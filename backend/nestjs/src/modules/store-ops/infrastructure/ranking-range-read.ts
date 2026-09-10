import type { DatabaseService } from "../../../shared/database/database.service";

export type RankingRangeInput = {
  companyIds: string[];
  periodStart: string;
  periodEnd: string;
  metricCodes: string[];
};
export type RankingRangeRow = {
  store_id: string;
  store_name: string | null;
  region_id: string | null;
  region_name: string | null;
  region_manager_user_id: string | null;
  region_manager_name: string | null;
  kpi_code: string;
  kpi_name: string | null;
  actual_value: string | null;
  target_value: string | null;
  achievement_rate: string | null;
};

/** Ratios require complete daily components; monthly values are never used as daily facts. */
export async function readRankingStoreRange(
  database: DatabaseService,
  input: RankingRangeInput,
) {
  return (
    await database.query<RankingRangeRow>(
      `
    WITH daily AS (
      SELECT ka.store_id, ka.period_start AS day, kd.kpi_code, ka.actual_value,
        kt.target_value
      FROM ops.kpi_actual ka
      JOIN ops.kpi_definition kd ON kd.kpi_id = ka.kpi_id
      JOIN ops.store s ON s.store_id = ka.store_id
      LEFT JOIN ops.kpi_target kt ON kt.kpi_id = ka.kpi_id AND kt.store_id = ka.store_id
        AND kt.scope_type = 'store' AND kt.period_type = 'daily'
        AND kt.period_start = ka.period_start AND kt.period_end = ka.period_end
      WHERE ka.scope_type = 'store' AND ka.period_type = 'daily'
        AND ka.period_start = ka.period_end
        AND ka.period_start BETWEEN $1::date AND $2::date
        AND COALESCE(ka.source_type, '') <> 'demo_seed' AND s.kpi_import_enabled = TRUE
        AND (cardinality($3::uuid[]) = 0 OR s.company_id = ANY($3::uuid[]))
    ), totals AS (
      SELECT store_id, kpi_code,
        CASE WHEN COUNT(DISTINCT day) = $2::date - $1::date + 1 THEN SUM(actual_value) END AS value,
        CASE WHEN COUNT(target_value) = $2::date - $1::date + 1 THEN SUM(target_value) END AS target,
        CASE WHEN COUNT(target_value) = $2::date - $1::date + 1 AND MIN(target_value) = MAX(target_value) THEN MIN(target_value) END AS rate_target
      FROM daily GROUP BY store_id, kpi_code
    ), gsm AS (
      SELECT g.store_id,
        CASE WHEN COUNT(*) = $2::date - $1::date + 1
          AND COUNT(DISTINCT g.business_date) = COUNT(*) AND COUNT(DISTINCT outcome.integration_source_id) = 1
          THEN SUM(g.yes_customer_count)::numeric / NULLIF(SUM(g.total_customer_count), 0) END AS value
      FROM ops.company_daily_kpi_store_gsm g
      JOIN ops.company_daily_kpi_component_outcome outcome USING (component_outcome_id, business_date, operation)
      JOIN ops.store s ON s.store_id = g.store_id
      WHERE g.business_date BETWEEN $1::date AND $2::date AND outcome.status = 'succeeded'
        AND (cardinality($3::uuid[]) = 0 OR s.company_id = ANY($3::uuid[]))
      GROUP BY g.store_id
    ), facts AS (
      SELECT DISTINCT store_id FROM daily
    )
    SELECT s.store_id::text, s.store_name, s.region_id::text, r.region_name,
      manager.user_id AS region_manager_user_id, manager.display_name AS region_manager_name,
      kd.kpi_code, kd.kpi_name,
      CASE kd.kpi_code
        WHEN 'ATV' THEN sales.value / NULLIF(tickets.value, 0)
        WHEN 'UPT' THEN items.value / NULLIF(tickets.value, 0)
        WHEN 'CR' THEN tickets.value / NULLIF(footfall.value, 0)
        WHEN 'gsm_approval' THEN gsm.value * 100
        WHEN 'TARGET_ACHIEVEMENT' THEN COALESCE(achievement.value, sales.value)
      END::text AS actual_value,
      CASE WHEN kd.kpi_code = 'TARGET_ACHIEVEMENT' THEN COALESCE(achievement.target, sales.target) WHEN kd.kpi_code = 'gsm_approval' THEN gsm_target.rate_target * 100 END::text AS target_value,
      NULL::text AS achievement_rate
    FROM facts
    JOIN ops.store s USING (store_id)
    LEFT JOIN ops.region r USING (region_id)
    CROSS JOIN ops.kpi_definition kd
    LEFT JOIN totals sales ON sales.store_id = s.store_id AND sales.kpi_code = 'NET_SALES'
    LEFT JOIN totals items ON items.store_id = s.store_id AND items.kpi_code = 'ITEM_COUNT'
    LEFT JOIN totals tickets ON tickets.store_id = s.store_id AND tickets.kpi_code = 'TICKET_COUNT'
    LEFT JOIN totals footfall ON footfall.store_id = s.store_id AND footfall.kpi_code = 'FF'
    LEFT JOIN LATERAL (
      SELECT candidate.value, candidate.target
      FROM totals candidate
      WHERE candidate.store_id = s.store_id
        AND candidate.kpi_code IN ('TARGET_ACHIEVEMENT', 'STORE_SALES', 'SALES_TARGET_ACHIEVEMENT')
      ORDER BY CASE candidate.kpi_code WHEN 'TARGET_ACHIEVEMENT' THEN 0 WHEN 'STORE_SALES' THEN 1 ELSE 2 END
      LIMIT 1
    ) achievement ON TRUE
    LEFT JOIN totals gsm_target ON gsm_target.store_id = s.store_id AND gsm_target.kpi_code = 'gsm_approval'
    LEFT JOIN gsm ON gsm.store_id = s.store_id
    LEFT JOIN LATERAL (
      SELECT ua.user_id::text, COALESCE(NULLIF(TRIM(CONCAT(e.first_name, ' ', e.last_name)), ''), ua.username, ua.email, ua.user_id::text) AS display_name
      FROM ops.user_role_assignment ura
      JOIN ops.role role ON role.role_id = ura.role_id AND role.role_code = 'REGION_MANAGER'
      JOIN ops.user_account ua ON ua.user_id = ura.user_id AND ua.is_active = TRUE
      LEFT JOIN ops.employee e ON e.employee_id = ua.employee_id
      WHERE ura.region_id = s.region_id AND ura.start_at <= NOW() AND (ura.end_at IS NULL OR ura.end_at >= NOW())
      ORDER BY ua.username, ua.user_id LIMIT 1
    ) manager ON TRUE
    WHERE kd.kpi_code = ANY($4::text[])
    ORDER BY s.store_name, s.store_id, kd.kpi_code
  `,
      [input.periodStart, input.periodEnd, input.companyIds, input.metricCodes],
    )
  ).rows;
}

export async function readRankingRangeBenchmarks(
  database: DatabaseService,
  input: { companyId?: string; periodStart: string; periodEnd: string },
) {
  return (
    await database.query<{ kpi_code: string; benchmark_value: string | null }>(
      `
    WITH totals AS (
      SELECT ka.store_id, kd.kpi_code,
        CASE WHEN COUNT(DISTINCT ka.period_start) = $2::date - $1::date + 1 THEN SUM(ka.actual_value) END AS value
      FROM ops.kpi_actual ka JOIN ops.kpi_definition kd USING (kpi_id)
      JOIN ops.store s USING (store_id)
      WHERE ka.scope_type = 'store' AND ka.period_type = 'daily' AND ka.period_start = ka.period_end
        AND ka.period_start BETWEEN $1::date AND $2::date AND COALESCE(ka.source_type, '') <> 'demo_seed'
        AND s.kpi_import_enabled = TRUE AND ($3::uuid IS NULL OR s.company_id = $3::uuid)
      GROUP BY ka.store_id, kd.kpi_code
    ), pairs AS (
      SELECT numerator.kpi_code, numerator.value AS numerator, denominator.value AS denominator
      FROM totals numerator JOIN totals denominator USING (store_id)
      WHERE numerator.value IS NOT NULL AND denominator.value IS NOT NULL
        AND ((numerator.kpi_code IN ('NET_SALES', 'ITEM_COUNT') AND denominator.kpi_code = 'TICKET_COUNT')
          OR (numerator.kpi_code = 'TICKET_COUNT' AND denominator.kpi_code = 'FF'))
    ), gsm AS (
      SELECT g.store_id, SUM(g.yes_customer_count) AS yes_count, SUM(g.total_customer_count) AS total_count
      FROM ops.company_daily_kpi_store_gsm g
      JOIN ops.company_daily_kpi_component_outcome outcome USING (component_outcome_id, business_date, operation)
      JOIN ops.store s USING (store_id)
      WHERE g.business_date BETWEEN $1::date AND $2::date AND outcome.status = 'succeeded'
        AND s.kpi_import_enabled = TRUE AND ($3::uuid IS NULL OR s.company_id = $3::uuid)
      GROUP BY g.store_id
      HAVING COUNT(*) = $2::date - $1::date + 1 AND COUNT(DISTINCT g.business_date) = COUNT(*) AND COUNT(DISTINCT outcome.integration_source_id) = 1
    )
    SELECT CASE kpi_code WHEN 'NET_SALES' THEN 'ATV' WHEN 'ITEM_COUNT' THEN 'UPT' ELSE 'CR' END AS kpi_code,
      (SUM(numerator) / NULLIF(SUM(denominator), 0))::text AS benchmark_value FROM pairs GROUP BY kpi_code
    UNION ALL SELECT 'gsm_approval', (100 * SUM(yes_count)::numeric / NULLIF(SUM(total_count), 0))::text FROM gsm
  `,
      [input.periodStart, input.periodEnd, input.companyId ?? null],
    )
  ).rows;
}
