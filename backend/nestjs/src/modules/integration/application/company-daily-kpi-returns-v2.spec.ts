import { normalizeCompanyDailySales, type NeutralSalesLine } from "./company-daily-kpi-pure-adapter";
import { buildCompanyDailySalesProjection } from "./company-daily-kpi-sales-projection";
import { canonicalDecimal } from "./company-daily-kpi-decimal";

const day = "2026-09-30";
const id = (suffix: string) => `00000000-0000-4000-8000-${suffix.padStart(12, "0")}`;
const stores = new Map(["store-A", "store-B", "partner-A"].map((code, index) => [code,
  { storeId: id(String(100 + index)), companyId: id("1"), regionId: id("2") }]));
const employees = new Map([["seller-A", id("200")]]);
const line = (input: Partial<NeutralSalesLine> = {}): NeutralSalesLine => ({ sourceDateToken: day,
  storeCode: "store-A", originalStoreCode: "store-A", personnelCode: "seller-A",
  ephemeralInvoiceId: "invoice-sale", isReturn: false, quantity: "1", amountTry: "100", ...input });
const returned = (store: string, amount = "-10", original: string | null = "store-A") => line({
  storeCode: store, originalStoreCode: original, isReturn: true, quantity: "-1", amountTry: amount,
  ephemeralInvoiceId: `invoice-return-${store}` });
function normalize(rows: NeutralSalesLine[], aliases?: Record<string, string>) {
  return normalizeCompanyDailySales({ sourceCode: "source-A", businessDate: day, retryCount: 0,
    returnAttributionVersion: 2, rows, allowedStoreCodes: new Set(stores.keys()), storeAliases: aliases });
}

describe("company daily returns attribution v2", () => {
  it("assigns the return to its Istanbul day at the month boundary", () => {
    const result = normalizeCompanyDailySales({ sourceCode: "source-A", businessDate: "2026-10-01", retryCount: 0,
      returnAttributionVersion: 2, rows: [returned("store-A", "-10", "store-A")].map(row => ({
        ...row, sourceDateToken: "2026-09-30T21:30:00Z" })) });
    expect(result.status).toBe("succeeded");
    expect(result.returnAggregates?.[0].businessDate).toBe("2026-10-01");
    expect(normalizeCompanyDailySales({ sourceCode: "source-A", businessDate: "2026-09-30", retryCount: 0,
      returnAttributionVersion: 2, rows: [line({ sourceDateToken: "2026-09-30T21:30:00Z" })] }).status).toBe("failed");
  });
  it("keeps the seller's same-store net while two other receiving stores retain only store debits", () => {
    const sales = normalize([line(), returned("store-A"), returned("store-B", "-20"), returned("partner-A", "-30")]);
    const projection = buildCompanyDailySalesProjection({ sales, stores, employees });
    expect(projection.employeeSales).toHaveLength(1);
    expect(projection.employeeSales[0].netAmountTry).toBe("90");
    expect(projection.storeSales.map(row => row.netAmountTry)).toEqual(["-30", "90", "-20"]);
    expect(projection.returnFacts).toHaveLength(3);
    expect(projection.metrics.filter(m => m.scopeType === "employee" && m.kpiCode === "NET_SALES"))
      .toEqual([expect.objectContaining({ storeId: id("100"), actualValue: "90" })]);
    expect(JSON.stringify(sales)).not.toMatch(/invoice-/);
    expect(new Set(projection.metrics.map(m => JSON.stringify([m.storeId, m.employeeId, m.kpiCode]))).size)
      .toBe(projection.metrics.length);
  });

  it("allows the same seller's genuine positive sales in two stores with independent canonical keys", () => {
    const sales = normalize([line(), line({ storeCode: "store-B", originalStoreCode: "store-B" })]);
    const projection = buildCompanyDailySalesProjection({ sales, stores, employees });
    expect(projection.employeeSales).toHaveLength(2);
    expect(projection.metrics.filter(m => m.scopeType === "employee" && m.kpiCode === "NET_SALES"))
      .toHaveLength(2);
  });

  it("retains outbound external returns as information without deducting original store or seller", () => {
    const sales = normalize([line(), returned("external-A", "-20")]);
    const projection = buildCompanyDailySalesProjection({ sales, stores, employees });
    expect(projection.storeSales).toEqual([expect.objectContaining({ netAmountTry: "100" })]);
    expect(projection.employeeSales[0].netAmountTry).toBe("100");
    expect(projection.returnFacts).toEqual([expect.objectContaining({ storeId: id("100"),
      receivingStoreCode: "external-A", direction: "external", returnKind: "cross_store" })]);
    expect(normalize([returned("external-A", "-20", "external-B")]).returnAggregates).toEqual([]);
  });

  it("accepts external/franchise origins at registered receivers, and never guesses missing origin", () => {
    const sales = normalize([line(), returned("store-A", "-20", "external-A"), returned("store-B", "-30", null)]);
    const projection = buildCompanyDailySalesProjection({ sales, stores, employees });
    expect(projection.employeeSales[0].netAmountTry).toBe("100");
    expect(projection.storeSales.map(r => r.netAmountTry)).toEqual(["80", "-30"]);
    expect(sales.safeReasonCode).toBe("unresolved_return_origin");
    expect(sales.returnAggregates?.map(r => r.returnKind)).toEqual(["cross_store", "unresolved"]);
  });

  it("resolves historical aliases before comparing original and receiving store identities", () => {
    expect(normalize([line(), returned("store-A", "-10", "former-A")], { "former-A": "store-A" })
      .aggregates[0]).toMatchObject({ personnelCode: "seller-A", netAmountTry: "90" });
  });

  it("counts repeated return invoice lines once and makes retry/order digests stable", () => {
    const rows = [line(), returned("store-A", "-1.15"), returned("store-A", "-2.10")];
    const first = normalize(rows), second = normalize([...rows].reverse());
    expect(first.returnAggregates?.[0]).toMatchObject({ returnInvoiceCount: 1, signedReturnAmountTry: "-3.25" });
    expect(first.sanitizedSetDigest).toBe(second.sanitizedSetDigest);
    expect(normalize([line(), returned("store-A", "-4")]).sanitizedSetDigest).not.toBe(first.sanitizedSetDigest);
  });

  it("retains same-store negative employee net and unmapped returns without bootstrapping them", () => {
    const sales = normalize([returned("store-A", "-150")]);
    expect(buildCompanyDailySalesProjection({ sales, stores, employees }).employeeSales[0].netAmountTry).toBe("-150");
    expect(buildCompanyDailySalesProjection({ sales, stores, employees: new Map() }).unmappedPersonnelSales)
      .toEqual([expect.objectContaining({ personnelCode: "seller-A", netAmountTry: "-150", saleInvoiceCount: 0 })]);
  });

  it.each([
    returned("external-A", "1"),
    returned("store-A", "-1e3"),
    line({ sourceDateToken: "2026-09-29T20:59:59Z" }),
    line({ originalStoreCode: " bad " }),
  ])("rejects malformed/mismatched source rows before filtering", row => {
    expect(normalize([row]).status).toBe("failed");
  });

  it("refuses a legacy set for new projection and rounds canonical decimals without floating-point loss", () => {
    expect(() => buildCompanyDailySalesProjection({ sales: normalizeCompanyDailySales({ sourceCode: "source-A",
      businessDate: day, retryCount: 0, rows: [line({ originalStoreCode: undefined })] }), stores, employees }))
      .toThrow("attribution_v2_required");
    expect(canonicalDecimal("99999999999999.9999")).toBe("99999999999999.9999");
    expect(canonicalDecimal("-10", 3n)).toBe("-3.3333");
    expect(() => canonicalDecimal("100000000000000")).toThrow("out_of_range");
  });
});
