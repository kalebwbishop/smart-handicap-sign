#pragma once

#include <stddef.h>

#include "esp_err.h"

#ifndef DPS_ID_SCOPE_MAX_LEN
#define DPS_ID_SCOPE_MAX_LEN 32U
#endif

#ifndef DPS_REGISTRATION_ID_MAX_LEN
#define DPS_REGISTRATION_ID_MAX_LEN 128U
#endif

#ifndef DPS_ASSIGNED_HUB_MAX_LEN
#define DPS_ASSIGNED_HUB_MAX_LEN 128U
#endif

#ifndef DPS_ASSIGNED_DEVICE_ID_MAX_LEN
#define DPS_ASSIGNED_DEVICE_ID_MAX_LEN 128U
#endif

typedef struct {
    char id_scope[DPS_ID_SCOPE_MAX_LEN + 1U];
    char registration_id[DPS_REGISTRATION_ID_MAX_LEN + 1U];
    const char *client_cert_pem;
    const char *client_key_pem;
} dps_client_config_t;

typedef struct {
    char assigned_hub[DPS_ASSIGNED_HUB_MAX_LEN + 1U];
    char device_id[DPS_ASSIGNED_DEVICE_ID_MAX_LEN + 1U];
} dps_assignment_t;

esp_err_t dps_client_register(const dps_client_config_t *config, dps_assignment_t *assignment);
