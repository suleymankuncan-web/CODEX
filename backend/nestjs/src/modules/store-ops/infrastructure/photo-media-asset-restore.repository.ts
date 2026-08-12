import { BadRequestException, ServiceUnavailableException } from "@nestjs/common";
import { DatabaseService } from "../../../shared/database/database.service";
import {
  PHOTO_MEDIA_QUOTA_LOCK_KEY,
  PHOTO_MEDIA_USAGE_SCOPE,
  PhotoMediaStorageIdentity,
  buildPhotoMediaObjectKeys,
} from "../application/photo-media-storage.contract";

export async function claimPhotoMediaRestoreCandidate(
  databaseService: DatabaseService,
  storageIdentity: PhotoMediaStorageIdentity,
  input: Record<string, unknown>,
) {
  return databaseService.withTransaction(async (client) => {
    const result = await client.query<{
      media_asset_id: string;
      company_id: string;
      cleanup_lease_token: string;
      canonical_object_key: string;
      recovery_object_key: string;
      canonical_sha256: string;
      byte_count: string;
      replica_generation: number;
      restore_object_key: string | null;
    }>(`
      UPDATE ops.media_asset ma
      SET cleanup_origin_state = 'restore', cleanup_lease_token = gen_random_uuid(),
          cleanup_lease_expires_at = NOW() + INTERVAL '15 minutes', updated_at = NOW()
      FROM ops.media_asset_replica recovery
      WHERE ma.media_asset_id = $1::uuid
        AND ma.state = 'ready'
        AND (ma.cleanup_lease_token IS NULL OR ma.cleanup_lease_expires_at <= NOW())
        AND NOT ma.legal_hold AND NOT ma.operational_hold
        AND NOT ma.active_workflow_hold AND NOT ma.ai_review_hold
        AND recovery.media_asset_id = ma.media_asset_id
        AND recovery.replica_role = 'recovery' AND recovery.replica_state = 'verified'
        AND recovery.is_active
        AND recovery.provider_adapter_id = $2
        AND recovery.jurisdiction = $3
      RETURNING ma.media_asset_id, ma.company_id, ma.cleanup_lease_token,
                ma.canonical_object_key, recovery.object_key AS recovery_object_key,
                ma.canonical_sha256, ma.byte_count,
                COALESCE(
                  (SELECT replica_generation FROM ops.media_asset_replica pending
                   WHERE pending.media_asset_id = ma.media_asset_id
                     AND pending.replica_role = 'primary' AND pending.replica_state = 'copying'
                     AND pending.provider_adapter_id = $2
                     AND pending.jurisdiction = $3
                    ORDER BY replica_generation DESC LIMIT 1),
                  (SELECT COALESCE(MAX(replica_generation), 0) + 1
                   FROM ops.media_asset_replica generations
                   WHERE generations.media_asset_id = ma.media_asset_id
                     AND generations.replica_role = 'primary')
                ) AS replica_generation,
                (SELECT object_key FROM ops.media_asset_replica pending
                 WHERE pending.media_asset_id = ma.media_asset_id
                   AND pending.replica_role = 'primary' AND pending.replica_state = 'copying'
                   AND pending.provider_adapter_id = $2
                   AND pending.jurisdiction = $3
                 ORDER BY replica_generation DESC LIMIT 1) AS restore_object_key
    `, [input.mediaAssetId, storageIdentity.provider, storageIdentity.jurisdiction]);
    const row = result.rows[0];
    if (!row) {
      throw new BadRequestException("Photo media restore target is stale, held, or already leased");
    }
    await client.query(`
      INSERT INTO audit.photo_media_storage_event (
        actor_user_id, event_type, media_asset_id, company_id, correlation_id,
        reason_code, content_sha256, byte_count
      ) VALUES (
        $1::uuid, 'checklist_photo_evidence.storage.restore_started', $2::uuid,
        $3::uuid, $2::text, 'manual_restore', $4, $5::bigint
      )
    `, [input.actorUserId, row.media_asset_id, row.company_id, row.canonical_sha256, row.byte_count]);
    return {
      mediaAssetId: row.media_asset_id,
      cleanupLeaseToken: row.cleanup_lease_token,
      canonicalObjectKey: row.canonical_object_key,
      recoveryObjectKey: row.recovery_object_key,
      restoreObjectKey: row.restore_object_key ?? buildPhotoMediaObjectKeys({
          companyId: row.company_id,
          mediaAssetId: row.media_asset_id,
          storageAttemptId: row.cleanup_lease_token,
        }).canonical,
      replicaGeneration: row.replica_generation,
      canonicalSha256: row.canonical_sha256,
      canonicalByteCount: Number(row.byte_count),
    };
  });
}

export async function reservePhotoMediaRestoreGeneration(
  databaseService: DatabaseService,
  storageIdentity: PhotoMediaStorageIdentity,
  input: Record<string, unknown>,
): Promise<void> {
  await databaseService.withTransaction(async (client) => {
    await client.query(`SELECT pg_advisory_xact_lock(hashtext('${PHOTO_MEDIA_QUOTA_LOCK_KEY}')::bigint)`);
    const asset = await client.query<{
      company_id: string;
      accounted_provider_bytes: string;
      retention_days: number;
    }>(`
      SELECT ma.company_id, ma.accounted_provider_bytes,
             CASE WHEN ma.classification = 'derived_artifact'
                  THEN policy.derived_retention_days
                  ELSE policy.evidence_retention_days
             END AS retention_days
      FROM ops.media_asset ma
      JOIN ops.evidence_retention_policy policy
        ON policy.retention_policy_id = ma.retention_policy_id
       AND policy.company_id = ma.company_id
       AND policy.version_no = ma.retention_policy_version
      WHERE ma.media_asset_id = $1::uuid AND ma.state = 'ready'
        AND ma.cleanup_lease_token = $2::uuid AND ma.cleanup_origin_state = 'restore'
      FOR UPDATE OF ma
    `, [input.mediaAssetId, input.cleanupLeaseToken]);
    const row = asset.rows[0];
    if (!row) {
      throw new BadRequestException("Photo media restore reservation lease is stale");
    }
    const inserted = await client.query(`
      INSERT INTO ops.media_asset_replica (
        media_asset_id, company_id, replica_role, provider_adapter_id, jurisdiction,
        bucket_alias, object_key, replica_generation, is_active, replica_state,
        content_sha256, byte_count, copy_started_at
      ) VALUES (
        $1::uuid, $2::uuid, 'primary', $7, $8, 'primary', $3, $4, FALSE,
        'copying', $5, $6::bigint, NOW()
      )
      ON CONFLICT (media_asset_id, replica_role, replica_generation) DO NOTHING
      RETURNING media_asset_replica_id
    `, [
      input.mediaAssetId, row.company_id, input.restoreObjectKey,
      input.replicaGeneration,
      input.canonicalSha256,
      input.canonicalByteCount,
      storageIdentity.provider,
      storageIdentity.jurisdiction,
    ]);
    if (inserted.rows.length === 0) {
      const existing = await client.query(`
        SELECT media_asset_replica_id
        FROM ops.media_asset_replica
        WHERE media_asset_id = $1::uuid AND replica_role = 'primary'
          AND replica_generation = $4 AND replica_state = 'copying'
          AND object_key = $3 AND content_sha256 = $5
          AND byte_count = $6::bigint
          AND provider_adapter_id = $7 AND jurisdiction = $8
      `, [
        input.mediaAssetId, row.company_id, input.restoreObjectKey,
        input.replicaGeneration, input.canonicalSha256, input.canonicalByteCount,
        storageIdentity.provider, storageIdentity.jurisdiction,
      ]);
      if (existing.rows.length !== 1) {
        throw new ServiceUnavailableException("Photo media restore generation proof conflicts with provider identity");
      }
      return;
    }
    const additionalBytes = Number(input.additionalBytes);
    const usage = await client.query<{ provider_visible_bytes: string }>(`
      SELECT provider_visible_bytes FROM ops.photo_media_usage_state
      WHERE usage_scope = '${PHOTO_MEDIA_USAGE_SCOPE}' FOR UPDATE
    `);
    if (
      !Number.isSafeInteger(additionalBytes) || additionalBytes < 0 ||
      Number(usage.rows[0]?.provider_visible_bytes ?? 0) + additionalBytes > Number(input.aggregateBytesHardLimit)
    ) {
      throw new ServiceUnavailableException("Photo media restore would exceed the storage hard limit");
    }
    if (additionalBytes > 0) {
      await client.query(`
        UPDATE ops.photo_media_usage_state
        SET provider_visible_bytes = provider_visible_bytes + $1::bigint, updated_at = NOW()
        WHERE usage_scope = '${PHOTO_MEDIA_USAGE_SCOPE}'
      `, [additionalBytes]);
    }
    await client.query(`
      UPDATE ops.media_asset
      SET accounted_provider_bytes = accounted_provider_bytes + $3::bigint,
          expires_at = GREATEST(expires_at, NOW() + make_interval(days => $4::integer)),
          updated_at = NOW()
      WHERE media_asset_id = $1::uuid AND cleanup_lease_token = $2::uuid
    `, [input.mediaAssetId, input.cleanupLeaseToken, additionalBytes, row.retention_days]);
  });
}

export async function markPhotoMediaRestoreVerified(
  databaseService: DatabaseService,
  storageIdentity: PhotoMediaStorageIdentity,
  input: Record<string, unknown>,
): Promise<void> {
  await databaseService.withTransaction(async (client) => {
    const asset = await client.query<{
      company_id: string;
      canonical_sha256: string;
      byte_count: string;
    }>(`
      SELECT company_id, canonical_sha256, byte_count
      FROM ops.media_asset
      WHERE media_asset_id = $1::uuid AND state = 'ready'
        AND cleanup_lease_token = $2::uuid AND cleanup_origin_state = 'restore'
      FOR UPDATE
    `, [input.mediaAssetId, input.cleanupLeaseToken]);
    const row = asset.rows[0];
    if (!row) {
      throw new BadRequestException("Photo media restore lease is stale");
    }
    const replacedPrimary = await client.query<{ media_asset_replica_id: string }>(`
      UPDATE ops.media_asset_replica SET is_active = FALSE, updated_at = NOW()
      WHERE media_asset_id = $1::uuid AND replica_role = 'primary' AND is_active
      RETURNING media_asset_replica_id
    `, [input.mediaAssetId]);
    if (input.previousPrimaryMissing === true && replacedPrimary.rows.length > 0) {
      await client.query(`
        UPDATE ops.media_asset_replica
        SET replica_state = 'deleted_tombstone', deleted_at = NOW(), updated_at = NOW()
        WHERE media_asset_replica_id = ANY($1::uuid[])
          AND replica_state = 'verified' AND NOT is_active
          AND provider_adapter_id = $2 AND jurisdiction = $3
      `, [
        replacedPrimary.rows.map((replica) => replica.media_asset_replica_id),
        storageIdentity.provider,
        storageIdentity.jurisdiction,
      ]);
    }
    const promoted = await client.query(`
      UPDATE ops.media_asset_replica
      SET replica_state = 'verified', is_active = TRUE, verified_at = NOW(), updated_at = NOW()
      WHERE media_asset_id = $1::uuid AND replica_role = 'primary'
        AND replica_generation = $2 AND replica_state = 'copying'
        AND object_key = $3 AND content_sha256 = $4 AND byte_count = $5::bigint
        AND provider_adapter_id = $6 AND jurisdiction = $7
      RETURNING media_asset_replica_id
    `, [
      input.mediaAssetId,
      input.replicaGeneration,
      input.restoreObjectKey,
      row.canonical_sha256,
      row.byte_count,
      storageIdentity.provider,
      storageIdentity.jurisdiction,
    ]);
    if (promoted.rows.length !== 1) {
      throw new ServiceUnavailableException("Photo media restore generation proof is stale");
    }
    await client.query(`
      UPDATE ops.media_asset
      SET canonical_object_key = $3, cleanup_lease_token = NULL,
          cleanup_lease_expires_at = NULL, cleanup_origin_state = NULL, updated_at = NOW()
      WHERE media_asset_id = $1::uuid AND cleanup_lease_token = $2::uuid
    `, [input.mediaAssetId, input.cleanupLeaseToken, input.restoreObjectKey]);
    await client.query(`
      INSERT INTO audit.photo_media_storage_event (
        actor_user_id, event_type, media_asset_id, company_id, correlation_id,
        reason_code, content_sha256, byte_count
      ) VALUES ($1::uuid, 'checklist_photo_evidence.storage.restore_verified',
        $2::uuid, $3::uuid, $2::text, 'manual_restore', $4, $5::bigint)
    `, [input.actorUserId, input.mediaAssetId, row.company_id, row.canonical_sha256, row.byte_count]);
  });
}

export async function finishPhotoMediaRestore(
  databaseService: DatabaseService,
  input: Record<string, unknown>,
  eventType: string,
  reasonCode: unknown,
): Promise<void> {
  await databaseService.withTransaction(async (client) => {
    const released = await client.query<{
      company_id: string;
      canonical_sha256: string;
      byte_count: string;
    }>(`
      UPDATE ops.media_asset
      SET cleanup_lease_token = NULL, cleanup_lease_expires_at = NULL,
          cleanup_origin_state = NULL, updated_at = NOW()
      WHERE media_asset_id = $1::uuid AND state = 'ready'
        AND cleanup_lease_token = $2::uuid AND cleanup_origin_state = 'restore'
      RETURNING company_id, canonical_sha256, byte_count
    `, [input.mediaAssetId, input.cleanupLeaseToken]);
    const row = released.rows[0];
    if (!row) {
      throw new BadRequestException("Photo media restore lease is stale");
    }
    await client.query(`
      INSERT INTO audit.photo_media_storage_event (
        actor_user_id, event_type, media_asset_id, company_id, correlation_id,
        reason_code, content_sha256, byte_count
      ) VALUES ($1::uuid, $2, $3::uuid, $4::uuid, $3::text, $5, $6, $7::bigint)
    `, [input.actorUserId, eventType, input.mediaAssetId, row.company_id, reasonCode, row.canonical_sha256, row.byte_count]);
  });
}
