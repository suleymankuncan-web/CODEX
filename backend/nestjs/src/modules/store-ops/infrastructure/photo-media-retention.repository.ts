import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { DatabaseService } from "../../../shared/database/database.service";
import {
  PhotoMediaPurgeSnapshot,
  PhotoMediaPurgeReason,
  buildPurgeEligibilityDigest,
  buildPurgeManifestDigest,
} from "../application/photo-media-retention.contract";
import { PhotoMediaRetentionRepositoryPort } from "../application/photo-media-retention.ports";
import { PHOTO_MEDIA_USAGE_SCOPE } from "../application/photo-media-storage.contract";

type ManifestRow = {
  photo_media_purge_manifest_id: string;
  status: string;
  manifest_digest: string;
  candidate_count: number;
  candidate_bytes: string;
  expires_at: Date;
  execution_lease_token: string | null;
  execution_lease_expires_at: Date | null;
  execution_lease_expired?: boolean;
  manifest_not_expired?: boolean;
};

type SnapshotRow = {
  media_asset_id: string;
  company_id: string;
  state: "ready" | "purge_pending" | "deleted_tombstone";
  canonical_sha256: string;
  accounted_provider_bytes: string;
  expires_at: Date;
  retention_policy_id: string;
  retention_policy_version: number;
  eligibility_digest?: string;
  legal_hold?: boolean;
  operational_hold?: boolean;
  active_workflow_hold?: boolean;
  ai_review_hold?: boolean;
  cleanup_origin_state?: string | null;
  cleanup_lease_token?: string | null;
  cleanup_lease_expires_at?: Date | null;
  thumbnail_object_key?: string;
  raw_disposed_at?: Date | null;
  purge_manifest_id?: string | null;
  expiry_eligible?: boolean;
  cleanup_lease_available?: boolean;
};

function retentionConflict(code: string, message: string): ConflictException {
  return new ConflictException({ code, message });
}

function retentionBadRequest(code: string, message: string): BadRequestException {
  return new BadRequestException({ code, message });
}

function mapSnapshot(row: SnapshotRow): PhotoMediaPurgeSnapshot {
  return {
    mediaAssetId: row.media_asset_id,
    companyId: row.company_id,
    assetState: "ready",
    canonicalSha256: row.canonical_sha256,
    accountedProviderBytes: Number(row.accounted_provider_bytes),
    expiresAt: new Date(row.expires_at),
    retentionPolicyId: row.retention_policy_id,
    retentionPolicyVersion: Number(row.retention_policy_version),
  };
}

@Injectable()
export class PhotoMediaRetentionRepository implements PhotoMediaRetentionRepositoryPort {
  constructor(private readonly databaseService: DatabaseService) {}

  async createPurgeManifest(input: {
    limit: number;
    reason: PhotoMediaPurgeReason;
    source: "manual" | "scheduled";
    actorUserId: string | null;
    ttlMinutes: number;
    allowedCompanyIds?: string[];
  }) {
    return this.databaseService.withTransaction(async (client) => {
      const candidates = await client.query<SnapshotRow>(`
        SELECT ma.media_asset_id, ma.company_id, ma.state, ma.canonical_sha256,
               ma.accounted_provider_bytes, ma.expires_at,
               ma.retention_policy_id, ma.retention_policy_version
        FROM ops.media_asset ma
        WHERE ma.state = 'ready'
          AND ma.expires_at <= NOW()
          AND ma.raw_disposed_at IS NOT NULL
          AND ($2::uuid[] IS NULL OR ma.company_id = ANY($2::uuid[]))
          AND NOT ma.legal_hold
          AND NOT ma.operational_hold
          AND NOT ma.active_workflow_hold
          AND NOT ma.ai_review_hold
          AND (ma.cleanup_lease_token IS NULL OR ma.cleanup_lease_expires_at <= NOW())
          AND NOT EXISTS (
            SELECT 1
            FROM ops.photo_media_purge_manifest_item item
            JOIN ops.photo_media_purge_manifest manifest
              ON manifest.photo_media_purge_manifest_id = item.photo_media_purge_manifest_id
            WHERE item.media_asset_id = ma.media_asset_id
              AND manifest.status IN ('previewed', 'executing')
              AND manifest.expires_at > NOW()
          )
        ORDER BY ma.expires_at, ma.media_asset_id
        FOR SHARE SKIP LOCKED
        LIMIT $1
      `, [input.limit, input.allowedCompanyIds ?? null]);
      const snapshots = candidates.rows.map(mapSnapshot).map((snapshot) => ({
        ...snapshot,
        eligibilityDigest: buildPurgeEligibilityDigest(snapshot),
      }));
      const manifestDigest = buildPurgeManifestDigest(snapshots);
      const candidateBytes = snapshots.reduce(
        (total, item) => total + item.accountedProviderBytes,
        0,
      );
      const created = await client.query<ManifestRow>(`
        INSERT INTO ops.photo_media_purge_manifest (
          source, status, manifest_digest, candidate_count, candidate_bytes,
          reason, created_by_user_id, expires_at
        ) VALUES ($1, 'previewed', $2, $3, $4, $5, $6::uuid,
                  NOW() + make_interval(mins => $7))
        RETURNING photo_media_purge_manifest_id, status, manifest_digest,
                  candidate_count, candidate_bytes, expires_at,
                  execution_lease_token, execution_lease_expires_at
      `, [
        input.source,
        manifestDigest,
        snapshots.length,
        candidateBytes,
        input.reason,
        input.actorUserId,
        input.ttlMinutes,
      ]);
      const manifest = created.rows[0];
      if (!manifest) throw retentionConflict("manifest_stale", "Photo media purge manifest was not created");
      for (const [index, snapshot] of snapshots.entries()) {
        await client.query(`
          INSERT INTO ops.photo_media_purge_manifest_item (
            photo_media_purge_manifest_id, item_no, media_asset_id, company_id,
            asset_state, canonical_sha256, accounted_provider_bytes, expires_at,
            retention_policy_id, retention_policy_version, eligibility_digest
          ) VALUES ($1::uuid, $2, $3::uuid, $4::uuid, $5, $6, $7, $8, $9::uuid, $10, $11)
        `, [
          manifest.photo_media_purge_manifest_id,
          index + 1,
          snapshot.mediaAssetId,
          snapshot.companyId,
          snapshot.assetState,
          snapshot.canonicalSha256,
          snapshot.accountedProviderBytes,
          snapshot.expiresAt,
          snapshot.retentionPolicyId,
          snapshot.retentionPolicyVersion,
          snapshot.eligibilityDigest,
        ]);
      }
      await client.query(`
        INSERT INTO audit.photo_evidence_event (
          actor_user_id, event_type, entity_name, entity_id, company_id,
          correlation_id, reason_code, state_after, content_sha256
        )
        SELECT $1::uuid, 'checklist_photo_evidence.retention.cleanup_previewed',
               'photo_media_purge_manifest', $2::uuid,
               company_id,
               $2::text, 'governed_cleanup', 'previewed', $3
        FROM ops.photo_media_purge_manifest_item
        WHERE photo_media_purge_manifest_id = $2::uuid
        GROUP BY company_id
      `, [input.actorUserId, manifest.photo_media_purge_manifest_id, manifestDigest]);
      return {
        manifestId: manifest.photo_media_purge_manifest_id,
        manifestDigest,
        candidateCount: snapshots.length,
        candidateBytes,
        expiresAt: manifest.expires_at,
        status: "previewed" as const,
      };
    });
  }

  async claimPurgeManifest(input: {
    manifestId: string;
    manifestDigest: string;
    actorUserId: string | null;
    allowedCompanyIds?: string[];
  }) {
    const expired = await this.databaseService.query(`
      UPDATE ops.photo_media_purge_manifest
      SET status = 'expired', execution_lease_token = NULL,
          execution_lease_expires_at = NULL
      WHERE photo_media_purge_manifest_id = $1::uuid
        AND manifest_digest = $2
        AND expires_at <= NOW()
        AND (status IN ('previewed', 'retryable_failure')
          OR (status = 'executing' AND execution_lease_expires_at <= NOW()))
      RETURNING photo_media_purge_manifest_id
    `, [input.manifestId, input.manifestDigest]);
    if (expired.rows.length > 0) {
      throw retentionConflict("manifest_expired", "Photo media purge manifest expired");
    }
    const claimed = await this.databaseService.withTransaction(async (client) => {
      const manifestResult = await client.query<ManifestRow>(`
        SELECT photo_media_purge_manifest_id, status, manifest_digest,
               candidate_count, candidate_bytes, expires_at,
               execution_lease_token, execution_lease_expires_at,
               (execution_lease_expires_at IS NULL
                 OR execution_lease_expires_at <= NOW()) AS execution_lease_expired,
               (expires_at > NOW()) AS manifest_not_expired
        FROM ops.photo_media_purge_manifest
        WHERE photo_media_purge_manifest_id = $1::uuid
        FOR UPDATE
      `, [input.manifestId]);
      const manifest = manifestResult.rows[0];
      if (!manifest) {
        throw new NotFoundException({
          code: "manifest_not_found",
          message: "Photo media purge manifest was not found",
        });
      }
      if (manifest.manifest_digest !== input.manifestDigest) {
        throw retentionBadRequest(
          "manifest_digest_mismatch",
          "Photo media purge manifest digest mismatch",
        );
      }
      if (!manifest.manifest_not_expired) {
        if (manifest.status === "executing" && !manifest.execution_lease_expired) {
          throw retentionConflict(
            "manifest_not_executable",
            "Photo media purge manifest is already executing",
          );
        }
        await client.query(`
          UPDATE ops.photo_media_purge_manifest
          SET status = 'expired', execution_lease_token = NULL,
              execution_lease_expires_at = NULL
          WHERE photo_media_purge_manifest_id = $1::uuid
            AND (status IN ('previewed', 'retryable_failure')
              OR (status = 'executing' AND execution_lease_expires_at <= NOW()))
        `, [input.manifestId]);
        return { expired: true as const };
      }
      if (
        !["previewed", "retryable_failure"].includes(manifest.status) &&
        !(manifest.status === "executing" && manifest.execution_lease_expired)
      ) {
        throw retentionConflict(
          "manifest_not_executable",
          "Photo media purge manifest is not executable",
        );
      }

      const items = await client.query<SnapshotRow & { item_no: number }>(`
        SELECT item.item_no, item.media_asset_id, item.company_id,
               item.asset_state, item.canonical_sha256,
               item.accounted_provider_bytes, item.expires_at,
               item.retention_policy_id, item.retention_policy_version,
               item.eligibility_digest,
               ma.state, ma.legal_hold, ma.operational_hold,
               ma.active_workflow_hold, ma.ai_review_hold,
               ma.cleanup_origin_state, ma.cleanup_lease_token,
               ma.cleanup_lease_expires_at, ma.thumbnail_object_key,
               ma.raw_disposed_at, ma.purge_manifest_id,
               (ma.expires_at <= NOW()) AS expiry_eligible,
               (ma.cleanup_lease_token IS NULL
                 OR ma.cleanup_lease_expires_at <= NOW()) AS cleanup_lease_available
        FROM ops.photo_media_purge_manifest_item item
        JOIN ops.media_asset ma
          ON ma.media_asset_id = item.media_asset_id
         AND ma.company_id = item.company_id
        WHERE item.photo_media_purge_manifest_id = $1::uuid
          AND ($2::uuid[] IS NULL OR item.company_id = ANY($2::uuid[]))
        ORDER BY item.item_no
        FOR UPDATE OF ma
      `, [input.manifestId, input.allowedCompanyIds ?? null]);
      if (items.rows.length !== manifest.candidate_count) {
        throw retentionConflict("manifest_stale", "Photo media purge manifest is incomplete");
      }
      const manifestSnapshots = items.rows.map((row) => {
        const snapshot = mapSnapshot({ ...row, state: "ready" });
        return { ...snapshot, eligibilityDigest: row.eligibility_digest ?? "" };
      });
      if (buildPurgeManifestDigest(manifestSnapshots) !== manifest.manifest_digest) {
        throw retentionConflict("manifest_stale", "Photo media purge manifest proof is invalid");
      }
      const foreignTombstone = items.rows.some((row) =>
        row.state === "deleted_tombstone" && row.purge_manifest_id !== input.manifestId,
      );
      if (foreignTombstone) {
        throw retentionConflict("manifest_stale", "Photo media purge manifest lost asset ownership");
      }
      const remaining = items.rows.filter((row) => row.state !== "deleted_tombstone");
      for (const row of remaining) {
        const snapshot = mapSnapshot({ ...row, state: "ready" });
        const currentDigest = buildPurgeEligibilityDigest(snapshot);
        if (row.legal_hold || row.operational_hold || row.active_workflow_hold || row.ai_review_hold) {
          throw retentionConflict("asset_held", "Photo media purge asset is held");
        }
        const stale = currentDigest !== row.eligibility_digest ||
          !["ready", "purge_pending"].includes(row.state) ||
          (row.state === "purge_pending" && row.cleanup_origin_state !== "ready") ||
          !row.raw_disposed_at ||
          !row.expiry_eligible || !row.cleanup_lease_available;
        if (stale) {
          throw retentionConflict("manifest_stale", "Photo media purge manifest became stale or held");
        }
      }

      const manifestLease = await client.query<{ execution_lease_token: string }>(`
        UPDATE ops.photo_media_purge_manifest
        SET status = 'executing', execution_attempt_count = execution_attempt_count + 1,
            execution_lease_token = gen_random_uuid(),
            execution_lease_expires_at = NOW() + INTERVAL '30 minutes'
        WHERE photo_media_purge_manifest_id = $1::uuid
        RETURNING execution_lease_token
      `, [input.manifestId]);
      const manifestLeaseToken = manifestLease.rows[0]?.execution_lease_token;
      if (!manifestLeaseToken) throw retentionConflict("manifest_stale", "Photo media purge manifest lease failed");

      const candidates = [];
      for (const row of remaining) {
        const claimed = await client.query<{
          cleanup_lease_token: string; thumbnail_object_key: string;
        }>(`
          UPDATE ops.media_asset
          SET state = 'purge_pending', purge_pending_at = COALESCE(purge_pending_at, NOW()),
              cleanup_origin_state = COALESCE(cleanup_origin_state, state),
              purge_manifest_id = $3::uuid,
              cleanup_lease_token = gen_random_uuid(),
              cleanup_lease_expires_at = NOW() + INTERVAL '30 minutes', updated_at = NOW()
          WHERE media_asset_id = $1::uuid AND company_id = $2::uuid
          RETURNING cleanup_lease_token, thumbnail_object_key
        `, [row.media_asset_id, row.company_id, input.manifestId]);
        const assetLease = claimed.rows[0];
        if (!assetLease) throw retentionConflict("manifest_stale", "Photo media purge asset lease failed");
        const replicas = await client.query<{
          replica_role: "primary" | "recovery"; object_key: string;
        }>(`
          SELECT replica_role, object_key
          FROM ops.media_asset_replica
          WHERE media_asset_id = $1::uuid
            AND replica_state IN ('copying', 'verified')
          ORDER BY replica_role, replica_generation
        `, [row.media_asset_id]);
        candidates.push({
          mediaAssetId: row.media_asset_id,
          cleanupLeaseToken: assetLease.cleanup_lease_token,
          canonicalSha256: row.canonical_sha256,
          thumbnailObjectKey: assetLease.thumbnail_object_key,
          primaryObjectKeys: replicas.rows.filter((item) => item.replica_role === "primary")
            .map((item) => item.object_key),
          recoveryObjectKeys: replicas.rows.filter((item) => item.replica_role === "recovery")
            .map((item) => item.object_key),
        });
      }
      return {
        manifestId: input.manifestId,
        manifestDigest: input.manifestDigest,
        manifestLeaseToken,
        candidates,
      };
    });
    if ("expired" in claimed) {
      throw retentionConflict("manifest_expired", "Photo media purge manifest expired");
    }
    return claimed;
  }

  async markPurgeManifestCompleted(input: {
    manifestId: string; manifestDigest: string; manifestLeaseToken: string; actorUserId: string | null;
  }): Promise<void> {
    await this.databaseService.withTransaction(async (client) => {
      const updated = await client.query<{ candidate_count: number }>(`
        WITH remaining AS (
          SELECT COUNT(*) FILTER (
                   WHERE ma.state <> 'deleted_tombstone'
                      OR ma.purge_manifest_id IS DISTINCT FROM $1::uuid
                 )::int AS remaining_count,
                 MIN(item.company_id::text) AS company_id
          FROM ops.photo_media_purge_manifest_item item
          JOIN ops.media_asset ma ON ma.media_asset_id = item.media_asset_id
          WHERE item.photo_media_purge_manifest_id = $1::uuid
        )
        UPDATE ops.photo_media_purge_manifest manifest
        SET status = 'completed', executed_at = NOW(),
            execution_lease_token = NULL, execution_lease_expires_at = NULL
        FROM remaining
        WHERE manifest.photo_media_purge_manifest_id = $1::uuid
          AND manifest.manifest_digest = $2
          AND manifest.status = 'executing'
          AND manifest.execution_lease_token = $3::uuid
          AND remaining.remaining_count = 0
        RETURNING manifest.candidate_count
      `, [input.manifestId, input.manifestDigest, input.manifestLeaseToken]);
      const row = updated.rows[0];
      if (!row) throw retentionConflict("manifest_stale", "Photo media purge completion is stale");
      await client.query(`
        INSERT INTO audit.photo_evidence_event (
          actor_user_id, event_type, entity_name, entity_id, company_id,
          correlation_id, reason_code, state_before, state_after, content_sha256
        )
        SELECT $1::uuid, 'checklist_photo_evidence.retention.cleanup_executed',
               'photo_media_purge_manifest', $2::uuid, company_id, $2::text,
               'governed_cleanup', 'executing', 'completed', $3
        FROM ops.photo_media_purge_manifest_item
        WHERE photo_media_purge_manifest_id = $2::uuid
        GROUP BY company_id
      `, [input.actorUserId, input.manifestId, input.manifestDigest]);
    });
  }

  async markPurgeManifestRetryableFailure(input: {
    manifestId: string; manifestDigest: string; manifestLeaseToken: string;
    actorUserId: string | null; reasonCode: "provider_delete_failed";
  }): Promise<void> {
    const updated = await this.databaseService.query(`
      UPDATE ops.photo_media_purge_manifest
      SET status = 'retryable_failure', last_failure_reason = $4,
          execution_lease_token = NULL, execution_lease_expires_at = NULL
      WHERE photo_media_purge_manifest_id = $1::uuid
        AND manifest_digest = $2 AND execution_lease_token = $3::uuid
        AND status = 'executing'
      RETURNING photo_media_purge_manifest_id
    `, [input.manifestId, input.manifestDigest, input.manifestLeaseToken, input.reasonCode]);
    if (updated.rows.length !== 1) {
      throw retentionConflict("manifest_stale", "Photo media purge failure receipt is stale");
    }
  }

  async releasePurgeManifestAssetLeases(input: {
    manifestId: string; manifestLeaseToken: string;
  }): Promise<void> {
    await this.databaseService.withTransaction(async (client) => {
      const manifest = await client.query(`
        SELECT 1 FROM ops.photo_media_purge_manifest
        WHERE photo_media_purge_manifest_id = $1::uuid
          AND status = 'executing'
          AND execution_lease_token = $2::uuid
        FOR UPDATE
      `, [input.manifestId, input.manifestLeaseToken]);
      if (manifest.rows.length !== 1) {
        throw retentionConflict("manifest_stale", "Photo media purge lease release is stale");
      }
      await client.query(`
        UPDATE ops.media_asset
        SET cleanup_lease_token = NULL, cleanup_lease_expires_at = NULL,
            purge_manifest_id = NULL, updated_at = NOW()
        WHERE purge_manifest_id = $1::uuid
          AND state = 'purge_pending'
      `, [input.manifestId]);
    });
  }

  async getLifecycleReconciliationSummary(allowedCompanyIds?: string[]) {
    const result = await this.databaseService.query<{
      dangling_link_count: string; stuck_upload_count: string; stuck_purge_count: string;
      protected_expiry_count: string; tombstone_residue_count: string;
    }>(`
      WITH links AS (
        SELECT link.media_asset_id, link.company_id,
               instance.status IN ('planned', 'in_progress') AS active
        FROM ops.checklist_response_media link
        JOIN ops.checklist_instance instance
          ON instance.checklist_instance_id = link.checklist_instance_id
        WHERE link.unlinked_at IS NULL
        UNION ALL
        SELECT evidence.media_asset_id, evidence.company_id,
               plan.status IN (
                 'open', 'in_progress', 'blocked',
                 'solution_review_pending', 'correction_required'
               ) AS active
        FROM ops.store_action_plan_evidence evidence
        JOIN ops.store_action_plan plan
          ON plan.store_action_plan_id = evidence.store_action_plan_id
        UNION ALL
        SELECT asset.media_asset_id, asset.company_id,
               reference.lifecycle_status IN ('draft', 'scheduled', 'open', 'closed') AS active
        FROM ops.visual_reference_item_asset asset
        JOIN ops.visual_reference_set reference
          ON reference.visual_reference_set_id = asset.visual_reference_set_id
        UNION ALL
        SELECT media.media_asset_id, media.company_id,
               assignment.review_status <> 'completed' AS active
        FROM ops.visual_campaign_submission_media media
        JOIN ops.visual_campaign_submission submission
          ON submission.campaign_submission_id = media.campaign_submission_id
        JOIN ops.visual_campaign_assignment assignment
          ON assignment.assignment_id = submission.assignment_id
      )
      SELECT
        (SELECT COUNT(*) FROM links JOIN ops.media_asset ma USING (media_asset_id, company_id)
          WHERE ((links.active AND ma.state <> 'ready')
              OR (NOT links.active AND ma.state NOT IN ('ready', 'deleted_tombstone')))
            AND ($1::uuid[] IS NULL OR ma.company_id = ANY($1::uuid[]))) AS dangling_link_count,
        (SELECT COUNT(*) FROM ops.media_asset
          WHERE state IN ('initiated', 'uploaded')
            AND initiated_at < NOW() - INTERVAL '24 hours'
            AND ($1::uuid[] IS NULL OR company_id = ANY($1::uuid[]))) AS stuck_upload_count,
        (SELECT COUNT(*) FROM ops.media_asset
          WHERE state = 'purge_pending'
            AND (cleanup_lease_expires_at IS NULL OR cleanup_lease_expires_at <= NOW())
            AND ($1::uuid[] IS NULL OR company_id = ANY($1::uuid[]))) AS stuck_purge_count,
        (SELECT COUNT(*) FROM ops.media_asset
          WHERE state = 'ready' AND expires_at <= NOW()
            AND (legal_hold OR operational_hold OR active_workflow_hold OR ai_review_hold)
            AND ($1::uuid[] IS NULL OR company_id = ANY($1::uuid[]))) AS protected_expiry_count,
        (SELECT COUNT(*) FROM ops.media_asset ma
          WHERE ma.state = 'deleted_tombstone'
            AND ($1::uuid[] IS NULL OR ma.company_id = ANY($1::uuid[]))
            AND EXISTS (SELECT 1 FROM ops.media_asset_replica mar
              WHERE mar.media_asset_id = ma.media_asset_id
                AND mar.replica_state <> 'deleted_tombstone')) AS tombstone_residue_count
    `, [allowedCompanyIds ?? null]);
    const row = result.rows[0];
    return {
      danglingLinkCount: Number(row?.dangling_link_count ?? 0),
      stuckUploadCount: Number(row?.stuck_upload_count ?? 0),
      stuckPurgeCount: Number(row?.stuck_purge_count ?? 0),
      protectedExpiryCount: Number(row?.protected_expiry_count ?? 0),
      tombstoneResidueCount: Number(row?.tombstone_residue_count ?? 0),
      findingEvents: [],
    };
  }

  async getUsageForecast(allowedCompanyIds?: string[]) {
    if (allowedCompanyIds) {
      const outsideScope = await this.databaseService.query(`
        SELECT 1 FROM ops.company
        WHERE NOT (company_id = ANY($1::uuid[]))
        LIMIT 1
      `, [allowedCompanyIds]);
      if (outsideScope.rows.length > 0 || allowedCompanyIds.length === 0) {
        throw new ForbiddenException("Photo media aggregate usage requires full company scope");
      }
    }
    const totals = await this.databaseService.query<{
      provider_visible_bytes: string; class_a_operations: string; class_b_operations: string;
      recent_growth_bytes: string; purge_eligible_count: string; protected_expired_count: string;
      stuck_upload_count: string; stuck_purge_count: string; cleanup_failure_count: string;
    }>(`
      SELECT usage.provider_visible_bytes,
        CASE WHEN usage.operation_month = date_trunc('month', CURRENT_DATE)::date
          THEN usage.class_a_operations ELSE 0 END AS class_a_operations,
        CASE WHEN usage.operation_month = date_trunc('month', CURRENT_DATE)::date
          THEN usage.class_b_operations ELSE 0 END AS class_b_operations,
        COALESCE((SELECT SUM(accounted_provider_bytes) FROM ops.media_asset
          WHERE finalized_at >= NOW() - INTERVAL '30 days'), 0) AS recent_growth_bytes,
        (SELECT COUNT(*) FROM ops.media_asset WHERE state = 'ready' AND expires_at <= NOW()
          AND NOT legal_hold AND NOT operational_hold AND NOT active_workflow_hold AND NOT ai_review_hold) AS purge_eligible_count,
        (SELECT COUNT(*) FROM ops.media_asset WHERE state = 'ready' AND expires_at <= NOW()
          AND (legal_hold OR operational_hold OR active_workflow_hold OR ai_review_hold)) AS protected_expired_count,
        (SELECT COUNT(*) FROM ops.media_asset WHERE state IN ('initiated', 'uploaded')
          AND initiated_at < NOW() - INTERVAL '24 hours') AS stuck_upload_count,
        (SELECT COUNT(*) FROM ops.media_asset WHERE state = 'purge_pending'
          AND (cleanup_lease_expires_at IS NULL OR cleanup_lease_expires_at <= NOW())) AS stuck_purge_count,
        (SELECT COUNT(*) FROM audit.photo_media_storage_event
          WHERE event_type = 'checklist_photo_evidence.storage.cleanup_failed'
            AND occurred_at >= NOW() - INTERVAL '30 days') AS cleanup_failure_count
      FROM ops.photo_media_usage_state usage
      WHERE usage.usage_scope = '${PHOTO_MEDIA_USAGE_SCOPE}'
    `);
    const classifications = await this.databaseService.query<{
      classification: string; asset_count: string; byte_count: string;
    }>(`
      SELECT classification, COUNT(*) AS asset_count,
             COALESCE(SUM(accounted_provider_bytes), 0) AS byte_count
      FROM ops.media_asset
      WHERE state <> 'deleted_tombstone'
      GROUP BY classification ORDER BY classification
    `);
    const row = totals.rows[0];
    const currentBytes = Number(row?.provider_visible_bytes ?? 0);
    const recentGrowthBytes = Number(row?.recent_growth_bytes ?? 0);
    return {
      currentBytes,
      classAOperations: Number(row?.class_a_operations ?? 0),
      classBOperations: Number(row?.class_b_operations ?? 0),
      recentGrowthBytes,
      projectedThirtyDayBytes: currentBytes + recentGrowthBytes,
      classifications: classifications.rows.map((item) => ({
        classification: item.classification,
        assetCount: Number(item.asset_count),
        bytes: Number(item.byte_count),
      })),
      purgeEligibleCount: Number(row?.purge_eligible_count ?? 0),
      protectedExpiredCount: Number(row?.protected_expired_count ?? 0),
      stuckUploadCount: Number(row?.stuck_upload_count ?? 0),
      stuckPurgeCount: Number(row?.stuck_purge_count ?? 0),
      cleanupFailureCount: Number(row?.cleanup_failure_count ?? 0),
    };
  }
}
