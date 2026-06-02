# Hazard Hero Constitution

## Project Identity

Hazard Hero is an IoT accessibility system for **accessible parking sign management**. The system combines mobile software, backend APIs, PostgreSQL persistence, AI-assisted wave detection, ESP-IDF firmware, and deployment infrastructure to support safer, more reliable, and more accessible parking-space operations.

Hazard Hero operates in a physical-world accessibility context. It must never treat dynamic IoT state, app state, backend inference, or notification state as a substitute for legal accessibility requirements, static signage, site policy, or jurisdictional compliance.

The repository is a brownfield npm-workspaces monorepo with module-separated ownership:

- Python FastAPI backend code in `backend/`
- React Native/Expo frontend code in `frontend/`
- PostgreSQL schemas, seeds, migrations, and database scripts in `database/`
- PyTorch model development and testing code in `ai/`
- Embedded backend inference code in `backend/app/ai/`
- Active ESP-IDF firmware in `firmware/`
- Legacy MicroPython hardware code in `hardware/`
- Docker Compose and Terraform deployment infrastructure at the repository root and `terraform/`

The system is intentionally **module-separated rather than package-shared**. Cross-module integration must happen through HTTP APIs, SQL schemas, firmware payloads, migration scripts, documented contracts, TypeScript/Pydantic models, or model artifacts. Cross-imports between top-level modules are prohibited unless an explicit architectural decision changes this constitution.

---

## Normative Language

The words **MUST**, **MUST NOT**, **REQUIRED**, **SHOULD**, **SHOULD NOT**, **RECOMMENDED**, **MAY**, and **OPTIONAL** are used with their RFC 2119 meanings.

A violation of a **MUST** or **MUST NOT** blocks a spec, plan, task list, pull request, or implementation unless this constitution is amended first.

A violation of a **SHOULD** requires a documented exception with:

- rationale
- risk
- owner
- mitigation
- follow-up date or explicit acceptance of permanent risk

Informative repository observations may guide planning, but constitutional rules govern implementation.

---

## Core Principles

### I. Accessibility And Physical-World Safety Come First

Hazard Hero exists to support accessible parking. Accessibility and safety are not frontend polish, product extras, or optional acceptance criteria.

All user-facing language SHOULD prefer **accessible parking**, **accessible spaces**, and **people with disabilities** over outdated or stigmatizing wording, except when matching legal signage text, jurisdictional wording, imported source data, or user-provided labels.

Any feature that affects sign state, device state, space availability, claims, notifications, enforcement visibility, or organization/site access MUST define safe behavior for:

- backend outage
- network loss
- stale telemetry
- firmware crash
- bad sensor input
- duplicate or conflicting device reports
- conflicting user/device commands
- partial migration or rollback
- notification delivery failure

The system MUST distinguish meaningful operational states instead of collapsing uncertainty into availability. At minimum, specs touching parking/sign/device state MUST consider:

- available
- occupied
- reserved or claimed
- unknown
- stale
- offline
- error
- manually overridden

No implementation may imply that dynamic Hazard Hero state alone establishes ADA compliance, legal parking eligibility, or enforcement authority.

---

### II. Module Boundaries Are Contracts

All changes MUST respect top-level module ownership:

- Backend API code lives in `backend/app/`
- Backend routers live in `backend/app/routes/`
- Backend async service functions live in `backend/app/services/`
- Backend middleware lives in `backend/app/middleware/`
- Backend configuration lives in `backend/app/config/`
- Backend shared utilities live in `backend/app/utils/`
- Frontend app code lives in `frontend/src/` and `frontend/app/`
- Frontend reusable app code SHOULD prefer `frontend/src/api/`, `frontend/src/store/`, `frontend/src/screens/`, `frontend/src/navigation/`, `frontend/src/theme/`, `frontend/src/types/`, and `frontend/src/utils/`
- Database schemas, seeds, migrations, and register scripts live in `database/`
- Active production firmware lives in `firmware/`
- Legacy MicroPython support lives in `hardware/`
- Standalone AI model training and testing code lives in `ai/`
- Backend inference integration lives in `backend/app/ai/`
- Deployment and operations code lives in `docker-compose.yml` and `terraform/`

A spec, plan, or task that spans modules MUST name every affected module and define the contract between them before implementation begins.

Cross-module coupling MUST NOT be introduced through direct imports, copied hidden business logic, shared mutable files, or undocumented assumptions.

---

### III. Backend Changes Follow FastAPI, Async Services, And Raw SQL

Backend API changes MUST preserve the detected architecture:

- thin FastAPI routers
- Pydantic request/response models near route boundaries
- async service functions for business logic
- centralized configuration
- structured logging
- asyncpg-based data access
- parameterized SQL placeholders such as `$1`, `$2`, `$3`

An ORM MUST NOT be introduced without an explicit architectural decision and constitutional amendment or approved exception.

New or changed API routes MUST be mounted under `/api/v1` unless they are root health/status endpoints already following the existing pattern.

Because FastAPI `redirect_slashes=False` is part of the current behavior, specs, frontend clients, firmware clients, tests, and documentation MUST use exact paths and MUST NOT rely on trailing-slash redirects.

Backend route changes MUST document:

- request model
- response model
- authentication requirement
- authorization rule
- database tables touched
- failure behavior
- logging/audit behavior
- frontend, firmware, or external consumers affected

---

### IV. Authorization, Authentication, And Tenant Boundaries Are Mandatory

Any feature touching WorkOS authentication, device bearer-token authentication, organization membership, installer/admin/owner permissions, notifications, device claims, serial numbers, inference submission, or parking-space state MUST document and test authorization behavior.

Backend endpoints that access user-owned, organization-owned, device-owned, site-owned, parking-space-owned, event, claim, or notification data MUST scope access through the current authenticated user or authenticated device.

Every endpoint that accepts or derives a user ID, organization ID, site ID, parking-space ID, device ID, event ID, notification ID, claim ID, serial number, or token-derived identifier MUST include an authorization matrix covering at minimum:

- unauthenticated caller
- authenticated user with no relevant organization access
- authenticated user in the wrong organization
- authenticated user with insufficient role
- authenticated user with sufficient role
- valid device token, where applicable
- invalid, revoked, malformed, or expired device token, where applicable
- replay or brute-force attempt, where applicable

Device-facing endpoints MUST distinguish unauthenticated lightweight polling from authenticated telemetry, inference, registration, provisioning, and mutation operations.

Claim IDs, device tokens, serial numbers, and organization IDs are security-sensitive. Specs and tasks that accept these values MUST describe:

- validation
- expiration or revocation behavior
- brute-force resistance
- replay protection
- failure response
- logging without secret leakage

---

### V. Device Lifecycle Security Is A First-Class Architecture Concern

Every production device MUST have a unique logical identity and a documented serial/physical identity path.

Provisioning, claiming, token issuance, token rotation, revocation, firmware version reporting, and factory reset behavior MUST be specified before implementation of any device lifecycle feature.

Firmware and backend changes MUST document compatibility across:

- firmware version
- backend API version
- payload schema version
- certificate expectations
- backend URL expectations
- clock/TLS assumptions
- offline and retry behavior

Device-facing APIs MUST define safe behavior when the backend is unavailable, when credentials are invalid, and when the device is running an older supported firmware version.

Firmware SHOULD report firmware version, configuration version, last successful sync, and health/security state where practical.

---

### VI. Schema And API Changes Move Together

PostgreSQL is the source of truth for persisted entities.

Changes to persisted data MUST include the relevant schema or migration script changes, backend model/service updates, and seed/register script updates when development data is affected.

The repository uses `shs_schema.sql` as the bootstrap entrypoint and `shs_schema_v2.sql` as the canonical schema content. Every database plan MUST state whether it targets:

- the canonical device lifecycle model
- seed/register script compatibility
- cleanup/removal of obsolete behavior

Schema changes MUST include:

- migration strategy
- rollback or recovery plan
- impact on existing data
- seed/register script impact
- backend deployment ordering
- whether old and new backend versions can safely run before, during, and after migration

Destructive migrations MUST be called out explicitly and MUST NOT be bundled with unrelated feature work.

---

### VII. API And Payload Contracts Must Be Versioned, Documented, And Testable

Any backend route consumed by the frontend, firmware, deployment scripts, external tools, or AI/inference workflows MUST have a documented request/response contract.

API contract changes SHOULD update at least one authoritative contract artifact:

- OpenAPI schema
- Pydantic model
- TypeScript API type
- firmware payload structure
- SQL migration/schema contract
- markdown contract document
- focused integration test

Plans MUST classify contract changes as:

- backward-compatible
- forward-compatible
- breaking
- firmware-breaking
- frontend-breaking
- migration-only
- internal-only

Breaking changes to frontend-facing or device-facing APIs MUST either preserve compatibility for supported client/firmware versions or introduce a versioned endpoint/contract.

Firmware payloads MUST include enough versioning or shape validation to reject malformed or unsupported payloads safely.

---

### VIII. Frontend Changes Use Existing Navigation, API, Store, Theme, And Accessibility Patterns

Frontend features MUST use existing React Native/Expo TypeScript patterns:

- API clients in `frontend/src/api/`
- Zustand state in `frontend/src/store/`
- screens in `frontend/src/screens/`
- navigation definitions in `frontend/src/navigation/`
- navigation types in `frontend/src/types/navigation.ts`
- design tokens from `frontend/src/theme/`

User-facing screens MUST use existing theme colors, spacing, typography, and component patterns rather than ad hoc palettes.

Specs touching the frontend MUST include:

- loading behavior
- empty state
- error state
- authenticated state
- unauthenticated state
- offline or stale-data behavior, where relevant
- iOS/Android/platform-specific behavior, where relevant
- accessibility behavior

New interactive frontend elements MUST include appropriate accessibility labels, roles/states, hints where needed, focus behavior, and screen reader behavior.

Frontend changes SHOULD target WCAG 2.2 AA where applicable and MUST document exceptions.

Status must not be communicated by color alone. Critical state must be available through text, iconography, semantics, or screen-reader-accessible labels.

---

### IX. Firmware And Hardware Behavior Must Be Explicit

Active firmware work MUST target ESP-IDF C under `firmware/` unless the spec explicitly states that it is changing legacy MicroPython under `hardware/`.

Firmware specs MUST include:

- API endpoint paths
- request payloads
- response payloads
- authentication/token behavior
- Wi-Fi/provisioning behavior
- retry/backoff behavior
- watchdog behavior
- offline behavior
- LED/status behavior
- certificate/backend URL implications
- firmware version impact
- testing impact to `firmware/README.md` and `firmware/TEST_PLAN.md`

Changes to backend routes used by firmware MUST evaluate compatibility with current ESP-IDF code and, when still relevant, legacy MicroPython code.

Firmware changes MUST NOT silently change backend payload contracts, timing expectations, certificate assumptions, or provisioning behavior.

---

### X. AI Inference Changes Require Model Governance

Standalone model training and tests live in `ai/`. Embedded backend inference code lives under `backend/app/ai/`.

AI model, preprocessing, wave-detection, threshold, inference payload, or embedded inference changes MUST document:

- input shape
- sampling assumptions
- preprocessing steps
- model artifact version
- training/evaluation dataset source
- false-positive impact
- false-negative impact
- backend payload contract
- compatibility with `backend/app/ai/`
- regression results against known examples

The current model input/output contract defined in `config.json` MUST NOT change without a coordinated AI, backend, firmware, and frontend impact plan.

Model artifact changes MUST be reviewable, reproducible where practical, and accompanied by tests or evaluation evidence.

---

### XI. Observability, Auditability, And Operations Are Required

Production-impacting backend, firmware, notification, claim, organization, site, device lifecycle, inference, and parking-state changes MUST define logs, metrics, and audit events.

Audit logs MUST avoid secrets and sensitive tokens while preserving enough context to investigate:

- sign state changes
- parking-space state changes
- device registration
- device claims
- token failures
- permission denials
- organization membership changes
- notification delivery attempts
- inference submissions
- firmware/version changes

Plans touching production behavior MUST include:

- expected failure modes
- operator visibility
- recovery steps
- relevant dashboards/log queries if they exist
- documentation updates if they do not exist

Structured logging MUST be used for backend behavior that affects security, device lifecycle, claims, notifications, or physical-world state.

---

### XII. Dependency, Supply Chain, And Secret Hygiene Are Mandatory

Backend dependencies are declared in `backend/requirements.txt`.

AI dependencies are declared in `ai/requirements.txt`.

Frontend dependencies are declared in `frontend/package.json`.

Database script dependencies are declared in `database/package.json`.

Root npm scripts orchestrate workspaces from `package.json`.

The backend currently depends on a local `deploy-box-python` path package, and the frontend depends on a local `deploy-box-react-native` path package. Specs and plans that rely on these packages MUST call out local path availability and deployment implications.

New dependencies MUST be justified in the plan with:

- owning module
- runtime impact
- security/licensing consideration
- reason existing dependencies are insufficient
- installation/update instructions

Secrets, private keys, database URLs, WorkOS secrets, cloud credentials, device tokens, claim IDs, certificates, and bearer tokens MUST NOT be committed to the repository, test fixtures, logs, screenshots, seed files, or documentation examples.

Sample values MUST be clearly fake and non-functional.

---

### XIII. Tests Scale With Risk And Touched Modules

New behavior MUST include tests in the module that owns the behavior unless the plan documents why no automated test is practical.

Existing detected test locations and commands are authoritative:

- Backend route/service/security tests: `backend/tests/`, run with `pytest` from `backend/` after installing `backend/requirements.txt`
- AI model/data/inference tests: `ai/test_ai.py`, run with `pytest` from `ai/` after installing `ai/requirements.txt`
- Frontend unit tests: `npm run test --workspace=frontend` when Jest tests are added or affected
- Frontend linting: `npm run lint --workspace=frontend`
- Frontend e2e/browser tests: `frontend/e2e/`, run with Playwright after starting Expo web as described by `frontend/playwright.config.ts`
- Firmware validation: `idf.py build` from `firmware/` in an ESP-IDF 5.4+ environment when firmware C code, CMake, partitions, cert embedding, or SDK config changes
- Database validation: `npm run migrate --workspace=database` or `npm run migrate:v2 --workspace=database`, depending on the intended schema path
- Docker/infrastructure validation: relevant Docker Compose or Terraform validation command where credentials/tooling permit

Security fixes, authorization changes, migrations, device lifecycle changes, firmware payload changes, notification behavior, AI inference changes, and physical-world state changes require focused regression tests.

If a gate cannot be run, the plan or PR MUST state:

- command not run
- reason
- risk
- substitute validation performed
- follow-up required before production release

No CI workflow was detected. Until CI exists, local verification evidence is required before marking implementation complete.

---

### XIV. Documentation Must Move With Behavior

Documentation changes are REQUIRED when implementation changes user-visible behavior, operator behavior, setup behavior, deployment behavior, firmware behavior, database behavior, or API contracts.

Documentation touching stale Social Media Stack or signs-v1 language MUST be updated when nearby behavior is changed.

Firmware changes that alter provisioning, payloads, backend URLs, certificates, build instructions, testing, LED states, or failure behavior MUST update `firmware/README.md` or `firmware/TEST_PLAN.md` as appropriate.

Backend route changes consumed by frontend or firmware MUST update API documentation, OpenAPI output, typed contracts, or an equivalent documented contract.

Operational changes MUST update deployment/runbook documentation where such documentation exists, or create a minimal runbook note when it does not.

---

### XV. Planning Must Expose Risk Before Implementation

Every Spec Kit spec, plan, and task list MUST identify:

- affected modules
- cross-module contracts
- data/schema impact
- auth/authorization impact
- accessibility impact
- physical-world safety impact
- firmware impact
- AI/model impact
- observability/audit impact
- test gates
- documentation updates
- rollout and rollback considerations

If a category is not applicable, the plan MAY say “Not applicable,” but it MUST NOT silently omit risk categories for work touching backend, frontend, firmware, database, AI, deployment, security, or parking-state behavior.

Implementation tasks MUST be small enough to verify independently and MUST map back to constitution-relevant risks.

---

## Naming And Style Conventions

Python modules and functions use `snake_case`.

Python classes and Pydantic models use `PascalCase`.

Backend async service functions remain functions rather than service classes unless an existing local pattern already supports service classes.

TypeScript React Native screens and components use `PascalCase`.

TypeScript API modules and helpers use `camelCase`.

Frontend imports MAY use the `@/*` alias where configured in `frontend/tsconfig.json`.

Firmware C files use `snake_case.c` and `snake_case.h` pairs and are registered through `firmware/main/CMakeLists.txt`.

SQL object names use lowercase `snake_case`, UUID primary keys, enum types, and trigger-backed `updated_at` behavior where already present.

Recent commits mostly use Conventional Commit prefixes. New commits SHOULD use Conventional Commit style:

- `feat:`
- `fix:`
- `refactor:`
- `docs:`
- `test:`
- `chore:`
- `build:`
- `ci:`

Breaking changes SHOULD use `BREAKING CHANGE:` in the commit footer.

Repository-wide formatting, linting, or naming rules MUST NOT be introduced unless supported by project tooling or approved through a separate architectural decision.

---

## Quality Gates By Module

### Backend Touched

Required unless explicitly justified:

```bash
cd backend
pytest
```

Plans MUST identify affected routes, services, database tables, auth scopes, and API contracts.

### Frontend Touched

Required unless explicitly justified:

```bash
npm run lint --workspace=frontend
```

Also required when tests exist, are added, or behavior is changed in tested areas:

```bash
npm run test --workspace=frontend
```

Playwright validation is REQUIRED for browser-facing flows where appropriate.

### Database Touched

Required path must match the targeted schema:

```bash
npm run migrate --workspace=database
```

or:

```bash
npm run migrate:v2 --workspace=database
```

Destructive changes require explicit review, rollback planning, and production-data impact notes.

### AI Touched

Required unless explicitly justified:

```bash
cd ai
pytest
```

The model contract defined in `config.json` must be preserved unless a coordinated contract-change plan is approved.

### Firmware Touched

Required in an ESP-IDF 5.4+ environment unless unavailable:

```bash
cd firmware
idf.py build
```

If ESP-IDF is unavailable, the plan MUST document the missing toolchain and any substitute validation.

### Docker Or Terraform Touched

Validate the relevant Docker Compose or Terraform command path where credentials and tooling permit.

Plans MUST document skipped validation and deployment risk.

### Documentation Touched

Documentation-only changes MUST still be reviewed for stale architecture, stale product terminology, stale signs-v1 language, and stale setup instructions.

---

## Pull Request Acceptance Checklist

A PR is not ready for review unless it answers:

1. Which modules changed?
2. Which contracts changed?
3. Is the change backward-compatible?
4. What auth/authorization behavior changed?
5. What accessible parking or accessibility behavior changed?
6. What physical-world safety behavior changed?
7. What database schema or migration path changed?
8. What firmware behavior changed?
9. What AI/model behavior changed?
10. What logs, metrics, or audit events changed?
11. What tests were run?
12. What tests were skipped and why?
13. What docs were updated?
14. What rollback or recovery path exists?
15. Does this require a constitution amendment?

A PR that touches security, schema, firmware, device lifecycle, claims, notifications, inference, or parking-space state MUST include focused verification evidence.

---

## Governance

This constitution governs Hazard Hero specs, plans, tasks, implementation, review, and verification.

The constitution MUST be updated when the repository:

- changes major architecture
- replaces a major framework
- changes the active firmware runtime
- introduces CI quality gates
- changes the database migration strategy
- changes device lifecycle assumptions
- changes security/auth architecture
- changes accessibility requirements
- establishes new mandatory coding conventions

### Amendment Requirements

Every amendment MUST include:

- reason for change
- observed repository fact or explicit team decision that caused the change
- affected principles
- affected modules
- affected Spec Kit templates
- migration impact for existing specs/plans/tasks
- new version
- amendment date

Spec templates, plan templates, and task templates MUST be updated in the same change when a governance rule changes how work is planned, verified, or reviewed.

### Versioning Policy

Constitution versioning follows semantic intent:

- **MAJOR**: removes, replaces, or redefines a core principle; changes required architecture; changes mandatory quality gates; or materially changes security, accessibility, safety, or governance obligations
- **MINOR**: adds a new principle, new governed module, new required planning category, or new required quality gate
- **PATCH**: clarifies wording without changing obligations

### Compliance Review

Every plan MUST include a Constitution Check.

Every task list MUST include tasks required by the Constitution Check.

Every implementation review MUST verify that constitutional requirements were either satisfied or explicitly waived according to this constitution.

A constitutional waiver MUST be visible in the plan or PR and MUST include rationale, owner, risk, mitigation, and follow-up.

---

## Reference Basis

This constitution was drafted using the repository facts provided by the project owner and public best-practice references, including:

- [GitHub Spec Kit constitution command/template](https://github.com/github/spec-kit/blob/main/templates/commands/constitution.md)
- [RFC 2119: Key words for use in RFCs to Indicate Requirement Levels](https://www.rfc-editor.org/rfc/rfc2119)
- [OWASP API Security Top 10 2023: Broken Object Level Authorization](https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/)
- [NIST IR 8259A: IoT Device Cybersecurity Capability Core Baseline](https://www.nist.gov/publications/iot-device-cybersecurity-capability-core-baseline)
- [NIST Technical Device Cybersecurity Capabilities Catalog](https://pages.nist.gov/IoT-Device-Cybersecurity-Requirement-Catalogs/technical/)
- [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/)
- [W3C WAI: What's New in WCAG 2.2](https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/)
- [React Native Accessibility Documentation](https://reactnative.dev/docs/accessibility)
- [OpenAPI Initiative](https://www.openapis.org/)
- [OpenAPI Specification](https://swagger.io/specification/)
- [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/)

---

**Version**: 2.0.0  
**Proposed Ratification**: 2026-05-12  
**Last Amended**: 2026-05-12  
**Status**: Draft for review  
**Supersedes**: 1.0.0
