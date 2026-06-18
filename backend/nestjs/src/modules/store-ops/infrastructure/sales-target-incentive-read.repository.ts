import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../../../shared/database/database.service";
import type {
  SalesTargetIncentiveInputPositionCode,
  SalesTargetIncentiveStoreOwnershipType,
} from "../application/sales-target-incentive-calculator.service";

export type SalesTargetIncentiveReadScopeInput = {
  companyIds: string[];
  regionIds: string[];
  storeIds: string[];
  allowGlobalScope?: boolean;
  periodStart: string;
  periodEnd: string;
  assignmentAsOfDate: string;
  closeCutoffAt?: string;
};

export type SalesTargetIncentiveStoreSourceRow = {
  company_id: string;
  region_id: string;
  store_id: string;
  store_name: string;
  store_type: SalesTargetIncentiveStoreOwnershipType;
  store_target_request_id: string | null;
  store_target_amount: string | null;
  store_net_sales_amount: string | null;
  store_net_sales_source_batch_id: string | null;
  store_net_sales_import_batch_id: string | null;
  store_net_sales_source_payload_hash: string | null;
  store_net_sales_last_synced_at: string | null;
  manager_employee_id: string | null;
  manager_user_id: string | null;
  manager_assignment_id: string | null;
  manager_assignment_started_on: string | null;
  manager_assignment_ended_on: string | null;
  manager_position_id: string | null;
  manager_first_name: string | null;
  manager_last_name: string | null;
  manager_position_code: "STORE_MANAGER" | null;
};

export type SalesTargetIncentivePersonnelSourceRow = {
  company_id: string;
  region_id: string;
  store_id: string;
  store_name: string;
  store_type: SalesTargetIncentiveStoreOwnershipType;
  store_target_request_id: string | null;
  store_target_amount: string | null;
  store_net_sales_amount: string | null;
  store_net_sales_source_batch_id: string | null;
  store_net_sales_import_batch_id: string | null;
  personnel_target_reference_id: string | null;
  personnel_target_amount: string | null;
  personnel_positive_sales_amount: string | null;
  personnel_sales_source_batch_id: string | null;
  personnel_sales_import_batch_id: string | null;
  personnel_sales_source_payload_hash: string | null;
  personnel_sales_last_synced_at: string | null;
  employee_id: string;
  user_id: string | null;
  assignment_id: string;
  assignment_started_on: string;
  assignment_ended_on: string | null;
  position_id: string;
  first_name: string;
  last_name: string;
  external_employee_ref: string | null;
  position_code: SalesTargetIncentiveInputPositionCode;
};

export type SalesTargetIncentiveCloseBlockingImportRow = {
  import_batch_id: string;
  status: string;
  source_window_started_at: string | null;
  source_window_ended_at: string | null;
};

export type SalesTargetIncentiveCloseBlockingTargetRevisionRow = {
  target_distribution_request_id: string;
  company_id: string;
  region_id: string;
  store_id: string;
  request_status: string;
  updated_at: string | null;
};

@Injectable()
export class SalesTargetIncentiveReadRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async listStoreProjectionSources(input: SalesTargetIncentiveReadScopeInput) {
    const params: unknown[] = [
      input.periodStart,
      input.periodEnd,
      input.assignmentAsOfDate,
    ];
    const closeCutoffClause = this.appendCloseCutoffClause(input, params, "ib");
    const clauses = this.buildStoreScopeClauses(input, params);

    const result =
      await this.databaseService.query<SalesTargetIncentiveStoreSourceRow>(
        `
          WITH scoped_stores AS (
            SELECT
              s.company_id,
              s.region_id,
              s.store_id,
              s.store_name,
              s.store_type
            FROM ops.store s
            WHERE s.status = 'active'
              AND s.store_type = 'company'
              AND ${clauses.join(" AND ")}
          )
          SELECT
            s.company_id::text AS company_id,
            s.region_id::text AS region_id,
            s.store_id::text AS store_id,
            s.store_name,
            s.store_type,
            store_target.target_distribution_request_id::text AS store_target_request_id,
            store_target.total_target_value::text AS store_target_amount,
            store_sales.actual_value::text AS store_net_sales_amount,
            store_sales.source_batch_id AS store_net_sales_source_batch_id,
            store_sales.import_batch_id AS store_net_sales_import_batch_id,
            store_sales.source_payload_hash AS store_net_sales_source_payload_hash,
            store_sales.last_synced_at::text AS store_net_sales_last_synced_at,
            manager.employee_id::text AS manager_employee_id,
            manager_user.user_id::text AS manager_user_id,
            manager.assignment_id::text AS manager_assignment_id,
            manager.start_date::text AS manager_assignment_started_on,
            manager.end_date::text AS manager_assignment_ended_on,
            manager.position_id::text AS manager_position_id,
            manager_employee.first_name AS manager_first_name,
            manager_employee.last_name AS manager_last_name,
            manager.position_code AS manager_position_code
          FROM scoped_stores s
          LEFT JOIN LATERAL (
            SELECT
              tdr.target_distribution_request_id,
              tdr.total_target_value
            FROM ops.target_distribution_request tdr
            WHERE tdr.company_id = s.company_id
              AND tdr.region_id = s.region_id
              AND tdr.store_id = s.store_id
              AND tdr.request_status = 'approved'
              AND tdr.request_month = $1::date
            ORDER BY
              tdr.approved_at DESC NULLS LAST,
              tdr.updated_at DESC,
              tdr.created_at DESC,
              tdr.target_distribution_request_id DESC
            LIMIT 1
          ) store_target ON TRUE
          LEFT JOIN LATERAL (
            SELECT
              eah.employee_id,
              eah.assignment_id,
              eah.start_date,
              eah.end_date,
              eah.position_id,
              p.position_code
            FROM ops.employee_assignment_history eah
            INNER JOIN ops.employee e
              ON e.employee_id = eah.employee_id
             AND e.employment_status = 'active'
            INNER JOIN ops.position p
              ON p.position_id = eah.position_id
             AND p.position_code = 'STORE_MANAGER'
            WHERE eah.store_id = s.store_id
              AND eah.is_primary_assignment = TRUE
              AND eah.start_date <= $3::date
              AND (eah.end_date IS NULL OR eah.end_date >= $3::date)
            ORDER BY eah.start_date DESC, eah.created_at DESC, eah.assignment_id DESC
            LIMIT 1
          ) manager ON TRUE
          LEFT JOIN ops.employee manager_employee
            ON manager_employee.employee_id = manager.employee_id
          LEFT JOIN LATERAL (
            SELECT ua.user_id
            FROM ops.user_account ua
            WHERE ua.employee_id = manager.employee_id
              AND ua.is_active = TRUE
            ORDER BY ua.created_at DESC, ua.user_id DESC
            LIMIT 1
          ) manager_user ON TRUE
          LEFT JOIN LATERAL (
            SELECT
              ka.actual_value,
              ka.source_batch_id,
              ib.import_batch_id::text AS import_batch_id,
              ka.source_payload_hash,
              ka.last_synced_at
            FROM ops.kpi_actual ka
            INNER JOIN ops.kpi_definition kd
              ON kd.kpi_id = ka.kpi_id
             AND kd.kpi_code = 'NET_SALES'
             AND kd.is_active = TRUE
            INNER JOIN stg.import_batch ib
              ON ib.source_batch_id = ka.source_batch_id
             AND ib.entity_type = 'kpi'
             AND ib.status IN ('completed', 'completed_with_errors')
             AND ib.company_ids && ARRAY[s.company_id]::uuid[]
             ${closeCutoffClause}
            WHERE ka.store_id = s.store_id
              AND ka.scope_type = 'store'
              AND ka.period_type = 'monthly'
              AND ka.period_start = $1::date
              AND ka.period_end = $2::date
              AND ka.source_type = 'integration'
              AND COALESCE(ka.source_type, '') <> 'demo_seed'
              AND ka.source_batch_id IS NOT NULL
            ORDER BY ka.last_synced_at DESC, ka.calculated_at DESC, ka.kpi_actual_id DESC
            LIMIT 1
          ) store_sales ON TRUE
          ORDER BY s.store_name ASC, s.store_id ASC
        `,
        params,
      );

    return result.rows;
  }

  async listPersonnelProjectionSources(input: SalesTargetIncentiveReadScopeInput) {
    const params: unknown[] = [
      input.periodStart,
      input.periodEnd,
      input.assignmentAsOfDate,
    ];
    const closeCutoffClause = this.appendCloseCutoffClause(input, params, "ib");
    const clauses = this.buildStoreScopeClauses(input, params);

    const result =
      await this.databaseService.query<SalesTargetIncentivePersonnelSourceRow>(
        `
          WITH scoped_stores AS (
            SELECT
              s.company_id,
              s.region_id,
              s.store_id,
              s.store_name,
              s.store_type
            FROM ops.store s
            WHERE s.status = 'active'
              AND s.store_type = 'company'
              AND ${clauses.join(" AND ")}
          ),
          assignment AS (
            SELECT DISTINCT ON (eah.employee_id)
              eah.employee_id,
              eah.assignment_id,
              eah.start_date,
              eah.end_date,
              eah.position_id,
              eah.store_id,
              e.first_name,
              e.last_name,
              e.external_employee_ref,
              p.position_code
            FROM ops.employee_assignment_history eah
            INNER JOIN scoped_stores s
              ON s.store_id = eah.store_id
            INNER JOIN ops.employee e
              ON e.employee_id = eah.employee_id
             AND e.employment_status = 'active'
            INNER JOIN ops.position p
              ON p.position_id = eah.position_id
             AND p.position_code IN (
               'ASSISTANT_MANAGER',
               'SENIOR_SALES_CONSULTANT',
               'SALES_ASSOCIATE',
               'SHIFT_LEAD'
             )
            WHERE eah.is_primary_assignment = TRUE
              AND eah.start_date <= $3::date
              AND (eah.end_date IS NULL OR eah.end_date >= $3::date)
            ORDER BY eah.employee_id, eah.start_date DESC, eah.created_at DESC, eah.assignment_id DESC
          )
          SELECT
            s.company_id::text AS company_id,
            s.region_id::text AS region_id,
            s.store_id::text AS store_id,
            s.store_name,
            s.store_type,
            store_target.target_distribution_request_id::text AS store_target_request_id,
            store_target.total_target_value::text AS store_target_amount,
            store_sales.actual_value::text AS store_net_sales_amount,
            store_sales.source_batch_id AS store_net_sales_source_batch_id,
            store_sales.import_batch_id AS store_net_sales_import_batch_id,
            ptr.personnel_target_reference_id::text AS personnel_target_reference_id,
            ptr.target_value::text AS personnel_target_amount,
            personnel_sales.actual_value::text AS personnel_positive_sales_amount,
            personnel_sales.source_batch_id AS personnel_sales_source_batch_id,
            personnel_sales.import_batch_id AS personnel_sales_import_batch_id,
            personnel_sales.source_payload_hash AS personnel_sales_source_payload_hash,
            personnel_sales.last_synced_at::text AS personnel_sales_last_synced_at,
            assignment.employee_id::text AS employee_id,
            personnel_user.user_id::text AS user_id,
            assignment.assignment_id::text AS assignment_id,
            assignment.start_date::text AS assignment_started_on,
            assignment.end_date::text AS assignment_ended_on,
            assignment.position_id::text AS position_id,
            assignment.first_name,
            assignment.last_name,
            assignment.external_employee_ref,
            assignment.position_code
          FROM assignment
          INNER JOIN scoped_stores s
            ON s.store_id = assignment.store_id
          LEFT JOIN LATERAL (
            SELECT
              tdr.target_distribution_request_id,
              tdr.total_target_value
            FROM ops.target_distribution_request tdr
            WHERE tdr.company_id = s.company_id
              AND tdr.region_id = s.region_id
              AND tdr.store_id = s.store_id
              AND tdr.request_status = 'approved'
              AND tdr.request_month = $1::date
            ORDER BY
              tdr.approved_at DESC NULLS LAST,
              tdr.updated_at DESC,
              tdr.created_at DESC,
              tdr.target_distribution_request_id DESC
            LIMIT 1
          ) store_target ON TRUE
          LEFT JOIN LATERAL (
            SELECT
              ka.actual_value,
              ka.source_batch_id,
              ib.import_batch_id::text AS import_batch_id
            FROM ops.kpi_actual ka
            INNER JOIN ops.kpi_definition kd
              ON kd.kpi_id = ka.kpi_id
             AND kd.kpi_code = 'NET_SALES'
             AND kd.is_active = TRUE
            INNER JOIN stg.import_batch ib
              ON ib.source_batch_id = ka.source_batch_id
             AND ib.entity_type = 'kpi'
             AND ib.status IN ('completed', 'completed_with_errors')
             AND ib.company_ids && ARRAY[s.company_id]::uuid[]
             ${closeCutoffClause}
            WHERE ka.store_id = s.store_id
              AND ka.scope_type = 'store'
              AND ka.period_type = 'monthly'
              AND ka.period_start = $1::date
              AND ka.period_end = $2::date
              AND ka.source_type = 'integration'
              AND COALESCE(ka.source_type, '') <> 'demo_seed'
              AND ka.source_batch_id IS NOT NULL
            ORDER BY ka.last_synced_at DESC, ka.calculated_at DESC, ka.kpi_actual_id DESC
            LIMIT 1
          ) store_sales ON TRUE
          LEFT JOIN ops.personnel_target_reference ptr
            ON ptr.employee_id = assignment.employee_id
           AND ptr.store_id = assignment.store_id
           AND ptr.source_request_id = store_target.target_distribution_request_id
           AND ptr.period_start = $1::date
           AND ptr.period_end = $2::date
           AND ptr.target_type = 'monthly_sales_target'
           AND ptr.status = 'approved'
          LEFT JOIN LATERAL (
            SELECT
              ka.actual_value,
              ka.source_batch_id,
              ib.import_batch_id::text AS import_batch_id,
              ka.source_payload_hash,
              ka.last_synced_at
            FROM ops.kpi_actual ka
            INNER JOIN ops.kpi_definition kd
              ON kd.kpi_id = ka.kpi_id
             AND kd.kpi_code = 'NET_SALES'
             AND kd.is_active = TRUE
            INNER JOIN stg.import_batch ib
              ON ib.source_batch_id = ka.source_batch_id
             AND ib.entity_type = 'kpi'
             AND ib.status IN ('completed', 'completed_with_errors')
             AND ib.company_ids && ARRAY[s.company_id]::uuid[]
             ${closeCutoffClause}
            WHERE ka.store_id = assignment.store_id
              AND ka.employee_id = assignment.employee_id
              AND ka.scope_type = 'employee'
              AND ka.period_type = 'monthly'
              AND ka.period_start = $1::date
              AND ka.period_end = $2::date
              AND ka.source_type = 'integration'
              AND COALESCE(ka.source_type, '') <> 'demo_seed'
              AND ka.source_batch_id IS NOT NULL
              AND EXISTS (
                SELECT 1
                FROM stg.kpi_raw kr
                INNER JOIN stg.external_id_map employee_map
                  ON employee_map.integration_source_id = ib.integration_source_id
                 AND employee_map.entity_type = 'employee'
                 AND employee_map.external_id = kr.employee_external_ref
                 AND employee_map.internal_id = assignment.employee_id
                 AND employee_map.is_active = TRUE
                INNER JOIN stg.external_id_map store_map
                  ON store_map.integration_source_id = ib.integration_source_id
                 AND store_map.entity_type = 'store'
                 AND store_map.external_id = kr.store_external_ref
                 AND store_map.internal_id = assignment.store_id
                 AND store_map.is_active = TRUE
                WHERE kr.import_batch_id = ib.import_batch_id
                  AND kr.source_metric_id = 'NET_SALES'
                  AND kr.period_start = ka.period_start
                  AND kr.period_end = ka.period_end
                  AND kr.payload_json ->> 'scopeType' = 'employee'
                  AND kr.payload_json -> 'sourceRow' ->> 'sourceKind' = 'personnel_gross_sales'
              )
            ORDER BY ka.last_synced_at DESC, ka.calculated_at DESC, ka.kpi_actual_id DESC
            LIMIT 1
          ) personnel_sales ON TRUE
          LEFT JOIN LATERAL (
            SELECT ua.user_id
            FROM ops.user_account ua
            WHERE ua.employee_id = assignment.employee_id
              AND ua.is_active = TRUE
            ORDER BY ua.created_at DESC, ua.user_id DESC
            LIMIT 1
          ) personnel_user ON TRUE
          ORDER BY s.store_name ASC, assignment.first_name ASC, assignment.last_name ASC, assignment.employee_id ASC
        `,
        params,
      );

    return result.rows;
  }

  async listCloseBlockingKpiImports(input: {
    companyIds: string[];
    periodStart: string;
    periodEnd: string;
    closeCutoffAt: string;
  }) {
    const result =
      await this.databaseService.query<SalesTargetIncentiveCloseBlockingImportRow>(
        `
          SELECT
            ib.import_batch_id::text AS import_batch_id,
            ib.status,
            ib.source_window_started_at::text AS source_window_started_at,
            ib.source_window_ended_at::text AS source_window_ended_at
          FROM stg.import_batch ib
          INNER JOIN stg.integration_source source
            ON source.integration_source_id = ib.integration_source_id
           AND source.entity_type = 'kpi'
          WHERE ib.entity_type = 'kpi'
            AND (
              ib.source_window_started_at IS NULL
              OR ib.source_window_ended_at IS NULL
              OR (
                ib.source_window_started_at::date <= $2::date
                AND ib.source_window_ended_at::date >= $1::date
              )
            )
            AND ib.company_ids && $3::uuid[]
            AND COALESCE(ib.finished_at, ib.started_at) <= $4::timestamptz
            AND ib.status IN ('pending', 'processing', 'queued', 'failed')
          ORDER BY ib.source_window_started_at ASC, ib.import_batch_id ASC
        `,
        [
          input.periodStart,
          input.periodEnd,
          input.companyIds,
          input.closeCutoffAt,
        ],
      );

    return result.rows;
  }

  async listCloseBlockingTargetRevisions(input: {
    companyIds: string[];
    periodStart: string;
  }) {
    const result =
      await this.databaseService.query<SalesTargetIncentiveCloseBlockingTargetRevisionRow>(
        `
          SELECT
            tdr.target_distribution_request_id::text AS target_distribution_request_id,
            tdr.company_id::text AS company_id,
            tdr.region_id::text AS region_id,
            tdr.store_id::text AS store_id,
            tdr.request_status,
            tdr.updated_at::text AS updated_at
          FROM ops.target_distribution_request tdr
          INNER JOIN ops.store s
            ON s.store_id = tdr.store_id
           AND s.status = 'active'
           AND s.store_type = 'company'
          WHERE tdr.request_status = 'pending_region_approval'
            AND tdr.request_month = $1::date
            AND tdr.company_id = ANY($2::uuid[])
          ORDER BY tdr.updated_at ASC, tdr.target_distribution_request_id ASC
        `,
        [input.periodStart, input.companyIds],
      );

    return result.rows;
  }

  private buildStoreScopeClauses(
    input: {
      companyIds?: string[];
      regionIds?: string[];
      storeIds?: string[];
      allowGlobalScope?: boolean;
    },
    params: unknown[],
  ) {
    const clauses: string[] = [];

    if (input.storeIds && input.storeIds.length > 0) {
      params.push(input.storeIds);
      clauses.push(`s.store_id = ANY($${params.length}::uuid[])`);
    }

    if (input.regionIds && input.regionIds.length > 0) {
      params.push(input.regionIds);
      clauses.push(`s.region_id = ANY($${params.length}::uuid[])`);
    }

    if (input.companyIds && input.companyIds.length > 0) {
      params.push(input.companyIds);
      clauses.push(`s.company_id = ANY($${params.length}::uuid[])`);
    }

    if (clauses.length > 0) {
      return clauses;
    }

    return input.allowGlobalScope ? ["TRUE"] : ["FALSE"];
  }

  private appendCloseCutoffClause(
    input: { closeCutoffAt?: string },
    params: unknown[],
    importAlias: string,
  ) {
    if (!input.closeCutoffAt) {
      return "";
    }

    params.push(input.closeCutoffAt);
    return `AND COALESCE(${importAlias}.finished_at, ${importAlias}.started_at) <= $${params.length}::timestamptz`;
  }
}
