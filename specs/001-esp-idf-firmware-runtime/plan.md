# Implementation Plan: ESP-IDF Firmware Runtime

**Branch**: `001-esp-idf-firmware-runtime` | **Date**: 2026-05-12 | **Spec**: [spec.md](spec.md)  
**Input**: Feature specification from `/specs/001-esp-idf-firmware-runtime/spec.md`

**Note**: This plan is grounded in the active Hazard Hero brownfield repository and now feeds the generated implementation task list.

## Summary

Bring the active ESP-IDF firmware runtime into alignment with the maintained Spec Kit specification for field devices at accessible parking signs. The implementation centers on the `firmware/` ESP-IDF application: provisioning Wi-Fi with local authorization, reading device identity and bearer token material from NVS, polling backend device status, collecting and submitting 512 raw ADC samples only when backend status is `available`, driving non-blocking LED status patterns, failing closed during unusable status polling, and marking OTA images valid only after the first successful HTTPS device status response.

Backend, database, frontend, AI, infrastructure, and documentation are affected as integration contracts. The plan preserves module boundaries by using HTTP API, SQL schema, firmware payload, and documented contract surfaces rather than cross-module imports.

## Technical Context

**Project Type**: Brownfield IoT/accessibility monorepo with mobile app, API, database, AI, firmware, and infrastructure modules  
**Primary Languages**: Python, TypeScript/TSX, C, SQL, Terraform, PowerShell  
**Backend**: FastAPI, asyncpg raw SQL, Pydantic models near route boundaries, WorkOS user auth, device bearer-token auth, embedded PyTorch inference  
**Frontend**: React Native + Expo SDK 54, TypeScript, React Navigation native-stack, Zustand, Axios clients, Hazard Hero theme tokens  
**Database**: PostgreSQL 15, v2 device lifecycle schema in `database/schemas/shs_schema_v2.sql`, TypeScript migration/seed scripts in `database/`  
**Firmware**: ESP-IDF C under `firmware/`; legacy MicroPython under `hardware/` is reference-only for this feature  
**AI**: PyTorch 1D CNN with 512-sample input contract; firmware does not run model inference locally  
**Infrastructure**: Docker Compose, Terraform, Azure deployment artifacts; firmware depends on backend URL and certificate alignment  
**Testing**: `idf.py build` for firmware, backend pytest for route/security contracts, database v2 migration validation when schema changes, frontend lint/test when provisioning UI/API changes  
**External/Local Dependencies**: WorkOS, PostgreSQL, Docker, ESP-IDF 5.4+ toolchain, local `deploy-box-python`, local `deploy-box-react-native` where frontend/backend installs require them  
**Constraints**: FastAPI `redirect_slashes=False`; raw SQL/no ORM; exact `/api/v1` paths; device token secrecy; local provisioning must not leak secrets; ESP32 watchdog/timing/memory limits; frontend must use existing API/theme/navigation patterns  
**Open Technical Questions**: None remain for planning. Brownfield gaps to resolve during implementation are recorded in [research.md](research.md): local `/configure` auth is not yet enforced, current firmware can regenerate a MAC-derived identity, and the visible v2 schema must define the `devices.operational_status` contract used by backend/frontend/firmware.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Module Boundaries**: PASS. Primary implementation belongs in `firmware/`. Backend, database, frontend, AI, infrastructure, and docs are touched only through contracts, tests, schema alignment, or documentation updates. No cross-module imports are planned.
- **Backend Raw SQL/FastAPI Pattern**: PASS. Any backend contract fixes stay in `backend/app/routes/`, `backend/app/services/`, `backend/app/middleware/`, or tests, using Pydantic models and asyncpg parameterized SQL.
- **Security/Auth**: PASS. Classification remains device-authenticated with `Authorization: Bearer <serial>:<token>`. Local `/configure` remains unauthenticated in pilot provisioning mode and must not return saved Wi-Fi passwords or device tokens. Device auth failures must be logged without secrets.
- **Authorization Matrix And Abuse Resistance**: PASS WITH ACTION. Device status, classify, and local provisioning contracts must document unauthenticated, malformed payload, wrong-serial, invalid-token, and valid caller behavior. Pilot `/configure` should reject malformed Wi-Fi payloads without writing credentials.
- **Device Lifecycle Security**: PASS WITH ACTION. Token issuance remains manufacturing/backend-only, token rotation is out of scope, revoked/missing tokens fail closed, field reset clears Wi-Fi only, and firmware/config-version reporting is required with backend minimum-version enforcement.
- **Schema/API Coupling**: PASS WITH DESIGN ACTION. The v2 `devices` table must expose lifecycle status, operational status, token hash/salt, firmware metadata, and serial identity expected by backend and firmware. If `operational_status` is absent, add it non-destructively and update v2 migration/seed/register behavior.
- **Frontend Patterns**: PASS. Any provisioning client changes stay in `frontend/src/api/espApi.ts` and related setup screens/types, using existing Axios/storage/navigation/theme patterns where backend interaction is involved.
- **Firmware Target**: PASS. Active runtime is ESP-IDF C under `firmware/`; `hardware/` MicroPython files are not production behavior for this feature.
- **Testing/Validation**: PASS. Required gates include firmware build, backend security/contract pytest, database v2 migration where schema changes, frontend lint/test if provisioning UI/API changes, and firmware hardware validation from `firmware/TEST_PLAN.md`.
- **Docs/Compatibility**: PASS. Firmware README, firmware test plan, quickstart, and contracts must document pilot provisioning behavior, identity/token requirements, status polling, fail-closed behavior, classify payloads, LED mapping, OTA validity, and certificate/backend URL setup.
- **Frontend Accessibility**: PASS WITH ACTION. Provisioning UI must include accessible labels, hints, role/state semantics, error announcement, invalid-field focus behavior, and non-color-only status indicators.
- **Observability/Operations**: PASS WITH ACTION. The work must define secret-safe structured logs, device events, metrics definitions, operator visibility, and recovery steps for provisioning, auth, status, classify, certificate, and OTA failures.

## Project Structure

### Documentation (this feature)

```text
specs/001-esp-idf-firmware-runtime/
+-- plan.md
+-- research.md
+-- data-model.md
+-- quickstart.md
+-- contracts/
|   +-- backend-device-api.md
|   +-- local-provisioning-api.md
+-- tasks.md
```

### Repository Modules

```text
backend/
+-- app/
|   +-- routes/
|   |   +-- devices.py
|   |   +-- inference.py
|   +-- middleware/
|   |   +-- device_auth.py
|   +-- services/
|   |   +-- device_service.py
+-- tests/

frontend/
+-- src/
|   +-- api/
|   |   +-- espApi.ts
|   +-- screens/
|   +-- types/

database/
+-- schemas/
+-- scripts/
+-- seeds/

firmware/
+-- CMakeLists.txt
+-- README.md
+-- TEST_PLAN.md
+-- partitions.csv
+-- sdkconfig.defaults
+-- server_certs/
+-- main/
    +-- main.c
    +-- adc_sampler.c
    +-- adc_sampler.h
    +-- https_client.c
    +-- https_client.h
    +-- led_driver.c
    +-- led_driver.h
    +-- nvs_storage.c
    +-- nvs_storage.h
    +-- ota_update.c
    +-- ota_update.h
    +-- provisioning_server.c
    +-- provisioning_server.h
    +-- wifi_manager.c
    +-- wifi_manager.h

ai/
hardware/
terraform/
docker-compose.yml
```

**Structure Decision**: Firmware behavior changes should be implemented in `firmware/main/` and firmware docs. Backend/database/frontend changes are limited to contract compatibility, tests, and provisioning client support. `ai/` and `backend/app/ai/` should not change unless validation finds the 512-sample input contract has drifted. `hardware/` should not be updated except for explicit legacy-reference documentation.

## Phase 0: Research And Unknowns

Research decisions are captured in [research.md](research.md). Key outcomes:

- Keep ESP-IDF under `firmware/` as the only production runtime for this feature.
- Treat backend status `available` as the only state that permits sampling and classification.
- Treat status polling failures, malformed status payloads, and unknown status strings as fail-closed conditions with zero classification submissions.
- Keep local `/configure` simple for the pilot by accepting Wi-Fi credentials without a claim or setup code; do not rely on backend reachability during provisioning.
- Preserve exact backend paths: `GET /api/v1/devices/{serial_number}/status` and `POST /api/v1/inference/classify`.
- Preserve the 512-sample, raw 12-bit ADC payload contract and validate it in firmware and backend tests.
- Use non-destructive v2 schema alignment if `devices.operational_status` is missing from the visible schema.

## Phase 1: Design And Contracts

### Backend/API Design

- **Routes**: `GET /api/v1/devices/{serial_number}/status` returns firmware status data; `POST /api/v1/inference/classify` accepts device-authenticated 512-sample classification payloads; staff debug/history endpoints remain user-authenticated.
- **Models**: Status response includes `serial_number`, `status`, `lifecycle_status`, and `operational_status`. Classification request includes optional deprecated `sign_id`, optional `serial_number`, and required `samples` length 512. Classification response includes `label`, `confidence`, and optional debug graph only when explicitly requested.
- **Services**: Reuse existing async service functions for device event creation and status updates. Any new helper should remain a function, not a service class.
- **SQL**: Use asyncpg raw SQL with `$1` placeholders. `devices` is the source for serial identity, lifecycle status, operational status, auth token hash/salt, organization, site, space, and firmware metadata. Wave classification updates `devices.operational_status` to `assistance_requested` only for the authenticated serial.
- **Auth**: Classification requires `Authorization: Bearer <serial>:<token>` and rejects wrong-serial payloads. Status polling remains the existing lightweight firmware-facing contract and must tolerate firmware sending an Authorization header without depending on it.
- **Authorization Matrix**: Contracts and tests must cover anonymous status polling, anonymous classify rejection, malformed bearer credentials, unknown serials, wrong token, revoked/expired token metadata where available, wrong-serial classify payloads, valid device credentials, repeated auth failure threshold behavior, and replay/brute-force cases where applicable.
- **Firmware Version Policy**: Firmware must send `X-Firmware-Version` and `X-Firmware-Config-Version` on status, classify, and firmware event-reporting requests. Backend must enforce configured minimum supported firmware and config versions before telemetry side effects; requests with missing, malformed, or below-minimum versions fail safely, and accepted observations are recorded without secrets. App firmware versions use numeric semantic version format `MAJOR.MINOR.PATCH` and compare by major, then minor, then patch. Config versions use numeric date format `YYYY.MM.DD` and compare by year, then month, then day. Empty components, suffixes, non-numeric components, impossible dates, and extra components are malformed.

### Frontend Design

- **Screens**: Setup guide or Wi-Fi setup surfaces that call the ESP32 local AP must collect Wi-Fi details only. Existing staff-facing device and claim screens remain separate from local AP behavior.
- **API Clients**: Update `frontend/src/api/espApi.ts` so `configureWifi` sends only `ssid` and `password` to the local provisioning contract.
- **State/Navigation**: No new navigation architecture is planned. Provisioning state should stay local to the setup screens.
- **Theme/UI States**: Provisioning UI must cover loading, scan failure, AP unreachable, credential rejection, and success/reboot states using existing theme tokens and accessible labels.
- **Accessibility**: Provisioning inputs and actions must include accessibility labels, hints, role/state semantics, screen-reader error announcement, focus movement to invalid fields after validation failure, and non-color-only indicators for success, error, disabled, and loading states.

### Database Design

- **Schema Version**: Existing v2 device lifecycle schema.
- **Tables/Enums/Indexes**: Ensure `devices` has serial identity, lifecycle status, operational status, token hash/salt, firmware metadata, organization/site/space references, and indexes for serial and status fields. If absent, add `device_operational_status` or equivalent constrained column non-destructively with statuses `available`, `assistance_requested`, `assistance_in_progress`, `offline`, `error`, `training_ready`, `training_positive`, and `training_negative`.
- **Data Migration/Seeds**: Update `shs_schema_v2.sql`, `migrate_v2.ts`, `dev_data_v2.sql`, and register scripts only if the operational status contract is missing or seed/register data must include device tokens/firmware status. No destructive migration is planned.

#### Device State Matrix

The matrix below is the authoritative design for database state, backend status responses, firmware sampling gates, and LED categories.

| Lifecycle status | Operational status | Firmware `status` | Sampling permitted | LED category | Notes |
|---|---|---|---|---|---|
| `active` | `available` | `available` | Yes | Available/ready | Only state that permits a 512-sample classify submission |
| `active` | `assistance_requested` | `assistance_requested` | No | Assistance requested | Wave classification transitions `available` to this state |
| `active` | `assistance_in_progress` | `assistance_in_progress` | No | Assistance in progress | Staff acknowledgement owns transition from requested to in-progress |
| `active` | `offline`, `error`, `training_ready`, `training_positive`, `training_negative` | Same as operational status | No | Mapped non-available pattern | Device keeps polling and never classifies while non-available |
| `active` | `occupied`, `reserved`, `claimed`, `manually_overridden` if introduced by parking-space or operations integrations | Same as operational status or `unknown` until supported | No | Manual/blocked non-available pattern | These are not part of the initial `device_operational_status` enum; backend must not collapse them into `available` if surfaced later |
| `manufactured`, `unclaimed`, `claiming` | Any or null | `pending` | No | Setup/pending | Device may provision but must not classify |
| `lost`, `revoked`, `retired` | Any or null | `disabled` | No | Disabled/error | Device must fail closed and avoid runtime telemetry side effects |
| Any lifecycle status | Stale telemetry, stale backend-derived state, or stale device sync marker | `unknown` or polling failure | No | Error/offline | Stale state must never authorize classification based on last-known `available` |
| Unknown, missing, malformed, or unsupported combination | Any | `unknown` or polling failure | No | Error/offline | Backend and firmware treat as fail-closed and log without secrets |

Backend services should expose this mapping through one helper used by the status endpoint and tests. Firmware should only treat exact `available` as sample-eligible and should map all other known values to non-blocking LED states.

### Firmware/Device Design

- **Target Runtime**: ESP-IDF C under `firmware/`.
- **Payloads/Endpoints**: Runtime calls `GET /devices/{serial}/status` and `POST /inference/classify` using a base URL that already includes `/api/v1`. Local provisioning exposes `/status`, `/scan`, and `/configure` only while in provisioning mode.
- **Provisioning Auth**: `/configure` is unauthenticated in the pilot flow and accepts Wi-Fi credentials directly.
- **Provisioning Abuse Resistance**: `/configure` rejects malformed or oversized JSON, rejects missing SSIDs, and must not write Wi-Fi credentials on invalid requests.
- **Identity/Auth Storage**: NVS must provide serial number, auth token, and Wi-Fi credentials where required. Missing serial or token must block normal runtime or enter a recoverable setup/error path rather than silently submitting unauthenticated telemetry.
- **Token And Reset Policy**: Device tokens are issued by manufacturing/backend registration tooling only; firmware never creates tokens. Token rotation is out of scope for this feature, but missing, malformed, revoked, expired, or invalid tokens fail closed and require service/manufacturing tooling to restore. Field reset clears Wi-Fi credentials only and preserves serial number and auth token.
- **Firmware Version Compatibility**: Firmware reports app and configuration versions through `X-Firmware-Version` and `X-Firmware-Config-Version` headers on backend runtime requests. Backend enforces configured minimum supported firmware/config versions. Version parsing follows the format and comparison policy in the backend API design section.
- **Firmware Event Reporting**: Firmware reports firmware-observed operational events through `POST /api/v1/devices/{serial_number}/events` with device bearer auth and firmware version headers once connectivity permits upload. Required event types are status failure, status recovery, OTA validation, and successful provisioning summary. Payloads must be small, bounded, deduplicated where practical, and secret-free.
- **Reliability**: Status polling uses bounded retries and backoff. Any unusable status response pauses sampling, shows error/offline LED behavior, and retries. Sampling collects exactly 512 ADC1 readings at the configured interval while feeding the watchdog. OTA pending verification is marked valid only after the first successful HTTPS status response for the same serial.

### Observability And Operations Design

- **Structured Logs**: Firmware and backend logs must include secret-safe fields for provisioning attempts, token failures, status polling failures and recoveries, classify submissions, wave detections, certificate failures, firmware version observations, and OTA validation.
- **Device Events And Auditability**: Backend-observed events should record wave detection, authentication failure threshold exceeded, and observed firmware version. Firmware-observed events should be accepted through the firmware event-reporting contract for status failure and recovery, OTA validation, and successful local provisioning summaries once backend connectivity is available. Event payloads must not include Wi-Fi passwords, device tokens, setup codes, hashes, or salts.
- **Metrics Definitions**: The feature must define counter or timer names/descriptions for status poll failures, status recoveries, classify submissions, auth failures, OTA validation, and provisioning success. A dedicated metrics backend is not required in the first implementation if equivalent structured logs/device events preserve the signals.
- **Operator Recovery**: Firmware docs and quickstart must tell operators to use firmware serial logs for pre-connect provisioning failures and backend logs/device event history for connected-device failures.
- **Recovery Steps**: Operators should first confirm the device serial in firmware logs, then check backend logs and `device_events` by serial for auth failures, firmware-version rejection, status-poll failures, OTA validation, and provisioning summaries. If token material is missing or revoked, recovery requires manufacturing/service tooling; normal field reset must only clear Wi-Fi credentials. Unsupported firmware must be upgraded rather than granted a runtime bypass.

### AI/Inference Design

- **Model Contract**: No firmware-side model changes. Backend inference continues to consume exactly 512 integer samples and returns `wave`/`non-wave` label plus confidence. The known normalization mismatch between 12-bit firmware values and AI training scale remains a separate AI concern.
- **Training/Debugging**: No checkpoint, model architecture, or training data changes are planned. Firmware validation covers payload shape, identity, transport, and status gating, not model accuracy.

### Infrastructure/Operations Design

- **Docker/Terraform/Azure**: No infrastructure code change is planned unless certificate/backend URL validation reveals deployment mismatch. Firmware docs must state backend URL and certificate expectations.
- **Environment Variables/Secrets**: Device tokens, CA/private key material, WorkOS secrets, and backend credentials must not be committed. Examples use fake values only.

### Post-Design Constitution Re-check

- **Module Boundaries**: PASS. Contracts are documented in `specs/001-esp-idf-firmware-runtime/contracts/`; implementation remains module-local.
- **Security/Auth**: PASS. Device classify auth, pilot provisioning behavior, secret hygiene, and fail-closed status behavior are represented in plan, data model, contracts, and quickstart.
- **Schema/API Coupling**: PASS WITH ACTION. The plan explicitly requires non-destructive v2 schema alignment for `devices.operational_status` if absent.
- **Firmware Target**: PASS. All runtime behavior is scoped to ESP-IDF under `firmware/`.
- **Testing/Validation**: PASS. Firmware, backend, database, frontend, AI, infrastructure, and docs gates are selected according to touched modules.
- **Docs/Compatibility**: PASS. Generated artifacts cover backend runtime API, local provisioning API, data model, operational quickstart, and known compatibility constraints.
- **Authorization/Abuse Resistance**: PASS WITH ACTION. Tasks must cover the authorization matrix, invalid/revoked/expired credentials, replay, brute-force lockout, and wrong-serial behavior.
- **Observability/Accessibility/Device Lifecycle**: PASS WITH ACTION. Tasks must cover metrics definitions, device events, operator recovery docs, firmware version reporting, field-reset semantics, token lifecycle boundaries, and frontend accessibility validation.

## Verification Plan

| Module Touched | Required Validation |
|---|---|
| Firmware | `cd firmware` then `idf.py build` in an ESP-IDF 5.4+ environment; run hardware validation scenarios in `firmware/TEST_PLAN.md` where a board is available |
| Backend | `cd backend` then `pytest`, with focused coverage for device auth, classify payload bounds, wrong-serial rejection, status response mapping, and operational status writes |
| Database | `npm run migrate:v2 --workspace=database` where safe if v2 schema/migration/seed/register files change |
| Frontend | `npm run lint --workspace=frontend`; `npm run test --workspace=frontend` if provisioning UI/API tests are added or affected |
| AI | `cd ai` then `pytest` only if inference/model files or checkpoint contracts change; otherwise document not run as not touched |
| Infrastructure | Relevant Docker Compose/Terraform validation only if backend URL, certificates, or deployment files change |
| Documentation | Review firmware README, test plan, quickstart, and contracts for stale MicroPython or signs-v1 production language |
| Accessibility | Validate provisioning Wi-Fi fields, errors, disabled/loading states, and focus behavior against React Native accessibility expectations where the platform/tooling permits |
| Observability | Review structured log fields, device event payloads, metric definitions, and operator recovery docs for secret leakage and support usefulness |

## Complexity Tracking

No constitutional violations or intentional complexity exceptions are planned. The work is cross-module by contract, but implementation should remain module-local and contract-driven.

| Violation/Complexity | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| N/A | N/A | N/A |

## Migration And Rollback

- **Data Migration**: No destructive migration. If `devices.operational_status` is missing, add the v2 status column/enum with a safe default and update seeds/register scripts.
- **Backward Compatibility**: Active ESP-IDF firmware supersedes MicroPython production behavior. Backend classify retains deprecated `sign_id` input where already supported, but v2 serial identity is the runtime path. Status endpoint remains exact path and trailing-slash behavior is unchanged.
- **Rollback Plan**: Firmware rollback uses existing dual OTA slot behavior; do not mark a pending image valid until status polling succeeds. Backend/database changes should be reversible by removing additive status columns only after confirming no runtime depends on them. Frontend provisioning changes can roll back to the previous `espApi.ts` payload if the pilot needs to restore an earlier setup flow.
- **Operational Risk**: Main risks are field devices stuck in provisioning due to malformed Wi-Fi payloads, certificate/backend URL mismatch, missing device token in NVS, schema drift around `operational_status`, and unavailable ESP-IDF hardware validation. Each risk must be visible in tasks and final validation notes.
- **Security And Support Risk**: Malformed provisioning requests, unsupported old firmware, missing/revoked tokens, inaccessible frontend setup flows, and missing observability can block field recovery or hide unsafe runtime behavior. The task list must treat these as implementation blockers rather than polish.