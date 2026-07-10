#include "provisioning_server.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "cJSON.h"
#include "esp_http_server.h"
#include "esp_log.h"
#include "esp_system.h"
#include "esp_wifi.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "nvs_storage.h"
#include "wifi_manager.h"

#define SCAN_RESULT_LIMIT 20

static const char *TAG = "prov_server";

static httpd_handle_t s_server;

static void add_cors_headers(httpd_req_t *req)
{
    httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");
    httpd_resp_set_hdr(req, "Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    httpd_resp_set_hdr(req, "Access-Control-Allow-Headers", "Content-Type");
}

static void reboot_task(void *arg)
{
    (void)arg;
    vTaskDelay(pdMS_TO_TICKS(1000));
    esp_restart();
}

static esp_err_t send_json_response(httpd_req_t *req, const char *status, const char *body)
{
    add_cors_headers(req);
    httpd_resp_set_status(req, status);
    httpd_resp_set_type(req, "application/json");
    return httpd_resp_sendstr(req, body);
}

static esp_err_t receive_request_body(httpd_req_t *req, char *buffer, size_t buffer_len)
{
    int total_received = 0;

    while (total_received < req->content_len && total_received < (int)(buffer_len - 1U)) {
        int received = httpd_req_recv(req, buffer + total_received, req->content_len - total_received);
        if (received <= 0) {
            return ESP_FAIL;
        }
        total_received += received;
    }

    buffer[total_received] = '\0';
    return total_received == req->content_len ? ESP_OK : ESP_FAIL;
}

static esp_err_t status_get_handler(httpd_req_t *req)
{
    uint8_t mac[6] = {0};
    char device_id[13] = {0};
    cJSON *root = cJSON_CreateObject();
    if (root == NULL) {
        return ESP_ERR_NO_MEM;
    }

    esp_wifi_get_mac(WIFI_IF_STA, mac);
    snprintf(device_id, sizeof(device_id), "%02X%02X%02X%02X%02X%02X", mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);

    cJSON_AddStringToObject(root, "device_id", device_id);
    cJSON_AddBoolToObject(root, "ap_active", true);

    char *body = cJSON_PrintUnformatted(root);
    cJSON_Delete(root);
    if (body == NULL) {
        return ESP_ERR_NO_MEM;
    }

    add_cors_headers(req);
    httpd_resp_set_type(req, "application/json");
    esp_err_t err = httpd_resp_sendstr(req, body);

    ESP_LOGI(TAG, "Status response sent");
    ESP_LOGI(TAG, "Status response body: %s", body);

    free(body);
    return err;
}

static esp_err_t scan_get_handler(httpd_req_t *req)
{
    wifi_scan_result_t results[SCAN_RESULT_LIMIT] = {0};
    int count = wifi_scan(results, SCAN_RESULT_LIMIT);

    cJSON *array = cJSON_CreateArray();
    if (array == NULL) {
        return ESP_ERR_NO_MEM;
    }

    for (int i = 0; i < count; ++i) {
        cJSON *item = cJSON_CreateObject();
        if (item == NULL) {
            cJSON_Delete(array);
            return ESP_ERR_NO_MEM;
        }

        cJSON_AddStringToObject(item, "ssid", results[i].ssid);
        cJSON_AddNumberToObject(item, "rssi", results[i].rssi);
        cJSON_AddNumberToObject(item, "authmode", results[i].authmode);
        cJSON_AddItemToArray(array, item);
    }

    char *body = cJSON_PrintUnformatted(array);
    cJSON_Delete(array);
    if (body == NULL) {
        return ESP_ERR_NO_MEM;
    }

    add_cors_headers(req);
    httpd_resp_set_type(req, "application/json");
    esp_err_t err = httpd_resp_sendstr(req, body);
    free(body);
    return err;
}

static esp_err_t configure_post_handler(httpd_req_t *req)
{
    ESP_LOGI(TAG, "Received WiFi configuration request");
    if (req->content_len <= 0 || req->content_len > 512) {
        return send_json_response(req, "400 Bad Request", "{\"error\":\"Invalid request body\"}");
    }

    char *body = calloc((size_t)req->content_len + 1U, sizeof(char));
    if (body == NULL) {
        return ESP_ERR_NO_MEM;
    }

    esp_err_t err = receive_request_body(req, body, (size_t)req->content_len + 1U);
    if (err != ESP_OK) {
        free(body);
        return send_json_response(req, "400 Bad Request", "{\"error\":\"Invalid request body\"}");
    }

    cJSON *json = cJSON_Parse(body);
    free(body);
    if (json == NULL) {
        return send_json_response(req, "400 Bad Request", "{\"error\":\"Invalid JSON\"}");
    }

    const cJSON *ssid = cJSON_GetObjectItemCaseSensitive(json, "ssid");
    const cJSON *password = cJSON_GetObjectItemCaseSensitive(json, "password");
    ESP_LOGI(TAG, "Received WiFi configuration request: ssid=%s", ssid->valuestring);
    ESP_LOGI(TAG, "Received WiFi configuration request: password=%s", password->valuestring);
    if (!cJSON_IsString(ssid) || ssid->valuestring == NULL || ssid->valuestring[0] == '\0') {
        cJSON_Delete(json);
        return send_json_response(req, "400 Bad Request", "{\"error\":\"ssid is required\"}");
    }

    err = nvs_wifi_save(ssid->valuestring, cJSON_IsString(password) && password->valuestring != NULL ? password->valuestring : "");
    cJSON_Delete(json);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "Failed to save WiFi config: %s", esp_err_to_name(err));
        return send_json_response(req, "500 Internal Server Error", "{\"error\":\"Failed to save WiFi credentials\"}");
    }

    err = send_json_response(req, "200 OK", "{\"ok\":true,\"message\":\"Credentials saved. Rebooting...\"}");
    if (err == ESP_OK) {
        BaseType_t task_created = xTaskCreate(reboot_task, "prov_reboot", 2048, NULL, 5, NULL);
        if (task_created != pdPASS) {
            ESP_LOGE(TAG, "Failed to create reboot task");
            return ESP_FAIL;
        }
    }
    return err;
}

static esp_err_t options_handler(httpd_req_t *req)
{
    add_cors_headers(req);
    httpd_resp_set_status(req, "204 No Content");
    return httpd_resp_send(req, NULL, 0);
}

static esp_err_t not_found_handler(httpd_req_t *req, httpd_err_code_t error)
{
    (void)error;
    return send_json_response(req, "404 Not Found", "{\"error\":\"Not found\"}");
}

esp_err_t provisioning_server_start(void)
{
    if (s_server != NULL) {
        return ESP_OK;
    }

    httpd_config_t config = HTTPD_DEFAULT_CONFIG();
    config.server_port = 80;
    config.uri_match_fn = httpd_uri_match_wildcard;
    config.max_open_sockets = 5;

    esp_err_t err = httpd_start(&s_server, &config);
    if (err != ESP_OK) {
        return err;
    }

    httpd_uri_t status_uri = {
        .uri = "/status",
        .method = HTTP_GET,
        .handler = status_get_handler,
        .user_ctx = NULL,
    };
    httpd_uri_t scan_uri = {
        .uri = "/scan",
        .method = HTTP_GET,
        .handler = scan_get_handler,
        .user_ctx = NULL,
    };
    httpd_uri_t configure_uri = {
        .uri = "/configure",
        .method = HTTP_POST,
        .handler = configure_post_handler,
        .user_ctx = NULL,
    };
    httpd_uri_t options_uri = {
        .uri = "/*",
        .method = HTTP_OPTIONS,
        .handler = options_handler,
        .user_ctx = NULL,
    };

    err = httpd_register_uri_handler(s_server, &status_uri);
    if (err == ESP_OK) {
        err = httpd_register_uri_handler(s_server, &scan_uri);
    }
    if (err == ESP_OK) {
        err = httpd_register_uri_handler(s_server, &configure_uri);
    }
    if (err == ESP_OK) {
        err = httpd_register_uri_handler(s_server, &options_uri);
    }
    if (err == ESP_OK) {
        err = httpd_register_err_handler(s_server, HTTPD_404_NOT_FOUND, not_found_handler);
    }

    if (err != ESP_OK) {
        httpd_stop(s_server);
        s_server = NULL;
        return err;
    }

    ESP_LOGI(TAG, "Provisioning server started on port 80");
    return ESP_OK;
}

esp_err_t provisioning_server_stop(void)
{
    if (s_server == NULL) {
        return ESP_OK;
    }

    esp_err_t err = httpd_stop(s_server);
    if (err == ESP_OK) {
        s_server = NULL;
    }
    return err;
}
