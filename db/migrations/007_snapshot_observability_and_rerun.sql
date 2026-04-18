ALTER TABLE rpt.snapshot_run
ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;

ALTER TABLE rpt.snapshot_run
ADD COLUMN IF NOT EXISTS finished_at TIMESTAMPTZ;

ALTER TABLE rpt.snapshot_run
ADD COLUMN IF NOT EXISTS failure_reason TEXT;

ALTER TABLE rpt.snapshot_run
ADD COLUMN IF NOT EXISTS rerun_of_snapshot_run_id UUID REFERENCES rpt.snapshot_run(snapshot_run_id);
