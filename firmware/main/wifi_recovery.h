#ifndef WIFI_RECOVERY_H
#define WIFI_RECOVERY_H

#include "esp_err.h"

esp_err_t wifi_recovery_attempt(int *failure_count);

#endif
