# Copilot Instructions — Hazard Hero

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
ESP32 photoresistor → config.json-defined sample window at the configured interval
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
- **`optional_auth` dependency** for endpoints that work with or without auth (e.g., `/inference/classify`, `GET /api/v1/devices/{serial_number}/status`).
- **`redirect_slashes=False`** on the FastAPI app — trailing slashes will 404 (e.g., `/api/v1/devices/serial/status/` fails if a route is defined without the slash).
- **SSL bypass:** When `ENVIRONMENT != "cloud"`, SSL verification is disabled globally (stdlib `ssl` + `httpx` patched). This is for corporate proxy environments — don't add redundant `verify=False` flags.

### API routes (all under `/api/v1`)

- `/auth/*` — WorkOS OAuth (login, callback, exchange, refresh, me, logout)
- `/devices/*` — device registration, claims, lifecycle, status polling, and device event history
- `/notifications/*` — Push notification management
- `/organizations/*` — Organization CRUD, member management, role-based access (owner/admin/member)
- `/inference/classify` — POST signal matching the configured sample count → wave/non-wave classification (optional auth)
- `GET /health` — DB connectivity check (mounted at root, not under `/api/v1`)
- `GET /api/v1/status` — API version and uptime check

## Frontend (`frontend/`)

### Conventions

- **Navigation:** React Navigation native-stack (not expo-router). Auth state drives conditional navigator rendering in `RootNavigator.tsx`.
- **Three-layer pattern:** `src/api/` (Axios client) → `src/store/` (Zustand) → `src/screens/` (UI)
- **Path alias:** `@/*` maps to `./src/*` (note: a dead `@shared/*` alias exists in tsconfig pointing to a nonexistent `../shared/` directory)
- **Axios interceptors:** Auto-inject bearer token, silent refresh on 401.
- **Cross-platform storage:** `src/utils/storage.tsx` uses `expo-secure-store` on native, `react-secure-storage` on web (lazy-loaded to avoid crashing iOS).
- **ESP32 direct communication:** `src/api/espApi.ts` talks to ESP32 AP at `http://192.168.4.1` (no auth, no backend).
- **Design system:** Custom tokens in `src/theme/` (colors with WCAG AA palette, spacing, typography). See `frontend/inspo/DESIGN.md` for the full design reference (Composio-inspired dark theme with specific color palette, typography, and component patterns).
- **External dependency:** `deploy-box-ui` is a locally linked library at `../../deploy-box-react-native-library`.

## AI Module (`ai/`)

- **Model:** `WaveDetector` — 3-block 1D CNN (Conv1d → BatchNorm → ReLU → MaxPool) → AdaptiveAvgPool → Dropout → Linear → Sigmoid
- **Input:** Configured sample-count integers (0–65535), normalized to [0,1], shaped as (batch, 1, SEQ_LEN). Note: ESP32 ADC produces 12-bit values (0–4095) but the model normalizes by dividing by 65535 — there is a known scaling mismatch.
- **Output:** Binary probability (wave / non-wave)
- **Training data:** Synthetic — sine/square waves (label=1), noise/silence (label=0)
- **Checkpoints:** `ai/checkpoints/best.pt` — must also be copied to `backend/app/ai/checkpoints/best.pt`

## Hardware (`hardware/`) — MicroPython on ESP32

- **Target runtime is MicroPython, not CPython.** Use `ujson`, `urequests`, `usocket`, `machine`, `network` modules.
- **Photoresistor:** ADC pin 34, 12-bit resolution, 0–3.3V range.
- **WiFi provisioning:** AP mode with HTTP server on port 80 (`/status`, `/scan`, `/configure`). Credentials persisted in `/wifi_config.json` on flash.
- **Status LED:** Non-blocking blink patterns via hardware Timer callbacks.
- **Resilience:** WDT (30s timeout), retry logic with backoff, auto-reconnect, fallback to AP provisioning mode on WiFi failure.
- **Main loop:** Poll sign status → sample the configured window → POST to `/api/v1/inference/classify`
- **Hardcoded config:** `main.py` has a hardcoded dev tunnel URL and sign UUID — must be changed per deployment.
- **AP SSID:** `SmartSign-{last4ofDeviceId}`
- **No `boot.py`** — `main.py` is the sole MicroPython entry point.

## Database

PostgreSQL 15 with `uuid-ossp`. UUID primary keys. Most tables have `created_at`/`updated_at` triggers.

Tables: `users`, `profiles`, `organizations`, `organization_members`, `devices`, `sites`, `parking_spaces`, `installations`, `device_events`, `notifications`, `push_tokens`, `audit_logs`

Custom enums: `org_role`, `device_lifecycle_status`, `device_operational_status`, `claim_status_type`, `accessible_parking_type`

Schema auto-loaded by Docker entrypoint from `database/schemas/shs_schema.sql`.

## Deployment

- **Backend:** Azure Container Apps (image `deployboxcrprod.azurecr.io/hazard-hero-backend:<tag>`), 0.25 CPU / 0.5Gi, health probes on port 8000
- **Docker Compose services:** postgres (5432), pgadmin (5050), redis (6379), backend (8000), web (8081)

## Known Quirks

- **External dependency:** `deploy-box-ui` is a locally linked library at `../../deploy-box-react-native-library`. Frontend builds will fail if this directory doesn't exist.
- Codebase was originally a "Social Media Stack" template, then renamed "Smart Handicap Sign", then "Hazard Hero". Some infrastructure identifiers still use older naming (e.g., Docker image `kalebwbishop/shs:2`, DB name `shs`, terraform resource names with `smart-handicap-sign`, cloud-init paths at `/opt/smart-handicap-sign/`). These are intentionally left as-is to avoid breaking deployed infrastructure.
- Frontend `bable.config.js` has a filename typo (should be `babel.config.js`).
- `docker-compose.yml` has a broken `mobile` service referencing a nonexistent `./mobile` directory.
- `database/seeds/dev_data.sql` references old schema columns (`password_hash`, `is_verified`) that no longer exist — seeding will fail.
- No backend or frontend tests exist yet.

<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan
<!-- SPECKIT END -->
