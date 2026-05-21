# Admin Reports Mobile Evidence V1

Date: 2026-05-21

## Sokrates Decision

Claim:

- `/admin/reports` and `/admin/reports/snapshot-runs` should get route-level
  mobile boundedness evidence now, because the earlier reports link-context
  slice improved accessible drill-down labels but left mobile proof mostly in
  browser notes and detail-page coverage.

Evidence:

- Repo evidence: `kpi-config-versioning.spec.ts` already owns reports summary,
  snapshot chooser, and report detail localization fixtures.
- Repo evidence: `2026-05-20-admin-reports-link-context-v1.md` records browser
  checks for these routes, but the automated mobile guard covered report detail
  table controls rather than the summary hub and snapshot chooser as a pair.

Counterargument:

- A test-only slice does not add visible polish. That is acceptable because no
  current browser or pilot evidence proves a visual defect on these two routes.

Risk:

- LOW. This slice adds targeted Playwright coverage and a handoff note only.

Door:

- Two-way door. The guard can be narrowed or replaced if a future reports UX
  issue requires visible changes.

Decision:

- Add mobile-width boundedness coverage for the reports summary hub and the
  snapshot run chooser.
- Do not change report API calls, response shapes, auth, permissions, DB,
  sorting, export behavior, drill-down href targets, CSS, copy, layout, or
  report calculations.

## Verification

Local gates:

- `git diff --check`
- `npm.cmd --prefix admin-web run lint`
- `npm.cmd --prefix admin-web run build`
- `npm.cmd --prefix admin-web run test:e2e -- kpi-config-versioning.spec.ts --workers=1`
  - Result: 9 passed, 0 failed.
- `npm.cmd --prefix admin-web audit --omit=dev`

Result:

- Passed locally.

## Follow-Up

- Park reports summary and snapshot chooser polish unless this guard, browser
  review, or pilot feedback reveals a concrete issue.
