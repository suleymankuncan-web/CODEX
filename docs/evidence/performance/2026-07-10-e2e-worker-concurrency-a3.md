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

The pre-change required gate proof for PR #918 measured the root release job at
14 minutes and 1 second. The Playwright command took 10 minutes and 55 seconds,
about 78% of the root job. The pre-change ten-run nearest-rank p95 was 14
minutes and 1 second, above the 12-minute target.

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

The initial post-change proof on [PR #919](https://github.com/suleymankuncan-web/CODEX/pull/919)
completed on commit `b0ca81978575b64e0fba86790805f0c47849bbd1`
([run 29061500263](https://github.com/suleymankuncan-web/CODEX/actions/runs/29061500263)):

- root release job: 10 minutes 27 seconds;
- official release gate: 9 minutes 55 seconds;
- Playwright: `Running 371 tests using 2 workers` and `371 passed (8.1m)`;
- required aggregate, targeted frontend child, rehearsal, and Vercel: passed;
- the failure-artifact step skipped on the successful run, as designed.

The final PR head `5804ea686746975af9279506978faa060f7cddf0` also passed
([run 29062087361](https://github.com/suleymankuncan-web/CODEX/actions/runs/29062087361)):

- root release job: 10 minutes 54 seconds;
- Playwright: `Running 371 tests using 2 workers` and `371 passed (8.4m)`;
- required aggregate, targeted frontend child, rehearsal, and Vercel: passed;
- the failure-artifact step again skipped on the successful run.

These two live proofs validate the implementation and final PR head. They are
not a ten-run p95 claim.

## Ten-Run Outcome - 2026-07-12

The first ten successful post-stabilization PR root-release jobs were read from
GitHub Actions. Durations are job wall times, not inferred workflow totals:

| Run | Head | Duration |
| --- | --- | ---: |
| `29206865377` | `77889d1b` | 12m 48s |
| `29204653376` | `89cdfe3a` | 11m 40s |
| `29203135745` | `eda1b9ef` | 13m 14s |
| `29199988675` | `891c5774` | 9m 59s |
| `29197004787` | `195e6406` | 9m 58s |
| `29195125937` | `6a9c77c2` | 11m 48s |
| `29193782087` | `437e3325` | 12m 16s |
| `29191086178` | `02869db6` | 9m 58s |
| `29190535724` | `c0b45524` | 12m 03s |
| `29187201049` | `4e0ed951` | 11m 35s |

Sorted durations are `598, 598, 599, 695, 700, 708, 723, 736, 768, 794`
seconds. With ten samples, nearest-rank p95 is the tenth value: `794` seconds,
or `13.23` minutes. NFR-3's 12-minute target is therefore **not met**.

The result is still measurably better than the pre-change 14m 01s baseline.
All 371 Playwright tests remain selected and file-local serial behavior remains
unchanged. No evidence attributes the recorded failures around this window to
cross-worker interference; PR #968 separately repaired the bounded Report
Viewer multi-route timeout without weakening full-load semantics. Keep two CI
workers, open no new concurrency experiment, and reduce no coverage. Revisit
only with a new measured isolation plan or a worker-related failure signal.

## Safety Boundary

- `fullyParallel` remains disabled, so each file keeps its serial execution
  model.
- The two workers run only in CI; local default behavior remains serial.
- The existing visual-evidence specs remain whole files and are not duplicated
  across a shard boundary.
- Page-local request fixtures and browser contexts remain the isolation unit.
- A failed root release preserves its Playwright failure results as a bounded
  CI artifact; successful runs do not upload an extra artifact.
- The dated ten-run result above is the final A3 observation. It records an
  improvement but does not claim the 12-minute p95 target was met.

The decision is `insufficient_improvement_keep_two_workers`: p95 is above 12
minutes, but the bounded setting remains measurably better than the serial
baseline and has no worker-interference signal. Coverage reduction, hidden
retries, or another unmeasured shard/concurrency change remain forbidden.

## Rollback And Stop Rule

Revert the worker setting if CI shows a blank shell, cross-test interference,
coverage mismatch, artifact collision, or an unexplained flake. Do not respond
by removing tests, adding retries to hide failures, or weakening the required
gate. Keep the one-worker configuration until a new, reproducible isolation
plan is approved.
