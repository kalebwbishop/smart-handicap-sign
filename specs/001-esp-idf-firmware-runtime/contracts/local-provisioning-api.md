# Contract: ESP-IDF Local Provisioning API

## General Rules

- Base URL while in SoftAP provisioning mode: `http://192.168.4.1`.
- Provisioning endpoints are exposed only while the device is intentionally in setup/fallback mode.
- `/status` and `/scan` are unauthenticated and must not return secrets.
- `/configure` accepts Wi-Fi credentials without any claim or setup code in the pilot flow.
- Responses must not include saved Wi-Fi passwords or device bearer tokens.
- Field reset clears Wi-Fi credentials only. Serial number and bearer token remain available unless a protected manufacturing or service identity erase path is used.

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

**Purpose**: Save Wi-Fi credentials for the pilot device.

**Request Body**:

```json
{
  "ssid": "ExampleNetwork",
  "password": "fake-password-for-docs-only"
}
```

**Request Matrix**:

| Caller / Condition | Expected Behavior |
|---|---|
| Malformed or oversized JSON | `400` or `413`, no Wi-Fi write |
| Missing `ssid` | `400`, no Wi-Fi write |
| Valid `ssid` with optional password | `200`, credentials saved |

**Request Validation**:

- `ssid` is required and non-empty.
- `password` may be empty only for open networks and must respect NVS length limits.
- Invalid JSON, oversized bodies, or invalid SSID returns an error and does not save credentials.

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

- `400`: Invalid JSON, missing SSID, or malformed request.
- `413`: Request body exceeds firmware limit, if implemented separately from `400`.
- `500`: NVS write failure or internal provisioning error.

**Side Effects**:

- On success, firmware saves `wifi_ssid` and `wifi_pass` to NVS, returns success, and reboots or reconnects as a station.
- On failure, firmware does not modify saved Wi-Fi credentials.
- Field reset clears Wi-Fi credentials only. Serial number and auth token remain unless a protected manufacturing/service identity erase path is used.
- Successful local provisioning should be summarized later through a secret-free backend device event when backend connectivity is available.
- Suggested operational signal is `hazard_hero_provisioning_success_total`, emitted as structured logs or backend device events when a metrics backend is not present.

## Compatibility Classification

- **Firmware-breaking if changed**: Endpoint paths or JSON field names for `ssid`/`password`.
- **Frontend-breaking if changed**: Request field names or success/error response shape.
- **Security-breaking if changed**: Returning any secret in provisioning responses.