import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../../../shared/database/database.service";
import {
  StoreMonthlyReportPackageRow,
  StoreMonthlyReportPackageScope,
} from "./store-monthly-report-package.types";

const STORE_MONTHLY_REPORT_PACKAGE_SQL = `
WITH scoped_stores AS (
  SELECT
    store.store_id,
    store.company_id,
    store.region_id,
    store.store_name,
    store.store_type,
    region.region_name
  FROM ops.store store
  LEFT JOIN ops.region region
    ON region.region_id = store.region_id
  WHERE store.status = 'active'
    AND (
      (CARDINALITY($3::uuid[]) > 0 AND store.company_id = ANY($3::uuid[]))
      OR (CARDINALITY($4::uuid[]) > 0 AND store.region_id = ANY($4::uuid[]))
      OR (CARDINALITY($5::uuid[]) > 0 AND store.store_id = ANY($5::uuid[]))
      OR (
        $6::uuid IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM ops.user_action_store_assignment action_scope
          WHERE action_scope.store_id = store.store_id
            AND action_scope.user_id = $6::uuid
            AND action_scope.start_at <= ($2::date + TIME '23:59:59')::timestamptz
            AND (action_scope.end_at IS NULL OR action_scope.end_at >= $1::date::timestamptz)
        )
      )
    )
),
region_manager_names AS (
  SELECT
    ranked.store_id,
    ranked.region_manager_name
  FROM (
    SELECT
      scoped.store_id,
      COALESCE(
        NULLIF(TRIM(CONCAT(employee.first_name, ' ', employee.last_name)), ''),
        NULLIF(TRIM(REGEXP_REPLACE(scoped.region_name, '\\s+B(?:ö|o)lgesi$', '', 'i')), ''),
        user_account.username,
        user_account.email,
        user_account.user_id::text
      ) AS region_manager_name,
      ROW_NUMBER() OVER (
        PARTITION BY scoped.store_id
        ORDER BY
          CASE
            WHEN user_account.email ILIKE 'pilot.%'
              OR user_account.email ILIKE '%+clerk_test%'
              OR user_account.email ILIKE '%@example.%'
              OR user_account.email ILIKE '%+%@%'
              THEN 1
            ELSE 0
          END ASC,
          CASE
            WHEN NULLIF(TRIM(CONCAT(employee.first_name, ' ', employee.last_name)), '') IS NULL
              THEN 1
            ELSE 0
          END ASC,
          role_assignment.created_at DESC NULLS LAST,
          user_account.email ASC,
          user_account.user_id ASC
      ) AS manager_rank
    FROM scoped_stores scoped
    INNER JOIN ops.user_role_assignment role_assignment
      ON role_assignment.company_id = scoped.company_id
     AND (
       (
         role_assignment.scope_type = 'region'
         AND role_assignment.region_id = scoped.region_id
       )
       OR (
         role_assignment.scope_type = 'store'
         AND role_assignment.region_id = scoped.region_id
         AND role_assignment.store_id = scoped.store_id
       )
     )
     AND role_assignment.start_at <= ($2::date + TIME '23:59:59')::timestamptz
     AND (role_assignment.end_at IS NULL OR role_assignment.end_at >= $1::date::timestamptz)
    INNER JOIN ops.role role
      ON role.role_id = role_assignment.role_id
     AND role.role_code = 'REGION_MANAGER'
    INNER JOIN ops.user_account user_account
      ON user_account.user_id = role_assignment.user_id
     AND user_account.is_active = TRUE
    LEFT JOIN ops.employee employee
      ON employee.employee_id = user_account.employee_id
  ) ranked
  WHERE ranked.manager_rank = 1
),
store_kpis AS (
  SELECT
    scoped.store_id,
    MAX(kpi_actual.actual_value) FILTER (WHERE kpi_definition.kpi_code IN ('WEIGHTED_STORE_SCORE', 'STORE_SCORE'))::text AS score_value,
    MAX(kpi_actual.actual_value) FILTER (WHERE kpi_definition.kpi_code = 'UPT')::text AS upt_value,
    MAX(kpi_actual.actual_value) FILTER (WHERE kpi_definition.kpi_code = 'ATV')::text AS atv_value,
    MAX(kpi_actual.actual_value) FILTER (WHERE kpi_definition.kpi_code = 'CR')::text AS cr_value,
    MAX(COALESCE(kpi_actual.achievement_rate, kpi_actual.actual_value)) FILTER (
      WHERE kpi_definition.kpi_code IN ('TARGET_ACHIEVEMENT', 'STORE_SALES', 'SALES_TARGET_ACHIEVEMENT', 'HG%')
    )::text AS hg_value,
    MAX(COALESCE(kpi_actual.achievement_rate, kpi_actual.actual_value)) FILTER (
      WHERE kpi_definition.kpi_code IN ('GSM_ONAY', 'gsm_approval')
    )::text AS gsm_value
  FROM scoped_stores scoped
  LEFT JOIN ops.kpi_actual kpi_actual
    ON kpi_actual.store_id = scoped.store_id
   AND kpi_actual.scope_type = 'store'
   AND kpi_actual.period_start <= $2::date
   AND kpi_actual.period_end >= $1::date
  LEFT JOIN ops.kpi_definition kpi_definition
    ON kpi_definition.kpi_id = kpi_actual.kpi_id
  GROUP BY scoped.store_id
),
checklist_month_scores AS (
  SELECT
    scoped.store_id,
    AVG(checklist_instance.total_score) FILTER (
      WHERE checklist_template.template_type = 'BM_STORE_VISIT'
        AND checklist_instance.completed_at::date BETWEEN $1::date AND $2::date
    )::text AS bm_checklist_score,
    AVG(checklist_instance.total_score) FILTER (
      WHERE checklist_template.template_type <> 'BM_STORE_VISIT'
        AND checklist_instance.completed_at::date BETWEEN $1::date AND $2::date
    )::text AS vm_checklist_score,
    COUNT(*) FILTER (
      WHERE checklist_instance.status = 'completed'
        AND checklist_instance.completed_at::date BETWEEN $1::date AND $2::date
        AND checklist_acknowledgement.checklist_acknowledgement_id IS NULL
    )::text AS pending_ack_count
  FROM scoped_stores scoped
  LEFT JOIN ops.checklist_instance checklist_instance
    ON checklist_instance.store_id = scoped.store_id
   AND checklist_instance.status = 'completed'
  LEFT JOIN ops.checklist_template checklist_template
    ON checklist_template.checklist_template_id = checklist_instance.checklist_template_id
  LEFT JOIN ops.checklist_acknowledgement checklist_acknowledgement
    ON checklist_acknowledgement.checklist_instance_id = checklist_instance.checklist_instance_id
  GROUP BY scoped.store_id
),
latest_visit AS (
  SELECT
    scoped.store_id,
    MAX(checklist_instance.completed_at::date)::text AS last_visit_date,
    ($2::date - MAX(checklist_instance.completed_at::date))::text AS days_since_visit
  FROM scoped_stores scoped
  LEFT JOIN ops.checklist_instance checklist_instance
    ON checklist_instance.store_id = scoped.store_id
   AND checklist_instance.status = 'completed'
   AND checklist_instance.completed_at::date <= $2::date
  GROUP BY scoped.store_id
),
action_state AS (
  SELECT
    scoped.store_id,
    COUNT(*) FILTER (WHERE action_plan.status IN ('open', 'in_progress', 'blocked'))::text AS open_action_count,
    COUNT(*) FILTER (WHERE action_plan.status = 'closed')::text AS closed_action_count
  FROM scoped_stores scoped
  LEFT JOIN ops.store_action_plan action_plan
    ON action_plan.store_id = scoped.store_id
   AND action_plan.created_at::date <= $2::date
   AND (action_plan.cancelled_at IS NULL OR action_plan.cancelled_at::date >= $1::date)
  GROUP BY scoped.store_id
),
target_state AS (
  SELECT DISTINCT ON (scoped.store_id)
    scoped.store_id,
    target_request.request_status AS target_status
  FROM scoped_stores scoped
  LEFT JOIN ops.target_distribution_request target_request
    ON target_request.store_id = scoped.store_id
   AND target_request.request_month = DATE_TRUNC('month', $1::date)::date
  ORDER BY scoped.store_id, target_request.updated_at DESC NULLS LAST, target_request.created_at DESC NULLS LAST
),
incentive_state AS (
  SELECT
    scoped.store_id,
    MAX(close_run.status) AS incentive_status,
    SUM(final_row.final_amount)::text AS incentive_total_amount
  FROM scoped_stores scoped
  LEFT JOIN rpt.sales_target_incentive_final_snapshot final_snapshot
    ON final_snapshot.store_id = scoped.store_id
   AND final_snapshot.period_key = TO_CHAR($1::date, 'YYYY-MM')
  LEFT JOIN ops.sales_target_incentive_close_run close_run
    ON close_run.sales_target_incentive_close_run_id = final_snapshot.close_run_id
  LEFT JOIN rpt.sales_target_incentive_final_row final_row
    ON final_row.final_snapshot_id = final_snapshot.sales_target_incentive_final_snapshot_id
  GROUP BY scoped.store_id
),
workforce_norm_state AS (
  SELECT
    scoped.store_id,
    SUM(norm_plan.planned_headcount)::text AS planned_headcount
  FROM scoped_stores scoped
  LEFT JOIN ops.workforce_norm_plan norm_plan
    ON norm_plan.store_id = scoped.store_id
   AND norm_plan.period_start <= $2::date
   AND norm_plan.period_end >= $1::date
  GROUP BY scoped.store_id
),
workforce_active_state AS (
  SELECT
    scoped.store_id,
    COUNT(DISTINCT assignment.employee_id)::text AS active_headcount
  FROM scoped_stores scoped
  LEFT JOIN ops.employee_assignment_history assignment
    ON assignment.store_id = scoped.store_id
   AND assignment.assignment_status = 'active'
   AND assignment.start_date <= $2::date
   AND (assignment.end_date IS NULL OR assignment.end_date >= $2::date)
  GROUP BY scoped.store_id
),
workforce_state AS (
  SELECT
    scoped.store_id,
    workforce_norm_state.planned_headcount,
    workforce_active_state.active_headcount
  FROM scoped_stores scoped
  LEFT JOIN workforce_norm_state
    ON workforce_norm_state.store_id = scoped.store_id
  LEFT JOIN workforce_active_state
    ON workforce_active_state.store_id = scoped.store_id
),
turnover_state AS (
  SELECT
    scoped.store_id,
    turnover_projection.leaver_count::text AS leaver_count,
    CASE
      WHEN turnover_projection.leaver_count > 0
        AND ((turnover_projection.opening_headcount + turnover_projection.closing_headcount) / 2.0) > 0
        THEN (
          (
            turnover_projection.leaver_count /
            ((turnover_projection.opening_headcount + turnover_projection.closing_headcount) / 2.0)
          ) * 100
        )::numeric(10,2)::text
      ELSE NULL
    END AS turnover_rate
  FROM scoped_stores scoped
  CROSS JOIN LATERAL (
    SELECT
      (
        SELECT COUNT(*)::numeric(10,2)
        FROM ops.employee_assignment_history assignment
        WHERE assignment.store_id = scoped.store_id
          AND assignment.start_date <= DATE_TRUNC('year', $2::date)::date
          AND (assignment.end_date IS NULL OR assignment.end_date >= DATE_TRUNC('year', $2::date)::date)
      ) AS opening_headcount,
      (
        SELECT COUNT(*)::numeric(10,2)
        FROM ops.employee_assignment_history assignment
        WHERE assignment.store_id = scoped.store_id
          AND assignment.assignment_status = 'active'
          AND assignment.start_date <= $2::date
          AND (assignment.end_date IS NULL OR assignment.end_date >= $2::date)
      ) AS closing_headcount,
      (
        SELECT COUNT(*)::numeric(10,2)
        FROM ops.turnover_event turnover_event
        WHERE turnover_event.store_id = scoped.store_id
          AND turnover_event.event_type = 'termination'
          AND turnover_event.event_date BETWEEN DATE_TRUNC('year', $2::date)::date AND $2::date
      ) AS leaver_count
  ) turnover_projection
)
SELECT
  region_manager_names.region_manager_name,
  scoped.store_id::text,
  scoped.store_name,
  scoped.store_type,
  scoped.region_name,
  store_kpis.score_value,
  store_kpis.upt_value,
  store_kpis.atv_value,
  store_kpis.cr_value,
  store_kpis.hg_value,
  store_kpis.gsm_value,
  checklist_month_scores.bm_checklist_score,
  checklist_month_scores.vm_checklist_score,
  checklist_month_scores.pending_ack_count,
  action_state.open_action_count,
  action_state.closed_action_count,
  target_state.target_status,
  incentive_state.incentive_status,
  incentive_state.incentive_total_amount,
  workforce_state.planned_headcount,
  workforce_state.active_headcount,
  turnover_state.leaver_count,
  turnover_state.turnover_rate,
  latest_visit.last_visit_date,
  latest_visit.days_since_visit
FROM scoped_stores scoped
LEFT JOIN region_manager_names
  ON region_manager_names.store_id = scoped.store_id
LEFT JOIN store_kpis
  ON store_kpis.store_id = scoped.store_id
LEFT JOIN checklist_month_scores
  ON checklist_month_scores.store_id = scoped.store_id
LEFT JOIN latest_visit
  ON latest_visit.store_id = scoped.store_id
LEFT JOIN action_state
  ON action_state.store_id = scoped.store_id
LEFT JOIN target_state
  ON target_state.store_id = scoped.store_id
LEFT JOIN incentive_state
  ON incentive_state.store_id = scoped.store_id
LEFT JOIN workforce_state
  ON workforce_state.store_id = scoped.store_id
LEFT JOIN turnover_state
  ON turnover_state.store_id = scoped.store_id
ORDER BY scoped.store_name ASC
`;

@Injectable()
export class StoreMonthlyReportPackageRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async getStoreMonthlyReportPackageRows(input: {
    periodStart: string;
    periodEnd: string;
    companyIds: string[];
    regionIds: string[];
    storeIds: string[];
    regionManagerUserId?: string;
  }): Promise<StoreMonthlyReportPackageRow[]> {
    if (!this.hasStoreScope(input)) {
      return [];
    }

    const result = await this.databaseService.query<StoreMonthlyReportPackageRow>(
      STORE_MONTHLY_REPORT_PACKAGE_SQL,
      [
        input.periodStart,
        input.periodEnd,
        input.companyIds,
        input.regionIds,
        input.storeIds,
        input.regionManagerUserId ?? null,
      ],
    );

    return result.rows;
  }

  private hasStoreScope(input: StoreMonthlyReportPackageScope): boolean {
    return (
      input.companyIds.length > 0 ||
      input.regionIds.length > 0 ||
      input.storeIds.length > 0 ||
      Boolean(input.regionManagerUserId)
    );
  }
}
