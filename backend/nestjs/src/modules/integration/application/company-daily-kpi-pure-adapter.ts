import { createHash } from "node:crypto";

export type ISODate = string;
export type DecimalText = string;

export type NeutralSalesLine = {
  sourceDateToken: string;
  ephemeralInvoiceId: string;
  personnelCode: string;
  displayName?: string;
  storeCode: string;
  isReturn: boolean;
  quantity: DecimalText;
  amountTry: DecimalText;
};

export type NeutralFootfallRow = {
  sourceDateToken: string;
  storeCode: string;
  total: number;
};

export type NeutralGsmRow = {
  storeCode: string;
  consent: "yes" | "no";
};

export type NeutralStoreDirectoryRow = {
  storeCode: string;
  displayDescription?: string;
};

export type EmployeeSalesDailyAggregate = {
  businessDate: ISODate;
  storeCode: string;
  personnelCode: string;
  saleInvoiceCount: number;
  returnInvoiceCount: number;
  saleQuantity: DecimalText;
  signedReturnQuantity: DecimalText;
  netQuantity: DecimalText;
  saleAmountTry: DecimalText;
  signedReturnAmountTry: DecimalText;
  netAmountTry: DecimalText;
};

export type StoreSalesDailyAggregate = {
  businessDate: ISODate;
  storeCode: string;
  saleInvoiceCount: number;
  returnInvoiceCount: number;
  saleQuantity: DecimalText;
  signedReturnQuantity: DecimalText;
  netQuantity: DecimalText;
  saleAmountTry: DecimalText;
  signedReturnAmountTry: DecimalText;
  netAmountTry: DecimalText;
};

export type StoreFootfallDailyAggregate = {
  businessDate: ISODate;
  storeCode: string;
  footfall: number;
};

export type StoreGsmDailyAggregate = {
  businessDate: ISODate;
  storeCode: string;
  yesCustomerCount: number;
  totalCustomerCount: number;
};

export type CompanyDailySafeReasonCode =
  | "invalid_component_input"
  | "source_date_mismatch"
  | "invalid_decimal"
  | "invalid_return_sign"
  | "excluded_missing_personnel_code"
  | "duplicate_store_day"
  | "invalid_footfall"
  | "invalid_consent";

export type SanitizedComponentSet<TAggregate> = {
  sourceCode: string;
  operation: "sales" | "footfall" | "gsm";
  businessDate: ISODate;
  status: "succeeded" | "failed" | "missed";
  aggregates: TAggregate[];
  aggregateCount: number;
  retryCount: number;
  sanitizedSetDigest?: string;
  safeReasonCode?: CompanyDailySafeReasonCode;
};

export type SalesDailyAggregate =
  | EmployeeSalesDailyAggregate
  | StoreSalesDailyAggregate;

type NormalizeComponentInput<TRow> = {
  sourceCode: string;
  businessDate: ISODate;
  retryCount: number;
  rows: readonly TRow[];
};

type DecimalValue = {
  units: bigint;
  scale: number;
};

type MutableEmployeeSales = {
  storeCode: string;
  personnelCode: string;
  saleInvoices: Set<string>;
  returnInvoices: Set<string>;
  saleQuantity: DecimalValue;
  signedReturnQuantity: DecimalValue;
  saleAmountTry: DecimalValue;
  signedReturnAmountTry: DecimalValue;
};

type MutableStoreSales = {
  storeCode: string;
  saleInvoices: Set<string>;
  returnInvoices: Set<string>;
  saleQuantity: DecimalValue;
  signedReturnQuantity: DecimalValue;
  saleAmountTry: DecimalValue;
  signedReturnAmountTry: DecimalValue;
};

const ISTANBUL_TIME_ZONE = "Europe/Istanbul";
const ZERO_DECIMAL: DecimalValue = { units: 0n, scale: 0 };

export function normalizeCompanyDailySales(
  input: NormalizeComponentInput<NeutralSalesLine>,
): SanitizedComponentSet<SalesDailyAggregate> {
  assertCommonInput(input);

  const employeeSales = new Map<string, MutableEmployeeSales>();
  const storeSales = new Map<string, MutableStoreSales>();
  let excludedMissingPersonnel = false;

  for (const row of input.rows) {
    if (resolveIstanbulDate(row.sourceDateToken) !== input.businessDate) {
      return failedSet(input, "sales", "source_date_mismatch");
    }

    if (
      !isRequiredCode(row.storeCode) ||
      typeof row.ephemeralInvoiceId !== "string" ||
      row.ephemeralInvoiceId.length === 0 ||
      typeof row.isReturn !== "boolean"
    ) {
      return failedSet(input, "sales", "invalid_component_input");
    }

    const quantity = parseDecimal(row.quantity);
    const amountTry = parseDecimal(row.amountTry);

    if (quantity === null || amountTry === null) {
      return failedSet(input, "sales", "invalid_decimal");
    }

    if (row.isReturn && (quantity.units >= 0n || amountTry.units >= 0n)) {
      return failedSet(input, "sales", "invalid_return_sign");
    }

    const store = storeSales.get(row.storeCode) ?? {
      storeCode: row.storeCode,
      saleInvoices: new Set<string>(),
      returnInvoices: new Set<string>(),
      saleQuantity: ZERO_DECIMAL,
      signedReturnQuantity: ZERO_DECIMAL,
      saleAmountTry: ZERO_DECIMAL,
      signedReturnAmountTry: ZERO_DECIMAL,
    };

    if (row.isReturn) {
      store.returnInvoices.add(row.ephemeralInvoiceId);
      store.signedReturnQuantity = addDecimal(
        store.signedReturnQuantity,
        quantity,
      );
      store.signedReturnAmountTry = addDecimal(
        store.signedReturnAmountTry,
        amountTry,
      );
    } else {
      store.saleInvoices.add(row.ephemeralInvoiceId);
      store.saleQuantity = addDecimal(store.saleQuantity, quantity);
      store.saleAmountTry = addDecimal(store.saleAmountTry, amountTry);
    }

    storeSales.set(row.storeCode, store);

    if (!isRequiredCode(row.personnelCode)) {
      excludedMissingPersonnel = true;
      continue;
    }

    const employeeKey = JSON.stringify([row.storeCode, row.personnelCode]);
    const employee = employeeSales.get(employeeKey) ?? {
      storeCode: row.storeCode,
      personnelCode: row.personnelCode,
      saleInvoices: new Set<string>(),
      returnInvoices: new Set<string>(),
      saleQuantity: ZERO_DECIMAL,
      signedReturnQuantity: ZERO_DECIMAL,
      saleAmountTry: ZERO_DECIMAL,
      signedReturnAmountTry: ZERO_DECIMAL,
    };

    if (row.isReturn) {
      employee.returnInvoices.add(row.ephemeralInvoiceId);
      employee.signedReturnQuantity = addDecimal(
        employee.signedReturnQuantity,
        quantity,
      );
      employee.signedReturnAmountTry = addDecimal(
        employee.signedReturnAmountTry,
        amountTry,
      );
    } else {
      employee.saleInvoices.add(row.ephemeralInvoiceId);
      employee.saleQuantity = addDecimal(employee.saleQuantity, quantity);
      employee.saleAmountTry = addDecimal(employee.saleAmountTry, amountTry);
    }

    employeeSales.set(employeeKey, employee);
  }

  const employeeAggregates: EmployeeSalesDailyAggregate[] = [
    ...employeeSales.values(),
  ]
    .sort(compareEmployeeSales)
    .map((aggregate) => ({
      businessDate: input.businessDate,
      storeCode: aggregate.storeCode,
      personnelCode: aggregate.personnelCode,
      saleInvoiceCount: aggregate.saleInvoices.size,
      returnInvoiceCount: aggregate.returnInvoices.size,
      saleQuantity: formatDecimal(aggregate.saleQuantity),
      signedReturnQuantity: formatDecimal(aggregate.signedReturnQuantity),
      netQuantity: formatDecimal(
        addDecimal(aggregate.saleQuantity, aggregate.signedReturnQuantity),
      ),
      saleAmountTry: formatDecimal(aggregate.saleAmountTry),
      signedReturnAmountTry: formatDecimal(aggregate.signedReturnAmountTry),
      netAmountTry: formatDecimal(
        addDecimal(aggregate.saleAmountTry, aggregate.signedReturnAmountTry),
      ),
    }));
  const storeAggregates: StoreSalesDailyAggregate[] = [...storeSales.values()]
    .sort((left, right) => compareText(left.storeCode, right.storeCode))
    .map((aggregate) => ({
      businessDate: input.businessDate,
      storeCode: aggregate.storeCode,
      saleInvoiceCount: aggregate.saleInvoices.size,
      returnInvoiceCount: aggregate.returnInvoices.size,
      saleQuantity: formatDecimal(aggregate.saleQuantity),
      signedReturnQuantity: formatDecimal(aggregate.signedReturnQuantity),
      netQuantity: formatDecimal(
        addDecimal(aggregate.saleQuantity, aggregate.signedReturnQuantity),
      ),
      saleAmountTry: formatDecimal(aggregate.saleAmountTry),
      signedReturnAmountTry: formatDecimal(aggregate.signedReturnAmountTry),
      netAmountTry: formatDecimal(
        addDecimal(aggregate.saleAmountTry, aggregate.signedReturnAmountTry),
      ),
    }));

  return succeededSet(
    input,
    "sales",
    [...employeeAggregates, ...storeAggregates],
    excludedMissingPersonnel ? "excluded_missing_personnel_code" : undefined,
  );
}

export function normalizeCompanyDailyFootfall(
  input: NormalizeComponentInput<NeutralFootfallRow>,
): SanitizedComponentSet<StoreFootfallDailyAggregate> {
  assertCommonInput(input);

  const aggregates = new Map<string, StoreFootfallDailyAggregate>();

  for (const row of input.rows) {
    if (resolveIstanbulDate(row.sourceDateToken) !== input.businessDate) {
      return failedSet(input, "footfall", "source_date_mismatch");
    }

    if (!isRequiredCode(row.storeCode)) {
      return failedSet(input, "footfall", "invalid_component_input");
    }

    if (!Number.isSafeInteger(row.total) || row.total < 0) {
      return failedSet(input, "footfall", "invalid_footfall");
    }

    if (aggregates.has(row.storeCode)) {
      return failedSet(input, "footfall", "duplicate_store_day");
    }

    aggregates.set(row.storeCode, {
      businessDate: input.businessDate,
      storeCode: row.storeCode,
      footfall: row.total,
    });
  }

  return succeededSet(
    input,
    "footfall",
    [...aggregates.values()].sort((left, right) =>
      compareText(left.storeCode, right.storeCode),
    ),
  );
}

export function normalizeCompanyDailyGsm(
  input: NormalizeComponentInput<NeutralGsmRow>,
): SanitizedComponentSet<StoreGsmDailyAggregate> {
  assertCommonInput(input);

  const counts = new Map<
    string,
    { yesCustomerCount: number; totalCustomerCount: number }
  >();

  for (const row of input.rows) {
    if (!isRequiredCode(row.storeCode)) {
      return failedSet(input, "gsm", "invalid_component_input");
    }

    if (row.consent !== "yes" && row.consent !== "no") {
      return failedSet(input, "gsm", "invalid_consent");
    }

    const aggregate = counts.get(row.storeCode) ?? {
      yesCustomerCount: 0,
      totalCustomerCount: 0,
    };
    aggregate.totalCustomerCount += 1;
    if (row.consent === "yes") aggregate.yesCustomerCount += 1;
    counts.set(row.storeCode, aggregate);
  }

  return succeededSet(
    input,
    "gsm",
    [...counts.entries()]
      .sort(([left], [right]) => compareText(left, right))
      .map(([storeCode, aggregate]) => ({
        businessDate: input.businessDate,
        storeCode,
        yesCustomerCount: aggregate.yesCustomerCount,
        totalCustomerCount: aggregate.totalCustomerCount,
      })),
  );
}

export function sanitizeCompanyStoreDirectory(
  rows: readonly NeutralStoreDirectoryRow[],
): string[] {
  const codes = new Set<string>();

  for (const row of rows) {
    if (!isRequiredCode(row.storeCode)) {
      throw new TypeError("Invalid company store-directory input");
    }
    codes.add(row.storeCode);
  }

  return [...codes].sort(compareText);
}

function assertCommonInput(input: NormalizeComponentInput<unknown>): void {
  if (
    !isRequiredCode(input.sourceCode) ||
    !isIsoDate(input.businessDate) ||
    !Number.isSafeInteger(input.retryCount) ||
    input.retryCount < 0 ||
    !Array.isArray(input.rows)
  ) {
    throw new TypeError("Invalid company daily KPI adapter input");
  }
}

function succeededSet<TAggregate>(
  input: NormalizeComponentInput<unknown>,
  operation: "sales" | "footfall" | "gsm",
  aggregates: TAggregate[],
  safeReasonCode?: CompanyDailySafeReasonCode,
): SanitizedComponentSet<TAggregate> {
  const identity = {
    sourceCode: input.sourceCode,
    operation,
    businessDate: input.businessDate,
    aggregates,
  };

  return {
    sourceCode: input.sourceCode,
    operation,
    businessDate: input.businessDate,
    status: "succeeded",
    aggregates,
    aggregateCount: aggregates.length,
    retryCount: input.retryCount,
    ...(safeReasonCode === undefined ? {} : { safeReasonCode }),
    sanitizedSetDigest: createHash("sha256")
      .update(JSON.stringify(identity), "utf8")
      .digest("hex"),
  };
}

function failedSet<TAggregate>(
  input: NormalizeComponentInput<unknown>,
  operation: "sales" | "footfall" | "gsm",
  safeReasonCode: CompanyDailySafeReasonCode,
): SanitizedComponentSet<TAggregate> {
  return {
    sourceCode: input.sourceCode,
    operation,
    businessDate: input.businessDate,
    status: "failed",
    aggregates: [],
    aggregateCount: 0,
    retryCount: input.retryCount,
    safeReasonCode,
  };
}

function isRequiredCode(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value === value.trim();
}

function resolveIstanbulDate(value: unknown): ISODate | null {
  if (typeof value !== "string") return null;
  if (isIsoDate(value)) return value;
  if (!/(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: ISTANBUL_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );

  return `${parts.year}-${parts.month}-${parts.day}`;
}

function isIsoDate(value: unknown): value is ISODate {
  if (typeof value !== "string") return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function parseDecimal(value: unknown): DecimalValue | null {
  if (typeof value !== "string") return null;
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(value);
  if (!match) return null;

  const [, sign, whole, fraction = ""] = match;
  const units = BigInt(`${whole}${fraction}`);

  return {
    units: sign === "-" ? -units : units,
    scale: fraction.length,
  };
}

function addDecimal(left: DecimalValue, right: DecimalValue): DecimalValue {
  const scale = Math.max(left.scale, right.scale);

  return {
    units:
      left.units * pow10(scale - left.scale) +
      right.units * pow10(scale - right.scale),
    scale,
  };
}

function formatDecimal(value: DecimalValue): DecimalText {
  if (value.units === 0n) return "0";

  const sign = value.units < 0n ? "-" : "";
  const absolute = value.units < 0n ? -value.units : value.units;

  if (value.scale === 0) return `${sign}${absolute.toString()}`;

  const digits = absolute.toString().padStart(value.scale + 1, "0");
  const whole = digits.slice(0, -value.scale);
  const fraction = digits.slice(-value.scale).replace(/0+$/, "");

  return fraction.length > 0 ? `${sign}${whole}.${fraction}` : `${sign}${whole}`;
}

function pow10(scale: number): bigint {
  return 10n ** BigInt(scale);
}

function compareEmployeeSales(
  left: MutableEmployeeSales,
  right: MutableEmployeeSales,
): number {
  return (
    compareText(left.storeCode, right.storeCode) ||
    compareText(left.personnelCode, right.personnelCode)
  );
}

function compareText(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}
