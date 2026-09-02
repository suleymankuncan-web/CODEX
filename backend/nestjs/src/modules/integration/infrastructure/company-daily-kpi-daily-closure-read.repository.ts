import { BadRequestException, Injectable } from "@nestjs/common";
import { DatabaseService } from "../../../shared/database/database.service";
import type { ISODate } from "../application/company-daily-kpi-pure-adapter";

export type CompanyDailyKpiDailyClosureReadInput = {
  integrationSourceId: string;
  businessDate: ISODate;
};

export type CompanyDailyKpiDailyClosureReadOutcome = {
  operation: "sales" | "footfall" | "gsm";
  sourceCode: string;
  businessDate: ISODate;
  status: "succeeded" | "failed" | "missed";
  aggregateCount: number;
  retryCount: number;
  safeReasonCode?: string;
  sanitizedSetDigest?: string;
};

export type CompanyDailyKpiDailyClosureRead = {
  sourceCode: string;
  businessDate: ISODate;
  outcomes: readonly CompanyDailyKpiDailyClosureReadOutcome[];
};

type CompanyDailyKpiDailyClosureReadRow = {
  source_match_count?: unknown;
  source_id?: unknown;
  source_code?: unknown;
  business_date?: unknown;
  operation?: unknown;
  status?: unknown;
  aggregate_count?: unknown;
  retry_count?: unknown;
  safe_reason_code?: unknown;
  sanitized_set_digest?: unknown;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DIGEST_PATTERN = /^[0-9a-f]{64}$/;
const INTEGER_TEXT_PATTERN = /^(0|[1-9]\d*)$/;
const SAFE_REASON_CODE_PATTERN = /^[a-z0-9_]{1,64}$/;
const POSTGRES_INTEGER_MAX = 2_147_483_647;

/**
 * Read-only, one-statement snapshot of persisted daily KPI component outcome
 * metadata. The projection deliberately excludes physical facts and filters
 * only by the requested KPI source and business date.
 */
@Injectable()
export class CompanyDailyKpiDailyClosureReadRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async readDailyClosure(
    input: CompanyDailyKpiDailyClosureReadInput,
  ): Promise<CompanyDailyKpiDailyClosureRead> {
    assertDailyClosureReadInput(input);

    const result =
      await this.databaseService.query<CompanyDailyKpiDailyClosureReadRow>(
        DAILY_CLOSURE_READ_SQL,
        [input.integrationSourceId, input.businessDate],
      );

    return parseDailyClosureRows(result.rows, input);
  }
}

const DAILY_CLOSURE_READ_SQL = `
WITH source_matches AS (
  SELECT integration_source_id, source_code
  FROM stg.integration_source
  WHERE integration_source_id = $1::uuid
    AND entity_type = 'kpi'
), source_marker AS (
  SELECT
    COUNT(*)::text AS source_match_count,
    CASE WHEN COUNT(*) = 1
      THEN (array_agg(integration_source_id::text ORDER BY integration_source_id::text))[1]
      ELSE NULL
    END AS source_id,
    CASE WHEN COUNT(*) = 1
      THEN (array_agg(source_code ORDER BY source_code))[1]
      ELSE NULL
    END AS source_code
  FROM source_matches
)
SELECT
  source.source_match_count,
  source.source_id,
  source.source_code,
  $2::date::text AS business_date,
  outcome.operation,
  outcome.status,
  outcome.aggregate_count::text AS aggregate_count,
  outcome.retry_count::text AS retry_count,
  outcome.safe_reason_code,
  outcome.sanitized_set_digest
FROM source_marker source
LEFT JOIN ops.company_daily_kpi_component_outcome outcome
  ON outcome.integration_source_id = $1::uuid
 AND outcome.business_date = $2::date
ORDER BY CASE outcome.operation
  WHEN 'sales' THEN 1
  WHEN 'footfall' THEN 2
  WHEN 'gsm' THEN 3
  ELSE 4
END
`;

function assertDailyClosureReadInput(
  input: CompanyDailyKpiDailyClosureReadInput,
): void {
  if (!isStrictRecord(input)) {
    throw invalidRead("company_daily_kpi_invalid_daily_closure_input");
  }
  const keys = Reflect.ownKeys(input);
  if (
    keys.length !== 2 ||
    keys.some((key) => key !== "integrationSourceId" && key !== "businessDate")
  ) {
    throw invalidRead("company_daily_kpi_invalid_daily_closure_input");
  }
  const integrationSourceId = readOwnValue(input, "integrationSourceId");
  const businessDate = readOwnValue(input, "businessDate");
  if (
    typeof integrationSourceId !== "string" ||
    !UUID_PATTERN.test(integrationSourceId)
  ) {
    throw invalidRead("company_daily_kpi_invalid_daily_closure_source_id");
  }
  if (typeof businessDate !== "string" || !isIsoDate(businessDate)) {
    throw invalidRead("company_daily_kpi_invalid_daily_closure_date");
  }
}

function parseDailyClosureRows(
  rows: readonly CompanyDailyKpiDailyClosureReadRow[],
  input: CompanyDailyKpiDailyClosureReadInput,
): CompanyDailyKpiDailyClosureRead {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw invalidRead("company_daily_kpi_source_not_resolved");
  }
  let sourceCode: string | undefined;
  const seenOperations = new Set<string>();
  const outcomes: CompanyDailyKpiDailyClosureReadOutcome[] = [];
  for (const row of rows) {
    if (!isStrictRecord(row)) {
      throw invalidRead("company_daily_kpi_daily_closure_row_invalid");
    }
    if (
      parsePostgresInteger(
        row.source_match_count,
        "company_daily_kpi_invalid_source_match_count",
      ) !== 1
    ) {
      throw invalidRead("company_daily_kpi_source_marker_mismatch");
    }
    if (
      typeof row.source_id !== "string" ||
      row.source_id.toLowerCase() !== input.integrationSourceId.toLowerCase()
    ) {
      throw invalidRead("company_daily_kpi_source_marker_mismatch");
    }
    if (
      typeof row.source_code !== "string" ||
      !isRequiredCode(row.source_code)
    ) {
      throw invalidRead("company_daily_kpi_source_code_missing");
    }
    if (sourceCode === undefined) sourceCode = row.source_code;
    if (sourceCode !== row.source_code) {
      throw invalidRead("company_daily_kpi_duplicate_source");
    }
    if (parseDateText(row.business_date) !== input.businessDate) {
      throw invalidRead("company_daily_kpi_daily_closure_date_mismatch");
    }
    if (row.operation === null || row.operation === undefined) {
      if (
        rows.length !== 1 ||
        (row.status !== null && row.status !== undefined) ||
        (row.aggregate_count !== null && row.aggregate_count !== undefined) ||
        (row.retry_count !== null && row.retry_count !== undefined) ||
        (row.safe_reason_code !== null && row.safe_reason_code !== undefined) ||
        (row.sanitized_set_digest !== null &&
          row.sanitized_set_digest !== undefined)
      ) {
        throw invalidRead("company_daily_kpi_missing_outcome_marker");
      }
      continue;
    }
    const operation = parseOperation(row.operation);
    if (seenOperations.has(operation)) {
      throw invalidRead("company_daily_kpi_duplicate_outcome");
    }
    seenOperations.add(operation);
    const status = parseStatus(row.status);
    const aggregateCount = parsePostgresInteger(
      row.aggregate_count,
      "company_daily_kpi_invalid_aggregate_count",
    );
    const retryCount = parsePostgresInteger(
      row.retry_count,
      "company_daily_kpi_invalid_retry_count",
    );
    const safeReasonCode = parseDailyReasonCode(row.safe_reason_code);
    const sanitizedSetDigest = parseDigest(row.sanitized_set_digest);
    if (
      (status === "succeeded" && sanitizedSetDigest === null) ||
      ((status === "failed" || status === "missed") &&
        (aggregateCount !== 0 || sanitizedSetDigest !== null))
    ) {
      throw invalidRead(
        "company_daily_kpi_daily_closure_status_shape_mismatch",
      );
    }
    outcomes.push({
      operation,
      sourceCode,
      businessDate: input.businessDate,
      status,
      aggregateCount,
      retryCount,
      ...(safeReasonCode === undefined ? {} : { safeReasonCode }),
      ...(sanitizedSetDigest === null ? {} : { sanitizedSetDigest }),
    });
  }
  if (sourceCode === undefined) {
    throw invalidRead("company_daily_kpi_source_not_resolved");
  }
  return { sourceCode, businessDate: input.businessDate, outcomes };
}

function parseDailyReasonCode(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value !== "string" || !SAFE_REASON_CODE_PATTERN.test(value)) {
    throw invalidRead("company_daily_kpi_invalid_safe_reason");
  }
  return value;
}

function parsePostgresInteger(value: unknown, message: string): number {
  let bigintValue: bigint;
  if (typeof value === "bigint") {
    bigintValue = value;
  } else if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) throw invalidRead(message);
    bigintValue = BigInt(value);
  } else if (typeof value === "string" && INTEGER_TEXT_PATTERN.test(value)) {
    try {
      bigintValue = BigInt(value);
    } catch {
      throw invalidRead(message);
    }
  } else {
    throw invalidRead(message);
  }
  if (bigintValue < 0n || bigintValue > BigInt(POSTGRES_INTEGER_MAX)) {
    throw invalidRead(message);
  }
  return Number(bigintValue);
}

function isStrictRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readOwnValue(record: object, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(record, key);
  if (descriptor === undefined || !("value" in descriptor)) {
    throw invalidRead("company_daily_kpi_invalid_daily_closure_input");
  }
  return descriptor.value;
}

function parseDateText(value: unknown): ISODate {
  if (typeof value !== "string" || !isIsoDate(value)) {
    throw invalidRead("company_daily_kpi_invalid_business_date");
  }
  return value;
}

function parseOperation(value: unknown): "sales" | "footfall" | "gsm" {
  if (value === "sales" || value === "footfall" || value === "gsm")
    return value;
  throw invalidRead("company_daily_kpi_invalid_operation");
}

function parseStatus(value: unknown): "succeeded" | "failed" | "missed" {
  if (value === "succeeded" || value === "failed" || value === "missed") {
    return value;
  }
  throw invalidRead("company_daily_kpi_invalid_status");
}

function parseDigest(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string" || !DIGEST_PATTERN.test(value)) {
    throw invalidRead("company_daily_kpi_invalid_digest");
  }
  return value;
}

function isRequiredCode(value: unknown): value is string {
  return (
    typeof value === "string" && value.length > 0 && value === value.trim()
  );
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

function invalidRead(message: string): BadRequestException {
  return new BadRequestException(message);
}
