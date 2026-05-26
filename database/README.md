# Database

PostgreSQL 15 schema assets for Hazard Hero.

## Canonical assets

- `schemas/shs_schema.sql` — bootstrap entrypoint used by Docker and local setup
- `schemas/shs_schema_v2.sql` — canonical schema content loaded by `shs_schema.sql`
- `seeds/dev_data_v2.sql` — current development seed data
- `scripts/migrate_v2.ts` — default migration entrypoint

## Commands

Run these from `database/`:

```bash
npm run migrate
npm run seed
```

Both scripts load `../backend/.env` and expect `POSTGRES_CONNECTION_STRING` (or `DATABASE_URL` for the seed script) to point at the target PostgreSQL instance.

## Migration behavior

`npm run migrate` uses `scripts/migrate_v2.ts` to reset the target database to the canonical device schema by applying `schemas/shs_schema_v2.sql`.

## Production deployment

`.github/workflows/ci-cd.yml` runs `npm run migrate` before Terraform deploys a new backend revision.

The current migration is destructive by design. Use it only where resetting the database is acceptable.

## Schema overview

Primary v2 tables:

- `users`, `profiles`
- `organizations`, `organization_members`
- `sites`
- `devices`
- `parking_spaces`
- `installations`
- `device_events`
- `notifications`
- `push_tokens`
- `audit_logs`

## Key enums

- `org_role`: `owner`, `admin`, `installer`, `member`
- `device_lifecycle_status`: `manufactured`, `unclaimed`, `claiming`, `active`, `lost`, `revoked`, `retired`
- `device_operational_status`: `available`, `assistance_requested`, `assistance_in_progress`, `offline`, `error`, `training_ready`, `training_positive`, `training_negative`
- `claim_status_type`: `unused`, `used`, `revoked`, `expired`
- `accessible_parking_type`: `standard`, `van_accessible`, `temporary`, `reserved`

## Seeding

`npm run seed` applies only `seeds/dev_data_v2.sql`. The v2 seed includes:

- sample users and organizations
- organization memberships with installer/admin/owner roles
- sites and parking spaces
- devices in multiple lifecycle states
- installations and device events

Run the seed only after `npm run migrate` has completed successfully.
