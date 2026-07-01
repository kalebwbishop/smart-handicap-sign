# Pilot checklist

This checklist is the launch gate for the **single-sign physical pilot**.

The pilot is ready only when the one-sign loop works end to end:

1. The sign boots.
2. The sign connects to Wi-Fi.
3. The sign polls backend status.
4. The sign samples the photoresistor only when status is `available`.
5. A real wave triggers `assistance_requested`.
6. The operator can acknowledge and resolve the request.
7. The system recovers after temporary Wi-Fi or backend loss.

## 1. Environment readiness

- [x] Backend environment is configured.
- [x] Frontend environment is configured.
- [x] Database connection string points at the pilot PostgreSQL instance.
- [x] WorkOS auth credentials are present.
- [ ] Pilot sign serial number and auth token are available.
- [ ] Pilot Wi-Fi credentials are available.
- [ ] Pilot backend URL includes `/api/v1`.
- [ ] TLS CA certificate matches the pilot backend chain.

## 2. Database readiness

- [ ] Pilot schema is applied cleanly.
- [ ] Seeded pilot device row exists.
- [ ] `device_events` stores request payloads and false-positive labels.
- [ ] `notifications`, `notification_preferences`, and `push_tokens` behave as expected for the pilot workflow.

## 3. Backend readiness

- [ ] `GET /health` returns healthy.
- [ ] `GET /api/v1/status` returns the API version and timestamp.
- [ ] `GET /api/v1/devices/{serial_number}/status` returns the installed sign state.
- [ ] `POST /api/v1/inference/classify` accepts the configured sample window.
- [ ] `POST /api/v1/devices/{serial_number}/acknowledge` transitions `assistance_requested` to `assistance_in_progress`.
- [ ] `POST /api/v1/devices/{serial_number}/resolve` returns the sign to `available`.
- [ ] `POST /api/v1/devices/{serial_number}/events/{device_event_id}/false-positive` marks false positives correctly.

## 4. Frontend readiness

- [ ] Operator can log in.
- [ ] Operator can see the pilot sign status.
- [ ] Operator can acknowledge a new assistance request.
- [ ] Operator can resolve a request after helping the visitor.
- [ ] Operator can mark a request as false positive.

## 5. Firmware readiness

- [ ] Firmware builds with ESP-IDF 5.4+.
- [ ] Firmware is flashed successfully to the installed ESP32.
- [ ] Device identity is preloaded or generated as expected.
- [ ] Wi-Fi provisioning works as recovery mode.
- [ ] Status polling works while connected to the pilot backend.
- [ ] LED patterns match backend state.
- [ ] Classification only runs when status is `available`.
- [ ] Device recovers after temporary Wi-Fi loss.

## 6. Physical installation readiness

- [ ] Sign is mounted at the pilot location.
- [ ] Power is stable.
- [ ] Wi-Fi coverage is strong enough at the install location.
- [ ] ADC/photoresistor wiring is correct.
- [ ] Operator can observe the sign and use the app during a live request.

## 7. Pilot validation run

- [ ] Run a boot test.
- [ ] Run a Wi-Fi reconnect test.
- [ ] Run a status poll test.
- [ ] Run a real wave detection test.
- [ ] Run an acknowledge/resolve test.
- [ ] Run a false-positive labeling test.
- [ ] Run a temporary backend outage test.
- [ ] Run a temporary Wi-Fi outage test.

## Go / no-go

**Go** only if every required checkbox above is complete and the live end-to-end loop works on the installed sign.

**No-go** if any of these still fail:

- boot or Wi-Fi provisioning
- backend status polling
- wave detection and classification
- acknowledge / resolve flow
- recovery from transient connectivity loss
