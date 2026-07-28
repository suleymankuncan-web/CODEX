import { BadRequestException, ForbiddenException, ServiceUnavailableException } from "@nestjs/common";
import { DatabaseService } from "../../../shared/database/database.service";
import { PhotoMediaAssetRecord } from "../application/photo-media-storage.contract";

export async function getPhotoMediaUsage(databaseService: DatabaseService) {
  const result = await databaseService.query<{
    provider_visible_bytes: string; class_a_operations: string; class_b_operations: string;
  }>(`
    SELECT provider_visible_bytes, class_a_operations, class_b_operations
    FROM ops.photo_media_usage_state WHERE usage_scope = 'r2-eu'
  `);
  const row = result.rows[0];
  return {
    aggregateStoredBytes: Number(row?.provider_visible_bytes ?? 0),
    monthlyClassAOperations: Number(row?.class_a_operations ?? 0),
    monthlyClassBOperations: Number(row?.class_b_operations ?? 0),
  };
}

export async function recordPhotoMediaAccess(
  databaseService: DatabaseService, input: Record<string, unknown>,
): Promise<void> {
  await databaseService.query(`
    INSERT INTO audit.photo_evidence_event (
      actor_user_id, event_type, entity_name, entity_id, company_id,
      region_id, store_id, media_asset_id, correlation_id
    ) VALUES (
      $1::uuid, 'checklist_photo_evidence.media.viewed', 'evidence_access',
      $2::uuid, $3::uuid, $4::uuid, $5::uuid, $2::uuid, $2::text
    )
  `, [input.actorUserId, input.mediaAssetId, input.companyId, input.regionId, input.storeId]);
}

export async function listPhotoMediaReconciliationInventory(
  databaseService: DatabaseService,
  allowedCompanyIds?: string[],
) {
  const result = await databaseService.query<{
    media_asset_id: string; state: PhotoMediaAssetRecord["state"];
    raw_object_key: string | null; raw_disposed_at: Date | null;
    canonical_sha256: string | null; byte_count: string | null;
    canonical_object_key: string | null; thumbnail_object_key: string | null;
  }>(`
    SELECT ma.media_asset_id, ma.state, ma.raw_object_key, ma.raw_disposed_at,
           ma.canonical_sha256, ma.byte_count, ma.canonical_object_key, ma.thumbnail_object_key
    FROM ops.media_asset ma
    WHERE ma.state <> 'deleted_tombstone'
      AND ($1::uuid[] IS NULL OR ma.company_id = ANY($1::uuid[]))
    ORDER BY ma.media_asset_id
  `, [allowedCompanyIds ?? null]);
  const replicas = await databaseService.query<{
    media_asset_id: string; replica_role: "primary" | "recovery"; object_key: string;
    content_sha256: string | null; byte_count: string | null; is_active: boolean;
  }>(`
    SELECT media_asset_id, replica_role, object_key, content_sha256, byte_count, is_active
    FROM ops.media_asset_replica replica
    JOIN ops.media_asset ma USING (media_asset_id)
    WHERE replica.replica_state IN ('copying', 'verified')
      AND ($1::uuid[] IS NULL OR ma.company_id = ANY($1::uuid[]))
    ORDER BY media_asset_id, replica_role, replica_generation
  `, [allowedCompanyIds ?? null]);
  const replicasByAsset = new Map<string, typeof replicas.rows>();
  for (const replica of replicas.rows) {
    const current = replicasByAsset.get(replica.media_asset_id) ?? [];
    current.push(replica);
    replicasByAsset.set(replica.media_asset_id, current);
  }
  return result.rows.map((row) => {
    const canonicalProof = row.canonical_sha256 && row.byte_count
      ? { sha256: row.canonical_sha256, byteCount: Number(row.byte_count) } : {};
    const assetReplicas = replicasByAsset.get(row.media_asset_id) ?? [];
    return {
      mediaAssetId: row.media_asset_id, recoveryRequired: row.state === "ready",
      primaryObjects: [
        ...assetReplicas.filter((replica) => replica.replica_role === "primary").map((replica) => ({
          objectKey: replica.object_key,
          ...(replica.is_active && replica.content_sha256 ? { sha256: replica.content_sha256 } : {}),
          ...(replica.is_active && replica.byte_count ? { byteCount: Number(replica.byte_count) } : {}),
        })),
        ...(row.thumbnail_object_key ? [{ objectKey: row.thumbnail_object_key }] : []),
        ...(row.raw_object_key && !row.raw_disposed_at ? [{ objectKey: row.raw_object_key }] : []),
      ],
      recoveryObjects: assetReplicas.filter((replica) => replica.replica_role === "recovery").map((replica) => ({
        objectKey: replica.object_key,
        ...(replica.is_active
          ? (replica.content_sha256 ? { sha256: replica.content_sha256 } : canonicalProof)
          : {}),
        ...(replica.is_active && replica.byte_count ? { byteCount: Number(replica.byte_count) } : {}),
      })),
    };
  });
}

export async function recordPhotoMediaProviderFailure(
  databaseService: DatabaseService, input: Record<string, unknown>,
): Promise<void> {
  const allowedEvents = new Set([
    "checklist_photo_evidence.storage.recovery_copy_started",
    "checklist_photo_evidence.storage.recovery_failed",
    "checklist_photo_evidence.storage.provider_failed",
  ]);
  const eventType = typeof input.eventType === "string"
    ? input.eventType
    : "checklist_photo_evidence.storage.recovery_failed";
  if (!allowedEvents.has(eventType)) {
    throw new BadRequestException("Photo media provider event type is invalid");
  }
  const result = await databaseService.query(`
    INSERT INTO audit.photo_media_storage_event (
      actor_user_id, event_type, media_asset_id, company_id, correlation_id, reason_code
    )
    SELECT $1::uuid, $4, media_asset_id, company_id, media_asset_id::text, $3
    FROM ops.media_asset WHERE media_asset_id = $2::uuid
    RETURNING photo_media_storage_event_id
  `, [input.actorUserId, input.mediaAssetId, input.reasonCode, eventType]);
  if (result.rows.length !== 1) {
    throw new BadRequestException("Photo media provider failure asset is unavailable");
  }
}

export async function recordPhotoMediaQuotaDenial(
  databaseService: DatabaseService, input: Record<string, unknown>,
): Promise<void> {
  const result = await databaseService.query(`
    INSERT INTO audit.photo_media_storage_event (
      actor_user_id, event_type, media_asset_id, company_id, correlation_id, reason_code
    )
    SELECT $1::uuid, 'checklist_photo_evidence.storage.quota_denied', NULL, company_id, $3, $4
    FROM ops.store WHERE store_id = $2::uuid AND company_id = ANY($5::uuid[])
    RETURNING photo_media_storage_event_id
  `, [input.actorUserId, input.storeId, input.correlationId, input.reasonCode, input.allowedCompanyIds]);
  if (result.rows.length !== 1) {
    throw new ForbiddenException("Photo media quota denial scope is unavailable");
  }
}

export async function reservePhotoMediaProviderOperations(
  databaseService: DatabaseService,
  input: {
    classAOperations: number; classBOperations: number;
    monthlyClassAHardLimit: number; monthlyClassBHardLimit: number;
  },
): Promise<void> {
  if (
    !Number.isSafeInteger(input.classAOperations) || input.classAOperations < 0 ||
    !Number.isSafeInteger(input.classBOperations) || input.classBOperations < 0 ||
    input.classAOperations + input.classBOperations === 0
  ) {
    throw new BadRequestException("Photo media provider operation reservation is invalid");
  }
  await databaseService.withTransaction(async (client) => {
    await client.query(`SELECT pg_advisory_xact_lock(hashtext('photo-media-r2-eu-quota')::bigint)`);
    await client.query(`
      INSERT INTO ops.photo_media_usage_state (
        usage_scope, provider_visible_bytes, operation_month, class_a_operations, class_b_operations
      ) VALUES ('r2-eu', 0, date_trunc('month', CURRENT_DATE)::date, 0, 0)
      ON CONFLICT (usage_scope) DO NOTHING
    `);
    const usage = await client.query<{ class_a_operations: string; class_b_operations: string }>(`
      SELECT
        CASE WHEN operation_month = date_trunc('month', CURRENT_DATE)::date THEN class_a_operations ELSE 0 END AS class_a_operations,
        CASE WHEN operation_month = date_trunc('month', CURRENT_DATE)::date THEN class_b_operations ELSE 0 END AS class_b_operations
      FROM ops.photo_media_usage_state WHERE usage_scope = 'r2-eu' FOR UPDATE
    `);
    const row = usage.rows[0];
    if (!row) throw new ServiceUnavailableException("Photo media usage state is unavailable");
    if (Number(row.class_a_operations) + input.classAOperations > input.monthlyClassAHardLimit) {
      throw new ServiceUnavailableException("Photo media Class A hard limit reached");
    }
    if (Number(row.class_b_operations) + input.classBOperations > input.monthlyClassBHardLimit) {
      throw new ServiceUnavailableException("Photo media Class B hard limit reached");
    }
    await client.query(`
      UPDATE ops.photo_media_usage_state
      SET operation_month = date_trunc('month', CURRENT_DATE)::date,
          class_a_operations = CASE
            WHEN operation_month = date_trunc('month', CURRENT_DATE)::date THEN class_a_operations + $1::bigint
            ELSE $1::bigint END,
          class_b_operations = CASE
            WHEN operation_month = date_trunc('month', CURRENT_DATE)::date THEN class_b_operations + $2::bigint
            ELSE $2::bigint END,
          updated_at = NOW()
      WHERE usage_scope = 'r2-eu'
    `, [input.classAOperations, input.classBOperations]);
  });
}

export function mapPhotoMediaAsset(row: {
  media_asset_id: string; company_id: string; region_id: string | null; store_id: string | null;
  state: PhotoMediaAssetRecord["state"]; raw_object_key?: string;
  canonical_object_key?: string | null; thumbnail_object_key?: string | null;
  canonical_sha256?: string | null; byte_count?: string | null;
  storage_attempt_id?: string | null; raw_disposed_at?: Date | null;
  classification?: PhotoMediaAssetRecord["classification"];
}): PhotoMediaAssetRecord {
  return {
    mediaAssetId: row.media_asset_id, companyId: row.company_id, regionId: row.region_id,
    storeId: row.store_id, state: row.state,
    ...(row.classification ? { classification: row.classification } : {}),
    ...(row.raw_object_key ? { rawObjectKey: row.raw_object_key } : {}),
    canonicalObjectKey: row.canonical_object_key ?? null,
    thumbnailObjectKey: row.thumbnail_object_key ?? null,
    canonicalSha256: row.canonical_sha256 ?? null,
    canonicalByteCount: row.byte_count === null || row.byte_count === undefined ? null : Number(row.byte_count),
    storageAttemptId: row.storage_attempt_id ?? null, rawDisposedAt: row.raw_disposed_at ?? null,
  };
}
