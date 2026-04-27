-- Seed data for development environment
-- This file contains sample data for testing

-- Sample users (authenticated via WorkOS OAuth)
INSERT INTO users (workos_user_id, email, name) VALUES
    ('user_dev_john_doe', 'john.doe@example.com', 'John Doe'),
    ('user_dev_jane_smith', 'jane.smith@example.com', 'Jane Smith'),
    ('user_dev_bob_wilson', 'bob.wilson@example.com', 'Bob Wilson')
ON CONFLICT (email) DO NOTHING;

-- Note: workos_user_id values are placeholders for local development only
-- In production, these are assigned by WorkOS during OAuth authentication
