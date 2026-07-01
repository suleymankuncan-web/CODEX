export type ChecklistScorePolicy = {
  lowScoreThreshold: number | null;
  minScore: number | null;
  requiresLowScoreNote: boolean;
};

export function parseChecklistScorePolicy(
  expectedValue: unknown,
): ChecklistScorePolicy {
  if (!expectedValue) {
    return {
      lowScoreThreshold: null,
      minScore: null,
      requiresLowScoreNote: false,
    };
  }

  try {
    const parsed =
      typeof expectedValue === "string"
        ? (JSON.parse(expectedValue) as Record<string, unknown>)
        : (expectedValue as Record<string, unknown>);

    if (!parsed || typeof parsed !== "object") {
      return {
        lowScoreThreshold: null,
        minScore: null,
        requiresLowScoreNote: false,
      };
    }

    const lowScoreThreshold = Number(parsed.lowScoreThreshold);
    const minScore = Number(parsed.minScore);

    return {
      lowScoreThreshold:
        Number.isFinite(lowScoreThreshold) && lowScoreThreshold >= 0
          ? lowScoreThreshold
          : null,
      minScore: Number.isFinite(minScore) && minScore >= 0 ? minScore : null,
      requiresLowScoreNote: parsed.requiresLowScoreNote === true,
    };
  } catch {
    return {
      lowScoreThreshold: null,
      minScore: null,
      requiresLowScoreNote: false,
    };
  }
}
