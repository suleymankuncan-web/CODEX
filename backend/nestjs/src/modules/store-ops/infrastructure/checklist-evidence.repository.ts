import { BadRequestException } from "@nestjs/common";
import { createHash } from "node:crypto";
import type { PoolClient } from "pg";
import { DatabaseService } from "../../../shared/database/database.service";

export class ChecklistEvidenceRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async linkMobileChecklistItemEvidence(input: {
    checklistInstanceId: string;
    templateItemId: string;
    mediaAssetId: string;
    expectedEvidenceVersion: number;
    idempotencyKey: string;
    actorUserId: string;
    actorRoleCodes: string[];
    actorActionScope?: { assignedStoreIds: string[] };
  }) {
    const digest = this.buildEvidenceCommandDigest("link", {
      checklistInstanceId: input.checklistInstanceId,
      templateItemId: input.templateItemId,
      mediaAssetId: input.mediaAssetId,
      expectedEvidenceVersion: input.expectedEvidenceVersion,
    });
    return this.databaseService.withTransaction(async (client) => {
      await client.query(
        `SELECT pg_advisory_xact_lock(hashtext($1)::bigint)`,
        [`${input.actorUserId}:${input.idempotencyKey}`],
      );
      const receipt = await client.query<{ command_digest: string; result_json: Record<string, unknown> }>(
        `SELECT command_digest, result_json
         FROM ops.photo_evidence_command_receipt
         WHERE actor_user_id = $1::uuid AND idempotency_key = $2::uuid`,
        [input.actorUserId, input.idempotencyKey],
      );
      if (receipt.rows[0]) {
        if (receipt.rows[0].command_digest !== digest) {
          throw new BadRequestException("idempotency_digest_mismatch");
        }
        return { ...receipt.rows[0].result_json, idempotent: true };
      }

      const guard = await client.query<{
        checklist_instance_id: string;
        company_id: string;
        region_id: string;
        store_id: string;
        status: string;
        evidence_version_no: number;
        evidence_policy: "none" | "optional" | "required";
        max_evidence_count: number;
        response_id: string | null;
        media_count: string;
        next_display_order: number;
        asset_state: string | null;
        asset_classification: string | null;
        asset_company_id: string | null;
        asset_store_id: string | null;
        intent_instance_id: string | null;
        intent_item_id: string | null;
        intent_actor_user_id: string | null;
        canonical_sha256: string | null;
        capture_source: string | null;
      }>(
        `SELECT ci.checklist_instance_id, store.company_id, store.region_id, ci.store_id,
                ci.status, ci.evidence_version_no, policy.evidence_policy,
                policy.max_evidence_count, response.response_id,
                (SELECT COUNT(*) FROM ops.checklist_response_media existing
                 WHERE existing.checklist_instance_id = ci.checklist_instance_id
                   AND existing.template_item_id = policy.template_item_id
                   AND existing.unlinked_at IS NULL)::text AS media_count,
                (SELECT COALESCE(MAX(existing.display_order), -1) + 1
                 FROM ops.checklist_response_media existing
                 WHERE existing.checklist_instance_id = ci.checklist_instance_id
                   AND existing.template_item_id = policy.template_item_id) AS next_display_order,
                asset.state AS asset_state, asset.classification AS asset_classification,
                asset.company_id AS asset_company_id,
                asset.store_id AS asset_store_id, asset.canonical_sha256,
                asset.capture_source,
                intent.checklist_instance_id AS intent_instance_id,
                intent.template_item_id AS intent_item_id,
                intent.uploaded_by_user_id AS intent_actor_user_id
         FROM ops.checklist_instance ci
         JOIN ops.store store ON store.store_id = ci.store_id
         JOIN ops.checklist_template template ON template.checklist_template_id = ci.checklist_template_id
         JOIN ops.checklist_instance_item_policy policy
           ON policy.checklist_instance_id = ci.checklist_instance_id
          AND policy.template_item_id = $2::uuid
         LEFT JOIN ops.checklist_response response
           ON response.checklist_instance_id = ci.checklist_instance_id
          AND response.template_item_id = policy.template_item_id
         LEFT JOIN ops.media_asset asset ON asset.media_asset_id = $3::uuid
         LEFT JOIN ops.checklist_item_evidence_upload_intent intent
           ON intent.media_asset_id = asset.media_asset_id
         WHERE ci.checklist_instance_id = $1::uuid
           AND (
             'SUPER_ADMIN' = ANY($5::text[])
             OR (ci.store_id = ANY($4::uuid[]) AND template.template_type = 'BM_STORE_VISIT' AND 'REGION_MANAGER' = ANY($5::text[]))
             OR (ci.store_id = ANY($4::uuid[]) AND template.template_type = 'VM_STORE_VISIT' AND 'VISUAL_MERCHANDISER' = ANY($5::text[]))
           )
         FOR UPDATE OF ci`,
        [
          input.checklistInstanceId,
          input.templateItemId,
          input.mediaAssetId,
          input.actorActionScope?.assignedStoreIds ?? [],
          input.actorRoleCodes,
        ],
      );
      const row = guard.rows[0];
      if (!row || !["planned", "in_progress"].includes(row.status)) {
        throw new BadRequestException("instance_locked");
      }
      if (Number(row.evidence_version_no) !== input.expectedEvidenceVersion) {
        throw new BadRequestException("stale_version");
      }
      if (row.evidence_policy === "none") {
        throw new BadRequestException("policy_forbids");
      }
      if (!row.response_id) {
        throw new BadRequestException("response_required");
      }
      if (row.asset_state !== "ready") {
        throw new BadRequestException("asset_not_ready");
      }
      if (
        row.asset_classification !== "checklist_evidence" ||
        row.intent_instance_id !== input.checklistInstanceId ||
        row.intent_item_id !== input.templateItemId ||
        row.intent_actor_user_id !== input.actorUserId
      ) {
        throw new BadRequestException("asset_intent_mismatch");
      }
      if (row.asset_company_id !== row.company_id || row.asset_store_id !== row.store_id) {
        throw new BadRequestException("asset_scope_mismatch");
      }
      if (Number(row.media_count) >= Number(row.max_evidence_count)) {
        throw new BadRequestException("evidence_limit_reached");
      }

      const linked = await client.query<{ checklist_response_media_id: string; display_order: number }>(
        `INSERT INTO ops.checklist_response_media (
           company_id, region_id, store_id, checklist_instance_id, response_id,
           template_item_id, media_asset_id, display_order, linked_by_user_id
         ) VALUES (
           $1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid,
           $6::uuid, $7::uuid, $8, $9::uuid
         )
         RETURNING checklist_response_media_id, display_order`,
        [
          row.company_id, row.region_id, row.store_id, input.checklistInstanceId,
          row.response_id, input.templateItemId, input.mediaAssetId,
          Number(row.next_display_order), input.actorUserId,
        ],
      );
      const link = linked.rows[0];
      await client.query(
        `UPDATE ops.checklist_instance
         SET evidence_version_no = evidence_version_no + 1
         WHERE checklist_instance_id = $1::uuid`,
        [input.checklistInstanceId],
      );
      await client.query(
        `UPDATE ops.media_asset SET active_workflow_hold = TRUE, updated_at = NOW()
         WHERE media_asset_id = $1::uuid`,
        [input.mediaAssetId],
      );
      await client.query(
        `INSERT INTO audit.photo_evidence_event (
           actor_user_id, event_type, entity_name, entity_id, company_id, region_id,
           store_id, media_asset_id, correlation_id, state_before, state_after,
           content_sha256
         ) VALUES (
           $1::uuid, 'checklist_photo_evidence.checklist.linked',
           'checklist_response_media', $2::uuid, $3::uuid, $4::uuid, $5::uuid,
           $6::uuid, $7, 'ready', 'ready', $8
         )`,
        [
          input.actorUserId, link.checklist_response_media_id, row.company_id,
          row.region_id, row.store_id, input.mediaAssetId, input.idempotencyKey,
          row.canonical_sha256,
        ],
      );
      const result = await this.readMobileChecklistItemEvidenceProjection(
        client, input.checklistInstanceId, input.templateItemId,
      );
      await client.query(
        `INSERT INTO ops.photo_evidence_command_receipt (
           actor_user_id, idempotency_key, command_type, command_digest,
           result_code, result_entity_id, result_json
         ) VALUES ($1::uuid, $2::uuid, 'link', $3, 'linked', $4::uuid, $5::jsonb)`,
        [
          input.actorUserId, input.idempotencyKey, digest,
          link.checklist_response_media_id, JSON.stringify(result),
        ],
      );
      return { ...result, idempotent: false };
    });
  }

  async unlinkMobileChecklistItemEvidence(input: {
    checklistInstanceId: string;
    templateItemId: string;
    mediaAssetId: string;
    reason: string;
    expectedEvidenceVersion: number;
    idempotencyKey: string;
    actorUserId: string;
    actorRoleCodes: string[];
    actorActionScope?: { assignedStoreIds: string[] };
  }) {
    const reason = input.reason.trim();
    if (!reason) {
      throw new BadRequestException("unlink_reason_required");
    }
    const digest = this.buildEvidenceCommandDigest("unlink", {
      checklistInstanceId: input.checklistInstanceId,
      templateItemId: input.templateItemId,
      mediaAssetId: input.mediaAssetId,
      expectedEvidenceVersion: input.expectedEvidenceVersion,
      reason,
    });
    return this.databaseService.withTransaction(async (client) => {
      await client.query(
        `SELECT pg_advisory_xact_lock(hashtext($1)::bigint)`,
        [`${input.actorUserId}:${input.idempotencyKey}`],
      );
      const receipt = await client.query<{ command_digest: string; result_json: Record<string, unknown> }>(
        `SELECT command_digest, result_json
         FROM ops.photo_evidence_command_receipt
         WHERE actor_user_id = $1::uuid AND idempotency_key = $2::uuid`,
        [input.actorUserId, input.idempotencyKey],
      );
      if (receipt.rows[0]) {
        if (receipt.rows[0].command_digest !== digest) {
          throw new BadRequestException("idempotency_digest_mismatch");
        }
        return { ...receipt.rows[0].result_json, idempotent: true };
      }
      const guard = await client.query<{
        checklist_response_media_id: string;
        company_id: string;
        region_id: string;
        store_id: string;
        status: string;
        evidence_version_no: number;
        locked_at: string | null;
        unlinked_at: string | null;
        canonical_sha256: string | null;
      }>(
        `SELECT media.checklist_response_media_id, media.company_id, media.region_id,
                media.store_id, instance.status, instance.evidence_version_no,
                media.locked_at, media.unlinked_at, asset.canonical_sha256
         FROM ops.checklist_response_media media
         JOIN ops.checklist_instance instance
           ON instance.checklist_instance_id = media.checklist_instance_id
         JOIN ops.media_asset asset ON asset.media_asset_id = media.media_asset_id
         JOIN ops.checklist_template template ON template.checklist_template_id = instance.checklist_template_id
         WHERE media.checklist_instance_id = $1::uuid
           AND media.template_item_id = $2::uuid
           AND media.media_asset_id = $3::uuid
           AND (
             'SUPER_ADMIN' = ANY($5::text[])
             OR (instance.store_id = ANY($4::uuid[]) AND template.template_type = 'BM_STORE_VISIT' AND 'REGION_MANAGER' = ANY($5::text[]))
             OR (instance.store_id = ANY($4::uuid[]) AND template.template_type = 'VM_STORE_VISIT' AND 'VISUAL_MERCHANDISER' = ANY($5::text[]))
           )
         FOR UPDATE OF instance, media`,
        [
          input.checklistInstanceId,
          input.templateItemId,
          input.mediaAssetId,
          input.actorActionScope?.assignedStoreIds ?? [],
          input.actorRoleCodes,
        ],
      );
      const row = guard.rows[0];
      if (!row || !["planned", "in_progress"].includes(row.status) || row.locked_at) {
        throw new BadRequestException("instance_locked");
      }
      if (Number(row.evidence_version_no) !== input.expectedEvidenceVersion) {
        throw new BadRequestException("stale_version");
      }
      if (row.unlinked_at) {
        const result = await this.readMobileChecklistItemEvidenceProjection(
          client, input.checklistInstanceId, input.templateItemId,
        );
        await client.query(
          `INSERT INTO ops.photo_evidence_command_receipt (
             actor_user_id, idempotency_key, command_type, command_digest,
             result_code, result_entity_id, result_json
           ) VALUES ($1::uuid, $2::uuid, 'unlink', $3, 'already_unlinked', $4::uuid, $5::jsonb)`,
          [
            input.actorUserId, input.idempotencyKey, digest,
            row.checklist_response_media_id, JSON.stringify(result),
          ],
        );
        return { ...result, idempotent: true };
      }
      await client.query(
        `UPDATE ops.checklist_response_media
         SET unlinked_at = NOW(), unlinked_by_user_id = $4::uuid, unlink_reason = $5
         WHERE checklist_instance_id = $1::uuid AND template_item_id = $2::uuid
           AND media_asset_id = $3::uuid AND unlinked_at IS NULL`,
        [input.checklistInstanceId, input.templateItemId, input.mediaAssetId, input.actorUserId, reason],
      );
      await client.query(
        `UPDATE ops.checklist_instance
         SET evidence_version_no = evidence_version_no + 1
         WHERE checklist_instance_id = $1::uuid`,
        [input.checklistInstanceId],
      );

      await client.query(
        `UPDATE ops.media_asset SET active_workflow_hold = FALSE, updated_at = NOW()
         WHERE media_asset_id = $1::uuid`,
        [input.mediaAssetId],
      );
      await client.query(
        `INSERT INTO audit.photo_evidence_event (
           actor_user_id, event_type, entity_name, entity_id, company_id, region_id,
           store_id, media_asset_id, correlation_id, reason_code, state_before,
           state_after, content_sha256
         ) VALUES (
           $1::uuid, 'checklist_photo_evidence.checklist.unlinked',
           'checklist_response_media', $2::uuid, $3::uuid, $4::uuid, $5::uuid,
           $6::uuid, $7, 'user_requested', 'ready', 'ready', $8
         )`,
        [
          input.actorUserId, row.checklist_response_media_id, row.company_id,
          row.region_id, row.store_id, input.mediaAssetId, input.idempotencyKey,
          row.canonical_sha256,
        ],
      );
      const result = await this.readMobileChecklistItemEvidenceProjection(
        client, input.checklistInstanceId, input.templateItemId,
      );
      await client.query(
        `INSERT INTO ops.photo_evidence_command_receipt (
           actor_user_id, idempotency_key, command_type, command_digest,
           result_code, result_entity_id, result_json
         ) VALUES ($1::uuid, $2::uuid, 'unlink', $3, 'unlinked', $4::uuid, $5::jsonb)`,
        [
          input.actorUserId, input.idempotencyKey, digest,
          row.checklist_response_media_id, JSON.stringify(result),
        ],
      );
      return { ...result, idempotent: false };
    });
  }

  async assertMobileChecklistItemEvidenceLink(input: {
    checklistInstanceId: string;
    templateItemId: string;
    mediaAssetId: string;
    actorRoleCodes: string[];
    actorActionScope?: { assignedStoreIds: string[] };
  }) {
    const result = await this.databaseService.query<{ media_asset_id: string }>(
      `SELECT media.media_asset_id
       FROM ops.checklist_response_media media
       JOIN ops.checklist_instance instance
         ON instance.checklist_instance_id = media.checklist_instance_id
       JOIN ops.checklist_template template
         ON template.checklist_template_id = instance.checklist_template_id
       JOIN ops.media_asset asset ON asset.media_asset_id = media.media_asset_id
       WHERE media.checklist_instance_id = $1::uuid
         AND media.template_item_id = $2::uuid
         AND media.media_asset_id = $3::uuid
         AND media.unlinked_at IS NULL
         AND asset.state = 'ready'
         AND (
           'SUPER_ADMIN' = ANY($5::text[])
           OR (instance.store_id = ANY($4::uuid[]) AND template.template_type = 'BM_STORE_VISIT' AND 'REGION_MANAGER' = ANY($5::text[]))
           OR (instance.store_id = ANY($4::uuid[]) AND template.template_type = 'VM_STORE_VISIT' AND 'VISUAL_MERCHANDISER' = ANY($5::text[]))
         )`,
      [
        input.checklistInstanceId,
        input.templateItemId,
        input.mediaAssetId,
        input.actorActionScope?.assignedStoreIds ?? [],
        input.actorRoleCodes,
      ],
    );
    if (!result.rows[0]) {
      throw new BadRequestException("scope_denied");
    }
  }

  async getMobileChecklistItemEvidenceUploadScope(input: {
    checklistInstanceId: string;
    templateItemId: string;
    actorRoleCodes: string[];
    actorActionScope?: { assignedStoreIds: string[] };
  }) {
    const result = await this.databaseService.query<{
      company_id: string;
      region_id: string;
      store_id: string;
    }>(
      `SELECT store.company_id, store.region_id, instance.store_id
       FROM ops.checklist_instance instance
       JOIN ops.store store ON store.store_id = instance.store_id
       JOIN ops.checklist_template template
         ON template.checklist_template_id = instance.checklist_template_id
       JOIN ops.checklist_instance_item_policy policy
         ON policy.checklist_instance_id = instance.checklist_instance_id
        AND policy.template_item_id = $2::uuid
       JOIN ops.checklist_response response
         ON response.checklist_instance_id = instance.checklist_instance_id
        AND response.template_item_id = policy.template_item_id
       WHERE instance.checklist_instance_id = $1::uuid
         AND instance.status IN ('planned', 'in_progress')
         AND policy.evidence_policy IN ('optional', 'required')
         AND (
           'SUPER_ADMIN' = ANY($4::text[])
           OR (instance.store_id = ANY($3::uuid[]) AND template.template_type = 'BM_STORE_VISIT' AND 'REGION_MANAGER' = ANY($4::text[]))
           OR (instance.store_id = ANY($3::uuid[]) AND template.template_type = 'VM_STORE_VISIT' AND 'VISUAL_MERCHANDISER' = ANY($4::text[]))
         )`,
      [
        input.checklistInstanceId,
        input.templateItemId,
        input.actorActionScope?.assignedStoreIds ?? [],
        input.actorRoleCodes,
      ],
    );
    const row = result.rows[0];
    if (!row) throw new BadRequestException("scope_denied");
    return {
      companyId: row.company_id,
      regionId: row.region_id,
      storeId: row.store_id,
    };
  }

  async recordMobileChecklistItemEvidenceUploadIntent(input: {
    mediaAssetId: string;
    checklistInstanceId: string;
    templateItemId: string;
    actorUserId: string;
  }) {
    await this.databaseService.query(
      `INSERT INTO ops.checklist_item_evidence_upload_intent (
         media_asset_id, checklist_instance_id, template_item_id, uploaded_by_user_id
       ) VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid)`,
      [input.mediaAssetId, input.checklistInstanceId, input.templateItemId, input.actorUserId],
    );
  }

  async assertMobileChecklistItemEvidenceUploadIntent(input: {
    mediaAssetId: string;
    checklistInstanceId: string;
    templateItemId: string;
    actorUserId: string;
    actorRoleCodes: string[];
    actorActionScope?: { assignedStoreIds: string[] };
  }) {
    const result = await this.databaseService.query<{ media_asset_id: string }>(
      `SELECT intent.media_asset_id
       FROM ops.checklist_item_evidence_upload_intent intent
       JOIN ops.checklist_instance instance
         ON instance.checklist_instance_id = intent.checklist_instance_id
       JOIN ops.checklist_template template
         ON template.checklist_template_id = instance.checklist_template_id
       JOIN ops.media_asset asset ON asset.media_asset_id = intent.media_asset_id
       WHERE intent.media_asset_id = $1::uuid
         AND intent.checklist_instance_id = $2::uuid
         AND intent.template_item_id = $3::uuid
         AND intent.uploaded_by_user_id = $4::uuid
         AND asset.classification = 'checklist_evidence'
         AND instance.status IN ('planned', 'in_progress')
         AND (
           'SUPER_ADMIN' = ANY($6::text[])
           OR (instance.store_id = ANY($5::uuid[]) AND template.template_type = 'BM_STORE_VISIT' AND 'REGION_MANAGER' = ANY($6::text[]))
           OR (instance.store_id = ANY($5::uuid[]) AND template.template_type = 'VM_STORE_VISIT' AND 'VISUAL_MERCHANDISER' = ANY($6::text[]))
         )`,
      [
        input.mediaAssetId, input.checklistInstanceId, input.templateItemId,
        input.actorUserId, input.actorActionScope?.assignedStoreIds ?? [], input.actorRoleCodes,
      ],
    );
    if (!result.rows[0]) throw new BadRequestException("asset_intent_mismatch");
  }

  private buildEvidenceCommandDigest(commandType: "link" | "unlink", input: object) {
    return createHash("sha256")
      .update(JSON.stringify({ commandType, ...input }))
      .digest("hex");
  }

  private async readMobileChecklistItemEvidenceProjection(
    client: PoolClient,
    checklistInstanceId: string,
    templateItemId: string,
  ) {
    const result = await client.query<{
      evidence_version_no: number;
      evidence_policy: "none" | "optional" | "required";
      max_evidence_count: number;
      evidence_json: unknown;
    }>(
      `SELECT instance.evidence_version_no, policy.evidence_policy, policy.max_evidence_count,
              COALESCE(jsonb_agg(jsonb_build_object(
                'mediaAssetId', media.media_asset_id,
                'displayOrder', media.display_order,
                'captureSource', asset.capture_source,
                'thumbnailAvailable', asset.thumbnail_object_key IS NOT NULL
              ) ORDER BY media.display_order)
                FILTER (WHERE asset.media_asset_id IS NOT NULL), '[]'::jsonb) AS evidence_json
       FROM ops.checklist_instance instance
       JOIN ops.checklist_instance_item_policy policy
         ON policy.checklist_instance_id = instance.checklist_instance_id
        AND policy.template_item_id = $2::uuid
       LEFT JOIN ops.checklist_response_media media
         ON media.checklist_instance_id = instance.checklist_instance_id
        AND media.template_item_id = policy.template_item_id
        AND media.unlinked_at IS NULL
       LEFT JOIN ops.media_asset asset
         ON asset.media_asset_id = media.media_asset_id
        AND asset.state = 'ready'
       WHERE instance.checklist_instance_id = $1::uuid
       GROUP BY instance.evidence_version_no, policy.evidence_policy, policy.max_evidence_count`,
      [checklistInstanceId, templateItemId],
    );
    const row = result.rows[0];
    const parsed = typeof row?.evidence_json === "string"
      ? JSON.parse(row.evidence_json)
      : row?.evidence_json;
    return {
      checklistInstanceId,
      templateItemId,
      evidenceVersion: Number(row?.evidence_version_no ?? 0),
      evidencePolicy: row?.evidence_policy ?? "none",
      maxEvidenceCount: Number(row?.max_evidence_count ?? 0),
      evidence: Array.isArray(parsed) ? parsed : [],
    };
  }

  async completeMobileChecklistInstance(input: {
    checklistInstanceId: string;
    actorUserId: string;
    actorRoleCodes: string[];
    actorActionScope?: { assignedStoreIds: string[] };
  }) {
    return this.databaseService.withTransaction(async (client) => {
      const instanceResult = await client.query<{
        checklist_instance_id: string;
        store_id: string;
        status: string;
        total_score: string | null;
        compliance_rate: string | null;
        completed_at: string | null;
        locked_at: string | null;
      }>(
        `
          SELECT instance.checklist_instance_id, instance.store_id, instance.status,
                 instance.total_score, instance.compliance_rate,
                 instance.completed_at, instance.locked_at
          FROM ops.checklist_instance instance
          JOIN ops.checklist_template template
            ON template.checklist_template_id = instance.checklist_template_id
          WHERE instance.checklist_instance_id = $1::uuid
            AND (
              'SUPER_ADMIN' = ANY($3::text[])
              OR (instance.store_id = ANY($2::uuid[]) AND template.template_type = 'BM_STORE_VISIT' AND 'REGION_MANAGER' = ANY($3::text[]))
              OR (instance.store_id = ANY($2::uuid[]) AND template.template_type = 'VM_STORE_VISIT' AND 'VISUAL_MERCHANDISER' = ANY($3::text[]))
            )
          FOR UPDATE OF instance
        `,
        [input.checklistInstanceId, input.actorActionScope?.assignedStoreIds ?? [], input.actorRoleCodes],
      );
      const instance = instanceResult.rows[0];

      if (!instance) {
        throw new BadRequestException("Checklist instance cannot be completed");
      }

      if (instance.status === "completed") {
        return {
          checklist_instance_id: instance.checklist_instance_id,
          status: instance.status,
          total_score: instance.total_score,
          compliance_rate: instance.compliance_rate,
          completed_at: instance.completed_at,
          locked_at: instance.locked_at,
        };
      }

      if (!["planned", "in_progress"].includes(instance.status)) {
        throw new BadRequestException("Checklist instance cannot be completed");
      }

      const completion = await this.calculateMobileChecklistCompletionWithClient(
        client,
        input.checklistInstanceId,
      );

      if (completion.missingMandatoryCount > 0) {
        throw new BadRequestException("Mandatory checklist responses are missing");
      }
      if (completion.missingRequiredEvidenceCount > 0) {
        throw new BadRequestException("missing_required_evidence");
      }

      const result = await client.query<{
        checklist_instance_id: string;
        status: string;
        total_score: string;
        compliance_rate: string;
        completed_at: string;
        locked_at: string;
      }>(
        `
          UPDATE ops.checklist_instance
          SET
            completed_by_user_id = $2,
            completed_at = NOW(),
            locked_at = NOW(),
            status = 'completed',
            total_score = $3::numeric,
            compliance_rate = $4::numeric,
            evidence_version_no = evidence_version_no + 1
          WHERE checklist_instance_id = $1::uuid
            AND status IN ('planned', 'in_progress')
          RETURNING checklist_instance_id, status, total_score, compliance_rate, completed_at, locked_at
        `,
        [
          input.checklistInstanceId,
          input.actorUserId,
          completion.totalScore,
          completion.complianceRate,
        ],
      );

      if (!result.rows[0]) {
        throw new BadRequestException("Checklist instance cannot be completed");
      }

      await client.query(
        `UPDATE ops.checklist_response_media
         SET locked_at = COALESCE(locked_at, NOW())
         WHERE checklist_instance_id = $1::uuid AND unlinked_at IS NULL`,
        [input.checklistInstanceId],
      );

      await client.query(
        `INSERT INTO audit.photo_evidence_event (
           actor_user_id, event_type, entity_name, entity_id, company_id, region_id,
           store_id, media_asset_id, correlation_id, state_before, state_after, content_sha256
         )
         SELECT $2::uuid, 'checklist_photo_evidence.checklist.completed_locked',
                'checklist_response_media', media.checklist_response_media_id,
                media.company_id, media.region_id, media.store_id, media.media_asset_id,
                $1::text, 'ready', 'completed', asset.canonical_sha256
         FROM ops.checklist_response_media media
         JOIN ops.media_asset asset ON asset.media_asset_id = media.media_asset_id
         WHERE media.checklist_instance_id = $1::uuid
           AND media.unlinked_at IS NULL`,
        [input.checklistInstanceId, input.actorUserId],
      );

      await client.query(
        `INSERT INTO audit.event_log (
           actor_user_id, event_type, entity_name, entity_id, scope_type, metadata_json
         ) VALUES (
           $1::uuid, 'checklist_evidence.locked', 'ops.checklist_instance',
           $2::uuid, 'store', jsonb_build_object('checklistInstanceId', $2::text)
         )`,
        [input.actorUserId, input.checklistInstanceId],
      );

      return result.rows[0];
    });
  }

  private async calculateMobileChecklistCompletionWithClient(
    client: {
      query: DatabaseService["query"];
    },
    checklistInstanceId: string,
  ) {
    const result = await client.query<{
      total_score: string;
      compliance_rate: string;
      missing_mandatory_count: string;
      missing_required_evidence_count: string;
    }>(
      `
        SELECT
          CASE
            WHEN COUNT(*) FILTER (WHERE cti.response_type = 'compliance') > 0 THEN
              COALESCE(
                (
                  SUM((COALESCE(cr.score_value, 0) / NULLIF(cti.max_score, 0)) * cti.weight)
                    FILTER (WHERE cr.response_value IS DISTINCT FROM 'not_applicable')
                  / NULLIF(
                      SUM(cti.weight)
                        FILTER (WHERE cr.response_value IS DISTINCT FROM 'not_applicable'),
                      0
                    )
                ) * 100,
                0
              )
            ELSE COALESCE(
              SUM((COALESCE(cr.score_value, 0) / NULLIF(cti.max_score, 0)) * cti.weight),
              0
            )
          END::numeric(12,2)::text AS total_score,
          COALESCE(
            AVG(
              CASE
                WHEN cr.response_value = 'not_applicable' THEN NULL
                WHEN COALESCE(cr.score_value, 0) > 0 THEN 1
                ELSE 0
              END
            ),
            0
          )::numeric(7,4)::text AS compliance_rate,
          COUNT(*) FILTER (WHERE cti.is_mandatory = TRUE AND cr.response_id IS NULL)::text AS missing_mandatory_count
          ,COUNT(*) FILTER (
            WHERE policy.evidence_policy = 'required'
              AND NOT EXISTS (
                SELECT 1 FROM ops.checklist_response_media media
                JOIN ops.media_asset asset ON asset.media_asset_id = media.media_asset_id
                WHERE media.checklist_instance_id = ci.checklist_instance_id
                  AND media.template_item_id = cti.template_item_id
                  AND media.unlinked_at IS NULL
                  AND asset.state = 'ready'
              )
          )::text AS missing_required_evidence_count
        FROM ops.checklist_template_item cti
        LEFT JOIN ops.checklist_response cr
          ON cr.template_item_id = cti.template_item_id
         AND cr.checklist_instance_id = $1::uuid
        INNER JOIN ops.checklist_instance ci
          ON ci.checklist_template_id = cti.checklist_template_id
        LEFT JOIN ops.checklist_instance_item_policy policy
          ON policy.checklist_instance_id = ci.checklist_instance_id
         AND policy.template_item_id = cti.template_item_id
        WHERE ci.checklist_instance_id = $1::uuid
      `,
      [checklistInstanceId],
    );
    const row = result.rows[0] ?? {
      total_score: "0.00",
      compliance_rate: "0.0000",
      missing_mandatory_count: "0",
      missing_required_evidence_count: "0",
    };

    return {
      totalScore: row.total_score,
      complianceRate: row.compliance_rate,
      missingMandatoryCount: Number(row.missing_mandatory_count),
      missingRequiredEvidenceCount: Number(row.missing_required_evidence_count ?? 0),
    };
  }
}
