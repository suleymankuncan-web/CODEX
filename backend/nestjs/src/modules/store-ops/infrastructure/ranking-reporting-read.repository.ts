import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../../../shared/database/database.service";

@Injectable()
export class RankingReportingReadRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async getLatestRankingPeriod(input: {
    metricCodes: string[];
    periodType: "daily" | "monthly";
    periodStart?: string;
  }) {
    if (input.metricCodes.length === 0) {
      return null;
    }

    const params: unknown[] = [input.metricCodes, input.periodType];
    const clauses = [
      `ka.period_type = $2`,
      `kd.kpi_code = ANY($1::text[])`,
      `COALESCE(ka.source_type, '') <> 'demo_seed'`,
    ];

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
          ka.period_start::text AS period_start,
          ka.period_end::text AS period_end
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

  async listRankingAvailablePeriods(input: { metricCodes: string[] }) {
    if (input.metricCodes.length === 0) {
      return [];
    }

    const result = await this.databaseService.query<{
      period_type: string;
      period_start: string;
      period_end: string;
    }>(
      `
        SELECT DISTINCT
          ka.period_type,
          ka.period_start::text AS period_start,
          ka.period_end::text AS period_end
        FROM ops.kpi_actual ka
        INNER JOIN ops.kpi_definition kd
          ON kd.kpi_id = ka.kpi_id
        WHERE ka.period_type IN ('daily', 'monthly')
          AND kd.kpi_code = ANY($1::text[])
          AND COALESCE(ka.source_type, '') <> 'demo_seed'
        ORDER BY 3 DESC, 2 DESC
      `,
      [input.metricCodes],
    );

    return result.rows;
  }

  async listRankingStoreKpiRows(input: {
    metricCodes: string[];
    companyIds: string[];
    periodType: string;
    periodStart: string;
    periodEnd: string;
  }) {
    if (input.metricCodes.length === 0) {
      return [];
    }

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
      `store.kpi_import_enabled = TRUE`,
      `COALESCE(ka.source_type, '') <> 'demo_seed'`,
    ];

    if (input.companyIds.length > 0) {
      params.push(input.companyIds);
      clauses.push(`store.company_id = ANY($${params.length}::uuid[])`);
    }

    const result = await this.databaseService.query<{
      store_id: string;
      store_name: string | null;
      region_id: string | null;
      region_name: string | null;
      region_manager_user_id: string | null;
      region_manager_name: string | null;
      kpi_code: string;
      kpi_name: string | null;
      actual_value: string | null;
      achievement_rate: string | null;
      target_value: string | null;
    }>(
      `
        SELECT
          store.store_id::text AS store_id,
          store.store_name,
          store.region_id::text AS region_id,
          region.region_name,
          region_manager.user_id AS region_manager_user_id,
          region_manager.display_name AS region_manager_name,
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
        LEFT JOIN ops.region region
          ON region.region_id = store.region_id
        LEFT JOIN ops.kpi_target kt
          ON kt.kpi_id = ka.kpi_id
         AND kt.scope_type = 'store'
         AND kt.store_id = ka.store_id
         AND kt.period_type = ka.period_type
         AND kt.period_start = ka.period_start
         AND kt.period_end = ka.period_end
        LEFT JOIN LATERAL (
          SELECT
            ua.user_id::text AS user_id,
            COALESCE(
              NULLIF(TRIM(CONCAT(employee.first_name, ' ', employee.last_name)), ''),
              ua.username,
              ua.email,
              ua.user_id::text
            ) AS display_name
          FROM ops.user_role_assignment ura
          INNER JOIN ops.role role
            ON role.role_id = ura.role_id
           AND role.role_code = 'REGION_MANAGER'
          INNER JOIN ops.user_account ua
            ON ua.user_id = ura.user_id
           AND ua.is_active = TRUE
          LEFT JOIN ops.employee employee
            ON employee.employee_id = ua.employee_id
          WHERE ura.region_id = store.region_id
            AND ura.start_at <= NOW()
            AND (ura.end_at IS NULL OR ura.end_at >= NOW())
          ORDER BY ua.username ASC, ua.user_id ASC
          LIMIT 1
        ) region_manager ON TRUE
        WHERE ${clauses.join(" AND ")}
        ORDER BY store.store_name ASC, store.store_id ASC, kd.kpi_code ASC
      `,
      params,
    );

    return result.rows;
  }

  async listRankingStoreChecklistRows(input: {
    companyIds: string[];
    periodStart: string;
    periodEnd: string;
  }) {
    const params: unknown[] = [input.periodStart, input.periodEnd];
    const clauses = [
      `ci.status = 'completed'`,
      `ci.completed_at IS NOT NULL`,
      `ci.completed_at::date BETWEEN $1::date AND $2::date`,
      `ct.template_type IN ('BM_STORE_VISIT', 'VM_STORE_VISIT')`,
      `store.kpi_import_enabled = TRUE`,
    ];

    if (input.companyIds.length > 0) {
      params.push(input.companyIds);
      clauses.push(`store.company_id = ANY($${params.length}::uuid[])`);
    }

    const result = await this.databaseService.query<{
      store_id: string;
      store_name: string | null;
      region_id: string | null;
      region_name: string | null;
      region_manager_user_id: string | null;
      region_manager_name: string | null;
      position_code: string | null;
      net_sales_value: string | null;
      store_net_sales_value: string | null;
      kpi_code: string;
      kpi_name: string | null;
      actual_value: string | null;
      target_value: string | null;
    }>(
      `
        SELECT
          store.store_id::text AS store_id,
          store.store_name,
          store.region_id::text AS region_id,
          region.region_name,
          region_manager.user_id AS region_manager_user_id,
          region_manager.display_name AS region_manager_name,
          CASE ct.template_type
            WHEN 'BM_STORE_VISIT' THEN 'BM_CHECKLIST'
            WHEN 'VM_STORE_VISIT' THEN 'VM_CHECKLIST'
          END AS kpi_code,
          CASE ct.template_type
            WHEN 'BM_STORE_VISIT' THEN 'BM Checklist'
            WHEN 'VM_STORE_VISIT' THEN 'VM Checklist'
          END AS kpi_name,
          AVG(ci.total_score)::numeric(12,2)::text AS actual_value,
          NULL::text AS target_value
        FROM ops.checklist_instance ci
        INNER JOIN ops.checklist_template ct
          ON ct.checklist_template_id = ci.checklist_template_id
        INNER JOIN ops.store store
          ON store.store_id = ci.store_id
        LEFT JOIN ops.region region
          ON region.region_id = store.region_id
        LEFT JOIN LATERAL (
          SELECT
            ua.user_id::text AS user_id,
            COALESCE(
              NULLIF(TRIM(CONCAT(employee.first_name, ' ', employee.last_name)), ''),
              ua.username,
              ua.email,
              ua.user_id::text
            ) AS display_name
          FROM ops.user_role_assignment ura
          INNER JOIN ops.role role
            ON role.role_id = ura.role_id
           AND role.role_code = 'REGION_MANAGER'
          INNER JOIN ops.user_account ua
            ON ua.user_id = ura.user_id
           AND ua.is_active = TRUE
          LEFT JOIN ops.employee employee
            ON employee.employee_id = ua.employee_id
          WHERE ura.region_id = store.region_id
            AND ura.start_at <= NOW()
            AND (ura.end_at IS NULL OR ura.end_at >= NOW())
          ORDER BY ua.username ASC, ua.user_id ASC
          LIMIT 1
        ) region_manager ON TRUE
        WHERE ${clauses.join(" AND ")}
        GROUP BY
          store.store_id,
          store.store_name,
          store.region_id,
          region.region_name,
          region_manager.user_id,
          region_manager.display_name,
          ct.template_type
        ORDER BY store.store_name ASC, store.store_id ASC, kpi_code ASC
      `,
      params,
    );

    return result.rows;
  }

  async listRankingPersonnelKpiRows(input: {
    metricCodes: string[];
    companyIds: string[];
    periodType: string;
    periodStart: string;
    periodEnd: string;
  }) {
    if (input.metricCodes.length === 0) {
      return [];
    }

    const params: unknown[] = [
      input.metricCodes,
      input.periodType,
      input.periodStart,
      input.periodEnd,
    ];
    const clauses = [
      `ka.scope_type = 'employee'`,
      `kd.kpi_code = ANY($1::text[])`,
      `ka.period_type = $2`,
      `ka.period_start = $3::date`,
      `ka.period_end = $4::date`,
      `store.kpi_import_enabled = TRUE`,
      `COALESCE(ka.source_type, '') <> 'demo_seed'`,
    ];

    if (input.companyIds.length > 0) {
      params.push(input.companyIds);
      clauses.push(`ka.company_id = ANY($${params.length}::uuid[])`);
    }

    const result = await this.databaseService.query<{
      employee_id: string;
      first_name: string | null;
      last_name: string | null;
      store_id: string | null;
      store_name: string | null;
      region_id: string | null;
      region_name: string | null;
      region_manager_user_id: string | null;
      region_manager_name: string | null;
      kpi_code: string;
      kpi_name: string | null;
      actual_value: string | null;
      target_value: string | null;
    }>(
      `
        SELECT
          ka.employee_id::text AS employee_id,
          employee.first_name,
          employee.last_name,
          store.store_id::text AS store_id,
          store.store_name,
          region.region_id::text AS region_id,
          region.region_name,
          region_manager.user_id AS region_manager_user_id,
          region_manager.display_name AS region_manager_name,
          position.position_code,
          employee_sales.net_sales_value::text AS net_sales_value,
          store_sales.store_net_sales_value::text AS store_net_sales_value,
          kd.kpi_code,
          kd.kpi_name,
          ka.actual_value::text AS actual_value,
          ptr.target_value::text AS target_value
        FROM ops.kpi_actual ka
        INNER JOIN ops.kpi_definition kd
          ON kd.kpi_id = ka.kpi_id
        INNER JOIN ops.employee employee
          ON employee.employee_id = ka.employee_id
        LEFT JOIN LATERAL (
          SELECT eah.store_id, eah.region_id, eah.position_id
          FROM ops.employee_assignment_history eah
          WHERE eah.employee_id = ka.employee_id
            AND eah.assignment_status = 'active'
          ORDER BY eah.is_primary_assignment DESC, eah.start_date DESC
          LIMIT 1
        ) assignment ON TRUE
        LEFT JOIN ops.position position
          ON position.position_id = assignment.position_id
        LEFT JOIN ops.store store
          ON store.store_id = COALESCE(ka.store_id, assignment.store_id)
        LEFT JOIN ops.region region
          ON region.region_id = COALESCE(ka.region_id, assignment.region_id, store.region_id)
        LEFT JOIN LATERAL (
          SELECT SUM(net_ka.actual_value)::numeric AS store_net_sales_value
          FROM ops.kpi_actual net_ka
          INNER JOIN ops.kpi_definition net_kd
            ON net_kd.kpi_id = net_ka.kpi_id
           AND net_kd.kpi_code = 'NET_SALES'
          WHERE net_ka.scope_type = 'employee'
            AND net_ka.store_id = store.store_id
            AND net_ka.period_type = ka.period_type
            AND net_ka.period_start = ka.period_start
            AND net_ka.period_end = ka.period_end
            AND COALESCE(net_ka.source_type, '') <> 'demo_seed'
        ) store_sales ON TRUE
        LEFT JOIN LATERAL (
          SELECT SUM(net_ka.actual_value)::numeric AS net_sales_value
          FROM ops.kpi_actual net_ka
          INNER JOIN ops.kpi_definition net_kd
            ON net_kd.kpi_id = net_ka.kpi_id
           AND net_kd.kpi_code = 'NET_SALES'
          WHERE net_ka.scope_type = 'employee'
            AND net_ka.employee_id = ka.employee_id
            AND net_ka.period_type = ka.period_type
            AND net_ka.period_start = ka.period_start
            AND net_ka.period_end = ka.period_end
            AND COALESCE(net_ka.source_type, '') <> 'demo_seed'
        ) employee_sales ON TRUE
        LEFT JOIN ops.personnel_target_reference ptr
          ON ptr.employee_id = ka.employee_id
         AND ptr.period_start <= ka.period_start
         AND ptr.period_end >= ka.period_end
         AND ptr.target_type = 'monthly_sales_target'
         AND ptr.status = 'approved'
         AND kd.kpi_code IN ('TARGET_ACHIEVEMENT', 'NET_SALES', 'STORE_SALES', 'SALES_TARGET_ACHIEVEMENT')
        LEFT JOIN LATERAL (
          SELECT
            ua.user_id::text AS user_id,
            COALESCE(
              NULLIF(TRIM(CONCAT(manager_employee.first_name, ' ', manager_employee.last_name)), ''),
              ua.username,
              ua.email,
              ua.user_id::text
            ) AS display_name
          FROM ops.user_role_assignment ura
          INNER JOIN ops.role role
            ON role.role_id = ura.role_id
           AND role.role_code = 'REGION_MANAGER'
          INNER JOIN ops.user_account ua
            ON ua.user_id = ura.user_id
           AND ua.is_active = TRUE
          LEFT JOIN ops.employee manager_employee
            ON manager_employee.employee_id = ua.employee_id
          WHERE ura.region_id = COALESCE(ka.region_id, assignment.region_id, store.region_id)
            AND ura.start_at <= NOW()
            AND (ura.end_at IS NULL OR ura.end_at >= NOW())
          ORDER BY ua.username ASC, ua.user_id ASC
          LIMIT 1
        ) region_manager ON TRUE
        WHERE ${clauses.join(" AND ")}
        ORDER BY employee.last_name ASC, employee.first_name ASC, ka.employee_id ASC, kd.kpi_code ASC
      `,
      params,
    );

    return result.rows;
  }

  async listRankingFilterOptions(input: {
    companyIds: string[];
    periodType: string;
    periodStart: string;
    periodEnd: string;
  }): Promise<{
    regionManagers: Array<{ id: string; label: string }>;
    regions: Array<{ id: string; label: string }>;
    stores: Array<{ id: string; label: string }>;
  }> {
    const params: unknown[] = [
      input.periodType,
      input.periodStart,
      input.periodEnd,
    ];
    const companyClause =
      input.companyIds.length > 0
        ? (() => {
            params.push(input.companyIds);
            return `AND store.company_id = ANY($${params.length}::uuid[])`;
          })()
        : "";
    const regionManagerParams =
      input.companyIds.length > 0 ? [input.companyIds] : [];

    const regionManagers = await this.databaseService.query<{
      id: string;
      label: string;
    }>(
      `
        SELECT DISTINCT
          ua.user_id::text AS id,
          COALESCE(
            NULLIF(TRIM(CONCAT(employee.first_name, ' ', employee.last_name)), ''),
            ua.username,
            ua.email,
            ua.user_id::text
          ) AS label
        FROM ops.user_role_assignment ura
        INNER JOIN ops.role role
          ON role.role_id = ura.role_id
         AND role.role_code = 'REGION_MANAGER'
        INNER JOIN ops.user_account ua
          ON ua.user_id = ura.user_id
         AND ua.is_active = TRUE
        LEFT JOIN ops.employee employee
          ON employee.employee_id = ua.employee_id
        LEFT JOIN ops.region region
          ON region.region_id = ura.region_id
        WHERE ura.start_at <= NOW()
          AND (ura.end_at IS NULL OR ura.end_at >= NOW())
          ${
            input.companyIds.length > 0
              ? `AND (ura.company_id = ANY($1::uuid[]) OR region.company_id = ANY($1::uuid[]))`
              : ""
          }
        ORDER BY label ASC
      `,
      regionManagerParams,
    );

    const regions = await this.databaseService.query<{ id: string; label: string }>(
      `
        SELECT DISTINCT
          region.region_id::text AS id,
          region.region_name AS label
        FROM ops.kpi_actual ka
        LEFT JOIN ops.store store
          ON store.store_id = ka.store_id
        LEFT JOIN ops.region region
          ON region.region_id = COALESCE(ka.region_id, store.region_id)
        WHERE ka.period_type = $1
          AND ka.period_start = $2::date
          AND ka.period_end = $3::date
          AND store.kpi_import_enabled = TRUE
          AND COALESCE(ka.source_type, '') <> 'demo_seed'
          AND region.region_id IS NOT NULL
          ${companyClause}
        ORDER BY label ASC
      `,
      params,
    );

    const stores = await this.databaseService.query<{ id: string; label: string }>(
      `
        SELECT DISTINCT
          store.store_id::text AS id,
          store.store_name AS label
        FROM ops.kpi_actual ka
        INNER JOIN ops.store store
          ON store.store_id = ka.store_id
        WHERE ka.period_type = $1
          AND ka.period_start = $2::date
          AND ka.period_end = $3::date
          AND store.kpi_import_enabled = TRUE
          AND COALESCE(ka.source_type, '') <> 'demo_seed'
          ${companyClause}
        ORDER BY label ASC
      `,
      params,
    );

    return {
      regionManagers: regionManagers.rows,
      regions: regions.rows,
      stores: stores.rows,
    };
  }
}
