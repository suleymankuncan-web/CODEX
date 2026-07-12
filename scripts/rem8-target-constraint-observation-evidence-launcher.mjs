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

const hex64 = /^[a-f0-9]{64}$/;

function required(name, env) {
  const value = env[name]?.trim();
  if (!value) throw new Error(`${name.toLowerCase()}_missing`);
  return value;
}

// Trace: FR-10; NFR-01..04, NFR-08; AC-03; EC-16..18.
export function validateInputs(env = process.env, now = Date.now()) {
  const reviewedCommit = required("REM8_TARGET_OBSERVATION_REVIEWED_COMMIT", env).toLowerCase();
  if (!/^[a-f0-9]{40}$/.test(reviewedCommit)) throw new Error("reviewed_commit_invalid");
  const evidenceBranch = required("REM8_TARGET_OBSERVATION_EVIDENCE_BRANCH", env);
  if (!/^codex\/rem8-target-observation-evidence-v1(?:-[a-z0-9][a-z0-9-]*)?$/.test(evidenceBranch)) {
    throw new Error("evidence_branch_invalid");
  }
  const shared = validateV2Inputs({
    ...env,
    STAGING_REMEDIATION_EVIDENCE_BRANCH: "codex/rem-2b-v2-staging-evidence-rem8-adapter",
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
    fileURLToPath(new URL("./staging-remediation-invariant-v2-evidence-launcher.mjs", import.meta.url)),
  ];
  return createHash("sha256")
    .update(paths.map((path) => `${path.split(/[\\/]/).at(-1)}\0${readFileSync(path)}`).join("\0"))
    .digest("hex");
}

export function buildRunnerEnvironment(inputs, env = process.env) {
  const runnerEnvironment = buildV2RunnerEnvironment(inputs, env);
  delete runnerEnvironment.STAGING_REMEDIATION_INVARIANT_V2_REVIEWED_COMMIT;
  runnerEnvironment.REM8_TARGET_OBSERVATION_REVIEWED_COMMIT = inputs.reviewedCommit;
  return runnerEnvironment;
}

export function verifyRepositoryState(inputs, executeGit) {
  return verifyV2RepositoryState(inputs, executeGit);
}

export function validateEvidenceDiffPaths(paths) {
  const allowedExact = new Set([
    "current-state.md",
    "docs/README.md",
    "docs/plans/post-dg2-staging-remediation-and-constraint-reentry-plan-v1.md",
    "docs/plans/rem8-target-constraint-observation-and-rehearsal-spec-v1.md",
  ]);
  const evidencePattern = /^docs\/evidence\/readiness\/\d{4}-\d{2}-\d{2}-staging-rem8-target-constraint-(?:observation|disposable-rehearsal)-v1\.(?:json|md)$/;
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
  const prefix = `hr-axis-rem8-target-observation-${inputs.reviewedCommit.slice(0, 8)}`;
  const markerPath = join(temporaryDirectory, `${prefix}-attempted.json`);
  const marker = {
    attemptedAt,
    branch: inputs.evidenceBranch,
    event: "rem8_target_constraint.observation_attempted",
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
    "--silent", "--prefix", "backend/nestjs", "run", "observe:rem8:target:constraint",
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

function exactKeys(value, keys) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function nonNegativeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0;
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
  const result = receipt.queryResult;
  const candidate = result?.candidate;
  const compatibility = result?.compatibility;
  const target = result?.targetTable;
  const transactions = result?.transactions;
  const artifacts = result?.artifacts;
  const timeout = receipt.timeoutProfile;
  if (!exactKeys(receipt, [
    "certificateVerified", "event", "invariantV2QueryDigest", "observationQueryDigest",
    "planQueryDigest", "queryResult", "receiptDigest", "receiptVersion", "reviewedCommit",
    "runnerDigest", "targetClass", "targetFingerprint", "timeoutProfile", "tlsMode",
    "transactionIsolation", "transactionReadOnly",
  ])
    || receipt.event !== "rem8_target_constraint.observation_completed"
    || receipt.receiptVersion !== "1"
    || receipt.reviewedCommit !== inputs.reviewedCommit
    || receipt.targetClass !== "staging" || receipt.tlsMode !== "verify-full"
    || receipt.certificateVerified !== true || receipt.transactionReadOnly !== true
    || receipt.transactionIsolation !== "repeatable_read"
    || ![receipt.invariantV2QueryDigest, receipt.observationQueryDigest, receipt.planQueryDigest,
      receipt.receiptDigest, receipt.runnerDigest, receipt.targetFingerprint].every((item) => hex64.test(item ?? ""))
    || timeout?.connectionMs !== 5000 || timeout?.idleMs !== 1000
    || timeout?.queryMs !== 30000 || timeout?.statementMs !== 30000
    || !exactKeys(result, [
      "artifacts", "candidate", "compatibility", "indexStrategy", "locks", "observedAt",
      "plan", "querySetVersion", "reasons", "rem7ReceiptDigest", "server", "state",
      "targetTable", "transactions", "writes",
    ])
    || result?.querySetVersion !== "rem8-target-constraint-observation-v1"
    || !["eligible_for_disposable_rehearsal", "blocked"].includes(result?.state)
    || !Array.isArray(result?.reasons) || result.reasons.length === 0
    || !hex64.test(result?.rem7ReceiptDigest ?? "")
    || result?.indexStrategy !== "not_applicable_no_index_candidate"
    || !exactKeys(candidate, [
      "addConstraintDigest", "addLock", "functionDigest", "rollbackDigest",
      "validateConstraintDigest", "validateLock",
    ])
    || !exactKeys(compatibility, [
      "activeTargetV2Hits", "nonArrayRows", "ordinaryDuplicateRows", "pilotDuplicateGroups",
      "pilotUniqueIndex",
    ])
    || !exactKeys(artifacts, ["constraintState", "functionState"])
    || !exactKeys(result?.server, ["major"])
    || !exactKeys(target, [
      "deadRows", "estimatedRows", "indexBytes", "liveRows", "partitioned", "tableBytes",
      "totalBytes",
    ])
    || !exactKeys(transactions, ["activeCount", "maxAgeMs", "over30sCount", "over5sCount"])
    || !exactKeys(result?.writes, ["deleted", "inserted", "statsAgeSeconds", "updated"])
    || !exactKeys(result?.plan, ["nodeTypes", "planRows", "totalCost"])
    || !Array.isArray(result?.locks)
    || result.locks.some((lock) => !exactKeys(lock, ["count", "granted", "mode"])
      || !Number.isSafeInteger(lock.count) || lock.count <= 0 || typeof lock.granted !== "boolean")
    || !nonNegativeInteger(result?.server?.major)
    || !nonNegativeInteger(target?.liveRows) || !nonNegativeInteger(target?.totalBytes)
    || !nonNegativeInteger(transactions?.over30sCount)
    || !nonNegativeInteger(compatibility?.activeTargetV2Hits)
    || !nonNegativeInteger(compatibility?.ordinaryDuplicateRows)
    || !nonNegativeInteger(compatibility?.pilotDuplicateGroups)
    || !nonNegativeInteger(compatibility?.nonArrayRows)
    || !["present_valid_exact", "absent", "invalid", "definition_drifted"].includes(compatibility?.pilotUniqueIndex)
    || !["absent", "present"].includes(artifacts?.functionState)
    || !["absent", "present_not_valid", "present_valid"].includes(artifacts?.constraintState)
    || candidate?.addLock !== "access_exclusive"
    || candidate?.validateLock !== "share_update_exclusive"
    || ![candidate?.addConstraintDigest, candidate?.functionDigest, candidate?.rollbackDigest,
      candidate?.validateConstraintDigest].every((item) => hex64.test(item ?? ""))) {
    throw new Error("receipt_contract_mismatch");
  }
  const { receiptDigest, ...withoutDigest } = receipt;
  if (canonicalDigest(withoutDigest) !== receiptDigest) throw new Error("receipt_contract_mismatch");
  return receipt;
}

export function executeEvidence(inputs, runnerEnvironment, {
  attemptedAt = new Date().toISOString(),
  executeRunner = executeMergedRunner,
  temporaryDirectory = tmpdir(),
} = {}) {
  const attemptMarkerPath = claimEvidenceAttempt(inputs, temporaryDirectory, attemptedAt);
  const prefix = `hr-axis-rem8-target-observation-${inputs.reviewedCommit.slice(0, 8)}`;
  const receiptPath = join(temporaryDirectory, `${prefix}-receipt.json`);
  const stderrPath = join(temporaryDirectory, `${prefix}-stderr.txt`);
  const result = executeRunner(runnerEnvironment);
  const stderr = typeof result?.stderr === "string" ? result.stderr : "";
  const stdout = typeof result?.stdout === "string" ? result.stdout : "";
  assertSafeText(stderr);
  writeFileSync(stderrPath, stderr, { encoding: "utf8", mode: 0o600 });
  if (result?.status !== 0 && result?.status !== 2) throw new Error("runner_safety_failure");
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
    observationState: receipt.queryResult.state,
    projectRefFingerprint: inputs.projectRefFingerprint,
    receiptDigest: receipt.receiptDigest,
    receiptPath,
    reviewedCommit: receipt.reviewedCommit,
    stderrPath,
  };
}

export function safeFailure(error) {
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
    ? error.message : "rem8_target_constraint_observation_launcher_failed";
  process.stderr.write(`${JSON.stringify({
    error: code,
    event: "rem8_target_constraint.observation_launcher_failed",
  })}\n`);
  process.exitCode = 1;
}

function main() {
  try {
    const inputs = validateInputs();
    if (process.argv.includes("--validate-inputs-only")) {
      process.stdout.write(`${JSON.stringify({
        certificatePemLoaded: true,
        event: "rem8_target_constraint.observation_inputs_validated",
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
