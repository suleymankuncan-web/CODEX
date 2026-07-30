import { buildVisualComparisonPilotReceipt, type VisualComparisonPilotReceiptRow } from "./visual-comparison-pilot-receipt";

describe("visual comparison pilot receipt", () => {
  const row = (index: number): VisualComparisonPilotReceiptRow => ({
    comparisonRunId: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    status: "human_reviewed", isolationClass: "advisory",
    companyMatches: true, referenceSetMatches: true, notBeforeMatches: true,
    modelMatches: true, policyMatches: true, decision: "pass", finalDecision: "pass", reviewDecision: "accept",
    reviewed: true, reviewCount: 1, typedReviewAuditCount: 1, unexpectedAuditEventCount: 0,
    latencyMs: 100 + index, inputTokens: 1000, outputTokens: 100,
    estimatedCostUsdMicros: 50, retryCount: 0,
  });

  it("[FR-15][AC-14] emits aggregate-only bounded cohort evidence", () => {
    const receipt = buildVisualComparisonPilotReceipt(Array.from({ length: 30 }, (_, index) => row(index)));
    expect(receipt).toMatchObject({ cohortCount: 30, agreementCount: 30, agreementRate: 1 });
    expect(receipt.cohortDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(receipt)).not.toContain("00000000-0000");
  });

  it("[EC-9] rejects wrong-sized or identity-mismatched cohorts", () => {
    expect(() => buildVisualComparisonPilotReceipt([row(1)])).toThrow("30 to 50");
    expect(() => buildVisualComparisonPilotReceipt(Array.from({ length: 30 }, (_, index) => ({
      ...row(index), modelMatches: index !== 4,
    })))).toThrow("identity");
  });

  it("[AC-13] rejects non-terminal, duplicate-review, missing-audit, or unexpected-sink evidence", () => {
    const cohort = Array.from({ length: 30 }, (_, index) => row(index));
    expect(() => buildVisualComparisonPilotReceipt(cohort.map((item, index) => index === 2
      ? { ...item, status: "processing" }
      : item))).toThrow("not terminal")
    expect(() => buildVisualComparisonPilotReceipt(cohort.map((item, index) => index === 3
      ? { ...item, reviewCount: 2 }
      : item))).toThrow("review/audit")
    expect(() => buildVisualComparisonPilotReceipt(cohort.map((item, index) => index === 4
      ? { ...item, typedReviewAuditCount: 0 }
      : item))).toThrow("review/audit")
    expect(() => buildVisualComparisonPilotReceipt(cohort.map((item, index) => index === 5
      ? { ...item, unexpectedAuditEventCount: 1 }
      : item))).toThrow("review/audit")
  });

  it("[AC-13] accepts typed reject and recapture reviews with no fabricated final decision", () => {
    const receipt = buildVisualComparisonPilotReceipt(Array.from({ length: 30 }, (_, index) => ({
      ...row(index),
      ...(index === 1 ? { reviewDecision: "reject" as const, finalDecision: null } : {}),
      ...(index === 2 ? { reviewDecision: "recapture" as const, finalDecision: null } : {}),
    })));
    expect(receipt).toMatchObject({ reviewedCount: 30, manualFallbackCount: 2 });
  });
});
