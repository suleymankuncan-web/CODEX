# Rankings monthly and inclusive date aggregation

Owner request: fix Türkiye Sıralaması monthly aggregation of daily ingested facts,
reuse the locked calendar for two-date selection, and preserve ranking visibility,
manager identities, exclusions and scoring.

## Decision and data semantics

- Monthly reads prefer daily physical components inside the requested month when
  those facts exist in the caller's company scope. Existing monthly snapshots are
  retained for months without daily physical components. Dates without data stay empty.
- Calendar ranges send the existing `periodType=daily`, `periodStart`, `periodEnd`
  contract. Bounds are inclusive, with the existing 366-day server maximum.
- Per-entity/day numerator and denominator pairs are matched before summing. ATV,
  UPT and CR are recomputed from those sums; imported ratios and scores are never
  added or averaged. Missing components are omitted from both sides of a pair.
- Available recorded days contribute to the selected interval. Missing days are not
  zero-filled. The page explains that calculations use available period records.
- GSM uses summed yes/total customer counts. Daily GSM target rates are weighted
  by the same total-customer counts. Store sales targets retain the physical daily
  target sum; personnel targets retain approved monthly-target proration across
  the complete selected interval.
- Store and personnel benchmark reads use the same physical range basis. The
  existing score evaluator, baseline 70/cap 140, checklist handling, role/scope,
  demo/import exclusions and store-manager personnel exclusion remain in place.
- Fixed an existing personnel range SQL ambiguity: joining account `user_id`
  explicitly avoids duplicate `user_id` columns after direct manager assignments.
- Actual REGION_MANAGER user IDs still own the manager filter. The separate Targets
  task extracted its existing directory query without changing these identities.

Medium-risk read/scoring-input correction, reversible by reverting these source
changes. No migrations, provider activation or business-data mutation. The shared
range reader also serves explicit Store KPI ranges; its regression suite is included.

## Verification

- Backend scoped Jest: 4 suites and 25 tests passed. The opt-in PostgreSQL suite
  also passed 3 tests against a newly created and dropped disposable database.
- Frontend and backend lint and production builds passed.
- Backend architecture and file-size guards passed; the ranking service test file
  remains within the enforced 1,199-line limit.
- PostgreSQL fixture tests create and drop only their uniquely named isolated database.
  Explicit invocation sets `RANKING_RANGE_POSTGRES_CONTAINER` to a local fixture
  container and runs `ranking-range-postgres.spec.ts`. Ordinary Jest runs skip this
  opt-in integration file; the separately executed receipt above covers it.
- Numeric fixtures cover incomplete-month observed sums, paired denominators,
  weighted GSM/targets, personnel targets and benchmarks, inclusive subset/single
  dates, missing denominators, source preference, empty month and company isolation.
- Service regression verifies recalculated baseline70/cap140 scores and rankings.
- The 19 targeted Rankings Playwright checks passed across desktop, tablet and
  390/320 px mobile viewports. They cover filters, inclusive custom ranges,
  month restoration, top-100 role views, API denial recovery and removal of
  personnel-profile navigation.
- Visual self-review found existing 320px clipping masked by global overflow hiding.
  The actual surface extended to x=348.25. Setting its grid-child `min-width: 0`
  fixes containment. Bounding-box assertions now guard the surface and selected
  range button at all four verified widths.
