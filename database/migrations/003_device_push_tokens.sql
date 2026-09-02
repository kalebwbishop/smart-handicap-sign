CREATE TABLE IF NOT EXISTS device_push_tokens (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id         VARCHAR(255) NOT NULL
        REFERENCES devices (device_id) ON DELETE CASCADE,
    expo_push_token   VARCHAR(255) NOT NULL UNIQUE,
    platform          VARCHAR(20),
    device_name       VARCHAR(255),
    push_enabled      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT device_push_tokens_token_not_blank
        CHECK (length(trim(expo_push_token)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_device_push_tokens_device_enabled
    ON device_push_tokens (device_id)
    WHERE push_enabled;
