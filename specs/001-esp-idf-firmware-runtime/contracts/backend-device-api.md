# Contract: Backend Device Runtime API

## General Rules

- Base URL compiled into firmware includes `/api/v1`, for example `https://api.example.com/api/v1`.
- Firmware appends paths without trailing slashes. FastAPI `redirect_slashes=False` means trailing slash variants are not valid contracts.
- Runtime HTTPS must validate the configured certificate chain and common name expectations for production deployments.
- Device bearer credentials are secrets and must not be logged or returned in responses.
- Firmware must send `X-Firmware-Version` and `X-Firmware-Config-Version` headers on runtime requests. Backend behavior must enforce configured minimum supported firmware and config versions before telemetry side effects; missing, malformed, or unsupported versions fail safely instead of receiving compatibility bypasses.
- `X-Firmware-Version` format is numeric semantic version `MAJOR.MINOR.PATCH`; compare major, then minor, then patch as integers.
- `X-Firmware-Config-Version` format is numeric date version `YYYY.MM.DD`; compare year, then month, then day as integers and reject impossible dates.
- Empty components, suffixes, non-numeric components, impossible dates, extra components, or missing headers are malformed and fail safe before telemetry side effects.

## `GET /api/v1/devices/{serial_number}/status`

**Consumer**: ESP-IDF firmware status polling and OTA boot validation.

**Authentication**: Existing lightweight firmware-facing status contract. The endpoint must not expose secrets. Firmware may send `Authorization: Bearer <serial>:<token>` for consistency, but this plan does not require status polling to depend on that header.

**Authorization Matrix**:

| Caller / Condition | Expected Behavior |
|---|---|
| Anonymous caller with known serial | Allowed, returns secret-free status payload only |
| Anonymous caller with unknown serial | `404`, no secret fields |
| Firmware sends valid bearer header | Allowed, bearer is tolerated and may be logged as authenticated without exposing token |
| Firmware sends malformed or invalid bearer header | Status response remains secret-free; implementation may ignore auth for this lightweight endpoint, but must not leak auth failure details |
| Missing, malformed, or unsupported firmware/config version | Fail safe according to configured policy; do not grant provisioning or telemetry bypasses based on this endpoint |

**Path Parameters**:

- `serial_number`: Registered device serial number.

**Success Response `200 application/json`**:

```json
{
  "serial_number": "SHS-2605-S01-A7K-00003-W",
  "status": "available",
  "lifecycle_status": "active",
  "operational_status": "available"
}
```

**Status Semantics**:

- Firmware may sample and submit classification only when `status` is exactly `available`.
- `lifecycle_status == active` uses `operational_status` to derive `status`.
- Occupied, reserved, claimed, stale, or manually overridden parking/operations states are not part of the initial device operational enum. If backend status derivation later surfaces those states to firmware, they must derive a non-available `status` or `unknown` and must not permit sampling.
- Non-active lifecycle states must produce non-available status values such as `pending`, `disabled`, or `unknown`.
- Unknown status strings, stale status data, and malformed lifecycle/operational combinations are treated by firmware as fail-closed and must not permit sampling.

**Failure Responses**:

- `404`: Device serial is not registered.
- `5xx` or network/TLS failure: Firmware pauses sampling, shows error/offline LED behavior, and retries with bounded backoff.
- Malformed JSON, missing `status`, or unusable body: Firmware treats as fail-closed polling failure.

**OTA Rule**:

- A pending OTA image may be marked valid only after a successful HTTPS `200` response for this endpoint for the device serial number.

## `POST /api/v1/inference/classify`

**Consumer**: ESP-IDF firmware classification submission.

**Authentication**: Required device bearer token.

```http
Authorization: Bearer <serial_number>:<device_token>
Content-Type: application/json
X-Firmware-Version: 1.2.3
X-Firmware-Config-Version: 2026.05.12
```

**Authorization Matrix**:

| Caller / Condition | Expected Behavior |
|---|---|
| Anonymous caller | `401`, model inference is not run |
| Malformed bearer credential | `401`, model inference is not run |
| Unknown serial in bearer credential | `401`, model inference is not run |
| Wrong token, revoked token, or expired token metadata | `401`, model inference is not run; repeated failures can create auth-failure-threshold device events without secrets |
| Missing, malformed, or unsupported firmware/config version | `426` or `403`, model inference is not run and no telemetry side effect occurs |
| Valid token with payload serial omitted | Accepted, payload serial defaults to authenticated device serial |
| Valid token with mismatched payload serial | `403`, model inference is not run |
| Valid token with exactly 512 samples in `0..4095` | `200` classification response |
| Valid token with wrong sample shape or range | `422`, model inference is not run |

**Request Body**:

```json
{
  "serial_number": "SHS-2605-S01-A7K-00003-W",
  "samples": [0, 17, 42, 4095]
}
```

`samples` is shown truncated above. The real request must include exactly 512 integer values.

**Request Validation**:

- `serial_number` is optional only for legacy/client compatibility. Firmware should send it explicitly.
- If `serial_number` is present, it must match the authenticated device serial.
- `samples` must contain exactly 512 integers.
- Each sample must be in the ESP32 12-bit ADC range `0..4095`.
- User-controlled thresholds are not accepted.

**Success Response `200 application/json`**:

```json
{
  "label": "wave",
  "confidence": 0.91,
  "debug_graph": null
}
```

**Side Effects**:

- If `label == "wave"`, backend updates the authenticated device to `operational_status = 'assistance_requested'` and attempts to create a device event/notification.
- Event/notification failures should be logged but must not prevent returning the classification result.
- Backend records or preserves secret-free operational signals for wave detection, repeated auth failure thresholds, observed firmware version, status failure/recovery where known, and OTA validation events.
- Metrics definitions must include counters or timers for classify submissions, auth failures, wave detections, status poll failures/recoveries, and OTA validation, even when the first implementation emits those signals as structured logs or device events.
- Suggested signal names: `hazard_hero_classify_submissions_total`, `hazard_hero_device_auth_failures_total`, `hazard_hero_wave_detections_total`, `hazard_hero_status_poll_failures_total`, `hazard_hero_status_poll_recoveries_total`, `hazard_hero_firmware_version_observations_total`, and `hazard_hero_ota_validations_total`.

**Failure Responses**:

- `401`: Missing, malformed, unknown, or invalid device bearer token.
- `403`: Payload serial does not match authenticated device serial.
- `422`: Invalid sample shape or values.
- `5xx`: Backend/model/database failure. Firmware shows error behavior and retries according to runtime policy.

## `POST /api/v1/devices/{serial_number}/events`

**Consumer**: ESP-IDF firmware reporting events that only the device can observe directly.

**Authentication**: Required device bearer token. The path serial number must match the authenticated serial.

```http
Authorization: Bearer <serial_number>:<device_token>
Content-Type: application/json
X-Firmware-Version: 1.2.3
X-Firmware-Config-Version: 2026.05.12
```

**Allowed Event Types**:

- `status_poll_failed`
- `status_poll_recovered`
- `ota_validated`
- `provisioning_succeeded`

**Request Body**:

```json
{
  "event_type": "status_poll_failed",
  "occurred_at_ms": 123456,
  "payload": {
    "reason": "tls_error",
    "retry_count": 3
  }
}
```

**Authorization Matrix**:

| Caller / Condition | Expected Behavior |
|---|---|
| Anonymous caller | `401`, no event is stored |
| Malformed bearer credential | `401`, no event is stored |
| Valid token for a different serial | `403`, no event is stored |
| Missing, malformed, or unsupported firmware/config version | `426` or `403`, no event is stored |
| Unsupported event type | `422`, no event is stored |
| Payload contains forbidden secret fields | `422`, no event is stored |
| Valid token, supported firmware/config version, allowed event type, secret-free payload | `201`, event is stored as a `device_events` row |

**Payload Rules**:

- Payloads must be bounded JSON objects suitable for storage in `device_events.payload`.
- Payloads must not include Wi-Fi passwords, device tokens, verifier hashes, salts, private keys, or certificate private material.
- Firmware should deduplicate repeated status failures where practical and send summaries after connectivity is restored.
- Backend structured logs and `device_events` payloads must include serial/device identifiers and reason categories only; they must never include bearer tokens, hashes, salts, Wi-Fi passwords, private keys, or certificate private material.

**Success Response `201 application/json`**:

```json
{
  "ok": true,
  "event_type": "status_poll_failed"
}
```

## Compatibility Classification

- **Backward-compatible**: Status endpoint remains on existing path and classify keeps deprecated `sign_id` acceptance outside firmware.
- **Firmware-breaking if changed**: Path names, required trailing slashes, Authorization header format, firmware version header policy, sample length, sample range, firmware event-reporting fields, or response `status`/`label`/`confidence` fields.
- **Migration-only**: Adding missing v2 `devices.operational_status` column or enum to match the contract.