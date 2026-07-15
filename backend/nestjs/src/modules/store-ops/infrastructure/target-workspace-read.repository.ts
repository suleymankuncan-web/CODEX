import { Injectable } from "@nestjs/common";
import type { AuthReadScope } from "../../auth/auth-context.service";
import { DatabaseService } from "../../../shared/database/database.service";

export type TargetWorkspaceStoreRow = {
  company_id: string;
  company_name: string | null;
  region_id: string;
  region_name: string | null;
  region_manager_name: string | null;
  store_id: string;
  store_code: string;
  store_name: string;
  store_status: string;
  request_id: string | null;
  request_status: string | null;
  target_label: string | null;
  total_target_value: string | null;
  allocation_count: number | null;
  request_reason: string | null;
  allocation_json: unknown;
  approved_at: string | null;
  approval_note: string | null;
  approval_evidence_json: unknown;
  created_at: string | null;
  updated_at: string | null;
  has_revision_conflict: boolean;
  has_stale_reference: boolean;
};

export type TargetWorkspacePersonnelRow = {
  store_id: string;
  employee_id: string;
  display_name: string;
  position_code: string;
  position_name: string;
};

export type TargetWorkspaceMonthStatusRow = {
  store_id: string;
  request_month: string;
  request_status: string | null;
  approval_evidence_json: unknown;
  approved_source_count: number;
  approved_source_status: string | null;
  approved_source_evidence_json: unknown;
};

export type TargetWorkspaceHierarchyRow = {
  company_id: string;
  company_name: string | null;
  region_id: string | null;
  region_name: string | null;
  manager_assignment_exists: boolean;
  region_manager_name: string | null;
};

@Injectable()
export class TargetWorkspaceReadRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async listHierarchy(input: { scope: AuthReadScope; periodEnd: string }) {
    const scoped = scopeClause(input.scope, "store");
    const periodEndIndex = scoped.params.length + 1;
    const usesScopedStores = input.scope.storeIds.length > 0 || input.scope.regionIds.length > 0;
    const hierarchySource = usesScopedStores
      ? `
          WITH hierarchy_scope AS (
            SELECT DISTINCT store.company_id, store.region_id
            FROM ops.store store
            WHERE ${scoped.sql}
          )
          SELECT
            company.company_id::text AS company_id,
            company.company_name,
            region.region_id::text AS region_id,
            region.region_name,
            COALESCE(region_manager.assignment_exists, FALSE) AS manager_assignment_exists,
            region_manager.display_name AS region_manager_name
          FROM hierarchy_scope hierarchy
          INNER JOIN ops.company company ON company.company_id = hierarchy.company_id
          INNER JOIN ops.region region ON region.region_id = hierarchy.region_id
        `
      : `
          SELECT
            company.company_id::text AS company_id,
            company.company_name,
            region.region_id::text AS region_id,
            region.region_name,
            COALESCE(region_manager.assignment_exists, FALSE) AS manager_assignment_exists,
            region_manager.display_name AS region_manager_name
          FROM ops.company company
          LEFT JOIN ops.region region ON region.company_id = company.company_id
        `;
    const companyFilter = usesScopedStores
      ? ""
      : `WHERE company.company_id = ANY($1::uuid[])`;
    const params = usesScopedStores ? [...scoped.params, input.periodEnd] : [input.scope.companyIds, input.periodEnd];
    const managerPeriodIndex = usesScopedStores ? periodEndIndex : 2;
    const result = await this.databaseService.query<TargetWorkspaceHierarchyRow>(
      `
        ${hierarchySource}
        LEFT JOIN LATERAL (
          SELECT
            TRUE AS assignment_exists,
            NULLIF(TRIM(CONCAT(employee.first_name, ' ', employee.last_name)), '') AS display_name
          FROM ops.user_role_assignment role_assignment
          INNER JOIN ops.role role ON role.role_id = role_assignment.role_id
            AND role.role_code = 'REGION_MANAGER'
          INNER JOIN ops.user_account account ON account.user_id = role_assignment.user_id
          LEFT JOIN ops.employee employee ON employee.employee_id = account.employee_id
          WHERE role_assignment.region_id = region.region_id
            AND role_assignment.start_at <= ((($${managerPeriodIndex}::date + INTERVAL '1 day') AT TIME ZONE 'Europe/Istanbul') - INTERVAL '1 microsecond')
            AND (role_assignment.end_at IS NULL OR role_assignment.end_at >= ((($${managerPeriodIndex}::date + INTERVAL '1 day') AT TIME ZONE 'Europe/Istanbul') - INTERVAL '1 microsecond'))
          ORDER BY display_name ASC NULLS LAST, role_assignment.start_at DESC, role_assignment.user_role_assignment_id DESC
          LIMIT 1
        ) region_manager ON TRUE
        ${companyFilter}
        ORDER BY company.company_name ASC NULLS LAST, region.region_name ASC NULLS LAST,
          company.company_id ASC, region.region_id ASC NULLS LAST
      `,
      params,
    );
    return result.rows;
  }

  async summarizeScope(input: { scope: AuthReadScope; periodStart: string }) {
    const scoped = scopeClause(input.scope, "store");
    const periodIndex = scoped.params.length + 1;
    const result = await this.databaseService.query<{
      total_stores: string;
      pending_stores: string;
      approved_stores: string;
      adjusted_approved_stores: string;
      returned_stores: string;
      missing_stores: string;
      total_target_value: string;
    }>(
      `
        WITH scoped_store AS (
          SELECT store.store_id
          FROM ops.store store
          WHERE ${scoped.sql}
        ),
        latest_request AS (
          SELECT DISTINCT ON (request.store_id)
            request.store_id,
            request.request_status,
            request.total_target_value,
            request.approval_evidence_json
          FROM ops.target_distribution_request request
          INNER JOIN scoped_store ON scoped_store.store_id = request.store_id
          WHERE request.request_month = $${periodIndex}::date
          ORDER BY request.store_id, request.updated_at DESC,
            request.created_at DESC, request.target_distribution_request_id DESC
        )
        SELECT
          COUNT(*)::text AS total_stores,
          COUNT(*) FILTER (WHERE latest_request.request_status = 'pending_region_approval')::text AS pending_stores,
          COUNT(*) FILTER (
            WHERE latest_request.request_status = 'approved'
              AND NOT (
                COALESCE(jsonb_typeof(latest_request.approval_evidence_json), 'null') = 'object'
                AND latest_request.approval_evidence_json ->> 'approvalMode' = 'adjusted'
                AND latest_request.approval_evidence_json ?& ARRAY[
                  'originalTotalTargetValue', 'approvedTotalTargetValue',
                  'originalAllocations', 'approvedAllocations'
                ]
                AND jsonb_typeof(latest_request.approval_evidence_json -> 'originalAllocations') = 'array'
                AND jsonb_typeof(latest_request.approval_evidence_json -> 'approvedAllocations') = 'array'
              )
          )::text AS approved_stores,
          COUNT(*) FILTER (
            WHERE latest_request.request_status = 'approved'
              AND COALESCE(jsonb_typeof(latest_request.approval_evidence_json), 'null') = 'object'
              AND latest_request.approval_evidence_json ->> 'approvalMode' = 'adjusted'
              AND latest_request.approval_evidence_json ?& ARRAY[
                'originalTotalTargetValue', 'approvedTotalTargetValue',
                'originalAllocations', 'approvedAllocations'
              ]
              AND jsonb_typeof(latest_request.approval_evidence_json -> 'originalAllocations') = 'array'
              AND jsonb_typeof(latest_request.approval_evidence_json -> 'approvedAllocations') = 'array'
          )::text AS adjusted_approved_stores,
          COUNT(*) FILTER (WHERE latest_request.request_status = 'rejected')::text AS returned_stores,
          COUNT(*) FILTER (WHERE latest_request.store_id IS NULL)::text AS missing_stores,
          COALESCE(SUM(latest_request.total_target_value), 0)::text AS total_target_value
        FROM scoped_store
        LEFT JOIN latest_request ON latest_request.store_id = scoped_store.store_id
      `,
      [...scoped.params, input.periodStart],
    );
    const row = result.rows[0];
    return {
      totalStores: Number(row?.total_stores ?? 0),
      pendingStores: Number(row?.pending_stores ?? 0),
      approvedStores: Number(row?.approved_stores ?? 0),
      adjustedApprovedStores: Number(row?.adjusted_approved_stores ?? 0),
      returnedStores: Number(row?.returned_stores ?? 0),
      missingStores: Number(row?.missing_stores ?? 0),
      totalTargetValue: row?.total_target_value ?? "0",
    };
  }

  async listStorePage(input: {
    scope: AuthReadScope;
    periodStart: string;
    periodEnd: string;
    limit: number;
    offset: number;
  }) {
    const scoped = scopeClause(input.scope, "store");
    const countResult = await this.databaseService.query<{ total_count: string }>(
      `SELECT COUNT(*)::text AS total_count FROM ops.store store WHERE ${scoped.sql}`,
      scoped.params,
    );
    const periodStartIndex = scoped.params.length + 1;
    const periodEndIndex = scoped.params.length + 2;
    const limitIndex = scoped.params.length + 3;
    const offsetIndex = scoped.params.length + 4;
    const result = await this.databaseService.query<TargetWorkspaceStoreRow>(
      `
        SELECT
          store.company_id::text AS company_id,
          company.company_name,
          store.region_id::text AS region_id,
          region.region_name,
          region_manager.display_name AS region_manager_name,
          store.store_id::text AS store_id,
          store.store_code,
          store.store_name,
          store.status AS store_status,
          latest_request.target_distribution_request_id::text AS request_id,
          latest_request.request_status,
          latest_request.target_label,
          latest_request.total_target_value::text AS total_target_value,
          latest_request.allocation_count,
          latest_request.request_reason,
          latest_request.allocation_json,
          latest_request.approved_at,
          latest_request.approval_note,
          latest_request.approval_evidence_json,
          latest_request.created_at,
          latest_request.updated_at,
          COALESCE(integrity.has_revision_conflict, FALSE) AS has_revision_conflict,
          COALESCE(integrity.has_stale_reference, FALSE) AS has_stale_reference
        FROM ops.store store
        LEFT JOIN ops.company company ON company.company_id = store.company_id
        LEFT JOIN ops.region region ON region.region_id = store.region_id
        LEFT JOIN LATERAL (
          SELECT NULLIF(TRIM(CONCAT(employee.first_name, ' ', employee.last_name)), '') AS display_name
          FROM ops.user_role_assignment role_assignment
          INNER JOIN ops.role role ON role.role_id = role_assignment.role_id
            AND role.role_code = 'REGION_MANAGER'
          INNER JOIN ops.user_account account ON account.user_id = role_assignment.user_id
          LEFT JOIN ops.employee employee ON employee.employee_id = account.employee_id
          WHERE role_assignment.region_id = store.region_id
            AND role_assignment.start_at <= ((($${periodEndIndex}::date + INTERVAL '1 day') AT TIME ZONE 'Europe/Istanbul') - INTERVAL '1 microsecond')
            AND (role_assignment.end_at IS NULL OR role_assignment.end_at >= ((($${periodEndIndex}::date + INTERVAL '1 day') AT TIME ZONE 'Europe/Istanbul') - INTERVAL '1 microsecond'))
          ORDER BY display_name ASC NULLS LAST, role_assignment.start_at DESC, role_assignment.user_role_assignment_id DESC
          LIMIT 1
        ) region_manager ON TRUE
        LEFT JOIN LATERAL (
          SELECT request.*
          FROM ops.target_distribution_request request
          WHERE request.store_id = store.store_id
            AND request.request_month = $${periodStartIndex}::date
          ORDER BY request.updated_at DESC, request.created_at DESC, request.target_distribution_request_id DESC
          LIMIT 1
        ) latest_request ON TRUE
        LEFT JOIN LATERAL (
          SELECT
            EXISTS (
              SELECT 1
              FROM jsonb_array_elements(
                CASE
                  WHEN jsonb_typeof(latest_request.allocation_json) = 'array' THEN latest_request.allocation_json
                  ELSE '[]'::jsonb
                END
              ) allocation(value)
              INNER JOIN ops.personnel_target_reference reference
                ON reference.employee_id::text = LOWER(allocation.value ->> 'employeeId')
                AND reference.store_id = store.store_id
                AND reference.period_start = latest_request.request_month
                AND reference.period_end = (latest_request.request_month + INTERVAL '1 month' - INTERVAL '1 day')::date
                AND reference.target_type = 'monthly_sales_target'
                AND reference.status = 'approved'
              WHERE latest_request.request_status = 'pending_region_approval'
            ) AS has_revision_conflict,
            EXISTS (
              SELECT 1
              FROM ops.employee_assignment_history assignment
              INNER JOIN ops.personnel_target_reference reference
                ON reference.employee_id = assignment.employee_id
                AND reference.store_id <> store.store_id
                AND reference.period_start = $${periodStartIndex}::date
                AND reference.period_end = ($${periodStartIndex}::date + INTERVAL '1 month' - INTERVAL '1 day')::date
                AND reference.target_type = 'monthly_sales_target'
                AND reference.status = 'approved'
              WHERE assignment.store_id = store.store_id
                AND assignment.start_date <= $${periodEndIndex}::date
                AND (assignment.end_date IS NULL OR assignment.end_date >= $${periodEndIndex}::date)
            ) AS has_stale_reference
        ) integrity ON TRUE
        WHERE ${scoped.sql}
        ORDER BY company.company_name ASC NULLS LAST, region.region_name ASC NULLS LAST, store.store_name ASC, store.store_id ASC
        LIMIT $${limitIndex}::int OFFSET $${offsetIndex}::int
      `,
      [...scoped.params, input.periodStart, input.periodEnd, input.limit, input.offset],
    );
    return {
      items: result.rows,
      total: Number(countResult.rows[0]?.total_count ?? 0),
      limit: input.limit,
      offset: input.offset,
    };
  }

  async listPersonnel(input: { storeIds: string[]; periodEnd: string }) {
    if (input.storeIds.length === 0) return [];
    const result = await this.databaseService.query<TargetWorkspacePersonnelRow>(
      `
        SELECT DISTINCT ON (assignment.store_id, assignment.employee_id)
          assignment.store_id::text AS store_id,
          employee.employee_id::text AS employee_id,
          COALESCE(NULLIF(TRIM(CONCAT(employee.first_name, ' ', employee.last_name)), ''), 'Kayıt sahibi bilgisi yok') AS display_name,
          position.position_code,
          position.position_name
        FROM ops.employee_assignment_history assignment
        INNER JOIN ops.employee employee ON employee.employee_id = assignment.employee_id
        INNER JOIN ops.position position ON position.position_id = assignment.position_id
          AND position.position_code NOT IN ('STORE_MANAGER', 'CASHIER')
        WHERE assignment.store_id = ANY($1::uuid[])
          AND assignment.start_date <= $2::date
          AND (assignment.end_date IS NULL OR assignment.end_date >= $2::date)
          AND assignment.is_primary_assignment = TRUE
          AND employee.hire_date <= $2::date
          AND (employee.termination_date IS NULL OR employee.termination_date >= $2::date)
        ORDER BY assignment.store_id, assignment.employee_id,
          assignment.start_date DESC, assignment.assignment_id DESC
      `,
      [input.storeIds, input.periodEnd],
    );
    return result.rows;
  }

  async listMonthStatuses(input: { storeIds: string[]; yearStart: string; yearEnd: string }) {
    if (input.storeIds.length === 0) return [];
    const result = await this.databaseService.query<TargetWorkspaceMonthStatusRow>(
      `
        WITH latest_request AS (
          SELECT DISTINCT ON (request.store_id, request.request_month)
            request.store_id,
            request.request_month,
            request.request_status,
            request.approval_evidence_json
          FROM ops.target_distribution_request request
          WHERE request.store_id = ANY($1::uuid[])
            AND request.request_month BETWEEN $2::date AND $3::date
          ORDER BY request.store_id, request.request_month, request.updated_at DESC,
            request.created_at DESC, request.target_distribution_request_id DESC
        ),
        approved_basis AS (
          SELECT
            reference.store_id,
            reference.period_start AS request_month,
            COUNT(DISTINCT reference.source_request_id)::int AS approved_source_count
          FROM ops.personnel_target_reference reference
          INNER JOIN ops.target_distribution_request source_request
            ON source_request.target_distribution_request_id = reference.source_request_id
            AND source_request.request_status = 'approved'
          WHERE reference.store_id = ANY($1::uuid[])
            AND reference.period_start BETWEEN $2::date AND $3::date
            AND reference.period_end = (reference.period_start + INTERVAL '1 month' - INTERVAL '1 day')::date
            AND reference.target_type = 'monthly_sales_target'
            AND reference.status = 'approved'
          GROUP BY reference.store_id, reference.period_start
        ),
        approved_source AS (
          SELECT DISTINCT ON (reference.store_id, reference.period_start)
            reference.store_id,
            reference.period_start AS request_month,
            source_request.request_status AS approved_source_status,
            source_request.approval_evidence_json AS approved_source_evidence_json
          FROM ops.personnel_target_reference reference
          INNER JOIN ops.target_distribution_request source_request
            ON source_request.target_distribution_request_id = reference.source_request_id
            AND source_request.request_status = 'approved'
          WHERE reference.store_id = ANY($1::uuid[])
            AND reference.period_start BETWEEN $2::date AND $3::date
            AND reference.period_end = (reference.period_start + INTERVAL '1 month' - INTERVAL '1 day')::date
            AND reference.target_type = 'monthly_sales_target'
            AND reference.status = 'approved'
          ORDER BY reference.store_id, reference.period_start, reference.approved_at DESC,
            reference.source_request_id DESC
        ),
        month_key AS (
          SELECT store_id, request_month FROM latest_request
          UNION
          SELECT store_id, request_month FROM approved_basis
        )
        SELECT
          month_key.store_id::text AS store_id,
          month_key.request_month,
          latest_request.request_status,
          latest_request.approval_evidence_json,
          COALESCE(approved_basis.approved_source_count, 0)::int AS approved_source_count,
          approved_source.approved_source_status,
          approved_source.approved_source_evidence_json
        FROM month_key
        LEFT JOIN latest_request USING (store_id, request_month)
        LEFT JOIN approved_basis USING (store_id, request_month)
        LEFT JOIN approved_source USING (store_id, request_month)
        ORDER BY month_key.store_id, month_key.request_month
      `,
      [input.storeIds, input.yearStart, input.yearEnd],
    );
    return result.rows;
  }
}

function scopeClause(scope: AuthReadScope, alias: string) {
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (scope.storeIds.length > 0) {
    params.push(scope.storeIds);
    clauses.push(`${alias}.store_id = ANY($${params.length}::uuid[])`);
  }
  if (scope.regionIds.length > 0) {
    params.push(scope.regionIds);
    clauses.push(`${alias}.region_id = ANY($${params.length}::uuid[])`);
  }
  if (scope.companyIds.length > 0) {
    params.push(scope.companyIds);
    clauses.push(`${alias}.company_id = ANY($${params.length}::uuid[])`);
  }
  return { sql: clauses.length > 0 ? clauses.join(" AND ") : "FALSE", params };
}
