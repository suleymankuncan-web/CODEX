import type { EmployeeSalesDailyAggregate } from "./company-daily-kpi-pure-adapter";
import { planDailyPersonnelMovements, selectDailyPersonnelBootstrapCandidates } from "./company-daily-kpi-personnel-eligibility";

function sale(input: Partial<EmployeeSalesDailyAggregate> & Pick<EmployeeSalesDailyAggregate, "personnelCode" | "storeCode">): EmployeeSalesDailyAggregate {
  return {
    businessDate: "2026-09-26",
    saleInvoiceCount: 1,
    returnInvoiceCount: 0,
    saleQuantity: "1",
    signedReturnQuantity: "0",
    netQuantity: "1",
    saleAmountTry: "100",
    signedReturnAmountTry: "0",
    netAmountTry: "100",
    ...input,
  };
}

describe("daily personnel bootstrap eligibility", () => {
  const allowedStoreCodes = new Set(["S1", "S2"]);
  const choose = (aggregates: EmployeeSalesDailyAggregate[], knownPersonnelCodes = new Set<string>(), mayBootstrapCurrentDay = true) =>
    selectDailyPersonnelBootstrapCandidates({ aggregates, knownPersonnelCodes, allowedStoreCodes, mayBootstrapCurrentDay });

  it("admits positive sale movement even when a larger return makes net negative", () => {
    expect(choose([sale({ personnelCode: "P1", storeCode: "S1", saleAmountTry: "100", signedReturnAmountTry: "-150", netAmountTry: "-50" })]))
      .toEqual([{ personnelCode: "P1", primaryStoreCode: "S1" }]);
  });

  it("does not admit return-only or zero-value movement", () => {
    expect(choose([
      sale({ personnelCode: "P1", storeCode: "S1", saleInvoiceCount: 0, returnInvoiceCount: 1, saleAmountTry: "0", signedReturnAmountTry: "-50", netAmountTry: "-50" }),
      sale({ personnelCode: "P2", storeCode: "S1", saleAmountTry: "0", netAmountTry: "0" }),
    ])).toEqual([]);
  });

  it("never proposes a new assignment or reactivation for an existing employee", () => {
    expect(choose([sale({ personnelCode: "P1", storeCode: "S2" })], new Set(["P1"]))).toEqual([]);
  });

  it("does not bootstrap from historical replay or disabled stores", () => {
    expect(choose([sale({ personnelCode: "P1", storeCode: "S1" })], new Set(), false)).toEqual([]);
    expect(choose([sale({ personnelCode: "P1", storeCode: "S3" })])).toEqual([]);
  });

  it("retains one deterministic provisional store for a new multi-store seller", () => {
    expect(choose([
      sale({ personnelCode: "P1", storeCode: "S2", saleAmountTry: "100.50" }),
      sale({ personnelCode: "P1", storeCode: "S1", saleAmountTry: "100.5000" }),
      sale({ personnelCode: "P2", storeCode: "S2", saleAmountTry: "2.00" }),
      sale({ personnelCode: "P2", storeCode: "S1", saleAmountTry: "10.00" }),
    ])).toEqual([
      { personnelCode: "P1", primaryStoreCode: "S1" },
      { personnelCode: "P2", primaryStoreCode: "S1" },
    ]);
  });
});

describe("sanitized daily personnel movement plan", () => {
  const previousDay = "2026-09-26";
  const evaluatedAt = new Date("2026-09-27T06:00:00.000Z");
  const plan = (aggregates: EmployeeSalesDailyAggregate[], options: { known?: string[]; scheduled?: boolean; businessDate?: string } = {}) =>
    planDailyPersonnelMovements({
      aggregates,
      knownPersonnelCodes: new Set(options.known ?? []),
      allowedStoreCodes: new Set(["S1", "S2"]),
      businessDate: options.businessDate ?? previousDay,
      scheduled: options.scheduled ?? true,
      evaluatedAt,
    });

  it("bootstraps a positive seller despite negative net, with both stores' movements intact", () => {
    const first = sale({ businessDate: previousDay, personnelCode: "P1", storeCode: "S1", saleAmountTry: "100", signedReturnAmountTry: "-150", netAmountTry: "-50" });
    const second = sale({ businessDate: previousDay, personnelCode: "P1", storeCode: "S2", saleInvoiceCount: 0, returnInvoiceCount: 1, saleQuantity: "0", signedReturnQuantity: "-1", netQuantity: "-1", saleAmountTry: "0", signedReturnAmountTry: "-25", netAmountTry: "-25" });
    const result = plan([first, second]);
    expect(result.bootstrapCandidates).toEqual([{ personnelCode: "P1", primaryStoreCode: "S1" }]);
    expect(result.mappedMovements).toEqual([first, second]);
    expect(result.unmappedMovements).toEqual([]);
  });

  it("keeps a separated known employee mapped without creating or moving a roster entry", () => {
    const returnOnly = sale({ businessDate: previousDay, personnelCode: "FORMER", storeCode: "S2", saleInvoiceCount: 0, saleAmountTry: "0", signedReturnAmountTry: "-50", netAmountTry: "-50" });
    expect(plan([returnOnly], { known: ["FORMER"] })).toEqual({
      bootstrapCandidates: [], mappedMovements: [returnOnly], unmappedMovements: [],
    });
  });

  it("routes unknown return-only and historical positive sales to unmapped facts", () => {
    const returnOnly = sale({ businessDate: previousDay, personnelCode: "RETURN", storeCode: "S1", saleInvoiceCount: 0, saleAmountTry: "0", signedReturnAmountTry: "-20", netAmountTry: "-20" });
    expect(plan([returnOnly]).unmappedMovements).toEqual([returnOnly]);
    const historical = sale({ businessDate: "2026-09-20", personnelCode: "OLD", storeCode: "S1" });
    expect(plan([historical], { businessDate: "2026-09-20" })).toEqual({
      bootstrapCandidates: [], mappedMovements: [], unmappedMovements: [historical],
    });
    expect(plan([sale({ businessDate: previousDay, personnelCode: "MANUAL", storeCode: "S1" })], { scheduled: false }).bootstrapCandidates).toEqual([]);
  });

  it("rejects mismatched or duplicate person/store/day grains before persistence", () => {
    const movement = sale({ businessDate: previousDay, personnelCode: "P1", storeCode: "S1" });
    expect(() => plan([movement, movement])).toThrow("company_daily_kpi_invalid_personnel_movement_grain");
    expect(() => plan([{ ...movement, businessDate: "2026-09-25" }])).toThrow("company_daily_kpi_invalid_personnel_movement_grain");
    expect(() => plan([], { businessDate: "2026-99-99" })).toThrow("company_daily_kpi_invalid_personnel_plan_date");
  });
});
