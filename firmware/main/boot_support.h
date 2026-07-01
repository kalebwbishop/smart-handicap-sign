#ifndef BOOT_SUPPORT_H
#define BOOT_SUPPORT_H

#include "esp_err.h"

void boot_support_halt_forever(void);
void boot_support_fatal_restart(const char *message, esp_err_t err);
void boot_support_enter_provisioning_mode(const char *reason);
esp_err_t boot_support_init_task_wdt(void);

#endif
