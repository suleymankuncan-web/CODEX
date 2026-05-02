CREATE SCHEMA IF NOT EXISTS audit;

CREATE TABLE IF NOT EXISTS audit.schema_migration (
    migration_name TEXT PRIMARY KEY,
    migration_checksum TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('running', 'succeeded', 'failed')),
    attempt_count INTEGER NOT NULL DEFAULT 0,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ,
    duration_ms INTEGER,
    applied_by TEXT NOT NULL DEFAULT CURRENT_USER,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_schema_migration_status
    ON audit.schema_migration (status, started_at DESC);

COMMENT ON TABLE audit.schema_migration IS 'Tracks SQL migration execution, checksums, status, and failure evidence.';
