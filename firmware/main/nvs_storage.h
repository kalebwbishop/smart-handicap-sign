#pragma once

#include <stdbool.h>
#include <stddef.h>
#include "esp_err.h"

#define NVS_SERIAL_NUMBER_MAX_LEN 32
#define NVS_AUTH_TOKEN_MAX_LEN 128
#define NVS_WIFI_SSID_MAX_LEN 32
#define NVS_WIFI_PASSWORD_MAX_LEN 64
#define NVS_SETUP_CODE_HASH_MAX_LEN 128
#define NVS_SETUP_CODE_SALT_MAX_LEN 32
#define NVS_SETUP_CODE_MAX_LEN 64

esp_err_t nvs_storage_init(void);

esp_err_t nvs_wifi_save(const char *ssid, const char *password);
esp_err_t nvs_wifi_load(char *ssid, size_t ssid_len, char *password, size_t pass_len);
esp_err_t nvs_wifi_clear(void);
esp_err_t nvs_field_reset_wifi_only(void);
bool nvs_wifi_exists(void);

esp_err_t nvs_identity_save(const char *serial_number);
esp_err_t nvs_identity_load(char *serial_number, size_t len);
bool nvs_identity_exists(void);

esp_err_t nvs_auth_token_save(const char *token);
esp_err_t nvs_auth_token_load(char *token, size_t len);
bool nvs_auth_token_exists(void);

esp_err_t nvs_setup_verifier_save(const char *hash, const char *salt);
esp_err_t nvs_setup_verifier_load(char *hash, size_t hash_len, char *salt, size_t salt_len);
bool nvs_setup_verifier_exists(void);
bool nvs_setup_verifier_is_active(void);
bool nvs_setup_code_verify(const char *code);
