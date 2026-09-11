import type { DatabaseService } from "../../../shared/database/database.service";

export async function readEmployeeTurkeyBenchmarks(database: DatabaseService, input: {
  periodStart: string; periodEnd: string; companyId?: string; periodType?: string;
}) {
  return (await database.query<{ kpi_code: string; benchmark_value: string | null }>(`
    WITH components AS (
      SELECT ka.employee_id, ka.store_id, kd.kpi_code,
        CASE WHEN $4::text IS DISTINCT FROM 'daily'
          OR COUNT(DISTINCT ka.period_start) = $2::date - $1::date + 1
          THEN SUM(ka.actual_value) END AS value
      FROM ops.kpi_actual ka
      JOIN ops.kpi_definition kd USING (kpi_id)
      WHERE ka.scope_type = 'employee'
        AND ka.period_start >= $1::date AND ka.period_end <= $2::date
        AND ($3::uuid IS NULL OR ka.company_id = $3::uuid)
        AND ($4::text IS NULL OR ka.period_type = $4)
        AND ($4::text IS DISTINCT FROM 'daily' OR ka.period_start = ka.period_end)
        AND kd.kpi_code IN ('NET_SALES', 'ITEM_COUNT', 'TICKET_COUNT')
        AND COALESCE(ka.source_type, '') <> 'demo_seed'
      GROUP BY ka.employee_id, ka.store_id, kd.kpi_code
    ), facts AS (
      SELECT employee_id, store_id,
        MAX(value) FILTER (WHERE kpi_code = 'NET_SALES') AS sales,
        MAX(value) FILTER (WHERE kpi_code = 'ITEM_COUNT') AS items,
        MAX(value) FILTER (WHERE kpi_code = 'TICKET_COUNT') AS tickets
      FROM components GROUP BY employee_id, store_id
    )
    SELECT 'ATV' AS kpi_code,
      (SUM(sales) / NULLIF(SUM(tickets), 0))::text AS benchmark_value
      FROM facts WHERE sales IS NOT NULL AND tickets IS NOT NULL
    UNION ALL
    SELECT 'UPT' AS kpi_code,
      (SUM(items) / NULLIF(SUM(tickets), 0))::text AS benchmark_value
      FROM facts WHERE items IS NOT NULL AND tickets IS NOT NULL
    ORDER BY kpi_code
  `, [input.periodStart, input.periodEnd, input.companyId ?? null, input.periodType ?? null])).rows;
}
