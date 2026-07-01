import { isChecklistScoreNonCompliant } from "./checklist-low-score-policy";
import { parseChecklistScorePolicy } from "./checklist-score-policy";

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

describe("parseChecklistScorePolicy", () => {
  it("normalizes template score policy fields from expected value", () => {
    expect(
      parseChecklistScorePolicy(
        JSON.stringify({
          lowScoreThreshold: 2,
          minScore: 1,
          requiresLowScoreNote: true,
        }),
      ),
    ).toEqual({
      lowScoreThreshold: 2,
      minScore: 1,
      requiresLowScoreNote: true,
    });
  });

  it("falls back safely when expected value is missing or malformed", () => {
    expect(parseChecklistScorePolicy("{")).toEqual({
      lowScoreThreshold: null,
      minScore: null,
      requiresLowScoreNote: false,
    });
  });
});
