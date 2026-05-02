CREATE TABLE IF NOT EXISTS rpt.employee_kpi_snapshot (
    snapshot_run_id UUID NOT NULL REFERENCES rpt.snapshot_run(snapshot_run_id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES ops.employee(employee_id),
    store_id UUID REFERENCES ops.store(store_id),
    kpi_id UUID NOT NULL REFERENCES ops.kpi_definition(kpi_id),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    actual_value NUMERIC(18,4) NOT NULL,
    PRIMARY KEY (snapshot_run_id, employee_id, kpi_id)
);

CREATE TABLE IF NOT EXISTS rpt.employee_performance_snapshot (
    snapshot_run_id UUID NOT NULL REFERENCES rpt.snapshot_run(snapshot_run_id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES ops.employee(employee_id),
    store_id UUID REFERENCES ops.store(store_id),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    score_value NUMERIC(18,4) NOT NULL,
    matched_metrics INTEGER NOT NULL,
    total_metrics INTEGER NOT NULL,
    turkey_rank INTEGER,
    turkey_population INTEGER NOT NULL,
    store_rank INTEGER,
    store_population INTEGER NOT NULL,
    PRIMARY KEY (snapshot_run_id, employee_id)
);

CREATE INDEX IF NOT EXISTS employee_performance_snapshot_run_store_idx
    ON rpt.employee_performance_snapshot (snapshot_run_id, store_id, score_value DESC);

CREATE INDEX IF NOT EXISTS employee_kpi_snapshot_run_employee_idx
    ON rpt.employee_kpi_snapshot (snapshot_run_id, employee_id, kpi_id);

DROP TRIGGER IF EXISTS trg_employee_kpi_snapshot_immutable ON rpt.employee_kpi_snapshot;
CREATE TRIGGER trg_employee_kpi_snapshot_immutable
    BEFORE UPDATE OR DELETE ON rpt.employee_kpi_snapshot
    FOR EACH ROW EXECUTE FUNCTION rpt.prevent_snapshot_mutation();

DROP TRIGGER IF EXISTS trg_employee_performance_snapshot_immutable ON rpt.employee_performance_snapshot;
CREATE TRIGGER trg_employee_performance_snapshot_immutable
    BEFORE UPDATE OR DELETE ON rpt.employee_performance_snapshot
    FOR EACH ROW EXECUTE FUNCTION rpt.prevent_snapshot_mutation();
