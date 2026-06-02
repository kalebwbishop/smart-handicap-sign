#ifndef IOT_HUB_CLIENT_H
#define IOT_HUB_CLIENT_H

#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

#include "esp_err.h"
#include "led_driver.h"

#define IOT_HUB_HOST_MAX_LEN 128
#define IOT_HUB_DEVICE_ID_MAX_LEN 128
#define IOT_HUB_API_VERSION_MAX_LEN 16
#define IOT_HUB_SAS_TOKEN_MAX_LEN 512

typedef struct {
    char host[IOT_HUB_HOST_MAX_LEN + 1];
    char device_id[IOT_HUB_DEVICE_ID_MAX_LEN + 1];
    char api_version[IOT_HUB_API_VERSION_MAX_LEN + 1];
    char sas_token[IOT_HUB_SAS_TOKEN_MAX_LEN + 1];
    uint16_t mqtt_port;
} iot_hub_client_settings_t;

typedef struct {
    device_status_t status;
    bool telemetry_enabled;
    uint32_t telemetry_interval_ms;
    uint32_t last_desired_version;
} iot_hub_state_t;

esp_err_t iot_hub_client_init(const iot_hub_client_settings_t *settings, const iot_hub_state_t *initial_state);
esp_err_t iot_hub_client_start(void);
esp_err_t iot_hub_client_stop(void);
bool iot_hub_client_is_connected(void);
esp_err_t iot_hub_client_get_state(iot_hub_state_t *state);
esp_err_t iot_hub_client_publish_telemetry(const int *samples, size_t sample_count);

#endif
