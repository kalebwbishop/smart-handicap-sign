# Tasks: ESP-IDF Firmware Runtime

**Input**: Design documents from `/specs/001-esp-idf-firmware-runtime/`  
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/backend-device-api.md`, `contracts/local-provisioning-api.md`, `quickstart.md`

**Tests**: Required. The specification marks user scenarios and testing as mandatory, and this feature touches firmware behavior, device authentication, database schema, backend contracts, local provisioning input, frontend provisioning flows, status state modeling, and observability.

**Organization**: Tasks are grouped by phase and user story so each story remains independently implementable and testable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it touches different files and has no dependency on another unfinished task.
- **[Story]**: User story label such as `US1`, `US2`, `US3`; omitted only for setup/foundation/polish/validation tasks.
- Every task includes exact repository-relative paths.

## Phase 1: Setup And Baseline

**Purpose**: Confirm current behavior and affected module boundaries before changing code.

- [X] T001 Confirm feature inputs, priorities, and module boundaries in `specs/001-esp-idf-firmware-runtime/plan.md` and `specs/001-esp-idf-firmware-runtime/spec.md`
- [X] T002 [P] Capture current ESP-IDF provisioning, status, classify, identity, reset, and OTA behavior from `firmware/main/main.c`, `firmware/main/provisioning_server.c`, `firmware/main/https_client.c`, and `firmware/main/nvs_storage.c`
- [X] T003 [P] Capture current backend device status, inference, device auth, firmware version handling, and device event behavior from `backend/app/routes/devices.py`, `backend/app/routes/inference.py`, `backend/app/middleware/device_auth.py`, and `backend/app/services/device_service.py`
- [X] T004 [P] Capture current v2 device schema gap for `devices.operational_status` in `database/schemas/shs_schema_v2.sql`, `database/seeds/dev_data_v2.sql`, and `database/scripts/migrate_v2.ts`
- [X] T005 [P] Capture current local provisioning client behavior in `frontend/src/api/espApi.ts`, `frontend/src/screens/SetupGuideScreen.tsx`, and `frontend/src/screens/WiFiSetupScreen.tsx`
- [X] T006 [P] Capture current firmware validation coverage for provisioning, status matrix, field reset, firmware versions, device events, and OTA in `firmware/TEST_PLAN.md`

---

## Phase 2: Foundational Contracts And Data

**Purpose**: Define shared contracts and persisted data that block user-story work.

**Critical**: No user story implementation should begin until required schema, auth, status, event, and payload contracts are stable.

- [X] T007 Add `device_operational_status` enum, `devices.operational_status` column with default `available`, index, and comments in `database/schemas/shs_schema_v2.sql`
- [X] T008 Update device seed rows with `operational_status`, fake development `auth_token_hash`, fake development `auth_token_salt`, and fake firmware metadata in `database/seeds/dev_data_v2.sql`
- [X] T009 Update v1-to-v2 sign migration to map legacy sign status into `devices.operational_status` while keeping lifecycle status separate in `database/scripts/migrate_v2.ts`
- [X] T010 Update activation/register script to set `operational_status = 'available'` when claiming a device in `database/scripts/register_device_kalebwbishop.sql`
- [X] T011 Update activation/register script to set `operational_status = 'available'` when claiming a device in `database/scripts/register_device_tester.sql`
- [X] T012 Add shared backend contract test helpers for fake asyncpg records, fake pools, firmware headers, and authenticated device overrides in `backend/tests/test_firmware_runtime_contract.py`
- [X] T013 [P] Lock final backend runtime contract wording for status fields, auth header format, sample range, firmware version enforcement, firmware event reporting, and trailing-slash behavior in `specs/001-esp-idf-firmware-runtime/contracts/backend-device-api.md`
- [X] T014 [P] Lock final local provisioning contract wording for exactly-one setup/claim code handling, field reset semantics, and forbidden secret fields in `specs/001-esp-idf-firmware-runtime/contracts/local-provisioning-api.md`
- [X] T015 [P] Update validation setup notes for fake NVS identity, auth token, setup-code verifier, backend URL, CA certificate, and firmware version headers in `specs/001-esp-idf-firmware-runtime/quickstart.md`
- [X] T016 Add the device/status/classify/provisioning/event authorization matrix for anonymous callers, invalid token/code, revoked or expired verifier metadata, replay, brute-force, wrong serial, unsupported firmware version, and valid caller behavior in `specs/001-esp-idf-firmware-runtime/contracts/backend-device-api.md` and `specs/001-esp-idf-firmware-runtime/contracts/local-provisioning-api.md`
- [X] T017 Add the authoritative lifecycle/operational status matrix, constitution-required occupied/reserved/claimed/stale/manual-override considerations, and fail-closed state handling expectations in `specs/001-esp-idf-firmware-runtime/plan.md` and `specs/001-esp-idf-firmware-runtime/contracts/backend-device-api.md`
- [X] T018 Add observability contract requirements for backend-observed events, firmware-observed event reporting, structured logs, metrics definitions, operator visibility, and recovery steps in `specs/001-esp-idf-firmware-runtime/plan.md` and `specs/001-esp-idf-firmware-runtime/quickstart.md`
- [X] T019 Add device lifecycle policy decisions for manufacturing-only token issuance, token rotation out of scope, fail-closed revoked/missing tokens, Wi-Fi-only field reset, and unsupported old secure-provisioning firmware in `specs/001-esp-idf-firmware-runtime/spec.md` and `firmware/README.md`

**Checkpoint**: Database schema, API contracts, device auth shape, status state matrix, event source boundaries, and provisioning authorization requirements are ready for user-story implementation.

---

## Phase 3: User Story 1 - Provision Device Connectivity (Priority: P1) - MVP

**Goal**: A field installer can put an ESP-IDF device into local setup mode, view status, scan networks, submit Wi-Fi credentials with a valid device-specific setup or claim code, and have the device reconnect as a station without erasing device identity material.

**Independent Test**: Build and flash the firmware, erase Wi-Fi credentials, connect to the SoftAP, verify `/status` and `/scan`, confirm `/configure` rejects missing/invalid codes without saving credentials, confirm field reset clears only Wi-Fi keys, then submit valid credentials plus a valid code and observe station reconnect.

### Tests For User Story 1

- [X] T020 [P] [US1] Add frontend API tests for `configureWifi` payloads, exactly-one code selection, timeout handling, and ESP error propagation in `frontend/src/api/espApi.test.ts`
- [X] T021 [P] [US1] Add local provisioning manual validation cases for missing code, invalid code, both-code input, successful save, reboot, and no-secret responses in `firmware/TEST_PLAN.md`
- [X] T022 [P] [US1] Add quickstart commands for `/configure` success and failure cases using `claim_id` and `setup_code` in `specs/001-esp-idf-firmware-runtime/quickstart.md`
- [X] T023 [P] [US1] Add frontend accessibility tests or validation notes for setup/claim code labels, hints, role/state semantics, error announcements, invalid-field focus, and non-color-only status indicators in `frontend/src/api/espApi.test.ts` and `firmware/TEST_PLAN.md`
- [X] T024 [P] [US1] Add local provisioning abuse validation cases for 5 failed setup/claim code attempts, 5-minute lockout, generic error messages, revoked/expired verifier metadata when provisioned, no Wi-Fi credential writes during lockout, and verifier reuse after valid code submission in `firmware/TEST_PLAN.md`
- [X] T025 [P] [US1] Add field reset validation cases proving Wi-Fi credentials are cleared while serial number, auth token, and setup/claim verifier material remain readable in `firmware/TEST_PLAN.md`

### Implementation For User Story 1

- [X] T026 [US1] Add setup/claim verifier constants and public load/save/exists/verify function declarations in `firmware/main/nvs_storage.h`
- [X] T027 [US1] Implement setup/claim verifier storage, optional revoked/expired metadata reads, and constant-time verification helpers in `firmware/main/nvs_storage.c`
- [X] T028 [US1] Expose a Wi-Fi-only field reset API that clears `wifi_ssid` and `wifi_pass` without opening the device identity namespace in `firmware/main/nvs_storage.h` and `firmware/main/nvs_storage.c`
- [X] T029 [US1] Parse `claim_id` and `setup_code`, reject missing or both-present code fields, and reject oversized or invalid JSON before Wi-Fi writes in `firmware/main/provisioning_server.c`
- [X] T030 [US1] Require successful active, unexpired setup/claim code verification before calling `nvs_wifi_save` and clear sensitive buffers after use in `firmware/main/provisioning_server.c`
- [X] T031 [US1] Ensure `/status` and `/scan` responses expose only non-secret setup fields and never include Wi-Fi password, auth token, setup code, hash, or salt in `firmware/main/provisioning_server.c`
- [ ] T032 [US1] Route installer-accessible reset or Wi-Fi retry-exhaustion fallback through the Wi-Fi-only field reset API without erasing serial number, auth token, or setup/claim verifier material in `firmware/main/main.c` and `firmware/main/provisioning_server.c`
- [X] T033 [US1] Change `configureWifi` to accept a discriminated `claimId` or `setupCode` argument and send `claim_id` or `setup_code` to `/configure` in `frontend/src/api/espApi.ts`
- [ ] T034 [US1] Add setup or claim code input, validation, loading, invalid-code, AP-unreachable, and success states to the guided setup flow in `frontend/src/screens/SetupGuideScreen.tsx`
- [ ] T035 [US1] Add setup or claim code input, validation, loading, invalid-code, AP-unreachable, and success states to the direct Wi-Fi setup flow in `frontend/src/screens/WiFiSetupScreen.tsx`
- [X] T036 [US1] Track setup/claim code failures in the current boot session and lock `/configure` credential writes for 5 minutes after 5 failed validations in `firmware/main/provisioning_server.c`
- [ ] T037 [US1] Add accessibility labels, hints, role/state semantics, screen-reader error announcement, invalid-field focus, and non-color-only status indicators to setup-code UI in `frontend/src/screens/SetupGuideScreen.tsx` and `frontend/src/screens/WiFiSetupScreen.tsx`
- [X] T038 [US1] Document provisioning authorization, NVS verifier keys, Wi-Fi-only field reset behavior, fake NVS CSV examples, and no-secret response rules in `firmware/README.md`
- [ ] T039 [US1] Update frontend provisioning copy and validation notes to avoid exposing setup/claim code secrets in `frontend/src/screens/SetupGuideScreen.tsx` and `frontend/src/screens/WiFiSetupScreen.tsx`

**Checkpoint**: User Story 1 is independently functional and testable through local SoftAP provisioning and Wi-Fi-only field reset behavior.

---

## Phase 4: User Story 2 - Detect And Submit Gesture Samples (Priority: P1)

**Goal**: An active device polls backend status, follows the lifecycle/operational state matrix, samples only when status is exactly `available`, sends exactly one 512-sample raw 12-bit ADC payload with device bearer auth and supported firmware headers, and avoids submissions for every non-available state.

**Independent Test**: With a registered device row, valid serial/token in NVS, backend URL, CA certificate, and supported firmware/config version headers, set backend `operational_status` to `available` and verify one authenticated 512-sample classify request; then exercise every non-available matrix row and verify zero new classify requests.

### Tests For User Story 2

- [ ] T040 [P] [US2] Add classify contract tests for exactly 512 samples, rejecting too few samples, rejecting too many samples, and rejecting values outside `0..4095` in `backend/tests/test_inference_security.py`
- [ ] T041 [P] [US2] Add device status state-matrix tests for active available, active assistance states, active offline/error/training states, occupied/reserved/claimed/manual-override non-available considerations, stale state handling, non-active lifecycle states, unknown lifecycle states, null operational status, 404 unknown serial, and no-secret response bodies in `backend/tests/test_device_status_contract.py`
- [ ] T042 [P] [US2] Add positive-wave side-effect tests for updating only the authenticated serial to `assistance_requested` in `backend/tests/test_firmware_runtime_contract.py`
- [ ] T043 [P] [US2] Add firmware version parser/policy tests for missing, malformed, below-minimum, and supported `X-Firmware-Version` and `X-Firmware-Config-Version` headers plus revoked/expired device-token metadata and repeated auth-failure threshold event creation in `backend/tests/test_firmware_runtime_contract.py`
- [ ] T044 [P] [US2] Add firmware validation steps for available status sampling, each non-available matrix row producing zero submissions, missing token, missing serial, ADC range validation, and firmware version headers in `firmware/TEST_PLAN.md`

### Implementation For User Story 2

- [ ] T045 [US2] Enforce exact sample length and per-item integer range `0..4095` in `ClassifyRequest` in `backend/app/routes/inference.py`
- [ ] T046 [US2] Ensure classify defaults omitted `serial_number` to the authenticated device and returns 403 before model inference when payload serial mismatches in `backend/app/routes/inference.py`
- [ ] T047 [US2] Ensure wave classification updates `devices.operational_status` only for the authenticated serial and logs event/notification failures without failing the response in `backend/app/routes/inference.py`
- [ ] T048 [US2] Add an explicit status response model for `GET /devices/{serial_number}/status` in `backend/app/routes/devices.py`
- [ ] T049 [US2] Implement the authoritative lifecycle/operational status matrix helper, including fail-closed occupied/reserved/claimed/stale/manual-override considerations, in `backend/app/services/device_service.py` and call it from `backend/app/routes/devices.py`
- [ ] T050 [US2] Ensure device service read paths include `operational_status` and remain compatible with the v2 schema in `backend/app/services/device_service.py`
- [ ] T051 [US2] Add configurable minimum firmware and config version settings plus numeric semantic-version and date-version parser rules in `backend/app/config/settings.py`
- [ ] T052 [US2] Enforce firmware version policy and revoked/expired device-token fail-closed checks for status and classify requests before telemetry side effects in `backend/app/middleware/device_auth.py`, `backend/app/routes/devices.py`, and `backend/app/routes/inference.py`
- [ ] T053 [US2] Record accepted firmware version observations and repeated device-auth failure threshold events without secrets in `backend/app/middleware/device_auth.py`, `backend/app/services/device_service.py`, and `backend/app/routes/inference.py`
- [ ] T054 [US2] Block normal runtime when serial number is absent instead of generating a MAC-derived production identity in `firmware/main/main.c`
- [ ] T055 [US2] Block status polling and classification when the auth token is absent and route the device to a recoverable error/provisioning path in `firmware/main/main.c`
- [ ] T056 [US2] Validate classify request samples before transmit and preserve `serial_number` plus `Authorization: Bearer <serial>:<token>` payload behavior in `firmware/main/https_client.c`
- [ ] T057 [US2] Send `X-Firmware-Version` and `X-Firmware-Config-Version` headers on status and classify requests in `firmware/main/https_client.c` and `firmware/main/https_client.h`
- [ ] T058 [US2] Update runtime status-gating documentation for the state matrix, `available`-only sampling, unsupported firmware rejection, and non-available LED behavior in `firmware/README.md`

**Checkpoint**: User Stories 1 and 2 are independently functional; provisioning can connect a device and runtime sampling submits only when allowed by the status matrix and firmware version policy.

---

## Phase 5: User Story 3 - Maintain Field Runtime Resilience (Priority: P2)

**Goal**: The device handles Wi-Fi failure, backend failure, malformed status payloads, unknown statuses, certificate issues, watchdog-sensitive work, LED state changes, OTA boot validation, and firmware-observed event reporting without indefinite blocking or insecure submissions.

**Independent Test**: Run firmware validation scenarios for Wi-Fi retry exhaustion, backend unavailable responses, malformed status JSON, unknown status strings, TLS mismatch, watchdog-safe sampling/retries, pending OTA image validity, and queued firmware-observed events uploaded after connectivity returns.

### Tests For User Story 3

- [ ] T059 [P] [US3] Add firmware failure-injection validation cases for non-200 status, malformed JSON, missing status, unknown status, wrong serial response, backend unreachable, and TLS mismatch in `firmware/TEST_PLAN.md`
- [ ] T060 [P] [US3] Add OTA validation cases for pending image not marked valid before status success and marked valid after first successful HTTPS status response in `firmware/TEST_PLAN.md`
- [ ] T061 [P] [US3] Add backend status failure tests for malformed or missing persisted `operational_status` handling in `backend/tests/test_device_status_contract.py`
- [ ] T062 [P] [US3] Add firmware event-reporting contract tests for authenticated valid event, wrong serial, unsupported firmware version, unsupported event type, and forbidden secret fields in `backend/tests/test_firmware_runtime_contract.py`
- [ ] T063 [P] [US3] Add backend device-event persistence tests for status failure, status recovery, OTA validation, provisioning summary, and secret stripping in `backend/tests/test_firmware_runtime_contract.py`
- [ ] T064 [P] [US3] Add firmware validation steps for queued firmware-observed status failure/recovery, OTA validation, and provisioning success summaries in `firmware/TEST_PLAN.md`

### Implementation For User Story 3

- [ ] T065 [US3] Extend `status_result_t` to include returned serial, lifecycle status, operational status, and a known-status validity flag in `firmware/main/https_client.h`
- [ ] T066 [US3] Parse and validate `serial_number`, `status`, `lifecycle_status`, and `operational_status` from status responses before treating a status poll as usable in `firmware/main/https_client.c`
- [ ] T067 [US3] Treat malformed status JSON, missing status fields, unknown status strings, wrong serial responses, non-200 responses, and TLS failures as fail-closed polling failures in `firmware/main/https_client.c`
- [ ] T068 [US3] Set error/offline LED status and bounded retry/backoff behavior immediately after status polling failure in `firmware/main/main.c`
- [ ] T069 [US3] Mark pending OTA images valid only after the first successful HTTPS status response for the same serial number in `firmware/main/main.c`
- [ ] T070 [US3] Keep LED updates non-blocking and ensure unknown status strings never map to `STATUS_AVAILABLE` in `firmware/main/led_driver.c` and `firmware/main/led_driver.h`
- [ ] T071 [US3] Add authenticated firmware event request model and `POST /devices/{serial_number}/events` route in `backend/app/routes/devices.py`
- [ ] T072 [US3] Store firmware-reported events through `create_device_event` with an event-type allow-list and forbidden-secret payload rejection in `backend/app/services/device_service.py`
- [ ] T073 [US3] Enforce firmware version policy on firmware event-reporting requests before storing `device_events` rows in `backend/app/routes/devices.py`
- [ ] T074 [US3] Add firmware event payload builder and upload helper for status failure, status recovery, OTA validation, and provisioning success summaries in `firmware/main/https_client.c` and `firmware/main/https_client.h`
- [ ] T075 [US3] Queue or summarize firmware-observed events while offline and upload them after backend connectivity is restored in `firmware/main/main.c`
- [ ] T076 [US3] Emit a secret-free provisioning success summary event after successful local Wi-Fi configuration and backend reachability in `firmware/main/provisioning_server.c` and `firmware/main/main.c`
- [ ] T077 [US3] Document fail-closed status polling, bounded retry timing, certificate failure behavior, watchdog expectations, OTA validation, and firmware event reporting in `firmware/README.md`

**Checkpoint**: All planned user stories are independently functional and resilient against expected field failures with backend-observed and firmware-observed events captured.

---

## Phase 6: Cross-Cutting Hardening And Polish

**Purpose**: Finish integration, security, compatibility, and documentation after user stories work.

- [ ] T078 [P] Review firmware and backend logging to ensure Wi-Fi passwords, device auth tokens, setup codes, hashes, salts, and private key material are never logged in `firmware/main/provisioning_server.c`, `firmware/main/nvs_storage.c`, `firmware/main/https_client.c`, and `backend/app/middleware/device_auth.py`
- [ ] T079 [P] Review exact endpoint paths and trailing-slash compatibility for `/api/v1/devices/{serial_number}/status`, `/api/v1/inference/classify`, `/api/v1/devices/{serial_number}/events`, `/status`, `/scan`, and `/configure` in `specs/001-esp-idf-firmware-runtime/contracts/backend-device-api.md` and `specs/001-esp-idf-firmware-runtime/contracts/local-provisioning-api.md`
- [ ] T080 [P] Review SQL changes for raw parameterized placeholders, additive migration safety, enum defaults, state matrix compatibility, and rollback notes in `database/schemas/shs_schema_v2.sql` and `database/scripts/migrate_v2.ts`
- [ ] T081 [P] Review frontend provisioning states for loading, invalid setup/claim code, AP unreachable, scan failure, credential rejection, success/reboot, and accessibility behavior in `frontend/src/screens/SetupGuideScreen.tsx` and `frontend/src/screens/WiFiSetupScreen.tsx`
- [ ] T082 [P] Review firmware retry, watchdog, LED, field reset, firmware event queue, and provisioning behavior in `firmware/main/main.c`, `firmware/main/https_client.c`, `firmware/main/led_driver.c`, and `firmware/main/nvs_storage.c`
- [ ] T083 [P] Update stale ESP-IDF versus legacy MicroPython wording in `README.md`, `HARDWARE.md`, `REGISTRATION.md`, and `firmware/README.md`
- [ ] T084 [P] Define metrics names or counter/timer descriptions for setup-code failures, setup-code lockouts, status poll failures and recoveries, classify submissions, auth failures, OTA validation, provisioning success, firmware version observations, and firmware event reports in `firmware/README.md` and `specs/001-esp-idf-firmware-runtime/quickstart.md`
- [ ] T085 [P] Document operator recovery steps for firmware serial logs, backend logs, device event history, unsupported firmware versions, token restoration, Wi-Fi-only field reset, and manufacturing/service identity erase in `firmware/README.md` and `specs/001-esp-idf-firmware-runtime/quickstart.md`
- [ ] T086 Execute the manual validation flow and record any skipped hardware or ESP-IDF toolchain steps in `specs/001-esp-idf-firmware-runtime/quickstart.md`

---

## Phase 7: Validation Gates

**Purpose**: Run relevant validation for touched modules and record skipped gates with reasons in the implementation summary.

- [ ] T087 Run backend validation with `cd backend` then `pytest` for `backend/tests/`
- [ ] T088 Run database validation with `npm run migrate:v2 --workspace=database` for `database/schemas/shs_schema_v2.sql` and `database/scripts/migrate_v2.ts`
- [ ] T089 Run frontend lint and tests with `npm run lint --workspace=frontend` and `npm run test --workspace=frontend` for `frontend/src/`
- [ ] T090 Run firmware validation with `cd firmware` then `idf.py build` for `firmware/`
- [ ] T091 Run hardware validation scenarios for provisioning, field reset, sampling, fail-closed polling, LED mapping, Wi-Fi fallback, certificate mismatch, firmware event reporting, and OTA validity from `firmware/TEST_PLAN.md`
- [ ] T092 Validate timed success criteria for 5-minute provisioning, 10-minute non-available zero submissions, one configured Wi-Fi retry cycle, and 5-minute setup-code lockout in `firmware/TEST_PLAN.md`
- [ ] T093 Review observability outputs for secret-safe logs, backend-observed events, firmware-reported events, metric definitions, firmware version enforcement, and operator recovery usefulness in `backend/tests/test_firmware_runtime_contract.py`, `firmware/README.md`, and `specs/001-esp-idf-firmware-runtime/quickstart.md`

---

## Dependencies & Execution Order

- Phase 1 setup and baseline tasks run first.
- Phase 2 foundational schema, seed, migration, contract, state matrix, firmware version policy, and event-reporting tasks block all user story implementation.
- User Story 1 and User Story 2 are both P1. Complete User Story 1 first for MVP provisioning and Wi-Fi-only field reset, then User Story 2 for runtime sampling/classification.
- User Story 3 depends on the status, identity, auth, LED, firmware version, and HTTPS behavior stabilized in User Story 2.
- Database schema changes must land before backend code or tests that read `devices.operational_status`.
- Backend request/response validation must land before frontend and firmware client behavior is treated as complete.
- Firmware `/configure` authorization and field reset semantics must land before frontend provisioning flows can be validated end-to-end.
- Firmware event-reporting backend endpoint tasks T071 through T073 must land before firmware upload tasks T074 through T076 are complete.
- Cross-cutting hardening and validation gates run after selected user stories are complete.

## User Story Dependency Graph

```text
Phase 1 Setup
    -> Phase 2 Foundational Contracts And Data
        -> US1 Provision Device Connectivity (MVP)
        -> US2 Detect And Submit Gesture Samples
            -> US3 Maintain Field Runtime Resilience
                -> Phase 6 Polish
                    -> Phase 7 Validation Gates
```

## Parallel Opportunities

- Phase 1: T002 through T006 can run in parallel after T001.
- Phase 2: T013 through T019 can run in parallel after T007 establishes schema direction; T010 and T011 should follow the chosen `operational_status` column/default.
- US1: T020 through T025 can run in parallel; after T026 through T028, provisioning tasks T029 through T039 can proceed with firmware, frontend, and docs split across separate agents.
- US2: T040 through T044 can run in parallel; backend state matrix tasks T048 through T053 should be completed before firmware runtime validation tasks T054 through T058.
- US3: T059 through T064 can run in parallel; T065 must precede T066 and T067; backend event tasks T071 through T073 can proceed in parallel with firmware event tasks T074 through T076 after the event contract is stable.
- Polish: T078 through T085 can run in parallel once all selected user stories are complete; T086 should run after those reviews.

## Parallel Execution Examples

### User Story 1

```text
Agent A: T020 frontend API tests in frontend/src/api/espApi.test.ts
Agent B: T021, T022, T024, and T025 provisioning, abuse, and field reset validation docs in firmware/TEST_PLAN.md and specs/001-esp-idf-firmware-runtime/quickstart.md
Agent C: T026, T027, and T028 NVS verifier and field reset APIs in firmware/main/nvs_storage.h and firmware/main/nvs_storage.c
Agent D: T023, T037, and T039 accessibility validation and UI semantics in frontend/src/ and firmware/TEST_PLAN.md
```

### User Story 2

```text
Agent A: T040 classify tests in backend/tests/test_inference_security.py
Agent B: T041, T042, and T043 status matrix, wave side-effect, and firmware version tests in backend/tests/
Agent C: T048, T049, T051, T052, and T053 backend status matrix and firmware version enforcement in backend/app/
Agent D: T044, T056, T057, and T058 firmware validation, payload validation, headers, and documentation in firmware/
```

### User Story 3

```text
Agent A: T059, T060, and T064 failure, OTA, and firmware event validation cases in firmware/TEST_PLAN.md
Agent B: T062, T063, T071, T072, and T073 backend firmware event reporting in backend/tests/ and backend/app/
Agent C: T065, T066, and T067 fail-closed status parsing in firmware/main/https_client.h and firmware/main/https_client.c
Agent D: T074, T075, and T076 firmware event building, queueing, and upload integration in firmware/main/
```

## Implementation Strategy

### MVP First

Deliver User Story 1 first: secure local provisioning with setup/claim code verification, frontend payload support, Wi-Fi-only field reset behavior, and documentation. This makes a device reachable and installable without depending on gesture detection.

### Incremental Delivery

1. Complete Phase 1 and Phase 2 to stabilize schema, contracts, status state matrix, firmware version policy, and event source boundaries.
2. Complete User Story 1 and validate local provisioning plus field reset independently.
3. Complete User Story 2 and validate authenticated available-only sampling, classify submission, state matrix behavior, and firmware version enforcement.
4. Complete User Story 3 and validate resilience, fail-closed behavior, OTA image validity, and firmware-observed event reporting.
5. Run polish and validation gates for touched modules.

### Risk Notes

- ESP-IDF or physical hardware may be unavailable during implementation; if so, complete code review and document skipped hardware gates in `specs/001-esp-idf-firmware-runtime/quickstart.md`.
- Device setup/claim verifier material must use fake values in docs and dev seeds; production tokens, Wi-Fi passwords, setup codes, salts, and certificates must not be committed.
- The visible v2 schema currently lacks `devices.operational_status`; database tasks must be completed before relying on current backend device status queries.
- Firmware version enforcement can lock out deployed old firmware; minimum supported versions must be configured intentionally and documented before rollout.
- Firmware-observed event upload must be bounded and secret-free so offline recovery does not create unbounded memory pressure or leak local provisioning secrets.