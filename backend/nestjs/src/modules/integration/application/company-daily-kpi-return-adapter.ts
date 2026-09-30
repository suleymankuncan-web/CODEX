import type { CompanyDailySafeReasonCode, NeutralSalesLine } from "./company-daily-kpi-pure-adapter";
import { decimalUnits, sumDecimal } from "./company-daily-kpi-decimal";

export type ReturnDailyAggregate = {
  businessDate: string;
  /** Registered receiving store, or original store for an external information row. */
  storeCode: string;
  receivingStoreCode: string;
  originalStoreCode: string | null;
  personnelCode: string | null;
  direction: "received" | "external";
  returnKind: "same_store" | "cross_store" | "unresolved";
  returnInvoiceCount: number;
  signedReturnQuantity: string;
  signedReturnAmountTry: string;
};

export type CompanyDailyReturnFact = Omit<ReturnDailyAggregate, "storeCode"> & { storeId: string };

export function prepareCompanyDailyReturns(input: {
  businessDate: string;
  rows: readonly NeutralSalesLine[];
  allowedStoreCodes?: ReadonlySet<string>;
  storeAliases?: Readonly<Record<string, string>>;
}): { rows: NeutralSalesLine[]; returns: ReturnDailyAggregate[]; error?: CompanyDailySafeReasonCode } {
  const rows: NeutralSalesLine[] = [];
  const returns = new Map<string, { fact: ReturnDailyAggregate; invoices: Set<string> }>();
  const code = (value: string) => input.storeAliases && Object.hasOwn(input.storeAliases, value)
    ? input.storeAliases[value] : value;
  const allowed = (value: string) => !input.allowedStoreCodes || input.allowedStoreCodes.has(value);
  const validCode = (value: unknown): value is string => typeof value === "string" && value.length > 0 &&
    value.length <= 80 && value.trim() === value && ![...value].some(c => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127);
  const fail = (error: CompanyDailySafeReasonCode) => ({ rows: [], returns: [], error });

  if (input.storeAliases && Object.entries(input.storeAliases).some(([from, to]) => !validCode(from) || !validCode(to)))
    return fail("invalid_component_input");

  for (const row of input.rows) {
    if (!validCode(row.storeCode) || typeof row.isReturn !== "boolean" || typeof row.ephemeralInvoiceId !== "string" || !row.ephemeralInvoiceId ||
      (row.originalStoreCode != null && !validCode(row.originalStoreCode))) return fail("invalid_component_input");
    const receiving = code(row.storeCode), original = row.originalStoreCode == null ? null : code(row.originalStoreCode);
    // Validate dates/signs for external rows too: scope filtering cannot hide bad source data.
    const date = /^\d{4}-\d{2}-\d{2}$/.test(row.sourceDateToken) ? row.sourceDateToken :
      /(?:Z|[+-]\d{2}:\d{2})$/.test(row.sourceDateToken) && Number.isFinite(Date.parse(row.sourceDateToken))
        ? new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(row.sourceDateToken)) : null;
    if (date !== input.businessDate) return fail("source_date_mismatch");
    try {
      const quantity = decimalUnits(row.quantity), amount = decimalUnits(row.amountTry);
      if (row.isReturn && (quantity.units >= 0n || amount.units >= 0n)) return fail("invalid_return_sign");
      if (!row.isReturn && (quantity.units < 0n || amount.units < 0n)) return fail("invalid_component_input");
    } catch { return fail("invalid_decimal"); }
    if (!allowed(receiving) && (!row.isReturn || !original || !allowed(original))) continue;
    const kind = !original ? "unresolved" : original === receiving ? "same_store" : "cross_store";
    if (row.isReturn) {
      const direction = allowed(receiving) ? "received" : "external";
      const anchor = direction === "received" ? receiving : original!;
      const personnel = validCode(row.personnelCode) ? row.personnelCode : null;
      const key = JSON.stringify([anchor, receiving, original, personnel, direction, kind]);
      const item = returns.get(key) ?? { fact: { businessDate: input.businessDate, storeCode: anchor,
        receivingStoreCode: receiving, originalStoreCode: original, personnelCode: personnel,
        direction, returnKind: kind, returnInvoiceCount: 0, signedReturnQuantity: "0", signedReturnAmountTry: "0" }, invoices: new Set<string>() };
      item.invoices.add(row.ephemeralInvoiceId);
      item.fact.returnInvoiceCount = item.invoices.size;
      item.fact.signedReturnQuantity = sumDecimal(item.fact.signedReturnQuantity, row.quantity);
      item.fact.signedReturnAmountTry = sumDecimal(item.fact.signedReturnAmountTry, row.amountTry);
      returns.set(key, item);
    }
    if (allowed(receiving)) rows.push({ ...row, storeCode: receiving,
      originalStoreCode: original });
  }
  return { rows, returns: [...returns.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, item]) => item.fact) };
}
