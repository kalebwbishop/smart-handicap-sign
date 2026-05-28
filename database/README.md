# Database

PostgreSQL 15 schema assets for the one-sign Hazard Hero pilot.

## Canonical assets

- `schemas/shs_schema.sql` — bootstrap entrypoint used by Docker and local setup
- `schemas/shs_schema_v2.sql` — canonical pilot schema loaded by `shs_schema.sql`
- `seeds/dev_data_v2.sql` — deterministic pilot seed data
- `scripts/migrate_v2.ts` — default migration entrypoint

## Commands

Run these from `database/`:

```bash
npm run migrate
npm run migrate:last-seen
npm run seed
```

Both scripts load `../backend/.env` and expect `POSTGRES_CONNECTION_STRING` (or `DATABASE_URL` for the seed script) to point at the target PostgreSQL instance.

## Migration behavior

`npm run migrate` drops and recreates the database as the pilot schema. It is destructive by design and should only be used where data reset is acceptable.

`npm run migrate:last-seen` is an additive migration that only ensures `devices.last_seen_at` exists on an already-provisioned pilot database.

## Pilot schema overview

The pilot database keeps only the tables needed for a single operator + single sign workflow:

- `users`
- `profiles`
- `devices`
- `device_events`

## Device states

`device_operational_status` supports only the pilot loop and basic health states:

- `available`
- `assistance_requested`
- `assistance_in_progress`
- `offline`
- `error`

Training states, organization tables, installation/claim workflow tables, push tokens, notifications, and billing/subscription fields are intentionally removed from the canonical schema.

## Seeding

`npm run seed` applies `seeds/dev_data_v2.sql`, which creates:

- one pilot operator record
- one pilot sign with a known serial number
- one sample device event

The seeded device token is `pilot-device-token` with serial `SHS-2605-S01-A7K-00001-J` for local pilot testing.
