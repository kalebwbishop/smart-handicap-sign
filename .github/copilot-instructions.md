# Copilot Instructions — Smart Handicap Sign

IoT accessibility system: ESP32 with photoresistor detects wave gestures near handicap parking signs, a PyTorch 1D CNN classifies the signal, and a React Native app lets staff monitor signs and acknowledge assistance requests.

## Architecture

npm workspaces monorepo with five top-level directories (note: `backend` is listed in workspaces but has no `package.json` — it's Python-only):

- **`backend/`** — Python 3.12 FastAPI (async), asyncpg, embedded PyTorch inference
- **`frontend/`** — React Native + Expo SDK 54 (TypeScript), React Navigation
- **`database/`** — PostgreSQL 15 schema + TypeScript migration scripts (loads `.env` from `../../backend/.env`)
- **`ai/`** — Standalone PyTorch model training (WaveDetector 1D CNN)
- **`hardware/`** — MicroPython for ESP32 microcontroller

### Sign status workflow

```
available → assistance_requested  (ML wave detection)
         → assistance_in_progress (staff acknowledge via app)
         → available              (staff resolve via app)
```

Additional statuses: `offline`, `error`, `training_ready`, `training_positive`, `training_negative`

### System data flow

```
ESP32 photoresistor → 512 samples at 25ms intervals
→ POST /api/v1/inference/classify → WaveDetector CNN → wave/non-wave
→ if wave: sign status → assistance_requested
→ mobile app polls sign status → staff acknowledges → resolves
```

### Auth flow (WorkOS)

```
frontend GET /auth/login → WorkOS authorization URL → browser redirect
→ callback with code → POST /auth/exchange → access + refresh tokens
→ Zustand store + expo-secure-store persistence
→ Axios interceptor auto-refreshes expired tokens
```

## Key Commands

```bash
# Root (workspaces)
npm run dev              # backend + frontend concurrently (frontend targets Android emulator)
npm run db:up            # start PostgreSQL via Docker
npm run db:migrate       # run migrations
npm run db:seed          # seed dev data

# Backend
cd backend
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# Frontend
cd frontend
npm start                # Expo dev server
npm run web              # web mode
npm run android          # Android mode
npm run lint             # ESLint
npm run test             # Jest + @testing-library/react-native (no tests written yet)

# AI training
cd ai
pip install -r requirements.txt
python train.py --epochs 20 --batch 64

# Docker (full stack)
docker compose up -d     # postgres, pgadmin, redis, backend, web
```

## Backend (`backend/`)

### Conventions

- **No ORM.** Raw parameterized SQL via asyncpg (`$1, $2, ...` placeholders).
- **Layered pattern:** Routes (thin controllers + Pydantic models) → Services (async functions, not classes) → Config (settings, DB pool, WorkOS client)
- **Settings:** `pydantic-settings` `BaseSettings` with `@lru_cache`, loaded from `.env`
- **Error handling:** Custom `AppError` class + generic exception handler middleware.
- **Logging:** Structured logger with console + `logs/error.log` + `logs/combined.log` (JSON).
- **ML inference:** `app/ai/` contains an embedded copy of WaveDetector — keep in sync with `ai/` root module.
- **`optional_auth` dependency** for endpoints that work with or without auth (e.g., `/inference/classify`, `GET /signs/{sign_id}/status`).
- **`redirect_slashes=False`** on the FastAPI app — trailing slashes will 404 (e.g., `/api/v1/signs/` fails, `/api/v1/signs` works).

### API routes (all under `/api/v1`)

- `/auth/*` — WorkOS OAuth (login, callback, exchange, refresh, me, logout)
- `/signs/*` — CRUD + acknowledge/resolve workflow + lightweight status polling (used by ESP32)
- `/events/*` — Sign event log
- `/notifications/*` — Push notification management
- `/inference/classify` — POST 512-int signal → wave/non-wave classification (optional auth)
- `GET /health` — DB connectivity check

## Frontend (`frontend/`)

### Conventions

- **Navigation:** React Navigation native-stack (not expo-router). Auth state drives conditional navigator rendering in `RootNavigator.tsx`.
- **Three-layer pattern:** `src/api/` (Axios client) → `src/store/` (Zustand) → `src/screens/` (UI)
- **Path alias:** `@/*` maps to `./src/*` (note: a dead `@shared/*` alias exists in tsconfig pointing to a nonexistent `../shared/` directory)
- **Axios interceptors:** Auto-inject bearer token, silent refresh on 401.
- **Cross-platform storage:** `src/utils/storage.tsx` uses `expo-secure-store` on native, `react-secure-storage` on web (lazy-loaded to avoid crashing iOS).
- **ESP32 direct communication:** `src/api/espApi.ts` talks to ESP32 AP at `http://192.168.4.1` (no auth, no backend).
- **Design system:** Custom tokens in `src/theme/` (colors with WCAG AA palette, spacing, typography).
- **External dependency:** `deploy-box-ui` is a locally linked library at `../../deploy-box-react-native-library`.

## AI Module (`ai/`)

- **Model:** `WaveDetector` — 3-block 1D CNN (Conv1d → BatchNorm → ReLU → MaxPool) → AdaptiveAvgPool → Dropout → Linear → Sigmoid
- **Input:** 512 integers (0–65535), normalized to [0,1], shaped as (batch, 1, 512). Note: ESP32 ADC produces 12-bit values (0–4095) but the model normalizes by dividing by 65535 — there is a known scaling mismatch.
- **Output:** Binary probability (wave / non-wave)
- **Training data:** Synthetic — sine/square waves (label=1), noise/silence (label=0)
- **Checkpoints:** `ai/checkpoints/best.pt` — must also be copied to `backend/app/ai/checkpoints/best.pt`

## Hardware (`hardware/`) — MicroPython on ESP32

- **Target runtime is MicroPython, not CPython.** Use `ujson`, `urequests`, `usocket`, `machine`, `network` modules.
- **Photoresistor:** ADC pin 34, 12-bit resolution, 0–3.3V range.
- **WiFi provisioning:** AP mode with HTTP server on port 80 (`/status`, `/scan`, `/configure`). Credentials persisted in `/wifi_config.json` on flash.
- **Status LED:** Non-blocking blink patterns via hardware Timer callbacks.
- **Resilience:** WDT (30s timeout), retry logic with backoff, auto-reconnect, fallback to AP provisioning mode on WiFi failure.
- **Main loop:** Poll sign status → sample 512 points → POST to `/api/v1/inference/classify`
- **Hardcoded config:** `main.py` has a hardcoded dev tunnel URL and sign UUID — must be changed per deployment.
- **AP SSID:** `SmartSign-{last4ofDeviceId}`
- **No `boot.py`** — `main.py` is the sole MicroPython entry point.

## Database

PostgreSQL 15 with `uuid-ossp`. UUID primary keys. Most tables have `created_at`/`updated_at` triggers, except `signs` which only has `last_updated`.

Tables: `users`, `profiles`, `signs` (with status enum), `events` (with type enum + JSONB data), `notifications`

Custom enums: `sign_status` (8 values), `event_type` (4 values)

Schema auto-loaded by Docker entrypoint from `database/schemas/shs_schema.sql`.

## Deployment

- **Backend:** Azure Container Apps (image `docker.io/kalebwbishop/shs:2`), 0.25 CPU / 0.5Gi, health probes on port 8000
- **Docker Compose services:** postgres (5432), pgadmin (5050), redis (6379), backend (8000), web (8081)

## Known Quirks

- Codebase evolved from a "Social Media Stack" template — naming artifacts remain: `social-stack` in root `package.json`, `social_stack_dev` default DB name in settings, `title="Social Media API"` in `backend/app/main.py`, Docker container names prefixed `social-stack-*`.
- Frontend `bable.config.js` has a filename typo (should be `babel.config.js`).
- `docker-compose.yml` has a broken `mobile` service referencing a nonexistent `./mobile` directory.
- `database/seeds/dev_data.sql` references old schema columns (`password_hash`, `is_verified`) that no longer exist — seeding will fail.
- No backend or frontend tests exist yet.
