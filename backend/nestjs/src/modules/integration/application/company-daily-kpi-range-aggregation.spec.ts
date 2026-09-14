import {
  aggregateCompanyDailyKpiStoreRange,
  type CompanyDailyKpiStoreRangeComponentSet,
  type CompanyDailyKpiStoreRangeProjection,
} from "./company-daily-kpi-range-aggregation";
import {
  type StoreFootfallDailyAggregate,
  type StoreGsmDailyAggregate,
  type StoreSalesDailyAggregate,
} from "./company-daily-kpi-pure-adapter";

const set = <
  TAggregate,
  TOperation extends "sales" | "footfall" | "gsm",
>(
  operation: TOperation,
  businessDate: string,
  aggregates: readonly TAggregate[],
): CompanyDailyKpiStoreRangeComponentSet<TAggregate, TOperation> => ({
  operation,
  businessDate,
  status: "succeeded",
  aggregates: [...aggregates],
  projectionAggregateCount: aggregates.length,
});

const sales = (
  businessDate: string,
  storeCode: string,
  saleInvoiceCount: number,
  returnInvoiceCount = 0,
): StoreSalesDailyAggregate => ({
  businessDate,
  storeCode,
  saleInvoiceCount,
  returnInvoiceCount,
  saleQuantity: "0",
  signedReturnQuantity: "0",
  netQuantity: "0",
  saleAmountTry: "0",
  signedReturnAmountTry: "0",
  netAmountTry: "0",
});

const footfall = (
  businessDate: string,
  storeCode: string,
  total: number,
): StoreFootfallDailyAggregate => ({
  businessDate,
  storeCode,
  footfall: total,
});

const gsm = (
  businessDate: string,
  storeCode: string,
  yesCustomerCount: number,
  totalCustomerCount: number,
): StoreGsmDailyAggregate => ({
  businessDate,
  storeCode,
  yesCustomerCount,
  totalCustomerCount,
});

type ComponentOperation = "sales" | "footfall" | "gsm";
type AggregateForOperation<TOperation extends ComponentOperation> =
  TOperation extends "sales"
    ? StoreSalesDailyAggregate
    : TOperation extends "footfall"
      ? StoreFootfallDailyAggregate
      : StoreGsmDailyAggregate;

const failed = <TOperation extends ComponentOperation>(
  operation: TOperation,
  businessDate: string,
  status: "failed" | "missed" = "failed",
): CompanyDailyKpiStoreRangeComponentSet<
  AggregateForOperation<TOperation>,
  TOperation
> => ({
  operation,
  businessDate,
  status,
  aggregates: [],
  projectionAggregateCount: 0,
});

const input = (
  overrides: Partial<CompanyDailyKpiStoreRangeProjection> = {},
): CompanyDailyKpiStoreRangeProjection => ({
  sourceCode: "source-A",
  startDate: "2026-08-30",
  endDate: "2026-08-30",
  storeCodes: ["store-A"],
  componentSets: {
    sales: [set("sales", "2026-08-30", [sales("2026-08-30", "store-A", 2)])],
    footfall: [
      set("footfall", "2026-08-30", [footfall("2026-08-30", "store-A", 10)]),
    ],
    gsm: [set("gsm", "2026-08-30", [gsm("2026-08-30", "store-A", 3, 5)])],
  },
  ...overrides,
});

const expectInvalid = (candidate: unknown): void => {
  expect(() =>
    aggregateCompanyDailyKpiStoreRange(
      candidate as CompanyDailyKpiStoreRangeProjection,
    ),
  ).toThrow(TypeError);
};

describe("company daily KPI store range aggregation", () => {
  it("calculates exact store ratios from one complete day", () => {
    expect(aggregateCompanyDailyKpiStoreRange(input())).toEqual([
      {
        storeCode: "store-A",
        conversion: {
          ratio: {
            availability: "available",
            numerator: "2",
            denominator: "10",
          },
          coverage: {
            expectedDays: ["2026-08-30"],
            includedDays: ["2026-08-30"],
            missingDays: [],
          },
        },
        gsmRate: {
          ratio: {
            availability: "available",
            numerator: "3",
            denominator: "5",
          },
          coverage: {
            expectedDays: ["2026-08-30"],
            includedDays: ["2026-08-30"],
            missingDays: [],
          },
        },
      },
    ]);
  });

  it("sums eligible daily numerators and denominators across a leap/month boundary", () => {
    const days = ["2024-02-28", "2024-02-29", "2024-03-01"] as const;
    const result = aggregateCompanyDailyKpiStoreRange({
      sourceCode: "source-A",
      startDate: days[0],
      endDate: days[2],
      storeCodes: ["store-A"],
      componentSets: {
        sales: [
          set("sales", days[2], [sales(days[2], "store-A", 3)]),
          set("sales", days[0], [sales(days[0], "store-A", 1)]),
          set("sales", days[1], [sales(days[1], "store-A", 2)]),
        ],
        footfall: [
          set("footfall", days[1], [footfall(days[1], "store-A", 4)]),
          set("footfall", days[2], [footfall(days[2], "store-A", 5)]),
          set("footfall", days[0], [footfall(days[0], "store-A", 3)]),
        ],
        gsm: [
          set("gsm", days[1], [gsm(days[1], "store-A", 0, 1)]),
          set("gsm", days[0], [gsm(days[0], "store-A", 1, 2)]),
          set("gsm", days[2], [gsm(days[2], "store-A", 2, 3)]),
        ],
      },
    })[0];

    expect(result.conversion.ratio).toEqual({
      availability: "available",
      numerator: "6",
      denominator: "12",
    });
    expect(result.gsmRate.ratio).toEqual({
      availability: "available",
      numerator: "3",
      denominator: "6",
    });
    expect(result.conversion.coverage).toEqual({
      expectedDays: [...days],
      includedDays: [...days],
      missingDays: [],
    });
  });

  it("accumulates safe daily counts with bigint when range sums exceed Number.MAX_SAFE_INTEGER", () => {
    const max = Number.MAX_SAFE_INTEGER;
    const days = ["2026-08-30", "2026-08-31"] as const;
    const result = aggregateCompanyDailyKpiStoreRange({
      sourceCode: "source-A",
      startDate: days[0],
      endDate: days[1],
      storeCodes: ["store-A"],
      componentSets: {
        sales: days.map((day) =>
          set("sales", day, [sales(day, "store-A", max)]),
        ),
        footfall: days.map((day) =>
          set("footfall", day, [footfall(day, "store-A", max)]),
        ),
        gsm: days.map((day) => set("gsm", day, [gsm(day, "store-A", max, max)])),
      },
    })[0];

    expect(result.conversion.ratio).toEqual({
      availability: "available",
      numerator: "18014398509481982",
      denominator: "18014398509481982",
    });
    expect(result.gsmRate.ratio).toEqual({
      availability: "available",
      numerator: "18014398509481982",
      denominator: "18014398509481982",
    });
  });

  it("is deterministic under shuffled component, store, and sales aggregate order", () => {
    const days = ["2026-08-30", "2026-08-31"] as const;
    const ordered = aggregateCompanyDailyKpiStoreRange({
      sourceCode: "source-A",
      startDate: days[0],
      endDate: days[1],
      storeCodes: ["store-B", "store-A"],
      componentSets: {
        sales: [
          set("sales", days[0], [
            sales(days[0], "store-B", 4),
            sales(days[0], "store-A", 2),
          ]),
          set("sales", days[1], [
            sales(days[1], "store-B", 5),
            sales(days[1], "store-A", 3),
          ]),
        ],
        footfall: [
          set("footfall", days[0], [
            footfall(days[0], "store-B", 8),
            footfall(days[0], "store-A", 4),
          ]),
          set("footfall", days[1], [
            footfall(days[1], "store-A", 6),
            footfall(days[1], "store-B", 10),
          ]),
        ],
        gsm: [
          set("gsm", days[0], [
            gsm(days[0], "store-B", 2, 4),
            gsm(days[0], "store-A", 1, 2),
          ]),
          set("gsm", days[1], [
            gsm(days[1], "store-A", 3, 6),
            gsm(days[1], "store-B", 5, 10),
          ]),
        ],
      },
    });
    const shuffled = aggregateCompanyDailyKpiStoreRange({
      sourceCode: "source-A",
      startDate: days[0],
      endDate: days[1],
      storeCodes: ["store-A", "store-B"],
      componentSets: {
        sales: [
          set("sales", days[1], [
            sales(days[1], "store-A", 3),
            sales(days[1], "store-B", 5),
          ]),
          set("sales", days[0], [
            sales(days[0], "store-A", 2),
            sales(days[0], "store-B", 4),
          ]),
        ],
        footfall: [
          set("footfall", days[1], [
            footfall(days[1], "store-B", 10),
            footfall(days[1], "store-A", 6),
          ]),
          set("footfall", days[0], [
            footfall(days[0], "store-A", 4),
            footfall(days[0], "store-B", 8),
          ]),
        ],
        gsm: [
          set("gsm", days[1], [
            gsm(days[1], "store-B", 5, 10),
            gsm(days[1], "store-A", 3, 6),
          ]),
          set("gsm", days[0], [
            gsm(days[0], "store-A", 1, 2),
            gsm(days[0], "store-B", 2, 4),
          ]),
        ],
      },
    });

    expect(shuffled).toEqual(ordered);
    expect(JSON.stringify(shuffled)).not.toMatch(/person|personnel|invoice/i);
  });

  it("returns deterministic all-missing results for a requested store with no facts", () => {
    const result = aggregateCompanyDailyKpiStoreRange({
      ...input(),
      storeCodes: ["store-B", "store-A"],
    });

    expect(result[1]).toMatchObject({ storeCode: "store-B" });
    expect(result[1].conversion).toEqual({
      ratio: { availability: "unavailable", reason: "no_eligible_days" },
      coverage: {
        expectedDays: ["2026-08-30"],
        includedDays: [],
        missingDays: ["2026-08-30"],
        warning: "incomplete_coverage",
      },
    });
    expect(result[1].gsmRate).toEqual({
      ratio: { availability: "unavailable", reason: "no_eligible_days" },
      coverage: {
        expectedDays: ["2026-08-30"],
        includedDays: [],
        missingDays: ["2026-08-30"],
        warning: "incomplete_coverage",
      },
    });
  });

  it("tracks conversion and GSM coverage independently and never zero-fills missing days", () => {
    const days = ["2026-08-30", "2026-08-31"] as const;
    const result = aggregateCompanyDailyKpiStoreRange({
      sourceCode: "source-A",
      startDate: days[0],
      endDate: days[1],
      storeCodes: ["store-A"],
      componentSets: {
        sales: [set("sales", days[0], [sales(days[0], "store-A", 2)])],
        footfall: [
          set("footfall", days[0], [footfall(days[0], "store-A", 5)]),
        ],
        gsm: [set("gsm", days[1], [gsm(days[1], "store-A", 3, 4)])],
      },
    })[0];

    expect(result.conversion).toEqual({
      ratio: { availability: "available", numerator: "2", denominator: "5" },
      coverage: {
        expectedDays: [...days],
        includedDays: [days[0]],
        missingDays: [days[1]],
        warning: "incomplete_coverage",
      },
    });
    expect(result.gsmRate).toEqual({
      ratio: { availability: "available", numerator: "3", denominator: "4" },
      coverage: {
        expectedDays: [...days],
        includedDays: [days[1]],
        missingDays: [days[0]],
        warning: "incomplete_coverage",
      },
    });
  });

  it("treats failed and missed component sets as missing while allowing succeeded empty sets", () => {
    const days = ["2026-08-30", "2026-08-31"] as const;
    const result = aggregateCompanyDailyKpiStoreRange({
      sourceCode: "source-A",
      startDate: days[0],
      endDate: days[1],
      storeCodes: ["store-A"],
      componentSets: {
        sales: [set("sales", days[0], [])],
        footfall: [failed("footfall", days[0]), failed("footfall", days[1], "missed")],
        gsm: [failed("gsm", days[0], "missed")],
      },
    })[0];

    expect(result.conversion.coverage).toEqual({
      expectedDays: [...days],
      includedDays: [],
      missingDays: [...days],
      warning: "incomplete_coverage",
    });
    expect(result.gsmRate.coverage).toEqual({
      expectedDays: [...days],
      includedDays: [],
      missingDays: [...days],
      warning: "incomplete_coverage",
    });
  });

  it("uses only store sales facts and sale invoice counts, never personnel or return counts", () => {
    const result = aggregateCompanyDailyKpiStoreRange({
      sourceCode: "source-A",
      startDate: "2026-08-30",
      endDate: "2026-08-30",
      storeCodes: ["store-A"],
      componentSets: {
        sales: [
          set("sales", "2026-08-30", [
            sales("2026-08-30", "store-A", 2, 99),
          ]),
        ],
        footfall: [
          set("footfall", "2026-08-30", [footfall("2026-08-30", "store-A", 10)]),
        ],
        gsm: [set("gsm", "2026-08-30", [gsm("2026-08-30", "store-A", 1, 2)])],
      },
    })[0];

    expect(result.conversion.ratio).toEqual({
      availability: "available",
      numerator: "2",
      denominator: "10",
    });
    expect(JSON.stringify(result)).not.toMatch(/person-A|personnelCode|returnInvoiceCount/i);
  });

  it("rejects employee-shaped sales rows because the range input is store-projected", () => {
    const candidate = input();
    candidate.componentSets.sales = [
      {
        ...candidate.componentSets.sales[0],
        aggregates: [
          {
            ...sales("2026-08-30", "store-A", 2),
            personnelCode: "employee-A",
          } as never,
        ],
        projectionAggregateCount: 1,
      },
    ];

    expectInvalid(candidate);
  });

  it("keeps zero numerators available but treats zero denominators as missing", () => {
    const result = aggregateCompanyDailyKpiStoreRange({
      sourceCode: "source-A",
      startDate: "2026-08-30",
      endDate: "2026-08-30",
      storeCodes: ["store-A"],
      componentSets: {
        sales: [set("sales", "2026-08-30", [sales("2026-08-30", "store-A", 0)])],
        footfall: [
          set("footfall", "2026-08-30", [footfall("2026-08-30", "store-A", 0)]),
        ],
        gsm: [set("gsm", "2026-08-30", [gsm("2026-08-30", "store-A", 0, 5)])],
      },
    })[0];

    expect(result.conversion.ratio).toEqual({
      availability: "unavailable",
      reason: "no_eligible_days",
    });
    expect(result.gsmRate.ratio).toEqual({
      availability: "available",
      numerator: "0",
      denominator: "5",
    });
    expect(result.conversion.coverage.missingDays).toEqual(["2026-08-30"]);
    expect(result.gsmRate.coverage.missingDays).toEqual([]);
  });

  it("rejects non-calendar ranges, reversed ranges, blank sources, and invalid store scope", () => {
    expectInvalid({ ...input(), startDate: "2026-02-30" });
    expectInvalid({ ...input(), startDate: "2026-08-31", endDate: "2026-08-30" });
    expectInvalid({ ...input(), sourceCode: "" });
    expectInvalid({ ...input(), sourceCode: " source-A" });
    expectInvalid({ ...input(), storeCodes: ["store-A", ""] });
    expectInvalid({ ...input(), storeCodes: ["store-A", "store-A"] });
    expectInvalid({ ...input(), storeCodes: [" store-A"] });
  });

  it("rejects mismatched, duplicate, unknown, and malformed component sets", () => {
    const base = input();
    const salesSet = base.componentSets.sales[0];

    expectInvalid({
      ...base,
      componentSets: {
        ...base.componentSets,
        sales: [{ ...salesSet, retryCount: 0 } as never],
      },
    });
    expectInvalid({
      ...base,
      componentSets: {
        ...base.componentSets,
        sales: [{ ...salesSet, businessDate: "2026-08-31" }],
      },
    });
    expectInvalid({
      ...base,
      componentSets: {
        ...base.componentSets,
        sales: [
          { ...salesSet },
          { ...salesSet },
        ],
      },
    });
    expectInvalid({
      ...base,
      componentSets: {
        ...base.componentSets,
        sales: [{ ...salesSet, operation: "unknown" as never }],
      },
    });
    expectInvalid({
      ...base,
      componentSets: {
        ...base.componentSets,
        sales: [{ ...salesSet, status: "unknown" as never }],
      },
    });
    expectInvalid({
      ...base,
      componentSets: {
        ...base.componentSets,
        sales: undefined as never,
      },
    });
    expectInvalid({
      ...base,
      componentSets: undefined as never,
    });
  });

  it("rejects aggregate date mismatches, duplicate store facts, and count invariants", () => {
    const base = input();

    expectInvalid({
      ...base,
      componentSets: {
        ...base.componentSets,
        sales: [
          set("sales", "2026-08-30", [
            sales("2026-08-31", "store-A", 2),
          ]),
        ],
      },
    });
    expectInvalid({
      ...base,
      componentSets: {
        ...base.componentSets,
        sales: [
          set("sales", "2026-08-30", [
            sales("2026-08-30", "store-A", 1),
            sales("2026-08-30", "store-A", 2),
          ]),
        ],
      },
    });
    expectInvalid({
      ...base,
      componentSets: {
        ...base.componentSets,
        footfall: [
          set("footfall", "2026-08-30", [
            footfall("2026-08-30", "store-A", 1),
            footfall("2026-08-30", "store-A", 2),
          ]),
        ],
      },
    });
    expectInvalid({
      ...base,
      componentSets: {
        ...base.componentSets,
        gsm: [
          set("gsm", "2026-08-30", [
            gsm("2026-08-30", "store-A", 1, 2),
            gsm("2026-08-30", "store-A", 1, 2),
          ]),
        ],
      },
    });
    expectInvalid({
      ...base,
      componentSets: {
        ...base.componentSets,
        sales: [
          { ...base.componentSets.sales[0], projectionAggregateCount: 0 },
        ],
      },
    });
    expectInvalid({
      ...base,
      componentSets: {
        ...base.componentSets,
        footfall: [
          {
            ...base.componentSets.footfall[0],
            status: "failed",
            aggregates: [footfall("2026-08-30", "store-A", 10)],
            projectionAggregateCount: 1,
          },
        ],
      },
    });
    expectInvalid({
      ...base,
      componentSets: {
        ...base.componentSets,
        gsm: [
          {
            ...base.componentSets.gsm[0],
            status: "missed",
            aggregates: [gsm("2026-08-30", "store-A", 1, 1)],
          },
        ],
      },
    });
  });

  it("rejects invalid, unsafe, and negative count values plus invalid GSM bounds", () => {
    const base = input();

    expectInvalid({
      ...base,
      componentSets: {
        ...base.componentSets,
        sales: [
          set("sales", "2026-08-30", [sales("2026-08-30", "store-A", NaN)]),
        ],
      },
    });
    expectInvalid({
      ...base,
      componentSets: {
        ...base.componentSets,
        sales: [
          set("sales", "2026-08-30", [sales("2026-08-30", "store-A", -1)]),
        ],
      },
    });
    expectInvalid({
      ...base,
      componentSets: {
        ...base.componentSets,
        sales: [
          set("sales", "2026-08-30", [
            sales("2026-08-30", "store-A", Number.MAX_SAFE_INTEGER + 1),
          ]),
        ],
      },
    });
    expectInvalid({
      ...base,
      componentSets: {
        ...base.componentSets,
        footfall: [
          set("footfall", "2026-08-30", [
            footfall("2026-08-30", "store-A", Number.MAX_SAFE_INTEGER + 1),
          ]),
        ],
      },
    });
    expectInvalid({
      ...base,
      componentSets: {
        ...base.componentSets,
        gsm: [
          set("gsm", "2026-08-30", [
            gsm("2026-08-30", "store-A", 3, 2),
          ]),
        ],
      },
    });
    expectInvalid({
      ...base,
      componentSets: {
        ...base.componentSets,
        gsm: [
          set("gsm", "2026-08-30", [
            gsm("2026-08-30", "store-A", -1, 2),
          ]),
        ],
      },
    });
    expectInvalid({
      ...base,
      componentSets: {
        ...base.componentSets,
        footfall: [
          set("footfall", "2026-08-30", [
            {
              ...footfall("2026-08-30", "store-A", 2),
              personnelCode: "person-A",
            } as never,
          ]),
        ],
      },
    });
  });
});
