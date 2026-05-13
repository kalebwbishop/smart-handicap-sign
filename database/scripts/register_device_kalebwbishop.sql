-- Register device SHS-2605-S01-A7K-00002-8 to kalebwbishop
-- Org: Acme Parking Services, Site: Downtown Parking Garage, Space: A-02 (van-accessible)

BEGIN;

-- 1. Update device: mark as active, assign to org/site/space
UPDATE devices SET
    lifecycle_status = 'active',
    operational_status = 'available',
    claim_status = 'used',
    claimed_by_user_id = 'a0000000-0000-0000-0000-000000000099',
    claimed_at = NOW(),
    organization_id = 'b0000000-0000-0000-0000-000000000001',
    current_site_id = 'd0000000-0000-0000-0000-000000000001',
    current_parking_space_id = 'e0000000-0000-0000-0000-000000000002',
    updated_at = NOW()
WHERE serial_number = 'SHS-2605-S01-A7K-00002-8'
  AND lifecycle_status = 'unclaimed'
  AND claim_status = 'unused';

-- 2. Update parking space: link device
UPDATE parking_spaces SET
    current_device_id = 'f0000000-0000-0000-0000-000000000002',
    updated_at = NOW()
WHERE id = 'e0000000-0000-0000-0000-000000000002';

-- 3. Create installation record
INSERT INTO installations (id, device_id, organization_id, site_id, parking_space_id, installer_user_id, install_notes, installed_at, activation_status)
VALUES (
    'f1000000-0000-0000-0000-000000000099',
    'f0000000-0000-0000-0000-000000000002',
    'b0000000-0000-0000-0000-000000000001',
    'd0000000-0000-0000-0000-000000000001',
    'e0000000-0000-0000-0000-000000000002',
    'a0000000-0000-0000-0000-000000000099',
    'Registered by kalebwbishop via CLI',
    NOW(),
    'active'
);

-- 4. Create device event
INSERT INTO device_events (id, device_id, event_type, payload)
VALUES (
    'f2000000-0000-0000-0000-000000000099',
    'f0000000-0000-0000-0000-000000000002',
    'claimed',
    '{"claimed_by": "kalebwbishop", "organization": "Acme Parking Services", "site": "Downtown Parking Garage", "space": "A-02"}'::jsonb
);

-- 5. Create audit log
INSERT INTO audit_logs (id, actor_user_id, action, entity_type, entity_id, metadata)
VALUES (
    'f3000000-0000-0000-0000-000000000099',
    'a0000000-0000-0000-0000-000000000099',
    'device.claimed',
    'device',
    'f0000000-0000-0000-0000-000000000002',
    '{"serial_number": "SHS-2605-S01-A7K-00002-8", "organization": "Acme Parking Services", "site": "Downtown Parking Garage", "space": "A-02", "accessible_type": "van_accessible"}'::jsonb
);

COMMIT;
