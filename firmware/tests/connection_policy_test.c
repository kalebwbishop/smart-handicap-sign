#include <assert.h>
#include <stdbool.h>

#include "../main/connection_policy.h"

int main(void)
{
    assert(should_enter_provisioning_on_initial_connect_failure(false) == true);
    assert(should_enter_provisioning_on_initial_connect_failure(true) == false);

    assert(should_enter_provisioning_on_reconnect_failure(false, 1, 3) == false);
    assert(should_enter_provisioning_on_reconnect_failure(false, 3, 3) == true);
    assert(should_enter_provisioning_on_reconnect_failure(true, 3, 3) == false);
    assert(should_enter_provisioning_on_reconnect_failure(true, 5, 3) == false);

    return 0;
}
