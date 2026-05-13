-- Register device SHS-2605-S01-A7K-00003-W to kalebwbishop+tester@gmail.com
BEGIN;

-- 1. Create an organization for the tester
INSERT INTO organizations (id, name, billing_status, subscription_tier)
VALUES ('b0000000-0000-0000-0000-000000000099', 'Bishop Testing', 'active', 'standard')
ON CONFLICT (id) DO NOTHING;

-- 2. Add tester as owner of the org
INSERT INTO organization_members (id, organization_id, user_id, role)
VALUES (
    'c0000000-0000-0000-0000-000000000199',
    'b0000000-0000-0000-0000-000000000099',
    '7f4cc277-02e3-456c-8bee-4e77350aa80a',
    'owner'
) ON CONFLICT (id) DO NOTHING;

-- 3. Create a site
INSERT INTO sites (id, organization_id, name, address_line_1, city, state, postal_code, country)
VALUES (
    'd0000000-0000-0000-0000-000000000099',
    'b0000000-0000-0000-0000-000000000099',
    'Test Site',
    '123 Main St',
    'Louisville',
    'KY',
    '40202',
    'US'
);

-- 4. Create a parking space
INSERT INTO parking_spaces (id, site_id, label, accessible_type)
VALUES (
    'e0000000-0000-0000-0000-000000000099',
    'd0000000-0000-0000-0000-000000000099',
    'P-01',
    'standard'
);

-- 5. Update device: mark as active, assign to tester's org/site/space
UPDATE devices SET
    lifecycle_status = 'active',
    operational_status = 'available',
    claim_status = 'used',
    claimed_by_user_id = '7f4cc277-02e3-456c-8bee-4e77350aa80a',
    claimed_at = NOW(),
    organization_id = 'b0000000-0000-0000-0000-000000000099',
    current_site_id = 'd0000000-0000-0000-0000-000000000099',
    current_parking_space_id = 'e0000000-0000-0000-0000-000000000099',
    updated_at = NOW()
WHERE serial_number = 'SHS-2605-S01-A7K-00003-W'
  AND lifecycle_status = 'unclaimed';

-- 6. Link device to parking space
UPDATE parking_spaces SET
    current_device_id = 'f0000000-0000-0000-0000-000000000003',
    updated_at = NOW()
WHERE id = 'e0000000-0000-0000-0000-000000000099';

-- 7. Create installation record
INSERT INTO installations (id, device_id, organization_id, site_id, parking_space_id, installer_user_id, install_notes, installed_at, activation_status)
VALUES (
    'f1000000-0000-0000-0000-000000000199',
    'f0000000-0000-0000-0000-000000000003',
    'b0000000-0000-0000-0000-000000000099',
    'd0000000-0000-0000-0000-000000000099',
    'e0000000-0000-0000-0000-000000000099',
    '7f4cc277-02e3-456c-8bee-4e77350aa80a',
    'Registered to tester account via CLI',
    NOW(),
    'active'
);

-- 8. Device event
INSERT INTO device_events (id, device_id, event_type, payload)
VALUES (
    'f2000000-0000-0000-0000-000000000199',
    'f0000000-0000-0000-0000-000000000003',
    'claimed',
    '{"claimed_by": "kalebwbishop+tester", "organization": "Bishop Testing", "site": "Test Site", "space": "P-01"}'::jsonb
);

-- 9. Audit log
INSERT INTO audit_logs (id, actor_user_id, action, entity_type, entity_id, metadata)
VALUES (
    'f3000000-0000-0000-0000-000000000199',
    '7f4cc277-02e3-456c-8bee-4e77350aa80a',
    'device.claimed',
    'device',
    'f0000000-0000-0000-0000-000000000003',
    '{"serial_number": "SHS-2605-S01-A7K-00003-W", "organization": "Bishop Testing", "site": "Test Site", "space": "P-01"}'::jsonb
);

COMMIT;
