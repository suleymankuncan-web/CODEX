# Store KPIs Prototype Parity V1 Plan

Date: 2026-06-04

Status: implementation-ready plan; runtime code is not changed by this document.

## Goal

Move the approved Store KPI prototypes into the production `/store/kpis` route with
prototype-level parity for both Store Manager and Region Manager surfaces.

Approved prototype contracts:

- Store Manager: `docs/prototypes/store-kpis-command-deck-v3.html`
- Region Manager: `docs/prototypes/store-kpis-region-manager-v1.html`

These prototype files are contract evidence, not disposable local drafts. They
must be tracked in the repository before runtime implementation PRs depend on
them.

This is not a light restyle. The production page must use the same product model,
spacing rhythm, status tones, table density, KPI contribution language, score source
model, tab behavior, and primary action placement as the prototypes. Existing
production KPI math, auth, scope, API contracts, and workflow semantics must remain
protected.

## Route Contract

`/store/kpis` remains the shared Store KPI route.

Store Manager behavior:

- `/store/kpis` opens the current manager's own assigned store KPI surface.
- Store manager cannot select or inspect stores outside their assigned scope.
- Store manager personnel rows use compact `Profil` actions.
- Personnel profile route is `/store/personnel/:employeeId` for another employee.
- `/store/me` remains the current user's own performance page, not a generic
  employee profile route.

Region Manager behavior:

- `/store/kpis` opens the Region Manager overview surface.
- The overview lists only stores in the Region Manager's real backend scope.
- Region Manager overview data comes from ranking/scope reads, not from calling
  store detail highlights without a selected `storeId`.
- `Mağazaya git` opens the selected store KPI detail on the same product route:
  `/store/kpis?storeId=<storeId>`.
- The selected store detail uses the approved Store Manager KPI surface model, but
  in Region Manager read context.
- A Region Manager cannot open a store outside their scope. Frontend hiding is not
  enough; the backend must return access denial for out-of-scope `storeId`.
- A Region Manager request for store detail without `storeId` must not silently
  choose the first scoped store. Frontend Region Manager overview must not call
  `getStoreKpiHighlights` until a `storeId` is selected. If the backend receives a
  Region Manager `store-kpi-highlights` request without `storeId`, it must return
  the existing no-selected-store/partial highlights response if that shape is
  already supported. If that cannot be done without changing the public response
  shape that existing callers depend on, PR-1 stops for an explicit product/API
  decision.

## Non-Goals

- No fake KPI, personnel, checklist, target, trend, score, ranking, or coaching data.
- No scoring formula change.
- No KPI config weight change.
- No checklist scoring behavior change.
- No ranking sort semantics change.
- No DB schema or migration.
- No new Store route unless existing router constraints prove `/store/kpis?storeId`
  cannot carry selected store context.
- No role switcher in production UI.
- No old Store KPI panel skeleton dressed in prototype colors.
- No changes to `/store/incentives`.

## Prototype Parity Rules

- Production layout must visually match the approved HTML prototypes before PR
  closeout.
- Palette, status tones, row height, typography weight, card rhythm, tab model,
  score ring behavior, tooltip/tap behavior, and action placement are part of the
  implementation contract.
- The production shell may own the sidebar/header. This is the only expected layout
  deviation from prototype HTML if the prototype includes a local sidebar.
- Demo-only fake rows in prototype are replaced with real API data or honest empty
  states.
- Any deviation must be recorded with evidence: reason, affected file, and why real
  data/role/scope/responsiveness forced the change.
- Desktop and mobile screenshots must be compared against prototype screenshots.
  "Close enough" is not accepted while visible structure, palette, or density differs.

## Real Data Sources

Existing sources to preserve and extend only where needed:

- `getKpiConfig`
- `getStoreKpiHighlights`
- `getRankings`
- `getReportingSnapshotRuns`
- `getKpiReport`
- `getStoreScoreBreakdown`
- Store auth summary and assigned store/region scope
- KPI config profile weights
- Store/personnel leaderboard rows
- BM/VM checklist rows from KPI/reporting responses

Known contract gap:

- `getStoreKpiHighlights` currently has no selected `storeId` query.
- Region Manager currently has ranking visibility but does not have a selected
  store KPI read contract on `/api/reports/store-kpi-highlights`.
- This must be solved with backend scope validation before UI links are treated as
  complete.

Protected legacy behavior:

- Current `/store/kpis` uses `getReportingSnapshotRuns`, `getKpiReport`, and
  `getStoreScoreBreakdown` for closed/snapshot period behavior. The prototype
  implementation must not silently remove or break that behavior.
- Default rule: existing closed/snapshot behavior is preserved. If it cannot be
  preserved while matching the approved prototype, implementation stops for a
  product decision. The executor must not park or remove it autonomously.
- Before runtime code changes, PR-1 must classify current closed/snapshot behavior
  as preserved or not reachable in the current shipped UI. "Parked" is only allowed
  after explicit user/product approval.
- If closed/snapshot behavior remains reachable, selected store scope validation
  must cover the relevant selected-store read path, including
  `store-score-breakdown` when it is still called.
- If exact prototype parity conflicts with preserving closed/snapshot controls,
  implementation stops and records the conflict before opening a UI PR.

## PR Train

### PR-0: Prototype Contract Baseline

Risk class: docs/evidence only.

Purpose:

- Make the approved HTML prototypes part of the repository contract before any
  runtime implementation claims prototype parity.

Expected changes:

- Track `docs/superpowers/plans/2026-06-04-store-kpis-prototype-parity-v1.md`.
- Track `docs/prototypes/store-kpis-command-deck-v3.html`.
- Track `docs/prototypes/store-kpis-region-manager-v1.html`.
- Do not add prototype-only alternate drafts to the contract PR unless explicitly
  needed as historical evidence.
- Record that production implementation must compare against these two files.

Verification:

- `git diff --check -- docs/prototypes/store-kpis-command-deck-v3.html docs/prototypes/store-kpis-region-manager-v1.html`
- If the files are still untracked during local review, run a no-index whitespace
  check before staging.
- `git status --short -- docs/prototypes/store-kpis-command-deck-v3.html docs/prototypes/store-kpis-region-manager-v1.html`

Stop conditions:

- The approved prototype files are missing.
- A different prototype revision is accidentally used as the contract.
- Prototype files contain demo-only role switchers or fake-data helpers that are
  not clearly understood as prototype-only and excluded from production behavior.

### PR-1: Selected Store KPI Read Contract

Risk class: auth/scope and API read contract.

Purpose:

- Make selected store KPI detail readable for Region Manager without expanding
  access beyond real scope.

Expected changes:

- Add optional `storeId` to
  `backend/nestjs/src/modules/store-ops/web/dto/get-store-kpi-highlights.query.ts`.
- Allow `REGION_MANAGER` on the store KPI highlights read endpoint only if the
  selected store is in their resolved scope.
- Define Region Manager no-selection behavior: `store-kpi-highlights` without
  `storeId` must not default to an arbitrary scoped store for Region Manager.
  Region overview remains a separate frontend model backed by rankings/scope data.
  If the backend receives this no-selection request, it must return the existing
  no-selected-store/partial highlights response if that shape is already supported;
  otherwise PR-1 stops for an explicit product/API decision.
- Keep Store Manager default behavior unchanged: no `storeId` means own assigned
  store.
- Validate selected `storeId` server-side before returning highlights.
- Return access denial for out-of-scope selected store.
- Do not make Region Manager a broad-read role unless existing scope helpers prove
  that is already the intended contract.
- If a repository helper is missing for selected store scope validation, add the
  smallest read helper needed; do not infer scope in frontend.
- Freeze and test current closed/snapshot behavior before changing selected store
  scope.
- Decide whether `store-score-breakdown` needs the same selected-store
  Region Manager scope path. If it remains reachable from `/store/kpis`, it must
  be covered by the same in-scope/out-of-scope tests.
- Generate or update OpenAPI output in the same PR when the backend DTO changes.
  Frontend usage can wait until PR-2, but generated contract drift cannot.

Protected behavior:

- Store manager assigned-store-only read still passes.
- Store manager no-`storeId` default still opens their assigned store.
- Store manager out-of-scope selected store is denied.
- Region manager in-scope selected store passes.
- Region manager no-`storeId` detail request does not select the first scoped
  store implicitly.
- Region manager out-of-scope selected store is denied.
- KPI math and response shape for existing callers stay stable except the accepted
  optional query parameter.
- Closed/snapshot reads either remain behaviorally available or are explicitly
  stopped by explicit product decision before implementation continues.

Candidate files:

- `backend/nestjs/src/modules/store-ops/web/reporting.controller.ts`
- `backend/nestjs/src/modules/store-ops/web/dto/get-store-kpi-highlights.query.ts`
- `backend/nestjs/src/modules/store-ops/application/reporting-store-kpi-read.service.ts`
- existing Store Ops reporting repositories, only if selected store validation
  requires a minimal query helper.
- `backend/nestjs/src/modules/store-ops/web/reporting.controller.spec.ts`

Verification:

- `npm.cmd --prefix backend/nestjs run test -- reporting.controller`
- Targeted KPI highlights service tests if service selection changes.
- `npm.cmd --prefix backend/nestjs run openapi:generate`
- `npm.cmd --prefix admin-web run api:check`
- `git diff --check`.

Stop conditions:

- Selected store support requires changing score calculation.
- Selected store support requires DB migration.
- Selected store support cannot be enforced backend-side.
- Exact prototype parity would require silently removing current closed/snapshot
  behavior.
- Region Manager no-selection behavior cannot be represented with an existing
  no-selected-store/partial highlights response and would require changing the
  public API response shape that existing callers depend on.

### PR-2: Store KPI Frontend Data Model And Route State

Risk class: frontend data binding and route behavior.

Purpose:

- Prepare `/store/kpis` to render the correct role surface using real data.

Expected changes:

- Update `admin-web/src/features/reports/api.ts` to support optional `storeId`
  in `getStoreKpiHighlights` after backend contract exists.
- Update Store KPI page model to distinguish:
  - Store Manager own store detail.
  - Region Manager overview.
  - Region Manager selected store detail.
- Update frontend access gating so `REGION_MANAGER` can reach the Store KPI page
  when the backend contract allows it.
- Add Region Manager prefetch support without firing invalid selected-store detail
  requests when no `storeId` is present.
- Ensure Region Manager `/store/kpis` overview does not call
  `getStoreKpiHighlights` until a `storeId` is selected.
- Make `Mağazaya git` links preserve selected period/query context.
- Keep personnel profile links scoped to `/store/personnel/:employeeId`.
- Keep `/store/me` as self-only.
- Keep existing closed/snapshot query behavior reachable unless PR-1 recorded an
  explicit product decision to park it.

Data mapping requirements:

- Store detail cards bind to real KPI rows/config.
- Personnel table binds to real personnel leaderboard data if available.
- If personnel KPI data is not available for selected store, show honest empty
  state; do not use prototype names.
- Monthly trend chart uses real historical store score data if an existing API
  exposes it. If not, render an honest sparse/empty chart state and record the
  missing contract.
- Passive checklist redistribution display is derived from KPI config weights and
  active KPI rows only; missing checklist weight is not moved to the other
  checklist.
- Score source composition must be backed by explicit model fields:
  - Personnel KPI impact comes only from real personnel/ranking/store-score data.
  - BM checklist impact comes only from BM checklist KPI/reporting rows.
  - VM checklist impact comes only from VM checklist KPI/reporting rows.
  - Passive checklist redistribution is display-only unless the backend scoring
    contract already applies the same redistribution.
- If the current API cannot support a score source line, show an honest unavailable
  state for that line instead of deriving a fake contribution.

Candidate files:

- `admin-web/src/pages/StoreKpiHighlightsPage.tsx`
- `admin-web/src/pages/store-kpi-highlights-model.ts`
- `admin-web/src/pages/store-kpi-highlights-formatters.ts`
- `admin-web/src/features/reports/api.ts`
- `admin-web/src/app/route-data-preloaders.ts`
- `admin-web/src/app/store-shell.tsx` only if route parsing requires it.

Verification:

- `npm.cmd --prefix admin-web run lint`
- `npm.cmd --prefix admin-web run build`
- `npm.cmd --prefix admin-web run api:check`
- Targeted Store KPI e2e smoke adjusted for role surfaces.
- E2E or unit coverage for Region Manager overview proving no detail request is
  made without selected `storeId`.
- `git diff --check`.

Stop conditions:

- Frontend needs fake data to make a required prototype module visible.
- Frontend cannot tell current role/scope without changing auth semantics.
- Selected store route creates route/nav visibility drift.
- Score source composition cannot be backed by real API/model fields.

### PR-3: Store Manager Prototype Parity Surface

Risk class: UI parity with protected KPI semantics.

Purpose:

- Replace the current Store KPI panel chain with the approved Store Manager
  command deck surface.

Expected production modules:

- Compact Store KPI header aligned to the existing Store shell.
- `Mağaza KPI` and `Personel KPI` tabs.
- Animated score ring with KPI color segments and desktop hover/mobile tap
  contribution popover.
- Store KPI cards:
  - Hedef gerçekleşme with target, current net sales, and progress.
  - UPT.
  - ATV.
  - CR.
  - BM checklist.
  - VM checklist.
- KPI contribution table with:
  - KPI.
  - Gerçekleşen.
  - Referans.
  - Oran.
  - Ağırlık.
  - Katkı.
  - Durum.
- Status language:
  - `Yapılmadı` for missing checklist.
  - `Pasif` where checklist weight is redistributed.
  - No "eksik veri" copy for checklist not done.
- Monthly score trend with year picker and real/sparse data only.
- Personnel KPI tab with compact rows:
  - Personel.
  - Skor.
  - Katkı.
  - UPT.
  - ATV.
  - HG%.
  - Durum.
  - `Profil`.
- Passive checklist redistribution panel placed in the personnel KPI decision
  area, not as a long page-stretching table.
- Score source card showing how Store score is composed:
  - Personnel KPI score impact.
  - BM checklist impact.
  - VM checklist impact or passive state.

Implementation constraints:

- Use shadcn/ui, Tailwind v4, lucide-react, and Store surface primitives where
  applicable.
- Page-specific CSS is allowed only to reproduce the approved prototype token
  language; avoid old dashboard primitives.
- Remove unused old Store KPI panels after the new surface owns the route.
- Keep all values real; modules with no source show honest empty/access/loading.

Candidate files:

- `admin-web/src/pages/StoreKpiHighlightsPage.tsx`
- new focused Store KPI components under `admin-web/src/pages/`
- `admin-web/src/pages/store-kpi-highlights-model.ts`
- `admin-web/src/pages/store-kpi-highlights-formatters.ts`
- `admin-web/src/styles/*` only if needed for prototype-level parity.

Verification:

- `npm.cmd --prefix admin-web run lint`
- `npm.cmd --prefix admin-web run build`
- Store KPI targeted e2e.
- `design-taste-frontend` review pass against the approved prototype and the
  project Store UI principles.
- Desktop and mobile screenshots compared with the approved prototype:
  - prototype desktop: `docs/prototypes/store-kpis-command-deck-v3.html`
  - production desktop: `/store/kpis` at 1440px width
  - production mobile: `/store/kpis` at 390px width
- Evidence must include a parity checklist for:
  - palette/status tones,
  - score ring/dots/popover behavior,
  - row height and table density,
  - tab layout,
  - action placement,
  - empty/access/loading states,
  - and any intentional deviation.
- `git diff --check`.

Stop conditions:

- Store Manager surface still visually resembles the old panel chain.
- KPI contribution values are inferred outside existing config/reporting data.
- Missing checklist status is represented as fake score or fake data.
- Screenshot comparison shows visible prototype drift that is not documented as an
  intentional shell/data/access deviation.

### PR-4: Region Manager Prototype Parity Surface

Risk class: UI parity plus scoped drill-in navigation.

Purpose:

- Implement the approved Region Manager `/store/kpis` overview and selected store
  drill-in behavior.

Expected production modules:

- Region overview header using the prototype's short operational title style.
- Summary cards:
  - Bölge ortalama skoru.
  - Kapsam: store count and personnel count if real data source exists.
  - Bölge KPI değerleri in one compact card: HG%, UPT, ATV, CR.
- Compact store table:
  - Mağaza.
  - Skor.
  - HG%.
  - UPT.
  - ATV.
  - CR.
  - Checklist.
  - Aksiyon.
- Store rows must stay compact; no extra subtext under store names.
- Checklist chips show done scores and passive states clearly:
  - `BM 92`, `VM 86` when done.
  - `BM Pasif`, `VM Pasif` when not done.
- Header click sorting works for visible columns without oversized arrow icons.
- All action buttons use a consistent primary treatment and compact `Aç` label.
- `Aç` navigates to `/store/kpis?storeId=<storeId>` and opens selected store KPI
  detail in Region Manager read context.

Data mapping requirements:

- Store list comes from real ranking/scope data.
- Region Manager only sees assigned/in-scope stores.
- CR appears only if backend ranking/store KPI data includes real CR values.
- Personnel count appears only if a real source exists; otherwise use honest
  unavailable state, not a fake total.
- Sorting must not mislead when pagination is active. If the backend supports the
  sort key, use backend sort. If only visible-row sorting is possible, label/e2e
  must reflect current loaded rows.

Candidate files:

- `admin-web/src/pages/StoreKpiHighlightsPage.tsx`
- new Region Manager Store KPI overview component(s)
- `admin-web/src/pages/store-kpi-highlights-model.ts`
- `admin-web/src/features/reports/api.ts`
- `admin-web/e2e/store-surfaces.spec.ts`

Verification:

- `npm.cmd --prefix admin-web run lint`
- `npm.cmd --prefix admin-web run build`
- Store KPI Region Manager e2e.
- `design-taste-frontend` review pass against the approved prototype and the
  project Store UI principles.
- Desktop and mobile screenshots compared with the approved prototype:
  - prototype desktop: `docs/prototypes/store-kpis-region-manager-v1.html`
  - production desktop: `/store/kpis` as Region Manager at 1440px width
  - production mobile: `/store/kpis` as Region Manager at 390px width
- Evidence must include a parity checklist for:
  - summary card alignment,
  - compact row density,
  - checklist chip tones,
  - sort interaction,
  - action column placement,
  - selected store drill-in,
  - and any intentional deviation.
- Negative scope e2e or backend test for out-of-scope selected store.
- `git diff --check`.

Stop conditions:

- Region Manager overview shows stores outside scope.
- `Aç` uses a fake page, modal-only shortcut, or route not backed by selected store
  contract.
- Production table density/palette does not match the approved prototype.
- Screenshot comparison shows visible prototype drift that is not documented as an
  intentional shell/data/access deviation.

### PR-5: Evidence, Regression Guard, And Old UI Cleanup

Risk class: release confidence and visual parity closure.

Purpose:

- Prove the implemented `/store/kpis` route matches prototypes and did not leave
  old UI remnants.

Expected changes:

- Update Store KPI e2e assertions from old "Mağaza KPI'ları" panel semantics to
  the new prototype contract.
- Add/adjust tests for:
  - Store Manager detail surface.
  - Region Manager overview surface.
  - Region Manager `Aç` selected store drill-in.
  - Out-of-scope selected store denied.
  - Missing checklist displays `Yapılmadı`/`Pasif`.
  - Region overview column sorting changes row order.
  - Mobile no horizontal overflow and no overlapped personnel rows.
- Add evidence document with:
  - PR list.
  - Prototype references.
  - Desktop/mobile screenshots.
  - Prototype-vs-production parity checklist for Store Manager and Region Manager.
  - Intentional deviations and reasons.
  - Verification command results.
- Search and remove old Store KPI UI remnants:
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
  if they are no longer used.

Verification:

- `npm.cmd --prefix admin-web run lint`
- `npm.cmd --prefix admin-web run build`
- `npm.cmd --prefix admin-web run test:e2e -- store-surfaces.spec.ts`
- `npm.cmd --prefix backend/nestjs run test -- reporting.controller`
- `npm.cmd --prefix admin-web run api:check`
- `npm.cmd run test:scripts`
- Desktop/mobile visual evidence for both approved prototypes:
  - Store Manager production desktop 1440px.
  - Store Manager production mobile 390px.
  - Region Manager production desktop 1440px.
  - Region Manager production mobile 390px.
- `git diff --check`

Closeout standard:

- Production Store Manager page matches
  `docs/prototypes/store-kpis-command-deck-v3.html`.
- Production Region Manager page matches
  `docs/prototypes/store-kpis-region-manager-v1.html`.
- Store shell/sidebar ownership is documented as the only expected prototype
  layout deviation if applicable.
- No fake data exists.
- No old Store KPI page skeleton remains active.
- Role/scope behavior is backend-enforced.

## Final Verification Bundle

Run before the final merge in this line:

```powershell
npm.cmd --prefix admin-web run lint
npm.cmd --prefix admin-web run build
npm.cmd --prefix admin-web run test:e2e -- store-surfaces.spec.ts
npm.cmd --prefix admin-web run api:check
npm.cmd --prefix backend/nestjs run test -- reporting.controller
npm.cmd run test:scripts
git diff --check
```

If backend contract changes are present:

```powershell
npm.cmd --prefix backend/nestjs run test -- reporting.controller
npm.cmd --prefix backend/nestjs run openapi:generate
npm.cmd --prefix admin-web run api:check
```

Use the exact targeted backend command available in the repo at implementation
time if the generic command is not valid.

## Implementation Notes To Preserve

- Store KPI score composition must distinguish:
  - Personnel KPI contribution.
  - BM checklist contribution.
  - VM checklist contribution.
  - Passive checklist redistribution.
- When one or both checklist sources are not done, their weight is redistributed
  across active store KPI metrics such as HG%, ATV, UPT, and CR. It is not moved
  to the other checklist.
- Checklist not done must read as `Yapılmadı`/`Pasif`, not as "eksik veri".
- CR is a store KPI, not a personnel KPI.
- Personnel KPI rows show personnel-level metrics only.
- Profile navigation for another employee is `/store/personnel/:employeeId`.
- Store Manager own performance remains `/store/me`.
- Region Manager store navigation is `/store/kpis?storeId=<storeId>`.
