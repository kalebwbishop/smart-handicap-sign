#include "led_driver.h"

#include <stdbool.h>
#include <stdlib.h>
#include <string.h>

#include "esp_log.h"
#include "esp_timer.h"
#include "freertos/FreeRTOS.h"
#include "freertos/semphr.h"
#include "led_strip.h"

typedef struct {
    led_rgb_t color;
    uint16_t on_ms;
    uint16_t off_ms;
} led_step_t;

typedef struct {
    const led_step_t *steps;
    size_t step_count;
} led_pattern_t;

static const char *TAG = "led_driver";

static const led_step_t AVAILABLE_STEPS[] = {{{0, 255, 0}, 120, 1880}};
static const led_step_t BOOTING_STEPS[] = {
    {{255, 255, 255}, 180, 180},
    {{255, 255, 255}, 180, 900},
};
static const led_step_t CONNECTION_NEEDED_STEPS[] = {
    {{255, 160, 0}, 90, 90},
    {{255, 160, 0}, 90, 90},
    {{255, 160, 0}, 90, 900},
};
static const led_step_t CONNECTING_STEPS[] = {{{0, 160, 255}, 450, 450}};
static const led_step_t ASSISTANCE_REQUESTED_STEPS[] = {
    {{255, 0, 0}, 120, 120},
    {{255, 0, 0}, 120, 120},
    {{255, 0, 0}, 120, 800},
};
static const led_step_t ASSISTANCE_IN_PROGRESS_STEPS[] = {{{0, 255, 0}, 750, 250}};
static const led_step_t OFFLINE_STEPS[] = {{{255, 255, 255}, 80, 2920}};
static const led_step_t ERROR_STEPS[] = {{{255, 0, 0}, 100, 100}};

static const led_pattern_t LED_PATTERNS[STATUS_COUNT] = {
    [STATUS_BOOTING] = {BOOTING_STEPS, sizeof(BOOTING_STEPS) / sizeof(BOOTING_STEPS[0])},
    [STATUS_CONNECTION_NEEDED] = {CONNECTION_NEEDED_STEPS, sizeof(CONNECTION_NEEDED_STEPS) / sizeof(CONNECTION_NEEDED_STEPS[0])},
    [STATUS_CONNECTING] = {CONNECTING_STEPS, sizeof(CONNECTING_STEPS) / sizeof(CONNECTING_STEPS[0])},
    [STATUS_AVAILABLE] = {AVAILABLE_STEPS, sizeof(AVAILABLE_STEPS) / sizeof(AVAILABLE_STEPS[0])},
    [STATUS_ASSISTANCE_REQUESTED] = {ASSISTANCE_REQUESTED_STEPS, sizeof(ASSISTANCE_REQUESTED_STEPS) / sizeof(ASSISTANCE_REQUESTED_STEPS[0])},
    [STATUS_ASSISTANCE_IN_PROGRESS] = {ASSISTANCE_IN_PROGRESS_STEPS, sizeof(ASSISTANCE_IN_PROGRESS_STEPS) / sizeof(ASSISTANCE_IN_PROGRESS_STEPS[0])},
    [STATUS_OFFLINE] = {OFFLINE_STEPS, sizeof(OFFLINE_STEPS) / sizeof(OFFLINE_STEPS[0])},
    [STATUS_ERROR] = {ERROR_STEPS, sizeof(ERROR_STEPS) / sizeof(ERROR_STEPS[0])},
};

static led_strip_handle_t s_strip;
static led_rgb_t *s_pixels;
static SemaphoreHandle_t s_render_mutex;
static SemaphoreHandle_t s_state_mutex;
static esp_timer_handle_t s_timer;
static device_operational_status_t s_current_status = STATUS_OFFLINE;
static size_t s_step_index;
static bool s_step_off;
static uint8_t s_brightness = LED_BRIGHTNESS;
static bool s_initialized;
static bool s_enabled;
static bool s_dirty;

static uint8_t led_driver_scale(uint8_t value)
{
    return (uint8_t)(((uint16_t)value * s_brightness + 127U) / 255U);
}

static const led_pattern_t *led_driver_get_pattern(device_operational_status_t status)
{
    if (status >= STATUS_COUNT || LED_PATTERNS[status].steps == NULL) {
        return &LED_PATTERNS[STATUS_OFFLINE];
    }
    return &LED_PATTERNS[status];
}

static esp_err_t led_driver_write_pixel(size_t index)
{
    return led_strip_set_pixel(
        s_strip,
        index,
        led_driver_scale(s_pixels[index].red),
        led_driver_scale(s_pixels[index].green),
        led_driver_scale(s_pixels[index].blue));
}

void led_driver_set_pixel(size_t index, led_rgb_t color)
{
    if (!s_initialized || index >= LED_NUM_LEDS || xSemaphoreTake(s_render_mutex, portMAX_DELAY) != pdTRUE) {
        return;
    }

    if (memcmp(&s_pixels[index], &color, sizeof(color)) != 0) {
        s_pixels[index] = color;
        esp_err_t err = led_driver_write_pixel(index);
        if (err != ESP_OK) {
            ESP_LOGW(TAG, "Failed to update pixel %u: %s", (unsigned)index, esp_err_to_name(err));
        } else {
            s_dirty = true;
        }
    }
    xSemaphoreGive(s_render_mutex);
}

void led_driver_set_color(led_rgb_t color)
{
    if (!s_initialized || xSemaphoreTake(s_render_mutex, portMAX_DELAY) != pdTRUE) {
        return;
    }

    for (size_t index = 0; index < LED_NUM_LEDS; ++index) {
        if (memcmp(&s_pixels[index], &color, sizeof(color)) == 0) {
            continue;
        }
        s_pixels[index] = color;
        esp_err_t err = led_driver_write_pixel(index);
        if (err != ESP_OK) {
            ESP_LOGW(TAG, "Failed to update pixel %u: %s", (unsigned)index, esp_err_to_name(err));
        } else {
            s_dirty = true;
        }
    }
    xSemaphoreGive(s_render_mutex);
}

void led_driver_clear(void)
{
    led_driver_set_color((led_rgb_t){0, 0, 0});
}

esp_err_t led_driver_show(void)
{
    if (!s_initialized || xSemaphoreTake(s_render_mutex, portMAX_DELAY) != pdTRUE) {
        return ESP_ERR_INVALID_STATE;
    }

    esp_err_t err = ESP_OK;
    if (s_dirty) {
        err = led_strip_refresh(s_strip);
        if (err == ESP_OK) {
            s_dirty = false;
        }
    }
    xSemaphoreGive(s_render_mutex);
    return err;
}

void led_driver_set_brightness(uint16_t brightness)
{
    if (!s_initialized || xSemaphoreTake(s_render_mutex, portMAX_DELAY) != pdTRUE) {
        return;
    }

    uint8_t clamped_brightness = brightness > UINT8_MAX ? UINT8_MAX : (uint8_t)brightness;
    if (s_brightness != clamped_brightness) {
        s_brightness = clamped_brightness;
        for (size_t index = 0; index < LED_NUM_LEDS; ++index) {
            esp_err_t err = led_driver_write_pixel(index);
            if (err != ESP_OK) {
                ESP_LOGW(TAG, "Failed to apply brightness to pixel %u: %s", (unsigned)index, esp_err_to_name(err));
            } else {
                s_dirty = true;
            }
        }
    }
    xSemaphoreGive(s_render_mutex);
}

static void led_driver_schedule_next_locked(void)
{
    if (s_timer == NULL || !s_enabled) {
        return;
    }

    const led_pattern_t *pattern = led_driver_get_pattern(s_current_status);
    const led_step_t step = pattern->steps[s_step_index];

    if (!s_step_off) {
        led_driver_set_color(step.color);
    } else {
        led_driver_clear();
    }
    esp_err_t err = led_driver_show();
    if (err != ESP_OK) {
        ESP_LOGW(TAG, "Failed to refresh LED strip: %s", esp_err_to_name(err));
    }

    uint16_t delay_ms = s_step_off ? step.off_ms : step.on_ms;
    if (s_step_off || step.off_ms == 0U) {
        s_step_index = (s_step_index + 1U) % pattern->step_count;
        s_step_off = false;
    } else {
        s_step_off = true;
    }
    if (delay_ms == 0U) {
        delay_ms = 1000U;
    }

    err = esp_timer_start_once(s_timer, (uint64_t)delay_ms * 1000ULL);
    if (err != ESP_OK) {
        ESP_LOGW(TAG, "Failed to schedule LED timer: %s", esp_err_to_name(err));
    }
}

static void led_driver_schedule_next(void)
{
    if (s_state_mutex == NULL || xSemaphoreTake(s_state_mutex, portMAX_DELAY) != pdTRUE) {
        return;
    }
    led_driver_schedule_next_locked();
    xSemaphoreGive(s_state_mutex);
}

static void led_driver_timer_callback(void *arg)
{
    (void)arg;
    led_driver_schedule_next();
}

esp_err_t led_driver_init(void)
{
    if (s_initialized) {
        return ESP_OK;
    }

    s_pixels = calloc(LED_NUM_LEDS, sizeof(*s_pixels));
    if (s_pixels == NULL) {
        return ESP_ERR_NO_MEM;
    }

    s_render_mutex = xSemaphoreCreateMutex();
    if (s_render_mutex == NULL) {
        free(s_pixels);
        s_pixels = NULL;
        return ESP_ERR_NO_MEM;
    }
    s_state_mutex = xSemaphoreCreateMutex();
    if (s_state_mutex == NULL) {
        vSemaphoreDelete(s_render_mutex);
        s_render_mutex = NULL;
        free(s_pixels);
        s_pixels = NULL;
        return ESP_ERR_NO_MEM;
    }

    const led_strip_config_t strip_config = {
        .strip_gpio_num = LED_DATA_PIN,
        .max_leds = LED_NUM_LEDS,
        .led_model = LED_MODEL_WS2812,
        .color_component_format = LED_STRIP_COLOR_COMPONENT_FMT_GRB,
        .flags.invert_out = false,
    };
    const led_strip_rmt_config_t rmt_config = {
        .clk_src = RMT_CLK_SRC_DEFAULT,
        .resolution_hz = 10 * 1000 * 1000,
        .mem_block_symbols = 64,
        .flags.with_dma = false,
    };

    esp_err_t err = led_strip_new_rmt_device(&strip_config, &rmt_config, &s_strip);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "Failed to initialize WS2812B strip: %s", esp_err_to_name(err));
        vSemaphoreDelete(s_state_mutex);
        s_state_mutex = NULL;
        vSemaphoreDelete(s_render_mutex);
        s_render_mutex = NULL;
        free(s_pixels);
        s_pixels = NULL;
        return err;
    }

    const esp_timer_create_args_t timer_args = {
        .callback = led_driver_timer_callback,
        .name = "led_driver",
        .skip_unhandled_events = true,
    };
    err = esp_timer_create(&timer_args, &s_timer);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "Failed to create LED timer: %s", esp_err_to_name(err));
        led_strip_del(s_strip);
        s_strip = NULL;
        vSemaphoreDelete(s_state_mutex);
        s_state_mutex = NULL;
        vSemaphoreDelete(s_render_mutex);
        s_render_mutex = NULL;
        free(s_pixels);
        s_pixels = NULL;
        return err;
    }

    s_initialized = true;
    s_enabled = true;
    s_step_off = false;
    s_dirty = true;
    led_driver_set_brightness(LED_BRIGHTNESS);
    led_driver_clear();
    err = led_driver_show();
    if (err != ESP_OK) {
        return err;
    }
    led_driver_schedule_next();
    ESP_LOGI(TAG, "WS2812B LED driver initialized on GPIO %d with %d LEDs", LED_DATA_PIN, LED_NUM_LEDS);
    return ESP_OK;
}

void led_driver_set_status(device_operational_status_t status)
{
    if (!s_initialized) {
        return;
    }
    if (status >= STATUS_COUNT) {
        status = STATUS_OFFLINE;
    }

    if (xSemaphoreTake(s_state_mutex, portMAX_DELAY) != pdTRUE) {
        return;
    }
    if (s_enabled && s_current_status == status) {
        xSemaphoreGive(s_state_mutex);
        return;
    }
    esp_err_t stop_err = esp_timer_stop(s_timer);
    if (stop_err != ESP_OK && stop_err != ESP_ERR_INVALID_STATE) {
        ESP_LOGW(TAG, "Failed to stop LED timer: %s", esp_err_to_name(stop_err));
    }
    s_current_status = status;
    s_step_index = 0;
    s_step_off = false;
    s_enabled = true;
    led_driver_schedule_next_locked();
    xSemaphoreGive(s_state_mutex);
}

device_operational_status_t led_driver_status_from_string(const char *status_str)
{
    if (status_str == NULL) {
        return STATUS_OFFLINE;
    }
    if (strcmp(status_str, "available") == 0) return STATUS_AVAILABLE;
    if (strcmp(status_str, "booting") == 0) return STATUS_BOOTING;
    if (strcmp(status_str, "connection_needed") == 0) return STATUS_CONNECTION_NEEDED;
    if (strcmp(status_str, "connecting") == 0) return STATUS_CONNECTING;
    if (strcmp(status_str, "assistance_requested") == 0) return STATUS_ASSISTANCE_REQUESTED;
    if (strcmp(status_str, "assistance_in_progress") == 0) return STATUS_ASSISTANCE_IN_PROGRESS;
    if (strcmp(status_str, "offline") == 0) return STATUS_OFFLINE;
    if (strcmp(status_str, "error") == 0) return STATUS_ERROR;
    return STATUS_OFFLINE;
}

void led_driver_off(void)
{
    if (!s_initialized) {
        return;
    }
    if (xSemaphoreTake(s_state_mutex, portMAX_DELAY) != pdTRUE) {
        return;
    }
    esp_err_t stop_err = esp_timer_stop(s_timer);
    if (stop_err != ESP_OK && stop_err != ESP_ERR_INVALID_STATE) {
        ESP_LOGW(TAG, "Failed to stop LED timer: %s", esp_err_to_name(stop_err));
    }
    s_enabled = false;
    s_step_off = false;
    led_driver_clear();
    esp_err_t err = led_driver_show();
    if (err != ESP_OK) {
        ESP_LOGW(TAG, "Failed to refresh LED strip while turning off: %s", esp_err_to_name(err));
    }
    xSemaphoreGive(s_state_mutex);
}
