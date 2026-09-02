CREATE TABLE IF NOT EXISTS signal_classification_results (
    message_id     UUID PRIMARY KEY,
    schema_version VARCHAR(20) NOT NULL,
    occurred_at    TIMESTAMPTZ NOT NULL,
    device_id      VARCHAR(255) NOT NULL CHECK (length(trim(device_id)) > 0),
    label          VARCHAR(20) NOT NULL CHECK (label IN ('positive', 'negative')),
    confidence     DOUBLE PRECISION NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    payload        JSONB NOT NULL,
    received_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_signal_classification_results_device_occurred
    ON signal_classification_results (device_id, occurred_at DESC);
