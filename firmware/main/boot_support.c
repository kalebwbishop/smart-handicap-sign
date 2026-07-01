#include <stdbool.h>

#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "esp_log.h"
#include "esp_system.h"
#include "esp_task_wdt.h"

#include "boot_support.h"
#include "led_driver.h"
#include "provisioning_server.h"
#include "runtime_config.h"
#include "wifi_manager.h"

static const char *TAG = "boot";

static void disable_task_wdt(void)
{
    esp_err_t err = esp_task_wdt_delete(NULL);
    if (err != ESP_OK && err != ESP_ERR_NOT_FOUND && err != ESP_ERR_INVALID_STATE) {
        ESP_LOGW(TAG, "Failed to unsubscribe main task from WDT: %s", esp_err_to_name(err));
    }

    err = esp_task_wdt_deinit();
    if (err != ESP_OK && err != ESP_ERR_INVALID_STATE) {
        ESP_LOGW(TAG, "Failed to deinitialize task WDT: %s", esp_err_to_name(err));
    }
}

void boot_support_halt_forever(void)
{
    while (true) {
        vTaskDelay(pdMS_TO_TICKS(1000));
    }
}

void boot_support_fatal_restart(const char *message, esp_err_t err)
{
    ESP_LOGE(TAG, "%s: %s", message, esp_err_to_name(err));
    led_driver_set_status(STATUS_ERROR);
    vTaskDelay(pdMS_TO_TICKS(5000));
    esp_restart();
}

void boot_support_enter_provisioning_mode(const char *reason)
{
    ESP_LOGW(TAG, "Entering provisioning mode: %s", reason);
    led_driver_set_status(STATUS_OFFLINE);
    disable_task_wdt();

    esp_err_t err = wifi_ap_start();
    if (err != ESP_OK) {
        boot_support_fatal_restart("Failed to start SoftAP", err);
    }

    err = provisioning_server_start();
    if (err != ESP_OK) {
        boot_support_fatal_restart("Failed to start provisioning server", err);
    }

    ESP_LOGI(TAG, "Provisioning server ready; waiting for WiFi configuration");
    boot_support_halt_forever();
}

esp_err_t boot_support_init_task_wdt(void)
{
    const esp_task_wdt_config_t config = {
        .timeout_ms = WDT_TIMEOUT_MS,
        .idle_core_mask = 0,
        .trigger_panic = true,
    };

    esp_err_t err = esp_task_wdt_init(&config);
    if (err != ESP_OK && err != ESP_ERR_INVALID_STATE) {
        return err;
    }

    err = esp_task_wdt_add(NULL);
    if (err != ESP_OK) {
        return err;
    }

    return ESP_OK;
}
