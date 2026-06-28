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
#include "dps_certificates.h"
#include "dps_client.h"
#include "iot_hub_client.h"
#include "led_driver.h"
#include "nvs_storage.h"
#include "provisioning_server.h"
#include "wifi_manager.h"

#ifndef DPS_ID_SCOPE
#define DPS_ID_SCOPE ""
#endif
#ifndef DPS_REGISTRATION_ID
#define DPS_REGISTRATION_ID ""
#endif
#ifndef IOT_HUB_MQTT_PORT
#define IOT_HUB_MQTT_PORT 8883
#endif
#ifndef IOT_HUB_API_VERSION
#define IOT_HUB_API_VERSION "2021-04-12"
#endif

#define DEFAULT_TELEMETRY_INTERVAL_MS 1000
#define NETWORK_STABILITY_DELAY_MS 2000
#define MAX_RECONNECT_FAILURES 3
#define WIFI_CONNECT_TIMEOUT_MS 20000
#define WDT_TIMEOUT_MS 30000

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

static esp_err_t load_device_identity(char *serial_number, size_t serial_len)
{
    if (serial_number == NULL || serial_len == 0U) {
        return ESP_ERR_INVALID_ARG;
    }

    if (DPS_REGISTRATION_ID[0] != '\0') {
        strlcpy(serial_number, DPS_REGISTRATION_ID, serial_len);
        ESP_LOGI(TAG, "Using DPS registration ID as device serial number");
        return ESP_OK;
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

static esp_err_t resolve_iot_hub_settings_x509(const char *registration_id, iot_hub_client_settings_t *settings)
{
    if (registration_id == NULL || registration_id[0] == '\0' || settings == NULL) {
        return ESP_ERR_INVALID_ARG;
    }

    if (DPS_ID_SCOPE[0] == '\0') {
        ESP_LOGE(TAG, "DPS_ID_SCOPE is not configured");
        return ESP_ERR_INVALID_ARG;
    }

    memset(settings, 0, sizeof(*settings));

    char assigned_hub[NVS_DPS_ASSIGNED_HUB_MAX_LEN + 1U] = {0};
    char assigned_device_id[NVS_DPS_DEVICE_ID_MAX_LEN + 1U] = {0};

    if (!nvs_dps_assignment_exists()) {
        ESP_LOGI(TAG, "No cached DPS assignment found; registering with DPS");

        dps_client_config_t dps_config = {0};
        strlcpy(dps_config.id_scope, DPS_ID_SCOPE, sizeof(dps_config.id_scope));
        strlcpy(dps_config.registration_id, registration_id, sizeof(dps_config.registration_id));
        dps_config.client_cert_pem = DEVICE_CERT_PEM;
        dps_config.client_key_pem = DEVICE_KEY_PEM;

        dps_assignment_t assignment = {0};
        esp_err_t err = dps_client_register(&dps_config, &assignment);
        if (err != ESP_OK) {
            ESP_LOGE(TAG, "DPS registration failed: %s", esp_err_to_name(err));
            return err;
        }

        err = nvs_dps_assignment_save(assignment.assigned_hub, assignment.device_id);
        if (err != ESP_OK) {
            ESP_LOGE(TAG, "Failed to cache DPS assignment: %s", esp_err_to_name(err));
            return err;
        }
    }

    esp_err_t err = nvs_dps_assignment_load(
        assigned_hub,
        sizeof(assigned_hub),
        assigned_device_id,
        sizeof(assigned_device_id));
    if (err != ESP_OK) {
        return err;
    }

    strlcpy(settings->host, assigned_hub, sizeof(settings->host));
    strlcpy(settings->device_id, assigned_device_id, sizeof(settings->device_id));
    strlcpy(settings->api_version, IOT_HUB_API_VERSION, sizeof(settings->api_version));
    settings->mqtt_port = IOT_HUB_MQTT_PORT;
    settings->auth_mode = IOT_HUB_AUTH_X509;
    settings->client_cert_pem = DEVICE_CERT_PEM;
    settings->client_key_pem = DEVICE_KEY_PEM;

    ESP_LOGI(TAG, "Resolved IoT Hub through DPS: hub=%s deviceId=%s", settings->host, settings->device_id);
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
        (void)iot_hub_client_start();
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
    iot_hub_client_settings_t iot_hub_settings = {0};
    iot_hub_state_t cloud_state = {0};
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
    led_driver_set_status(STATUS_BOOTING);

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

    led_driver_set_status(STATUS_CONNECTING);
    err = nvs_wifi_load(wifi_ssid, sizeof(wifi_ssid), wifi_password, sizeof(wifi_password));
    if (err != ESP_OK) {
        fatal_restart("Failed to load WiFi credentials", err);
    }

    err = wifi_sta_connect(wifi_ssid, wifi_password, WIFI_CONNECT_TIMEOUT_MS);
    memset(wifi_password, 0, sizeof(wifi_password));
    memset(wifi_ssid, 0, sizeof(wifi_ssid));
    if (err != ESP_OK) {
        ESP_LOGW(TAG, "Initial WiFi connection failed: %s", esp_err_to_name(err));
        led_driver_set_status(STATUS_ERROR);
        if (should_enter_provisioning_on_initial_connect_failure(nvs_wifi_is_validated())) {
            enter_provisioning_mode("Unable to connect with saved WiFi credentials");
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
        fatal_restart("Failed to initialize ADC sampler", err);
    }

    err = resolve_iot_hub_settings_x509(serial_number, &iot_hub_settings);
    if (err != ESP_OK) {
        fatal_restart("Failed to build IoT Hub settings", err);
    }

    err = iot_hub_client_init(&iot_hub_settings, NULL);
    if (err != ESP_OK) {
        fatal_restart("Failed to initialize IoT Hub client", err);
    }

    err = iot_hub_client_start();
    if (err != ESP_OK && err != ESP_ERR_NOT_FOUND) {
        ESP_LOGW(TAG, "IoT Hub client did not start cleanly: %s", esp_err_to_name(err));
    }

    err = iot_hub_client_get_state(&cloud_state);
    if (err != ESP_OK) {
        fatal_restart("Failed to load cached IoT Hub state", err);
    }
    led_driver_set_status(cloud_state.status);

    err = init_task_wdt();
    if (err != ESP_OK) {
        fatal_restart("Failed to initialize task watchdog", err);
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
            err = reconnect_wifi(&reconnect_failures);
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
