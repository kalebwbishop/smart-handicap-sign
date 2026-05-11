#include "ota_update.h"

#include "esp_app_desc.h"
#include "esp_https_ota.h"
#include "esp_log.h"
#include "esp_ota_ops.h"
#include "esp_task_wdt.h"

static const char *TAG = "ota_update";

static ota_status_t s_ota_status = OTA_STATUS_IDLE;
static bool s_first_boot = false;

extern const char ca_cert_pem_start[] asm("_binary_ca_cert_pem_start");
extern const char ca_cert_pem_end[] asm("_binary_ca_cert_pem_end");

static esp_err_t mark_running_app_valid(void)
{
    esp_err_t err = esp_ota_mark_app_valid_cancel_rollback();
    if (err == ESP_OK) {
        ESP_LOGI(TAG, "Running firmware marked valid");
        return ESP_OK;
    }

    if (err == ESP_ERR_OTA_ROLLBACK_INVALID_STATE) {
        ESP_LOGI(TAG, "Running firmware is already valid");
        return ESP_OK;
    }

    ESP_LOGE(TAG, "Failed to mark running firmware valid: %s", esp_err_to_name(err));
    return err;
}

esp_err_t ota_init(void)
{
    const esp_partition_t *running_partition = esp_ota_get_running_partition();
    if (running_partition == NULL) {
        ESP_LOGE(TAG, "Failed to determine running partition");
        return ESP_ERR_NOT_FOUND;
    }

    esp_ota_img_states_t ota_state = ESP_OTA_IMG_UNDEFINED;
    esp_err_t err = esp_ota_get_state_partition(running_partition, &ota_state);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "Failed to read OTA state for partition %s: %s",
                 running_partition->label,
                 esp_err_to_name(err));
        return err;
    }

    if (ota_state == ESP_OTA_IMG_PENDING_VERIFY) {
        s_first_boot = true;
        ESP_LOGW(TAG, "Running partition %s is pending verification", running_partition->label);
        return ESP_OK;
    }

    s_first_boot = false;
    ESP_LOGI(TAG, "Running partition %s OTA state: %d", running_partition->label, ota_state);
    return mark_running_app_valid();
}

esp_err_t ota_perform_update(const char *url)
{
    if (url == NULL || url[0] == '\0') {
        return ESP_ERR_INVALID_ARG;
    }

    esp_http_client_config_t http_config = {
        .url = url,
        .cert_pem = ca_cert_pem_start,
        .timeout_ms = 30000,
        .keep_alive_enable = true,
    };

    esp_https_ota_config_t ota_config = {
        .http_config = &http_config,
    };

    ESP_LOGI(TAG, "Starting OTA update from: %s", url);
    s_ota_status = OTA_STATUS_IN_PROGRESS;

    esp_https_ota_handle_t handle = NULL;
    esp_err_t err = esp_https_ota_begin(&ota_config, &handle);
    if (err != ESP_OK) {
        s_ota_status = OTA_STATUS_FAILED;
        ESP_LOGE(TAG, "OTA begin failed: %s", esp_err_to_name(err));
        return err;
    }

    while (1) {
        err = esp_https_ota_perform(handle);

        esp_err_t wdt_err = esp_task_wdt_reset();
        if (wdt_err != ESP_OK && wdt_err != ESP_ERR_INVALID_STATE) {
            ESP_LOGW(TAG, "Failed to reset task watchdog during OTA: %s", esp_err_to_name(wdt_err));
        }

        if (err != ESP_ERR_HTTPS_OTA_IN_PROGRESS) {
            break;
        }

        int image_size = esp_https_ota_get_image_size(handle);
        int read_size = esp_https_ota_get_image_len_read(handle);
        if (image_size > 0) {
            ESP_LOGI(TAG, "OTA progress: %d / %d bytes (%.1f%%)",
                     read_size,
                     image_size,
                     ((float)read_size / (float)image_size) * 100.0f);
        }
    }

    if (err != ESP_OK) {
        s_ota_status = OTA_STATUS_FAILED;
        esp_https_ota_abort(handle);
        ESP_LOGE(TAG, "OTA failed: %s", esp_err_to_name(err));
        return err;
    }

    err = esp_https_ota_finish(handle);
    if (err == ESP_OK) {
        s_ota_status = OTA_STATUS_SUCCESS;
        ESP_LOGI(TAG, "OTA update successful — restart to activate");
        return ESP_OK;
    }

    s_ota_status = OTA_STATUS_FAILED;
    ESP_LOGE(TAG, "OTA finish failed: %s", esp_err_to_name(err));
    return err;
}

const char *ota_get_current_version(void)
{
    const esp_app_desc_t *app_desc = esp_app_get_description();
    return app_desc != NULL ? app_desc->version : "unknown";
}

ota_status_t ota_get_status(void)
{
    return s_ota_status;
}

esp_err_t ota_mark_valid(void)
{
    esp_err_t err = mark_running_app_valid();
    if (err == ESP_OK) {
        s_first_boot = false;
    }

    return err;
}

bool ota_is_first_boot(void)
{
    return s_first_boot;
}
