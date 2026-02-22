-- Social Media Stack Database Schema
-- Version: 2.0.0
-- Description: Comprehensive schema for social media features with WorkOS authentication


-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing tables to ensure clean schema update (resolves column mismatches)
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS followers CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS users CASCADE;


-- Users table (updated for WorkOS)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workos_user_id VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- User profiles table (extended user information)
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

-- Followers relationship table (many-to-many)
CREATE TABLE IF NOT EXISTS followers (
    follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    following_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (follower_id, following_id),
    CONSTRAINT no_self_follow CHECK (follower_id != following_id)
);

-- Create enum type for status
CREATE TYPE sign_status AS ENUM (
    'available',
    'occupied',
    'offline',
    'error',
    'training_ready',
    'training_positive',
    'training_negative'
);

-- Create table
CREATE TABLE signs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    location TEXT NOT NULL,
    status sign_status NOT NULL DEFAULT 'available',
    last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Optional index if you query by status often
CREATE INDEX idx_signs_status ON signs(status);

-- Optional index if you sort/filter by last_updated
CREATE INDEX idx_signs_last_updated ON signs(last_updated);

-- Event type enum
CREATE TYPE event_type AS ENUM (
    'status_change',
    'alert',
    'maintenance',
    'misuse'
);

-- Events table
CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sign_id UUID NOT NULL REFERENCES signs(id) ON DELETE CASCADE,
    type event_type NOT NULL,
    data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Events indexes
CREATE INDEX idx_events_sign ON events(sign_id);
CREATE INDEX idx_events_type ON events(type);
CREATE INDEX idx_events_created_at ON events(created_at DESC);

-- Auto-update updated_at on events
CREATE TRIGGER update_events_updated_at
    BEFORE UPDATE ON events
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE events IS 'Sign notification events (status changes, alerts, maintenance, misuse)';
COMMENT ON COLUMN events.sign_id IS 'FK to the sign that generated this event';
COMMENT ON COLUMN events.type IS 'Category of the event';
COMMENT ON COLUMN events.data IS 'Arbitrary JSON payload with event-specific details';

-- Notifications table (optionally linked to an event)
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID REFERENCES events(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Notifications indexes
CREATE INDEX idx_notifications_event ON notifications(event_id);
CREATE INDEX idx_notifications_read ON notifications(read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);

-- Auto-update updated_at on notifications
CREATE TRIGGER update_notifications_updated_at
    BEFORE UPDATE ON notifications
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE notifications IS 'User notifications, optionally tied to a sign event';
COMMENT ON COLUMN notifications.user_id IS 'FK to the user who receives this notification';
COMMENT ON COLUMN notifications.event_id IS 'Optional FK to the event that triggered this notification';
COMMENT ON COLUMN notifications.read IS 'Whether the notification has been read by the user';

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_workos_id ON users(workos_user_id);

CREATE INDEX IF NOT EXISTS idx_followers_follower ON followers(follower_id);
CREATE INDEX IF NOT EXISTS idx_followers_following ON followers(following_id);

-- Function to update 'updated_at' timestamp automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers to auto-update 'updated_at' columns
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE users IS 'Core user accounts authenticated via WorkOS';
COMMENT ON TABLE profiles IS 'Extended user profile information for social features';
COMMENT ON TABLE followers IS 'Follower/following relationships between users';
COMMENT ON COLUMN users.workos_user_id IS 'WorkOS user identifier for authentication';
COMMENT ON COLUMN profiles.display_name IS 'User-chosen display name (can differ from account name)';
COMMENT ON COLUMN profiles.bio IS 'User biography/description';
COMMENT ON TABLE notifications IS 'User notifications, optionally tied to a sign event';

