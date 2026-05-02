ALTER TABLE ops.kpi_actual
ADD COLUMN IF NOT EXISTS source_batch_id TEXT;

ALTER TABLE ops.kpi_actual
ADD COLUMN IF NOT EXISTS source_payload_hash TEXT;

ALTER TABLE ops.kpi_actual
ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE UNIQUE INDEX IF NOT EXISTS kpi_actual_store_live_unique_idx
ON ops.kpi_actual (kpi_id, store_id, period_type, period_start, period_end)
WHERE scope_type = 'store' AND store_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS kpi_actual_employee_live_unique_idx
ON ops.kpi_actual (kpi_id, employee_id, period_type, period_start, period_end)
WHERE scope_type = 'employee' AND employee_id IS NOT NULL;
