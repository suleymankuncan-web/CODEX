/** Daily physical facts are paired on the same entity/day before reducing the interval.
 * Missing days are omitted, never zero-filled; imported ratios and scores are not summed.
 */
export function rankingDailyComponentsSql(scope: "store" | "employee") {
  const employee = scope === "employee" ? "ka.employee_id," : "";
  const groupEmployee = scope === "employee" ? "employee_id," : "";
  return `WITH daily AS (
    SELECT ${employee} ka.store_id, ka.period_start AS day,
      MAX(ka.actual_value) FILTER (WHERE kd.kpi_code = 'NET_SALES') AS sales,
      MAX(ka.actual_value) FILTER (WHERE kd.kpi_code = 'ITEM_COUNT') AS items,
      MAX(ka.actual_value) FILTER (WHERE kd.kpi_code = 'TICKET_COUNT') AS tickets,
      MAX(ka.actual_value) FILTER (WHERE kd.kpi_code = 'FF') AS footfall,
      COALESCE(MAX(ka.actual_value) FILTER (WHERE kd.kpi_code = 'TARGET_ACHIEVEMENT'),
        MAX(ka.actual_value) FILTER (WHERE kd.kpi_code = 'STORE_SALES'),
        MAX(ka.actual_value) FILTER (WHERE kd.kpi_code = 'SALES_TARGET_ACHIEVEMENT'),
        MAX(ka.actual_value) FILTER (WHERE kd.kpi_code = 'NET_SALES')) AS achievement,
      COALESCE(MAX(kt.target_value) FILTER (WHERE kd.kpi_code = 'TARGET_ACHIEVEMENT'),
        MAX(kt.target_value) FILTER (WHERE kd.kpi_code = 'STORE_SALES'),
        MAX(kt.target_value) FILTER (WHERE kd.kpi_code = 'SALES_TARGET_ACHIEVEMENT'),
        MAX(kt.target_value) FILTER (WHERE kd.kpi_code = 'NET_SALES')) AS sales_target
    FROM ops.kpi_actual ka JOIN ops.kpi_definition kd USING (kpi_id)
    JOIN ops.store s ON s.store_id = ka.store_id
    LEFT JOIN ops.kpi_target kt ON kt.kpi_id = ka.kpi_id AND kt.store_id = ka.store_id
      AND kt.scope_type = '${scope}' AND kt.period_type = 'daily'
      AND kt.period_start = ka.period_start AND kt.period_end = ka.period_end
    WHERE ka.scope_type = '${scope}' AND ka.period_type = 'daily'
      AND ka.period_start = ka.period_end AND ka.period_start BETWEEN $1::date AND $2::date
      AND kd.kpi_code IN ('NET_SALES','ITEM_COUNT','TICKET_COUNT','FF',
        'TARGET_ACHIEVEMENT','STORE_SALES','SALES_TARGET_ACHIEVEMENT','gsm_approval')
      AND COALESCE(ka.source_type, '') <> 'demo_seed' AND s.kpi_import_enabled = TRUE
      AND (cardinality($3::uuid[]) = 0 OR s.company_id = ANY($3::uuid[]))
    GROUP BY ${employee} ka.store_id, ka.period_start
  ), facts AS (
    SELECT ${groupEmployee} store_id, SUM(sales) AS sales,
      SUM(achievement) AS achievement,
      CASE WHEN COUNT(sales_target) = COUNT(achievement) THEN SUM(sales_target) END AS sales_target,
      SUM(sales) FILTER (WHERE tickets IS NOT NULL) AS atv_numerator,
      SUM(tickets) FILTER (WHERE sales IS NOT NULL) AS atv_denominator,
      SUM(items) FILTER (WHERE tickets IS NOT NULL) AS upt_numerator,
      SUM(tickets) FILTER (WHERE items IS NOT NULL) AS upt_denominator,
      SUM(tickets) FILTER (WHERE footfall IS NOT NULL) AS cr_numerator,
      SUM(footfall) FILTER (WHERE tickets IS NOT NULL) AS cr_denominator
    FROM daily GROUP BY ${groupEmployee} store_id
  )`;
}
