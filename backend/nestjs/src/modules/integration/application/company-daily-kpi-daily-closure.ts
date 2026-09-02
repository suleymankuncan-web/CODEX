import type {
  ISODate,
  SanitizedComponentSet,
} from "./company-daily-kpi-pure-adapter";

export type CompanyDailyKpiDailyClosureOperation =
  SanitizedComponentSet<never>["operation"];
export type CompanyDailyKpiDailyClosureStatus = SanitizedComponentSet<never>["status"];

export type CompanyDailyKpiDailyClosureComponentMetadata = {
  readonly operation: CompanyDailyKpiDailyClosureOperation;
  readonly sourceCode: string;
  readonly businessDate: ISODate;
  readonly status: CompanyDailyKpiDailyClosureStatus;
  readonly aggregateCount: number;
  readonly retryCount: number;
  readonly safeReasonCode?: string;
  readonly sanitizedSetDigest?: string;
};

export type CompanyDailyKpiDailyClosureComponentOutcome =
  CompanyDailyKpiDailyClosureComponentMetadata;

export type CompanyDailyKpiDailyClosureInput = {
  readonly sourceCode: string;
  readonly businessDate: ISODate;
  readonly outcomes: readonly CompanyDailyKpiDailyClosureComponentOutcome[];
};

export type CompanyDailyKpiDailyClosureResult = {
  readonly sourceCode: string;
  readonly businessDate: ISODate;
  readonly closureStatus: "completed" | "incomplete";
  readonly components: readonly CompanyDailyKpiDailyClosureComponentMetadata[];
  readonly missingOperations: readonly CompanyDailyKpiDailyClosureOperation[];
};

const REQUIRED_OPERATIONS: readonly CompanyDailyKpiDailyClosureOperation[] = [
  "sales",
  "footfall",
  "gsm",
];
const POSTGRES_INTEGER_MAX = 2_147_483_647;
const SAFE_REASON_CODE_PATTERN = /^[a-z0-9_]{1,64}$/;

export function evaluateCompanyDailyKpiDailyClosure(
  input: CompanyDailyKpiDailyClosureInput,
): CompanyDailyKpiDailyClosureResult {
  if (!isRecord(input)) {
    throw invalidInput();
  }

  const sourceCode = readOwnDataProperty(input, "sourceCode");
  const businessDate = readOwnDataProperty(input, "businessDate");
  const suppliedOutcomes = readOwnDataProperty(input, "outcomes");
  if (
    !isRequiredCode(sourceCode) ||
    !isIsoDate(businessDate) ||
    !Array.isArray(suppliedOutcomes)
  ) {
    throw invalidInput();
  }

  const suppliedOutcomeCount = readOwnDataProperty(suppliedOutcomes, "length");
  if (
    !isPersistedCount(suppliedOutcomeCount) ||
    suppliedOutcomeCount > REQUIRED_OPERATIONS.length
  ) {
    throw invalidInput();
  }

  const byOperation = new Map<
    CompanyDailyKpiDailyClosureOperation,
    CompanyDailyKpiDailyClosureComponentOutcome
  >();
  for (let index = 0; index < suppliedOutcomeCount; index += 1) {
    const outcome = readOwnDataProperty(suppliedOutcomes, String(index));
    const snapshot = snapshotOutcome(outcome, sourceCode, businessDate);
    if (byOperation.has(snapshot.operation)) {
      throw invalidInput();
    }
    byOperation.set(snapshot.operation, snapshot);
  }
  const components = REQUIRED_OPERATIONS.flatMap((operation) => {
    const outcome = byOperation.get(operation);
    return outcome === undefined ? [] : [projectMetadata(outcome)];
  });
  const missingOperations = REQUIRED_OPERATIONS.filter(
    (operation) => !byOperation.has(operation),
  );
  const isComplete = REQUIRED_OPERATIONS.every(
    (operation) => byOperation.get(operation)?.status === "succeeded",
  );

  return {
    sourceCode,
    businessDate,
    closureStatus: isComplete ? "completed" : "incomplete",
    components,
    missingOperations,
  };
}

function projectMetadata(
  outcome: CompanyDailyKpiDailyClosureComponentOutcome,
): CompanyDailyKpiDailyClosureComponentMetadata {
  return {
    operation: outcome.operation,
    sourceCode: outcome.sourceCode,
    businessDate: outcome.businessDate,
    status: outcome.status,
    aggregateCount: outcome.aggregateCount,
    retryCount: outcome.retryCount,
    ...(outcome.safeReasonCode === undefined
      ? {}
      : { safeReasonCode: outcome.safeReasonCode }),
    ...(outcome.sanitizedSetDigest === undefined
      ? {}
      : { sanitizedSetDigest: outcome.sanitizedSetDigest }),
  };
}

function snapshotOutcome(
  value: unknown,
  sourceCode: string,
  businessDate: ISODate,
): CompanyDailyKpiDailyClosureComponentOutcome {
  if (!isRecord(value)) {
    throw invalidInput();
  }

  const operation = readOwnDataProperty(value, "operation");
  const outcomeSourceCode = readOwnDataProperty(value, "sourceCode");
  const outcomeBusinessDate = readOwnDataProperty(value, "businessDate");
  const status = readOwnDataProperty(value, "status");
  const aggregateCount = readOwnDataProperty(value, "aggregateCount");
  const retryCount = readOwnDataProperty(value, "retryCount");
  const safeReasonCode = readOwnDataProperty(value, "safeReasonCode", false);
  const sanitizedSetDigest = readOwnDataProperty(
    value,
    "sanitizedSetDigest",
    false,
  );

  if (
    outcomeSourceCode !== sourceCode ||
    outcomeBusinessDate !== businessDate ||
    !isClosureOperation(operation) ||
    !isClosureStatus(status) ||
    !isPersistedCount(aggregateCount) ||
    !isPersistedCount(retryCount) ||
    !isSafeReasonCode(safeReasonCode) ||
    !isSanitizedSetDigest(sanitizedSetDigest) ||
    (status === "succeeded" && sanitizedSetDigest === undefined) ||
    ((status === "failed" || status === "missed") &&
      (aggregateCount !== 0 || sanitizedSetDigest !== undefined))
  ) {
    throw invalidInput();
  }

  return {
    operation,
    sourceCode,
    businessDate,
    status,
    aggregateCount,
    retryCount,
    ...(safeReasonCode === undefined ? {} : { safeReasonCode }),
    ...(sanitizedSetDigest === undefined ? {} : { sanitizedSetDigest }),
  };
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

function isRequiredCode(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value === value.trim();
}

function isClosureOperation(
  value: unknown,
): value is CompanyDailyKpiDailyClosureOperation {
  return value === "sales" || value === "footfall" || value === "gsm";
}

function isClosureStatus(value: unknown): value is CompanyDailyKpiDailyClosureStatus {
  return value === "succeeded" || value === "failed" || value === "missed";
}

function isPersistedCount(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= POSTGRES_INTEGER_MAX
  );
}

function isSafeReasonCode(value: unknown): value is string | undefined {
  return value === undefined || (typeof value === "string" && SAFE_REASON_CODE_PATTERN.test(value));
}

function isSanitizedSetDigest(value: unknown): value is string | undefined {
  return value === undefined || (typeof value === "string" && /^[0-9a-f]{64}$/.test(value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readOwnDataProperty(
  record: object,
  key: string,
  required = true,
): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(record, key);
  if (descriptor === undefined) {
    if (required) throw invalidInput();
    return undefined;
  }
  if (!("value" in descriptor)) {
    throw invalidInput();
  }
  return descriptor.value;
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
      ? 29
      : 28;
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function invalidInput(): TypeError {
  return new TypeError("Invalid company daily KPI daily closure input");
}
