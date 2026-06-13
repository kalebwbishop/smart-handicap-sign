#pragma once

#include <stdbool.h>
#include <stddef.h>

#include "esp_err.h"

#ifndef NVS_WIFI_SSID_MAX_LEN
#define NVS_WIFI_SSID_MAX_LEN 32U
#endif

#ifndef NVS_WIFI_PASSWORD_MAX_LEN
#define NVS_WIFI_PASSWORD_MAX_LEN 64U
#endif

#ifndef NVS_SERIAL_NUMBER_MAX_LEN
#define NVS_SERIAL_NUMBER_MAX_LEN 128U
#endif

#ifndef NVS_AUTH_TOKEN_MAX_LEN
#define NVS_AUTH_TOKEN_MAX_LEN 512U
#endif

#ifndef NVS_IOT_HUB_STATE_MAX_LEN
#define NVS_IOT_HUB_STATE_MAX_LEN 512U
#endif

#ifndef NVS_DPS_ASSIGNED_HUB_MAX_LEN
#define NVS_DPS_ASSIGNED_HUB_MAX_LEN 128U
#endif

#ifndef NVS_DPS_DEVICE_ID_MAX_LEN
#define NVS_DPS_DEVICE_ID_MAX_LEN 128U
#endif

esp_err_t nvs_storage_init(void);

esp_err_t nvs_wifi_save(const char *ssid, const char *password);
esp_err_t nvs_wifi_load(char *ssid, size_t ssid_len, char *password, size_t pass_len);
esp_err_t nvs_wifi_clear(void);
bool nvs_wifi_exists(void);
esp_err_t nvs_wifi_set_validated(bool validated);
bool nvs_wifi_is_validated(void);
esp_err_t nvs_field_reset_wifi_only(void);

esp_err_t nvs_identity_save(const char *serial_number);
esp_err_t nvs_identity_load(char *serial_number, size_t len);
bool nvs_identity_exists(void);

esp_err_t nvs_auth_token_save(const char *token);
esp_err_t nvs_auth_token_load(char *token, size_t len);
bool nvs_auth_token_exists(void);

esp_err_t nvs_iot_hub_state_save(const char *state_json);
esp_err_t nvs_iot_hub_state_load(char *state_json, size_t len);
bool nvs_iot_hub_state_exists(void);

esp_err_t nvs_dps_assignment_save(const char *assigned_hub, const char *device_id);
esp_err_t nvs_dps_assignment_load(char *assigned_hub, size_t assigned_hub_len, char *device_id, size_t device_id_len);
bool nvs_dps_assignment_exists(void);
esp_err_t nvs_dps_assignment_clear(void);
