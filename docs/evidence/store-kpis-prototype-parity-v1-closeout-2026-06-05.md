# Store KPIs Prototype Parity V1 Closeout

Date: 2026-06-05

Scope: `/store/kpis` Store Manager and Region Manager prototype parity line.

## PR Train

- PR #649: added the Store KPIs prototype parity contract and tracked the
  approved prototype files.
- PR #650: added the selected-store KPI read contract and Region Manager
  no-selection behavior without changing scoring, auth, DB schema, or API
  response shape outside the planned query contract.
- PR #651: added frontend route state for live/closed mode, selected store, and
  Region Manager no-selection routing.
- PR #652: moved the Store Manager surface to the approved command-deck
  prototype language.
- PR #653: moved the Region Manager overview and selected-store drill-in to the
  approved region-manager prototype language.
- PR #654: final closeout evidence and current-state handoff update.

## Prototype Contracts

- Store Manager prototype:
  `docs/prototypes/store-kpis-command-deck-v3.html`
- Region Manager prototype:
  `docs/prototypes/store-kpis-region-manager-v1.html`

## Visual Evidence

Store Manager:

- Prototype desktop:
  `docs/evidence/store-kpis-pr3-prototype-desktop-2026-06-04.png`
- Production desktop:
  `docs/evidence/store-kpis-pr3-production-desktop-2026-06-04.png`
- Prototype mobile:
  `docs/evidence/store-kpis-pr3-prototype-mobile-2026-06-04.png`
- Production mobile:
  `docs/evidence/store-kpis-pr3-production-mobile-2026-06-04.png`

Region Manager:

- Prototype desktop:
  `docs/evidence/store-kpis-pr4-prototype-desktop-2026-06-04.png`
- Production desktop:
  `docs/evidence/store-kpis-pr4-production-desktop-2026-06-04.png`
- Prototype mobile:
  `docs/evidence/store-kpis-pr4-prototype-mobile-2026-06-04.png`
- Production mobile:
  `docs/evidence/store-kpis-pr4-production-mobile-2026-06-04.png`

Detailed parity evidence:

- `docs/evidence/store-kpis-prototype-parity-pr3-2026-06-04.md`
- `docs/evidence/store-kpis-prototype-parity-pr4-2026-06-04.md`

## Parity Closeout

- Store Manager production matches the command-deck prototype for the page
  header rhythm, score composition card, Store KPI / Personnel KPI tabs, KPI
  contribution rows, personnel rows, status tones, profile actions, and
  desktop/mobile density.
- Region Manager production matches the region prototype for short operational
  title style, summary card alignment, compact store table, checklist chips,
  backend-supported sorting, compact `Ac` action placement, and mobile card
  layout.
- Production keeps the real Store shell/sidebar instead of prototype-local
  shell chrome. This is the only expected layout deviation for both surfaces.
- Production may show real shell-level pilot feedback controls in screenshots;
  those controls are outside the Store KPI surface implementation.
- Store name sorting is intentionally not implemented because the rankings API
  sort contract supports score and KPI metric keys, not store-name sort.

## Behavior And Data Boundaries

- No fake production data was added. Prototype demo rows are not embedded in
  runtime code.
- Missing KPI/checklist values render as honest `Veri yok`, `Yapilmadi`, or
  `Pasif` states.
- Checklist source composition remains explicit:
  personnel/store KPI contribution, BM checklist contribution, VM checklist
  contribution, and passive checklist redistribution are separate UI concepts.
- Passive checklist weight is redistributed across active store KPI metrics such
  as HG%, ATV, UPT, and CR; it is not moved to the other checklist.
- CR remains a store KPI and is not shown as a personnel KPI.
- Personnel rows show personnel-level metrics only.
- Store Manager `/store/kpis` reads the manager's own store.
- Store Manager own performance remains `/store/me`.
- Another employee profile remains `/store/personnel/:employeeId`.
- Region Manager overview reads rankings/scope data and does not call
  `store-kpi-highlights` until a store is explicitly selected.
- Region Manager store navigation is `/store/kpis?storeId=<storeId>` and
  selected-store scope remains backend-enforced.

## Regression Coverage

`admin-web/e2e/store-surfaces.spec.ts` covers:

- Store Manager command-deck surface and old Store KPI copy removal.
- Store Manager Personnel KPI tab and profile-access behavior.
- Live checklist contribution display with completed BM/VM checklist rows.
- English localization for the new Store KPI contract.
- Region Manager no-selected-store overview behavior.
- Region Manager scoped overview data and `Aç` selected-store drill-in route.
- Missing Region Manager checklist metric as `VM Pasif`.
- Backend-supported Region Manager sort query changes.
- Region Manager mobile viewport visibility.
- Region averages hidden when the rankings response does not return full
  `meta.total` coverage.

The broader Store surface spec also keeps existing out-of-scope route/access
and Store personnel profile coverage; this parity line did not widen those
semantics.

## Old UI Remnant Scan

The closeout scan found no active runtime references to the retired Store KPI
surface component names:

- `StoreKpiHeroPanel`
- `StoreKpiViewModePanel`
- `StoreKpiSummaryGrid`
- `StoreKpiChecklistImpactPanel`
- `StoreKpiScoreSourcesPanel`
- `StoreKpiScopeSignalGrid`
- `StoreKpiPartialDataPanel`
- `StoreKpiScoreMeaningPanel`
- `StoreKpiScoreBreakdownPanel`
- `StoreKpiOwnershipPanel`
- `StoreKpiPriorityPanel`
- `StoreKpiRegionOverviewFoundation`

The Store KPI E2E also asserts the absence of old English handoff/debug copy
such as `Store KPI Highlights`, `Weighted Score Summary`, `Current Context`,
`Top Signal`, `Ownership Matrix`, and `Priority Follow-Up`.

## Verification

PR #652 Store Manager verification:

- `npm.cmd --prefix admin-web run lint`: pass
- `npm.cmd --prefix admin-web run build`: pass
- `npm.cmd --prefix admin-web run test:e2e -- store-surfaces.spec.ts -g "store KPI"`:
  pass, 4/4
- `npm.cmd --prefix admin-web run api:check`: pass
- `npm.cmd run test:scripts`: pass, 406/406
- `git diff --check`: pass
- `git diff --cached --check`: pass

PR #653 Region Manager verification:

- `npm.cmd --prefix admin-web run lint`: pass
- `npm.cmd --prefix admin-web run build`: pass
- `npm.cmd --prefix admin-web run test:e2e -- store-surfaces.spec.ts -g "region manager store KPI overview waits for selected store before loading detail highlights"`:
  pass, 1/1
- `npm.cmd --prefix admin-web run api:check`: pass
- `npm.cmd run test:scripts`: pass, 406/406
- `npm.cmd --prefix backend/nestjs run test -- reporting.controller`: pass,
  2 suites / 11 tests
- `git diff --check`: pass
- `git diff --cached --check`: pass

PR-5 closeout verification:

- `npm.cmd --prefix admin-web run lint`: pass
- `npm.cmd --prefix admin-web run build`: pass
- `npm.cmd --prefix admin-web run test:e2e -- store-surfaces.spec.ts`: pass,
  65/65
- `npm.cmd --prefix admin-web run api:check`: pass
- `npm.cmd --prefix backend/nestjs run test -- reporting.controller`: pass,
  2 suites / 11 tests
- `npm.cmd run test:scripts`: pass, 406/406
- `git diff --check`: pass

## Remaining Intentional Risks

- Live protected persona/browser smoke was not part of this prototype parity
  line; existing backend scope and E2E fixtures are the evidence boundary.
- Region-level true aggregate averages require full ranking coverage or a future
  aggregate API. Until that exists, production hides the average when the
  returned rows do not cover full `meta.total`.
- Store shell/sidebar is owned by the broader Store shell work, not by the local
  prototype files.
