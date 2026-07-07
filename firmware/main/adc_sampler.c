#include "adc_sampler.h"

#include "esp_log.h"
#include "esp_mac.h"
#include "esp_task_wdt.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

#include <stdio.h>
#include <string.h>

#define ADC_SAMPLER_WDT_FEED_INTERVAL 32U

static const char *TAG = "adc_sampler";
static adc_oneshot_unit_handle_t s_adc_handle;

static esp_err_t adc_sampler_read_internal(int *raw_value)
{
    if (raw_value == NULL) {
        return ESP_ERR_INVALID_ARG;
    }

    if (s_adc_handle == NULL) {
        ESP_LOGE(TAG, "ADC sampler not initialized");
        return ESP_ERR_INVALID_STATE;
    }

    esp_err_t err = adc_oneshot_read(s_adc_handle, ADC_PIN, raw_value);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "Failed to read ADC sample: %s", esp_err_to_name(err));
    }

    return err;
}

esp_err_t adc_sampler_init(void)
{
    if (s_adc_handle != NULL) {
        return ESP_OK;
    }

    adc_oneshot_unit_init_cfg_t init_config = {0};
    init_config.unit_id = ADC_UNIT_1;

    esp_err_t err = adc_oneshot_new_unit(&init_config, &s_adc_handle);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "Failed to create ADC unit: %s", esp_err_to_name(err));
        return err;
    }

    adc_oneshot_chan_cfg_t channel_config = {
        .bitwidth = ADC_BITWIDTH_12,
        .atten = ADC_ATTEN_DB_12,
    };

    err = adc_oneshot_config_channel(s_adc_handle, ADC_PIN, &channel_config);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "Failed to configure ADC channel: %s", esp_err_to_name(err));
        adc_oneshot_del_unit(s_adc_handle);
        s_adc_handle = NULL;
        return err;
    }

    ESP_LOGI(TAG, "ADC sampler initialized on ADC1 channel %d", ADC_PIN);
    return ESP_OK;
}

esp_err_t adc_sampler_configure_channel(adc_channel_t channel)
{
    if (s_adc_handle == NULL) {
        return ESP_ERR_INVALID_STATE;
    }

    adc_oneshot_chan_cfg_t channel_config = {
        .bitwidth = ADC_BITWIDTH_12,
        .atten = ADC_ATTEN_DB_12,
    };

    return adc_oneshot_config_channel(s_adc_handle, channel, &channel_config);
}

esp_err_t adc_sampler_read_channel_raw(adc_channel_t channel, int *raw_value)
{
    if (raw_value == NULL) {
        return ESP_ERR_INVALID_ARG;
    }

    if (s_adc_handle == NULL) {
        ESP_LOGE(TAG, "ADC sampler not initialized");
        return ESP_ERR_INVALID_STATE;
    }

    esp_err_t err = adc_oneshot_read(s_adc_handle, channel, raw_value);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "Failed to read ADC channel %d: %s", channel, esp_err_to_name(err));
    }

    return err;
}

int adc_sampler_read_raw(void)
{
    int raw_value = -1;

    if (adc_sampler_read_internal(&raw_value) != ESP_OK) {
        return -1;
    }

    return raw_value;
}

esp_err_t adc_sampler_collect_batch(int *buffer, size_t buffer_size_bytes)
{
    if (buffer == NULL) {
        return ESP_ERR_INVALID_ARG;
    }

    if (buffer_size_bytes < (SAMPLES_PER_BATCH * sizeof(buffer[0]))) {
        return ESP_ERR_INVALID_SIZE;
    }

    for (size_t i = 0; i < SAMPLES_PER_BATCH; ++i) {
        if ((i % ADC_SAMPLER_WDT_FEED_INTERVAL) == 0U) {
            esp_err_t wdt_err = esp_task_wdt_reset();
            if (wdt_err != ESP_OK && wdt_err != ESP_ERR_INVALID_STATE && wdt_err != ESP_ERR_NOT_FOUND) {
                ESP_LOGW(TAG, "Failed to reset task watchdog during sampling: %s", esp_err_to_name(wdt_err));
            }
        }

        esp_err_t err = adc_sampler_read_internal(&buffer[i]);
        if (err != ESP_OK) {
            return err;
        }

        if (i + 1U < SAMPLES_PER_BATCH) {
            vTaskDelay(pdMS_TO_TICKS(SAMPLE_INTERVAL_MS));
        }
    }

    return ESP_OK;
}

esp_err_t adc_sampler_get_device_id(char *buf, size_t buf_len)
{
    if (buf == NULL) {
        return ESP_ERR_INVALID_ARG;
    }

    if (buf_len < 13U) {
        return ESP_ERR_INVALID_SIZE;
    }

    uint8_t mac[6] = {0};
    esp_err_t err = esp_efuse_mac_get_default(mac);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "Failed to read device MAC address: %s", esp_err_to_name(err));
        return err;
    }

    int written = snprintf(
        buf,
        buf_len,
        "%02x%02x%02x%02x%02x%02x",
        mac[0],
        mac[1],
        mac[2],
        mac[3],
        mac[4],
        mac[5]);

    if (written != 12) {
        ESP_LOGE(TAG, "Failed to format device ID");
        return ESP_FAIL;
    }

    return ESP_OK;
}
