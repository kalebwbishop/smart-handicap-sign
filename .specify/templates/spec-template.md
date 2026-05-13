# Feature Specification: [FEATURE NAME]

**Feature Branch**: `[###-feature-name]`  
**Created**: [DATE]  
**Status**: Draft  
**Input**: User description: "$ARGUMENTS"

## Summary

[Describe the user-visible outcome and the affected Hazard Hero module(s): backend, frontend, database, firmware, hardware, ai, infrastructure, documentation.]

## User Scenarios & Testing *(mandatory)*

<!--
  User stories must be prioritized by user value and independently testable.
  Each story should be deliverable as a vertical slice without requiring all later stories.
-->

### User Story 1 - [Brief Title] (Priority: P1)

[Describe this user journey in plain language.]

**Why this priority**: [Explain the value and why this is the MVP slice.]

**Independent Test**: [Describe how this can be tested independently. Include the app/API/firmware/database entry point used for verification.]

**Acceptance Scenarios**:

1. **Given** [initial state], **When** [action], **Then** [expected outcome]
2. **Given** [initial state], **When** [action], **Then** [expected outcome]

---

### User Story 2 - [Brief Title] (Priority: P2)

[Describe this user journey in plain language.]

**Why this priority**: [Explain the value and priority.]

**Independent Test**: [Describe how this can be tested independently.]

**Acceptance Scenarios**:

1. **Given** [initial state], **When** [action], **Then** [expected outcome]

---

### User Story 3 - [Brief Title] (Priority: P3)

[Describe this user journey in plain language.]

**Why this priority**: [Explain the value and priority.]

**Independent Test**: [Describe how this can be tested independently.]

**Acceptance Scenarios**:

1. **Given** [initial state], **When** [action], **Then** [expected outcome]

---

[Add or remove user stories as needed.]

### Edge Cases

- [Authorization boundary: unauthenticated user, wrong organization, wrong role, or wrong device token]
- [Device/network boundary: offline device, retry exhaustion, duplicate submission, stale status, or backend unavailable]
- [Data boundary: missing entity, invalid UUID/serial/claim ID, already-claimed device, occupied parking space, or deleted organization/site]
- [Frontend boundary: loading, empty, error, refresh, deep link, mobile/web platform difference]
- [Firmware boundary: invalid provisioning payload, bad Wi-Fi credentials, watchdog timing, certificate/backend URL issue]

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST [specific capability]
- **FR-002**: System MUST [specific capability]
- **FR-003**: Users MUST be able to [key interaction]
- **FR-004**: System MUST [persistence or integration behavior]
- **FR-005**: System MUST [error, audit, notification, or observability behavior]

Use `[NEEDS CLARIFICATION: ...]` when a requirement is materially unclear.

### Affected Modules *(mandatory)*

- **Backend (`backend/`)**: [Routes, services, middleware, config, utils, AI embedding, or N/A]
- **Frontend (`frontend/`)**: [Screens, API clients, navigation, store, theme, types, or N/A]
- **Database (`database/`)**: [Schema, migration, seed/register scripts, or N/A]
- **Firmware (`firmware/`)**: [ESP-IDF C files, CMake, certs, config, tests/docs, or N/A]
- **Legacy Hardware (`hardware/`)**: [MicroPython files, only if explicitly affected]
- **AI (`ai/`, `backend/app/ai/`)**: [Training, checkpoint, inference contract, or N/A]
- **Infrastructure (`docker-compose.yml`, `nginx/`, `terraform/`)**: [Runtime/deploy changes or N/A]
- **Documentation**: [README, DESIGN, HARDWARE, firmware docs, API docs, or N/A]

### API Requirements *(include if backend/frontend/firmware contract changes)*

- **Endpoint(s)**: [HTTP method and exact path under `/api/v1`; remember trailing slashes do not redirect]
- **Authentication**: [WorkOS user auth, device bearer token, optional/no auth]
- **Authorization**: [Organization role, device ownership, site/space membership, notification ownership]
- **Request Payload**: [Fields, validation, serial/claim/device constraints]
- **Response Payload**: [Fields, status codes, errors]
- **Backward Compatibility**: [Compatibility with existing frontend, ESP-IDF firmware, legacy MicroPython, or N/A]

### Database Requirements *(include if persisted data changes)*

- **Schema Target**: [v1 signs schema, v2 device lifecycle schema, or migration between them]
- **Entities/Tables**: [users, organizations, organization_members, devices, sites, parking_spaces, installations, events, device_events, notifications, audit_logs, etc.]
- **Migration Behavior**: [Fresh install, data-preserving migration, destructive reset, seed impact]
- **Indexes/Constraints/Enums**: [Required additions or changes]
- **Rollback/Recovery**: [Required data recovery or rollback expectations]

### Frontend Requirements *(include if UI/app changes)*

- **Screens/Navigation**: [Affected screens and `RootStackParamList`/navigation changes]
- **State/API Integration**: [Zustand store, API client, TanStack Query, token refresh behavior]
- **Design System**: [Use `frontend/src/theme/` colors, spacing, typography]
- **States**: [Loading, empty, error, success, disabled, unauthorized, offline]
- **Platforms**: [Native, web, camera/deep-link/push-notification differences]

### Device/Firmware Requirements *(include if firmware or device-facing API changes)*

- **Runtime Target**: [ESP-IDF `firmware/` or legacy MicroPython `hardware/`]
- **Device Identity/Auth**: [Serial number, device token, claim ID, cert behavior]
- **Provisioning/Wi-Fi**: [SoftAP endpoints, NVS persistence, retry/fallback behavior]
- **Telemetry/API Payloads**: [Status polling, inference classify payload, OTA payload]
- **Reliability**: [Watchdog, retry limits, timing, LED status, offline behavior]

### AI/Inference Requirements *(include if model or inference changes)*

- **Input Contract**: [512 samples, value range, normalization expectations]
- **Output Contract**: [label/confidence/debug graph/status side effect]
- **Checkpoint Impact**: [Whether `ai/checkpoints/best.pt` and `backend/app/ai/checkpoints/best.pt` must stay in sync]
- **Training/Validation**: [Synthetic data, test coverage, accuracy/performance expectations]

### Key Entities *(include if feature involves data)*

- **[Entity 1]**: [Meaning, key attributes, relationships]
- **[Entity 2]**: [Meaning, key attributes, relationships]

## Security & Privacy Requirements *(mandatory when auth, device data, org data, or external input is involved)*

- [Authentication and authorization behavior]
- [Input validation requirements]
- [Rate limiting or brute-force/replay protection]
- [Audit/event/notification requirements]
- [Sensitive data handling: tokens, claim IDs, WorkOS IDs, device serials]

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: [Measurable user/system outcome]
- **SC-002**: [Measurable reliability/performance/security outcome]
- **SC-003**: [Measurable workflow completion or operational outcome]

## Assumptions

- [Assumption about users, devices, organizations, sites, or deployment]
- [Assumption about existing APIs/schema/firmware behavior]
- [Assumption about local dependencies such as deploy-box packages]

## Out Of Scope

- [Explicitly excluded module, behavior, migration, firmware target, or UI flow]