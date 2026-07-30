import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../../../shared/database/database.service";
import {
  VisualComparisonShadowClaim,
  VisualComparisonShadowClaimResult,
  VisualComparisonShadowRepositoryPort,
  VisualComparisonShadowScope,
  buildShadowIdempotencyKey,
} from "../application/visual-comparison-shadow.contract";
import { QWEN_VISUAL_COMPARISON_MODEL } from "../application/visual-comparison.contract";

type CandidateRow = {
  company_id: string;
  region_id: string;
  store_id: string;
  assignment_id: string;
  campaign_revision_id: string;
  visual_reference_set_id: string;
  visual_reference_item_id: string;
  evidence_media_asset_id: string;
  evidence_sha256: string;
  reference_sha256: string;
  rubric_version: string;
};

type ClaimRow = {
  comparison_run_id: string;
  company_id: string;
  region_id: string;
  store_id: string;
  submitted_by_user_id: string;
  reference_media_asset_id: string;
  evidence_media_asset_id: string;
  reference_sha256: string;
  evidence_sha256: string;
  reference_width_px: number;
  reference_height_px: number;
  evidence_width_px: number;
  evidence_height_px: number;
  expected_visual_intent: string;
  review_instructions: string;
  attempt_count: number;
  status: string;
  started_at: Date | null;
};

type BudgetRow = {
  request_attempts: string;
  reserved_tokens: string;
  reserved_spend: string;
};

@Injectable()
export class VisualComparisonShadowRepository
implements VisualComparisonShadowRepositoryPort {
  constructor(private readonly database: DatabaseService) {}

  async reconcile(input: VisualComparisonShadowScope & {
    promptVersion: string;
    policyVersion: string;
    maxAttempts: number;
    processingLeaseSeconds: number;
  }): Promise<string[]> {
    return this.database.withTransaction(async (client) => {
      const candidates = await client.query<CandidateRow>(`
        SELECT submission.company_id, submission.region_id, submission.store_id,
          submission.assignment_id, submission.campaign_revision_id,
          submission.visual_reference_set_id, media.visual_reference_item_id,
          media.media_asset_id AS evidence_media_asset_id,
          evidence.canonical_sha256 AS evidence_sha256,
          reference.canonical_sha256 AS reference_sha256,
          item.rubric_version
        FROM ops.visual_campaign_submission submission
        JOIN ops.visual_campaign_submission_media media
          ON media.campaign_submission_id = submission.campaign_submission_id
        JOIN ops.visual_reference_item item
          ON item.visual_reference_item_id = media.visual_reference_item_id
         AND item.campaign_revision_id = submission.campaign_revision_id
        JOIN ops.visual_reference_item_asset reference_link
          ON reference_link.visual_reference_item_id = item.visual_reference_item_id
         AND reference_link.display_order = 0
        JOIN ops.media_asset evidence
          ON evidence.media_asset_id = media.media_asset_id
         AND evidence.company_id = submission.company_id
         AND evidence.store_id = submission.store_id
        JOIN ops.media_asset reference
          ON reference.media_asset_id = reference_link.media_asset_id
         AND reference.company_id = submission.company_id
        WHERE submission.company_id = $1::uuid
          AND submission.visual_reference_set_id = $2::uuid
          AND submission.finalized_at >= $3::timestamptz
          AND evidence.state = 'ready'
          AND reference.state = 'ready'
          AND evidence.canonical_sha256 IS NOT NULL
          AND reference.canonical_sha256 IS NOT NULL
        ORDER BY submission.finalized_at, media.campaign_submission_media_id
        LIMIT $4
      `, [input.companyId, input.referenceSetId, input.notBefore, input.limit]);

      for (const row of candidates.rows) {
        const idempotencyKey = buildShadowIdempotencyKey({
          companyId: row.company_id,
          assignmentId: row.assignment_id,
          visualReferenceItemId: row.visual_reference_item_id,
          evidenceSha256: row.evidence_sha256,
          referenceSha256: row.reference_sha256,
          rubricVersion: row.rubric_version,
          promptVersion: input.promptVersion,
          policyVersion: input.policyVersion,
        });
        await client.query(`
          INSERT INTO ops.visual_comparison_run (
            company_id, region_id, store_id, assignment_id,
            visual_reference_set_id, campaign_revision_id,
            visual_reference_item_id, evidence_media_asset_id,
            isolation_class, status, evidence_sha256, reference_sha256,
            rubric_version, prompt_version, comparison_policy_version,
            idempotency_key
          ) VALUES (
            $1::uuid, $2::uuid, $3::uuid, $4::uuid,
            $5::uuid, $6::uuid, $7::uuid, $8::uuid,
            'shadow', 'queued', $9, $10, $11, $12, $13, $14
          )
          ON CONFLICT (company_id, idempotency_key) DO NOTHING
        `, [
          row.company_id,
          row.region_id,
          row.store_id,
          row.assignment_id,
          row.visual_reference_set_id,
          row.campaign_revision_id,
          row.visual_reference_item_id,
          row.evidence_media_asset_id,
          row.evidence_sha256,
          row.reference_sha256,
          row.rubric_version,
          input.promptVersion,
          input.policyVersion,
          idempotencyKey,
        ]);
      }

      const queued = await client.query<{ comparison_run_id: string }>(`
        SELECT run.comparison_run_id
        FROM ops.visual_comparison_run run
        WHERE run.company_id = $1::uuid
          AND run.visual_reference_set_id = $2::uuid
          AND run.created_at >= $3::timestamptz
          AND run.isolation_class = 'shadow'
          AND (
            run.status IN ('queued', 'failed_retryable')
            OR (
              run.status = 'processing'
              AND run.started_at < CURRENT_TIMESTAMP - make_interval(secs => $6)
            )
          )
          AND run.attempt_count < $5
        ORDER BY run.created_at, run.comparison_run_id
        LIMIT $4
      `, [
        input.companyId,
        input.referenceSetId,
        input.notBefore,
        input.limit,
        input.maxAttempts,
        input.processingLeaseSeconds,
      ]);
      return queued.rows.map((row) => row.comparison_run_id);
    });
  }

  async claim(input: {
    comparisonRunId: string;
    maxAttempts: number;
    processingLeaseSeconds: number;
    companyId: string;
    referenceSetId: string;
    notBefore: Date;
    budget: Parameters<VisualComparisonShadowRepositoryPort["claim"]>[0]["budget"];
  }): Promise<VisualComparisonShadowClaimResult> {
    return this.database.withTransaction(async (client) => {
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
        [`visual-comparison-shadow:${input.companyId}:${input.referenceSetId}`],
      );

      const selected = await client.query<ClaimRow>(`
        SELECT run.comparison_run_id, run.company_id, run.region_id,
          run.store_id, submission.submitted_by_user_id,
          reference.media_asset_id AS reference_media_asset_id,
          run.evidence_media_asset_id, run.reference_sha256,
          run.evidence_sha256, reference.width_px AS reference_width_px,
          reference.height_px AS reference_height_px,
          evidence.width_px AS evidence_width_px,
          evidence.height_px AS evidence_height_px,
          item.expected_visual_intent, item.review_instructions,
          run.attempt_count, run.status, run.started_at
        FROM ops.visual_comparison_run run
        JOIN ops.visual_reference_item item
          ON item.visual_reference_item_id = run.visual_reference_item_id
         AND item.campaign_revision_id = run.campaign_revision_id
         AND item.visual_reference_set_id = run.visual_reference_set_id
         AND item.company_id = run.company_id
        JOIN ops.visual_reference_item_asset reference_link
          ON reference_link.visual_reference_item_id = item.visual_reference_item_id
         AND reference_link.display_order = 0
        JOIN ops.media_asset reference
          ON reference.media_asset_id = reference_link.media_asset_id
         AND reference.company_id = run.company_id
         AND reference.state = 'ready'
         AND reference.canonical_sha256 = run.reference_sha256
        JOIN ops.media_asset evidence
          ON evidence.media_asset_id = run.evidence_media_asset_id
         AND evidence.company_id = run.company_id
         AND evidence.store_id = run.store_id
         AND evidence.state = 'ready'
         AND evidence.canonical_sha256 = run.evidence_sha256
        JOIN ops.visual_campaign_submission_media submission_media
          ON submission_media.media_asset_id = run.evidence_media_asset_id
         AND submission_media.visual_reference_item_id = run.visual_reference_item_id
        JOIN ops.visual_campaign_submission submission
          ON submission.campaign_submission_id = submission_media.campaign_submission_id
         AND submission.assignment_id = run.assignment_id
         AND submission.company_id = run.company_id
         AND submission.visual_reference_set_id = run.visual_reference_set_id
         AND submission.finalized_at >= $4::timestamptz
        WHERE run.comparison_run_id = $1::uuid
          AND run.isolation_class = 'shadow'
          AND run.company_id = $2::uuid
          AND run.visual_reference_set_id = $3::uuid
        FOR UPDATE OF run
      `, [
        input.comparisonRunId,
        input.companyId,
        input.referenceSetId,
        input.notBefore,
      ]);
      const row = selected.rows[0];
      if (!row) {
        await client.query(`
          UPDATE ops.visual_comparison_run
          SET status = 'failed_terminal', finished_at = CURRENT_TIMESTAMP,
            failure_reason = 'scope_or_media_unavailable', updated_at = CURRENT_TIMESTAMP
          WHERE comparison_run_id = $1::uuid
            AND company_id = $2::uuid
            AND visual_reference_set_id = $3::uuid
            AND isolation_class = 'shadow'
            AND (
              status IN ('queued', 'failed_retryable')
              OR (
                status = 'processing'
                AND (
                  started_at IS NULL
                  OR started_at < CURRENT_TIMESTAMP - make_interval(secs => $4)
                )
              )
            )
        `, [
          input.comparisonRunId,
          input.companyId,
          input.referenceSetId,
          input.processingLeaseSeconds,
        ]);
        return { status: "idempotent" as const };
      }

      if (["completed", "abstained", "failed_terminal", "human_reviewed"].includes(row.status)) {
        return { status: "idempotent" as const };
      }
      const leaseExpired = row.status === "processing" && row.started_at !== null &&
        row.started_at.getTime() < Date.now() - input.processingLeaseSeconds * 1000;
      if (row.status === "processing" && !leaseExpired) {
        return { status: "busy" as const };
      }
      if (row.attempt_count >= input.maxAttempts) {
        await client.query(`
          UPDATE ops.visual_comparison_run
          SET status = 'failed_terminal', finished_at = CURRENT_TIMESTAMP,
            failure_reason = 'attempts_exhausted', updated_at = CURRENT_TIMESTAMP
          WHERE comparison_run_id = $1::uuid
        `, [input.comparisonRunId]);
        return { status: "idempotent" as const };
      }

      const budgetResult = await client.query<BudgetRow>(`
        SELECT COALESCE(SUM(run.attempt_count), 0)::text AS request_attempts,
          COALESCE(SUM(
            CASE WHEN run.result_json ? 'budgetReservation'
              THEN (run.result_json #>> '{budgetReservation,tokens}')::bigint
              ELSE 0 END
          ), 0)::text AS reserved_tokens,
          COALESCE(SUM(run.bounded_cost_minor_units), 0)::text AS reserved_spend
        FROM ops.visual_comparison_run run
        WHERE run.company_id = $1::uuid
          AND run.visual_reference_set_id = $2::uuid
          AND run.isolation_class = 'shadow'
          AND run.created_at >= $3::timestamptz
      `, [input.companyId, input.referenceSetId, input.notBefore]);
      const used = budgetResult.rows[0];
      const requestsAfterClaim = BigInt(used.request_attempts) + 1n;
      const tokensAfterClaim = BigInt(used.reserved_tokens) +
        BigInt(input.budget.reservedTokensPerAttempt);
      const spendAfterClaim = BigInt(used.reserved_spend) +
        BigInt(input.budget.reservedSpendUsdMicrosPerAttempt);
      if (
        requestsAfterClaim > BigInt(input.budget.maxRequests) ||
        tokensAfterClaim > BigInt(input.budget.maxTotalTokens) ||
        spendAfterClaim > BigInt(input.budget.maxSpendUsdMicros)
      ) {
        await client.query(`
          UPDATE ops.visual_comparison_run
          SET status = 'failed_terminal', finished_at = CURRENT_TIMESTAMP,
            failure_reason = 'budget_exhausted', updated_at = CURRENT_TIMESTAMP
          WHERE comparison_run_id = $1::uuid
        `, [input.comparisonRunId]);
        return { status: "budget_exhausted" as const };
      }

      const nextAttempt = row.attempt_count + 1;
      const priorReservedTokens = Number(
        (await client.query<{ reserved_tokens: string }>(`
          SELECT COALESCE(result_json #>> '{budgetReservation,tokens}', '0')
            AS reserved_tokens
          FROM ops.visual_comparison_run
          WHERE comparison_run_id = $1::uuid
        `, [input.comparisonRunId])).rows[0].reserved_tokens,
      );
      const priorReservedSpend = Number(
        (await client.query<{ reserved_spend: string }>(`
          SELECT COALESCE(bounded_cost_minor_units, 0)::text AS reserved_spend
          FROM ops.visual_comparison_run
          WHERE comparison_run_id = $1::uuid
        `, [input.comparisonRunId])).rows[0].reserved_spend,
      );
      await client.query(`
        UPDATE ops.visual_comparison_run
        SET status = 'processing', attempt_count = $2,
          started_at = CURRENT_TIMESTAMP, finished_at = NULL,
          bounded_cost_minor_units = $3,
          result_json = jsonb_set(
            COALESCE(result_json, '{}'::jsonb),
            '{budgetReservation}',
            jsonb_build_object('tokens', $4::bigint, 'spendUsdMicros', $3::bigint),
            true
          ),
          failure_reason = NULL, updated_at = CURRENT_TIMESTAMP
        WHERE comparison_run_id = $1::uuid
      `, [
        input.comparisonRunId,
        nextAttempt,
        priorReservedSpend + input.budget.reservedSpendUsdMicrosPerAttempt,
        priorReservedTokens + input.budget.reservedTokensPerAttempt,
      ]);

      const claim: VisualComparisonShadowClaim = {
        comparisonRunId: row.comparison_run_id,
        companyId: row.company_id,
        regionId: row.region_id,
        storeId: row.store_id,
        actorUserId: row.submitted_by_user_id,
        referenceMediaAssetId: row.reference_media_asset_id,
        evidenceMediaAssetId: row.evidence_media_asset_id,
        referenceSha256: row.reference_sha256,
        evidenceSha256: row.evidence_sha256,
        referenceWidthPx: row.reference_width_px,
        referenceHeightPx: row.reference_height_px,
        evidenceWidthPx: row.evidence_width_px,
        evidenceHeightPx: row.evidence_height_px,
        expectedVisualIntent: row.expected_visual_intent,
        reviewInstructions: row.review_instructions,
        attemptNumber: nextAttempt,
      };
      return { status: "claimed" as const, claim };
    });
  }

  async complete(input: Parameters<VisualComparisonShadowRepositoryPort["complete"]>[0]) {
    const decision = input.invocation.result.decision;
    const status = decision === "abstain" || decision === "recapture_required"
      ? "abstained"
      : "completed";
    const result = await this.database.query(`
      UPDATE ops.visual_comparison_run
      SET status = $2, finished_at = CURRENT_TIMESTAMP,
        latency_ms = $3,
        decision = $4, overall_confidence = $5,
        provider_adapter_id = 'qwen-compatible-v1', provider_model_id = $6,
        result_json = jsonb_build_object(
          'result', $7::jsonb,
          'usage', $8::jsonb,
          'budgetReservation', COALESCE(result_json->'budgetReservation', '{}'::jsonb)
        ), failure_reason = NULL,
        updated_at = CURRENT_TIMESTAMP
      WHERE comparison_run_id = $1::uuid AND status = 'processing'
        AND attempt_count = $9
    `, [
      input.comparisonRunId,
      status,
      input.invocation.latencyMs,
      decision,
      input.invocation.result.overallConfidence,
      QWEN_VISUAL_COMPARISON_MODEL,
      JSON.stringify(input.invocation.result),
      JSON.stringify(input.invocation.usage),
      input.attemptNumber,
    ]);
    return result.rowCount === 1;
  }

  async fail(input: Parameters<VisualComparisonShadowRepositoryPort["fail"]>[0]) {
    const result = await this.database.query(`
      UPDATE ops.visual_comparison_run
      SET status = $2, finished_at = CURRENT_TIMESTAMP,
        failure_reason = $3, updated_at = CURRENT_TIMESTAMP
      WHERE comparison_run_id = $1::uuid AND status = 'processing'
        AND attempt_count = $4
    `, [
      input.comparisonRunId,
      input.retryable ? "failed_retryable" : "failed_terminal",
      input.code,
      input.attemptNumber,
    ]);
    return result.rowCount === 1;
  }
}
