# Feature Specification: ESP-IDF Firmware Runtime

**Feature Branch**: `001-esp-idf-firmware-runtime`  
**Created**: 2026-05-12  
**Status**: Draft  
**Input**: User description: "Can you mirgrate #file:spec.md into a new spec?"  
**Source**: `brownfield-specs/esp-idf-firmware-runtime/spec.md`

## Summary

Hazard Hero needs a maintained Spec Kit specification for the active ESP-IDF firmware runtime that powers field devices at accessible parking signs. The runtime lets installers provision Wi-Fi, lets devices identify themselves, polls backend status, collects photoresistor gesture sample windows, submits classification payloads, reflects operational status with an LED, recovers from common network failures, and validates OTA images after the first successful HTTPS status response for the device serial number.

The primary module is firmware. Backend, database, frontend, AI, infrastructure, and documentation are affected as integration contracts that the firmware depends on or exposes to installers and operators.

## Clarifications

### Session 2026-05-12

- Q: Which backend status permits firmware gesture sampling and classify submissions? → A: Only backend status `available` permits sampling/classify submission.
- Q: How should local provisioning endpoints work for the pilot? → A: `/configure` accepts Wi-Fi credentials without a claim or setup code; `/status` and `/scan` remain unauthenticated.
- Q: Which backend interaction marks a newly booted OTA image valid? → A: The first successful HTTPS `GET /api/v1/devices/{serial_number}/status` response.
- Q: What ADC sample value range should firmware submit? → A: Raw ESP32 12-bit ADC values, valid range `0..4095`.
- Q: What should firmware do when status polling fails or returns unusable data? → A: Fail closed: pause sampling, show error/offline LED state, retry with bounded backoff.
- Q: What should `/configure` require in the pilot? → A: `/configure` requires a non-empty SSID, accepts an optional password, rejects malformed or oversized payloads, and saves Wi-Fi credentials without any claim or setup code.
- Q: What observability level is required? → A: Use operational observability: structured firmware/backend logs plus backend `device_events` for wave detection, auth failure threshold exceeded, status failure and recovery, OTA validation, firmware version reporting, and successful local provisioning summaries where backend connectivity later permits upload.
- Q: How are device tokens managed in this feature? → A: Device tokens are issued only by manufacturing/backend registration tooling; firmware never creates tokens. Token rotation is out of scope, but missing, revoked, malformed, or invalid tokens fail closed and require service/manufacturing tooling to restore or rotate.
- Q: What does field factory reset clear? → A: Field reset clears Wi-Fi credentials only. Serial number and device auth token remain unless a protected manufacturing/service erase path is used.
- Q: How should firmware version compatibility be handled? → A: Firmware sends `X-Firmware-Version` and `X-Firmware-Config-Version` headers on backend runtime requests. Backend enforces configured minimum supported firmware/config versions.
- Q: What frontend accessibility behavior is required? → A: Provisioning inputs and actions must include accessibility labels, hints, role/state semantics, error announcements, invalid-field focus behavior, and non-color-only status communication.
- Q: Where should operators look during failures? → A: Operators use backend logs plus device event history for connected-device failures, and firmware serial logs for pre-connect provisioning failures. Recovery steps must be documented in firmware and validation docs.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Provision Device Connectivity (Priority: P1)

A field installer powers a device and provisions Wi-Fi credentials through the device's local setup mode when saved credentials are absent or no longer work.

**Why this priority**: A device cannot detect gestures, report assistance requests, or receive operational status until it can connect to a network.

**Independent Test**: Build and flash the firmware, erase stored Wi-Fi credentials, boot the device, connect to its local setup network, and verify status, network scan, and credential configuration behavior.

**Acceptance Scenarios**:

1. **Given** a device has no saved Wi-Fi credentials, **When** it boots, **Then** it starts local provisioning mode and exposes installer setup status.
2. **Given** valid Wi-Fi credentials are submitted during provisioning, **When** the device stores the credentials, **Then** it reconnects as a station and exits provisioning mode after connectivity succeeds.
3. **Given** saved Wi-Fi credentials repeatedly fail to reconnect, **When** retry exhaustion occurs, **Then** the device returns to local provisioning mode without requiring a firmware reinstall.

---

### User Story 2 - Detect And Submit Gesture Samples (Priority: P1)

An active device checks whether gesture detection is currently allowed, samples the photoresistor when allowed, and submits a complete 512-sample window for backend classification.

**Why this priority**: Gesture detection is the core runtime behavior that turns a wave near the sign into a staff-visible assistance request.

**Independent Test**: With a registered device identity, device token, backend URL, and certificate configuration, observe status polling and classification submissions while the backend reports an available device state.

**Acceptance Scenarios**:

1. **Given** the backend reports status `available`, **When** the firmware main loop runs, **Then** the device collects exactly 512 photoresistor readings at the configured interval and submits one classification payload.
2. **Given** the backend reports any status other than `available`, **When** the firmware main loop runs, **Then** the device does not submit a new sample window and reflects the current status through the LED.
3. **Given** a device token or serial number is missing or invalid, **When** the device attempts runtime classification, **Then** the submission is rejected or blocked and the failure is visible through runtime status handling.

---

### User Story 3 - Maintain Field Runtime Resilience (Priority: P2)

The device handles Wi-Fi failures, backend failures, certificate issues, LED state changes, watchdog timing, and OTA boot validation without blocking normal operation indefinitely.

**Why this priority**: Devices are deployed unattended and need predictable recovery behavior after network changes, backend outages, or firmware updates.

**Independent Test**: Run firmware validation scenarios for Wi-Fi retry exhaustion, backend unavailable responses, LED status mapping, watchdog-safe sampling, and OTA image validity.

**Acceptance Scenarios**:

1. **Given** backend connectivity is temporarily unavailable or status polling returns unusable data, **When** the device completes a bounded retry attempt, **Then** it pauses sampling, shows the configured error/offline LED state, retries with bounded backoff, and continues operating without blocking LED updates or watchdog servicing indefinitely.
2. **Given** a newly booted OTA image, **When** the device receives the first successful HTTPS status response for its serial number, **Then** the device marks the OTA image valid.
3. **Given** a backend URL or certificate configuration mismatch, **When** secure communication fails, **Then** the device reports a recoverable runtime failure state instead of silently submitting insecure traffic.

### Edge Cases

- Device serial number is missing from persistent device storage.
- Device token is missing, expired, malformed, or does not match the serial number.
- Saved Wi-Fi credentials are invalid, the network is unavailable, or signal quality is poor.
- Installer submits an invalid provisioning payload, omits the SSID for `/configure`, or cancels setup before connection succeeds.
- Backend status is unavailable, stale, malformed, or anything other than `available`; firmware fails closed by pausing sampling, showing the configured error/offline LED state, and retrying with bounded backoff.
- Classification submission contains too few, too many, or sample values outside the raw ESP32 12-bit ADC range `0..4095`.
- Backend URL, certificate, or common-name expectations do not match the deployment.
- Watchdog timing is stressed during sampling, network retries, or backend timeouts.
- OTA image is not marked valid and must roll back.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The active device runtime MUST be the ESP-IDF firmware under `firmware/`; the legacy MicroPython runtime MUST NOT define production behavior for this feature.
- **FR-002**: The device MUST read serial number, device token, and Wi-Fi credentials from persistent device storage before normal runtime operation.
- **FR-003**: The device MUST block or enter a recoverable setup/error path when required identity data is missing.
- **FR-004**: The device MUST start local provisioning mode when valid Wi-Fi credentials are absent or reconnect retry exhaustion occurs.
- **FR-005**: Provisioning mode MUST allow an installer to view setup status, scan nearby Wi-Fi networks, and submit Wi-Fi credentials.
- **FR-006**: Provisioning `/configure` MUST accept a valid Wi-Fi payload without a claim or setup code, while `/status` and `/scan` remain available without secrets during provisioning mode.
- **FR-007**: After valid Wi-Fi credentials are submitted, the device MUST persist the credentials, reconnect as a station, and leave provisioning mode after connection succeeds.
- **FR-008**: The device MUST poll backend status before deciding whether to collect and submit a gesture sample window.
- **FR-009**: When backend status is `available`, the device MUST collect exactly 512 readings from the photoresistor input at the configured sample interval.
- **FR-010**: Each classification submission MUST include the registered serial identity, the device bearer credential, and exactly one 512-value sample window of raw ESP32 12-bit ADC integers in the range `0..4095`.
- **FR-011**: When backend status is anything other than `available`, the device MUST avoid submitting a new sample window and MUST show the mapped status through a non-blocking LED pattern.
- **FR-012**: When status polling fails or returns stale, malformed, or otherwise unusable data, the device MUST fail closed by pausing sampling, showing the configured error/offline LED state, and retrying with bounded backoff.
- **FR-013**: Device communication with backend runtime and OTA services MUST use the configured backend URL and certificate trust configuration.
- **FR-014**: The device MUST initialize OTA support and mark a newly booted OTA image valid only after the first successful HTTPS `GET /api/v1/devices/{serial_number}/status` response for its serial number.
- **FR-015**: Wi-Fi reconnects, backend retries, sampling, and LED updates MUST remain bounded so the device can recover without indefinite blocking.
- **FR-016**: Firmware documentation and validation materials MUST cover provisioning authorization, identity requirements, runtime status polling, status-poll failure handling, classification payloads, LED status mapping, Wi-Fi fallback, OTA validity, and deployment certificate setup.
- **FR-017**: `/configure` MUST enforce a request-validation matrix covering missing SSID, malformed payloads, oversized bodies, and valid Wi-Fi credential submissions.
- **FR-018**: The device MUST reject invalid local `/configure` requests without writing Wi-Fi credentials and MUST return generic error responses for malformed payloads.
- **FR-019**: Firmware MUST treat missing, malformed, revoked, expired, or invalid device tokens as fail-closed runtime failures that prevent status polling or classification submission until service/manufacturing tooling restores valid token material.
- **FR-020**: Field reset behavior MUST clear Wi-Fi credentials without clearing serial number or device auth token; full identity erasure MUST require a protected manufacturing/service path outside normal installer setup.
- **FR-021**: Firmware MUST include `X-Firmware-Version` and `X-Firmware-Config-Version` headers on backend runtime requests, and backend behavior MUST enforce configured minimum supported firmware/config versions by rejecting or failing safely for missing, malformed, or unsupported versions rather than bypassing secure provisioning. Firmware app versions use numeric semantic version format `MAJOR.MINOR.PATCH`; firmware config versions use numeric date format `YYYY.MM.DD`; backend comparisons MUST parse and compare numeric components rather than raw strings.
- **FR-022**: Backend and firmware runtime behavior MUST emit structured logs without secrets. Backend-observed events such as wave detection, auth failure threshold exceeded, and firmware version observation MUST create backend `device_events`; firmware-observed events such as status failure and recovery, OTA validation, and successful provisioning summaries MUST be reported through a minimal authenticated firmware event-reporting contract once backend connectivity permits upload.
- **FR-023**: Operational metrics MUST be defined for provisioning failures, status poll failures and recoveries, classify submissions, auth failures, and OTA validation, even if the first implementation records them through structured logs or device events rather than a dedicated metrics backend.
- **FR-024**: Frontend provisioning flows MUST expose Wi-Fi fields and errors with accessible labels, hints, role/state semantics, screen-reader error announcements, focus movement to invalid fields, and non-color-only status indicators.
- **FR-025**: Operator recovery documentation MUST state where to inspect firmware serial logs, backend logs, and device event history for provisioning, status polling, classification, auth, certificate, and OTA failures.
- **FR-026**: Backend status responses, database device state, firmware sampling decisions, and LED behavior MUST follow one documented lifecycle/operational status matrix that identifies the derived firmware status, whether sampling is permitted, the expected LED category, and the fail-closed behavior for unsupported or malformed combinations. The matrix MUST explicitly consider occupied, reserved or claimed, unknown, stale, offline, error, and manually overridden states, even when a state maps to a non-device parking-space concept or a future integration boundary.

### Affected Modules *(mandatory)*

- **Backend (`backend/`)**: Device status and inference classification endpoints are firmware-facing contracts and must remain compatible with registered device identity and bearer-token behavior.
- **Frontend (`frontend/`)**: Setup guide and Wi-Fi setup flows interact with local provisioning behavior and installer expectations.
- **Database (`database/`)**: Registered device records, lifecycle status, operational status, token material, and firmware metadata must exist before authenticated runtime submissions can succeed.
- **Firmware (`firmware/`)**: Active ESP-IDF runtime, including application entry point, ADC sampling, HTTPS communication, LED behavior, device storage, OTA, provisioning, Wi-Fi management, build configuration, partitions, README, and test plan.
- **Legacy Hardware (`hardware/`)**: Out of production scope except as a legacy reference that must not override ESP-IDF runtime expectations.
- **AI (`ai/`, `backend/app/ai/`)**: Backend inference contract consumes firmware sample windows; model training and checkpoint management remain outside the firmware image.
- **Infrastructure (`docker-compose.yml`, `terraform/`)**: Backend host, certificate, and deployed service availability must align with firmware runtime configuration.
- **Documentation**: Firmware README, firmware test plan, setup documentation, and device registration notes must match the runtime workflow.

### API Requirements *(include if backend/frontend/firmware contract changes)*

- **Endpoint(s)**: Firmware consumes `GET /api/v1/devices/{serial_number}/status`, `POST /api/v1/inference/classify`, and `POST /api/v1/devices/{serial_number}/events` for firmware-observed operational events; local provisioning exposes `/status`, `/scan`, and `/configure` while setup mode is active.
- **Authentication**: Classification submissions use a device bearer token. Device status polling uses the existing firmware-facing status contract. Local provisioning is only available while provisioning mode is active; local `/configure` is unauthenticated in the pilot flow, while `/status` and `/scan` remain unauthenticated and must not return secrets.
- **Authorization**: Backend device authentication must constrain classification submissions to the authenticated serial identity.
- **Request Payload**: Classification payload contains the serial number and exactly 512 raw ESP32 12-bit ADC integer readings in the range `0..4095`, collected as one sample window.
- **Response Payload**: Status responses provide enough lifecycle and operational state for the device to sample only when status is `available` and choose the mapped LED pattern for every other status. Missing, stale, malformed, or otherwise unusable status data is treated as a fail-closed polling failure. Classification responses provide the label and confidence needed by backend assistance workflow behavior.
- **Backward Compatibility**: Active ESP-IDF firmware supersedes legacy MicroPython behavior while legacy files remain available for reference.

### Database Requirements *(include if persisted data changes)*

- **Schema Target**: Existing v2 device lifecycle schema.
- **Entities/Tables**: Device records include serial number, lifecycle status, operational status, token hash/salt, and firmware metadata needed for runtime authentication and status behavior.
- **Migration Behavior**: No destructive data migration is implied by this specification; device records must be pre-created or migrated before firmware can authenticate classification submissions.
- **Indexes/Constraints/Enums**: Device lifecycle and operational statuses must map to firmware runtime decisions and LED status behavior.
- **Rollback/Recovery**: Device runtime must tolerate backend/database unavailability; database rollback behavior is outside the firmware runtime scope.

### Device/Firmware Requirements *(include if firmware or device-facing API changes)*

- **Runtime Target**: ESP-IDF firmware under `firmware/`.
- **Device Identity/Auth**: Serial number and device token are read from persistent device storage and used for backend runtime calls.
- **Provisioning/Wi-Fi**: Local provisioning handles missing or failed Wi-Fi credentials, scans available networks, accepts `/configure` with Wi-Fi details only, stores valid credentials, reconnects as a station, and falls back after retry exhaustion.
- **Telemetry/API Payloads**: Runtime status polling permits collection and submission of a 512-value gesture sample window only when backend status is `available`; each sample value is a raw ESP32 12-bit ADC integer in the range `0..4095`.
- **Reliability**: Runtime behavior includes fail-closed status polling behavior, bounded retries, watchdog-safe work, non-blocking LED status patterns, Wi-Fi fallback, certificate-aware backend communication, and OTA image validity after the first successful HTTPS device status response.

### AI/Inference Requirements *(include if model or inference changes)*

- **Input Contract**: Firmware sends raw photoresistor sample windows with exactly 512 ESP32 12-bit ADC integer readings in the range `0..4095`.
- **Output Contract**: Backend classification returns label and confidence values that influence assistance workflow state outside the firmware image.
- **Checkpoint Impact**: Firmware image changes do not require model checkpoint changes, but backend and AI checkpoints must remain compatible with the 512-sample input contract.
- **Training/Validation**: Firmware validation covers transport, identity, and payload shape; model accuracy and training quality remain separate AI concerns.

### Key Entities *(include if feature involves data)*

- **Device Identity**: Registered serial number and bearer token used to authenticate runtime submissions and associate them with one physical device.
- **Provisioning Credentials**: Wi-Fi SSID and password stored on the device after installer setup.
- **Provisioning Request**: Wi-Fi SSID plus optional password submitted to local `/configure` during provisioning mode.
- **Device Status**: Backend lifecycle and operational state where only `available` permits sampling; every other status pauses sampling and maps to LED behavior. Missing, stale, malformed, or unusable status data fails closed with error/offline LED behavior and bounded retry.
- **Sample Batch**: One 512-value photoresistor reading window submitted for classification, where every value is a raw ESP32 12-bit ADC integer in the range `0..4095`.
- **OTA Image State**: Boot validity state used to keep or roll back newly delivered firmware, marked valid only after the first successful HTTPS device status response for the device serial number.

## Security & Privacy Requirements *(mandatory when auth, device data, org data, or external input is involved)*

- Device bearer tokens MUST be treated as secrets on the device and in backend storage.
- Classification submissions MUST include device authentication and MUST be rejected when the authenticated device does not match the submitted serial identity.
- Device-authenticated classification MUST reject missing, malformed, invalid, revoked, expired, and wrong-serial device credentials without running model inference.
- Provisioning responses MUST NOT expose saved Wi-Fi passwords or device bearer tokens.
- Provisioning `/configure` MUST reject Wi-Fi credential submissions that omit the SSID or provide malformed JSON.
- Provisioning mode MUST only expose setup behavior while the device is intentionally in local setup/fallback mode.
- Backend and OTA communication MUST use the configured certificate trust path for the target deployment.
- Runtime failures involving authentication, provisioning payloads, certificate validation, or backend connectivity MUST produce diagnosable status without leaking secrets.

### Accessibility Requirements

- Frontend provisioning inputs MUST have accessible labels and hints that describe the expected Wi-Fi values without exposing secrets.
- Provisioning errors MUST be announced to screen readers and focus MUST move to the invalid field or actionable error area after validation failure.
- Provisioning buttons and status indicators MUST expose disabled, loading, success, and error states semantically and MUST NOT rely on color alone.
- Documentation and UI copy SHOULD use accessible parking terminology and MUST NOT imply that dynamic device status establishes legal accessibility compliance.

### Observability And Operations Requirements

- Firmware and backend logs MUST use structured, secret-safe fields for provisioning attempts, token failures, status polling failures and recoveries, classify submissions, wave detections, certificate failures, and OTA validation.
- Backend MUST create or preserve device-event records for backend-observed wave detection, authentication failure threshold exceeded, and firmware version observation.
- Firmware MUST report firmware-observed status failure and recovery, OTA validation, and successful provisioning summaries through the authenticated firmware event-reporting contract when backend connectivity permits upload, and backend MUST store those reports as secret-safe `device_events`.
- Metrics definitions MUST include counters or timers for status poll failures, status recoveries, classify submissions, auth failures, OTA validation, and provisioning success.
- Operator recovery docs MUST identify firmware serial logs for pre-connect failures and backend logs/device event history for connected-device failures.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A field installer can provision a freshly erased device onto Wi-Fi and observe backend reachability within 5 minutes using documented setup steps.
- **SC-002**: During validation, 100% of classification submissions made while sampling is allowed contain the registered serial identity and exactly 512 raw ESP32 12-bit ADC integer samples in the range `0..4095`.
- **SC-003**: During a 10-minute non-available status test, the device submits zero new classification sample windows and continues showing the mapped LED status.
- **SC-004**: After Wi-Fi retry exhaustion in validation testing, the device enters provisioning fallback within one configured retry cycle without a manual firmware reinstall.
- **SC-005**: A newly booted OTA image is marked valid only after the first successful HTTPS `GET /api/v1/devices/{serial_number}/status` response in validation testing.
- **SC-006**: During provisioning validation, `/configure` rejects credential submissions without an SSID and never returns stored Wi-Fi passwords or device bearer tokens.
- **SC-007**: During status polling failure validation, missing, stale, malformed, and unreachable status responses produce zero classification submissions, show the configured error/offline LED state, and retry with bounded backoff.
- **SC-008**: Firmware validation covers provisioning, sampling/classification submission, backend unavailable behavior, Wi-Fi failure fallback, LED status mapping, certificate/backend URL failure, and OTA validity scenarios.
- **SC-009**: During provisioning validation, malformed or incomplete `/configure` requests do not save Wi-Fi credentials and return usable error responses.
- **SC-010**: During frontend provisioning validation, Wi-Fi inputs and errors are reachable and understandable through screen-reader semantics, keyboard/focus behavior where applicable, and non-color-only visual indicators.
- **SC-011**: During runtime validation, backend logs or device event history show backend-observed wave detection, auth failure threshold exceeded, and observed firmware version plus firmware-reported status failure/recovery, OTA validation, and provisioning success without exposing device tokens or Wi-Fi passwords.

## Assumptions

- Target hardware is ESP32-WROOM-32 with the photoresistor connected to GPIO 34 / ADC1 channel 6 and status LED behavior available to the runtime.
- Backend base URL and certificate trust configuration are selected per deployment environment before production flashing.
- Device rows and device tokens are registered before authenticated classification submissions are expected to succeed.
- The existing backend status and classification contracts remain the integration surface for firmware runtime behavior.
- ESP-IDF build and flash tooling is available for validation after this specification advances to planning and tasks.

## Out Of Scope

- Updating legacy MicroPython behavior under `hardware/`.
- Changing model architecture, training data generation, or checkpoint promotion rules.
- Redesigning staff-facing mobile monitoring workflows beyond current provisioning touchpoints.
- Changing organization membership, notification, site, or parking-space workflows except where existing status contracts are consumed by firmware.
- Implementing production code as part of this specification artifact. Planning, task generation, and later implementation remain separate Spec Kit workflow stages.
