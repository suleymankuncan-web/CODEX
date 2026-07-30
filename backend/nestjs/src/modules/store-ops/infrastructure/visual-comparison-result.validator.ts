import {
  VISUAL_COMPARISON_DECISIONS,
  VISUAL_COMPARISON_DIMENSION_KEYS,
  VISUAL_COMPARISON_MODEL_LIMITATIONS,
  VISUAL_COMPARISON_QUALITY_FLAGS,
  VISUAL_COMPARISON_REASON_CODES,
  VisualComparisonFailure,
  VisualComparisonResult,
} from "../application/visual-comparison.contract";

const RESULT_KEYS = [
  "decision",
  "dimensions",
  "overallConfidence",
  "qualityFlags",
  "modelLimitations",
] as const;
const DIMENSION_KEYS = ["key", "score", "confidence", "reasonCode", "explanation"] as const;
const INSUFFICIENT_REASON_CODES = new Set([
  "visibility_occluded",
  "image_quality_insufficient",
  "reference_variant_unsupported",
  "comparison_ambiguous",
  "instruction_text_ignored",
]);
const PASS_BLOCKING_QUALITY_FLAGS = new Set([
  "framing_incomplete",
  "resolution_insufficient",
  "instruction_like_text",
  "unsupported_layout",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  return actual.length === expected.length &&
    actual.every((key, index) => key === [...expected].sort()[index]);
}

function isHundredth(value: number): boolean {
  return Number.isFinite(value) && Math.abs(value * 100 - Math.round(value * 100)) < 1e-9;
}

function isEnumValue<T extends readonly string[]>(values: T, value: unknown): value is T[number] {
  return typeof value === "string" && values.includes(value as T[number]);
}

function assertUniqueEnumArray<T extends readonly string[]>(
  value: unknown,
  allowed: T,
  field: string,
): asserts value is T[number][] {
  if (
    !Array.isArray(value) ||
    value.some((item) => !isEnumValue(allowed, item)) ||
    new Set(value).size !== value.length
  ) {
    throw new VisualComparisonFailure(
      "invalid_provider_response",
      `Provider ${field} is invalid`,
    );
  }
}

export function parseVisualComparisonResultJson(content: string): VisualComparisonResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new VisualComparisonFailure(
      "invalid_provider_response",
      "Provider result is not valid JSON",
    );
  }

  if (!isRecord(parsed) || !hasExactKeys(parsed, RESULT_KEYS)) {
    throw new VisualComparisonFailure(
      "invalid_provider_response",
      "Provider result has an invalid object shape",
    );
  }
  if (!isEnumValue(VISUAL_COMPARISON_DECISIONS, parsed.decision)) {
    throw new VisualComparisonFailure(
      "invalid_provider_response",
      "Provider decision is invalid",
    );
  }
  if (
    typeof parsed.overallConfidence !== "number" ||
    parsed.overallConfidence < 0 ||
    parsed.overallConfidence > 1 ||
    !isHundredth(parsed.overallConfidence)
  ) {
    throw new VisualComparisonFailure(
      "invalid_provider_response",
      "Provider overall confidence is invalid",
    );
  }
  if (
    !Array.isArray(parsed.dimensions) ||
    parsed.dimensions.length !== VISUAL_COMPARISON_DIMENSION_KEYS.length
  ) {
    throw new VisualComparisonFailure(
      "invalid_provider_response",
      "Provider dimensions are incomplete",
    );
  }

  const dimensions = parsed.dimensions.map((value, index) => {
    if (!isRecord(value) || !hasExactKeys(value, DIMENSION_KEYS)) {
      throw new VisualComparisonFailure(
        "invalid_provider_response",
        "Provider dimension shape is invalid",
      );
    }
    if (value.key !== VISUAL_COMPARISON_DIMENSION_KEYS[index]) {
      throw new VisualComparisonFailure(
        "invalid_provider_response",
        "Provider dimension order is invalid",
      );
    }
    if (
      value.score !== null &&
      (typeof value.score !== "number" ||
        !Number.isInteger(value.score) ||
        value.score < 0 ||
        value.score > 100)
    ) {
      throw new VisualComparisonFailure(
        "invalid_provider_response",
        "Provider dimension score is invalid",
      );
    }
    if (
      typeof value.confidence !== "number" ||
      value.confidence < 0 ||
      value.confidence > 1 ||
      !isHundredth(value.confidence)
    ) {
      throw new VisualComparisonFailure(
        "invalid_provider_response",
        "Provider dimension confidence is invalid",
      );
    }
    if (!isEnumValue(VISUAL_COMPARISON_REASON_CODES, value.reasonCode)) {
      throw new VisualComparisonFailure(
        "invalid_provider_response",
        "Provider reason code is invalid",
      );
    }
    if (
      typeof value.explanation !== "string" ||
      value.explanation.length > 180 ||
      /[\r\n]/.test(value.explanation) ||
      /https?:\/\//i.test(value.explanation)
    ) {
      throw new VisualComparisonFailure(
        "invalid_provider_response",
        "Provider explanation is invalid",
      );
    }
    return {
      key: VISUAL_COMPARISON_DIMENSION_KEYS[index],
      score: value.score,
      confidence: value.confidence,
      reasonCode: value.reasonCode,
      explanation: value.explanation,
    };
  });

  assertUniqueEnumArray(parsed.qualityFlags, VISUAL_COMPARISON_QUALITY_FLAGS, "quality flags");
  assertUniqueEnumArray(
    parsed.modelLimitations,
    VISUAL_COMPARISON_MODEL_LIMITATIONS,
    "model limitations",
  );

  const uncertainDecision =
    parsed.decision === "abstain" || parsed.decision === "recapture_required";
  if (dimensions.some((dimension) => dimension.score === null) && !uncertainDecision) {
    throw new VisualComparisonFailure(
      "invalid_provider_response",
      "Provider null scores require abstain or recapture",
    );
  }
  if (
    dimensions.some((dimension) => INSUFFICIENT_REASON_CODES.has(dimension.reasonCode)) &&
    !uncertainDecision
  ) {
    throw new VisualComparisonFailure(
      "invalid_provider_response",
      "Provider insufficient evidence requires abstain or recapture",
    );
  }
  if (
    parsed.decision === "pass" &&
    (dimensions.some(
      (dimension) => dimension.reasonCode !== "aligned" && dimension.reasonCode !== "minor_variance",
    ) ||
      parsed.qualityFlags.some((flag) => PASS_BLOCKING_QUALITY_FLAGS.has(flag)))
  ) {
    throw new VisualComparisonFailure(
      "invalid_provider_response",
      "Provider pass conflicts with reported mismatches or quality flags",
    );
  }

  return {
    decision: parsed.decision,
    dimensions,
    overallConfidence: parsed.overallConfidence,
    qualityFlags: parsed.qualityFlags,
    modelLimitations: parsed.modelLimitations,
  };
}
