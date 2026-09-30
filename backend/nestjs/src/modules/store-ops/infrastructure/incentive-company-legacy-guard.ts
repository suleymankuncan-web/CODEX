import { ConflictException } from "@nestjs/common";
import type { PoolClient } from "pg";

export async function assertStandaloneMoneyAllowed(client: Pick<PoolClient, "query">, input: { companyId: string; periodKey: string; finalRowId: string | null }) {
  const result = await client.query<{ allowed: boolean }>(`SELECT CASE WHEN $3::uuid IS NULL THEN NOT EXISTS (
    SELECT 1 FROM ops.incentive_company_cycle WHERE company_id=$1::uuid AND period_key=$2
  ) ELSE EXISTS (
    SELECT 1 FROM ops.incentive_legacy_approval legacy
    JOIN ops.sales_target_incentive_region_package_store ps ON ps.region_package_id=legacy.package_id
    JOIN rpt.sales_target_incentive_final_row row ON row.final_snapshot_id=ps.final_snapshot_id
    WHERE row.sales_target_incentive_final_row_id=$3::uuid AND ps.company_id=$1::uuid AND ps.period_key=$2
  ) END AS allowed`, [input.companyId, input.periodKey, input.finalRowId]);
  if (!result.rows[0]?.allowed) throw new ConflictException("Closed new-contract money requires sealed General Manager final approval");
}

export async function assertLegacyPackageReviewAllowed(client: Pick<PoolClient, "query">, packageId: string) {
  const legacy = await client.query("SELECT package_id FROM ops.incentive_legacy_approval WHERE package_id=$1::uuid", [packageId]);
  if (!legacy.rows.length) throw new ConflictException("Pending packages require the company approval cycle; legacy approval cannot advance them");
}
