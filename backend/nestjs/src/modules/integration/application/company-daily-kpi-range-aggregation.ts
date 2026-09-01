import type {
  ISODate,
  SalesDailyAggregate,
  SanitizedComponentSet,
  StoreFootfallDailyAggregate,
  StoreGsmDailyAggregate,
  StoreSalesDailyAggregate,
} from "./company-daily-kpi-pure-adapter";

export type IntegerText = string;

export type RangeCoverage = {
  expectedDays: ISODate[];
  includedDays: ISODate[];
  missingDays: ISODate[];
  warning?: "incomplete_coverage";
};

export type ExactRatio =
  | {
      availability: "available";
      numerator: IntegerText;
      denominator: IntegerText;
    }
  | {
      availability: "unavailable";
      reason: "no_eligible_days";
    };

export type RatioWithCoverage = {
  ratio: ExactRatio;
  coverage: RangeCoverage;
};

export type StoreRangeResult = {
  storeCode: string;
  conversion: RatioWithCoverage;
  gsmRate: RatioWithCoverage;
};

type CompanyDailyKpiOperation = "sales" | "footfall" | "gsm";

export type CompanyDailyKpiComponentSet<
  TAggregate,
  TOperation extends CompanyDailyKpiOperation,
> = Readonly<
  Omit<SanitizedComponentSet<TAggregate>, "operation" | "aggregates">
> & {
  operation: TOperation;
  aggregates: readonly TAggregate[];
};

export type CompanyDailyKpiComponentSets = {
  sales: readonly CompanyDailyKpiComponentSet<
    SalesDailyAggregate,
    "sales"
  >[];
  footfall: readonly CompanyDailyKpiComponentSet<
    StoreFootfallDailyAggregate,
    "footfall"
  >[];
  gsm: readonly CompanyDailyKpiComponentSet<
    StoreGsmDailyAggregate,
    "gsm"
  >[];
};

export type CompanyDailyKpiStoreRangeInput = {
  sourceCode: string;
  startDate: ISODate;
  endDate: ISODate;
  storeCodes: readonly string[];
  componentSets: CompanyDailyKpiComponentSets;
};

type ValidatedInput = {
  startDate: ISODate;
  endDate: ISODate;
  storeCodes: readonly string[];
  componentSets: CompanyDailyKpiComponentSets;
};

type ValidatedComponentSets = {
  sales: Map<
    ISODate,
    CompanyDailyKpiComponentSet<SalesDailyAggregate, "sales">
  >;
  footfall: Map<
    ISODate,
    CompanyDailyKpiComponentSet<StoreFootfallDailyAggregate, "footfall">
  >;
  gsm: Map<
    ISODate,
    CompanyDailyKpiComponentSet<StoreGsmDailyAggregate, "gsm">
  >;
};

const INVALID_INPUT_MESSAGE = "Invalid company daily KPI range input";

/**
 * Reduces independently-owned daily component sets into deterministic,
 * store-scoped exact ratios. This function is deliberately application-pure:
 * it performs no I/O and does not expose component or personnel metadata.
 */
export function aggregateCompanyDailyKpiStoreRange(
  input: CompanyDailyKpiStoreRangeInput,
): StoreRangeResult[] {
  const validated = validateInput(input);
  const expectedDays = enumerateDays(validated.startDate, validated.endDate);
  const componentSets = indexComponentSets(validated);

  return [...validated.storeCodes]
    .sort(compareText)
    .map((storeCode) => {
      const conversion = aggregateConversion(
        storeCode,
        expectedDays,
        componentSets.sales,
        componentSets.footfall,
      );
      const gsmRate = aggregateGsm(
        storeCode,
        expectedDays,
        componentSets.gsm,
      );

      return { storeCode, conversion, gsmRate };
    });
}

function validateInput(
  input: CompanyDailyKpiStoreRangeInput,
): ValidatedInput {
  if (!isRecord(input)) throw invalidInput();
  if (!isRequiredCode(input.sourceCode)) throw invalidInput();
  if (!isIsoDate(input.startDate) || !isIsoDate(input.endDate)) {
    throw invalidInput();
  }
  if (compareText(input.startDate, input.endDate) > 0) throw invalidInput();
  if (!Array.isArray(input.storeCodes)) throw invalidInput();

  const storeCodes = new Set<string>();
  for (const storeCode of input.storeCodes) {
    if (!isRequiredCode(storeCode) || storeCodes.has(storeCode)) {
      throw invalidInput();
    }
    storeCodes.add(storeCode);
  }

  if (!isRecord(input.componentSets)) throw invalidInput();
  if (
    !Array.isArray(input.componentSets.sales) ||
    !Array.isArray(input.componentSets.footfall) ||
    !Array.isArray(input.componentSets.gsm)
  ) {
    throw invalidInput();
  }

  const expectedStart = input.startDate;
  const expectedEnd = input.endDate;
  const componentSets = {
    sales: input.componentSets.sales,
    footfall: input.componentSets.footfall,
    gsm: input.componentSets.gsm,
  };

  validateComponentSets(
    componentSets.sales,
    "sales",
    input.sourceCode,
    expectedStart,
    expectedEnd,
  );
  validateComponentSets(
    componentSets.footfall,
    "footfall",
    input.sourceCode,
    expectedStart,
    expectedEnd,
  );
  validateComponentSets(
    componentSets.gsm,
    "gsm",
    input.sourceCode,
    expectedStart,
    expectedEnd,
  );

  return {
    startDate: input.startDate,
    endDate: input.endDate,
    storeCodes: [...storeCodes],
    componentSets,
  };
}

function validateComponentSets<
  TAggregate,
  TOperation extends CompanyDailyKpiOperation,
>(
  sets: readonly CompanyDailyKpiComponentSet<TAggregate, TOperation>[],
  expectedOperation: TOperation,
  sourceCode: string,
  startDate: ISODate,
  endDate: ISODate,
): void {
  const seenDates = new Set<ISODate>();

  for (const componentSet of sets) {
    if (!isRecord(componentSet)) throw invalidInput();
    if (componentSet.operation !== expectedOperation) throw invalidInput();
    if (componentSet.sourceCode !== sourceCode) throw invalidInput();
    if (!isIsoDate(componentSet.businessDate)) throw invalidInput();
    if (
      compareText(componentSet.businessDate, startDate) < 0 ||
      compareText(componentSet.businessDate, endDate) > 0
    ) {
      throw invalidInput();
    }
    if (seenDates.has(componentSet.businessDate)) throw invalidInput();
    seenDates.add(componentSet.businessDate);
    if (!Array.isArray(componentSet.aggregates)) throw invalidInput();
    if (!isSafeCount(componentSet.aggregateCount)) throw invalidInput();
    if (!isSafeCount(componentSet.retryCount)) throw invalidInput();

    if (componentSet.status === "succeeded") {
      if (componentSet.aggregateCount !== componentSet.aggregates.length) {
        throw invalidInput();
      }
    } else if (
      componentSet.status === "failed" ||
      componentSet.status === "missed"
    ) {
      if (componentSet.aggregateCount !== 0 || componentSet.aggregates.length) {
        throw invalidInput();
      }
    } else {
      throw invalidInput();
    }

    validateAggregates(
      componentSet.aggregates,
      expectedOperation,
      componentSet.businessDate,
    );
  }
}

function validateAggregates(
  aggregates: readonly unknown[],
  operation: CompanyDailyKpiOperation,
  businessDate: ISODate,
): void {
  const seenStoreFacts = new Set<string>();

  for (const aggregate of aggregates) {
    if (!isRecord(aggregate)) throw invalidInput();
    if (aggregate.businessDate !== businessDate) throw invalidInput();
    if (!isRequiredCode(aggregate.storeCode)) throw invalidInput();

    if (operation === "sales") {
      if (hasOwn(aggregate, "personnelCode")) {
        validateEmployeeSalesAggregate(aggregate);
      } else {
        validateStoreSalesAggregate(aggregate);
        assertUniqueStoreFact(seenStoreFacts, aggregate.storeCode);
      }
    } else if (operation === "footfall") {
      if (hasOwn(aggregate, "personnelCode")) throw invalidInput();
      validateFootfallAggregate(aggregate);
      assertUniqueStoreFact(seenStoreFacts, aggregate.storeCode);
    } else {
      if (hasOwn(aggregate, "personnelCode")) throw invalidInput();
      validateGsmAggregate(aggregate);
      assertUniqueStoreFact(seenStoreFacts, aggregate.storeCode);
    }
  }
}

function validateEmployeeSalesAggregate(
  aggregate: Record<string, unknown>,
): void {
  if (!isRequiredCode(aggregate.personnelCode)) throw invalidInput();
  for (const field of ["saleInvoiceCount", "returnInvoiceCount"] as const) {
    if (!isSafeCount(aggregate[field])) throw invalidInput();
  }
  for (const field of [
    "saleQuantity",
    "signedReturnQuantity",
    "netQuantity",
    "saleAmountTry",
    "signedReturnAmountTry",
    "netAmountTry",
  ] as const) {
    if (typeof aggregate[field] !== "string") throw invalidInput();
  }
}

function validateStoreSalesAggregate(
  aggregate: Record<string, unknown>,
): void {
  if (!isSafeCount(aggregate.saleInvoiceCount)) throw invalidInput();
  if (!isSafeCount(aggregate.returnInvoiceCount)) throw invalidInput();
}

function validateFootfallAggregate(
  aggregate: Record<string, unknown>,
): void {
  if (!isSafeCount(aggregate.footfall)) throw invalidInput();
}

function validateGsmAggregate(aggregate: Record<string, unknown>): void {
  if (!isSafeCount(aggregate.yesCustomerCount)) throw invalidInput();
  if (!isSafeCount(aggregate.totalCustomerCount)) throw invalidInput();
  if (aggregate.yesCustomerCount > aggregate.totalCustomerCount) {
    throw invalidInput();
  }
}

function assertUniqueStoreFact(
  seenStoreFacts: Set<string>,
  storeCode: string,
): void {
  if (seenStoreFacts.has(storeCode)) throw invalidInput();
  seenStoreFacts.add(storeCode);
}

function indexComponentSets(input: ValidatedInput): ValidatedComponentSets {
  return {
    sales: new Map(
      input.componentSets.sales.map((componentSet) => [
        componentSet.businessDate,
        componentSet,
      ]),
    ),
    footfall: new Map(
      input.componentSets.footfall.map((componentSet) => [
        componentSet.businessDate,
        componentSet,
      ]),
    ),
    gsm: new Map(
      input.componentSets.gsm.map((componentSet) => [
        componentSet.businessDate,
        componentSet,
      ]),
    ),
  };
}

function aggregateConversion(
  storeCode: string,
  expectedDays: readonly ISODate[],
  salesSets: ReadonlyMap<
    ISODate,
    CompanyDailyKpiComponentSet<SalesDailyAggregate, "sales">
  >,
  footfallSets: ReadonlyMap<
    ISODate,
    CompanyDailyKpiComponentSet<StoreFootfallDailyAggregate, "footfall">
  >,
): RatioWithCoverage {
  let numerator = 0n;
  let denominator = 0n;
  const includedDays: ISODate[] = [];
  const missingDays: ISODate[] = [];

  for (const day of expectedDays) {
    const salesSet = salesSets.get(day);
    const footfallSet = footfallSets.get(day);
    const salesFact = salesSet?.status === "succeeded"
      ? findStoreSalesFact(salesSet.aggregates, storeCode)
      : undefined;
    const footfallFact = footfallSet?.status === "succeeded"
      ? findFootfallFact(footfallSet.aggregates, storeCode)
      : undefined;

    if (
      salesFact !== undefined &&
      footfallFact !== undefined &&
      footfallFact.footfall > 0
    ) {
      numerator += BigInt(salesFact.saleInvoiceCount);
      denominator += BigInt(footfallFact.footfall);
      includedDays.push(day);
    } else {
      missingDays.push(day);
    }
  }

  return ratioWithCoverage(numerator, denominator, expectedDays, includedDays, missingDays);
}

function aggregateGsm(
  storeCode: string,
  expectedDays: readonly ISODate[],
  gsmSets: ReadonlyMap<
    ISODate,
    CompanyDailyKpiComponentSet<StoreGsmDailyAggregate, "gsm">
  >,
): RatioWithCoverage {
  let numerator = 0n;
  let denominator = 0n;
  const includedDays: ISODate[] = [];
  const missingDays: ISODate[] = [];

  for (const day of expectedDays) {
    const gsmSet = gsmSets.get(day);
    const gsmFact = gsmSet?.status === "succeeded"
      ? findGsmFact(gsmSet.aggregates, storeCode)
      : undefined;

    if (gsmFact !== undefined && gsmFact.totalCustomerCount > 0) {
      numerator += BigInt(gsmFact.yesCustomerCount);
      denominator += BigInt(gsmFact.totalCustomerCount);
      includedDays.push(day);
    } else {
      missingDays.push(day);
    }
  }

  return ratioWithCoverage(numerator, denominator, expectedDays, includedDays, missingDays);
}

function findStoreSalesFact(
  aggregates: readonly SalesDailyAggregate[],
  storeCode: string,
): StoreSalesDailyAggregate | undefined {
  return aggregates.find(
    (aggregate): aggregate is StoreSalesDailyAggregate =>
      aggregate.storeCode === storeCode && !hasOwn(aggregate, "personnelCode"),
  );
}

function findFootfallFact(
  aggregates: readonly StoreFootfallDailyAggregate[],
  storeCode: string,
): StoreFootfallDailyAggregate | undefined {
  return aggregates.find((aggregate) => aggregate.storeCode === storeCode);
}

function findGsmFact(
  aggregates: readonly StoreGsmDailyAggregate[],
  storeCode: string,
): StoreGsmDailyAggregate | undefined {
  return aggregates.find((aggregate) => aggregate.storeCode === storeCode);
}

function ratioWithCoverage(
  numerator: bigint,
  denominator: bigint,
  expectedDays: readonly ISODate[],
  includedDays: readonly ISODate[],
  missingDays: readonly ISODate[],
): RatioWithCoverage {
  const coverage: RangeCoverage = {
    expectedDays: [...expectedDays],
    includedDays: [...includedDays],
    missingDays: [...missingDays],
    ...(missingDays.length > 0 ? { warning: "incomplete_coverage" } : {}),
  };

  return {
    ratio:
      denominator > 0n
        ? {
            availability: "available",
            numerator: numerator.toString(10),
            denominator: denominator.toString(10),
          }
        : { availability: "unavailable", reason: "no_eligible_days" },
    coverage,
  };
}

function enumerateDays(startDate: ISODate, endDate: ISODate): ISODate[] {
  const days: ISODate[] = [];
  const cursor = dateToUtc(startDate);
  const end = dateToUtc(endDate);

  while (cursor.getTime() <= end.getTime()) {
    days.push(formatIsoDate(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return days;
}

function dateToUtc(value: ISODate): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw invalidInput();
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return date;
}

function formatIsoDate(value: Date): ISODate {
  return `${value.getUTCFullYear().toString().padStart(4, "0")}-${(value.getUTCMonth() + 1)
    .toString()
    .padStart(2, "0")}-${value.getUTCDate().toString().padStart(2, "0")}`;
}

function isIsoDate(value: unknown): value is ISODate {
  if (typeof value !== "string") return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;

  return day <= daysInMonth(year, month);
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28;
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function isRequiredCode(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value === value.trim();
}

function isSafeCount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function invalidInput(): TypeError {
  return new TypeError(INVALID_INPUT_MESSAGE);
}

function compareText(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}
