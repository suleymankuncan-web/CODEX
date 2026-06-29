# Store Reports Prototype To Product V1 Closeout

Date: 2026-06-29
Status: PR3 evidence slice
Surface: `/store/reports`

## Decision

`/store/reports` is no longer a Store shell bridge/placeholder route.

It is now a Store Reports Package V1 read/export surface:

- Region Manager, Super Admin, Report Viewer, and Auditor can open it.
- Store Manager does not see it in the sidebar and cannot open it directly.
- Period selection is month/year only.
- Current month export covers month start through the current Europe/Istanbul day.
- Past month export covers the full month.
- Future months are disabled in the UI.
- Missing source data is exported and displayed as `Veri yok`; values are not invented.

## Implemented Contract

Visible production surface:

- Header: `Raporlar`
- Subtitle: `Dönem rapor paketi, modül özetleri ve detay dışa aktarım.`
- Top-right period picker with month and year only
- Metrics: `Dönem paketi`, `Kapsam`, `Detay çıktı`, selected period readiness
- Main panel: `${periodLabel} Mağaza İzleyiş Exceli`
- Primary action: `Excel indir`
- Sections: `KPI kolonları`, `Onay skorları`, `Aksiyon durumu`, `Hedefler`, `Primler`, `Norm Kadro`, `Ziyaret`

Removed production behavior:

- `/admin/reports` bridge button
- lower report list/drawer
- duplicate top-right Excel button
- refresh button
- day calendar grid
- internal/debug copy

## Data Source

Backend source:

- `GET /api/reports/store-monthly-package`
- `GET /api/reports/store-monthly-package.xlsx`

The Excel package is scoped to the current actor's allowed stores and contains one row per scoped store.

Initial package columns:

- Bölge Müdürü
- Mağaza
- Şehir
- Dönem
- Rapor aralığı
- Skor
- UPT
- ATV
- CR
- HG%
- GSM
- BM Checklist
- VM Checklist
- Aksiyon durumu
- Hedef durumu
- Prim durumu
- Norm / Fiili
- Eksik gün
- Turnover
- Son ziyaret
- Ziyaretten geçen gün
- Veri notu

## Prototype Parity

Result: PASS for PR2/PR3 production-bound parity scope.

Evidence basis:

- The production route carries the accepted compact report package anatomy.
- Store Manager no-access boundary is visible and tested.
- Region Manager product route is visible and tested.
- Month/year picker has no day grid.
- Desktop and mobile overflow are covered by Playwright.
- The old bridge copy and `/admin/reports` action are absent.

Intentional deviation:

- There is no standalone locked `docs/prototypes/store-reports-*.html` hash entry for this surface. The accepted contract is the implementation plan and the production React surface introduced by PR2. This is recorded in `docs/prototypes/README.md`.

## Verification

PR1 backend contract:

- targeted service/repository/controller tests passed
- backend lint/build passed
- OpenAPI generated
- system-flow generated
- script tests passed
- GitHub release checks passed before merge

PR2 frontend productization:

- `npm.cmd --prefix admin-web run api:generate`
- `npm.cmd --prefix admin-web run api:check`
- `npm.cmd --prefix admin-web run lint`
- `npm.cmd --prefix admin-web run build`
- `npm.cmd run system-flow:generate`
- `node scripts/system-flow-generator-contract.test.mjs`
- `npm.cmd run test:scripts` (488/488)
- `npm.cmd --prefix admin-web run test:e2e -- reports-surfaces.spec.ts store-surfaces.spec.ts` (90/90)
- GitHub checks passed before merge

PR3 evidence additions:

- dedicated `admin-web/e2e/store-reports.spec.ts`
- placeholder decision updated as superseded for `/store/reports`
- prototype shelf updated with the accepted Store Reports product contract

## Remaining Boundaries

This closeout does not change:

- KPI scoring formulas
- target approval workflow
- incentive formulas or approval flow
- workforce/norm logic
- Store Manager report visibility
- report package column definitions beyond V1

Future report expansion must stay behind the scoped report package contract and must preserve the missing-data policy.
