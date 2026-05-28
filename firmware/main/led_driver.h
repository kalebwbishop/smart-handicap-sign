#ifndef LED_DRIVER_H
#define LED_DRIVER_H

#include "driver/gpio.h"
#include "esp_err.h"

#define LED_GPIO GPIO_NUM_2

// Device status values (must match backend enum)
typedef enum {
    STATUS_AVAILABLE,
    STATUS_ASSISTANCE_REQUESTED,
    STATUS_ASSISTANCE_IN_PROGRESS,
    STATUS_OFFLINE,
    STATUS_ERROR,
    STATUS_COUNT  // sentinel
} device_status_t;

// Initialize LED driver (GPIO + timer)
esp_err_t led_driver_init(void);

// Set LED pattern based on device status
void led_driver_set_status(device_status_t status);

// Convert status string from backend to enum (returns STATUS_OFFLINE for unknown)
device_status_t led_driver_status_from_string(const char *status_str);

// Turn LED off and stop pattern
void led_driver_off(void);

#endif
