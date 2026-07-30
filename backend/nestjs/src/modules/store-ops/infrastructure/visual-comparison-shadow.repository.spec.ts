import { readFileSync } from "node:fs";
import { join } from "node:path";
import { VisualComparisonShadowRepository } from "./visual-comparison-shadow.repository";

const claimInput = {
  comparisonRunId: "11111111-1111-4111-8111-111111111111",
  isolationClass: "shadow" as const,
  maxAttempts: 3,
  processingLeaseSeconds: 300,
  companyId: "22222222-2222-4222-8222-222222222222",
  referenceSetId: "33333333-3333-4333-8333-333333333333",
  notBefore: new Date("2026-07-30T00:00:00.000Z"),
  budget: {
    maxRequests: 20,
    maxTotalTokens: 400000,
    maxSpendUsdMicros: 1000000,
    reservedTokensPerAttempt: 20000,
    reservedSpendUsdMicrosPerAttempt: 1000,
  },
};

function selectedRow(overrides: Record<string, unknown> = {}) {
  return {
    comparison_run_id: claimInput.comparisonRunId,
    company_id: claimInput.companyId,
    region_id: "44444444-4444-4444-8444-444444444444",
    store_id: "55555555-5555-4555-8555-555555555555",
    submitted_by_user_id: "66666666-6666-4666-8666-666666666666",
    reference_media_asset_id: "77777777-7777-4777-8777-777777777777",
    evidence_media_asset_id: "88888888-8888-4888-8888-888888888888",
    reference_sha256: "a".repeat(64),
    evidence_sha256: "b".repeat(64),
    reference_width_px: 1200,
    reference_height_px: 900,
    evidence_width_px: 1200,
    evidence_height_px: 900,
    expected_visual_intent: "approved fixture",
    review_instructions: "compare visible presentation",
    attempt_count: 0,
    status: "queued",
    started_at: null,
    ...overrides,
  };
}

function repositoryWithQuery(query: jest.Mock) {
  const database = {
    withTransaction: jest.fn(async (work) => work({ query })),
    query: jest.fn(),
  };
  return new VisualComparisonShadowRepository(database as never);
}

describe("VisualComparisonShadowRepository source contract", () => {
  const source = readFileSync(
    join(__dirname, "visual-comparison-shadow.repository.ts"),
    "utf8",
  );

  it("uses the existing run ledger as a scoped durable outbox", () => {
    expect(source).toContain("ops.visual_comparison_run");
    expect(source).toContain("submission.company_id = $1::uuid");
    expect(source).toContain("submission.visual_reference_set_id = $2::uuid");
    expect(source).toContain("submission.finalized_at >= $3::timestamptz");
    expect(source).toContain("ON CONFLICT (company_id, idempotency_key) DO NOTHING");
  });

  it("claims idempotently and never writes official product outcomes", () => {
    expect(source).toContain("pg_advisory_xact_lock");
    expect(source).toContain("FOR UPDATE OF run");
    expect(source).toContain("run.status IN ('queued', 'failed_retryable')");
    expect(source).toContain("run.attempt_count < $5");
    expect(source).toContain("submission_media.media_asset_id = run.evidence_media_asset_id");
    expect(source).toContain("submission.finalized_at >= $4::timestamptz");
    expect(source).toContain("AND attempt_count = $9");
    expect(source).toContain("AND attempt_count = $4");
    expect(source).toContain("budgetReservation");
    expect(source).not.toMatch(/UPDATE ops\.(?:visual_campaign_assignment|checklist_instance|store_action_plan|kpi|target|incentive|competition)/i);
    expect(source).not.toContain("ops.visual_comparison_review");
  });

  it("reserves durable scope budget and returns an attempt-owned claim", async () => {
    const query = jest.fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [selectedRow()] })
      .mockResolvedValueOnce({
        rows: [{ request_attempts: "0", reserved_tokens: "0", reserved_spend: "0" }],
      })
      .mockResolvedValueOnce({ rows: [{ reserved_tokens: "0" }] })
      .mockResolvedValueOnce({ rows: [{ reserved_spend: "0" }] })
      .mockResolvedValueOnce({ rows: [] });
    const repository = repositoryWithQuery(query);

    await expect(repository.claim(claimInput)).resolves.toMatchObject({
      status: "claimed",
      claim: { attemptNumber: 1, comparisonRunId: claimInput.comparisonRunId },
    });
    expect(String(query.mock.calls[1][0])).toContain(
      "submission_media.media_asset_id = run.evidence_media_asset_id",
    );
    expect(String(query.mock.calls[5][0])).toContain("budgetReservation");
  });

  it("returns busy without acknowledging or reserving a live processing claim", async () => {
    const query = jest.fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [selectedRow({ status: "processing", started_at: new Date() })],
      });
    const repository = repositoryWithQuery(query);
    await expect(repository.claim(claimInput)).resolves.toEqual({ status: "busy" });
    expect(query).toHaveBeenCalledTimes(2);
  });

  it("fails the scoped run terminal before provider work when durable budget is exhausted", async () => {
    const query = jest.fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [selectedRow()] })
      .mockResolvedValueOnce({
        rows: [{ request_attempts: "20", reserved_tokens: "400000", reserved_spend: "1000000" }],
      })
      .mockResolvedValueOnce({ rows: [] });
    const repository = repositoryWithQuery(query);
    await expect(repository.claim(claimInput)).resolves.toEqual({
      status: "budget_exhausted",
    });
    expect(String(query.mock.calls[3][0])).toContain("failure_reason = 'budget_exhausted'");
  });

  it("terminalizes stale processing when exact media or scope can no longer resolve", async () => {
    const query = jest.fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 });
    const repository = repositoryWithQuery(query);
    await expect(repository.claim(claimInput)).resolves.toEqual({ status: "idempotent" });
    expect(String(query.mock.calls[2][0])).toContain("status = 'processing'");
    expect(String(query.mock.calls[2][0])).toContain("make_interval(secs => $4)");
  });

  it("reports attempt CAS rejection instead of silently accepting stale completion", async () => {
    const query = jest.fn().mockResolvedValue({ rows: [], rowCount: 0 });
    const repository = new VisualComparisonShadowRepository({ query } as never);
    await expect(repository.fail({
      comparisonRunId: claimInput.comparisonRunId,
      code: "provider_timeout",
      retryable: true,
      attemptNumber: 1,
    })).resolves.toBe(false);
  });
});
