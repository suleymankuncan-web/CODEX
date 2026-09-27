# Store read-only UI and data binding — 27 September 2026

Status: local verification for PR; not deployment evidence.

## Scope and design read

- Surfaces: `/store/rankings`, `/store/kpis`, and `/store/reports` in the existing Store shell.
- Personas: Store Personnel, Store Manager, Region Manager, and Report Viewer where already authorized. Role and route permissions are unchanged.
- Primary tasks: compare ranking lists, search current KPI results without losing input focus, and download the selected report package.
- Archetypes and density: compact list/management for rankings and KPI results; compact result/report for reports.
- Mobile behavior: ranking tabs wrap without overlap, KPI search remains stable, and report metrics retain the existing stacked layout without horizontal overflow.
- Data: existing ranking and report APIs only. The KPI month fallback uses the monthly window returned by the API; it does not invent the current month.
- Unchanged contracts: API response shapes, authentication, permissions, KPI formulas, ranking order, exported report-package contents, and Excel behavior.

## Change and rollback

- Ranking tabs reserve space for real list counts at desktop and narrow widths.
- KPI searches debounce for 300 ms, reset pagination with the committed search, cancel superseded reads, retain same-scope results, expose the existing regional GSM metric, and recover a returned monthly window when persisted monthly options are absent.
- Reports remove the repeated store KPI table, open package contents initially, and keep the result surface compact.
- One revert restores all prior presentation and query-binding behavior; no data repair or provider change is required.

## Verification

- `git diff --check`: passed.
- Changed TS/TSX ESLint: passed.
- Frontend Playwright build (`npm run build:e2e`): passed; the existing large-chunk warning remains.
- Affected Playwright specs: 28/28 passed. Debounce timing uses a paused Playwright clock before the 299+1 ms boundary, so real wall-clock progress cannot weaken the assertion.

Full local E2E, `check:release`, on-prem proof, deployment, and live-provider claims are intentionally not made; mandatory GitHub CI remains unchanged.
