#ifndef LED_DRIVER_H
#define LED_DRIVER_H

#include <stddef.h>
#include <stdint.h>

#include "esp_err.h"
#include "iot_hub_client.h"

#ifndef DATA_PIN
#define DATA_PIN 4
#endif

#ifndef NUM_LEDS
#define NUM_LEDS 8
#endif

#ifndef BRIGHTNESS
#define BRIGHTNESS 128
#endif

#define LED_DATA_PIN DATA_PIN
#define LED_NUM_LEDS NUM_LEDS
#define LED_BRIGHTNESS BRIGHTNESS

typedef struct {
    uint8_t red;
    uint8_t green;
    uint8_t blue;
} led_rgb_t;

// Initialize the WS2812B strip and clear it.
esp_err_t led_driver_init(void);

// Set a pixel in the pending frame. Out-of-range indices are ignored.
void led_driver_set_pixel(size_t index, led_rgb_t color);

// Set the pending frame to one RGB color.
void led_driver_set_color(led_rgb_t color);

// Clear the pending frame.
void led_driver_clear(void);

// Transmit the pending frame only when it has changed.
esp_err_t led_driver_show(void);

// Set global brightness, clamped to 0-255.
void led_driver_set_brightness(uint16_t brightness);

// Set LED pattern based on device status.
void led_driver_set_status(device_operational_status_t status);

// Convert status string from backend to enum (returns STATUS_OFFLINE for unknown).
device_operational_status_t led_driver_status_from_string(const char *status_str);

// Turn LED off and stop the status pattern.
void led_driver_off(void);

#endif
