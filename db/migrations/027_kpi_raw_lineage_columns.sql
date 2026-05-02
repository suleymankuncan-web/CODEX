ALTER TABLE stg.kpi_raw
ADD COLUMN IF NOT EXISTS row_hash TEXT,
ADD COLUMN IF NOT EXISTS raw_row_reference TEXT;

CREATE INDEX IF NOT EXISTS kpi_raw_row_hash_idx
    ON stg.kpi_raw (row_hash)
    WHERE row_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS kpi_raw_reference_idx
    ON stg.kpi_raw (raw_row_reference)
    WHERE raw_row_reference IS NOT NULL;

COMMENT ON COLUMN stg.kpi_raw.row_hash IS 'Stable row-level hash from the source adapter or canonical normalization layer.';
COMMENT ON COLUMN stg.kpi_raw.raw_row_reference IS 'Readable source row reference for reconciliation and source evidence tracing.';
