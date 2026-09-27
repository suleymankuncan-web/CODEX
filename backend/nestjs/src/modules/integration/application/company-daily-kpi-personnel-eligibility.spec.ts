import type { EmployeeSalesDailyAggregate } from "./company-daily-kpi-pure-adapter";
import { selectDailyPersonnelBootstrapCandidates } from "./company-daily-kpi-personnel-eligibility";

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
