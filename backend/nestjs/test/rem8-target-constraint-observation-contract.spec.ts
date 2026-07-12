import {
  REM8_OBSERVATION_QUERY_SET_VERSION,
  buildRem8Observation,
  createRem8ObservationReceipt,
  validateRem8ObservationReceipt,
  type Rem8ObservationSqlDocument,
} from "../scripts/rem8-target-constraint-observation-contract";

describe("REM-8 TARGET constraint observation contract", () => {
  // Trace: FR-05..09; NFR-01..04; AC-02; EC-05..10, EC-16.
  it("accepts exact sanitized TARGET capacity, compatibility, and lock facts", () => {
    const result = buildRem8Observation(
      validDocument(),
      0,
      validPlan(),
      "a".repeat(64),
      validPackageDigests(),
    );

    expect(result.state).toBe("eligible_for_disposable_rehearsal");
    expect(result.reasons).toEqual(["all_prerequisites_satisfied"]);
    expect(result.compatibility).toMatchObject({
      activeTargetV2Hits: 0,
      ordinaryDuplicateRows: 0,
      pilotDuplicateGroups: 0,
      pilotUniqueIndex: "present_valid_exact",
    });
    expect(result.candidate).toMatchObject({
      addLock: "access_exclusive",
      validateLock: "share_update_exclusive",
    });
  });

  it.each([
    ["duplicate rows", (value: Rem8ObservationSqlDocument) => { value.compatibility.ordinaryDuplicateRows = 1; }, "ordinary_duplicate_rows_present"],
    ["pilot index drift", (value: Rem8ObservationSqlDocument) => { value.compatibility.pilotUniqueIndex = "definition_drifted"; }, "pilot_unique_index_not_exact"],
    ["candidate artifact", (value: Rem8ObservationSqlDocument) => { value.artifacts.functionState = "present"; }, "candidate_artifact_conflict"],
    ["partitioned table", (value: Rem8ObservationSqlDocument) => { value.targetTable.partitioned = true; }, "target_table_partitioned"],
    ["server major drift", (value: Rem8ObservationSqlDocument) => { value.server.major = 18; }, "server_major_mismatch"],
  ])("blocks on %s", (_name, mutate, reason) => {
    const value = validDocument();
    mutate(value);
    const result = buildRem8Observation(
      value, 0, validPlan(), "a".repeat(64), validPackageDigests(),
    );
    expect(result.state).toBe("blocked");
    expect(result.reasons).toContain(reason);
  });

  it("blocks when active V2 TARGET drifts non-zero", () => {
    const result = buildRem8Observation(
      validDocument(), 1, validPlan(), "a".repeat(64), validPackageDigests(),
    );
    expect(result).toMatchObject({ state: "blocked", reasons: ["active_target_v2_hits_present"] });
  });

  it("rejects unknown lock modes, raw plan fields, and extra SQL fields", () => {
    const lock = validDocument();
    lock.locks[0].mode = "UnknownLock";
    expect(() => buildRem8Observation(
      lock, 0, validPlan(), "a".repeat(64), validPackageDigests(),
    )).toThrow("lock_mode_not_allowed");

    expect(() => buildRem8Observation(
      validDocument(), 0, { ...validPlan(), rawQuery: "select secret" }, "a".repeat(64), validPackageDigests(),
    )).toThrow("observation_plan_schema_mismatch");

    expect(() => buildRem8Observation(
      { ...validDocument(), pid: 42 }, 0, validPlan(), "a".repeat(64), validPackageDigests(),
    )).toThrow("observation_sql_schema_mismatch");
  });

  // Trace: FR-09; NFR-01..04; AC-02, AC-03; EC-16.
  it("digest-binds a strict verify-full staging receipt", () => {
    const result = buildRem8Observation(
      validDocument(), 0, validPlan(), "a".repeat(64), validPackageDigests(),
    );
    const receipt = createRem8ObservationReceipt({
      certificateVerified: true,
      invariantV2QueryDigest: "b".repeat(64),
      observationQueryDigest: "c".repeat(64),
      planQueryDigest: "9".repeat(64),
      queryResult: result,
      reviewedCommit: "d".repeat(40),
      runnerDigest: "e".repeat(64),
      targetClass: "staging",
      targetFingerprint: "f".repeat(64),
      tlsMode: "verify-full",
    });

    expect(validateRem8ObservationReceipt(receipt)).toEqual(receipt);
    expect(() => validateRem8ObservationReceipt({ ...receipt, rawHost: "hidden" })).toThrow(
      "observation_receipt_schema_mismatch",
    );
    expect(() => validateRem8ObservationReceipt({
      ...receipt, receiptDigest: "0".repeat(64),
    })).toThrow("receipt_digest_mismatch");
  });
});

function validDocument(): Rem8ObservationSqlDocument {
  return {
    artifacts: { constraintState: "absent", functionState: "absent" },
    compatibility: {
      nonArrayRows: 0,
      ordinaryDuplicateRows: 0,
      pilotDuplicateGroups: 0,
      pilotUniqueIndex: "present_valid_exact",
    },
    locks: [
      { count: 1, granted: true, mode: "AccessShareLock" },
    ],
    observedAt: "2026-07-12T15:30:00.000Z",
    querySetVersion: REM8_OBSERVATION_QUERY_SET_VERSION,
    server: { major: 17 },
    targetTable: {
      deadRows: 2,
      estimatedRows: 100,
      indexBytes: 32768,
      liveRows: 100,
      partitioned: false,
      tableBytes: 65536,
      totalBytes: 98304,
    },
    transactions: { activeCount: 1, maxAgeMs: 250, over30sCount: 0, over5sCount: 0 },
    writes: { deleted: 1, inserted: 120, statsAgeSeconds: 3600, updated: 20 },
  };
}

function validPlan() {
  return { nodeTypes: ["Aggregate", "Seq Scan"], planRows: 1, totalCost: 42.25 };
}

function validPackageDigests() {
  return {
    addConstraint: "1".repeat(64),
    createFunction: "2".repeat(64),
    rollback: "3".repeat(64),
    validateConstraint: "4".repeat(64),
  };
}
