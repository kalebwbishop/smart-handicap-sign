# Database

PostgreSQL 15 schema assets for the one-sign Hazard Hero pilot.

## Canonical assets

- `schemas/shs_schema.sql` — bootstrap entrypoint used by Docker and local setup
- `schemas/shs_schema_v2.sql` — canonical pilot schema loaded by `shs_schema.sql`
- `seeds/dev_data_v2.sql` — deterministic pilot sign bootstrap data
- `scripts/migrate_v2.ts` — default migration entrypoint

## Commands

Run these from `database/`:

```bash
npm run migrate
npm run migrate:last-seen
npm run load:sign
npm run seed
```

The scripts load `../backend/.env` and expect `POSTGRES_CONNECTION_STRING` (or `DATABASE_URL` for the sign load script) to point at the target PostgreSQL instance.

## Migration behavior

`npm run migrate` drops and recreates the database as the pilot schema. It is destructive by design and should only be used where data reset is acceptable.

`npm run migrate:last-seen` is an additive migration that ensures `devices.last_seen_at` and `devices.connectivity_status` exist on an already-provisioned pilot database.

## Pilot schema overview

The pilot database keeps only the tables needed for a single operator + single sign workflow:

- `users`
- `profiles`
- `devices`
- `device_events`
- `notifications`
- `notification_preferences`
- `push_tokens`

`device_events` now stores the raw assistance-request samples inside `payload` and a `correct_response` label that operators can flip to false when the request was a false positive.

## Device states

`device_connectivity_status` tracks backend-authored connection freshness:

- `online`
- `offline`

`device_operational_status` supports only the pilot loop and basic health states:

- `available`
- `assistance_requested`
- `assistance_in_progress`
- `offline`
- `error`

Training states, organization tables, installation/claim workflow tables, and billing/subscription fields are intentionally removed from the canonical schema. The pilot notification schema only supports assistance-request alerts plus operator opt-out and Expo push token storage.

## Assistance-request notifications

The pilot schema now includes the minimum persistence needed for operator notifications:

- `notifications` stores one assistance-request alert per `(user_id, device_event_id)` so later service code can suppress duplicates per operator.
- `notification_preferences` stores operator opt-out state. Missing rows should be treated as the pilot default: notifications enabled and push enabled.
- `push_tokens` stores Expo push tokens for authenticated operators.

`connectivity_status` is the backend-authored offline indicator. When the sweep marks a device offline, the backend also records a device event and operator notification.

## Pilot sign bootstrap

`npm run load:sign` applies `seeds/dev_data_v2.sql`, which creates only the pilot sign/device row required by the runtime API. It does not create user, profile, organization, parking-space, or device-event records.

`npm run seed` is kept as a backwards-compatible alias for the same sign-only load.

The seeded device token is `pilot-device-token` with serial `SHS-2605-S01-A7K-00001-J` for local pilot testing.
