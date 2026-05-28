#include <stdbool.h>
#include <stdio.h>
#include <string.h>

#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "esp_log.h"
#include "esp_system.h"
#include "esp_task_wdt.h"

#include "adc_sampler.h"
#include "connection_policy.h"
#include "https_client.h"
#include "led_driver.h"
#include "nvs_storage.h"
#include "provisioning_server.h"
#include "wifi_manager.h"

#ifndef HAZARD_HERO_BACKEND_URL
#define HAZARD_HERO_BACKEND_URL "https://tqr9vxj0-8000.usw3.devtunnels.ms/api/v1"
#endif

#define NETWORK_STABILITY_DELAY_MS 2000
#define SEND_INTERVAL_MS        1000
#define STATUS_POLL_INTERVAL_MS 3000
#define MAX_RECONNECT_FAILURES  3
#define MAX_STATUS_RETRIES      3
#define STATUS_RETRY_DELAY_MS   2000
#define WIFI_CONNECT_TIMEOUT_MS 20000
#define WDT_TIMEOUT_MS          30000

static const char *TAG = "main";
static int s_sample_buffer[SAMPLES_PER_BATCH];

static void halt_forever(void)
{
    while (true) {
        vTaskDelay(pdMS_TO_TICKS(1000));
    }
}

static void disable_task_wdt(void)
{
    esp_err_t err = esp_task_wdt_delete(NULL);
    if (err != ESP_OK && err != ESP_ERR_NOT_FOUND && err != ESP_ERR_INVALID_STATE) {
        ESP_LOGW(TAG, "Failed to unsubscribe main task from WDT: %s", esp_err_to_name(err));
    }

    err = esp_task_wdt_deinit();
    if (err != ESP_OK && err != ESP_ERR_INVALID_STATE) {
        ESP_LOGW(TAG, "Failed to deinitialize task WDT: %s", esp_err_to_name(err));
    }
}

static void fatal_restart(const char *message, esp_err_t err)
{
    ESP_LOGE(TAG, "%s: %s", message, esp_err_to_name(err));
    led_driver_set_status(STATUS_ERROR);
    vTaskDelay(pdMS_TO_TICKS(5000));
    esp_restart();
}

static void enter_provisioning_mode(const char *reason)
{
    ESP_LOGW(TAG, "Entering provisioning mode: %s", reason);
    led_driver_set_status(STATUS_OFFLINE);
    disable_task_wdt();

    esp_err_t err = wifi_ap_start();
    if (err != ESP_OK) {
        fatal_restart("Failed to start SoftAP", err);
    }

    err = provisioning_server_start();
    if (err != ESP_OK) {
        fatal_restart("Failed to start provisioning server", err);
    }

    ESP_LOGI(TAG, "Provisioning server ready; waiting for WiFi configuration");
    halt_forever();
}

static esp_err_t init_task_wdt(void)
{
    const esp_task_wdt_config_t config = {
        .timeout_ms = WDT_TIMEOUT_MS,
        .idle_core_mask = 0,
        .trigger_panic = true,
    };

    esp_err_t err = esp_task_wdt_init(&config);
    if (err != ESP_OK && err != ESP_ERR_INVALID_STATE) {
        return err;
    }

    err = esp_task_wdt_add(NULL);
    if (err != ESP_OK) {
        return err;
    }

    return ESP_OK;
}

static esp_err_t poll_status_with_retries(status_result_t *result)
{
    if (result == NULL) {
        return ESP_ERR_INVALID_ARG;
    }

    for (int attempt = 1; attempt <= MAX_STATUS_RETRIES; ++attempt) {
        esp_task_wdt_reset();

        esp_err_t err = https_client_get_status(result);
        if (err == ESP_OK && result->http_status == 200) {
            return ESP_OK;
        }

        if (err == ESP_OK) {
            ESP_LOGW(TAG, "Status poll attempt %d/%d returned HTTP %d", attempt, MAX_STATUS_RETRIES, result->http_status);
            err = ESP_FAIL;
        } else {
            ESP_LOGW(TAG, "Status poll attempt %d/%d failed: %s", attempt, MAX_STATUS_RETRIES, esp_err_to_name(err));
        }

        if (attempt < MAX_STATUS_RETRIES) {
            vTaskDelay(pdMS_TO_TICKS(STATUS_RETRY_DELAY_MS));
        }
    }

    return ESP_FAIL;
}

static esp_err_t load_device_identity(char *serial_number, size_t serial_len)
{
    if (serial_number == NULL || serial_len == 0U) {
        return ESP_ERR_INVALID_ARG;
    }

    if (nvs_identity_exists()) {
        return nvs_identity_load(serial_number, serial_len);
    }

    char generated_device_id[13] = {0};
    esp_err_t err = adc_sampler_get_device_id(generated_device_id, sizeof(generated_device_id));
    if (err != ESP_OK) {
        return err;
    }

    err = nvs_identity_save(generated_device_id);
    if (err != ESP_OK) {
        return err;
    }

    strlcpy(serial_number, generated_device_id, serial_len);
    ESP_LOGW(TAG, "Device serial number missing from NVS; regenerated identity from MAC address");
    return ESP_OK;
}

static esp_err_t reconnect_wifi(int *failure_count)
{
    if (failure_count == NULL) {
        return ESP_ERR_INVALID_ARG;
    }

    if (!nvs_wifi_exists()) {
        enter_provisioning_mode("WiFi credentials missing during reconnect");
    }

    char ssid[NVS_WIFI_SSID_MAX_LEN + 1] = {0};
    char password[NVS_WIFI_PASSWORD_MAX_LEN + 1] = {0};

    esp_err_t err = nvs_wifi_load(ssid, sizeof(ssid), password, sizeof(password));
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "Failed to load WiFi credentials for reconnect: %s", esp_err_to_name(err));
        (*failure_count)++;
        return err;
    }

    ESP_LOGW(TAG, "Attempting WiFi reconnect");
    esp_task_wdt_reset();
    err = wifi_sta_connect(ssid, password, WIFI_CONNECT_TIMEOUT_MS);
    memset(password, 0, sizeof(password));
    memset(ssid, 0, sizeof(ssid));
    if (err == ESP_OK) {
        *failure_count = 0;
        esp_err_t validated_err = nvs_wifi_set_validated(true);
        if (validated_err != ESP_OK) {
            ESP_LOGW(TAG, "Connected to WiFi but failed to persist validated flag: %s", esp_err_to_name(validated_err));
        }
        ESP_LOGI(TAG, "WiFi reconnect succeeded");
        return ESP_OK;
    }

    (*failure_count)++;
    ESP_LOGW(TAG, "WiFi reconnect failed (%d/%d): %s", *failure_count, MAX_RECONNECT_FAILURES, esp_err_to_name(err));
    if (should_enter_provisioning_on_reconnect_failure(nvs_wifi_is_validated(), *failure_count, MAX_RECONNECT_FAILURES)) {
        enter_provisioning_mode("Exceeded maximum WiFi reconnect failures");
    }
    if (*failure_count >= MAX_RECONNECT_FAILURES) {
        ESP_LOGW(TAG, "Saved WiFi credentials were previously validated; staying out of provisioning mode");
        *failure_count = 0;
    }

    return err;
}

void app_main(void)
{
    char serial_number[NVS_SERIAL_NUMBER_MAX_LEN + 1] = {0};
    char wifi_ssid[NVS_WIFI_SSID_MAX_LEN + 1] = {0};
    char wifi_password[NVS_WIFI_PASSWORD_MAX_LEN + 1] = {0};
    int reconnect_failures = 0;

    ESP_LOGI(TAG, "Hazard Hero firmware starting");

    esp_err_t err = nvs_storage_init();
    if (err != ESP_OK) {
        fatal_restart("Failed to initialize NVS storage", err);
    }

    err = led_driver_init();
    if (err != ESP_OK) {
        fatal_restart("Failed to initialize LED driver", err);
    }

    err = load_device_identity(serial_number, sizeof(serial_number));
    if (err != ESP_OK) {
        fatal_restart("Failed to load device serial number", err);
    }
    ESP_LOGI(TAG, "Device serial number: %s", serial_number);

    err = wifi_manager_init();
    if (err != ESP_OK) {
        fatal_restart("Failed to initialize WiFi manager", err);
    }

    if (!nvs_wifi_exists()) {
        enter_provisioning_mode("No WiFi credentials found in NVS");
    }

    err = nvs_wifi_load(wifi_ssid, sizeof(wifi_ssid), wifi_password, sizeof(wifi_password));
    if (err != ESP_OK) {
        fatal_restart("Failed to load WiFi credentials", err);
    }

    err = wifi_sta_connect(wifi_ssid, wifi_password, WIFI_CONNECT_TIMEOUT_MS);
    memset(wifi_password, 0, sizeof(wifi_password));
    memset(wifi_ssid, 0, sizeof(wifi_ssid));
    if (err != ESP_OK) {
        ESP_LOGW(TAG, "Initial WiFi connection failed: %s", esp_err_to_name(err));
        if (should_enter_provisioning_on_initial_connect_failure(nvs_wifi_is_validated())) {
            enter_provisioning_mode("Unable to connect with saved WiFi credentials");
        }
        ESP_LOGW(TAG, "Saved WiFi credentials were previously validated; continuing without provisioning mode");
    } else {
        esp_err_t validated_err = nvs_wifi_set_validated(true);
        if (validated_err != ESP_OK) {
            ESP_LOGW(TAG, "Connected to WiFi but failed to persist validated flag: %s", esp_err_to_name(validated_err));
        }
    }

    vTaskDelay(pdMS_TO_TICKS(NETWORK_STABILITY_DELAY_MS));

    err = adc_sampler_init();
    if (err != ESP_OK) {
        fatal_restart("Failed to initialize ADC sampler", err);
    }

    err = https_client_init(HAZARD_HERO_BACKEND_URL);
    if (err != ESP_OK) {
        fatal_restart("Failed to initialize HTTPS client", err);
    }

    led_driver_set_status(STATUS_AVAILABLE);

    err = init_task_wdt();
    if (err != ESP_OK) {
        fatal_restart("Failed to initialize task watchdog", err);
    }

    ESP_LOGI(TAG, "Initialization complete; entering main loop");

    while (true) {
        status_result_t status_result = {0};
        classify_result_t classify_result = {0};

        esp_task_wdt_reset();

        err = poll_status_with_retries(&status_result);
        if (err != ESP_OK) {
            ESP_LOGW(TAG, "Status polling failed after %d attempts", MAX_STATUS_RETRIES);
            err = reconnect_wifi(&reconnect_failures);
            if (err == ESP_OK) {
                vTaskDelay(pdMS_TO_TICKS(NETWORK_STABILITY_DELAY_MS));
            }
            continue;
        }

        reconnect_failures = 0;
        ESP_LOGI(TAG, "Device status: %s", status_result.status_str);
        led_driver_set_status(status_result.status);

        if (status_result.status != STATUS_AVAILABLE) {
            vTaskDelay(pdMS_TO_TICKS(STATUS_POLL_INTERVAL_MS));
            continue;
        }

        esp_task_wdt_reset();
        err = adc_sampler_collect_batch(s_sample_buffer, sizeof(s_sample_buffer));
        if (err != ESP_OK) {
            ESP_LOGE(TAG, "ADC sampling failed: %s", esp_err_to_name(err));
            led_driver_set_status(STATUS_ERROR);
            vTaskDelay(pdMS_TO_TICKS(SEND_INTERVAL_MS));
            continue;
        }

        esp_task_wdt_reset();
        err = https_client_classify(s_sample_buffer, SAMPLES_PER_BATCH, &classify_result);
        if (err != ESP_OK) {
            ESP_LOGE(TAG, "Classification request failed: %s", esp_err_to_name(err));
            led_driver_set_status(STATUS_ERROR);
        } else if (classify_result.http_status != 200) {
            ESP_LOGE(TAG, "Classification returned HTTP %d", classify_result.http_status);
            led_driver_set_status(STATUS_ERROR);
        } else {
            ESP_LOGI(TAG,
                     "Classification result: label=%s confidence=%.3f",
                     classify_result.label,
                     (double)classify_result.confidence);
        }

        vTaskDelay(pdMS_TO_TICKS(SEND_INTERVAL_MS));
    }
}
