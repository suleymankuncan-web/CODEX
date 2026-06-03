import { isChecklistScoreNonCompliant } from "./checklist-low-score-policy";

describe("isChecklistScoreNonCompliant", () => {
  it("marks actual scores at or below the configured low threshold as non-compliant", () => {
    expect(
      isChecklistScoreNonCompliant({
        expectedValue: JSON.stringify({ lowScoreThreshold: 6 }),
        scoreValue: 6,
      }),
    ).toBe(true);
  });

  it("does not treat missing scores as zero", () => {
    expect(
      isChecklistScoreNonCompliant({
        expectedValue: JSON.stringify({ lowScoreThreshold: 6 }),
        scoreValue: null,
      }),
    ).toBe(false);
  });

  it("does not mark scores non-compliant when no threshold exists", () => {
    expect(
      isChecklistScoreNonCompliant({
        expectedValue: null,
        scoreValue: 0,
      }),
    ).toBe(false);
  });
});
