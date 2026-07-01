#include <string.h>

#include "esp_log.h"

#include "adc_sampler.h"
#include "identity_service.h"
#include "nvs_storage.h"

#ifndef DPS_REGISTRATION_ID
#define DPS_REGISTRATION_ID ""
#endif

static const char *TAG = "identity";

esp_err_t identity_service_load_device_serial_number(char *serial_number, size_t serial_len)
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
