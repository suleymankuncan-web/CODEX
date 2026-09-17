/** Full targets for every calendar month touched by a ranking interval, never day-prorated. */
export function rankingMonthlyTargetJoinSql(input: {
  store: string;
  employee?: string;
  startParameter: number;
  endParameter: number;
}) {
  const { store, employee, startParameter, endParameter } = input;
  // All identifiers/parameter positions are internal SQL fragments, never request values.
  const monthlyValue = employee ? `
    SELECT CASE WHEN COUNT(*) = 1 THEN MAX(ptr.target_value) END AS value
    FROM ops.personnel_target_reference ptr
    WHERE ptr.employee_id = ${employee}.employee_id AND ptr.store_id = ${store}.store_id
      AND ptr.period_start = month.start_date
      AND ptr.period_end = (month.start_date + INTERVAL '1 month - 1 day')::date
      AND ptr.target_type = 'monthly_sales_target' AND ptr.status = 'approved'
  ` : `
    SELECT COALESCE(approved.total_target_value, imported.value) AS value
    FROM (SELECT 1) anchor
    LEFT JOIN LATERAL (
      SELECT request.total_target_value
      FROM ops.target_distribution_request request
      WHERE request.store_id = ${store}.store_id AND request.company_id = ${store}.company_id
        AND request.request_month = month.start_date AND request.request_status = 'approved'
      ORDER BY request.approved_at DESC NULLS LAST, request.updated_at DESC,
        request.created_at DESC, request.target_distribution_request_id DESC
      LIMIT 1
    ) approved ON TRUE
    LEFT JOIN LATERAL (
      SELECT CASE WHEN COUNT(*) = 1 THEN MAX(kt.target_value) END AS value
      FROM ops.kpi_target kt JOIN ops.kpi_definition definition USING (kpi_id)
      WHERE kt.store_id = ${store}.store_id AND kt.scope_type = 'store' AND kt.period_type = 'monthly'
        AND kt.period_start = month.start_date
        AND kt.period_end = (month.start_date + INTERVAL '1 month - 1 day')::date
        AND definition.kpi_code IN ('TARGET_ACHIEVEMENT', 'STORE_SALES', 'SALES_TARGET_ACHIEVEMENT', 'NET_SALES')
      GROUP BY definition.kpi_code
      ORDER BY CASE definition.kpi_code WHEN 'TARGET_ACHIEVEMENT' THEN 1
        WHEN 'STORE_SALES' THEN 2 WHEN 'SALES_TARGET_ACHIEVEMENT' THEN 3 ELSE 4 END
      LIMIT 1
    ) imported ON TRUE
  `;
  return `LEFT JOIN LATERAL (
    SELECT CASE WHEN COUNT(target.value) = COUNT(*) AND MIN(target.value) >= 0
      THEN SUM(target.value) END AS value
    FROM (SELECT DATE_TRUNC('month', $${startParameter}::date)::date AS first_month,
      (EXTRACT(YEAR FROM $${endParameter}::date) - EXTRACT(YEAR FROM $${startParameter}::date))::int * 12
      + (EXTRACT(MONTH FROM $${endParameter}::date) - EXTRACT(MONTH FROM $${startParameter}::date))::int AS month_count) bounds
    -- Integer bounds give PostgreSQL the actual month count instead of the timestamp series' 1,000-row estimate.
    CROSS JOIN LATERAL generate_series(0, bounds.month_count) offsets(month_offset)
    CROSS JOIN LATERAL (SELECT (bounds.first_month + offsets.month_offset * INTERVAL '1 month')::date AS start_date) month
    LEFT JOIN LATERAL (${monthlyValue}) target ON TRUE
  ) monthly_target ON TRUE`;
}
