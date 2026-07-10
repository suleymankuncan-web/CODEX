import {
  assertConnectionBoundary,
  classifyCandidate,
  classifySafeError,
  mapCheckResult,
  resolveDecision,
} from "../scripts/database-invariant-preflight-core";

describe("database invariant preflight core", () => {
  it("classifies zero, violation, and unresolved temporal candidates", () => {
    expect(classifyCandidate("ORG-01", 0, disposableContext)).toEqual({
      classification: "blocked_live_evidence",
      reason: "disposable_zero_count_is_not_live_evidence",
    });
    expect(classifyCandidate("ORG-01", 0, stagingContext)).toEqual({
      classification: "safe_to_enforce",
      reason: "approved_staging_target_reports_zero_violations",
    });
    expect(classifyCandidate("ORG-01", 2, stagingContext)).toEqual({
      classification: "requires_data_correction",
      reason: "violations_present_no_automatic_repair",
    });
    expect(classifyCandidate("ASSIGN-01", 0, stagingContext)).toEqual({
      classification: "requires_business_decision",
      reason: "primary_assignment_temporal_semantics_unapproved",
    });
    expect(classifyCandidate("TARGET-02", 0, stagingContext)).toEqual({
      classification: "requires_business_decision",
      reason: "target_duplicate_state_enforcement_unapproved",
    });
    expect(classifyCandidate("KEY-01", 0, stagingContext)).toEqual({
      classification: "deferred_lock_or_performance",
      reason: "candidate_parent_key_validation_cost_not_measured",
    });
  });

  it("keeps disposable evidence local and blocks unresolved staging semantics", () => {
    expect(resolveDecision("disposable", 0)).toBe("clean_local");
    expect(resolveDecision("staging", 0)).toBe("blocked_business_decision");
    expect(resolveDecision("staging", 1)).toBe("blocked_violations");
  });

  it("accepts only bounded hashed sample references", () => {
    expect(
      mapCheckResult({
        category: "organization",
        check_id: "ORG-01",
        sample_refs: ["012345abcdef"],
        violation_count: "1",
      }, disposableContext),
    ).toMatchObject({
      sampleRefs: ["012345abcdef"],
      violationCount: 1,
    });

    for (const unsafe of [
      "00000000-0000-0000-0000-000000000001",
      "employee@example.com",
      "postgres://user:secret@localhost/database",
      "+905551112233",
      "employee-name",
    ]) {
      expect(() =>
        mapCheckResult({
          category: "organization",
          check_id: "ORG-01",
          sample_refs: [unsafe],
          violation_count: 1,
        }, disposableContext),
      ).toThrow("unsafe_sample_ref");
    }
  });

  it("fails closed on invalid counts, excessive samples, and unsafe errors", () => {
    expect(() =>
      mapCheckResult({
        category: "organization",
        check_id: "ORG-01",
        sample_refs: [],
        violation_count: -1,
      }, disposableContext),
    ).toThrow("invalid_violation_count");
    expect(() =>
      mapCheckResult({
        category: "organization",
        check_id: "ORG-01",
        sample_refs: Array.from({ length: 6 }, () => "012345abcdef"),
        violation_count: 6,
      }, disposableContext),
    ).toThrow("too_many_sample_refs");
    expect(classifySafeError(new Error("unsafe_sample_ref"))).toBe("unsafe_sample_ref");
    expect(classifySafeError(new Error("postgres://user:secret@host/db"))).toBe(
      "database_preflight_failed",
    );
  });

  it("binds disposable and staging labels to an explicit database identity", () => {
    expect(() => assertConnectionBoundary(
      "disposable",
      "postgres://user:secret@localhost:54329/store_ops_fresh_migration_smoke_preflight",
      {},
    )).not.toThrow();
    expect(() => assertConnectionBoundary(
      "disposable",
      "postgres://user:secret@database.example/store_ops_live",
      {},
    )).toThrow("non_disposable_target_refused");

    const stagingUrl = "postgres://user:secret@staging.db.example/store_ops_staging";
    expect(() => assertConnectionBoundary("staging", stagingUrl, {})).toThrow(
      "staging_target_identity_missing",
    );
    expect(() => assertConnectionBoundary("staging", stagingUrl, {
      database: "wrong_database",
      host: "staging.db.example",
    })).toThrow("staging_target_identity_mismatch");
    expect(() => assertConnectionBoundary("staging", stagingUrl, {
      database: "store_ops_staging",
      host: "staging.db.example",
    })).not.toThrow();
    expect(() => assertConnectionBoundary(
      "staging",
      "postgres://user:secret@prod.db.example/store_ops_production",
      { database: "store_ops_production", host: "prod.db.example" },
    )).toThrow("production_target_refused");
  });
});

const disposableContext = {
  candidateKeys: {
    regionCompositeUniquePresent: false,
    storeCompositeUniquePresent: false,
  },
  targetClass: "disposable" as const,
};

const stagingContext = {
  ...disposableContext,
  targetClass: "staging" as const,
};
