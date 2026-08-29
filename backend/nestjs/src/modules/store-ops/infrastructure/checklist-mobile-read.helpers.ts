import type { DatabaseService } from "../../../shared/database/database.service";
import type { MobileChecklistToday } from "../application/checklist.contract";

export function mapMobileChecklistDraftResponses(
  value: unknown,
): MobileChecklistToday["activeInstances"][number]["responses"] {
  const parsed = typeof value === "string" ? JSON.parse(value) : value;
  if (!Array.isArray(parsed)) return [];
  return parsed.map((item) => {
    const row = item as Record<string, unknown>;
    return {
      templateItemId: String(row.templateItemId ?? ""),
      responseValue: row.responseValue == null ? null : String(row.responseValue),
      scoreValue: Number(row.scoreValue ?? 0),
      commentText: row.commentText == null ? null : String(row.commentText),
    };
  }).filter((item) => item.templateItemId.length > 0);
}

export function mapMobileChecklistEvidence(
  value: unknown,
): MobileChecklistToday["activeInstances"][number]["evidence"] {
  const parsed = typeof value === "string" ? JSON.parse(value) : value;
  if (!Array.isArray(parsed)) return [];
  return parsed.map((item) => {
    const row = item as Record<string, unknown>;
    return {
      templateItemId: String(row.templateItemId ?? ""),
      mediaAssetId: String(row.mediaAssetId ?? ""),
      displayOrder: Number(row.displayOrder ?? 0),
      captureSource: String(row.captureSource ?? "system_generated") as
        | "camera" | "gallery" | "system_generated",
      thumbnailAvailable: row.thumbnailAvailable === true,
    };
  }).filter((item) => item.templateItemId.length > 0 && item.mediaAssetId.length > 0);
}

export function queryMobileChecklistStores(
  databaseService: DatabaseService,
  input: { explicitStoreIds: string[]; readRegionIds: string[]; readCompanyIds: string[] },
) {
  const [column, values] = input.explicitStoreIds.length > 0
    ? ["store_id", input.explicitStoreIds]
    : input.readRegionIds.length > 0
      ? ["region_id", input.readRegionIds]
      : ["company_id", input.readCompanyIds];
  return databaseService.query<{ store_id: string; store_name: string }>(
    `SELECT s.store_id, s.store_name FROM ops.store s
     WHERE s.${column} = ANY($1::uuid[]) ORDER BY s.store_name ASC`,
    [values],
  );
}
