import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { RequestContextStore } from "../../../shared/request-context";
import { DatabaseService } from "../../../shared/database/database.service";

type Scope = {
  actorUserId: string;
  storeIds: readonly string[];
  companyId: string;
  referenceSetId: string;
  notBefore: Date;
  modelId: string;
  promptVersion: string;
  rubricVersion: string;
  policyVersion: string;
};
type ReviewDecision = "accept" | "override" | "reject" | "recapture";

const FRESH_SCOPE = `
  run.store_id = ANY($2::uuid[])
  AND EXISTS (
    SELECT 1 FROM ops.user_role_assignment ura
    INNER JOIN ops.role role ON role.role_id = ura.role_id AND role.role_code = 'REGION_MANAGER'
    WHERE ura.user_id = $1::uuid
      AND ura.start_at <= CURRENT_TIMESTAMP
      AND (ura.end_at IS NULL OR ura.end_at >= CURRENT_TIMESTAMP)
  )
  AND EXISTS (
    SELECT 1 FROM ops.user_action_store_assignment action_scope
    WHERE action_scope.user_id = $1::uuid AND action_scope.store_id = run.store_id
      AND action_scope.start_at <= CURRENT_TIMESTAMP
      AND (action_scope.end_at IS NULL OR action_scope.end_at >= CURRENT_TIMESTAMP)
  )
`;

const EXACT_COHORT = `
  run.company_id = $3::uuid
  AND run.visual_reference_set_id = $4::uuid
  AND run.created_at >= $5::timestamptz
  AND run.provider_model_id = $6
  AND run.prompt_version = $7
  AND run.rubric_version = $8
  AND run.comparison_policy_version = $9
`;

function scopeParams(input: Scope): unknown[] {
  return [input.actorUserId, input.storeIds, input.companyId,
    input.referenceSetId, input.notBefore, input.modelId, input.promptVersion,
    input.rubricVersion, input.policyVersion];
}

@Injectable()
export class VisualComparisonAdvisoryRepository {
  constructor(private readonly database: DatabaseService) {}

  async list(input: Scope & { limit: number; offset: number }) {
    const result = await this.database.query<any>(`
      SELECT run.comparison_run_id, store.store_name, reference.reference_name,
        run.status, run.decision, run.overall_confidence, run.result_json,
        run.finished_at, (review.comparison_review_id IS NOT NULL) AS reviewed,
        COUNT(*) OVER()::int AS total_count
      FROM ops.visual_comparison_run run
      INNER JOIN ops.store store ON store.store_id = run.store_id
      INNER JOIN ops.visual_reference_set reference
        ON reference.visual_reference_set_id = run.visual_reference_set_id
      LEFT JOIN ops.visual_comparison_review review
        ON review.comparison_run_id = run.comparison_run_id AND review.review_no = 1
      WHERE run.isolation_class = 'advisory'
        AND run.status IN ('completed','abstained','failed_terminal','human_reviewed')
        AND ${FRESH_SCOPE}
        AND ${EXACT_COHORT}
      ORDER BY COALESCE(run.finished_at, run.updated_at) DESC, run.comparison_run_id
      LIMIT $10 OFFSET $11
    `, [...scopeParams(input), input.limit, input.offset]);
    return {
      items: result.rows.map((row) => projectAdvisory(row)),
      total: Number(result.rows[0]?.total_count ?? 0),
      limit: input.limit,
      offset: input.offset,
    };
  }

  async detail(input: Scope & { comparisonRunId: string }) {
    const result = await this.database.query<any>(`
      SELECT run.comparison_run_id, store.store_name, reference.reference_name,
        item.expected_visual_intent, item.review_instructions,
        run.status, run.decision, run.overall_confidence, run.result_json,
        run.finished_at, review.review_decision, review.review_reason,
        review.after_result_json, review.reviewed_at
      FROM ops.visual_comparison_run run
      INNER JOIN ops.store store ON store.store_id = run.store_id
      INNER JOIN ops.visual_reference_set reference
        ON reference.visual_reference_set_id = run.visual_reference_set_id
      INNER JOIN ops.visual_reference_item item
        ON item.visual_reference_item_id = run.visual_reference_item_id
      LEFT JOIN ops.visual_comparison_review review
        ON review.comparison_run_id = run.comparison_run_id AND review.review_no = 1
      WHERE run.comparison_run_id = $10::uuid
        AND run.isolation_class = 'advisory'
        AND run.status IN ('completed','abstained','failed_terminal','human_reviewed')
        AND ${FRESH_SCOPE}
        AND ${EXACT_COHORT}
    `, [...scopeParams(input), input.comparisonRunId]);
    if (!result.rows[0]) throw new NotFoundException("Visual advisory was not found");
    return projectAdvisory(result.rows[0], true);
  }

  async resolveMedia(input: Scope & { comparisonRunId: string; kind: "reference" | "evidence" }) {
    const result = await this.database.query<{ media_asset_id: string; company_id: string; region_id: string; store_id: string }>(`
      SELECT CASE WHEN $11 = 'reference' THEN reference_asset.media_asset_id
                  ELSE run.evidence_media_asset_id END AS media_asset_id,
        run.company_id, run.region_id, run.store_id
      FROM ops.visual_comparison_run run
      INNER JOIN ops.visual_reference_item_asset reference_asset
        ON reference_asset.visual_reference_item_id = run.visual_reference_item_id
       AND reference_asset.display_order = 0
      INNER JOIN ops.media_asset reference_media
        ON reference_media.media_asset_id = reference_asset.media_asset_id
       AND reference_media.company_id = run.company_id
      INNER JOIN ops.media_asset evidence_media
        ON evidence_media.media_asset_id = run.evidence_media_asset_id
       AND evidence_media.company_id = run.company_id
       AND evidence_media.store_id = run.store_id
      WHERE run.comparison_run_id = $10::uuid
        AND run.isolation_class = 'advisory'
        AND run.status IN ('completed','abstained','failed_terminal','human_reviewed')
        AND ${FRESH_SCOPE}
        AND ${EXACT_COHORT}
      LIMIT 1
    `, [...scopeParams(input), input.comparisonRunId, input.kind]);
    if (!result.rows[0]) throw new NotFoundException("Visual advisory media was not found");
    return result.rows[0];
  }

  async review(input: Scope & {
    comparisonRunId: string;
    decision: ReviewDecision;
    reason: string;
    finalDecision?: "pass" | "partial" | "fail";
    minimumConfidence: number;
  }) {
    return this.database.withTransaction(async (client) => {
      const result = await client.query<any>(`
        SELECT run.* FROM ops.visual_comparison_run run
        WHERE run.comparison_run_id = $10::uuid
          AND run.isolation_class = 'advisory'
          AND ${FRESH_SCOPE}
          AND ${EXACT_COHORT}
        FOR UPDATE
      `, [...scopeParams(input), input.comparisonRunId]);
      const run = result.rows[0];
      if (!run) throw new NotFoundException("Visual advisory was not found");

      const finalDecision = input.decision === "override"
        ? input.finalDecision
        : input.decision === "accept"
          ? run.decision
          : null;
      const persistedDecision = input.decision === "recapture" ? "request_recapture" : input.decision;
      const after = { decision: finalDecision, source: "region_manager" };
      const prior = await client.query<any>(`
        SELECT * FROM ops.visual_comparison_review
        WHERE comparison_run_id = $1::uuid AND review_no = 1
      `, [input.comparisonRunId]);
      if (prior.rows[0]) {
        const row = prior.rows[0];
        if (row.review_decision === persistedDecision && row.review_reason === input.reason &&
            row.after_result_json?.decision === after.decision &&
            row.after_result_json?.source === after.source) {
          return { comparisonRunId: input.comparisonRunId, decision: input.decision, finalDecision };
        }
        throw new ConflictException("Visual advisory already has a different final review");
      }
      if (!["completed", "abstained", "failed_terminal"].includes(run.status)) {
        throw new ConflictException("Visual advisory is not reviewable");
      }
      if (input.decision === "accept" &&
          (run.status !== "completed" || Number(run.overall_confidence ?? 0) < input.minimumConfidence ||
           !["pass", "partial", "fail"].includes(run.decision))) {
        throw new ConflictException("Low-confidence or incomplete advisory cannot be accepted");
      }
      await client.query(`
        INSERT INTO ops.visual_comparison_review (
          comparison_run_id, company_id, review_no, review_decision, review_reason,
          before_result_json, after_result_json, reviewed_by_user_id
        ) VALUES ($1::uuid,$2::uuid,1,$3,$4,$5::jsonb,$6::jsonb,$7::uuid)
      `, [input.comparisonRunId, run.company_id, persistedDecision, input.reason,
        JSON.stringify(run.result_json ?? null), JSON.stringify(after), input.actorUserId]);
      await client.query(`
        UPDATE ops.visual_comparison_run SET status = 'human_reviewed', updated_at = NOW()
        WHERE comparison_run_id = $1::uuid
      `, [input.comparisonRunId]);
      const eventType = input.decision === "accept"
        ? "checklist_photo_evidence.comparison.review_accepted"
        : input.decision === "override"
          ? "checklist_photo_evidence.comparison.review_overridden"
          : input.decision === "reject"
            ? "checklist_photo_evidence.comparison.review_rejected"
            : "checklist_photo_evidence.comparison.recapture_requested";
      await client.query(`
        INSERT INTO audit.photo_evidence_event (
          actor_user_id,event_type,entity_name,entity_id,company_id,region_id,store_id,
          media_asset_id,correlation_id,reason_code,state_before,state_after,
          content_sha256,rubric_version,policy_version
        ) VALUES ($1::uuid,$2,'visual_comparison_review',$3::uuid,$4::uuid,$5::uuid,$6::uuid,
          $7::uuid,$8,$9,$10,'human_reviewed',$11,$12,$13)
      `, [input.actorUserId, eventType, input.comparisonRunId, run.company_id, run.region_id,
        run.store_id, run.evidence_media_asset_id, RequestContextStore.getCorrelationId(),
        persistedDecision, run.status, run.evidence_sha256, run.rubric_version,
        run.comparison_policy_version]);
      return { comparisonRunId: input.comparisonRunId, decision: input.decision, finalDecision };
    });
  }
}

function projectAdvisory(row: any, detail = false) {
  const result = typeof row.result_json === "string" ? JSON.parse(row.result_json) : row.result_json;
  const advisoryResult = result?.result ?? result;
  return {
    comparisonRunId: row.comparison_run_id,
    storeName: row.store_name,
    referenceName: row.reference_name,
    status: row.status,
    suggestion: row.decision ?? null,
    confidence: row.overall_confidence === null ? null : Number(row.overall_confidence),
    qualityFlags: advisoryResult?.qualityFlags ?? [],
    modelLimitations: advisoryResult?.modelLimitations ?? [],
    dimensions: advisoryResult?.dimensions ?? [],
    finishedAt: row.finished_at ?? null,
    reviewed: Boolean(row.review_decision ?? row.reviewed),
    ...(detail ? {
      criterion: row.expected_visual_intent,
      reviewInstructions: row.review_instructions,
      review: row.review_decision ? {
        decision: row.review_decision === "request_recapture" ? "recapture" : row.review_decision,
        reason: row.review_reason,
        finalDecision: row.after_result_json?.decision ?? null,
        reviewedAt: row.reviewed_at,
      } : null,
    } : {}),
  };
}
