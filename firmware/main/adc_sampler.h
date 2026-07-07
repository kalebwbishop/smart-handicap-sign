#ifndef ADC_SAMPLER_H
#define ADC_SAMPLER_H

#include "esp_err.h"
#include "esp_adc/adc_oneshot.h"
#include <stddef.h>
#include <stdint.h>

#define ADC_PIN             ADC_CHANNEL_6
#define SAMPLES_PER_BATCH   200
#define SAMPLE_INTERVAL_MS  20

// Initialize ADC1 for photoresistor reading
esp_err_t adc_sampler_init(void);

// Configure an additional ADC1 channel on the shared oneshot unit
esp_err_t adc_sampler_configure_channel(adc_channel_t channel);

// Read a single raw sample from a specific ADC channel
esp_err_t adc_sampler_read_channel_raw(adc_channel_t channel, int *raw_value);

// Read a single raw sample (0–4095, 12-bit)
int adc_sampler_read_raw(void);

// Collect SAMPLES_PER_BATCH samples into the provided buffer
// buffer_size_bytes must be at least SAMPLES_PER_BATCH * sizeof(int)
// Blocks for about 4.0 seconds (199 delays * 20ms, plus ADC read overhead)
// Returns ESP_OK on success
esp_err_t adc_sampler_collect_batch(int *buffer, size_t buffer_size_bytes);

// Get device ID as hex string (from ESP32 MAC address)
// Writes hex string into buf (must be at least 13 bytes for 6-byte MAC = 12 hex + null)
esp_err_t adc_sampler_get_device_id(char *buf, size_t buf_len);

#endif
