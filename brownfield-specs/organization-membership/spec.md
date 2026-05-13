---
status: migrated
created: 2026-05-12
source: brownfield-migrate
artifact_scope: spec-only
---

# Feature Specification: Organization Membership And Roles

**Feature Branch**: `N/A - migrated from existing code`  
**Created**: 2026-05-12  
**Status**: Migrated  
**Input**: Brownfield migration of implemented organization and membership APIs.

## Summary

Hazard Hero uses organizations to scope users, sites, devices, events, notifications, and administrative permissions. Users can create organizations, list organizations they belong to, manage organization metadata, and administer members by role.

## User Scenarios & Testing

### User Story 1 - Create And List Organizations (Priority: P1)

An authenticated user creates an organization and becomes its owner.

**Why this priority**: Organization ownership is the root authorization boundary for the application.

**Independent Test**: Call `POST /api/v1/organizations` and `GET /api/v1/organizations` as an authenticated user.

**Acceptance Scenarios**:

1. **Given** an authenticated user, **When** the user creates an organization, **Then** the organization is stored and the creator has owner role.
2. **Given** multiple organizations, **When** the user lists organizations, **Then** only memberships for that user are returned.

### User Story 2 - Manage Organization Details (Priority: P2)

Owners or admins update organization metadata or delete an organization.

**Why this priority**: Staff must maintain customer organization records safely.

**Independent Test**: Exercise `GET`, `PATCH`, and `DELETE /api/v1/organizations/{org_id}` under owner, admin, member, and non-member identities.

**Acceptance Scenarios**:

1. **Given** an admin, **When** the admin updates organization name, **Then** the updated organization is returned.
2. **Given** a member, **When** the member attempts deletion, **Then** the API returns 403.

### User Story 3 - Manage Members (Priority: P2)

Owners and admins add, list, update, or remove organization members.

**Why this priority**: Membership controls who can operate devices and respond to assistance requests.

**Independent Test**: Exercise `/api/v1/organizations/{org_id}/members` endpoints and role-change constraints.

**Acceptance Scenarios**:

1. **Given** an admin, **When** the admin adds a member by email, **Then** the user is added with the requested non-owner role.
2. **Given** an admin, **When** the admin attempts to add or modify an owner role, **Then** the API returns 403.

### Edge Cases

- Non-member tries to view organization or members.
- Admin tries to modify owner roles.
- Member email does not resolve to an existing user.
- Duplicate membership insertion.
- Removing a member who is not in the organization.

## Requirements

### Functional Requirements

- **FR-001**: System MUST allow authenticated users to create organizations and assign the creator as owner.
- **FR-002**: System MUST list only organizations associated with the current user.
- **FR-003**: System MUST require organization membership to view organization detail and member lists.
- **FR-004**: System MUST require owner or admin role to update organization metadata.
- **FR-005**: System MUST require owner role to delete an organization.
- **FR-006**: System MUST allow owner/admin users to add members by existing user email.
- **FR-007**: System MUST prevent admins from adding, changing, or removing owner roles.
- **FR-008**: System MUST return clear 403, 404, or 409 errors for authorization, missing user/member, and duplicate membership failures.

### Affected Modules

- **Backend (`backend/`)**: `routes/organizations.py`, `services/organization_service.py`.
- **Frontend (`frontend/`)**: `OrganizationScreen`.
- **Database (`database/`)**: `organizations` and `organization_members` tables in v1/v2 schemas.
- **Firmware (`firmware/`)**: N/A.
- **Legacy Hardware (`hardware/`)**: N/A.
- **AI (`ai/`, `backend/app/ai/`)**: N/A.
- **Infrastructure**: N/A.
- **Documentation**: N/A.

### API Requirements

- **Endpoint(s)**: `POST /api/v1/organizations`, `GET /api/v1/organizations`, `GET /api/v1/organizations/{org_id}`, `PATCH /api/v1/organizations/{org_id}`, `DELETE /api/v1/organizations/{org_id}`, `GET /api/v1/organizations/{org_id}/members`, `POST /api/v1/organizations/{org_id}/members`, `PATCH /api/v1/organizations/{org_id}/members/{user_id}`, `DELETE /api/v1/organizations/{org_id}/members/{user_id}`.
- **Authentication**: WorkOS user auth required.
- **Authorization**: Owner/admin/member roles determine view and mutation rights. Owner-only protection applies to owner role changes and organization deletion.
- **Request Payload**: Organization payloads include name. Member payloads include email or target user ID and role.
- **Response Payload**: Organization responses include ID, name, timestamps, and caller role. Member responses include IDs, role, user email/name, and timestamps.
- **Backward Compatibility**: v1 schema includes owner/admin/member; v2 schema includes installer as an additional role, but the current route enum exposes owner/admin/member.

### Database Requirements

- **Schema Target**: v1 and v2 organization membership schemas.
- **Entities/Tables**: `users`, `organizations`, `organization_members`.
- **Migration Behavior**: `migrate_v2.ts` preserves organizations and memberships.
- **Indexes/Constraints/Enums**: `org_role` enum governs valid role values; v2 includes installer.
- **Rollback/Recovery**: No feature-specific rollback is documented.

### Frontend Requirements

- **Screens/Navigation**: Organization management is surfaced through `OrganizationScreen`.
- **State/API Integration**: Organization UI should use the shared API client and auth token flow.
- **Design System**: UI must use Hazard Hero theme tokens.
- **States**: Loading, empty organization list, not a member, insufficient role, duplicate member, user not found, and deletion confirmation.
- **Platforms**: Native and web should behave consistently.

### Key Entities

- **Organization**: Customer/team boundary used for authorization.
- **Organization Member**: User-to-organization relationship with role.
- **Role**: Permission level controlling organization, site, device, and member actions.

## Security & Privacy Requirements

- Every organization detail and membership operation MUST validate current user membership or role.
- Owner roles MUST be protected from admin-level escalation or removal.
- Member lookup by email MUST avoid exposing more user data than needed.
- Organization access must be used as a base control for devices, sites, and events.

## Success Criteria

### Measurable Outcomes

- **SC-001**: A user can create an organization and immediately receive owner role.
- **SC-002**: Non-members cannot view organization details or member lists.
- **SC-003**: Admins cannot create, alter, or remove owner roles.

## Assumptions

- WorkOS-authenticated users are synchronized into the local `users` table before membership operations.
- The v2 installer role is used by device claim flows even though the organization route enum currently omits it.
- Organization deletion behavior is service-defined and may depend on related records.

## Gaps And Risks

- Dedicated organization authorization tests were not identified in the migration scan.
- Role enum drift exists between v2 database roles and the organization route model.

## Out Of Scope

- Invitation emails or external identity-provider organization sync.
- Billing or subscription enforcement.
- Adding plan/task artifacts or code changes.