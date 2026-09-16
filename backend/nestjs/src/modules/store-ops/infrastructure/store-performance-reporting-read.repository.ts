import { Injectable, Optional } from "@nestjs/common";
import { RankingFactsCache } from "./ranking-facts-cache";
import { readRankingRangeBenchmarks } from "./ranking-range-read";
import { DatabaseService } from "../../../shared/database/database.service";

@Injectable()
export class StorePerformanceReportingReadRepository {
  constructor(private readonly databaseService: DatabaseService,
    @Optional() private readonly rankingFactsCache?: RankingFactsCache) {}

  async getStoreNameById(storeId: string) {
    const result = await this.databaseService.query<{ store_name: string | null }>(
      `
        SELECT store_name
        FROM ops.store
        WHERE store_id = $1::uuid
        LIMIT 1
      `,
      [storeId],
    );

    return result.rows[0]?.store_name ?? null;
  }

  async getStoreScopeById(storeId: string) {
    const result = await this.databaseService.query<{
      store_id: string;
      company_id: string | null;
      region_id: string | null;
    }>(
      `
        SELECT
          store_id::text AS store_id,
          company_id::text AS company_id,
          region_id::text AS region_id
        FROM ops.store
        WHERE store_id = $1::uuid
        LIMIT 1
      `,
      [storeId],
    );

    return result.rows[0] ?? null;
  }

  async canRegionManagerReadStore(input: { userId: string; storeId: string }) {
    const result = await this.databaseService.query<{ can_read: boolean }>(
      `
        SELECT EXISTS (
          SELECT 1
          FROM ops.store store
          INNER JOIN ops.company company
            ON company.company_id = store.company_id
          INNER JOIN ops.region region
            ON region.region_id = store.region_id
           AND region.company_id = store.company_id
          INNER JOIN ops.user_role_assignment ura ON (
            (
              ura.scope_type = 'region'
              AND ura.company_id = store.company_id
              AND ura.region_id = store.region_id
            )
            OR (
              ura.scope_type = 'store'
              AND ura.company_id = store.company_id
              AND ura.region_id = store.region_id
              AND ura.store_id = store.store_id
            )
          )
          INNER JOIN ops.role role
            ON role.role_id = ura.role_id
           AND role.role_code = 'REGION_MANAGER'
          WHERE ura.user_id = $1::uuid
            AND store.store_id = $2::uuid
            AND company.status = 'active'
            AND region.status = 'active'
            AND store.status = 'active'
            AND ura.start_at <= NOW()
            AND (ura.end_at IS NULL OR ura.end_at >= NOW())
        ) AS can_read
      `,
      [input.userId, input.storeId],
    );

    return result.rows[0]?.can_read === true;
  }

  async getLatestStoreKpiPeriod(input: {
    storeId: string;
    metricCodes: string[];
    periodType?: string;
    periodStart?: string;
  }) {
    const params: unknown[] = [input.storeId, input.metricCodes];
    const clauses = [
      `ka.store_id = $1::uuid`,
      `ka.scope_type = 'store'`,
      `kd.kpi_code = ANY($2::text[])`,
    ];

    if (input.periodType) {
      params.push(input.periodType);
      clauses.push(`ka.period_type = $${params.length}`);
    }

    if (input.periodStart) {
      params.push(input.periodStart);
      clauses.push(`ka.period_start = $${params.length}::date`);
    }

    const result = await this.databaseService.query<{
      period_type: string;
      period_start: string;
      period_end: string;
    }>(
      `
        SELECT
          ka.period_type,
          ka.period_start,
          ka.period_end
        FROM ops.kpi_actual ka
        INNER JOIN ops.kpi_definition kd
          ON kd.kpi_id = ka.kpi_id
        WHERE ${clauses.join(" AND ")}
        ORDER BY ka.period_end DESC, ka.period_start DESC
        LIMIT 1
      `,
      params,
    );

    return result.rows[0] ?? null;
  }

  async listStoreKpiPeriods(input: {
    storeId: string;
    metricCodes: string[];
  }) {
    const result = await this.databaseService.query<{
      period_type: string;
      period_start: string;
      period_end: string;
    }>(
      `
        SELECT DISTINCT
          ka.period_type,
          ka.period_start,
          ka.period_end
        FROM ops.kpi_actual ka
        INNER JOIN ops.kpi_definition kd
          ON kd.kpi_id = ka.kpi_id
        WHERE ka.store_id = $1::uuid
          AND ka.scope_type = 'store'
          AND kd.kpi_code = ANY($2::text[])
        ORDER BY 3 DESC, 2 DESC
      `,
      [input.storeId, input.metricCodes],
    );

    return result.rows;
  }

  async getStorePerformanceRows(input: {
    storeId: string;
    metricCodes: string[];
    periodType: string;
    periodStart: string;
    periodEnd: string;
  }) {
    const result = await this.databaseService.query<{
      store_id: string;
      store_name: string;
      kpi_code: string;
      kpi_name: string;
      actual_value: string | null;
      achievement_rate: string | null;
      target_value: string | null;
    }>(
      `
        SELECT
          store.store_id,
          store.store_name,
          kd.kpi_code,
          kd.kpi_name,
          ka.actual_value::text AS actual_value,
          ka.achievement_rate::text AS achievement_rate,
          kt.target_value::text AS target_value
        FROM ops.kpi_actual ka
        INNER JOIN ops.kpi_definition kd
          ON kd.kpi_id = ka.kpi_id
        INNER JOIN ops.store store
          ON store.store_id = ka.store_id
        LEFT JOIN ops.kpi_target kt
          ON kt.kpi_id = ka.kpi_id
          AND kt.scope_type = 'store'
          AND kt.store_id = ka.store_id
          AND kt.period_type = ka.period_type
          AND kt.period_start = ka.period_start
          AND kt.period_end = ka.period_end
        WHERE ka.store_id = $1::uuid
          AND ka.scope_type = 'store'
          AND kd.kpi_code = ANY($2::text[])
          AND ka.period_type = $3
          AND ka.period_start = $4::date
          AND ka.period_end = $5::date
        ORDER BY kd.kpi_code ASC
      `,
      [
        input.storeId,
        input.metricCodes,
        input.periodType,
        input.periodStart,
        input.periodEnd,
      ],
    );

    return result.rows;
  }

  async getPeerStorePerformanceRows(input: {
    metricCodes: string[];
    companyId?: string;
    periodType: string;
    periodStart: string;
    periodEnd: string;
  }) {
    const params: unknown[] = [
      input.metricCodes,
      input.periodType,
      input.periodStart,
      input.periodEnd,
    ];
    const clauses = [
      `ka.scope_type = 'store'`,
      `kd.kpi_code = ANY($1::text[])`,
      `ka.period_type = $2`,
      `ka.period_start = $3::date`,
      `ka.period_end = $4::date`,
    ];

    if (input.companyId) {
      params.push(input.companyId);
      clauses.push(`ka.company_id = $${params.length}::uuid`);
    }

    const result = await this.databaseService.query<{
      store_id: string;
      kpi_code: string;
      actual_value: string;
    }>(
      `
        SELECT
          ka.store_id,
          kd.kpi_code,
          ka.actual_value::text AS actual_value
        FROM ops.kpi_actual ka
        INNER JOIN ops.kpi_definition kd
          ON kd.kpi_id = ka.kpi_id
        WHERE ${clauses.join(" AND ")}
        ORDER BY ka.store_id ASC, kd.kpi_code ASC
      `,
      params,
    );

    return result.rows;
  }

  async getStoreTurkeyBenchmarkValues(input: {
    isRange?: boolean;
    periodType: string;
    periodStart: string;
    periodEnd: string;
    companyId?: string;
  }) {
    if (input.isRange || (input.periodType === "daily" && input.periodStart !== input.periodEnd)) return readRankingRangeBenchmarks(this.databaseService, input, this.rankingFactsCache);
    const params: unknown[] = [
      input.periodType,
      input.periodStart,
      input.periodEnd,
    ];
    const companyClause = input.companyId
      ? (() => {
          params.push(input.companyId);
          return `AND store.company_id = $${params.length}::uuid`;
        })()
      : "";

    const result = await this.databaseService.query<{
      kpi_code: string;
      benchmark_value: string | null;
    }>(
      `
        WITH scoped_actual AS (
          SELECT
            ka.store_id,
            kd.kpi_code,
            SUM(ka.actual_value) AS actual_value
          FROM ops.kpi_actual ka
          INNER JOIN ops.kpi_definition kd
            ON kd.kpi_id = ka.kpi_id
          INNER JOIN ops.store store
            ON store.store_id = ka.store_id
          WHERE ka.scope_type = 'store'
            AND ka.period_type = $1
            AND ka.period_start >= $2::date
            AND ka.period_end <= $3::date
            AND store.kpi_import_enabled = TRUE
            AND COALESCE(ka.source_type, '') <> 'demo_seed'
            ${companyClause}
          GROUP BY ka.store_id, kd.kpi_code
        )
        SELECT 'ATV' AS kpi_code,
               AVG(scoped_actual.actual_value)::text AS benchmark_value
        FROM scoped_actual
        WHERE scoped_actual.kpi_code = 'ATV'
        UNION ALL
        SELECT 'UPT' AS kpi_code,
               (SUM(item_count.actual_value) / NULLIF(SUM(ticket_count.actual_value), 0))::text AS benchmark_value
        FROM scoped_actual item_count
        INNER JOIN scoped_actual ticket_count
          ON ticket_count.store_id = item_count.store_id
          AND ticket_count.kpi_code = 'TICKET_COUNT'
        WHERE item_count.kpi_code = 'ITEM_COUNT'
        UNION ALL
        SELECT 'CR' AS kpi_code,
               (SUM(ticket_count.actual_value) / NULLIF(SUM(ff.actual_value), 0))::text AS benchmark_value
        FROM scoped_actual ticket_count
        INNER JOIN scoped_actual ff
          ON ff.store_id = ticket_count.store_id
          AND ff.kpi_code = 'FF'
        WHERE ticket_count.kpi_code = 'TICKET_COUNT'
        UNION ALL
        SELECT 'gsm_approval' AS kpi_code,
               AVG(scoped_actual.actual_value)::text AS benchmark_value
        FROM scoped_actual
        WHERE scoped_actual.kpi_code IN ('gsm_approval', 'GSM_ONAY')
        UNION ALL
        SELECT 'GSM_ONAY' AS kpi_code,
               AVG(scoped_actual.actual_value)::text AS benchmark_value
        FROM scoped_actual
        WHERE scoped_actual.kpi_code IN ('gsm_approval', 'GSM_ONAY')
      `,
      params,
    );

    return result.rows;
  }
}
