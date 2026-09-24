export const SALES_TARGET_INCENTIVE_RULE_VERSION =
  "sales-target-incentive-v1.0.0";
export const MANAGER_RATE_TABLE_VERSION = "manager-sales-target-v1.0.0";
export const PERSONNEL_RATE_TABLE_VERSION = "personnel-sales-target-v1.0.0";
export const SALES_TARGET_INCENTIVE_TIMEZONE = "Europe/Istanbul";

export type SalesTargetIncentiveStoreOwnershipType =
  | "company"
  | "franchise"
  | "operator";

export type SalesTargetIncentiveInputPositionCode =
  | "STORE_MANAGER"
  | "ASSISTANT_MANAGER"
  | "SENIOR_SALES_CONSULTANT"
  | "SALES_ASSOCIATE"
  | "SHIFT_LEAD"
  | "CASHIER";

export type SalesTargetIncentiveEligiblePositionCode =
  | "STORE_MANAGER"
  | "ASSISTANT_MANAGER"
  | "SENIOR_SALES_CONSULTANT"
  | "SALES_ASSOCIATE";

export type SalesTargetIncentiveCalculationStatus =
  | "projected"
  | "blocked"
  | "no_source"
  | "excluded";

export type SalesTargetIncentiveReason =
  | "missing_store_target"
  | "invalid_store_target"
  | "missing_personnel_target"
  | "invalid_personnel_target"
  | "missing_store_sales_source"
  | "missing_personnel_sales_source"
  | "cashier_excluded_v1"
  | "store_manager_uses_manager_formula_v1"
  | "non_company_store_excluded_v1";

export type SalesTargetIncentiveCalculationResult = {
  status: SalesTargetIncentiveCalculationStatus;
  blockedReason: SalesTargetIncentiveReason | null;
  excludedReason: SalesTargetIncentiveReason | null;
  ruleVersionCode: typeof SALES_TARGET_INCENTIVE_RULE_VERSION;
  rateTableVersion:
    | typeof MANAGER_RATE_TABLE_VERSION
    | typeof PERSONNEL_RATE_TABLE_VERSION;
  positionCode: SalesTargetIncentiveEligiblePositionCode | null;
  normalizedFromPositionCode: "SHIFT_LEAD" | null;
  storeAchievementPct: string | null;
  storeGatePassed: boolean | null;
  achievementPct: string | null;
  personalRateBeforeGate: string | null;
  rate: string | null;
  rawEarnedAmount: string | null;
  payableAmount: string | null;
};

export type SalesTargetIncentiveManagerInput = {
  storeOwnershipType: SalesTargetIncentiveStoreOwnershipType;
  storeTarget: string | null;
  storeActualNetSales: string | null;
};

export type SalesTargetIncentivePersonnelInput = {
  storeOwnershipType: SalesTargetIncentiveStoreOwnershipType;
  positionCode: SalesTargetIncentiveInputPositionCode;
  storeTarget: string | null;
  storeActualNetSales: string | null;
  personnelTarget: string | null;
  personnelActualPositiveSales: string | null;
};

export type SalesTargetIncentivePeriodResolution =
  | { status: "resolved"; periodKey: string }
  | { status: "blocked"; blockedReason: "ambiguous_source_period" };

export type SalesTargetIncentiveImportInclusion =
  | { included: true }
  | {
      included: false;
      excludedReason:
        | "not_accepted_import"
        | "ambiguous_source_period"
        | "source_period_mismatch"
        | "accepted_after_close_cutoff";
    };

type DecimalValue = {
  units: bigint;
  scale: number;
};

type RateBracket = {
  minPct: string | null;
  rate: string;
};

const MANAGER_RATE_BRACKETS: RateBracket[] = [
  { minPct: "110.0000", rate: "0.0100" },
  { minPct: "100.0000", rate: "0.0070" },
  { minPct: "95.0000", rate: "0.0050" },
  { minPct: "90.0000", rate: "0.0040" },
  { minPct: "85.0000", rate: "0.0030" },
  { minPct: "80.0000", rate: "0.0020" },
  { minPct: null, rate: "0.0000" },
];

const PERSONNEL_RATE_BRACKETS: RateBracket[] = [
  { minPct: "110.0000", rate: "0.0165" },
  { minPct: "100.0000", rate: "0.0150" },
  { minPct: "95.0000", rate: "0.0075" },
  { minPct: "90.0000", rate: "0.0065" },
  { minPct: "85.0000", rate: "0.0050" },
  { minPct: "80.0000", rate: "0.0050" },
  { minPct: null, rate: "0.0000" },
];

export class SalesTargetIncentiveCalculatorService {
  calculateManager(
    input: SalesTargetIncentiveManagerInput,
  ): SalesTargetIncentiveCalculationResult {
    if (input.storeOwnershipType !== "company") {
      return this.excludedResult({
        rateTableVersion: MANAGER_RATE_TABLE_VERSION,
        positionCode: "STORE_MANAGER",
        excludedReason: "non_company_store_excluded_v1",
      });
    }

    const storeTargetValidation = this.validatePositiveSource({
      value: input.storeTarget,
      missingReason: "missing_store_target",
      invalidReason: "invalid_store_target",
      rateTableVersion: MANAGER_RATE_TABLE_VERSION,
      positionCode: "STORE_MANAGER",
    });

    if (storeTargetValidation.status !== "valid") {
      return storeTargetValidation.result;
    }

    if (input.storeActualNetSales === null) {
      return this.noSourceResult({
        reason: "missing_store_sales_source",
        rateTableVersion: MANAGER_RATE_TABLE_VERSION,
        positionCode: "STORE_MANAGER",
      });
    }

    const storeActualNetSales = parseDecimal(input.storeActualNetSales);
    const rate = selectRateByAchievement({
      actual: storeActualNetSales,
      target: storeTargetValidation.decimal,
      brackets: MANAGER_RATE_BRACKETS,
    });
    const rawEarnedAmount = multiplyDecimalToMinimumScale({
      multiplicand: storeActualNetSales,
      multiplier: parseDecimal(rate),
      minimumOutputScale: 6,
    });

    return {
      ...this.baseResult(MANAGER_RATE_TABLE_VERSION),
      status: "projected",
      positionCode: "STORE_MANAGER",
      achievementPct: formatAchievementPct({
        actual: storeActualNetSales,
        target: storeTargetValidation.decimal,
      }),
      rate,
      rawEarnedAmount,
      payableAmount: truncateSalesTargetIncentivePayable(rawEarnedAmount),
    };
  }

  calculatePersonnel(
    input: SalesTargetIncentivePersonnelInput,
  ): SalesTargetIncentiveCalculationResult {
    if (input.storeOwnershipType !== "company") {
      return this.excludedResult({
        rateTableVersion: PERSONNEL_RATE_TABLE_VERSION,
        positionCode: null,
        excludedReason: "non_company_store_excluded_v1",
      });
    }

    if (input.positionCode === "STORE_MANAGER") {
      return this.excludedResult({
        rateTableVersion: PERSONNEL_RATE_TABLE_VERSION,
        positionCode: null,
        excludedReason: "store_manager_uses_manager_formula_v1",
      });
    }

    const position = normalizeSalesTargetIncentivePosition(input.positionCode);

    if (position === null) {
      return this.excludedResult({
        rateTableVersion: PERSONNEL_RATE_TABLE_VERSION,
        positionCode: null,
        excludedReason: "cashier_excluded_v1",
      });
    }

    const storeTargetValidation = this.validatePositiveSource({
      value: input.storeTarget,
      missingReason: "missing_store_target",
      invalidReason: "invalid_store_target",
      rateTableVersion: PERSONNEL_RATE_TABLE_VERSION,
      positionCode: position.positionCode,
      normalizedFromPositionCode: position.normalizedFromPositionCode,
    });

    if (storeTargetValidation.status !== "valid") {
      return storeTargetValidation.result;
    }

    if (input.storeActualNetSales === null) {
      return this.noSourceResult({
        reason: "missing_store_sales_source",
        rateTableVersion: PERSONNEL_RATE_TABLE_VERSION,
        positionCode: position.positionCode,
        normalizedFromPositionCode: position.normalizedFromPositionCode,
      });
    }

    const personnelTargetValidation = this.validatePositiveSource({
      value: input.personnelTarget,
      missingReason: "missing_personnel_target",
      invalidReason: "invalid_personnel_target",
      rateTableVersion: PERSONNEL_RATE_TABLE_VERSION,
      positionCode: position.positionCode,
      normalizedFromPositionCode: position.normalizedFromPositionCode,
    });

    if (personnelTargetValidation.status !== "valid") {
      return personnelTargetValidation.result;
    }

    if (input.personnelActualPositiveSales === null) {
      return this.noSourceResult({
        reason: "missing_personnel_sales_source",
        rateTableVersion: PERSONNEL_RATE_TABLE_VERSION,
        positionCode: position.positionCode,
        normalizedFromPositionCode: position.normalizedFromPositionCode,
      });
    }

    const storeActualNetSales = parseDecimal(input.storeActualNetSales);
    const personnelActualPositiveSales = parseDecimal(
      input.personnelActualPositiveSales,
    );
    const storeGatePassed = isAchievementAtLeast({
      actual: storeActualNetSales,
      target: storeTargetValidation.decimal,
      thresholdPct: "80.0000",
    });
    const personalRateBeforeGate = selectRateByAchievement({
      actual: personnelActualPositiveSales,
      target: personnelTargetValidation.decimal,
      brackets: PERSONNEL_RATE_BRACKETS,
    });
    const rate = storeGatePassed ? personalRateBeforeGate : "0.0000";
    const rawEarnedAmount = storeGatePassed
      ? multiplyDecimalToMinimumScale({
          multiplicand: personnelActualPositiveSales,
          multiplier: parseDecimal(rate),
          minimumOutputScale: 6,
        })
      : "0.000000";

    return {
      ...this.baseResult(PERSONNEL_RATE_TABLE_VERSION),
      status: "projected",
      positionCode: position.positionCode,
      normalizedFromPositionCode: position.normalizedFromPositionCode,
      storeAchievementPct: formatAchievementPct({
        actual: storeActualNetSales,
        target: storeTargetValidation.decimal,
      }),
      storeGatePassed,
      achievementPct: formatAchievementPct({
        actual: personnelActualPositiveSales,
        target: personnelTargetValidation.decimal,
      }),
      personalRateBeforeGate,
      rate,
      rawEarnedAmount,
      payableAmount: truncateSalesTargetIncentivePayable(rawEarnedAmount),
    };
  }

  private validatePositiveSource(input: {
    value: string | null;
    missingReason: SalesTargetIncentiveReason;
    invalidReason: SalesTargetIncentiveReason;
    rateTableVersion:
      | typeof MANAGER_RATE_TABLE_VERSION
      | typeof PERSONNEL_RATE_TABLE_VERSION;
    positionCode: SalesTargetIncentiveEligiblePositionCode;
    normalizedFromPositionCode?: "SHIFT_LEAD" | null;
  }):
    | { status: "valid"; decimal: DecimalValue }
    | { status: "invalid"; result: SalesTargetIncentiveCalculationResult } {
    if (input.value === null) {
      return {
        status: "invalid",
        result: this.blockedResult({
          reason: input.missingReason,
          rateTableVersion: input.rateTableVersion,
          positionCode: input.positionCode,
          normalizedFromPositionCode: input.normalizedFromPositionCode ?? null,
        }),
      };
    }

    const decimal = parseDecimal(input.value);

    if (decimal.units <= 0n) {
      return {
        status: "invalid",
        result: this.blockedResult({
          reason: input.invalidReason,
          rateTableVersion: input.rateTableVersion,
          positionCode: input.positionCode,
          normalizedFromPositionCode: input.normalizedFromPositionCode ?? null,
        }),
      };
    }

    return { status: "valid", decimal };
  }

  private blockedResult(input: {
    reason: SalesTargetIncentiveReason;
    rateTableVersion:
      | typeof MANAGER_RATE_TABLE_VERSION
      | typeof PERSONNEL_RATE_TABLE_VERSION;
    positionCode: SalesTargetIncentiveEligiblePositionCode | null;
    normalizedFromPositionCode?: "SHIFT_LEAD" | null;
  }): SalesTargetIncentiveCalculationResult {
    return {
      ...this.baseResult(input.rateTableVersion),
      status: "blocked",
      blockedReason: input.reason,
      positionCode: input.positionCode,
      normalizedFromPositionCode: input.normalizedFromPositionCode ?? null,
    };
  }

  private noSourceResult(input: {
    reason: SalesTargetIncentiveReason;
    rateTableVersion:
      | typeof MANAGER_RATE_TABLE_VERSION
      | typeof PERSONNEL_RATE_TABLE_VERSION;
    positionCode: SalesTargetIncentiveEligiblePositionCode | null;
    normalizedFromPositionCode?: "SHIFT_LEAD" | null;
  }): SalesTargetIncentiveCalculationResult {
    return {
      ...this.baseResult(input.rateTableVersion),
      status: "no_source",
      blockedReason: input.reason,
      positionCode: input.positionCode,
      normalizedFromPositionCode: input.normalizedFromPositionCode ?? null,
    };
  }

  private excludedResult(input: {
    rateTableVersion:
      | typeof MANAGER_RATE_TABLE_VERSION
      | typeof PERSONNEL_RATE_TABLE_VERSION;
    positionCode: SalesTargetIncentiveEligiblePositionCode | null;
    excludedReason: SalesTargetIncentiveReason;
  }): SalesTargetIncentiveCalculationResult {
    return {
      ...this.baseResult(input.rateTableVersion),
      status: "excluded",
      positionCode: input.positionCode,
      excludedReason: input.excludedReason,
    };
  }

  private baseResult(
    rateTableVersion:
      | typeof MANAGER_RATE_TABLE_VERSION
      | typeof PERSONNEL_RATE_TABLE_VERSION,
  ): SalesTargetIncentiveCalculationResult {
    return {
      status: "projected",
      blockedReason: null,
      excludedReason: null,
      ruleVersionCode: SALES_TARGET_INCENTIVE_RULE_VERSION,
      rateTableVersion,
      positionCode: null,
      normalizedFromPositionCode: null,
      storeAchievementPct: null,
      storeGatePassed: null,
      achievementPct: null,
      personalRateBeforeGate: null,
      rate: null,
      rawEarnedAmount: null,
      payableAmount: null,
    };
  }
}

export function truncateSalesTargetIncentivePayable(value: string): string {
  const decimal = parseDecimal(value);
  return formatDecimal(decimal.units, decimal.scale, 2);
}

export function resolveSalesTargetIncentivePeriod(input: {
  sourceSalesAt: string | null;
  sourcePeriodKey: string | null;
}): SalesTargetIncentivePeriodResolution {
  const sourcePeriodKey = input.sourcePeriodKey;
  const timestampPeriodKey =
    input.sourceSalesAt !== null
      ? formatPeriodKeyInIstanbul(input.sourceSalesAt)
      : null;

  if (
    sourcePeriodKey !== null &&
    !/^\d{4}-(0[1-9]|1[0-2])$/.test(sourcePeriodKey)
  ) {
    return { status: "blocked", blockedReason: "ambiguous_source_period" };
  }

  if (
    sourcePeriodKey !== null &&
    timestampPeriodKey !== null &&
    sourcePeriodKey !== timestampPeriodKey
  ) {
    return { status: "blocked", blockedReason: "ambiguous_source_period" };
  }

  const periodKey = sourcePeriodKey ?? timestampPeriodKey;

  if (periodKey === null) {
    return { status: "blocked", blockedReason: "ambiguous_source_period" };
  }

  return { status: "resolved", periodKey };
}

export function canCloseSalesTargetIncentivePeriod(
  periodKey: string,
  nowIso: string,
  eligibleHour = 2,
): boolean {
  const { year, month } = parsePeriodKey(periodKey);
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextMonthYear = month === 12 ? year + 1 : year;
  const eligibleAt = zonedTimeToUtc({
    year: nextMonthYear,
    month: nextMonth,
    day: 1,
    hour: eligibleHour,
    minute: 0,
    second: 0,
    millisecond: 0,
    timeZone: SALES_TARGET_INCENTIVE_TIMEZONE,
  });
  const now = new Date(nowIso);

  return now.getTime() >= eligibleAt.getTime();
}

export function resolveSalesTargetIncentiveImportInclusion(input: {
  expectedPeriodKey: string;
  sourceSalesAt: string | null;
  sourcePeriodKey: string | null;
  acceptedAt: string;
  closeCutoffAt: string;
  importStatus: "accepted" | "pending" | "failed";
}): SalesTargetIncentiveImportInclusion {
  if (input.importStatus !== "accepted") {
    return { included: false, excludedReason: "not_accepted_import" };
  }

  const period = resolveSalesTargetIncentivePeriod({
    sourceSalesAt: input.sourceSalesAt,
    sourcePeriodKey: input.sourcePeriodKey,
  });

  if (period.status === "blocked") {
    return { included: false, excludedReason: "ambiguous_source_period" };
  }

  if (period.periodKey !== input.expectedPeriodKey) {
    return { included: false, excludedReason: "source_period_mismatch" };
  }

  if (new Date(input.acceptedAt).getTime() > new Date(input.closeCutoffAt).getTime()) {
    return { included: false, excludedReason: "accepted_after_close_cutoff" };
  }

  return { included: true };
}

function normalizeSalesTargetIncentivePosition(
  positionCode: SalesTargetIncentiveInputPositionCode,
): {
  positionCode: SalesTargetIncentiveEligiblePositionCode;
  normalizedFromPositionCode: "SHIFT_LEAD" | null;
} | null {
  if (positionCode === "CASHIER") {
    return null;
  }

  if (positionCode === "SHIFT_LEAD") {
    return {
      positionCode: "ASSISTANT_MANAGER",
      normalizedFromPositionCode: "SHIFT_LEAD",
    };
  }

  return {
    positionCode,
    normalizedFromPositionCode: null,
  };
}

function selectRateByAchievement(input: {
  actual: DecimalValue;
  target: DecimalValue;
  brackets: RateBracket[];
}): string {
  for (const bracket of input.brackets) {
    if (
      bracket.minPct === null ||
      isAchievementAtLeast({
        actual: input.actual,
        target: input.target,
        thresholdPct: bracket.minPct,
      })
    ) {
      return bracket.rate;
    }
  }

  return "0.0000";
}

function isAchievementAtLeast(input: {
  actual: DecimalValue;
  target: DecimalValue;
  thresholdPct: string;
}): boolean {
  const threshold = parseDecimal(input.thresholdPct);
  const left =
    input.actual.units *
    100n *
    pow10(input.target.scale + threshold.scale);
  const right =
    input.target.units * threshold.units * pow10(input.actual.scale);

  return left >= right;
}

function formatAchievementPct(input: {
  actual: DecimalValue;
  target: DecimalValue;
}): string {
  const units =
    (input.actual.units * 100n * pow10(input.target.scale + 4)) /
    (input.target.units * pow10(input.actual.scale));

  return formatDecimal(units, 4, 4);
}

function multiplyDecimalToMinimumScale(input: {
  multiplicand: DecimalValue;
  multiplier: DecimalValue;
  minimumOutputScale: number;
}): string {
  return formatDecimalWithMinimumScale(
    input.multiplicand.units * input.multiplier.units,
    input.multiplicand.scale + input.multiplier.scale,
    input.minimumOutputScale,
  );
}

function formatDecimalWithMinimumScale(
  units: bigint,
  sourceScale: number,
  minimumOutputScale: number,
): string {
  const outputScale = Math.max(sourceScale, minimumOutputScale);
  const formatted = formatDecimal(units, sourceScale, outputScale);

  if (outputScale === minimumOutputScale || !formatted.includes(".")) {
    return formatted;
  }

  const [whole, fraction] = formatted.split(".");
  let trimmedFraction = fraction;

  while (
    trimmedFraction.length > minimumOutputScale &&
    trimmedFraction.endsWith("0")
  ) {
    trimmedFraction = trimmedFraction.slice(0, -1);
  }

  return `${whole}.${trimmedFraction}`;
}

function parseDecimal(value: string): DecimalValue {
  const trimmed = value.trim();
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(trimmed);

  if (!match) {
    throw new Error(`Invalid decimal value: ${value}`);
  }

  const [, sign, whole, fraction = ""] = match;
  const digits = `${whole}${fraction}`.replace(/^0+(?=\d)/, "");
  const unsignedUnits = BigInt(digits || "0");
  const units = sign === "-" ? -unsignedUnits : unsignedUnits;

  return {
    units,
    scale: fraction.length,
  };
}

function formatDecimal(
  units: bigint,
  sourceScale: number,
  outputScale: number,
): string {
  const scaledUnits =
    outputScale >= sourceScale
      ? units * pow10(outputScale - sourceScale)
      : units / pow10(sourceScale - outputScale);
  const sign = scaledUnits < 0n ? "-" : "";
  const absolute = scaledUnits < 0n ? -scaledUnits : scaledUnits;

  if (outputScale === 0) {
    return `${sign}${absolute.toString()}`;
  }

  const digits = absolute.toString().padStart(outputScale + 1, "0");
  const whole = digits.slice(0, -outputScale);
  const fraction = digits.slice(-outputScale);

  return `${sign}${whole}.${fraction}`;
}

function pow10(scale: number): bigint {
  return 10n ** BigInt(scale);
}

function formatPeriodKeyInIstanbul(value: string): string | null {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const parts = getZonedDateTimeParts(date, SALES_TARGET_INCENTIVE_TIMEZONE);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}`;
}

function parsePeriodKey(periodKey: string): { year: number; month: number } {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(periodKey);

  if (!match) {
    throw new Error(`Invalid incentive period key: ${periodKey}`);
  }

  return {
    year: Number(match[1]),
    month: Number(match[2]),
  };
}

function zonedTimeToUtc(input: {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  millisecond: number;
  timeZone: string;
}): Date {
  const utcGuess = Date.UTC(
    input.year,
    input.month - 1,
    input.day,
    input.hour,
    input.minute,
    input.second,
    input.millisecond,
  );
  const zonedParts = getZonedDateTimeParts(new Date(utcGuess), input.timeZone);
  const zonedAsUtc = Date.UTC(
    zonedParts.year,
    zonedParts.month - 1,
    zonedParts.day,
    zonedParts.hour,
    zonedParts.minute,
    zonedParts.second,
    input.millisecond,
  );
  const offset = zonedAsUtc - utcGuess;

  return new Date(utcGuess - offset);
}

function getZonedDateTimeParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value]),
  );

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}
