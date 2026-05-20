import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../../../shared/database/database.service";

@Injectable()
export class ReportingRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  private hasStoreAccessScope(input: {
    companyIds: string[];
    regionIds: string[];
    storeIds: string[];
    allowGlobalScope?: boolean;
  }) {
    return (
      input.allowGlobalScope === true ||
      input.companyIds.length > 0 ||
      input.regionIds.length > 0 ||
      input.storeIds.length > 0
    );
  }

  async getEmployeeIdForUser(userId: string) {
    const result = await this.databaseService.query<{ employee_id: string | null }>(
      `
        SELECT employee_id
        FROM ops.user_account
        WHERE user_id = $1::uuid
      `,
      [userId],
    );

    return result.rows[0]?.employee_id ?? null;
  }

  async resolveEmployeeIdForAuthIdentity(input: {
    userId: string;
    employeeId?: string;
    companyIds: string[];
  }) {
    const employeeClaim = input.employeeId?.trim();

    if (employeeClaim) {
      if (this.isUuid(employeeClaim)) {
        return employeeClaim;
      }

      const resolvedByExternalRef = await this.getEmployeeIdByExternalRef({
        externalEmployeeRef: employeeClaim,
        companyIds: input.companyIds,
      });

      if (resolvedByExternalRef) {
        return resolvedByExternalRef;
      }
    }

    if (!this.isUuid(input.userId)) {
      return null;
    }

    return this.getEmployeeIdForUser(input.userId);
  }

  async getActiveEmployeeAssignmentScope(employeeId: string) {
    const result = await this.databaseService.query<{
      employee_id: string;
      external_employee_ref: string | null;
      first_name: string;
      last_name: string;
      company_id: string | null;
      region_id: string | null;
      region_name: string | null;
      store_id: string | null;
      store_name: string | null;
    }>(
      `
        SELECT
          e.employee_id,
          e.external_employee_ref,
          e.first_name,
          e.last_name,
          COALESCE(store.company_id, e.company_id)::text AS company_id,
          store.region_id::text AS region_id,
          region.region_name,
          assignment.store_id::text AS store_id,
          store.store_name
        FROM ops.employee e
        LEFT JOIN LATERAL (
          SELECT eah.store_id
          FROM ops.employee_assignment_history eah
          WHERE eah.employee_id = e.employee_id
            AND eah.assignment_status = 'active'
          ORDER BY eah.start_date DESC
          LIMIT 1
        ) assignment ON TRUE
        LEFT JOIN ops.store store
          ON store.store_id = assignment.store_id
        LEFT JOIN ops.region region
          ON region.region_id = store.region_id
        WHERE e.employee_id = $1::uuid
        LIMIT 1
      `,
      [employeeId],
    );

    return result.rows[0] ?? null;
  }

  async getEmployeeIdByExternalRef(input: {
    externalEmployeeRef: string;
    companyIds: string[];
  }) {
    if (input.companyIds.length === 0) {
      return null;
    }

    const params: unknown[] = [input.externalEmployeeRef];
    const clauses = [`external_employee_ref = $1`];

    if (input.companyIds.length > 0) {
      params.push(input.companyIds);
      clauses.push(`company_id = ANY($${params.length}::uuid[])`);
    }

    const result = await this.databaseService.query<{ employee_id: string }>(
      `
        SELECT employee_id
        FROM ops.employee
        WHERE ${clauses.join(" AND ")}
        ORDER BY created_at DESC, employee_id ASC
        LIMIT 1
      `,
      params,
    );

    return result.rows[0]?.employee_id ?? null;
  }

  private isUuid(value: string) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    );
  }

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
      target_value: string | null;
    }>(
      `
        SELECT
          store.store_id,
          store.store_name,
          kd.kpi_code,
          kd.kpi_name,
          ka.actual_value::text AS actual_value,
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
    periodType: string;
    periodStart: string;
    periodEnd: string;
    companyId?: string;
  }) {
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
      `,
      params,
    );

    return result.rows;
  }

  async getEmployeeTurkeyBenchmarkValues(input: {
    periodStart: string;
    periodEnd: string;
    companyId?: string;
    periodType?: string;
  }) {
    const params: unknown[] = [input.periodStart, input.periodEnd];
    const clauses = [
      `ka.scope_type = 'employee'`,
      `ka.period_start >= $1::date`,
      `ka.period_end <= $2::date`,
      `kd.kpi_code IN ('ATV', 'UPT')`,
      `COALESCE(ka.source_type, '') <> 'demo_seed'`,
    ];

    if (input.periodType) {
      params.push(input.periodType);
      clauses.push(`ka.period_type = $${params.length}`);
    }

    if (input.companyId) {
      params.push(input.companyId);
      clauses.push(`ka.company_id = $${params.length}::uuid`);
    }

    const result = await this.databaseService.query<{
      kpi_code: string;
      benchmark_value: string | null;
    }>(
      `
        SELECT
          kd.kpi_code,
          AVG(ka.actual_value)::text AS benchmark_value
        FROM ops.kpi_actual ka
        INNER JOIN ops.kpi_definition kd
          ON kd.kpi_id = ka.kpi_id
        WHERE ${clauses.join(" AND ")}
        GROUP BY kd.kpi_code
        ORDER BY kd.kpi_code ASC
      `,
      params,
    );

    return result.rows;
  }

  async getLatestEmployeeKpiPeriod(input: {
    employeeId: string;
    metricCodes: string[];
    companyIds: string[];
    regionIds: string[];
    storeIds: string[];
    allowGlobalScope?: boolean;
    periodType?: string;
    periodStart?: string;
  }) {
    if (!this.hasStoreAccessScope(input)) {
      return null;
    }

    const params: unknown[] = [input.employeeId, input.metricCodes];
    const clauses = [
      `ka.employee_id = $1::uuid`,
      `ka.scope_type = 'employee'`,
      `kd.kpi_code = ANY($2::text[])`,
    ];

    if (input.periodType === "monthly" && input.periodStart) {
      params.push(input.periodType);
      const periodTypeIndex = params.length;
      params.push(input.periodStart);
      const periodStartIndex = params.length;
      clauses.push(
        `(
          (ka.period_type = $${periodTypeIndex} AND ka.period_start = $${periodStartIndex}::date)
          OR (
            ka.period_type = 'custom'
            AND DATE_TRUNC('month', ka.period_start)::date = DATE_TRUNC('month', $${periodStartIndex}::date)::date
          )
        )`,
      );
    } else {
      if (input.periodType) {
        params.push(input.periodType);
        if (input.periodType === "monthly") {
          clauses.push(`(ka.period_type = $${params.length} OR ka.period_type = 'custom')`);
        } else {
          clauses.push(`ka.period_type = $${params.length}`);
        }
      }

      if (input.periodStart) {
        params.push(input.periodStart);
        clauses.push(`ka.period_start = $${params.length}::date`);
      }
    }

    if (input.storeIds.length > 0) {
      params.push(input.storeIds);
      clauses.push(
        `COALESCE(ka.store_id, assignment.store_id) = ANY($${params.length}::uuid[])`,
      );
    } else if (input.regionIds.length > 0) {
      params.push(input.regionIds);
      clauses.push(
        `COALESCE(ka.region_id, assignment.region_id, store.region_id) = ANY($${params.length}::uuid[])`,
      );
    } else if (input.companyIds.length > 0) {
      params.push(input.companyIds);
      clauses.push(
        `COALESCE(ka.company_id, store.company_id, employee.company_id) = ANY($${params.length}::uuid[])`,
      );
    }

    const result = await this.databaseService.query<{
      period_type: string;
      period_start: string;
      period_end: string;
      store_id: string | null;
    }>(
      `
        SELECT
          ka.period_type,
          ka.period_start::text AS period_start,
          ka.period_end::text AS period_end,
          COALESCE(ka.store_id, assignment.store_id)::text AS store_id
        FROM ops.kpi_actual ka
        INNER JOIN ops.kpi_definition kd
          ON kd.kpi_id = ka.kpi_id
        INNER JOIN ops.employee employee
          ON employee.employee_id = ka.employee_id
        LEFT JOIN LATERAL (
          SELECT eah.store_id, eah.region_id
          FROM ops.employee_assignment_history eah
          WHERE eah.employee_id = ka.employee_id
            AND eah.assignment_status = 'active'
          ORDER BY eah.is_primary_assignment DESC, eah.start_date DESC
          LIMIT 1
        ) assignment ON TRUE
        LEFT JOIN ops.store store
          ON store.store_id = COALESCE(ka.store_id, assignment.store_id)
        WHERE ${clauses.join(" AND ")}
        ORDER BY ka.period_end DESC, ka.period_start DESC
        LIMIT 1
      `,
      params,
    );

    return result.rows[0] ?? null;
  }

  async listEmployeeKpiPeriods(input: {
    employeeId: string;
    metricCodes: string[];
    companyIds: string[];
    regionIds: string[];
    storeIds: string[];
    allowGlobalScope?: boolean;
  }) {
    if (!this.hasStoreAccessScope(input)) {
      return [];
    }

    const params: unknown[] = [input.employeeId, input.metricCodes];
    const clauses = [
      `ka.employee_id = $1::uuid`,
      `ka.scope_type = 'employee'`,
      `kd.kpi_code = ANY($2::text[])`,
    ];

    if (input.storeIds.length > 0) {
      params.push(input.storeIds);
      clauses.push(
        `COALESCE(ka.store_id, assignment.store_id) = ANY($${params.length}::uuid[])`,
      );
    } else if (input.regionIds.length > 0) {
      params.push(input.regionIds);
      clauses.push(
        `COALESCE(ka.region_id, assignment.region_id, store.region_id) = ANY($${params.length}::uuid[])`,
      );
    } else if (input.companyIds.length > 0) {
      params.push(input.companyIds);
      clauses.push(
        `COALESCE(ka.company_id, store.company_id, employee.company_id) = ANY($${params.length}::uuid[])`,
      );
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
        INNER JOIN ops.employee employee
          ON employee.employee_id = ka.employee_id
        LEFT JOIN LATERAL (
          SELECT eah.store_id, eah.region_id
          FROM ops.employee_assignment_history eah
          WHERE eah.employee_id = ka.employee_id
            AND eah.assignment_status = 'active'
          ORDER BY eah.is_primary_assignment DESC, eah.start_date DESC
          LIMIT 1
        ) assignment ON TRUE
        LEFT JOIN ops.store store
          ON store.store_id = COALESCE(ka.store_id, assignment.store_id)
        WHERE ${clauses.join(" AND ")}
        ORDER BY 3 DESC, 2 DESC
      `,
      params,
    );

    return result.rows;
  }

  async getEmployeePerformanceRows(input: {
    employeeId: string;
    metricCodes: string[];
    periodStart: string;
    periodEnd: string;
  }) {
    const result = await this.databaseService.query<{
      employee_id: string;
      first_name: string;
      last_name: string;
      store_id: string | null;
      store_name: string | null;
      kpi_code: string;
      kpi_name: string;
      target_value: string | null;
      personnel_target_reference_id: string | null;
      actual_value: string;
    }>(
      `
        SELECT
          e.employee_id,
          e.first_name,
          e.last_name,
          assignment.store_id,
          store.store_name,
          kd.kpi_code,
          kd.kpi_name,
          ptr.target_value::text AS target_value,
          ptr.personnel_target_reference_id::text AS personnel_target_reference_id,
          ka.actual_value::text AS actual_value
        FROM ops.kpi_actual ka
        INNER JOIN ops.kpi_definition kd
          ON kd.kpi_id = ka.kpi_id
        LEFT JOIN ops.personnel_target_reference ptr
          ON ptr.employee_id = ka.employee_id
         AND ptr.period_start <= ka.period_start
         AND ptr.period_end >= ka.period_end
         AND ptr.target_type = 'monthly_sales_target'
         AND ptr.status = 'approved'
         AND kd.kpi_code IN ('TARGET_ACHIEVEMENT', 'NET_SALES', 'STORE_SALES', 'SALES_TARGET_ACHIEVEMENT')
        INNER JOIN ops.employee e
          ON e.employee_id = ka.employee_id
        LEFT JOIN LATERAL (
          SELECT eah.store_id
          FROM ops.employee_assignment_history eah
          WHERE eah.employee_id = e.employee_id
            AND eah.assignment_status = 'active'
          ORDER BY eah.start_date DESC
          LIMIT 1
        ) assignment ON TRUE
        LEFT JOIN ops.store store
          ON store.store_id = assignment.store_id
        WHERE ka.employee_id = $1::uuid
          AND ka.scope_type = 'employee'
          AND kd.kpi_code = ANY($2::text[])
          AND ka.period_start = $3::date
          AND ka.period_end = $4::date
        ORDER BY kd.kpi_code ASC
      `,
      [input.employeeId, input.metricCodes, input.periodStart, input.periodEnd],
    );

    return result.rows;
  }

  async getPeerEmployeePerformanceRows(input: {
    metricCodes: string[];
    companyId?: string;
    storeId?: string | null;
    periodStart: string;
    periodEnd: string;
  }) {
    const params: unknown[] = [input.metricCodes, input.periodStart, input.periodEnd];
    const clauses = [
      `ka.scope_type = 'employee'`,
      `kd.kpi_code = ANY($1::text[])`,
      `ka.period_start = $2::date`,
      `ka.period_end = $3::date`,
    ];

    if (input.companyId) {
      params.push(input.companyId);
      clauses.push(`ka.company_id = $${params.length}::uuid`);
    }

    if (input.storeId) {
      params.push(input.storeId);
      clauses.push(`ka.store_id = $${params.length}::uuid`);
    }

    const result = await this.databaseService.query<{
      employee_id: string;
      first_name: string;
      last_name: string;
      store_id: string | null;
      store_name: string | null;
      kpi_code: string;
      kpi_name: string;
      target_value: string | null;
      personnel_target_reference_id: string | null;
      actual_value: string;
    }>(
      `
        SELECT
          ka.employee_id,
          e.first_name,
          e.last_name,
          ka.store_id,
          store.store_name,
          kd.kpi_code,
          kd.kpi_name,
          ptr.target_value::text AS target_value,
          ptr.personnel_target_reference_id::text AS personnel_target_reference_id,
          ka.actual_value::text AS actual_value
        FROM ops.kpi_actual ka
        INNER JOIN ops.kpi_definition kd
          ON kd.kpi_id = ka.kpi_id
        INNER JOIN ops.employee e
          ON e.employee_id = ka.employee_id
        LEFT JOIN ops.store store
          ON store.store_id = ka.store_id
        LEFT JOIN ops.personnel_target_reference ptr
          ON ptr.employee_id = ka.employee_id
         AND ptr.period_start <= ka.period_start
         AND ptr.period_end >= ka.period_end
         AND ptr.target_type = 'monthly_sales_target'
         AND ptr.status = 'approved'
         AND kd.kpi_code IN ('TARGET_ACHIEVEMENT', 'NET_SALES', 'STORE_SALES', 'SALES_TARGET_ACHIEVEMENT')
        WHERE ${clauses.join(" AND ")}
        ORDER BY ka.employee_id ASC, kd.kpi_code ASC
      `,
      params,
    );

    return result.rows;
  }

  async getLatestMonthlyRankingPeriod(input: {
    metricCodes: string[];
    periodStart?: string;
  }) {
    if (input.metricCodes.length === 0) {
      return null;
    }

    const params: unknown[] = [input.metricCodes];
    const clauses = [
      `ka.period_type = 'monthly'`,
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
        WHERE ka.period_type = 'monthly'
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
          SELECT eah.store_id, eah.region_id
          FROM ops.employee_assignment_history eah
          WHERE eah.employee_id = ka.employee_id
            AND eah.assignment_status = 'active'
          ORDER BY eah.is_primary_assignment DESC, eah.start_date DESC
          LIMIT 1
        ) assignment ON TRUE
        LEFT JOIN ops.store store
          ON store.store_id = COALESCE(ka.store_id, assignment.store_id)
        LEFT JOIN ops.region region
          ON region.region_id = COALESCE(ka.region_id, assignment.region_id, store.region_id)
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
