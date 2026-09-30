import { Injectable, NotFoundException } from "@nestjs/common";
import { DatabaseService } from "../../../shared/database/database.service";
import type { AuthReadScope } from "../../auth/auth-context.service";
import type { StoreReturnsLedger } from "../application/store-returns.contract";

const authorizedStore = `SELECT store.* FROM ops.store store WHERE store.store_id=$1::uuid
  AND (store.company_id=ANY($2::uuid[]) OR store.store_id=ANY($3::uuid[]))`;

@Injectable()
export class StoreReturnsReadRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async canReadStore(input: { storeId: string; scope: AuthReadScope }) {
    const result = await this.databaseService.query(authorizedStore,
      [input.storeId, input.scope.companyIds, input.scope.storeIds]);
    return result.rows.length > 0;
  }

  async getLedger(input: {
    storeId: string; scope: AuthReadScope; periodStart: string; periodEnd: string;
    category: "inside" | "other"; limit: number; offset: number;
  }): Promise<StoreReturnsLedger> {
    const result = await this.databaseService.query<{ ledger: StoreReturnsLedger }>(`
      WITH selected_store AS (${authorizedStore}),
      expected_days AS (
        SELECT day::date AS business_date FROM selected_store store
        CROSS JOIN LATERAL generate_series(
          GREATEST($4::date, COALESCE(store.open_date,$4::date)),
          LEAST($5::date, COALESCE(store.close_date,$5::date),
            (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Istanbul')::date - 1), INTERVAL '1 day') day
      ),
      accepted_sales AS (
        SELECT DISTINCT ON (sales.business_date) sales.*
        FROM selected_store store JOIN ops.company_daily_kpi_store_sales sales USING(store_id)
        JOIN ops.company_daily_kpi_component_outcome outcome USING(component_outcome_id)
        WHERE sales.business_date BETWEEN $4::date AND $5::date
          AND outcome.status='succeeded' AND outcome.return_attribution_version=2
          AND EXISTS (
            SELECT 1 FROM ops.kpi_actual actual JOIN ops.kpi_definition definition USING(kpi_id)
            JOIN stg.import_batch batch ON
              (batch.source_batch_id=actual.source_batch_id OR batch.import_batch_id::text=actual.source_batch_id)
              AND batch.integration_source_id=outcome.integration_source_id
              AND batch.entity_type='kpi' AND batch.status='completed' AND batch.error_count=0
              AND store.company_id=ANY(batch.company_ids)
            WHERE actual.store_id=store.store_id AND actual.scope_type='store'
              AND actual.period_type='daily' AND actual.period_start=sales.business_date
              AND actual.period_end=sales.business_date AND actual.source_type='integration'
              AND definition.kpi_code='NET_SALES' AND definition.is_active
              AND actual.actual_value=ROUND(sales.net_amount_try,4)
          )
        ORDER BY sales.business_date, outcome.accepted_at DESC, outcome.component_outcome_id DESC
      ),
      classified AS (
        SELECT movement.return_id, movement.business_date,
          movement.direction, movement.personnel_code,
          person.employee_id, NULLIF(TRIM(CONCAT(person.first_name,' ',person.last_name)),'') AS display_name,
          movement.receiving_store_code, receiving.store_name AS receiving_store_name,
          movement.original_store_code, original.store_name AS original_store_name,
          movement.signed_return_amount_try, movement.return_invoice_count,
          CASE
            WHEN movement.return_kind='cross_store' THEN 'cross_store'
            WHEN movement.return_kind='unresolved' OR person.employee_id IS NULL THEN 'review_required'
            WHEN norm.start_date IS NULL THEN 'out_of_norm'
            WHEN positive.has_sales OR norm.start_date > movement.business_date - 15 THEN 'in_store'
            WHEN coverage.covered_days=15 THEN 'out_of_norm'
            ELSE 'review_required'
          END AS category
        FROM selected_store store JOIN ops.company_daily_kpi_return movement USING(store_id)
        JOIN ops.company_daily_kpi_component_outcome outcome USING(component_outcome_id)
        LEFT JOIN stg.external_id_map identity_map
          ON identity_map.integration_source_id=outcome.integration_source_id
          AND identity_map.entity_type='employee' AND identity_map.external_id=movement.personnel_code
          AND identity_map.is_active
        LEFT JOIN ops.master_identity_code_reservation personnel_alias
          ON personnel_alias.entity_type='employee'
          AND personnel_alias.normalized_code=ops.normalize_master_external_code_v1(movement.personnel_code)
        LEFT JOIN ops.employee person ON person.employee_id=CASE
          WHEN personnel_alias.internal_id IS NOT NULL AND identity_map.internal_id IS NOT NULL
            AND personnel_alias.internal_id<>identity_map.internal_id THEN NULL
          ELSE COALESCE(personnel_alias.internal_id,identity_map.internal_id) END
          AND (person.company_id=store.company_id OR person.company_id=ANY($2::uuid[]))
        LEFT JOIN ops.master_identity_code_reservation receiving_alias
          ON receiving_alias.entity_type='store'
          AND receiving_alias.normalized_code=ops.normalize_master_external_code_v1(movement.receiving_store_code)
        LEFT JOIN ops.master_identity_code_reservation original_alias
          ON original_alias.entity_type='store'
          AND original_alias.normalized_code=ops.normalize_master_external_code_v1(movement.original_store_code)
        LEFT JOIN ops.store receiving ON receiving.store_id=COALESCE(receiving_alias.internal_id,
          (SELECT store_id FROM ops.store WHERE store_code=movement.receiving_store_code))
          AND (receiving.company_id=store.company_id OR receiving.company_id=ANY($2::uuid[]))
        LEFT JOIN ops.store original ON original.store_id=COALESCE(original_alias.internal_id,
          (SELECT store_id FROM ops.store WHERE store_code=movement.original_store_code))
          AND (original.company_id=store.company_id OR original.company_id=ANY($2::uuid[]))
        LEFT JOIN LATERAL (
          SELECT assignment.start_date FROM ops.employee_assignment_history assignment
          WHERE assignment.employee_id=person.employee_id AND assignment.store_id=store.store_id
            AND assignment.is_primary_assignment AND assignment.start_date<=movement.business_date
            AND (assignment.end_date IS NULL OR assignment.end_date>=movement.business_date)
          ORDER BY assignment.start_date DESC, assignment.assignment_id DESC LIMIT 1
        ) norm ON TRUE
        CROSS JOIN LATERAL (
          SELECT EXISTS (
            SELECT 1 FROM ops.company_daily_kpi_employee_sales sales
            JOIN ops.company_daily_kpi_component_outcome accepted USING(component_outcome_id)
            WHERE sales.store_id=store.store_id AND sales.employee_id=person.employee_id
              AND sales.business_date BETWEEN movement.business_date-15 AND movement.business_date
              AND sales.sale_invoice_count>0 AND sales.sale_amount_try>0 AND accepted.status='succeeded'
            UNION ALL
            SELECT 1 FROM ops.company_daily_kpi_unmapped_personnel_sales sales
            JOIN ops.company_daily_kpi_component_outcome accepted USING(component_outcome_id)
            JOIN ops.master_identity_code_reservation identity ON identity.entity_type='employee'
              AND identity.normalized_code=ops.normalize_master_external_code_v1(sales.personnel_code)
              AND identity.internal_id=person.employee_id
            LEFT JOIN stg.external_id_map mapping ON mapping.integration_source_id=accepted.integration_source_id
              AND mapping.entity_type='employee' AND mapping.external_id=sales.personnel_code AND mapping.is_active
            WHERE sales.store_id=store.store_id AND sales.business_date BETWEEN movement.business_date-15 AND movement.business_date
              AND (mapping.internal_id IS NULL OR mapping.internal_id=identity.internal_id)
              AND sales.sale_invoice_count>0 AND sales.sale_amount_try>0 AND accepted.status='succeeded'
          ) AS has_sales
        ) positive
        CROSS JOIN LATERAL (
          SELECT COUNT(DISTINCT sales.business_date)::int AS covered_days
          FROM ops.company_daily_kpi_store_sales sales
          JOIN ops.company_daily_kpi_component_outcome accepted USING(component_outcome_id)
          WHERE sales.store_id=store.store_id AND accepted.status='succeeded'
            AND sales.business_date BETWEEN movement.business_date-15 AND movement.business_date-1
        ) coverage
        WHERE movement.business_date BETWEEN $4::date AND $5::date
          AND outcome.status='succeeded' AND outcome.return_attribution_version=2
      ),
      filtered AS (
        SELECT * FROM classified WHERE ($6='inside' AND category='in_store' AND direction='received')
          OR ($6='other' AND (category<>'in_store' OR direction='external'))
      ),
      page AS (SELECT * FROM filtered ORDER BY business_date DESC, return_id ASC LIMIT $7 OFFSET $8),
      missing AS (
        SELECT expected.business_date FROM expected_days expected
        WHERE NOT EXISTS (SELECT 1 FROM accepted_sales sales WHERE sales.business_date=expected.business_date)
      )
      SELECT jsonb_build_object(
        'storeId',store.store_id::text,'periodStart',$4::text,'periodEnd',$5::text,'timezone','Europe/Istanbul',
        'totals',jsonb_build_object(
          'receivedSignedAmount',(SELECT SUM(signed_return_amount_try)::text FROM accepted_sales),
          'receivedInvoiceCount',(SELECT SUM(return_invoice_count) FROM accepted_sales),
          'externalSignedAmount',(SELECT COALESCE(SUM(signed_return_amount_try),0)::text FROM classified WHERE direction='external'),
          'netSales',(SELECT SUM(ROUND(net_amount_try,4))::text FROM accepted_sales)),
        'coverage',jsonb_build_object(
          'expectedDays',(SELECT COUNT(*) FROM expected_days),
          'coveredDays',(SELECT COUNT(*) FROM expected_days day JOIN accepted_sales USING(business_date)),
          'missingDates',(SELECT COALESCE(jsonb_agg(business_date::text ORDER BY business_date),'[]'::jsonb) FROM missing),
          'status',CASE WHEN NOT EXISTS(SELECT 1 FROM accepted_sales) THEN 'no_data'
            WHEN EXISTS(SELECT 1 FROM missing) OR EXISTS(SELECT 1 FROM classified WHERE category='review_required') THEN 'partial' ELSE 'complete' END,
          'unresolvedRows',(SELECT COUNT(*) FROM classified WHERE category='review_required')),
        'rows',(SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'returnId',return_id::text,'businessDate',business_date::text,'direction',direction,'category',category,
          'personnelCode',personnel_code,'employeeId',employee_id::text,'displayName',display_name,
          'receivingStoreCode',receiving_store_code,'receivingStoreName',receiving_store_name,
          'originalStoreCode',original_store_code,'originalStoreName',original_store_name,
          'signedAmount',signed_return_amount_try::text,'invoiceCount',return_invoice_count
        ) ORDER BY business_date DESC,return_id ASC),'[]'::jsonb) FROM page),
        'page',jsonb_build_object('total',(SELECT COUNT(*) FROM filtered),'limit',$7::int,'offset',$8::int)
      ) AS ledger FROM selected_store store
    `, [input.storeId,input.scope.companyIds,input.scope.storeIds,input.periodStart,input.periodEnd,
      input.category,input.limit,input.offset]);
    if (!result.rows[0]) throw new NotFoundException("Store not found");
    return result.rows[0].ledger;
  }
}
