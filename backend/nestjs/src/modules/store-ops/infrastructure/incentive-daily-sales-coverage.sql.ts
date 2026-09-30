/** Readiness and the close transaction use the same immutable cutoff contract. */
export type IncentiveMissingSalesDay = { store_id: string; business_date: string };

export const incentiveDailySalesCoverageSql = `
  WITH selected AS (
    SELECT store.* FROM ops.store store
    WHERE store.company_id=ANY($1::uuid[]) AND store.kpi_import_enabled
      AND ($6::boolean OR store.store_id=ANY($2::uuid[]))
      AND ($6::boolean OR EXISTS (
        SELECT 1 FROM ops.kpi_actual actual JOIN ops.kpi_definition definition USING(kpi_id)
        WHERE actual.store_id=store.store_id AND definition.kpi_code='NET_SALES'
          AND actual.scope_type='store' AND actual.period_type='daily'
          AND actual.period_start BETWEEN $3::date AND $4::date
          AND actual.source_type='integration'
      ))
  ), expected AS (
    SELECT store.store_id,store.company_id,day::date AS business_date FROM selected store
    CROSS JOIN LATERAL generate_series(
      GREATEST($3::date,COALESCE(store.open_date,$3::date)),
      LEAST($4::date,COALESCE(store.close_date,$4::date)),INTERVAL '1 day') day
    WHERE ops.store_type_as_of(store.store_id,day::date)='company'
  )
  SELECT expected.store_id::text,expected.business_date::text FROM expected
  WHERE NOT EXISTS (
    SELECT 1 FROM ops.company_daily_kpi_store_sales sales
    JOIN ops.company_daily_kpi_component_outcome outcome USING(component_outcome_id)
    WHERE sales.store_id=expected.store_id AND sales.business_date=expected.business_date
      AND outcome.status='succeeded' AND outcome.operation='sales' AND outcome.return_attribution_version=2
      AND outcome.accepted_at<=$5::timestamptz AND outcome.updated_at<=$5::timestamptz
      AND EXISTS (
        SELECT 1 FROM ops.kpi_actual actual JOIN ops.kpi_definition definition USING(kpi_id)
        JOIN stg.import_batch batch ON
          (batch.source_batch_id=actual.source_batch_id OR batch.import_batch_id::text=actual.source_batch_id)
          AND batch.integration_source_id=outcome.integration_source_id
          AND batch.entity_type='kpi' AND batch.status='completed' AND batch.error_count=0
          AND expected.company_id=ANY(batch.company_ids) AND batch.finished_at<=$5::timestamptz
        WHERE actual.store_id=expected.store_id AND actual.scope_type='store'
          AND actual.period_type='daily' AND actual.period_start=expected.business_date
          AND actual.period_end=expected.business_date AND actual.source_type='integration'
          AND definition.kpi_code='NET_SALES' AND definition.is_active
          AND actual.actual_value=ROUND(sales.net_amount_try,4)
          AND actual.last_synced_at<=$5::timestamptz AND actual.calculated_at<=$5::timestamptz
      )
      AND NOT EXISTS (
        SELECT 1 FROM ops.company_daily_kpi_return movement
        JOIN ops.company_daily_kpi_component_outcome accepted USING(component_outcome_id)
        WHERE movement.store_id=expected.store_id AND movement.business_date=expected.business_date
          AND accepted.status='succeeded' AND movement.return_kind='unresolved'
      )
  ) ORDER BY expected.store_id,expected.business_date
`;

export function dailySalesCoverageParams(input: {
  companyIds: string[]; storeIds: string[]; periodStart: string; periodEnd: string;
  closeCutoffAt: string; forceDaily: boolean;
}) {
  return [input.companyIds,input.storeIds,input.periodStart,input.periodEnd,input.closeCutoffAt,input.forceDaily];
}
