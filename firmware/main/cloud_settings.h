#ifndef CLOUD_SETTINGS_H
#define CLOUD_SETTINGS_H

#include "esp_err.h"
#include "iot_hub_client.h"

esp_err_t cloud_settings_resolve_iot_hub_settings_x509(const char *registration_id, iot_hub_client_settings_t *settings);

#endif
