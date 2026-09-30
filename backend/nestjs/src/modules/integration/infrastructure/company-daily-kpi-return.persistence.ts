import { BadRequestException } from "@nestjs/common";
import type { PoolClient } from "pg";
import type { CompanyDailyReturnFact } from "../application/company-daily-kpi-return-adapter";
import { decimalUnits } from "../application/company-daily-kpi-decimal";

export type { CompanyDailyReturnFact } from "../application/company-daily-kpi-return-adapter";

export function assertReturnFacts(facts: CompanyDailyReturnFact[], day: string): void {
  const grains = new Set<string>();
  const code = (value: unknown) => typeof value === "string" && value.length > 0 && value.length <= 80 &&
    value.trim() === value && ![...value].some(c => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127);
  for (const fact of facts) {
    const grain = JSON.stringify([fact.storeId, fact.receivingStoreCode, fact.originalStoreCode,
      fact.personnelCode, fact.direction, fact.returnKind]);
    try {
      const relation = fact.returnKind === "unresolved" ? fact.originalStoreCode === null && fact.direction === "received" :
        fact.returnKind === "same_store" ? fact.originalStoreCode === fact.receivingStoreCode && fact.direction === "received" :
          fact.returnKind === "cross_store" && code(fact.originalStoreCode) && fact.originalStoreCode !== fact.receivingStoreCode;
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(fact.storeId) ||
        fact.businessDate !== day || !code(fact.receivingStoreCode) ||
        (fact.originalStoreCode !== null && !code(fact.originalStoreCode)) ||
        (fact.personnelCode !== null && !code(fact.personnelCode)) ||
        !["received", "external"].includes(fact.direction) || !relation ||
        !Number.isSafeInteger(fact.returnInvoiceCount) || fact.returnInvoiceCount <= 0 || fact.returnInvoiceCount > 2147483647 ||
        decimalUnits(fact.signedReturnAmountTry).units >= 0n || decimalUnits(fact.signedReturnQuantity).units >= 0n || grains.has(grain)) {
        throw new Error("invalid return fact");
      }
      grains.add(grain);
    } catch { throw new BadRequestException("company_daily_kpi_invalid_return_fact"); }
  }
}

export async function insertReturnFacts(client: PoolClient, outcome: string, day: string, facts: CompanyDailyReturnFact[]) {
  if (!facts.length) return;
  await client.query(`INSERT INTO ops.company_daily_kpi_return
    (component_outcome_id,business_date,store_id,receiving_store_code,original_store_code,personnel_code,
     direction,return_kind,return_invoice_count,signed_return_quantity,signed_return_amount_try)
    SELECT $1::uuid,$2::date,f.store_id,f.receiving_store_code,f.original_store_code,f.personnel_code,
      f.direction,f.return_kind,f.return_invoice_count,f.signed_return_quantity,f.signed_return_amount_try
    FROM jsonb_to_recordset($3::jsonb) AS f(store_id uuid,receiving_store_code text,original_store_code text,
      personnel_code text,direction text,return_kind text,return_invoice_count integer,
      signed_return_quantity numeric(38,12),signed_return_amount_try numeric(38,12))`,
  [outcome, day, JSON.stringify(facts.map(f => ({ store_id: f.storeId, receiving_store_code: f.receivingStoreCode,
    original_store_code: f.originalStoreCode, personnel_code: f.personnelCode, direction: f.direction,
    return_kind: f.returnKind, return_invoice_count: f.returnInvoiceCount,
    signed_return_quantity: f.signedReturnQuantity, signed_return_amount_try: f.signedReturnAmountTry })))]);
}
