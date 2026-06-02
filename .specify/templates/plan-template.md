# Implementation Plan: [FEATURE]

**Branch**: `[###-feature-name]` | **Date**: [DATE] | **Spec**: [link]  
**Input**: Feature specification from `/specs/[###-feature-name]/spec.md`

**Note**: This template is filled in by `/speckit.plan`. Keep all sections grounded in the actual Hazard Hero repository structure.

## Summary

[Extract from feature spec: primary user outcome, affected modules, and technical approach.]

## Technical Context

**Project Type**: Brownfield IoT/accessibility monorepo with mobile app, API, database, AI, firmware, and infrastructure modules  
**Primary Languages**: Python, TypeScript/TSX, C, SQL, Terraform, PowerShell  
**Backend**: FastAPI, asyncpg raw SQL, Pydantic Settings, WorkOS auth, PyJWT, embedded PyTorch inference  
**Frontend**: React Native + Expo SDK 54, TypeScript, React Navigation native-stack, Zustand, TanStack Query, Axios, theme tokens  
**Database**: PostgreSQL 15 schemas and TypeScript migration/seed scripts in `database/`  
**Firmware**: ESP-IDF C under `firmware/`; legacy MicroPython under `hardware/` only when explicitly targeted  
**AI**: PyTorch 1D CNN, config.json-defined sample-count input contract, checkpoints in `ai/checkpoints/` and backend embedded copy  
**Infrastructure**: Docker Compose, Terraform, Azure deployment artifacts  
**Testing**: pytest for backend/AI, Jest configured for frontend, Playwright for frontend e2e, ESP-IDF build for firmware  
**External/Local Dependencies**: WorkOS, PostgreSQL, local `deploy-box-python`, local `deploy-box-react-native`, Docker, ESP-IDF toolchain when firmware touched  
**Constraints**: FastAPI `redirect_slashes=False`; raw SQL/no ORM; exact `/api/v1` route paths; device/organization authorization; ESP32 timing/watchdog limits; frontend design tokens  
**Open Technical Questions**: [List only if needed]

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Module Boundaries**: [Which modules are touched? Are cross-module contracts explicit?]
- **Backend Raw SQL/FastAPI Pattern**: [If backend touched, are routes thin, services async, SQL parameterized?]
- **Security/Auth**: [If auth/org/device data touched, are authorization and failure cases specified?]
- **Schema/API Coupling**: [If persisted data changes, are schema, services, clients, and migration behavior aligned?]
- **Frontend Patterns**: [If frontend touched, are screens/API/store/navigation/theme locations identified?]
- **Firmware Target**: [If firmware touched, is target ESP-IDF vs legacy MicroPython explicit?]
- **Testing/Validation**: [Are module-specific gates selected?]
- **Docs/Compatibility**: [Are stale docs or firmware/API compatibility impacts handled?]

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
+-- plan.md
+-- research.md
+-- data-model.md
+-- quickstart.md
+-- contracts/
+-- tasks.md
```

### Repository Modules

```text
backend/
+-- app/
|   +-- main.py
|   +-- config/
|   +-- middleware/
|   +-- routes/
|   +-- services/
|   +-- utils/
|   +-- ai/
+-- tests/

frontend/
+-- App.tsx
+-- app/
+-- e2e/
+-- src/
    +-- api/
    +-- hooks/
    +-- lib/
    +-- navigation/
    +-- screens/
    +-- store/
    +-- theme/
    +-- types/
    +-- utils/

database/
+-- schemas/
+-- scripts/
+-- seeds/

firmware/
+-- CMakeLists.txt
+-- main/
+-- server_certs/
+-- partitions.csv
+-- sdkconfig.defaults

hardware/
+-- main.py
+-- provision.py
+-- *.py

ai/
+-- model.py
+-- train.py
+-- infer.py
+-- data.py
+-- test_ai.py
+-- checkpoints/

terraform/
docker-compose.yml
```

**Structure Decision**: [List exact files/directories to modify. Do not include unrelated modules.]

## Phase 0: Research And Unknowns

[Capture decisions needed before design: existing routes/services, schema version, API payload compatibility, firmware behavior, external dependency availability, migration safety, design constraints.]

## Phase 1: Design And Contracts

### Backend/API Design

- **Routes**: [Exact method/path under `/api/v1`]
- **Models**: [Pydantic request/response models]
- **Services**: [Async service functions]
- **SQL**: [Tables and parameterized statements]
- **Auth**: [WorkOS user, device token, optional auth]

### Frontend Design

- **Screens**: [Affected screens/components]
- **API Clients**: [Affected files in `frontend/src/api/`]
- **State/Navigation**: [Zustand/navigation/types changes]
- **Theme/UI States**: [Design token usage and states]

### Database Design

- **Schema Version**: [v1, v2, migration]
- **Tables/Enums/Indexes**: [Changes]
- **Data Migration/Seeds**: [Changes]

### Firmware/Device Design

- **Target Runtime**: [ESP-IDF or legacy MicroPython]
- **Payloads/Endpoints**: [Status/classify/provisioning/OTA changes]
- **Reliability**: [Watchdog, retries, LED patterns, timing]

### AI/Inference Design

- **Model Contract**: [Input/output/checkpoint behavior]
- **Training/Debugging**: [If changed]

### Infrastructure/Operations Design

- **Docker/Terraform/Azure**: [If changed]
- **Environment Variables/Secrets**: [If changed]

## Verification Plan

Select all applicable gates and document expected commands/outcomes.

| Module Touched | Required Validation |
|---|---|
| Backend | `cd backend` then `pytest` |
| Frontend | `npm run lint --workspace=frontend`; `npm run test --workspace=frontend` when tests exist or are added |
| Frontend e2e/web | Start Expo web per `frontend/playwright.config.ts`; run Playwright tests for affected browser flows |
| Database | `npm run migrate --workspace=database` or `npm run migrate:v2 --workspace=database` against intended schema path, where safe |
| AI | `cd ai` then `pytest` |
| Firmware | `cd firmware` then `idf.py build` in ESP-IDF 5.4+ environment |
| Infrastructure | Relevant Docker Compose/Terraform validation where credentials/tooling permit |
| Docs only | Review links/commands for accuracy |

## Complexity Tracking

> Fill only if the Constitution Check has violations or the feature intentionally adds complexity.

| Violation/Complexity | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| [e.g., new cross-module dependency] | [reason] | [reason] |

## Migration And Rollback

- **Data Migration**: [N/A or details]
- **Backward Compatibility**: [N/A or details]
- **Rollback Plan**: [How to revert app/API/schema/firmware safely]
- **Operational Risk**: [Device downtime, auth disruption, seed data, local dependencies, deployment]