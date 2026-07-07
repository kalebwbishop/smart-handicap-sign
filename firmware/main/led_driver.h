#ifndef LED_DRIVER_H
#define LED_DRIVER_H

#include "driver/gpio.h"
#include "esp_err.h"
#include "iot_hub_client.h"

#define LED_RED_GPIO GPIO_NUM_25
#define LED_GREEN_GPIO GPIO_NUM_26
#define LED_BLUE_GPIO GPIO_NUM_27

// Initialize LED driver (GPIO + timer)
esp_err_t led_driver_init(void);

// Set LED pattern based on device status
void led_driver_set_status(device_operational_status_t status);

// Convert status string from backend to enum (returns STATUS_OFFLINE for unknown)
device_operational_status_t led_driver_status_from_string(const char *status_str);

// Turn LED off and stop pattern
void led_driver_off(void);

#endif
