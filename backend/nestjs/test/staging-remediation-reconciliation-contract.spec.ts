import {
  RECONCILIATION_QUERY_SET_VERSION,
  buildReconciliationAuthorityResult,
  buildReconciliationResult,
  createReconciliationReceipt,
  validateReconciliationReceipt,
  validateReconciliationResult,
} from "../scripts/staging-remediation-reconciliation-contract";
import {
  INVARIANT_V2_QUERY_SET_VERSION,
  type InvariantV2QueryResult,
} from "../scripts/staging-remediation-invariant-v2-contract";
import {
  AUTHORITY_CLASSIFIER_QUERY_SET_VERSION,
  type AuthorityClassifierResult,
} from "../scripts/staging-remediation-row-authority-classifier-contract";

describe("staging remediation reconciliation contract", () => {
  // Trace: FR-01..10; NFR-01, NFR-02; AC-01, AC-04, AC-05; EC-05, EC-06.
  it("marks only TARGET eligible when every locked zero-state prerequisite reconciles", () => {
    const result = buildValid();

    expect(result.querySetVersion).toBe(RECONCILIATION_QUERY_SET_VERSION);
    expect(result.overallState).toBe("target_eligible_other_families_blocked");
    expect(result.families).toEqual([
      expect.objectContaining({
        activeCount: 0,
        constraintEligibility: "eligible_after_rem8",
        family: "TARGET-02",
        nextGate: "rem_8",
        state: "eligible_zero",
        v1ContinuityCount: 54,
      }),
      expect.objectContaining({ family: "ORG-02", nextGate: "authoritative_row_evidence", state: "blocked" }),
      expect.objectContaining({ family: "ORG-04", nextGate: "authoritative_row_evidence", state: "blocked" }),
      expect.objectContaining({ family: "ASSIGN-01", nextGate: "authoritative_row_evidence", state: "blocked" }),
    ]);
    expect(result.applicationContracts).toEqual([{
      code: "target_duplicate_employee_rejected",
      sourceDigest: "d".repeat(64),
      state: "present",
    }]);
  });

  // Trace: FR-03, FR-04, FR-11; AC-02, AC-03; EC-01, EC-02.
  it.each([
    ["unknown V1 check", (rows: ReturnType<typeof validV1Rows>) => { rows[0].check_id = "UNKNOWN-01"; }, "v1_check_catalog_mismatch"],
    ["duplicate V1 check", (rows: ReturnType<typeof validV1Rows>) => { rows[1].check_id = rows[0].check_id; }, "v1_check_catalog_mismatch"],
    ["negative V1 count", (rows: ReturnType<typeof validV1Rows>) => { rows[0].violation_count = -1; }, "invalid_v1_violation_count"],
  ])("rejects %s", (_name, mutate, expected) => {
    const rows = validV1Rows();
    mutate(rows);
    expect(() => buildReconciliationResult(
      rows,
      validV2Result(),
      validAuthorityResult(),
      "d".repeat(64),
      validSourceDigests(),
    )).toThrow(expected);
  });

  it("rejects V1/V2 bridge drift and V2/classifier drift", () => {
    const v2BridgeDrift = validV2Result();
    v2BridgeDrift.bridge.find((item) => item.family === "TARGET-02")!.v1HitCount = 55;
    expect(() => buildReconciliationResult(
      validV1Rows(), v2BridgeDrift, validAuthorityResult(), "d".repeat(64), validSourceDigests(),
    )).toThrow("dishonest_v1_bridge");

    const authorityDrift = validAuthorityResult();
    authorityDrift.v2FamilyTotals.find((item) => item.family === "ORG-04")!.hitCount = 8;
    expect(() => buildReconciliationResult(
      validV1Rows(), validV2Result(), authorityDrift, "d".repeat(64), validSourceDigests(),
    )).toThrow("v2_authority_reconciliation_mismatch");
  });

  // Trace: FR-02, FR-07, FR-10; NFR-02; AC-04, AC-06; EC-05, EC-11.
  it("blocks TARGET when TARGET-03 is non-zero and refuses mixed observation instants", () => {
    const rows = validV1Rows();
    rows.find((row) => row.check_id === "TARGET-03")!.violation_count = 1;
    const blocked = buildReconciliationResult(
      rows, validV2Result(), validAuthorityResult(), "d".repeat(64), validSourceDigests(),
    );
    expect(blocked.families[0]).toMatchObject({
      constraintEligibility: "blocked",
      nextGate: "none",
      reason: "target_prerequisite_missing",
      state: "blocked",
    });
    expect(blocked.overallState).toBe("blocked");

    const authority = validAuthorityResult();
    authority.observedAt = "2026-07-12T09:00:01.000Z";
    expect(() => buildReconciliationResult(
      validV1Rows(), validV2Result(), authority, "d".repeat(64), validSourceDigests(),
    )).toThrow("snapshot_observation_mismatch");
  });

  it("blocks TARGET when active V2 drifts non-zero without weakening authority validation", () => {
    const v2 = validV2Result();
    const total = v2.familyTotals.find((item) => item.family === "TARGET-02")!;
    total.hitCount = 1;
    const bridgeItem = v2.bridge.find((item) => item.family === "TARGET-02")!;
    bridgeItem.carriedForwardCount = 1;
    bridgeItem.revisedValidCount = 53;
    bridgeItem.v2HitCount = 1;
    v2.hits.push({
      count: 1,
      invariant: "target.ordinary_count_matches_json",
      reason: "target.ordinary_count_json_mismatch",
      sampleRefs: [],
      sourceTable: "ops.target_distribution_request",
      unit: "check_hits",
    });
    v2.overallCheckHits.count = 15;

    const authority = buildReconciliationAuthorityResult(validAuthoritySql(), v2);
    expect(authority.v2FamilyTotals.find((item) => item.family === "TARGET-02")?.hitCount).toBe(0);
    const result = buildReconciliationResult(
      validV1Rows(), v2, authority, "d".repeat(64), validSourceDigests(),
    );
    expect(result.families[0]).toMatchObject({
      activeCount: 1,
      constraintEligibility: "blocked",
      nextGate: "none",
      state: "blocked",
    });
    expect(result.overallState).toBe("blocked");
  });

  // Trace: FR-07, FR-11; NFR-01; AC-03, AC-04; EC-06, EC-08, EC-09.
  it("requires exact digests and exact decision refs", () => {
    expect(() => buildReconciliationResult(
      validV1Rows(), validV2Result(), validAuthorityResult(), "", validSourceDigests(),
    )).toThrow("application_contract_digest_missing");
    expect(() => buildReconciliationResult(
      validV1Rows(), validV2Result(), validAuthorityResult(), "d".repeat(64), {
        ...validSourceDigests(), invariantV1: "short",
      },
    )).toThrow("source_digest_mismatch");

    const result = buildValid();
    result.families[0].decisionRefs = ["D-TARGET-DUPLICATE=reject_app_and_db"];
    expect(() => validateReconciliationResult(result)).toThrow("invalid_decision_refs");
    expect(() => validateReconciliationResult({ ...buildValid(), rawRows: [] })).toThrow(
      "reconciliation_schema_mismatch",
    );
    const invalidState = buildValid();
    invalidState.families[0].state = "preserved_excluded";
    expect(() => validateReconciliationResult(invalidState)).toThrow(
      "terminal_state_prerequisite_missing",
    );
  });

  // Trace: FR-10, FR-11; NFR-01..04; AC-06; EC-09, EC-11.
  it("digest-binds the strict receipt and enforces verify-full for staging", () => {
    const receipt = createReconciliationReceipt({
      certificateVerified: true,
      queryResult: buildValid(),
      reviewedCommit: "a".repeat(40),
      runnerDigest: "b".repeat(64),
      targetClass: "staging",
      targetFingerprint: "c".repeat(64),
      tlsMode: "verify-full",
    });
    expect(validateReconciliationReceipt(receipt)).toEqual(receipt);
    expect(() => validateReconciliationReceipt({ ...receipt, receiptDigest: "f".repeat(64) })).toThrow(
      "receipt_digest_mismatch",
    );
    expect(() => validateReconciliationReceipt({ ...receipt, rawManifest: [] })).toThrow(
      "reconciliation_receipt_schema_mismatch",
    );
    expect(() => createReconciliationReceipt({
      certificateVerified: false,
      queryResult: buildValid(),
      reviewedCommit: "a".repeat(40),
      runnerDigest: "b".repeat(64),
      targetClass: "staging",
      targetFingerprint: "c".repeat(64),
      tlsMode: "disable",
    })).toThrow("certificate_verification_failed");
  });
});

function buildValid() {
  return buildReconciliationResult(
    validV1Rows(),
    validV2Result(),
    validAuthorityResult(),
    "d".repeat(64),
    validSourceDigests(),
  );
}

function validSourceDigests() {
  return {
    authorityClassifierV1: "3".repeat(64),
    invariantV1: "1".repeat(64),
    invariantV2: "2".repeat(64),
  };
}

function validV1Rows() {
  const counts: Record<string, number> = {
    "ASSIGN-01": 4,
    "AUTH-01": 0,
    "AUTH-02": 0,
    "KEY-01": 0,
    "ORG-01": 0,
    "ORG-02": 3,
    "ORG-03": 0,
    "ORG-04": 7,
    "TARGET-01": 0,
    "TARGET-02": 54,
    "TARGET-03": 0,
  };
  const categories: Record<string, string> = {
    "ASSIGN-01": "assignment",
    "AUTH-01": "authorization",
    "AUTH-02": "authorization",
    "KEY-01": "candidate_key",
    "ORG-01": "organization",
    "ORG-02": "organization",
    "ORG-03": "organization",
    "ORG-04": "organization",
    "TARGET-01": "target",
    "TARGET-02": "target",
    "TARGET-03": "target",
  };
  return Object.keys(counts).sort().map((check_id) => ({
    category: categories[check_id],
    check_id,
    sample_refs: [],
    violation_count: counts[check_id],
  }));
}

function validV2Result(): InvariantV2QueryResult {
  const familyTotals = [
    { family: "ASSIGN-01", hitCount: 4, unit: "check_hits" },
    { family: "ORG-02", hitCount: 3, unit: "check_hits" },
    { family: "ORG-04", hitCount: 7, unit: "check_hits" },
    { family: "TARGET-02", hitCount: 0, unit: "check_hits" },
  ] as const;
  return {
    bridge: [
      bridge("ASSIGN-01", 4, 4, 0),
      bridge("ORG-02", 3, 3, 0),
      bridge("ORG-04", 7, 7, 0),
      bridge("TARGET-02", 54, 0, 54),
    ],
    familyTotals: [...familyTotals],
    hits: [
      hit("ASSIGN-01", 4),
      hit("ORG-02", 3),
      hit("ORG-04", 7),
    ],
    observedAt: "2026-07-12T09:00:00.000Z",
    overallCheckHits: { count: 14, unit: "check_hits" },
    querySetVersion: INVARIANT_V2_QUERY_SET_VERSION,
  };
}

function bridge(
  family: "ASSIGN-01" | "ORG-02" | "ORG-04" | "TARGET-02",
  v1HitCount: number,
  v2HitCount: number,
  revisedValidCount: number,
) {
  return {
    carriedForwardCount: v2HitCount,
    family,
    revisedValidCount,
    unit: "check_hits" as const,
    v1HitCount,
    v2HitCount,
    v2NewCount: 0,
  };
}

function hit(family: "ASSIGN-01" | "ORG-02" | "ORG-04", count: number) {
  if (family === "ASSIGN-01") {
    return {
      count,
      invariant: "assignment.primary_ranges_non_overlapping" as const,
      reason: "assignment.primary_strict_overlap" as const,
      sampleRefs: [],
      sourceTable: "ops.employee_assignment_history" as const,
      unit: "check_hits" as const,
    };
  }
  if (family === "ORG-02") {
    return {
      count,
      invariant: "assignment.lifecycle_region" as const,
      reason: "assignment.active_region_store_mismatch" as const,
      sampleRefs: [],
      sourceTable: "ops.employee_assignment_history" as const,
      unit: "check_hits" as const,
    };
  }
  return {
    count,
    invariant: "org.kpi_period_end_manager" as const,
    reason: "kpi.period_end_manager_ambiguous" as const,
    sampleRefs: [],
    sourceTable: "ops.kpi_actual" as const,
    unit: "check_hits" as const,
  };
}

function validAuthorityResult(): AuthorityClassifierResult {
  return {
    buckets: [
      authorityBucket("ASSIGN-01", 4, 2, "assign01.rotation_authority_source_absent", "authority.assignment_lifecycle_contract"),
      authorityBucket("ORG-02", 3, 3, "org02.rotation_authority_source_absent", "authority.assignment_lifecycle_contract"),
      authorityBucket("ORG-04", 7, 3, "org04.multiple_distinct_managers", "authority.rbac_role_assignment"),
    ],
    familyTotals: [
      { authorityUnitCount: 2, checkHitCount: 4, family: "ASSIGN-01" },
      { authorityUnitCount: 3, checkHitCount: 3, family: "ORG-02" },
      { authorityUnitCount: 3, checkHitCount: 7, family: "ORG-04" },
    ],
    observedAt: "2026-07-12T09:00:00.000Z",
    overall: { authorityUnitCount: 8, checkHitCount: 14 },
    querySetVersion: AUTHORITY_CLASSIFIER_QUERY_SET_VERSION,
    sourceContracts: [{ code: "assignment_rotation_lifecycle", state: "absent" }],
    v2FamilyTotals: [
      { family: "ASSIGN-01", hitCount: 4 },
      { family: "ORG-02", hitCount: 3 },
      { family: "ORG-04", hitCount: 7 },
      { family: "TARGET-02", hitCount: 0 },
    ],
  };
}

function validAuthoritySql() {
  const { v2FamilyTotals: _ignored, ...sql } = validAuthorityResult();
  return sql;
}

function authorityBucket(
  family: "ASSIGN-01" | "ORG-02" | "ORG-04",
  checkHitCount: number,
  authorityUnitCount: number,
  reason: AuthorityClassifierResult["buckets"][number]["reason"],
  source: AuthorityClassifierResult["buckets"][number]["source"],
) {
  return {
    authorityUnitCount,
    checkHitCount,
    family,
    reason,
    sampleAuthorityRefs: [],
    source,
    units: { authority: "authority_units" as const, findings: "check_hits" as const },
  };
}
