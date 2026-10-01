import { Inject, Injectable } from "@nestjs/common";
import { DatabaseService } from "../../../shared/database/database.service";
import type { StorePositiveSeller } from "../application/store-returns.contract";

@Injectable()
export class StorePositiveSellersReadRepository {
  constructor(@Inject(DatabaseService) private readonly databaseService: Pick<DatabaseService,"query">) {}

  async listActivity(input: { storeIds: string[]; throughDate: string }) {
    if (!input.storeIds.length) return [];
    const result=await this.databaseService.query<{
      store_id: string; employee_id: string; covered_days: number; no_positive_sales_15_days: boolean;
    }>(`
      SELECT norm.store_id::text,norm.employee_id::text,coverage.covered_days,
        (norm.start_date<=$2::date-15 AND coverage.covered_days=15 AND NOT EXISTS (
          SELECT 1 FROM ops.company_daily_kpi_employee_sales sale
          JOIN ops.company_daily_kpi_component_outcome outcome USING(component_outcome_id)
          WHERE sale.store_id=norm.store_id AND sale.employee_id=norm.employee_id
            AND sale.business_date BETWEEN $2::date-15 AND $2::date
            AND outcome.status='succeeded' AND outcome.operation='sales'
            AND sale.sale_invoice_count>0 AND sale.sale_amount_try>0
        ) AND NOT EXISTS (
          SELECT 1 FROM ops.company_daily_kpi_unmapped_personnel_sales sale
          JOIN ops.company_daily_kpi_component_outcome outcome USING(component_outcome_id)
          JOIN ops.master_identity_code_reservation identity ON identity.entity_type='employee'
            AND identity.normalized_code=ops.normalize_master_external_code_v1(sale.personnel_code)
            AND identity.internal_id=norm.employee_id
          LEFT JOIN stg.external_id_map mapping ON mapping.integration_source_id=outcome.integration_source_id
            AND mapping.entity_type='employee' AND mapping.external_id=sale.personnel_code AND mapping.is_active
          WHERE sale.store_id=norm.store_id AND sale.business_date BETWEEN $2::date-15 AND $2::date
            AND outcome.status='succeeded' AND outcome.operation='sales'
            AND (mapping.internal_id IS NULL OR mapping.internal_id=identity.internal_id)
            AND sale.sale_invoice_count>0 AND sale.sale_amount_try>0
        )) AS no_positive_sales_15_days
      FROM ops.employee_assignment_history norm
      CROSS JOIN LATERAL (
        SELECT COUNT(DISTINCT sale.business_date)::int AS covered_days
        FROM ops.company_daily_kpi_store_sales sale
        JOIN ops.company_daily_kpi_component_outcome outcome USING(component_outcome_id)
        WHERE sale.store_id=norm.store_id AND sale.business_date BETWEEN $2::date-15 AND $2::date-1
          AND outcome.status='succeeded' AND outcome.operation='sales'
      ) coverage
      WHERE norm.store_id=ANY($1::uuid[]) AND norm.is_primary_assignment
        AND norm.start_date<=$2::date AND (norm.end_date IS NULL OR norm.end_date>=$2::date)
      ORDER BY norm.store_id,norm.employee_id,norm.start_date DESC,norm.assignment_id DESC
    `,[input.storeIds,input.throughDate]);
    return result.rows;
  }

  // Called with store IDs already resolved by the workspace's own role boundary.
  async list(input: { storeIds: string[]; periodStart: string; throughDate: string }): Promise<StorePositiveSeller[]> {
    if (!input.storeIds.length) return [];
    const result = await this.databaseService.query<StorePositiveSeller>(`
      WITH raw_people AS (
        SELECT sales.store_id,sales.employee_id,employee.external_employee_ref AS personnel_code,
          sales.component_outcome_id,sales.business_date,sales.sale_amount_try,sales.sale_invoice_count,
          sales.signed_return_amount_try,sales.net_amount_try
        FROM ops.company_daily_kpi_employee_sales sales JOIN ops.employee employee USING(employee_id)
        WHERE sales.store_id=ANY($1::uuid[]) AND sales.business_date BETWEEN $2::date AND $3::date
        UNION ALL
        SELECT sales.store_id,NULL::uuid,sales.personnel_code,sales.component_outcome_id,sales.business_date,
          sales.sale_amount_try,sales.sale_invoice_count,sales.signed_return_amount_try,sales.net_amount_try
        FROM ops.company_daily_kpi_unmapped_personnel_sales sales
        WHERE sales.store_id=ANY($1::uuid[]) AND sales.business_date BETWEEN $2::date AND $3::date
      ), resolved AS (
        SELECT raw.*,COALESCE(raw.employee_id,CASE
          WHEN alias.internal_id IS NOT NULL AND mapping.internal_id IS NOT NULL AND alias.internal_id<>mapping.internal_id THEN NULL
          ELSE COALESCE(alias.internal_id,mapping.internal_id) END) AS resolved_employee_id,
          outcome.return_attribution_version
        FROM raw_people raw JOIN ops.company_daily_kpi_component_outcome outcome USING(component_outcome_id)
        LEFT JOIN ops.master_identity_code_reservation alias
          ON alias.entity_type='employee' AND alias.normalized_code=ops.normalize_master_external_code_v1(raw.personnel_code)
        LEFT JOIN stg.external_id_map mapping ON mapping.integration_source_id=outcome.integration_source_id
          AND mapping.entity_type='employee' AND mapping.external_id=raw.personnel_code AND mapping.is_active
        WHERE outcome.status='succeeded' AND outcome.operation='sales'
      ), verified AS (
        SELECT resolved.*, (return_attribution_version=2 AND
          (resolved_employee_id IS NULL OR EXISTS (
            SELECT 1 FROM ops.kpi_actual actual JOIN ops.kpi_definition definition USING(kpi_id)
            JOIN ops.company_daily_kpi_component_outcome accepted
              ON accepted.component_outcome_id=resolved.component_outcome_id
            JOIN stg.import_batch batch ON
              (batch.source_batch_id=actual.source_batch_id OR batch.import_batch_id::text=actual.source_batch_id)
              AND batch.integration_source_id=accepted.integration_source_id
              AND batch.entity_type='kpi' AND batch.status='completed' AND batch.error_count=0
            JOIN ops.store store ON store.store_id=resolved.store_id AND store.company_id=ANY(batch.company_ids)
            WHERE actual.store_id=resolved.store_id AND actual.employee_id=resolved.resolved_employee_id
              AND actual.scope_type='employee' AND actual.period_type='daily'
              AND actual.period_start=resolved.business_date AND actual.period_end=resolved.business_date
              AND actual.source_type='integration' AND definition.kpi_code='NET_SALES' AND definition.is_active
              AND actual.actual_value=ROUND(resolved.net_amount_try,4)
          ))) AS net_verified
        FROM resolved
      ), grouped AS (
        SELECT store_id,resolved_employee_id AS employee_id,
          MAX(personnel_code) AS personnel_code,
          SUM(sale_amount_try)::text AS sale_amount,
          CASE WHEN BOOL_AND(net_verified) AND NOT EXISTS (
            SELECT 1 FROM ops.company_daily_kpi_return movement
            JOIN ops.company_daily_kpi_component_outcome accepted USING(component_outcome_id)
            WHERE movement.store_id=verified.store_id AND movement.business_date BETWEEN $2::date AND $3::date
              AND movement.return_kind='unresolved' AND accepted.status='succeeded'
          ) THEN SUM(ROUND(net_amount_try,4))::text END AS net_amount,
          CASE WHEN BOOL_AND(return_attribution_version=2) THEN SUM(signed_return_amount_try)::text END AS return_amount,
          MAX(business_date) FILTER(WHERE sale_invoice_count>0 AND sale_amount_try>0)::text AS last_positive_date
        FROM verified GROUP BY store_id,resolved_employee_id,CASE WHEN resolved_employee_id IS NULL THEN personnel_code END
        HAVING BOOL_OR(sale_invoice_count>0 AND sale_amount_try>0)
      )
      SELECT people.store_id::text,people.employee_id::text,people.personnel_code,
        NULLIF(TRIM(CONCAT(employee.first_name,' ',employee.last_name)),'') AS display_name,
        position.position_code,employee.employment_status AS current_employment_status,
        employee.termination_date::text,people.sale_amount,people.return_amount,people.net_amount,people.last_positive_date,
        coverage.covered_days,
        (norm.start_date<=$3::date-15 AND coverage.covered_days=15 AND NOT EXISTS (
          SELECT 1 FROM ops.company_daily_kpi_employee_sales sales
          JOIN ops.company_daily_kpi_component_outcome accepted USING(component_outcome_id)
          WHERE sales.store_id=people.store_id AND sales.employee_id=people.employee_id
            AND sales.business_date BETWEEN $3::date-15 AND $3::date
            AND accepted.status='succeeded' AND sales.sale_invoice_count>0 AND sales.sale_amount_try>0
        ) AND people.last_positive_date::date<$3::date-15) IS TRUE AS no_positive_sales_15_days
      FROM grouped people JOIN ops.store store USING(store_id)
      LEFT JOIN ops.employee employee ON employee.employee_id=people.employee_id
      LEFT JOIN LATERAL (
        SELECT assignment.position_id,assignment.start_date FROM ops.employee_assignment_history assignment
        WHERE assignment.employee_id=people.employee_id AND assignment.store_id=people.store_id
          AND assignment.start_date<=$3::date AND (assignment.end_date IS NULL OR assignment.end_date>=$3::date)
          AND assignment.is_primary_assignment
        ORDER BY assignment.start_date DESC,assignment.assignment_id DESC LIMIT 1
      ) norm ON TRUE
      LEFT JOIN ops.position position USING(position_id)
      CROSS JOIN LATERAL (
        SELECT COUNT(DISTINCT sales.business_date)::int AS covered_days
        FROM ops.company_daily_kpi_store_sales sales JOIN ops.company_daily_kpi_component_outcome accepted USING(component_outcome_id)
        WHERE sales.store_id=people.store_id AND accepted.status='succeeded'
          AND sales.business_date BETWEEN $3::date-15 AND $3::date-1
      ) coverage
      ORDER BY people.store_id,people.employee_id NULLS LAST,people.personnel_code
    `, [input.storeIds,input.periodStart,input.throughDate]);
    return result.rows;
  }
}
