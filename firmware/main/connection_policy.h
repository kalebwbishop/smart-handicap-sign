#ifndef CONNECTION_POLICY_H
#define CONNECTION_POLICY_H

#include <stdbool.h>

bool should_enter_provisioning_on_initial_connect_failure(bool credentials_validated);
bool should_enter_provisioning_on_reconnect_failure(bool credentials_validated, int failure_count, int max_failures);

#endif
