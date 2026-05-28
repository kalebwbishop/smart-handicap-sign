#include "wifi_manager.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "esp_event.h"
#include "esp_log.h"
#include "esp_netif.h"
#include "esp_wifi.h"
#include "freertos/FreeRTOS.h"
#include "freertos/event_groups.h"

#define WIFI_CONNECTED_BIT BIT0
#define WIFI_FAIL_BIT      BIT1
#define WIFI_CONNECT_TIMEOUT_MS 20000
#define WIFI_AP_CHANNEL    1
#define WIFI_AP_MAX_CONN   4

static const char *TAG = "wifi_manager";

static EventGroupHandle_t s_wifi_event_group;
static esp_netif_t *s_sta_netif;
static esp_netif_t *s_ap_netif;
static bool s_initialized;
static bool s_wifi_started;
static bool s_sta_connected;
static bool s_waiting_for_connection;
static wifi_mode_t s_current_mode = WIFI_MODE_NULL;

static void wifi_event_handler(void *arg, esp_event_base_t event_base, int32_t event_id, void *event_data)
{
    (void)arg;
    (void)event_data;

    if (event_base == WIFI_EVENT) {
        switch (event_id) {
        case WIFI_EVENT_STA_DISCONNECTED:
            s_sta_connected = false;
            if (s_waiting_for_connection && s_wifi_event_group != NULL) {
                xEventGroupSetBits(s_wifi_event_group, WIFI_FAIL_BIT);
            }
            ESP_LOGI(TAG, "Station disconnected");
            break;
        case WIFI_EVENT_AP_START:
            ESP_LOGI(TAG, "SoftAP started");
            break;
        case WIFI_EVENT_AP_STOP:
            ESP_LOGI(TAG, "SoftAP stopped");
            break;
        default:
            break;
        }
    } else if (event_base == IP_EVENT && event_id == IP_EVENT_STA_GOT_IP) {
        s_sta_connected = true;
        if (s_wifi_event_group != NULL) {
            xEventGroupSetBits(s_wifi_event_group, WIFI_CONNECTED_BIT);
        }
        ESP_LOGI(TAG, "Station got IP");
    }
}

static esp_err_t wifi_set_mode_started(wifi_mode_t mode)
{
    esp_err_t err;

    if (!s_wifi_started) {
        err = esp_wifi_set_mode(mode);
        if (err != ESP_OK) {
            return err;
        }

        err = esp_wifi_start();
        if (err != ESP_OK) {
            return err;
        }

        s_wifi_started = true;
        s_current_mode = mode;
        return ESP_OK;
    }

    if (s_current_mode != mode) {
        err = esp_wifi_set_mode(mode);
        if (err != ESP_OK) {
            return err;
        }
        s_current_mode = mode;
    }

    return ESP_OK;
}

static void build_ap_ssid(char *buffer, size_t buffer_len)
{
    uint8_t mac[6] = {0};
    esp_err_t err = esp_wifi_get_mac(WIFI_IF_STA, mac);
    if (err != ESP_OK) {
        snprintf(buffer, buffer_len, "SmartSign-0000");
        return;
    }

    snprintf(buffer, buffer_len, "SmartSign-%02X%02X", mac[4], mac[5]);
}

static int compare_scan_results(const void *left, const void *right)
{
    const wifi_scan_result_t *lhs = (const wifi_scan_result_t *)left;
    const wifi_scan_result_t *rhs = (const wifi_scan_result_t *)right;
    return (int)rhs->rssi - (int)lhs->rssi;
}

static int compare_ap_records(const void *left, const void *right)
{
    const wifi_ap_record_t *lhs = (const wifi_ap_record_t *)left;
    const wifi_ap_record_t *rhs = (const wifi_ap_record_t *)right;
    return (int)rhs->rssi - (int)lhs->rssi;
}

static void restore_scan_mode(bool was_started, wifi_mode_t previous_mode)
{
    if (!was_started) {
        esp_wifi_stop();
        s_wifi_started = false;
        s_current_mode = WIFI_MODE_NULL;
        return;
    }

    if (previous_mode == WIFI_MODE_AP) {
        esp_wifi_set_mode(WIFI_MODE_AP);
        s_current_mode = WIFI_MODE_AP;
    }
}

esp_err_t wifi_manager_init(void)
{
    esp_err_t err;

    if (s_initialized) {
        return ESP_OK;
    }

    err = esp_netif_init();
    if (err != ESP_OK && err != ESP_ERR_INVALID_STATE) {
        return err;
    }

    err = esp_event_loop_create_default();
    if (err != ESP_OK && err != ESP_ERR_INVALID_STATE) {
        return err;
    }

    s_sta_netif = esp_netif_create_default_wifi_sta();
    if (s_sta_netif == NULL) {
        ESP_LOGE(TAG, "Failed to create STA netif");
        return ESP_FAIL;
    }

    s_ap_netif = esp_netif_create_default_wifi_ap();
    if (s_ap_netif == NULL) {
        ESP_LOGE(TAG, "Failed to create AP netif");
        return ESP_FAIL;
    }

    wifi_init_config_t cfg = WIFI_INIT_CONFIG_DEFAULT();
    err = esp_wifi_init(&cfg);
    if (err != ESP_OK) {
        return err;
    }

    err = esp_wifi_set_storage(WIFI_STORAGE_RAM);
    if (err != ESP_OK) {
        return err;
    }

    if (s_wifi_event_group == NULL) {
        s_wifi_event_group = xEventGroupCreate();
        if (s_wifi_event_group == NULL) {
            return ESP_ERR_NO_MEM;
        }
    }

    err = esp_event_handler_register(WIFI_EVENT, ESP_EVENT_ANY_ID, &wifi_event_handler, NULL);
    if (err != ESP_OK) {
        return err;
    }

    err = esp_event_handler_register(IP_EVENT, IP_EVENT_STA_GOT_IP, &wifi_event_handler, NULL);
    if (err != ESP_OK) {
        return err;
    }

    s_initialized = true;
    ESP_LOGI(TAG, "WiFi manager initialized");
    return ESP_OK;
}

esp_err_t wifi_sta_connect(const char *ssid, const char *password, int timeout_ms)
{
    if (!s_initialized) {
        return ESP_ERR_INVALID_STATE;
    }

    if (ssid == NULL || ssid[0] == '\0') {
        return ESP_ERR_INVALID_ARG;
    }

    esp_err_t err = wifi_set_mode_started(WIFI_MODE_STA);
    if (err != ESP_OK) {
        return err;
    }

    wifi_config_t wifi_config = {0};
    strlcpy((char *)wifi_config.sta.ssid, ssid, sizeof(wifi_config.sta.ssid));
    strlcpy((char *)wifi_config.sta.password, password != NULL ? password : "", sizeof(wifi_config.sta.password));
    wifi_config.sta.threshold.authmode = WIFI_AUTH_OPEN;
    wifi_config.sta.pmf_cfg.capable = true;
    wifi_config.sta.pmf_cfg.required = false;

    err = esp_wifi_set_config(WIFI_IF_STA, &wifi_config);
    if (err != ESP_OK) {
        return err;
    }

    err = esp_wifi_disconnect();
    if (err != ESP_OK && err != ESP_ERR_WIFI_NOT_CONNECT) {
        return err;
    }

    xEventGroupClearBits(s_wifi_event_group, WIFI_CONNECTED_BIT | WIFI_FAIL_BIT);
    s_waiting_for_connection = true;
    s_sta_connected = false;

    err = esp_wifi_connect();
    if (err != ESP_OK) {
        s_waiting_for_connection = false;
        return err;
    }

    EventBits_t bits = xEventGroupWaitBits(
        s_wifi_event_group,
        WIFI_CONNECTED_BIT | WIFI_FAIL_BIT,
        pdTRUE,
        pdFALSE,
        pdMS_TO_TICKS(timeout_ms > 0 ? timeout_ms : WIFI_CONNECT_TIMEOUT_MS));

    s_waiting_for_connection = false;

    if ((bits & WIFI_CONNECTED_BIT) != 0) {
        ESP_LOGI(TAG, "Connected to SSID '%s'", ssid);
        return ESP_OK;
    }

    ESP_LOGE(TAG, "Failed to connect to SSID '%s'", ssid);
    return (bits & WIFI_FAIL_BIT) != 0 ? ESP_FAIL : ESP_ERR_TIMEOUT;
}

bool wifi_sta_is_connected(void)
{
    return s_sta_connected;
}

esp_err_t wifi_manager_sta_disconnect(void)
{
    if (!s_initialized) {
        return ESP_ERR_INVALID_STATE;
    }

    if (!s_wifi_started) {
        return ESP_OK;
    }

    esp_err_t err = esp_wifi_disconnect();
    if (err == ESP_ERR_WIFI_NOT_CONNECT) {
        return ESP_OK;
    }

    if (err == ESP_OK) {
        s_sta_connected = false;
    }

    return err;
}

esp_err_t wifi_ap_start(void)
{
    if (!s_initialized) {
        return ESP_ERR_INVALID_STATE;
    }

    esp_err_t err = wifi_manager_sta_disconnect();
    if (err != ESP_OK) {
        return err;
    }

    err = wifi_set_mode_started(WIFI_MODE_AP);
    if (err != ESP_OK) {
        return err;
    }

    wifi_config_t ap_config = {0};
    build_ap_ssid((char *)ap_config.ap.ssid, sizeof(ap_config.ap.ssid));
    ap_config.ap.ssid_len = strlen((char *)ap_config.ap.ssid);
    ap_config.ap.channel = WIFI_AP_CHANNEL;
    ap_config.ap.authmode = WIFI_AUTH_OPEN;
    ap_config.ap.max_connection = WIFI_AP_MAX_CONN;
    ap_config.ap.pmf_cfg.required = false;

    err = esp_wifi_set_config(WIFI_IF_AP, &ap_config);
    if (err != ESP_OK) {
        return err;
    }

    ESP_LOGI(TAG, "SoftAP active as %s", ap_config.ap.ssid);
    return ESP_OK;
}

esp_err_t wifi_ap_stop(void)
{
    if (!s_initialized) {
        return ESP_ERR_INVALID_STATE;
    }

    if (!s_wifi_started) {
        return ESP_OK;
    }

    if (s_current_mode != WIFI_MODE_AP && s_current_mode != WIFI_MODE_APSTA) {
        return ESP_OK;
    }

    if (s_current_mode == WIFI_MODE_APSTA) {
        s_current_mode = WIFI_MODE_STA;
        return esp_wifi_set_mode(WIFI_MODE_STA);
    }

    esp_err_t err = esp_wifi_stop();
    if (err == ESP_OK) {
        s_wifi_started = false;
        s_current_mode = WIFI_MODE_NULL;
    }
    return err;
}

int wifi_scan(wifi_scan_result_t *results, int max_results)
{
    if (!s_initialized || results == NULL || max_results <= 0) {
        return 0;
    }

    esp_err_t err;
    bool was_started = s_wifi_started;
    wifi_mode_t previous_mode = s_current_mode;

    if (!was_started) {
        err = wifi_set_mode_started(WIFI_MODE_STA);
    } else if (previous_mode == WIFI_MODE_AP) {
        err = wifi_set_mode_started(WIFI_MODE_APSTA);
    } else {
        err = ESP_OK;
    }

    if (err != ESP_OK) {
        ESP_LOGE(TAG, "Failed to prepare WiFi scan: %s", esp_err_to_name(err));
        return 0;
    }

    wifi_scan_config_t scan_config = {0};
    err = esp_wifi_scan_start(&scan_config, true);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "WiFi scan failed: %s", esp_err_to_name(err));
        restore_scan_mode(was_started, previous_mode);
        return 0;
    }

    uint16_t ap_count = 0;
    err = esp_wifi_scan_get_ap_num(&ap_count);
    if (err != ESP_OK || ap_count == 0) {
        restore_scan_mode(was_started, previous_mode);
        return 0;
    }

    wifi_ap_record_t *records = calloc(ap_count, sizeof(wifi_ap_record_t));
    if (records == NULL) {
        ESP_LOGE(TAG, "Failed to allocate scan records");
        restore_scan_mode(was_started, previous_mode);
        return 0;
    }

    err = esp_wifi_scan_get_ap_records(&ap_count, records);
    if (err != ESP_OK) {
        free(records);
        restore_scan_mode(was_started, previous_mode);
        return 0;
    }

    qsort(records, ap_count, sizeof(wifi_ap_record_t), compare_ap_records);

    int unique_count = 0;
    for (uint16_t i = 0; i < ap_count && unique_count < max_results; ++i) {
        if (records[i].ssid[0] == '\0') {
            continue;
        }

        bool duplicate = false;
        for (int j = 0; j < unique_count; ++j) {
            if (strncmp(results[j].ssid, (const char *)records[i].ssid, sizeof(results[j].ssid)) == 0) {
                duplicate = true;
                break;
            }
        }

        if (duplicate) {
            continue;
        }

        strlcpy(results[unique_count].ssid, (const char *)records[i].ssid, sizeof(results[unique_count].ssid));
        results[unique_count].rssi = records[i].rssi;
        results[unique_count].authmode = (uint8_t)records[i].authmode;
        ++unique_count;
    }

    free(records);
    qsort(results, unique_count, sizeof(wifi_scan_result_t), compare_scan_results);

    restore_scan_mode(was_started, previous_mode);

    ESP_LOGI(TAG, "Scan found %d unique networks", unique_count);
    return unique_count;
}
