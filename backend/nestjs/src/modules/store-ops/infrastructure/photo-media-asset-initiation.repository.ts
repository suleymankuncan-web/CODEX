import { ForbiddenException, ServiceUnavailableException } from "@nestjs/common";
import { DatabaseService } from "../../../shared/database/database.service";
import {
  PHOTO_MEDIA_QUOTA_LOCK_KEY,
  PHOTO_MEDIA_USAGE_SCOPE,
  PhotoMediaAssetRecord,
  assertPhotoMediaUploadQuota,
  buildPhotoMediaObjectKeys,
} from "../application/photo-media-storage.contract";

export type CreatePhotoMediaAssetInput = {
  mediaAssetId: string;
  actorUserId: string;
  allowedCompanyIds: string[];
  storeId?: string;
  companyId?: string;
  contentType: string;
  contentLength: number;
  captureSource: "camera" | "gallery" | "system_generated";
  classification?: "checklist_evidence" | "action_evidence" | "vm_reference" | "vm_campaign_evidence" | "derived_artifact";
  quota: {
    aggregateBytesHardLimit: number;
    monthlyClassAHardLimit: number;
    monthlyClassBHardLimit: number;
    lockSafetyDays: number;
    perUserDailyBytesHardLimit: number;
    perStoreDailyBytesHardLimit: number;
    concurrentProcessingHardLimit: number;
  };
};

export async function createPhotoMediaAsset(
  databaseService: DatabaseService,
  input: CreatePhotoMediaAssetInput,
): Promise<PhotoMediaAssetRecord> {
  return databaseService.withTransaction(async (client) => {
    await client.query(`SELECT pg_advisory_xact_lock(hashtext('${PHOTO_MEDIA_QUOTA_LOCK_KEY}')::bigint)`);
    const scope = input.storeId
      ? (await client.query<{ company_id: string; region_id: string }>(`
          SELECT company_id, region_id FROM ops.store
          WHERE store_id = $1::uuid AND company_id = ANY($2::uuid[]) AND status = 'active'
        `, [input.storeId, input.allowedCompanyIds])).rows[0]
      : (await client.query<{ company_id: string; region_id: null }>(`
          SELECT company_id, NULL::uuid AS region_id FROM ops.company
          WHERE company_id = $1::uuid AND company_id = ANY($2::uuid[]) AND status = 'active'
        `, [input.companyId, input.allowedCompanyIds])).rows[0];
    if (!scope || (!input.storeId && input.classification !== "vm_reference")) {
      throw new ForbiddenException("Photo media scope is outside actor company scope");
    }

    await client.query(`
      INSERT INTO ops.photo_media_usage_state (
        usage_scope, provider_visible_bytes, operation_month, class_a_operations, class_b_operations
      ) VALUES ('${PHOTO_MEDIA_USAGE_SCOPE}', 0, date_trunc('month', CURRENT_DATE)::date, 0, 0)
      ON CONFLICT (usage_scope) DO NOTHING
    `);
    const usageResult = await client.query<{
      provider_visible_bytes: string;
      class_a_operations: string;
      class_b_operations: string;
    }>(`
      SELECT provider_visible_bytes,
        CASE WHEN operation_month = date_trunc('month', CURRENT_DATE)::date THEN class_a_operations ELSE 0 END AS class_a_operations,
        CASE WHEN operation_month = date_trunc('month', CURRENT_DATE)::date THEN class_b_operations ELSE 0 END AS class_b_operations
      FROM ops.photo_media_usage_state WHERE usage_scope = '${PHOTO_MEDIA_USAGE_SCOPE}' FOR UPDATE
    `);
    const usage = usageResult.rows[0];
    const reservedBytes = input.contentLength * 4;
    const reservedClassA = 1;
    const reservedClassB = 0;
    assertPhotoMediaUploadQuota({
      aggregateStoredBytes: Number(usage?.provider_visible_bytes ?? 0),
      requestedBytes: reservedBytes,
      monthlyClassAOperations: Number(usage?.class_a_operations ?? 0),
      monthlyClassBOperations: Number(usage?.class_b_operations ?? 0),
      configuration: {
        aggregateBytesHardLimit: input.quota.aggregateBytesHardLimit,
        monthlyClassAHardLimit: input.quota.monthlyClassAHardLimit,
        monthlyClassBHardLimit: input.quota.monthlyClassBHardLimit,
      },
    });

    const retentionResult = await client.query<{
      retention_policy_id: string;
      version_no: number;
      evidence_retention_days: number;
      reference_retention_days: number;
      derived_retention_days: number;
    }>(`
      SELECT retention_policy_id, version_no, evidence_retention_days,
             reference_retention_days, derived_retention_days
      FROM ops.evidence_retention_policy
      WHERE company_id = $1::uuid AND effective_from <= NOW()
        AND (effective_to IS NULL OR effective_to > NOW())
      ORDER BY version_no DESC LIMIT 1
    `, [scope.company_id]);
    const retention = retentionResult.rows[0];
    if (!retention) {
      throw new ServiceUnavailableException("Photo media retention policy is not configured");
    }
    const retentionDays = input.classification === "vm_reference"
      ? retention.reference_retention_days
      : input.classification === "derived_artifact"
        ? retention.derived_retention_days
        : retention.evidence_retention_days;
    if (retentionDays < input.quota.lockSafetyDays) {
      throw new ServiceUnavailableException("Photo media retention is shorter than the provider lock safety window");
    }

    await client.query(`
      INSERT INTO ops.photo_media_daily_usage (usage_date, subject_kind, subject_id, uploaded_bytes)
      VALUES (CURRENT_DATE, 'user', $1::uuid, 0)
      ON CONFLICT (usage_date, subject_kind, subject_id) DO NOTHING
    `, [input.actorUserId]);
    if (input.storeId) await client.query(`
      INSERT INTO ops.photo_media_daily_usage (usage_date, subject_kind, subject_id, uploaded_bytes)
      VALUES (CURRENT_DATE, 'store', $1::uuid, 0)
      ON CONFLICT (usage_date, subject_kind, subject_id) DO NOTHING
    `, [input.storeId]);
    const dailyUsage = await client.query<{ subject_kind: "user" | "store"; uploaded_bytes: string }>(`
      SELECT subject_kind, uploaded_bytes FROM ops.photo_media_daily_usage
      WHERE usage_date = CURRENT_DATE
        AND ((subject_kind = 'user' AND subject_id = $1::uuid)
          OR ($2::uuid IS NOT NULL AND subject_kind = 'store' AND subject_id = $2::uuid))
      FOR UPDATE
    `, [input.actorUserId, input.storeId ?? null]);
    const userBytes = Number(dailyUsage.rows.find((row) => row.subject_kind === "user")?.uploaded_bytes ?? 0);
    const storeBytes = Number(dailyUsage.rows.find((row) => row.subject_kind === "store")?.uploaded_bytes ?? 0);
    if (userBytes + input.contentLength > input.quota.perUserDailyBytesHardLimit) {
      throw new ServiceUnavailableException("Photo media per-user daily byte limit reached");
    }
    if (input.storeId && storeBytes + input.contentLength > input.quota.perStoreDailyBytesHardLimit) {
      throw new ServiceUnavailableException("Photo media per-store daily byte limit reached");
    }
    await client.query(`
      UPDATE ops.photo_media_daily_usage
      SET uploaded_bytes = uploaded_bytes + $3::bigint, updated_at = NOW()
      WHERE usage_date = CURRENT_DATE
        AND ((subject_kind = 'user' AND subject_id = $1::uuid)
          OR ($2::uuid IS NOT NULL AND subject_kind = 'store' AND subject_id = $2::uuid))
    `, [input.actorUserId, input.storeId ?? null, input.contentLength]);

    const rawObjectKey = buildPhotoMediaObjectKeys({
      companyId: scope.company_id,
      mediaAssetId: input.mediaAssetId,
    }).raw;
    await client.query(`
      UPDATE ops.photo_media_usage_state
      SET provider_visible_bytes = provider_visible_bytes + $1::bigint,
          operation_month = date_trunc('month', CURRENT_DATE)::date,
          class_a_operations = CASE
            WHEN operation_month = date_trunc('month', CURRENT_DATE)::date THEN class_a_operations + $2::bigint
            ELSE $2::bigint END,
          class_b_operations = CASE
            WHEN operation_month = date_trunc('month', CURRENT_DATE)::date THEN class_b_operations + $3::bigint
            ELSE $3::bigint END,
          updated_at = NOW()
      WHERE usage_scope = '${PHOTO_MEDIA_USAGE_SCOPE}'
    `, [reservedBytes, reservedClassA, reservedClassB]);

    const assetResult = await client.query<{
      media_asset_id: string;
      company_id: string;
      region_id: string;
      store_id: string;
      state: PhotoMediaAssetRecord["state"];
      raw_object_key: string;
    }>(`
      INSERT INTO ops.media_asset (
        media_asset_id, company_id, region_id, store_id, classification, state,
        capture_source, raw_object_key, detected_mime_type, declared_upload_byte_count,
        uploaded_by_user_id, retention_policy_id, retention_policy_version, expires_at,
        quota_reserved_bytes, quota_reserved_class_a, quota_reserved_class_b
      ) VALUES (
        $1::uuid, $2::uuid, $3::uuid, $4::uuid, $15, 'initiated',
        $5, $6, $7, $8::bigint, $9::uuid, $10::uuid, $11,
        NULL, $12::bigint, $13, $14
      )
      RETURNING media_asset_id, company_id, region_id, store_id, state, raw_object_key
    `, [
       input.mediaAssetId, scope.company_id, scope.region_id, input.storeId ?? null,
      input.captureSource, rawObjectKey, input.contentType, input.contentLength,
      input.actorUserId, retention.retention_policy_id, retention.version_no,
      reservedBytes, reservedClassA, reservedClassB,
      input.classification ?? "checklist_evidence",
    ]);
    const row = assetResult.rows[0];
    if (!row) {
      throw new ServiceUnavailableException("Photo media asset could not be initiated");
    }
    return {
      mediaAssetId: row.media_asset_id,
      companyId: row.company_id,
      regionId: row.region_id,
      storeId: row.store_id,
      state: row.state,
      rawObjectKey: row.raw_object_key,
      canonicalObjectKey: null,
      thumbnailObjectKey: null,
      canonicalSha256: null,
      canonicalByteCount: null,
      storageAttemptId: null,
      rawDisposedAt: null,
    };
  });
}
