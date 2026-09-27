import type {
  EmployeeSalesDailyAggregate,
  SalesDailyAggregate,
} from "./company-daily-kpi-pure-adapter";

export type DailyPersonnelBootstrapCandidate = {
  personnelCode: string;
  primaryStoreCode: string;
};

/**
 * Sales are evidence for a provisional first roster entry, never authority to
 * transfer or reactivate an existing employee. The caller must still verify the
 * current provider day and apply its own master-data approval boundary.
 */
export function selectDailyPersonnelBootstrapCandidates(input: {
  aggregates: readonly SalesDailyAggregate[];
  knownPersonnelCodes: ReadonlySet<string>;
  allowedStoreCodes: ReadonlySet<string>;
  mayBootstrapCurrentDay: boolean;
}): DailyPersonnelBootstrapCandidate[] {
  if (!input.mayBootstrapCurrentDay) return [];

  const preferred = new Map<string, EmployeeSalesDailyAggregate>();
  for (const aggregate of input.aggregates) {
    if (!("personnelCode" in aggregate) ||
      input.knownPersonnelCodes.has(aggregate.personnelCode) ||
      !input.allowedStoreCodes.has(aggregate.storeCode) ||
      aggregate.saleInvoiceCount <= 0 ||
      !isPositiveDecimal(aggregate.saleAmountTry)) {
      continue;
    }
    const previous = preferred.get(aggregate.personnelCode);
    if (!previous || comparePositiveDecimal(aggregate.saleAmountTry, previous.saleAmountTry) > 0 ||
      (comparePositiveDecimal(aggregate.saleAmountTry, previous.saleAmountTry) === 0 &&
        aggregate.storeCode < previous.storeCode)) {
      preferred.set(aggregate.personnelCode, aggregate);
    }
  }

  return [...preferred.values()]
    .map((aggregate) => ({
      personnelCode: aggregate.personnelCode,
      primaryStoreCode: aggregate.storeCode,
    }))
    .sort((left, right) => left.personnelCode.localeCompare(right.personnelCode));
}

function isPositiveDecimal(value: string): boolean {
  return /^\d+(?:\.\d+)?$/.test(value) && BigInt(value.replace(".", "")) > 0n;
}

function comparePositiveDecimal(left: string, right: string): number {
  const leftFraction = left.split(".")[1]?.length ?? 0;
  const rightFraction = right.split(".")[1]?.length ?? 0;
  const scale = Math.max(leftFraction, rightFraction);
  const leftUnits = BigInt(left.replace(".", "")) * 10n ** BigInt(scale - leftFraction);
  const rightUnits = BigInt(right.replace(".", "")) * 10n ** BigInt(scale - rightFraction);
  return leftUnits > rightUnits ? 1 : leftUnits < rightUnits ? -1 : 0;
}
