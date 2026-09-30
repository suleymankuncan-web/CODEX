import type { EmployeeSalesDailyAggregate, SalesDailyAggregate, SanitizedComponentSet } from "./company-daily-kpi-pure-adapter";
import type { CompanyDailyReturnFact } from "./company-daily-kpi-return-adapter";
import { canonicalDecimal } from "./company-daily-kpi-decimal";

type StoreIdentity = { storeId: string; companyId: string; regionId: string | null };
type KpiPayload = StoreIdentity & { employeeId: string | null; scopeType: "employee" | "store";
  kpiCode: string; actualValue: string; achievementRate: null; periodType: "daily"; periodStart: string; periodEnd: string };

/** The private decoder must force attribution v2 and bootstrap positive sellers
 * before calling this boundary. No provider row, name, or invoice is accepted. */
export function buildCompanyDailySalesProjection(input: {
  sales: SanitizedComponentSet<SalesDailyAggregate>;
  stores: ReadonlyMap<string, StoreIdentity>;
  employees: ReadonlyMap<string, string>;
}) {
  const { sales } = input;
  if (sales.status !== "succeeded" || sales.returnAttributionVersion !== 2 || !sales.returnAggregates)
    throw new TypeError("company_daily_kpi_attribution_v2_required");
  const metrics: KpiPayload[] = [];
  const employeeSales: Array<Omit<EmployeeSalesDailyAggregate, "businessDate" | "storeCode" | "personnelCode"> & { storeId: string; employeeId: string }> = [];
  const unmappedPersonnelSales: Array<Omit<EmployeeSalesDailyAggregate, "businessDate" | "storeCode"> & { storeId: string }> = [];
  const storeSales = [];
  const store = (code: string) => {
    const identity = input.stores.get(code);
    if (!identity) throw new TypeError("company_daily_kpi_unmapped_store");
    return identity;
  };
  for (const row of sales.aggregates) {
    const identity = store(row.storeCode);
    const employeeId = "personnelCode" in row ? input.employees.get(row.personnelCode) : null;
    if ("personnelCode" in row) {
      const { businessDate: _day, storeCode: _code, personnelCode, ...facts } = row;
      if (employeeId) employeeSales.push({ ...facts, storeId: identity.storeId, employeeId });
      else { unmappedPersonnelSales.push({ ...facts, storeId: identity.storeId, personnelCode }); continue; }
    } else {
      const { businessDate: _day, storeCode: _code, ...facts } = row;
      storeSales.push({ ...facts, storeId: identity.storeId });
    }
    const add = (kpiCode: string, value: string, denominator = 1n) => metrics.push({ ...identity,
      employeeId: employeeId ?? null, scopeType: employeeId ? "employee" : "store", kpiCode,
      actualValue: canonicalDecimal(value, denominator), achievementRate: null,
      periodType: "daily", periodStart: sales.businessDate, periodEnd: sales.businessDate });
    add("NET_SALES", row.netAmountTry);
    add("ITEM_COUNT", row.netQuantity);
    add("TICKET_COUNT", String(row.saleInvoiceCount));
    if (row.saleInvoiceCount > 0) {
      add("ATV", row.netAmountTry, BigInt(row.saleInvoiceCount));
      add("UPT", row.netQuantity, BigInt(row.saleInvoiceCount));
    }
  }
  const returnFacts: CompanyDailyReturnFact[] = sales.returnAggregates.map(row => {
    const { storeCode, ...fact } = row;
    return { ...fact, storeId: store(storeCode).storeId };
  });
  return { metrics, employeeSales, unmappedPersonnelSales, storeSales, returnFacts,
    returnAttributionVersion: 2 as const,
    aggregateCount: employeeSales.length + unmappedPersonnelSales.length + storeSales.length };
}
