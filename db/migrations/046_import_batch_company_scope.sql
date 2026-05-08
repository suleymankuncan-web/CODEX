ALTER TABLE stg.import_batch
ADD COLUMN IF NOT EXISTS company_ids UUID[] NOT NULL DEFAULT '{}'::uuid[];

DROP INDEX IF EXISTS import_batch_source_batch_unique_idx;

CREATE UNIQUE INDEX IF NOT EXISTS import_batch_source_batch_unique_idx
ON stg.import_batch (integration_source_id, entity_type, source_batch_id, company_ids)
WHERE source_batch_id IS NOT NULL;

DROP INDEX IF EXISTS uq_import_batch_idempotency_key;

CREATE UNIQUE INDEX IF NOT EXISTS uq_import_batch_idempotency_key
ON stg.import_batch (idempotency_key, company_ids)
WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_import_batch_company_ids
ON stg.import_batch USING GIN (company_ids);
