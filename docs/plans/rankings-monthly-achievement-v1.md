# Turkey rankings: progress against full monthly targets

Status: final live-scoring implementation and PR verification in progress; not deployed
Date: 2026-09-17
Risk: R5 scoring, reversible through one code revert; no data repair.

The owner approved showing selected-day sales against the full monthly target
for both store and personnel Turkey rankings. A 3% first day plus a 5% second
day therefore produces 8% over those two days. No calendar-day proration or
weekday/weekend multiplier applies. The existing default monthly view remains.

The final owner-approved scoring rule makes live HG contribution equal to its
own achievement ratio times the published profile weight: 80% at weight 40 earns
32 points; 100% earns 40. Turkey HG reference remains informational. Other KPIs
retain their current base-70/reference rules, so HG 40 plus other metrics 60 at
reference yields 82 total points. Existing live ratio cap 2 and negative score
floor stay unchanged; closed/versioned snapshot scoring is not rewritten.

Implementation sequence: apply the HG-only scale in the shared live evaluator;
invalidate ranking client queries after successful admin publication; verify
dynamic store/personnel weights, range additivity, missing targets, unchanged
other KPI/snapshot rules and cache parity; run canonical release, self-review
and fix findings, then open one PR. The owner requested leaving that PR open.
Draft saves do not affect live scores. Published profiles are read from storage
on every ranking request; Redis caches daily facts, not the profile or final score.

Previously, range reads summed observed daily store targets and prorated personnel
references by selected days. Single-day requests also have a separate read path.
The implementation uses a common monthly-target lookup for range, single-day and legacy monthly
ranking reads. Store targets use the latest approved distribution request, then
an imported full-month sales target when no approved request exists. Personnel
targets use their approved full-month reference for the employee and store.
Target revisions are read afresh, outside the daily-facts Redis payload.

Ranges spanning months use the sum of each touched month's full target once.
Missing/ambiguous targets make HG unavailable rather than silently shortening
the denominator. A zero target does not produce a percentage. Daily sales stay
bounded by the selected inclusive dates; daily facts override legacy monthly
facts as before. NET_SALES is the preferred store sales numerator for each day,
with existing sales aliases as a fallback for days when net sales is absent.

Contract Impact: HG values and their existing contribution to live rankings
change intentionally, including removing base 70 for HG only. API shape,
role/scope access, published KPI weights, other ratio
formulas, target approval writes, closed snapshots, Redis activation and schemas
are unchanged. Monthly target progress is not a pace-versus-elapsed-time score.

Verify with actual PostgreSQL: early-month and single-day progress, two-day
additivity, complete/partial month, month/year boundaries, missing/zero/duplicate
targets, approved revisions and pending requests, employee/store/company
isolation, plus unchanged ATV/UPT/CR/GSM results. Cover repository/service routing
and cache parity/freshness. Run relevant backend release checks and review the
final diff separately. Stop if live data repair or a schema change is required.

## Local verification — 17 September 2026

- Final ranking suite after review: 23 suites / 120 tests passed, including 12
  real PostgreSQL cases in an owned disposable database. Explicit single-day
  calendar ranges use physical facts. Legacy daily-period API requests without
  an end date retain imported ratios, including when NET_SALES is also present.
- Final backend lint and build passed. The full backend release check had already
  passed (375 suites / 2,718 tests, production audit clean) before the final
  localized single-day compatibility and monthly lookup query-plan refinements;
  the affected ranking suite was rerun after those refinements.
- Frontend production-mode E2E build and both ranking Playwright specs passed
  (11 tests), including default month, inclusive custom ranges, cancellation,
  role/filter contracts and mobile layouts. An initial preview startup timed out
  during compilation; explicitly building first resolved that infrastructure wait.
- Redis/PostgreSQL proof passed with 100 stores, 800 personnel and 54,000 physical
  rows: cached/uncached equality, fresh approved store and personnel targets,
  scope separation, invalidation, rollback and unavailable-cache fallback.
- Self-review caught PostgreSQL's 1,000-row timestamp-series estimate triggering
  costly JIT in the new target lookup. Bounded integer month offsets removed it:
  three local store reads took 27/21/21 ms (EXPLAIN execution 20.394 ms), versus
  1,220/1,145/1,020 ms before the fix. This is synthetic local read-path evidence,
  not a hosted latency claim. After review, stalled-Redis fallback was 332.60 ms.

## Inline self-review and fixes — 17 September 2026

Two P2 findings were reproduced with failing real PostgreSQL regression tests:

1. Selecting NET_SALES after summing the range dropped alias-only days whenever
   any other day had net sales. Resolve the source per day before summing HG.
   Tests cover mixed codes, conflicting aliases, zero net sales and returns.
2. Newly routing legacy daily-period requests through physical aggregation
   discarded imported ratios when NET_SALES existed without ticket/item counts.
   Restore their original routing; the shared calendar's explicit date ranges
   still aggregate physical facts and all paths retain full monthly HG targets.

The corrected daily projection uses cache namespace v2, preventing reuse of v1
aggregates from a previous deployment. A regression test rejects the old key;
the real Redis proof verifies mixed-code totals on warm reads, current targets,
cache/database parity and all existing invalidation/isolation safeguards.
Final targeted verification also passed 38 architecture/size/handoff/scoring
guards and backend lint/build. A second inline self-review found no remaining
actionable issue within this diff. Frontend source is unchanged by these fixes;
its earlier 11 passing Playwright checks remain scoped evidence, not a new run.

## Final live scoring and publication verification

- Shared live HG calculation now uses the published weight directly. Other live
  KPI scales, the existing checklist-weight fallback, ratio caps and closed
  snapshot calculations remain unchanged. Golden expectations were recalculated
  for the intentional HG contribution increase; ranking/tie contracts still pass.
- A service test verifies independent published store/personnel weight changes
  become visible on the next request using unchanged facts (82 to 79 / 85).
- A browser regression preserves the same QueryClient across SPA navigation:
  draft save retains the cached ranking, publication fetches the new score without
  document reload. The targeted Playwright test and production E2E build passed.
- Final targeted backend run: 33 suites / 175 tests passed, including all 12 real
  PostgreSQL cases. Redis parity/freshness proof passed again, including mixed
  daily sales codes and a 332.15 ms stalled-cache fallback on this local fixture.
- Inline self-review covered approved-target precedence, missing/ambiguous
  targets, date boundaries, scope isolation, old cache namespace rejection,
  dynamic weights and closed snapshot preservation. No remaining actionable
  finding was identified. This is self-review, not independent agent review.
- Full root verification identified two repository guard failures: the frozen
  admin page grew by one line, and the disposable cache proof's target write
  was not inventoried. Grouping publication invalidations preserves the size
  budget; explicitly classifying the local-only fixture preserves the fail-closed
  writer guard without changing runtime writers. Both guards passed after fixes.

Run the canonical full release on the committed change before opening the PR;
record its exact-head receipt and subsequent CI in the PR. No schema/data repair,
cache activation or hosted deployment is part of this change. Leave the PR open
as requested. Rollback is a code revert; approved targets, sales records and
completed ranking snapshots are not rewritten.
