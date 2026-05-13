---
status: migrated
created: 2026-05-12
source: brownfield-migrate
artifact_scope: spec-only
---

# Feature Specification: Legacy Signs And Events Compatibility

**Feature Branch**: `N/A - migrated from existing code`  
**Created**: 2026-05-12  
**Status**: Migrated  
**Input**: Brownfield migration of implemented v1 sign/event compatibility behavior.

## Summary

Hazard Hero retains v1 sign/event service behavior while v2 device lifecycle support is introduced. Event APIs create, list, retrieve, update, delete, and link notifications to events by legacy `sign_id`, with authorization checks routed through sign organization membership. The code notes that sign-service authorization should eventually migrate to the device registration model.

## User Scenarios & Testing

### User Story 1 - Create A Sign Event (Priority: P1)

An authenticated organization member creates an event for a legacy sign and optionally creates a notification.

**Why this priority**: Legacy sign installations and existing event logs must keep working during v2 migration.

**Independent Test**: Call `POST /api/v1/events` with a valid sign ID as member and non-member users.

**Acceptance Scenarios**:

1. **Given** a sign in an organization, **When** a member creates an event, **Then** the event is stored.
2. **Given** a non-member, **When** the user creates an event for that sign, **Then** the API returns 403.

### User Story 2 - Review Event History (Priority: P1)

Staff list and inspect events filtered by sign or type.

**Why this priority**: Event history supports operations, audits, and notification review.

**Independent Test**: Call `GET /api/v1/events` and `GET /api/v1/events/{event_id}` with allowed and disallowed users.

**Acceptance Scenarios**:

1. **Given** multiple events, **When** a user lists events, **Then** results are scoped through the user's accessible organizations.
2. **Given** an event for another organization's sign, **When** a non-member requests it, **Then** the API returns 403.

### User Story 3 - Maintain Event Records (Priority: P2)

Authorized staff update or delete events and inspect linked notifications.

**Why this priority**: Legacy event records need maintenance while the system migrates toward v2 devices.

**Independent Test**: Exercise `PATCH`, `DELETE`, and `/notifications` subresource endpoints with IDOR tests.

**Acceptance Scenarios**:

1. **Given** an accessible event, **When** staff update event type or data, **Then** the updated event is returned.
2. **Given** an inaccessible event, **When** staff request linked notifications, **Then** the API returns 403.

### Edge Cases

- Event references a missing sign.
- Sign has no organization ID.
- Event ID does not exist.
- Notification creation requested without complete notification fields.
- v1 sign records coexist with v2 device records.

## Requirements

### Functional Requirements

- **FR-001**: System MUST support CRUD operations for events under `/api/v1/events`.
- **FR-002**: System MUST authorize event access through the associated sign's organization membership when present.
- **FR-003**: System MUST reject event creation for missing signs.
- **FR-004**: System MUST support filtering event lists by sign ID and event type.
- **FR-005**: System MUST allow events to store arbitrary JSON payload data.
- **FR-006**: System MUST optionally create notifications when events are created.
- **FR-007**: System MUST expose linked notifications for an event only after event access is authorized.
- **FR-008**: System MUST keep v1 event compatibility explicit while v2 device event migration remains incomplete.

### Affected Modules

- **Backend (`backend/`)**: `routes/events.py`, `services/event_service.py`, `services/sign_service.py`, `services/organization_service.py`.
- **Frontend (`frontend/`)**: Legacy sign/event consumption was not clearly identified in current screens during this migration scan.
- **Database (`database/`)**: v1 `signs` and `events` tables; v2 keeps `events` and adds `device_events`.
- **Firmware (`firmware/`)**: Active firmware uses v2 device endpoints; legacy sign compatibility may apply to older clients.
- **Legacy Hardware (`hardware/`)**: Legacy MicroPython may rely on sign-oriented behavior.
- **AI (`ai/`, `backend/app/ai/`)**: N/A.
- **Infrastructure**: N/A.
- **Documentation**: Migration documentation should clarify v1/v2 event boundaries.

### API Requirements

- **Endpoint(s)**: `POST /api/v1/events`, `GET /api/v1/events`, `GET /api/v1/events/{event_id}`, `GET /api/v1/events/{event_id}/notifications`, `PATCH /api/v1/events/{event_id}`, `DELETE /api/v1/events/{event_id}`.
- **Authentication**: WorkOS user auth required.
- **Authorization**: Event access is checked through `sign_service.get_sign(event.sign_id)` and organization membership when the sign has an organization.
- **Request Payload**: Event create accepts `sign_id`, event type, data JSON, and optional notification creation fields. Event update accepts optional type and data.
- **Response Payload**: Events include ID, sign ID, type, data, created timestamp, and updated timestamp.
- **Backward Compatibility**: This API is explicitly legacy sign-oriented and coexists with v2 `device_events`.

### Database Requirements

- **Schema Target**: v1 signs/events compatibility with v2 migration awareness.
- **Entities/Tables**: `signs`, `events`, `notifications`, `devices`, `device_events`.
- **Migration Behavior**: `migrate_v2.ts` migrates sign events into v2-compatible event storage, while device-specific events exist separately.
- **Indexes/Constraints/Enums**: `event_type` enum includes `status_change`, `alert`, `maintenance`, and `misuse`.
- **Rollback/Recovery**: No feature-specific rollback is documented.

### Key Entities

- **Sign**: Legacy parking sign record used for event authorization.
- **Event**: Legacy sign event with type and JSON payload.
- **Notification**: User-facing alert optionally linked to an event.

## Security & Privacy Requirements

- Event operations MUST enforce organization membership through associated sign records where available.
- Event notification access MUST use the same event authorization path.
- IDOR tests MUST cover cross-organization event reads and mutations.
- Event payload JSON may contain operational details and should not be exposed across org boundaries.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Organization members can create and read events for signs in their organization.
- **SC-002**: Non-members cannot create, read, update, delete, or inspect notifications for another organization's event.
- **SC-003**: Legacy sign/event tests continue to pass while v2 device events exist in parallel.

## Assumptions

- Legacy signs remain in use or need compatibility during transition to v2 devices.
- `sign_service` remains the current authorization bridge for legacy events.
- v2 device event migration is planned but not completed in this spec-only artifact.

## Gaps And Risks

- `routes/events.py` contains a TODO to migrate authorization checks from `sign_service` to the v2 device registration model.
- A current `routes/signs.py` file was not found in the route inventory, while `sign_service.py` and sign IDOR tests remain.
- Frontend legacy event UI ownership was unclear from the migration scan.

## Out Of Scope

- Replacing legacy events with device events.
- Removing `sign_service` or v1 schema artifacts.
- Adding plan/task artifacts or code changes.