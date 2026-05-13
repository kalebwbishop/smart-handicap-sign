---
status: migrated
created: 2026-05-12
source: brownfield-migrate
artifact_scope: spec-only
---

# Feature Specification: Wave Inference And Debug History

**Feature Branch**: `N/A - migrated from existing code`  
**Created**: 2026-05-12  
**Status**: Migrated  
**Input**: Brownfield migration of implemented wave classification and debug tooling.

## Summary

Hazard Hero classifies 512-sample photoresistor windows from devices using an embedded PyTorch `WaveDetector` model. Authenticated devices submit telemetry to the backend; a wave result updates the device operational status to `assistance_requested`, creates device events, and can notify organization users. Authenticated staff can inspect recent inference history and the latest signal graph for debugging.

## User Scenarios & Testing

### User Story 1 - Device Classifies A Signal (Priority: P1)

An ESP32 device submits ADC samples and receives a wave/non-wave classification.

**Why this priority**: Classification is the core detection mechanism for assistance requests.

**Independent Test**: Call `POST /api/v1/inference/classify` with device bearer credentials and exactly 512 samples.

**Acceptance Scenarios**:

1. **Given** valid device credentials and 512 ADC samples, **When** the device submits the payload, **Then** the API returns a label and confidence.
2. **Given** a device attempts to submit telemetry for a different serial, **When** classification is requested, **Then** the API returns 403.

### User Story 2 - Wave Requests Assistance (Priority: P1)

A positive wave classification moves the associated device into assistance requested state and records an event.

**Why this priority**: The physical gesture must translate into a staff-visible service request.

**Independent Test**: Mock classifier output to `wave` and assert device status and event/notification behavior.

**Acceptance Scenarios**:

1. **Given** an active available device, **When** a submitted signal is classified as wave, **Then** the device operational status becomes `assistance_requested`.
2. **Given** downstream event or notification creation fails, **When** classification completes, **Then** the classification response is still returned and the failure is logged.

### User Story 3 - Staff Debug Recent Inference (Priority: P2)

An authenticated staff user views recent inference history or a graph of the latest samples.

**Why this priority**: Debug history helps diagnose model, sensor, and deployment behavior.

**Independent Test**: Call `GET /api/v1/inference/history` and `GET /api/v1/inference/latest-graph` as authenticated and anonymous users.

**Acceptance Scenarios**:

1. **Given** recent inference submissions, **When** staff request history, **Then** the API returns recent entries newest first.
2. **Given** no matching inference entries, **When** staff request the latest graph, **Then** the API returns 204 with an empty body.

### Edge Cases

- Missing, malformed, or wrong device bearer token.
- Sample arrays shorter or longer than 512 values.
- Sample values outside the classifier's supported range.
- Debug graph requested on constrained environments.
- In-memory history reset after process restart.

## Requirements

### Functional Requirements

- **FR-001**: System MUST require device authentication for classification submissions.
- **FR-002**: System MUST accept exactly 512 integer samples per classification request.
- **FR-003**: System MUST use a server-side wave threshold and reject user-controlled thresholds.
- **FR-004**: System MUST ensure a device can only submit telemetry for its own serial number.
- **FR-005**: System MUST return classification label and confidence for valid requests.
- **FR-006**: System MUST update device operational status to `assistance_requested` when a wave is detected.
- **FR-007**: System MUST create a device event and notification intent for positive wave detections when possible.
- **FR-008**: System MUST keep a bounded in-memory debug history of recent inference requests.
- **FR-009**: System MUST restrict history and latest-graph endpoints to authenticated users.

### Affected Modules

- **Backend (`backend/`)**: `routes/inference.py`, `middleware/device_auth.py`, `services/device_service.py`, `app/ai/infer.py`, `app/ai/model.py`.
- **Frontend (`frontend/`)**: `InferenceDebugScreen`.
- **Database (`database/`)**: `devices`, `device_events`, and notification-related records in v2 schema.
- **Firmware (`firmware/`)**: `adc_sampler`, `https_client`, and main loop submit samples and consume status.
- **Legacy Hardware (`hardware/`)**: Legacy MicroPython may use the same classify contract but is not active.
- **AI (`ai/`, `backend/app/ai/`)**: `WaveDetector`, `WaveClassifier`, training data, checkpoint, and AI tests.
- **Infrastructure**: N/A.
- **Documentation**: Firmware docs describe sample size, endpoint, and ADC constraints.

### API Requirements

- **Endpoint(s)**: `POST /api/v1/inference/classify`, `GET /api/v1/inference/history`, `GET /api/v1/inference/latest-graph`.
- **Authentication**: Classification uses device bearer token in `Authorization: Bearer <serial>:<token>`. Debug endpoints use WorkOS user auth.
- **Authorization**: Device submissions are constrained to the authenticated serial. Debug endpoints are available to authenticated users; organization scoping is not evident in the current in-memory history implementation.
- **Request Payload**: Classification accepts optional deprecated `sign_id`, optional `serial_number`, and required `samples` list of length 512.
- **Response Payload**: Classification returns `label`, `confidence`, and optional base64 `debug_graph`; graph endpoint returns PNG bytes or 204.
- **Backward Compatibility**: `sign_id` remains accepted as deprecated input but device serial is the v2 path.

### Database Requirements

- **Schema Target**: v2 device lifecycle schema with legacy compatibility.
- **Entities/Tables**: `devices`, `device_events`, `notifications`, `push_tokens` indirectly through notification creation.
- **Migration Behavior**: No schema changes are part of this migrated feature.
- **Indexes/Constraints/Enums**: Operational statuses include `available`, `assistance_requested`, and `assistance_in_progress` behavior.
- **Rollback/Recovery**: Debug history is in-memory and not recovered after restart.

### Device/Firmware Requirements

- **Runtime Target**: ESP-IDF `firmware/`.
- **Device Identity/Auth**: Device token and serial must be present for classify submissions.
- **Provisioning/Wi-Fi**: Firmware must have network connectivity and backend URL configuration.
- **Telemetry/API Payloads**: Firmware sends `serial_number` and exactly 512 ADC samples.
- **Reliability**: Device should continue polling and retrying according to firmware policy when backend calls fail.

### AI/Inference Requirements

- **Input Contract**: 512 samples. Firmware documentation states 12-bit ADC values in range `0..4095`; AI code historically normalizes against a larger range.
- **Output Contract**: Binary label and confidence.
- **Checkpoint Impact**: Backend embedded checkpoint and root AI checkpoint must remain compatible.
- **Training/Validation**: AI tests cover model shape, generators, training helpers, and classifier input validation.

### Key Entities

- **Inference Submission**: Device-authenticated sample window with serial number, label, confidence, and timestamp.
- **WaveDetector**: PyTorch 1D CNN used to classify sample windows.
- **Device Event**: Status/event record created when a wave requests assistance.

## Security & Privacy Requirements

- Classification MUST reject anonymous submissions and wrong-serial submissions.
- Threshold values MUST remain server-controlled.
- Debug data can expose device serials and sensor readings and MUST require user authentication.
- Device token validation MUST use constant-time comparison.

## Success Criteria

### Measurable Outcomes

- **SC-001**: A valid device receives a label/confidence for a 512-sample submission.
- **SC-002**: Positive wave classification updates operational status and records a device event.
- **SC-003**: Anonymous users cannot access inference debug history or graphs.

## Assumptions

- Firmware sends raw ESP32 ADC samples rather than preprocessed model tensors.
- The in-memory debug ring buffer is acceptable for local/debug use.
- The backend model checkpoint exists in the expected backend AI checkpoint location.

## Gaps And Risks

- The AI normalization range and firmware ADC value range appear mismatched and should be tracked separately.
- Debug history is not organization scoped and is process-local.
- Frontend coverage for `InferenceDebugScreen` was not found in the migration scan.

## Out Of Scope

- Retraining the model or changing checkpoint files.
- Persisting inference history.
- Adding plan/task artifacts or implementation changes.