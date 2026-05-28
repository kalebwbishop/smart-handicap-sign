# Hazard Hero

Hazard Hero is a **one-sign pilot** for accessible parking assistance. The pilot proves one simple loop:

1. A visitor waves at the installed sign.
2. The sign sends a 512-sample reading to the backend.
3. The backend marks the sign as `assistance_requested`.
4. A staff member sees the request in the app, acknowledges it, and resolves it.
5. The sign returns to `available`.

If that loop works reliably for one installed sign, the pilot is successful.

## Pilot scope

### In scope

- One installed ESP32 sign
- One backend environment
- One operator account or one small pilot team
- One mobile operator workflow
- One fixed installation location
- Basic event history for request, acknowledge, and resolve actions

### Explicitly deferred

These items may exist elsewhere in the repo, but they are **not required for pilot launch**:

- Multi-org or fleet management workflows
- Rich site and parking-space administration
- Full QR/device claim operations for scaled deployment
- OTA update workflows
- Push notifications as a launch dependency
- Training-mode productization
- Old social/media/template features from earlier repo history

See `PILOT.md` for the detailed pilot definition and launch checklist.

## Pilot architecture

```text
ESP32 sign
  -> GET /api/v1/devices/{serial}/status
  -> when status == available, collect 512 ADC samples
  -> POST /api/v1/inference/classify
  -> backend changes sign to assistance_requested when a wave is detected
  -> staff app shows the request
  -> staff acknowledges and resolves the request
```

Primary sign states for the pilot:

`available -> assistance_requested -> assistance_in_progress -> available`

## Repository layout

```text
smart-handicap-sign/
├── backend/      FastAPI API, async services, embedded inference
├── frontend/     React Native + Expo operator app
├── database/     PostgreSQL schema and migration scripts
├── firmware/     ESP-IDF firmware for the pilot sign
├── hardware/     Legacy MicroPython implementation
├── ai/           Model training code
└── PILOT.md      Pilot scope and launch checklist
```

## Quick start

### Prerequisites

- Node.js 18+
- Python 3.12 for the backend
- Docker Desktop
- PostgreSQL access via `docker compose`
- WorkOS credentials for auth

### Local setup

1. Install workspace dependencies:

   ```bash
   npm install
   ```

2. Configure environment variables:

   - `backend/.env`
   - `frontend/.env`

3. Start Postgres:

   ```bash
   npm run db:up
   ```

4. Apply the schema:

   ```bash
   npm run db:migrate
   ```

5. Run the backend:

   ```bash
   cd backend
   pip install -r requirements.txt
   uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
   ```

   To open a live matplotlib graph for every inference payload during local debugging,
   set `INFERENCE_DEBUG_PLOT_ENABLED=true` in `backend/.env` before starting the backend.

6. Run the frontend:

   ```bash
   cd frontend
   npm start
   ```

7. Flash and provision the pilot sign using `firmware/README.md`.

## Pilot operations

For the pilot, operators only need to:

1. Log in.
2. Watch the current sign status.
3. Acknowledge a new assistance request.
4. Resolve the request after helping the visitor.

Setup, manufacturing, and scale-out workflows should not be treated as launch blockers.

## Key API endpoints for the pilot

- `GET /health`
- `GET /api/v1/status`
- `GET /api/v1/devices/{serial_number}/status`
- `POST /api/v1/inference/classify`
- `POST /api/v1/devices/{serial_number}/acknowledge`
- `POST /api/v1/devices/{serial_number}/resolve`

## Validation

Useful repo commands for the pilot:

```bash
# Backend tests
cd backend
pytest

# Frontend lint
npm run lint --workspace=frontend

# Frontend tests (placeholder suite)
npm run test --workspace=frontend
```

Firmware validation depends on an ESP-IDF 5.4+ environment; see `firmware/README.md` and `firmware/TEST_PLAN.md`.

## Related docs

- `PILOT.md` - pilot definition and launch checklist
- `firmware/README.md` - flash, configure, and operate the pilot sign
- `firmware/TEST_PLAN.md` - hardware validation checklist for the pilot sign
- `WORKOS_SETUP.md` - auth provider setup

## Status

This repository still contains some post-pilot or legacy building blocks. When documentation and implementation disagree, treat the **one-sign pilot flow** as the current product target.
