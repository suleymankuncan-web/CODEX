import { createHash } from "node:crypto";

export type VisualComparisonPilotReceiptRow = {
  comparisonRunId: string;
  status: string;
  isolationClass: string;
  companyMatches: boolean;
  referenceSetMatches: boolean;
  notBeforeMatches: boolean;
  modelMatches: boolean;
  policyMatches: boolean;
  decision: string | null;
  finalDecision: string | null;
  reviewDecision: "accept" | "override" | "reject" | "recapture" | null;
  reviewed: boolean;
  reviewCount: number;
  typedReviewAuditCount: number;
  unexpectedAuditEventCount: number;
  latencyMs: number | null;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsdMicros: number;
  retryCount: number;
};

export function buildVisualComparisonPilotReceipt(rows: VisualComparisonPilotReceiptRow[]) {
  if (rows.length < 30 || rows.length > 50) throw new Error("Pilot cohort must contain 30 to 50 rows");
  if (rows.some((row) => row.isolationClass !== "advisory" || !row.companyMatches ||
      !row.referenceSetMatches || !row.notBeforeMatches || !row.modelMatches || !row.policyMatches)) {
    throw new Error("Pilot cohort identity does not match the approved advisory scope");
  }
  if (rows.some((row) => {
    const typedOutcome = row.reviewDecision === "accept" || row.reviewDecision === "override"
      ? ["pass", "partial", "fail"].includes(row.finalDecision ?? "")
      : (row.reviewDecision === "reject" || row.reviewDecision === "recapture") && row.finalDecision === null;
    return row.status !== "human_reviewed" || !row.reviewed || row.reviewCount !== 1 ||
      row.typedReviewAuditCount !== 1 || row.unexpectedAuditEventCount !== 0 || !typedOutcome;
  })) {
    throw new Error("Pilot cohort is not terminal or review/audit isolation is incomplete");
  }
  const reviewed = rows.filter((row) => row.reviewed);
  const comparable = reviewed.filter((row) => ["pass", "partial", "fail"].includes(row.decision ?? ""));
  const agreement = comparable.filter((row) => row.decision === row.finalDecision).length;
  const latencies = rows.map((row) => row.latencyMs).filter((value): value is number => value !== null).sort((a, b) => a - b);
  const count = (key: keyof VisualComparisonPilotReceiptRow, value: unknown) => rows.filter((row) => row[key] === value).length;
  return {
    schemaVersion: "hr-axis-visual-advisory-pilot-receipt-v1",
    cohortDigest: createHash("sha256").update(rows.map((row) => row.comparisonRunId).sort().join("\n")).digest("hex"),
    cohortCount: rows.length,
    statusCounts: Object.fromEntries([...new Set(rows.map((row) => row.status))].sort().map((value) => [value, count("status", value)])),
    decisionCounts: Object.fromEntries([...new Set(rows.map((row) => row.decision ?? "none"))].sort().map((value) => [value, rows.filter((row) => (row.decision ?? "none") === value).length])),
    reviewedCount: reviewed.length,
    manualFallbackCount: reviewed.filter((row) => row.reviewDecision === "reject" || row.reviewDecision === "recapture").length,
    agreementCount: agreement,
    agreementRate: comparable.length ? Number((agreement / comparable.length).toFixed(4)) : null,
    falsePassCount: reviewed.filter((row) => row.decision === "pass" && row.finalDecision === "fail").length,
    falseFailCount: reviewed.filter((row) => row.decision === "fail" && row.finalDecision === "pass").length,
    retryCount: rows.reduce((sum, row) => sum + row.retryCount, 0),
    latencyMs: { p50: percentile(latencies, 0.5), p95: percentile(latencies, 0.95) },
    usage: {
      inputTokens: rows.reduce((sum, row) => sum + row.inputTokens, 0),
      outputTokens: rows.reduce((sum, row) => sum + row.outputTokens, 0),
      estimatedCostUsdMicros: rows.reduce((sum, row) => sum + row.estimatedCostUsdMicros, 0),
    },
  };
}

function percentile(values: number[], ratio: number) {
  if (!values.length) return null;
  return values[Math.min(values.length - 1, Math.ceil(values.length * ratio) - 1)]!;
}
