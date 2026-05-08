ALTER TABLE rpt.snapshot_run
ADD COLUMN IF NOT EXISTS company_ids UUID[] NOT NULL DEFAULT '{}'::uuid[];

DROP INDEX IF EXISTS uq_snapshot_run_idempotency_key;

CREATE UNIQUE INDEX IF NOT EXISTS uq_snapshot_run_idempotency_key
ON rpt.snapshot_run (idempotency_key, company_ids)
WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_snapshot_run_company_ids
ON rpt.snapshot_run USING GIN (company_ids);
