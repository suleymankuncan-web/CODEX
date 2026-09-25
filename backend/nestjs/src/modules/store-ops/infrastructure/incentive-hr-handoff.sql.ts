const hrScopeSql = `
  WITH cutoff AS (
    SELECT LEAST(clock_timestamp(),
      ((($1::text || '-01')::date + INTERVAL '1 month') AT TIME ZONE 'Europe/Istanbul') - INTERVAL '1 microsecond') AS at_time
  ), latest_final_snapshot AS (
    SELECT DISTINCT ON (snapshot.store_id)
      snapshot.store_id, snapshot.company_id,
      snapshot.sales_target_incentive_final_snapshot_id AS final_snapshot_id
    FROM rpt.sales_target_incentive_final_snapshot snapshot
    WHERE snapshot.period_key = $1 AND snapshot.company_id = ANY($2::uuid[])
    ORDER BY snapshot.store_id, snapshot.close_cutoff_at DESC,
      snapshot.sales_target_incentive_final_snapshot_id DESC
  ), assigned_snapshot AS (
    SELECT store.company_id, store.store_id, latest.final_snapshot_id,
      manager.user_id AS manager_user_id
    FROM ops.store store
    LEFT JOIN latest_final_snapshot latest ON latest.store_id = store.store_id
    LEFT JOIN LATERAL (
      SELECT MIN(account.user_id::text)::uuid AS user_id
      FROM ops.user_action_store_assignment assignment
      JOIN ops.user_account account ON account.user_id = assignment.user_id AND account.is_active = TRUE
      JOIN ops.user_role_assignment role_assignment ON role_assignment.user_id = account.user_id
      JOIN ops.role role ON role.role_id = role_assignment.role_id AND role.role_code = 'REGION_MANAGER'
      CROSS JOIN cutoff
      WHERE assignment.store_id = store.store_id
        AND assignment.start_at <= cutoff.at_time
        AND (assignment.end_at IS NULL OR assignment.end_at > cutoff.at_time)
        AND role_assignment.start_at <= cutoff.at_time
        AND (role_assignment.end_at IS NULL OR role_assignment.end_at > cutoff.at_time)
      HAVING COUNT(DISTINCT account.user_id) = 1
    ) manager ON TRUE
    WHERE store.company_id = ANY($2::uuid[])
      AND store.store_type = 'company' AND store.status = 'active'
  )
`;

export const hrPackagesSql = `
  ${hrScopeSql}, required_manager AS (
    SELECT DISTINCT company_id, manager_user_id FROM assigned_snapshot
    UNION
    SELECT company_id, COALESCE(manager_user_id, submitted_by_user_id)
    FROM ops.sales_target_incentive_region_package
    WHERE period_key = $1 AND company_id = ANY($2::uuid[])
  )
  SELECT required.company_id::text, company.company_name,
    required.manager_user_id::text AS manager_user_id,
    package.sales_target_incentive_region_package_id::text AS package_id,
    package.package_status, package.submitted_at::text, package.reviewed_at::text,
    COALESCE(NULLIF(TRIM(CONCAT(employee.first_name, ' ', employee.last_name)), ''),
      account.username, account.email, 'Atanmamış') AS manager_name,
    ARRAY(SELECT store_id::text FROM ops.sales_target_incentive_region_package_store
      WHERE region_package_id = package.sales_target_incentive_region_package_id ORDER BY store_id) AS store_ids,
    (SELECT COUNT(*)::int FROM (
      SELECT ps.store_id FROM ops.sales_target_incentive_region_package_store ps
      LEFT JOIN latest_final_snapshot latest ON latest.store_id = ps.store_id
      LEFT JOIN assigned_snapshot assigned ON assigned.store_id = ps.store_id
      WHERE ps.region_package_id = package.sales_target_incentive_region_package_id
        AND (ps.final_snapshot_id IS DISTINCT FROM latest.final_snapshot_id
          OR assigned.manager_user_id IS DISTINCT FROM required.manager_user_id)
      UNION
      SELECT assigned.store_id FROM assigned_snapshot assigned
      WHERE assigned.company_id = required.company_id
        AND assigned.manager_user_id IS NOT DISTINCT FROM required.manager_user_id
        AND NOT EXISTS (SELECT 1 FROM ops.sales_target_incentive_region_package_store ps
          WHERE ps.region_package_id = package.sales_target_incentive_region_package_id
            AND ps.store_id = assigned.store_id)
    ) stale) AS stale_stores
  FROM required_manager required
  JOIN ops.company company ON company.company_id = required.company_id AND company.status = 'active'
  LEFT JOIN ops.sales_target_incentive_region_package package
    ON package.company_id = required.company_id AND package.period_key = $1
    AND COALESCE(package.manager_user_id, package.submitted_by_user_id)
      IS NOT DISTINCT FROM required.manager_user_id
  LEFT JOIN ops.user_account account ON account.user_id = required.manager_user_id
  LEFT JOIN ops.employee employee ON employee.employee_id = account.employee_id
  ORDER BY required.company_id, manager_name, package.submitted_at DESC NULLS LAST
`;

export const hrRowsSql = `
  SELECT package.company_id::text,
    COALESCE(package.manager_user_id, package.submitted_by_user_id)::text AS manager_user_id,
    package.sales_target_incentive_region_package_id::text AS package_id,
    ps.store_id::text, store.store_code, store.store_name,
    row.sales_target_incentive_final_row_id::text AS row_id, row.employee_id::text,
    NULLIF(TRIM(CONCAT(employee.first_name, ' ', employee.last_name)), '') AS display_name,
    row.position_code, row.target_amount::text, row.actual_sales_amount::text,
    row.achievement_pct::text, row.applied_rate::text, row.payable_amount::text,
    (row.final_amount + COALESCE(adjustments.amount, 0))::numeric(18,2)::text AS final_amount,
    correction.reason_note
  FROM ops.sales_target_incentive_region_package package
  JOIN ops.sales_target_incentive_region_package_store ps
    ON ps.region_package_id = package.sales_target_incentive_region_package_id
  JOIN ops.store store ON store.store_id = ps.store_id
  JOIN rpt.sales_target_incentive_final_row row ON row.final_snapshot_id = ps.final_snapshot_id
  JOIN ops.employee employee ON employee.employee_id = row.employee_id
  LEFT JOIN LATERAL (SELECT SUM(adjustment_amount) AS amount FROM ops.sales_target_incentive_adjustment
    WHERE final_row_id = row.sales_target_incentive_final_row_id AND adjustment_scope = 'final_snapshot' AND status = 'approved') adjustments ON TRUE
  LEFT JOIN ops.sales_target_incentive_region_correction correction
    ON correction.region_package_id = package.sales_target_incentive_region_package_id
    AND correction.final_row_id = row.sales_target_incentive_final_row_id AND correction.correction_status = 'admin_approved'
  WHERE package.period_key = $1 AND package.company_id = ANY($2::uuid[])
    AND package.package_status = 'admin_approved'
  ORDER BY package.company_id, manager_user_id, ps.store_id, row.sales_target_incentive_final_row_id
`;

export const hrGrantSql = `
  SELECT DISTINCT ura.company_id::text FROM ops.user_role_assignment ura
  JOIN ops.role role ON role.role_id = ura.role_id
  JOIN ops.user_account account ON account.user_id = ura.user_id
  JOIN ops.company company ON company.company_id = ura.company_id
  WHERE ura.user_id = $1::uuid AND ura.company_id = ANY($2::uuid[])
    AND role.role_code = 'REPORT_VIEWER' AND role.role_scope_type = 'company'
    AND ura.scope_type = 'company' AND ura.incentive_approval
    AND account.is_active = TRUE AND company.status = 'active'
    AND ura.start_at <= clock_timestamp() AND (ura.end_at IS NULL OR ura.end_at > clock_timestamp())
`;
