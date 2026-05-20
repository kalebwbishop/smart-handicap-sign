# AGENTS.md

This repository is a brownfield Hazard Hero monorepo. Agents should keep work scoped to the module they are changing and use the contracts between modules instead of creating cross-module imports.

## Repository Boundaries

| Agent Area | Owns | Notes |
|---|---|---|
| Backend API | `backend/app/`, `backend/tests/`, `backend/requirements.txt` | FastAPI, async service functions, asyncpg raw SQL, WorkOS/user auth, device auth, inference routes |
| Frontend App | `frontend/src/`, `frontend/app/`, `frontend/e2e/`, `frontend/package.json` | React Native + Expo, TypeScript, React Navigation, Zustand, Axios clients, theme tokens |
| Database | `database/schemas/`, `database/scripts/`, `database/seeds/`, `database/package.json` | PostgreSQL schemas, TypeScript migrations, seed/register scripts |
| Firmware | `firmware/` | Active ESP-IDF C firmware, CMake, OTA, provisioning, Wi-Fi, ADC, HTTPS, LED status |
| Legacy Hardware | `hardware/` | MicroPython runtime only; do not update unless explicitly requested |
| AI | `ai/`, `backend/app/ai/` | PyTorch training/inference contract and checkpoint compatibility |
| Infrastructure | `docker-compose.yml`, `terraform/`, deployment YAML/scripts | Local services and Azure/Terraform deployment |
| Spec Kit | `.specify/`, `.github/prompts/`, `.github/agents/` | Specification workflow, templates, constitution, agent prompts |

## Shared Rules

- Respect existing module boundaries. Do not import frontend code into backend, backend code into firmware, or AI training code directly into frontend.
- Use HTTP API contracts, SQL schemas, TypeScript types, Pydantic models, firmware payload definitions, and documented checkpoints as integration surfaces.
- Keep backend database access in asyncpg raw SQL with parameterized placeholders. Do not introduce an ORM without an explicit decision.
- Keep frontend UI aligned with `frontend/src/theme/` and existing navigation/API/store patterns.
- Treat `firmware/` as the active ESP-IDF implementation. Treat `hardware/` as legacy MicroPython unless the task says otherwise.
- When changing device claims, device status, inference, organization access, notifications, or events, include authorization and IDOR-style regression tests.
- When changing persisted data, update schema/migration/seed behavior and the backend/frontend contracts that consume it.
- Do not clean or revert unrelated dirty worktree changes.

## Validation By Area

| Area Touched | Preferred Validation |
|---|---|
| Backend | `cd backend` then `pytest` |
| Frontend | `npm run lint --workspace=frontend`; `npm run test --workspace=frontend` when tests exist or are added |
| Frontend web/e2e | Start Expo web per `frontend/playwright.config.ts`, then run Playwright for affected flows |
| Database | `npm run migrate --workspace=database` or `npm run migrate:v2 --workspace=database` where safe |
| AI | `cd ai` then `pytest` |
| Firmware | `cd firmware` then `idf.py build` in an ESP-IDF 5.4+ environment |
| Infrastructure | Relevant Docker Compose or Terraform validation where tooling and credentials permit |

## Coordination Notes

- Backend API changes should be planned before frontend or firmware client updates.
- Database migrations should be planned before services that depend on new columns, tables, or enums.
- Firmware/device-facing endpoint changes must include compatibility notes for deployed device behavior.
- Documentation should be updated when a change touches workflows currently described in `README.md`, `DESIGN.md`, `HARDWARE.md`, `MVP.md`, `REGISTRATION.md`, or `firmware/README.md`.