import type {
  EmployeeSalesDailyAggregate,
  SalesDailyAggregate,
} from "./company-daily-kpi-pure-adapter";

export type DailyPersonnelBootstrapCandidate = {
  personnelCode: string;
  primaryStoreCode: string;
};

export type DailyPersonnelMovementPlan = {
  bootstrapCandidates: DailyPersonnelBootstrapCandidate[];
  mappedMovements: EmployeeSalesDailyAggregate[];
  unmappedMovements: EmployeeSalesDailyAggregate[];
};

/**
 * This is the only roster decision made from sanitized daily sales. The
 * private fetcher supplies aggregates, not provider rows or credentials.
 * Existing codes include separated employees: their movements are retained
 * without reactivating them or changing their primary assignment.
 */
export function planDailyPersonnelMovements(input: {
  aggregates: readonly SalesDailyAggregate[];
  knownPersonnelCodes: ReadonlySet<string>;
  allowedStoreCodes: ReadonlySet<string>;
  businessDate: string;
  scheduled: boolean;
  evaluatedAt: Date;
}): DailyPersonnelMovementPlan {
  const parsedBusinessDate = new Date(`${input.businessDate}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.businessDate) ||
    Number.isNaN(parsedBusinessDate.getTime()) ||
    parsedBusinessDate.toISOString().slice(0, 10) !== input.businessDate ||
    Number.isNaN(input.evaluatedAt.getTime())) {
    throw new TypeError("company_daily_kpi_invalid_personnel_plan_date");
  }
  const personnelMovements = input.aggregates.filter(
    (aggregate): aggregate is EmployeeSalesDailyAggregate => "personnelCode" in aggregate &&
      input.allowedStoreCodes.has(aggregate.storeCode),
  );
  const grains = new Set<string>();
  for (const movement of personnelMovements) {
    if (movement.businessDate !== input.businessDate ||
      !movement.personnelCode || !movement.storeCode ||
      grains.has(JSON.stringify([movement.storeCode, movement.personnelCode]))) {
      throw new TypeError("company_daily_kpi_invalid_personnel_movement_grain");
    }
    grains.add(JSON.stringify([movement.storeCode, movement.personnelCode]));
  }

  const bootstrapCandidates = selectDailyPersonnelBootstrapCandidates({
    aggregates: personnelMovements,
    knownPersonnelCodes: input.knownPersonnelCodes,
    allowedStoreCodes: input.allowedStoreCodes,
    mayBootstrapCurrentDay: input.scheduled && input.businessDate === previousIstanbulBusinessDate(input.evaluatedAt),
  });
  const bootstrapCodes = new Set(bootstrapCandidates.map(candidate => candidate.personnelCode));
  return {
    bootstrapCandidates,
    mappedMovements: personnelMovements.filter(movement =>
      input.knownPersonnelCodes.has(movement.personnelCode) || bootstrapCodes.has(movement.personnelCode)),
    unmappedMovements: personnelMovements.filter(movement =>
      !input.knownPersonnelCodes.has(movement.personnelCode) && !bootstrapCodes.has(movement.personnelCode)),
  };
}

function previousIstanbulBusinessDate(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const value = (part: string) => Number(parts.find(item => item.type === part)?.value);
  return new Date(Date.UTC(value("year"), value("month") - 1, value("day") - 1)).toISOString().slice(0, 10);
}

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
