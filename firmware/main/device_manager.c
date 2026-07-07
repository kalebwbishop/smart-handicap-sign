#include "esp_err.h"
#include "device_manager.h"
#include "adc_sampler.h"

#ifndef BATTERY_MANAGER_ADC_CHANNEL
#define BATTERY_MANAGER_ADC_CHANNEL ADC_CHANNEL_5
#endif

esp_err_t battery_manager_init_adc(void)
{
    esp_err_t err = adc_sampler_init();
    if (err != ESP_OK) {
        return err;
    }

    return adc_sampler_configure_channel(BATTERY_MANAGER_ADC_CHANNEL);
}

int battery_manager_read_percentage(void)
{
    int raw_value = -1;
    if (adc_sampler_read_channel_raw(BATTERY_MANAGER_ADC_CHANNEL, &raw_value) != ESP_OK) {
        return -1;
    }

    return raw_value * 100 / 4095;
}
