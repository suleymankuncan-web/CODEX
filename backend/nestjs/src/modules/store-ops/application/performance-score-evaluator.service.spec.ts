import type { KpiScoreProfile } from "./kpi-config.contract";
import { storeKpiScoreProfile } from "./kpi-config.contract";
import { PerformanceScoreEvaluator } from "./performance-score-evaluator.service";

describe("PerformanceScoreEvaluator", () => {
  const evaluator = new PerformanceScoreEvaluator();

  it("keeps the store checklist fallback score contract", () => {
    const profile: KpiScoreProfile = {
      profileCode: "store",
      title: "Store profile",
      summary: "Golden store score fixture",
      futureMetricRule: "test",
      metrics: [
        {
          code: "TARGET_ACHIEVEMENT",
          label: "Target achievement",
          ownerRole: "STORE_MANAGER",
          weightPercent: 40,
          scoreBehavior: "score_only",
          direction: "HIGHER_IS_BETTER",
          benchmarkSource: "TARGET",
          capRatio: 1.2,
        },
        {
          code: "ATV",
          aliases: ["AOV"],
          label: "ATV",
          ownerRole: "STORE_MANAGER",
          weightPercent: 20,
          scoreBehavior: "score_only",
          direction: "HIGHER_IS_BETTER",
          benchmarkSource: "TURKEY_AVERAGE",
          capRatio: 1.2,
        },
        {
          code: "BM_CHECKLIST",
          label: "BM checklist",
          ownerRole: "REGION_MANAGER",
          weightPercent: 10,
          scoreBehavior: "score_only",
          direction: "HIGHER_IS_BETTER",
          benchmarkSource: "CHECKLIST_SCORE",
          capRatio: 1.2,
        },
        {
          code: "VM_CHECKLIST",
          label: "VM checklist",
          ownerRole: "STORE_MANAGER",
          weightPercent: 10,
          scoreBehavior: "score_only",
          direction: "HIGHER_IS_BETTER",
          benchmarkSource: "CHECKLIST_SCORE",
          capRatio: 1.2,
        },
      ],
    };

    const result = evaluator.evaluate({
      profile,
      benchmarkFallback: "matched-or-canonical",
      useStoreChecklistFallback: true,
      benchmarkLookup: new Map([["ATV", 1000]]),
      values: new Map([
        [
          "TARGET_ACHIEVEMENT",
          {
            label: "Target achievement",
            actualValue: 110,
            targetValue: 100,
          },
        ],
        [
          "AOV",
          {
            label: "Average order value",
            actualValue: 1200,
            targetValue: null,
          },
        ],
        [
          "BM_CHECKLIST",
          {
            label: "BM checklist",
            actualValue: 80,
            targetValue: null,
          },
        ],
      ]),
    });

    expect(result.scoreValue).toBe(76.53);
    expect(result.metrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "TARGET_ACHIEVEMENT",
          contributionValue: 44,
        }),
        expect.objectContaining({
          code: "ATV",
          label: "Average order value",
          benchmarkValue: 1000,
          contributionValue: 16.8,
        }),
        expect.objectContaining({
          code: "BM_CHECKLIST",
          contributionValue: 5.6,
        }),
        expect.objectContaining({
          code: "VM_CHECKLIST",
          contributionValue: null,
        }),
      ]),
    );
  });

  it("keeps ranking and live leaderboard benchmark fallback modes explicit", () => {
    const profile: KpiScoreProfile = {
      profileCode: "personnel",
      title: "Personnel profile",
      summary: "Golden personnel score fixture",
      futureMetricRule: "test",
      metrics: [
        {
          code: "ATV",
          aliases: ["AOV"],
          label: "ATV",
          ownerRole: "STORE_PERSONNEL",
          weightPercent: 50,
          scoreBehavior: "score_only",
          direction: "HIGHER_IS_BETTER",
          benchmarkSource: "TURKEY_AVERAGE",
          capRatio: 1.2,
        },
      ],
    };
    const input = {
      profile,
      benchmarkLookup: new Map([["ATV", 500]]),
      values: new Map([
        [
          "AOV",
          {
            label: "Average order value",
            actualValue: 600,
            targetValue: null,
          },
        ],
      ]),
    };

    expect(
      evaluator.evaluate({
        ...input,
        benchmarkFallback: "matched-only",
        useStoreChecklistFallback: false,
      }).scoreValue,
    ).toBe(0);
    expect(
      evaluator.evaluate({
        ...input,
        benchmarkFallback: "matched-or-canonical",
        useStoreChecklistFallback: false,
      }).scoreValue,
    ).toBe(42);
  });

  it("scores gsm_approval with achievementRate while keeping display percentage", () => {
    const result = evaluator.evaluate({
      profile: storeKpiScoreProfile,
      benchmarkFallback: "matched-or-canonical",
      useStoreChecklistFallback: true,
      benchmarkLookup: new Map([
        ["CR", 0.2],
        ["ATV", 1500],
        ["UPT", 4],
      ]),
      values: new Map([
        [
          "TARGET_ACHIEVEMENT",
          { label: "Target achievement", actualValue: 100, targetValue: 100 },
        ],
        ["CR", { label: "CR", actualValue: 0.2, targetValue: null }],
        ["ATV", { label: "ATV", actualValue: 1500, targetValue: null }],
        ["UPT", { label: "UPT", actualValue: 4, targetValue: null }],
        ["BM_CHECKLIST", { label: "BM checklist", actualValue: 80, targetValue: null }],
        ["VM_CHECKLIST", { label: "VM checklist", actualValue: 100, targetValue: null }],
        [
          "gsm_approval",
          {
            label: "GSM Onayı",
            actualValue: 91.2052,
            scoreValue: 0.912052,
            targetValue: null,
          },
        ],
      ]),
    });

    expect(result.scoreValue).toBe(79.49);
    expect(result.metrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "gsm_approval",
          actualValue: 91.2052,
          contributionValue: 3.1922,
        }),
      ]),
    );
  });

  it("scores legacy GSM_ONAY profile versions with the imported achievement rate", () => {
    const profile: KpiScoreProfile = {
      profileCode: "store",
      title: "Legacy GSM profile",
      summary: "Versioned profile before canonical rename",
      futureMetricRule: "versioned",
      metrics: [
        {
          code: "GSM_ONAY",
          label: "GSM Onay",
          ownerRole: "STORE_MANAGER",
          weightPercent: 100,
          scoreBehavior: "score_only",
          direction: "HIGHER_IS_BETTER",
          benchmarkSource: "TARGET",
          capRatio: 1,
        },
      ],
    };

    const result = evaluator.evaluate({
      profile,
      benchmarkFallback: "matched-or-canonical",
      useStoreChecklistFallback: false,
      benchmarkLookup: new Map(),
      values: new Map([
        [
          "GSM_ONAY",
          {
            label: "GSM Onay",
            actualValue: 91.2052,
            scoreValue: 0.912052,
            targetValue: null,
          },
        ],
      ]),
    });

    expect(result.scoreValue).toBe(63.84);
    expect(result.metrics[0]).toEqual(
      expect.objectContaining({
        code: "GSM_ONAY",
        actualValue: 91.2052,
        contributionValue: 63.8436,
      }),
    );
  });

  it("keeps missing gsm_approval visible without inventing score contribution", () => {
    const result = evaluator.evaluate({
      profile: storeKpiScoreProfile,
      benchmarkFallback: "matched-or-canonical",
      useStoreChecklistFallback: true,
      benchmarkLookup: new Map([
        ["CR", 0.2],
        ["ATV", 1500],
        ["UPT", 4],
      ]),
      values: new Map([
        [
          "TARGET_ACHIEVEMENT",
          { label: "Target achievement", actualValue: 100, targetValue: 100 },
        ],
        ["CR", { label: "CR", actualValue: 0.2, targetValue: null }],
        ["ATV", { label: "ATV", actualValue: 1500, targetValue: null }],
        ["UPT", { label: "UPT", actualValue: 4, targetValue: null }],
        ["BM_CHECKLIST", { label: "BM checklist", actualValue: 80, targetValue: null }],
        ["VM_CHECKLIST", { label: "VM checklist", actualValue: 100, targetValue: null }],
      ]),
    });

    expect(result.metrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "gsm_approval",
          actualValue: null,
          contributionValue: null,
        }),
      ]),
    );
  });
});
