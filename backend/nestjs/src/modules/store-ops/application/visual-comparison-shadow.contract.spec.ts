import {
  buildShadowCriteria,
  buildShadowIdempotencyKey,
  isRetryableVisualComparisonFailure,
} from "./visual-comparison-shadow.contract";

describe("visual comparison shadow contract", () => {
  it("builds stable work identity and six bounded criteria", () => {
    const input = {
      companyId: "company-1",
      assignmentId: "assignment-1",
      visualReferenceItemId: "item-1",
      evidenceSha256: "a".repeat(64),
      referenceSha256: "b".repeat(64),
      rubricVersion: "rubric-v1",
      promptVersion: "prompt-v1",
      policyVersion: "policy-v1",
    };
    expect(buildShadowIdempotencyKey(input)).toBe(buildShadowIdempotencyKey(input));
    expect(buildShadowIdempotencyKey({ ...input, evidenceSha256: "c".repeat(64) }))
      .not.toBe(buildShadowIdempotencyKey(input));
    const criteria = buildShadowCriteria({
      expectedVisualIntent: "Approved fixture layout.",
      reviewInstructions: "Compare only visible store presentation.",
    });
    expect(criteria).toHaveLength(6);
    expect(criteria.every((criterion) => criterion.requirement.length <= 400)).toBe(true);
  });

  it("retries only transient provider transport failures", () => {
    expect(isRetryableVisualComparisonFailure("provider_timeout")).toBe(true);
    expect(isRetryableVisualComparisonFailure("provider_unavailable")).toBe(true);
    expect(isRetryableVisualComparisonFailure("invalid_provider_response")).toBe(false);
    expect(isRetryableVisualComparisonFailure("budget_exhausted")).toBe(false);
    expect(isRetryableVisualComparisonFailure("model_identity_mismatch")).toBe(false);
  });
});
