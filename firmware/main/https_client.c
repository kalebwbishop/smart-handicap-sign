#include "https_client.h"

#include <stdbool.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "cJSON.h"
#include "esp_http_client.h"
#include "esp_log.h"
#include "nvs_storage.h"

#define HTTP_TIMEOUT_MS 15000
#define HTTP_RX_BUFFER_SIZE 2048
#define HTTP_TX_BUFFER_SIZE 4096
#define CLASSIFY_SAMPLE_COUNT 512
#define CLASSIFY_PATH "/inference/classify"
#define STATUS_PATH_FORMAT "/devices/%s/status"
#define AUTH_HEADER_PREFIX "Bearer "
#define HTTP_RESPONSE_INITIAL_CAPACITY 256
#define STATUS_URL_EXTRA_LEN 32

static const char *TAG = "https_client";

extern const char ca_cert_pem_start[] asm("_binary_ca_cert_pem_start");
extern const char ca_cert_pem_end[] asm("_binary_ca_cert_pem_end");

typedef struct {
    char *data;
    size_t len;
    size_t capacity;
    bool alloc_failed;
} response_buffer_t;

static char s_base_url[HTTPS_URL_MAX_LEN];
static bool s_initialized = false;

static void secure_zero(void *buffer, size_t buffer_len)
{
    if (buffer == NULL || buffer_len == 0U) {
        return;
    }

    volatile unsigned char *bytes = (volatile unsigned char *)buffer;
    while (buffer_len-- > 0U) {
        *bytes++ = 0U;
    }
}

static void classify_result_reset(classify_result_t *result)
{
    if (result == NULL) {
        return;
    }

    memset(result, 0, sizeof(*result));
}

static void status_result_reset(status_result_t *result)
{
    if (result == NULL) {
        return;
    }

    memset(result, 0, sizeof(*result));
    result->status = STATUS_OFFLINE;
}

static esp_err_t response_buffer_init(response_buffer_t *buffer, size_t initial_capacity)
{
    if (buffer == NULL || initial_capacity == 0U) {
        return ESP_ERR_INVALID_ARG;
    }

    buffer->data = calloc(initial_capacity, sizeof(char));
    if (buffer->data == NULL) {
        return ESP_ERR_NO_MEM;
    }

    buffer->len = 0U;
    buffer->capacity = initial_capacity;
    buffer->alloc_failed = false;
    buffer->data[0] = '\0';
    return ESP_OK;
}

static void response_buffer_free(response_buffer_t *buffer)
{
    if (buffer == NULL) {
        return;
    }

    free(buffer->data);
    buffer->data = NULL;
    buffer->len = 0U;
    buffer->capacity = 0U;
    buffer->alloc_failed = false;
}

static esp_err_t response_buffer_append(response_buffer_t *buffer, const char *data, size_t data_len)
{
    if (buffer == NULL || data == NULL) {
        return ESP_ERR_INVALID_ARG;
    }

    size_t required = buffer->len + data_len + 1U;
    if (required > buffer->capacity) {
        size_t new_capacity = buffer->capacity;
        while (new_capacity < required) {
            new_capacity *= 2U;
        }

        char *new_data = realloc(buffer->data, new_capacity);
        if (new_data == NULL) {
            buffer->alloc_failed = true;
            return ESP_ERR_NO_MEM;
        }

        buffer->data = new_data;
        buffer->capacity = new_capacity;
    }

    memcpy(buffer->data + buffer->len, data, data_len);
    buffer->len += data_len;
    buffer->data[buffer->len] = '\0';
    return ESP_OK;
}

static esp_err_t http_event_handler(esp_http_client_event_t *evt)
{
    if (evt == NULL || evt->user_data == NULL) {
        return ESP_OK;
    }

    response_buffer_t *buffer = (response_buffer_t *)evt->user_data;
    if (evt->event_id == HTTP_EVENT_ON_DATA && evt->data != NULL && evt->data_len > 0) {
        return response_buffer_append(buffer, (const char *)evt->data, (size_t)evt->data_len);
    }

    return ESP_OK;
}

static esp_err_t build_url(const char *path, char *url, size_t url_len)
{
    if (!s_initialized) {
        return ESP_ERR_INVALID_STATE;
    }
    if (path == NULL || url == NULL || url_len == 0U) {
        return ESP_ERR_INVALID_ARG;
    }

    int written = snprintf(url, url_len, "%s%s", s_base_url, path);
    if (written < 0 || (size_t)written >= url_len) {
        ESP_LOGE(TAG, "URL buffer too small for path %s", path);
        return ESP_ERR_INVALID_ARG;
    }

    return ESP_OK;
}

static esp_err_t build_status_url(const char *serial_number, char *url, size_t url_len)
{
    if (!s_initialized) {
        return ESP_ERR_INVALID_STATE;
    }
    if (serial_number == NULL || url == NULL || url_len == 0U) {
        return ESP_ERR_INVALID_ARG;
    }

    int written = snprintf(url, url_len, "%s" STATUS_PATH_FORMAT, s_base_url, serial_number);
    if (written < 0 || (size_t)written >= url_len) {
        ESP_LOGE(TAG, "Status URL buffer too small for serial number");
        return ESP_ERR_INVALID_ARG;
    }

    return ESP_OK;
}

static esp_err_t build_auth_header(const char *serial_number, const char *auth_token, char *header, size_t header_len)
{
    if (serial_number == NULL || auth_token == NULL || header == NULL || header_len == 0U) {
        return ESP_ERR_INVALID_ARG;
    }

    int written = snprintf(header, header_len, AUTH_HEADER_PREFIX "%s:%s", serial_number, auth_token);
    if (written < 0 || (size_t)written >= header_len) {
        ESP_LOGE(TAG, "Authorization header buffer too small");
        return ESP_ERR_INVALID_ARG;
    }

    return ESP_OK;
}

static esp_err_t validate_samples(const int *samples, int sample_count)
{
    if (samples == NULL) {
        ESP_LOGE(TAG, "Samples buffer is required");
        return ESP_ERR_INVALID_ARG;
    }

    if (sample_count != CLASSIFY_SAMPLE_COUNT) {
        ESP_LOGE(TAG, "Expected %d ADC samples, got %d", CLASSIFY_SAMPLE_COUNT, sample_count);
        return ESP_ERR_INVALID_ARG;
    }

    for (int i = 0; i < sample_count; ++i) {
        if (samples[i] < 0 || samples[i] > 4095) {
            ESP_LOGE(TAG, "ADC sample at index %d is out of range: %d", i, samples[i]);
            return ESP_ERR_INVALID_ARG;
        }
    }

    return ESP_OK;
}

static esp_err_t load_serial_and_auth(char *serial_number, size_t serial_len, char *auth_token, size_t token_len)
{
    esp_err_t err = nvs_identity_load(serial_number, serial_len);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "Failed to load serial number from NVS: %s", esp_err_to_name(err));
        return err;
    }

    err = nvs_auth_token_load(auth_token, token_len);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "Failed to load auth token from NVS: %s", esp_err_to_name(err));
        return err;
    }

    return ESP_OK;
}

static esp_err_t perform_request(const char *url,
                                 esp_http_client_method_t method,
                                 const char *auth_header,
                                 const char *request_body,
                                 response_buffer_t *response,
                                 int *http_status)
{
    if (url == NULL || response == NULL || http_status == NULL) {
        return ESP_ERR_INVALID_ARG;
    }

    esp_http_client_config_t config = {
        .url = url,
        .cert_pem = ca_cert_pem_start,
        .method = method,
        .timeout_ms = HTTP_TIMEOUT_MS,
        .buffer_size = HTTP_RX_BUFFER_SIZE,
        .buffer_size_tx = HTTP_TX_BUFFER_SIZE,
        .event_handler = http_event_handler,
        .user_data = response,
        .skip_cert_common_name_check = false,
    };

    esp_http_client_handle_t client = esp_http_client_init(&config);
    if (client == NULL) {
        ESP_LOGE(TAG, "Failed to initialize HTTP client");
        return ESP_FAIL;
    }

    esp_http_client_set_header(client, "Accept", "application/json");
    if (auth_header != NULL) {
        esp_http_client_set_header(client, "Authorization", auth_header);
    }
    if (request_body != NULL) {
        esp_http_client_set_header(client, "Content-Type", "application/json");
        esp_http_client_set_post_field(client, request_body, (int)strlen(request_body));
    }

    esp_err_t err = esp_http_client_perform(client);
    if (response->alloc_failed) {
        err = ESP_ERR_NO_MEM;
    }

    if (err == ESP_OK) {
        *http_status = esp_http_client_get_status_code(client);
        ESP_LOGI(TAG, "%s %s -> HTTP %d", method == HTTP_METHOD_POST ? "POST" : "GET", url, *http_status);
    } else {
        ESP_LOGE(TAG, "HTTP request failed for %s: %s", url, esp_err_to_name(err));
    }

    esp_http_client_cleanup(client);
    return err;
}

static esp_err_t parse_classify_response(const char *response_body, classify_result_t *result)
{
    cJSON *json = cJSON_Parse(response_body);
    if (json == NULL) {
        ESP_LOGE(TAG, "Failed to parse classify response JSON");
        return ESP_FAIL;
    }

    const cJSON *label = cJSON_GetObjectItemCaseSensitive(json, "label");
    const cJSON *confidence = cJSON_GetObjectItemCaseSensitive(json, "confidence");
    if (!cJSON_IsString(label) || label->valuestring == NULL || !cJSON_IsNumber(confidence)) {
        cJSON_Delete(json);
        ESP_LOGE(TAG, "Classify response missing required fields");
        return ESP_FAIL;
    }

    snprintf(result->label, sizeof(result->label), "%s", label->valuestring);
    result->confidence = (float)cJSON_GetNumberValue(confidence);

    cJSON_Delete(json);
    return ESP_OK;
}

static esp_err_t parse_status_response(const char *response_body, status_result_t *result)
{
    cJSON *json = cJSON_Parse(response_body);
    if (json == NULL) {
        ESP_LOGE(TAG, "Failed to parse status response JSON");
        return ESP_FAIL;
    }

    const cJSON *status = cJSON_GetObjectItemCaseSensitive(json, "status");
    if (!cJSON_IsString(status) || status->valuestring == NULL) {
        cJSON_Delete(json);
        ESP_LOGE(TAG, "Status response missing status field");
        return ESP_FAIL;
    }

    snprintf(result->status_str, sizeof(result->status_str), "%s", status->valuestring);
    result->status = led_driver_status_from_string(result->status_str);

    cJSON_Delete(json);
    return ESP_OK;
}

esp_err_t https_client_init(const char *base_url)
{
    if (base_url == NULL || base_url[0] == '\0') {
        return ESP_ERR_INVALID_ARG;
    }

    size_t base_url_len = strlen(base_url);
    while (base_url_len > 0U && base_url[base_url_len - 1U] == '/') {
        base_url_len--;
    }

    if (base_url_len == 0U || base_url_len >= sizeof(s_base_url)) {
        return ESP_ERR_INVALID_ARG;
    }

    memcpy(s_base_url, base_url, base_url_len);
    s_base_url[base_url_len] = '\0';
    s_initialized = true;

    size_t cert_len = (size_t)(ca_cert_pem_end - ca_cert_pem_start);
    ESP_LOGI(TAG, "HTTPS client initialized for %s", s_base_url);
    ESP_LOGI(TAG, "TLS certificate common-name validation is enabled");
    ESP_LOGD(TAG, "Embedded CA cert length: %u bytes", (unsigned int)cert_len);
    return ESP_OK;
}

esp_err_t https_client_classify(const int *samples, int sample_count, classify_result_t *result)
{
    if (result == NULL) {
        return ESP_ERR_INVALID_ARG;
    }

    classify_result_reset(result);
    if (!s_initialized) {
        return ESP_ERR_INVALID_STATE;
    }

    esp_err_t err = validate_samples(samples, sample_count);
    if (err != ESP_OK) {
        return err;
    }

    char serial_number[NVS_SERIAL_NUMBER_MAX_LEN + 1] = {0};
    char auth_token[NVS_AUTH_TOKEN_MAX_LEN + 1] = {0};
    char url[HTTPS_URL_MAX_LEN + sizeof(CLASSIFY_PATH)] = {0};
    char auth_header[sizeof(AUTH_HEADER_PREFIX) + NVS_SERIAL_NUMBER_MAX_LEN + NVS_AUTH_TOKEN_MAX_LEN + 2] = {0};
    response_buffer_t response = {0};
    cJSON *root = NULL;
    char *request_body = NULL;

    err = load_serial_and_auth(serial_number, sizeof(serial_number), auth_token, sizeof(auth_token));
    if (err != ESP_OK) {
        goto cleanup;
    }

    root = cJSON_CreateObject();
    if (root == NULL) {
        err = ESP_ERR_NO_MEM;
        goto cleanup;
    }

    cJSON *sample_array = cJSON_CreateIntArray(samples, sample_count);
    if (sample_array == NULL) {
        err = ESP_ERR_NO_MEM;
        goto cleanup;
    }

    cJSON_AddStringToObject(root, "serial_number", serial_number);
    cJSON_AddItemToObject(root, "samples", sample_array);

    request_body = cJSON_PrintUnformatted(root);
    if (request_body == NULL) {
        err = ESP_ERR_NO_MEM;
        goto cleanup;
    }

    err = build_url(CLASSIFY_PATH, url, sizeof(url));
    if (err == ESP_OK) {
        err = build_auth_header(serial_number, auth_token, auth_header, sizeof(auth_header));
    }
    if (err == ESP_OK) {
        err = response_buffer_init(&response, HTTP_RESPONSE_INITIAL_CAPACITY);
    }
    if (err == ESP_OK) {
        err = perform_request(url, HTTP_METHOD_POST, auth_header, request_body, &response, &result->http_status);
    }
    if (err == ESP_OK && result->http_status == 200) {
        err = parse_classify_response(response.data, result);
    }

cleanup:
    cJSON_Delete(root);
    response_buffer_free(&response);
    if (request_body != NULL) {
        secure_zero(request_body, strlen(request_body));
        free(request_body);
    }
    secure_zero(auth_header, sizeof(auth_header));
    secure_zero(auth_token, sizeof(auth_token));
    secure_zero(serial_number, sizeof(serial_number));
    return err;
}

esp_err_t https_client_get_status(status_result_t *result)
{
    if (result == NULL) {
        return ESP_ERR_INVALID_ARG;
    }

    status_result_reset(result);
    if (!s_initialized) {
        return ESP_ERR_INVALID_STATE;
    }

    char serial_number[NVS_SERIAL_NUMBER_MAX_LEN + 1] = {0};
    char auth_token[NVS_AUTH_TOKEN_MAX_LEN + 1] = {0};
    char url[HTTPS_URL_MAX_LEN + NVS_SERIAL_NUMBER_MAX_LEN + STATUS_URL_EXTRA_LEN] = {0};
    char auth_header[sizeof(AUTH_HEADER_PREFIX) + NVS_SERIAL_NUMBER_MAX_LEN + NVS_AUTH_TOKEN_MAX_LEN + 2] = {0};
    response_buffer_t response = {0};

    esp_err_t err = load_serial_and_auth(serial_number, sizeof(serial_number), auth_token, sizeof(auth_token));
    if (err == ESP_OK) {
        err = build_status_url(serial_number, url, sizeof(url));
    }
    if (err == ESP_OK) {
        err = build_auth_header(serial_number, auth_token, auth_header, sizeof(auth_header));
    }
    if (err == ESP_OK) {
        err = response_buffer_init(&response, HTTP_RESPONSE_INITIAL_CAPACITY);
    }
    if (err == ESP_OK) {
        err = perform_request(url, HTTP_METHOD_GET, auth_header, NULL, &response, &result->http_status);
    }
    if (err == ESP_OK && result->http_status == 200) {
        err = parse_status_response(response.data, result);
    }

    response_buffer_free(&response);
    secure_zero(auth_header, sizeof(auth_header));
    secure_zero(auth_token, sizeof(auth_token));
    secure_zero(serial_number, sizeof(serial_number));
    return err;
}
