import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Client } from "pg";
import { buildVisualComparisonPilotReceipt } from "../src/modules/store-ops/application/visual-comparison-pilot-receipt";

async function main() {
  const manifestPath = process.argv[2];
  if (!manifestPath) throw new Error("Usage: receipt:visual-advisory-pilot <opaque-run-id-manifest.json>");
  const ids = JSON.parse(readFileSync(resolve(manifestPath), "utf8")) as unknown;
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!Array.isArray(ids) || ids.length < 30 || ids.length > 50 ||
      ids.some((value) => typeof value !== "string" || !uuidPattern.test(value)) ||
      new Set(ids).size !== ids.length) {
    throw new Error("Manifest must contain 30 to 50 unique opaque run UUIDs");
  }
  const databaseUrl = required("DATABASE_URL");
  const companyId = required("VISUAL_COMPARISON_COMPANY_ID");
  const referenceSetId = required("VISUAL_COMPARISON_REFERENCE_SET_ID");
  const notBefore = required("VISUAL_COMPARISON_NOT_BEFORE");
  const caPath = required("DATABASE_CA_CERT_PATH");
  const client = new Client({ connectionString: databaseUrl, ssl: { ca: readFileSync(resolve(caPath), "utf8"), rejectUnauthorized: true } });
  await client.connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const result = await client.query<any>(`
      SELECT run.comparison_run_id, run.status, run.isolation_class,
        run.company_id = $2::uuid AS company_matches,
        run.visual_reference_set_id = $3::uuid AS reference_set_matches,
        run.created_at >= $4::timestamptz AS not_before_matches,
        run.provider_model_id = 'qwen3.7-plus-2026-05-26' AS model_matches,
        run.prompt_version = 'hr-axis-qwen-prompt-policy-v1'
          AND run.rubric_version = 'hr-axis-vm-rubric-v1'
          AND run.comparison_policy_version = 'hr-axis-visual-comparison-result-v1' AS policy_matches,
        run.decision, review.review_decision,
        review.after_result_json->>'decision' AS final_decision,
        review.comparison_review_id IS NOT NULL AS reviewed,
        (SELECT COUNT(*)::int FROM ops.visual_comparison_review counted_review
          WHERE counted_review.comparison_run_id = run.comparison_run_id) AS review_count,
        (SELECT COUNT(*)::int FROM audit.photo_evidence_event review_event
          WHERE review_event.entity_name = 'visual_comparison_review'
            AND review_event.entity_id = run.comparison_run_id
            AND review_event.event_type IN (
              'checklist_photo_evidence.comparison.review_accepted',
              'checklist_photo_evidence.comparison.review_overridden',
              'checklist_photo_evidence.comparison.review_rejected',
              'checklist_photo_evidence.comparison.recapture_requested'
            )) AS typed_review_audit_count,
        (SELECT COUNT(*)::int FROM audit.photo_evidence_event unexpected_event
          WHERE unexpected_event.entity_id = run.comparison_run_id
            AND unexpected_event.entity_name <> 'visual_comparison_review') AS unexpected_audit_event_count,
        run.latency_ms,
        COALESCE((run.result_json->'usage'->>'inputTokens')::int, 0) AS input_tokens,
        COALESCE((run.result_json->'usage'->>'outputTokens')::int, 0) AS output_tokens,
        COALESCE((run.result_json->'usage'->>'estimatedCostUsdMicros')::bigint, 0) AS estimated_cost_usd_micros,
        GREATEST(run.attempt_count - 1, 0) AS retry_count
      FROM ops.visual_comparison_run run
      LEFT JOIN ops.visual_comparison_review review
        ON review.comparison_run_id = run.comparison_run_id AND review.review_no = 1
      WHERE run.comparison_run_id = ANY($1::uuid[])
      ORDER BY run.comparison_run_id
    `, [ids, companyId, referenceSetId, notBefore]);
    if (result.rows.length !== ids.length) throw new Error("One or more manifest rows are unavailable");
    await client.query("COMMIT");
    const receipt = buildVisualComparisonPilotReceipt(result.rows.map((row) => ({
      comparisonRunId: row.comparison_run_id, status: row.status,
      isolationClass: row.isolation_class, companyMatches: row.company_matches,
      referenceSetMatches: row.reference_set_matches, notBeforeMatches: row.not_before_matches,
      modelMatches: row.model_matches, policyMatches: row.policy_matches,
      decision: row.decision, finalDecision: row.final_decision,
      reviewDecision: row.review_decision === "request_recapture" ? "recapture" : row.review_decision,
      reviewed: row.reviewed,
      reviewCount: Number(row.review_count), typedReviewAuditCount: Number(row.typed_review_audit_count),
      unexpectedAuditEventCount: Number(row.unexpected_audit_event_count),
      latencyMs: row.latency_ms === null ? null : Number(row.latency_ms),
      inputTokens: Number(row.input_tokens), outputTokens: Number(row.output_tokens),
      estimatedCostUsdMicros: Number(row.estimated_cost_usd_micros), retryCount: Number(row.retry_count),
    })));
    process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}

function required(key: string) {
  const value = process.env[key]?.trim();
  if (!value) throw new Error(`${key} is required`);
  return value;
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : "Pilot receipt failed"}\n`);
  process.exitCode = 1;
});
