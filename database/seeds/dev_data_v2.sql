-- Pilot sign bootstrap data for the single-sign pilot schema.
-- Run after schemas/shs_schema_v2.sql.

INSERT INTO devices (
    id,
    serial_number,
    model_code,
    hardware_revision,
    firmware_version,
    auth_token_hash,
    auth_token_salt,
    connectivity_status,
    operational_status,
    last_seen_at,
    name
) VALUES (
    'f0000000-0000-0000-0000-000000000001',
    'SHS-2605-S01-A7K-00001-J',
    'S01',
    'rev3',
    '1.2.0',
    'abc3c5186f765789dce954ea1d164cceae936094c81af90595e6dc3e6b1364f6',
    '24b3bf3cd7df078969e36d7c37d3ddee',
    'online',
    'available',
    CURRENT_TIMESTAMP,
    'Pilot Handicap Sign'
)
ON CONFLICT (serial_number) DO NOTHING;
