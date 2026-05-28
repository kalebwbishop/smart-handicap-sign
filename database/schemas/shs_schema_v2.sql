-- Hazard Hero pilot schema
-- Destructive by design: resets the database to the single-sign pilot model.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS device_events CASCADE;
DROP TABLE IF EXISTS devices CASCADE;
DROP TABLE IF EXISTS installations CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS organization_members CASCADE;
DROP TABLE IF EXISTS organizations CASCADE;
DROP TABLE IF EXISTS parking_spaces CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS push_tokens CASCADE;
DROP TABLE IF EXISTS sites CASCADE;
DROP TABLE IF EXISTS users CASCADE;

DROP TYPE IF EXISTS accessible_parking_type CASCADE;
DROP TYPE IF EXISTS claim_status_type CASCADE;
DROP TYPE IF EXISTS device_lifecycle_status CASCADE;
DROP TYPE IF EXISTS device_operational_status CASCADE;
DROP TYPE IF EXISTS org_role CASCADE;

CREATE TYPE device_operational_status AS ENUM (
    'available',
    'assistance_requested',
    'assistance_in_progress',
    'offline',
    'error'
);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workos_user_id  VARCHAR(255) UNIQUE NOT NULL,
    email           VARCHAR(255) UNIQUE NOT NULL,
    name            VARCHAR(255) NOT NULL,
    avatar_url      TEXT,
    created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_workos_id ON users(workos_user_id);

CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE profiles (
    user_id            UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    display_name       VARCHAR(100),
    bio                TEXT,
    profile_image_url  VARCHAR(500),
    cover_image_url    VARCHAR(500),
    location           VARCHAR(255),
    website            VARCHAR(255),
    created_at         TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at         TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE devices (
    id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    serial_number      VARCHAR(30) UNIQUE NOT NULL,
    model_code         VARCHAR(10),
    hardware_revision  VARCHAR(10),
    firmware_version   VARCHAR(20),
    auth_token_hash    VARCHAR(128),
    auth_token_salt    VARCHAR(64),
    operational_status device_operational_status NOT NULL DEFAULT 'available',
    last_seen_at       TIMESTAMPTZ,
    name               TEXT,
    created_at         TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at         TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_devices_serial ON devices(serial_number);
CREATE INDEX idx_devices_operational ON devices(operational_status);

CREATE TRIGGER update_devices_updated_at
    BEFORE UPDATE ON devices
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE device_events (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id  UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    payload    JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_device_events_device ON device_events(device_id);
CREATE INDEX idx_device_events_device_created ON device_events(device_id, created_at DESC);
