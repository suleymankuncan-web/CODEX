export type ImportDataQualityIssueOwner = "source_data" | "mapping" | "system";
export type ImportDataQualityIssueSeverity = "low" | "medium" | "high";

export type ImportDataQualityIssue = {
  code: string;
  label: string;
  owner: ImportDataQualityIssueOwner;
  severity: ImportDataQualityIssueSeverity;
  description: string;
};

export const IMPORT_DATA_QUALITY_ISSUES = [
  issue(
    "missing_identity",
    "Missing identity",
    "source_data",
    "high",
    "A required source, business, or mapping identity is absent from the row.",
  ),
  issue(
    "unmapped_store",
    "Unmapped store",
    "mapping",
    "high",
    "The row references a store that is not mapped to an internal store.",
  ),
  issue(
    "unmapped_employee",
    "Unmapped employee",
    "mapping",
    "high",
    "The row references an employee that is not mapped to an internal employee.",
  ),
  issue(
    "unmapped_position",
    "Unmapped position",
    "mapping",
    "medium",
    "The row references a position that is not mapped to an internal position.",
  ),
  issue(
    "unmapped_region",
    "Unmapped region",
    "mapping",
    "medium",
    "The row references a region that is not mapped to an internal region.",
  ),
  issue(
    "unmapped_company",
    "Unmapped company",
    "mapping",
    "medium",
    "The row references a company that is not mapped to an internal company.",
  ),
  issue(
    "invalid_metric",
    "Invalid metric",
    "source_data",
    "high",
    "The row has an invalid, missing, or unresolved KPI metric definition or value.",
  ),
  issue(
    "duplicate_source_row",
    "Duplicate source row",
    "source_data",
    "medium",
    "The source row appears to duplicate another row for the same business key.",
  ),
  issue(
    "late_correction_candidate",
    "Late correction candidate",
    "source_data",
    "medium",
    "The row may be a late correction for a period that needs explicit review.",
  ),
  issue(
    "schema_mismatch",
    "Schema mismatch",
    "source_data",
    "medium",
    "The row shape does not match the expected canonical import contract.",
  ),
  issue(
    "system_write_failure",
    "System write failure",
    "system",
    "high",
    "The row failed because the platform could not complete a database or system write.",
  ),
  issue(
    "unknown_quality_issue",
    "Unknown quality issue",
    "system",
    "low",
    "The row failed without a recognized data quality issue pattern.",
  ),
] as const satisfies readonly ImportDataQualityIssue[];

export type ImportDataQualityIssueCode = (typeof IMPORT_DATA_QUALITY_ISSUES)[number]["code"];

export function getImportDataQualityIssue(code: string) {
  return IMPORT_DATA_QUALITY_ISSUES.find((issue) => issue.code === code) ?? null;
}

export function classifyImportDataQualityIssue(input: {
  normalizedStatus: string;
  validationError: string | null;
}): ImportDataQualityIssueCode {
  const message = (input.validationError ?? "").toLowerCase();

  if (!message.trim()) {
    return "unknown_quality_issue";
  }

  if (message.includes("duplicate")) {
    return "duplicate_source_row";
  }

  if (
    message.includes("late correction") ||
    message.includes("closed period") ||
    message.includes("outside source window")
  ) {
    return "late_correction_candidate";
  }

  if (message.includes("schema") || message.includes("payload shape")) {
    return "schema_mismatch";
  }

  if (message.includes("store reference could not be resolved")) {
    return "unmapped_store";
  }

  if (message.includes("employee reference could not be resolved")) {
    return "unmapped_employee";
  }

  if (message.includes("position reference could not be resolved")) {
    return "unmapped_position";
  }

  if (
    message.includes("region reference could not be resolved") ||
    message.includes("store region could not be resolved")
  ) {
    return "unmapped_region";
  }

  if (message.includes("company reference could not be resolved")) {
    return "unmapped_company";
  }

  if (message.includes("reference is required") || message.includes(" is required")) {
    return "missing_identity";
  }

  if (
    message.includes("kpi definition could not be resolved") ||
    message.includes("kpiid") ||
    message.includes("kpicode") ||
    message.includes("sourcemetricid") ||
    message.includes("actual value") ||
    message.includes("metric")
  ) {
    return "invalid_metric";
  }

  if (input.normalizedStatus === "retryable_error") {
    return "system_write_failure";
  }

  return "unknown_quality_issue";
}

function issue<const TCode extends string>(
  code: TCode,
  label: string,
  owner: ImportDataQualityIssueOwner,
  severity: ImportDataQualityIssueSeverity,
  description: string,
): ImportDataQualityIssue & { code: TCode } {
  return {
    code,
    label,
    owner,
    severity,
    description,
  };
}
