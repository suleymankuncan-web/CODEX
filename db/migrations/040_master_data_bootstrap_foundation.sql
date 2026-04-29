CREATE TABLE IF NOT EXISTS stg.master_data_bootstrap_batch (
    master_data_bootstrap_batch_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES ops.company(company_id),
    bootstrap_entity TEXT NOT NULL,
    source_label TEXT NOT NULL,
    file_reference TEXT,
    uploaded_by_user_id TEXT NOT NULL,
    batch_status TEXT NOT NULL DEFAULT 'uploaded',
    row_count INTEGER NOT NULL DEFAULT 0 CHECK (row_count >= 0),
    valid_count INTEGER NOT NULL DEFAULT 0 CHECK (valid_count >= 0),
    needs_review_count INTEGER NOT NULL DEFAULT 0 CHECK (needs_review_count >= 0),
    invalid_count INTEGER NOT NULL DEFAULT 0 CHECK (invalid_count >= 0),
    promoted_count INTEGER NOT NULL DEFAULT 0 CHECK (promoted_count >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    validated_at TIMESTAMPTZ,
    promoted_at TIMESTAMPTZ,
    CHECK (bootstrap_entity IN ('store', 'personnel')),
    CHECK (batch_status IN ('uploaded', 'validated', 'ready_to_promote', 'promoted', 'rejected'))
);

CREATE TABLE IF NOT EXISTS stg.master_data_bootstrap_row (
    master_data_bootstrap_row_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    master_data_bootstrap_batch_id UUID NOT NULL REFERENCES stg.master_data_bootstrap_batch(master_data_bootstrap_batch_id) ON DELETE CASCADE,
    row_number INTEGER NOT NULL CHECK (row_number > 0),
    row_hash TEXT NOT NULL,
    source_store_code TEXT,
    source_employee_code TEXT,
    raw_payload_json JSONB NOT NULL,
    normalized_payload_json JSONB NOT NULL DEFAULT '{}'::JSONB,
    validation_status TEXT NOT NULL DEFAULT 'pending',
    issue_code TEXT,
    issue_message TEXT,
    resolved_company_id UUID REFERENCES ops.company(company_id),
    resolved_region_id UUID REFERENCES ops.region(region_id),
    resolved_store_id UUID REFERENCES ops.store(store_id),
    resolved_employee_id UUID REFERENCES ops.employee(employee_id),
    resolved_position_id UUID REFERENCES ops.position(position_id),
    promoted_entity_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (validation_status IN ('pending', 'valid', 'needs_review', 'invalid', 'promoted')),
    CHECK (validation_status NOT IN ('needs_review', 'invalid') OR issue_code IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_master_data_bootstrap_row_hash
    ON stg.master_data_bootstrap_row (master_data_bootstrap_batch_id, row_hash);

CREATE INDEX IF NOT EXISTS idx_master_data_bootstrap_batch_status
    ON stg.master_data_bootstrap_batch (company_id, bootstrap_entity, batch_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_master_data_bootstrap_row_review
    ON stg.master_data_bootstrap_row (master_data_bootstrap_batch_id, validation_status, row_number);

COMMENT ON TABLE stg.master_data_bootstrap_batch IS 'Controlled store/personnel master-data bootstrap batches. Rows must be reviewed before live promotion.';
COMMENT ON TABLE stg.master_data_bootstrap_row IS 'Raw and normalized master-data bootstrap rows with validation state, resolution evidence, and future promotion trace.';
