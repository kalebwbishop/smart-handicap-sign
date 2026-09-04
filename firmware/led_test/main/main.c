#include "esp_err.h"
#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "led_driver.h"

#ifndef LED_TEST_STEP_INTERVAL_MS
#define LED_TEST_STEP_INTERVAL_MS 5000
#endif

static const char *TAG = "led_test_main";

void app_main(void)
{
    esp_err_t err = led_driver_init();
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "Failed to initialize LED driver: %s", esp_err_to_name(err));
        return;
    }

    ESP_LOGI(TAG, "Starting solid green LED test");

    while (true) {
        led_driver_off();
        led_driver_set_color((led_rgb_t){0, 255, 0});
        err = led_driver_show();
        if (err != ESP_OK) {
            ESP_LOGW(TAG, "Failed to turn LEDs green: %s", esp_err_to_name(err));
        } else {
            ESP_LOGI(TAG, "LEDs on: green");
        }

        vTaskDelay(pdMS_TO_TICKS(LED_TEST_STEP_INTERVAL_MS));

        led_driver_off();
        ESP_LOGI(TAG, "LEDs off");
        vTaskDelay(pdMS_TO_TICKS(LED_TEST_STEP_INTERVAL_MS));
    }
}
