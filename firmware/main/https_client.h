#ifndef HTTPS_CLIENT_H
#define HTTPS_CLIENT_H

#include "esp_err.h"
#include "led_driver.h"

#define HTTPS_URL_MAX_LEN 256

// Result of a classify request
typedef struct {
    char label[16];
    float confidence;
    int http_status;
} classify_result_t;

// Result of a status request
typedef struct {
    device_status_t status;
    char status_str[32];
    int http_status;
} status_result_t;

// Initialize HTTPS client (configures TLS with embedded CA cert)
// base_url: e.g., "https://your-server.com/api/v1"
esp_err_t https_client_init(const char *base_url);

// POST /inference/classify with 512 ADC samples
// serial_number and auth_token are read from NVS
esp_err_t https_client_classify(const int *samples, int sample_count, classify_result_t *result);

// GET /devices/{serial_number}/status
// serial_number is read from NVS
esp_err_t https_client_get_status(status_result_t *result);

#endif
