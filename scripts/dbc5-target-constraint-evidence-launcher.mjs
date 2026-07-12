import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import {
  buildRunnerEnvironment as buildV2RunnerEnvironment,
  validateInputs as validateV2Inputs,
  verifyRepositoryState as verifyV2RepositoryState,
} from "./staging-remediation-invariant-v2-evidence-launcher.mjs";

const hex40 = /^[a-f0-9]{40}$/;
const hex64 = /^[a-f0-9]{64}$/;
const migrationName = "060_target_distribution_duplicate_employee_constraint_v1.sql";
const workspaceRoot = join(import.meta.dirname, "..");
const expectedEvidenceReceipts = Object.freeze({
  observation: "450ea647b22152a0bf476478fe472abcb398c3f55c1489c834a88e607a6f6aeb",
  rehearsal: "db1359e9086754ae6f7382648cbdd8ac728f90d9f5539de67448b3c9b5dbabda",
});

function required(name, env) {
  const value = env[name]?.trim();
  if (!value) throw new Error(`${name.toLowerCase()}_missing`);
  return value;
}

// Trace: FR-08, FR-10; NFR-01..04, NFR-06; AC-04, AC-06; EC-08..10.
export function validateInputs(env = process.env, now = Date.now()) {
  const reviewedCommit = required("DBC5_TARGET_CONSTRAINT_REVIEWED_COMMIT", env).toLowerCase();
  if (!hex40.test(reviewedCommit)) throw new Error("reviewed_commit_invalid");
  const evidenceBranch = required("DBC5_TARGET_CONSTRAINT_EVIDENCE_BRANCH", env);
  if (!/^codex\/dbc5-target-constraint-evidence-v1(?:-[a-z0-9][a-z0-9-]*)?$/.test(
    evidenceBranch,
  )) throw new Error("evidence_branch_invalid");
  const shared = validateV2Inputs({
    ...env,
    STAGING_REMEDIATION_EVIDENCE_BRANCH: "codex/rem-2b-v2-staging-evidence-dbc5-adapter",
    STAGING_REMEDIATION_INVARIANT_V2_REVIEWED_COMMIT: reviewedCommit,
  }, now);
  return {
    ...shared,
    evidenceBranch,
    launcherDigest: digestLauncherFiles(),
    reviewedCommit,
  };
}

function digestLauncherFiles() {
  const paths = [
    fileURLToPath(import.meta.url),
    fileURLToPath(new URL(
      "./staging-remediation-invariant-v2-evidence-launcher.mjs",
      import.meta.url,
    )),
  ];
  return createHash("sha256")
    .update(paths.map((path) => `${path.split(/[\\/]/).at(-1)}\0${readFileSync(path)}`).join("\0"))
    .digest("hex");
}

export function buildRunnerEnvironment(inputs, env = process.env) {
  const runnerEnvironment = buildV2RunnerEnvironment(inputs, env);
  delete runnerEnvironment.STAGING_REMEDIATION_INVARIANT_V2_REVIEWED_COMMIT;
  delete runnerEnvironment.DATABASE_INVARIANT_PREFLIGHT_STAGING_APPROVED;
  runnerEnvironment.DATABASE_INVARIANT_PREFLIGHT_ACK = "staging-ddl-approved";
  runnerEnvironment.DATABASE_INVARIANT_PREFLIGHT_TARGET = "staging";
  runnerEnvironment.DBC5_TARGET_CONSTRAINT_REVIEWED_COMMIT = inputs.reviewedCommit;
  runnerEnvironment.DBC5_TARGET_CONSTRAINT_STAGING_APPROVED = "true";
  return runnerEnvironment;
}

export function verifyRepositoryState(inputs, executeGit) {
  return verifyV2RepositoryState(inputs, executeGit);
}

export function validateEvidenceDiffPaths(paths) {
  const allowedExact = new Set([
    "current-state.md",
    "docs/README.md",
    "docs/plans/dbc5-target-duplicate-enforcement-spec-v1.md",
    "docs/plans/post-dg2-staging-remediation-and-constraint-reentry-plan-v1.md",
    "docs/plans/rem-2-owner-decision-packet-v1.md",
  ]);
  const evidencePattern = /^docs\/evidence\/readiness\/\d{4}-\d{2}-\d{2}-staging-dbc5-target-constraint-v1\.(?:json|md)$/;
  if (!Array.isArray(paths) || paths.length === 0
    || paths.some((path) => typeof path !== "string"
      || (!allowedExact.has(path.replaceAll("\\", "/"))
        && !evidencePattern.test(path.replaceAll("\\", "/"))))) {
    throw new Error("evidence_diff_scope_violation");
  }
  return paths.map((path) => path.replaceAll("\\", "/")).sort();
}

export function claimEvidenceAttempt(
  inputs,
  temporaryDirectory = tmpdir(),
  attemptedAt = new Date().toISOString(),
) {
  const prefix = `hr-axis-dbc5-target-${inputs.reviewedCommit.slice(0, 8)}`;
  const markerPath = join(temporaryDirectory, `${prefix}-attempted.json`);
  const marker = {
    attemptedAt,
    branch: inputs.evidenceBranch,
    event: "dbc5_target_constraint.apply_attempted",
    launcherDigest: inputs.launcherDigest,
    projectRefFingerprint: inputs.projectRefFingerprint,
    reviewedCommit: inputs.reviewedCommit,
    windowEnd: inputs.windowEndText,
    windowStart: inputs.windowStartText,
  };
  try {
    writeFileSync(markerPath, `${JSON.stringify(marker, null, 2)}\n`, {
      encoding: "utf8", flag: "wx", mode: 0o600,
    });
  } catch (error) {
    if (error && typeof error === "object" && error.code === "EEXIST") {
      throw new Error("attempt_already_recorded");
    }
    throw new Error("attempt_marker_failed");
  }
  return markerPath;
}

export function buildMergedRunnerInvocation(platform = process.platform) {
  const npmArgs = [
    "--silent", "--prefix", "backend/nestjs", "run", "apply:staging:dbc5:target",
  ];
  if (platform === "win32") {
    return {
      args: ["/d", "/s", "/c", ["npm.cmd", ...npmArgs].join(" ")],
      command: "cmd.exe",
    };
  }
  return { args: npmArgs, command: "npm" };
}

function executeMergedRunner(env) {
  const invocation = buildMergedRunnerInvocation();
  return spawnSync(invocation.command, invocation.args, {
    cwd: process.cwd(), encoding: "utf8", env, maxBuffer: 2 * 1024 * 1024,
  });
}

function assertSafeText(value) {
  const patterns = [
    /\b(?:postgres(?:ql)?|https?):\/\//i,
    /-----BEGIN [A-Z ]+-----/,
    /\bpassword\b/i,
    /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i,
    /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
  ];
  if (patterns.some((pattern) => pattern.test(value))) throw new Error("unsafe_output_rejected");
}

function exactObject(value, keys) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("receipt_contract_mismatch");
  }
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length
    || actual.some((key, index) => key !== expected[index])) {
    throw new Error("receipt_contract_mismatch");
  }
  return value;
}

function nonNegativeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function digestSet(value) {
  const item = exactObject(value, [
    "addConstraint", "createFunction", "rollback", "validateConstraint",
  ]);
  if (!Object.values(item).every((digest) => hex64.test(digest ?? ""))) {
    throw new Error("receipt_contract_mismatch");
  }
  return item;
}

function expectedReceiptBindings() {
  const packageRoot = join(
    workspaceRoot, "db", "constraint-packages", "rem8-target-duplicate-v1",
  );
  const sql = {
    addConstraint: readFileSync(join(packageRoot, "002_add_constraint_not_valid.sql"), "utf8"),
    createFunction: readFileSync(join(packageRoot, "001_create_function.sql"), "utf8"),
    rollback: readFileSync(join(packageRoot, "rollback.sql"), "utf8"),
    validateConstraint: readFileSync(join(packageRoot, "003_validate_constraint.sql"), "utf8"),
  };
  const migrationPath = join(workspaceRoot, "db", "migrations", migrationName);
  const runnerPaths = [
    join(workspaceRoot, "backend", "nestjs", "scripts", "dbc5-target-constraint-apply.ts"),
    join(workspaceRoot, "backend", "nestjs", "scripts", "dbc5-target-constraint-apply-contract.ts"),
    join(workspaceRoot, "backend", "nestjs", "scripts", "rem8-target-constraint-observation-contract.ts"),
    join(workspaceRoot, "backend", "nestjs", "scripts", "rem8-target-constraint-rehearsal-contract.ts"),
    join(workspaceRoot, "backend", "nestjs", "scripts", "rem8-target-constraint-package-contract.ts"),
    migrationPath,
    join(workspaceRoot, "db", "preflight", "rem8-target-constraint-observation-v1.sql"),
    join(workspaceRoot, "db", "preflight", "rem8-target-constraint-plan-v1.sql"),
    join(workspaceRoot, "db", "preflight", "staging-remediation-invariant-v2.sql"),
  ];
  return {
    candidateDigests: {
      evidenceCrlf: digestSqlObject(sql, crlf),
      gitLf: digestSqlObject(sql, lf),
    },
    evidenceReceipts: expectedEvidenceReceipts,
    migrationChecksum: sha256Text(lf(readFileSync(migrationPath, "utf8"))),
    runnerDigest: sha256Text(runnerPaths
      .map((path) => `${path.split(/[\\/]/).at(-1)}\0${readFileSync(path, "utf8")}`)
      .join("\0")),
  };
}

function digestSqlObject(sql, normalize) {
  return Object.fromEntries(Object.entries(sql).map(([key, value]) => [
    key,
    sha256Text(normalize(value)),
  ]));
}

function sha256Text(value) {
  return createHash("sha256").update(value).digest("hex");
}

function lf(value) { return value.replace(/\r\n?/g, "\n"); }
function crlf(value) { return lf(value).replace(/\n/g, "\r\n"); }

function sameObject(left, right) {
  return canonicalStringify(left) === canonicalStringify(right);
}

export function canonicalDigest(value) {
  return createHash("sha256").update(canonicalStringify(value)).digest("hex");
}

function canonicalStringify(value) {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number" && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) =>
      `${JSON.stringify(key)}:${canonicalStringify(value[key])}`).join(",")}}`;
  }
  throw new Error("receipt_contract_mismatch");
}

function validateReceipt(stdout, inputs) {
  if (!stdout.trim()) throw new Error("receipt_missing");
  assertSafeText(stdout);
  let receipt;
  try { receipt = JSON.parse(stdout); } catch { throw new Error("receipt_invalid"); }
  exactObject(receipt, [
    "candidateDigests", "certificateVerified", "event", "evidenceReceipts", "migration",
    "postflight", "preflight", "receiptDigest", "receiptVersion", "reviewedCommit",
    "runnerDigest", "stagingDdlExecuted", "targetClass", "targetFingerprint",
    "timeoutProfile", "tlsMode",
  ]);
  if (receipt.event !== "dbc5_target_constraint.apply_completed"
    || receipt.receiptVersion !== "1" || receipt.reviewedCommit !== inputs.reviewedCommit
    || receipt.targetClass !== "staging" || receipt.tlsMode !== "verify-full"
    || receipt.certificateVerified !== true || receipt.stagingDdlExecuted !== true
    || ![receipt.receiptDigest, receipt.runnerDigest, receipt.targetFingerprint]
      .every((item) => hex64.test(item ?? ""))) {
    throw new Error("receipt_contract_mismatch");
  }
  const candidates = exactObject(receipt.candidateDigests, ["evidenceCrlf", "gitLf"]);
  digestSet(candidates.evidenceCrlf);
  digestSet(candidates.gitLf);
  const evidence = exactObject(receipt.evidenceReceipts, ["observation", "rehearsal"]);
  if (!Object.values(evidence).every((item) => hex64.test(item ?? ""))) {
    throw new Error("receipt_contract_mismatch");
  }
  const migration = exactObject(receipt.migration, [
    "appliedCount", "checksum", "checksumStyles", "failedCount", "name", "skippedCount",
  ]);
  const styles = exactObject(migration.checksumStyles, ["gitLf", "windowsCrlf"]);
  if (migration.appliedCount !== 1 || migration.failedCount !== 0
    || migration.skippedCount !== 59 || migration.name !== migrationName
    || !hex64.test(migration.checksum ?? "")
    || !nonNegativeInteger(styles.gitLf) || !nonNegativeInteger(styles.windowsCrlf)
    || styles.gitLf + styles.windowsCrlf !== 59) {
    throw new Error("receipt_contract_mismatch");
  }
  const expected = expectedReceiptBindings();
  if (!sameObject(candidates, expected.candidateDigests)
    || !sameObject(evidence, expected.evidenceReceipts)
    || migration.checksum !== expected.migrationChecksum
    || receipt.runnerDigest !== expected.runnerDigest) {
    throw new Error("receipt_contract_mismatch");
  }
  const preflight = exactObject(receipt.preflight, [
    "lockBuckets", "over30sTransactions", "state", "targetLiveRows",
    "transactionIsolation", "transactionReadOnly",
  ]);
  if (preflight.state !== "eligible" || preflight.over30sTransactions !== 0
    || !nonNegativeInteger(preflight.lockBuckets)
    || !nonNegativeInteger(preflight.targetLiveRows)
    || preflight.transactionIsolation !== "repeatable_read"
    || preflight.transactionReadOnly !== true) {
    throw new Error("receipt_contract_mismatch");
  }
  const postflight = exactObject(receipt.postflight, [
    "activeTargetV2Hits", "constraintState", "functionState", "indexStrategy", "migrationState",
    "transactionReadOnly",
  ]);
  if (postflight.activeTargetV2Hits !== 0
    || postflight.constraintState !== "present_valid_exact"
    || postflight.functionState !== "present_immutable_exact"
    || postflight.indexStrategy !== "not_applicable_no_index_candidate"
    || postflight.migrationState !== "succeeded_exact"
    || postflight.transactionReadOnly !== true) {
    throw new Error("receipt_contract_mismatch");
  }
  const timeout = exactObject(receipt.timeoutProfile, [
    "connectionMs", "idleMs", "lockMs", "queryMs", "statementMs",
  ]);
  if (timeout.connectionMs !== 5000 || timeout.idleMs !== 1000 || timeout.lockMs !== 5000
    || timeout.queryMs !== 30000 || timeout.statementMs !== 30000) {
    throw new Error("receipt_contract_mismatch");
  }
  const { receiptDigest, ...withoutDigest } = receipt;
  if (canonicalDigest(withoutDigest) !== receiptDigest) {
    throw new Error("receipt_contract_mismatch");
  }
  return receipt;
}

export function executeEvidence(inputs, runnerEnvironment, {
  attemptedAt = new Date().toISOString(),
  executeRunner = executeMergedRunner,
  temporaryDirectory = tmpdir(),
} = {}) {
  const attemptMarkerPath = claimEvidenceAttempt(inputs, temporaryDirectory, attemptedAt);
  try {
    const prefix = `hr-axis-dbc5-target-${inputs.reviewedCommit.slice(0, 8)}`;
    const receiptPath = join(temporaryDirectory, `${prefix}-receipt.json`);
    const stderrPath = join(temporaryDirectory, `${prefix}-stderr.txt`);
    const result = executeRunner(runnerEnvironment);
    const stderr = typeof result?.stderr === "string" ? result.stderr : "";
    const stdout = typeof result?.stdout === "string" ? result.stdout : "";
    assertSafeText(stderr);
    writeFileSync(stderrPath, stderr, { encoding: "utf8", mode: 0o600 });
    if (result?.status !== 0) throw new Error("runner_safety_failure");
    if (stderr.trim()) throw new Error("runner_stderr_rejected");
    const receipt = validateReceipt(stdout, inputs);
    writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, {
      encoding: "utf8", mode: 0o600,
    });
    return {
      attemptMarkerPath,
      event: receipt.event,
      exitCode: result.status,
      launcherDigest: inputs.launcherDigest,
      projectRefFingerprint: inputs.projectRefFingerprint,
      receiptDigest: receipt.receiptDigest,
      receiptPath,
      reviewedCommit: receipt.reviewedCommit,
      stagingDdlExecuted: receipt.stagingDdlExecuted,
      stderrPath,
    };
  } catch (error) {
    const attemptedError = new Error(error instanceof Error
      ? error.message : "dbc5_target_constraint_launcher_failed");
    attemptedError.ddlState = "unverified_after_attempt";
    throw attemptedError;
  }
}

export function createSafeFailurePayload(error) {
  const allowed = new Set([
    "attempt_already_recorded", "attempt_marker_failed", "ca_file_missing", "ca_pem_invalid",
    "ca_private_key_refused", "database_protocol_invalid", "evidence_branch_invalid",
    "evidence_branch_mismatch", "evidence_diff_scope_violation", "git_command_failed",
    "origin_main_mismatch", "owner_authorization_missing", "production_target_refused",
    "project_ref_fingerprint_missing", "project_ref_mismatch", "project_ref_unresolved",
    "receipt_contract_mismatch", "receipt_invalid", "receipt_missing", "reviewed_commit_invalid",
    "reviewed_commit_mismatch", "run_window_inactive", "run_window_invalid",
    "run_window_timezone_invalid", "runner_safety_failure", "runner_stderr_rejected",
    "target_identity_mismatch", "target_identity_missing", "unsafe_output_rejected",
    "verify_full_required", "worktree_dirty",
  ]);
  const code = error instanceof Error && allowed.has(error.message)
    ? error.message : "dbc5_target_constraint_launcher_failed";
  return {
    error: code,
    event: "dbc5_target_constraint.launcher_failed",
    stagingDdlExecuted: error?.ddlState === "unverified_after_attempt"
      ? "unverified_after_attempt" : false,
  };
}

export function safeFailure(error) {
  process.stderr.write(`${JSON.stringify(createSafeFailurePayload(error))}\n`);
  process.exitCode = 1;
}

function main() {
  try {
    const inputs = validateInputs();
    if (process.argv.includes("--validate-inputs-only")) {
      process.stdout.write(`${JSON.stringify({
        certificatePemLoaded: true,
        event: "dbc5_target_constraint.inputs_validated",
        targetIdentityMatched: true,
        windowActive: true,
      })}\n`);
      return;
    }
    verifyRepositoryState(inputs);
    const summary = executeEvidence(inputs, buildRunnerEnvironment(inputs));
    process.stdout.write(`${JSON.stringify(summary)}\n`);
  } catch (error) { safeFailure(error); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
