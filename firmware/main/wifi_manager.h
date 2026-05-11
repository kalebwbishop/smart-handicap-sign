#ifndef WIFI_MANAGER_H
#define WIFI_MANAGER_H

#include <stdbool.h>
#include <stdint.h>
#include "esp_err.h"

typedef struct {
    char ssid[33];
    int8_t rssi;
    uint8_t authmode;
} wifi_scan_result_t;

esp_err_t wifi_manager_init(void);
esp_err_t wifi_sta_connect(const char *ssid, const char *password, int timeout_ms);
bool wifi_sta_is_connected(void);
esp_err_t wifi_sta_disconnect(void);

esp_err_t wifi_ap_start(void);
esp_err_t wifi_ap_stop(void);

int wifi_scan(wifi_scan_result_t *results, int max_results);

#endif
