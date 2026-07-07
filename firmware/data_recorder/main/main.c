#include <stdbool.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "cJSON.h"
#include "esp_err.h"
#include "esp_http_client.h"
#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "nvs_flash.h"

#include "adc_sampler.h"
#include "wifi_manager.h"

#ifndef DEV_BACKEND_URL
#define DEV_BACKEND_URL "http://192.168.7.168:8000/api/v1/dev/training-captures"
#endif
#ifndef DEV_WIFI_SSID
#define DEV_WIFI_SSID "222 Potomac WiFi"
#endif
#ifndef DEV_WIFI_PASSWORD
#define DEV_WIFI_PASSWORD "Everhart12052026"
#endif
#ifndef DEV_DEVICE_SERIAL
#define DEV_DEVICE_SERIAL ""
#endif
#ifndef DEV_FIRMWARE_VERSION
#define DEV_FIRMWARE_VERSION "dev"
#endif

#define DEV_REQUEST_TIMEOUT_MS 5000

static const char *TAG = "data_recorder";
static int s_samples[SAMPLES_PER_BATCH];

static void post_capture(const int *samples, size_t sample_count)
{
    if (DEV_BACKEND_URL[0] == '\0') {
        return;
    }

    cJSON *root = cJSON_CreateObject();
    if (root == NULL) {
        return;
    }

    cJSON *sample_array = cJSON_CreateArray();
    if (sample_array == NULL) {
        cJSON_Delete(root);
        return;
    }

    for (size_t i = 0; i < sample_count; ++i) {
        cJSON_AddItemToArray(sample_array, cJSON_CreateNumber(samples[i]));
    }

    cJSON_AddStringToObject(root, "serial_number", DEV_DEVICE_SERIAL[0] != '\0' ? DEV_DEVICE_SERIAL : "dev-unknown");
    cJSON_AddStringToObject(root, "firmware_version", DEV_FIRMWARE_VERSION);
    cJSON_AddNumberToObject(root, "sample_count", (double)sample_count);
    cJSON_AddNumberToObject(root, "sample_interval_ms", SAMPLE_INTERVAL_MS);
    cJSON_AddItemToObject(root, "samples", sample_array);

    char *body = cJSON_PrintUnformatted(root);
    cJSON_Delete(root);
    if (body == NULL) {
        return;
    }

    const bool is_https = strncmp(DEV_BACKEND_URL, "https://", 8) == 0;
    ESP_LOGI(TAG, "Posting capture to %s", DEV_BACKEND_URL);

    esp_http_client_config_t config = {
        .url = DEV_BACKEND_URL,
        .timeout_ms = DEV_REQUEST_TIMEOUT_MS,
        .transport_type = is_https ? HTTP_TRANSPORT_OVER_SSL : HTTP_TRANSPORT_OVER_TCP,
    };

    esp_http_client_handle_t client = esp_http_client_init(&config);
    if (client != NULL) {
        esp_http_client_set_method(client, HTTP_METHOD_POST);
        esp_http_client_set_header(client, "Content-Type", "application/json");
        esp_http_client_set_post_field(client, body, (int)strlen(body));
        esp_err_t err = esp_http_client_perform(client);
        if (err != ESP_OK) {
            ESP_LOGE(TAG, "Capture upload failed: %s", esp_err_to_name(err));
        }
        esp_http_client_cleanup(client);
    }

    free(body);
}

void app_main(void)
{
    ESP_LOGI(TAG, "Data recorder starting");

    (void)nvs_flash_init();
    (void)adc_sampler_init();
    (void)wifi_manager_init();
    if (DEV_WIFI_SSID[0] != '\0') {
        (void)wifi_sta_connect(DEV_WIFI_SSID, DEV_WIFI_PASSWORD, 20000);
    }

    while (true) {
        if (adc_sampler_collect_batch(s_samples, sizeof(s_samples)) == ESP_OK) {
            post_capture(s_samples, SAMPLES_PER_BATCH);
            int sum = 0;
            for (size_t i = 0; i < SAMPLES_PER_BATCH; ++i) {
                sum += s_samples[i];
            }
            ESP_LOGI(TAG, "Capture posted successfully, sum of samples: %d", sum);
        }
    }
}
