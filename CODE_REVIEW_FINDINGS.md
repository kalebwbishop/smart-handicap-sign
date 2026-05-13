# Code Review Findings and Remediation Plan

Date: 2026-05-07

## Summary

Review verdict: **Request changes**.

The current device registration migration introduces several correctness and security issues that should be addressed before merge. The highest-risk issue is an authorization gap in device claim and transfer flows: a valid organization member can submit a `site_id` or `parking_space_id` from another organization, causing that other organization's parking space to be modified.

The review also found a runtime error in claim validation, a still-mounted legacy events API that queries the removed `signs` table, and a broken legacy IDOR test file that no longer targets existing routes.

## Findings

| ID | Severity | Area | Status |
| --- | --- | --- | --- |
| F-001 | Critical | Device claim and transfer authorization | Must fix before merge |
| F-002 | Required | Device claim validation response | Must fix before merge |
| F-003 | Required | Legacy events API and v2 schema compatibility | Must fix before merge |
| F-004 | Required | Legacy IDOR tests | Must fix before merge |

## F-001: Cross-organization device claim or transfer can corrupt another organization's parking space

**Severity:** Critical

**Affected files:**

- `backend\app\routes\device_claims.py:115`
- `backend\app\services\device_service.py:326`
- `backend\app\services\device_service.py:351`
- `backend\app\services\device_service.py:364`
- `backend\app\routes\devices.py:266`
- `backend\app\services\device_service.py:571`
- `backend\app\services\device_service.py:589`
- `backend\app\services\device_service.py:602`

### Problem

`claim_device` verifies that the current user belongs to `body.customer_id`, but it does not verify that `body.site_id` belongs to that organization or that `body.parking_space_id` belongs to that site.

The service then trusts the caller-controlled IDs and writes them into multiple tables:

- `devices.organization_id`
- `devices.current_site_id`
- `devices.current_parking_space_id`
- `parking_spaces.current_device_id`
- `parking_spaces.accessible_type`
- `installations.organization_id`
- `installations.site_id`
- `installations.parking_space_id`
- `device_events.payload`
- audit log metadata

`transfer_device` has the same authorization gap. The route verifies that the caller has admin access to the device being transferred, but the service trusts `new_site_id` and `new_parking_space_id` without proving that the new parking space belongs to the device's organization.

The v2 schema does not enforce this relationship at the database level. `installations.organization_id`, `installations.site_id`, and `installations.parking_space_id` are independent foreign keys:

```sql
CREATE TABLE installations (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id           UUID NOT NULL REFERENCES devices(id),
    organization_id     UUID NOT NULL REFERENCES organizations(id),
    site_id             UUID NOT NULL REFERENCES sites(id),
    parking_space_id    UUID NOT NULL REFERENCES parking_spaces(id),
    installer_user_id   UUID NOT NULL REFERENCES users(id),
    ...
);
```

That means application code must validate the hierarchy:

```text
organization -> site -> parking_space
```

### Impact

A user with a valid role in their own organization can modify a parking space in another organization if they know or can guess the UUID of that parking space.

Example failure mode:

1. User is an installer for organization A.
2. User submits a valid claim for organization A.
3. User provides `site_id` from organization A but `parking_space_id` from organization B.
4. The claim succeeds.
5. Organization B's `parking_spaces.current_device_id` is overwritten with organization A's device.

This is an insecure direct object reference (IDOR) and cross-tenant data integrity issue.

### Required remediation

Validate the target location inside the same transaction that performs the claim or transfer. The service should lock and verify the parking space and its parent site before updating device, parking space, installation, event, or audit data.

Recommended claim-time validation:

```sql
SELECT
    ps.id AS parking_space_id,
    ps.current_device_id,
    s.id AS site_id,
    s.organization_id
FROM parking_spaces ps
JOIN sites s ON s.id = ps.site_id
WHERE ps.id = $1
  AND s.id = $2
  AND s.organization_id = $3
FOR UPDATE;
```

Where:

- `$1` is `parking_space_id`
- `$2` is `site_id`
- `$3` is `organization_id`

If no row is returned, reject the request before any write occurs.

Recommended response mapping:

| Condition | Suggested error code | Suggested HTTP status |
| --- | --- | --- |
| Parking space does not exist or is outside the organization/site | `TARGET_LOCATION_NOT_FOUND` | 404 |
| Parking space already has a different active device | `PARKING_SPACE_OCCUPIED` | 409 |
| Site exists but does not belong to target organization | `TARGET_LOCATION_NOT_FOUND` or `FORBIDDEN_TARGET_LOCATION` | 404 or 403 |

Prefer `404` if the API should not reveal whether another organization's site or parking space exists.

Recommended transfer-time validation:

```sql
SELECT
    ps.id AS parking_space_id,
    ps.current_device_id,
    s.id AS site_id,
    s.organization_id
FROM parking_spaces ps
JOIN sites s ON s.id = ps.site_id
WHERE ps.id = $1
  AND s.id = $2
  AND s.organization_id = $3
FOR UPDATE;
```

For transfer, `$3` should be the existing device's `organization_id`, not a caller-supplied organization ID.

### Implementation checklist

- [ ] Add a service-level helper that validates and locks a target parking space by `organization_id`, `site_id`, and `parking_space_id`.
- [ ] Call that helper from `execute_claim` before updating `devices`.
- [ ] Call that helper from `transfer_device` before clearing the old parking space or decommissioning the old installation.
- [ ] Reject occupied target spaces unless the occupying device is the same device being transferred.
- [ ] Ensure no partial writes occur when validation fails.
- [ ] Return stable service error codes and map them to appropriate HTTP responses in the routes.
- [ ] Add regression tests for cross-organization claim attempts.
- [ ] Add regression tests for cross-organization transfer attempts.
- [ ] Add regression tests for mismatched `site_id` and `parking_space_id`.
- [ ] Add regression tests for occupied target parking spaces.

### Suggested tests

Add tests that prove the following behavior:

1. A user can claim a device into a parking space that belongs to their organization and site.
2. A user cannot claim a device into a parking space from another organization.
3. A user cannot claim a device with a `site_id` from their organization and a `parking_space_id` from another site.
4. An admin can transfer a device to another parking space in the same organization.
5. An admin cannot transfer a device to a parking space in another organization.
6. Failed claim or transfer attempts do not update `devices`, `parking_spaces`, `installations`, or `device_events`.

## F-002: Valid device-claim validation responses can raise `KeyError`

**Severity:** Required

**Affected files:**

- `backend\app\routes\device_claims.py:87`
- `backend\app\services\device_service.py:224`

### Problem

`validate_device_claim` builds a `DeviceSummary` using:

```python
lifecycle_status=result.device["lifecycle_status"]
```

But `device_service.validate_claim` returns a success summary with only:

```python
summary = {
    "id": str(device["id"]),
    "serial_number": device["serial_number"],
    "model_code": device["model_code"],
    "name": device["name"],
}
```

The route also attempts to read `hardware_revision` with `.get(...)`, but that field is also missing from the service result.

### Impact

A successful validation can fail at response construction time with `KeyError: 'lifecycle_status'`. That turns a valid claim-code validation into a server error.

This also means tests that only cover invalid claim flows can miss the broken success path.

### Required remediation

Make the service result and route response model agree.

Recommended fix:

1. Include the fields required by `DeviceSummary` in the SQL query and service summary.
2. Keep `lifecycle_status` required if clients need it.
3. Keep `hardware_revision` optional if it is not guaranteed.

Example service summary shape:

```python
summary = {
    "id": str(device["id"]),
    "serial_number": device["serial_number"],
    "model_code": device["model_code"],
    "hardware_revision": device["hardware_revision"],
    "lifecycle_status": device["lifecycle_status"],
    "name": device["name"],
}
```

If clients do not need lifecycle status, an alternate fix is to remove `lifecycle_status` from `DeviceSummary`. However, the current model declares it as required, so adding it to the service result is the lower-risk change.

### Implementation checklist

- [ ] Update `validate_claim` to select `hardware_revision` if it is not already selected.
- [ ] Add `hardware_revision` and `lifecycle_status` to the returned success summary.
- [ ] Add a route-level or service-level test for the successful validation path.
- [ ] Assert that the response includes `serial_number`, `model_code`, `hardware_revision`, and `lifecycle_status`.

### Suggested tests

Add tests that prove:

1. Valid serial number and claim ID returns `200` with `valid: true`.
2. The successful response includes `device.lifecycle_status`.
3. The route does not raise when `hardware_revision` is `NULL`.
4. Invalid claim code still returns the documented invalid response.

## F-003: Mounted events API still queries the removed `signs` table

**Severity:** Required

**Affected files:**

- `backend\app\main.py:150`
- `backend\app\services\event_service.py:58`
- `backend\app\services\event_service.py:154`
- `database\schemas\shs_schema_v2.sql:27`
- `database\schemas\shs_schema_v2.sql:333`

### Problem

The application still mounts `events_router`:

```python
app.include_router(events_router, prefix=API_PREFIX)
```

But `event_service` still queries the legacy `signs` table:

```python
SELECT id, organization_id FROM signs WHERE id = $1
```

and:

```python
e.sign_id IN (
    SELECT s.id
    FROM signs s
    WHERE s.organization_id IN (...)
)
```

The v2 schema explicitly drops `signs`:

```sql
DROP TABLE IF EXISTS signs CASCADE;
```

The v2 `events` table retains `sign_id` only as a legacy column:

```sql
sign_id UUID NOT NULL,  -- legacy FK; original table (signs) no longer exists
```

### Impact

Any mounted endpoint that calls these service methods can fail at runtime with a database error because `signs` no longer exists in v2.

This also creates an inconsistent API surface: the v2 app exposes legacy events routes even though the underlying legacy data model has been removed.

### Required remediation

Choose one of the following paths and make the API, service, and schema consistent.

#### Option A: Migrate events to devices

Use this option if `/api/v1/events` remains part of the supported API.

Recommended changes:

- Replace `sign_id` request/response concepts with `device_id` or `serial_number`.
- Authorize event access through `devices.organization_id`.
- Store new events in `device_events` if that is the v2 canonical table.
- Update route schemas and service functions to use device-oriented names.
- Add migration or compatibility behavior if existing clients still send `sign_id`.

Recommended authorization query:

```sql
SELECT d.id, d.organization_id
FROM devices d
WHERE d.id = $1;
```

For list authorization:

```sql
SELECT de.id, de.device_id, de.event_type, de.payload, de.created_at
FROM device_events de
JOIN devices d ON d.id = de.device_id
JOIN organization_members om ON om.organization_id = d.organization_id
WHERE om.user_id = $1
ORDER BY de.created_at DESC
OFFSET $2 LIMIT $3;
```

#### Option B: Unmount or deprecate legacy events

Use this option if `/api/v1/events` should not be supported in v2.

Recommended changes:

- Remove `app.include_router(events_router, prefix=API_PREFIX)` from `backend\app\main.py`.
- Remove or clearly quarantine the legacy route/service code.
- Update API documentation to point clients to device event endpoints.
- Remove or rewrite tests that expect the old signs/events behavior.

### Implementation checklist

- [ ] Decide whether legacy `/api/v1/events` remains supported.
- [ ] If supported, migrate the route and service from `signs`/`events` to `devices`/`device_events`.
- [ ] If unsupported, unmount the router and update docs/tests.
- [ ] Ensure no code path queries `signs` under the v2 schema.
- [ ] Add tests that run against the v2 schema assumptions.

### Suggested tests

If migrating:

1. Creating a device event succeeds for a device in the user's organization.
2. Creating or listing events for another organization's device is rejected.
3. Listing events no longer references `signs`.
4. Response fields use device terminology consistently.

If unmounting:

1. `/api/v1/events` returns `404`.
2. No mounted route calls `event_service.create_event` or `event_service.list_events`.
3. Legacy event tests are removed, skipped with a clear reason, or rewritten.

## F-004: Legacy IDOR tests patch a deleted route module

**Severity:** Required

**Affected file:**

- `backend\tests\test_idor_signs.py:52`

### Problem

`backend\tests\test_idor_signs.py` patches `app.routes.signs.*`, but `backend\app\routes\signs.py` no longer exists.

Example:

```python
@patch("app.routes.signs.organization_service.get_user_role", new_callable=AsyncMock)
@patch("app.routes.signs.sign_service.get_sign", new_callable=AsyncMock)
def test_member_can_view_sign(...):
    ...
```

The file header already says the tests are legacy and expected to be rewritten:

```python
LEGACY: These tests cover the deprecated signs API which has been replaced
by the device registration system (routes/device_claims.py).
```

### Impact

The test suite can fail before it exercises any authorization behavior because the patched module path no longer exists.

This hides the more important risk: the new device and device-claim endpoints need equivalent IDOR coverage, especially because F-001 is an IDOR issue.

### Required remediation

Rewrite this test file to target the new device and device-claim endpoints, or remove/skip it only if equivalent v2 IDOR tests are added elsewhere.

Recommended direction:

- Replace signs fixtures with organizations, sites, parking spaces, and devices.
- Replace `GET /api/v1/signs/{id}` tests with device read/update/transfer authorization tests.
- Add explicit tests for claim and transfer cross-organization target validation.
- Keep the test intent: users must not access or mutate resources outside their organization.

### Implementation checklist

- [ ] Remove patches that reference `app.routes.signs`.
- [ ] Add test fixtures for two organizations, two users, two sites, two parking spaces, and at least one claimable device.
- [ ] Cover member and non-member access to device endpoints.
- [ ] Cover admin-only transfer/revoke paths.
- [ ] Cover claim into another organization's parking space.
- [ ] Cover transfer into another organization's parking space.
- [ ] Ensure tests fail before the F-001 fix and pass after it.

### Suggested tests

1. Organization A installer cannot claim a device into organization B's parking space.
2. Organization A admin cannot transfer an organization A device into organization B's parking space.
3. Organization A admin cannot transfer a device using mismatched `site_id` and `parking_space_id`.
4. Non-member cannot view, transfer, revoke, or release another organization's device.
5. Valid member/admin flows still succeed.

## Recommended remediation order

1. Fix F-001 first. It is the highest-severity security and data integrity issue.
2. Fix F-002 next. It is a small correctness fix and should be straightforward to test.
3. Decide the F-003 product/API direction. Either migrate legacy events to device events or unmount them.
4. Rewrite F-004 tests so the suite protects the v2 API instead of patching deleted signs routes.

## Verification plan

After remediation, run the backend test suite and targeted tests for the changed areas.

Recommended targeted checks:

```powershell
cd C:\Users\KBishop\code\apps\smart-handicap-sign
backend\venv\Scripts\python.exe -m pytest backend\tests -q
```

If the full suite is too broad, run targeted tests for:

- device claim validation
- device claim execution
- device transfer
- device/event authorization
- rewritten IDOR tests

## Acceptance criteria

The remediation is complete when all of the following are true:

- [ ] Device claim validates that `organization_id`, `site_id`, and `parking_space_id` belong to the same hierarchy.
- [ ] Device transfer validates that the target site and parking space belong to the device's organization.
- [ ] Failed claim or transfer attempts leave device, parking space, installation, and event state unchanged.
- [ ] Successful claim validation no longer raises `KeyError`.
- [ ] The mounted events API no longer queries `signs`, or the legacy events router is no longer mounted.
- [ ] IDOR tests target the v2 device/device-claim API instead of deleted signs routes.
- [ ] Tests cover both allowed same-organization behavior and rejected cross-organization behavior.
