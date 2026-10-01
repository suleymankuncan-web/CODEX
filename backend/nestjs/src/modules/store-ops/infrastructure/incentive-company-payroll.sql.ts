const sealedCycle = `FROM ops.incentive_company_cycle cycle
  JOIN ops.incentive_company_revision revision ON revision.cycle_id=cycle.cycle_id AND revision.revision_no=cycle.current_revision
  WHERE cycle.period_key=$1 AND cycle.company_id=ANY($2::uuid[])`;

export const companyPayrollPackagesSql = `WITH sealed AS (SELECT cycle.*,revision.seal_hash,revision.payload ${sealedCycle})
  SELECT s.company_id::text,s.payload->>'companyName' AS company_name,
    p->>'manager_user_id' AS manager_user_id,p->>'sales_target_incentive_region_package_id' AS package_id,
    CASE WHEN s.stage='final' AND EXISTS(SELECT 1 FROM ops.incentive_company_decision d WHERE d.cycle_id=s.cycle_id
      AND d.revision_no=s.current_revision AND d.seal_hash=s.seal_hash AND d.stage='general_manager' AND d.decision='approve')
      THEN 'admin_approved' ELSE 'submitted' END AS package_status,
    p->>'submitted_at' AS submitted_at,
    (SELECT decided_at::text FROM ops.incentive_company_decision d WHERE d.cycle_id=s.cycle_id AND d.revision_no=s.current_revision
      AND d.stage='general_manager' AND d.decision='approve') AS reviewed_at,
    s.payload->'managerNames'->>(p->>'manager_user_id') AS manager_name,
    ARRAY(SELECT item->>'store_id' FROM jsonb_array_elements(s.payload->'stores') item
      WHERE item->>'region_package_id'=p->>'sales_target_incentive_region_package_id' ORDER BY item->>'store_id') AS store_ids,
    (SELECT COALESCE(jsonb_agg(jsonb_build_object('storeId',item->>'store_id','finalSnapshotId',item->>'final_snapshot_id',
      'participationRevisionNo',item->'participation_revision_no','exclusions',item->'participation_exclusions_json') ORDER BY item->>'store_id'),'[]'::jsonb)
      FROM jsonb_array_elements(s.payload->'stores') item WHERE item->>'region_package_id'=p->>'sales_target_incentive_region_package_id') AS frozen_participation,
    CASE WHEN s.stage='final' THEN 0 ELSE 1 END AS stale_stores,
    'company_cycle' AS approval_origin,s.cycle_id::text AS final_cycle_id,s.current_revision AS final_revision_no,s.seal_hash AS final_seal_hash,
    (SELECT COALESCE(NULLIF(BTRIM(CONCAT_WS(' ',account.first_name,account.last_name)),''),
        NULLIF(BTRIM(CONCAT_WS(' ',employee.first_name,employee.last_name)),''),account.username)
      FROM ops.incentive_company_decision d JOIN ops.user_account account ON account.user_id=d.actor_user_id
        LEFT JOIN ops.employee employee ON employee.employee_id=account.employee_id
      WHERE d.cycle_id=s.cycle_id AND d.revision_no=s.current_revision AND d.stage='general_manager' AND d.decision='approve') AS final_approver_name,p->>'submission_note' AS submission_note,
    (SELECT COALESCE(jsonb_agg(jsonb_build_object('storeId',item->>'store_id','storeCode',item->>'store_code','storeName',item->>'store_name',
      'target',item->'source'->>'store_target_amount','net',item->'source'->>'store_net_sales_amount','achievement',item->'source'->>'store_achievement_pct',
      'gross',sale->>'gross','returns',sale->>'returns') ORDER BY item->>'store_id'),'[]'::jsonb)
      FROM jsonb_array_elements(s.payload->'stores') item
      LEFT JOIN LATERAL (SELECT sale FROM jsonb_array_elements(s.payload->'sales'->'stores') sale
        WHERE sale->>'storeId'=item->>'store_id' AND (sale->>'net')::numeric=(item->'source'->>'store_net_sales_amount')::numeric) detail ON TRUE
      WHERE item->>'region_package_id'=p->>'sales_target_incentive_region_package_id') AS store_details
  FROM sealed s CROSS JOIN LATERAL jsonb_array_elements(s.payload->'packages') p`;

export const companyPayrollRowsSql = `WITH sealed AS (SELECT cycle.*,revision.seal_hash,revision.payload ${sealedCycle})
  SELECT s.company_id::text,p->>'manager_user_id' AS manager_user_id,
    row->>'region_package_id' AS package_id,row->>'store_id' AS store_id,
    store->>'store_code' AS store_code,store->>'store_name' AS store_name,
    row->>'sales_target_incentive_final_row_id' AS row_id,row->>'employee_id' AS employee_id,
    person->>'display_name' AS display_name,row->>'position_code' AS position_code,
    row->>'target_amount' AS target_amount,row->>'actual_sales_amount' AS actual_sales_amount,
    row->>'achievement_pct' AS achievement_pct,row->>'applied_rate' AS applied_rate,
    row->>'payable_amount' AS payable_amount,row->>'effective_contribution' AS final_amount,
    (SELECT proposal->>'reason_note' FROM jsonb_array_elements(s.payload->'proposals') proposal
      WHERE proposal->>'final_row_id'=row->>'sales_target_incentive_final_row_id') AS reason_note,row->>'raw_baseline' AS raw_baseline,row->>'proposed_amount' AS proposed_amount,
    detail.sale->>'gross' AS gross_sales,detail.sale->>'returns' AS signed_returns
  FROM sealed s CROSS JOIN LATERAL jsonb_array_elements(s.payload->'rows') row
    CROSS JOIN LATERAL jsonb_array_elements(s.payload->'stores') store
    CROSS JOIN LATERAL jsonb_array_elements(s.payload->'packages') p
    CROSS JOIN LATERAL jsonb_array_elements(s.payload->'roster') person
    LEFT JOIN LATERAL (SELECT sale FROM jsonb_array_elements(CASE WHEN row->>'participant_type'='manager' THEN s.payload->'sales'->'stores' ELSE s.payload->'sales'->'people' END) sale
      WHERE sale->>'storeId'=row->>'store_id' AND (row->>'participant_type'='manager' OR sale->>'employeeId'=row->>'employee_id')
        AND (sale->>'net')::numeric=(row->>'actual_sales_amount')::numeric) detail ON TRUE
  WHERE s.stage='final' AND EXISTS(SELECT 1 FROM ops.incentive_company_decision d WHERE d.cycle_id=s.cycle_id
    AND d.revision_no=s.current_revision AND d.seal_hash=s.seal_hash AND d.stage='general_manager' AND d.decision='approve')
    AND store->>'store_id'=row->>'store_id' AND p->>'sales_target_incentive_region_package_id'=row->>'region_package_id'
    AND person->>'store_id'=row->>'store_id' AND person->>'employee_id'=row->>'employee_id' AND (person->>'included')::boolean
  ORDER BY s.company_id,row->>'region_package_id',row->>'store_id',row->>'sales_target_incentive_final_row_id'`;
