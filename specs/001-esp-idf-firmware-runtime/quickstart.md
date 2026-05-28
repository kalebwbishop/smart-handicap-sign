# Quickstart: ESP-IDF Firmware Runtime Validation

This quickstart is for validating the planned ESP-IDF firmware runtime behavior after implementation tasks are generated and completed.

## Prerequisites

- ESP-IDF 5.4+ available in the shell used for firmware builds.
- ESP32-WROOM-32 class board with photoresistor on GPIO 34 / ADC1 channel 6.
- Backend and PostgreSQL available for integration testing.
- A registered device row with serial number, token hash/salt, lifecycle status, and operational status.
- Firmware `server_certs/ca_cert.pem` matching the backend HTTPS endpoint used for testing.

## 1. Start Backend Dependencies

From the repository root:

```powershell
npm run db:up
npm run migrate:v2 --workspace=database
```

Then run the backend:

```powershell
Set-Location backend
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Use fake local test values only. Do not commit real device tokens, WorkOS secrets, database URLs, or certificates.

## 2. Prepare A Device Row

The test device must exist in the v2 `devices` table and have an auth token verifier configured. For runtime sampling tests, set:

```sql
UPDATE devices
SET lifecycle_status = 'active',
    operational_status = 'available'
WHERE serial_number = 'SHS-2605-S01-A7K-00003-W';
```

If `operational_status` is unavailable, complete the schema-alignment task from the implementation plan before continuing.

## 3. Configure Firmware Inputs

Before building/flashing production-like firmware, confirm:

- `HAZARD_HERO_BACKEND_URL` includes `/api/v1` and points at the target backend.
- `firmware/server_certs/ca_cert.pem` trusts that backend certificate chain.
- NVS contains the serial number and device auth token.
- Wi-Fi credentials are either preloaded or intentionally absent to test SoftAP provisioning.
- Device auth token material was issued by manufacturing/backend registration tooling; firmware must not generate token material.
- Field reset clears Wi-Fi credentials only and must preserve serial number and auth token material.

Example NVS CSV shape for bench testing after implementation may include fields like these, with fake values only:

```csv
key,type,encoding,value
device,namespace,,
serial,data,string,SHS-2605-S01-A7K-00003-W
auth_token,data,string,fake-device-token-for-local-test
wifi,namespace,,
wifi_ssid,data,string,ExampleNetwork
wifi_pass,data,string,fake-password-for-docs-only
```

## 4. Build Firmware

From an ESP-IDF shell:

```powershell
Set-Location firmware
idf.py set-target esp32
idf.py build
```

If ESP-IDF is unavailable, record the missing toolchain and perform substitute validation by reviewing changed C files, contracts, and docs. Hardware-facing implementation is not complete without a later ESP-IDF build.

## 5. Validate Local Provisioning

Erase or omit Wi-Fi credentials, flash the device, and boot into SoftAP provisioning mode.

Connect to the device AP and run:

```powershell
curl http://192.168.4.1/status
curl http://192.168.4.1/scan
curl -X POST http://192.168.4.1/configure `
  -H "Content-Type: application/json" `
  -d '{"ssid":"ExampleNetwork","password":"fake-password-for-docs-only"}'
```

Expected behavior:

- `/status` confirms AP mode without secrets.
- `/scan` returns nearby networks without secrets.
- `/configure` rejects missing SSID and oversized or malformed JSON.
- `/configure` saves Wi-Fi credentials and reboots after a valid request.
- Device exits provisioning after it reconnects as a station.

## 6. Validate Runtime Status Gating

Set backend status to `available` and observe firmware logs:

- Firmware polls `GET /api/v1/devices/{serial_number}/status`.
- Firmware sends `X-Firmware-Version` and `X-Firmware-Config-Version` headers, and backend rejects or fails safely for missing, malformed, or unsupported firmware/config versions according to the configured minimum-version policy.
- Firmware collects exactly 512 ADC samples at the configured interval.
- Firmware submits one `POST /api/v1/inference/classify` request with device bearer auth.

Then set backend status to a non-available value such as `assistance_requested`, `assistance_in_progress`, `offline`, or `error`.

Expected behavior:

- Firmware submits zero new classification sample windows.
- Firmware maps the status to LED behavior.
- Firmware keeps polling with bounded timing.

## 7. Validate Fail-Closed Behavior

Inject each failure independently:

- Stop backend or block network.
- Return non-200 status responses.
- Return malformed status JSON.
- Remove `status` from the response body.
- Configure an invalid backend certificate or mismatched backend URL.

Expected behavior:

- Firmware pauses sampling.
- Firmware shows error/offline LED behavior.
- Firmware retries with bounded backoff.
- Watchdog servicing and LED updates remain responsive.

## 8. Validate OTA Boot Marking

Boot a pending OTA image and block backend status polling.

Expected behavior:

- Firmware does not mark the image valid before successful backend status polling.

Restore backend connectivity and return `200` from `GET /api/v1/devices/{serial_number}/status`.

Expected behavior:

- Firmware marks the OTA image valid after that first successful HTTPS status response.

## 9. Validate Observability And Recovery

Expected secret-free support signals:

- Firmware serial logs show pre-connect provisioning failures, Wi-Fi connection failures, certificate failures, status polling failures, and OTA validation decisions without Wi-Fi passwords or device tokens.
- Backend logs or device event history show connected-device wave detection, auth failure threshold exceeded, status failure and recovery, OTA validation, observed firmware version, and provisioning success summaries without secrets.
- Metrics definitions or equivalent structured log/device-event signals exist for status poll failures and recoveries, classify submissions, auth failures, OTA validation, provisioning success, and firmware version observations.
- Operators can recover by checking firmware serial logs for pre-connect failures, backend logs/device event history for connected-device failures, and manufacturing/service tooling for missing or revoked token material.

Suggested counter or timer names for the first implementation, whether emitted through metrics, structured logs, or device events:

- `hazard_hero_status_poll_failures_total`
- `hazard_hero_status_poll_recoveries_total`
- `hazard_hero_classify_submissions_total`
- `hazard_hero_device_auth_failures_total`
- `hazard_hero_ota_validations_total`
- `hazard_hero_provisioning_success_total`
- `hazard_hero_firmware_version_observations_total`
- `hazard_hero_firmware_event_reports_total`

Operator recovery checklist:

1. Read firmware serial logs for the reported serial number, firmware/config version, Wi-Fi retry state, certificate failures, and OTA validation decisions.
2. Inspect backend logs and `device_events` for the same serial number to find auth failures, unsupported firmware version rejection, status recovery, wave detection, and firmware-reported event summaries.
3. For unsupported firmware, upgrade the device image; do not bypass minimum firmware/config version policy.
4. For missing, revoked, or expired token material, use manufacturing or service tooling to restore identity. Field reset is Wi-Fi-only and must not erase identity material.
5. For provisioning failures, verify the Wi-Fi SSID/password, and backend certificate/backend URL after connectivity returns.

## 10. Run Regression Gates

Run the applicable gates from the plan:

```powershell
Set-Location backend
pytest
```

```powershell
Set-Location ..\firmware
idf.py build
```

```powershell
Set-Location ..
npm run lint --workspace=frontend
```

Run database migration validation when schema files changed:

```powershell
npm run migrate:v2 --workspace=database
```