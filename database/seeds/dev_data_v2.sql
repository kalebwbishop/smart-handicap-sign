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
    operational_status,
    name
) VALUES (
    'f0000000-0000-0000-0000-000000000001',
    'SHS-2605-S01-A7K-00001-J',
    'S01',
    'rev3',
    '1.2.0',
    '0c2bffb5891b8c89d3cd94d92a9dd8772a1f92d6d1b7b84a9e53ef835cb32a51',
    'pilot-device-salt',
    'available',
    'Pilot Handicap Sign'
)
ON CONFLICT (serial_number) DO NOTHING;
