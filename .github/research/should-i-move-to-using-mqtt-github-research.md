# Should Hazard Hero Move to MQTT?

## Executive Summary

Do **not** move Hazard Hero to MQTT for the current pilot. The repository evidence shows a deliberately simple HTTPS REST architecture: ESP-IDF firmware polls device status and posts classification samples over HTTPS, the backend handles inference/status/notifications synchronously, and the mobile app uses REST polling plus Expo push notifications.[^1][^2][^3] MQTT is absent from the implementation, dependencies, configuration, deployment, and documentation; adding it would require a new broker, new auth/ACL model, backend MQTT lifecycle work, and firmware concurrency changes.[^4][^5][^6]

MQTT is worth revisiting after the pilot if the project grows into a fleet where polling overhead, offline detection latency, server-pushed device commands, or OTA distribution become real requirements.[^7][^8] For now, the same pain points can be addressed with much lower-risk improvements: HTTP keep-alive in firmware, reducing heartbeat database writes, increasing the non-available status poll interval, wiring push receipt to refresh the mobile screen, and optionally adding SSE for foreground mobile updates.[^9]

## Recommendation

Stay on HTTPS REST for the pilot. Treat MQTT as a post-pilot architecture option, most likely for device status/heartbeat/LWT first, not for the gesture-classification request/response path.[^10][^11]

Recommended order:

1. Keep `POST /api/v1/inference/classify` as HTTPS because the firmware currently expects a synchronous `{label, confidence}` response and the backend does inference, state transition, notification creation, and push dispatch in one request path.[^12][^13]
2. Reduce current HTTP costs before introducing a broker: enable HTTP keep-alive, throttle or remove per-status-poll `last_seen_at` writes, and increase the non-available status poll interval.[^14][^15]
3. Improve staff UX with existing push/REST mechanics: on push receipt, trigger an immediate Home refresh; if foreground latency remains a problem, add SSE before MQTT for mobile real-time updates.[^16][^17]
4. Revisit MQTT after pilot when fleet size, server-pushed commands, OTA, or real-time offline detection justify broker infrastructure and persistent connections.[^7][^8]

## Current Architecture

```mermaid
flowchart TD
    ESP32[ESP32 firmware] -->|GET /api/v1/devices/{serial}/status| Backend[FastAPI backend]
    ESP32 -->|POST /api/v1/inference/classify| Backend
    Backend -->|asyncpg SQL| DB[(PostgreSQL)]
    Backend -->|Expo Push API| Expo[Expo/APNs]
    Expo --> Staff[Staff mobile app]
    Staff -->|REST polling: devices + notifications| Backend
    Staff -->|acknowledge / resolve REST actions| Backend
```

The active firmware is a single-task blocking loop: poll status, set LED, if available collect ADC samples, POST classify samples, then delay before repeating.[^18] The firmware uses `esp_http_client` for both status and classify, creates/cleans up an HTTP client per request, and has no MQTT component in the build.[^14][^19] The mobile app polls Home data every 30 seconds and performs a foreground notification sync every 15 seconds; push notifications are the out-of-band alert mechanism.[^3][^16]

## Key Findings

### MQTT does not exist in the repo today

Research found no active MQTT implementation, broker config, dependency, topic naming, or deployment resource.[^4][^5] Backend dependencies do not include MQTT libraries, backend settings expose no broker fields, firmware CMake does not link the ESP-IDF MQTT component, and Terraform does not provision a broker.[^5][^6][^19]

### The pilot scope does not justify the infrastructure cost

Project documentation frames the current product as a single-sign, single-site pilot, with fleet management, multi-sign dashboards, OTA, and production scale deferred until after the pilot.[^7] That matters because MQTT's biggest advantages appear when many devices need persistent bidirectional messaging, broker-level fan-out, LWT/offline signaling, or fleet command distribution.[^8]

### MQTT fits status/heartbeat better than classify

MQTT maps well to status push and Last Will and Testament: the backend could publish retained status messages and receive LWT/offline events instead of relying on polling/staleness.[^10][^20] It maps less cleanly to classification because the current firmware sends samples and waits synchronously for a classification result; MQTT would require publish/subscribe result correlation, timeout handling, queues, and WDT-safe waits.[^11][^13]

### Backend services are partially MQTT-ready, but auth and lifecycle are not

The DB-backed status transition function already uses row locks and transactional notification creation, which would remain useful from an MQTT message handler.[^21] However, device auth is currently HTTP-header based (`Bearer <serial>:<token>`) and would need to move to broker connect-time authentication or a broker auth plugin; FastAPI lifespan would also need to manage an MQTT client/subscriber alongside the database pool.[^22][^23]

### The data model needs additions for safe MQTT delivery

The schema has useful pieces: `device_events` with JSONB payloads, `devices.last_seen_at`, an `offline` enum value, and a notification uniqueness constraint per `device_event_id`.[^24][^25] It lacks MQTT-specific safety fields such as message id/idempotency key, MQTT client/session tracking, connected/disconnected timestamps, and a path for LWT-driven offline transitions.[^26]

### Mobile direct MQTT is not the best next step

The app already receives background alerts via Expo push and uses polling for catch-up state.[^3][^16] Direct mobile MQTT would add broker WebSocket/TLS support, React Native MQTT client complexity, and user/topic authorization tied to WorkOS. SSE from FastAPI is a lower-risk fit for foreground server-to-client updates because the mobile app only needs one-way status/event updates.[^17]

## Decision Matrix

| Option | Benefit | Cost/Risk | Verdict |
|---|---:|---:|---|
| Stay HTTPS REST as-is | Lowest implementation risk | Keeps polling/TLS/DB-write inefficiencies | Acceptable for pilot, but tune it |
| HTTP keep-alive | Removes repeated TLS handshakes | Small firmware refactor | Do before MQTT |
| Throttle/remove status `last_seen_at` writes | Reduces DB write load | Small backend behavior change | Do before MQTT |
| Push-triggered Home refresh | Improves staff UX immediately | Small mobile change | Do before MQTT |
| SSE for mobile | Near-real-time foreground UI | Medium backend/mobile work | Prefer over mobile MQTT |
| MQTT status + LWT only | Better device status/offline model | Broker + firmware MQTT + backend publish | Good post-pilot phase |
| Full MQTT classify | Persistent transport + QoS | Highest complexity; async result correlation | Defer unless fleet requirements demand it |

## What a Post-Pilot MQTT Migration Would Look Like

```mermaid
flowchart TD
    ESP32[ESP32 firmware] -->|MQTT CONNECT serial/token| Broker[MQTT broker]
    Backend[FastAPI MQTT worker] -->|publish retained status| Broker
    Broker -->|devices/{serial}/status| ESP32
    ESP32 -->|devices/{serial}/heartbeat or LWT| Broker
    Broker -->|heartbeat/offline event| Backend
    Backend --> DB[(PostgreSQL)]
    Backend -->|Expo push / REST / SSE| Staff[Staff app]
    ESP32 -->|Optional later: samples topic| Broker
    Broker -->|Optional later: classify result topic| ESP32
```

A low-risk MQTT migration should start with status and LWT only: add broker infrastructure, add backend publish/subscribe lifecycle, publish retained `devices/{serial}/status` after state transitions, and have firmware subscribe for LED state instead of polling.[^10][^23] Only after that path is stable should classification move to MQTT, because that requires async result topics, correlation IDs, buffer sizing, and WDT-safe firmware waits.[^11]

## Lower-Risk Improvements to Do First

1. **Enable HTTP keep-alive in firmware.** The current code initializes and cleans up an `esp_http_client` per request; keep-alive addresses MQTT's main transport-efficiency argument without a broker.[^14]
2. **Stop writing `last_seen_at` on every status GET or throttle it.** The status endpoint currently updates `last_seen_at` on every firmware poll even though the stale threshold is much larger than the poll interval.[^15][^27]
3. **Increase non-available status poll interval.** The firmware polls every 3 seconds while not available; a 10-15 second interval would reduce request load while preserving acceptable pilot behavior.[^18]
4. **Trigger mobile refresh on push receipt.** The mobile app already has push listeners and Home refresh logic; wiring them together reduces the perceived need for real-time sockets.[^16]
5. **Consider SSE before MQTT for mobile foreground updates.** SSE matches the one-way backend-to-mobile update need with less infrastructure than broker-backed mobile MQTT.[^17]

## Important Related Issue: Sample Count Mismatch

Multiple research passes found a pre-existing sample-count contradiction: active firmware evidence points to the config-defined sample count, while docs/contracts often describe a different sample window.[^28] This should be reconciled before any transport migration, because MQTT would not solve a payload contract mismatch; it would just move the mismatch to a new protocol.

## Confidence Assessment

**High confidence:** The current implementation is HTTPS REST/polling plus Expo push, not MQTT; no MQTT broker/config/dependency exists; the pilot scope is single-sign and does not require MQTT; full MQTT classify migration is materially more complex than status/LWT migration.[^1][^4][^5][^7][^11]

**Medium confidence:** HTTP keep-alive, throttled heartbeat writes, push-triggered refresh, and SSE are lower-risk alternatives that address most near-term pain points. This is based on repository structure and code behavior; exact implementation effort would need direct engineering work.[^9][^14][^16][^17]

**Lower confidence / assumptions:** Managed broker choice is inferred from the Azure Container Apps/Terraform deployment context rather than an existing architecture decision. Cost and fleet thresholds are directional because no target device count or latency SLA is documented.[^6][^7]

## Footnotes

[^1]: `firmware/main/main.c:283-333`; `firmware/main/https_client.c:354-470`; `backend/app/routes/inference.py:53-124`; `backend/app/routes/devices.py:66-75`
[^2]: `backend/app/services/device_service.py:113-194`; `backend/app/services/notification_service.py:53-93`; `backend/app/services/expo_push.py:20-85`
[^3]: `frontend_new/apps/mobile/src/screens/HomeScreen.tsx:29-31,100-106,177-184`; `frontend_new/apps/mobile/App.tsx:37,250-268`
[^4]: Research subagents reported zero active matches for MQTT/WebSocket/SSE implementation across firmware, backend, frontend, configuration, Terraform, and docs.
[^5]: `backend/requirements.txt:1-12`; `backend/.env.example:1-19`; `backend/app/config/settings.py:6-43`
[^6]: `terraform/container_app.tf:29-124`; `terraform/variables.tf:73-76`; `.github/workflows/ci-cd.yml:1-244`
[^7]: `PILOT.md:5,56-78,249-257`; `README.md:3,26-33`
[^8]: `PILOT.md:249-253`; `README.md:28-32`; `brownfield-specs/esp-idf-firmware-runtime/spec.md:FR-008`
[^9]: `firmware/main/https_client.c:231-283`; `backend/app/routes/devices.py:66-75`; `frontend_new/apps/mobile/src/screens/HomeScreen.tsx:29-31`; `frontend_new/apps/mobile/App.tsx:160-182`
[^10]: `firmware/main/main.c:104-131,283-306`; `backend/app/services/device_service.py:113-194`; `database/schemas/shs_schema_v2.sql:26-32,77-109`
[^11]: `firmware/main/https_client.c:354-429`; `firmware/main/main.c:317-329`; `firmware/main/adc_sampler.h:9-12`
[^12]: `backend/app/routes/inference.py:53-124`
[^13]: `firmware/main/https_client.c:394-428`
[^14]: `firmware/main/https_client.c:231-283`
[^15]: `backend/app/routes/devices.py:66-75`; `backend/app/services/device_service.py:92-110`
[^16]: `frontend_new/apps/mobile/App.tsx:160-182,272-312,334-356`; `frontend_new/apps/mobile/src/screens/HomeScreen.tsx:158-219`
[^17]: `backend/app/main.py:40-48`; `backend/app/config/database.py:21-28`; `brownfield-specs/notifications-push/spec.md:151-152`
[^18]: `firmware/main/main.c:23-30,283-333`
[^19]: `firmware/main/CMakeLists.txt:12`; `firmware/sdkconfig.defaults`; `firmware/partitions.csv`
[^20]: `database/schemas/shs_schema_v2.sql:26-32,77-98`; `firmware/main/led_driver.h:9-17`
[^21]: `backend/app/services/device_service.py:113-194`
[^22]: `backend/app/middleware/device_auth.py:26-93`; `firmware/main/https_client.c:177-190`
[^23]: `backend/app/main.py:40-48`; `backend/app/config/database.py:8,16-29`
[^24]: `database/schemas/shs_schema_v2.sql:77-109,127-148`
[^25]: `backend/app/services/notification_service.py:53-93`
[^26]: `database/schemas/shs_schema_v2.sql:6,77-109`; `backend/app/services/device_service.py:92-110,113-194`
[^27]: `frontend_new/apps/mobile/src/screens/pilotStatus.ts:6,45-55`
[^28]: `firmware/main/adc_sampler.h:9-12`; `specs/001-esp-idf-firmware-runtime/contracts/backend-device-api.md:99`; `.github/research/would-it-be-feasable-to-run-the-inference-on-the-e.md:13`
