# Contract: ESP-IDF Local Provisioning API

## General Rules

- Base URL while in SoftAP provisioning mode: `http://192.168.4.1`.
- Provisioning endpoints are exposed only while the device is intentionally in setup/fallback mode.
- `/status` and `/scan` are unauthenticated and must not return secrets.
- `/configure` requires a valid device-specific setup or claim code before Wi-Fi credentials are saved.
- Responses must not include saved Wi-Fi passwords, device bearer tokens, setup/claim codes, verifier hashes, or salts.
- `/configure` accepts exactly one of `claim_id` or `setup_code`. Requests with both fields or neither field are rejected before any Wi-Fi write.
- Firmware locks `/configure` credential writes for 5 minutes after 5 failed setup/claim code validations during the current boot session.
- Setup/claim verifier material is issued by manufacturing, backend registration, or service tooling. Firmware verifies locally and does not mint verifier secrets.
- Revoked or expired verifier metadata, when present in device storage, makes the verifier unusable before any Wi-Fi write.
- Field reset clears Wi-Fi credentials only. Serial number, bearer token, and setup/claim verifier material remain available unless a protected manufacturing or service identity erase path is used.

## `GET /status`

**Purpose**: Let an installer app confirm that it is connected to the device SoftAP.

**Success Response `200 application/json`**:

```json
{
  "device_id": "A1B2C3D4E5F6",
  "ap_active": true
}
```

**Allowed Additive Fields**:

- `serial_number`: Allowed only if it is already printed/QR-visible and not treated as a secret.
- `firmware_version`: Allowed for diagnostics.
- `provisioning_required`: Allowed for UI state.

**Forbidden Fields**:

- Wi-Fi password.
- Device auth token.
- Setup/claim code.
- Setup/claim hash or salt.

## `GET /scan`

**Purpose**: Return nearby Wi-Fi networks for installer selection.

**Success Response `200 application/json`**:

```json
[
  {
    "ssid": "ExampleNetwork",
    "rssi": -53,
    "authmode": 3
  }
]
```

**Validation and Failure Behavior**:

- Hidden SSIDs may be omitted.
- Duplicate SSIDs should be collapsed where practical.
- Scan failures return an error JSON body and must not crash the provisioning server.

## `POST /configure`

**Purpose**: Save Wi-Fi credentials after local setup/claim authorization succeeds.

**Request Body**:

```json
{
  "ssid": "ExampleNetwork",
  "password": "fake-password-for-docs-only",
  "claim_id": "ABCD-EF23"
}
```

**Accepted Authorization Fields**:

- `claim_id`: Preferred when the installer flow already scanned the device claim QR code.
- `setup_code`: Accepted alias for deployments that use a separate setup code.

Exactly one valid device-specific code must be supplied. If both fields are supplied, firmware rejects the request.

**Authorization Matrix**:

| Caller / Condition | Expected Behavior |
|---|---|
| Missing `claim_id` and `setup_code` | `400`, no Wi-Fi write |
| Both `claim_id` and `setup_code` supplied | `400`, no Wi-Fi write |
| Malformed or oversized JSON | `400` or `413`, no Wi-Fi write |
| Invalid code | `401` or `403`, no Wi-Fi write, failure counter increments |
| Revoked or expired verifier metadata, when provisioned | `401` or `403`, no Wi-Fi write, generic invalid-code response |
| 5 failed validations in current boot session | `/configure` credential writes locked for 5 minutes |
| Request during lockout | `429`, no Wi-Fi write, no secret detail |
| Valid code with valid SSID/password | `200`, credentials saved, sensitive buffers cleared |
| Replay of still-active valid code for Wi-Fi reconfiguration | Allowed until verifier is revoked or rotated by manufacturing/backend/service tooling |

Validation must treat replay with revoked or expired metadata as invalid, apply the same generic error shape as other invalid-code failures, and avoid writing Wi-Fi credentials.

**Request Validation**:

- `ssid` is required and non-empty.
- `password` may be empty only for open networks and must respect NVS length limits.
- `claim_id` or `setup_code` must verify against local verifier material provisioned on the device.
- Invalid JSON, oversized bodies, missing code, invalid code, lockout, or invalid SSID returns an error and does not save credentials.
- Error bodies must be generic enough to avoid revealing whether a submitted code was close to valid.

**Success Response `200 application/json`**:

```json
{
  "ok": true,
  "message": "Credentials saved. Rebooting..."
}
```

**Failure Responses**:

```json
{
  "error": "Invalid setup code"
}
```

Representative HTTP statuses:

- `400`: Invalid JSON, missing SSID, missing authorization code, or malformed request.
- `401` or `403`: Authorization code did not verify.
- `413`: Request body exceeds firmware limit, if implemented separately from `400`.
- `500`: NVS write failure or internal provisioning error.

**Side Effects**:

- On success, firmware saves `wifi_ssid` and `wifi_pass` to NVS, clears sensitive buffers where practical, returns success, and reboots or reconnects as a station.
- On failure, firmware does not modify saved Wi-Fi credentials.
- Field reset clears Wi-Fi credentials only. Serial number, auth token, and setup/claim verifier material remain unless a protected manufacturing/service identity erase path is used.
- Successful local provisioning should be summarized later through a secret-free backend device event when backend connectivity is available.
- Suggested operational signals are `hazard_hero_setup_code_failures_total`, `hazard_hero_setup_code_lockouts_total`, and `hazard_hero_provisioning_success_total`, emitted as structured logs or backend device events when a metrics backend is not present.

## Compatibility Classification

- **Firmware-breaking if changed**: Endpoint paths, JSON field names for `ssid`/`password`, or requirement that `/configure` accepts a setup/claim code.
- **Frontend-breaking if changed**: `claim_id`/`setup_code` request field names or error response shape.
- **Security-breaking if changed**: Returning any secret or allowing unauthenticated `/configure` credential writes.