import { createHash } from "node:crypto";

export type FrozenStoreFinancialSnapshot = {
  storeId: string; finalSnapshotId: string; participationRevisionNo: number;
  exclusions: Array<{ employeeId: string; displayName: string; positionCode: string; reasonNote: string }>;
};
export type PackageFinancialRow = {
  package_id: string | null; company_id: string; submitted_at: string | null;
  frozen_total_amount?: string | null; store_snapshots?: FrozenStoreFinancialSnapshot[];
};

// Shared by the GET summary and the transaction-bound review read.
export function packageFinancialColumnsSql(packageAlias: string, idColumn = "package_id") {
  return `CASE WHEN ${packageAlias}.package_status IN ('submitted', 'admin_approved') THEN (
    SELECT COALESCE(SUM(CASE WHEN EXISTS (
      SELECT 1 FROM jsonb_array_elements(ps.participation_exclusions_json) exclusion
      WHERE exclusion->>'employeeId' = final_row.employee_id::text
    ) THEN 0 ELSE COALESCE(submitted_correction.final_amount,
      final_row.final_amount + COALESCE(adjustments.amount, 0)) END), 0)::numeric(18,2)::text
    FROM ops.sales_target_incentive_region_package_store ps
    JOIN rpt.sales_target_incentive_final_row final_row ON final_row.final_snapshot_id = ps.final_snapshot_id
    LEFT JOIN LATERAL (
      SELECT SUM(adjustment_amount) AS amount FROM ops.sales_target_incentive_adjustment
      WHERE final_row_id = final_row.sales_target_incentive_final_row_id
        AND adjustment_scope = 'final_snapshot' AND status = 'approved'
    ) adjustments ON TRUE
    LEFT JOIN ops.sales_target_incentive_region_correction submitted_correction
      ON submitted_correction.region_package_id = ${packageAlias}.${idColumn}
      AND submitted_correction.store_id = ps.store_id
      AND submitted_correction.final_row_id = final_row.sales_target_incentive_final_row_id
      AND submitted_correction.correction_status = 'submitted'
      AND ${packageAlias}.package_status = 'submitted'
    WHERE ps.region_package_id = ${packageAlias}.${idColumn}
  ) ELSE NULL END AS frozen_total_amount,
  (SELECT COALESCE(jsonb_agg(jsonb_build_object('storeId', ps.store_id::text,
    'finalSnapshotId', ps.final_snapshot_id::text, 'participationRevisionNo', ps.participation_revision_no,
    'exclusions', ps.participation_exclusions_json) ORDER BY ps.store_id), '[]'::jsonb)
    FROM ops.sales_target_incentive_region_package_store ps
    WHERE ps.region_package_id = ${packageAlias}.${idColumn}) AS store_snapshots`;
}

export const packageFinancialReadSql = `SELECT package.sales_target_incentive_region_package_id::text AS package_id,
  package.company_id::text, to_char(package.submitted_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS submitted_at,
  ${packageFinancialColumnsSql("package", "sales_target_incentive_region_package_id")}
  FROM ops.sales_target_incentive_region_package package
  WHERE package.sales_target_incentive_region_package_id = $1::uuid`;

export const packageFinancialTargetsSql = `SELECT ps.store_id::text, final_row.employee_id::text, final_row.participant_type
  FROM ops.sales_target_incentive_region_package_store ps
  JOIN rpt.sales_target_incentive_final_row final_row ON final_row.final_snapshot_id = ps.final_snapshot_id
  WHERE ps.region_package_id = $1::uuid
  ORDER BY ps.store_id, final_row.employee_id, final_row.participant_type`;

export function packageFinancialVersion(period: string, row: PackageFinancialRow): string | null {
  if (!row.package_id || row.frozen_total_amount == null) return null;
  const stores = [...(row.store_snapshots ?? [])].sort((a, b) => a.storeId.localeCompare(b.storeId)).map(store => ({
    storeId: store.storeId, finalSnapshotId: store.finalSnapshotId, participationRevisionNo: store.participationRevisionNo,
    exclusions: [...store.exclusions].sort((a, b) => a.employeeId.localeCompare(b.employeeId)).map(exclusion => ({
      employeeId: exclusion.employeeId, displayName: exclusion.displayName, positionCode: exclusion.positionCode, reasonNote: exclusion.reasonNote,
    })),
  }));
  return createHash("sha256").update(JSON.stringify({ contract: "incentive-package-financial-v1", period,
    companyId: row.company_id, packageId: row.package_id, submittedAt: row.submitted_at,
    frozenTotalAmount: row.frozen_total_amount, stores })).digest("hex");
}
