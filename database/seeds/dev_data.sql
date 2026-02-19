-- Seed data for development environment
-- This file contains sample data for testing

-- Sample users (password for all users: 'password123')
-- Password hash generated with bcrypt, cost factor 10
INSERT INTO users (email, password_hash, name, is_verified) VALUES
    ('john.doe@example.com', '$2b$10$XOPbrlUPQdwdJUpSrIF6X.LbE8eeoooGlId3Kk3JcuN7oVVl/oWem', 'John Doe', true),
    ('jane.smith@example.com', '$2b$10$XOPbrlUPQdwdJUpSrIF6X.LbE8eeoooGlId3Kk3JcuN7oVVl/oWem', 'Jane Smith', true),
    ('bob.wilson@example.com', '$2b$10$XOPbrlUPQdwdJUpSrIF6X.LbE8eeoooGlId3Kk3JcuN7oVVl/oWem', 'Bob Wilson', false)
ON CONFLICT (email) DO NOTHING;

-- Note: In production, NEVER commit actual passwords or sensitive data
-- This is for development/testing only
