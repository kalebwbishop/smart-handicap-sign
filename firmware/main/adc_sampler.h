#ifndef ADC_SAMPLER_H
#define ADC_SAMPLER_H

#include "esp_err.h"
#include "esp_adc/adc_oneshot.h"
#include <stddef.h>
#include <stdint.h>

#define ADC_PIN             ADC_CHANNEL_6
#define SAMPLES_PER_BATCH   512
#define SAMPLE_INTERVAL_MS  25

// Initialize ADC1 for photoresistor reading
esp_err_t adc_sampler_init(void);

// Read a single raw sample (0–4095, 12-bit)
int adc_sampler_read_raw(void);

// Collect SAMPLES_PER_BATCH samples into the provided buffer
// buffer_size_bytes must be at least SAMPLES_PER_BATCH * sizeof(int)
// Blocks for ~12.8 seconds (512 * 25ms)
// Returns ESP_OK on success
esp_err_t adc_sampler_collect_batch(int *buffer, size_t buffer_size_bytes);

// Get device ID as hex string (from ESP32 MAC address)
// Writes hex string into buf (must be at least 13 bytes for 6-byte MAC = 12 hex + null)
esp_err_t adc_sampler_get_device_id(char *buf, size_t buf_len);

#endif
