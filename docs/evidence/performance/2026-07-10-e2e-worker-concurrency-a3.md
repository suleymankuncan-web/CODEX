# E2E Worker Concurrency Evidence - 2026-07-10

Status: active
Shelf: evidence
Evidence class: local_test plus GitHub Actions measurement

## Reader And Action

Reader:

- an engineer or release operator deciding whether the frontend release gate
  may use bounded parallel execution.

After reading, they should be able to preserve the full E2E suite while
understanding why CI uses two file-serial workers, what evidence supports that
choice, and when to revert it.

## Decision

The frontend release gate keeps all 371 Playwright tests and runs them with two
workers only in CI. Tests within a file remain serial. Local default execution
remains one worker unless the operator explicitly supplies a runner override.

This is a bounded CI efficiency change, not a test reduction, product change,
or broad test-sharding program.

## Measured Baseline

The required gate proof for PR #918 measured the root release job at 14 minutes
and 1 second. The Playwright command took 10 minutes and 55 seconds, about 78%
of the root job. The latest ten successful PR root jobs had a nearest-rank p95
of 14 minutes and 1 second, above the 12-minute target.

The same root proof discovered 371 tests in 56 files. No test was removed,
renamed, skipped, or narrowed for this change.

## Local Repetition Evidence

Two clean two-worker runs used the full discovered suite with the existing
system-Chrome setting:

| Run | Result | Wall time |
| --- | --- | ---: |
| 1 | 371 passed | 6 minutes 11 seconds |
| 2 | 371 passed | 6 minutes 7 seconds |
| CI-mode root release | root scripts, backend, and full frontend release passed | 8 minutes 36 seconds |

The post-run discovery list still reported 371 tests in 56 files. Existing
visual-evidence outputs were generated only by their pre-existing tests and
were excluded from the implementation diff.

Local wall times support the isolation decision only. GitHub Actions remains
the source for the release-gate p95 and the required live proof.

## Live CI Proof

The post-change proof on [PR #919](https://github.com/suleymankuncan-web/CODEX/pull/919)
completed on commit `b0ca81978575b64e0fba86790805f0c47849bbd1`:

- root release job: 10 minutes 27 seconds;
- official release gate: 9 minutes 55 seconds;
- Playwright: `Running 371 tests using 2 workers` and `371 passed (8.1m)`;
- required aggregate, targeted frontend child, rehearsal, and Vercel: passed;
- the failure-artifact step skipped on the successful run, as designed.

This one live proof validates the latest code change. It is not a ten-run p95
claim.

## Safety Boundary

- `fullyParallel` remains disabled, so each file keeps its serial execution
  model.
- The two workers run only in CI; local default behavior remains serial.
- The existing visual-evidence specs remain whole files and are not duplicated
  across a shard boundary.
- Page-local request fixtures and browser contexts remain the isolation unit.
- A failed root release preserves its Playwright failure results as a bounded
  CI artifact; successful runs do not upload an extra artifact.
- A green CI proof is required before treating this as a release-gate
  improvement. The following ten successful root PR runs must be measured
  before claiming the p95 target is met.

After those ten runs, record one dated outcome: keep the setting when p95 is at
or below 12 minutes; otherwise record the measured p95 and cause as an
insufficient-improvement/no-further-concurrency-change decision. In the latter
case, retain two workers only if they are flake-free and measurably better than
the serial baseline; otherwise revert to one worker. Neither outcome permits
coverage reduction, hidden retries, or another unmeasured shard change.

## Rollback And Stop Rule

Revert the worker setting if CI shows a blank shell, cross-test interference,
coverage mismatch, artifact collision, or an unexplained flake. Do not respond
by removing tests, adding retries to hide failures, or weakening the required
gate. Keep the one-worker configuration until a new, reproducible isolation
plan is approved.
