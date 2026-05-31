# Admin UI Modernization V1 PR-6 Visual QA - Auth And Audit Surfaces

Date: 2026-05-31

Scope:
- `/admin/auth`
- `/admin/auth/catalog`
- `/admin/audit`
- `/admin/audit/users/:userId/audit`

Fixture source:
- Playwright-routed auth and audit API fixtures.
- No production API, auth, permission, audit, import, snapshot, or workflow contract changes.

Checks:
- Desktop viewport: `1440x1100`
- Mobile viewport: `390x900`
- Audit detail viewport: `1440x900`
- Document horizontal overflow: `0px` for every capture.
- Legacy dashboard class count: `0` for `hero-panel`, `metric-card`, `panel-heading`, `stacked-row`, `stacked-table`, `control-button`, `timeline-item`, `timeline-dot`, `key-grid`, and `back-link`.
- Required auth/audit headings visible before capture.
- Console/page error count: `0` for every capture.

Screenshots:
- `docs/evidence/admin-ui-modernization-v1-pr6-auth-audit-visual-qa-2026-05-31/auth-dashboard-desktop.png`
- `docs/evidence/admin-ui-modernization-v1-pr6-auth-audit-visual-qa-2026-05-31/auth-dashboard-mobile-390.png`
- `docs/evidence/admin-ui-modernization-v1-pr6-auth-audit-visual-qa-2026-05-31/auth-catalog-desktop.png`
- `docs/evidence/admin-ui-modernization-v1-pr6-auth-audit-visual-qa-2026-05-31/audit-center-desktop.png`
- `docs/evidence/admin-ui-modernization-v1-pr6-auth-audit-visual-qa-2026-05-31/audit-center-mobile-390.png`
- `docs/evidence/admin-ui-modernization-v1-pr6-auth-audit-visual-qa-2026-05-31/audit-user-detail-desktop.png`
