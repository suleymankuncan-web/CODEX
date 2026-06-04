# Store KPIs Prototype Parity PR-4 Evidence

Date: 2026-06-04

Scope: Region Manager `/store/kpis` overview and selected store drill-in.

Approved prototype:

- `docs/prototypes/store-kpis-region-manager-v1.html`

Screenshots:

- Prototype desktop: `docs/evidence/store-kpis-pr4-prototype-desktop-2026-06-04.png`
- Production desktop: `docs/evidence/store-kpis-pr4-production-desktop-2026-06-04.png`
- Prototype mobile: `docs/evidence/store-kpis-pr4-prototype-mobile-2026-06-04.png`
- Production mobile: `docs/evidence/store-kpis-pr4-production-mobile-2026-06-04.png`

Production screenshots are captured from the `store-kpis-region-overview`
surface after asserting the surface is in the 390px mobile viewport. This
isolates the approved KPI surface from the real Store shell/sidebar, which is
an allowed prototype deviation in this plan.

## Parity Checklist

- Summary card alignment: matched the prototype's short header, toolbar chips,
  average score, scope card, and compact region KPI values.
- Compact row density: desktop table uses the prototype's tight row rhythm and
  avoids subtext under store names.
- Mobile layout: mobile uses card rows instead of a horizontal desktop table.
- Checklist chip tones: completed checklist scores render as green `BM 92` /
  `VM 86`; missing checklist values render as pink passive chips.
- Sort interaction: visible backend-supported metric columns update
  `sortKey`/`sortDirection` through the rankings query.
- Action placement: all rows use the same compact primary `Ac` action.
- Selected store drill-in: row action navigates to
  `/store/kpis?storeId=<storeId>` and keeps the selected period query.
- Empty/access/loading states: overview uses real ranking/scope data or honest
  empty/error states; no production fake rows were added.

## Intentional Deviations

- Production keeps the real Store shell/sidebar instead of the prototype local
  sidebar. This is the allowed shell deviation in the plan.
- Production may show the real shell-level Pilot feedback control in visual
  evidence. It is not part of the Store KPI surface implementation.
- Store name header is not sortable in this PR because the rankings API sort
  contract supports score and KPI metric keys, not store-name sorting.
- Screenshot production data is Playwright visual QA fixture data only. Runtime
  production code reads the real rankings/highlights/config APIs and does not
  embed those fixture rows.
- Personnel count is shown only when the rankings response returns a real
  personnel total; otherwise the UI uses the unavailable scope copy.

## Verification

- `npm.cmd --prefix admin-web run lint`: pass
- `npm.cmd --prefix admin-web run build`: pass
- `npm.cmd --prefix admin-web run test:e2e -- store-surfaces.spec.ts -g "region manager store KPI overview waits for selected store before loading detail highlights"`:
  pass, 1/1; includes mobile viewport visibility assertion for the region
  overview surface and verifies region averages are hidden when the rankings
  response does not return the full store scope
- `npm.cmd --prefix admin-web run api:check`: pass
- `npm.cmd run test:scripts`: pass, 406/406
- `npm.cmd --prefix backend/nestjs run test -- reporting.controller`: pass,
  2 suites / 11 tests
- `git diff --check`: pass
