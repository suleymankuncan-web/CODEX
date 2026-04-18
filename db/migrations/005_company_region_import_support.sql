CREATE TABLE IF NOT EXISTS stg.company_raw (
    stg_company_raw_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    import_batch_id UUID NOT NULL REFERENCES stg.import_batch(import_batch_id) ON DELETE CASCADE,
    source_company_id TEXT NOT NULL,
    payload_json JSONB NOT NULL,
    normalized_status TEXT NOT NULL DEFAULT 'pending',
    validation_error TEXT,
    processed_flag BOOLEAN NOT NULL DEFAULT FALSE,
    processed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS stg.region_raw (
    stg_region_raw_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    import_batch_id UUID NOT NULL REFERENCES stg.import_batch(import_batch_id) ON DELETE CASCADE,
    source_region_id TEXT NOT NULL,
    source_company_id TEXT,
    payload_json JSONB NOT NULL,
    normalized_status TEXT NOT NULL DEFAULT 'pending',
    validation_error TEXT,
    processed_flag BOOLEAN NOT NULL DEFAULT FALSE,
    processed_at TIMESTAMPTZ
);
