-- Read-only evidence for reviewing provisional personnel created by a daily
-- employee import. Supply bootstrap_source_code through psql -v; never write
-- credentials or real names to this file. No row from this query is an
-- automatic deletion or termination decision.
WITH provisional AS (
  SELECT raw.stg_employee_raw_id, raw.source_employee_id AS personnel_code,
    (raw.payload_json ->> 'employeeId')::uuid AS employee_id,
    batch.import_batch_id, batch.source_batch_id, batch.started_at::date AS imported_on
  FROM stg.employee_raw raw
  INNER JOIN stg.import_batch batch ON batch.import_batch_id = raw.import_batch_id
  INNER JOIN stg.integration_source source ON source.integration_source_id = batch.integration_source_id
  WHERE source.source_code = :'bootstrap_source_code'
    AND raw.processed_flag = TRUE
    AND raw.payload_json -> 'bootstrapDefaults' ->> 'ownerApproved' = 'true'
), evidence AS (
  SELECT provisional.*, employee.employment_status, employee.termination_date,
    totals.first_observed_on,
    COALESCE(first_day.sale_amount, 0) AS first_day_sale_amount,
    COALESCE(first_day.return_amount, 0) AS first_day_return_amount,
    COALESCE(totals.all_sale_amount, 0) AS all_recorded_sale_amount,
    COALESCE(totals.all_return_amount, 0) AS all_recorded_return_amount
  FROM provisional
  INNER JOIN ops.employee employee ON employee.employee_id = provisional.employee_id
  LEFT JOIN LATERAL (
    SELECT MIN(sales.business_date) AS first_observed_on,
      SUM(sales.sale_amount_try) AS all_sale_amount,
      SUM(sales.signed_return_amount_try) AS all_return_amount
    FROM ops.company_daily_kpi_employee_sales sales
    WHERE sales.employee_id = provisional.employee_id
  ) totals ON TRUE
  LEFT JOIN LATERAL (
    SELECT SUM(sales.sale_amount_try) AS sale_amount,
      SUM(sales.signed_return_amount_try) AS return_amount
    FROM ops.company_daily_kpi_employee_sales sales
    WHERE sales.employee_id = provisional.employee_id
      AND sales.business_date = totals.first_observed_on
  ) first_day ON TRUE
), active_assignment AS (
  SELECT assignment.employee_id, COUNT(*) FILTER (
    WHERE assignment.is_primary_assignment = TRUE) AS primary_count,
    ARRAY_AGG(DISTINCT store.store_code ORDER BY store.store_code) AS active_store_codes
  FROM ops.employee_assignment_history assignment
  INNER JOIN ops.store store ON store.store_id = assignment.store_id
  WHERE assignment.assignment_status = 'active'
    AND assignment.start_date <= (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Istanbul')::date
    AND (assignment.end_date IS NULL OR assignment.end_date >= (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Istanbul')::date)
  GROUP BY assignment.employee_id
)
SELECT evidence.personnel_code, evidence.employee_id, evidence.import_batch_id,
  evidence.source_batch_id, evidence.imported_on, evidence.first_observed_on, evidence.employment_status,
  evidence.termination_date, evidence.first_day_sale_amount,
  evidence.first_day_return_amount, evidence.all_recorded_sale_amount,
  evidence.all_recorded_return_amount,
  COALESCE(active_assignment.primary_count, 0) AS active_primary_count,
  COALESCE(active_assignment.active_store_codes, ARRAY[]::text[]) AS active_store_codes,
  CASE
    WHEN evidence.all_recorded_sale_amount <= 0 AND evidence.all_recorded_return_amount < 0
      THEN 'return_only_bootstrap_review'
    WHEN evidence.all_recorded_sale_amount <= 0 THEN 'no_recorded_positive_sale_review'
    WHEN evidence.first_day_sale_amount <= 0 THEN 'later_positive_sale_review'
    WHEN COALESCE(active_assignment.primary_count, 0) > 1 THEN 'multiple_active_primary_assignments_review'
    WHEN evidence.employment_status <> 'active' AND COALESCE(active_assignment.primary_count, 0) > 0
      THEN 'inactive_employee_active_assignment_review'
    ELSE 'provisional_source_review'
  END AS review_reason
FROM evidence
LEFT JOIN active_assignment ON active_assignment.employee_id = evidence.employee_id
ORDER BY evidence.imported_on DESC, evidence.personnel_code;
