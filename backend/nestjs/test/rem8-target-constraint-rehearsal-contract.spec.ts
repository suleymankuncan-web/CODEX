import type { Rem8Observation } from "../scripts/rem8-target-constraint-observation-contract";
import {
  createRem8RehearsalReceipt,
  decideRem8C,
  validateRem8RehearsalReceipt,
  type Rem8RehearsalReceipt,
} from "../scripts/rem8-target-constraint-rehearsal-contract";

describe("REM-8 TARGET disposable rehearsal and decision contract", () => {
  // Trace: FR-11..17; NFR-02..04, NFR-09; AC-04..08; EC-11..15.
  it("accepts a complete restored PG17 failure/concurrency/cleanup rehearsal", () => {
    const receipt = createRem8RehearsalReceipt(validRehearsalInput());

    expect(receipt.receiptDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(receipt).toMatchObject({
      cleanupVerified: true,
      constraintValidated: true,
      duplicateWriteRejected: true,
      failureValidationSqlState: "23514",
      indexStrategy: "not_applicable_no_index_candidate",
      lockTimeoutSqlState: "55P03",
      representativeness: "schema_writer_and_scale_contract_only",
      restoreSourceClass: "synthetic_migrated_fixture",
      writerFailures: 0,
    });
    expect(validateRem8RehearsalReceipt(receipt)).toEqual(receipt);
  });

  it.each([
    ["writer failure", (value: Record<string, unknown>) => { value.writerFailures = 1; }],
    ["cleanup failure", (value: Record<string, unknown>) => { value.cleanupVerified = false; }],
    ["wrong validation SQLSTATE", (value: Record<string, unknown>) => { value.failureValidationSqlState = "00000"; }],
    ["unexpected index strategy", (value: Record<string, unknown>) => { value.indexStrategy = "index"; }],
  ])("rejects %s", (_name, mutate) => {
    const receipt = createRem8RehearsalReceipt(validRehearsalInput());
    mutate(receipt as unknown as Record<string, unknown>);
    expect(() => validateRem8RehearsalReceipt(receipt)).toThrow();
  });

  it("rejects receipt digest tampering and extra fields", () => {
    const receipt = createRem8RehearsalReceipt(validRehearsalInput());
    expect(() => validateRem8RehearsalReceipt({
      ...receipt, receiptDigest: "0".repeat(64),
    })).toThrow("receipt_digest_mismatch");
    expect(() => validateRem8RehearsalReceipt({ ...receipt, rawRows: [] })).toThrow(
      "rehearsal_receipt_schema_mismatch",
    );
  });

  // Trace: FR-18; NFR-09; AC-09; EC-09, EC-10, EC-14.
  it("omits REM-8C only when staging scale and pressure fit the rehearsal envelope", () => {
    expect(decideRem8C(validObservation(), createRem8RehearsalReceipt(validRehearsalInput())))
      .toEqual({
        decision: "rem_8c_not_required",
        reasons: ["staging_fits_conservative_disposable_envelope"],
        stagingDdlExecuted: false,
      });
  });

  it.each([
    ["scale exceeds rehearsal", (value: Rem8Observation) => { value.targetTable.liveRows = 6000; }, "staging_scale_exceeds_rehearsal"],
    ["long transaction pressure", (value: Rem8Observation) => { value.transactions.over30sCount = 1; value.transactions.over5sCount = 1; value.transactions.activeCount = 1; }, "staging_long_transaction_pressure"],
    ["conflicting lock pressure", (value: Rem8Observation) => { value.locks.push({ count: 1, granted: false, mode: "AccessExclusiveLock" }); }, "staging_conflicting_lock_pressure"],
  ])("requires REM-8C when %s", (_name, mutate, reason) => {
    const observation = validObservation();
    mutate(observation);
    expect(decideRem8C(observation, createRem8RehearsalReceipt(validRehearsalInput())))
      .toEqual({ decision: "rem_8c_required", reasons: [reason], stagingDdlExecuted: false });
  });
});

function validRehearsalInput(): Parameters<typeof createRem8RehearsalReceipt>[0] {
  return {
    addConstraintMs: 12.5,
    cleanupVerified: true as const,
    constraintValidated: true as const,
    dumpDigest: "1".repeat(64),
    duplicateWriteRejected: true as const,
    failureValidationSqlState: "23514" as const,
    indexStrategy: "not_applicable_no_index_candidate" as const,
    lockTimeoutSqlState: "55P03" as const,
    migrationCount: 59,
    packageDigests: {
      addConstraint: "2".repeat(64),
      createFunction: "3".repeat(64),
      rollback: "4".repeat(64),
      validateConstraint: "5".repeat(64),
    },
    representativeness: "schema_writer_and_scale_contract_only" as const,
    restoreAggregateDigest: "6".repeat(64),
    restoreSourceClass: "synthetic_migrated_fixture" as const,
    restoredTargetRows: 5001,
    reviewedCommit: "a".repeat(40),
    rollbackMs: 4.25,
    runnerDigest: "7".repeat(64),
    sourceAggregateDigest: "6".repeat(64),
    syntheticScaleRows: 5000,
    validateConstraintMs: 18.75,
    writerAttempts: 20,
    writerFailures: 0 as const,
    writerSuccesses: 20,
  };
}

function validObservation(): Rem8Observation {
  return {
    artifacts: { constraintState: "absent", functionState: "absent" },
    candidate: {
      addConstraintDigest: "2".repeat(64),
      addLock: "access_exclusive",
      functionDigest: "3".repeat(64),
      rollbackDigest: "4".repeat(64),
      validateConstraintDigest: "5".repeat(64),
      validateLock: "share_update_exclusive",
    },
    compatibility: {
      activeTargetV2Hits: 0,
      nonArrayRows: 0,
      ordinaryDuplicateRows: 0,
      pilotDuplicateGroups: 0,
      pilotUniqueIndex: "present_valid_exact",
    },
    indexStrategy: "not_applicable_no_index_candidate",
    locks: [{ count: 1, granted: true, mode: "AccessShareLock" }],
    observedAt: "2026-07-12T15:30:00.000Z",
    plan: { nodeTypes: ["Aggregate", "Seq Scan"], planRows: 1, totalCost: 42 },
    querySetVersion: "rem8-target-constraint-observation-v1",
    reasons: ["all_prerequisites_satisfied"],
    rem7ReceiptDigest: "8".repeat(64),
    server: { major: 17 },
    state: "eligible_for_disposable_rehearsal",
    targetTable: {
      deadRows: 0,
      estimatedRows: 100,
      indexBytes: 32768,
      liveRows: 100,
      partitioned: false,
      tableBytes: 65536,
      totalBytes: 98304,
    },
    transactions: { activeCount: 0, maxAgeMs: 0, over30sCount: 0, over5sCount: 0 },
    writes: { deleted: 0, inserted: 100, statsAgeSeconds: 3600, updated: 5 },
  };
}
