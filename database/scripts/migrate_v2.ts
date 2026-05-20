import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as dotenv from 'dotenv';

// Load environment variables from backend/.env (same pattern as migrate.ts)
const envPath = path.resolve(__dirname, '../../backend/.env');
console.log(`Loading environment from: ${envPath}`);
dotenv.config({ path: envPath });

const POSTGRES_CONNECTION_STRING =
    process.env.POSTGRES_CONNECTION_STRING ??
    process.env.DATABASE_URL ??
    'postgresql://localhost:5432/smart_handicap_sign';

// ── Serial-number helpers ───────────────────────────────────────────

const SERIAL_PREFIX = 'SHS';
const LEGACY_MODEL = '0000';
const LEGACY_HW_REV = 'LEG';
const LEGACY_BATCH = 'AAA';
const CHECK_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1

/**
 * Compute a single check character over the body of a serial number.
 * Uses a simple weighted-sum mod-32 mapped to CHECK_ALPHABET.
 */
function computeCheckChar(body: string): string {
    let sum = 0;
    for (let i = 0; i < body.length; i++) {
        sum += body.charCodeAt(i) * (i + 1);
    }
    return CHECK_ALPHABET[sum % CHECK_ALPHABET.length];
}

/**
 * Generate a legacy serial number for a migrated sign.
 * Format: SHS-0000-LEG-AAA-XXXXX-C
 */
function generateLegacySerial(sequenceNum: number): string {
    const seq = String(sequenceNum).padStart(5, '0');
    const body = `${SERIAL_PREFIX}-${LEGACY_MODEL}-${LEGACY_HW_REV}-${LEGACY_BATCH}-${seq}`;
    const check = computeCheckChar(body);
    return `${body}-${check}`;
}

/**
 * Generate a deterministic claim-ID hash for a legacy device.
 * Since these devices are already deployed the claim is marked 'used'.
 */
function generateLegacyClaimHash(signId: string): { hash: string; salt: string } {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto
        .createHash('sha256')
        .update(`legacy-claim-${signId}-${salt}`)
        .digest('hex');
    return { hash, salt };
}

// ── v1 row shape ────────────────────────────────────────────────────

interface V1Sign {
    id: string;
    organization_id: string | null;
    name: string;
    location: string;
    status: string;
    last_updated: Date;
}

function mapLegacyOperationalStatus(status: string): string {
    switch (status) {
        case 'available':
        case 'assistance_requested':
        case 'assistance_in_progress':
        case 'offline':
        case 'error':
        case 'training_ready':
        case 'training_positive':
        case 'training_negative':
            return status;
        default:
            return 'error';
    }
}

const COMPATIBILITY_SIGNS_SQL = `
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'sign_status'
    ) THEN
        CREATE TYPE sign_status AS ENUM (
            'available',
            'assistance_requested',
            'assistance_in_progress',
            'offline',
            'error',
            'training_ready',
            'training_positive',
            'training_negative'
        );
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS signs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    location TEXT NOT NULL,
    status sign_status NOT NULL DEFAULT 'available',
    last_updated TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_signs_status ON signs(status);
CREATE INDEX IF NOT EXISTS idx_signs_last_updated ON signs(last_updated);
CREATE INDEX IF NOT EXISTS idx_signs_organization ON signs(organization_id);
`;

async function syncExistingV2Compatibility(client: Client, hasSignsTable: boolean) {
    const mode = hasSignsTable ? 'refreshing compatibility data' : 'adding missing compatibility objects';
    console.log(`\n📋 Detected existing v2 schema — ${mode}...`);

    await client.query('BEGIN');
    try {
        await client.query(COMPATIBILITY_SIGNS_SQL);

        const { rows } = await client.query<{
            inserted_signs: number;
            orphaned_events: number;
        }>(`
            WITH inserted AS (
                INSERT INTO signs (id, organization_id, name, location, status, last_updated)
                SELECT
                    d.id,
                    d.organization_id,
                    COALESCE(d.name, d.serial_number),
                    CASE
                        WHEN ps.label IS NOT NULL AND st.name IS NOT NULL THEN ps.label || ' @ ' || st.name
                        WHEN ps.label IS NOT NULL THEN ps.label
                        WHEN st.name IS NOT NULL THEN st.name
                        ELSE d.serial_number
                    END,
                    CASE
                        WHEN d.lifecycle_status = 'active' THEN d.operational_status::text::sign_status
                        WHEN d.operational_status::text IN ('offline', 'error') THEN d.operational_status::text::sign_status
                        ELSE 'offline'::sign_status
                    END,
                    COALESCE(d.updated_at, d.created_at, NOW())
                FROM devices d
                LEFT JOIN sites st ON st.id = d.current_site_id
                LEFT JOIN parking_spaces ps ON ps.id = d.current_parking_space_id
                WHERE NOT EXISTS (
                    SELECT 1 FROM signs legacy_sign WHERE legacy_sign.id = d.id
                )
                RETURNING 1
            ),
            orphaned AS (
                SELECT COUNT(*)::int AS count
                FROM events e
                LEFT JOIN signs s ON s.id = e.sign_id
                WHERE s.id IS NULL
            )
            SELECT
                (SELECT COUNT(*)::int FROM inserted) AS inserted_signs,
                (SELECT count FROM orphaned) AS orphaned_events
        `);

        await client.query('COMMIT');

        const insertedSigns = Number(rows[0]?.inserted_signs ?? 0);
        const orphanedEvents = Number(rows[0]?.orphaned_events ?? 0);

        console.log(`✅ v2 compatibility sync complete (${insertedSigns} sign row(s) ensured)`);
        if (orphanedEvents > 0) {
            console.warn(
                `⚠️  ${orphanedEvents} legacy event(s) still do not map to a compatibility sign row.`
            );
        }
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    }
}

// ── Main migration ──────────────────────────────────────────────────

async function migrateToV2() {
    const client = new Client({
        connectionString: POSTGRES_CONNECTION_STRING,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : undefined,
    });

    try {
        console.log('🔌 Connecting to database...');
        await client.connect();
        console.log('✅ Connected to database');

        // 1. Detect whether this is a fresh install, a true v1 schema, or
        //    an already-v2 database that needs a non-destructive compatibility sync.
        const tableCheck = await client.query(`
            SELECT
                EXISTS (
                    SELECT 1 FROM information_schema.tables
                    WHERE table_schema = 'public' AND table_name = 'signs'
                ) AS "hasSigns",
                EXISTS (
                    SELECT 1 FROM information_schema.tables
                    WHERE table_schema = 'public' AND table_name = 'devices'
                ) AS "hasDevices"
        `);
        const hasSignsTable: boolean = tableCheck.rows[0].hasSigns;
        const hasDevicesTable: boolean = tableCheck.rows[0].hasDevices;

        if (hasSignsTable && !hasDevicesTable) {
            await migrateFromV1(client);
        } else if (hasDevicesTable) {
            await syncExistingV2Compatibility(client, hasSignsTable);
        } else {
            await freshInstall(client);
        }
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    } finally {
        await client.end();
        console.log('🔌 Database connection closed');
    }
}

// ── v1 → v2 migration ──────────────────────────────────────────────

async function migrateFromV1(client: Client) {
    console.log('\n📋 Detected v1 schema (signs table exists). Starting migration...');

    // 1a. Read all existing signs before schema changeover
    const { rows: signs } = await client.query<V1Sign>(
        'SELECT id, organization_id, name, location, status, last_updated FROM signs ORDER BY last_updated'
    );
    console.log(`   Found ${signs.length} sign(s) to migrate`);

    // 1b. Also snapshot organization data so we can re-insert after v2 drops/creates
    const { rows: orgs } = await client.query(
        'SELECT id, name, created_at, updated_at FROM organizations'
    );
    console.log(`   Found ${orgs.length} organization(s) to preserve`);

    const { rows: orgMembers } = await client.query(
        'SELECT id, organization_id, user_id, role, created_at, updated_at FROM organization_members'
    );
    console.log(`   Found ${orgMembers.length} organization member(s) to preserve`);

    const { rows: users } = await client.query(
        'SELECT id, workos_user_id, email, name, avatar_url, created_at, updated_at FROM users'
    );
    console.log(`   Found ${users.length} user(s) to preserve`);

    const { rows: profiles } = await client.query(
        'SELECT user_id, display_name, bio, profile_image_url, cover_image_url, location, website, created_at, updated_at FROM profiles'
    );

    const { rows: events } = await client.query(
        'SELECT id, sign_id, type, data, created_at, updated_at FROM events'
    );
    console.log(`   Found ${events.length} event(s) to preserve`);

    const { rows: notifications } = await client.query(
        'SELECT id, user_id, event_id, title, body, read, created_at, updated_at FROM notifications'
    );
    console.log(`   Found ${notifications.length} notification(s) to preserve`);

    const { rows: pushTokens } = await client.query(
        'SELECT id, user_id, expo_push_token, device_id, created_at FROM push_tokens'
    );

    // 2. Apply v2 schema inside a transaction
    console.log('\n⏳ Applying v2 schema...');
    const schemaPath = path.join(__dirname, '../schemas/shs_schema_v2.sql');
    const schemaSQL = fs.readFileSync(schemaPath, 'utf-8');

    await client.query('BEGIN');

    try {
        await client.query(schemaSQL);
        console.log('✅ v2 schema applied');

        // 3. Re-insert preserved data

        // Users
        for (const u of users) {
            await client.query(
                `INSERT INTO users (id, workos_user_id, email, name, avatar_url, created_at, updated_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)
                 ON CONFLICT (id) DO NOTHING`,
                [u.id, u.workos_user_id, u.email, u.name, u.avatar_url, u.created_at, u.updated_at]
            );
        }
        console.log(`   ✅ Re-inserted ${users.length} user(s)`);

        // Profiles
        for (const p of profiles) {
            await client.query(
                `INSERT INTO profiles (user_id, display_name, bio, profile_image_url, cover_image_url, location, website, created_at, updated_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                 ON CONFLICT (user_id) DO NOTHING`,
                [p.user_id, p.display_name, p.bio, p.profile_image_url, p.cover_image_url, p.location, p.website, p.created_at, p.updated_at]
            );
        }
        console.log(`   ✅ Re-inserted ${profiles.length} profile(s)`);

        // Organizations (v2 adds billing_status, subscription_tier — use defaults)
        for (const o of orgs) {
            await client.query(
                `INSERT INTO organizations (id, name, created_at, updated_at)
                 VALUES ($1, $2, $3, $4)
                 ON CONFLICT (id) DO NOTHING`,
                [o.id, o.name, o.created_at, o.updated_at]
            );
        }
        console.log(`   ✅ Re-inserted ${orgs.length} organization(s)`);

        // Organization members (role enum now includes 'installer'; old values still valid)
        for (const om of orgMembers) {
            await client.query(
                `INSERT INTO organization_members (id, organization_id, user_id, role, created_at, updated_at)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 ON CONFLICT (id) DO NOTHING`,
                [om.id, om.organization_id, om.user_id, om.role, om.created_at, om.updated_at]
            );
        }
        console.log(`   ✅ Re-inserted ${orgMembers.length} organization member(s)`);

        // 4. Migrate signs → devices
        console.log('\n⏳ Migrating signs → devices...');
        let migrated = 0;
        const statusNotes: string[] = [];

        for (let i = 0; i < signs.length; i++) {
            const sign = signs[i];
            const serial = generateLegacySerial(i + 1);
            const { hash, salt } = generateLegacyClaimHash(sign.id);
            const operationalStatus = mapLegacyOperationalStatus(sign.status);

            let lifecycleStatus = 'active';
            if (sign.status === 'offline' || sign.status === 'error') {
                statusNotes.push(
                    `Sign "${sign.name}" (${sign.id}): was '${sign.status}' — mapped to 'active' (review recommended)`
                );
            }

            await client.query(
                `INSERT INTO devices (
                    id, serial_number, lifecycle_status, operational_status,
                    claim_id_hash, claim_id_salt, claim_status,
                    organization_id, name, created_at, updated_at
                 ) VALUES ($1, $2, $3::device_lifecycle_status, $4::device_operational_status, $5, $6, $7::claim_status_type, $8, $9, $10, $11)`,
                [
                    sign.id,
                    serial,
                    lifecycleStatus,
                    operationalStatus,
                    hash,
                    salt,
                    'used',           // already deployed
                    sign.organization_id,
                    sign.name,
                    sign.last_updated, // preserve original timestamp
                    sign.last_updated,
                ]
            );
            migrated++;
        }
        console.log(`   ✅ Migrated ${migrated} sign(s) → device(s)`);

        // 5. Re-insert compatibility signs for the remaining sign/event services
        for (const sign of signs) {
            await client.query(
                `INSERT INTO signs (id, organization_id, name, location, status, last_updated)
                 VALUES ($1, $2, $3, $4, $5::sign_status, $6)
                 ON CONFLICT (id) DO NOTHING`,
                [
                    sign.id,
                    sign.organization_id,
                    sign.name,
                    sign.location,
                    sign.status,
                    sign.last_updated,
                ]
            );
        }
        console.log(`   ✅ Restored ${signs.length} legacy sign(s) for compatibility`);

        // 6. Re-insert events (legacy — sign_id column retained in v2 schema)
        for (const e of events) {
            await client.query(
                `INSERT INTO events (id, sign_id, type, data, created_at, updated_at)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 ON CONFLICT (id) DO NOTHING`,
                [e.id, e.sign_id, e.type, e.data, e.created_at, e.updated_at]
            );
        }
        console.log(`   ✅ Re-inserted ${events.length} legacy event(s)`);

        // Notifications
        for (const n of notifications) {
            await client.query(
                `INSERT INTO notifications (id, user_id, event_id, title, body, read, created_at, updated_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                 ON CONFLICT (id) DO NOTHING`,
                [n.id, n.user_id, n.event_id, n.title, n.body, n.read, n.created_at, n.updated_at]
            );
        }
        console.log(`   ✅ Re-inserted ${notifications.length} notification(s)`);

        // Push tokens
        for (const pt of pushTokens) {
            await client.query(
                `INSERT INTO push_tokens (id, user_id, expo_push_token, device_id, created_at)
                 VALUES ($1, $2, $3, $4, $5)
                 ON CONFLICT (id) DO NOTHING`,
                [pt.id, pt.user_id, pt.expo_push_token, pt.device_id, pt.created_at]
            );
        }
        console.log(`   ✅ Re-inserted ${pushTokens.length} push token(s)`);

        // Log an audit entry for the migration itself
        await client.query(
            `INSERT INTO audit_logs (action, entity_type, entity_id, metadata)
             VALUES ('schema.migrate_v1_to_v2', 'system', uuid_generate_v4(), $1)`,
            [JSON.stringify({
                signs_migrated: migrated,
                orgs_preserved: orgs.length,
                users_preserved: users.length,
                events_preserved: events.length,
                timestamp: new Date().toISOString(),
            })]
        );

        await client.query('COMMIT');

        // ── Summary ─────────────────────────────────────────────────
        console.log('\n🎉 v1 → v2 migration completed successfully!\n');
        console.log('── Migration Summary ──────────────────────────────');
        console.log(`   Users preserved:          ${users.length}`);
        console.log(`   Profiles preserved:        ${profiles.length}`);
        console.log(`   Organizations preserved:   ${orgs.length}`);
        console.log(`   Org members preserved:     ${orgMembers.length}`);
        console.log(`   Signs → Devices migrated:  ${migrated}`);
        console.log(`   Signs restored:            ${signs.length}`);
        console.log(`   Legacy events preserved:   ${events.length}`);
        console.log(`   Notifications preserved:   ${notifications.length}`);
        console.log(`   Push tokens preserved:     ${pushTokens.length}`);
        console.log('───────────────────────────────────────────────────');

        if (statusNotes.length > 0) {
            console.log('\n⚠️  Status notes (review recommended):');
            statusNotes.forEach((note) => console.log(`   • ${note}`));
        }
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    }
}

// ── Fresh install (no v1 data) ──────────────────────────────────────

async function freshInstall(client: Client) {
    console.log('\n📋 No existing schema detected — treating as fresh install.');
    console.log('⏳ Applying v2 schema...');

    const schemaPath = path.join(__dirname, '../schemas/shs_schema_v2.sql');
    const schemaSQL = fs.readFileSync(schemaPath, 'utf-8');

    await client.query('BEGIN');
    try {
        await client.query(schemaSQL);
        await client.query('COMMIT');
        console.log('✅ v2 schema applied (fresh install)');
        console.log('🎉 Database is ready — no data to migrate.');
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    }
}

// ── Entry point ─────────────────────────────────────────────────────
migrateToV2();
