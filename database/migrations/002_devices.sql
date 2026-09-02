CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS devices (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id           VARCHAR(255) NOT NULL UNIQUE,
    serial_number       VARCHAR(30) UNIQUE,
    model_code          VARCHAR(10),
    hardware_revision   VARCHAR(10),
    firmware_version    VARCHAR(20),
    lifecycle_status    VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (lifecycle_status IN (
            'manufactured',
            'unclaimed',
            'claiming',
            'active',
            'lost',
            'revoked',
            'retired'
        )),
    connectivity_status VARCHAR(20) NOT NULL DEFAULT 'offline'
        CHECK (connectivity_status IN ('online', 'offline')),
    operational_status  VARCHAR(30) NOT NULL DEFAULT 'available'
        CHECK (operational_status IN (
            'available',
            'assistance_requested',
            'assistance_in_progress',
            'error',
            'unknown'
        )),
    battery_percentage  INTEGER NOT NULL DEFAULT 0
        CHECK (battery_percentage BETWEEN 0 AND 100),
    last_seen_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT devices_device_id_not_blank CHECK (length(trim(device_id)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_devices_connectivity_status
    ON devices (connectivity_status);

CREATE INDEX IF NOT EXISTS idx_devices_operational_status
    ON devices (operational_status);
