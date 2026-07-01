#include <stdbool.h>
#include <string.h>

#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "esp_err.h"
#include "esp_log.h"
#include "esp_task_wdt.h"

#include "adc_sampler.h"
#include "boot_support.h"
#include "cloud_settings.h"
#include "connection_policy.h"
#include "identity_service.h"
#include "iot_hub_client.h"
#include "led_driver.h"
#include "nvs_storage.h"
#include "runtime_config.h"
#include "wifi_manager.h"
#include "wifi_recovery.h"

static const char *TAG = "main";
static int s_sample_buffer[SAMPLES_PER_BATCH];

void app_main(void)
{
    char serial_number[NVS_SERIAL_NUMBER_MAX_LEN + 1] = {0};
    char wifi_ssid[NVS_WIFI_SSID_MAX_LEN + 1] = {0};
    char wifi_password[NVS_WIFI_PASSWORD_MAX_LEN + 1] = {0};
    iot_hub_client_settings_t iot_hub_settings = {0};
    iot_hub_state_t cloud_state = {0};
    int reconnect_failures = 0;

    ESP_LOGI(TAG, "Hazard Hero firmware starting");

    esp_err_t err = nvs_storage_init();
    if (err != ESP_OK) {
        boot_support_fatal_restart("Failed to initialize NVS storage", err);
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
    }

    vTaskDelay(pdMS_TO_TICKS(NETWORK_STABILITY_DELAY_MS));

    err = adc_sampler_init();
    if (err != ESP_OK) {
        boot_support_fatal_restart("Failed to initialize ADC sampler", err);
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
    led_driver_set_status(cloud_state.status);

    err = boot_support_init_task_wdt();
    if (err != ESP_OK) {
        boot_support_fatal_restart("Failed to initialize task watchdog", err);
    }

    ESP_LOGI(TAG, "Initialization complete; entering main loop");

    while (true) {
        esp_task_wdt_reset();

        err = iot_hub_client_get_state(&cloud_state);
        if (err != ESP_OK) {
            ESP_LOGE(TAG, "Failed to read cached IoT Hub state: %s", esp_err_to_name(err));
            led_driver_set_status(STATUS_ERROR);
            vTaskDelay(pdMS_TO_TICKS(DEFAULT_TELEMETRY_INTERVAL_MS));
            continue;
        }

        led_driver_set_status(cloud_state.status);

        if (!wifi_sta_is_connected()) {
            led_driver_set_status(STATUS_CONNECTING);
            err = wifi_recovery_attempt(&reconnect_failures);
            if (err == ESP_OK) {
                vTaskDelay(pdMS_TO_TICKS(NETWORK_STABILITY_DELAY_MS));
            } else {
                vTaskDelay(pdMS_TO_TICKS(DEFAULT_TELEMETRY_INTERVAL_MS));
            }
            continue;
        }

        reconnect_failures = 0;

        if (!cloud_state.telemetry_enabled) {
            vTaskDelay(pdMS_TO_TICKS(cloud_state.telemetry_interval_ms));
            continue;
        }

        if (cloud_state.status != STATUS_AVAILABLE) {
            ESP_LOGI(TAG, "Skipping telemetry while status is %d", cloud_state.status);
            vTaskDelay(pdMS_TO_TICKS(cloud_state.telemetry_interval_ms));
            continue;
        }

        esp_task_wdt_reset();
        err = adc_sampler_collect_batch(s_sample_buffer, sizeof(s_sample_buffer));
        if (err != ESP_OK) {
            ESP_LOGE(TAG, "ADC sampling failed: %s", esp_err_to_name(err));
            led_driver_set_status(STATUS_ERROR);
            vTaskDelay(pdMS_TO_TICKS(cloud_state.telemetry_interval_ms));
            continue;
        }

        esp_task_wdt_reset();
        err = iot_hub_client_publish_telemetry(s_sample_buffer, SAMPLES_PER_BATCH);
        if (err != ESP_OK && err != ESP_ERR_NO_MEM) {
            ESP_LOGW(TAG, "Telemetry publish deferred: %s", esp_err_to_name(err));
        }

        vTaskDelay(pdMS_TO_TICKS(cloud_state.telemetry_interval_ms));
    }
}
