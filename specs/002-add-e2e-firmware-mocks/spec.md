# Feature Specification: Add E2E Firmware Mocks

**Feature Branch**: `002-add-e2e-firmware-mocks`  
**Created**: 2026-05-13  
**Status**: Draft  
**Input**: User description: "I want to make an E2E testing script, it should be able to mock the firmware requests"

## Summary

Provide an end-to-end testing capability for Hazard Hero that lets developers and QA verify the device-to-staff assistance workflow without a physical ESP32. The test run must simulate representative firmware requests, drive the expected sign status outcomes, and produce clear pass/fail diagnostics while keeping test data isolated from production or operator data.

Affected Hazard Hero areas are backend behavior under test, API-level staff-observable status verification, firmware request contract simulation, AI inference contract inputs, test data handling, and documentation for running the script safely.

## Clarifications

### Session 2026-05-13

- Q: What E2E boundary should the firmware mock testing use? → A: Real backend HTTP API with dedicated test data.
- Q: How should the E2E script handle dirty dedicated test state? → A: Auto-reset dedicated test records before and after scenarios.
- Q: How should the script prove staff-facing status changed? → A: Verify existing backend API status responses.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Verify Assistance Workflow Without Hardware (Priority: P1)

A developer or QA tester runs one automated end-to-end scenario that behaves like a deployed sign device detecting a wave, then verifies that staff-facing status reflects an assistance request.

**Why this priority**: This is the core value of the feature: validating the most important device-triggered workflow without requiring a physical ESP32, sensor, or manual hardware setup.

**Independent Test**: Run the E2E script against the real backend HTTP API in a prepared local or test environment with a dedicated test sign/device. The script simulates a wave-classification firmware request and verifies through existing backend API status responses that the sign status visible to staff changes to assistance requested.

**Acceptance Scenarios**:

1. **Given** a dedicated test sign is available, **When** the E2E script runs the simulated wave scenario, **Then** the sign transitions from available to assistance requested and the existing backend API status response reflects the staff-observable request.
2. **Given** the simulated wave scenario completes, **When** the final report is shown, **Then** it identifies the scenario as passed and includes the verified starting state, final state, and elapsed time.
3. **Given** the test sign starts in a non-available state, **When** the E2E script begins, **Then** it resets only the dedicated test records to a safe test state before running required scenarios.

---

### User Story 2 - Validate Firmware Request Compatibility (Priority: P2)

A developer uses the same E2E capability to confirm that mocked firmware traffic still follows the active firmware request contract for status polling and inference classification.

**Why this priority**: Mocked requests only protect the product if they remain faithful to deployed firmware behavior; this catches contract drift before a real device or release cycle exposes it.

**Independent Test**: Run firmware-request scenarios that include both wave and non-wave sample data, device identity/authentication, and expected request payload shape. Confirm the system accepts valid simulated traffic and rejects unsafe or malformed traffic.

**Acceptance Scenarios**:

1. **Given** valid dedicated test device credentials, **When** the script sends simulated firmware status and inference requests, **Then** the system accepts the requests and records or exposes the expected outcomes.
2. **Given** simulated non-wave sensor data, **When** the E2E script submits the classification request, **Then** no assistance request is created for the test sign.
3. **Given** a simulated firmware request is missing required identity or payload data, **When** the script sends the request, **Then** the system rejects it and the report clearly labels the failure as expected negative coverage.

---

### User Story 3 - Diagnose E2E Failures Quickly (Priority: P3)

A developer or QA tester can understand why an E2E run failed without inspecting multiple logs or manually reconstructing the firmware workflow.

**Why this priority**: E2E tests are useful only when failures are actionable; clear diagnostics keep the test from becoming a noisy or ignored gate.

**Independent Test**: Force a missing configuration, unavailable backend, invalid device token, or unexpected status transition and confirm the script exits with a non-success result and a concise failure summary.

**Acceptance Scenarios**:

1. **Given** required test configuration is missing, **When** the script starts, **Then** it stops before sending requests and lists the missing values with safe remediation guidance.
2. **Given** the target environment is unavailable, **When** the script attempts to run, **Then** it reports the unavailable dependency, marks affected scenarios as failed or skipped, and exits with a non-success result.
3. **Given** an expected status transition does not occur, **When** the script finishes, **Then** the report includes the expected state, observed state, scenario name, and request step where verification failed.

### Edge Cases

- Mocked firmware request uses an invalid, expired, missing, or wrong-organization device credential.
- Mocked request targets a sign/device that does not exist, is deleted, or is not assigned to the test organization.
- Duplicate wave submissions arrive for a sign that already has assistance requested.
- Non-wave sample data is incorrectly classified or incorrectly changes sign status.
- The target environment is offline, slow, returns an unexpected error, or becomes unavailable mid-run.
- Required test data already exists in a dirty state from a previous failed run and must be reset only if it is clearly marked as dedicated test data.
- The script is accidentally pointed at a production-like environment or credentials that are not marked for testing.
- Request payload contains malformed sample data, the wrong sample count, unsupported values, or stale status information.
- Staff-facing status does not update within the expected verification window after backend state changes.
- Generated test data or events remain after a failed or interrupted run.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Developers and QA testers MUST be able to start a single end-to-end test run that verifies the firmware-triggered assistance workflow without a physical device.
- **FR-002**: The test run MUST simulate firmware status polling and inference classification requests by sending real HTTP requests to the backend API with representative identity, authentication, payload shape, and timing expectations for the active device contract.
- **FR-003**: The test run MUST include a wave scenario that verifies a dedicated available test sign becomes assistance requested and that existing backend API status responses reflect the staff-observable request.
- **FR-004**: The test run MUST include a non-wave scenario that verifies simulated firmware traffic does not create an assistance request when no wave is detected.
- **FR-005**: The test run MUST include negative coverage for at least one invalid firmware request, such as missing credentials, malformed payload data, or an unauthorized device/sign pairing.
- **FR-006**: The script MUST prevent accidental modification of production or non-test data by requiring clearly identified test configuration before sending mocked firmware traffic.
- **FR-007**: The script MUST make repeated local/test runs safe by automatically resetting only dedicated test records before and after required scenarios.
- **FR-008**: The script MUST report each scenario result with the scenario name, pass/fail/skip status, expected state, observed state, elapsed time, and failing step when applicable.
- **FR-009**: The script MUST exit with a success result only when all required scenarios pass; any failed required scenario MUST produce a non-success result.
- **FR-010**: Documentation MUST explain how to prepare safe test data, configure the target environment, run the E2E script, and interpret failures.

### Affected Modules *(mandatory)*

- **Backend (`backend/`)**: Existing device-facing inference/status behavior is under test through real HTTP API requests; test support may need dedicated fixtures or safe reset behavior, but no product route behavior is expected to change.
- **Frontend (`frontend/`)**: N/A for the initial E2E run; no user interface automation or app changes are expected.
- **Database (`database/`)**: Dedicated test records and cleanup/reset expectations may be used; no schema migration is expected.
- **Firmware (`firmware/`)**: The active ESP-IDF request contract is simulated by the E2E capability; no firmware runtime changes are expected.
- **Legacy Hardware (`hardware/`)**: N/A unless legacy MicroPython request compatibility is explicitly added later.
- **AI (`ai/`, `backend/app/ai/`)**: Inference input/output behavior is exercised with deterministic wave and non-wave sample data; no training or checkpoint changes are expected.
- **Infrastructure (`docker-compose.yml`, `terraform/`)**: Local/test runtime configuration may be referenced by documentation; no deployment changes are expected.
- **Documentation**: E2E run instructions, test data safety guidance, and troubleshooting notes must be added or updated.

### Device/Firmware Requirements *(include if firmware or device-facing API changes)*

- **Runtime Target**: Mocked traffic must represent the active ESP-IDF firmware request contract. Legacy MicroPython behavior is outside the initial target.
- **Device Identity/Auth**: Simulated requests must use dedicated test device identity and credentials, and reports must not reveal secret values.
- **Provisioning/Wi-Fi**: Provisioning and Wi-Fi setup behavior are not part of the initial E2E run.
- **Telemetry/API Payloads**: The script must simulate status polling and inference classification payloads with representative wave and non-wave sensor samples.
- **Reliability**: The E2E scenarios must account for duplicate submissions, backend unavailability, and retry-safe state handling at the workflow level.

### AI/Inference Requirements *(include if model or inference changes)*

- **Input Contract**: Simulated inference requests must use the existing expected sample count and numeric value boundaries for firmware sensor data.
- **Output Contract**: The E2E run must verify whether simulated wave and non-wave inputs produce the expected workflow outcomes.
- **Checkpoint Impact**: No model checkpoint change is expected.
- **Training/Validation**: No model training behavior is in scope; deterministic samples are used only to exercise the E2E workflow.

### Key Entities *(include if feature involves data)*

- **E2E Test Run**: A single execution of the automated scenarios, including target environment, start/end time, scenario results, and final outcome.
- **Simulated Firmware Request**: A mocked request that represents active firmware traffic, including device identity, target sign, payload, and expected outcome.
- **Dedicated Test Sign**: A sign reserved for automated validation, reset to a known state before scenarios and restored or cleaned afterward.
- **Scenario Result**: The pass/fail/skip record for one E2E scenario, including expected state, observed state, elapsed time, and diagnostics.

## Security & Privacy Requirements *(mandatory when auth, device data, org data, or external input is involved)*

- The script must use only dedicated test device credentials and must not print full tokens, secrets, WorkOS identifiers, or sensitive device credentials in output.
- The script must verify that the target environment and test records are safe for automated mutation before sending mocked firmware requests.
- Invalid or unauthorized firmware request scenarios must be covered to preserve device ownership and organization access boundaries.
- Test-generated events, notifications, and status changes must be clearly attributable to an automated test run where observable.
- The script must avoid sending real push notifications or operator alerts outside the dedicated test scope.
- Any saved run artifacts must avoid storing raw secrets and must be safe to attach to issue reports.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A developer or QA tester can complete the primary wave E2E scenario against a prepared local/test environment in under 5 minutes without using an ESP32.
- **SC-002**: 100% of required scenarios report pass/fail/skip status, expected state, observed state, elapsed time, and failed step when applicable.
- **SC-003**: The wave scenario verifies the transition from available to assistance requested and the staff-observable backend API status response within 10 seconds in at least 95% of local/test runs.
- **SC-004**: The non-wave scenario completes without creating an assistance request in 100% of local/test runs.
- **SC-005**: The invalid-request scenario confirms unauthorized or malformed mocked firmware traffic is rejected in 100% of local/test runs.
- **SC-006**: Successful and failed runs leave dedicated test data in a reusable state through automatic reset before and after scenarios, with no production or non-test records modified.

## Assumptions

- The initial audience is developers and QA testers running against local or dedicated test environments.
- Existing product behavior already supports firmware-driven inference and staff-observable sign status; this feature validates that behavior rather than changing it.
- Dedicated test organization, sign, and device credentials can be provisioned or configured before running the script.
- Deterministic wave and non-wave sensor samples are acceptable for E2E workflow validation.
- Physical firmware, provisioning, Wi-Fi behavior, and hardware sensor timing are covered by separate firmware validation.

## Out Of Scope

- Changing the staff app user interface or sign workflow behavior.
- Verifying the staff app through frontend UI automation in the initial E2E script.
- Changing firmware runtime code, provisioning flows, OTA behavior, LED behavior, or watchdog behavior.
- Training, replacing, or tuning the AI model.
- Adding database schema changes solely for the E2E script.
- Production load testing, long-running reliability testing, or mobile device farm coverage.
- Legacy MicroPython request emulation unless explicitly requested in a later feature.
