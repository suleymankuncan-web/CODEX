CREATE TABLE IF NOT EXISTS stg.roster_reconciliation_input (
    roster_reconciliation_input_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_file TEXT NOT NULL,
    source_sheet TEXT NOT NULL,
    source_period TEXT NOT NULL DEFAULT '',
    source_kind TEXT NOT NULL,
    row_number INTEGER NOT NULL,
    raw_store_name TEXT,
    raw_store_code TEXT,
    raw_employee_code TEXT,
    raw_employee_name TEXT,
    raw_position_name TEXT,
    raw_payload JSONB NOT NULL DEFAULT '{}'::JSONB,
    normalized_store_key TEXT NOT NULL DEFAULT '',
    normalized_employee_key TEXT NOT NULL DEFAULT '',
    match_status TEXT NOT NULL DEFAULT 'pending',
    match_notes TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_roster_reconciliation_source_kind
      CHECK (source_kind IN ('current_roster', 'dealer_roster', 'target', 'sales_kpi')),
    CONSTRAINT chk_roster_reconciliation_match_status
      CHECK (match_status IN ('pending', 'matched', 'missing_store', 'missing_employee', 'ambiguous', 'ignored', 'review_required')),
    CONSTRAINT uq_roster_reconciliation_source_row
      UNIQUE (source_file, source_sheet, source_kind, source_period, row_number)
);

CREATE INDEX IF NOT EXISTS idx_roster_reconciliation_period_kind
    ON stg.roster_reconciliation_input (source_period, source_kind);

CREATE INDEX IF NOT EXISTS idx_roster_reconciliation_store_key
    ON stg.roster_reconciliation_input (normalized_store_key);

CREATE INDEX IF NOT EXISTS idx_roster_reconciliation_employee_key
    ON stg.roster_reconciliation_input (normalized_employee_key);

CREATE INDEX IF NOT EXISTS idx_roster_reconciliation_status
    ON stg.roster_reconciliation_input (match_status);

COMMENT ON TABLE stg.roster_reconciliation_input IS 'Pilot-only staging analysis table for roster, target, and sales/KPI reconciliation dry-runs. Product tables must not read from this table.';
