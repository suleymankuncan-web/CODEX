import {
  INVARIANT_V2_QUERY_SET_VERSION,
  createInvariantV2Receipt,
  type InvariantV2QueryResult,
  validateInvariantV2QueryResult,
} from "../scripts/staging-remediation-invariant-v2-contract";

describe("staging remediation invariant V2 contract", () => {
  // Trace: FR-SCOPE-01, FR-DEC-08; NFR-02, NFR-03; AC-11.
  it("accepts an exact V1-to-V2 bridge with typed hits", () => {
    const result = validateInvariantV2QueryResult({
      bridge: [
        {
          carriedForwardCount: 2,
          family: "ASSIGN-01",
          revisedValidCount: 0,
          unit: "check_hits",
          v1HitCount: 2,
          v2HitCount: 3,
          v2NewCount: 1,
        },
        zeroBridge("ORG-02"),
        zeroBridge("ORG-04"),
        zeroBridge("TARGET-02"),
      ],
      familyTotals: [
        { family: "ASSIGN-01", hitCount: 3, unit: "check_hits" },
        { family: "ORG-02", hitCount: 0, unit: "check_hits" },
        { family: "ORG-04", hitCount: 0, unit: "check_hits" },
        { family: "TARGET-02", hitCount: 0, unit: "check_hits" },
      ],
      hits: [
        {
          count: 2,
          invariant: "assignment.primary_ranges_non_overlapping",
          reason: "assignment.primary_strict_overlap",
          sampleRefs: ["123456789abc"],
          sourceTable: "ops.employee_assignment_history",
          unit: "check_hits",
        },
        {
          count: 1,
          invariant: "assignment.exactly_one_open_primary",
          reason: "assignment.open_primary_missing",
          sampleRefs: ["abcdef123456"],
          sourceTable: "ops.employee_assignment_history",
          unit: "check_hits",
        },
      ],
      observedAt: "2026-07-12T09:00:00.000Z",
      overallCheckHits: { count: 3, unit: "check_hits" },
      querySetVersion: INVARIANT_V2_QUERY_SET_VERSION,
    });

    expect(result.bridge[0]).toEqual(expect.objectContaining({
      family: "ASSIGN-01",
      v1HitCount: 2,
      v2HitCount: 3,
    }));
  });

  // Trace: FR-DEC-08; NFR-08; AC-11; EC-04, EC-08.
  it("rejects a bridge that omits revised-semantic families", () => {
    expect(() => validateInvariantV2QueryResult({
      bridge: [],
      familyTotals: [],
      hits: [],
      observedAt: "2026-07-12T09:00:00.000Z",
      overallCheckHits: { count: 0, unit: "check_hits" },
      querySetVersion: INVARIANT_V2_QUERY_SET_VERSION,
    })).toThrow("incomplete_family_catalog");
  });

  // Trace: FR-DIAG-08, FR-DIAG-09, FR-DEC-08; NFR-01..04; AC-01, AC-11, AC-12.
  it("binds a sanitized V2 result to the reviewed runner and query digests", () => {
    const receipt = createInvariantV2Receipt({
      certificateVerified: false,
      queryDigest: "1".repeat(64),
      queryResult: zeroResult(),
      reviewedCommit: "a".repeat(40),
      runnerDigest: "2".repeat(64),
      targetClass: "disposable",
      targetFingerprint: "3".repeat(64),
      tlsMode: "disable",
    });

    expect(receipt.receiptDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(receipt.transactionIsolation).toBe("repeatable_read");
    expect(receipt.transactionReadOnly).toBe(true);
  });

  // Trace: FR-DIAG-09, FR-DEC-08; NFR-02; AC-01, AC-11; EC-01, EC-08.
  it("rejects a reason code borrowed from another invariant", () => {
    const value = zeroResult();
    value.hits = [{
      count: 1,
      invariant: "target.ordinary_count_matches_json",
      reason: "assignment.open_primary_missing",
      sampleRefs: ["123456789abc"],
      sourceTable: "ops.target_distribution_request",
      unit: "check_hits",
    }];
    value.familyTotals.find((item) => item.family === "TARGET-02")!.hitCount = 1;
    const bridge = value.bridge.find((item) => item.family === "TARGET-02")!;
    bridge.v2HitCount = 1;
    bridge.v2NewCount = 1;
    value.overallCheckHits.count = 1;

    expect(() => validateInvariantV2QueryResult(value)).toThrow("reason_invariant_mismatch");
  });

  it("rejects an allowed source table borrowed from another invariant", () => {
    const value = zeroResult();
    value.hits = [{
      count: 1,
      invariant: "target.ordinary_count_matches_json",
      reason: "target.ordinary_count_json_mismatch",
      sampleRefs: ["123456789abc"],
      sourceTable: "audit.event_log",
      unit: "check_hits",
    }];
    value.familyTotals.find((item) => item.family === "TARGET-02")!.hitCount = 1;
    const bridge = value.bridge.find((item) => item.family === "TARGET-02")!;
    bridge.v2HitCount = 1;
    bridge.v2NewCount = 1;
    value.overallCheckHits.count = 1;

    expect(() => validateInvariantV2QueryResult(value)).toThrow("source_invariant_mismatch");
  });
});

function zeroBridge(family: "ORG-02" | "ORG-04" | "TARGET-02") {
  return {
    carriedForwardCount: 0,
    family,
    revisedValidCount: 0,
    unit: "check_hits",
    v1HitCount: 0,
    v2HitCount: 0,
    v2NewCount: 0,
  } as const;
}

function zeroResult(): InvariantV2QueryResult {
  const families = ["ASSIGN-01", "ORG-02", "ORG-04", "TARGET-02"] as const;
  return {
    bridge: families.map((family) => ({
      carriedForwardCount: 0,
      family,
      revisedValidCount: 0,
      unit: "check_hits" as const,
      v1HitCount: 0,
      v2HitCount: 0,
      v2NewCount: 0,
    })),
    familyTotals: families.map((family) => ({ family, hitCount: 0, unit: "check_hits" as const })),
    hits: [],
    observedAt: "2026-07-12T09:00:00.000Z",
    overallCheckHits: { count: 0, unit: "check_hits" as const },
    querySetVersion: INVARIANT_V2_QUERY_SET_VERSION,
  };
}
