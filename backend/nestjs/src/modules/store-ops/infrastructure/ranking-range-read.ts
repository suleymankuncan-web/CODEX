import { rankingDailyComponentsSql } from "./ranking-daily-components-sql";
import { cachedRankingFactsSql } from "./ranking-facts-cache-sql";
import type { RankingFactsCache } from "./ranking-facts-cache";
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

/** Ratios use matched daily components; monthly values are never used as daily facts. */
export async function readRankingStoreRange(
  database: DatabaseService,
  input: RankingRangeInput,
  cache?: RankingFactsCache,
) {
  const facts = await cache?.get("store", input);
  return (
    await database.query<RankingRangeRow>(
      `
    ${facts === undefined ? rankingDailyComponentsSql("store") : cachedRankingFactsSql("store", 5)}, gsm AS (
      SELECT g.store_id,
        CASE WHEN COUNT(DISTINCT g.business_date) = COUNT(*) AND COUNT(DISTINCT outcome.integration_source_id) = 1
          THEN SUM(g.yes_customer_count)::numeric / NULLIF(SUM(g.total_customer_count), 0) END AS value,
        CASE WHEN COUNT(kt.target_value) = COUNT(*) THEN
          SUM(kt.target_value * g.total_customer_count) / NULLIF(SUM(g.total_customer_count), 0) END AS target
      FROM ops.company_daily_kpi_store_gsm g
      JOIN ops.company_daily_kpi_component_outcome outcome USING (component_outcome_id, business_date, operation)
      JOIN ops.store s ON s.store_id = g.store_id
      LEFT JOIN ops.kpi_definition gsm_definition ON gsm_definition.kpi_code = 'gsm_approval'
      LEFT JOIN ops.kpi_target kt ON kt.kpi_id = gsm_definition.kpi_id AND kt.store_id = g.store_id
        AND kt.scope_type = 'store' AND kt.period_type = 'daily'
        AND kt.period_start = g.business_date AND kt.period_end = g.business_date
      WHERE g.business_date BETWEEN $1::date AND $2::date AND outcome.status = 'succeeded'
        AND s.kpi_import_enabled = TRUE
        AND (cardinality($3::uuid[]) = 0 OR s.company_id = ANY($3::uuid[]))
      GROUP BY g.store_id
    )
    SELECT s.store_id::text, s.store_name, s.region_id::text, r.region_name,
      manager.user_id AS region_manager_user_id, manager.display_name AS region_manager_name,
      kd.kpi_code, kd.kpi_name,
      CASE kd.kpi_code
        WHEN 'ATV' THEN facts.atv_numerator / NULLIF(facts.atv_denominator, 0)
        WHEN 'UPT' THEN facts.upt_numerator / NULLIF(facts.upt_denominator, 0)
        WHEN 'CR' THEN facts.cr_numerator / NULLIF(facts.cr_denominator, 0)
        WHEN 'gsm_approval' THEN gsm.value * 100
        WHEN 'TARGET_ACHIEVEMENT' THEN facts.achievement
      END::text AS actual_value,
      CASE WHEN kd.kpi_code = 'TARGET_ACHIEVEMENT' THEN facts.sales_target WHEN kd.kpi_code = 'gsm_approval' THEN gsm.target * 100 END::text AS target_value,
      NULL::text AS achievement_rate
    FROM facts
    JOIN ops.store s USING (store_id)
    LEFT JOIN ops.region r USING (region_id)
    CROSS JOIN ops.kpi_definition kd
    LEFT JOIN gsm ON gsm.store_id = s.store_id
    LEFT JOIN LATERAL (
      SELECT ua.user_id::text, COALESCE(NULLIF(TRIM(CONCAT(e.first_name, ' ', e.last_name)), ''), ua.username, ua.email, ua.user_id::text) AS display_name
      FROM ops.user_action_store_assignment manager_store
      JOIN ops.user_role_assignment ura ON ura.user_id = manager_store.user_id
        AND ura.start_at <= NOW() AND (ura.end_at IS NULL OR ura.end_at >= NOW())
      JOIN ops.role role ON role.role_id = ura.role_id AND role.role_code = 'REGION_MANAGER'
      JOIN ops.user_account ua ON ua.user_id = ura.user_id AND ua.is_active = TRUE
      LEFT JOIN ops.employee e ON e.employee_id = ua.employee_id
      WHERE manager_store.store_id = s.store_id
        AND manager_store.start_at <= NOW() AND (manager_store.end_at IS NULL OR manager_store.end_at > NOW())
      ORDER BY ua.username, ua.user_id LIMIT 1
    ) manager ON TRUE
    WHERE kd.kpi_code = ANY($4::text[])
    ORDER BY s.store_name, s.store_id, kd.kpi_code
  `,
      [input.periodStart, input.periodEnd, input.companyIds, input.metricCodes, ...(facts === undefined ? [] : [facts])],
    )
  ).rows;
}

export async function readRankingRangeBenchmarks(
  database: DatabaseService,
  input: { companyId?: string; periodStart: string; periodEnd: string },
  cache?: RankingFactsCache,
) {
  const facts = await cache?.get("store", { ...input, companyIds: input.companyId ? [input.companyId] : [] });
  return (
    await database.query<{ kpi_code: string; benchmark_value: string | null }>(
      `
    ${facts === undefined ? rankingDailyComponentsSql("store") : cachedRankingFactsSql("store", 4)}, pairs AS (
      SELECT 'ATV' AS kpi_code, atv_numerator AS numerator, atv_denominator AS denominator FROM facts
      UNION ALL SELECT 'UPT', upt_numerator, upt_denominator FROM facts
      UNION ALL SELECT 'CR', cr_numerator, cr_denominator FROM facts
    ), gsm AS (
      SELECT g.store_id, SUM(g.yes_customer_count) AS yes_count, SUM(g.total_customer_count) AS total_count
      FROM ops.company_daily_kpi_store_gsm g
      JOIN ops.company_daily_kpi_component_outcome outcome USING (component_outcome_id, business_date, operation)
      JOIN ops.store s USING (store_id)
      WHERE g.business_date BETWEEN $1::date AND $2::date AND outcome.status = 'succeeded'
        AND s.kpi_import_enabled = TRUE AND (cardinality($3::uuid[]) = 0 OR s.company_id = ANY($3::uuid[]))
      GROUP BY g.store_id
      HAVING COUNT(DISTINCT g.business_date) = COUNT(*) AND COUNT(DISTINCT outcome.integration_source_id) = 1
    )
    SELECT kpi_code,
      (SUM(numerator) / NULLIF(SUM(denominator), 0))::text AS benchmark_value FROM pairs GROUP BY kpi_code
    UNION ALL SELECT 'gsm_approval', (100 * SUM(yes_count)::numeric / NULLIF(SUM(total_count), 0))::text FROM gsm
  `,
      [input.periodStart, input.periodEnd, input.companyId ? [input.companyId] : [], ...(facts === undefined ? [] : [facts])],
    )
  ).rows;
}
