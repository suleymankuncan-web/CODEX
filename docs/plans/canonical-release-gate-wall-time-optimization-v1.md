# Canonical Release Gate Wall-Time Optimization V1

Status: approved
Owner approval: 2026-07-16
Risk: R3 CI/process; HIGH if any gate is weakened
Door: two-way; one squash revert restores the prior orchestration
Implementation branch: `codex/canonical-release-wall-time-v1`

## 1. Context

The canonical release gate preserves broad backend, frontend, contract,
build, audit, and Playwright evidence, but it executes independent work
serially and repeats already-proven work in sibling workflows. A late
Playwright failure can therefore consume roughly one full run before the fix
and another full run afterward. The measured ten-run root-release p95 is
13.23 minutes, and a recent local run took 1,154 seconds before failing in the
last Playwright stage.

The optimization MUST reduce wall time and failed-run recovery time without
removing, skipping, narrowing, retry-hiding, or weakening any test. Backend
proof, frontend static proof, frontend E2E proof, dependency audit, release
rehearsal, the fail-closed required aggregate, and exact-tree post-merge proof
remain mandatory where repository scope selects them.

## 2. Decision

Use one versioned release-stage contract for local orchestration and a matching
job DAG in GitHub Actions. Independent backend and frontend work runs in
parallel. Frontend E2E starts only after frontend static proof succeeds and
runs exactly once. Local `--resume` reuses only exact-input successful stages;
volatile dependency audits always rerun. GitHub's native failed-job rerun
reuses successful sibling jobs. Unknown, missing, stale, cancelled, or
mismatched evidence fails closed.

## 3. Functional Requirements

- **FR-01:** The repository MUST expose a versioned, allowlisted stage manifest
  containing the canonical commands, dependencies, volatility, and stage IDs.
- **FR-02:** Every local stage MUST emit an atomic sanitized JSON receipt with
  start/end time, duration, outcome, stage/command digest, proof identity, and
  upstream receipt digests; receipts MUST contain no environment values or
  credentials.
- **FR-03:** A failed stage MUST stop dependent stages and terminate locally
  owned child processes; unrelated successful stage receipts MAY remain for an
  exact-input resume.
- **FR-04:** After the root contract/preflight stage, backend release proof,
  frontend static proof, and dependency audits MUST be eligible to overlap.
- **FR-05:** The local proof identity MUST bind HEAD SHA, manifest/schema and
  command digests, Node/platform identity, package-lock digests, and the exact
  tracked plus non-ignored untracked workspace content digest.
- **FR-06:** `npm run check:release -- --resume` MUST rerun failed, missing,
  volatile, or invalidated stages and MUST reuse no other stage.
- **FR-07:** Dependency audits MUST be volatile and MUST rerun on every fresh or
  resumed invocation.
- **FR-08:** Frontend build and Playwright MUST each execute once per fresh
  canonical run; Playwright MUST retain the repository's complete selected
  suite and existing two-worker CI policy.
- **FR-09:** GitHub Actions MUST split independent proof into native jobs so
  “Re-run failed jobs” does not repeat successful sibling jobs.
- **FR-10:** Release rehearsal MUST run its Docker/live rehearsal without
  repeating the backend lint/Jest/build/audit proof already selected by the
  required release gate.
- **FR-11:** The required check name MUST remain `required-release-gate`, and
  its aggregate MUST reject missing, skipped, cancelled, timed-out, or failed
  selected proof.
- **FR-12:** Post-merge exact-tree reuse MUST remain single-parent, exact-base,
  exact-tree, latest-success, pre-merge-completion proof.
- **FR-13:** Any uncertainty in selection, receipt validation, job result, or
  post-merge identity MUST choose the full/fresh fail-safe path.
- **FR-14:** `discipline.md` MUST be the normative process source; `AGENTS.md`,
  `CONTRIBUTING.md`, `current-state.md`, and contract tests MUST preserve the
  same no-coverage-reduction, resume, native-rerun, polling, and fallback rules.

## 4. Non-Functional Requirements

- **NFR-01:** Test inventory, Playwright selection, lint, build, API generation
  check, audits, backend Jest coverage, and Docker rehearsal coverage MUST NOT
  be reduced.
- **NFR-02:** Successful receipts MUST NOT be stored in GitHub Actions cache or
  uploaded as PASS artifacts; `node_modules` MUST NOT be cached or transferred.
- **NFR-03:** Receipt writes MUST be atomic, receipts MUST be non-executable,
  and malformed or schema-incompatible receipts MUST be ignored fail-closed.
- **NFR-04:** A workspace lock MUST prevent two local canonical full gates from
  owning the same receipt directory or preview resources concurrently.
- **NFR-05:** Windows command wrapping, argument boundaries, child cleanup, and
  atomic rename behavior MUST have contract coverage.
- **NFR-06:** Successful logs MUST stay compact; failure output MAY expose only
  the relevant command and bounded diagnostic tail while child test output
  remains directly visible to the operator.
- **NFR-07:** Required-gate p95 SHOULD be at most 13 minutes, DAG proof SHOULD
  be at most 12 minutes 30 seconds, local cold proof SHOULD be at most 13
  minutes 30 seconds, and pre-E2E static failures SHOULD surface within two
  minutes when runner availability permits.
- **NFR-08:** An exact-input late-E2E resume SHOULD add no more than 60 seconds
  outside the E2E rerun and volatile audits; post-merge exact-tree reuse SHOULD
  complete within two minutes.
- **NFR-09:** Aggregate runner-minutes MUST NOT exceed 110% of the previous
  ten-run baseline without a new owner decision; wall-time improvement MUST NOT
  be bought with uncontrolled runner multiplication.

## 5. Acceptance Criteria

- **AC-01 (FR-01, FR-05, FR-13):** Given an unchanged workspace and manifest,
  when identity is calculated twice, then every digest is stable; when one
  tracked, non-ignored untracked, lock, command, runtime, or manifest input
  changes, then the affected receipt is rejected.
- **AC-02 (FR-02, NFR-03):** Given a completed stage, when its receipt is read,
  then it validates against the current schema and contains only sanitized
  metadata; given a partial/malformed receipt, then resume treats it as absent.
- **AC-03 (FR-03, NFR-04, NFR-05):** Given a failed parallel child or a second
  local runner, when execution proceeds, then dependents do not start, owned
  children are cleaned up, and the competing runner fails before proof work.
- **AC-04 (FR-04, FR-08):** Given a fresh gate, when root contracts pass, then
  backend/static/audit proof can overlap, frontend E2E follows static proof,
  frontend build occurs once, and Playwright occurs once with unchanged
  selection.
- **AC-05 (FR-06, FR-07):** Given exact successful backend/static receipts and a
  failed E2E receipt, when `--resume` runs, then backend/static are reused,
  audits rerun, and E2E reruns; given any identity drift, then reuse is denied.
- **AC-06 (FR-09, FR-11):** Given the CI DAG, when a late frontend job fails,
  then GitHub failed-job rerun need not rerun successful root/backend siblings;
  the stable aggregate remains red until every selected child is successful.
- **AC-07 (FR-10, NFR-01):** Given backend-sensitive scope, when required proof
  and rehearsal run, then backend release proof executes once and Docker/live
  rehearsal still builds/boots/smokes its fixture without calling backend
  `check:release` again.
- **AC-08 (FR-12, FR-13):** Given an exact squash tree and latest successful PR
  gate, when main is pushed, then fast proof is selected; given any mismatch,
  then the reusable full release is selected.
- **AC-09 (FR-14):** Given future process edits, when root script contracts run,
  then drift among `discipline.md`, `AGENTS.md`, `CONTRIBUTING.md`,
  `current-state.md`, commands, workflows, and stable check names fails.
- **AC-10 (NFR-01, NFR-07, NFR-09):** Given the final PR, when local and CI
  verification is reviewed, then baseline test selection is unchanged and
  timings/runner-minutes are recorded honestly; a missed time target is a
  measured follow-up, never permission to weaken coverage.

## 6. Edge Cases

- **EC-01:** Detached HEAD, unavailable Git, or unreadable tracked input denies
  resume and runs fresh or stops safely.
- **EC-02:** Renames, Unicode paths, spaces, Windows separators, symlinks, and
  empty files contribute deterministically to the workspace digest.
- **EC-03:** Ignored secrets and generated/ignored artifacts never enter proof
  metadata; non-ignored untracked files do enter the identity.
- **EC-04:** SIGINT/SIGTERM, child spawn failure, non-zero exit, and concurrent
  runner collision release only owned resources and never forge PASS receipts.
- **EC-05:** A successful but volatile audit receipt is never reused.
- **EC-06:** A skipped unselected CI child is acceptable only when the scope
  output explicitly says it was not selected; a skipped selected child fails.
- **EC-07:** GitHub API uncertainty, stale attempts, unsupported merge shapes,
  and workflow-name drift select fallback or fail closed.
- **EC-08:** Docker unavailable remains an explicit rehearsal failure or the
  existing separately documented conditional path; it does not silently pass.

## 7. Contracts

```ts
type ReleaseStage = {
  id: string
  cwd: string
  command: readonly string[]
  dependsOn: readonly string[]
  volatile: boolean
}

type ReleaseReceiptV1 = {
  schemaVersion: 1
  stageId: string
  status: 'success'
  startedAt: string
  completedAt: string
  durationMs: number
  proofIdentityDigest: string
  commandDigest: string
  upstreamReceiptDigests: Record<string, string>
}
```

No product API or database contract changes.

## 8. Data Model

Local receipts live under ignored `tmp/release-gate/`. The directory contains
one lock and one JSON receipt per stage. Receipts are disposable local evidence,
not source-controlled business data and not cross-run CI cache inputs.

## 9. Implementation Slices

1. Add the approved stage manifest/schema and red contract tests.
2. Implement exact identity, atomic receipts, resume selection, locking,
   parallel execution, and Windows cleanup in the root runner.
3. Split package-owned static/E2E/audit commands without changing their
   contents or selection.
4. Convert the reusable release workflow to independent native jobs with a
   fail-closed internal aggregate; remove the duplicate required frontend
   targeted child from the selected PR path.
5. Remove duplicate backend proof from release rehearsal while preserving the
   Docker/live fixture build and smokes.
6. Align `discipline.md`, `AGENTS.md`, `CONTRIBUTING.md`, `current-state.md`,
   release docs, and drift contracts.
7. Run targeted contracts, package checks, one canonical full gate, High
   adversarial review, PR checks, squash merge, and post-merge proof.

## 10. Verification And Measurement

- `git diff --check`
- focused Node contract tests for stage runner, required aggregate, rehearsal,
  post-merge proof, affected selector, and operating-doc drift
- backend/frontend package-script contract checks
- one fresh `npm.cmd run check:release`
- required GitHub checks and mergeability
- workflow job timing, Playwright discovered/passed count, build count, and
  aggregate runner-minutes recorded in the PR/evidence
- squash merge and post-merge exact-tree verification

## 11. Rollback

Revert the single squash commit. This restores serial local orchestration,
the prior reusable workflow, duplicate targeted/rehearsal proof, and prior docs.
No product data, schema, provider, auth, or runtime rollback is required.

## 12. Out Of Scope

- Test removal, `skip`, retries that hide failures, broader Playwright worker
  concurrency, sharding, or changing `fullyParallel`.
- Product UI/API/auth/database/provider behavior.
- Actions caching or artifact transfer of PASS receipts, build output, or
  `node_modules`.
- Broad production rollout or deployment policy changes.

## 13. Sokrates Decision

Decision: proceed with one bounded CI/process PR.
Evidence: measured p95, recent 1,154-second late failure, current serial root
runner, duplicated frontend-targeted proof, and duplicated rehearsal backend
proof.
Counterargument: parallel jobs can spend extra runner-minutes and split proof
across more surfaces.
Guardrail: 110% runner-minute ceiling, stable aggregate, exact fail-closed
identity, no coverage reduction, and one-revert rollback.
Change-my-mind trigger: any test inventory reduction, missing selected child,
receipt reuse across input drift, unexplained check failure, or projected
runner-minute breach stops merge.
