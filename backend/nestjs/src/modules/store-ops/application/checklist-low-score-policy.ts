import { parseChecklistScorePolicy } from "./checklist-score-policy";

export function isChecklistScoreNonCompliant(input: {
  expectedValue?: unknown;
  scoreValue?: number | null;
}) {
  if (input.scoreValue === null || input.scoreValue === undefined) {
    return false;
  }

  const scoreValue = Number(input.scoreValue);
  if (!Number.isFinite(scoreValue)) {
    return false;
  }

  const policy = parseChecklistScorePolicy(input.expectedValue);
  if (policy.lowScoreThreshold === null) {
    return false;
  }

  return scoreValue <= policy.lowScoreThreshold;
}
