-- Smart Handicap Sign Database Schema
-- Description: Schema for handicap sign management with WorkOS authentication


-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing tables to ensure clean schema update
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS events CASCADE;
DROP TABLE IF EXISTS signs CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Drop existing types
DROP TYPE IF EXISTS event_type CASCADE;
DROP TYPE IF EXISTS sign_status CASCADE;


-- ── Helper function (must be defined before triggers) ───────────────

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ── Users ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workos_user_id VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_workos_id ON users(workos_user_id);

CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE users IS 'Core user accounts authenticated via WorkOS';
COMMENT ON COLUMN users.workos_user_id IS 'WorkOS user identifier for authentication';


-- ── Profiles ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS profiles (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    display_name VARCHAR(100),
    bio TEXT,
    profile_image_url VARCHAR(500),
    cover_image_url VARCHAR(500),
    location VARCHAR(255),
    website VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE profiles IS 'Extended user profile information';
COMMENT ON COLUMN profiles.display_name IS 'User-chosen display name (can differ from account name)';
COMMENT ON COLUMN profiles.bio IS 'User biography/description';


-- ── Signs ───────────────────────────────────────────────────────────

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

CREATE TABLE signs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    location TEXT NOT NULL,
    status sign_status NOT NULL DEFAULT 'available',
    last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_signs_status ON signs(status);
CREATE INDEX idx_signs_last_updated ON signs(last_updated);


-- ── Events ──────────────────────────────────────────────────────────

CREATE TYPE event_type AS ENUM (
    'status_change',
    'alert',
    'maintenance',
    'misuse'
);

CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sign_id UUID NOT NULL REFERENCES signs(id) ON DELETE CASCADE,
    type event_type NOT NULL,
    data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_events_sign ON events(sign_id);
CREATE INDEX idx_events_type ON events(type);
CREATE INDEX idx_events_created_at ON events(created_at DESC);

CREATE TRIGGER update_events_updated_at
    BEFORE UPDATE ON events
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE events IS 'Sign events (status changes, alerts, maintenance, misuse)';
COMMENT ON COLUMN events.sign_id IS 'FK to the sign that generated this event';
COMMENT ON COLUMN events.type IS 'Category of the event';
COMMENT ON COLUMN events.data IS 'Arbitrary JSON payload with event-specific details';


-- ── Notifications ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID REFERENCES events(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notifications_event ON notifications(event_id);
CREATE INDEX idx_notifications_read ON notifications(read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);

CREATE TRIGGER update_notifications_updated_at
    BEFORE UPDATE ON notifications
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE notifications IS 'Notifications, optionally tied to a sign event';
COMMENT ON COLUMN notifications.event_id IS 'Optional FK to the event that triggered this notification';
COMMENT ON COLUMN notifications.read IS 'Whether the notification has been read';

