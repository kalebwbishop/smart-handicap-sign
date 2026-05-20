---
description: "Hazard Hero task list template for feature implementation"
---

# Tasks: [FEATURE NAME]

**Input**: Design documents from `/specs/[###-feature-name]/`  
**Prerequisites**: `plan.md` (required), `spec.md` (required for user stories), `research.md`, `data-model.md`, `contracts/`

**Tests**: Include tests for changed behavior. Security, auth, schema, device lifecycle, firmware/API contracts, and inference behavior require focused regression coverage unless the plan documents why automated testing is not practical.

**Organization**: Tasks are grouped by phase and user story so each story remains independently implementable and testable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it touches different files and has no dependency on another unfinished task.
- **[Story]**: User story label such as `US1`, `US2`, `US3`; omit only for setup/foundation/polish tasks.
- Include exact repository-relative paths in every implementation and test task.

## Path Conventions

- Backend routes: `backend/app/routes/`
- Backend services: `backend/app/services/`
- Backend middleware/auth/utils: `backend/app/middleware/`, `backend/app/utils/`, `backend/app/config/`
- Backend tests: `backend/tests/test_*.py`
- Frontend API clients: `frontend/src/api/`
- Frontend screens/navigation/store/types/theme: `frontend/src/screens/`, `frontend/src/navigation/`, `frontend/src/store/`, `frontend/src/types/`, `frontend/src/theme/`
- Frontend e2e: `frontend/e2e/`
- Database schema/scripts/seeds: `database/schemas/`, `database/scripts/`, `database/seeds/`
- ESP-IDF firmware: `firmware/main/`, `firmware/CMakeLists.txt`, `firmware/partitions.csv`, `firmware/sdkconfig.defaults`
- Legacy MicroPython: `hardware/`
- AI model/training: `ai/`, `backend/app/ai/`
- Infrastructure: `docker-compose.yml`, `terraform/`

<!--
  The sections below are a project-aware scaffold. The /speckit.tasks command
  must replace sample placeholders with actual feature tasks derived from the
  spec, plan, data model, contracts, and selected modules.
-->

## Phase 1: Setup And Baseline

**Purpose**: Confirm current behavior, dependencies, and affected module boundaries before changing code.

- [ ] T001 Confirm affected modules and exact files from `plan.md`
- [ ] T002 Confirm local dependency availability for affected modules (`deploy-box-python`, `deploy-box-react-native`, ESP-IDF, Docker, or database as applicable)
- [ ] T003 [P] Capture baseline backend/API behavior or failing test in `backend/tests/` if backend behavior changes
- [ ] T004 [P] Capture baseline frontend/e2e behavior in `frontend/e2e/` or Jest test path if frontend behavior changes
- [ ] T005 [P] Capture baseline firmware/API payload behavior if `firmware/` or device-facing endpoints change

---

## Phase 2: Foundational Contracts And Data

**Purpose**: Define shared contracts that block independent user-story work.

**Critical**: No user story implementation should begin until required contracts are stable.

- [ ] T006 Define or update API contract details in `specs/[###-feature-name]/contracts/` for changed `/api/v1` endpoints
- [ ] T007 [P] Define or update TypeScript types in `frontend/src/types/` for changed frontend/API data shapes
- [ ] T008 [P] Define or update Pydantic request/response models in the affected `backend/app/routes/` file
- [ ] T009 Define database schema/migration changes in `database/schemas/` or `database/scripts/` if persisted data changes
- [ ] T010 Define firmware payload/status compatibility in `firmware/README.md`, `firmware/TEST_PLAN.md`, or feature docs if device behavior changes
- [ ] T011 Define auth/authorization test matrix for WorkOS user roles, device bearer tokens, organization membership, and unauthenticated paths

**Checkpoint**: Contracts, schema expectations, and authorization rules are ready for implementation.

---

## Phase 3: User Story 1 - [Title] (Priority: P1) - MVP

**Goal**: [Brief description of what this story delivers]

**Independent Test**: [How to verify this story works on its own]

### Tests For User Story 1

- [ ] T012 [P] [US1] Add backend route/service/security test in `backend/tests/test_[feature].py` if backend behavior changes
- [ ] T013 [P] [US1] Add frontend unit/e2e test in `frontend/` if UI behavior changes
- [ ] T014 [P] [US1] Add database migration or seed verification if persisted data changes
- [ ] T015 [P] [US1] Add AI or firmware test/build check if model or firmware behavior changes

### Implementation For User Story 1

- [ ] T016 [US1] Implement database/schema changes in `database/` if required
- [ ] T017 [US1] Implement backend route changes in `backend/app/routes/[route].py`
- [ ] T018 [US1] Implement backend service changes in `backend/app/services/[service].py`
- [ ] T019 [US1] Implement backend middleware/config/util changes in `backend/app/` if required
- [ ] T020 [US1] Implement frontend API/type changes in `frontend/src/api/` and `frontend/src/types/` if required
- [ ] T021 [US1] Implement frontend screen/navigation/store changes in `frontend/src/` if required
- [ ] T022 [US1] Implement firmware or legacy hardware changes in `firmware/` or `hardware/` if required
- [ ] T023 [US1] Update docs for the changed workflow, API, or device behavior

**Checkpoint**: User Story 1 is independently functional and testable.

---

## Phase 4: User Story 2 - [Title] (Priority: P2)

**Goal**: [Brief description of what this story delivers]

**Independent Test**: [How to verify this story works on its own]

### Tests For User Story 2

- [ ] T024 [P] [US2] Add focused test(s) in the owning module for this story

### Implementation For User Story 2

- [ ] T025 [US2] Implement story-specific backend/frontend/database/firmware changes in exact paths from the plan
- [ ] T026 [US2] Integrate with User Story 1 contracts without breaking independent validation
- [ ] T027 [US2] Update docs or quickstart steps if the user workflow changes

**Checkpoint**: User Stories 1 and 2 are independently functional.

---

## Phase 5: User Story 3 - [Title] (Priority: P3)

**Goal**: [Brief description of what this story delivers]

**Independent Test**: [How to verify this story works on its own]

### Tests For User Story 3

- [ ] T028 [P] [US3] Add focused test(s) in the owning module for this story

### Implementation For User Story 3

- [ ] T029 [US3] Implement story-specific backend/frontend/database/firmware changes in exact paths from the plan
- [ ] T030 [US3] Update docs or quickstart steps if the user workflow changes

**Checkpoint**: All planned user stories are independently functional.

---

[Add more user-story phases as needed.]

---

## Phase N: Cross-Cutting Hardening And Polish

**Purpose**: Finish integration, compatibility, and documentation after user stories work.

- [ ] T031 [P] Review authorization coverage for IDOR, role mismatch, unauthenticated access, and device token misuse
- [ ] T032 [P] Review exact API paths for FastAPI trailing-slash behavior
- [ ] T033 [P] Review SQL for parameterized placeholders and migration safety
- [ ] T034 [P] Review frontend loading/empty/error/offline/platform states
- [ ] T035 [P] Review firmware retry/watchdog/provisioning behavior if device-facing changes were made
- [ ] T036 [P] Update stale project docs if touched behavior is currently documented incorrectly
- [ ] T037 Run quickstart validation from `specs/[###-feature-name]/quickstart.md`

---

## Phase N+1: Validation Gates

Run only the gates relevant to touched modules and record results in the implementation summary.

- [ ] T038 Backend validation: `cd backend` then `pytest`
- [ ] T039 Frontend lint: `npm run lint --workspace=frontend`
- [ ] T040 Frontend tests: `npm run test --workspace=frontend` when tests exist or are added
- [ ] T041 Frontend e2e: start Expo web per `frontend/playwright.config.ts`, then run Playwright for affected flows
- [ ] T042 Database validation: `npm run migrate --workspace=database` or `npm run migrate:v2 --workspace=database` where safe
- [ ] T043 AI validation: `cd ai` then `pytest`
- [ ] T044 Firmware validation: `cd firmware` then `idf.py build` in ESP-IDF 5.4+ environment
- [ ] T045 Infrastructure validation: run relevant Docker Compose or Terraform checks where tooling/credentials permit

---

## Dependencies & Execution Order

- Setup and baseline tasks run first.
- Foundational contracts and schema tasks block user-story implementation.
- User Story 1 should be completed and validated before lower-priority stories unless the plan explicitly assigns parallel owners.
- Database/schema changes must land before backend code that depends on them.
- Backend API/type contract changes must land before frontend or firmware clients depend on them.
- Firmware payload changes must be validated against backend route behavior before device deployment.
- Polish and validation gates run after selected user stories are complete.

## Parallel Opportunities

- Tests for different modules can run in parallel when they do not depend on the same files.
- Frontend UI work can proceed in parallel with backend service work after API contracts are stable.
- Database seed/docs updates can proceed in parallel with frontend screens after schema decisions are final.
- Firmware changes can proceed in parallel only after device-facing API payloads and auth requirements are stable.

## Notes

- Replace all placeholder tasks with concrete file paths.
- Keep each user story independently demonstrable.
- Do not add unrelated refactors to task lists.
- Do not mark validation complete when a command was skipped; record the reason instead.
- Commit guidance, when requested, should follow the recent Conventional Commit style observed in the repository.