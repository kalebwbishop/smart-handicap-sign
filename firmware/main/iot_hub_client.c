#include "iot_hub_client.h"

#include <inttypes.h>
#include <stdio.h>
#include <string.h>

#include "cJSON.h"
#include "esp_crt_bundle.h"
#include "esp_log.h"
#include "mqtt_client.h"
#include "nvs_storage.h"

#define TAG "iot_hub_client"

#define DEFAULT_TELEMETRY_INTERVAL_MS 1000U
#define MAX_TELEMETRY_INTERVAL_MS 3600000U
#define TELEMETRY_QUEUE_DEPTH 4U
#define TOPIC_BUFFER_SIZE 512U
#define PAYLOAD_BUFFER_SIZE 2048U
#define STATE_JSON_BUFFER_SIZE 256U
#define HAZARD_HERO_NAMESPACE "hazardHero"
#define D2C_TOPIC_SUFFIX "/messages/events/"
#define DESIRED_TOPIC_FILTER_SUFFIX "/twin/PATCH/properties/desired/#"
#define TWIN_RESPONSE_TOPIC_FRAGMENT "/twin/res/"
#define MAX_SAMPLE_VALUE 4095

typedef struct {
    int samples[SAMPLES_PER_BATCH];
    size_t sample_count;
    uint32_t sequence;
} telemetry_batch_t;

typedef struct {
    char host[IOT_HUB_HOST_MAX_LEN + 1];
    char device_id[IOT_HUB_DEVICE_ID_MAX_LEN + 1];
    char api_version[IOT_HUB_API_VERSION_MAX_LEN + 1];
    char sas_token[IOT_HUB_SAS_TOKEN_MAX_LEN + 1];
    uint16_t mqtt_port;
    bool credentials_ready;
} hub_settings_t;

static hub_settings_t s_settings;
static iot_hub_state_t s_state;
static esp_mqtt_client_handle_t s_client;
static bool s_initialized;
static bool s_started;
static bool s_connected;
static uint32_t s_next_rid = 1U;
static uint32_t s_next_sequence = 1U;
static telemetry_batch_t s_pending[TELEMETRY_QUEUE_DEPTH];
static size_t s_pending_head;
static size_t s_pending_count;
static char s_rx_topic[TOPIC_BUFFER_SIZE];
static char s_rx_payload[PAYLOAD_BUFFER_SIZE];
static size_t s_rx_payload_len;
static bool s_rx_dropping;
static portMUX_TYPE s_lock = portMUX_INITIALIZER_UNLOCKED;

static void set_default_state(iot_hub_state_t *state)
{
    if (state == NULL) {
        return;
    }

    state->status = STATUS_OFFLINE;
    state->telemetry_enabled = false;
    state->telemetry_interval_ms = DEFAULT_TELEMETRY_INTERVAL_MS;
    state->last_desired_version = 0U;
}

static const char *status_to_string(device_status_t status)
{
    switch (status) {
    case STATUS_AVAILABLE:
        return "available";
    case STATUS_ASSISTANCE_REQUESTED:
        return "assistance_requested";
    case STATUS_ASSISTANCE_IN_PROGRESS:
        return "assistance_in_progress";
    case STATUS_OFFLINE:
        return "offline";
    case STATUS_ERROR:
    default:
        return "error";
    }
}

static bool parse_status_string(const char *status_str, device_status_t *status)
{
    if (status_str == NULL || status == NULL) {
        return false;
    }

    if (strcmp(status_str, "available") == 0) {
        *status = STATUS_AVAILABLE;
        return true;
    }
    if (strcmp(status_str, "assistance_requested") == 0) {
        *status = STATUS_ASSISTANCE_REQUESTED;
        return true;
    }
    if (strcmp(status_str, "assistance_in_progress") == 0) {
        *status = STATUS_ASSISTANCE_IN_PROGRESS;
        return true;
    }
    if (strcmp(status_str, "offline") == 0) {
        *status = STATUS_OFFLINE;
        return true;
    }
    if (strcmp(status_str, "error") == 0) {
        *status = STATUS_ERROR;
        return true;
    }

    return false;
}

static esp_err_t format_state_json(const iot_hub_state_t *state, char *buffer, size_t buffer_len)
{
    if (state == NULL || buffer == NULL || buffer_len == 0U) {
        return ESP_ERR_INVALID_ARG;
    }

    int written = snprintf(
        buffer,
        buffer_len,
        "{\"status\":\"%s\",\"telemetryEnabled\":%s,\"telemetryIntervalMs\":%" PRIu32 ",\"lastDesiredVersion\":%" PRIu32 "}",
        status_to_string(state->status),
        state->telemetry_enabled ? "true" : "false",
        state->telemetry_interval_ms,
        state->last_desired_version);
    if (written < 0 || (size_t)written >= buffer_len) {
        return ESP_ERR_NO_MEM;
    }

    return ESP_OK;
}

static esp_err_t format_reported_payload(const iot_hub_state_t *state, char *buffer, size_t buffer_len)
{
    char state_json[STATE_JSON_BUFFER_SIZE] = {0};
    esp_err_t err = format_state_json(state, state_json, sizeof(state_json));
    if (err != ESP_OK) {
        return err;
    }

    int written = snprintf(buffer, buffer_len, "{\"%s\":%s}", HAZARD_HERO_NAMESPACE, state_json);
    if (written < 0 || (size_t)written >= buffer_len) {
        return ESP_ERR_NO_MEM;
    }

    return ESP_OK;
}

static esp_err_t format_telemetry_payload(const telemetry_batch_t *batch, const iot_hub_state_t *state, char *buffer, size_t buffer_len)
{
    if (batch == NULL || state == NULL || buffer == NULL || buffer_len == 0U) {
        return ESP_ERR_INVALID_ARG;
    }

    int written = snprintf(
        buffer,
        buffer_len,
        "{\"deviceId\":\"%s\",\"sequence\":%" PRIu32 ",\"status\":\"%s\",\"sampleCount\":%zu,\"samples\":[",
        s_settings.device_id,
        batch->sequence,
        status_to_string(state->status),
        batch->sample_count);
    if (written < 0 || (size_t)written >= buffer_len) {
        return ESP_ERR_NO_MEM;
    }

    size_t used = (size_t)written;
    for (size_t i = 0; i < batch->sample_count; ++i) {
        written = snprintf(buffer + used, buffer_len - used, "%s%d", i == 0U ? "" : ",", batch->samples[i]);
        if (written < 0 || (size_t)written >= (buffer_len - used)) {
            return ESP_ERR_NO_MEM;
        }
        used += (size_t)written;
    }

    written = snprintf(buffer + used, buffer_len - used, "]}");
    if (written < 0 || (size_t)written >= (buffer_len - used)) {
        return ESP_ERR_NO_MEM;
    }

    return ESP_OK;
}

static esp_err_t build_topic(char *buffer, size_t buffer_len, const char *suffix)
{
    if (buffer == NULL || suffix == NULL || buffer_len == 0U) {
        return ESP_ERR_INVALID_ARG;
    }

    int written = snprintf(buffer, buffer_len, "devices/%s%s", s_settings.device_id, suffix);
    if (written < 0 || (size_t)written >= buffer_len) {
        return ESP_ERR_NO_MEM;
    }

    return ESP_OK;
}

static bool validate_samples(const int *samples, size_t sample_count)
{
    if (samples == NULL || sample_count != SAMPLES_PER_BATCH) {
        return false;
    }

    for (size_t i = 0; i < sample_count; ++i) {
        if (samples[i] < 0 || samples[i] > MAX_SAMPLE_VALUE) {
            return false;
        }
    }

    return true;
}

static esp_err_t load_cached_state(iot_hub_state_t *state)
{
    if (state == NULL) {
        return ESP_ERR_INVALID_ARG;
    }

    set_default_state(state);

    if (!nvs_iot_hub_state_exists()) {
        return ESP_OK;
    }

    char state_json[NVS_IOT_HUB_STATE_MAX_LEN + 1] = {0};
    esp_err_t err = nvs_iot_hub_state_load(state_json, sizeof(state_json));
    if (err != ESP_OK) {
        ESP_LOGW(TAG, "Failed to load cached IoT Hub state: %s", esp_err_to_name(err));
        return ESP_OK;
    }

    cJSON *json = cJSON_Parse(state_json);
    if (json == NULL) {
        ESP_LOGW(TAG, "Cached IoT Hub state JSON is invalid; using defaults");
        return ESP_OK;
    }

    const cJSON *status = cJSON_GetObjectItemCaseSensitive(json, "status");
    const cJSON *telemetry_enabled = cJSON_GetObjectItemCaseSensitive(json, "telemetryEnabled");
    const cJSON *telemetry_interval_ms = cJSON_GetObjectItemCaseSensitive(json, "telemetryIntervalMs");
    const cJSON *desired_version = cJSON_GetObjectItemCaseSensitive(json, "lastDesiredVersion");

    if (cJSON_IsString(status) && status->valuestring != NULL) {
        device_status_t parsed_status;
        if (parse_status_string(status->valuestring, &parsed_status)) {
            state->status = parsed_status;
        }
    }
    if (cJSON_IsBool(telemetry_enabled)) {
        state->telemetry_enabled = cJSON_IsTrue(telemetry_enabled);
    } else if (cJSON_IsNumber(telemetry_enabled)) {
        state->telemetry_enabled = cJSON_GetNumberValue(telemetry_enabled) != 0.0;
    }
    if (cJSON_IsNumber(telemetry_interval_ms)) {
        double value = cJSON_GetNumberValue(telemetry_interval_ms);
        if (value > 0.0 && value <= (double)MAX_TELEMETRY_INTERVAL_MS) {
            state->telemetry_interval_ms = (uint32_t)value;
        }
    }
    if (cJSON_IsNumber(desired_version)) {
        double value = cJSON_GetNumberValue(desired_version);
        if (value >= 0.0) {
            state->last_desired_version = (uint32_t)value;
        }
    }

    cJSON_Delete(json);
    return ESP_OK;
}

static esp_err_t save_cached_state(const iot_hub_state_t *state)
{
    if (state == NULL) {
        return ESP_ERR_INVALID_ARG;
    }

    char state_json[NVS_IOT_HUB_STATE_MAX_LEN + 1] = {0};
    esp_err_t err = format_state_json(state, state_json, sizeof(state_json));
    if (err != ESP_OK) {
        return err;
    }

    err = nvs_iot_hub_state_save(state_json);
    if (err != ESP_OK) {
        ESP_LOGW(TAG, "Failed to persist cached IoT Hub state: %s", esp_err_to_name(err));
    }

    return err;
}

static bool queue_pending_batch(const telemetry_batch_t *batch)
{
    bool dropped_oldest = false;

    portENTER_CRITICAL(&s_lock);

    if (s_pending_count >= TELEMETRY_QUEUE_DEPTH) {
        s_pending_head = (s_pending_head + 1U) % TELEMETRY_QUEUE_DEPTH;
        s_pending_count--;
        dropped_oldest = true;
    }

    size_t slot = (s_pending_head + s_pending_count) % TELEMETRY_QUEUE_DEPTH;
    s_pending[slot] = *batch;
    s_pending_count++;

    portEXIT_CRITICAL(&s_lock);
    return dropped_oldest;
}

static bool peek_pending_batch(telemetry_batch_t *batch)
{
    if (batch == NULL) {
        return false;
    }

    bool available = false;
    portENTER_CRITICAL(&s_lock);
    if (s_pending_count > 0U) {
        *batch = s_pending[s_pending_head];
        available = true;
    }
    portEXIT_CRITICAL(&s_lock);
    return available;
}

static void drop_pending_batch(void)
{
    portENTER_CRITICAL(&s_lock);
    if (s_pending_count > 0U) {
        s_pending_head = (s_pending_head + 1U) % TELEMETRY_QUEUE_DEPTH;
        s_pending_count--;
    }
    portEXIT_CRITICAL(&s_lock);
}

static uint32_t next_request_id(void)
{
    portENTER_CRITICAL(&s_lock);
    uint32_t rid = s_next_rid++;
    portEXIT_CRITICAL(&s_lock);
    return rid;
}

static void copy_state(iot_hub_state_t *state)
{
    if (state == NULL) {
        return;
    }

    portENTER_CRITICAL(&s_lock);
    *state = s_state;
    portEXIT_CRITICAL(&s_lock);
}

static esp_err_t publish_message(const char *topic, const char *payload)
{
    if (s_client == NULL || topic == NULL || payload == NULL) {
        return ESP_ERR_INVALID_STATE;
    }

    int msg_id = esp_mqtt_client_enqueue(s_client, topic, payload, (int)strlen(payload), 1, 0, true);
    if (msg_id >= 0) {
        return ESP_OK;
    }

    if (msg_id == -2) {
        return ESP_ERR_NO_MEM;
    }

    return ESP_FAIL;
}

static esp_err_t publish_reported_state(void)
{
    iot_hub_state_t current_state;
    copy_state(&current_state);

    char payload[PAYLOAD_BUFFER_SIZE] = {0};
    char topic[TOPIC_BUFFER_SIZE] = {0};

    esp_err_t err = format_reported_payload(&current_state, payload, sizeof(payload));
    if (err != ESP_OK) {
        return err;
    }

    err = build_topic(topic, sizeof(topic), "/twin/PATCH/properties/reported/");
    if (err != ESP_OK) {
        return err;
    }

    uint32_t rid = next_request_id();
    char reported_topic[TOPIC_BUFFER_SIZE] = {0};
    int written = snprintf(reported_topic, sizeof(reported_topic), "%s?$rid=%" PRIu32, topic, rid);
    if (written < 0 || (size_t)written >= sizeof(reported_topic)) {
        return ESP_ERR_NO_MEM;
    }

    return publish_message(reported_topic, payload);
}

static esp_err_t publish_twin_get(void)
{
    char topic[TOPIC_BUFFER_SIZE] = {0};
    uint32_t rid = next_request_id();
    esp_err_t err = build_topic(topic, sizeof(topic), "/twin/get/");
    if (err != ESP_OK) {
        return err;
    }

    char request_topic[TOPIC_BUFFER_SIZE] = {0};
    int written = snprintf(request_topic, sizeof(request_topic), "%s?$rid=%" PRIu32, topic, rid);
    if (written < 0 || (size_t)written >= sizeof(request_topic)) {
        return ESP_ERR_NO_MEM;
    }

    return publish_message(request_topic, "");
}

static void flush_pending_batches(void)
{
    if (s_client == NULL) {
        return;
    }

    for (;;) {
        telemetry_batch_t batch = {0};
        if (!peek_pending_batch(&batch)) {
            return;
        }

        char payload[PAYLOAD_BUFFER_SIZE] = {0};
        char topic[TOPIC_BUFFER_SIZE] = {0};
        iot_hub_state_t current_state;
        copy_state(&current_state);

        esp_err_t err = format_telemetry_payload(&batch, &current_state, payload, sizeof(payload));
        if (err != ESP_OK) {
            ESP_LOGW(TAG, "Failed to serialize queued telemetry batch: %s", esp_err_to_name(err));
            return;
        }

        err = build_topic(topic, sizeof(topic), D2C_TOPIC_SUFFIX);
        if (err != ESP_OK) {
            ESP_LOGW(TAG, "Failed to build telemetry topic: %s", esp_err_to_name(err));
            return;
        }

        err = publish_message(topic, payload);
        if (err != ESP_OK) {
            ESP_LOGW(TAG, "Deferred telemetry publish still pending: %s", esp_err_to_name(err));
            return;
        }

        drop_pending_batch();
    }
}

static esp_err_t publish_telemetry_batch(const telemetry_batch_t *batch)
{
    if (batch == NULL) {
        return ESP_ERR_INVALID_ARG;
    }

    iot_hub_state_t current_state;
    copy_state(&current_state);

    char payload[PAYLOAD_BUFFER_SIZE] = {0};
    char topic[TOPIC_BUFFER_SIZE] = {0};

    esp_err_t err = format_telemetry_payload(batch, &current_state, payload, sizeof(payload));
    if (err != ESP_OK) {
        return err;
    }

    err = build_topic(topic, sizeof(topic), D2C_TOPIC_SUFFIX);
    if (err != ESP_OK) {
        return err;
    }

    return publish_message(topic, payload);
}

static esp_err_t apply_patch_object(cJSON *version_source, cJSON *patch)
{
    if (version_source == NULL || patch == NULL) {
        return ESP_ERR_INVALID_ARG;
    }

    iot_hub_state_t next_state;
    copy_state(&next_state);
    bool changed = false;

    const cJSON *status = cJSON_GetObjectItemCaseSensitive(patch, "status");
    if (cJSON_IsString(status) && status->valuestring != NULL) {
        device_status_t parsed_status;
        if (!parse_status_string(status->valuestring, &parsed_status)) {
            ESP_LOGW(TAG, "Ignoring desired property with unknown status '%s'", status->valuestring);
            return ESP_ERR_INVALID_ARG;
        }

        next_state.status = parsed_status;
        changed = true;
    } else if (status != NULL) {
        ESP_LOGW(TAG, "Ignoring desired property 'status' with invalid type");
        return ESP_ERR_INVALID_ARG;
    }

    const cJSON *telemetry_enabled = cJSON_GetObjectItemCaseSensitive(patch, "telemetryEnabled");
    if (cJSON_IsBool(telemetry_enabled)) {
        next_state.telemetry_enabled = cJSON_IsTrue(telemetry_enabled);
        changed = true;
    } else if (telemetry_enabled != NULL && !cJSON_IsNull(telemetry_enabled)) {
        ESP_LOGW(TAG, "Ignoring desired property 'telemetryEnabled' with invalid type");
        return ESP_ERR_INVALID_ARG;
    }

    const cJSON *telemetry_interval_ms = cJSON_GetObjectItemCaseSensitive(patch, "telemetryIntervalMs");
    if (cJSON_IsNumber(telemetry_interval_ms)) {
        double value = cJSON_GetNumberValue(telemetry_interval_ms);
        if (value <= 0.0 || value > (double)MAX_TELEMETRY_INTERVAL_MS) {
            ESP_LOGW(TAG, "Ignoring desired property 'telemetryIntervalMs' out of range");
            return ESP_ERR_INVALID_ARG;
        }

        next_state.telemetry_interval_ms = (uint32_t)value;
        changed = true;
    } else if (telemetry_interval_ms != NULL) {
        ESP_LOGW(TAG, "Ignoring desired property 'telemetryIntervalMs' with invalid type");
        return ESP_ERR_INVALID_ARG;
    }

    const cJSON *version = cJSON_GetObjectItemCaseSensitive(version_source, "$version");
    if (cJSON_IsNumber(version)) {
        double value = cJSON_GetNumberValue(version);
        if (value >= 0.0) {
            next_state.last_desired_version = (uint32_t)value;
            changed = true;
        }
    }

    if (!changed) {
        return ESP_OK;
    }

    portENTER_CRITICAL(&s_lock);
    s_state = next_state;
    portEXIT_CRITICAL(&s_lock);

    esp_err_t err = save_cached_state(&next_state);
    if (err != ESP_OK) {
        ESP_LOGW(TAG, "Cached IoT Hub state could not be saved: %s", esp_err_to_name(err));
    }

    err = publish_reported_state();
    if (err != ESP_OK) {
        ESP_LOGW(TAG, "Failed to publish reported state: %s", esp_err_to_name(err));
    }

    return ESP_OK;
}

static esp_err_t apply_desired_properties_json(const char *json, bool from_twin_response)
{
    if (json == NULL) {
        return ESP_ERR_INVALID_ARG;
    }

    cJSON *root = cJSON_Parse(json);
    if (root == NULL) {
        ESP_LOGW(TAG, "Received invalid desired property JSON");
        return ESP_ERR_INVALID_ARG;
    }

    cJSON *patch = root;
    cJSON *version_source = root;
    if (from_twin_response) {
        cJSON *properties = cJSON_GetObjectItemCaseSensitive(root, "properties");
        cJSON *desired = NULL;
        if (cJSON_IsObject(properties)) {
            desired = cJSON_GetObjectItemCaseSensitive(properties, "desired");
        }
        if (cJSON_IsObject(desired)) {
            patch = desired;
            version_source = desired;
        } else {
            cJSON_Delete(root);
            ESP_LOGW(TAG, "Twin response did not contain desired properties");
            return ESP_OK;
        }
    } else {
        cJSON *namespaced = cJSON_GetObjectItemCaseSensitive(root, HAZARD_HERO_NAMESPACE);
        if (cJSON_IsObject(namespaced)) {
            patch = namespaced;
        }
    }

    esp_err_t err = apply_patch_object(version_source, patch);
    cJSON_Delete(root);
    return err;
}

static void process_complete_mqtt_message(void)
{
    if (s_rx_topic[0] == '\0' || s_rx_payload[0] == '\0') {
        return;
    }

    if (strstr(s_rx_topic, TWIN_RESPONSE_TOPIC_FRAGMENT) != NULL) {
        (void)apply_desired_properties_json(s_rx_payload, true);
        return;
    }

    if (strstr(s_rx_topic, DESIRED_TOPIC_FILTER_SUFFIX) != NULL || strstr(s_rx_topic, "/twin/PATCH/properties/desired/") != NULL) {
        (void)apply_desired_properties_json(s_rx_payload, false);
    }
}

static void reset_rx_message(void)
{
    s_rx_topic[0] = '\0';
    s_rx_payload[0] = '\0';
    s_rx_payload_len = 0U;
    s_rx_dropping = false;
}

static void append_rx_chunk(esp_mqtt_event_handle_t event)
{
    if (event == NULL || event->topic == NULL || event->data == NULL) {
        return;
    }

    if (event->current_data_offset == 0) {
        reset_rx_message();
        if (event->topic_len >= sizeof(s_rx_topic)) {
            s_rx_dropping = true;
            return;
        }

        memcpy(s_rx_topic, event->topic, (size_t)event->topic_len);
        s_rx_topic[event->topic_len] = '\0';
    }

    if (s_rx_dropping) {
        return;
    }

    size_t remaining = sizeof(s_rx_payload) - s_rx_payload_len - 1U;
    if ((size_t)event->data_len > remaining) {
        s_rx_dropping = true;
        ESP_LOGW(TAG, "Dropping oversized MQTT message on topic %s", s_rx_topic);
        return;
    }

    memcpy(s_rx_payload + s_rx_payload_len, event->data, (size_t)event->data_len);
    s_rx_payload_len += (size_t)event->data_len;

    if ((size_t)event->current_data_offset + (size_t)event->data_len >= (size_t)event->total_data_len) {
        s_rx_payload[s_rx_payload_len] = '\0';
        process_complete_mqtt_message();
        reset_rx_message();
    }
}

static void subscribe_desired_properties(void)
{
    if (s_client == NULL) {
        return;
    }

    char topic[TOPIC_BUFFER_SIZE] = {0};
    if (build_topic(topic, sizeof(topic), DESIRED_TOPIC_FILTER_SUFFIX) != ESP_OK) {
        return;
    }

    int msg_id = esp_mqtt_client_subscribe(s_client, topic, 1);
    if (msg_id < 0) {
        ESP_LOGW(TAG, "Failed to subscribe to desired property updates");
        return;
    }

    ESP_LOGI(TAG, "Subscribed to desired property updates");
}

static void log_mqtt_error(esp_mqtt_event_handle_t event)
{
    if (event == NULL || event->error_handle == NULL) {
        ESP_LOGW(TAG, "MQTT error with no error handle");
        return;
    }

    esp_mqtt_error_codes_t *error = event->error_handle;
    if (error->error_type == MQTT_ERROR_TYPE_TCP_TRANSPORT) {
        ESP_LOGW(TAG, "MQTT TLS error: esp_err=0x%x tls_stack=0x%x errno=%d",
                 error->esp_tls_last_esp_err,
                 error->esp_tls_stack_err,
                 error->esp_transport_sock_errno);
    } else if (error->error_type == MQTT_ERROR_TYPE_CONNECTION_REFUSED) {
        ESP_LOGW(TAG, "MQTT connection refused: code=%d", error->connect_return_code);
    } else {
        ESP_LOGW(TAG, "MQTT error type=%d", error->error_type);
    }
}

static void mqtt_event_handler(void *handler_args, esp_event_base_t base, int32_t event_id, void *event_data)
{
    (void)handler_args;
    (void)base;

    esp_mqtt_event_handle_t event = (esp_mqtt_event_handle_t)event_data;
    if (event == NULL) {
        return;
    }

    switch ((esp_mqtt_event_id_t)event_id) {
    case MQTT_EVENT_CONNECTED:
        portENTER_CRITICAL(&s_lock);
        s_connected = true;
        portEXIT_CRITICAL(&s_lock);

        ESP_LOGI(TAG, "Connected to Azure IoT Hub");
        subscribe_desired_properties();
        (void)publish_twin_get();
        (void)publish_reported_state();
        flush_pending_batches();
        break;

    case MQTT_EVENT_DISCONNECTED:
        portENTER_CRITICAL(&s_lock);
        s_connected = false;
        portEXIT_CRITICAL(&s_lock);
        ESP_LOGW(TAG, "Disconnected from Azure IoT Hub");
        break;

    case MQTT_EVENT_DATA:
        append_rx_chunk(event);
        break;

    case MQTT_EVENT_ERROR:
        log_mqtt_error(event);
        portENTER_CRITICAL(&s_lock);
        s_connected = false;
        portEXIT_CRITICAL(&s_lock);
        break;

    default:
        break;
    }
}

esp_err_t iot_hub_client_init(const iot_hub_client_settings_t *settings, const iot_hub_state_t *initial_state)
{
    if (settings == NULL || settings->host[0] == '\0' || settings->device_id[0] == '\0' || settings->api_version[0] == '\0') {
        return ESP_ERR_INVALID_ARG;
    }

    memset(&s_settings, 0, sizeof(s_settings));
    strlcpy(s_settings.host, settings->host, sizeof(s_settings.host));
    strlcpy(s_settings.device_id, settings->device_id, sizeof(s_settings.device_id));
    strlcpy(s_settings.api_version, settings->api_version, sizeof(s_settings.api_version));
    strlcpy(s_settings.sas_token, settings->sas_token, sizeof(s_settings.sas_token));
    s_settings.mqtt_port = settings->mqtt_port;
    s_settings.credentials_ready = s_settings.sas_token[0] != '\0';

    if (initial_state != NULL) {
        s_state = *initial_state;
    } else {
        set_default_state(&s_state);
    }

    esp_err_t err = load_cached_state(&s_state);
    if (err != ESP_OK) {
        ESP_LOGW(TAG, "Using default IoT Hub state after cache load failure: %s", esp_err_to_name(err));
    }

    s_next_sequence = 1U;
    s_next_rid = 1U;
    s_client = NULL;
    s_started = false;
    s_connected = false;
    s_pending_head = 0U;
    s_pending_count = 0U;
    reset_rx_message();
    s_initialized = true;

    ESP_LOGI(TAG, "IoT Hub client initialized for %s", s_settings.device_id);
    if (!s_settings.credentials_ready) {
        ESP_LOGW(TAG, "IoT Hub SAS token not configured; cloud transport remains disabled");
    }

    return ESP_OK;
}

esp_err_t iot_hub_client_start(void)
{
    if (!s_initialized) {
        return ESP_ERR_INVALID_STATE;
    }

    if (!s_settings.credentials_ready) {
        return ESP_ERR_NOT_FOUND;
    }

    if (s_started) {
        return ESP_OK;
    }

    char broker_uri[TOPIC_BUFFER_SIZE] = {0};
    char username[TOPIC_BUFFER_SIZE] = {0};

    int written = snprintf(broker_uri, sizeof(broker_uri), "mqtts://%s:%u", s_settings.host, s_settings.mqtt_port);
    if (written < 0 || (size_t)written >= sizeof(broker_uri)) {
        return ESP_ERR_INVALID_ARG;
    }

    written = snprintf(username, sizeof(username), "%s/%s/?api-version=%s", s_settings.host, s_settings.device_id, s_settings.api_version);
    if (written < 0 || (size_t)written >= sizeof(username)) {
        return ESP_ERR_INVALID_ARG;
    }

    const esp_mqtt_client_config_t mqtt_cfg = {
        .broker = {
            .address.uri = broker_uri,
            .verification.crt_bundle_attach = esp_crt_bundle_attach,
        },
        .credentials = {
            .client_id = s_settings.device_id,
            .username = username,
            .authentication.password = s_settings.sas_token,
        },
        .session = {
            .keepalive = 60,
            .disable_clean_session = false,
        },
        .network = {
            .timeout_ms = 15000,
        },
        .task = {
            .stack_size = 6144,
        },
        .buffer = {
            .size = 2048,
        },
    };

    s_client = esp_mqtt_client_init(&mqtt_cfg);
    if (s_client == NULL) {
        return ESP_FAIL;
    }

    esp_err_t err = esp_mqtt_client_register_event(s_client, ESP_EVENT_ANY_ID, mqtt_event_handler, NULL);
    if (err != ESP_OK) {
        esp_mqtt_client_destroy(s_client);
        s_client = NULL;
        return err;
    }

    err = esp_mqtt_client_start(s_client);
    if (err != ESP_OK) {
        esp_mqtt_client_destroy(s_client);
        s_client = NULL;
        return err;
    }

    s_started = true;
    ESP_LOGI(TAG, "MQTT client started for Azure IoT Hub");
    return ESP_OK;
}

esp_err_t iot_hub_client_stop(void)
{
    if (!s_started || s_client == NULL) {
        return ESP_OK;
    }

    esp_err_t err = esp_mqtt_client_stop(s_client);
    if (err != ESP_OK) {
        return err;
    }

    err = esp_mqtt_client_destroy(s_client);
    if (err != ESP_OK) {
        return err;
    }

    s_client = NULL;
    s_started = false;
    portENTER_CRITICAL(&s_lock);
    s_connected = false;
    portEXIT_CRITICAL(&s_lock);
    return ESP_OK;
}

bool iot_hub_client_is_connected(void)
{
    bool connected = false;
    portENTER_CRITICAL(&s_lock);
    connected = s_connected;
    portEXIT_CRITICAL(&s_lock);
    return connected;
}

esp_err_t iot_hub_client_get_state(iot_hub_state_t *state)
{
    if (state == NULL) {
        return ESP_ERR_INVALID_ARG;
    }

    copy_state(state);
    return ESP_OK;
}

esp_err_t iot_hub_client_publish_telemetry(const int *samples, size_t sample_count)
{
    if (!s_initialized || !s_started || s_client == NULL) {
        return ESP_ERR_INVALID_STATE;
    }

    if (!validate_samples(samples, sample_count)) {
        return ESP_ERR_INVALID_ARG;
    }

    telemetry_batch_t batch = {0};
    memcpy(batch.samples, samples, sample_count * sizeof(samples[0]));
    batch.sample_count = sample_count;

    portENTER_CRITICAL(&s_lock);
    batch.sequence = s_next_sequence++;
    portEXIT_CRITICAL(&s_lock);

    flush_pending_batches();

    esp_err_t err = publish_telemetry_batch(&batch);
    if (err == ESP_OK) {
        return ESP_OK;
    }

    bool dropped_oldest = queue_pending_batch(&batch);
    if (dropped_oldest) {
        ESP_LOGW(TAG, "Telemetry queue full; dropping oldest batch");
    }

    ESP_LOGW(TAG, "Telemetry publish deferred: %s", esp_err_to_name(err));
    return dropped_oldest ? ESP_ERR_NO_MEM : ESP_OK;
}
