---
status: migrated
created: 2026-05-12
source: brownfield-migrate
artifact_scope: spec-only
---

# Feature Specification: ESP-IDF Firmware Runtime

**Feature Branch**: `N/A - migrated from existing code`  
**Created**: 2026-05-12  
**Status**: Migrated  
**Input**: Brownfield migration of implemented ESP-IDF firmware runtime.

## Summary

Hazard Hero includes active ESP-IDF firmware for an ESP32-WROOM-32 controller. The firmware stores identity and Wi-Fi data in NVS, exposes SoftAP provisioning when needed, samples a photoresistor, calls backend status and inference endpoints over HTTPS, drives LED status patterns, and includes OTA infrastructure.

## User Scenarios & Testing

### User Story 1 - Provision Device Connectivity (Priority: P1)

A field installer powers a device and provisions Wi-Fi credentials through SoftAP fallback when saved credentials are absent or invalid.

**Why this priority**: Devices cannot report gestures or poll status until they can connect to a network.

**Independent Test**: Build/flash firmware, erase Wi-Fi NVS, boot device, and verify `/status`, `/scan`, and `/configure` provisioning endpoints.

**Acceptance Scenarios**:

1. **Given** no saved Wi-Fi credentials, **When** the device boots, **Then** it starts SoftAP provisioning mode.
2. **Given** valid Wi-Fi credentials submitted to `/configure`, **When** the device stores them, **Then** it reconnects as a station and exits provisioning mode.

### User Story 2 - Detect And Submit Gestures (Priority: P1)

An active device samples the photoresistor and submits 512 ADC samples to the backend classifier.

**Why this priority**: Gesture detection is the device's primary runtime purpose.

**Independent Test**: With valid serial/token NVS values and backend URL, observe status polling and classify POST payloads.

**Acceptance Scenarios**:

1. **Given** backend status `available`, **When** the main loop runs, **Then** firmware samples 512 values at the configured interval and submits them to `/inference/classify`.
2. **Given** backend status is not available, **When** the main loop runs, **Then** firmware mirrors status on the LED and does not submit a new sample window.

### User Story 3 - Maintain Runtime Resilience (Priority: P2)

The device handles Wi-Fi failures, backend failures, LED status, and OTA validity without blocking normal operation indefinitely.

**Why this priority**: Devices are deployed unattended and need deterministic recovery behavior.

**Independent Test**: Use firmware test plan scenarios for Wi-Fi retry, backend failure, LED patterns, and OTA boot validity.

**Acceptance Scenarios**:

1. **Given** repeated Wi-Fi reconnect failures, **When** retry exhaustion occurs, **Then** firmware falls back to SoftAP provisioning.
2. **Given** a newly booted OTA image and successful backend connectivity, **When** connectivity is confirmed, **Then** firmware marks the OTA image valid.

### Edge Cases

- Missing serial number in NVS.
- Missing device token causing classify authentication failure.
- Invalid Wi-Fi credentials or networks with poor signal.
- Backend URL/certificate mismatch.
- Watchdog timing during sampling or network retries.
- OTA image rollback if not marked valid.

## Requirements

### Functional Requirements

- **FR-001**: Firmware MUST target ESP-IDF in `firmware/`, not legacy MicroPython in `hardware/`.
- **FR-002**: Firmware MUST persist serial number, auth token, and Wi-Fi credentials in NVS.
- **FR-003**: Firmware MUST start SoftAP provisioning when Wi-Fi credentials are missing or reconnect retries are exhausted.
- **FR-004**: Firmware MUST expose provisioning endpoints for status, scan, and configure behavior.
- **FR-005**: Firmware MUST sample GPIO 34 / ADC1 channel 6 using 512 samples at the configured interval.
- **FR-006**: Firmware MUST call backend status and classify endpoints using the configured backend URL.
- **FR-007**: Firmware MUST drive non-blocking LED patterns for backend/device statuses.
- **FR-008**: Firmware MUST initialize OTA support and mark valid images after successful backend connectivity.
- **FR-009**: Firmware MUST use the embedded CA/certificate configuration for HTTPS and OTA behavior.

### Affected Modules

- **Backend (`backend/`)**: Device status and inference endpoints are firmware-facing contracts.
- **Frontend (`frontend/`)**: `WiFiSetupScreen`, `SetupGuideScreen`, and `espApi.ts` interact with provisioning behavior.
- **Database (`database/`)**: Device serial/token/lifecycle records must exist for authenticated runtime calls.
- **Firmware (`firmware/`)**: `main.c`, `adc_sampler`, `https_client`, `led_driver`, `nvs_storage`, `ota_update`, `provisioning_server`, `wifi_manager`, `CMakeLists.txt`, `partitions.csv`, `README.md`, and `TEST_PLAN.md`.
- **Legacy Hardware (`hardware/`)**: Legacy MicroPython runtime is not the active implementation.
- **AI (`ai/`, `backend/app/ai/`)**: Classify contract depends on model input requirements but firmware does not run AI locally.
- **Infrastructure**: Backend URL, certificates, and deployment host must align with firmware build settings.
- **Documentation**: Firmware README and test plan are primary references.

### API Requirements

- **Endpoint(s)**: Firmware consumes `GET /api/v1/devices/{serial_number}/status` and `POST /api/v1/inference/classify`; provisioning SoftAP exposes local `/status`, `/scan`, and `/configure`.
- **Authentication**: Backend classify uses device bearer credentials. Status endpoint is currently unauthenticated. Local provisioning endpoint auth was not evident from the migration scan.
- **Authorization**: Backend device auth constrains classify submissions to the authenticated serial.
- **Request Payload**: Classify payload includes serial number and exactly 512 ADC sample integers.
- **Response Payload**: Status response includes status/lifecycle/operational fields. Classify response includes label and confidence.
- **Backward Compatibility**: Active firmware replaces legacy MicroPython but legacy files remain in `hardware/`.

### Database Requirements

- **Schema Target**: v2 device lifecycle schema.
- **Entities/Tables**: `devices` with serial number, lifecycle status, operational status, token hash/salt, firmware metadata.
- **Migration Behavior**: Device rows must be pre-created or migrated before firmware can authenticate classification.
- **Indexes/Constraints/Enums**: Device statuses must map to firmware LED/status behavior.
- **Rollback/Recovery**: OTA partitions support rollback; database rollback is not part of firmware runtime.

### Device/Firmware Requirements

- **Runtime Target**: ESP-IDF 5.4+ under `firmware/`.
- **Device Identity/Auth**: Serial and token are read from NVS; missing serial blocks normal runtime.
- **Provisioning/Wi-Fi**: SoftAP provisioning handles missing/failed Wi-Fi and persists credentials.
- **Telemetry/API Payloads**: 512 raw ADC samples are sent to backend classify.
- **Reliability**: Watchdog, retry limits, status LED, Wi-Fi fallback, and OTA valid marking are required.

### AI/Inference Requirements

- **Input Contract**: Firmware sends 12-bit ADC values from the photoresistor.
- **Output Contract**: Firmware receives classification label/confidence indirectly affecting backend operational state.
- **Checkpoint Impact**: N/A for firmware image.
- **Training/Validation**: Firmware test plan should cover transport and payload behavior, not model accuracy.

### Key Entities

- **Device Identity**: Serial number and auth token stored in NVS and registered in backend database.
- **Provisioning Credentials**: Wi-Fi SSID/password stored in NVS.
- **Sample Batch**: 512 ADC readings collected from photoresistor input.

## Security & Privacy Requirements

- Device auth tokens MUST be treated as secrets in NVS and backend storage.
- HTTPS certificate configuration MUST match deployment expectations before production use.
- Provisioning endpoints SHOULD avoid exposing secrets and should only run during provisioning mode.
- Backend classify calls MUST include the device bearer credential.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Fresh firmware can be provisioned onto Wi-Fi and reach the backend.
- **SC-002**: Available devices submit 512-sample classify payloads using stored serial/token identity.
- **SC-003**: Wi-Fi failure triggers bounded retries and SoftAP fallback.

## Assumptions

- Target hardware is ESP32-WROOM-32 with photoresistor on GPIO 34 and LED on GPIO 2.
- Backend base URL and CA are configured at build/deployment time.
- ESP-IDF tooling is available for build validation.

## Gaps And Risks

- Firmware build validation was not run as part of spec-only migration.
- Production provisioning auth/hardening may need additional review.
- Certificate/common-name behavior and dev tunnel settings require deployment-specific validation.

## Out Of Scope

- Editing firmware code or Kconfig surfaces.
- Updating legacy MicroPython runtime.
- Adding plan/task artifacts or hardware test automation.