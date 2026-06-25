import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../../../shared/database/database.service";

type ActiveEmployeeAssignmentScopeRow = {
  employee_id: string;
  external_employee_ref: string | null;
  first_name: string;
  last_name: string;
  company_id: string | null;
  region_id: string | null;
  region_name: string | null;
  store_id: string | null;
  store_name: string | null;
};

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

  async getActiveEmployeeAssignmentScope(
    employeeId: string,
  ): Promise<ActiveEmployeeAssignmentScopeRow | null> {
    const rows = await this.getActiveEmployeeAssignmentScopes([employeeId]);

    return rows[0] ?? null;
  }

  async getActiveEmployeeAssignmentScopes(
    employeeIds: string[],
  ): Promise<ActiveEmployeeAssignmentScopeRow[]> {
    if (employeeIds.length === 0) {
      return [];
    }

    const result = await this.databaseService.query<ActiveEmployeeAssignmentScopeRow>(
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
        WHERE e.employee_id = ANY($1::uuid[])
        ORDER BY e.employee_id ASC
      `,
      [employeeIds],
    );

    return result.rows;
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
      region_id: string | null;
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
          store.region_id::text AS region_id,
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
      region_id: string | null;
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
          store.region_id::text AS region_id,
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

}
