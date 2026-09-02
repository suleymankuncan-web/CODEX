import { BadRequestException, Injectable } from "@nestjs/common";
import { DatabaseService } from "../../../shared/database/database.service";
import type {
  ISODate,
  StoreFootfallDailyAggregate,
  StoreGsmDailyAggregate,
  StoreSalesDailyAggregate,
} from "../application/company-daily-kpi-pure-adapter";

export type CompanyDailyKpiStoreRangeReadInput = {
  integrationSourceId: string;
  startDate: ISODate;
  endDate: ISODate;
  storeIds: readonly string[];
};

export type CompanyDailyKpiStoreSalesRangeFact = StoreSalesDailyAggregate & {
  storeId: string;
};

export type CompanyDailyKpiStoreFootfallRangeFact =
  StoreFootfallDailyAggregate & { storeId: string };

export type CompanyDailyKpiStoreGsmRangeFact = StoreGsmDailyAggregate & {
  storeId: string;
};

export type CompanyDailyKpiStoreRangeFact =
  | CompanyDailyKpiStoreSalesRangeFact
  | CompanyDailyKpiStoreFootfallRangeFact
  | CompanyDailyKpiStoreGsmRangeFact;

export type CompanyDailyKpiStoreRangeReadOutcome = {
  componentOutcomeId: string;
  businessDate: ISODate;
  operation: "sales" | "footfall" | "gsm";
  status: "succeeded" | "failed" | "missed";
  persistedAggregateCount: number;
  fullPhysicalFactCount: number;
  sanitizedSetDigest: string | null;
  storeFacts: readonly CompanyDailyKpiStoreRangeFact[];
};

export type CompanyDailyKpiStoreRangeRead = {
  sourceCode: string;
  stores: readonly {
    storeId: string;
    storeCode: string;
  }[];
  outcomes: readonly CompanyDailyKpiStoreRangeReadOutcome[];
};

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

type StoreMarker = {
  requestedStoreId: string;
  matchCount: number;
  storeId: string | null;
  storeCode: string | null;
};

type CompanyDailyKpiStoreRangeReadRow = {
  source_match_count?: unknown;
  source_id?: unknown;
  source_code?: unknown;
  store_markers?: unknown;
  component_outcome_id?: unknown;
  business_date?: unknown;
  operation?: unknown;
  status?: unknown;
  persisted_aggregate_count?: unknown;
  full_physical_fact_count?: unknown;
  sanitized_set_digest?: unknown;
  store_facts?: unknown;
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
const MAX_SAFE_INTEGER_BIGINT = BigInt(Number.MAX_SAFE_INTEGER);
const POSTGRES_INTEGER_MAX = 2_147_483_647;
const MAX_RANGE_DAYS = 366;
const MAX_STORE_IDS = 250;
/**
 * Read-only, one-statement snapshot of the persisted company daily KPI
 * component store range. The query deliberately resolves historical stores
 * without status, lifecycle, or KPI-enable predicates; the caller asked for
 * persisted history, not today's import eligibility.
 */
@Injectable()
export class CompanyDailyKpiComponentRangeReadRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async readStoreRange(
    input: CompanyDailyKpiStoreRangeReadInput,
  ): Promise<CompanyDailyKpiStoreRangeRead> {
    assertReadInput(input);

    const result = await this.databaseService.query<CompanyDailyKpiStoreRangeReadRow>(
      RANGE_READ_SQL,
      [input.integrationSourceId, input.startDate, input.endDate, [...input.storeIds]],
    );

    return parseReadRows(result.rows, input);
  }

  async readDailyClosure(
    input: CompanyDailyKpiDailyClosureReadInput,
  ): Promise<CompanyDailyKpiDailyClosureRead> {
    assertDailyClosureReadInput(input);

    const result = await this.databaseService.query<CompanyDailyKpiDailyClosureReadRow>(
      DAILY_CLOSURE_READ_SQL,
      [input.integrationSourceId, input.businessDate],
    );

    return parseDailyClosureRows(result.rows, input);
  }
}

const RANGE_READ_SQL = `
WITH requested_store_ids AS (
  SELECT value::uuid AS store_id
  FROM unnest($4::uuid[]) AS requested(value)
),
source_matches AS (
  SELECT integration_source_id, source_code
  FROM stg.integration_source
  WHERE integration_source_id = $1::uuid
    AND entity_type = 'kpi'
),
source_marker AS (
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
),
store_marker_rows AS (
  SELECT
    requested.store_id::text AS requested_store_id,
    COUNT(store.store_id)::text AS match_count,
    CASE WHEN COUNT(store.store_id) = 1
      THEN (array_agg(store.store_id::text ORDER BY store.store_id::text))[1]
      ELSE NULL
    END AS store_id,
    CASE WHEN COUNT(store.store_id) = 1
      THEN (array_agg(store.store_code ORDER BY store.store_code))[1]
      ELSE NULL
    END AS store_code
  FROM requested_store_ids requested
  LEFT JOIN ops.store store ON store.store_id = requested.store_id
  GROUP BY requested.store_id
),
store_markers AS (
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'requested_store_id', requested_store_id,
        'match_count', match_count,
        'store_id', store_id,
        'store_code', store_code
      ) ORDER BY requested_store_id
    ),
    '[]'::jsonb
  ) AS store_markers
  FROM store_marker_rows
),
expected_days AS (
  SELECT generate_series(
    $2::date,
    $3::date,
    interval '1 day'
  )::date AS business_date
),
expected_components AS (
  SELECT business_date, operation
  FROM expected_days
  CROSS JOIN (VALUES ('sales'::text), ('footfall'::text), ('gsm'::text)) operations(operation)
),
outcomes AS (
  SELECT
    outcome.component_outcome_id::text AS component_outcome_id,
    outcome.integration_source_id::text AS integration_source_id,
    outcome.business_date::text AS business_date,
    outcome.operation,
    outcome.status,
    outcome.aggregate_count::text AS persisted_aggregate_count,
    outcome.sanitized_set_digest,
    outcome.safe_reason_code
  FROM ops.company_daily_kpi_component_outcome outcome
  WHERE outcome.integration_source_id = $1::uuid
    AND outcome.business_date BETWEEN $2::date AND $3::date
),
physical_counts AS (
  SELECT
    outcome.component_outcome_id,
    outcome.business_date,
    outcome.operation,
    CASE outcome.operation
      WHEN 'sales' THEN (
        (SELECT COUNT(*)::bigint
         FROM ops.company_daily_kpi_employee_sales employee_fact
         WHERE employee_fact.component_outcome_id = outcome.component_outcome_id::uuid
           AND employee_fact.business_date = outcome.business_date::date
           AND employee_fact.operation = 'sales')
        +
        (SELECT COUNT(*)::bigint
         FROM ops.company_daily_kpi_store_sales store_fact
         WHERE store_fact.component_outcome_id = outcome.component_outcome_id::uuid
           AND store_fact.business_date = outcome.business_date::date
           AND store_fact.operation = 'sales')
      )
      WHEN 'footfall' THEN (
        SELECT COUNT(*)::bigint
        FROM ops.company_daily_kpi_store_footfall footfall_fact
        WHERE footfall_fact.component_outcome_id = outcome.component_outcome_id::uuid
          AND footfall_fact.business_date = outcome.business_date::date
          AND footfall_fact.operation = 'footfall'
      )
      WHEN 'gsm' THEN (
        SELECT COUNT(*)::bigint
        FROM ops.company_daily_kpi_store_gsm gsm_fact
        WHERE gsm_fact.component_outcome_id = outcome.component_outcome_id::uuid
          AND gsm_fact.business_date = outcome.business_date::date
          AND gsm_fact.operation = 'gsm'
      )
    END::text AS full_physical_fact_count
  FROM outcomes outcome
),
scoped_facts AS (
  SELECT
    outcome.component_outcome_id,
    outcome.business_date,
    'sales'::text AS operation,
    jsonb_agg(
      jsonb_build_object(
        'store_id', store_fact.store_id::text,
        'store_code', store.store_code,
        'sale_invoice_count', store_fact.sale_invoice_count::text,
        'return_invoice_count', store_fact.return_invoice_count::text
      ) ORDER BY store_fact.store_id::text
    ) AS store_facts
  FROM outcomes outcome
  INNER JOIN ops.company_daily_kpi_store_sales store_fact
    ON store_fact.component_outcome_id::text = outcome.component_outcome_id
   AND store_fact.business_date::text = outcome.business_date
   AND store_fact.operation = 'sales'
  INNER JOIN requested_store_ids requested
    ON requested.store_id = store_fact.store_id
  INNER JOIN ops.store store ON store.store_id = store_fact.store_id
  WHERE outcome.operation = 'sales'
  GROUP BY outcome.component_outcome_id, outcome.business_date

  UNION ALL

  SELECT
    outcome.component_outcome_id,
    outcome.business_date,
    'footfall'::text AS operation,
    jsonb_agg(
      jsonb_build_object(
        'store_id', footfall_fact.store_id::text,
        'store_code', store.store_code,
        'footfall', footfall_fact.footfall::text
      ) ORDER BY footfall_fact.store_id::text
    ) AS store_facts
  FROM outcomes outcome
  INNER JOIN ops.company_daily_kpi_store_footfall footfall_fact
    ON footfall_fact.component_outcome_id::text = outcome.component_outcome_id
   AND footfall_fact.business_date::text = outcome.business_date
   AND footfall_fact.operation = 'footfall'
  INNER JOIN requested_store_ids requested
    ON requested.store_id = footfall_fact.store_id
  INNER JOIN ops.store store ON store.store_id = footfall_fact.store_id
  WHERE outcome.operation = 'footfall'
  GROUP BY outcome.component_outcome_id, outcome.business_date

  UNION ALL

  SELECT
    outcome.component_outcome_id,
    outcome.business_date,
    'gsm'::text AS operation,
    jsonb_agg(
      jsonb_build_object(
        'store_id', gsm_fact.store_id::text,
        'store_code', store.store_code,
        'yes_customer_count', gsm_fact.yes_customer_count::text,
        'total_customer_count', gsm_fact.total_customer_count::text
      ) ORDER BY gsm_fact.store_id::text
    ) AS store_facts
  FROM outcomes outcome
  INNER JOIN ops.company_daily_kpi_store_gsm gsm_fact
    ON gsm_fact.component_outcome_id::text = outcome.component_outcome_id
   AND gsm_fact.business_date::text = outcome.business_date
   AND gsm_fact.operation = 'gsm'
  INNER JOIN requested_store_ids requested
    ON requested.store_id = gsm_fact.store_id
  INNER JOIN ops.store store ON store.store_id = gsm_fact.store_id
  WHERE outcome.operation = 'gsm'
  GROUP BY outcome.component_outcome_id, outcome.business_date
)
SELECT
  source.source_match_count,
  source.source_id,
  source.source_code,
  markers.store_markers,
  expected.business_date::text AS business_date,
  expected.operation,
  outcome.component_outcome_id,
  outcome.status,
  CASE WHEN outcome.component_outcome_id IS NULL
    THEN NULL
    ELSE outcome.persisted_aggregate_count
  END AS persisted_aggregate_count,
  CASE WHEN outcome.component_outcome_id IS NULL
    THEN NULL
    ELSE physical.full_physical_fact_count
  END AS full_physical_fact_count,
  CASE WHEN outcome.component_outcome_id IS NULL
    THEN NULL
    ELSE outcome.sanitized_set_digest
  END AS sanitized_set_digest,
  COALESCE(facts.store_facts, '[]'::jsonb) AS store_facts
FROM source_marker source
CROSS JOIN store_markers markers
CROSS JOIN expected_components expected
LEFT JOIN outcomes outcome
  ON outcome.business_date = expected.business_date::text
 AND outcome.operation = expected.operation
LEFT JOIN physical_counts physical
  ON physical.component_outcome_id = outcome.component_outcome_id
 AND physical.business_date = outcome.business_date
 AND physical.operation = outcome.operation
LEFT JOIN scoped_facts facts
  ON facts.component_outcome_id = outcome.component_outcome_id
 AND facts.business_date = outcome.business_date
 AND facts.operation = outcome.operation
ORDER BY expected.business_date, expected.operation
`;

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

function parseReadRows(
  rows: readonly CompanyDailyKpiStoreRangeReadRow[],
  input: CompanyDailyKpiStoreRangeReadInput,
): CompanyDailyKpiStoreRangeRead {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw invalidRead("company_daily_kpi_source_not_resolved");
  }

  const first = rows[0];
  const sourceCode = parseSourceMarker(rows, input.integrationSourceId);
  const storeMarkers = parseStoreMarkers(first.store_markers, input.storeIds);
  const markerFingerprint = JSON.stringify(storeMarkers);
  const outcomes: CompanyDailyKpiStoreRangeReadOutcome[] = [];
  const seenComponentKeys = new Set<string>();
  const seenExpectedKeys = new Set<string>();

  for (const row of rows) {
    if (parseSourceCount(row.source_match_count) !== 1) {
      throw invalidRead("company_daily_kpi_source_marker_mismatch");
    }
    if (String(row.source_id ?? "") !== input.integrationSourceId) {
      throw invalidRead("company_daily_kpi_source_marker_mismatch");
    }
    if (row.source_code !== sourceCode) {
      throw invalidRead("company_daily_kpi_source_marker_mismatch");
    }
    const rowMarkers = parseStoreMarkers(row.store_markers, input.storeIds);
    if (JSON.stringify(rowMarkers) !== markerFingerprint) {
      throw invalidRead("company_daily_kpi_store_marker_mismatch");
    }

    const businessDate = parseDateText(row.business_date);
    if (
      compareText(businessDate, input.startDate) < 0 ||
      compareText(businessDate, input.endDate) > 0
    ) {
      throw invalidRead("company_daily_kpi_range_date_mismatch");
    }
    const operation = parseOperation(row.operation);
    const expectedKey = `${businessDate}:${operation}`;
    if (seenExpectedKeys.has(expectedKey)) {
      throw invalidRead("company_daily_kpi_duplicate_outcome");
    }
    seenExpectedKeys.add(expectedKey);

    if (row.component_outcome_id === null || row.component_outcome_id === undefined) {
      if (
        row.status !== null &&
        row.status !== undefined ||
        row.persisted_aggregate_count !== null &&
          row.persisted_aggregate_count !== undefined ||
        row.full_physical_fact_count !== null &&
          row.full_physical_fact_count !== undefined ||
        row.sanitized_set_digest !== null &&
          row.sanitized_set_digest !== undefined
      ) {
        throw invalidRead("company_daily_kpi_missing_outcome_marker");
      }
      const missingFacts = parseJsonArray(row.store_facts);
      if (missingFacts.length > 0) {
        throw invalidRead("company_daily_kpi_missing_outcome_facts");
      }
      continue;
    }

    const componentOutcomeId = parseUuid(row.component_outcome_id);
    const componentKey = `${componentOutcomeId}:${expectedKey}`;
    if (seenComponentKeys.has(componentKey)) {
      throw invalidRead("company_daily_kpi_duplicate_outcome");
    }
    seenComponentKeys.add(componentKey);

    const status = parseStatus(row.status);
    const persistedAggregateCount = parseSafeCount(
      row.persisted_aggregate_count,
      "company_daily_kpi_invalid_persisted_count",
    );
    const fullPhysicalFactCount = parseSafeCount(
      row.full_physical_fact_count,
      "company_daily_kpi_invalid_physical_count",
    );
    const sanitizedSetDigest = parseDigest(row.sanitized_set_digest);
    const storeFacts = parseStoreFacts(
      operation,
      businessDate,
      row.store_facts,
      storeMarkers,
      componentKey,
    );

    outcomes.push({
      componentOutcomeId,
      businessDate,
      operation,
      status,
      persistedAggregateCount,
      fullPhysicalFactCount,
      sanitizedSetDigest,
      storeFacts,
    });
  }

  const stores = storeMarkers.map((marker) => {
    if (marker.storeId === null || marker.storeCode === null) {
      throw invalidRead("company_daily_kpi_store_not_resolved");
    }
    return { storeId: marker.storeId, storeCode: marker.storeCode };
  });

  return { sourceCode, stores, outcomes };
}

function parseSourceMarker(
  rows: readonly CompanyDailyKpiStoreRangeReadRow[],
  integrationSourceId: string,
): string {
  let sourceCode: string | undefined;
  for (const row of rows) {
    if (parseSourceCount(row.source_match_count) !== 1) {
      throw invalidRead("company_daily_kpi_source_not_resolved");
    }
    if (String(row.source_id ?? "") !== integrationSourceId) {
      throw invalidRead("company_daily_kpi_source_marker_mismatch");
    }
    if (typeof row.source_code !== "string" || !isRequiredCode(row.source_code)) {
      throw invalidRead("company_daily_kpi_source_code_missing");
    }
    if (sourceCode === undefined) sourceCode = row.source_code;
    if (sourceCode !== row.source_code) {
      throw invalidRead("company_daily_kpi_duplicate_source");
    }
  }
  if (!sourceCode) throw invalidRead("company_daily_kpi_source_not_resolved");
  return sourceCode;
}

function parseStoreMarkers(
  value: unknown,
  requestedStoreIds: readonly string[],
): StoreMarker[] {
  const raw = parseJsonArray(value);
  if (raw.length !== requestedStoreIds.length) {
    throw invalidRead("company_daily_kpi_store_resolution_mismatch");
  }

  const requested = new Set(requestedStoreIds);
  const seen = new Set<string>();
  const markers: StoreMarker[] = [];
  for (const candidate of raw) {
    if (!isRecord(candidate)) throw invalidRead("company_daily_kpi_store_marker_invalid");
    const requestedStoreId = parseUuid(candidate.requested_store_id);
    if (!requested.has(requestedStoreId) || seen.has(requestedStoreId)) {
      throw invalidRead("company_daily_kpi_store_marker_invalid");
    }
    seen.add(requestedStoreId);
    const matchCount = parseSafeCount(
      candidate.match_count,
      "company_daily_kpi_invalid_store_match_count",
    );
    const storeId = candidate.store_id === null ? null : parseUuid(candidate.store_id);
    const storeCode = candidate.store_code === null ? null : parseCode(candidate.store_code);
    if ((matchCount === 1) !== (storeId !== null && storeCode !== null)) {
      throw invalidRead("company_daily_kpi_store_resolution_mismatch");
    }
    markers.push({ requestedStoreId, matchCount, storeId, storeCode });
  }

  if (seen.size !== requestedStoreIds.length) {
    throw invalidRead("company_daily_kpi_store_resolution_mismatch");
  }
  markers.sort((left, right) => compareText(left.requestedStoreId, right.requestedStoreId));
  return markers;
}

function parseStoreFacts(
  operation: "sales" | "footfall" | "gsm",
  businessDate: ISODate,
  value: unknown,
  storeMarkers: readonly StoreMarker[],
  componentKey: string,
): CompanyDailyKpiStoreRangeFact[] {
  const raw = parseJsonArray(value);
  const knownStores = new Map(
    storeMarkers
      .filter((marker) => marker.matchCount === 1 && marker.storeId && marker.storeCode)
      .map((marker) => [marker.storeId as string, marker.storeCode as string]),
  );
  const seenStores = new Set<string>();
  const facts: CompanyDailyKpiStoreRangeFact[] = [];

  for (const candidate of raw) {
    if (!isRecord(candidate)) throw invalidRead("company_daily_kpi_store_fact_invalid");
    if (hasOwn(candidate, "employee_id") || hasOwn(candidate, "personnel_code")) {
      throw invalidRead("company_daily_kpi_employee_fact_leaked");
    }
    const storeId = parseUuid(candidate.store_id);
    const storeCode = parseCode(candidate.store_code);
    if (knownStores.get(storeId) !== storeCode || seenStores.has(storeId)) {
      throw invalidRead(`company_daily_kpi_duplicate_store_fact:${componentKey}`);
    }
    seenStores.add(storeId);

    if (operation === "sales") {
      facts.push({
        businessDate,
        storeId,
        storeCode,
        saleInvoiceCount: parseSafeCount(candidate.sale_invoice_count, "company_daily_kpi_invalid_count"),
        returnInvoiceCount: parseSafeCount(candidate.return_invoice_count, "company_daily_kpi_invalid_count"),
      });
    } else if (operation === "footfall") {
      facts.push({
        businessDate,
        storeId,
        storeCode,
        footfall: parseSafeCount(candidate.footfall, "company_daily_kpi_invalid_count"),
      });
    } else {
      const yesCustomerCount = parseSafeCount(
        candidate.yes_customer_count,
        "company_daily_kpi_invalid_count",
      );
      const totalCustomerCount = parseSafeCount(
        candidate.total_customer_count,
        "company_daily_kpi_invalid_count",
      );
      if (yesCustomerCount > totalCustomerCount) {
        throw invalidRead("company_daily_kpi_invalid_gsm_bounds");
      }
      facts.push({
        businessDate,
        storeId,
        storeCode,
        yesCustomerCount,
        totalCustomerCount,
      });
    }
  }

  return facts;
}
function assertDailyClosureReadInput(input: CompanyDailyKpiDailyClosureReadInput): void {
  if (!isStrictRecord(input)) {
    throw invalidRead("company_daily_kpi_invalid_daily_closure_input");
  }
  const keys = Reflect.ownKeys(input);
  if (keys.length !== 2 || keys.some((key) => key !== "integrationSourceId" && key !== "businessDate")) {
    throw invalidRead("company_daily_kpi_invalid_daily_closure_input");
  }
  const integrationSourceId = readOwnValue(input, "integrationSourceId");
  const businessDate = readOwnValue(input, "businessDate");
  if (typeof integrationSourceId !== "string" || !UUID_PATTERN.test(integrationSourceId)) {
    throw invalidRead("company_daily_kpi_invalid_daily_closure_source_id");
  }
  if (typeof businessDate !== "string" || !isIsoDate(businessDate)) {
    throw invalidRead("company_daily_kpi_invalid_daily_closure_date");
  }
}
function parseDailyClosureRows(rows: readonly CompanyDailyKpiDailyClosureReadRow[], input: CompanyDailyKpiDailyClosureReadInput): CompanyDailyKpiDailyClosureRead {
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
    if (parsePostgresInteger(row.source_match_count, "company_daily_kpi_invalid_source_match_count") !== 1) {
      throw invalidRead("company_daily_kpi_source_marker_mismatch");
    }
    if (typeof row.source_id !== "string" || row.source_id.toLowerCase() !== input.integrationSourceId.toLowerCase()) {
      throw invalidRead("company_daily_kpi_source_marker_mismatch");
    }
    if (typeof row.source_code !== "string" || !isRequiredCode(row.source_code)) {
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
        row.status !== null && row.status !== undefined ||
        row.aggregate_count !== null && row.aggregate_count !== undefined ||
        row.retry_count !== null && row.retry_count !== undefined ||
        row.safe_reason_code !== null && row.safe_reason_code !== undefined ||
        row.sanitized_set_digest !== null && row.sanitized_set_digest !== undefined
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
      throw invalidRead("company_daily_kpi_daily_closure_status_shape_mismatch");
    }
    outcomes.push({
      operation,
      sourceCode: sourceCode,
      businessDate: input.businessDate,
      status,
      aggregateCount,
      retryCount,
      ...(safeReasonCode === undefined ? {} : { safeReasonCode }),
      ...(sanitizedSetDigest === null
        ? {}
        : { sanitizedSetDigest }),
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
  return isRecord(value) && !Array.isArray(value);
}
function readOwnValue(record: object, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(record, key);
  if (descriptor === undefined || !("value" in descriptor)) {
    throw invalidRead("company_daily_kpi_invalid_daily_closure_input");
  }
  return descriptor.value;
}
function assertReadInput(input: CompanyDailyKpiStoreRangeReadInput): void {
  if (!isRecord(input)) throw invalidRead("company_daily_kpi_invalid_range_input");
  if (!UUID_PATTERN.test(input.integrationSourceId)) {
    throw invalidRead("company_daily_kpi_invalid_source_id");
  }
  if (!isIsoDate(input.startDate) || !isIsoDate(input.endDate)) {
    throw invalidRead("company_daily_kpi_invalid_range_date");
  }
  if (compareText(input.startDate, input.endDate) > 0) {
    throw invalidRead("company_daily_kpi_reversed_range");
  }
  if (calendarDaysInclusive(input.startDate, input.endDate) > MAX_RANGE_DAYS) {
    throw invalidRead("company_daily_kpi_range_too_large");
  }
  if (!Array.isArray(input.storeIds) || input.storeIds.length === 0) {
    throw invalidRead("company_daily_kpi_invalid_store_scope");
  }
  if (input.storeIds.length > MAX_STORE_IDS) {
    throw invalidRead("company_daily_kpi_store_scope_too_large");
  }
  const seen = new Set<string>();
  for (const storeId of input.storeIds) {
    if (!UUID_PATTERN.test(storeId) || seen.has(storeId)) {
      throw invalidRead("company_daily_kpi_invalid_store_scope");
    }
    seen.add(storeId);
  }
}

function parseDateText(value: unknown): ISODate {
  if (typeof value !== "string" || !isIsoDate(value)) {
    throw invalidRead("company_daily_kpi_invalid_business_date");
  }
  return value;
}

function parseOperation(value: unknown): "sales" | "footfall" | "gsm" {
  if (value === "sales" || value === "footfall" || value === "gsm") return value;
  throw invalidRead("company_daily_kpi_invalid_operation");
}

function parseStatus(value: unknown): "succeeded" | "failed" | "missed" {
  if (value === "succeeded" || value === "failed" || value === "missed") return value;
  throw invalidRead("company_daily_kpi_invalid_status");
}

function parseUuid(value: unknown): string {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
    throw invalidRead("company_daily_kpi_invalid_identity");
  }
  return value;
}

function parseCode(value: unknown): string {
  if (!isRequiredCode(value)) throw invalidRead("company_daily_kpi_invalid_store_code");
  return value;
}

function parseDigest(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string" || !DIGEST_PATTERN.test(value)) {
    throw invalidRead("company_daily_kpi_invalid_digest");
  }
  return value;
}

function parseSourceCount(value: unknown): number {
  return parseSafeCount(value, "company_daily_kpi_invalid_source_match_count");
}

function parseSafeCount(value: unknown, message: string): number {
  let bigintValue: bigint;
  if (typeof value === "bigint") {
    bigintValue = value;
  } else if (typeof value === "number") {
    if (!Number.isSafeInteger(value) || value < 0) throw invalidRead(message);
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
  if (bigintValue < 0n || bigintValue > MAX_SAFE_INTEGER_BIGINT) {
    throw invalidRead(message);
  }
  return Number(bigintValue);
}

function parseJsonArray(value: unknown): unknown[] {
  if (typeof value === "string") {
    try {
      value = JSON.parse(value) as unknown;
    } catch {
      throw invalidRead("company_daily_kpi_invalid_json_fact_set");
    }
  }
  if (!Array.isArray(value)) throw invalidRead("company_daily_kpi_invalid_json_fact_set");
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function isRequiredCode(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value === value.trim();
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
  if (!match) throw invalidRead("company_daily_kpi_invalid_range_date");
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

function invalidRead(message: string): BadRequestException {
  return new BadRequestException(message);
}

function compareText(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}
