ALTER TABLE stg.import_batch
ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_import_batch_idempotency_key
ON stg.import_batch (idempotency_key)
WHERE idempotency_key IS NOT NULL;

ALTER TABLE rpt.snapshot_run
ADD COLUMN IF NOT EXISTS run_status TEXT NOT NULL DEFAULT 'queued';

ALTER TABLE rpt.snapshot_run
ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_snapshot_run_idempotency_key
ON rpt.snapshot_run (idempotency_key)
WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_snapshot_run_status_date
ON rpt.snapshot_run (run_status, snapshot_date, generated_at);
