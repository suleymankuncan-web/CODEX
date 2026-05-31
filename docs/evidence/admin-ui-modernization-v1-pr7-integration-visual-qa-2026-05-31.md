# Admin UI Modernization V1 PR-7 Integration Visual QA - 2026-05-31

Scope:

- `/admin/integrations`
- `/admin/integrations/batch-kpi-lineage-ui-1`

Viewport coverage:

- Desktop: 1440px wide
- Mobile: 390px wide

Evidence:

- `admin-ui-modernization-v1-pr7-integration-visual-qa-2026-05-31/dashboard-desktop.png`
- `admin-ui-modernization-v1-pr7-integration-visual-qa-2026-05-31/dashboard-mobile.png`
- `admin-ui-modernization-v1-pr7-integration-visual-qa-2026-05-31/detail-desktop.png`
- `admin-ui-modernization-v1-pr7-integration-visual-qa-2026-05-31/detail-mobile.png`

Checks:

- Horizontal overflow: `0` for all four scenarios.
- Browser console errors: `0` for all four scenarios.
- Page errors: `0` for all four scenarios.

Notes:

- Screenshots use Playwright route fixtures for integration overview, needs-action queue,
  lookup/template data, batch detail, reconciliation, row errors, audit, and mapping candidates.
- No upload, retry, mapping, polling, import lifecycle, or API contract behavior was changed by
  the visual QA run.
