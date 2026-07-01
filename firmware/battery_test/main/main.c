#include <stdio.h>

#include "driver/adc.h"
#include "esp_err.h"
#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

#ifndef BATTERY_TEST_ADC_CHANNEL
#define BATTERY_TEST_ADC_CHANNEL ADC_CHANNEL_6
#endif
#ifndef BATTERY_TEST_SAMPLE_INTERVAL_MS
#define BATTERY_TEST_SAMPLE_INTERVAL_MS 1000
#endif

static const char *TAG = "battery_test";

static esp_err_t battery_test_init_adc(void)
{
    adc1_config_width(ADC_WIDTH_BIT_12);
    return adc1_config_channel_atten(BATTERY_TEST_ADC_CHANNEL, ADC_ATTEN_DB_11);
}

static int battery_test_read_raw(void)
{
    return adc1_get_raw(BATTERY_TEST_ADC_CHANNEL);
}

void app_main(void)
{
    esp_err_t err = battery_test_init_adc();
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "Failed to initialize ADC: %s", esp_err_to_name(err));
        return;
    }

    ESP_LOGI(TAG, "Logging ADC readings for channel %d", BATTERY_TEST_ADC_CHANNEL);

    while (true) {
        int raw = battery_test_read_raw();
        ESP_LOGI(TAG, "ADC raw reading: %d", raw);
        vTaskDelay(pdMS_TO_TICKS(BATTERY_TEST_SAMPLE_INTERVAL_MS));
    }
}
