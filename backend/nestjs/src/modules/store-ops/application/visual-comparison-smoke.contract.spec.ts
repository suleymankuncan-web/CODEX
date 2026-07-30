import {
  VISUAL_COMPARISON_DIMENSION_KEYS,
  VISUAL_COMPARISON_PROMPT_POLICY_VERSION,
  VISUAL_COMPARISON_RESULT_SCHEMA_VERSION,
  VISUAL_COMPARISON_RUBRIC_VERSION,
} from "./visual-comparison.contract";
import {
  VISUAL_COMPARISON_SMOKE_VERSION,
  parseVisualComparisonSmokeManifest,
} from "./visual-comparison-smoke.contract";

function manifest() {
  return {
    version: VISUAL_COMPARISON_SMOKE_VERSION,
    promptPolicyVersion: VISUAL_COMPARISON_PROMPT_POLICY_VERSION,
    resultSchemaVersion: VISUAL_COMPARISON_RESULT_SCHEMA_VERSION,
    rubricVersion: VISUAL_COMPARISON_RUBRIC_VERSION,
    locale: "tr",
    criteria: VISUAL_COMPARISON_DIMENSION_KEYS.map((dimension) => ({
      dimension,
      requirement: `Apply ${dimension}.`,
    })),
    pairs: Array.from({ length: 20 }, (_, index) => ({
      id: `pair-${String(index + 1).padStart(2, "0")}`,
      referenceFile: `references/${index + 1}.webp`,
      evidenceFile: `evidence/${index + 1}.webp`,
      referenceSha256: "a".repeat(64),
      evidenceSha256: "b".repeat(64),
      expectedDecision: "pass",
    })),
  };
}

describe("parseVisualComparisonSmokeManifest", () => {
  it("accepts exactly 20 frozen synthetic pairs", () => {
    expect(parseVisualComparisonSmokeManifest(manifest()).pairs).toHaveLength(20);
  });

  it("rejects a smaller dataset", () => {
    expect(() =>
      parseVisualComparisonSmokeManifest({ ...manifest(), pairs: manifest().pairs.slice(0, 19) }),
    ).toThrow(expect.objectContaining({ code: "invalid_request" }));
  });

  it("rejects duplicate identities and path traversal", () => {
    const duplicate = manifest();
    duplicate.pairs[1].id = duplicate.pairs[0].id;
    expect(() => parseVisualComparisonSmokeManifest(duplicate)).toThrow(
      expect.objectContaining({ code: "invalid_request" }),
    );

    const traversal = manifest();
    traversal.pairs[0].referenceFile = "../secret.webp";
    expect(() => parseVisualComparisonSmokeManifest(traversal)).toThrow(
      expect.objectContaining({ code: "invalid_request" }),
    );
  });
});
