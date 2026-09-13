// A month uses daily facts when present; monthly and daily facts are never added together.
export function targetPersonnelSalesSql(employee: string, store: string, month: string) {
  return `(SELECT CASE WHEN COUNT(*) FILTER (WHERE a.period_type = 'daily') > 0
    THEN SUM(a.actual_value) FILTER (WHERE a.period_type = 'daily')
    ELSE SUM(a.actual_value) FILTER (WHERE a.period_type = 'monthly') END::text
    FROM ops.kpi_actual a JOIN ops.kpi_definition d ON d.kpi_id = a.kpi_id AND d.kpi_code = 'NET_SALES'
    WHERE a.scope_type = 'employee' AND a.employee_id = ${employee}.employee_id
      AND a.store_id = ${store} AND a.company_id = ${employee}.company_id
      AND COALESCE(a.source_type, '') <> 'demo_seed'
      AND ((a.period_type = 'daily' AND a.period_start >= date_trunc('month', ${month}::date)::date
        AND a.period_end <= LEAST((date_trunc('month', ${month}::date) + INTERVAL '1 month - 1 day')::date,
          COALESCE(${employee}.termination_date, 'infinity'::date), (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Istanbul')::date))
        OR (a.period_type = 'monthly' AND a.period_start = date_trunc('month', ${month}::date)::date
          AND a.period_end <= LEAST((date_trunc('month', ${month}::date) + INTERVAL '1 month - 1 day')::date,
            COALESCE(${employee}.termination_date, 'infinity'::date), (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Istanbul')::date))))`;
}
