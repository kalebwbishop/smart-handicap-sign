# MVP Status

## Current MVP position

The Smart Handicap Sign MVP is partially built. The core product direction is clear and many backend, frontend, hardware, and database pieces exist, but the app is not ready for a production or customer-facing MVP until the critical claim-flow, security, notification, QR contract, and verification gaps below are completed.

## Done

### Product and architecture

- Product concept is defined as an IoT accessibility system for smart handicap parking sign management.
- The repo contains separate areas for backend, frontend, database, hardware firmware, AI inference, nginx, certificates, Docker, and Terraform.
- Device registration is documented in `REGISTRATION.md`.
- Overall system design is documented in `DESIGN.md`.
- Hardware behavior is documented in `HARDWARE.md`.

### Device registration and lifecycle model

- QR-code-based device registration flow is documented.
- Serial number format is defined as `SHS-YYMM-MDL-BBB-SSSSS-C`.
- Claim ID format and security intent are documented, including one-time use, revocation, expiration, and hashed storage.
- Device lifecycle states are defined: `manufactured`, `unclaimed`, `claiming`, `active`, `lost`, `revoked`, and `retired`.
- v2 database schema exists in `database/schemas/shs_schema_v2.sql`.
- v2 schema includes device-oriented tables such as devices, organizations, organization members, sites, parking spaces, installations, device events, and audit logs.

### Backend API foundations

- FastAPI backend structure exists under `backend/app`.
- WorkOS authentication wiring exists.
- Device claim endpoints exist:
  - `POST /api/v1/device-claims/validate`
  - `POST /api/v1/device-claims/claim`
- Device lifecycle endpoints exist for listing, retrieving, acknowledging, resolving, revoking, transferring, releasing, regenerating claims, and reading events.
- Backend tests exist for device claims, lifecycle behavior, serial validation, claim IDs, IDOR protection, inference security, nginx headers, and open redirect protection.

### Frontend foundations

- React Native / Expo frontend exists under `frontend`.
- Authenticated API client wiring exists.
- Device claim flow screens exist for QR scan, claim validation, organization/site/space assignment, installation photos, and confirmation.
- TypeScript types exist for device and claim-related data.
- Expo app configuration includes custom app schemes.

### Hardware and inference foundations

- Hardware firmware exists under `hardware`.
- Hardware code loads device identity and posts inference samples with a `serial_number`.
- AI/inference code exists for classifying sign interaction events.
- Backend inference route can update device operational state when a wave/assistance event is detected.

### Infrastructure and operations

- Docker Compose setup exists.
- Nginx configuration exists.
- Certificate-related files and renewal script exist.
- Terraform directory exists for cloud infrastructure work.

## Still needs complete before MVP

### Critical blockers

1. Fix valid claim validation success path.
   - Current risk: the backend claim validation service can return a successful result that is missing fields required by the route response builder.
   - Impact: a valid QR/claim code can return a server error instead of allowing installation to continue.
   - Needed: make the service and route response contract match, including `lifecycle_status` and `hardware_revision`, and add a route-level success test.

2. Enforce organization/site/parking-space ownership during claim and transfer.
   - Current risk: claim and transfer flows trust caller-provided `site_id` and `parking_space_id`.
   - Impact: a device could be attached to another organization's site or parking space.
   - Needed: validate in the same transaction that the parking space belongs to the requested site and the site belongs to the target organization. Reject occupied spaces unless the same device is being transferred.

3. Add real device authentication for telemetry/inference writes.
   - Current risk: `/inference/classify` accepts anonymous requests using only a supplied serial number.
   - Impact: anyone who can reach the endpoint can spoof assistance requests for a known serial number.
   - Needed: require a device credential before accepting telemetry that mutates device state. MVP options include per-device secret, signed request, short-lived provisioning token, mTLS, or another explicit device-auth mechanism.

4. Repair assistance event and notification flow for the v2 schema.
   - Current risk: inference still routes assistance notifications through legacy `signs` logic.
   - Impact: wave/assistance classification can appear successful while notifications fail.
   - Needed: create assistance events in `device_events`, resolve organization from the device record, and fan out notifications through the v2 device/org model.

### Claim flow contract gaps

1. Pick and implement one canonical QR/deep-link contract.
   - Current mismatch:
     - `DESIGN.md` references a `/claim` URL with `claim_id`.
     - `REGISTRATION.md` references a `/setup` URL with `claim`.
     - The app route and scanner expect only part of this contract.
   - Needed: align docs, QR payload generation, app linking prefixes, route path, and scanner parser.

2. Normalize backend and frontend claim error codes.
   - Current mismatch: backend service emits uppercase error codes while route mapping and frontend types expect lowercase values.
   - Impact: incorrect HTTP status mapping and generic frontend errors.
   - Needed: define one API error-code contract and apply it consistently in backend routes, frontend types, and UI copy.

3. Complete installer-facing happy-path validation.
   - Needed: verify the full QR scan -> validate claim -> assign org/site/space -> upload photos -> confirm activation flow works in the app against the backend.

### Frontend completion

- Resolve TypeScript compile errors.
- Confirm all claim-flow screens are reachable through navigation and deep links.
- Validate camera permissions, QR parsing, and manual fallback behavior on real devices.
- Confirm installation photo capture/upload behavior is implemented end to end.
- Add user-facing loading, empty, and error states for claim validation and claim execution.
- Remove or separate stale social-app UI/features that are not part of the Smart Handicap Sign MVP.

### Backend completion

- Finish v2 device event and notification integration.
- Add route-level tests for successful claim validation and claim execution.
- Add security tests for cross-organization claim and transfer attempts.
- Add tests for canonical claim error-code responses.
- Add tests for authenticated device telemetry.
- Confirm rate limiting and auth requirements are applied to all state-mutating endpoints.
- Ensure broad exception handling does not hide failed notification or event creation paths.

### Hardware completion

- Add secure device credential provisioning.
- Store device credentials safely on hardware.
- Sign or authenticate telemetry requests.
- Confirm hardware posts to the canonical backend endpoint and handles failures/retries.
- Document manufacturing/provisioning steps for serial number, claim ID, QR label, and device credential.

### Database and data operations

- Confirm v2 schema migration path from any existing v1/signs data.
- Add seed/dev data for organizations, sites, parking spaces, devices, and claim IDs.
- Enforce or validate organization -> site -> parking-space consistency.
- Confirm indexes and constraints support claim, transfer, event, and notification queries.
- Document how to apply migrations locally and in deployment.

### Infrastructure and deployment

- Confirm the Docker Compose setup can run the backend, database, frontend dependencies, and any required services from a clean checkout.
- Document required environment variables for backend, frontend, WorkOS, certificates, device auth, and storage.
- Decide whether Azure/Terraform is required for the MVP or can wait.
- Add deployment steps for a staging MVP environment.
- Add production-safe logging and monitoring for claim failures, telemetry failures, and notification failures.

### Documentation cleanup

- Update `README.md` to remove stale social-app features such as profiles, posts, feed, and messaging unless they are intentionally still in scope.
- Update backend technology references in `README.md`; the current backend is FastAPI/Python, while parts of the README still reference Express/TypeScript.
- Align `README.md`, `DESIGN.md`, and `REGISTRATION.md` around the same MVP flow and QR URL contract.
- Add a short "Run locally" path that works from a clean machine.
- Add a short "MVP demo script" for validating the end-to-end installer flow.

## Suggested MVP acceptance criteria

The MVP should be considered complete when all of the following are true:

1. An installer can scan a QR code and validate a real unclaimed device.
2. The installer can assign the device to an organization, site, and parking space they are authorized to manage.
3. The backend prevents cross-organization claim and transfer attempts.
4. The device becomes active and an installation record, device event, and audit log are created.
5. Hardware can send authenticated telemetry for its own serial number only.
6. A wave/assistance event creates a v2 device event and sends the expected notification.
7. The frontend displays clear success and error states for the complete claim flow.
8. The canonical QR/deep-link URL works both from a camera scan and inside the app scanner.
9. Backend tests pass from documented setup steps.
10. Frontend type check/build passes from documented setup steps.

## Recommended next work order

1. Fix backend claim validation response contract.
2. Add organization/site/parking-space validation to claim and transfer.
3. Define and implement device authentication for telemetry.
4. Move assistance events and notifications fully onto the v2 device schema.
5. Align QR/deep-link and claim error-code contracts across docs, backend, and frontend.
6. Clean up README and local setup instructions.
7. Run and stabilize backend tests and frontend type checks.
