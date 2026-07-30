import {
  VISUAL_COMPARISON_PROMPT_POLICY_VERSION,
  VISUAL_COMPARISON_RESULT_SCHEMA_VERSION,
  VISUAL_COMPARISON_RUBRIC_VERSION,
  VISUAL_COMPARISON_DECISIONS,
  VISUAL_COMPARISON_DIMENSION_KEYS,
  VisualComparisonCriteria,
  VisualComparisonDecision,
  VisualComparisonFailure,
} from "./visual-comparison.contract";

export const VISUAL_COMPARISON_SMOKE_VERSION = "hr-axis-qwen-smoke-v1" as const;

export type VisualComparisonSmokePair = {
  id: string;
  referenceFile: string;
  evidenceFile: string;
  referenceSha256: string;
  evidenceSha256: string;
  expectedDecision: VisualComparisonDecision;
};

export type VisualComparisonSmokeManifest = {
  version: typeof VISUAL_COMPARISON_SMOKE_VERSION;
  promptPolicyVersion: typeof VISUAL_COMPARISON_PROMPT_POLICY_VERSION;
  resultSchemaVersion: typeof VISUAL_COMPARISON_RESULT_SCHEMA_VERSION;
  rubricVersion: typeof VISUAL_COMPARISON_RUBRIC_VERSION;
  locale: "tr" | "en";
  criteria: VisualComparisonCriteria[];
  pairs: VisualComparisonSmokePair[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(record: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(record).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function validRelativeImagePath(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 240 &&
    !value.includes("\\") &&
    !value.startsWith("/") &&
    !value.split("/").includes("..") &&
    /\.(?:jpe?g|png|webp)$/i.test(value)
  );
}

export function parseVisualComparisonSmokeManifest(
  value: unknown,
): VisualComparisonSmokeManifest {
  if (
    !isRecord(value) ||
    !exactKeys(value, [
      "version",
      "promptPolicyVersion",
      "resultSchemaVersion",
      "rubricVersion",
      "locale",
      "criteria",
      "pairs",
    ]) ||
    value.version !== VISUAL_COMPARISON_SMOKE_VERSION ||
    value.promptPolicyVersion !== VISUAL_COMPARISON_PROMPT_POLICY_VERSION ||
    value.resultSchemaVersion !== VISUAL_COMPARISON_RESULT_SCHEMA_VERSION ||
    value.rubricVersion !== VISUAL_COMPARISON_RUBRIC_VERSION ||
    (value.locale !== "tr" && value.locale !== "en") ||
    !Array.isArray(value.criteria) ||
    !Array.isArray(value.pairs) ||
    value.pairs.length !== 20
  ) {
    throw new VisualComparisonFailure("invalid_request", "Smoke manifest shape is invalid");
  }

  const criteria = value.criteria.map((criterion, index) => {
    if (
      !isRecord(criterion) ||
      !exactKeys(criterion, ["dimension", "requirement"]) ||
      criterion.dimension !== VISUAL_COMPARISON_DIMENSION_KEYS[index] ||
      typeof criterion.requirement !== "string" ||
      criterion.requirement.length === 0 ||
      criterion.requirement.length > 400
    ) {
      throw new VisualComparisonFailure("invalid_request", "Smoke criteria are invalid");
    }
    return {
      dimension: VISUAL_COMPARISON_DIMENSION_KEYS[index],
      requirement: criterion.requirement,
    };
  });
  if (criteria.length !== VISUAL_COMPARISON_DIMENSION_KEYS.length) {
    throw new VisualComparisonFailure("invalid_request", "Smoke criteria are incomplete");
  }

  const ids = new Set<string>();
  const pairs = value.pairs.map((pair) => {
    if (
      !isRecord(pair) ||
      !exactKeys(pair, [
        "id",
        "referenceFile",
        "evidenceFile",
        "referenceSha256",
        "evidenceSha256",
        "expectedDecision",
      ]) ||
      typeof pair.id !== "string" ||
      !/^[a-z0-9][a-z0-9_-]{0,63}$/i.test(pair.id) ||
      ids.has(pair.id) ||
      !validRelativeImagePath(pair.referenceFile) ||
      !validRelativeImagePath(pair.evidenceFile) ||
      typeof pair.referenceSha256 !== "string" ||
      !/^[a-f0-9]{64}$/.test(pair.referenceSha256) ||
      typeof pair.evidenceSha256 !== "string" ||
      !/^[a-f0-9]{64}$/.test(pair.evidenceSha256) ||
      typeof pair.expectedDecision !== "string" ||
      !VISUAL_COMPARISON_DECISIONS.includes(
        pair.expectedDecision as VisualComparisonDecision,
      )
    ) {
      throw new VisualComparisonFailure("invalid_request", "Smoke pair is invalid");
    }
    ids.add(pair.id);
    return pair as VisualComparisonSmokePair;
  });

  return {
    version: VISUAL_COMPARISON_SMOKE_VERSION,
    promptPolicyVersion: VISUAL_COMPARISON_PROMPT_POLICY_VERSION,
    resultSchemaVersion: VISUAL_COMPARISON_RESULT_SCHEMA_VERSION,
    rubricVersion: VISUAL_COMPARISON_RUBRIC_VERSION,
    locale: value.locale,
    criteria,
    pairs,
  };
}
