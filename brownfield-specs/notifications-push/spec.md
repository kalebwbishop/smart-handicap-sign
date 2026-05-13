---
status: migrated
created: 2026-05-12
source: brownfield-migrate
artifact_scope: spec-only
---

# Feature Specification: Notifications And Push Tokens

**Feature Branch**: `N/A - migrated from existing code`  
**Created**: 2026-05-12  
**Status**: Migrated  
**Input**: Brownfield migration of implemented notification and Expo push-token behavior.

## Summary

Hazard Hero stores user notifications and device push tokens so staff can be alerted to assistance requests and related events. Users can list, read, update, mark, and delete their own notifications, while mobile clients register or unregister Expo push tokens for delivery.

## User Scenarios & Testing

### User Story 1 - View And Manage Notifications (Priority: P1)

A staff user opens notifications, filters unread items, reads a notification, and marks it as read.

**Why this priority**: Staff need a reliable inbox for operational alerts.

**Independent Test**: Exercise `/api/v1/notifications` endpoints as the notification owner and as another user.

**Acceptance Scenarios**:

1. **Given** unread notifications for a user, **When** the user lists notifications, **Then** only that user's notifications are returned.
2. **Given** another user's notification ID, **When** the current user attempts to read or update it, **Then** the API returns 403.

### User Story 2 - Register Push Delivery (Priority: P1)

The mobile app registers an Expo push token after permission is granted.

**Why this priority**: Push delivery depends on a current token tied to the authenticated user.

**Independent Test**: Call `POST /api/v1/push-tokens` with an authenticated user and Expo token, then unregister it.

**Acceptance Scenarios**:

1. **Given** an authenticated user and Expo token, **When** the app registers the token, **Then** the token is stored for that user.
2. **Given** an old token, **When** the app unregisters it, **Then** future pushes do not target that token.

### User Story 3 - Alert Users For Events (Priority: P2)

Backend services create notifications when events or wave detections require staff attention.

**Why this priority**: Notifications connect backend/device events to staff response.

**Independent Test**: Trigger event or wave-detection flows that request notification creation and verify stored notification records.

**Acceptance Scenarios**:

1. **Given** a wave detection that requests assistance, **When** notification service runs, **Then** organization users receive a stored notification and push intent where configured.
2. **Given** a notification linked to an event, **When** the event notifications endpoint is read, **Then** linked notifications can be returned to authorized users.

### Edge Cases

- Anonymous notification or push token requests.
- Cross-user notification reads, updates, deletes, and mark-read operations.
- Duplicate or stale Expo push tokens.
- Push provider failure after a notification is stored.
- Mark-all-read when there are no unread notifications.

## Requirements

### Functional Requirements

- **FR-001**: System MUST create notifications bound to the authenticated user when called through notification API.
- **FR-002**: System MUST list notifications scoped to the current user and support filters for event ID, read state, date, pagination, and limit.
- **FR-003**: System MUST return unread notification counts for the current user.
- **FR-004**: System MUST enforce notification ownership for get, update, mark-read, and delete operations.
- **FR-005**: System MUST support marking one notification or all notifications as read.
- **FR-006**: System MUST register Expo push tokens for the authenticated user.
- **FR-007**: System MUST support token unregister by Expo token value.
- **FR-008**: System SHOULD integrate event and device services with notification creation for assistance workflows.

### Affected Modules

- **Backend (`backend/`)**: `routes/notifications.py`, `routes/push_tokens.py`, `services/notification_service.py`, `services/push_token_service.py`, `services/expo_push.py`.
- **Frontend (`frontend/`)**: `NotificationDetailScreen`, `PreferencesScreen`, `usePushNotifications` hook.
- **Database (`database/`)**: `notifications` and `push_tokens` tables in v1/v2 schemas.
- **Firmware (`firmware/`)**: N/A.
- **Legacy Hardware (`hardware/`)**: N/A.
- **AI (`ai/`, `backend/app/ai/`)**: N/A.
- **Infrastructure**: N/A.
- **Documentation**: N/A.

### API Requirements

- **Endpoint(s)**: `POST /api/v1/notifications`, `GET /api/v1/notifications`, `GET /api/v1/notifications/unread/count`, `GET /api/v1/notifications/{notification_id}`, `PATCH /api/v1/notifications/{notification_id}`, `POST /api/v1/notifications/{notification_id}/read`, `POST /api/v1/notifications/read-all`, `DELETE /api/v1/notifications/{notification_id}`, `POST /api/v1/push-tokens`, `DELETE /api/v1/push-tokens`.
- **Authentication**: WorkOS user auth required.
- **Authorization**: Notification ownership required for individual operations. Token registration binds to the current user.
- **Request Payload**: Notification create/update supports event ID, title, body, and read state. Push token register/unregister supports Expo token and optional device ID.
- **Response Payload**: Notification records include ID, event ID, user ID, title, body, read state, and timestamps. Push token response includes ID, user ID, token, device ID, and created timestamp.
- **Backward Compatibility**: Notification table exists in both v1 and v2 schemas.

### Database Requirements

- **Schema Target**: v1 and v2 compatible notification model.
- **Entities/Tables**: `notifications`, `push_tokens`, `events`, `device_events` indirectly.
- **Migration Behavior**: `migrate_v2.ts` migrates existing notifications and push tokens.
- **Indexes/Constraints/Enums**: User and event foreign key behavior should preserve notification ownership.
- **Rollback/Recovery**: No feature-specific rollback is documented.

### Frontend Requirements

- **Screens/Navigation**: Notification detail and preferences screens consume notification and push settings.
- **State/API Integration**: Push notification hook coordinates permission/token registration with the backend.
- **Design System**: UI must use Hazard Hero theme tokens.
- **States**: Permission denied, no token, registration failure, empty notification list, unread/read state, and delete/update failure.
- **Platforms**: Push notification behavior differs across native/web and Expo runtime environments.

### Key Entities

- **Notification**: User-visible alert, optionally linked to an event, with read state.
- **Push Token**: Expo token tied to a user and optional client device identifier.

## Security & Privacy Requirements

- Users MUST NOT read, update, mark, or delete other users' notifications.
- Push tokens MUST be stored only for authenticated users.
- Notification bodies may include device identifiers or operational context and MUST be scoped to authorized users.
- Push delivery failures SHOULD be logged without exposing token values unnecessarily.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Users can list and mark their own notifications without seeing another user's data.
- **SC-002**: Mobile clients can register and unregister Expo push tokens through authenticated API calls.
- **SC-003**: IDOR regression tests protect notification ownership boundaries.

## Assumptions

- Expo push tokens are the active push delivery mechanism.
- Stored notifications remain the source of truth even when push delivery fails.
- Event and inference services may create notifications outside the direct notification API.

## Gaps And Risks

- Token unregister does not appear to verify user ownership in the route signature; service behavior should be reviewed before production hardening.
- Frontend notification list behavior was not fully mapped in this spec-only migration.
- Push delivery tests were not identified in the migration scan.

## Out Of Scope

- Replacing Expo push delivery.
- Adding realtime WebSocket notification delivery.
- Adding plan/task artifacts or changing notification code.