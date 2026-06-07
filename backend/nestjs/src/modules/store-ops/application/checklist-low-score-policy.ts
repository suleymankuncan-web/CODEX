type ChecklistExpectedValuePolicy = {
  lowScoreThreshold: number | null;
};

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

  const policy = parseChecklistExpectedValuePolicy(input.expectedValue);
  if (policy.lowScoreThreshold === null) {
    return false;
  }

  return scoreValue <= policy.lowScoreThreshold;
}

function parseChecklistExpectedValuePolicy(
  expectedValue: unknown,
): ChecklistExpectedValuePolicy {
  if (!expectedValue) {
    return { lowScoreThreshold: null };
  }

  try {
    const parsed =
      typeof expectedValue === "string"
        ? (JSON.parse(expectedValue) as { lowScoreThreshold?: unknown })
        : expectedValue;

    if (
      !parsed ||
      typeof parsed !== "object" ||
      !("lowScoreThreshold" in parsed)
    ) {
      return { lowScoreThreshold: null };
    }

    const lowScoreThreshold = Number(parsed.lowScoreThreshold);
    if (!Number.isFinite(lowScoreThreshold) || lowScoreThreshold < 0) {
      return { lowScoreThreshold: null };
    }

    return { lowScoreThreshold };
  } catch {
    return { lowScoreThreshold: null };
  }
}
