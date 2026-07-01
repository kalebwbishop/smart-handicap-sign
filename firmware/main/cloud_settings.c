#include <string.h>

#include "esp_log.h"

#include "cloud_settings.h"
#include "dps_certificates.h"
#include "dps_client.h"
#include "nvs_storage.h"

#ifndef DPS_ID_SCOPE
#define DPS_ID_SCOPE ""
#endif
#ifndef IOT_HUB_MQTT_PORT
#define IOT_HUB_MQTT_PORT 8883
#endif
#ifndef IOT_HUB_API_VERSION
#define IOT_HUB_API_VERSION "2021-04-12"
#endif

static const char *TAG = "cloud";

esp_err_t cloud_settings_resolve_iot_hub_settings_x509(const char *registration_id, iot_hub_client_settings_t *settings)
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
