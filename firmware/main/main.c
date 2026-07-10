#include <stdbool.h>
#include <string.h>

#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "esp_system.h"
#include "esp_timer.h"
#include "esp_wifi.h"
#include "esp_err.h"
#include "esp_log.h"
#include "esp_task_wdt.h"

#include "adc_sampler.h"
#include "boot_support.h"
#include "cloud_settings.h"
#include "device_manager.h"
#include "connection_policy.h"
#include "identity_service.h"
#include "iot_hub_client.h"
#include "led_driver.h"
#include "nvs_storage.h"
#include "runtime_config.h"
#include "wifi_manager.h"
#include "wifi_recovery.h"

static const char *TAG = "main";

#define TELEMETRY_RING_CAPACITY 200U
#define TELEMETRY_PUBLISH_INTERVAL_MS 5000U
#define HEARTBEAT_PUBLISH_INTERVAL_MS 60000U

typedef struct {
    int samples[TELEMETRY_RING_CAPACITY];
    size_t head;
    size_t tail;
    size_t count;
    portMUX_TYPE lock;
} telemetry_ring_t;

static telemetry_ring_t s_telemetry_ring = {
    .head = 0U,
    .tail = 0U,
    .count = 0U,
    .lock = portMUX_INITIALIZER_UNLOCKED,
};

static int get_wifi_rssi_dbm(void)
{
    wifi_ap_record_t ap_info;
    if (esp_wifi_sta_get_ap_info(&ap_info) != ESP_OK) {
        return -127;
    }
    return (int)ap_info.rssi;
}

static void telemetry_ring_push(int sample)
{
    portENTER_CRITICAL(&s_telemetry_ring.lock);

    s_telemetry_ring.samples[s_telemetry_ring.head] = sample;
    s_telemetry_ring.head = (s_telemetry_ring.head + 1U) % TELEMETRY_RING_CAPACITY;

    if (s_telemetry_ring.count == TELEMETRY_RING_CAPACITY) {
        s_telemetry_ring.tail = (s_telemetry_ring.tail + 1U) % TELEMETRY_RING_CAPACITY;
    } else {
        s_telemetry_ring.count++;
    }

    portEXIT_CRITICAL(&s_telemetry_ring.lock);
}

static size_t telemetry_ring_snapshot(int *buffer, size_t buffer_len)
{
    if (buffer == NULL || buffer_len == 0U) {
        return 0U;
    }

    portENTER_CRITICAL(&s_telemetry_ring.lock);

    size_t to_copy = s_telemetry_ring.count < buffer_len ? s_telemetry_ring.count : buffer_len;
    for (size_t i = 0U; i < to_copy; ++i) {
        size_t index = (s_telemetry_ring.tail + i) % TELEMETRY_RING_CAPACITY;
        buffer[i] = s_telemetry_ring.samples[index];
    }

    portEXIT_CRITICAL(&s_telemetry_ring.lock);
    return to_copy;
}

static void telemetry_ring_advance(size_t consumed)
{
    portENTER_CRITICAL(&s_telemetry_ring.lock);

    if (consumed >= s_telemetry_ring.count) {
        s_telemetry_ring.tail = s_telemetry_ring.head;
        s_telemetry_ring.count = 0U;
    } else {
        s_telemetry_ring.tail = (s_telemetry_ring.tail + consumed) % TELEMETRY_RING_CAPACITY;
        s_telemetry_ring.count -= consumed;
    }

    portEXIT_CRITICAL(&s_telemetry_ring.lock);
}

static void telemetry_sampler_task(void *arg)
{
    (void)arg;

    while (true) {
        int sample = adc_sampler_read_raw();
        if (sample >= 0) {
            telemetry_ring_push(sample);
        }

        vTaskDelay(pdMS_TO_TICKS(SAMPLE_INTERVAL_MS));
    }
}

void app_main(void)
{
    char serial_number[NVS_SERIAL_NUMBER_MAX_LEN + 1] = {0};
    char wifi_ssid[NVS_WIFI_SSID_MAX_LEN + 1] = {0};
    char wifi_password[NVS_WIFI_PASSWORD_MAX_LEN + 1] = {0};
    iot_hub_client_settings_t iot_hub_settings = {0};
    iot_hub_state_t cloud_state = {0};
    int reconnect_failures = 0;
    int64_t boot_time_us = esp_timer_get_time();
    int64_t last_heartbeat_us = 0;
    int64_t wifi_connected_since_us = 0;

    ESP_LOGI(TAG, "Hazard Hero firmware starting");

    esp_err_t err = nvs_storage_init();
    if (err != ESP_OK) {
        boot_support_fatal_restart("Failed to initialize NVS storage", err);
    }

    // Reset wifi credentials if GPIO0 is pressed at boot
    if (gpio_get_level(GPIO_NUM_0) == 0) {
        ESP_LOGI(TAG, "GPIO0 pressed at boot, resetting WiFi credentials");
        nvs_wifi_clear();
    }

    err = led_driver_init();
    if (err != ESP_OK) {
        boot_support_fatal_restart("Failed to initialize LED driver", err);
    }
    led_driver_set_status(STATUS_BOOTING);

    err = identity_service_load_device_serial_number(serial_number, sizeof(serial_number));
    if (err != ESP_OK) {
        boot_support_fatal_restart("Failed to load device serial number", err);
    }
    ESP_LOGI(TAG, "Device serial number: %s", serial_number);

    err = wifi_manager_init();
    if (err != ESP_OK) {
        boot_support_fatal_restart("Failed to initialize WiFi manager", err);
    }

    if (!nvs_wifi_exists()) {
        boot_support_enter_provisioning_mode("No WiFi credentials found in NVS");
    }

    led_driver_set_status(STATUS_CONNECTING);
    err = nvs_wifi_load(wifi_ssid, sizeof(wifi_ssid), wifi_password, sizeof(wifi_password));
    if (err != ESP_OK) {
        boot_support_fatal_restart("Failed to load WiFi credentials", err);
    }

    err = wifi_sta_connect(wifi_ssid, wifi_password, WIFI_CONNECT_TIMEOUT_MS);
    memset(wifi_password, 0, sizeof(wifi_password));
    memset(wifi_ssid, 0, sizeof(wifi_ssid));
    if (err != ESP_OK) {
        ESP_LOGW(TAG, "Initial WiFi connection failed: %s", esp_err_to_name(err));
        led_driver_set_status(STATUS_ERROR);
        if (should_enter_provisioning_on_initial_connect_failure(nvs_wifi_is_validated())) {
            boot_support_enter_provisioning_mode("Unable to connect with saved WiFi credentials");
        }
        ESP_LOGW(TAG, "Saved WiFi credentials were previously validated; continuing without provisioning mode");
    } else {
        esp_err_t validated_err = nvs_wifi_set_validated(true);
        if (validated_err != ESP_OK) {
            ESP_LOGW(TAG, "Connected to WiFi but failed to persist validated flag: %s", esp_err_to_name(validated_err));
        }
        led_driver_set_status(STATUS_AVAILABLE);
        wifi_connected_since_us = esp_timer_get_time();
    }

    vTaskDelay(pdMS_TO_TICKS(NETWORK_STABILITY_DELAY_MS));

    err = adc_sampler_init();
    if (err != ESP_OK) {
        boot_support_fatal_restart("Failed to initialize ADC sampler", err);
    }

    err = battery_manager_init_adc();
    if (err != ESP_OK) {
        boot_support_fatal_restart("Failed to initialize battery manager ADC channel", err);
    }

    BaseType_t task_result = xTaskCreate(telemetry_sampler_task, "telemetry_sampler", 4096, NULL, 5, NULL);
    if (task_result != pdPASS) {
        boot_support_fatal_restart("Failed to start telemetry sampler task", ESP_FAIL);
    }

    err = cloud_settings_resolve_iot_hub_settings_x509(serial_number, &iot_hub_settings);
    if (err != ESP_OK) {
        boot_support_fatal_restart("Failed to build IoT Hub settings", err);
    }

    err = iot_hub_client_init(&iot_hub_settings, NULL);
    if (err != ESP_OK) {
        boot_support_fatal_restart("Failed to initialize IoT Hub client", err);
    }

    err = iot_hub_client_start();
    if (err != ESP_OK && err != ESP_ERR_NOT_FOUND) {
        ESP_LOGW(TAG, "IoT Hub client did not start cleanly: %s", esp_err_to_name(err));
    }

    err = iot_hub_client_get_state(&cloud_state);
    if (err != ESP_OK) {
        boot_support_fatal_restart("Failed to load cached IoT Hub state", err);
    }
    led_driver_set_status(cloud_state.operational_status);

    err = boot_support_init_task_wdt();
    if (err != ESP_OK) {
        boot_support_fatal_restart("Failed to initialize task watchdog", err);
    }

    ESP_LOGI(TAG, "Initialization complete; entering main loop");

    while (true) {
        ESP_LOGI(TAG, "Main loop iteration");
        esp_task_wdt_reset();

        err = iot_hub_client_get_state(&cloud_state);
        if (err != ESP_OK) {
            ESP_LOGE(TAG, "Failed to read cached IoT Hub state: %s", esp_err_to_name(err));
            led_driver_set_status(STATUS_ERROR);
            vTaskDelay(pdMS_TO_TICKS(TELEMETRY_PUBLISH_INTERVAL_MS));
            continue;
        }

        led_driver_set_status(cloud_state.operational_status);

        if (!wifi_sta_is_connected()) {
            led_driver_set_status(STATUS_CONNECTING);
            err = wifi_recovery_attempt(&reconnect_failures);
            if (err == ESP_OK) {
                wifi_connected_since_us = esp_timer_get_time();
                vTaskDelay(pdMS_TO_TICKS(NETWORK_STABILITY_DELAY_MS));
            } else {
                vTaskDelay(pdMS_TO_TICKS(TELEMETRY_PUBLISH_INTERVAL_MS));
            }
            continue;
        }

        if (wifi_connected_since_us == 0) {
            wifi_connected_since_us = esp_timer_get_time();
        }

        reconnect_failures = 0;

        int64_t now_us = esp_timer_get_time();
        if (last_heartbeat_us == 0 || (now_us - last_heartbeat_us) >= (int64_t)HEARTBEAT_PUBLISH_INTERVAL_MS * 1000LL) {
            iot_hub_state_t heartbeat_state = {0};
            err = iot_hub_client_get_state(&heartbeat_state);
            if (err == ESP_OK) {
                uint32_t uptime_ms = (uint32_t)((now_us - boot_time_us) / 1000LL);
                uint32_t wifi_connected_ms = (uint32_t)((now_us - wifi_connected_since_us) / 1000LL);
                int wifi_rssi_dbm = get_wifi_rssi_dbm();
                err = iot_hub_client_publish_heartbeat(
                    uptime_ms,
                    wifi_connected_ms,
                    wifi_rssi_dbm,
                    battery_manager_read_percentage(),
                    heartbeat_state.telemetry_interval_ms,
                    heartbeat_state.telemetry_enabled,
                    heartbeat_state.operational_status);
                if (err == ESP_OK) {
                    last_heartbeat_us = now_us;
                } else {
                    ESP_LOGW(TAG, "Heartbeat publish deferred: %s", esp_err_to_name(err));
                }
            } else {
                ESP_LOGW(TAG, "Heartbeat state unavailable: %s", esp_err_to_name(err));
            }
        }

        if (!cloud_state.telemetry_enabled) {
            vTaskDelay(pdMS_TO_TICKS(TELEMETRY_PUBLISH_INTERVAL_MS));
            continue;
        }

        if (cloud_state.operational_status != STATUS_AVAILABLE) {
            ESP_LOGI(TAG, "Skipping telemetry while status is %d", cloud_state.operational_status);
            vTaskDelay(pdMS_TO_TICKS(TELEMETRY_PUBLISH_INTERVAL_MS));
            continue;
        }

        int publish_buffer[TELEMETRY_RING_CAPACITY] = {0};
        size_t publish_count = telemetry_ring_snapshot(publish_buffer, TELEMETRY_RING_CAPACITY);

        if (publish_count > 0U) {
            // Don't publish telemetry if the range of the data is less than the minimum meaningful threshold
            int min_value = publish_buffer[0];
            int max_value = publish_buffer[0];
            for (size_t i = 1; i < publish_count; ++i) {
                if (publish_buffer[i] < min_value) {
                    min_value = publish_buffer[i];
                }
                if (publish_buffer[i] > max_value) {
                    max_value = publish_buffer[i];
                }
            }
            if ((max_value - min_value) < 217U) {
                ESP_LOGI(TAG, "Telemetry range too small, skipping publish");
                vTaskDelay(pdMS_TO_TICKS(TELEMETRY_PUBLISH_INTERVAL_MS / 4));
                continue;
            }

            err = iot_hub_client_publish_telemetry(publish_buffer, publish_count);
            if (err == ESP_OK) {
                telemetry_ring_advance(publish_count);
            } else {
                ESP_LOGW(TAG, "Telemetry publish deferred: %s", esp_err_to_name(err));
            }
        }

        vTaskDelay(pdMS_TO_TICKS(TELEMETRY_PUBLISH_INTERVAL_MS));
    }
}
