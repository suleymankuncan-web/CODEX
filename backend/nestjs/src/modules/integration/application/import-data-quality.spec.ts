import {
  IMPORT_DATA_QUALITY_ISSUES,
  classifyImportDataQualityIssue,
  getImportDataQualityIssue,
} from "./import-data-quality";

describe("import data quality guard", () => {
  it("keeps a unique catalog of operator-facing issue codes", () => {
    const codes = IMPORT_DATA_QUALITY_ISSUES.map((issue) => issue.code);

    expect(new Set(codes).size).toBe(codes.length);
    expect(codes).toEqual(
      expect.arrayContaining([
        "missing_identity",
        "unmapped_store",
        "unmapped_employee",
        "invalid_metric",
        "duplicate_source_row",
        "late_correction_candidate",
        "schema_mismatch",
        "system_write_failure",
        "unknown_quality_issue",
      ]),
    );

    for (const issue of IMPORT_DATA_QUALITY_ISSUES) {
      expect(issue.label.trim().length).toBeGreaterThan(3);
      expect(issue.description.trim().length).toBeGreaterThan(12);
      expect(["source_data", "mapping", "system"]).toContain(issue.owner);
      expect(["low", "medium", "high"]).toContain(issue.severity);
      expect(getImportDataQualityIssue(issue.code)?.code).toBe(issue.code);
    }
  });

  it.each([
    ["store reference could not be resolved", "unmapped_store"],
    ["employee reference could not be resolved", "unmapped_employee"],
    ["position reference is required", "missing_identity"],
    ["actual value must be numeric for KPI row", "invalid_metric"],
    ["duplicate source row detected for row hash", "duplicate_source_row"],
    ["late correction for closed period requires review", "late_correction_candidate"],
    ["payload schema mismatch: unknown field", "schema_mismatch"],
    ["database unavailable", "system_write_failure"],
    [null, "unknown_quality_issue"],
  ])("maps %p to %s", (validationError, expectedCode) => {
    expect(
      classifyImportDataQualityIssue({
        normalizedStatus: validationError === "database unavailable" ? "retryable_error" : "validation_failed",
        validationError,
      }),
    ).toBe(expectedCode);
  });
});
