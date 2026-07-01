#ifndef IDENTITY_SERVICE_H
#define IDENTITY_SERVICE_H

#include <stddef.h>
#include "esp_err.h"

esp_err_t identity_service_load_device_serial_number(char *serial_number, size_t serial_len);

#endif
