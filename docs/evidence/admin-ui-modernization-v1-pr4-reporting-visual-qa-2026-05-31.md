# Admin UI Modernization V1 PR-4 Visual QA - Reporting Surfaces

Date: 2026-05-31

Scope:
- `/admin/reports`
- `/admin/reports/snapshot-runs`
- `/admin/reports/workforce/:snapshotRunId`
- `/admin/reports/kpis/:snapshotRunId`
- `/admin/reports/checklists/:snapshotRunId`
- `/admin/reports/turnover/:snapshotRunId`

Fixture source:
- Playwright-routed report API fixtures.
- No production API, auth, snapshot, scoring, or reporting contract changes.

Checks:
- Desktop viewport: `1440x1100`
- Mobile viewport: `390x900`
- Document horizontal overflow: `0px` for every captured route.
- Required route heading visible before capture.

Screenshots:
- `docs/evidence/admin-ui-modernization-v1-pr4-reporting-visual-qa-2026-05-31/reports-summary-desktop.png`
- `docs/evidence/admin-ui-modernization-v1-pr4-reporting-visual-qa-2026-05-31/reports-summary-mobile.png`
- `docs/evidence/admin-ui-modernization-v1-pr4-reporting-visual-qa-2026-05-31/reports-snapshot-runs-desktop.png`
- `docs/evidence/admin-ui-modernization-v1-pr4-reporting-visual-qa-2026-05-31/reports-snapshot-runs-mobile.png`
- `docs/evidence/admin-ui-modernization-v1-pr4-reporting-visual-qa-2026-05-31/reports-workforce-desktop.png`
- `docs/evidence/admin-ui-modernization-v1-pr4-reporting-visual-qa-2026-05-31/reports-workforce-mobile.png`
- `docs/evidence/admin-ui-modernization-v1-pr4-reporting-visual-qa-2026-05-31/reports-kpis-desktop.png`
- `docs/evidence/admin-ui-modernization-v1-pr4-reporting-visual-qa-2026-05-31/reports-kpis-mobile.png`
- `docs/evidence/admin-ui-modernization-v1-pr4-reporting-visual-qa-2026-05-31/reports-checklists-desktop.png`
- `docs/evidence/admin-ui-modernization-v1-pr4-reporting-visual-qa-2026-05-31/reports-checklists-mobile.png`
- `docs/evidence/admin-ui-modernization-v1-pr4-reporting-visual-qa-2026-05-31/reports-turnover-desktop.png`
- `docs/evidence/admin-ui-modernization-v1-pr4-reporting-visual-qa-2026-05-31/reports-turnover-mobile.png`
