# Admin Snapshots Mobile Evidence V1

Date: 2026-05-21

## Sokrates Decision

Claim:

- `/admin/snapshots` and `/admin/snapshots/:snapshotRunId` should get
  mobile-width evidence before any further snapshot UI polish, because snapshot
  runs are operational audit surfaces and visual changes would be speculative
  without a concrete browser or pilot gap.

Evidence:

- Repo evidence: `admin-routing.spec.ts` already verifies snapshot overview and
  detail localization, fixture routing, and key operator copy.
- Repo evidence: recent UI/UX V1 slices added mobile boundedness guards for
  auth audit detail, integrations, and admin checklists, but snapshot overview
  and detail did not yet have the same route-level mobile evidence.

Counterargument:

- A test-only slice does not improve the visual design. That is acceptable
  because no current browser/pilot evidence proves a snapshot visual defect.

Risk:

- LOW. This slice adds targeted Playwright coverage and a handoff note only.

Door:

- Two-way door. The guard can be narrowed, expanded, or replaced if a future
  concrete snapshot operator issue needs a visual or interaction change.

Decision:

- Add mobile-width boundedness coverage for the snapshot operations overview
  and snapshot run detail route.
- Do not change snapshot rerun behavior, API calls, auth, permissions, DB, CSS,
  copy, layout, audit data, materialized slice data, or data calculations.

## Verification

Local gates:

- `git diff --check`
- `npm.cmd --prefix admin-web run lint`
- `npm.cmd --prefix admin-web run build`
- `npm.cmd --prefix admin-web run test:e2e -- admin-routing.spec.ts --workers=1`
  - Result: 21 passed, 0 failed.
- `npm.cmd --prefix admin-web audit --omit=dev`

Result:

- Passed locally.

## Follow-Up

- Park snapshot UI polish unless this guard, browser review, or pilot feedback
  reveals a concrete issue.
