---
status: migrated
created: 2026-05-12
source: brownfield-migrate
artifact_scope: spec-only
---

# Feature Specification: Sites And Parking Spaces

**Feature Branch**: `N/A - migrated from existing code`  
**Created**: 2026-05-12  
**Status**: Migrated  
**Input**: Brownfield migration of implemented site and parking space management.

## Summary

Hazard Hero models customer facilities as organization-owned sites with accessible parking spaces. Backend APIs let authorized staff create, view, update, and delete sites and spaces, while the device claim flow consumes these records to assign a physical device to a real parking location.

## User Scenarios & Testing

### User Story 1 - Manage Sites (Priority: P1)

An owner or admin creates and maintains a site for an organization.

**Why this priority**: Devices need a physical deployment context before they can be assigned.

**Independent Test**: Exercise `/api/v1/sites` CRUD endpoints with owner/admin/member and non-member users.

**Acceptance Scenarios**:

1. **Given** an organization admin, **When** the admin creates a site, **Then** the site is stored with organization and address metadata.
2. **Given** a non-member user, **When** the user retrieves the site, **Then** the API returns 403.

### User Story 2 - Manage Parking Spaces (Priority: P1)

An authorized user creates accessible parking spaces within a site.

**Why this priority**: Device installation depends on choosing a valid parking space.

**Independent Test**: Exercise `/api/v1/sites/{site_id}/parking-spaces` and `/api/v1/parking-spaces/{space_id}` endpoints.

**Acceptance Scenarios**:

1. **Given** a valid site and installer role, **When** the user creates a parking space, **Then** the space is returned with a site ID and accessible type.
2. **Given** a space currently assigned to a device, **When** an admin attempts deletion, **Then** the API rejects deletion with a conflict.

### User Story 3 - Select A Deployment Location (Priority: P2)

An installer claims a device and selects a site and parking space during assignment.

**Why this priority**: Site and space data becomes operational only when tied to installation.

**Independent Test**: Use the claim assignment screen/API to select available spaces and verify cross-site or occupied-space rejection.

**Acceptance Scenarios**:

1. **Given** a site with available spaces, **When** the installer opens assignment, **Then** selectable spaces are limited to that site.
2. **Given** a parking space from a different site, **When** the claim is submitted, **Then** the backend rejects the mismatch.

### Edge Cases

- Missing site, deleted site, or site outside the user's organizations.
- Empty parking-space list for a valid site.
- Invalid or unsupported accessible type values.
- Deleting a parking space with an assigned device.
- Creating or updating a space without required label data.

## Requirements

### Functional Requirements

- **FR-001**: System MUST store sites under organizations with name and optional address/jurisdiction fields.
- **FR-002**: System MUST list only sites available to the authenticated user's organizations.
- **FR-003**: System MUST require owner or admin role to create, update, or delete sites.
- **FR-004**: System MUST store parking spaces under sites with label, accessible type, optional coordinates, notes, and current device assignment.
- **FR-005**: System MUST allow owner, admin, or installer roles to create parking spaces.
- **FR-006**: System MUST require owner or admin role for parking-space updates and deletes.
- **FR-007**: System MUST prevent deletion of a parking space that still has an assigned device.
- **FR-008**: System MUST make site and parking-space records available to the device claim flow.

### Affected Modules

- **Backend (`backend/`)**: `routes/sites.py`, `routes/parking_spaces.py`, `services/site_service.py`, `services/parking_space_service.py`.
- **Frontend (`frontend/`)**: `src/api/sites.ts` and claim assignment UI.
- **Database (`database/`)**: v2 `sites` and `parking_spaces` tables and seed data.
- **Firmware (`firmware/`)**: N/A.
- **Legacy Hardware (`hardware/`)**: N/A.
- **AI (`ai/`, `backend/app/ai/`)**: N/A.
- **Infrastructure**: N/A.
- **Documentation**: Registration/deployment documentation may reference site and space assignment.

### API Requirements

- **Endpoint(s)**: `GET /api/v1/sites`, `POST /api/v1/sites`, `GET /api/v1/sites/{site_id}`, `PATCH /api/v1/sites/{site_id}`, `DELETE /api/v1/sites/{site_id}`, `GET /api/v1/sites/{site_id}/parking-spaces`, `POST /api/v1/sites/{site_id}/parking-spaces`, `GET /api/v1/parking-spaces/{space_id}`, `PATCH /api/v1/parking-spaces/{space_id}`, `DELETE /api/v1/parking-spaces/{space_id}`.
- **Authentication**: WorkOS user auth required.
- **Authorization**: Site access requires membership in the owning organization. Mutations require owner/admin, except parking-space creation also allows installer.
- **Request Payload**: Site creation/update accepts organization, name, address, country, and jurisdiction fields. Parking-space creation/update accepts label, accessible type, coordinates, and notes.
- **Response Payload**: Site and parking-space records include IDs, ownership, timestamps, and current device assignment when applicable.
- **Backward Compatibility**: This is part of the v2 deployment model and does not replace legacy v1 signs directly.

### Database Requirements

- **Schema Target**: v2 device lifecycle schema.
- **Entities/Tables**: `organizations`, `sites`, `parking_spaces`, `devices`, `installations`.
- **Migration Behavior**: Seed data in `dev_data_v2.sql` creates sample organizations, sites, spaces, devices, and installations.
- **Indexes/Constraints/Enums**: `accessible_parking_type` governs supported space types; foreign keys link sites to organizations and spaces to sites.
- **Rollback/Recovery**: No feature-specific rollback is documented.

### Frontend Requirements

- **Screens/Navigation**: Claim assignment uses site and parking-space data. Dedicated site management screens were not identified in the scan.
- **State/API Integration**: Frontend API client must pass auth tokens through the shared Axios client.
- **Design System**: Any UI must use `frontend/src/theme/` tokens.
- **States**: Loading, empty site list, empty parking-space list, unauthorized, conflict, and validation errors.
- **Platforms**: Native and web should share API behavior.

### Key Entities

- **Site**: Organization-owned physical location with address and jurisdiction metadata.
- **Parking Space**: Accessible parking location inside a site, optionally assigned to a current device.

## Security & Privacy Requirements

- Site and parking-space access MUST be scoped through organization membership.
- Site and parking-space mutation MUST be role gated.
- Location metadata and coordinates MUST only be exposed to authorized organization members.
- Device claim logic MUST revalidate site and parking-space ownership server-side.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Authorized users can create a site and at least one parking space that can be selected during device claim.
- **SC-002**: Cross-organization site/space access returns 403.
- **SC-003**: Occupied spaces cannot be deleted or claimed by another device.

## Assumptions

- Sites are always owned by exactly one organization.
- Parking spaces belong to exactly one site.
- An installer role exists in v2 membership data for field setup workflows.

## Gaps And Risks

- Backend tests specifically for sites and parking spaces were not found in the migration scan.
- Dedicated frontend management screens for sites/spaces were not identified beyond the claim assignment path.

## Out Of Scope

- Geospatial search, maps, or routing.
- Bulk import of sites or spaces.
- Adding plan/task artifacts or changing schema/code.