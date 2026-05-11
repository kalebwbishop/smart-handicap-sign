#include "led_driver.h"

#include <stdbool.h>
#include <stdint.h>
#include <string.h>

#include "esp_log.h"
#include "esp_timer.h"
#include "freertos/FreeRTOS.h"
#include "freertos/portmacro.h"

typedef struct {
    uint16_t on_ms;
    uint16_t off_ms;
} led_step_t;

typedef struct {
    const led_step_t *steps;
    uint8_t step_count;
} led_pattern_t;

static const char *TAG = "led_driver";

static const led_step_t AVAILABLE_STEPS[] = {
    {1000, 2000},
};

static const led_step_t ASSISTANCE_REQUESTED_STEPS[] = {
    {200, 200},
};

static const led_step_t ASSISTANCE_IN_PROGRESS_STEPS[] = {
    {150, 150},
    {150, 800},
};

static const led_step_t OFFLINE_STEPS[] = {
    {0, 1000},
};

static const led_step_t ERROR_STEPS[] = {
    {100, 100},
    {100, 100},
    {100, 800},
};

static const led_step_t TRAINING_READY_STEPS[] = {
    {500, 500},
};

static const led_step_t TRAINING_POSITIVE_STEPS[] = {
    {1000, 0},
};

static const led_step_t TRAINING_NEGATIVE_STEPS[] = {
    {100, 100},
};

static const led_pattern_t LED_PATTERNS[STATUS_COUNT] = {
    [STATUS_AVAILABLE] = {.steps = AVAILABLE_STEPS, .step_count = 1},
    [STATUS_ASSISTANCE_REQUESTED] = {.steps = ASSISTANCE_REQUESTED_STEPS, .step_count = 1},
    [STATUS_ASSISTANCE_IN_PROGRESS] = {.steps = ASSISTANCE_IN_PROGRESS_STEPS, .step_count = 2},
    [STATUS_OFFLINE] = {.steps = OFFLINE_STEPS, .step_count = 1},
    [STATUS_ERROR] = {.steps = ERROR_STEPS, .step_count = 3},
    [STATUS_TRAINING_READY] = {.steps = TRAINING_READY_STEPS, .step_count = 1},
    [STATUS_TRAINING_POSITIVE] = {.steps = TRAINING_POSITIVE_STEPS, .step_count = 1},
    [STATUS_TRAINING_NEGATIVE] = {.steps = TRAINING_NEGATIVE_STEPS, .step_count = 1},
};

static device_status_t s_current_status = STATUS_OFFLINE;
static uint8_t s_step_index = 0;
static uint8_t s_phase = 0;
static esp_timer_handle_t s_timer = NULL;
static bool s_initialized = false;
static bool s_enabled = false;
static uint32_t s_generation = 0;
static portMUX_TYPE s_state_lock = portMUX_INITIALIZER_UNLOCKED;

static uint64_t led_driver_delay_to_us(uint16_t delay_ms)
{
    uint16_t safe_delay_ms = delay_ms > 0 ? delay_ms : 1000;
    return (uint64_t)safe_delay_ms * 1000ULL;
}

static const led_pattern_t *led_driver_get_pattern(device_status_t status)
{
    if (status >= STATUS_COUNT) {
        status = STATUS_OFFLINE;
    }

    return &LED_PATTERNS[status];
}

static void led_driver_advance_step(const led_pattern_t *pattern)
{
    s_step_index = (uint8_t)((s_step_index + 1U) % pattern->step_count);
}

static void led_driver_schedule_next(void)
{
    if (s_timer == NULL) {
        return;
    }

    uint64_t delay_us = 0;
    int level = 0;
    uint32_t generation = 0;

    portENTER_CRITICAL(&s_state_lock);

    if (!s_enabled) {
        portEXIT_CRITICAL(&s_state_lock);
        gpio_set_level(LED_GPIO, 0);
        return;
    }

    const led_pattern_t *pattern = led_driver_get_pattern(s_current_status);
    const led_step_t step = pattern->steps[s_step_index];
    generation = s_generation;

    if (s_phase == 0U) {
        if (step.on_ms == 0U) {
            level = 0;
            delay_us = led_driver_delay_to_us(step.off_ms);
            led_driver_advance_step(pattern);
            s_phase = 0U;
        } else if (step.off_ms == 0U) {
            level = 1;
            delay_us = led_driver_delay_to_us(step.on_ms);
            led_driver_advance_step(pattern);
            s_phase = 0U;
        } else {
            level = 1;
            delay_us = led_driver_delay_to_us(step.on_ms);
            s_phase = 1U;
        }
    } else {
        level = 0;
        delay_us = led_driver_delay_to_us(step.off_ms);
        led_driver_advance_step(pattern);
        s_phase = 0U;
    }

    portEXIT_CRITICAL(&s_state_lock);

    gpio_set_level(LED_GPIO, level);

    portENTER_CRITICAL(&s_state_lock);
    bool should_schedule = s_enabled && (generation == s_generation);
    portEXIT_CRITICAL(&s_state_lock);

    if (!should_schedule) {
        return;
    }

    esp_err_t err = esp_timer_start_once(s_timer, delay_us);
    if (err != ESP_OK) {
        ESP_LOGW(TAG, "Failed to schedule LED timer: %s", esp_err_to_name(err));
    }
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

    gpio_reset_pin(LED_GPIO);
    gpio_set_direction(LED_GPIO, GPIO_MODE_OUTPUT);
    gpio_set_level(LED_GPIO, 0);

    const esp_timer_create_args_t timer_args = {
        .callback = led_driver_timer_callback,
        .arg = NULL,
        .dispatch_method = ESP_TIMER_TASK,
        .name = "led_driver",
        .skip_unhandled_events = true,
    };

    esp_err_t err = esp_timer_create(&timer_args, &s_timer);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "Failed to create LED timer: %s", esp_err_to_name(err));
        return err;
    }

    s_initialized = true;
    s_current_status = STATUS_OFFLINE;
    s_step_index = 0U;
    s_phase = 0U;
    s_enabled = true;
    s_generation++;

    led_driver_schedule_next();
    ESP_LOGI(TAG, "LED driver initialized on GPIO %d", LED_GPIO);
    return ESP_OK;
}

void led_driver_set_status(device_status_t status)
{
    if (!s_initialized) {
        return;
    }

    if (status >= STATUS_COUNT) {
        status = STATUS_OFFLINE;
    }

    portENTER_CRITICAL(&s_state_lock);
    if (s_enabled && s_current_status == status) {
        portEXIT_CRITICAL(&s_state_lock);
        return;
    }
    portEXIT_CRITICAL(&s_state_lock);

    esp_err_t stop_err = esp_timer_stop(s_timer);
    if (stop_err != ESP_OK && stop_err != ESP_ERR_INVALID_STATE) {
        ESP_LOGW(TAG, "Failed to stop LED timer: %s", esp_err_to_name(stop_err));
    }

    portENTER_CRITICAL(&s_state_lock);
    s_current_status = status;
    s_step_index = 0U;
    s_phase = 0U;
    s_enabled = true;
    s_generation++;
    portEXIT_CRITICAL(&s_state_lock);

    led_driver_schedule_next();
}

device_status_t led_driver_status_from_string(const char *status_str)
{
    if (status_str == NULL) {
        return STATUS_OFFLINE;
    }

    if (strcmp(status_str, "available") == 0) {
        return STATUS_AVAILABLE;
    }
    if (strcmp(status_str, "assistance_requested") == 0) {
        return STATUS_ASSISTANCE_REQUESTED;
    }
    if (strcmp(status_str, "assistance_in_progress") == 0) {
        return STATUS_ASSISTANCE_IN_PROGRESS;
    }
    if (strcmp(status_str, "offline") == 0) {
        return STATUS_OFFLINE;
    }
    if (strcmp(status_str, "error") == 0) {
        return STATUS_ERROR;
    }
    if (strcmp(status_str, "training_ready") == 0) {
        return STATUS_TRAINING_READY;
    }
    if (strcmp(status_str, "training_positive") == 0) {
        return STATUS_TRAINING_POSITIVE;
    }
    if (strcmp(status_str, "training_negative") == 0) {
        return STATUS_TRAINING_NEGATIVE;
    }

    return STATUS_OFFLINE;
}

void led_driver_off(void)
{
    if (!s_initialized) {
        return;
    }

    esp_err_t stop_err = esp_timer_stop(s_timer);
    if (stop_err != ESP_OK && stop_err != ESP_ERR_INVALID_STATE) {
        ESP_LOGW(TAG, "Failed to stop LED timer: %s", esp_err_to_name(stop_err));
    }

    portENTER_CRITICAL(&s_state_lock);
    s_current_status = STATUS_COUNT;
    s_step_index = 0U;
    s_phase = 0U;
    s_enabled = false;
    s_generation++;
    portEXIT_CRITICAL(&s_state_lock);

    gpio_set_level(LED_GPIO, 0);
}
