# UI/UX V1 Route Inventory

## Purpose

Record the UI/UX Pro Max + Sokrates route inventory before changing any
visible screen. This is a repo-evidence pass over the current route/page/test
structure. It does not claim live visual QA, and it does not change business
logic, API shape, auth, permissions, DB state, data calculation, or CSS.

## Sokrates Decision

Claim:

- The next product-readiness work should improve only pages with a clear V1
  gap, rather than repainting routes that already have enough visible clarity.

Assumptions:

- Route code, localization copy, page state handling, and existing Playwright
  coverage are enough to choose the next safe slice.
- Browser screenshots should be used for implementation slices, but not every
  route needs a visual rewrite.
- The current HR Axis / Store Ops design language should stay quiet,
  operational, dense, and readable.

Evidence:

- `admin-web/src/app/admin-shell.tsx` and `admin-web/src/app/store-shell.tsx`
  expose the current route map.
- `admin-web/src/app/route-preloaders.ts` covers the same route families for
  preloading.
- Existing Playwright specs cover core store routes, admin routing, inbox,
  targets, integrations, auth admin surfaces, feed, checklists, competitions,
  KPI config, and pilot smoke.
- Recent product-readiness PRs already improved `/store/home` manager copy and
  `/admin/master-data` store labels.

Counterargument:

- A repo-only inventory can miss actual overlap, cramped mobile spacing, and
  focus-order friction. That is true, so implementation PRs must still include
  targeted Playwright plus browser checks for desktop and mobile viewports.

Risk:

- LOW for this inventory.
- MEDIUM for later UI/UX slices because they change user-visible screens.

Door:

- Two-way door. This evidence can be corrected or superseded if browser review
  or pilot feedback contradicts it.

Decision:

- Do not broad redesign.
- Do not reopen store home or admin master data unless a concrete gap appears.
- Start implementation with the smallest low-risk store utility/handoff surface
  family, then move to reports/admin/auth surfaces by evidence.

Verification ladder for this inventory:

1. `git status --short`
2. Route/page/test grep.
3. Admin lint/build.
4. A route-level smoke or targeted Playwright run when a code slice begins.

## Rubric

Score is 1-5:

- 5: V1-ready; clear purpose, primary action, state handling, localization,
  accessibility/focus, responsive shape, and targeted test signal.
- 4: Mostly V1; minor coverage or mobile evidence gap.
- 3: Usable but needs a small V1 slice.
- 2: Skeleton/placeholder or weak first-screen/action clarity.
- 1: Not ready or requires product/API/backend scope before UI work.

## Admin Route Inventory

| Route | Page/component | Existing test signal | V1 score | Main gap | Action |
| --- | --- | --- | ---: | --- | --- |
| `/admin/session` | `SessionGate` / `SessionReadinessPage` | `admin-routing`, `admin-inbox`, `store-return-to` | 4 | Dev/auth mode page is intentionally technical. | Park unless auth evidence work reopens it. |
| `/admin/integrations` | `IntegrationDashboardPage.tsx` | `integration-surfaces`, `admin-routing`, `pilot-smoke` | 3.5 | High-value operator screen; large page, dense upload/evidence/errors tabs, limited mobile evidence. | Candidate after utility slices; keep view/copy only. |
| `/admin/integrations/:batchId` | `ImportBatchDetailPage.tsx` | `integration-surfaces` | 3.9 | Mapping controls and page-scoped panel-copy readability improved; remaining risk is page size and evidence density. | Park broad redesign; reopen only for a concrete browser or pilot gap. |
| `/admin/master-data` | `MasterDataBootstrapPage.tsx` | `admin-routing`, `integration-surfaces`, recent label PR | 4.1 | Large page, but just improved and has state coverage. | Park unless browser pass finds a concrete gap. |
| `/admin/master-data/:batchId` | `MasterDataBootstrapPage.tsx` | Same as master-data | 4 | Deep-link route depends on selected batch readability. | Park. |
| `/admin/snapshots` | `SnapshotsDashboardPage.tsx` | `admin-routing` | 3.8 | Operational clarity exists; no recent mobile/browser evidence. | Candidate later if snapshot operator flow becomes priority. |
| `/admin/snapshots/:snapshotRunId` | `SnapshotRunDetailPage.tsx` | `admin-routing` | 3.8 | Detail readability likely ok, but limited targeted UX tests. | Park. |
| `/admin/inbox` | `AdminInboxPage.tsx` | `admin-inbox` | 4 | Queue/action states covered; no broad gap. | Park. |
| `/admin/feed` | `AdminFeedPage.tsx` | `feed-surfaces` | 4 | Composer and retry states covered; placeholder input is deliberate link-url example. | Park. |
| `/admin/checklists` | `AdminChecklistTemplatesPage.tsx` | `admin-routing` | 3.8 | Template editor is important; behavior risk if changed casually. | Park until concrete admin checklist issue. |
| `/admin/competitions` | `CompetitionDashboardPage.tsx` + `StageBuilderForm` | `competition-surfaces` | 3.7 | Deep workflow and large form; high review cost. | Candidate only as a small form clarity/refactor-adjacent slice. |
| `/admin/reports` | `ReportsSummaryPage.tsx` | Indirect API/report coverage; pilot does not list admin reports route | 3.6 | Good structure, but route-level Playwright coverage and mobile proof are thin. | Candidate after store utility slice. |
| `/admin/reports/snapshot-runs` | `ReportsSnapshotRunsPage.tsx` | Limited direct route coverage | 3.5 | Sort/export/read paths exist; route smoke assertions thin. | Batch with reports summary only if one review story. |
| `/admin/reports/workforce/:snapshotRunId` | `ReportsWorkforcePage.tsx` | Limited direct route coverage | 3.4 | Dense row cards; needs targeted route assertions before visual polish. | Candidate as reports detail batch. |
| `/admin/reports/kpis/:snapshotRunId` | `ReportsKpisPage.tsx` | Limited direct route coverage | 3.4 | Dense KPI rows; export/search controls need browser proof. | Candidate as reports detail batch. |
| `/admin/reports/checklists/:snapshotRunId` | `ReportsChecklistsPage.tsx` | Limited direct route coverage | 3.4 | Dense checklist rows; needs mobile/browser proof. | Candidate as reports detail batch. |
| `/admin/reports/turnover/:snapshotRunId` | `ReportsTurnoverPage.tsx` | Limited direct route coverage | 3.4 | Dense turnover rows; needs mobile/browser proof. | Candidate as reports detail batch. |
| `/admin/targets` | `TargetApprovalQueuePage.tsx` | `admin-targets`, `admin-routing` | 4 | Coverage and error/empty states exist. | Park. |
| `/admin/kpi-config` | `AdminKpiConfigPage.tsx` | `admin-kpi-config`, `kpi-config-versioning` | 3.8 | Large governance form; behavior risk if touched broadly. | Park unless a form feedback gap is isolated. |
| `/admin/auth` | `AuthDashboardPage.tsx` | `auth-admin-surfaces`, `pilot-smoke` | 3.7 | Auth/permission domain is high-risk; UI seems usable but must stay narrow. | Candidate only for read-only clarity/coverage. |
| `/admin/auth/catalog` | `AuthCatalogPage.tsx` | `auth-admin-surfaces` | 3.8 | Catalog has state/search; high-risk domain but read-only. | Candidate later if auth admin surface line begins. |
| `/admin/auth/users/:userId/audit` | `AuthUserAuditPage.tsx` | `admin-routing`, `pilot-smoke` | 3.7 | Detail route is readable but coverage focuses routing/localization. | Candidate with audit detail trio. |
| `/admin/auth/role-assignments/:assignmentId/audit` | `AuthAssignmentAuditPage.tsx` | `admin-routing`, `pilot-smoke` | 3.7 | Same as audit detail. | Candidate with audit detail trio. |
| `/admin/auth/action-store-assignments/:assignmentId/audit` | `AuthActionStoreAssignmentAuditPage.tsx` | `admin-routing`, `pilot-smoke` | 3.7 | Same as audit detail. | Candidate with audit detail trio. |
| `/admin/audit` | `AuditCenterPage.tsx` | `admin-routing`, `pilot-smoke` | 4 | Audit namespace links are covered. | Park. |
| `/admin/audit/*/audit` | Auth audit detail pages | `admin-routing` | 3.7 | Same components as auth detail routes; routing namespace covered. | Candidate only with detail trio. |

## Store Route Inventory

| Route | Page/component | Existing test signal | V1 score | Main gap | Action |
| --- | --- | --- | ---: | --- | --- |
| `/store`, `/store/home` | `StoreHomePage.tsx` | `store-surfaces`, recent manager-copy PR | 4.4 | Recently improved; no clear new gap. | Park. |
| `/store/checklists` | `StoreChecklistsPage.tsx` + split panels | `checklist-today-surfaces`, `store-surfaces` | 4.4 | Strong behavior/state/mobile coverage after refactor line. | Park. |
| `/store/tasks` | `StoreTasksPage.tsx` | `store-surfaces`, checklist workflow tests | 4 | Queue, retry, localization, deep-link behavior covered. | Park. |
| `/store/kpis` | `StoreKpiHighlightsPage.tsx` | `store-surfaces`, `pilot-smoke`, `pilot-api-contracts` | 3.9 | Strong semantics; large page and limited mobile proof. | Candidate later if KPI surface review is requested. |
| `/store/me` | `StoreMyPerformancePage.tsx` | `store-surfaces`, `pilot-api-contracts` | 4 | Strong behavior coverage; do not reopen without concrete issue. | Park. |
| `/store/personnel/:employeeId` | `StorePersonnelPerformancePage.tsx` | `store-surfaces` | 3.8 | Detail route coverage exists via rankings flow, not as first-class V1 audit. | Candidate later. |
| `/store/rankings` | `StoreRankingsPage.tsx` | `store-surfaces`, `pilot-api-contracts` | 4.1 | Strong trust/copy work; mobile evidence not first priority. | Park. |
| `/store/feed` | `StoreFeedPage.tsx` | `feed-surfaces`, `api-diagnostics`, `store-surfaces` | 4 | Loading/error/empty and locale covered. | Park. |
| `/store/competitions` | `StoreCompetitionsPage.tsx` | `store-surfaces` | 3.9 | Store read-only competition view covered; no immediate gap. | Park. |
| `/store/approvals` | `StoreApprovalsPage.tsx` + split forms | `store-surfaces`, recent refactor/fix PRs | 4 | Recent follow-up line improved structure and errors. | Park. |
| `/store/incentives` | `StoreIncentivesPage.tsx` | `store-surfaces` | 3.2 | Intentionally foundation/intake-like; no real incentive domain yet. | Park as product expansion intake, not UI polish. |
| `/store/settings` | `StoreSettingsPage.tsx` | Route transition coverage only | 3.1 | Tiny page, clear language control, but weak first-class settings evidence. | Candidate in store utility batch. |
| `/store/targets` | `StoreTargetsPage.tsx` | Sidebar/route visibility only | 2.8 | Handoff route links to admin target flow; needs clearer boundary and route test. | Candidate in store utility batch. |
| `/store/reports` | `StoreReportsPage.tsx` | Sidebar/route visibility only | 2.8 | Handoff route links to admin report flow; needs clearer boundary and route test. | Candidate in store utility batch. |

## Auth Flow Inventory

| Route | Page/component | Existing test signal | V1 score | Main gap | Action |
| --- | --- | --- | ---: | --- | --- |
| `/auth/login` | `AuthLoginPage.tsx` | `store-return-to` | 4 | Return-to and locale behavior covered. | Park. |
| `/auth/callback` | `AuthCallbackPage.tsx` | `store-return-to` | 4 | Placeholder-token language is explicit; provider evidence is external. | Park. |
| `/auth/logout` | `AuthLogoutPage.tsx` | `store-return-to` | 4 | Logout/locale covered. | Park. |

## Priority Order

1. Store utility/handoff surfaces (completed by
   `docs/evidence/product-progress/2026-05-20-store-utility-handoff-v1.md`):
   `/store/settings`, `/store/targets`, `/store/reports`.
   Reason: small files, low blast radius, visible route gaps, easy targeted
   Playwright assertions, and no data/API/auth behavior needed.
2. Admin reports route coverage and minor clarity:
   `/admin/reports` plus `/admin/reports/snapshot-runs` have link-context
   evidence at
   `docs/evidence/product-progress/2026-05-20-admin-reports-link-context-v1.md`.
   Continue into detail pages only if browser review finds a concrete gap.
3. Admin import detail (mapping context completed by
   `docs/evidence/product-progress/2026-05-20-import-detail-mapping-context-v1.md`
   and panel readability completed by
   `docs/evidence/product-progress/2026-05-20-import-detail-panel-readability-v1.md`):
   `/admin/integrations/:batchId` now has external-ID context on repeated
   mapping controls and page-scoped light-panel copy contrast. Continue only
   if a separate browser pass isolates a new concrete issue.
4. Auth catalog/audit read-only surfaces:
   only if the slice is purely presentation/coverage; auth behavior stays
   untouched.
5. Large workflow/form surfaces:
   competitions, KPI config, admin checklist templates only after a concrete
   pilot or browser gap.

## First Implementation Slice

Decision:

- Start with a store utility/handoff V1 slice covering `/store/settings`,
  `/store/targets`, and `/store/reports`.

Why this slice:

- It is one coherent review story: store shell utility/handoff pages.
- Files are tiny and isolated.
- The current pages already have structure, so improvement can stay copy/layout
  clarity plus route assertions.
- It avoids auth/API/DB/data-calculation risk.

Guardrails:

- Do not change route access, links, API calls, or role logic.
- Do not create a new design system.
- Keep CSS scoped to existing store command classes if CSS is needed.
- Do not pretend store targets/reports have their own domain contracts yet.

Verification ladder:

1. `npm.cmd --prefix admin-web run lint`
2. `npm.cmd --prefix admin-web run build`
3. Targeted Playwright for store utility routes and sidebar transition.
4. Desktop and mobile browser/screenshot check if local dev server is running
   for the implementation slice.

Stop rules:

- Stop if improving `/store/targets` or `/store/reports` requires changing the
  admin route permissions or adding backend/API behavior.
- Stop if the slice becomes a broad store shell redesign.
- Stop if the utility pages cannot be verified without widening fixtures.
