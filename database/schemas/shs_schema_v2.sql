-- Hazard Hero pilot schema
-- Destructive by design: resets the database to the single-sign pilot model.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS device_events CASCADE;
DROP TABLE IF EXISTS devices CASCADE;
DROP TABLE IF EXISTS installations CASCADE;
DROP TABLE IF EXISTS notification_preferences CASCADE;
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
DROP TYPE IF EXISTS device_connectivity_status CASCADE;
DROP TYPE IF EXISTS device_operational_status CASCADE;
DROP TYPE IF EXISTS org_role CASCADE;

CREATE TYPE device_connectivity_status AS ENUM (
    'online',
    'offline'
);

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
    connectivity_status device_connectivity_status NOT NULL DEFAULT 'offline',
    operational_status device_operational_status NOT NULL DEFAULT 'available',
    last_seen_at       TIMESTAMPTZ,
    name               TEXT,
    created_at         TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at         TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_devices_serial ON devices(serial_number);
CREATE INDEX idx_devices_connectivity ON devices(connectivity_status);
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
    correct_response BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT device_events_correct_response_scope_check CHECK (
        (event_type = 'assistance_requested' AND correct_response IS NOT NULL)
        OR (event_type <> 'assistance_requested' AND correct_response IS NULL)
    )
);

CREATE INDEX idx_device_events_device ON device_events(device_id);
CREATE INDEX idx_device_events_device_created ON device_events(device_id, created_at DESC);

CREATE TABLE training_captures (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_serial_number VARCHAR(30) NOT NULL,
    capture_label       VARCHAR(50) NOT NULL DEFAULT 'unlabeled',
    firmware_version    VARCHAR(20),
    sample_count        INTEGER NOT NULL CHECK (sample_count > 0),
    sample_interval_ms  INTEGER NOT NULL DEFAULT 20 CHECK (sample_interval_ms > 0),
    samples             JSONB NOT NULL,
    created_at          TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT training_captures_samples_array_check CHECK (jsonb_typeof(samples) = 'array'),
    CONSTRAINT training_captures_count_check CHECK (sample_count = jsonb_array_length(samples))
);

CREATE INDEX idx_training_captures_device_created ON training_captures(device_serial_number, created_at DESC);
CREATE INDEX idx_training_captures_label_created ON training_captures(capture_label, created_at DESC);

CREATE TABLE notification_preferences (
    user_id                       UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    assistance_requests_enabled   BOOLEAN NOT NULL DEFAULT TRUE,
    push_enabled                  BOOLEAN NOT NULL DEFAULT TRUE,
    created_at                    TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at                    TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER update_notification_preferences_updated_at
    BEFORE UPDATE ON notification_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Assistance-request notifications should be inserted in the same transaction
-- as the device status transition and device_events row so the alert cannot be
-- lost if part of the workflow fails.
CREATE TABLE notifications (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_id       UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    device_event_id UUID NOT NULL REFERENCES device_events(id) ON DELETE CASCADE,
    kind            VARCHAR(50) NOT NULL,
    title           TEXT NOT NULL,
    body            TEXT NOT NULL,
    read            BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT notifications_user_event_unique UNIQUE (user_id, device_event_id)
);

CREATE INDEX idx_notifications_user_created ON notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_user_read ON notifications(user_id, read, created_at DESC);
CREATE INDEX idx_notifications_device ON notifications(device_id, created_at DESC);

CREATE TRIGGER update_notifications_updated_at
    BEFORE UPDATE ON notifications
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE push_tokens (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expo_push_token VARCHAR(255) NOT NULL UNIQUE,
    platform        VARCHAR(20),
    device_name     TEXT,
    created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_push_tokens_user ON push_tokens(user_id);

CREATE TRIGGER update_push_tokens_updated_at
    BEFORE UPDATE ON push_tokens
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
