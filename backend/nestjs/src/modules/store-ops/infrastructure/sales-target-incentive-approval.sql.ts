export const latestFinalSnapshotCte = `
  WITH latest_final_snapshot AS (
    SELECT DISTINCT ON (snapshot.period_key, snapshot.store_id)
      snapshot.sales_target_incentive_final_snapshot_id, snapshot.period_key, snapshot.store_id
    FROM rpt.sales_target_incentive_final_snapshot snapshot
    WHERE snapshot.period_key = $1 AND snapshot.store_id = ANY($2::uuid[])
    ORDER BY snapshot.period_key, snapshot.store_id, snapshot.close_cutoff_at DESC,
      snapshot.sales_target_incentive_final_snapshot_id DESC
  )
`;

export const ensureSubmittedCorrectionsApprovableSql = `
  WITH submitted_correction AS (
    SELECT *
    FROM ops.sales_target_incentive_region_correction
    WHERE region_package_id = $1
      AND correction_status = 'submitted'
  ),
  correction_lock AS (
    SELECT pg_advisory_xact_lock(hashtext(
      CONCAT_WS(
        ':',
        'sales_target_incentive_adjustment',
        correction.period_key,
        correction.store_id,
        correction.employee_id,
        correction.participant_type,
        correction.target_scope
      )
    )::bigint) AS lock_acquired
    FROM (
      SELECT *
      FROM submitted_correction
      ORDER BY store_id ASC, employee_id ASC, participant_type ASC
    ) correction
  ),
  locked_final_row AS (
    SELECT final_row.sales_target_incentive_final_row_id, final_row.final_snapshot_id, final_row.final_amount
    FROM rpt.sales_target_incentive_final_row final_row
    INNER JOIN submitted_correction correction
      ON correction.final_row_id = final_row.sales_target_incentive_final_row_id
    CROSS JOIN (SELECT COUNT(*) AS lock_count FROM correction_lock) lock_barrier
    FOR UPDATE OF final_row
  ),
  latest_final_snapshot AS (
    SELECT DISTINCT ON (snapshot.period_key, snapshot.store_id)
      snapshot.sales_target_incentive_final_snapshot_id, snapshot.period_key, snapshot.store_id
    FROM rpt.sales_target_incentive_final_snapshot snapshot
    INNER JOIN submitted_correction correction
      ON correction.period_key = snapshot.period_key
      AND correction.store_id = snapshot.store_id
    ORDER BY snapshot.period_key, snapshot.store_id, snapshot.close_cutoff_at DESC,
      snapshot.sales_target_incentive_final_snapshot_id DESC
  ),
  live_correction AS (
    SELECT
      correction.sales_target_incentive_region_correction_id,
      correction.final_amount,
      latest_snapshot.sales_target_incentive_final_snapshot_id IS NOT NULL AS targets_latest_snapshot,
      (final_row.final_amount + approved_adjustment.amount)::numeric(18,2) AS current_amount
    FROM submitted_correction correction
    INNER JOIN locked_final_row final_row
      ON final_row.sales_target_incentive_final_row_id = correction.final_row_id
    LEFT JOIN latest_final_snapshot latest_snapshot
      ON latest_snapshot.sales_target_incentive_final_snapshot_id = final_row.final_snapshot_id
    LEFT JOIN LATERAL (
      SELECT COALESCE(SUM(adjustment.adjustment_amount) FILTER (WHERE adjustment.status = 'approved'), 0)::numeric(18,2) AS amount
      FROM ops.sales_target_incentive_adjustment adjustment
      WHERE adjustment.final_row_id = final_row.sales_target_incentive_final_row_id
        AND adjustment.adjustment_scope = 'final_snapshot'
    ) approved_adjustment ON TRUE
  )
  SELECT
    COUNT(*) FILTER (WHERE NOT targets_latest_snapshot)::text AS stale_snapshot_count,
    COUNT(*) FILTER (WHERE targets_latest_snapshot AND current_amount = final_amount)::text AS already_current_count
  FROM live_correction
`;

export const ensurePackageStoresCurrentSql = `
  WITH package_store AS (
    SELECT *
    FROM ops.sales_target_incentive_region_package_store
    WHERE region_package_id = $1
  ),
  latest_final_snapshot AS (
    SELECT DISTINCT ON (snapshot.period_key, snapshot.store_id)
      snapshot.sales_target_incentive_final_snapshot_id, snapshot.period_key, snapshot.store_id
    FROM rpt.sales_target_incentive_final_snapshot snapshot
    INNER JOIN package_store
      ON package_store.period_key = snapshot.period_key
      AND package_store.store_id = snapshot.store_id
    ORDER BY snapshot.period_key, snapshot.store_id, snapshot.close_cutoff_at DESC,
      snapshot.sales_target_incentive_final_snapshot_id DESC
  )
  SELECT
    COUNT(*) FILTER (
      WHERE latest_snapshot.sales_target_incentive_final_snapshot_id IS NULL
        OR latest_snapshot.sales_target_incentive_final_snapshot_id <> package_store.final_snapshot_id
    )::text AS stale_store_count
  FROM package_store
  LEFT JOIN latest_final_snapshot latest_snapshot
    ON latest_snapshot.period_key = package_store.period_key
    AND latest_snapshot.store_id = package_store.store_id
`;

export const approveSubmittedCorrectionsSql = `
  WITH submitted_correction AS (
    SELECT *
    FROM ops.sales_target_incentive_region_correction
    WHERE region_package_id = $1
      AND correction_status = 'submitted'
  ),
  correction_lock AS (
    SELECT pg_advisory_xact_lock(hashtext(
      CONCAT_WS(
        ':',
        'sales_target_incentive_adjustment',
        correction.period_key,
        correction.store_id,
        correction.employee_id,
        correction.participant_type,
        correction.target_scope
      )
    )::bigint) AS lock_acquired
    FROM (
      SELECT *
      FROM submitted_correction
      ORDER BY store_id ASC, employee_id ASC, participant_type ASC
    ) correction
  ),
  locked_final_row AS (
    SELECT final_row.sales_target_incentive_final_row_id, final_row.final_snapshot_id, final_row.final_amount
    FROM rpt.sales_target_incentive_final_row final_row
    INNER JOIN submitted_correction correction
      ON correction.final_row_id = final_row.sales_target_incentive_final_row_id
    CROSS JOIN (SELECT COUNT(*) AS lock_count FROM correction_lock) lock_barrier
    FOR UPDATE OF final_row
  ),
  latest_final_snapshot AS (
    SELECT DISTINCT ON (snapshot.period_key, snapshot.store_id)
      snapshot.sales_target_incentive_final_snapshot_id, snapshot.period_key, snapshot.store_id
    FROM rpt.sales_target_incentive_final_snapshot snapshot
    INNER JOIN submitted_correction correction
      ON correction.period_key = snapshot.period_key
      AND correction.store_id = snapshot.store_id
    ORDER BY snapshot.period_key, snapshot.store_id, snapshot.close_cutoff_at DESC,
      snapshot.sales_target_incentive_final_snapshot_id DESC
  ),
  live_correction AS (
    SELECT
      correction.*,
      final_snapshot.rule_version_id,
      (final_row.final_amount + approved_adjustment.amount)::numeric(18,2) AS current_amount
    FROM submitted_correction correction
    INNER JOIN locked_final_row final_row
      ON final_row.sales_target_incentive_final_row_id = correction.final_row_id
    INNER JOIN rpt.sales_target_incentive_final_snapshot final_snapshot
      ON final_snapshot.sales_target_incentive_final_snapshot_id = final_row.final_snapshot_id
    INNER JOIN latest_final_snapshot latest_snapshot
      ON latest_snapshot.sales_target_incentive_final_snapshot_id = final_snapshot.sales_target_incentive_final_snapshot_id
    LEFT JOIN LATERAL (
      SELECT COALESCE(SUM(adjustment.adjustment_amount) FILTER (WHERE adjustment.status = 'approved'), 0)::numeric(18,2) AS amount
      FROM ops.sales_target_incentive_adjustment adjustment
      WHERE adjustment.final_row_id = final_row.sales_target_incentive_final_row_id
        AND adjustment.adjustment_scope = 'final_snapshot'
    ) approved_adjustment ON TRUE
  ),
  inserted_adjustment AS (
    INSERT INTO ops.sales_target_incentive_adjustment (
      company_id,
      region_id,
      store_id,
      employee_id,
      final_row_id,
      rule_version_id,
      period_key,
      period_timezone,
      adjustment_scope,
      adjustment_type,
      adjustment_amount,
      before_amount,
      after_amount,
      reason_code,
      reason_note,
      status,
      created_by_user_id,
      approved_by_user_id,
      approved_at,
      evidence
    )
    SELECT
      correction.company_id,
      correction.region_id,
      correction.store_id,
      correction.employee_id,
      correction.final_row_id,
      correction.rule_version_id,
      correction.period_key,
      correction.period_timezone,
      'final_snapshot',
      'manual_adjustment',
      (correction.final_amount - correction.current_amount)::numeric(18,2),
      correction.current_amount,
      correction.final_amount,
      'region_manager_package',
      correction.reason_note,
      'approved',
      correction.created_by_user_id,
      $2,
      NOW(),
      jsonb_build_object(
        'source', 'region_manager_approval_package',
        'regionPackageId', correction.region_package_id,
        'regionCorrectionId', correction.sales_target_incentive_region_correction_id,
        'rebasedFromAmount', correction.current_amount
      )
    FROM live_correction correction
    WHERE correction.current_amount <> correction.final_amount
    RETURNING
      sales_target_incentive_adjustment_id,
      final_row_id,
      employee_id,
      evidence ->> 'regionCorrectionId' AS region_correction_id
  ),
  audit_event AS (
    INSERT INTO audit.event_log (
      actor_user_id,
      event_type,
      entity_name,
      entity_id,
      scope_type,
      company_id,
      region_id,
      store_id,
      metadata_json
    )
    SELECT
      $2::uuid,
      'sales_target_incentive_adjustment.approved',
      'ops.sales_target_incentive_adjustment',
      inserted_adjustment.sales_target_incentive_adjustment_id,
      'store',
      correction.company_id,
      correction.region_id,
      correction.store_id,
      jsonb_build_object(
        'correlationId', $3::text,
        'actorUserId', $2::text,
        'periodKey', correction.period_key,
        'phase', 'post_close',
        'participantType', correction.participant_type,
        'reasonCode', 'region_manager_package',
        'regionPackageId', correction.region_package_id,
        'regionCorrectionId', correction.sales_target_incentive_region_correction_id
      )
    FROM inserted_adjustment
    INNER JOIN live_correction correction
      ON correction.sales_target_incentive_region_correction_id::text = inserted_adjustment.region_correction_id
  )
  UPDATE ops.sales_target_incentive_region_correction correction
  SET
    correction_status = 'admin_approved',
    reviewed_by_user_id = $2,
    reviewed_at = NOW(),
    review_note = NULL,
    approved_adjustment_id = inserted_adjustment.sales_target_incentive_adjustment_id,
    updated_at = NOW()
  FROM inserted_adjustment
  WHERE correction.sales_target_incentive_region_correction_id::text = inserted_adjustment.region_correction_id
`;
