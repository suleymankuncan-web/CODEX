import {
  DIAGNOSTIC_QUERY_SET_VERSION,
  DIAGNOSTIC_TRANSACTION_CONTRACT,
  assertSanitizedDiagnosticJson,
  createDiagnosticReceipt,
  validateDiagnosticQueryResult,
  validateDiagnosticReceipt,
} from "../scripts/staging-remediation-diagnostic-contract";

// Trace: FR-DIAG-01..09, FR-DIAG-11; NFR-01..04; AC-01, AC-02; EC-04, EC-08.
describe("staging remediation diagnostic contract", () => {
  it("accepts the strict four-family diagnostic shape and preserves count units", () => {
    const result = validateDiagnosticQueryResult(safeQueryResult());

    expect(result.querySetVersion).toBe(DIAGNOSTIC_QUERY_SET_VERSION);
    expect(result.familyTotals).toEqual([
      { family: "ASSIGN-01", hitCount: 1, unit: "check_hits" },
      { family: "ORG-02", hitCount: 1, unit: "check_hits" },
      { family: "ORG-04", hitCount: 1, unit: "check_hits" },
      { family: "TARGET-02", hitCount: 1, unit: "check_hits" },
    ]);
    expect(result.distinctSourceRecords).toEqual({ count: 3, unit: "source_records" });
    expect(result.distinctPeople).toEqual({ status: "distinct_count_unresolved" });
    expect(result.cooccurrences).toEqual([
      {
        familyA: "ASSIGN-01",
        familyB: "ORG-02",
        sourceTable: "ops.employee_assignment_history",
        sourceRecordCount: 1,
        unit: "source_records",
      },
    ]);
  });

  it.each([
    ["reason", (value: any) => value.buckets[0].reasonCodes.push("target.unreviewed")],
    ["source", (value: any) => { value.buckets[0].sourceTable = "ops.employee"; }],
    ["extra field", (value: any) => { value.buckets[0].rawId = "hidden"; }],
    ["unsafe sample", (value: any) => {
      value.buckets[0].sampleRefs = [["00000000", "0000", "0000", "0000", "000000000001"].join("-")];
    }],
    ["unbounded samples", (value: any) => {
      value.buckets[0].sampleRefs = Array.from({ length: 6 }, () => "012345abcdef");
    }],
    ["dishonest total", (value: any) => { value.familyTotals[0].hitCount = 2; }],
    ["unknown dimension", (value: any) => {
      value.buckets[0].dimensions.writeSource = "guessed_from_payload";
    }],
    ["inconsistent reason", (value: any) => {
      value.buckets[0].dimensions.writeSource = "pilot_roster_import";
    }],
  ])("fails closed for adversarial %s output", (_name, mutate) => {
    const value = safeQueryResult();
    mutate(value);
    expect(() => validateDiagnosticQueryResult(value)).toThrow();
  });

  it("binds a sanitized receipt to canonical content and rejects extras or digest drift", () => {
    const receipt = createDiagnosticReceipt({
      certificateVerified: true,
      impactInventory: safeImpactInventory(),
      queryDigest: "1".repeat(64),
      queryResult: validateDiagnosticQueryResult(safeQueryResult()),
      reviewedCommit: "a".repeat(40),
      runnerDigest: "2".repeat(64),
      targetClass: "staging",
      targetFingerprint: "3".repeat(64),
      tlsMode: "verify-full",
    });

    expect(receipt.receiptDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(validateDiagnosticReceipt(receipt)).toEqual(receipt);
    expect(() => validateDiagnosticReceipt({ ...receipt, rawHost: "hidden" })).toThrow(
      "diagnostic_schema_mismatch",
    );
    expect(() => validateDiagnosticReceipt({ ...receipt, receiptDigest: "4".repeat(64) })).toThrow(
      "receipt_digest_mismatch",
    );
  });

  it.each([
    {
      dimensions: { openEnded: false, overlapKind: "same_day_boundary", scopeRelation: "cross_scope" },
      reasonCodes: ["assignment.same_day_boundary", "assignment.cross_scope"],
    },
    {
      dimensions: { openEnded: true, overlapKind: "strict_multi_day", scopeRelation: "same_scope" },
      reasonCodes: ["assignment.strict_multi_day", "assignment.open_ended", "assignment.same_scope"],
    },
  ])("accepts reviewed assignment overlap dimensions %#", ({ dimensions, reasonCodes }) => {
    const value = safeQueryResult();
    const assignment = value.buckets.find((bucket) => bucket.family === "ASSIGN-01")!;
    assignment.dimensions = dimensions;
    assignment.reasonCodes = reasonCodes;
    expect(validateDiagnosticQueryResult(value).buckets).toContainEqual(
      expect.objectContaining({ dimensions, reasonCodes }),
    );
  });

  it("rejects secret and PII patterns before evidence is written", () => {
    for (const unsafe of [
      `${"postgres" + "://"}fixture_user:fixture_secret@database.example/db`,
      'employee@example.com',
      ["00000000", "0000", "0000", "0000", "000000000001"].join("-"),
      '-----BEGIN CERTIFICATE-----',
      'Bearer eyJhbGciOiJIUzI1NiJ9.payload.signature',
      'password=secret',
    ]) {
      expect(() => assertSanitizedDiagnosticJson(JSON.stringify({ unsafe }))).toThrow(
        "sanitization_failed",
      );
    }
  });

  it("freezes one repeatable-read, read-only snapshot with explicit proof statements", () => {
    expect(DIAGNOSTIC_TRANSACTION_CONTRACT).toEqual({
      begin: "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY",
      showIsolation: "SHOW transaction_isolation",
      showReadOnly: "SHOW transaction_read_only",
    });
  });
});

function safeQueryResult() {
  return {
    buckets: [
      {
        dimensions: {
          approvalEvidence: "present",
          approvalMode: "adjusted",
          countDelta: -1,
          createdVintage: "2026_h2",
          requestStatus: "approved",
          writeSource: "legacy_or_unknown",
        },
        distinctSourceRecordCount: 1,
        family: "TARGET-02",
        hitCount: 1,
        querySetVersion: DIAGNOSTIC_QUERY_SET_VERSION,
        reasonCodes: [
          "target.count_less_than_json_length",
          "target.write_source_legacy_or_unknown",
        ],
        sampleRefs: ["012345abcdef"],
        sourceClass: "operational",
        sourceTable: "ops.target_distribution_request",
        unit: "check_hits",
      },
      {
        dimensions: { multipleReasons: true },
        distinctSourceRecordCount: 1,
        family: "ORG-02",
        hitCount: 1,
        querySetVersion: DIAGNOSTIC_QUERY_SET_VERSION,
        reasonCodes: [
          "org.assignment_region_store_region",
          "org.employee_company_store_company",
        ],
        sampleRefs: ["111111111111"],
        sourceClass: "operational",
        sourceTable: "ops.employee_assignment_history",
        unit: "check_hits",
      },
      {
        dimensions: { multipleReasons: false },
        distinctSourceRecordCount: 1,
        family: "ORG-04",
        hitCount: 1,
        querySetVersion: DIAGNOSTIC_QUERY_SET_VERSION,
        reasonCodes: ["org.scope_company_store"],
        sampleRefs: ["222222222222"],
        sourceClass: "audit",
        sourceTable: "audit.event_log",
        unit: "check_hits",
      },
      {
        dimensions: {
          openEnded: false,
          overlapKind: "strict_multi_day",
          scopeRelation: "same_scope",
        },
        family: "ASSIGN-01",
        hitCount: 1,
        querySetVersion: DIAGNOSTIC_QUERY_SET_VERSION,
        reasonCodes: ["assignment.strict_multi_day", "assignment.same_scope"],
        sampleRefs: ["333333333333"],
        sourceClass: "operational",
        sourceTable: "ops.employee_assignment_history",
        unit: "check_hits",
      },
    ],
    cooccurrences: [
      {
        familyA: "ASSIGN-01",
        familyB: "ORG-02",
        sourceRecordCount: 1,
        sourceTable: "ops.employee_assignment_history",
        unit: "source_records",
      },
    ],
    distinctPeople: { status: "distinct_count_unresolved" },
    distinctSourceRecords: { count: 3, unit: "source_records" },
    familyTotals: [
      { family: "ASSIGN-01", hitCount: 1, unit: "check_hits" },
      { family: "ORG-02", hitCount: 1, unit: "check_hits" },
      { family: "ORG-04", hitCount: 1, unit: "check_hits" },
      { family: "TARGET-02", hitCount: 1, unit: "check_hits" },
    ],
    observedAt: "2026-07-12T00:00:00.000Z",
    overallCheckHits: { count: 4, unit: "check_hits" },
    querySetVersion: DIAGNOSTIC_QUERY_SET_VERSION,
  };
}

function safeImpactInventory() {
  return {
    catalog: [
      {
        generatedColumnCount: 0,
        sourceTable: "ops.target_distribution_request",
        triggerCount: 0,
      },
      {
        generatedColumnCount: 0,
        sourceTable: "ops.employee_assignment_history",
        triggerCount: 1,
      },
    ],
    downstreamCodes: ["target.personnel_target_reference"],
    inventoryDigest: "5".repeat(64),
    inventoryVersion: "staging-remediation-impact-v1",
    writePathCodes: [
      "target.request_create",
      "target.approval",
      "target.pilot_roster_import",
      "assignment.integration_materialization",
      "assignment.master_data_bootstrap",
      "assignment.pilot_roster_import",
      "assignment.workforce_lifecycle",
    ],
  };
}
