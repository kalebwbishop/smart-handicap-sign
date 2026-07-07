#ifndef DEVICE_MANAGER_H
#define DEVICE_MANAGER_H

#include "esp_err.h"

esp_err_t battery_manager_init_adc();
int battery_manager_read_percentage();

#endif
