# Store Workforce Norm Kadro V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Promote the locked Region Manager Norm Kadro full-ledger prototype into the live `/store/workforce` Region Manager surface with matching layout, rhythm, typography, rows, detail modal, sorting, year filter, and Turkish copy while preserving the existing workforce business logic.

**Architecture:** Keep the existing Store shell, role routing, workforce API reads, assignment scope, headcount gap model, export behavior, and Store Manager view intact. Replace only the Region Manager visual composition and view-model mapping so the page becomes a full-width operational ledger instead of a two-column selected-store layout. Do not invent turnover, personnel cost, or exit-history data; render those fields only from available sources, otherwise use controlled empty states.

**Tech Stack:** React 19, TypeScript, TanStack Query, existing Store Workforce APIs, shadcn-compatible primitives already used by the page, Tailwind v4 `tw:` prefix, lucide icons, Playwright, ESLint.

---

## Metadata

- Status: planned
- Date: 2026-06-26
- Owner: Store Workforce / Norm Kadro V1
- Locked prototype: `docs/prototypes/store-workforce-full-ledger-prototype.tsx`
- Prototype URL: not committed as a production/dev route; the approved React source lives in the prototype shelf.
- Locked prototype SHA-256: `DBA61AB355FC25B564612873ECAF0C7A927C9D10CAB7D5F148395BE57767CEC3`
- Prototype registry: `docs/prototypes/README.md`
- Primary production route: `/store/workforce`
- Primary production files:
  - `admin-web/src/pages/StoreWorkforcePage.tsx`
  - `admin-web/src/pages/store-workforce-region-view.tsx`
  - `admin-web/src/pages/store-workforce-region-view-model.ts`
  - `admin-web/src/pages/store-workforce-region-detail-panes.tsx`
  - `admin-web/src/pages/store-workforce-model.ts`
  - `admin-web/src/features/workforce/api.ts`
  - `admin-web/src/styles/store-workforce-command.css`
  - `admin-web/src/styles/store-workforce-command-list.css`
  - `admin-web/src/styles/store-workforce-command-modal.css`
  - `admin-web/src/features/localization/messages/store-workforce.ts`
  - `admin-web/e2e/store-surfaces.spec.ts`
  - `admin-web/e2e/store-workforce-norm-status.spec.ts`

## Review Findings Fixed In This Revision

1. The first plan let the prototype route remain after production translation. That creates an avoidable auth-bypass and mock-data risk even behind `import.meta.env.DEV`. This revision requires removing the prototype route/import before the production PR is merged, unless it is explicitly converted to a dev-only lazy path that cannot enter the production bundle.
2. The first plan searched only `admin-web/src` for tests and missed the actual workforce coverage under `admin-web/e2e`. This revision names the relevant Playwright specs.
3. The first plan allowed a "real store-navigation action" in the modal footer. The approved prototype wants a clean modal, so V1 footer is `Kapat` only.
4. The first plan did not call out N+1 request risk. This revision blocks adding extra per-row fetches for history, turnover, or shortage duration.
5. The first plan treated localization cleanup broadly. This revision requires scoping copy edits so the Store Manager surface does not regress.
6. The first plan did not protect existing Playwright selectors. This revision requires preserving stable `data-testid` hooks or updating the focused tests in the same PR when a visual element is intentionally removed.

## Locked Prototype Contract

The approved prototype is the implementation contract, not inspiration. Production must match its visible structure unless live data limitations require a documented fallback.

Required visible behavior:

- Full-width store ledger; remove the right-side "Seçili mağaza" panel from the Region Manager view.
- Header title is compact; no oversized hero treatment.
- Metrics:
  - `Toplam mağaza`
  - `Eksik kadro`
  - `Yıl geneli turnover`
  - `Ortalama kıdem`
- Toolbar:
  - Store/manager search
  - Status filter
  - Year-only filter
  - Export and refresh actions remain.
- Ledger columns:
  - `Mağaza`
  - `Aktif personel`
  - `Norm / Fiili`
  - `Durum`
  - `Eksik gün`
  - `Turnover`
  - `Aksiyon`
- Sorting:
  - Header click sorts immediately.
  - No dropdown sort menu.
- Detail modal:
  - Tabs are `Personel`, `Pozisyon`, `Geçmiş`.
  - `Özet` tab is removed.
  - Footer has only `Kapat`; no store-navigation or request-flow action in V1.
- Copy:
  - Turkish text only.
  - No internal/source/debug copy such as "Gerçek veri", "scope", "API", "DB", "yetkili mağaza", "kaynak hazır", or similar implementation explanations.
- Mobile:
  - No horizontal overflow.
  - Store rows become compact cards.
  - Modal content stays readable and footer actions remain visible.

## Current Repo Facts

- `StoreWorkforcePage` already routes Region Manager users to `RegionWorkforceView`.
- `RegionWorkforceView` already fetches organization stores, store employees, and headcount gaps per store.
- Current Region Manager surface still uses a two-column grid with a selected-store side panel.
- `shortageDays` and `turnover` currently default to `null`; there is no confirmed live turnover source in this route.
- Current detail panes are `Personel`, `Pozisyon`, and a request placeholder; the locked prototype needs `Geçmiş`.
- Current localization contains old/internal copy that should not survive the Region Manager surface.
- Focused workforce e2e coverage already exists in `admin-web/e2e/store-surfaces.spec.ts` and `admin-web/e2e/store-workforce-norm-status.spec.ts`.
- Store Manager workforce behavior is a separate surface and must not be redesigned in this PR.

## Out Of Scope

- Adding the parked `Personel gider %` column.
- Creating or importing personnel cost data.
- Creating a new turnover data pipeline.
- Creating fake exit-history data.
- Changing role/scope rules.
- Changing Store Manager `/store/workforce` behavior.
- Reworking global Store shell/sidebar.
- Changing database schema unless a required live-history source is already present but not exposed.

## Data Rules

- `Toplam mağaza` comes from the Region Manager scoped store list.
- `Eksik kadro` comes from current norm/headcount gap calculation.
- `Ortalama kıdem` comes from active scoped personnel assignment dates.
- `Yıl geneli turnover` renders a real value only if a trusted source exists. If not, show `Veri yok` without blocking the page.
- `Eksik gün` renders a real shortage duration only if the existing headcount gap model or related source can prove the shortage start date. If not, show `Yok`.
- `Geçmiş` tab must not fabricate resignations or transfers. If no history source exists, show a clean empty state and keep active personnel/position tabs useful.
- All store types use the same Norm Kadro surface for this V1 unless existing permissions already hide a store from the Region Manager.
- Do not add new per-store requests for turnover, history, or shortage duration. Use data already loaded by the route, or leave the value empty for V1.

## Implementation Tasks

### 1. Preflight and Contract Evidence

- [ ] Verify working tree and avoid touching unrelated changes.
- [ ] Recompute prototype hash and compare with `docs/prototypes/README.md`.
- [ ] Capture desktop and mobile screenshots of the locked prototype for visual comparison.
- [ ] Read the current production Region Manager `/store/workforce` files listed above before editing.
- [ ] Confirm available tests with `rg "StoreWorkforce|store-workforce|workforce" admin-web/src admin-web/e2e admin-web/scripts -g "*.test.*" -g "*.spec.*" -g "*.mjs"`.
- [ ] Confirm the production PR will remove or safely isolate the temporary prototype route from `admin-web/src/App.tsx`.

Commands:

```powershell
git status --short
Get-FileHash docs/prototypes/store-workforce-full-ledger-prototype.tsx -Algorithm SHA256
rg "StoreWorkforce|store-workforce|workforce" admin-web/src -g "*.test.*" -g "*.spec.*"
rg "StoreWorkforce|store-workforce|workforce" admin-web/e2e -g "*.spec.*"
```

### 2. Region View-Model Alignment

- [ ] Update `admin-web/src/pages/store-workforce-region-view-model.ts` so production exposes the same row concepts as the locked prototype.
- [ ] Replace dropdown sort intent with one-click sortable headers.
- [ ] Keep stable deterministic sorting for equal values: fall back to store name, then store id.
- [ ] Normalize status to only user-facing concepts: `Eksik`, `Tam`, `Fazla`, `Tanımsız`.
- [ ] Ensure long store names remain single-line on desktop without overlapping score/value columns; truncate with accessible title only where needed.
- [ ] Keep `turnover` nullable and never fake it.
- [ ] Keep `shortageDays` nullable and never fake it.
- [ ] Add a `history` detail tab key and remove `summary` from Region Manager tab state.
- [ ] Preserve existing stable test hooks such as `store-workforce-page`, `store-workforce-region-row`, `store-workforce-region-rows`, and `store-workforce-region-detail-dialog` unless the matching e2e test is intentionally updated in the same PR.

Acceptance:

- Header click changes order immediately.
- No dropdown menu opens for column sorting.
- Store names do not overlap other columns at desktop widths.
- Unknown live data renders as controlled copy, not source/debug copy.

### 3. Full-Width Region Markup

- [ ] Update `admin-web/src/pages/store-workforce-region-view.tsx` to match the locked prototype layout.
- [ ] Remove the right-side selected-store card from the Region Manager route.
- [ ] Expand the ledger to the available content width.
- [ ] Keep export and refresh actions.
- [ ] Replace the current year/month control with a year-only control matching the prototype behavior.
- [ ] Keep search and status filter.
- [ ] Render metric icons centered and visually aligned.
- [ ] Preserve loading, error, empty, and partial-data states.
- [ ] Do not introduce new per-row network calls; the list must render from the existing scoped store, employee, and gap queries.

Acceptance:

- The production page no longer has the `Seçili mağaza` side panel.
- The ledger fits the page width without action-column clipping.
- Metric icons are centered.
- Store Manager route remains unchanged.

### 4. Detail Modal and Tabs

- [ ] Update `admin-web/src/pages/store-workforce-region-detail-panes.tsx`.
- [ ] Keep `Personel` pane with active employee list, position, code, tenure, and start date.
- [ ] Keep `Pozisyon` pane with role totals and norm/actual comparison when available.
- [ ] Replace the request placeholder with `Geçmiş`.
- [ ] In `Geçmiş`, show real assignment/history movement data only if available from existing API data.
- [ ] If no history source exists, show a short Turkish empty state; do not mention API/source gaps.
- [ ] Remove any non-useful "Talep akışına git" action from the modal.
- [ ] Use `Kapat` as the only V1 modal footer action.
- [ ] Keep the modal footer visible and usable on mobile.

Acceptance:

- Tabs are exactly `Personel`, `Pozisyon`, `Geçmiş`.
- Selected tab does not become visually blank/white.
- Modal does not overflow beyond viewport without internal scroll.
- Close action is visible.

### 5. CSS Parity and Responsive Layout

- [ ] Update `store-workforce-command.css`, `store-workforce-command-list.css`, and `store-workforce-command-modal.css` against the locked prototype.
- [ ] Replace the old two-column content grid with a full-width ledger layout for Region Manager.
- [ ] Reduce title, row, and table font weight to the approved prototype level.
- [ ] Align table headers to row cell centers.
- [ ] Keep columns spaced enough that `Aksiyon` is not clipped.
- [ ] Ensure desktop ledger can display all columns without unwanted horizontal overflow inside normal Store shell width.
- [ ] Add mobile card layout matching the prototype: compact, readable, no sideways scroll.
- [ ] Keep class changes scoped to workforce surfaces.

Acceptance:

- At 1440px and 1280px desktop widths, all columns are visible and aligned.
- At 390px mobile width, no horizontal overflow.
- Header title is compact.
- Rows match prototype density and visual balance.

### 6. Turkish Copy Cleanup

- [ ] Update `admin-web/src/features/localization/messages/store-workforce.ts`.
- [ ] Remove internal copy from Region Manager visible text.
- [ ] Fix Turkish characters: `Mağaza`, `Kıdem`, `Tanımsız`, `Pozisyon`, `Geçmiş`, `Eksik`, `Fazla`.
- [ ] Replace source/debug explanations with decision-oriented labels.
- [ ] Keep empty states concise.
- [ ] Scope copy changes to Region Manager workforce keys where possible; if shared keys change, verify Store Manager copy still matches the current workflow.

Acceptance:

- No user-facing Region Manager copy includes implementation/source/debug language.
- All visible Turkish strings render with correct characters.

### 7. Prototype Route Cleanup

- [ ] Keep the dev-only prototype route while implementing and verifying parity.
- [ ] Before opening the production PR, remove the temporary `StoreWorkforceFullLedgerPrototypeShell` import and `/store/workforce?prototype=full-ledger` bypass from `admin-web/src/App.tsx`, unless the user explicitly asks to keep a dev-only reference route.
- [ ] If the route is kept by explicit request, it must be lazy-loaded, guarded by `import.meta.env.DEV`, and absent from production verification screenshots.
- [ ] Do not ship prototype-only mock data into production route.

Acceptance:

- `/store/workforce` uses live data.
- No auth bypass or mock prototype path is reachable in staging/production.

### 8. Verification

- [ ] Run lint.
- [ ] Run build.
- [ ] Run focused Playwright screenshots for:
  - Region Manager `/store/workforce` desktop.
  - Region Manager `/store/workforce` mobile.
  - Detail modal tabs.
- [ ] Check for horizontal overflow in desktop and mobile.
- [ ] Confirm Store Manager `/store/workforce` still renders.
- [ ] Update focused e2e expectations that currently assume the old selected-store side panel, and assert the new full-width ledger/modal behavior instead.
- [ ] If e2e coverage exists for store surfaces, run the relevant spec.
- [ ] Run `git diff --check`.

Commands:

```powershell
npm.cmd --prefix admin-web run lint
npm.cmd --prefix admin-web run build
npm.cmd --prefix admin-web run test:e2e -- e2e/store-workforce-norm-status.spec.ts e2e/store-surfaces.spec.ts
git diff --check
```

If `store-surfaces.spec.ts` is absent or not relevant, replace it with the discovered focused Playwright spec and record the reason in the PR notes.

## Failure Paths To Check

- A Region Manager with zero scoped stores.
- Stores with active employees but no norm definition.
- Stores with norm definition but no active employees.
- Stores with long names and long manager names.
- Stores with no manager.
- Stores with unknown turnover.
- Stores with unknown shortage start date.
- Detail modal opened on mobile.
- Back/refresh after sorting and filtering.

## PR Scope

Recommended PR: one focused UI translation PR.

Do not combine with:

- Personnel cost data.
- Turnover import.
- Workforce schema changes.
- Clerk/persona changes.
- KPI/rankings fixes.
- Checklist redesign.

## Closeout Evidence

Final PR notes must include:

- Prototype hash used.
- Files changed.
- Screenshots or paths for desktop/mobile verification.
- Commands run and results.
- Known data-source limitations, especially turnover/history if still unavailable.
- Explicit statement that Store Manager behavior was checked or untouched.
