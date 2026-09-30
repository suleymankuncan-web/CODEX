// $1 company, $2 period. Responsibility is live authority; roster dates are data scope.
export const companyStoresSql = `SELECT store_id::text FROM ops.store
  WHERE company_id=$1::uuid AND status='active'
    AND ops.store_was_company_during(store_id,($2::text||'-01')::date,
      (($2::text||'-01')::date+INTERVAL '1 month - 1 day')::date) ORDER BY store_id`;

export const companyResponsibilitySql = `SELECT s.store_id::text,
  array_agg(DISTINCT a.user_id::text) FILTER (WHERE a.user_id IS NOT NULL) AS owners
  FROM ops.store s LEFT JOIN LATERAL (
    SELECT account.user_id FROM ops.user_action_store_assignment assigned
    JOIN ops.user_account account ON account.user_id=assigned.user_id AND account.is_active
    JOIN ops.user_role_assignment ura ON ura.user_id=account.user_id
    JOIN ops.role role ON role.role_id=ura.role_id AND role.role_code='REGION_MANAGER'
    WHERE assigned.store_id=s.store_id AND assigned.start_at<=clock_timestamp()
      AND (assigned.end_at IS NULL OR assigned.end_at>clock_timestamp())
      AND ura.start_at<=clock_timestamp() AND (ura.end_at IS NULL OR ura.end_at>clock_timestamp())
    FOR SHARE OF assigned,account,ura
  ) a ON TRUE
  WHERE s.company_id=$1::uuid AND s.status='active'
    AND ops.store_was_company_during(s.store_id,($2::text||'-01')::date,
      (($2::text||'-01')::date+INTERVAL '1 month - 1 day')::date)
  GROUP BY s.store_id ORDER BY s.store_id`;

export const companyReadinessSql = `WITH latest AS (
  SELECT DISTINCT ON (store_id) * FROM rpt.sales_target_incentive_final_snapshot
  WHERE company_id=$1::uuid AND period_key=$2 ORDER BY store_id,close_cutoff_at DESC,sales_target_incentive_final_snapshot_id DESC
), required AS (SELECT unnest($3::uuid[]) AS store_id)
SELECT required.store_id::text, p.sales_target_incentive_region_package_id::text AS package_id,
  COALESCE(p.manager_user_id,p.submitted_by_user_id)::text AS owner_id,
  p.package_status, p.company_id::text AS package_company_id, p.period_key AS package_period,
  p.package_scope, ps.final_snapshot_id::text,
  (latest.sales_target_incentive_final_snapshot_id=ps.final_snapshot_id
    AND p.submitted_by_user_id=COALESCE(p.manager_user_id,p.submitted_by_user_id)
    AND review.final_snapshot_id=ps.final_snapshot_id AND review.review_status='reviewed'
    AND review.reviewed_by_user_id=COALESCE(p.manager_user_id,p.submitted_by_user_id)
    AND ps.reviewed_by_user_id=review.reviewed_by_user_id AND ps.reviewed_at=review.reviewed_at
    AND ps.company_id=$1::uuid AND ps.period_key=$2
    AND ps.participation_revision_no=COALESCE(participation.revision_no,0)
    AND ps.participation_exclusions_json=COALESCE(participation.exclusions_json,'[]'::jsonb)) AS ready
FROM required LEFT JOIN ops.sales_target_incentive_region_package_store ps ON ps.store_id=required.store_id AND ps.period_key=$2
LEFT JOIN ops.sales_target_incentive_region_package p ON p.sales_target_incentive_region_package_id=ps.region_package_id
  AND p.package_status IN ('submitted','admin_approved')
LEFT JOIN latest ON latest.store_id=required.store_id
LEFT JOIN ops.sales_target_incentive_store_review review ON review.store_id=required.store_id AND review.period_key=$2
LEFT JOIN LATERAL (SELECT revision_no,exclusions_json FROM ops.sales_target_incentive_participation_revision
  WHERE store_id=required.store_id AND period_key=$2 AND final_snapshot_id=ps.final_snapshot_id ORDER BY revision_no DESC LIMIT 1) participation ON TRUE
ORDER BY required.store_id,p.sales_target_incentive_region_package_id`;

// Archive complete source rows, not totals or mutable package references alone.
// Explicit money strings preserve PostgreSQL decimal precision across JSON clients.
export const companyPayloadSql = `WITH packages AS (
  SELECT * FROM ops.sales_target_incentive_region_package WHERE sales_target_incentive_region_package_id=ANY($3::uuid[])
), stores AS (
  SELECT ps.*,s.store_code,s.store_name FROM ops.sales_target_incentive_region_package_store ps
  JOIN ops.store s ON s.store_id=ps.store_id WHERE ps.region_package_id=ANY($3::uuid[])
), financial AS (
  SELECT ps.store_id,ps.region_package_id,row.*,
    (row.final_amount+COALESCE(adjustments.amount,0))::numeric(18,2)::text AS raw_baseline,
    COALESCE(correction.final_amount,row.final_amount+COALESCE(adjustments.amount,0))::numeric(18,2)::text AS proposed_amount,
    CASE WHEN EXISTS (SELECT 1 FROM jsonb_array_elements(ps.participation_exclusions_json) e WHERE e->>'employeeId'=row.employee_id::text)
      THEN '0.00' ELSE COALESCE(correction.final_amount,row.final_amount+COALESCE(adjustments.amount,0))::numeric(18,2)::text END AS effective_contribution,
    employee.first_name,employee.last_name,employee.external_employee_ref,
    adjustments.evidence AS adjustment_evidence
  FROM stores ps JOIN rpt.sales_target_incentive_final_row row ON row.final_snapshot_id=ps.final_snapshot_id
  JOIN ops.employee employee ON employee.employee_id=row.employee_id
  LEFT JOIN LATERAL (SELECT SUM(adjustment_amount) AS amount,
    COALESCE(jsonb_agg(to_jsonb(a)||jsonb_build_object('adjustment_amount',a.adjustment_amount::text,'before_amount',a.before_amount::text,
      'after_amount',a.after_amount::text) ORDER BY a.sales_target_incentive_adjustment_id),'[]'::jsonb) AS evidence
    FROM ops.sales_target_incentive_adjustment a WHERE a.final_row_id=row.sales_target_incentive_final_row_id
      AND a.adjustment_scope='final_snapshot' AND a.status='approved') adjustments ON TRUE
  LEFT JOIN ops.sales_target_incentive_region_correction correction ON correction.region_package_id=ps.region_package_id
    AND correction.final_row_id=row.sales_target_incentive_final_row_id AND correction.correction_status='submitted'
), roster AS (
  SELECT ps.store_id,e.employee_id,
    COALESCE(NULLIF(BTRIM(CONCAT(e.first_name,' ',e.last_name)),''),e.external_employee_ref,e.employee_id::text) AS display_name,
    e.employment_status, e.termination_date, to_jsonb(assignment) AS assignment,
    to_jsonb(target)||jsonb_build_object('target_value',target.target_value::text) AS target,
    COALESCE(assignment.position_code,(SELECT position_code FROM financial f WHERE f.store_id=ps.store_id AND f.employee_id=e.employee_id LIMIT 1)) AS position_code,
    NOT EXISTS (SELECT 1 FROM jsonb_array_elements(ps.participation_exclusions_json) excluded WHERE excluded->>'employeeId'=e.employee_id::text) AS included,
    (SELECT excluded->>'reasonNote' FROM jsonb_array_elements(ps.participation_exclusions_json) excluded WHERE excluded->>'employeeId'=e.employee_id::text) AS reason_note
  FROM stores ps JOIN ops.employee e ON EXISTS (SELECT 1 FROM financial f WHERE f.store_id=ps.store_id AND f.employee_id=e.employee_id)
    OR EXISTS (SELECT 1 FROM ops.employee_assignment_history h WHERE h.employee_id=e.employee_id AND h.store_id=ps.store_id
      AND h.is_primary_assignment AND h.start_date<= (($2::text||'-01')::date+INTERVAL '1 month - 1 day')::date
      AND (h.end_date IS NULL OR h.end_date>= (($2::text||'-01')::date+INTERVAL '1 month - 1 day')::date))
    OR EXISTS (SELECT 1 FROM jsonb_array_elements(ps.participation_exclusions_json) excluded WHERE excluded->>'employeeId'=e.employee_id::text)
  LEFT JOIN LATERAL (SELECT h.*,position.position_code FROM ops.employee_assignment_history h
    JOIN ops.position position ON position.position_id=h.position_id WHERE h.employee_id=e.employee_id AND h.store_id=ps.store_id
      AND h.is_primary_assignment AND h.start_date<= (($2::text||'-01')::date+INTERVAL '1 month - 1 day')::date
      AND (h.end_date IS NULL OR h.end_date>= (($2::text||'-01')::date+INTERVAL '1 month - 1 day')::date)
    ORDER BY h.start_date DESC,h.created_at DESC,h.assignment_id DESC LIMIT 1) assignment ON TRUE
  LEFT JOIN LATERAL (SELECT request.target_distribution_request_id FROM ops.target_distribution_request request
    JOIN ops.store store ON store.store_id=ps.store_id AND request.company_id=store.company_id AND request.region_id=store.region_id
    WHERE request.store_id=ps.store_id AND request.request_month=($2::text||'-01')::date AND request.request_status='approved'
    ORDER BY request.approved_at DESC NULLS LAST,request.updated_at DESC,request.created_at DESC,request.target_distribution_request_id DESC LIMIT 1) request ON TRUE
  LEFT JOIN LATERAL (SELECT reference.* FROM ops.personnel_target_reference reference
    WHERE reference.employee_id=e.employee_id AND reference.store_id=ps.store_id AND reference.source_request_id=request.target_distribution_request_id
      AND reference.period_start=($2::text||'-01')::date AND reference.period_end=(($2::text||'-01')::date+INTERVAL '1 month - 1 day')::date
      AND reference.target_type='monthly_sales_target' AND reference.status='approved'
    ORDER BY reference.personnel_target_reference_id DESC LIMIT 1) target ON TRUE
), proposals AS (
  SELECT c.*,f.raw_baseline FROM ops.sales_target_incentive_region_correction c
  JOIN financial f ON f.sales_target_incentive_final_row_id=c.final_row_id AND f.region_package_id=c.region_package_id
  WHERE c.region_package_id=ANY($3::uuid[]) AND c.correction_status='submitted'
)
SELECT jsonb_build_object('contract','incentive-company-seal-v1','companyId',$1::text,'period',$2::text,
  'companyName',(SELECT company_name FROM ops.company WHERE company_id=$1::uuid),
  'managerNames',(SELECT COALESCE(jsonb_object_agg(p.manager_user_id::text,
    COALESCE(NULLIF(BTRIM(CONCAT(e.first_name,' ',e.last_name)),''),a.username,a.user_id::text)),'{}'::jsonb)
    FROM packages p JOIN ops.user_account a ON a.user_id=p.manager_user_id LEFT JOIN ops.employee e ON e.employee_id=a.employee_id),
  'responsibility',$4::jsonb,
  'packages',(SELECT COALESCE(jsonb_agg(to_jsonb(p) ORDER BY p.sales_target_incentive_region_package_id),'[]'::jsonb) FROM packages p),
  'stores',(SELECT COALESCE(jsonb_agg(to_jsonb(ps) || jsonb_build_object('source',to_jsonb(snapshot)||jsonb_build_object(
    'store_target_amount',snapshot.store_target_amount::text,'store_net_sales_amount',snapshot.store_net_sales_amount::text,
    'store_achievement_pct',snapshot.store_achievement_pct::text)) ORDER BY ps.store_id),'[]'::jsonb)
    FROM stores ps JOIN rpt.sales_target_incentive_final_snapshot snapshot ON snapshot.sales_target_incentive_final_snapshot_id=ps.final_snapshot_id),
  'roster',(SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.store_id,r.employee_id),'[]'::jsonb) FROM roster r),
  'rows',(SELECT COALESCE(jsonb_agg(to_jsonb(f)||jsonb_build_object('final_amount',f.final_amount::text,'payable_amount',f.payable_amount::text,
    'target_amount',f.target_amount::text,'actual_sales_amount',f.actual_sales_amount::text,'achievement_pct',f.achievement_pct::text,
    'applied_rate',f.applied_rate::text,'raw_earned_amount',f.raw_earned_amount::text,'correction_amount',f.correction_amount::text,
    'adjustment_amount',f.adjustment_amount::text) ORDER BY f.store_id,f.employee_id,f.participant_type),'[]'::jsonb) FROM financial f),
  'proposals',(SELECT COALESCE(jsonb_agg(to_jsonb(p)||jsonb_build_object('before_amount',p.before_amount::text,'final_amount',p.final_amount::text)
    ORDER BY p.sales_target_incentive_region_correction_id),'[]'::jsonb) FROM proposals p),
  'total',(SELECT COALESCE(SUM(effective_contribution::numeric),0)::numeric(18,2)::text FROM financial)) AS payload`;
