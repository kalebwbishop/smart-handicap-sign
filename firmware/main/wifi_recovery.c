#include <string.h>

#include "esp_log.h"
#include "esp_task_wdt.h"

#include "boot_support.h"
#include "connection_policy.h"
#include "iot_hub_client.h"
#include "nvs_storage.h"
#include "runtime_config.h"
#include "wifi_manager.h"

static const char *TAG = "wifi";

esp_err_t wifi_recovery_attempt(int *failure_count)
{
    if (failure_count == NULL) {
        return ESP_ERR_INVALID_ARG;
    }

    if (!nvs_wifi_exists()) {
        boot_support_enter_provisioning_mode("WiFi credentials missing during reconnect");
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
        (void)iot_hub_client_start();
        ESP_LOGI(TAG, "WiFi reconnect succeeded");
        return ESP_OK;
    }

    (*failure_count)++;
    ESP_LOGW(TAG, "WiFi reconnect failed (%d/%d): %s", *failure_count, MAX_RECONNECT_FAILURES, esp_err_to_name(err));
    if (should_enter_provisioning_on_reconnect_failure(nvs_wifi_is_validated(), *failure_count, MAX_RECONNECT_FAILURES)) {
        boot_support_enter_provisioning_mode("Exceeded maximum WiFi reconnect failures");
    }
    if (*failure_count >= MAX_RECONNECT_FAILURES) {
        ESP_LOGW(TAG, "Saved WiFi credentials were previously validated; staying out of provisioning mode");
        *failure_count = 0;
    }

    return err;
}
