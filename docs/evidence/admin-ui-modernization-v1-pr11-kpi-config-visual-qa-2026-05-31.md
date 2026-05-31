# Admin UI Modernization V1 PR-11 KPI Config Visual QA

Date: 2026-05-31

Surface:
- `/admin/kpi-config`

Build:
- `npm.cmd --prefix admin-web run build`
- Preview: `http://127.0.0.1:4311/admin/kpi-config`

Evidence:
- Desktop: `docs/evidence/admin-ui-modernization-v1-pr11-kpi-config-visual-qa-2026-05-31/admin-kpi-config-desktop.png`
- Mobile 390px: `docs/evidence/admin-ui-modernization-v1-pr11-kpi-config-visual-qa-2026-05-31/admin-kpi-config-mobile-390.png`

Checks:
- Legacy selector count: desktop `0`, mobile `0`
- Horizontal overflow: desktop `false`, mobile `false`

Legacy selectors checked:
- `.hero-panel`
- `.metric-card`
- `.dashboard-card`
- `.status-pill`
- `.panel-heading`
- `.stacked-row`
- `.stacked-table`
- `.control-button`
- `.page-stack`
- `.key-grid`
