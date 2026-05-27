# Hazard Hero Pilot Plan

## Pilot definition

This pilot is a **single-sign, single-site proof of concept**. The goal is to prove one real-world outcome:

1. A visitor triggers a help request at the sign.
2. The backend records the request and changes the sign status.
3. A staff member sees the request quickly.
4. Staff acknowledges the request.
5. Staff resolves the request and the sign returns to available.

If that loop works reliably with one installed sign, the pilot is successful.

## What the pilot should include

### Core scope

- **One physical sign**
- **One backend environment**
- **One organization or one shared operator account**
- **One staff-facing mobile app flow**
- **One notification path**: app polling is acceptable; push notifications are optional
- **One install location**
- **Basic event history** for requests, acknowledgements, and resolutions

### Required states

- `available`
- `assistance_requested`
- `assistance_in_progress`
- return to `available`

### Required working surfaces in this repo

- **Firmware/device loop**
  - Poll sign status
  - Sample and send wave data
  - Respect backend status before classifying
- **Backend**
  - `POST /api/v1/inference/classify`
  - `GET /api/v1/devices/{serial_number}/status`
  - `POST /api/v1/devices/{serial_number}/acknowledge`
  - `POST /api/v1/devices/{serial_number}/resolve`
  - device event logging
- **Frontend**
  - Login
  - Home screen showing current sign status
  - Acknowledge action
  - Resolve action
  - Basic request/event visibility

## What should be removed from pilot scope

These items may remain in the repo, but they should be treated as **out of scope for pilot launch** and not block pilot completion.

### Defer from launch

- Multi-organization administration
- Full member management and role complexity beyond what one pilot operator needs
- Full QR claim/install workflow
- Site and parking-space management UI beyond one seeded assignment
- Device fleet management for many devices
- Transfer / revoke / release workflows for pilot operations
- Claim ID regeneration workflows
- Push-token registration as a launch dependency
- Inference debug screens as part of the operator workflow
- OTA update workflows as a launch dependency
- Advanced firmware provisioning flows unless needed for this one install
- Training states:
  - `training_ready`
  - `training_positive`
  - `training_negative`
- Billing / subscription concepts
- Any old social/media/template leftovers in documentation

### Recommended repo-level simplifications for pilot focus

- **Hide or ignore** non-pilot screens from normal navigation if they distract from the operator flow.
- **Seed one known device** and one known user instead of requiring the full installer claim process.
- **Treat sites / parking spaces as fixed setup data** for the pilot, not operator-managed content.
- **Use polling first**; add push later only if polling is too slow.
- **Make the home screen the primary pilot surface** and avoid requiring operators to visit secondary admin screens.

## What may need to be added or tightened before pilot launch

### Product and UX

- A clearly named **pilot operator flow**:
  - see current sign status
  - see new request
  - acknowledge
  - resolve
- Clear copy for each status so staff can act without training
- A visible last-updated or last-seen timestamp for device freshness
- A simple error/offline indicator for the sign

### Backend

- Confirm `assistance_requested -> assistance_in_progress -> available` is the only supported operator loop for pilot
- Ensure acknowledge and resolve actions create auditable device events
- Ensure one wave does not create noisy duplicate requests while already in a requested/in-progress state
- Ensure device status polling remains lightweight and stable
- Ensure the pilot can run with seeded data and minimal setup steps

### Frontend

- Make the home screen robust when exactly one device is present
- Show the most recent request clearly
- Prevent double taps on acknowledge / resolve actions
- Show actionable failure states if the backend call fails
- Keep navigation minimal for pilot users

### Firmware / device setup

- Lock in the production-like URL and credentials for the pilot device
- Verify the sign behaves safely when backend is unreachable
- Verify LED/status behavior matches the backend state machine
- Verify the sign does not continuously spam classify requests when unavailable

### Documentation and ops

- Update repo-facing docs so the pilot story is obvious
- Document exact install steps for the one pilot sign
- Document operator steps for handling a request
- Document recovery steps for:
  - sign offline
  - backend unavailable
  - sign stuck in requested/in-progress state

## Pilot launch checklist

### Scope freeze

- [ ] Pilot success criteria are limited to one-sign end-to-end assistance handling
- [ ] Non-pilot features are explicitly marked as deferred
- [ ] Operators know which app screens are in scope for launch

### Environment and data

- [ ] Backend environment is deployed and reachable from the sign
- [ ] Database schema is applied
- [ ] Seed data or manual setup creates:
  - [ ] one operator user
  - [ ] one organization or shared pilot account
  - [ ] one active device
  - [ ] one fixed site/parking-space assignment if needed
- [ ] Device serial number and auth token are confirmed

### Device readiness

- [ ] Firmware is flashed on the pilot sign
- [ ] Sign can reach Wi-Fi reliably from the installation location
- [ ] Sign can reach backend endpoints reliably
- [ ] Sign status polling works
- [ ] Wave classification requests succeed
- [ ] LED/status indication is correct for each pilot state

### App readiness

- [ ] Operator can log in
- [ ] Operator can view the pilot sign from the home screen
- [ ] Operator can acknowledge a request
- [ ] Operator can resolve a request
- [ ] Operator can recover from a transient backend failure without app restart

### Operational readiness

- [ ] Staff know what to do when a request appears
- [ ] Staff know expected response-time target for the pilot
- [ ] A contact person is assigned for pilot issues
- [ ] A rollback/manual fallback exists if the sign or backend fails

## Tests that should pass before pilot launch

## 1. Backend API behavior

- [ ] `GET /health` returns healthy in the pilot environment
- [ ] `GET /api/v1/devices/{serial_number}/status` returns the current device state for the pilot sign
- [ ] `POST /api/v1/inference/classify` accepts valid 512-sample payloads from the pilot device
- [ ] A positive classification changes the sign to `assistance_requested`
- [ ] A positive classification creates a device event
- [ ] `POST /api/v1/devices/{serial_number}/acknowledge` changes state to `assistance_in_progress`
- [ ] `POST /api/v1/devices/{serial_number}/resolve` changes state back to `available`
- [ ] Invalid or unauthorized device submissions are rejected
- [ ] Repeated classifications do not create invalid state transitions or unbounded duplicate alerts

## 2. Frontend operator workflow

- [ ] Operator login succeeds
- [ ] Home screen loads with the pilot sign visible
- [ ] Sign status updates are visible without confusing navigation
- [ ] A newly requested assistance event becomes visible to staff quickly enough for the pilot
- [ ] Acknowledge action updates UI and backend state correctly
- [ ] Resolve action updates UI and backend state correctly
- [ ] App handles temporary API failures with a clear retry path

## 3. Device and firmware behavior

- [ ] Device authenticates successfully with backend
- [ ] Device polls status successfully on boot
- [ ] Device only submits classify requests when status is `available`
- [ ] Device remains stable during repeated polling/classification cycles
- [ ] Device recovers cleanly from temporary Wi-Fi loss
- [ ] Device does not enter a broken loop after backend errors

## 4. End-to-end pilot scenario

- [ ] Starting state is `available`
- [ ] A real user wave at the installed sign generates `assistance_requested`
- [ ] Staff sees the request on the app
- [ ] Staff acknowledges the request
- [ ] Sign becomes `assistance_in_progress`
- [ ] Staff resolves the request
- [ ] Sign returns to `available`
- [ ] Event history shows the full sequence with timestamps

## 5. Negative and recovery scenarios

- [ ] Non-wave/noise does not frequently trigger false requests during a short observation run
- [ ] If the backend is down, the device fails safely
- [ ] If the app is unavailable, the request still exists in backend state/event history
- [ ] If a request is already active, additional detections do not break the workflow
- [ ] If the sign reboots, it returns to the correct backend-driven state

## Suggested pilot exit criteria

The pilot is ready to launch when all of the following are true:

- [ ] The one-sign assistance loop works end to end
- [ ] Staff can operate the system without developer intervention
- [ ] The device remains connected and usable in the real install location
- [ ] Failures are understandable and recoverable
- [ ] Deferred features are no longer blocking decisions for launch

## Post-pilot items

These should be evaluated **after** the pilot proves the core workflow:

- Push notifications
- Multi-sign dashboards
- Full installer claim flow
- Rich org/member/site administration
- OTA updates
- Better analytics and reporting
- Training-mode productization
- Production hardening for scale
