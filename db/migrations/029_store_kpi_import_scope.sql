ALTER TABLE ops.store
ADD COLUMN IF NOT EXISTS kpi_import_enabled BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN ops.store.kpi_import_enabled IS
  'Controls whether this store is included in KPI imports from external files such as Power BI Excel exports.';

CREATE INDEX IF NOT EXISTS idx_store_kpi_import_scope
ON ops.store (status, kpi_import_enabled, store_code);
