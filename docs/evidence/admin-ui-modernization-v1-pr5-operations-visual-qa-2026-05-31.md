# Admin UI Modernization V1 PR-5 Visual QA - Operations Surface

Date: 2026-05-31

Scope:
- `/admin/operations`

Fixture source:
- Playwright-routed operations API fixtures.
- No production API, auth, import, snapshot, KPI, ranking, workforce, workflow, or status contract changes.

Checks:
- Desktop viewport: `1440x1100`
- Mobile viewport: `390x844`
- Document horizontal overflow: `0px` for both captures.
- Legacy dashboard class count: `0` for `hero-panel`, `metric-card`, `accent-chip`, `panel-heading`, `queue-row`, `key-item`, and `status-pill`.
- Required operations signal sections visible before capture.

Screenshots:
- `docs/evidence/admin-ui-modernization-v1-pr5-operations-visual-qa-2026-05-31/operations-desktop.png`
- `docs/evidence/admin-ui-modernization-v1-pr5-operations-visual-qa-2026-05-31/operations-mobile-390.png`
