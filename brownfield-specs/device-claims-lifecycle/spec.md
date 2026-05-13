---
status: migrated
created: 2026-05-12
source: brownfield-migrate
artifact_scope: spec-only
---

# Feature Specification: Device Claims And Lifecycle Management

**Feature Branch**: `N/A - migrated from existing code`  
**Created**: 2026-05-12  
**Status**: Migrated  
**Input**: Brownfield migration of implemented device claim and lifecycle management.

## Summary

Hazard Hero supports QR-based device claiming and ongoing device lifecycle management. Staff can validate a device claim code, assign the device to an organization, site, and parking space, upload installation evidence, and then administer the device through active, revoked, transferred, released, and regenerated-claim states. The feature spans the FastAPI backend, v2 database schema, React Native claim/device screens, and backend regression tests.

## User Scenarios & Testing

### User Story 1 - Validate A QR Claim (Priority: P1)

An installer scans or enters a device serial number and one-time claim ID before committing an installation.

**Why this priority**: Claim validation prevents assigning an unknown, expired, already claimed, or revoked device.

**Independent Test**: Call `POST /api/v1/device-claims/validate` with an authenticated user and verify valid and invalid claim responses.

**Acceptance Scenarios**:

1. **Given** an unclaimed device with a valid claim ID, **When** an authenticated installer validates the claim, **Then** the API returns `valid: true` with the device summary.
2. **Given** an expired or incorrect claim ID, **When** validation runs, **Then** the API returns `valid: false` with an error code and does not change device state.

### User Story 2 - Claim And Install A Device (Priority: P1)

An installer assigns a validated device to an organization, site, and parking space with installation notes and photos.

**Why this priority**: This is the core field activation workflow for deployed signs.

**Independent Test**: Call `POST /api/v1/device-claims/claim` as an owner, admin, or installer and verify the device, installation, event, and audit records.

**Acceptance Scenarios**:

1. **Given** a valid claim and an available parking space in the target organization, **When** the installer claims the device, **Then** the device becomes active and is assigned to the selected site and space.
2. **Given** a parking space occupied by another device, **When** the installer attempts the claim, **Then** the API returns a conflict and no partial assignment is committed.

### User Story 3 - Administer Active Devices (Priority: P2)

An organization admin views devices, opens a device detail screen, and performs lifecycle actions such as revoke, transfer, release, or regenerate claim.

**Why this priority**: Staff need operational controls after devices are deployed.

**Independent Test**: Exercise `/api/v1/devices` list/detail and action endpoints with users in and outside the owning organization.

**Acceptance Scenarios**:

1. **Given** an active assigned device, **When** an admin transfers it to another valid site and parking space, **Then** assignments update and the previous space is cleared.
2. **Given** a non-admin member, **When** the user attempts to revoke or release a device, **Then** the API returns 403.

### Edge Cases

- Invalid serial format, unknown serial, missing claim configuration, expired claim, reused claim, and revoked/retired device states.
- Claim attempts against a site outside the selected organization or a parking space that belongs to another site.
- Race conditions where two users attempt to claim the same device or parking space.
- Rate-limit exhaustion by IP, serial number, or user and serial pair.
- Unassigned manufactured devices that can be viewed but require admin access for lifecycle changes.

## Requirements

### Functional Requirements

- **FR-001**: System MUST validate device claim requests using serial number and one-time claim ID before activation.
- **FR-002**: System MUST rate-limit claim validation and claim execution attempts.
- **FR-003**: System MUST allow only authenticated organization owners, admins, and installers to execute device claims for the target organization.
- **FR-004**: System MUST atomically assign a claimed device to organization, site, and parking space records.
- **FR-005**: System MUST reject claims where the site, parking space, or organization relationship is invalid.
- **FR-006**: System MUST record installation, device event, and audit information for successful claims.
- **FR-007**: System MUST let authorized users list devices scoped to their organizations.
- **FR-008**: System MUST let organization owners or admins revoke, transfer, release, and regenerate claim IDs according to lifecycle state.
- **FR-009**: System MUST expose a lightweight unauthenticated status endpoint for devices at `GET /api/v1/devices/{serial_number}/status`.

### Affected Modules

- **Backend (`backend/`)**: `routes/device_claims.py`, `routes/devices.py`, `services/device_service.py`, `utils/claim.py`, `utils/serial.py`, `middleware/rate_limiter.py`.
- **Frontend (`frontend/`)**: QR scan, claim validation, assignment, photos, confirmation, device list/detail screens, device API clients, and device types.
- **Database (`database/`)**: v2 schema entities for devices, sites, parking spaces, installations, device events, and audit logs.
- **Firmware (`firmware/`)**: Device status endpoint consumption is device-facing, but lifecycle management itself is backend/frontend driven.
- **Legacy Hardware (`hardware/`)**: N/A.
- **AI (`ai/`, `backend/app/ai/`)**: N/A.
- **Infrastructure**: N/A.
- **Documentation**: Registration and MVP documentation describe portions of this workflow.

### API Requirements

- **Endpoint(s)**: `POST /api/v1/device-claims/validate`, `POST /api/v1/device-claims/claim`, `GET /api/v1/devices`, `GET /api/v1/devices/{serial_number}`, `GET /api/v1/devices/{serial_number}/status`, `POST /api/v1/devices/{serial_number}/acknowledge`, `POST /api/v1/devices/{serial_number}/resolve`, `POST /api/v1/devices/{serial_number}/revoke`, `POST /api/v1/devices/{serial_number}/transfer`, `POST /api/v1/devices/{serial_number}/release`, `POST /api/v1/devices/{serial_number}/regenerate-claim`, `GET /api/v1/devices/{serial_number}/events`.
- **Authentication**: User endpoints use WorkOS bearer auth; device status is currently unauthenticated.
- **Authorization**: Claim execution requires target organization membership with owner, admin, or installer role. Lifecycle admin actions require owner or admin. Device detail/events require membership in the device organization when assigned.
- **Request Payload**: Claim validation accepts `serial_number` and `claim_id`. Claim execution also requires organization/customer ID, site ID, parking space ID, accessible type, optional installation photos, and optional notes.
- **Response Payload**: Responses return device summary, claim success state, lifecycle status, assignment IDs, device records, or structured error details.
- **Backward Compatibility**: This is the v2 device lifecycle path and coexists with older sign/event behavior.

### Database Requirements

- **Schema Target**: v2 device lifecycle schema.
- **Entities/Tables**: `devices`, `sites`, `parking_spaces`, `installations`, `device_events`, `audit_logs`, `organizations`, `organization_members`.
- **Migration Behavior**: Existing v1 sign data is handled by `database/scripts/migrate_v2.ts`; fresh v2 development data is in `dev_data_v2.sql`.
- **Indexes/Constraints/Enums**: Device lifecycle, claim status, accessible parking type, organization role, and event type enums govern valid states.
- **Rollback/Recovery**: No automated rollback is documented for device claims; atomic service behavior is required to avoid partial assignment.

### Frontend Requirements

- **Screens/Navigation**: `QRScanScreen`, `ClaimValidateScreen`, `ClaimAssignScreen`, `ClaimPhotosScreen`, `ClaimConfirmScreen`, `DeviceListScreen`, and `DeviceDetailScreen`.
- **State/API Integration**: Frontend uses dedicated device claim/device API clients and typed device models.
- **Design System**: UI must align with `frontend/src/theme/` tokens.
- **States**: Loading, invalid claim, unauthorized, conflict, empty device list, success confirmation, and network failure states.
- **Platforms**: Native camera or manual-entry behavior may differ from web.

### Key Entities

- **Device**: Physical sign controller identified by serial number, lifecycle status, operational status, claim status, organization, site, and parking space.
- **Claim ID**: One-time secret used to prove possession during installation.
- **Installation**: Record linking device, organization, site, parking space, installer, notes, photos, and activation status.
- **Device Event**: Operational/audit history for device lifecycle and assistance events.

## Security & Privacy Requirements

- Authenticated users MUST be checked against organization membership before claims or lifecycle actions.
- Claim IDs and auth tokens MUST be hashed or treated as secrets and not exposed after use except when regenerating a claim for authorized admins.
- Claim attempts MUST be rate-limited to reduce brute-force risk.
- Device serial numbers and claim IDs MUST be validated before database writes.
- Successful lifecycle operations SHOULD produce audit and device event records.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Valid claim flow completes from QR/manual input through assigned active device without manual database edits.
- **SC-002**: Cross-organization site and parking-space claim attempts are rejected.
- **SC-003**: Admin lifecycle actions preserve assignment consistency and are covered by backend regression tests.

## Assumptions

- Devices are manufactured with serial numbers and claim IDs before field installation.
- Organization role `installer` is valid in the v2 schema even though older organization APIs expose owner/admin/member roles.
- Installation photos are stored or referenced as strings by the current backend contract.

## Gaps And Risks

- Frontend test coverage for the claim wizard and device detail workflow was not found in the migration scan.
- The unauthenticated device status endpoint intentionally supports firmware polling but may need hardening before production exposure.
- v1 sign behavior still overlaps with some assistance workflows.

## Out Of Scope

- Creating manufacturing tooling for serial/claim provisioning.
- Changing lifecycle states, database schema, or frontend screens.
- Adding `plan.md`, `tasks.md`, contracts, or implementation changes.