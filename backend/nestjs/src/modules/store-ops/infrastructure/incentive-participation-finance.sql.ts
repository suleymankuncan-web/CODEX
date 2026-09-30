// Financial reads never alter the raw amounts used to rebase corrections.
export type FinancialParticipation = { included: boolean; reasonNote: string | null; revisionNo: number; finalSnapshotId: string; source: "draft" | "approved" };
export const legacyParticipationCte = `
  , financial_participation AS (
    SELECT latest.store_id::text AS store_id,
      latest.sales_target_incentive_final_snapshot_id::text AS final_snapshot_id,
      CASE WHEN $3::text = 'draft' THEN COALESCE(draft.revision_no, 0)
        ELSE COALESCE(approved.participation_revision_no, 0) END AS revision_no,
      CASE WHEN $3::text = 'draft' THEN COALESCE(draft.exclusions_json, '[]'::jsonb)
        ELSE COALESCE(approved.participation_exclusions_json, '[]'::jsonb) END AS exclusions_json
    FROM latest_final_snapshot latest
    LEFT JOIN LATERAL (
      SELECT revision.* FROM (
        SELECT * FROM ops.sales_target_incentive_participation_revision
        WHERE store_id = latest.store_id AND period_key = $1
        ORDER BY revision_no DESC LIMIT 1
      ) revision
      WHERE revision.final_snapshot_id = latest.sales_target_incentive_final_snapshot_id
        AND revision.company_id = latest.company_id
    ) draft ON $3::text = 'draft'
    LEFT JOIN LATERAL (
      SELECT ps.participation_revision_no, ps.participation_exclusions_json
      FROM ops.sales_target_incentive_region_package package
      JOIN ops.sales_target_incentive_region_package_store ps
        ON ps.region_package_id = package.sales_target_incentive_region_package_id
      WHERE package.period_key = $1 AND package.package_status = 'admin_approved'
        AND package.company_id = latest.company_id
        AND ps.store_id = latest.store_id
        AND ps.final_snapshot_id = latest.sales_target_incentive_final_snapshot_id
      ORDER BY package.reviewed_at DESC, package.sales_target_incentive_region_package_id DESC LIMIT 1
    ) approved ON $3::text = 'approved'
  )
`;

export function legacyParticipationSelect(storeSql: string, snapshotSql: string, employeeSql: string) {
  return `(SELECT jsonb_build_object('included', exclusion.value IS NULL,
    'reasonNote', exclusion.value->>'reasonNote', 'revisionNo', participation.revision_no,
    'finalSnapshotId', participation.final_snapshot_id, 'source', $3::text)
    FROM financial_participation participation
    LEFT JOIN LATERAL (SELECT value FROM jsonb_array_elements(participation.exclusions_json)
      WHERE value->>'employeeId' = ${employeeSql} LIMIT 1) exclusion ON TRUE
    WHERE participation.store_id = ${storeSql}
      AND participation.final_snapshot_id = ${snapshotSql}) AS participation`;
}

export const legacyAdjustmentParticipationSelect = legacyParticipationSelect("adjustment_summary.store_id",
  "COALESCE(adjustment_summary.final_snapshot_id, (SELECT sales_target_incentive_final_snapshot_id::text FROM latest_final_snapshot WHERE store_id::text = adjustment_summary.store_id))",
  "adjustment_summary.employee_id");
