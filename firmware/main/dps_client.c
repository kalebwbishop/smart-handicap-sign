#include "dps_client.h"

#include <inttypes.h>
#include <stdbool.h>
#include <stdio.h>
#include <string.h>

#include "cJSON.h"
#include "esp_crt_bundle.h"
#include "esp_event.h"
#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/event_groups.h"
#include "mqtt_client.h"

#define TAG "dps_client"

#define DPS_GLOBAL_ENDPOINT "global.azure-devices-provisioning.net"
#define DPS_MQTT_PORT 8883U
#define DPS_API_VERSION "2019-03-31"
#define DPS_RESPONSE_TOPIC "$dps/registrations/res/#"
#define DPS_REGISTER_TOPIC_FORMAT "$dps/registrations/PUT/iotdps-register/?$rid=%" PRIu32
#define DPS_POLL_TOPIC_FORMAT "$dps/registrations/GET/iotdps-get-operationstatus/?$rid=%" PRIu32 "&operationId=%s"
#define DPS_TOPIC_BUFFER_SIZE 384U
#define DPS_PAYLOAD_BUFFER_SIZE 2048U
#define DPS_OPERATION_ID_MAX_LEN 128U
#define DPS_DEFAULT_POLL_DELAY_MS 3000U
#define DPS_ASSIGNMENT_TIMEOUT_MS 120000U

#define DPS_EVENT_CONNECTED BIT0
#define DPS_EVENT_RESPONSE BIT1
#define DPS_EVENT_ASSIGNED BIT2
#define DPS_EVENT_ERROR BIT3

typedef enum {
    DPS_STATUS_UNKNOWN = 0,
    DPS_STATUS_ASSIGNING,
    DPS_STATUS_ASSIGNED,
    DPS_STATUS_FAILED,
} dps_status_t;

typedef struct {
    const dps_client_config_t *config;
    dps_assignment_t *assignment;
    esp_mqtt_client_handle_t client;
    EventGroupHandle_t events;
    char operation_id[DPS_OPERATION_ID_MAX_LEN + 1U];
    dps_status_t status;
    esp_err_t last_error;
    uint32_t next_rid;
    uint32_t retry_after_ms;
    char rx_topic[DPS_TOPIC_BUFFER_SIZE];
    char rx_payload[DPS_PAYLOAD_BUFFER_SIZE];
    size_t rx_payload_len;
    bool rx_dropping;
} dps_context_t;

static void dps_reset_rx(dps_context_t *ctx)
{
    if (ctx == NULL) {
        return;
    }

    memset(ctx->rx_topic, 0, sizeof(ctx->rx_topic));
    memset(ctx->rx_payload, 0, sizeof(ctx->rx_payload));
    ctx->rx_payload_len = 0U;
    ctx->rx_dropping = false;
}

static uint32_t dps_next_rid(dps_context_t *ctx)
{
    ctx->next_rid++;
    if (ctx->next_rid == 0U) {
        ctx->next_rid = 1U;
    }
    return ctx->next_rid;
}

static bool dps_topic_has_success_status(const char *topic)
{
    return topic != NULL && strstr(topic, "$dps/registrations/res/2") != NULL;
}

static bool dps_topic_has_terminal_error(const char *topic)
{
    if (topic == NULL) {
        return false;
    }

    return strstr(topic, "$dps/registrations/res/4") != NULL ||
           strstr(topic, "$dps/registrations/res/5") != NULL;
}

static esp_err_t dps_parse_response(dps_context_t *ctx)
{
    if (ctx == NULL) {
        return ESP_ERR_INVALID_ARG;
    }

    if (!dps_topic_has_success_status(ctx->rx_topic)) {
        if (dps_topic_has_terminal_error(ctx->rx_topic)) {
            ESP_LOGE(TAG, "DPS returned error response on topic: %s", ctx->rx_topic);
            ctx->status = DPS_STATUS_FAILED;
            return ESP_FAIL;
        }
        ESP_LOGW(TAG, "Ignoring DPS response on unexpected topic: %s", ctx->rx_topic);
        return ESP_OK;
    }

    cJSON *root = cJSON_Parse(ctx->rx_payload);
    if (root == NULL) {
        ESP_LOGE(TAG, "DPS response JSON parse failed");
        return ESP_ERR_INVALID_RESPONSE;
    }

    const cJSON *operation_id = cJSON_GetObjectItemCaseSensitive(root, "operationId");
    if (cJSON_IsString(operation_id) && operation_id->valuestring != NULL) {
        strlcpy(ctx->operation_id, operation_id->valuestring, sizeof(ctx->operation_id));
    }

    const cJSON *status = cJSON_GetObjectItemCaseSensitive(root, "status");
    if (!cJSON_IsString(status) || status->valuestring == NULL) {
        cJSON_Delete(root);
        return ESP_ERR_INVALID_RESPONSE;
    }

    if (strcmp(status->valuestring, "assigned") == 0) {
        const cJSON *registration_state = cJSON_GetObjectItemCaseSensitive(root, "registrationState");
        const cJSON *assigned_hub = cJSON_GetObjectItemCaseSensitive(registration_state, "assignedHub");
        const cJSON *device_id = cJSON_GetObjectItemCaseSensitive(registration_state, "deviceId");

        if (!cJSON_IsString(assigned_hub) || assigned_hub->valuestring == NULL ||
            !cJSON_IsString(device_id) || device_id->valuestring == NULL) {
            cJSON_Delete(root);
            return ESP_ERR_INVALID_RESPONSE;
        }

        strlcpy(ctx->assignment->assigned_hub, assigned_hub->valuestring, sizeof(ctx->assignment->assigned_hub));
        strlcpy(ctx->assignment->device_id, device_id->valuestring, sizeof(ctx->assignment->device_id));
        ctx->status = DPS_STATUS_ASSIGNED;
        ESP_LOGI(TAG, "DPS assigned hub=%s deviceId=%s", ctx->assignment->assigned_hub, ctx->assignment->device_id);
        cJSON_Delete(root);
        return ESP_OK;
    }

    if (strcmp(status->valuestring, "assigning") == 0 || strcmp(status->valuestring, "registering") == 0) {
        ctx->status = DPS_STATUS_ASSIGNING;
        cJSON_Delete(root);
        return ESP_OK;
    }

    ESP_LOGE(TAG, "DPS terminal status: %s", status->valuestring);
    ctx->status = DPS_STATUS_FAILED;
    cJSON_Delete(root);
    return ESP_FAIL;
}

static esp_err_t dps_publish_register(dps_context_t *ctx)
{
    char topic[DPS_TOPIC_BUFFER_SIZE] = {0};
    char payload[256] = {0};

    int written = snprintf(topic, sizeof(topic), DPS_REGISTER_TOPIC_FORMAT, dps_next_rid(ctx));
    if (written < 0 || (size_t)written >= sizeof(topic)) {
        return ESP_ERR_NO_MEM;
    }

    written = snprintf(payload, sizeof(payload), "{\"registrationId\":\"%s\"}", ctx->config->registration_id);
    if (written < 0 || (size_t)written >= sizeof(payload)) {
        return ESP_ERR_NO_MEM;
    }

    int msg_id = esp_mqtt_client_enqueue(ctx->client, topic, payload, (int)strlen(payload), 1, 0, true);
    return msg_id >= 0 ? ESP_OK : ESP_FAIL;
}

static esp_err_t dps_publish_poll(dps_context_t *ctx)
{
    if (ctx->operation_id[0] == '\0') {
        return ESP_ERR_INVALID_STATE;
    }

    char topic[DPS_TOPIC_BUFFER_SIZE] = {0};
    int written = snprintf(topic, sizeof(topic), DPS_POLL_TOPIC_FORMAT, dps_next_rid(ctx), ctx->operation_id);
    if (written < 0 || (size_t)written >= sizeof(topic)) {
        return ESP_ERR_NO_MEM;
    }

    int msg_id = esp_mqtt_client_enqueue(ctx->client, topic, "", 0, 1, 0, true);
    return msg_id >= 0 ? ESP_OK : ESP_FAIL;
}

static void dps_process_complete_message(dps_context_t *ctx)
{
    esp_err_t err = dps_parse_response(ctx);
    ctx->last_error = err;
    xEventGroupSetBits(ctx->events, DPS_EVENT_RESPONSE);
    if (err != ESP_OK || ctx->status == DPS_STATUS_FAILED) {
        xEventGroupSetBits(ctx->events, DPS_EVENT_ERROR);
    } else if (ctx->status == DPS_STATUS_ASSIGNED) {
        xEventGroupSetBits(ctx->events, DPS_EVENT_ASSIGNED);
    }
}

static void dps_append_rx_chunk(dps_context_t *ctx, esp_mqtt_event_handle_t event)
{
    if (ctx == NULL || event == NULL) {
        return;
    }

    if (event->current_data_offset == 0) {
        dps_reset_rx(ctx);

        size_t topic_len = event->topic_len < (int)(sizeof(ctx->rx_topic) - 1U) ? (size_t)event->topic_len : sizeof(ctx->rx_topic) - 1U;
        memcpy(ctx->rx_topic, event->topic, topic_len);
        ctx->rx_topic[topic_len] = '\0';

        if ((size_t)event->total_data_len >= sizeof(ctx->rx_payload)) {
            ctx->rx_dropping = true;
            ESP_LOGE(TAG, "DPS response too large: %d bytes", event->total_data_len);
        }
    }

    if (ctx->rx_dropping) {
        if (event->current_data_offset + event->data_len >= event->total_data_len) {
            ctx->last_error = ESP_ERR_NO_MEM;
            xEventGroupSetBits(ctx->events, DPS_EVENT_ERROR);
            dps_reset_rx(ctx);
        }
        return;
    }

    if (ctx->rx_payload_len + (size_t)event->data_len >= sizeof(ctx->rx_payload)) {
        ctx->last_error = ESP_ERR_NO_MEM;
        xEventGroupSetBits(ctx->events, DPS_EVENT_ERROR);
        dps_reset_rx(ctx);
        return;
    }

    memcpy(&ctx->rx_payload[ctx->rx_payload_len], event->data, event->data_len);
    ctx->rx_payload_len += (size_t)event->data_len;
    ctx->rx_payload[ctx->rx_payload_len] = '\0';

    if (event->current_data_offset + event->data_len >= event->total_data_len) {
        dps_process_complete_message(ctx);
        dps_reset_rx(ctx);
    }
}

static void dps_mqtt_event_handler(void *handler_args, esp_event_base_t base, int32_t event_id, void *event_data)
{
    (void)base;

    dps_context_t *ctx = (dps_context_t *)handler_args;
    esp_mqtt_event_handle_t event = (esp_mqtt_event_handle_t)event_data;
    if (ctx == NULL || event == NULL) {
        return;
    }

    switch ((esp_mqtt_event_id_t)event_id) {
    case MQTT_EVENT_CONNECTED:
        ESP_LOGI(TAG, "Connected to DPS");
        if (esp_mqtt_client_subscribe(ctx->client, DPS_RESPONSE_TOPIC, 1) < 0) {
            ctx->last_error = ESP_FAIL;
            xEventGroupSetBits(ctx->events, DPS_EVENT_ERROR);
            return;
        }
        xEventGroupSetBits(ctx->events, DPS_EVENT_CONNECTED);
        break;

    case MQTT_EVENT_DATA:
        dps_append_rx_chunk(ctx, event);
        break;

    case MQTT_EVENT_ERROR:
        ESP_LOGE(TAG, "DPS MQTT error");
        ctx->last_error = ESP_FAIL;
        xEventGroupSetBits(ctx->events, DPS_EVENT_ERROR);
        break;

    case MQTT_EVENT_DISCONNECTED:
        ESP_LOGW(TAG, "Disconnected from DPS");
        break;

    default:
        break;
    }
}

static esp_err_t dps_validate_config(const dps_client_config_t *config, const dps_assignment_t *assignment)
{
    if (config == NULL || assignment == NULL) {
        return ESP_ERR_INVALID_ARG;
    }

    if (config->id_scope[0] == '\0' || config->registration_id[0] == '\0' ||
        config->client_cert_pem == NULL || config->client_cert_pem[0] == '\0' ||
        config->client_key_pem == NULL || config->client_key_pem[0] == '\0') {
        return ESP_ERR_INVALID_ARG;
    }

    return ESP_OK;
}

esp_err_t dps_client_register(const dps_client_config_t *config, dps_assignment_t *assignment)
{
    esp_err_t err = dps_validate_config(config, assignment);
    if (err != ESP_OK) {
        return err;
    }

    memset(assignment, 0, sizeof(*assignment));

    dps_context_t ctx = {
        .config = config,
        .assignment = assignment,
        .status = DPS_STATUS_UNKNOWN,
        .last_error = ESP_OK,
        .next_rid = 0U,
        .retry_after_ms = DPS_DEFAULT_POLL_DELAY_MS,
    };

    ctx.events = xEventGroupCreate();
    if (ctx.events == NULL) {
        return ESP_ERR_NO_MEM;
    }

    char broker_uri[DPS_TOPIC_BUFFER_SIZE] = {0};
    char username[DPS_TOPIC_BUFFER_SIZE] = {0};

    int written = snprintf(broker_uri, sizeof(broker_uri), "mqtts://%s:%u", DPS_GLOBAL_ENDPOINT, DPS_MQTT_PORT);
    if (written < 0 || (size_t)written >= sizeof(broker_uri)) {
        vEventGroupDelete(ctx.events);
        return ESP_ERR_NO_MEM;
    }

    written = snprintf(username, sizeof(username), "%s/registrations/%s/api-version=%s", config->id_scope, config->registration_id, DPS_API_VERSION);
    if (written < 0 || (size_t)written >= sizeof(username)) {
        vEventGroupDelete(ctx.events);
        return ESP_ERR_NO_MEM;
    }

    const esp_mqtt_client_config_t mqtt_cfg = {
        .broker = {
            .address.uri = broker_uri,
            .verification.crt_bundle_attach = esp_crt_bundle_attach,
        },
        .credentials = {
            .client_id = config->registration_id,
            .username = username,
            .authentication = {
                .certificate = config->client_cert_pem,
                .key = config->client_key_pem,
            },
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

    ctx.client = esp_mqtt_client_init(&mqtt_cfg);
    if (ctx.client == NULL) {
        vEventGroupDelete(ctx.events);
        return ESP_FAIL;
    }

    err = esp_mqtt_client_register_event(ctx.client, ESP_EVENT_ANY_ID, dps_mqtt_event_handler, &ctx);
    if (err != ESP_OK) {
        esp_mqtt_client_destroy(ctx.client);
        vEventGroupDelete(ctx.events);
        return err;
    }

    err = esp_mqtt_client_start(ctx.client);
    if (err != ESP_OK) {
        esp_mqtt_client_destroy(ctx.client);
        vEventGroupDelete(ctx.events);
        return err;
    }

    EventBits_t bits = xEventGroupWaitBits(ctx.events, DPS_EVENT_CONNECTED | DPS_EVENT_ERROR, pdTRUE, pdFALSE, pdMS_TO_TICKS(30000));
    if ((bits & DPS_EVENT_ERROR) != 0U || (bits & DPS_EVENT_CONNECTED) == 0U) {
        err = ctx.last_error != ESP_OK ? ctx.last_error : ESP_ERR_TIMEOUT;
        goto cleanup;
    }

    err = dps_publish_register(&ctx);
    if (err != ESP_OK) {
        goto cleanup;
    }

    TickType_t started_ticks = xTaskGetTickCount();
    while (ctx.status != DPS_STATUS_ASSIGNED) {
        bits = xEventGroupWaitBits(ctx.events, DPS_EVENT_RESPONSE | DPS_EVENT_ASSIGNED | DPS_EVENT_ERROR, pdTRUE, pdFALSE, pdMS_TO_TICKS(DPS_ASSIGNMENT_TIMEOUT_MS));
        if ((bits & DPS_EVENT_ERROR) != 0U) {
            err = ctx.last_error != ESP_OK ? ctx.last_error : ESP_FAIL;
            goto cleanup;
        }
        if ((bits & DPS_EVENT_ASSIGNED) != 0U || ctx.status == DPS_STATUS_ASSIGNED) {
            err = ESP_OK;
            break;
        }
        if ((bits & DPS_EVENT_RESPONSE) == 0U) {
            err = ESP_ERR_TIMEOUT;
            goto cleanup;
        }

        if (ctx.status == DPS_STATUS_ASSIGNING) {
            vTaskDelay(pdMS_TO_TICKS(ctx.retry_after_ms));
            err = dps_publish_poll(&ctx);
            if (err != ESP_OK) {
                goto cleanup;
            }
        } else {
            err = ESP_FAIL;
            goto cleanup;
        }

        if ((xTaskGetTickCount() - started_ticks) > pdMS_TO_TICKS(DPS_ASSIGNMENT_TIMEOUT_MS)) {
            err = ESP_ERR_TIMEOUT;
            goto cleanup;
        }
    }

cleanup:
    (void)esp_mqtt_client_stop(ctx.client);
    (void)esp_mqtt_client_destroy(ctx.client);
    vEventGroupDelete(ctx.events);

    if (err == ESP_OK && assignment->assigned_hub[0] != '\0' && assignment->device_id[0] != '\0') {
        return ESP_OK;
    }

    return err == ESP_OK ? ESP_FAIL : err;
}
