#pragma once

#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

#include "esp_err.h"
#include "adc_sampler.h"

#ifndef IOT_HUB_HOST_MAX_LEN
#define IOT_HUB_HOST_MAX_LEN 128U
#endif

#ifndef IOT_HUB_DEVICE_ID_MAX_LEN
#define IOT_HUB_DEVICE_ID_MAX_LEN 128U
#endif

#ifndef IOT_HUB_API_VERSION_MAX_LEN
#define IOT_HUB_API_VERSION_MAX_LEN 16U
#endif

#ifndef IOT_HUB_SAS_TOKEN_MAX_LEN
#define IOT_HUB_SAS_TOKEN_MAX_LEN 512U
#endif

typedef enum {
    STATUS_BOOTING = 0,
    STATUS_CONNECTION_NEEDED,
    STATUS_CONNECTING,
    STATUS_AVAILABLE,
    STATUS_ASSISTANCE_REQUESTED,
    STATUS_ASSISTANCE_IN_PROGRESS,
    STATUS_OFFLINE,
    STATUS_ERROR,
    STATUS_COUNT,
} device_operational_status_t;

typedef enum {
    IOT_HUB_AUTH_SAS = 0,
    IOT_HUB_AUTH_X509 = 1,
} iot_hub_auth_mode_t;

typedef struct {
    char host[IOT_HUB_HOST_MAX_LEN + 1U];
    char device_id[IOT_HUB_DEVICE_ID_MAX_LEN + 1U];
    char api_version[IOT_HUB_API_VERSION_MAX_LEN + 1U];
    char sas_token[IOT_HUB_SAS_TOKEN_MAX_LEN + 1U];
    const char *client_cert_pem;
    const char *client_key_pem;
    iot_hub_auth_mode_t auth_mode;
    uint16_t mqtt_port;
} iot_hub_client_settings_t;

typedef struct {
    device_operational_status_t operational_status;
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
esp_err_t iot_hub_client_publish_heartbeat(
    uint32_t uptime_ms,
    uint32_t wifi_connected_ms,
    int wifi_rssi_dbm,
    uint32_t battery_percentage,
    uint32_t telemetry_interval_ms,
    bool telemetry_enabled,
    device_operational_status_t operational_status);
