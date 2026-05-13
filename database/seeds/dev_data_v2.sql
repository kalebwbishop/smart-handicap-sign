-- ════════════════════════════════════════════════════════════════════
-- Seed data for development environment (v2 schema)
-- ════════════════════════════════════════════════════════════════════
-- Run AFTER shs_schema_v2.sql has been applied:
--   psql -f schemas/shs_schema_v2.sql
--   psql -f seeds/dev_data_v2.sql
--
-- All INSERTs use ON CONFLICT DO NOTHING so the file is safely re-runnable.
-- UUIDs are hardcoded for deterministic foreign-key references in dev/test.
-- ════════════════════════════════════════════════════════════════════


-- ────────────────────────────────────────────────────────────────────
-- 1. Users (authenticated via WorkOS OAuth)
-- ────────────────────────────────────────────────────────────────────
-- workos_user_id values are placeholders for local development only.
-- In production these are assigned by WorkOS during OAuth authentication.

INSERT INTO users (id, workos_user_id, email, name) VALUES
    ('a0000000-0000-0000-0000-000000000001', 'user_dev_john_doe',     'john.doe@example.com',     'John Doe'),
    ('a0000000-0000-0000-0000-000000000002', 'user_dev_jane_smith',   'jane.smith@example.com',   'Jane Smith'),
    ('a0000000-0000-0000-0000-000000000003', 'user_dev_bob_wilson',   'bob.wilson@example.com',   'Bob Wilson'),
    ('a0000000-0000-0000-0000-000000000004', 'user_dev_alice_garcia', 'alice.garcia@example.com', 'Alice Garcia'),
    ('a0000000-0000-0000-0000-000000000005', 'user_dev_mike_chen',    'mike.chen@example.com',    'Mike Chen')
ON CONFLICT (email) DO NOTHING;


-- ────────────────────────────────────────────────────────────────────
-- 2. Organizations
-- ────────────────────────────────────────────────────────────────────

INSERT INTO organizations (id, name, billing_status, subscription_tier) VALUES
    ('b0000000-0000-0000-0000-000000000001', 'Acme Parking Services',   'active',  'pro'),
    ('b0000000-0000-0000-0000-000000000002', 'City of Mapleton',        'active',  'enterprise'),
    ('b0000000-0000-0000-0000-000000000003', 'Springfield Medical',     'active',  'standard')
ON CONFLICT DO NOTHING;


-- ────────────────────────────────────────────────────────────────────
-- 3. Organization members (various roles)
-- ────────────────────────────────────────────────────────────────────
-- Roles: owner | admin | installer | member

INSERT INTO organization_members (id, organization_id, user_id, role) VALUES
    -- Acme Parking: John=owner, Jane=admin, Bob=installer
    ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'owner'),
    ('c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'admin'),
    ('c0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003', 'installer'),
    -- City of Mapleton: Alice=owner, Mike=installer
    ('c0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000004', 'owner'),
    ('c0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000005', 'installer'),
    -- Springfield Medical: Jane=member (cross-org membership)
    ('c0000000-0000-0000-0000-000000000006', 'b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000002', 'member')
ON CONFLICT (organization_id, user_id) DO NOTHING;


-- ────────────────────────────────────────────────────────────────────
-- 4. Sites (physical locations with addresses)
-- ────────────────────────────────────────────────────────────────────

INSERT INTO sites (id, organization_id, name, address_line_1, city, state, postal_code, country, jurisdiction) VALUES
    ('d0000000-0000-0000-0000-000000000001',
     'b0000000-0000-0000-0000-000000000001',
     'Downtown Parking Garage',
     '100 Main Street', 'Portland', 'OR', '97201', 'US',
     'City of Portland ADA Standards'),
    ('d0000000-0000-0000-0000-000000000002',
     'b0000000-0000-0000-0000-000000000001',
     'Airport Economy Lot',
     '7000 NE Airport Way', 'Portland', 'OR', '97218', 'US',
     'Port of Portland ADA Standards'),
    ('d0000000-0000-0000-0000-000000000003',
     'b0000000-0000-0000-0000-000000000002',
     'City Hall Lot',
     '200 Civic Drive', 'Mapleton', 'OR', '97453', 'US',
     'Mapleton Municipal Code §12.40')
ON CONFLICT DO NOTHING;


-- ────────────────────────────────────────────────────────────────────
-- 5. Parking spaces (different accessible types)
-- ────────────────────────────────────────────────────────────────────

INSERT INTO parking_spaces (id, site_id, label, accessible_type, latitude, longitude, notes) VALUES
    ('e0000000-0000-0000-0000-000000000001',
     'd0000000-0000-0000-0000-000000000001',
     'A-01', 'standard', 45.5152000, -122.6784000,
     'Ground level, near elevator'),
    ('e0000000-0000-0000-0000-000000000002',
     'd0000000-0000-0000-0000-000000000001',
     'A-02', 'van_accessible', 45.5152100, -122.6784100,
     'Ground level, extra-wide with side ramp clearance'),
    ('e0000000-0000-0000-0000-000000000003',
     'd0000000-0000-0000-0000-000000000002',
     'E-10', 'standard', 45.5887000, -122.5975000,
     'Covered section near terminal shuttle'),
    ('e0000000-0000-0000-0000-000000000004',
     'd0000000-0000-0000-0000-000000000003',
     'H-03', 'reserved', 45.1575000, -123.7285000,
     'Reserved for city employees with permits'),
    ('e0000000-0000-0000-0000-000000000005',
     'd0000000-0000-0000-0000-000000000003',
     'H-04', 'temporary', 45.1575100, -123.7285100,
     'Temporary space for construction period')
ON CONFLICT DO NOTHING;


-- ────────────────────────────────────────────────────────────────────
-- 6. Devices
-- ────────────────────────────────────────────────────────────────────
--
-- Serial number format:  SHS-YYMM-MDL-BBB-SSSSS-C
--   YY=year, MM=month, MDL=model, BBB=batch, SSSSS=sequence, C=check char
--
-- Check-character algorithm:
--   prefix = serial up to (not including) the final "-C" segment
--   value  = sum( ord(char) * (position+1) )  for each char in prefix
--   index  = value % 32
--   char   = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[index]
--
-- Claim ID hashing algorithm:
--   1. Normalize claim: uppercase, strip hyphens
--   2. hash = SHA-256( bytes.fromhex(salt) + normalized.encode() )
--
-- Pre-computed claim IDs for testing (plain-text → hash):
--   "TEST-CL01" (salt a1b2…a7b8) → d589d83eac923dc903ac3a7fca95ed2af220ff78a8f2d6ae72715b880c141f54
--   "9Q7M-2KD8" (salt dead…cdef) → dd9d343ac1791450e31bceaf33e46a14d761794c76b47aa4c373c2c3d1a624ca
--   "ABCD-EF23" (salt 0123…cdef) → 2e704fa9da7d96a6bc6504211a703f06b144233b717fc2fcdca7cbc9a89af087

INSERT INTO devices (
    id, serial_number, model_code, hardware_revision, firmware_version,
    manufacture_batch, lifecycle_status, operational_status,
    auth_token_hash, auth_token_salt,
    claim_id_hash, claim_id_salt, claim_status, claim_expires_at,
    claimed_by_user_id, claimed_at, organization_id, current_site_id,
    current_parking_space_id, name
) VALUES
    -- Device 1: manufactured, unused claim "TEST-CL01"
    ('f0000000-0000-0000-0000-000000000001',
     'SHS-2605-S01-A7K-00001-J', 'S01', 'rev3', '1.0.0', 'A7K',
    'manufactured', 'available',
    'fake-dev-token-hash-00001', 'fake-dev-token-salt-00001',
     'd589d83eac923dc903ac3a7fca95ed2af220ff78a8f2d6ae72715b880c141f54',
     'a1b2c3d4e5f6a7b8a1b2c3d4e5f6a7b8', 'unused',
     NOW() + INTERVAL '90 days',
     NULL, NULL, NULL, NULL, NULL, NULL),

    -- Device 2: unclaimed, unused claim "9Q7M-2KD8"
    ('f0000000-0000-0000-0000-000000000002',
     'SHS-2605-S01-A7K-00002-8', 'S01', 'rev3', '1.0.0', 'A7K',
    'unclaimed', 'available',
    'fake-dev-token-hash-00002', 'fake-dev-token-salt-00002',
     'dd9d343ac1791450e31bceaf33e46a14d761794c76b47aa4c373c2c3d1a624ca',
     'deadbeefcafebabe1234567890abcdef', 'unused',
     NOW() + INTERVAL '90 days',
     NULL, NULL, NULL, NULL, NULL, NULL),

    -- Device 3: unclaimed, unused claim "ABCD-EF23"
    ('f0000000-0000-0000-0000-000000000003',
     'SHS-2605-S01-A7K-00003-W', 'S01', 'rev3', '1.0.0', 'A7K',
    'unclaimed', 'available',
    'fake-dev-token-hash-00003', 'fake-dev-token-salt-00003',
     '2e704fa9da7d96a6bc6504211a703f06b144233b717fc2fcdca7cbc9a89af087',
     '0123456789abcdef0123456789abcdef', 'unused',
     NOW() + INTERVAL '90 days',
     NULL, NULL, NULL, NULL, NULL, NULL),

    -- Device 4: active, claimed by John, assigned to Acme / Downtown Garage / space A-01
    ('f0000000-0000-0000-0000-000000000004',
     'SHS-2605-S01-B2M-00004-P', 'S01', 'rev3', '1.2.0', 'B2M',
    'active', 'available',
    'fake-dev-token-hash-00004', 'fake-dev-token-salt-00004',
     NULL, NULL, 'used', NULL,
     'a0000000-0000-0000-0000-000000000001', NOW() - INTERVAL '30 days',
     'b0000000-0000-0000-0000-000000000001',
     'd0000000-0000-0000-0000-000000000001',
     'e0000000-0000-0000-0000-000000000001',
     'Downtown Garage - A-01'),

    -- Device 5: active, different org (City of Mapleton), City Hall / space H-03
    ('f0000000-0000-0000-0000-000000000005',
     'SHS-2604-S01-A7K-00005-2', 'S01', 'rev2', '1.1.0', 'A7K',
    'active', 'assistance_requested',
    'fake-dev-token-hash-00005', 'fake-dev-token-salt-00005',
     NULL, NULL, 'used', NULL,
     'a0000000-0000-0000-0000-000000000004', NOW() - INTERVAL '60 days',
     'b0000000-0000-0000-0000-000000000002',
     'd0000000-0000-0000-0000-000000000003',
     'e0000000-0000-0000-0000-000000000004',
     'City Hall - H-03'),

    -- Device 6: revoked (was claimed, now revoked)
    ('f0000000-0000-0000-0000-000000000006',
     'SHS-2603-S01-A7K-00006-G', 'S01', 'rev2', '1.0.0', 'A7K',
    'revoked', 'offline',
    'fake-dev-token-hash-00006', 'fake-dev-token-salt-00006',
     NULL, NULL, 'revoked', NULL,
     'a0000000-0000-0000-0000-000000000001', NOW() - INTERVAL '120 days',
     'b0000000-0000-0000-0000-000000000001',
     NULL, NULL, 'Revoked device - suspected tampering'),

    -- Device 7: retired (end of life)
    ('f0000000-0000-0000-0000-000000000007',
     'SHS-2602-S01-A7K-00007-W', 'S01', 'rev1', '0.9.0', 'A7K',
    'retired', 'offline',
    'fake-dev-token-hash-00007', 'fake-dev-token-salt-00007',
     NULL, NULL, 'expired', NULL,
     'a0000000-0000-0000-0000-000000000002', NOW() - INTERVAL '365 days',
     'b0000000-0000-0000-0000-000000000001',
     NULL, NULL, 'Retired - hardware end of life')
ON CONFLICT (serial_number) DO NOTHING;


-- Back-link: set current_device_id on the spaces that have active devices
UPDATE parking_spaces SET current_device_id = 'f0000000-0000-0000-0000-000000000004'
    WHERE id = 'e0000000-0000-0000-0000-000000000001';
UPDATE parking_spaces SET current_device_id = 'f0000000-0000-0000-0000-000000000005'
    WHERE id = 'e0000000-0000-0000-0000-000000000004';


-- ────────────────────────────────────────────────────────────────────
-- 7. Installations (for active devices)
-- ────────────────────────────────────────────────────────────────────

INSERT INTO installations (
    id, device_id, organization_id, site_id, parking_space_id,
    installer_user_id, installation_photos, install_notes,
    installed_at, activation_status
) VALUES
    -- Device 4 installed by Bob (installer) at Downtown Garage A-01
    ('10000000-0000-0000-0000-000000000001',
     'f0000000-0000-0000-0000-000000000004',
     'b0000000-0000-0000-0000-000000000001',
     'd0000000-0000-0000-0000-000000000001',
     'e0000000-0000-0000-0000-000000000001',
     'a0000000-0000-0000-0000-000000000003',
     '[{"url":"https://dev-photos.example.com/install-001-front.jpg"},{"url":"https://dev-photos.example.com/install-001-wiring.jpg"}]'::jsonb,
     'Mounted at 48 inches. Wiring routed through existing conduit.',
     NOW() - INTERVAL '28 days', 'active'),

    -- Device 5 installed by Mike (installer) at City Hall H-03
    ('10000000-0000-0000-0000-000000000002',
     'f0000000-0000-0000-0000-000000000005',
     'b0000000-0000-0000-0000-000000000002',
     'd0000000-0000-0000-0000-000000000003',
     'e0000000-0000-0000-0000-000000000004',
     'a0000000-0000-0000-0000-000000000005',
     '[{"url":"https://dev-photos.example.com/install-002-front.jpg"}]'::jsonb,
     'Post-mount installation. Solar panel facing south.',
     NOW() - INTERVAL '55 days', 'active'),

    -- Device 6 was installed at Airport Lot E-10 before revocation
    ('10000000-0000-0000-0000-000000000003',
     'f0000000-0000-0000-0000-000000000006',
     'b0000000-0000-0000-0000-000000000001',
     'd0000000-0000-0000-0000-000000000002',
     'e0000000-0000-0000-0000-000000000003',
     'a0000000-0000-0000-0000-000000000003',
     '[]'::jsonb,
     'Removed after tampering investigation.',
     NOW() - INTERVAL '100 days', 'decommissioned')
ON CONFLICT DO NOTHING;


-- ────────────────────────────────────────────────────────────────────
-- 8. Device events (sample telemetry / lifecycle events)
-- ────────────────────────────────────────────────────────────────────

INSERT INTO device_events (id, device_id, event_type, payload, created_at) VALUES
    -- Device 4 heartbeats and a button press
    ('20000000-0000-0000-0000-000000000001',
     'f0000000-0000-0000-0000-000000000004',
     'heartbeat',
     '{"battery_pct": 92, "rssi": -67, "firmware": "1.2.0"}'::jsonb,
     NOW() - INTERVAL '1 hour'),

    ('20000000-0000-0000-0000-000000000002',
     'f0000000-0000-0000-0000-000000000004',
     'button_press',
     '{"button": "assistance", "duration_ms": 250}'::jsonb,
     NOW() - INTERVAL '3 hours'),

    -- Device 5 heartbeat
    ('20000000-0000-0000-0000-000000000003',
     'f0000000-0000-0000-0000-000000000005',
     'heartbeat',
     '{"battery_pct": 78, "rssi": -72, "firmware": "1.1.0"}'::jsonb,
     NOW() - INTERVAL '30 minutes'),

    -- Device 6 revocation event
    ('20000000-0000-0000-0000-000000000004',
     'f0000000-0000-0000-0000-000000000006',
     'lifecycle_transition',
     '{"from": "active", "to": "revoked", "reason": "suspected_tampering", "actor": "john.doe@example.com"}'::jsonb,
     NOW() - INTERVAL '90 days'),

    -- Device 7 retirement event
    ('20000000-0000-0000-0000-000000000005',
     'f0000000-0000-0000-0000-000000000007',
     'lifecycle_transition',
     '{"from": "active", "to": "retired", "reason": "hardware_end_of_life", "actor": "jane.smith@example.com"}'::jsonb,
     NOW() - INTERVAL '300 days'),

    -- Device 4 firmware update event
    ('20000000-0000-0000-0000-000000000006',
     'f0000000-0000-0000-0000-000000000004',
     'firmware_update',
     '{"from_version": "1.1.0", "to_version": "1.2.0", "status": "success"}'::jsonb,
     NOW() - INTERVAL '7 days')
ON CONFLICT DO NOTHING;
