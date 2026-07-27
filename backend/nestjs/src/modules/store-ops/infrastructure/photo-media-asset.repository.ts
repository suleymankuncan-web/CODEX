import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { DatabaseService } from "../../../shared/database/database.service";
import {
  PhotoMediaAssetRecord,
  buildPhotoMediaObjectKeys,
} from "../application/photo-media-storage.contract";
import { PhotoMediaAssetRepositoryPort } from "../application/photo-media-storage.ports";
import {
  CreatePhotoMediaAssetInput,
  createPhotoMediaAsset,
} from "./photo-media-asset-initiation.repository";
import {
  getPhotoMediaUsage, listPhotoMediaReconciliationInventory, mapPhotoMediaAsset, recordPhotoMediaAccess,
  recordPhotoMediaProviderFailure, recordPhotoMediaQuotaDenial,
  reservePhotoMediaProviderOperations,
} from "./photo-media-asset-shared.repository";

@Injectable()
export class PhotoMediaAssetRepository implements PhotoMediaAssetRepositoryPort {
  constructor(private readonly databaseService: DatabaseService) {}

  async getUsage() {
    return getPhotoMediaUsage(this.databaseService);
  }

  async createInitiatedAsset(input: CreatePhotoMediaAssetInput): Promise<PhotoMediaAssetRecord> {
    return createPhotoMediaAsset(this.databaseService, input);
  }

  async findAssetForRead(mediaAssetId: string): Promise<PhotoMediaAssetRecord | null> {
    const result = await this.databaseService.query<{
      media_asset_id: string;
      company_id: string;
      region_id: string | null;
      store_id: string | null;
      state: PhotoMediaAssetRecord["state"];
      raw_object_key: string;
      canonical_object_key: string | null;
      thumbnail_object_key: string | null;
      canonical_sha256: string | null;
      byte_count: string | null;
    }>(`
      SELECT media_asset_id, company_id, region_id, store_id, state, raw_object_key,
             canonical_object_key, thumbnail_object_key, canonical_sha256, byte_count
             , storage_attempt_id, raw_disposed_at
      FROM ops.media_asset
      WHERE media_asset_id = $1::uuid
    `, [mediaAssetId]);
    return result.rows[0] ? mapPhotoMediaAsset(result.rows[0]) : null;
  }

  async prepareFinalizeAttempt(mediaAssetId: string): Promise<PhotoMediaAssetRecord> {
    const result = await this.databaseService.query<{
      media_asset_id: string;
      company_id: string;
      region_id: string | null;
      store_id: string | null;
      state: PhotoMediaAssetRecord["state"];
      raw_object_key: string;
      storage_attempt_id: string;
    }>(`
      UPDATE ops.media_asset
      SET storage_attempt_id = COALESCE(storage_attempt_id, gen_random_uuid()), updated_at = NOW()
      WHERE media_asset_id = $1::uuid AND state = 'uploaded'
      RETURNING media_asset_id, company_id, region_id, store_id, state,
                raw_object_key, storage_attempt_id
    `, [mediaAssetId]);
    const row = result.rows[0];
    if (!row) {
      throw new BadRequestException("Photo media finalize attempt is stale");
    }
    return mapPhotoMediaAsset(row);
  }

  async acquireProcessingLease(input: Record<string, unknown>): Promise<string> {
    const requiredState = input.requiredState === "initiated" ? "initiated" : "uploaded";
    return this.databaseService.withTransaction(async (client) => {
      await client.query(`SELECT pg_advisory_xact_lock(hashtext('photo-media-processing')::bigint)`);
      await client.query(`
        UPDATE ops.media_asset
        SET processing_lease_token = NULL, processing_lease_expires_at = NULL, updated_at = NOW()
        WHERE processing_lease_expires_at <= NOW()
      `);
      const target = await client.query<{ uploaded_by_user_id: string; store_id: string }>(`
        SELECT uploaded_by_user_id, store_id
        FROM ops.media_asset
        WHERE media_asset_id = $1::uuid AND state = $2
        FOR UPDATE
      `, [input.mediaAssetId, requiredState]);
      const row = target.rows[0];
      if (!row) {
        throw new BadRequestException("Photo media processing target is stale");
      }
      const counts = await client.query<{ user_count: string; store_count: string }>(`
        SELECT
          COUNT(*) FILTER (WHERE uploaded_by_user_id = $1::uuid) AS user_count,
          COUNT(*) FILTER (WHERE store_id = $2::uuid) AS store_count
        FROM ops.media_asset
        WHERE processing_lease_token IS NOT NULL AND processing_lease_expires_at > NOW()
      `, [row.uploaded_by_user_id, row.store_id]);
      const limit = Number(input.concurrentProcessingHardLimit);
      if (
        Number(counts.rows[0]?.user_count ?? 0) >= limit ||
        Number(counts.rows[0]?.store_count ?? 0) >= limit
      ) {
        throw new ServiceUnavailableException("Photo media concurrent processing limit reached");
      }
      const leased = await client.query<{ processing_lease_token: string }>(`
        UPDATE ops.media_asset
        SET processing_lease_token = gen_random_uuid(),
            processing_lease_expires_at = NOW() + INTERVAL '5 minutes', updated_at = NOW()
        WHERE media_asset_id = $1::uuid AND state = $2 AND processing_lease_token IS NULL
        RETURNING processing_lease_token
      `, [input.mediaAssetId, requiredState]);
      const token = leased.rows[0]?.processing_lease_token;
      if (!token) {
        throw new ServiceUnavailableException("Photo media processing lease could not be acquired");
      }
      return token;
    });
  }

  async releaseProcessingLease(input: Record<string, unknown>): Promise<void> {
    await this.databaseService.query(`
      UPDATE ops.media_asset
      SET processing_lease_token = NULL, processing_lease_expires_at = NULL, updated_at = NOW()
      WHERE media_asset_id = $1::uuid AND processing_lease_token = $2::uuid
    `, [input.mediaAssetId, input.processingLeaseToken]);
  }

  async resizeByteReservation(input: Record<string, unknown>): Promise<void> {
    await this.databaseService.withTransaction(async (client) => {
      await client.query(`SELECT pg_advisory_xact_lock(hashtext('photo-media-r2-eu-quota')::bigint)`);
      const asset = await client.query<{ quota_reserved_bytes: string }>(`
        SELECT quota_reserved_bytes FROM ops.media_asset
        WHERE media_asset_id = $1::uuid AND state = 'uploaded'
        FOR UPDATE
      `, [input.mediaAssetId]);
      const row = asset.rows[0];
      if (!row) {
        throw new BadRequestException("Photo media byte reservation state is stale");
      }
      const currentReservation = Number(row.quota_reserved_bytes);
      const requiredReservation = Number(input.requiredBytes);
      const usage = await client.query<{ provider_visible_bytes: string }>(`
        SELECT provider_visible_bytes FROM ops.photo_media_usage_state
        WHERE usage_scope = 'r2-eu' FOR UPDATE
      `);
      const visible = Number(usage.rows[0]?.provider_visible_bytes ?? 0);
      if (
        !Number.isSafeInteger(requiredReservation) || requiredReservation <= 0 ||
        visible - currentReservation + requiredReservation > Number(input.aggregateBytesHardLimit)
      ) {
        throw new ServiceUnavailableException("Photo media storage hard limit reached after processing");
      }
      const delta = requiredReservation - currentReservation;
      await client.query(`
        UPDATE ops.photo_media_usage_state
        SET provider_visible_bytes = provider_visible_bytes + $1::bigint, updated_at = NOW()
        WHERE usage_scope = 'r2-eu'
      `, [delta]);
      const updated = await client.query(`
        UPDATE ops.media_asset SET quota_reserved_bytes = $2::bigint, updated_at = NOW()
        WHERE media_asset_id = $1::uuid AND state = 'uploaded'
        RETURNING media_asset_id
      `, [input.mediaAssetId, requiredReservation]);
      if (updated.rows.length !== 1) {
        throw new BadRequestException("Photo media byte reservation update failed");
      }
    });
  }

  async recordVerifiedReplica(input: Record<string, unknown>): Promise<void> {
    await this.databaseService.withTransaction(async (client) => {
      const asset = await client.query<{ company_id: string }>(`
        SELECT company_id FROM ops.media_asset
        WHERE media_asset_id = $1::uuid AND state = 'uploaded'
        FOR UPDATE
      `, [input.mediaAssetId]);
      const companyId = asset.rows[0]?.company_id;
      if (!companyId) {
        throw new BadRequestException("Photo media replica proof state is stale");
      }
      await client.query(`
        INSERT INTO ops.media_asset_replica (
          media_asset_id, company_id, replica_role, provider_adapter_id,
          jurisdiction, bucket_alias, object_key, replica_state,
          replica_generation, is_active, content_sha256, byte_count, copy_started_at, verified_at
        ) VALUES ($1::uuid, $2::uuid, $3, 'r2', 'eu', $3, $4, 'verified', 1, TRUE, $5, $6::bigint, NOW(), NOW())
        ON CONFLICT (media_asset_id, replica_role, replica_generation) DO NOTHING
      `, [input.mediaAssetId, companyId, input.replicaRole, input.objectKey, input.sha256, input.byteCount]);
      const exact = await client.query(`
        SELECT media_asset_replica_id
        FROM ops.media_asset_replica
        WHERE media_asset_id = $1::uuid AND replica_role = $2
          AND replica_state = 'verified' AND object_key = $3
          AND replica_generation = 1 AND is_active
          AND content_sha256 = $4 AND byte_count = $5::bigint
      `, [input.mediaAssetId, input.replicaRole, input.objectKey, input.sha256, input.byteCount]);
      if (exact.rows.length !== 1) {
        throw new ServiceUnavailableException("Photo media immutable replica proof conflicts with retry");
      }
      const eventType = input.replicaRole === "primary"
        ? "checklist_photo_evidence.storage.primary_verified"
        : "checklist_photo_evidence.storage.recovery_verified";
      await client.query(`
        INSERT INTO audit.photo_media_storage_event (
          actor_user_id, event_type, media_asset_id, company_id, correlation_id,
          content_sha256, byte_count
        ) VALUES ($1::uuid, $2, $3::uuid, $4::uuid, $3::text, $5, $6::bigint)
      `, [input.actorUserId, eventType, input.mediaAssetId, companyId, input.sha256, input.byteCount]);
    });
  }

  async markUploaded(input: Record<string, unknown>): Promise<void> {
    const result = await this.databaseService.query(`
      UPDATE ops.media_asset
      SET state = 'uploaded', uploaded_at = NOW(), updated_at = NOW()
      WHERE media_asset_id = $1::uuid
        AND state = 'initiated'
        AND declared_upload_byte_count = $2::bigint
        AND detected_mime_type = $3
      RETURNING media_asset_id
    `, [input.mediaAssetId, input.byteCount, input.contentType]);
    if (result.rows.length !== 1) {
      throw new BadRequestException("Photo media upload state is stale");
    }
  }

  async markReadyAfterVerifiedRecovery(input: Record<string, unknown>): Promise<void> {
    await this.databaseService.withTransaction(async (client) => {
      const locked = await client.query<{
        company_id: string;
        quota_reserved_bytes: string;
        quota_reserved_class_a: number;
        quota_reserved_class_b: number;
        evidence_retention_days: number;
        declared_upload_byte_count: string;
      }>(`
        SELECT ma.company_id, ma.quota_reserved_bytes, ma.quota_reserved_class_a,
               ma.quota_reserved_class_b, policy.evidence_retention_days,
               ma.declared_upload_byte_count
        FROM ops.media_asset ma
        JOIN ops.evidence_retention_policy policy
          ON policy.retention_policy_id = ma.retention_policy_id
         AND policy.company_id = ma.company_id
         AND policy.version_no = ma.retention_policy_version
        WHERE ma.media_asset_id = $1::uuid AND ma.state IN ('uploaded', 'accepted', 'canonicalized')
        FOR UPDATE
      `, [input.mediaAssetId]);
      const asset = locked.rows[0];
      if (!asset) {
        throw new BadRequestException("Photo media asset finalize state is stale");
      }

      const accountedBytes = Number(input.canonicalByteCount) * 2
        + Number(input.thumbnailByteCount)
        + Number(asset.declared_upload_byte_count);
      if (Number(asset.quota_reserved_bytes) !== accountedBytes) {
        throw new ServiceUnavailableException("Photo media finalized bytes do not match the reserved quota");
      }
      const finalized = await client.query(`
        UPDATE ops.media_asset
        SET state = 'ready',
            canonical_object_key = $2,
            thumbnail_object_key = $3,
            detected_mime_type = $4,
            byte_count = $5::bigint,
            thumbnail_byte_count = $6::bigint,
            original_sha256 = $7,
            canonical_sha256 = $8,
            width_px = $9,
            height_px = $10,
            accepted_at = NOW(),
            canonicalized_at = NOW(),
            finalized_at = NOW(),
            metadata_stripped_at = NOW(),
            safety_scanned_at = NOW(),
            expires_at = NOW() + make_interval(days => $11::integer),
            quota_reserved_bytes = 0,
            quota_reserved_class_a = 0,
            quota_reserved_class_b = 0,
            accounted_provider_bytes = $12::bigint,
            updated_at = NOW()
        WHERE media_asset_id = $1::uuid
          AND state IN ('uploaded', 'accepted', 'canonicalized')
        RETURNING media_asset_id
      `, [
        input.mediaAssetId,
        input.canonicalObjectKey,
        input.thumbnailObjectKey,
        input.mimeType,
        input.canonicalByteCount,
        input.thumbnailByteCount,
        input.originalSha256,
        input.canonicalSha256,
        input.widthPx,
        input.heightPx,
        asset.evidence_retention_days,
        accountedBytes,
      ]);
      if (finalized.rows.length !== 1) {
        throw new BadRequestException("Photo media asset could not transition to ready");
      }
    });
  }

  async markRawDisposed(input: Record<string, unknown>): Promise<void> {
    await this.databaseService.withTransaction(async (client) => {
      const result = await client.query<{
        company_id: string;
        declared_upload_byte_count: string;
      }>(`
        UPDATE ops.media_asset
        SET raw_disposed_at = NOW(),
            accounted_provider_bytes = GREATEST(0, accounted_provider_bytes - declared_upload_byte_count),
            updated_at = NOW()
        WHERE media_asset_id = $1::uuid AND state = 'ready' AND raw_disposed_at IS NULL
          AND cleanup_lease_token = $2::uuid AND cleanup_lease_expires_at > NOW()
          AND cleanup_origin_state = 'raw_disposal' AND NOT raw_security_hold
        RETURNING company_id, declared_upload_byte_count
      `, [input.mediaAssetId, input.cleanupLeaseToken]);
      const row = result.rows[0];
      if (!row) {
        throw new BadRequestException("Photo media raw disposal lease is stale or held");
      }
      await client.query(`
        UPDATE ops.media_asset
        SET cleanup_lease_token = NULL, cleanup_lease_expires_at = NULL,
            cleanup_origin_state = NULL, updated_at = NOW()
        WHERE media_asset_id = $1::uuid
      `, [input.mediaAssetId]);
      await client.query(`
        UPDATE ops.photo_media_usage_state
        SET provider_visible_bytes = GREATEST(0, provider_visible_bytes - $1::bigint), updated_at = NOW()
        WHERE usage_scope = 'r2-eu'
      `, [row.declared_upload_byte_count]);
      await client.query(`
        INSERT INTO audit.photo_media_storage_event (
          actor_user_id, event_type, media_asset_id, company_id, correlation_id, reason_code
        ) VALUES (
          $1::uuid, 'checklist_photo_evidence.storage.raw_disposed', $2::uuid,
          $3::uuid, $2::text, 'raw_finalized'
        )
      `, [input.actorUserId, input.mediaAssetId, row.company_id]);
    });
  }

  async claimReadyRawDisposal(mediaAssetId: string) {
    const result = await this.databaseService.query<{
      media_asset_id: string;
      raw_object_key: string;
      cleanup_lease_token: string;
    }>(`
      UPDATE ops.media_asset
      SET cleanup_origin_state = 'raw_disposal', cleanup_lease_token = gen_random_uuid(),
          cleanup_lease_expires_at = NOW() + INTERVAL '15 minutes', updated_at = NOW()
      WHERE media_asset_id = $1::uuid AND state = 'ready' AND raw_disposed_at IS NULL
        AND NOT raw_security_hold
        AND (cleanup_lease_token IS NULL OR cleanup_lease_expires_at <= NOW())
      RETURNING media_asset_id, raw_object_key, cleanup_lease_token
    `, [mediaAssetId]);
    const row = result.rows[0];
    return row ? {
      mediaAssetId: row.media_asset_id,
      rawObjectKey: row.raw_object_key,
      cleanupLeaseToken: row.cleanup_lease_token,
    } : null;
  }

  async claimReadyRawDisposals(limit: number) {
    const result = await this.databaseService.query<{
      media_asset_id: string;
      raw_object_key: string;
      cleanup_lease_token: string;
    }>(`
      WITH eligible AS (
        SELECT media_asset_id FROM ops.media_asset
        WHERE state = 'ready' AND raw_disposed_at IS NULL AND NOT raw_security_hold
          AND (cleanup_lease_token IS NULL OR cleanup_lease_expires_at <= NOW())
        ORDER BY updated_at, media_asset_id
        FOR UPDATE SKIP LOCKED LIMIT $1
      )
      UPDATE ops.media_asset ma
      SET cleanup_origin_state = 'raw_disposal', cleanup_lease_token = gen_random_uuid(),
          cleanup_lease_expires_at = NOW() + INTERVAL '15 minutes', updated_at = NOW()
      FROM eligible
      WHERE ma.media_asset_id = eligible.media_asset_id
      RETURNING ma.media_asset_id, ma.raw_object_key, ma.cleanup_lease_token
    `, [limit]);
    return result.rows.map((row) => ({
      mediaAssetId: row.media_asset_id,
      rawObjectKey: row.raw_object_key,
      cleanupLeaseToken: row.cleanup_lease_token,
    }));
  }

  async markQuarantined(input: Record<string, unknown>): Promise<void> {
    await this.databaseService.withTransaction(async (client) => {
      const updated = await client.query<{ company_id: string }>(`
        UPDATE ops.media_asset
        SET state = 'quarantined', quarantined_at = NOW(), rejection_reason = $2, updated_at = NOW()
        WHERE media_asset_id = $1::uuid AND state IN ('initiated', 'uploaded')
        RETURNING company_id
      `, [input.mediaAssetId, input.reasonCode]);
      const row = updated.rows[0];
      if (!row) {
        throw new BadRequestException("Photo media quarantine state is stale");
      }
      await client.query(`
        INSERT INTO audit.photo_media_storage_event (
          actor_user_id, event_type, media_asset_id, company_id, correlation_id, reason_code
        ) VALUES ($1::uuid, 'checklist_photo_evidence.storage.quarantined',
          $2::uuid, $3::uuid, $2::text, 'scanner_unsafe')
      `, [input.actorUserId, input.mediaAssetId, row.company_id]);
    });
  }

  async markRejected(input: Record<string, unknown>): Promise<void> {
    await this.databaseService.withTransaction(async (client) => {
      const result = await client.query<{ quota_reserved_bytes: string }>(`
        WITH target AS (
          SELECT media_asset_id, quota_reserved_bytes
          FROM ops.media_asset
          WHERE media_asset_id = $1::uuid AND state IN ('initiated', 'uploaded')
          FOR UPDATE
        ), updated AS (
          UPDATE ops.media_asset ma
          SET state = 'rejected', rejected_at = NOW(), rejection_reason = $2,
              raw_disposed_at = NOW(), quota_reserved_bytes = 0,
              quota_reserved_class_a = 0, quota_reserved_class_b = 0,
              updated_at = NOW()
          FROM target
          WHERE ma.media_asset_id = target.media_asset_id
          RETURNING target.quota_reserved_bytes
        )
        SELECT quota_reserved_bytes FROM updated
      `, [input.mediaAssetId, input.reasonCode]);
      const reserved = Number(result.rows[0]?.quota_reserved_bytes ?? 0);
      if (reserved > 0) {
        await client.query(`
          UPDATE ops.photo_media_usage_state
          SET provider_visible_bytes = GREATEST(0, provider_visible_bytes - $1::bigint), updated_at = NOW()
          WHERE usage_scope = 'r2-eu'
        `, [reserved]);
      }
    });
  }

  async recordAccessEvent(input: Record<string, unknown>): Promise<void> {
    await recordPhotoMediaAccess(this.databaseService, input);
  }

  async listReconciliationInventory() {
    return listPhotoMediaReconciliationInventory(this.databaseService);
  }

  async recordReconciliationReceipt(input: Record<string, unknown>): Promise<void> {
    await this.databaseService.withTransaction(async (client) => {
      await client.query(`
        INSERT INTO audit.photo_media_reconciliation_run (
          expected_asset_count, missing_object_count, mismatch_object_count,
          orphan_primary_count, orphan_recovery_count, manifest_digest
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        input.expectedAssetCount,
        input.missingObjectCount,
        input.mismatchObjectCount,
        input.orphanPrimaryCount,
        input.orphanRecoveryCount,
        input.manifestDigest,
      ]);
      for (const finding of (input.findingEvents ?? []) as Array<{ mediaAssetId: string; reasonCode: string }>) {
        await client.query(`
          INSERT INTO audit.photo_media_storage_event (
            event_type, media_asset_id, company_id, correlation_id, reason_code,
            manifest_digest
          )
          SELECT 'checklist_photo_evidence.storage.reconciliation_detected',
                 media_asset_id, company_id, media_asset_id::text, $2, $3
          FROM ops.media_asset WHERE media_asset_id = $1::uuid
        `, [finding.mediaAssetId, finding.reasonCode, input.manifestDigest]);
      }
    });
  }

  async claimCleanupCandidates(limit: number) {
    return this.databaseService.withTransaction(async (client) => {
      const result = await client.query<{
        media_asset_id: string;
        canonical_sha256: string;
        thumbnail_object_key: string;
        primary_object_keys: string[];
        recovery_object_keys: string[];
        cleanup_lease_token: string;
      }>(`
        WITH eligible AS (
          SELECT ma.media_asset_id
          FROM ops.media_asset ma
          WHERE (
              (ma.state = 'ready' AND ma.expires_at <= NOW())
              OR (ma.state = 'purge_pending' AND ma.cleanup_origin_state = 'ready')
            )
            AND (ma.cleanup_lease_token IS NULL OR ma.cleanup_lease_expires_at <= NOW())
            AND NOT ma.legal_hold
            AND NOT ma.operational_hold
            AND NOT ma.active_workflow_hold
            AND NOT ma.ai_review_hold
          ORDER BY ma.expires_at, ma.media_asset_id
          FOR UPDATE SKIP LOCKED
          LIMIT $1
        )
        UPDATE ops.media_asset ma
        SET state = 'purge_pending', purge_pending_at = COALESCE(ma.purge_pending_at, NOW()),
            cleanup_origin_state = COALESCE(ma.cleanup_origin_state, ma.state),
            cleanup_lease_token = gen_random_uuid(),
            cleanup_lease_expires_at = NOW() + INTERVAL '15 minutes', updated_at = NOW()
        FROM eligible,
             LATERAL (
               SELECT array_agg(mar.object_key ORDER BY mar.replica_generation) AS object_keys
               FROM ops.media_asset_replica mar
               WHERE mar.media_asset_id = eligible.media_asset_id
                 AND mar.replica_role = 'primary'
                 AND mar.replica_state IN ('copying', 'verified')
             ) primary_replicas,
             LATERAL (
               SELECT array_agg(mar.object_key ORDER BY mar.replica_generation) AS object_keys
               FROM ops.media_asset_replica mar
               WHERE mar.media_asset_id = eligible.media_asset_id
                 AND mar.replica_role = 'recovery'
                 AND mar.replica_state IN ('copying', 'verified')
             ) recovery_replicas
        WHERE ma.media_asset_id = eligible.media_asset_id
        RETURNING ma.media_asset_id, ma.canonical_sha256,
                  ma.thumbnail_object_key, primary_replicas.object_keys AS primary_object_keys,
                  recovery_replicas.object_keys AS recovery_object_keys,
                  ma.cleanup_lease_token
      `, [limit]);
      return result.rows.map((row) => ({
        mediaAssetId: row.media_asset_id,
        cleanupLeaseToken: row.cleanup_lease_token,
        canonicalSha256: row.canonical_sha256,
        thumbnailObjectKey: row.thumbnail_object_key,
        primaryObjectKeys: row.primary_object_keys ?? [],
        recoveryObjectKeys: row.recovery_object_keys ?? [],
      }));
    });
  }

  async markDeletedTombstone(input: Record<string, unknown>): Promise<void> {
    await this.databaseService.withTransaction(async (client) => {
      const locked = await client.query<{ company_id: string; accounted_provider_bytes: string }>(`
        SELECT company_id, accounted_provider_bytes
        FROM ops.media_asset
        WHERE media_asset_id = $1::uuid
          AND state = 'purge_pending'
          AND cleanup_lease_token = $2::uuid
          AND cleanup_lease_expires_at > NOW()
          AND NOT legal_hold
          AND NOT operational_hold
          AND NOT active_workflow_hold
          AND NOT ai_review_hold
        FOR UPDATE
      `, [input.mediaAssetId, input.cleanupLeaseToken]);
      const asset = locked.rows[0];
      if (!asset) {
        throw new BadRequestException("Photo media cleanup state is stale or held");
      }
      await client.query(`
        UPDATE ops.media_asset_replica
        SET replica_state = 'deleted_tombstone', deleted_at = NOW(), updated_at = NOW()
        WHERE media_asset_id = $1::uuid AND replica_state IN ('copying', 'verified')
      `, [input.mediaAssetId]);
      const updated = await client.query(`
        UPDATE ops.media_asset
        SET state = 'deleted_tombstone', deleted_at = NOW(), deletion_reason = $3,
            tombstone_sha256 = $4, accounted_provider_bytes = 0,
            cleanup_lease_token = NULL, cleanup_lease_expires_at = NULL,
            cleanup_origin_state = NULL, updated_at = NOW()
        WHERE media_asset_id = $1::uuid AND state = 'purge_pending'
          AND cleanup_lease_token = $2::uuid
        RETURNING media_asset_id
      `, [input.mediaAssetId, input.cleanupLeaseToken, input.reasonCode, input.tombstoneSha256]);
      if (updated.rows.length !== 1) {
        throw new BadRequestException("Photo media tombstone transition failed");
      }
      await client.query(`
        UPDATE ops.photo_media_usage_state
        SET provider_visible_bytes = GREATEST(0, provider_visible_bytes - $1::bigint), updated_at = NOW()
        WHERE usage_scope = 'r2-eu'
      `, [asset.accounted_provider_bytes]);
      await client.query(`
        INSERT INTO audit.photo_media_storage_event (
          event_type, media_asset_id, company_id, correlation_id, reason_code, content_sha256
        ) VALUES (
          'checklist_photo_evidence.storage.cleanup_deleted', $1::uuid, $2::uuid,
          $1::text, 'governed_cleanup', $3
        )
      `, [input.mediaAssetId, asset.company_id, input.tombstoneSha256]);
    });
  }

  async claimStalePartialUploads(limit: number) {
    return this.databaseService.withTransaction(async (client) => {
      const result = await client.query<{
        media_asset_id: string;
        raw_object_key: string;
        cleanup_lease_token: string;
      }>(`
        WITH eligible AS (
          SELECT media_asset_id
          FROM ops.media_asset
          WHERE (
              (state IN ('initiated', 'uploaded') AND initiated_at < NOW() - INTERVAL '24 hours')
              OR (state = 'purge_pending' AND cleanup_origin_state IN ('initiated', 'uploaded'))
            )
            AND (cleanup_lease_token IS NULL OR cleanup_lease_expires_at <= NOW())
            AND NOT raw_security_hold
          ORDER BY initiated_at, media_asset_id
          FOR UPDATE SKIP LOCKED
          LIMIT $1
        )
        UPDATE ops.media_asset ma
        SET state = 'purge_pending', purge_pending_at = COALESCE(ma.purge_pending_at, NOW()),
            cleanup_origin_state = COALESCE(ma.cleanup_origin_state, ma.state),
            cleanup_lease_token = gen_random_uuid(),
            cleanup_lease_expires_at = NOW() + INTERVAL '15 minutes', updated_at = NOW()
        FROM eligible
        WHERE ma.media_asset_id = eligible.media_asset_id
        RETURNING ma.media_asset_id, ma.raw_object_key, ma.cleanup_lease_token
      `, [limit]);
      return result.rows.map((row) => ({
        mediaAssetId: row.media_asset_id,
        cleanupLeaseToken: row.cleanup_lease_token,
        rawObjectKey: row.raw_object_key,
      }));
    });
  }

  async claimQuarantinedDisposal(mediaAssetId: string) {
    const result = await this.databaseService.query<{
      media_asset_id: string;
      raw_object_key: string;
      cleanup_lease_token: string;
    }>(`
      UPDATE ops.media_asset
      SET state = 'purge_pending', purge_pending_at = COALESCE(purge_pending_at, NOW()),
          cleanup_origin_state = COALESCE(cleanup_origin_state, state),
          cleanup_lease_token = gen_random_uuid(),
          cleanup_lease_expires_at = NOW() + INTERVAL '15 minutes', updated_at = NOW()
      WHERE media_asset_id = $1::uuid
        AND (state = 'quarantined' OR (state = 'purge_pending' AND cleanup_origin_state = 'quarantined'))
        AND (cleanup_lease_token IS NULL OR cleanup_lease_expires_at <= NOW())
        AND NOT raw_security_hold
      RETURNING media_asset_id, raw_object_key, cleanup_lease_token
    `, [mediaAssetId]);
    const row = result.rows[0];
    if (!row) {
      throw new BadRequestException("Photo media quarantine is stale, held, or already leased");
    }
    return {
      mediaAssetId: row.media_asset_id,
      cleanupLeaseToken: row.cleanup_lease_token,
      rawObjectKey: row.raw_object_key,
    };
  }

  async markPartialUploadDisposed(input: Record<string, unknown>): Promise<void> {
    await this.databaseService.withTransaction(async (client) => {
      const result = await client.query<{ quota_reserved_bytes: string }>(`
        WITH target AS (
          SELECT media_asset_id, quota_reserved_bytes
          FROM ops.media_asset
          WHERE media_asset_id = $1::uuid
            AND state = 'purge_pending'
            AND cleanup_lease_token = $2::uuid
            AND cleanup_lease_expires_at > NOW()
            AND canonical_object_key IS NULL
            AND NOT raw_security_hold
          FOR UPDATE
        ), updated AS (
          UPDATE ops.media_asset ma
          SET state = 'rejected', rejected_at = NOW(), rejection_reason = $3,
              raw_disposed_at = NOW(), quota_reserved_bytes = 0,
              quota_reserved_class_a = 0, quota_reserved_class_b = 0,
              cleanup_lease_token = NULL, cleanup_lease_expires_at = NULL,
              cleanup_origin_state = NULL, updated_at = NOW()
          FROM target
          WHERE ma.media_asset_id = target.media_asset_id
          RETURNING target.quota_reserved_bytes
        )
        SELECT quota_reserved_bytes FROM updated
      `, [input.mediaAssetId, input.cleanupLeaseToken, input.reasonCode]);
      if (result.rows.length !== 1) {
        throw new BadRequestException("Photo media partial cleanup state is stale or held");
      }
      const reserved = Number(result.rows[0]?.quota_reserved_bytes ?? 0);
      if (reserved > 0) {
        await client.query(`
          UPDATE ops.photo_media_usage_state
          SET provider_visible_bytes = GREATEST(0, provider_visible_bytes - $1::bigint), updated_at = NOW()
          WHERE usage_scope = 'r2-eu'
        `, [reserved]);
      }
    });
  }

  async recordCleanupFailure(input: Record<string, unknown>): Promise<void> {
    await this.databaseService.withTransaction(async (client) => {
      const released = await client.query<{ company_id: string }>(`
        UPDATE ops.media_asset
        SET cleanup_lease_token = NULL, cleanup_lease_expires_at = NULL, updated_at = NOW()
        WHERE media_asset_id = $1::uuid
          AND state IN ('purge_pending', 'ready')
          AND cleanup_lease_token = $2::uuid
        RETURNING company_id
      `, [input.mediaAssetId, input.cleanupLeaseToken]);
      const row = released.rows[0];
      if (!row) {
        throw new BadRequestException("Photo media cleanup failure lease is stale");
      }
      await client.query(`
        INSERT INTO audit.photo_media_storage_event (
          event_type, media_asset_id, company_id, correlation_id, reason_code
        ) VALUES (
          'checklist_photo_evidence.storage.cleanup_failed', $1::uuid, $2::uuid,
          $1::text, $3
        )
      `, [input.mediaAssetId, row.company_id, input.reasonCode]);
    });
  }

  async recordProviderFailure(input: Record<string, unknown>): Promise<void> {
    await recordPhotoMediaProviderFailure(this.databaseService, input);
  }

  async recordQuotaDenial(input: Record<string, unknown>): Promise<void> {
    await recordPhotoMediaQuotaDenial(this.databaseService, input);
  }

  async claimRestoreCandidate(input: Record<string, unknown>) {
    return this.databaseService.withTransaction(async (client) => {
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
        RETURNING ma.media_asset_id, ma.company_id, ma.cleanup_lease_token,
                  ma.canonical_object_key, recovery.object_key AS recovery_object_key,
                  ma.canonical_sha256, ma.byte_count,
                  COALESCE(
                    (SELECT replica_generation FROM ops.media_asset_replica pending
                     WHERE pending.media_asset_id = ma.media_asset_id
                       AND pending.replica_role = 'primary' AND pending.replica_state = 'copying'
                     ORDER BY replica_generation DESC LIMIT 1),
                    (SELECT COALESCE(MAX(replica_generation), 0) + 1
                     FROM ops.media_asset_replica generations
                     WHERE generations.media_asset_id = ma.media_asset_id
                       AND generations.replica_role = 'primary')
                  ) AS replica_generation,
                  (SELECT object_key FROM ops.media_asset_replica pending
                   WHERE pending.media_asset_id = ma.media_asset_id
                     AND pending.replica_role = 'primary' AND pending.replica_state = 'copying'
                   ORDER BY replica_generation DESC LIMIT 1) AS restore_object_key
      `, [input.mediaAssetId]);
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

  async reserveRestoreGeneration(input: Record<string, unknown>): Promise<void> {
    await this.databaseService.withTransaction(async (client) => {
      await client.query(`SELECT pg_advisory_xact_lock(hashtext('photo-media-r2-eu-quota')::bigint)`);
      const asset = await client.query<{
        company_id: string;
        accounted_provider_bytes: string;
        evidence_retention_days: number;
      }>(`
        SELECT ma.company_id, ma.accounted_provider_bytes, policy.evidence_retention_days
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
          $1::uuid, $2::uuid, 'primary', 'r2', 'eu', 'primary', $3, $4, FALSE,
          'copying', $5, $6::bigint, NOW()
        )
        ON CONFLICT (media_asset_id, replica_role, replica_generation) DO NOTHING
        RETURNING media_asset_replica_id
      `, [
        input.mediaAssetId, row.company_id, input.restoreObjectKey,
        input.replicaGeneration, input.canonicalSha256, input.canonicalByteCount,
      ]);
      if (inserted.rows.length === 0) {
        return;
      }
      const additionalBytes = Number(input.additionalBytes);
      const usage = await client.query<{ provider_visible_bytes: string }>(`
        SELECT provider_visible_bytes FROM ops.photo_media_usage_state
        WHERE usage_scope = 'r2-eu' FOR UPDATE
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
          WHERE usage_scope = 'r2-eu'
        `, [additionalBytes]);
      }
      await client.query(`
        UPDATE ops.media_asset
        SET accounted_provider_bytes = accounted_provider_bytes + $3::bigint,
            expires_at = GREATEST(expires_at, NOW() + make_interval(days => $4::integer)),
            updated_at = NOW()
        WHERE media_asset_id = $1::uuid AND cleanup_lease_token = $2::uuid
      `, [input.mediaAssetId, input.cleanupLeaseToken, additionalBytes, row.evidence_retention_days]);
    });
  }

  async markRestoreVerified(input: Record<string, unknown>): Promise<void> {
    await this.databaseService.withTransaction(async (client) => {
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
        `, [replacedPrimary.rows.map((replica) => replica.media_asset_replica_id)]);
      }
      const promoted = await client.query(`
        UPDATE ops.media_asset_replica
        SET replica_state = 'verified', is_active = TRUE, verified_at = NOW(), updated_at = NOW()
        WHERE media_asset_id = $1::uuid AND replica_role = 'primary'
          AND replica_generation = $2 AND replica_state = 'copying'
          AND object_key = $3 AND content_sha256 = $4 AND byte_count = $5::bigint
        RETURNING media_asset_replica_id
      `, [input.mediaAssetId, input.replicaGeneration, input.restoreObjectKey, row.canonical_sha256, row.byte_count]);
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

  async markRestoreFailed(input: Record<string, unknown>): Promise<void> {
    await this.finishRestore(input, "checklist_photo_evidence.storage.restore_failed", input.reasonCode);
  }

  async markRestoreSkipped(input: Record<string, unknown>): Promise<void> {
    await this.finishRestore(input, "checklist_photo_evidence.storage.restore_skipped", "primary_healthy");
  }

  private async finishRestore(
    input: Record<string, unknown>,
    eventType: string,
    reasonCode: unknown,
  ): Promise<void> {
    await this.databaseService.withTransaction(async (client) => {
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

  async reserveProviderOperations(input: {
    classAOperations: number;
    classBOperations: number;
    monthlyClassAHardLimit: number;
    monthlyClassBHardLimit: number;
  }): Promise<void> {
    await reservePhotoMediaProviderOperations(this.databaseService, input);
  }
}
