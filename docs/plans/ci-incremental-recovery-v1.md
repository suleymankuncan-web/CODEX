# CI incremental recovery v1

Status: active
Owner approval: September 2026
Scope: one PR, release verification and recovery only

## Problem and measured baseline

A one-line Playwright assertion correction previously invalidated the global
release identity and restarted successful backend, static and browser work.
GitHub's native failed-job rerun keeps the original SHA; it cannot validate a
new fix commit.

The eight successful required gates for PRs #1145–#1152 took a mean 21m32s and
median 22m13s (created-to-updated run duration, including orchestration).
Run IDs: 34726500395, 34732168745, 34733326859, 34741389799,
34747234256, 34758046230, 34769229564, 34780808071.

PR #1152's frontend job took 19m19s: E2E 17m39s, static 67s and dependency
installation 17s. PR #1151's full image proof took 21m58s, including 16m47s
for fresh-volume core runtime. These are independent critical paths.
Post-merge run 34781914901 took 85s; existing exact-tree reuse already works.

Failed run 34779731928 recorded 681 passing cases and one ambiguous-heading
failure. Its following test-only correction still restarted the full suite.
Measurements above are observations from September 13, not new-run estimates.

## Execution contract

- Fresh `npm.cmd run check:release` executes all families and browser cases.
- `npm.cmd run check:release -- --plan` explains stage execution/reuse without
  running tests. `npm.cmd run check:release -- --resume` performs recovery.
- Root contracts and dependency audits always execute.
- Backend/static results can be retained for 24 hours only with matching
  stage commands, relevant files, both dependency locks, Node/npm/platform,
  environment and actual dist contents. Unknown files stay in the fingerprint.
  Metadata such as run ID, SHA and job name is recorded separately from content.
  Unknown environment variables and ignored .env files still invalidate proof.
- Backend excludes frontend src/public/E2E inputs; static excludes only root
  E2E spec files. Shared fixtures, scripts, configs and application changes
  therefore still trigger affected proof. Symlink inputs/outputs are rejected.
- Current execution identity and original proof SHA remain distinct. Existing
  exact-SHA canonical receipts are preserved for the on-prem fresh-proof contract;
  recovery records are separate, version 2, atomic and never imply deployment.
- `npm.cmd run test:status` distinguishes current, stale, failed, invalid and
  missing canonical receipts. A historical PASS alone is not current proof.

## Browser recovery

Playwright enumerates the actual full case inventory before selection. Only
explicitly reviewed isolated specs in `playwright-recovery-policy.json` may
retain results. The initial cohort is three target-page specs with per-test
clock freezing and isolated page/API mocks. Their reviewed source hashes are
pinned: edits require a new isolation review before retention is possible again.
Review hashes normalize CRLF to LF for Git checkouts; execution proof still
compares exact file bytes and platform identity.
Other specs execute every time. TypeScript syntax analysis covers side-effect,
type-only, namespace, barrel, require and dynamic spec imports.
The product, shared fixtures/config/scripts, environment, actual browser
version and actual build must match. Uncertain spec imports trigger full execution.

Changed/failed specs execute. An inventory addition, removal or rename requires
full execution. Each retained case must have one clean, unexpired passing result;
skips, retries, flaky or expected-failure results are not retained passes.
Global errors, cancellation and interrupted reports cannot provide recovery.
Executed and retained case IDs must equal the complete current inventory exactly.
Original per-case timestamps prevent indefinite extension through recovery chains.

Use the existing targeted command during diagnosis, for example
`npm.cmd --prefix admin-web run test:e2e -- operations-control-tower.spec.ts`.
Arguments select diagnostic tests only and cannot generate a canonical recovery
receipt. Then run the canonical resume command after the fix. Do not repeatedly
push speculative fixes to GitHub.

## GitHub transport and failures

Backend, frontend static and frontend E2E are independent jobs. E2E receives the
static job's build through a verified same-run bundle, including native retries
where that static job succeeded in an earlier attempt.

Cross-run reuse is only available on same-repository PRs. The newest preceding
run is selected before examining its result; older green runs cannot mask a
newer failure/cancellation. Validate repository, PR, base SHA, workflow, run and
attempt, tested merge commit/tree/parents, exact job result, artifact SHA-256
and age. API problems, missing/malformed bundles and ambiguous provenance fall
back to execution. Recovery/workflow-control edits disable cross-run reuse.
Forks and non-PR runs perform fresh verification; same-run build transfer works.

Transport uses read-only Actions access; tokens never enter fingerprint records
or build/test children. Bundles contain allowlisted dist files or test metadata,
are limited to 32 MiB and retained for one day. Validate paths and per-file
hashes before writing. ZIP extraction reads only bundle.json, never member paths.
No node_modules or local PASS records are imported into CI.

All required child jobs still feed the fail-closed aggregate. On-prem image,
offline and runtime proofs keep their exact-SHA policy. No provider/CD settings,
worker count, shard count, production data or runtime behavior changes.

For a transient failure on the same commit use
`node scripts/ci_monitor.cjs rerun-failed RUN_ID`.
For a code correction use a new run on the new SHA. The monitor's grep streams
large logs and reports at most the last 100 matching lines.

## Test abundance and duration work

Baseline inventory: 82 E2E files / 682 cases, 49 frontend unit files,
36 frontend script test files, 184 root script test files, 373 backend test files.
File counts are not test case counts; this PR adds recovery regression tests.
No product test is deleted.

Largest observed summed case times were store-kpis-contracts (130.3s / 38 cases),
checklist-command-canvas (112.5s / 42), today (77.8s / 22),
records (69s / 19), admin routing (66.9s / 22) and store shell (63.6s / 26).
These are summed case durations, not wall time with two workers.
Only three fixed sleeps totalled 5.4s; removing them is not a material solution.
Route/heading checks overlap across domain/persona suites, but deletion requires
proof of identical role, state and assertion coverage. File/token checks in
store-command-canvas-closeout are candidates for a later Node-test migration.

Each new browser summary reports executed/retained/total cases, wall time and
slowest-case measurements. Retained prior case time is explicitly not wall-time
savings. Stage summaries distinguish executed and reused proof.
`node scripts/ci_monitor.cjs timings RUN_ID` reports measured run elapsed
time, summed reported job seconds and slowest steps separately. Summed job
seconds are not wall time or billed minutes; missing durations remain unknown.

Acceptance: all negative-path tests pass, all original coverage remains present,
fresh verification passes, and a changed spec retains eligible unchanged proof
without retaining the changed result. Measure the next ten comparable runs for
p50/p95 wall time, total runner-minutes and recovery hit rate. The initial three
spec cohort cannot promise 2–5 minute full recovery; whole-suite execution and
on-prem runtime remain major costs. Expanding the cohort requires isolation review.

## Review and rollback

Review is inline self-review under the root-only execution policy. Check missing
outputs, source/env drift, malformed inventories, global errors, expiry, wrong
repository/PR/base/attempt, archive paths and fail-closed aggregation.
Revert this PR to restore the prior runner/workflow. Fresh mode remains available
without using any recovery records; runtime and deployment contracts are unchanged.
