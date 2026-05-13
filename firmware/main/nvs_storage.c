#include "nvs_storage.h"

#include <string.h>

#include "esp_log.h"
#include "nvs.h"
#include "nvs_flash.h"

static const char *TAG = "nvs_storage";

static const char *WIFI_NAMESPACE = "wifi";
static const char *DEVICE_NAMESPACE = "device";
static const char *WIFI_SSID_KEY = "wifi_ssid";
static const char *WIFI_PASS_KEY = "wifi_pass";
static const char *SERIAL_KEY = "serial";
static const char *AUTH_TOKEN_KEY = "auth_token";
static const char *SETUP_CODE_HASH_KEY = "setup_code_hash";
static const char *SETUP_CODE_SALT_KEY = "setup_code_salt";
static const char *SETUP_CODE_REVOKED_KEY = "setup_code_revoked";
static const char *SETUP_CODE_EXPIRES_AT_KEY = "setup_code_expires_at";

static bool constant_time_equals(const char *left, const char *right)
{
    if (left == NULL || right == NULL) {
        return false;
    }

    size_t left_len = strlen(left);
    size_t right_len = strlen(right);
    size_t max_len = left_len > right_len ? left_len : right_len;
    unsigned char diff = (unsigned char)(left_len ^ right_len);

    for (size_t i = 0; i < max_len; ++i) {
        unsigned char left_char = i < left_len ? (unsigned char)left[i] : 0U;
        unsigned char right_char = i < right_len ? (unsigned char)right[i] : 0U;
        diff |= (unsigned char)(left_char ^ right_char);
    }

    return diff == 0U;
}

static esp_err_t validate_input_string(const char *value, size_t min_len, size_t max_len, const char *field_name)
{
    if (value == NULL) {
        ESP_LOGE(TAG, "%s is required", field_name);
        return ESP_ERR_INVALID_ARG;
    }

    size_t length = strlen(value);
    if (length < min_len || length > max_len) {
        if (min_len == 0) {
            ESP_LOGE(TAG, "%s length must be between 0 and %u characters", field_name, (unsigned int)max_len);
        } else {
            ESP_LOGE(TAG, "%s length must be between %u and %u characters", field_name, (unsigned int)min_len, (unsigned int)max_len);
        }
        return ESP_ERR_INVALID_ARG;
    }

    return ESP_OK;
}

static esp_err_t open_namespace(const char *name, nvs_open_mode_t mode, nvs_handle_t *handle)
{
    esp_err_t err = nvs_open(name, mode, handle);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "Failed to open NVS namespace '%s': %s", name, esp_err_to_name(err));
    }

    return err;
}

static esp_err_t save_string_value(const char *namespace_name, const char *key, const char *value)
{
    nvs_handle_t handle;
    esp_err_t err = open_namespace(namespace_name, NVS_READWRITE, &handle);
    if (err != ESP_OK) {
        return err;
    }

    err = nvs_set_str(handle, key, value);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "Failed to save key '%s' in namespace '%s': %s", key, namespace_name, esp_err_to_name(err));
        nvs_close(handle);
        return err;
    }

    err = nvs_commit(handle);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "Failed to commit namespace '%s': %s", namespace_name, esp_err_to_name(err));
    }

    nvs_close(handle);
    return err;
}

static esp_err_t load_string_value(const char *namespace_name, const char *key, char *buffer, size_t buffer_len)
{
    if (buffer == NULL || buffer_len == 0) {
        ESP_LOGE(TAG, "Buffer for key '%s' is invalid", key);
        return ESP_ERR_INVALID_ARG;
    }

    nvs_handle_t handle;
    esp_err_t err = open_namespace(namespace_name, NVS_READONLY, &handle);
    if (err != ESP_OK) {
        return err;
    }

    size_t required_len = buffer_len;
    err = nvs_get_str(handle, key, buffer, &required_len);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "Failed to load key '%s' from namespace '%s': %s", key, namespace_name, esp_err_to_name(err));
    }

    nvs_close(handle);
    return err;
}

static bool key_exists(const char *namespace_name, const char *key)
{
    nvs_handle_t handle;
    esp_err_t err = nvs_open(namespace_name, NVS_READONLY, &handle);
    if (err != ESP_OK) {
        return false;
    }

    size_t required_len = 0;
    err = nvs_get_str(handle, key, NULL, &required_len);
    nvs_close(handle);

    return err == ESP_OK;
}

static esp_err_t erase_key_if_exists(nvs_handle_t handle, const char *key)
{
    esp_err_t err = nvs_erase_key(handle, key);
    if (err == ESP_ERR_NVS_NOT_FOUND) {
        return ESP_OK;
    }

    if (err != ESP_OK) {
        ESP_LOGE(TAG, "Failed to erase key '%s': %s", key, esp_err_to_name(err));
    }

    return err;
}

esp_err_t nvs_storage_init(void)
{
    esp_err_t err = nvs_flash_init();
    if (err == ESP_ERR_NVS_NO_FREE_PAGES || err == ESP_ERR_NVS_NEW_VERSION_FOUND) {
        ESP_LOGW(TAG, "NVS flash init requires erase, retrying: %s", esp_err_to_name(err));
        ESP_LOGW(TAG, "Erasing NVS removes stored WiFi credentials and device identity; the application must regenerate or reprovision them after boot");
        err = nvs_flash_erase();
        if (err != ESP_OK) {
            ESP_LOGE(TAG, "Failed to erase NVS flash: %s", esp_err_to_name(err));
            return err;
        }

        err = nvs_flash_init();
    }

    if (err != ESP_OK) {
        ESP_LOGE(TAG, "Failed to initialize NVS flash: %s", esp_err_to_name(err));
        return err;
    }

    ESP_LOGI(TAG, "NVS storage initialized");
    return ESP_OK;
}

esp_err_t nvs_wifi_save(const char *ssid, const char *password)
{
    esp_err_t err = validate_input_string(ssid, 1, NVS_WIFI_SSID_MAX_LEN, "WiFi SSID");
    if (err != ESP_OK) {
        return err;
    }

    err = validate_input_string(password, 0, NVS_WIFI_PASSWORD_MAX_LEN, "WiFi password");
    if (err != ESP_OK) {
        return err;
    }

    nvs_handle_t handle;
    err = open_namespace(WIFI_NAMESPACE, NVS_READWRITE, &handle);
    if (err != ESP_OK) {
        return err;
    }

    err = nvs_set_str(handle, WIFI_SSID_KEY, ssid);
    if (err == ESP_OK) {
        err = nvs_set_str(handle, WIFI_PASS_KEY, password);
    }
    if (err == ESP_OK) {
        err = nvs_commit(handle);
    }

    if (err != ESP_OK) {
        ESP_LOGE(TAG, "Failed to save WiFi credentials: %s", esp_err_to_name(err));
    } else {
        ESP_LOGI(TAG, "Saved WiFi credentials to NVS");
    }

    nvs_close(handle);
    return err;
}

esp_err_t nvs_wifi_load(char *ssid, size_t ssid_len, char *password, size_t pass_len)
{
    esp_err_t err = load_string_value(WIFI_NAMESPACE, WIFI_SSID_KEY, ssid, ssid_len);
    if (err != ESP_OK) {
        return err;
    }

    err = load_string_value(WIFI_NAMESPACE, WIFI_PASS_KEY, password, pass_len);
    if (err != ESP_OK) {
        return err;
    }

    ESP_LOGI(TAG, "Loaded WiFi credentials from NVS");
    return ESP_OK;
}

esp_err_t nvs_wifi_clear(void)
{
    nvs_handle_t handle;
    esp_err_t err = open_namespace(WIFI_NAMESPACE, NVS_READWRITE, &handle);
    if (err != ESP_OK) {
        return err;
    }

    err = erase_key_if_exists(handle, WIFI_SSID_KEY);
    if (err == ESP_OK) {
        err = erase_key_if_exists(handle, WIFI_PASS_KEY);
    }
    if (err == ESP_OK) {
        err = nvs_commit(handle);
    }

    if (err != ESP_OK) {
        ESP_LOGE(TAG, "Failed to clear WiFi credentials: %s", esp_err_to_name(err));
    } else {
        ESP_LOGI(TAG, "Cleared WiFi credentials from NVS");
    }

    nvs_close(handle);
    return err;
}

bool nvs_wifi_exists(void)
{
    return key_exists(WIFI_NAMESPACE, WIFI_SSID_KEY) && key_exists(WIFI_NAMESPACE, WIFI_PASS_KEY);
}

esp_err_t nvs_field_reset_wifi_only(void)
{
    return nvs_wifi_clear();
}

esp_err_t nvs_identity_save(const char *serial_number)
{
    esp_err_t err = validate_input_string(serial_number, 1, NVS_SERIAL_NUMBER_MAX_LEN, "Serial number");
    if (err != ESP_OK) {
        return err;
    }

    err = save_string_value(DEVICE_NAMESPACE, SERIAL_KEY, serial_number);
    if (err != ESP_OK) {
        return err;
    }

    ESP_LOGI(TAG, "Saved device serial number to NVS");
    return ESP_OK;
}

esp_err_t nvs_identity_load(char *serial_number, size_t len)
{
    esp_err_t err = load_string_value(DEVICE_NAMESPACE, SERIAL_KEY, serial_number, len);
    if (err != ESP_OK) {
        return err;
    }

    ESP_LOGI(TAG, "Loaded device serial number from NVS");
    return ESP_OK;
}

bool nvs_identity_exists(void)
{
    return key_exists(DEVICE_NAMESPACE, SERIAL_KEY);
}

esp_err_t nvs_auth_token_save(const char *token)
{
    esp_err_t err = validate_input_string(token, 1, NVS_AUTH_TOKEN_MAX_LEN, "Auth token");
    if (err != ESP_OK) {
        return err;
    }

    err = save_string_value(DEVICE_NAMESPACE, AUTH_TOKEN_KEY, token);
    if (err != ESP_OK) {
        return err;
    }

    ESP_LOGI(TAG, "Saved device auth token to NVS");
    return ESP_OK;
}

esp_err_t nvs_auth_token_load(char *token, size_t len)
{
    esp_err_t err = load_string_value(DEVICE_NAMESPACE, AUTH_TOKEN_KEY, token, len);
    if (err != ESP_OK) {
        return err;
    }

    ESP_LOGI(TAG, "Loaded device auth token from NVS");
    return ESP_OK;
}

bool nvs_auth_token_exists(void)
{
    return key_exists(DEVICE_NAMESPACE, AUTH_TOKEN_KEY);
}

esp_err_t nvs_setup_verifier_save(const char *hash, const char *salt)
{
    esp_err_t err = validate_input_string(hash, 1, NVS_SETUP_CODE_HASH_MAX_LEN, "Setup code hash");
    if (err != ESP_OK) {
        return err;
    }

    err = validate_input_string(salt, 0, NVS_SETUP_CODE_SALT_MAX_LEN, "Setup code salt");
    if (err != ESP_OK) {
        return err;
    }

    nvs_handle_t handle;
    err = open_namespace(DEVICE_NAMESPACE, NVS_READWRITE, &handle);
    if (err != ESP_OK) {
        return err;
    }

    err = nvs_set_str(handle, SETUP_CODE_HASH_KEY, hash);
    if (err == ESP_OK) {
        err = nvs_set_str(handle, SETUP_CODE_SALT_KEY, salt);
    }
    if (err == ESP_OK) {
        err = nvs_commit(handle);
    }

    if (err != ESP_OK) {
        ESP_LOGE(TAG, "Failed to save setup verifier: %s", esp_err_to_name(err));
    }

    nvs_close(handle);
    return err;
}

esp_err_t nvs_setup_verifier_load(char *hash, size_t hash_len, char *salt, size_t salt_len)
{
    esp_err_t err = load_string_value(DEVICE_NAMESPACE, SETUP_CODE_HASH_KEY, hash, hash_len);
    if (err != ESP_OK) {
        return err;
    }

    return load_string_value(DEVICE_NAMESPACE, SETUP_CODE_SALT_KEY, salt, salt_len);
}

bool nvs_setup_verifier_exists(void)
{
    return key_exists(DEVICE_NAMESPACE, SETUP_CODE_HASH_KEY) && key_exists(DEVICE_NAMESPACE, SETUP_CODE_SALT_KEY);
}

bool nvs_setup_verifier_is_active(void)
{
    nvs_handle_t handle;
    esp_err_t err = nvs_open(DEVICE_NAMESPACE, NVS_READONLY, &handle);
    if (err != ESP_OK) {
        return false;
    }

    uint8_t revoked = 0;
    err = nvs_get_u8(handle, SETUP_CODE_REVOKED_KEY, &revoked);
    if (err == ESP_OK && revoked != 0U) {
        nvs_close(handle);
        return false;
    }

    int64_t expires_at = 0;
    err = nvs_get_i64(handle, SETUP_CODE_EXPIRES_AT_KEY, &expires_at);
    if (err == ESP_OK && expires_at <= 0) {
        nvs_close(handle);
        return false;
    }

    nvs_close(handle);
    return nvs_setup_verifier_exists();
}

bool nvs_setup_code_verify(const char *code)
{
    esp_err_t err = validate_input_string(code, 1, NVS_SETUP_CODE_MAX_LEN, "Setup code");
    if (err != ESP_OK || !nvs_setup_verifier_is_active()) {
        return false;
    }

    char expected_hash[NVS_SETUP_CODE_HASH_MAX_LEN + 1] = {0};
    char salt[NVS_SETUP_CODE_SALT_MAX_LEN + 1] = {0};
    err = nvs_setup_verifier_load(expected_hash, sizeof(expected_hash), salt, sizeof(salt));
    if (err != ESP_OK) {
        return false;
    }

    char candidate[NVS_SETUP_CODE_HASH_MAX_LEN + 1] = {0};
    if (salt[0] != '\0') {
        snprintf(candidate, sizeof(candidate), "%s:%s", salt, code);
    } else {
        snprintf(candidate, sizeof(candidate), "%s", code);
    }

    bool verified = constant_time_equals(candidate, expected_hash) || constant_time_equals(code, expected_hash);
    memset(candidate, 0, sizeof(candidate));
    memset(expected_hash, 0, sizeof(expected_hash));
    memset(salt, 0, sizeof(salt));
    return verified;
}
