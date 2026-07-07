#include <stdio.h>

#include "esp_err.h"
#include "esp_log.h"
#include "esp_adc/adc_oneshot.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

#ifndef BATTERY_TEST_ADC_CHANNEL
#define BATTERY_TEST_ADC_CHANNEL ADC_CHANNEL_5
#endif
#ifndef BATTERY_TEST_SAMPLE_INTERVAL_MS
#define BATTERY_TEST_SAMPLE_INTERVAL_MS 1000
#endif

static const char *TAG = "battery_test";
static adc_oneshot_unit_handle_t s_adc_handle;

static esp_err_t battery_test_init_adc(void)
{
    adc_oneshot_unit_init_cfg_t init_config = {
        .unit_id = ADC_UNIT_1,
    };

    esp_err_t err = adc_oneshot_new_unit(&init_config, &s_adc_handle);
    if (err != ESP_OK) {
        return err;
    }

    adc_oneshot_chan_cfg_t channel_config = {
        .bitwidth = ADC_BITWIDTH_12,
        .atten = ADC_ATTEN_DB_12,
    };

    err = adc_oneshot_config_channel(s_adc_handle, BATTERY_TEST_ADC_CHANNEL, &channel_config);
    if (err != ESP_OK) {
        adc_oneshot_del_unit(s_adc_handle);
        s_adc_handle = NULL;
        return err;
    }

    return ESP_OK;
}

static int battery_test_read_raw(void)
{
    int raw_value = -1;

    if (adc_oneshot_read(s_adc_handle, BATTERY_TEST_ADC_CHANNEL, &raw_value) != ESP_OK) {
        return -1;
    }

    return raw_value;
}

void app_main(void)
{
    esp_err_t err = battery_test_init_adc();
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "Failed to initialize ADC: %s", esp_err_to_name(err));
        return;
    }

    ESP_LOGI(TAG, "Logging ADC readings for channel %d", BATTERY_TEST_ADC_CHANNEL);
    ESP_LOGI(TAG, "ADC channel: %d", BATTERY_TEST_ADC_CHANNEL);

    while (true) {
        int raw = battery_test_read_raw();
        ESP_LOGI(TAG, "ADC raw reading: %d\nPercentage: %d%%", raw, raw * 100 / 4095);
        vTaskDelay(pdMS_TO_TICKS(BATTERY_TEST_SAMPLE_INTERVAL_MS));
    }
}
