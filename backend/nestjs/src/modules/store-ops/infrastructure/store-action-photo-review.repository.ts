import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { RequestContextStore } from "../../../shared/request-context";
import { DatabaseService } from "../../../shared/database/database.service";
import { storeActionPlanAuditEventTypes } from "../application/store-action-plan.contract";

export type StoreActionPhotoReviewProjection = {
  actionPlanId: string;
  status: string;
  version: number;
  currentAttemptId: string | null;
  findingMediaAssetIds: string[];
  attempts: Array<{
    attemptId: string;
    attemptNo: number;
    resolutionNote: string;
    mediaAssetIds: string[];
    submittedAt: string;
    review: null | { decision: "approve" | "reject"; reason: string | null; reviewedAt: string };
  }>;
};

type ActorSnapshot = { displayName?: string; roleLabel?: string };

@Injectable()
export class StoreActionPhotoReviewRepository {
  constructor(private readonly database: DatabaseService) {}

  async createUploadIntent(input: {
    actionPlanId: string; mediaAssetId: string; actorUserId: string;
  }) {
    return this.database.withTransaction(async (client) => {
      const plan = await client.query<{ company_id: string; region_id: string; store_id: string; owner_user_id: string; resolution_workflow_version: number }>(`
        SELECT company_id, region_id, store_id, owner_user_id, resolution_workflow_version
        FROM ops.store_action_plan WHERE store_action_plan_id = $1::uuid FOR UPDATE
      `, [input.actionPlanId]);
      const row = plan.rows[0];
      if (!row) throw new NotFoundException("Store action plan was not found");
      if (row.owner_user_id !== input.actorUserId || row.resolution_workflow_version !== 2) {
        throw new ForbiddenException("Store action solution upload is outside current ownership");
      }
      const asset = await client.query<{ ok: boolean }>(`
        SELECT TRUE AS ok FROM ops.media_asset
        WHERE media_asset_id = $1::uuid AND company_id = $2::uuid AND store_id = $3::uuid
          AND uploaded_by_user_id = $4::uuid AND classification = 'action_evidence'
      `, [input.mediaAssetId, row.company_id, row.store_id, input.actorUserId]);
      if (!asset.rows[0]) throw new ForbiddenException("Store action evidence asset is outside the plan scope");
      await client.query(`
        INSERT INTO ops.store_action_solution_upload_intent (
          store_action_plan_id, media_asset_id, company_id, region_id, store_id, initiated_by_user_id
        ) VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, $6::uuid)
      `, [input.actionPlanId, input.mediaAssetId, row.company_id, row.region_id, row.store_id, input.actorUserId]);
      return { actionPlanId: input.actionPlanId, mediaAssetId: input.mediaAssetId };
    });
  }

  async hasUploadIntent(input: {
    actionPlanId: string; mediaAssetId: string; actorUserId: string;
  }) {
    const result = await this.database.query<{ ok: boolean }>(`
      SELECT TRUE AS ok
      FROM ops.store_action_solution_upload_intent
      WHERE store_action_plan_id = $1::uuid
        AND media_asset_id = $2::uuid
        AND initiated_by_user_id = $3::uuid
    `, [input.actionPlanId, input.mediaAssetId, input.actorUserId]);
    return Boolean(result.rows[0]);
  }

  async submit(input: {
    actionPlanId: string; actorUserId: string; resolutionNote: string; mediaAssetId: string;
    expectedVersion: number; idempotencyKey: string; actor: ActorSnapshot;
  }): Promise<StoreActionPhotoReviewProjection> {
    return this.database.withTransaction(async (client) => {
      const planResult = await client.query<any>(`
        SELECT * FROM ops.store_action_plan WHERE store_action_plan_id = $1::uuid FOR UPDATE
      `, [input.actionPlanId]);
      const plan = planResult.rows[0];
      if (!plan) throw new NotFoundException("Store action plan was not found");
      if (plan.resolution_workflow_version !== 2 || plan.owner_user_id !== input.actorUserId) {
        throw new ForbiddenException("Solution submission requires the current V2 action owner");
      }
      const duplicate = await client.query<any>(`
        SELECT attempt.*, evidence.media_asset_id
        FROM ops.store_action_solution_attempt attempt
        JOIN ops.store_action_plan_evidence evidence ON evidence.solution_attempt_id = attempt.solution_attempt_id
        WHERE attempt.store_action_plan_id = $1::uuid AND attempt.idempotency_key = $2::uuid
      `, [input.actionPlanId, input.idempotencyKey]);
      if (duplicate.rows[0]) {
        const prior = duplicate.rows[0];
        if (prior.resolution_note !== input.resolutionNote || prior.media_asset_id !== input.mediaAssetId || Number(prior.expected_version) !== input.expectedVersion) {
          throw new ConflictException("Idempotency key payload does not match the original submission");
        }
        return this.readProjection(client, input.actionPlanId);
      }
      if (!["open", "in_progress", "blocked", "correction_required"].includes(plan.status)) {
        throw new ConflictException("Store action solution cannot be submitted from the current state");
      }
      if (Number(plan.photo_evidence_version) !== input.expectedVersion) {
        throw new ConflictException("Store action solution version is stale");
      }
      const assetResult = await client.query<any>(`
        SELECT asset.media_asset_id, asset.canonical_sha256
        FROM ops.media_asset asset
        JOIN ops.store_action_solution_upload_intent intent ON intent.media_asset_id = asset.media_asset_id
        WHERE asset.media_asset_id = $1::uuid AND intent.store_action_plan_id = $2::uuid
          AND asset.company_id = $3::uuid AND asset.store_id = $4::uuid
          AND asset.uploaded_by_user_id = $5::uuid AND intent.initiated_by_user_id = $5::uuid
          AND asset.classification = 'action_evidence' AND asset.state = 'ready'
      `, [input.mediaAssetId, input.actionPlanId, plan.company_id, plan.store_id, input.actorUserId]);
      if (!assetResult.rows[0]) throw new ForbiddenException("Ready solution evidence is not bound to this action");
      const nextAttempt = await client.query<{ attempt_no: number }>(`
        SELECT COALESCE(MAX(attempt_no), 0)::int + 1 AS attempt_no
        FROM ops.store_action_solution_attempt WHERE store_action_plan_id = $1::uuid
      `, [input.actionPlanId]);
      const attempt = await client.query<{ solution_attempt_id: string }>(`
        INSERT INTO ops.store_action_solution_attempt (
          store_action_plan_id, company_id, region_id, store_id, attempt_no, resolution_note,
          submitted_by_user_id, idempotency_key, expected_version
        ) VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5,$6,$7::uuid,$8::uuid,$9)
        RETURNING solution_attempt_id
      `, [input.actionPlanId, plan.company_id, plan.region_id, plan.store_id,
        nextAttempt.rows[0]?.attempt_no ?? 1, input.resolutionNote, input.actorUserId,
        input.idempotencyKey, input.expectedVersion]);
      const attemptId = attempt.rows[0]!.solution_attempt_id;
      await client.query(`
        INSERT INTO ops.store_action_plan_evidence (
          store_action_plan_id, company_id, region_id, store_id, media_asset_id,
          solution_attempt_id, purpose, submitted_by_user_id
        ) VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::uuid,$6::uuid,'solution',$7::uuid)
      `, [input.actionPlanId, plan.company_id, plan.region_id, plan.store_id, input.mediaAssetId, attemptId, input.actorUserId]);
      await client.query(`
        UPDATE ops.media_asset SET active_workflow_hold = TRUE, updated_at = NOW()
        WHERE media_asset_id = $1::uuid
      `, [input.mediaAssetId]);
      await client.query(`
        UPDATE ops.store_action_plan SET status = 'solution_review_pending',
          current_solution_attempt_id = $2::uuid, photo_evidence_version = photo_evidence_version + 1,
          updated_at = NOW()
        WHERE store_action_plan_id = $1::uuid
      `, [input.actionPlanId, attemptId]);
      const eventType = Number(nextAttempt.rows[0]?.attempt_no ?? 1) > 1
        ? "checklist_photo_evidence.action.solution_resubmitted"
        : "checklist_photo_evidence.action.solution_submitted";
      await this.insertAudits(client, { ...input, plan, attemptId, eventType,
        auditEventType: Number(nextAttempt.rows[0]?.attempt_no ?? 1) > 1
          ? storeActionPlanAuditEventTypes.solutionResubmitted
          : storeActionPlanAuditEventTypes.solutionSubmitted,
        mediaAssetSha256: assetResult.rows[0].canonical_sha256,
        before: plan.status, after: "solution_review_pending" });
      return this.readProjection(client, input.actionPlanId);
    });
  }

  async review(input: {
    actionPlanId: string; solutionAttemptId: string; actorUserId: string;
    actorStoreIds: readonly string[];
    decision: "approve" | "reject"; reason?: string; expectedVersion: number;
    idempotencyKey: string; actor: ActorSnapshot;
  }): Promise<StoreActionPhotoReviewProjection> {
    return this.database.withTransaction(async (client) => {
      const planResult = await client.query<any>(`SELECT * FROM ops.store_action_plan WHERE store_action_plan_id = $1::uuid FOR UPDATE`, [input.actionPlanId]);
      const plan = planResult.rows[0];
      if (!plan) throw new NotFoundException("Store action plan was not found");
      if (!input.actorStoreIds.includes(plan.store_id)) {
        throw new ForbiddenException("Solution review is outside assigned Region Manager scope");
      }
      const duplicate = await client.query<any>(`
        SELECT * FROM ops.store_action_solution_review
        WHERE store_action_plan_id = $1::uuid AND idempotency_key = $2::uuid
      `, [input.actionPlanId, input.idempotencyKey]);
      if (duplicate.rows[0]) {
        const prior = duplicate.rows[0];
        if (prior.solution_attempt_id !== input.solutionAttemptId || prior.decision !== input.decision || (prior.reason ?? null) !== (input.reason ?? null) || Number(prior.expected_version) !== input.expectedVersion) {
          throw new ConflictException("Idempotency key payload does not match the original review");
        }
        return this.readProjection(client, input.actionPlanId);
      }
      if (plan.status !== "solution_review_pending" || plan.current_solution_attempt_id !== input.solutionAttemptId) {
        throw new ConflictException("Superseded or stale solution attempt cannot be reviewed");
      }
      if (Number(plan.photo_evidence_version) !== input.expectedVersion) {
        throw new ConflictException("Store action solution review version is stale");
      }
      if (input.decision === "reject" && !input.reason?.trim()) {
        throw new ConflictException("Rejection reason is required");
      }
      await client.query(`
        INSERT INTO ops.store_action_solution_review (
          solution_attempt_id, store_action_plan_id, company_id, region_id, store_id,
          decision, reason, reviewed_by_user_id, idempotency_key, expected_version
        ) VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::uuid,$6,$7,$8::uuid,$9::uuid,$10)
      `, [input.solutionAttemptId, input.actionPlanId, plan.company_id, plan.region_id, plan.store_id,
        input.decision, input.reason ?? null, input.actorUserId, input.idempotencyKey, input.expectedVersion]);
      const after = input.decision === "approve" ? "closed" : "correction_required";
      await client.query(`
        UPDATE ops.store_action_plan SET status = $2,
          resolution_note = CASE WHEN $2 = 'closed' THEN attempt.resolution_note ELSE resolution_note END,
          closed_by_user_id = CASE WHEN $2 = 'closed' THEN $3::uuid ELSE NULL END,
          closed_at = CASE WHEN $2 = 'closed' THEN NOW() ELSE NULL END,
          photo_evidence_version = photo_evidence_version + 1, updated_at = NOW()
        FROM ops.store_action_solution_attempt attempt
        WHERE ops.store_action_plan.store_action_plan_id = $1::uuid
          AND attempt.solution_attempt_id = $4::uuid
      `, [input.actionPlanId, after, input.actorUserId, input.solutionAttemptId]);
      if (input.decision === "approve") {
        await client.query(`
          UPDATE ops.media_asset asset SET active_workflow_hold = FALSE, updated_at = NOW()
          FROM ops.store_action_plan_evidence evidence
          WHERE evidence.store_action_plan_id = $1::uuid
            AND evidence.media_asset_id = asset.media_asset_id
            AND evidence.purpose = 'solution'
        `, [input.actionPlanId]);
      }
      const reviewedEvidence = await client.query<{ media_asset_id: string; canonical_sha256: string | null }>(`
        SELECT evidence.media_asset_id, asset.canonical_sha256
        FROM ops.store_action_plan_evidence evidence
        JOIN ops.media_asset asset ON asset.media_asset_id = evidence.media_asset_id
        WHERE evidence.solution_attempt_id = $1::uuid AND evidence.purpose = 'solution'
        ORDER BY evidence.linked_at LIMIT 1
      `, [input.solutionAttemptId]);
      const eventType = input.decision === "approve"
        ? "checklist_photo_evidence.action.solution_approved"
        : "checklist_photo_evidence.action.solution_rejected";
      await this.insertAudits(client, { ...input, plan, attemptId: input.solutionAttemptId, eventType,
        auditEventType: input.decision === "approve"
          ? storeActionPlanAuditEventTypes.solutionApproved
          : storeActionPlanAuditEventTypes.solutionRejected,
        mediaAssetId: reviewedEvidence.rows[0]?.media_asset_id,
        mediaAssetSha256: reviewedEvidence.rows[0]?.canonical_sha256,
        before: plan.status, after });
      return this.readProjection(client, input.actionPlanId);
    });
  }

  async getProjection(actionPlanId: string) {
    return this.database.withTransaction((client) => this.readProjection(client, actionPlanId));
  }

  async isAssetLinkedToPlan(input: {
    actionPlanId: string; mediaAssetId: string;
  }) {
    const result = await this.database.query<{ ok: boolean }>(`
      SELECT TRUE AS ok
      FROM ops.store_action_plan p
      JOIN ops.store_action_plan_evidence evidence
        ON evidence.store_action_plan_id = p.store_action_plan_id
       AND evidence.media_asset_id = $2::uuid
      WHERE p.store_action_plan_id = $1::uuid
    `, [input.actionPlanId, input.mediaAssetId]);
    return Boolean(result.rows[0]);
  }

  private async readProjection(client: any, actionPlanId: string): Promise<StoreActionPhotoReviewProjection> {
    const result = await client.query(`
      SELECT p.store_action_plan_id, p.status, p.photo_evidence_version, p.current_solution_attempt_id,
        (SELECT COALESCE(jsonb_agg(f.media_asset_id ORDER BY f.linked_at), '[]'::jsonb)
         FROM ops.store_action_plan_evidence f
         WHERE f.store_action_plan_id = p.store_action_plan_id AND f.purpose = 'finding') AS finding_media_asset_ids,
        COALESCE(jsonb_agg(jsonb_build_object(
          'attemptId', a.solution_attempt_id, 'attemptNo', a.attempt_no,
          'resolutionNote', a.resolution_note, 'submittedAt', a.submitted_at,
          'mediaAssetIds', COALESCE(media.ids, '[]'::jsonb),
          'review', CASE WHEN r.solution_review_id IS NULL THEN NULL ELSE jsonb_build_object(
            'decision', r.decision, 'reason', r.reason, 'reviewedAt', r.reviewed_at) END
        ) ORDER BY a.attempt_no DESC) FILTER (WHERE a.solution_attempt_id IS NOT NULL), '[]'::jsonb) AS attempts
      FROM ops.store_action_plan p
      LEFT JOIN ops.store_action_solution_attempt a ON a.store_action_plan_id = p.store_action_plan_id
      LEFT JOIN LATERAL (
        SELECT jsonb_agg(e.media_asset_id ORDER BY e.linked_at) AS ids
        FROM ops.store_action_plan_evidence e WHERE e.solution_attempt_id = a.solution_attempt_id
      ) media ON TRUE
      LEFT JOIN ops.store_action_solution_review r ON r.solution_attempt_id = a.solution_attempt_id
      WHERE p.store_action_plan_id = $1::uuid
      GROUP BY p.store_action_plan_id, p.status, p.photo_evidence_version, p.current_solution_attempt_id
    `, [actionPlanId]);
    const row = result.rows[0];
    if (!row) throw new NotFoundException("Store action plan was not found");
    return {
      actionPlanId: row.store_action_plan_id, status: row.status,
      version: Number(row.photo_evidence_version), currentAttemptId: row.current_solution_attempt_id,
      findingMediaAssetIds: typeof row.finding_media_asset_ids === "string"
        ? JSON.parse(row.finding_media_asset_ids)
        : row.finding_media_asset_ids,
      attempts: typeof row.attempts === "string" ? JSON.parse(row.attempts) : row.attempts,
    };
  }

  private async insertAudits(client: any, input: any) {
    const correlationId = RequestContextStore.getCorrelationId();
    await client.query(`
      INSERT INTO audit.photo_evidence_event (
        actor_user_id,event_type,entity_name,entity_id,company_id,region_id,store_id,
        media_asset_id,correlation_id,state_before,state_after,content_sha256
      ) VALUES ($1::uuid,$2,'store_action_solution_attempt',$3::uuid,$4::uuid,$5::uuid,$6::uuid,
        $7::uuid,$8,$9,$10,$11)
    `, [input.actorUserId, input.eventType, input.attemptId, input.plan.company_id,
      input.plan.region_id, input.plan.store_id, input.mediaAssetId ?? null,
      correlationId, input.before, input.after, input.mediaAssetSha256 ?? null]);
    await client.query(`
      INSERT INTO audit.event_log (
        actor_user_id,event_type,entity_name,entity_id,scope_type,company_id,region_id,store_id,metadata_json
      ) VALUES ($1::uuid,$2,'ops.store_action_plan',$3::uuid,'store',$4::uuid,$5::uuid,$6::uuid,$7::jsonb)
    `, [input.actorUserId, input.auditEventType, input.actionPlanId, input.plan.company_id,
      input.plan.region_id, input.plan.store_id, JSON.stringify({
        correlationId, actorDisplayName: input.actor.displayName,
        actorRoleLabel: input.actor.roleLabel, attemptId: input.attemptId,
        decision: input.decision, reason: input.reason,
      })]);
  }
}
