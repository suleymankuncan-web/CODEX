import {
  evaluateCompanyDailyKpiDailyClosure,
  type CompanyDailyKpiDailyClosureInput,
} from "./company-daily-kpi-daily-closure";

const sourceCode = "source-A";
const businessDate = "2026-08-30" as const;
const postgresIntegerMax = 2_147_483_647;

const succeeded = (operation: "sales" | "footfall" | "gsm") => ({
  operation,
  sourceCode,
  businessDate,
  status: "succeeded" as const,
  aggregateCount: 0,
  retryCount: 0,
  sanitizedSetDigest: `${
    operation === "sales" ? "a" : operation === "footfall" ? "b" : "c"
  }${"a".repeat(63)}`,
});

const failed = (operation: "sales" | "footfall" | "gsm", status: "failed" | "missed" = "failed") => ({
  operation,
  sourceCode,
  businessDate,
  status,
  aggregateCount: 0,
  retryCount: 1,
  safeReasonCode: "component_unavailable",
});

const completeInput = (): CompanyDailyKpiDailyClosureInput => ({
  sourceCode,
  businessDate,
  outcomes: [succeeded("sales"), succeeded("footfall"), succeeded("gsm")],
});

describe("company daily KPI daily closure", () => {
  it("marks all three succeeded components as completed", () => {
    expect(evaluateCompanyDailyKpiDailyClosure(completeInput())).toEqual({
      sourceCode,
      businessDate,
      closureStatus: "completed",
      components: [succeeded("sales"), succeeded("footfall"), succeeded("gsm")],
      missingOperations: [],
    });
  });

  it.each([
    ["sales", "failed"],
    ["footfall", "failed"],
    ["gsm", "failed"],
    ["sales", "missed"],
    ["footfall", "missed"],
    ["gsm", "missed"],
  ] as const)(
    "marks a %s component with %s status as incomplete without calling it absent",
    (missingOperation, status) => {
      const outcomes = [
        succeeded("sales"),
        succeeded("footfall"),
        succeeded("gsm"),
      ].map((outcome) =>
        outcome.operation === missingOperation
          ? failed(missingOperation, status)
          : outcome,
      );

      expect(
        evaluateCompanyDailyKpiDailyClosure({
          sourceCode,
          businessDate,
          outcomes,
        }),
      ).toEqual({
        sourceCode,
        businessDate,
        closureStatus: "incomplete",
        components: [
          missingOperation === "sales"
            ? failed("sales", status)
            : succeeded("sales"),
          missingOperation === "footfall"
            ? failed("footfall", status)
            : succeeded("footfall"),
          missingOperation === "gsm"
            ? failed("gsm", status)
            : succeeded("gsm"),
        ],
        missingOperations: [],
      });
    },
  );

  it.each(["sales", "footfall", "gsm"] as const)(
    "does not synthesize metadata when %s is absent",
    (missingOperation) => {
      const outcomes = completeInput().outcomes.filter(
        (outcome) => outcome.operation !== missingOperation,
      );
      const result = evaluateCompanyDailyKpiDailyClosure({
        sourceCode,
        businessDate,
        outcomes,
      });

      expect(result.closureStatus).toBe("incomplete");
      expect(result.components).toEqual(outcomes);
      expect(result.missingOperations).toEqual([missingOperation]);
    },
  );

  it("keeps supplied metadata and missing operations in fixed order", () => {
    const input = completeInput();
    const shuffled = evaluateCompanyDailyKpiDailyClosure({
      ...input,
      outcomes: [input.outcomes[2]!, input.outcomes[0]!, input.outcomes[1]!],
    });

    expect(shuffled).toEqual(evaluateCompanyDailyKpiDailyClosure(input));
    expect(JSON.stringify(shuffled)).toBe(
      JSON.stringify(evaluateCompanyDailyKpiDailyClosure(input)),
    );
  });

  it("keeps multiple absent operations in fixed order", () => {
    expect(
      evaluateCompanyDailyKpiDailyClosure({
        sourceCode,
        businessDate,
        outcomes: [],
      }).missingOperations,
    ).toEqual(["sales", "footfall", "gsm"]);
    expect(
      evaluateCompanyDailyKpiDailyClosure({
        sourceCode,
        businessDate,
        outcomes: [succeeded("gsm")],
      }).missingOperations,
    ).toEqual(["sales", "footfall"]);
  });

  it("rejects a non-calendar business date", () => {
    expect(() =>
      evaluateCompanyDailyKpiDailyClosure({
        ...completeInput(),
        businessDate: "2026-02-30",
      } as never),
    ).toThrow(TypeError);
  });

  it("rejects a component outcome from another source", () => {
    const outcomes = completeInput().outcomes.map((outcome) =>
      outcome.operation === "sales"
        ? { ...outcome, sourceCode: "source-B" }
        : outcome,
    );

    expect(() =>
      evaluateCompanyDailyKpiDailyClosure({
        sourceCode,
        businessDate,
        outcomes,
      } as never),
    ).toThrow(TypeError);
  });

  it("rejects a component outcome from another business date", () => {
    const outcomes = completeInput().outcomes.map((outcome) =>
      outcome.operation === "sales"
        ? { ...outcome, businessDate: "2026-08-29" }
        : outcome,
    );

    expect(() =>
      evaluateCompanyDailyKpiDailyClosure({
        sourceCode,
        businessDate,
        outcomes,
      } as never),
    ).toThrow(TypeError);
  });

  it("rejects duplicate component outcomes", () => {
    expect(() =>
      evaluateCompanyDailyKpiDailyClosure({
        ...completeInput(),
        outcomes: [...completeInput().outcomes, succeeded("sales")],
      }),
    ).toThrow(TypeError);
  });

  it.each(["store-directory", "unknown"])(
    "rejects an unsupported %s operation outcome",
    (operation) => {
      const outcomes = [
        ...completeInput().outcomes,
        {
          ...succeeded("sales"),
          operation,
        },
      ];

      expect(() =>
        evaluateCompanyDailyKpiDailyClosure({
          sourceCode,
          businessDate,
          outcomes,
        } as never),
      ).toThrow(TypeError);
    },
  );

  it("rejects an unsupported component status", () => {
    const outcomes = completeInput().outcomes.map((outcome) =>
      outcome.operation === "sales"
        ? { ...outcome, status: "pending" }
        : outcome,
    );

    expect(() =>
      evaluateCompanyDailyKpiDailyClosure({
        sourceCode,
        businessDate,
        outcomes,
      } as never),
    ).toThrow(TypeError);
  });

  it("rejects negative aggregate counts", () => {
    const outcomes = completeInput().outcomes.map((outcome) =>
      outcome.operation === "sales"
        ? { ...outcome, aggregateCount: -1 }
        : outcome,
    );

    expect(() =>
      evaluateCompanyDailyKpiDailyClosure({
        sourceCode,
        businessDate,
        outcomes,
      } as never),
    ).toThrow(TypeError);
  });

  it("rejects unsafe retry counts", () => {
    const outcomes = completeInput().outcomes.map((outcome) =>
      outcome.operation === "sales"
        ? { ...outcome, retryCount: Number.MAX_SAFE_INTEGER + 1 }
        : outcome,
    );

    expect(() =>
      evaluateCompanyDailyKpiDailyClosure({
        sourceCode,
        businessDate,
        outcomes,
      } as never),
    ).toThrow(TypeError);
  });

  it("accepts the persisted integer maximum for aggregate and retry counts", () => {
    const outcomes = completeInput().outcomes.map((outcome) =>
      outcome.operation === "sales"
        ? {
            ...outcome,
            aggregateCount: postgresIntegerMax,
            retryCount: postgresIntegerMax,
          }
        : outcome,
    );

    expect(
      evaluateCompanyDailyKpiDailyClosure({
        sourceCode,
        businessDate,
        outcomes,
      }).closureStatus,
    ).toBe("completed");
  });

  it.each(["aggregateCount", "retryCount"] as const)(
    "rejects %s above the persisted integer maximum",
    (field) => {
      const outcomes = completeInput().outcomes.map((outcome) =>
        outcome.operation === "sales"
          ? { ...outcome, [field]: postgresIntegerMax + 1 }
          : outcome,
      );

      expect(() =>
        evaluateCompanyDailyKpiDailyClosure({
          sourceCode,
          businessDate,
          outcomes,
        } as never),
      ).toThrow(TypeError);
    },
  );

  it("rejects safe reason codes outside the bounded syntax", () => {
    const outcomes = completeInput().outcomes.map((outcome) =>
      outcome.operation === "sales"
        ? { ...outcome, safeReasonCode: "Unsafe reason" }
        : outcome,
    );

    expect(() =>
      evaluateCompanyDailyKpiDailyClosure({
        sourceCode,
        businessDate,
        outcomes,
      } as never),
    ).toThrow(TypeError);
  });

  it("rejects malformed sanitized set digests", () => {
    const outcomes = completeInput().outcomes.map((outcome) =>
      outcome.operation === "sales"
        ? { ...outcome, sanitizedSetDigest: "not-a-sha256-digest" }
        : outcome,
    );

    expect(() =>
      evaluateCompanyDailyKpiDailyClosure({
        sourceCode,
        businessDate,
        outcomes,
      } as never),
    ).toThrow(TypeError);
  });

  it("requires a digest for a succeeded component", () => {
    const outcomes = completeInput().outcomes.map((outcome) =>
      outcome.operation === "sales"
        ? (() => {
            const { sanitizedSetDigest: _digest, ...withoutDigest } = outcome;
            return withoutDigest;
          })()
        : outcome,
    );

    expect(() =>
      evaluateCompanyDailyKpiDailyClosure({
        sourceCode,
        businessDate,
        outcomes,
      } as never),
    ).toThrow(TypeError);
  });

  it("allows a safe reason on a succeeded component", () => {
    const outcomes = completeInput().outcomes.map((outcome) =>
      outcome.operation === "sales"
        ? { ...outcome, safeReasonCode: "accepted_with_warning" }
        : outcome,
    );

    expect(
      evaluateCompanyDailyKpiDailyClosure({
        sourceCode,
        businessDate,
        outcomes,
      }).components[0],
    ).toEqual({
      ...succeeded("sales"),
      safeReasonCode: "accepted_with_warning",
    });
  });

  it.each([
    ["failed", "nonzero aggregate count", { aggregateCount: 1, sanitizedSetDigest: undefined }],
    ["missed", "nonzero aggregate count", { aggregateCount: 1, sanitizedSetDigest: undefined }],
    ["failed", "digest", { aggregateCount: 0, sanitizedSetDigest: "d".repeat(64) }],
    ["missed", "digest", { aggregateCount: 0, sanitizedSetDigest: "d".repeat(64) }],
  ] as const)(
    "rejects a %s component with a %s",
    (status, _invalidShape, invalidFields) => {
      const outcomes = completeInput().outcomes.map((outcome) =>
        outcome.operation === "sales"
          ? { ...outcome, status, ...invalidFields }
          : outcome,
      );

      expect(() =>
        evaluateCompanyDailyKpiDailyClosure({
          sourceCode,
          businessDate,
          outcomes,
        } as never),
      ).toThrow(TypeError);
    },
  );

  it("projects only safe component metadata and drops aggregate or private fields", () => {
    const input = completeInput();
    const noisyOutcomes = input.outcomes.map((outcome) =>
      outcome.operation === "sales"
        ? {
            ...outcome,
            aggregates: [{ invoiceId: "invoice-A", amount: 10 }],
            componentOutcomeId: "outcome-A",
            providerEndpoint: "https://private.invalid",
            updatedAt: "2026-08-30T01:00:00.000Z",
          }
        : outcome,
    );

    const result = evaluateCompanyDailyKpiDailyClosure({
      ...input,
      outcomes: noisyOutcomes,
    } as never);

    expect(result.components[0]).toEqual(succeeded("sales"));
    expect(JSON.stringify(result)).not.toMatch(
      /invoice-A|outcome-A|private\.invalid|updatedAt|aggregates/i,
    );
  });

  it("rejects accessor-backed top-level input fields", () => {
    const input = {
      sourceCode,
      businessDate,
      get outcomes() {
        return completeInput().outcomes;
      },
    };

    expect(() => evaluateCompanyDailyKpiDailyClosure(input)).toThrow(TypeError);
  });

  it.each(["status", "safeReasonCode"] as const)(
    "rejects accessor-backed %s metadata instead of rereading it",
    (field) => {
      const sales = { ...succeeded("sales") } as Record<string, unknown>;
      Object.defineProperty(sales, field, {
        enumerable: true,
        get: () => (field === "status" ? "succeeded" : "accepted_with_warning"),
      });

      expect(() =>
        evaluateCompanyDailyKpiDailyClosure({
          sourceCode,
          businessDate,
          outcomes: [sales, succeeded("footfall"), succeeded("gsm")],
        } as never),
      ).toThrow(TypeError);
    },
  );

  it("does not allow a caller-owned array method to manufacture outcomes", () => {
    const outcomes: CompanyDailyKpiDailyClosureInput["outcomes"] & {
      map: () => CompanyDailyKpiDailyClosureInput["outcomes"];
    } = [] as never;
    Object.defineProperty(outcomes, "map", {
      value: () => completeInput().outcomes,
    });

    expect(
      evaluateCompanyDailyKpiDailyClosure({
        sourceCode,
        businessDate,
        outcomes,
      }),
    ).toEqual({
      sourceCode,
      businessDate,
      closureStatus: "incomplete",
      components: [],
      missingOperations: ["sales", "footfall", "gsm"],
    });
  });

  it("does not mutate the supplied input", () => {
    const input = completeInput();
    const before = structuredClone(input);

    evaluateCompanyDailyKpiDailyClosure(input);

    expect(input).toEqual(before);
  });
});
