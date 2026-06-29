# Admin Pages Operational Prototype Parity Train V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the active HR Axis `/admin/*` product pages as clean operational work surfaces by creating a production-runtime React prototype for each page, then moving that prototype into the live route with visual, copy, density, and interaction parity. The agent runs the train autonomously: one page finishes, PR merges, `main` is pulled, and the next page starts without waiting for user approval.

**Architecture:** Page-by-page prototype-to-production loop. Each page PR starts with route/workflow evidence, creates a React prototype contract inside the app runtime, implements the live page from that contract, captures desktop/mobile parity evidence, and preserves all API, role, permission, DB, workflow, import, snapshot, scoring, and approval behavior. Existing AdminShell/navigation remains intact.

**Tech Stack:** React, TypeScript, Vite admin web app, existing `admin-web/src/components/ui` shadcn/ui components, Tailwind v4 `tw:` utilities, lucide icons only where useful, existing Admin surface primitives when they preserve the accepted prototype, Playwright/browser screenshot checks, GitHub PR train.

---

## Operating Decision

Admin pages are not dashboards. They are operational work surfaces for fast decisions, safe actions, and clean record management.

Required product stance:

- Main body is a table, queue, list, form, or workbench. Summary cards are optional and must be decision-relevant.
- Detail, evidence, edit, and approval context lives in `Sheet`/drawer. Confirmation uses `Dialog`/`AlertDialog`.
- One primary action per page area. Secondary actions are quiet and predictable.
- Product copy is short Turkish copy. Internal words such as `API`, `DB`, `scope`, `mock`, `provider`, `route`, `contract`, `gercek veri`, `guvenli veri kaynagi`, `kayit temsil eder`, and debug/release copy are not allowed on product screens.
- Role/action visibility must match the current authorization behavior.
- Empty, loading, access denied, and error states are designed states, not afterthoughts.
- Mobile is not a compressed desktop table. Mobile uses card/list rhythm and drawers without horizontal overflow.
- A prototype is not inspiration. Once a page prototype is selected by this train, it is the implementation contract.

## Source Documents To Read Before Execution

- `current-state.md`
- `discipline.md`
- `sokrates.md`
- `contributing.md`
- `docs/process/product-experience-principles.md`
- `docs/process/ui-surface-standard-v1.md`
- `docs/process/store-admin-surface-standardization-v1.md`
- `docs/plans/admin-ui-modernization-v1-inventory.md`
- `docs/plans/admin-operational-ux-v2-audit-matrix.md`
- `.agents/skills/hr-axis-ui-refactor/SKILL.md`

## Route Inventory

Primary admin navigation routes:

| Order | Route | Main page file | Current role visibility |
| --- | --- | --- | --- |
| 1 | `/admin/operations` | `admin-web/src/pages/OperationsControlTowerPage.tsx` | `SUPER_ADMIN` |
| 2 | `/admin/inbox` | `admin-web/src/pages/AdminInboxPage.tsx` | `SUPER_ADMIN`, `REPORT_VIEWER`, `HR_ADMIN` |
| 3 | `/admin/data-quality` | `admin-web/src/pages/AdminDataQualityCenterPage.tsx` | `SUPER_ADMIN` |
| 4 | `/admin/integrations` | integration route files under `admin-web/src/pages` and related features | `SUPER_ADMIN`, `INTEGRATION_ADMIN` |
| 5 | `/admin/master-data` | `admin-web/src/pages/MasterDataBootstrapPage.tsx` | `SUPER_ADMIN`, `HR_ADMIN`, `INTEGRATION_ADMIN` |
| 6 | `/admin/snapshots` | `admin-web/src/pages/SnapshotsDashboardPage.tsx` | `SUPER_ADMIN`, `SNAPSHOT_OPERATOR` |
| 7 | `/admin/snapshots/:snapshotRunId` | `admin-web/src/pages/SnapshotRunDetailPage.tsx` | `SUPER_ADMIN`, `SNAPSHOT_OPERATOR` |
| 8 | `/admin/reports` | `admin-web/src/pages/ReportsSummaryPage.tsx` | `SUPER_ADMIN`, `REPORT_VIEWER` |
| 9 | `/admin/reports/snapshot-runs` | `admin-web/src/pages/ReportsSnapshotRunsPage.tsx` | `SUPER_ADMIN`, `REPORT_VIEWER` |
| 10 | `/admin/reports/kpis/:snapshotRunId` | `admin-web/src/pages/ReportsKpisPage.tsx` | `SUPER_ADMIN`, `REPORT_VIEWER` |
| 11 | `/admin/reports/checklists/:snapshotRunId` | `admin-web/src/pages/ReportsChecklistsPage.tsx` | `SUPER_ADMIN`, `REPORT_VIEWER` |
| 12 | `/admin/reports/workforce/:snapshotRunId` | `admin-web/src/pages/ReportsWorkforcePage.tsx` | `SUPER_ADMIN`, `REPORT_VIEWER` |
| 13 | `/admin/reports/turnover/:snapshotRunId` | `admin-web/src/pages/ReportsTurnoverPage.tsx` | `SUPER_ADMIN`, `REPORT_VIEWER` |
| 14 | `/admin/targets` | `admin-web/src/pages/TargetApprovalQueuePage.tsx` | `SUPER_ADMIN`, `REPORT_VIEWER`, `REGION_MANAGER` |
| 15 | `/admin/incentives` | `admin-web/src/pages/AdminIncentivesPage.tsx` | `SUPER_ADMIN` |
| 16 | `/admin/kpi-config` | `admin-web/src/pages/AdminKpiConfigPage.tsx` | `SUPER_ADMIN` |
| 17 | `/admin/checklists` | `admin-web/src/pages/AdminChecklistTemplatesPage.tsx`, `admin-web/src/pages/AdminChecklistTemplateSurface.tsx` | `SUPER_ADMIN`, `HR_ADMIN` |
| 18 | `/admin/competitions` | `admin-web/src/pages/CompetitionDashboardPage.tsx` | `SUPER_ADMIN`, `HR_ADMIN`, `REPORT_VIEWER`, `REGION_MANAGER` |
| 19 | `/admin/auth` | `admin-web/src/pages/AuthDashboardPage.tsx` and auth audit/detail pages | `SUPER_ADMIN` |
| 20 | `/admin/audit` | `admin-web/src/pages/AuditCenterPage.tsx` and audit detail pages | `SUPER_ADMIN`, `AUDITOR` |
| 21 | `/admin/pilot-feedback` | `admin-web/src/pages/AdminPilotFeedbackPage.tsx` | `SUPER_ADMIN` |
| 22 | `/admin/feed` | `admin-web/src/pages/AdminFeedPage.tsx` | `SUPER_ADMIN`, `HR_ADMIN`, `REGION_MANAGER` |
| 23 | `/admin/session` | `admin-web/src/pages/SessionReadinessPage.tsx` | unguarded diagnostic route |

Parked-route rule:

- `/admin/feed` was previously parked because composer/write workflow needs a dedicated behavior contract. This train may reopen it only as its own PR with feed publish/pin/archive behavior frozen by tests.
- `/admin/session` stays diagnostic unless the user explicitly asks to turn it into a product admin settings surface.

## PR Train

### PR 0: Plan And Baseline Evidence

- [x] Add this plan.
- [x] Confirm admin route inventory against `admin-web/src/app/admin-navigation.ts` and `docs/plans/admin-ui-modernization-v1-inventory.md`.
- [x] Create `docs/evidence/admin-pages-operational-prototype-parity-v1/route-baseline.md` before runtime work begins.
- [x] Record parked-route decisions for `/admin/feed` and `/admin/session`.
- [x] Verification: `git diff --check`.

### PR 1: Operations, Inbox, Data Quality

Routes:

- `/admin/operations`
- `/admin/inbox`
- `/admin/data-quality`

Reason:

- These are queue/control surfaces and define the new admin operational rhythm.

Tasks:

- [ ] Read current component files, API hooks, tests, and route copy for the three routes.
- [ ] Create page-level component maps covering header, filters, primary work area, drawer/detail, state panels, and actions.
- [ ] Build production-runtime React prototype slices under `admin-web/src/prototypes/admin/`.
- [ ] Implement live pages from the accepted prototype slices.
- [ ] Keep operation/inbox/data-quality behavior unchanged.
- [ ] Remove old dashboard-like visual remnants, oversized headings, decorative cards, and internal copy.
- [ ] Add evidence screenshots for desktop and mobile.
- [ ] Run `npm.cmd --prefix admin-web run lint`.
- [ ] Run `npm.cmd --prefix admin-web run build`.
- [ ] Run existing targeted specs for operations, inbox, and data-quality if present.
- [ ] Open PR, address review/check failures, merge, pull `main`.

### PR 2: Integrations And Master Data

Routes:

- `/admin/integrations`
- `/admin/integrations/:batchId`
- `/admin/master-data`
- `/admin/master-data/:batchId`

Tasks:

- [ ] Freeze current import/upload/retry/mapping/promotion workflow behavior.
- [ ] Build prototype contracts for import batch queue, batch detail, validation results, promotion readiness, failed-row evidence, and retry eligibility.
- [ ] Implement pages as operational batch work surfaces, not dashboard summaries.
- [ ] Make batch detail evidence readable without exposing internal debug copy.
- [ ] Preserve CSRF, upload, retry, validation, promotion, and mapping behavior.
- [ ] Run `npm.cmd --prefix admin-web run lint`.
- [ ] Run `npm.cmd --prefix admin-web run build`.
- [ ] Run `npm.cmd run test:scripts`.
- [ ] Run existing integration/master-data e2e specs if present.
- [ ] Open PR, address review/check failures, merge, pull `main`.

### PR 3: Snapshots And Admin Reports

Routes:

- `/admin/snapshots`
- `/admin/snapshots/:snapshotRunId`
- `/admin/reports`
- `/admin/reports/snapshot-runs`
- `/admin/reports/kpis/:snapshotRunId`
- `/admin/reports/checklists/:snapshotRunId`
- `/admin/reports/workforce/:snapshotRunId`
- `/admin/reports/turnover/:snapshotRunId`

Tasks:

- [ ] Freeze snapshot run, rerun, dependency, lineage, report selection, and report table behavior.
- [ ] Prototype a compact snapshot status spine, run queue, dependency evidence, and report workbench.
- [ ] Implement live pages with dense readable tables and detail evidence sections.
- [ ] Preserve snapshot semantic golden output and report calculations.
- [ ] Run `npm.cmd --prefix admin-web run lint`.
- [ ] Run `npm.cmd --prefix admin-web run build`.
- [ ] Run snapshot/report targeted specs if present.
- [ ] Run `npm.cmd run test:scripts`.
- [ ] Open PR, address review/check failures, merge, pull `main`.

### PR 4: Targets And Incentives

Routes:

- `/admin/targets`
- `/admin/incentives`

Tasks:

- [ ] Freeze target approval, coverage, note, allocation, package, incentive approval/return, and period filter behavior.
- [ ] Prototype target approval queue and incentive package review as calm operational approval workbenches.
- [ ] Use drawer/detail for request/package evidence and keep confirmation dialogs short.
- [ ] Preserve role visibility for `REGION_MANAGER`, `REPORT_VIEWER`, and `SUPER_ADMIN`.
- [ ] Preserve incentive ledger/admin-approval separation.
- [ ] Run `npm.cmd --prefix admin-web run lint`.
- [ ] Run `npm.cmd --prefix admin-web run build`.
- [ ] Run target and incentive targeted specs if present.
- [ ] Open PR, address review/check failures, merge, pull `main`.

### PR 5: KPI Config, Checklist Templates, Competitions

Routes:

- `/admin/kpi-config`
- `/admin/checklists`
- `/admin/competitions`

Tasks:

- [ ] Freeze KPI versioning, validation, publish, checklist template authoring, checklist section/item behavior, competition lifecycle, stage/team/package behavior, and scoring semantics.
- [ ] Prototype each builder as a workbench with a compact status header, validation summary, main editor/list, and evidence drawer.
- [ ] Keep builder forms readable without hiding critical validation or publish readiness.
- [ ] Preserve all authoring payloads and mutation behavior.
- [ ] Run `npm.cmd --prefix admin-web run lint`.
- [ ] Run `npm.cmd --prefix admin-web run build`.
- [ ] Run KPI config, checklist template, and competition targeted specs if present.
- [ ] Open PR, address review/check failures, merge, pull `main`.

### PR 6: Auth, Audit, Pilot Feedback

Routes:

- `/admin/auth`
- `/admin/auth/catalog`
- `/admin/auth/users/:userId/audit`
- `/admin/auth/role-assignments/:assignmentId/audit`
- `/admin/auth/action-store-assignments/:assignmentId/audit`
- `/admin/audit`
- `/admin/audit/users/:userId/audit`
- `/admin/audit/role-assignments/:assignmentId/audit`
- `/admin/audit/action-store-assignments/:assignmentId/audit`
- `/admin/pilot-feedback`

Tasks:

- [ ] Freeze auth assignment, role/scope/action-store, audit detail, and pilot feedback classification behavior.
- [ ] Prototype security/admin queues with clear evidence, compact forms, and safe mutation affordances.
- [ ] Keep audit traceability visible without showing raw UUIDs where names are available.
- [ ] Preserve security permission semantics and audit route params.
- [ ] Run `npm.cmd --prefix admin-web run lint`.
- [ ] Run `npm.cmd --prefix admin-web run build`.
- [ ] Run auth, audit, pilot feedback, and pilot smoke specs if present.
- [ ] Open PR, address review/check failures, merge, pull `main`.

### PR 7: Admin Feed Reopen Or Park Decision

Route:

- `/admin/feed`

Tasks:

- [ ] Decide from current product behavior whether admin feed should be modernized now or remain parked.
- [ ] If modernized, freeze publish, pin, unpin, archive, visibility, query invalidation, and store-feed visibility behavior before UI work.
- [ ] Prototype composer and post list as a clean operational communication surface.
- [ ] Implement only if behavior coverage exists.
- [ ] Run `npm.cmd --prefix admin-web run lint`.
- [ ] Run `npm.cmd --prefix admin-web run build`.
- [ ] Run `feed-surfaces.spec.ts` or equivalent feed workflow specs.
- [ ] Open PR, address review/check failures, merge, pull `main`.

### PR 8: Session Readiness Recheck

Route:

- `/admin/session`

Tasks:

- [ ] Decide whether `/admin/session` remains a diagnostic route or becomes a product settings/readiness surface.
- [ ] If diagnostic, leave parked and only update evidence.
- [ ] If productized, remove diagnostic/mock/header/bearer copy and build a production admin readiness page with behavior coverage.
- [ ] Run `npm.cmd --prefix admin-web run lint`.
- [ ] Run `npm.cmd --prefix admin-web run build`.
- [ ] Run `admin-routing.spec.ts` and auth/session targeted specs if present.
- [ ] Open PR only if runtime or evidence changed, address failures, merge, pull `main`.

### PR 9: Final Consistency And Closeout

Tasks:

- [ ] Review all active `/admin/*` pages for typography, density, button style, filters, drawer behavior, empty/error/loading/access states, and mobile overflow.
- [ ] Remove unused prototype files only if they are not needed as locked parity references.
- [ ] Update route inventory/evidence with final status.
- [ ] Run `git diff --check`.
- [ ] Run `npm.cmd --prefix admin-web run lint`.
- [ ] Run `npm.cmd --prefix admin-web run build`.
- [ ] Run `npm.cmd run test:scripts`.
- [ ] Run `npm.cmd run check:release`.
- [ ] Open closeout PR, address review/check failures, merge, pull `main`.

## Per-Page Loop

Every page PR must execute this loop:

- [ ] Read the current page file, related feature API hooks, route tests, and navigation role rules.
- [ ] Write an evidence note under `docs/evidence/admin-pages-operational-prototype-parity-v1/`.
- [ ] Write a component map before visual work:
  - Header and page actions.
  - Filters and search.
  - Main table/list/workbench.
  - Drawer/sheet/detail model.
  - Empty/loading/error/access states.
  - Primary and secondary actions.
  - Mobile behavior.
- [ ] Build a React prototype slice in the app runtime, not standalone HTML.
- [ ] Self-review the prototype against the operational stance.
- [ ] Implement the live route from the prototype file, starting from the prototype shape rather than restyling the old page.
- [ ] Map every visible label, metric, status, row action, drawer field, and confirmation text to real data or an existing user action.
- [ ] Remove old UI remnants and debug/internal copy.
- [ ] Capture desktop and mobile screenshots after implementation.
- [ ] Record `Prototype parity: PASS` only when screenshot shape, density, palette, status tones, typography, row/card rhythm, drawer/modal model, labels, and interaction flow materially match the prototype.

## Prototype Contract

Each prototype must include:

- [ ] Turkish product copy that can ship unchanged.
- [ ] No placeholder/debug/internal copy.
- [ ] Realistic row density for expected production volume.
- [ ] A clear primary work area.
- [ ] Detail drawer/sheet when row evidence or actions need focus.
- [ ] One primary action in the relevant area.
- [ ] Metric cards only when they help a decision; every metric card has one small, meaningful, centered lucide icon.
- [ ] Month/year controls instead of raw numeric period inputs where period filtering exists.
- [ ] No native select/input/button if project shadcn equivalents exist.
- [ ] Mobile version without horizontal overflow.

## Acceptance Gates

A page PR is not complete until:

- [ ] The live route visually matches its prototype contract.
- [ ] The page does not look like an executive dashboard.
- [ ] The main user decision is visible within one screen on desktop.
- [ ] The primary action is obvious and not duplicated.
- [ ] Role-gated actions remain role-gated.
- [ ] Existing business behavior is unchanged.
- [ ] Existing API payloads are unchanged unless a separate backend PR explicitly owns that change.
- [ ] No raw UUID is shown when a store, region manager, user, or personnel name is available.
- [ ] No internal copy appears in product UI.
- [ ] Empty/error/loading/access states are product-facing.
- [ ] Desktop and mobile screenshots are checked.
- [ ] Targeted checks pass.

## Stop Rules

Stop the current PR and report before continuing when:

- A required visual element cannot be mapped to a real data source or existing behavior.
- A prototype requires API, DB, auth, permission, or workflow changes outside the PR scope.
- A page has role/scope ambiguity that could expose admin actions to the wrong persona.
- Screenshot parity fails and cannot be fixed without changing the accepted prototype contract.
- CI, release rehearsal, or required review fails.
- The page is too large for one low-risk PR; split the route into a dedicated PR.

## Verification Commands

Baseline commands for every runtime PR:

```powershell
git diff --check
npm.cmd --prefix admin-web run lint
npm.cmd --prefix admin-web run build
```

When API contracts or generated clients are touched:

```powershell
npm.cmd --prefix admin-web run api:generate
npm.cmd --prefix admin-web run api:check
npm.cmd run test:scripts
```

When release closeout is reached:

```powershell
npm.cmd run check:release
```

Run targeted e2e/spec commands by route when the corresponding spec exists. Do not invent green status for missing coverage; record the gap in PR evidence.

## Autonomous Execution Rules

- [ ] Do not wait for user feedback between page prototypes and implementation.
- [ ] Do not skip prototype creation for a page.
- [ ] Do not implement "inspired by" versions; implement the prototype.
- [ ] Merge one PR before starting the next route group.
- [ ] Pull `main` after every merge.
- [ ] Keep unrelated dirty work out of the PR.
- [ ] Do not merge through failing required checks.
- [ ] Use Codex/GitHub review feedback when present; fix actionable comments before merge.
- [ ] Leave `/admin/feed` and `/admin/session` parked unless their dedicated PR gates are satisfied.

## Risk Register

| Risk | Severity | Mitigation |
| --- | --- | --- |
| Prototype looks good but production diverges because old Admin primitives override it. | High | Build prototype in app runtime, then implement from prototype shape. Screenshot parity is a hard gate. |
| Dashboard styling returns through metric-heavy page patterns. | High | Metric cards are optional. Main table/list/workbench owns the page. |
| Workflow behavior changes while moving UI. | High | Freeze API payloads, role visibility, and mutations before each page. Run targeted specs. |
| Wide tables overflow on mobile. | Medium | Mobile card/list mode or drawer details are required for dense routes. |
| Reused copy exposes implementation details. | Medium | Product-copy scan in every PR. Internal terms are banned. |
| Large route groups become unreviewable. | Medium | Split any route group when diff size or behavior risk rises above low/medium. |
| `/admin/feed` write workflow changes accidentally. | High | Feed stays parked until its own workflow contract and specs exist. |
| `/admin/session` diagnostic language leaks into product polish. | Medium | Session stays parked unless explicitly productized. |

## Expected End State

- Active Admin pages share one calm operational product language.
- Admin users can scan queues, records, approvals, imports, reports, and security evidence without dashboard noise.
- Prototype and production parity becomes the normal delivery path.
- Feed and session have explicit decisions instead of accidental partial modernization.
- The project has per-page evidence for what changed, what stayed behaviorally frozen, and what was verified.
