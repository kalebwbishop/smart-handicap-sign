# Database

PostgreSQL 15 schema assets for Hazard Hero.

## Canonical assets

- `schemas/shs_schema_v2.sql` — current schema used by the backend
- `seeds/dev_data_v2.sql` — current development seed data
- `scripts/migrate_v2.ts` — default migration entrypoint

Legacy files such as `schemas/shs_schema.sql` and `seeds/dev_data.sql` are retained only for historical reference and should not be used for normal setup.

## Commands

Run these from `database/`:

```bash
npm run migrate
npm run seed
```

Both scripts load `../backend/.env` and expect `POSTGRES_CONNECTION_STRING` (or `DATABASE_URL` for the seed script) to point at the target PostgreSQL instance.

## Migration behavior

`npm run migrate` uses `scripts/migrate_v2.ts` and handles three cases:

1. Fresh install — applies `shs_schema_v2.sql`
2. Legacy v1 database (`signs` exists and `devices` does not) — snapshots v1 data, applies v2, migrates signs into devices, and restores the legacy compatibility tables still used by the backend
3. Existing v2 database — performs a non-destructive compatibility sync for the remaining legacy sign/event code paths

## Production deployment

`.github/workflows/ci-cd.yml` runs `npm run migrate` before Terraform deploys a new backend revision.

Keep production schema changes backward-compatible and additive so the currently deployed backend can continue serving traffic until the new revision is rolled out.

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

Legacy compatibility tables retained because the backend still uses them:

- `signs`
- `events`

The `signs` table is now a compatibility surface for the remaining sign/event service code. The operational source of truth for active hardware is `devices`.

## Key enums

- `org_role`: `owner`, `admin`, `installer`, `member`
- `device_lifecycle_status`: `manufactured`, `unclaimed`, `claiming`, `active`, `lost`, `revoked`, `retired`
- `device_operational_status`: `available`, `assistance_requested`, `assistance_in_progress`, `offline`, `error`, `training_ready`, `training_positive`, `training_negative`
- `claim_status_type`: `unused`, `used`, `revoked`, `expired`
- `accessible_parking_type`: `standard`, `van_accessible`, `temporary`, `reserved`
- `sign_status`: legacy compatibility enum matching the remaining sign service

## Seeding

`npm run seed` applies only `seeds/dev_data_v2.sql`. The v2 seed includes:

- sample users and organizations
- organization memberships with installer/admin/owner roles
- sites and parking spaces
- devices in multiple lifecycle states
- installations and device events

Run the seed only after `npm run migrate` has completed successfully.
