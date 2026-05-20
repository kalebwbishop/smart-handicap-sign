---
status: migrated
created: 2026-05-12
source: brownfield-migrate
artifact_scope: spec-only
---

# Feature Specification: Auth And Security Hardening

**Feature Branch**: `N/A - migrated from existing code`  
**Created**: 2026-05-12  
**Status**: Migrated  
**Input**: Brownfield migration of implemented authentication and security hardening behavior.

## Summary

Hazard Hero uses a shared WorkOS/deploy-box authentication package for user auth, local middleware re-exports for route dependencies, device bearer-token authentication for hardware classify calls, claim rate limiting, redirect allow-listing, and reverse-proxy security header tests. The active auth router is built dynamically from `backend/app/config/auth.py` rather than a static `backend/app/routes/auth.py` file.

## User Scenarios & Testing

### User Story 1 - Sign In And Resolve Current User (Priority: P1)

A staff user signs in through WorkOS and the backend resolves the current user and profile.

**Why this priority**: All staff-facing APIs depend on authenticated user identity.

**Independent Test**: Exercise the shared auth router and `/auth/me` behavior through configured WorkOS/deploy-box dependencies.

**Acceptance Scenarios**:

1. **Given** a valid WorkOS-authenticated request, **When** the route depends on `get_current_user`, **Then** the current user ID is available to authorization checks.
2. **Given** no valid user token, **When** a protected endpoint is called, **Then** the API returns unauthorized.

### User Story 2 - Prevent Unsafe Redirects (Priority: P1)

The auth callback only redirects to allowed frontend/native prefixes.

**Why this priority**: OAuth redirect handling must not enable open redirect vulnerabilities.

**Independent Test**: Run open redirect regression tests for allowed and blocked callback state values.

**Acceptance Scenarios**:

1. **Given** an allowed redirect prefix, **When** auth callback completes, **Then** the backend redirects to that target.
2. **Given** a malicious redirect URL, **When** auth callback processes state, **Then** the backend rejects it.

### User Story 3 - Authenticate Devices And Rate Limit Claims (Priority: P1)

Hardware devices submit telemetry with device bearer credentials and claim endpoints are throttled.

**Why this priority**: Device telemetry and claim IDs are high-risk external inputs.

**Independent Test**: Use device auth and inference security tests plus claim rate-limit behavior.

**Acceptance Scenarios**:

1. **Given** a bearer credential in `<serial>:<token>` form, **When** token hash matches backend storage, **Then** the device identity is resolved.
2. **Given** repeated claim attempts for the same IP or serial, **When** limits are exceeded, **Then** the API returns 429 with `Retry-After`.

### Edge Cases

- Corrupt auth callback state.
- Missing WorkOS user profile row.
- Unknown device serial, missing device token hash/salt, or wrong token.
- Forwarded client IP headers behind a proxy.
- Corporate proxy SSL bypass in non-cloud environment.

## Requirements

### Functional Requirements

- **FR-001**: System MUST build the auth router from shared deploy-box auth configuration.
- **FR-002**: System MUST expose route dependencies for `CurrentUser`, `get_current_user`, and `optional_auth` through local middleware imports.
- **FR-003**: System MUST constrain OAuth redirect targets to configured allowed prefixes.
- **FR-004**: System MUST resolve `/auth/me` profile data from local `users` and `profiles` tables.
- **FR-005**: System MUST authenticate device bearer credentials as `Bearer <serial>:<token>`.
- **FR-006**: System MUST compare device token hashes with constant-time comparison.
- **FR-007**: System MUST rate-limit device claim validation and claim execution attempts.
- **FR-008**: System MUST preserve deployment security header expectations where infrastructure manages them.

### Affected Modules

- **Backend (`backend/`)**: `config/auth.py`, `middleware/auth.py`, `middleware/device_auth.py`, `middleware/rate_limiter.py`, `config/settings.py`, and auth router mounted by `main.py`.
- **Frontend (`frontend/`)**: Login and token handling depend on auth router contracts.
- **Database (`database/`)**: `users`, `profiles`, and `devices` auth token fields.
- **Firmware (`firmware/`)**: Device bearer token is required for classify submissions.
- **Legacy Hardware (`hardware/`)**: Legacy client must match any auth contract if used.
- **AI (`ai/`, `backend/app/ai/`)**: N/A.
- **Infrastructure**: Deployment security headers and non-cloud SSL behavior.
- **Documentation**: Auth flow documented in project instructions and README-style docs.

### API Requirements

- **Endpoint(s)**: Auth endpoints are created by shared deploy-box router under `/api/v1/auth/*`; device auth protects `POST /api/v1/inference/classify`; claim rate limits protect `/api/v1/device-claims/*`.
- **Authentication**: WorkOS user auth for staff routes; device bearer token for hardware telemetry.
- **Authorization**: Auth identifies users/devices; feature-specific routes layer organization and ownership checks on top.
- **Request Payload**: Device credentials use the authorization header. Claim rate limiter parses serial/user identifiers from JSON request bodies.
- **Response Payload**: Auth router behavior comes from deploy-box; device auth failures return 401; rate-limit failures return 429.
- **Backward Compatibility**: Local middleware re-export preserves existing import surfaces while delegating to shared auth.

### Database Requirements

- **Schema Target**: v1/v2 user profile data and v2 device token data.
- **Entities/Tables**: `users`, `profiles`, `devices`.
- **Migration Behavior**: v2 migration preserves users/profiles and creates device auth fields.
- **Indexes/Constraints/Enums**: N/A beyond existing user/device keys.
- **Rollback/Recovery**: N/A.

### Frontend Requirements

- **Screens/Navigation**: Login and authenticated app navigation depend on auth state.
- **State/API Integration**: Axios interceptors and token refresh must align with auth router outputs.
- **Design System**: N/A.
- **States**: unauthenticated, expired token, refresh failure, redirect failure.
- **Platforms**: Native app redirect prefixes include `smartsign://` and Expo prefixes.

### Device/Firmware Requirements

- **Runtime Target**: ESP-IDF firmware sends device bearer tokens for classify.
- **Device Identity/Auth**: Token must match hash/salt in database.
- **Provisioning/Wi-Fi**: Auth token must be provisioned into NVS or classification will fail.
- **Telemetry/API Payloads**: Device serial in credentials must match payload serial.
- **Reliability**: Auth failures should be logged and retried according to firmware policy.

### Key Entities

- **CurrentUser**: Authenticated staff identity provided to route handlers.
- **AuthenticatedDevice**: Resolved hardware identity with serial and optional organization.
- **Rate Limit Key**: IP, serial, or user/serial scoped sliding-window key.

## Security & Privacy Requirements

- Redirect allow-listing MUST prevent arbitrary external redirects.
- Device token checks MUST use stored salt/hash and constant-time comparison.
- Claim rate limiting MUST limit brute-force attempts across multiple scopes.
- Security tests MUST continue to cover open redirect, inference auth, and claim-related hardening.
- User/profile/device identifiers MUST not be leaked across failed auth boundaries.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Protected user routes reject anonymous requests and receive a resolved current user for valid tokens.
- **SC-002**: Malicious OAuth redirect targets are blocked by tests.
- **SC-003**: Device classification rejects anonymous, malformed, unknown, and wrong-token credentials.

## Assumptions

- The shared `deploy_box.auth` package is available in the backend environment.
- Auth route behavior is intentionally centralized in `backend/app/config/auth.py`.
- Non-cloud SSL bypass is a development/corporate proxy workaround, not production behavior.

## Gaps And Risks

- Auth router exact endpoint list is defined by the external deploy-box package and not directly visible in local route files.
- In-memory rate limiting is process-local and may not scale across multiple backend replicas.
- Device provisioning of auth tokens requires operational discipline outside this spec.

## Out Of Scope

- Replacing WorkOS or deploy-box auth.
- Introducing distributed rate limiting.
- Adding plan/task artifacts or changing code.