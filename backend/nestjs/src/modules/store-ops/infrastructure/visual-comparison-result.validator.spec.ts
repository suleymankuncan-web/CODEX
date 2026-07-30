import {
  VISUAL_COMPARISON_DIMENSION_KEYS,
  VisualComparisonFailure,
} from "../application/visual-comparison.contract";
import { parseVisualComparisonResultJson } from "./visual-comparison-result.validator";

function validResult() {
  return {
    decision: "pass",
    dimensions: VISUAL_COMPARISON_DIMENSION_KEYS.map((key) => ({
      key,
      score: 92,
      confidence: 0.91,
      reasonCode: "aligned",
      explanation: "The store evidence follows the approved criterion.",
    })),
    overallConfidence: 0.91,
    qualityFlags: [],
    modelLimitations: [],
  };
}

describe("parseVisualComparisonResultJson", () => {
  it("accepts the exact provider-neutral result shape", () => {
    expect(parseVisualComparisonResultJson(JSON.stringify(validResult()))).toEqual(
      validResult(),
    );
  });

  it.each([
    ["invalid JSON", "not-json"],
    ["unknown root field", JSON.stringify({ ...validResult(), extra: true })],
    [
      "wrong dimension order",
      JSON.stringify({
        ...validResult(),
        dimensions: [...validResult().dimensions].reverse(),
      }),
    ],
    [
      "invalid confidence precision",
      JSON.stringify({ ...validResult(), overallConfidence: 0.911 }),
    ],
    [
      "duplicate quality flag",
      JSON.stringify({ ...validResult(), qualityFlags: ["blur", "blur"] }),
    ],
    [
      "URL in explanation",
      JSON.stringify({
        ...validResult(),
        dimensions: validResult().dimensions.map((dimension, index) =>
          index === 0 ? { ...dimension, explanation: "See https://example.com" } : dimension,
        ),
      }),
    ],
    [
      "pass with a material mismatch",
      JSON.stringify({
        ...validResult(),
        dimensions: validResult().dimensions.map((dimension, index) =>
          index === 0 ? { ...dimension, reasonCode: "material_mismatch" } : dimension,
        ),
      }),
    ],
    [
      "pass with an instruction-like quality flag",
      JSON.stringify({ ...validResult(), qualityFlags: ["instruction_like_text"] }),
    ],
    [
      "null score without abstaining",
      JSON.stringify({
        ...validResult(),
        dimensions: validResult().dimensions.map((dimension, index) =>
          index === 0 ? { ...dimension, score: null } : dimension,
        ),
      }),
    ],
  ])("fails closed for %s", (_name, content) => {
    expect(() => parseVisualComparisonResultJson(content)).toThrow(
      expect.objectContaining<Partial<VisualComparisonFailure>>({
        code: "invalid_provider_response",
      }),
    );
  });
});
