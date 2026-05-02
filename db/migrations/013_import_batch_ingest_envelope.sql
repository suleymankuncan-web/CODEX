ALTER TABLE stg.import_batch
ADD COLUMN IF NOT EXISTS source_batch_id TEXT;

ALTER TABLE stg.import_batch
ADD COLUMN IF NOT EXISTS source_payload_hash TEXT;

ALTER TABLE stg.import_batch
ADD COLUMN IF NOT EXISTS source_captured_at TIMESTAMPTZ;

ALTER TABLE stg.import_batch
ADD COLUMN IF NOT EXISTS source_window_started_at TIMESTAMPTZ;

ALTER TABLE stg.import_batch
ADD COLUMN IF NOT EXISTS source_window_ended_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS import_batch_source_batch_unique_idx
ON stg.import_batch (integration_source_id, entity_type, source_batch_id)
WHERE source_batch_id IS NOT NULL;
