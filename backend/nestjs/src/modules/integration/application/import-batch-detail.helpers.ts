import { getExternalIdInternalTableName } from "./external-id-mapping.helpers";
import {
  getBlockedByEntityTypes,
  getDetailHealthState,
  getRecommendedImportOrder,
} from "./import-batch-health";
import {
  type ImportBatchReadModelRow,
  mapImportBatchDetailBatch,
} from "./import-batch-read-model.mapper";
import {
  type ImportDataQualityIssue,
  type ImportDataQualityIssueCode,
  classifyImportDataQualityIssue,
  getImportDataQualityIssue,
} from "./import-data-quality";

type ImportBatchRowStatusSummaryRow = {
  normalized_status: string;
  row_count: string;
};

type ImportBatchDependencySummaryRow = {
  employee_count?: string | null;
  store_count?: string | null;
  position_count?: string | null;
  region_count?: string | null;
  company_count?: string | null;
  manager_count?: string | null;
} | null;

type ImportBatchLineageSummaryRow = {
  row_hash_count?: string | null;
  raw_row_reference_count?: string | null;
  sample_row_hash?: string | null;
  sample_raw_row_reference?: string | null;
} | null;

type ImportBatchQualityIssueRow = {
  normalized_status: string;
  validation_error: string | null;
  row_count: string;
};

export type ImportBatchDetailModel = ReturnType<
  typeof buildImportBatchDetailModel
>;

export function buildImportBatchDetailModel(input: {
  batch: ImportBatchReadModelRow;
  summaryRows: ImportBatchRowStatusSummaryRow[];
  dependencySummaryRow: ImportBatchDependencySummaryRow;
  lineageSummaryRow: ImportBatchLineageSummaryRow;
  qualityIssueRows: ImportBatchQualityIssueRow[];
}) {
  const rowStatusSummary = buildRowStatusSummary(input.summaryRows);
  const dependencySummary = buildDependencySummary(input.dependencySummaryRow);
  const blockedByEntityTypes = getBlockedByEntityTypes(dependencySummary);
  const recommendedImportOrder = getRecommendedImportOrder();
  const recommendedNextEntityType = blockedByEntityTypes[0] ?? null;
  const canRetryNow = blockedByEntityTypes.length === 0;
  const healthState = getDetailHealthState({
    status: input.batch.status,
    rowStatusSummary,
    blockedByEntityTypes,
    canRetryNow,
  });

  return {
    batch: mapImportBatchDetailBatch(input.batch, healthState),
    rowStatusSummary,
    dependencySummary,
    blockedByEntityTypes,
    recommendedImportOrder,
    recommendedNextEntityType,
    canRetryNow,
    healthState,
    qualityIssueSummary: buildQualityIssueSummary(input.qualityIssueRows),
    lineageSummary: {
      supported: input.batch.entity_type === "kpi",
      rowHashCount: Number(input.lineageSummaryRow?.row_hash_count ?? 0),
      rawRowReferenceCount: Number(
        input.lineageSummaryRow?.raw_row_reference_count ?? 0,
      ),
      sampleRowHash: input.lineageSummaryRow?.sample_row_hash ?? null,
      sampleRawRowReference:
        input.lineageSummaryRow?.sample_raw_row_reference ?? null,
    },
  };
}

export function buildImportBatchReconciliationModel(
  detail: ImportBatchDetailModel,
) {
  const totalRows =
    detail.rowStatusSummary.processed +
    detail.rowStatusSummary.validationFailed +
    detail.rowStatusSummary.retryableError +
    detail.rowStatusSummary.pending;
  const unaccountedRows = Math.max(detail.batch.recordCount - totalRows, 0);
  const safeDivide = (value: number, total: number) =>
    total > 0 ? value / total : 0;

  return {
    batch: detail.batch,
    totals: {
      recordCount: detail.batch.recordCount,
      accountedRows: totalRows,
      unaccountedRows,
      countsMatchRecordCount: totalRows === detail.batch.recordCount,
    },
    rowStatusSummary: detail.rowStatusSummary,
    rates: {
      processedRate: safeDivide(
        detail.rowStatusSummary.processed,
        detail.batch.recordCount,
      ),
      validationFailureRate: safeDivide(
        detail.rowStatusSummary.validationFailed,
        detail.batch.recordCount,
      ),
      retryableErrorRate: safeDivide(
        detail.rowStatusSummary.retryableError,
        detail.batch.recordCount,
      ),
      pendingRate: safeDivide(
        detail.rowStatusSummary.pending,
        detail.batch.recordCount,
      ),
      accountedRate: safeDivide(totalRows, detail.batch.recordCount),
    },
    reconciliation: {
      hasFailures:
        detail.rowStatusSummary.validationFailed > 0 ||
        detail.rowStatusSummary.retryableError > 0,
      hasPendingRows: detail.rowStatusSummary.pending > 0,
      hasUnaccountedRows: unaccountedRows > 0,
      canRetryNow: detail.canRetryNow,
      blockedByEntityTypes: detail.blockedByEntityTypes,
      recommendedNextEntityType: detail.recommendedNextEntityType,
    },
  };
}

export function buildImportBatchErrorItem(input: {
  integrationSourceId: string;
  row: {
    row_id: string;
    source_ref: string | null;
    row_hash: string | null;
    raw_row_reference: string | null;
    normalized_status: string;
    validation_error: string | null;
    processed_at: string | null;
    store_external_ref: string | null;
    employee_external_ref: string | null;
    payload_json: Record<string, unknown> | null;
  };
}) {
  const qualityIssueCode = classifyImportDataQualityIssue({
    normalizedStatus: input.row.normalized_status,
    validationError: input.row.validation_error,
  });
  const lineage =
    input.row.row_hash || input.row.raw_row_reference
      ? {
          rowHash: input.row.row_hash ?? null,
          rawRowReference: input.row.raw_row_reference ?? null,
        }
      : {};
  const mappingCandidate = getMappingCandidate({
    integrationSourceId: input.integrationSourceId,
    qualityIssueCode,
    row: input.row,
  });

  return {
    rowId: input.row.row_id,
    sourceRef: input.row.source_ref,
    ...lineage,
    normalizedStatus: input.row.normalized_status,
    errorCategory: classifyErrorCategory(
      input.row.normalized_status,
      input.row.validation_error,
    ),
    qualityIssueCode,
    ...(mappingCandidate ? { mappingCandidate } : {}),
    validationError: input.row.validation_error,
    processedAt: input.row.processed_at,
  };
}

function buildRowStatusSummary(summaryRows: ImportBatchRowStatusSummaryRow[]) {
  const rowStatusSummary = {
    processed: 0,
    validationFailed: 0,
    retryableError: 0,
    pending: 0,
  };

  for (const row of summaryRows) {
    if (row.normalized_status === "processed")
      rowStatusSummary.processed = Number(row.row_count);
    if (row.normalized_status === "validation_failed") {
      rowStatusSummary.validationFailed = Number(row.row_count);
    }
    if (row.normalized_status === "retryable_error") {
      rowStatusSummary.retryableError = Number(row.row_count);
    }
    if (row.normalized_status === "pending")
      rowStatusSummary.pending = Number(row.row_count);
  }

  return rowStatusSummary;
}

function buildDependencySummary(
  dependencySummaryRow: ImportBatchDependencySummaryRow,
) {
  return {
    employee: Number(dependencySummaryRow?.employee_count ?? 0),
    store: Number(dependencySummaryRow?.store_count ?? 0),
    position: Number(dependencySummaryRow?.position_count ?? 0),
    region: Number(dependencySummaryRow?.region_count ?? 0),
    company: Number(dependencySummaryRow?.company_count ?? 0),
    manager: Number(dependencySummaryRow?.manager_count ?? 0),
  };
}

function classifyErrorCategory(
  normalizedStatus: string,
  validationError: string | null,
): "validation" | "missing_dependency" | "write_failure" {
  if (normalizedStatus === "validation_failed") {
    return "validation";
  }

  const errorMessage = (validationError ?? "").toLowerCase();
  if (
    errorMessage.includes("could not be resolved") ||
    errorMessage.includes("missing dependency")
  ) {
    return "missing_dependency";
  }

  return "write_failure";
}

function getMappingCandidate(input: {
  integrationSourceId: string;
  qualityIssueCode: ImportDataQualityIssueCode;
  row: {
    store_external_ref: string | null;
    employee_external_ref: string | null;
    payload_json: Record<string, unknown> | null;
  };
}) {
  const payload = input.row.payload_json ?? {};
  if (input.qualityIssueCode === "unmapped_store") {
    const externalId = firstNonEmptyString([
      input.row.store_external_ref,
      payload["storeExternalRef"],
      payload["sourceStoreId"],
    ]);

    return externalId
      ? {
          integrationSourceId: input.integrationSourceId,
          entityType: "store" as const,
          externalId,
          internalTableName: getExternalIdInternalTableName("store"),
        }
      : null;
  }

  if (input.qualityIssueCode === "unmapped_employee") {
    const externalId = firstNonEmptyString([
      input.row.employee_external_ref,
      payload["employeeExternalRef"],
      payload["sourceEmployeeId"],
    ]);

    return externalId
      ? {
          integrationSourceId: input.integrationSourceId,
          entityType: "employee" as const,
          externalId,
          internalTableName: getExternalIdInternalTableName("employee"),
        }
      : null;
  }

  return null;
}

function firstNonEmptyString(values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
  }

  return null;
}

function buildQualityIssueSummary(rows: ImportBatchQualityIssueRow[]) {
  const issueCounts = new Map<ImportDataQualityIssueCode, number>();

  for (const row of rows) {
    const code = classifyImportDataQualityIssue({
      normalizedStatus: row.normalized_status,
      validationError: row.validation_error,
    });
    const count = Number(row.row_count ?? 0);
    issueCounts.set(code, (issueCounts.get(code) ?? 0) + count);
  }

  const items = Array.from(issueCounts.entries())
    .map(([code, count]) => {
      const issue =
        getImportDataQualityIssue(code) ??
        getImportDataQualityIssue("unknown_quality_issue");
      return {
        code,
        label: issue?.label ?? "Unknown quality issue",
        owner: issue?.owner ?? "system",
        severity: issue?.severity ?? "low",
        description:
          issue?.description ??
          "The row failed without a recognized data quality issue pattern.",
        count,
      };
    })
    .sort((left, right) => {
      const severityDelta = getSeverityRank(left) - getSeverityRank(right);
      if (severityDelta !== 0) return severityDelta;
      if (right.count !== left.count) return right.count - left.count;
      return left.code.localeCompare(right.code);
    });

  return {
    totalIssueRows: items.reduce((sum, item) => sum + item.count, 0),
    highSeverityRows: items
      .filter((item) => item.severity === "high")
      .reduce((sum, item) => sum + item.count, 0),
    items,
  };
}

function getSeverityRank(issue: Pick<ImportDataQualityIssue, "severity">) {
  if (issue.severity === "high") return 0;
  if (issue.severity === "medium") return 1;
  return 2;
}
