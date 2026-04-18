CREATE OR REPLACE FUNCTION rpt.generate_store_workforce_snapshot(
    p_snapshot_run_id UUID,
    p_period_start DATE,
    p_period_end DATE
)
RETURNS VOID
LANGUAGE SQL
AS $$
INSERT INTO rpt.store_workforce_snapshot (
    snapshot_run_id,
    store_id,
    position_id,
    active_headcount,
    active_fte,
    planned_headcount,
    planned_fte,
    gap_headcount,
    gap_fte
)
SELECT
    p_snapshot_run_id,
    scope.store_id,
    scope.position_id,
    COALESCE(scope.active_headcount, 0),
    COALESCE(scope.active_fte, 0),
    COALESCE(norm.planned_headcount, 0),
    COALESCE(norm.planned_fte, 0),
    COALESCE(norm.planned_headcount, 0) - COALESCE(scope.active_headcount, 0),
    COALESCE(norm.planned_fte, 0) - COALESCE(scope.active_fte, 0)
FROM (
    SELECT
        eah.store_id,
        eah.position_id,
        COUNT(*) FILTER (
            WHERE eah.start_date <= p_period_end
              AND (eah.end_date IS NULL OR eah.end_date >= p_period_start)
              AND eah.assignment_status = 'active'
        )::NUMERIC(10,2) AS active_headcount,
        COALESCE(SUM(
            CASE
                WHEN eah.start_date <= p_period_end
                 AND (eah.end_date IS NULL OR eah.end_date >= p_period_start)
                 AND eah.assignment_status = 'active'
                THEN eah.fte_ratio
                ELSE 0
            END
        ), 0)::NUMERIC(10,2) AS active_fte
    FROM ops.employee_assignment_history eah
    GROUP BY eah.store_id, eah.position_id
) scope
FULL OUTER JOIN (
    SELECT
        wnp.store_id,
        wnp.position_id,
        SUM(wnp.planned_headcount)::NUMERIC(10,2) AS planned_headcount,
        SUM(wnp.planned_fte)::NUMERIC(10,2) AS planned_fte
    FROM ops.workforce_norm_plan wnp
    WHERE wnp.period_start <= p_period_end
      AND wnp.period_end >= p_period_start
    GROUP BY wnp.store_id, wnp.position_id
) norm
    ON scope.store_id = norm.store_id
   AND scope.position_id = norm.position_id;
$$;

CREATE OR REPLACE FUNCTION rpt.generate_store_kpi_snapshot(
    p_snapshot_run_id UUID,
    p_period_start DATE,
    p_period_end DATE
)
RETURNS VOID
LANGUAGE SQL
AS $$
INSERT INTO rpt.store_kpi_snapshot (
    snapshot_run_id,
    store_id,
    kpi_id,
    period_start,
    period_end,
    target_value,
    actual_value,
    achievement_rate,
    status_band
)
SELECT
    p_snapshot_run_id,
    COALESCE(actual.store_id, target.store_id) AS store_id,
    COALESCE(actual.kpi_id, target.kpi_id) AS kpi_id,
    p_period_start,
    p_period_end,
    target.target_value,
    actual.actual_value,
    CASE
        WHEN target.target_value IS NULL OR target.target_value = 0 THEN NULL
        ELSE actual.actual_value / target.target_value
    END AS achievement_rate,
    CASE
        WHEN actual.actual_value IS NULL THEN 'missing'
        WHEN target.threshold_green IS NOT NULL AND actual.actual_value >= target.threshold_green THEN 'green'
        WHEN target.threshold_yellow IS NOT NULL AND actual.actual_value >= target.threshold_yellow THEN 'yellow'
        ELSE 'red'
    END AS status_band
FROM (
    SELECT ka.store_id, ka.kpi_id, SUM(ka.actual_value)::NUMERIC(18,4) AS actual_value
    FROM ops.kpi_actual ka
    WHERE ka.period_start >= p_period_start
      AND ka.period_end <= p_period_end
      AND ka.store_id IS NOT NULL
    GROUP BY ka.store_id, ka.kpi_id
) actual
FULL OUTER JOIN (
    SELECT kt.store_id, kt.kpi_id, MAX(kt.target_value)::NUMERIC(18,4) AS target_value,
           MAX(kt.threshold_green)::NUMERIC(18,4) AS threshold_green,
           MAX(kt.threshold_yellow)::NUMERIC(18,4) AS threshold_yellow
    FROM ops.kpi_target kt
    WHERE kt.period_start >= p_period_start
      AND kt.period_end <= p_period_end
      AND kt.store_id IS NOT NULL
    GROUP BY kt.store_id, kt.kpi_id
) target
    ON actual.store_id = target.store_id
   AND actual.kpi_id = target.kpi_id;
$$;

CREATE OR REPLACE FUNCTION rpt.generate_store_checklist_snapshot(
    p_snapshot_run_id UUID,
    p_period_start DATE,
    p_period_end DATE
)
RETURNS VOID
LANGUAGE SQL
AS $$
INSERT INTO rpt.store_checklist_snapshot (
    snapshot_run_id,
    store_id,
    checklist_template_id,
    audit_count,
    avg_score,
    compliance_rate,
    critical_issue_count
)
SELECT
    p_snapshot_run_id,
    ci.store_id,
    ci.checklist_template_id,
    COUNT(*)::INTEGER AS audit_count,
    AVG(ci.total_score)::NUMERIC(12,2) AS avg_score,
    AVG(ci.compliance_rate)::NUMERIC(7,4) AS compliance_rate,
    COALESCE(SUM(
      CASE
        WHEN cr.is_non_compliant = TRUE THEN 1
        ELSE 0
      END
    ), 0)::INTEGER AS critical_issue_count
FROM ops.checklist_instance ci
LEFT JOIN ops.checklist_response cr
  ON cr.checklist_instance_id = ci.checklist_instance_id
WHERE ci.created_at::date BETWEEN p_period_start AND p_period_end
GROUP BY ci.store_id, ci.checklist_template_id;
$$;

CREATE OR REPLACE FUNCTION rpt.generate_turnover_snapshot(
    p_snapshot_run_id UUID,
    p_period_start DATE,
    p_period_end DATE
)
RETURNS VOID
LANGUAGE SQL
AS $$
INSERT INTO rpt.turnover_snapshot (
    snapshot_run_id,
    scope_type,
    company_id,
    region_id,
    store_id,
    period_start,
    period_end,
    opening_headcount,
    closing_headcount,
    avg_headcount,
    leaver_count,
    turnover_rate
)
SELECT
    p_snapshot_run_id,
    'store',
    s.company_id,
    s.region_id,
    s.store_id,
    p_period_start,
    p_period_end,
    COALESCE(opening.opening_headcount, 0),
    COALESCE(closing.closing_headcount, 0),
    ((COALESCE(opening.opening_headcount, 0) + COALESCE(closing.closing_headcount, 0)) / 2.0)::NUMERIC(10,2),
    COALESCE(leavers.leaver_count, 0),
    CASE
        WHEN ((COALESCE(opening.opening_headcount, 0) + COALESCE(closing.closing_headcount, 0)) / 2.0) = 0 THEN 0
        ELSE (COALESCE(leavers.leaver_count, 0) / ((COALESCE(opening.opening_headcount, 0) + COALESCE(closing.closing_headcount, 0)) / 2.0))::NUMERIC(10,4)
    END
FROM ops.store s
LEFT JOIN (
    SELECT store_id, COUNT(*)::NUMERIC(10,2) AS opening_headcount
    FROM ops.employee_assignment_history
    WHERE start_date <= p_period_start
      AND (end_date IS NULL OR end_date >= p_period_start)
    GROUP BY store_id
) opening ON opening.store_id = s.store_id
LEFT JOIN (
    SELECT store_id, COUNT(*)::NUMERIC(10,2) AS closing_headcount
    FROM ops.employee_assignment_history
    WHERE start_date <= p_period_end
      AND (end_date IS NULL OR end_date >= p_period_end)
    GROUP BY store_id
) closing ON closing.store_id = s.store_id
LEFT JOIN (
    SELECT store_id, COUNT(*)::INTEGER AS leaver_count
    FROM ops.turnover_event
    WHERE event_date BETWEEN p_period_start AND p_period_end
      AND event_type = 'termination'
    GROUP BY store_id
) leavers ON leavers.store_id = s.store_id;
$$;
