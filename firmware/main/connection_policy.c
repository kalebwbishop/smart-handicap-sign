#include "connection_policy.h"

bool should_enter_provisioning_on_initial_connect_failure(bool credentials_validated)
{
    return !credentials_validated;
}

bool should_enter_provisioning_on_reconnect_failure(bool credentials_validated, int failure_count, int max_failures)
{
    if (failure_count < max_failures) {
        return false;
    }

    return !credentials_validated;
}
