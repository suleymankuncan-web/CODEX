WITH violations AS (
    SELECT 'INC-CYCLE-01'::text AS check_id, concat_ws(':',r.cycle_id,r.revision_no) AS record_id
    FROM ops.incentive_company_revision r JOIN ops.incentive_company_cycle c ON c.cycle_id=r.cycle_id
    WHERE r.seal_hash IS DISTINCT FROM encode(digest(r.payload::text,'sha256'),'hex')
      OR r.payload->>'companyId' IS DISTINCT FROM c.company_id::text OR r.payload->>'period' IS DISTINCT FROM c.period_key::text
      OR EXISTS(SELECT 1 FROM jsonb_array_elements(r.payload->'packages') p
        WHERE p->>'company_id' IS DISTINCT FROM c.company_id::text OR p->>'period_key' IS DISTINCT FROM c.period_key::text)
      OR EXISTS(SELECT 1 FROM jsonb_array_elements(r.payload->'stores') s
        WHERE s->>'company_id' IS DISTINCT FROM c.company_id::text OR s->'source'->>'company_id' IS DISTINCT FROM c.company_id::text
          OR s->>'period_key' IS DISTINCT FROM c.period_key::text OR s->'source'->>'period_key' IS DISTINCT FROM c.period_key::text)
    UNION ALL
    SELECT 'INC-CYCLE-02',c.cycle_id::text FROM ops.incentive_company_cycle c
    WHERE (c.current_revision>0 AND NOT EXISTS(SELECT 1 FROM ops.incentive_company_revision r WHERE r.cycle_id=c.cycle_id AND r.revision_no=c.current_revision))
      OR (c.stage IN ('hr','general_manager','final') AND NOT EXISTS(SELECT 1 FROM ops.incentive_company_decision d WHERE d.cycle_id=c.cycle_id AND d.revision_no=c.current_revision AND d.stage='sales_director' AND d.decision='approve'))
      OR (c.stage IN ('general_manager','final') AND NOT EXISTS(SELECT 1 FROM ops.incentive_company_decision d WHERE d.cycle_id=c.cycle_id AND d.revision_no=c.current_revision AND d.stage='hr' AND d.decision='approve'))
      OR (c.stage='final' AND NOT EXISTS(SELECT 1 FROM ops.incentive_company_decision d WHERE d.cycle_id=c.cycle_id AND d.revision_no=c.current_revision AND d.stage='general_manager' AND d.decision='approve'))
      OR EXISTS(SELECT 1 FROM ops.incentive_company_decision d JOIN ops.incentive_company_revision r USING(cycle_id,revision_no,seal_hash)
        CROSS JOIN LATERAL jsonb_array_elements(r.payload->'packages') p WHERE d.cycle_id=c.cycle_id AND p->>'submitted_by_user_id'=d.actor_user_id::text)
    UNION ALL
    SELECT 'INC-CYCLE-03',a.sales_target_incentive_adjustment_id::text FROM ops.sales_target_incentive_adjustment a
    WHERE a.status='approved' AND a.evidence ? 'companySealHash' AND NOT EXISTS (
      SELECT 1 FROM ops.incentive_company_revision r JOIN ops.incentive_company_cycle c USING(cycle_id)
      JOIN ops.incentive_company_decision d USING(cycle_id,revision_no,seal_hash)
      CROSS JOIN LATERAL jsonb_array_elements(r.payload->'proposals') p
      WHERE c.company_id=a.company_id AND c.period_key=a.period_key AND r.seal_hash=a.evidence->>'companySealHash'
        AND d.stage='general_manager' AND d.decision='approve' AND d.actor_user_id=a.approved_by_user_id
        AND p->>'sales_target_incentive_region_correction_id'=a.evidence->>'regionCorrectionId'
        AND p->>'final_row_id'=a.final_row_id::text AND p->>'employee_id'=a.employee_id::text AND p->>'store_id'=a.store_id::text
        AND (p->>'raw_baseline')::numeric=a.before_amount AND (p->>'final_amount')::numeric=a.after_amount
        AND a.adjustment_amount=a.after_amount-a.before_amount)
    UNION ALL
    SELECT 'INC-CYCLE-04',delivery.delivery_id::text FROM ops.incentive_hr_delivery delivery
    WHERE delivery.final_cycle_id IS NOT NULL AND NOT EXISTS(
      SELECT 1 FROM ops.incentive_company_cycle c JOIN ops.incentive_company_decision d USING(cycle_id)
      WHERE c.cycle_id=delivery.final_cycle_id AND c.company_id=delivery.company_id AND c.period_key=delivery.period_key
        AND c.stage='final' AND c.current_revision=delivery.final_revision_no AND d.revision_no=delivery.final_revision_no
        AND d.seal_hash=delivery.final_seal_hash AND d.stage='general_manager' AND d.decision='approve')
), checks AS (SELECT unnest(ARRAY['INC-CYCLE-01','INC-CYCLE-02','INC-CYCLE-03','INC-CYCLE-04']) AS check_id)
SELECT checks.check_id,'authorization'::text AS category,COUNT(violations.record_id)::bigint AS violation_count,
    COALESCE((array_agg(substr(md5(violations.record_id),1,12) ORDER BY violations.record_id)
      FILTER(WHERE violations.record_id IS NOT NULL))[1:5],ARRAY[]::text[]) AS sample_refs
FROM checks LEFT JOIN violations ON violations.check_id=checks.check_id GROUP BY checks.check_id ORDER BY checks.check_id;
