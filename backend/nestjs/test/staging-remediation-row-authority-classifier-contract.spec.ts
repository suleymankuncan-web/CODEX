import {
  AUTHORITY_CLASSIFIER_QUERY_SET_VERSION,
  createAuthorityClassifierReceipt,
  type AuthorityClassifierResult,
  validateAuthorityClassifierResult,
  validateAuthorityClassifierReceipt,
} from "../scripts/staging-remediation-row-authority-classifier-contract";

describe("staging remediation row-authority classifier contract", () => {
  // Trace: FR-03..09; NFR-03, NFR-05; AC-02..04; EC-01..08.
  it("accepts exhaustive family reconciliation while keeping check hits and authority units distinct", () => {
    const result = validateAuthorityClassifierResult(validResult());

    expect(result.overall).toEqual({ authorityUnitCount: 8, checkHitCount: 14 });
    expect(result.familyTotals).toEqual([
      { authorityUnitCount: 2, checkHitCount: 4, family: "ASSIGN-01" },
      { authorityUnitCount: 3, checkHitCount: 3, family: "ORG-02" },
      { authorityUnitCount: 3, checkHitCount: 7, family: "ORG-04" },
    ]);
    expect(result.v2FamilyTotals.find((item) => item.family === "TARGET-02")?.hitCount).toBe(0);
  });

  // Trace: FR-03, FR-04; NFR-03; AC-02; EC-07..09.
  it.each([
    ["dishonest family total", (value: AuthorityClassifierResult) => {
      value.familyTotals[2].checkHitCount += 1;
    }, "dishonest_authority_family_total"],
    ["dishonest V2 reconciliation", (value: AuthorityClassifierResult) => {
      value.v2FamilyTotals.find((item) => item.family === "ORG-04")!.hitCount += 1;
    }, "v2_authority_reconciliation_mismatch"],
    ["TARGET classifier bucket", (value: AuthorityClassifierResult) => {
      (value.buckets as unknown[]).push({
        authorityUnitCount: 1,
        checkHitCount: 1,
        family: "TARGET-02",
        reason: "org04.role_assignment_never_configured",
        sampleAuthorityRefs: ["111111111111"],
        source: "authority.rbac_role_assignment",
        units: { authority: "authority_units", findings: "check_hits" },
      });
    }, "authority_family_not_allowed"],
    ["authority units greater than findings", (value: AuthorityClassifierResult) => {
      value.buckets[0].authorityUnitCount = value.buckets[0].checkHitCount + 1;
    }, "invalid_authority_unit_count"],
  ])("rejects %s", (_name, mutate, expected) => {
    const value = validResult();
    mutate(value);
    expect(() => validateAuthorityClassifierResult(value)).toThrow(expected);
  });

  // Trace: FR-05, FR-11; NFR-03; AC-03, AC-05; EC-10.
  it("rejects a reason/source combination borrowed from another root cause", () => {
    const value = validResult();
    value.buckets[2].source = "authority.action_store_portfolio";
    expect(() => validateAuthorityClassifierResult(value)).toThrow("authority_source_reason_mismatch");
  });

  // Trace: FR-06, FR-11; NFR-03, NFR-05; AC-03, AC-05; EC-01..03, EC-10.
  it.each([
    ["duplicate sample", ["111111111111", "111111111111"], "duplicate_sample_authority_ref"],
    ["unsorted sample", ["222222222222", "111111111111"], "unsorted_sample_authority_ref"],
    ["raw UUID", ["00000000-0000-4000-8000-000000000001"], "invalid_sample_authority_ref"],
    ["too many samples", ["000000000001", "000000000002", "000000000003", "000000000004", "000000000005", "000000000006"], "too_many_sample_authority_refs"],
  ])("rejects %s", (_name, refs, expected) => {
    const value = validResult();
    value.buckets[0].sampleAuthorityRefs = refs;
    expect(() => validateAuthorityClassifierResult(value)).toThrow(expected);
  });

  // Trace: FR-08..10; NFR-03; AC-04; EC-12.
  it("requires the rotation lifecycle source contract to remain explicitly absent", () => {
    const value = validResult() as AuthorityClassifierResult & {
      sourceContracts: Array<{ code: string; state: string }>;
    };
    (value.sourceContracts[0] as unknown as { state: string }).state = "present";
    expect(() => validateAuthorityClassifierResult(value)).toThrow(
      "source_contract_version_change_required",
    );
  });

  // Trace: FR-11, FR-12; NFR-02..05; AC-05, AC-07; EC-10, EC-13.
  it("binds the complete sanitized result to exact query, runner, target, and timeout provenance", () => {
    const receipt = createAuthorityClassifierReceipt({
      certificateVerified: false,
      classifierQueryDigest: "1".repeat(64),
      invariantV2QueryDigest: "2".repeat(64),
      queryResult: validResult(),
      reviewedCommit: "a".repeat(40),
      runnerDigest: "3".repeat(64),
      targetClass: "disposable",
      targetFingerprint: "4".repeat(64),
      tlsMode: "disable",
    });

    expect(receipt.receiptDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(receipt.transactionIsolation).toBe("repeatable_read");
    expect(receipt.transactionReadOnly).toBe(true);
    expect(receipt.timeoutProfile).toEqual({
      connectionMs: 5000,
      idleMs: 1000,
      queryMs: 30000,
      statementMs: 30000,
    });
    expect(validateAuthorityClassifierReceipt(receipt)).toEqual(receipt);
  });

  it("rejects receipt digest tampering and extra fields", () => {
    const receipt = createAuthorityClassifierReceipt({
      certificateVerified: true,
      classifierQueryDigest: "1".repeat(64),
      invariantV2QueryDigest: "2".repeat(64),
      queryResult: validResult(),
      reviewedCommit: "a".repeat(40),
      runnerDigest: "3".repeat(64),
      targetClass: "staging",
      targetFingerprint: "4".repeat(64),
      tlsMode: "verify-full",
    });
    expect(() => validateAuthorityClassifierReceipt({
      ...receipt,
      receiptDigest: "f".repeat(64),
    })).toThrow("receipt_digest_mismatch");
    expect(() => validateAuthorityClassifierReceipt({ ...receipt, rawId: "hidden" })).toThrow(
      "authority_classifier_receipt_schema_mismatch",
    );
  });
});

function validResult(): AuthorityClassifierResult {
  return {
    buckets: [
      {
        authorityUnitCount: 2,
        checkHitCount: 4,
        family: "ASSIGN-01",
        reason: "assign01.rotation_authority_source_absent",
        sampleAuthorityRefs: ["111111111111", "222222222222"],
        source: "authority.assignment_lifecycle_contract",
        units: { authority: "authority_units", findings: "check_hits" },
      },
      {
        authorityUnitCount: 3,
        checkHitCount: 3,
        family: "ORG-02",
        reason: "org02.rotation_authority_source_absent",
        sampleAuthorityRefs: ["333333333333"],
        source: "authority.assignment_lifecycle_contract",
        units: { authority: "authority_units", findings: "check_hits" },
      },
      {
        authorityUnitCount: 2,
        checkHitCount: 5,
        family: "ORG-04",
        reason: "org04.role_assignment_never_configured",
        sampleAuthorityRefs: ["444444444444"],
        source: "authority.rbac_role_assignment",
        units: { authority: "authority_units", findings: "check_hits" },
      },
      {
        authorityUnitCount: 1,
        checkHitCount: 2,
        family: "ORG-04",
        reason: "org04.multiple_distinct_managers",
        sampleAuthorityRefs: ["555555555555"],
        source: "authority.rbac_role_assignment",
        units: { authority: "authority_units", findings: "check_hits" },
      },
    ],
    familyTotals: [
      { authorityUnitCount: 2, checkHitCount: 4, family: "ASSIGN-01" },
      { authorityUnitCount: 3, checkHitCount: 3, family: "ORG-02" },
      { authorityUnitCount: 3, checkHitCount: 7, family: "ORG-04" },
    ],
    observedAt: "2026-07-12T12:00:00.000Z",
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
