import { BadRequestException, Injectable } from "@nestjs/common";
import {
  aggregateCompanyDailyKpiStoreRange,
  type CompanyDailyKpiStoreRangeProjection,
  type CompanyDailyKpiStoreRangeComponentSets,
  type StoreRangeResult,
} from "./company-daily-kpi-range-aggregation";
import {
  CompanyDailyKpiComponentRangeReadRepository,
  type CompanyDailyKpiStoreRangeRead,
  type CompanyDailyKpiStoreRangeReadInput,
  type CompanyDailyKpiStoreRangeReadOutcome,
} from "../infrastructure/company-daily-kpi-component-range-read.repository";
import type { ISODate } from "./company-daily-kpi-pure-adapter";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DIGEST_PATTERN = /^[0-9a-f]{64}$/;
const MAX_RANGE_DAYS = 366;
const MAX_STORE_IDS = 250;

@Injectable()
export class CompanyDailyKpiStoreRangeService {
  constructor(
    private readonly rangeReadRepository: CompanyDailyKpiComponentRangeReadRepository,
  ) {}

  async readStoreRange(
    input: CompanyDailyKpiStoreRangeReadInput,
  ): Promise<StoreRangeResult[]> {
    assertReadInput(input);
    const read = await this.rangeReadRepository.readStoreRange(input);
    const projection = buildProjection(read, input);
    return aggregateCompanyDailyKpiStoreRange(projection);
  }
}

function buildProjection(
  read: CompanyDailyKpiStoreRangeRead,
  input: CompanyDailyKpiStoreRangeReadInput,
): CompanyDailyKpiStoreRangeProjection {
  assertStorageEnvelope(read, input);

  const componentSets: CompanyDailyKpiStoreRangeComponentSets = {
    sales: [],
    footfall: [],
    gsm: [],
  };

  for (const outcome of read.outcomes) {
    const common = {
      businessDate: outcome.businessDate,
      status: outcome.status,
      projectionAggregateCount: outcome.storeFacts.length,
    } as const;

    if (outcome.operation === "sales") {
      componentSets.sales = [
        ...componentSets.sales,
        {
          ...common,
          operation: "sales" as const,
          aggregates: outcome.storeFacts.map((fact) => {
            if (!isSalesFact(fact)) {
              throw invalidEnvelope("company_daily_kpi_sales_fact_mismatch");
            }
            return {
              businessDate: fact.businessDate,
              storeCode: fact.storeCode,
              saleInvoiceCount: fact.saleInvoiceCount,
              returnInvoiceCount: fact.returnInvoiceCount,
              saleQuantity: fact.saleQuantity,
              signedReturnQuantity: fact.signedReturnQuantity,
              netQuantity: fact.netQuantity,
              saleAmountTry: fact.saleAmountTry,
              signedReturnAmountTry: fact.signedReturnAmountTry,
              netAmountTry: fact.netAmountTry,
            };
          }),
        },
      ];
    } else if (outcome.operation === "footfall") {
      componentSets.footfall = [
        ...componentSets.footfall,
        {
          ...common,
          operation: "footfall" as const,
          aggregates: outcome.storeFacts.map((fact) => {
            if (!isFootfallFact(fact)) {
              throw invalidEnvelope("company_daily_kpi_footfall_fact_mismatch");
            }
            return {
              businessDate: fact.businessDate,
              storeCode: fact.storeCode,
              footfall: fact.footfall,
            };
          }),
        },
      ];
    } else {
      componentSets.gsm = [
        ...componentSets.gsm,
        {
          ...common,
          operation: "gsm" as const,
          aggregates: outcome.storeFacts.map((fact) => {
            if (!isGsmFact(fact)) {
              throw invalidEnvelope("company_daily_kpi_gsm_fact_mismatch");
            }
            return {
              businessDate: fact.businessDate,
              storeCode: fact.storeCode,
              yesCustomerCount: fact.yesCustomerCount,
              totalCustomerCount: fact.totalCustomerCount,
            };
          }),
        },
      ];
    }
  }

  return {
    sourceCode: read.sourceCode,
    startDate: input.startDate,
    endDate: input.endDate,
    storeCodes: [...read.stores]
      .sort((left, right) => compareText(left.storeId, right.storeId))
      .map((store) => store.storeCode),
    componentSets,
  };
}

function assertStorageEnvelope(
  read: CompanyDailyKpiStoreRangeRead,
  input: CompanyDailyKpiStoreRangeReadInput,
): void {
  if (!isRecord(read) || !isRequiredCode(read.sourceCode)) {
    throw invalidEnvelope("company_daily_kpi_source_code_missing");
  }
  if (!Array.isArray(read.stores) || read.stores.length !== input.storeIds.length) {
    throw invalidEnvelope("company_daily_kpi_store_resolution_mismatch");
  }

  const requestedStoreIds = new Set(input.storeIds);
  const storeCodeById = new Map<string, string>();
  const seenStoreIds = new Set<string>();
  const seenStoreCodes = new Set<string>();
  for (const store of read.stores) {
    if (
      !isRecord(store) ||
      !isUuid(store.storeId) ||
      !isRequiredCode(store.storeCode) ||
      !requestedStoreIds.has(store.storeId) ||
      seenStoreIds.has(store.storeId) ||
      seenStoreCodes.has(store.storeCode)
    ) {
      throw invalidEnvelope("company_daily_kpi_store_resolution_mismatch");
    }
    seenStoreIds.add(store.storeId);
    seenStoreCodes.add(store.storeCode);
    storeCodeById.set(store.storeId, store.storeCode);
  }
  if (seenStoreIds.size !== requestedStoreIds.size) {
    throw invalidEnvelope("company_daily_kpi_store_resolution_mismatch");
  }

  if (!Array.isArray(read.outcomes)) {
    throw invalidEnvelope("company_daily_kpi_outcome_rows_missing");
  }
  const seenOutcomes = new Set<string>();
  for (const outcome of read.outcomes) {
    assertOutcomeEnvelope(
      outcome,
      input,
      requestedStoreIds,
      storeCodeById,
      seenOutcomes,
    );
  }
}

function assertOutcomeEnvelope(
  outcome: CompanyDailyKpiStoreRangeReadOutcome,
  input: CompanyDailyKpiStoreRangeReadInput,
  requestedStoreIds: ReadonlySet<string>,
  storeCodeById: ReadonlyMap<string, string>,
  seenOutcomes: Set<string>,
): void {
  if (!isRecord(outcome)) throw invalidEnvelope("company_daily_kpi_outcome_invalid");
  if (!isUuid(outcome.componentOutcomeId)) {
    throw invalidEnvelope("company_daily_kpi_outcome_identity_invalid");
  }
  if (!isIsoDate(outcome.businessDate)) {
    throw invalidEnvelope("company_daily_kpi_outcome_date_invalid");
  }
  if (
    compareText(outcome.businessDate, input.startDate) < 0 ||
    compareText(outcome.businessDate, input.endDate) > 0
  ) {
    throw invalidEnvelope("company_daily_kpi_outcome_date_invalid");
  }
  if (
    outcome.operation !== "sales" &&
    outcome.operation !== "footfall" &&
    outcome.operation !== "gsm"
  ) {
    throw invalidEnvelope("company_daily_kpi_operation_invalid");
  }
  const key = `${outcome.businessDate}:${outcome.operation}`;
  if (seenOutcomes.has(key)) {
    throw invalidEnvelope("company_daily_kpi_duplicate_outcome");
  }
  seenOutcomes.add(key);

  if (
    !isSafeCount(outcome.persistedAggregateCount) ||
    !isSafeCount(outcome.fullPhysicalFactCount) ||
    !Array.isArray(outcome.storeFacts)
  ) {
    throw invalidEnvelope("company_daily_kpi_outcome_count_invalid");
  }
  if (outcome.status === "succeeded") {
    if (
      outcome.sanitizedSetDigest === null ||
      !DIGEST_PATTERN.test(outcome.sanitizedSetDigest) ||
      outcome.persistedAggregateCount !== outcome.fullPhysicalFactCount
    ) {
      throw invalidEnvelope("company_daily_kpi_storage_integrity_mismatch");
    }
  } else if (outcome.status === "failed" || outcome.status === "missed") {
    if (
      outcome.persistedAggregateCount !== 0 ||
      outcome.fullPhysicalFactCount !== 0 ||
      outcome.sanitizedSetDigest !== null ||
      outcome.storeFacts.length !== 0
    ) {
      throw invalidEnvelope("company_daily_kpi_storage_integrity_mismatch");
    }
  } else {
    throw invalidEnvelope("company_daily_kpi_outcome_status_invalid");
  }

  const seenFacts = new Set<string>();
  for (const fact of outcome.storeFacts) {
    if (!isRecord(fact) || !isUuid(fact.storeId) || !isRequiredCode(fact.storeCode)) {
      throw invalidEnvelope("company_daily_kpi_store_fact_invalid");
    }
    if (
      !requestedStoreIds.has(fact.storeId) ||
      storeCodeById.get(fact.storeId) !== fact.storeCode ||
      seenFacts.has(fact.storeId) ||
      hasOwn(fact, "employeeId") ||
      hasOwn(fact, "employee_id") ||
      hasOwn(fact, "personnelCode") ||
      hasOwn(fact, "personnel_code")
    ) {
      throw invalidEnvelope("company_daily_kpi_store_fact_invalid");
    }
    if (fact.businessDate !== outcome.businessDate) {
      throw invalidEnvelope("company_daily_kpi_store_fact_date_invalid");
    }
    seenFacts.add(fact.storeId);
    if (outcome.status === "succeeded") {
      if (outcome.operation === "sales" && !isSalesFact(fact)) {
        throw invalidEnvelope("company_daily_kpi_sales_fact_invalid");
      }
      if (outcome.operation === "footfall" && !isFootfallFact(fact)) {
        throw invalidEnvelope("company_daily_kpi_footfall_fact_invalid");
      }
      if (outcome.operation === "gsm" && !isGsmFact(fact)) {
        throw invalidEnvelope("company_daily_kpi_gsm_fact_invalid");
      }
    }
  }
}

function isSalesFact(
  value: unknown,
): value is Extract<
  CompanyDailyKpiStoreRangeReadOutcome["storeFacts"][number],
  { saleInvoiceCount: number }
> {
  return (
    isRecord(value) &&
    isSafeCount(value.saleInvoiceCount) &&
    isSafeCount(value.returnInvoiceCount) &&
    isDecimalText(value.saleQuantity) &&
    isDecimalText(value.signedReturnQuantity) &&
    isDecimalText(value.netQuantity) &&
    isDecimalText(value.saleAmountTry) &&
    isDecimalText(value.signedReturnAmountTry) &&
    isDecimalText(value.netAmountTry) &&
    !hasOwn(value, "footfall") &&
    !hasOwn(value, "yesCustomerCount") &&
    !hasOwn(value, "totalCustomerCount")
  );
}

function isDecimalText(value: unknown): value is string {
  return typeof value === "string" && /^-?\d+(?:\.\d{1,12})?$/.test(value);
}

function isFootfallFact(
  value: unknown,
): value is Extract<
  CompanyDailyKpiStoreRangeReadOutcome["storeFacts"][number],
  { footfall: number }
> {
  return (
    isRecord(value) &&
    isSafeCount(value.footfall) &&
    !hasOwn(value, "saleInvoiceCount") &&
    !hasOwn(value, "yesCustomerCount") &&
    !hasOwn(value, "totalCustomerCount")
  );
}

function isGsmFact(
  value: unknown,
): value is Extract<
  CompanyDailyKpiStoreRangeReadOutcome["storeFacts"][number],
  { yesCustomerCount: number; totalCustomerCount: number }
> {
  return (
    isRecord(value) &&
    isSafeCount(value.yesCustomerCount) &&
    isSafeCount(value.totalCustomerCount) &&
    value.yesCustomerCount <= value.totalCustomerCount &&
    !hasOwn(value, "saleInvoiceCount") &&
    !hasOwn(value, "footfall")
  );
}

function assertReadInput(input: CompanyDailyKpiStoreRangeReadInput): void {
  if (!isRecord(input) || !isUuid(input.integrationSourceId)) {
    throw invalidEnvelope("company_daily_kpi_invalid_source_id");
  }
  if (!isIsoDate(input.startDate) || !isIsoDate(input.endDate)) {
    throw invalidEnvelope("company_daily_kpi_invalid_range_date");
  }
  if (compareText(input.startDate, input.endDate) > 0) {
    throw invalidEnvelope("company_daily_kpi_reversed_range");
  }
  if (calendarDaysInclusive(input.startDate, input.endDate) > MAX_RANGE_DAYS) {
    throw invalidEnvelope("company_daily_kpi_range_too_large");
  }
  if (!Array.isArray(input.storeIds) || input.storeIds.length === 0) {
    throw invalidEnvelope("company_daily_kpi_invalid_store_scope");
  }
  if (input.storeIds.length > MAX_STORE_IDS) {
    throw invalidEnvelope("company_daily_kpi_store_scope_too_large");
  }
  const seen = new Set<string>();
  for (const storeId of input.storeIds) {
    if (!isUuid(storeId) || seen.has(storeId)) {
      throw invalidEnvelope("company_daily_kpi_invalid_store_scope");
    }
    seen.add(storeId);
  }
}

function isSafeCount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  return day <= daysInMonth(year, month);
}

function calendarDaysInclusive(startDate: ISODate, endDate: ISODate): number {
  const start = parseDateParts(startDate);
  const end = parseDateParts(endDate);
  let year = start.year;
  let month = start.month;
  let day = start.day;
  let count = 0;

  while (compareDateParts(year, month, day, end) <= 0) {
    count += 1;
    if (count > MAX_RANGE_DAYS) return count;

    if (day === daysInMonth(year, month)) {
      day = 1;
      month += 1;
      if (month > 12) {
        month = 1;
        year += 1;
      }
    } else {
      day += 1;
    }
  }

  return count;
}

function parseDateParts(value: ISODate): {
  year: number;
  month: number;
  day: number;
} {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw invalidEnvelope("company_daily_kpi_invalid_range_date");
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

function compareDateParts(
  year: number,
  month: number,
  day: number,
  right: { year: number; month: number; day: number },
): number {
  if (year !== right.year) return year < right.year ? -1 : 1;
  if (month !== right.month) return month < right.month ? -1 : 1;
  if (day !== right.day) return day < right.day ? -1 : 1;
  return 0;
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
      ? 29
      : 28;
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function isRequiredCode(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value === value.trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function invalidEnvelope(message: string): BadRequestException {
  return new BadRequestException(message);
}

function compareText(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}
