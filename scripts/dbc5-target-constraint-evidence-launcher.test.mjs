import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  buildMergedRunnerInvocation,
  buildRunnerEnvironment,
  canonicalDigest,
  claimEvidenceAttempt,
  createSafeFailurePayload,
  executeEvidence,
  validateEvidenceDiffPaths,
  validateInputs,
  verifyRepositoryState,
} from "./dbc5-target-constraint-evidence-launcher.mjs";

function istanbulIso(timestamp) {
  return `${new Date(timestamp + 3 * 60 * 60_000).toISOString().replace(/Z$/, "")}+03:00`;
}

function validEnvironment(caFile) {
  const now = Date.now();
  const scheme = "postgresql" + "://";
  return {
    ...process.env,
    DATABASE_INVARIANT_PREFLIGHT_EXPECTED_DATABASE: "postgres",
    DATABASE_INVARIANT_PREFLIGHT_EXPECTED_HOST: "staging.example",
    DATABASE_URL: `${scheme}postgres.example:placeholder@staging.example:6543/postgres`,
    DBC5_TARGET_CONSTRAINT_EVIDENCE_BRANCH: "codex/dbc5-target-constraint-evidence-v1-reviewed",
    DBC5_TARGET_CONSTRAINT_REVIEWED_COMMIT: "a".repeat(40),
    DB_SSL_MODE: "verify-full",
    STAGING_REMEDIATION_CA_FILE: caFile,
    STAGING_REMEDIATION_EXPECTED_PROJECT_REF_SHA256:
      createHash("sha256").update("example").digest("hex"),
    STAGING_REMEDIATION_OWNER_AUTHORIZATION: "standing-owner-authorization-2026-07-12",
    STAGING_REMEDIATION_WINDOW_END: istanbulIso(now + 5 * 60_000),
    STAGING_REMEDIATION_WINDOW_START: istanbulIso(now - 5 * 60_000),
  };
}

function withCa(run) {
  const directory = mkdtempSync(join(tmpdir(), "hr-axis-dbc5-launcher-"));
  try {
    const caFile = join(directory, "ca.pem");
    writeFileSync(caFile, "-----BEGIN CERTIFICATE-----\nTEST-ONLY\n-----END CERTIFICATE-----\n", "utf8");
    return run({ caFile, directory });
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
}

// Trace: FR-08, FR-10; NFR-01..04, NFR-06; AC-04, AC-06; EC-08..10.
test("validates guarded DB-C5 inputs and builds only the approved staging runner environment", () =>
  withCa(({ caFile }) => {
    const env = validEnvironment(caFile);
    const inputs = validateInputs(env);
    const runner = buildRunnerEnvironment(inputs, env);
    assert.equal(inputs.evidenceBranch, "codex/dbc5-target-constraint-evidence-v1-reviewed");
    assert.equal(runner.DBC5_TARGET_CONSTRAINT_REVIEWED_COMMIT, "a".repeat(40));
    assert.equal(runner.DBC5_TARGET_CONSTRAINT_STAGING_APPROVED, "true");
    assert.equal(runner.DATABASE_INVARIANT_PREFLIGHT_ACK, "staging-ddl-approved");
    assert.equal(runner.DATABASE_INVARIANT_PREFLIGHT_TARGET, "staging");
    assert.equal(runner.STAGING_REMEDIATION_CA_FILE, undefined);
    assert.match(runner.DB_SSL_CA, /BEGIN CERTIFICATE/);
  }));

test("pins evidence branch, reviewed HEAD, origin/main and a clean worktree", () => {
  const reviewedCommit = "a".repeat(40);
  const evidenceBranch = "codex/dbc5-target-constraint-evidence-v1-reviewed";
  const responses = new Map([
    ["fetch origin --quiet", { status: 0, stderr: "", stdout: "" }],
    ["branch --show-current", { status: 0, stderr: "", stdout: `${evidenceBranch}\n` }],
    ["rev-parse HEAD", { status: 0, stderr: "", stdout: `${reviewedCommit}\n` }],
    ["rev-parse origin/main", { status: 0, stderr: "", stdout: `${reviewedCommit}\n` }],
    ["status --porcelain=v1", { status: 0, stderr: "", stdout: "" }],
  ]);
  assert.equal(verifyRepositoryState(
    { evidenceBranch, reviewedCommit },
    (args) => responses.get(args.join(" ")),
  ).worktreeClean, true);
});

test("atomically consumes one DB-C5 staging DDL attempt per reviewed SHA", () =>
  withCa(({ directory }) => {
    const inputs = baseInputs();
    const marker = claimEvidenceAttempt(inputs, directory, "2026-07-12T16:05:00.000Z");
    assert.equal(JSON.parse(readFileSync(marker, "utf8")).event,
      "dbc5_target_constraint.apply_attempted");
    assert.throws(() => claimEvidenceAttempt(inputs, directory), /attempt_already_recorded/);
  }));

test("uses the reviewed Windows npm wrapper", () => {
  assert.deepEqual(buildMergedRunnerInvocation("win32"), {
    args: ["/d", "/s", "/c",
      "npm.cmd --silent --prefix backend/nestjs run apply:staging:dbc5:target"],
    command: "cmd.exe",
  });
});

test("allows only evidence and handoff documents in the evidence PR", () => {
  assert.deepEqual(validateEvidenceDiffPaths([
    "docs/evidence/readiness/2026-07-12-staging-dbc5-target-constraint-v1.json",
    "docs/evidence/readiness/2026-07-12-staging-dbc5-target-constraint-v1.md",
    "current-state.md",
  ]), [
    "current-state.md",
    "docs/evidence/readiness/2026-07-12-staging-dbc5-target-constraint-v1.json",
    "docs/evidence/readiness/2026-07-12-staging-dbc5-target-constraint-v1.md",
  ]);
  assert.throws(() => validateEvidenceDiffPaths([
    "db/migrations/060_target_distribution_duplicate_employee_constraint_v1.sql",
  ]), /evidence_diff_scope_violation/);
});

test("accepts only exit zero, empty stderr and an exact sanitized apply receipt", () =>
  withCa(({ directory }) => {
    const inputs = baseInputs();
    const receipt = validReceipt(inputs.reviewedCommit);
    const summary = executeEvidence(inputs, {}, {
      executeRunner: () => ({ status: 0, stderr: "", stdout: `${JSON.stringify(receipt)}\n` }),
      temporaryDirectory: directory,
    });
    assert.equal(summary.exitCode, 0);
    assert.equal(summary.stagingDdlExecuted, true);
    assert.equal(summary.receiptDigest, receipt.receiptDigest);
  }));

test("rejects nonzero exit, stderr, unsafe output and malformed receipts", () =>
  withCa(({ directory }) => {
    const inputs = baseInputs("b");
    const valid = validReceipt(inputs.reviewedCommit);
    let runFailure;
    try {
      executeEvidence(inputs, {}, {
        executeRunner: () => ({ status: 1, stderr: "", stdout: JSON.stringify(valid) }),
        temporaryDirectory: directory,
      });
    } catch (error) { runFailure = error; }
    assert.match(runFailure?.message ?? "", /runner_safety_failure/);
    assert.equal(
      createSafeFailurePayload(runFailure).stagingDdlExecuted,
      "unverified_after_attempt",
    );
    assert.equal(createSafeFailurePayload(new Error("worktree_dirty")).stagingDdlExecuted, false);

    const stderrDirectory = mkdtempSync(join(tmpdir(), "hr-axis-dbc5-stderr-"));
    try {
      assert.throws(() => executeEvidence(inputs, {}, {
        executeRunner: () => ({ status: 0, stderr: "unexpected", stdout: JSON.stringify(valid) }),
        temporaryDirectory: stderrDirectory,
      }), /runner_stderr_rejected/);
    } finally { rmSync(stderrDirectory, { force: true, recursive: true }); }

    const malformedDirectory = mkdtempSync(join(tmpdir(), "hr-axis-dbc5-malformed-"));
    try {
      const malformed = validReceipt(inputs.reviewedCommit);
      malformed.postflight.activeTargetV2Hits = 1;
      assert.throws(() => executeEvidence(inputs, {}, {
        executeRunner: () => ({ status: 0, stderr: "", stdout: JSON.stringify(malformed) }),
        temporaryDirectory: malformedDirectory,
      }), /receipt_contract_mismatch/);
    } finally { rmSync(malformedDirectory, { force: true, recursive: true }); }
  }));

test("rejects a self-consistent receipt whose exact candidate provenance drifted", () =>
  withCa(({ directory }) => {
    const inputs = baseInputs("e");
    const receipt = validReceipt(inputs.reviewedCommit);
    receipt.candidateDigests.gitLf.addConstraint = "f".repeat(64);
    delete receipt.receiptDigest;
    receipt.receiptDigest = canonicalDigest(receipt);
    assert.throws(() => executeEvidence(inputs, {}, {
      executeRunner: () => ({ status: 0, stderr: "", stdout: JSON.stringify(receipt) }),
      temporaryDirectory: directory,
    }), /receipt_contract_mismatch/);
  }));

function baseInputs(seed = "a") {
  return {
    evidenceBranch: "codex/dbc5-target-constraint-evidence-v1-reviewed",
    launcherDigest: "c".repeat(64),
    projectRefFingerprint: "d".repeat(64),
    reviewedCommit: seed.repeat(40),
    windowEndText: "2026-07-12T19:30:00+03:00",
    windowStartText: "2026-07-12T19:00:00+03:00",
  };
}

function validReceipt(reviewedCommit) {
  const bindings = expectedBindings();
  const withoutDigest = {
    candidateDigests: bindings.candidateDigests,
    certificateVerified: true,
    event: "dbc5_target_constraint.apply_completed",
    evidenceReceipts: bindings.evidenceReceipts,
    migration: {
      appliedCount: 1, checksum: bindings.migrationChecksum,
      checksumStyles: { gitLf: 59, windowsCrlf: 0 }, failedCount: 0,
      name: "060_target_distribution_duplicate_employee_constraint_v1.sql", skippedCount: 59,
    },
    postflight: {
      activeTargetV2Hits: 0, constraintState: "present_valid_exact",
      functionState: "present_immutable_exact", indexStrategy: "not_applicable_no_index_candidate",
      migrationState: "succeeded_exact", transactionReadOnly: true,
    },
    preflight: {
      lockBuckets: 1, over30sTransactions: 0, state: "eligible", targetLiveRows: 61,
      transactionIsolation: "repeatable_read", transactionReadOnly: true,
    },
    receiptVersion: "1", reviewedCommit, runnerDigest: bindings.runnerDigest,
    stagingDdlExecuted: true, targetClass: "staging", targetFingerprint: "d".repeat(64),
    timeoutProfile: {
      connectionMs: 5000, idleMs: 1000, lockMs: 5000, queryMs: 30000, statementMs: 30000,
    },
    tlsMode: "verify-full",
  };
  return { ...withoutDigest, receiptDigest: canonicalDigest(withoutDigest) };
}

function expectedBindings() {
  const root = join(import.meta.dirname, "..");
  const packageRoot = join(root, "db", "constraint-packages", "rem8-target-duplicate-v1");
  const migrationPath = join(
    root, "db", "migrations", "060_target_distribution_duplicate_employee_constraint_v1.sql",
  );
  const sql = {
    addConstraint: readFileSync(join(packageRoot, "002_add_constraint_not_valid.sql"), "utf8"),
    createFunction: readFileSync(join(packageRoot, "001_create_function.sql"), "utf8"),
    rollback: readFileSync(join(packageRoot, "rollback.sql"), "utf8"),
    validateConstraint: readFileSync(join(packageRoot, "003_validate_constraint.sql"), "utf8"),
  };
  const runnerPaths = [
    join(root, "backend", "nestjs", "scripts", "dbc5-target-constraint-apply.ts"),
    join(root, "backend", "nestjs", "scripts", "dbc5-target-constraint-apply-contract.ts"),
    join(root, "backend", "nestjs", "scripts", "rem8-target-constraint-observation-contract.ts"),
    join(root, "backend", "nestjs", "scripts", "rem8-target-constraint-rehearsal-contract.ts"),
    join(root, "backend", "nestjs", "scripts", "rem8-target-constraint-package-contract.ts"),
    migrationPath,
    join(root, "db", "preflight", "rem8-target-constraint-observation-v1.sql"),
    join(root, "db", "preflight", "rem8-target-constraint-plan-v1.sql"),
    join(root, "db", "preflight", "staging-remediation-invariant-v2.sql"),
  ];
  return {
    candidateDigests: {
      evidenceCrlf: hashSql(sql, crlf),
      gitLf: hashSql(sql, lf),
    },
    evidenceReceipts: {
      observation: "450ea647b22152a0bf476478fe472abcb398c3f55c1489c834a88e607a6f6aeb",
      rehearsal: "db1359e9086754ae6f7382648cbdd8ac728f90d9f5539de67448b3c9b5dbabda",
    },
    migrationChecksum: hash(lf(readFileSync(migrationPath, "utf8"))),
    runnerDigest: hash(runnerPaths
      .map((path) => `${path.split(/[\\/]/).at(-1)}\0${readFileSync(path, "utf8")}`)
      .join("\0")),
  };
}

function hashSql(sql, normalize) {
  return Object.fromEntries(Object.entries(sql).map(([key, value]) => [key, hash(normalize(value))]));
}

function hash(value) { return createHash("sha256").update(value).digest("hex"); }
function lf(value) { return value.replace(/\r\n?/g, "\n"); }
function crlf(value) { return lf(value).replace(/\n/g, "\r\n"); }
