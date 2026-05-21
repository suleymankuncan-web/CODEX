# Admin Integrations Mobile Evidence V1

Date: 2026-05-21

## Sokrates Decision

Claim:

- `/admin/integrations` should get route-level mobile evidence before any
  further visual changes, because the UI/UX V1 inventory flagged the main
  integrations screen as high-value with limited mobile evidence.

Evidence:

- Repo evidence: `/admin/integrations/:batchId` already has mapping-context and
  panel-readability follow-ups, but the main `/admin/integrations` route only
  had desktop/chrome, period-control, and upload-disabled assertions.
- Repo evidence: the page has three operator tabs: Uploads, Evidence, and
  Issues. The risky mobile areas are the metrics grid, evidence code block,
  tab navigation, toolbar cluster, and issue queue controls.

Counterargument:

- A test-only PR does not improve the screen visually. That is acceptable here:
  without a concrete browser or pilot gap, changing UI would be speculative.

Risk:

- LOW. This slice adds targeted Playwright coverage and a handoff note only.

Door:

- Two-way door. The test can be narrowed, updated, or removed if a future
  product slice replaces this route evidence.

Decision:

- Add mobile-width boundedness coverage for `/admin/integrations` across the
  Uploads, Evidence, and Issues tabs.
- Do not change upload behavior, import retry behavior, API calls, auth,
  permissions, DB, CSS, copy, layout, or data calculations.

## Verification

Local gates:

- `git diff --check`
- `npm.cmd --prefix admin-web run lint`
- `npm.cmd --prefix admin-web run build`
- `npm.cmd --prefix admin-web run test:e2e -- integration-surfaces.spec.ts --workers=1`
  - Result: 10 passed, 0 failed.
- `npm.cmd --prefix admin-web audit --omit=dev`

Result:

- Passed locally.

## Follow-Up

- Park `/admin/integrations` visual changes unless this test, browser review,
  or pilot feedback reveals a concrete gap.
