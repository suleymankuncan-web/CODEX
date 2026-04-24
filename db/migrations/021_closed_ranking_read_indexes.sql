CREATE INDEX IF NOT EXISTS snapshot_run_closed_daily_period_idx
    ON rpt.snapshot_run (period_start, period_end, generated_at DESC)
    WHERE snapshot_type = 'daily' AND run_status = 'completed';

CREATE INDEX IF NOT EXISTS employee_performance_snapshot_run_score_idx
    ON rpt.employee_performance_snapshot (snapshot_run_id, score_value DESC, employee_id);

CREATE INDEX IF NOT EXISTS employee_performance_snapshot_run_store_score_idx
    ON rpt.employee_performance_snapshot (snapshot_run_id, store_id, score_value DESC, employee_id);

CREATE INDEX IF NOT EXISTS employee_kpi_snapshot_run_metric_value_idx
    ON rpt.employee_kpi_snapshot (snapshot_run_id, kpi_id, actual_value DESC, employee_id);

CREATE INDEX IF NOT EXISTS employee_kpi_snapshot_run_store_metric_value_idx
    ON rpt.employee_kpi_snapshot (snapshot_run_id, store_id, kpi_id, actual_value DESC, employee_id);
