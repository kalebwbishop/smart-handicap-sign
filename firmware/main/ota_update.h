#ifndef OTA_UPDATE_H
#define OTA_UPDATE_H

#include <stdbool.h>

#include "esp_err.h"

// OTA update status for progress tracking
typedef enum {
    OTA_STATUS_IDLE,
    OTA_STATUS_IN_PROGRESS,
    OTA_STATUS_SUCCESS,
    OTA_STATUS_FAILED,
} ota_status_t;

// Initialize OTA subsystem (validate current partition, mark as valid)
esp_err_t ota_init(void);

// Check for and perform OTA update from the given URL
// This is a blocking call — downloads and flashes the new firmware
// On success, the device should be restarted to boot into the new firmware
// url: HTTPS URL to the firmware binary (.bin file)
esp_err_t ota_perform_update(const char *url);

// Get current running firmware version (from app description)
const char *ota_get_current_version(void);

// Get current OTA status
ota_status_t ota_get_status(void);

// Mark current firmware as valid (call after successful boot + connectivity check)
// This prevents rollback to the previous firmware
esp_err_t ota_mark_valid(void);

// Check if this is the first boot after an OTA update
bool ota_is_first_boot(void);

#endif
