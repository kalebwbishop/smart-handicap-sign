-- Smart Handicap Sign — Database Schema v2
-- Description: Canonical schema for device lifecycle, site management, and
--              installation tracking with WorkOS authentication.
-- Run: psql -f shs_schema_v2.sql


-- ════════════════════════════════════════════════════════════════════
-- 0. Extensions
-- ════════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- ════════════════════════════════════════════════════════════════════
-- 1. Drop existing objects (reverse dependency order)
-- ════════════════════════════════════════════════════════════════════

DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS device_events CASCADE;
DROP TABLE IF EXISTS installations CASCADE;
DROP TABLE IF EXISTS parking_spaces CASCADE;
DROP TABLE IF EXISTS sites CASCADE;
DROP TABLE IF EXISTS push_tokens CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS devices CASCADE;
DROP TABLE IF EXISTS organization_members CASCADE;
DROP TABLE IF EXISTS organizations CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS users CASCADE;

DROP TYPE IF EXISTS accessible_parking_type CASCADE;
DROP TYPE IF EXISTS claim_status_type CASCADE;
DROP TYPE IF EXISTS device_operational_status CASCADE;
DROP TYPE IF EXISTS device_lifecycle_status CASCADE;
DROP TYPE IF EXISTS org_role CASCADE;


-- ════════════════════════════════════════════════════════════════════
-- 2. Enum types
-- ════════════════════════════════════════════════════════════════════

CREATE TYPE org_role AS ENUM ('owner', 'admin', 'installer', 'member');

CREATE TYPE device_lifecycle_status AS ENUM (
    'manufactured',
    'unclaimed',
    'claiming',
    'active',
    'lost',
    'revoked',
    'retired'
);

CREATE TYPE device_operational_status AS ENUM (
    'available',
    'assistance_requested',
    'assistance_in_progress',
    'offline',
    'error',
    'training_ready',
    'training_positive',
    'training_negative'
);

CREATE TYPE claim_status_type AS ENUM (
    'unused',
    'used',
    'revoked',
    'expired'
);

CREATE TYPE accessible_parking_type AS ENUM (
    'standard',
    'van_accessible',
    'temporary',
    'reserved'
);


-- ════════════════════════════════════════════════════════════════════
-- 3. Helper function (must precede triggers)
-- ════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ════════════════════════════════════════════════════════════════════
-- 4. Tables
-- ════════════════════════════════════════════════════════════════════


-- ── Users (unchanged from v1) ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workos_user_id VARCHAR(255) UNIQUE NOT NULL,
    email       VARCHAR(255) UNIQUE NOT NULL,
    name        VARCHAR(255) NOT NULL,
    avatar_url  TEXT,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_workos_id ON users(workos_user_id);

CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE  users IS 'Core user accounts authenticated via WorkOS';
COMMENT ON COLUMN users.workos_user_id IS 'WorkOS user identifier for authentication';


-- ── Profiles (unchanged from v1) ────────────────────────────────────

CREATE TABLE IF NOT EXISTS profiles (
    user_id          UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    display_name     VARCHAR(100),
    bio              TEXT,
    profile_image_url VARCHAR(500),
    cover_image_url  VARCHAR(500),
    location         VARCHAR(255),
    website          VARCHAR(255),
    created_at       TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE  profiles IS 'Extended user profile information';
COMMENT ON COLUMN profiles.display_name IS 'User-chosen display name (can differ from account name)';
COMMENT ON COLUMN profiles.bio IS 'User biography/description';


-- ── Organizations (evolved: +billing_status, +subscription_tier) ────

CREATE TABLE organizations (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name              TEXT NOT NULL,
    billing_status    VARCHAR(50) DEFAULT 'active',
    subscription_tier VARCHAR(50) DEFAULT 'standard',
    created_at        TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER update_organizations_updated_at
    BEFORE UPDATE ON organizations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE  organizations IS 'Organizations that own devices and group users';
COMMENT ON COLUMN organizations.billing_status IS 'Current billing state (active, past_due, suspended, …)';
COMMENT ON COLUMN organizations.subscription_tier IS 'Plan tier (standard, pro, enterprise, …)';


-- ── Organization Members (evolved: org_role now includes installer) ──

CREATE TABLE organization_members (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role            org_role NOT NULL DEFAULT 'member',
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (organization_id, user_id)
);

CREATE INDEX idx_org_members_org  ON organization_members(organization_id);
CREATE INDEX idx_org_members_user ON organization_members(user_id);

CREATE TRIGGER update_org_members_updated_at
    BEFORE UPDATE ON organization_members
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE  organization_members IS 'Membership linking users to organizations with roles';
COMMENT ON COLUMN organization_members.role IS 'owner: full control, admin: manage members/devices, installer: field installs, member: view-only';


-- ── Sites (new) ─────────────────────────────────────────────────────

CREATE TABLE sites (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    address_line_1  TEXT,
    address_line_2  TEXT,
    city            VARCHAR(100),
    state           VARCHAR(100),
    postal_code     VARCHAR(20),
    country         VARCHAR(100) DEFAULT 'US',
    jurisdiction    TEXT,
    created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sites_organization ON sites(organization_id);

CREATE TRIGGER update_sites_updated_at
    BEFORE UPDATE ON sites
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE  sites IS 'Physical locations (lots, garages, campuses) belonging to an organization';
COMMENT ON COLUMN sites.jurisdiction IS 'Local ADA / accessibility jurisdiction that governs this site';


-- ── Devices ──────────────────────────────────────────────────────────

CREATE TABLE devices (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    serial_number           VARCHAR(30) UNIQUE NOT NULL,
    model_code              VARCHAR(10),
    hardware_revision       VARCHAR(10),
    firmware_version        VARCHAR(20),
    manufacture_batch       VARCHAR(20),
    public_key_fingerprint  VARCHAR(64),
    certificate_id          VARCHAR(64),
    auth_token_hash         VARCHAR(128),
    auth_token_salt         VARCHAR(32),
    lifecycle_status        device_lifecycle_status NOT NULL DEFAULT 'manufactured',
    operational_status      device_operational_status NOT NULL DEFAULT 'available',
    claim_id_hash           VARCHAR(128),
    claim_id_salt           VARCHAR(32),
    claim_status            claim_status_type DEFAULT 'unused',
    claim_expires_at        TIMESTAMPTZ,
    claimed_by_user_id      UUID REFERENCES users(id),
    claimed_at              TIMESTAMPTZ,
    organization_id         UUID REFERENCES organizations(id),
    current_site_id         UUID REFERENCES sites(id),
    current_parking_space_id UUID,  -- FK added after parking_spaces is created
    name                    TEXT,
    created_at              TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_devices_serial          ON devices(serial_number);
CREATE INDEX idx_devices_organization    ON devices(organization_id);
CREATE INDEX idx_devices_lifecycle       ON devices(lifecycle_status);
CREATE INDEX idx_devices_operational     ON devices(operational_status);
CREATE INDEX idx_devices_claim_status    ON devices(claim_status);
CREATE INDEX idx_devices_current_site    ON devices(current_site_id);
CREATE INDEX idx_devices_current_space   ON devices(current_parking_space_id);

CREATE TRIGGER update_devices_updated_at
    BEFORE UPDATE ON devices
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE  devices IS 'Physical smart-sign hardware units tracked through their full lifecycle';
COMMENT ON COLUMN devices.serial_number IS 'Factory-assigned globally unique serial number';
COMMENT ON COLUMN devices.lifecycle_status IS 'Where the device sits in its lifecycle (manufactured → active → retired)';
COMMENT ON COLUMN devices.operational_status IS 'Runtime operational state used by firmware status polling; only available permits sampling';
COMMENT ON COLUMN devices.claim_id_hash IS 'Bcrypt/SHA hash of the one-time claim code printed on the device';
COMMENT ON COLUMN devices.claim_id_salt IS 'Salt used when hashing the claim code';
COMMENT ON COLUMN devices.claim_status IS 'Whether the claim code has been used, revoked, or expired';
COMMENT ON COLUMN devices.public_key_fingerprint IS 'Fingerprint of the device''s public key for mutual TLS';
COMMENT ON COLUMN devices.certificate_id IS 'Reference to the device''s PKI certificate';
COMMENT ON COLUMN devices.auth_token_hash IS 'SHA-256 hash of the per-device bearer token used for API authentication';
COMMENT ON COLUMN devices.auth_token_salt IS 'Salt used when hashing the device bearer token';


-- ── Parking Spaces (new) ────────────────────────────────────────────

CREATE TABLE parking_spaces (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    site_id           UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    label             VARCHAR(50) NOT NULL,
    accessible_type   accessible_parking_type NOT NULL DEFAULT 'standard',
    latitude          DECIMAL(10, 7),
    longitude         DECIMAL(10, 7),
    notes             TEXT,
    current_device_id UUID REFERENCES devices(id),
    created_at        TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_parking_spaces_site ON parking_spaces(site_id);
CREATE UNIQUE INDEX idx_parking_spaces_current_device
    ON parking_spaces(current_device_id)
    WHERE current_device_id IS NOT NULL;

CREATE TRIGGER update_parking_spaces_updated_at
    BEFORE UPDATE ON parking_spaces
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE  parking_spaces IS 'Individual accessible parking spaces within a site';
COMMENT ON COLUMN parking_spaces.label IS 'Human-readable label painted on the space (e.g. "A-12")';
COMMENT ON COLUMN parking_spaces.accessible_type IS 'ADA classification of the space';
COMMENT ON COLUMN parking_spaces.current_device_id IS 'The device currently mounted at this space (one device per space)';

-- Now add the deferred FK from devices → parking_spaces
ALTER TABLE devices
    ADD CONSTRAINT fk_devices_current_parking_space
    FOREIGN KEY (current_parking_space_id) REFERENCES parking_spaces(id);


-- ── Installations (new) ─────────────────────────────────────────────

CREATE TABLE installations (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id           UUID NOT NULL REFERENCES devices(id),
    organization_id     UUID NOT NULL REFERENCES organizations(id),
    site_id             UUID NOT NULL REFERENCES sites(id),
    parking_space_id    UUID NOT NULL REFERENCES parking_spaces(id),
    installer_user_id   UUID NOT NULL REFERENCES users(id),
    installation_photos JSONB DEFAULT '[]'::jsonb,
    install_notes       TEXT,
    installed_at        TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    activation_status   VARCHAR(20) DEFAULT 'active',
    created_at          TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_installations_device    ON installations(device_id);
CREATE INDEX idx_installations_site      ON installations(site_id);
CREATE INDEX idx_installations_installer ON installations(installer_user_id);

CREATE TRIGGER update_installations_updated_at
    BEFORE UPDATE ON installations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE  installations IS 'Record of a device being physically installed at a parking space';
COMMENT ON COLUMN installations.installation_photos IS 'JSON array of photo URLs taken during install';
COMMENT ON COLUMN installations.activation_status IS 'Whether this installation is active, decommissioned, etc.';


-- ── Device Events ────────────────────────────────────────────────────

CREATE TABLE device_events (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id  UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    payload    JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_device_events_device          ON device_events(device_id);
CREATE INDEX idx_device_events_device_created   ON device_events(device_id, created_at DESC);

COMMENT ON TABLE  device_events IS 'Telemetry and lifecycle events emitted by devices';
COMMENT ON COLUMN device_events.event_type IS 'Machine-readable event category (e.g. heartbeat, button_press, firmware_update)';
COMMENT ON COLUMN device_events.payload IS 'Arbitrary JSON payload with event-specific data';


-- ── Notifications ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notifications (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id          UUID REFERENCES users(id) ON DELETE CASCADE,
    device_event_id  UUID REFERENCES device_events(id) ON DELETE SET NULL,
    title            TEXT NOT NULL,
    body             TEXT NOT NULL,
    read             BOOLEAN NOT NULL DEFAULT FALSE,
    created_at       TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notifications_user        ON notifications(user_id);
CREATE INDEX idx_notifications_device_event ON notifications(device_event_id);
CREATE INDEX idx_notifications_read        ON notifications(read);
CREATE INDEX idx_notifications_created_at  ON notifications(created_at DESC);
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, read) WHERE read = FALSE;

CREATE TRIGGER update_notifications_updated_at
    BEFORE UPDATE ON notifications
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE  notifications IS 'Per-user notifications, optionally tied to a device event';
COMMENT ON COLUMN notifications.user_id IS 'The user this notification belongs to';
COMMENT ON COLUMN notifications.device_event_id IS 'Optional FK to v2 device event that triggered this notification';
COMMENT ON COLUMN notifications.read IS 'Whether the notification has been read';


-- ── Push Tokens (unchanged from v1) ─────────────────────────────────

CREATE TABLE IF NOT EXISTS push_tokens (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expo_push_token TEXT NOT NULL UNIQUE,
    device_id       TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id ON push_tokens(user_id);

COMMENT ON TABLE  push_tokens IS 'Expo push notification tokens per user/device';
COMMENT ON COLUMN push_tokens.expo_push_token IS 'Unique Expo push token string';
COMMENT ON COLUMN push_tokens.device_id IS 'Optional client-supplied device identifier';


-- ── Audit Logs (new) ────────────────────────────────────────────────

CREATE TABLE audit_logs (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor_user_id UUID REFERENCES users(id),
    action        VARCHAR(100) NOT NULL,
    entity_type   VARCHAR(50) NOT NULL,
    entity_id     UUID NOT NULL,
    metadata      JSONB DEFAULT '{}'::jsonb,
    created_at    TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_logs_entity     ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_actor      ON audit_logs(actor_user_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);

COMMENT ON TABLE  audit_logs IS 'Immutable audit trail for all significant actions in the system';
COMMENT ON COLUMN audit_logs.actor_user_id IS 'The user who performed the action (NULL for system actions)';
COMMENT ON COLUMN audit_logs.action IS 'Machine-readable action name (e.g. device.claim, installation.create)';
COMMENT ON COLUMN audit_logs.entity_type IS 'The type of entity acted upon (device, site, installation, …)';
COMMENT ON COLUMN audit_logs.entity_id IS 'PK of the entity acted upon';
COMMENT ON COLUMN audit_logs.metadata IS 'Additional context about the action (before/after values, IP, etc.)';
