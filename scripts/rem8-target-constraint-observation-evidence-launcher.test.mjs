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
  executeEvidence,
  validateEvidenceDiffPaths,
  validateInputs,
  verifyRepositoryState,
} from "./rem8-target-constraint-observation-evidence-launcher.mjs";

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
    DB_SSL_MODE: "verify-full",
    REM8_TARGET_OBSERVATION_EVIDENCE_BRANCH: "codex/rem8-target-observation-evidence-v1-reviewed",
    REM8_TARGET_OBSERVATION_REVIEWED_COMMIT: "a".repeat(40),
    STAGING_REMEDIATION_CA_FILE: caFile,
    STAGING_REMEDIATION_EXPECTED_PROJECT_REF_SHA256:
      createHash("sha256").update("example").digest("hex"),
    STAGING_REMEDIATION_OWNER_AUTHORIZATION: "standing-owner-authorization-2026-07-12",
    STAGING_REMEDIATION_WINDOW_END: istanbulIso(now + 5 * 60_000),
    STAGING_REMEDIATION_WINDOW_START: istanbulIso(now - 5 * 60_000),
  };
}

function withCa(run) {
  const directory = mkdtempSync(join(tmpdir(), "hr-axis-rem8-observation-launcher-"));
  try {
    const caFile = join(directory, "ca.pem");
    writeFileSync(caFile, "-----BEGIN CERTIFICATE-----\nTEST-ONLY\n-----END CERTIFICATE-----\n", "utf8");
    return run({ caFile, directory });
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
}

// Trace: FR-10; NFR-01..04, NFR-08; AC-03; EC-16..18.
test("validates guarded REM-8 observation inputs and forwards only CA content", () => withCa(({ caFile }) => {
  const env = validEnvironment(caFile);
  const inputs = validateInputs(env);
  const runner = buildRunnerEnvironment(inputs, env);
  assert.equal(inputs.evidenceBranch, "codex/rem8-target-observation-evidence-v1-reviewed");
  assert.equal(runner.REM8_TARGET_OBSERVATION_REVIEWED_COMMIT, "a".repeat(40));
  assert.equal(runner.STAGING_REMEDIATION_CA_FILE, undefined);
  assert.match(runner.DB_SSL_CA, /BEGIN CERTIFICATE/);
  assert.equal(runner.DATABASE_INVARIANT_PREFLIGHT_TARGET, "staging");
}));

test("pins evidence branch, HEAD, origin/main and clean state", () => {
  const reviewedCommit = "a".repeat(40);
  const evidenceBranch = "codex/rem8-target-observation-evidence-v1-reviewed";
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

test("atomically consumes one REM-8 observation attempt per reviewed SHA", () => withCa(({ directory }) => {
  const inputs = {
    evidenceBranch: "codex/rem8-target-observation-evidence-v1-reviewed",
    launcherDigest: "c".repeat(64),
    projectRefFingerprint: "d".repeat(64),
    reviewedCommit: "a".repeat(40),
    windowEndText: "2026-07-12T19:30:00+03:00",
    windowStartText: "2026-07-12T19:00:00+03:00",
  };
  const marker = claimEvidenceAttempt(inputs, directory, "2026-07-12T16:05:00.000Z");
  assert.equal(JSON.parse(readFileSync(marker, "utf8")).event, "rem8_target_constraint.observation_attempted");
  assert.throws(() => claimEvidenceAttempt(inputs, directory), /attempt_already_recorded/);
}));

test("uses the reviewed Windows npm wrapper", () => {
  assert.deepEqual(buildMergedRunnerInvocation("win32"), {
    args: ["/d", "/s", "/c", "npm.cmd --silent --prefix backend/nestjs run observe:rem8:target:constraint"],
    command: "cmd.exe",
  });
});

test("allows only evidence and handoff documents in the evidence PR", () => {
  assert.deepEqual(validateEvidenceDiffPaths([
    "docs/evidence/readiness/2026-07-12-staging-rem8-target-constraint-observation-v1.json",
    "docs/evidence/readiness/2026-07-12-staging-rem8-target-constraint-disposable-rehearsal-v1.md",
    "current-state.md",
  ]), [
    "current-state.md",
    "docs/evidence/readiness/2026-07-12-staging-rem8-target-constraint-disposable-rehearsal-v1.md",
    "docs/evidence/readiness/2026-07-12-staging-rem8-target-constraint-observation-v1.json",
  ]);
  assert.throws(() => validateEvidenceDiffPaths([
    "backend/nestjs/scripts/rem8-target-constraint-observation.ts",
  ]), /evidence_diff_scope_violation/);
});

test("accepts exit two only with an exact sanitized observation receipt", () => withCa(({ directory }) => {
  const inputs = {
    evidenceBranch: "codex/rem8-target-observation-evidence-v1-reviewed",
    launcherDigest: "c".repeat(64),
    projectRefFingerprint: "d".repeat(64),
    reviewedCommit: "a".repeat(40),
    windowEndText: "2026-07-12T19:30:00+03:00",
    windowStartText: "2026-07-12T19:00:00+03:00",
  };
  const receipt = validReceipt(inputs.reviewedCommit);
  const summary = executeEvidence(inputs, {}, {
    executeRunner: () => ({ status: 2, stderr: "", stdout: `${JSON.stringify(receipt)}\n` }),
    temporaryDirectory: directory,
  });
  assert.equal(summary.observationState, "blocked");
  assert.equal(summary.exitCode, 2);
}));

test("rejects stderr, unsafe output and malformed receipts", () => withCa(({ directory }) => {
  const inputs = {
    evidenceBranch: "codex/rem8-target-observation-evidence-v1-reviewed",
    launcherDigest: "c".repeat(64), projectRefFingerprint: "d".repeat(64),
    reviewedCommit: "b".repeat(40), windowEndText: "end", windowStartText: "start",
  };
  assert.throws(() => executeEvidence(inputs, {}, {
    executeRunner: () => ({ status: 2, stderr: "unexpected", stdout: JSON.stringify(validReceipt(inputs.reviewedCommit)) }),
    temporaryDirectory: directory,
  }), /runner_stderr_rejected/);

  const malformedDirectory = mkdtempSync(join(tmpdir(), "hr-axis-rem8-malformed-"));
  try {
    const malformed = validReceipt(inputs.reviewedCommit);
    malformed.queryResult.server.major = -1;
    assert.throws(() => executeEvidence(inputs, {}, {
      executeRunner: () => ({ status: 2, stderr: "", stdout: JSON.stringify(malformed) }),
      temporaryDirectory: malformedDirectory,
    }), /receipt_contract_mismatch/);
  } finally {
    rmSync(malformedDirectory, { force: true, recursive: true });
  }
}));

function validReceipt(reviewedCommit) {
  const withoutDigest = {
    certificateVerified: true,
    event: "rem8_target_constraint.observation_completed",
    invariantV2QueryDigest: "1".repeat(64),
    observationQueryDigest: "2".repeat(64),
    planQueryDigest: "3".repeat(64),
    queryResult: {
      artifacts: { constraintState: "absent", functionState: "absent" },
      candidate: {
        addConstraintDigest: "4".repeat(64), addLock: "access_exclusive",
        functionDigest: "5".repeat(64), rollbackDigest: "6".repeat(64),
        validateConstraintDigest: "7".repeat(64), validateLock: "share_update_exclusive",
      },
      compatibility: {
        activeTargetV2Hits: 0, nonArrayRows: 0, ordinaryDuplicateRows: 0,
        pilotDuplicateGroups: 0, pilotUniqueIndex: "present_valid_exact",
      },
      indexStrategy: "not_applicable_no_index_candidate",
      locks: [{ count: 1, granted: true, mode: "AccessShareLock" }],
      observedAt: "2026-07-12T16:05:00.000Z",
      plan: { nodeTypes: ["Aggregate", "Seq Scan"], planRows: 1, totalCost: 42.5 },
      querySetVersion: "rem8-target-constraint-observation-v1",
      reasons: ["server_major_mismatch"],
      rem7ReceiptDigest: "8".repeat(64),
      server: { major: 16 },
      state: "blocked",
      targetTable: {
        deadRows: 0, estimatedRows: 100, indexBytes: 10, liveRows: 100,
        partitioned: false, tableBytes: 20, totalBytes: 30,
      },
      transactions: { activeCount: 1, maxAgeMs: 1, over30sCount: 0, over5sCount: 0 },
      writes: { deleted: 0, inserted: 100, statsAgeSeconds: 1, updated: 0 },
    },
    receiptVersion: "1", reviewedCommit,
    runnerDigest: "a".repeat(64), targetClass: "staging", targetFingerprint: "b".repeat(64),
    timeoutProfile: { connectionMs: 5000, idleMs: 1000, queryMs: 30000, statementMs: 30000 },
    tlsMode: "verify-full", transactionIsolation: "repeatable_read", transactionReadOnly: true,
  };
  return { ...withoutDigest, receiptDigest: canonicalDigest(withoutDigest) };
}
