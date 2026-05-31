# Admin UI Modernization V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move active `/admin/*` surfaces to the same disciplined UI system as
Store surfaces without changing business workflow, auth semantics, API shape,
DB schema, scoring, import, snapshot, or approval behavior.

**Architecture:** Treat the admin migration as a PR train, not a rewrite. First
freeze route intent and role/data contracts, then introduce a small admin
surface primitive layer, then migrate pages by risk class. Each PR must be
reviewable, revertible, visually verified, and merged before the next PR starts.

**Tech Stack:** React 19, Vite, shadcn/ui primitives in
`admin-web/src/components/ui`, Tailwind v4 utilities, lucide-react icons,
TanStack Query, React Router, Playwright, existing API clients.

---

## Status

Draft execution plan. No runtime code is changed by this document.

## Source Evidence

Current admin route and navigation sources:

- `admin-web/src/app/admin-shell.tsx`
- `admin-web/src/app/admin-navigation.ts`
- `admin-web/src/app/route-loaders.tsx`
- `admin-web/src/app/route-preloaders.ts`
- `admin-web/src/app/route-data-preloaders.ts`
- `admin-web/src/styles/admin-command-shell.css`
- `admin-web/src/styles/shell.css`
- `admin-web/src/components/dashboard-primitives.tsx`
- `admin-web/src/components/ui/button.tsx`
- `admin-web/src/components/ui/input.tsx`
- `admin-web/src/components/ui/card.tsx`
- `admin-web/src/components/ui/dialog.tsx`
- `admin-web/src/components/ui/table.tsx`
- `admin-web/src/components/ui/select.tsx`
- `admin-web/src/components/ui/badge.tsx`
- `admin-web/src/components/ui/alert.tsx`
- `admin-web/src/components/ui/skeleton.tsx`
- `admin-web/src/components/ui/textarea.tsx`

Known old UI remnants from source search:

- `dashboard-primitives` still powers many admin pages.
- `hero-panel`, `hero-title`, `hero-copy`, `hero-metrics`, `metric-card`, and
  `admin-command-*` classes remain active on admin surfaces.
- Several admin pages use broad hero composition for operational work surfaces.

## Non-Goals

Do not change:

- API request or response shape.
- Backend code, DB schema, migrations, auth semantics, role semantics, scope
  semantics, scoring, ranking, snapshot interpretation, import lifecycle,
  BullMQ behavior, or approval state machines.
- Existing data source ownership. If data is not available from real API/model
  state, show loading, empty, error, or access state.
- Store UI routes except shared shell fixes that are proven not to alter Store
  behavior.
- `/store/incentives` parked product decision.
- User-created prototype or `.agents` files unless a future PR explicitly
  owns them.

## Global UI Rules

- Use shadcn/ui + Tailwind v4 + lucide icons for converted production admin
  surfaces.
- Remove old `dashboard-primitives` usage from a page only when the page is
  fully migrated in that PR.
- Do not leave half-converted pages with mixed old hero cards and new shadcn
  panels.
- Keep admin screens operational: compact header, clear filters, concise KPI
  summaries only when backed by real data, main table/list/form, and one clear
  primary action.
- No fake metrics, fake scores, fake operational copy, fake coaching, or
  decorative modules.
- Role-visible navigation, actions, buttons, and empty/access states must match
  the route guard and existing permission model.
- Internal words such as contract, mock, debug, staging, DB, queue, Redis, and
  OpenAPI must not appear in product UI unless the page is an admin/developer
  diagnostic surface where the existing product copy already owns that concept.

## Active Admin Route Matrix

| Surface group | Routes | Roles from `admin-shell.tsx` | Primary risk |
| --- | --- | --- | --- |
| Session | `/admin/session` | all authenticated users | R1 shell/state |
| Operations | `/admin/operations` | `SUPER_ADMIN` | R2 read dashboard |
| Data quality | `/admin/data-quality` | `SUPER_ADMIN` | R2 read dashboard |
| Integrations | `/admin/integrations`, `/admin/integrations/:batchId` | `SUPER_ADMIN`, `INTEGRATION_ADMIN` | R4 import workflow |
| Master data | `/admin/master-data`, `/admin/master-data/:batchId` | `SUPER_ADMIN`, `HR_ADMIN`, `INTEGRATION_ADMIN` | R4 write/promotion workflow |
| Snapshots | `/admin/snapshots`, `/admin/snapshots/:snapshotRunId` | `SUPER_ADMIN`, `SNAPSHOT_OPERATOR` | R5 snapshot workflow |
| Inbox | `/admin/inbox` | `SUPER_ADMIN`, `REPORT_VIEWER`, `HR_ADMIN` | R2 read/action queue |
| Feed | `/admin/feed` | `SUPER_ADMIN`, `HR_ADMIN`, `REGION_MANAGER` | R2/R4 depending on composer scope |
| Checklist templates | `/admin/checklists` | `SUPER_ADMIN`, `HR_ADMIN` | R4 workflow authoring |
| Competitions | `/admin/competitions` | `SUPER_ADMIN`, `HR_ADMIN`, `REPORT_VIEWER`, `REGION_MANAGER` | R4/R5 workflow/scoring adjacency |
| Reports | `/admin/reports`, `/admin/reports/snapshot-runs`, `/admin/reports/workforce/:snapshotRunId`, `/admin/reports/kpis/:snapshotRunId`, `/admin/reports/checklists/:snapshotRunId`, `/admin/reports/turnover/:snapshotRunId` | `SUPER_ADMIN`, `REPORT_VIEWER` | R2 read/reporting |
| Targets | `/admin/targets` | `SUPER_ADMIN`, `REPORT_VIEWER`, `REGION_MANAGER` | R4 approval workflow |
| KPI config | `/admin/kpi-config` | `SUPER_ADMIN` | R5 scoring config governance |
| Pilot feedback | `/admin/pilot-feedback` | `SUPER_ADMIN` | R2 read/admin response |
| Auth admin | `/admin/auth`, `/admin/auth/catalog`, `/admin/auth/users/:userId/audit`, `/admin/auth/role-assignments/:assignmentId/audit`, `/admin/auth/action-store-assignments/:assignmentId/audit` | `SUPER_ADMIN` | R5 auth/security |
| Audit center | `/admin/audit`, `/admin/audit/users/:userId/audit`, `/admin/audit/role-assignments/:assignmentId/audit`, `/admin/audit/action-store-assignments/:assignmentId/audit` | `SUPER_ADMIN`, `AUDITOR` | R5 audit/security |

## PR Train

### PR-1: Admin Route Intent And Contract Freeze

Risk class: `R0 docs/process`

Goal: create the authoritative admin migration inventory before runtime UI
movement.

Files:

- Create: `docs/plans/admin-ui-modernization-v1-inventory.md`
- Modify: `current-state.md`

Steps:

- [ ] List every active admin route from `admin-web/src/app/admin-shell.tsx`.
- [ ] For each route, record purpose, roles, current page file, existing API
  clients/imports, loading/empty/error/access states, primary action, old UI
  remnants, and verification target.
- [ ] Record which pages are read-only, write/workflow, auth/security,
  scoring-adjacent, import/snapshot lifecycle, or docs/diagnostic.
- [ ] Mark pages that must not move until route-level characterization or e2e
  coverage exists.
- [ ] Run `git diff --check`.
- [ ] Run `npm.cmd run test:scripts`.
- [ ] Open PR, request Codex review, wait for checks, merge only when clean,
  then verify `origin/main`.

Stop if:

- A route's current role visibility disagrees with `admin-navigation.ts`.
- A page has fake data or placeholder data that cannot be classified without a
  product decision.

Expected output:

- A route-by-route migration matrix that future PRs must obey.

### PR-2: Admin Shell And Surface Foundation

Risk class: `R1 UI-only`

Goal: introduce the new admin surface vocabulary without migrating all pages.

Files:

- Create: `admin-web/src/pages/admin-surface-primitives.tsx`
- Create: `scripts/admin-route-parity-guard.test.mjs`
- Create:
  `docs/evidence/admin-ui-modernization-v1-pr2-route-parity-YYYY-MM-DD.md`
- Modify: `admin-web/src/app/admin-shell.tsx`
- Modify: `admin-web/src/app/admin-sidebar.tsx`
- Modify: `admin-web/src/styles/admin-command-shell.css`
- Modify only if needed: `admin-web/src/features/localization/messages/admin-shell.ts`

Scope:

- Add compact admin page primitives: `AdminSurfacePage`, `AdminSurfaceHeader`,
  `AdminMetricStrip`, `AdminStatePanel`, `AdminFilterBar`, and
  `AdminActionRow`.
- Use shadcn/ui components, Tailwind v4 utility classes, and lucide icons.
- Keep route definitions, role guards, preload behavior, `firstAllowedPath`,
  and session handling unchanged.
- Keep Store shell untouched.
- Add an automated Route Parity Check. The PR-1 inventory is the baseline.
  This must be a script/static test evidence path, not a manual before/after
  checklist. The guard must compare the baseline against the current parsed
  `admin-shell.tsx` and `admin-navigation.ts` state:
  - route graph and route role baseline,
  - admin navigation visibility baseline,
  - route role visibility matrix,
  - navigation visibility matrix,
  - route graph, route role, and navigation visibility diffs must be `0`.
- Detail routes such as `/admin/integrations/:batchId`,
  `/admin/master-data/:batchId`, report detail routes, snapshot detail routes,
  and audit detail routes are route parity inputs, but they are not required to
  appear in navigation parity unless the PR-1 baseline explicitly marks them as
  nav-visible.
- The role visibility matrix must include at minimum `SUPER_ADMIN`, `HR_ADMIN`,
  `INTEGRATION_ADMIN`, `SNAPSHOT_OPERATOR`, `REPORT_VIEWER`,
  `REGION_MANAGER`, `AUDITOR`, and a no-special-admin-role user.
- Record route parity evidence in the PR evidence file. The evidence must show
  the parsed baseline source, parsed current source, route-role `diff = 0`,
  and navigation-visibility `diff = 0` results.

Verification:

```powershell
npm.cmd --prefix admin-web run lint
npm.cmd --prefix admin-web run build
npm.cmd run test:scripts
git diff --check
```

Visual QA:

- Desktop and mobile screenshots for `/admin/session` and the default first
  allowed admin route for `SUPER_ADMIN`.

Stop if:

- The shell change affects Store route layout or route recovery.
- Any role sees a nav item that `admin-navigation.ts` does not allow.
- Route graph, route role list, nav item list, route role visibility matrix, or
  navigation visibility matrix differs from the PR-1 inventory baseline without
  a separate explicit route/access decision.

### PR-3: Low-Risk Admin Read Surfaces

Risk class: `R2 frontend data binding`

Goal: migrate low-risk read/admin-review pages first to prove the visual
system.

Pages:

- `admin-web/src/pages/AdminPilotFeedbackPage.tsx`
- `admin-web/src/pages/AdminDataQualityCenterPage.tsx`
- `admin-web/src/pages/AdminInboxPage.tsx`
- `admin-web/src/pages/AdminFeedPage.tsx` only if composer/write behavior is
  not changed.

Scope:

- Replace `dashboard-primitives`, `hero-panel`, and old metric cards with the
  admin surface primitives from PR-2.
- Preserve existing API queries, mutations, pagination, filters, and access
  behavior.
- Use real query results only. If a metric cannot be derived from existing
  state, remove it or show an honest empty state.

Verification:

```powershell
npm.cmd --prefix admin-web run lint
npm.cmd --prefix admin-web run build
npm.cmd --prefix admin-web run test:e2e -- admin-surfaces.spec.ts
npm.cmd run test:scripts
git diff --check
```

Visual QA:

- Desktop and mobile screenshots for every migrated route.
- Loading, empty, and error states where tests or local mocks can reach them.

Stop if:

- Feed composer behavior changes.
- Inbox action semantics become ambiguous.

### PR-4: Reporting Read Surfaces

Risk class: `R2 frontend data binding`

Goal: modernize reporting pages without changing report interpretation.

Pages:

- `admin-web/src/pages/ReportsSummaryPage.tsx`
- `admin-web/src/pages/ReportsSnapshotRunsPage.tsx`
- `admin-web/src/pages/ReportsWorkforcePage.tsx`
- `admin-web/src/pages/ReportsKpisPage.tsx`
- `admin-web/src/pages/ReportsChecklistsPage.tsx`
- `admin-web/src/pages/ReportsTurnoverPage.tsx`

Scope:

- Replace old hero and metric cards with compact report headers, filter/status
  rows, and shadcn tables/cards.
- Preserve snapshot run selection, route params, report labels, calculations,
  and API response interpretation.
- Do not rename backend fields or transform report semantics.

Verification:

```powershell
npm.cmd --prefix admin-web run lint
npm.cmd --prefix admin-web run build
npm.cmd --prefix admin-web run test:e2e -- reports-surfaces.spec.ts
npm.cmd run test:scripts
git diff --check
```

Stop if:

- Snapshot report values or route params need reinterpretation.

### PR-5: Operations And Control-Tower Read Surfaces

Risk class: `R2 frontend data binding`

Goal: modernize the operational control tower while preserving signal logic.

Pages:

- `admin-web/src/pages/OperationsControlTowerPage.tsx`
- `admin-web/src/pages/operations-*.tsx`
- `admin-web/src/pages/operations-*-model.ts`

Scope:

- Replace old control-tower hero panels with dense, scan-friendly operational
  sections.
- Keep model helpers and signal status calculations unchanged unless a test
  proves the change is pure presentation.
- Keep alert, freshness, ranking, workforce, workflow, and data-quality signal
  meanings unchanged.

Verification:

```powershell
npm.cmd --prefix admin-web run lint
npm.cmd --prefix admin-web run build
npm.cmd --prefix admin-web run test:e2e -- operations-surfaces.spec.ts
npm.cmd run test:scripts
git diff --check
```

Stop if:

- A visual change requires changing operations signal thresholds or status
  mapping.

### PR-6: Auth And Audit Read/Security Surfaces

Risk class: `R5 auth/security`

Goal: modernize auth and audit admin pages without changing permission
semantics.

Pages:

- `admin-web/src/pages/AuthDashboardPage.tsx`
- `admin-web/src/features/auth/AuthDashboardSections.tsx`
- `admin-web/src/pages/AuthCatalogPage.tsx`
- `admin-web/src/pages/AuthUserAuditPage.tsx`
- `admin-web/src/pages/AuthAssignmentAuditPage.tsx`
- `admin-web/src/pages/AuthActionStoreAssignmentAuditPage.tsx`
- `admin-web/src/pages/AuditCenterPage.tsx`

Scope:

- Convert visual shell, tables, empty states, and detail sections.
- Preserve user/role/action-store assignment commands, audit link behavior,
  correlation ids, and authorization checks.
- Do not change auth API client functions or scope helpers.

Verification:

```powershell
npm.cmd --prefix admin-web run lint
npm.cmd --prefix admin-web run build
npm.cmd --prefix admin-web run test:e2e -- auth-surfaces.spec.ts audit-surfaces.spec.ts
npm.cmd --prefix admin-web run smoke:pilot
npm.cmd run test:scripts
git diff --check
```

Stop if:

- Any auth action, route visibility, or audit navigation target changes.

### PR-7: Integration And Import Lifecycle Surfaces

Risk class: `R4 backend write/workflow` for UI workflow adjacency

Goal: modernize integration import pages without changing upload, polling,
retry, batch detail, or evidence behavior.

Pages:

- `admin-web/src/pages/IntegrationDashboardPage.tsx`
- `admin-web/src/pages/ImportBatchDetailPage.tsx`

Scope:

- Convert old integration hero and panels to compact command sections.
- Preserve upload controls, source selection, batch polling, retry/detail links,
  and error handling.
- Keep source governance copy honest: Power BI/Excel active, JSON suspended if
  that is still the current product decision.

Verification:

```powershell
npm.cmd --prefix admin-web run lint
npm.cmd --prefix admin-web run build
npm.cmd --prefix admin-web run test:e2e -- integration-surfaces.spec.ts
npm.cmd run test:scripts
git diff --check
```

Stop if:

- Upload command payloads, retry behavior, import lifecycle wording, or source
  governance status would change.

### PR-8: Master Data And Snapshot Workflow Surfaces

Risk class: `R5 snapshot/import workflow`

Goal: modernize high-risk workflow pages after read surfaces are stable.

Pages:

- `admin-web/src/pages/MasterDataBootstrapPage.tsx`
- `admin-web/src/pages/SnapshotsDashboardPage.tsx`
- `admin-web/src/pages/SnapshotRunDetailPage.tsx`

Additional files:

- Create or modify:
  `admin-web/e2e/fixtures/snapshot-status-golden.ts`
- Create or modify:
  `admin-web/e2e/snapshots-surfaces.spec.ts`
- Create:
  `docs/evidence/admin-ui-modernization-v1-pr8-snapshot-golden-YYYY-MM-DD.md`

Scope:

- Convert visual structure only.
- Preserve validation, promotion, snapshot run creation, rerun, detail polling,
  status labels, and destructive/action confirmations.
- Do not change snapshot period interpretation or materialization lifecycle
  wording unless existing product copy is wrong and a separate product decision
  is recorded.
- Add Snapshot Semantic Golden Verification with deterministic fixtures, not
  live data. The golden matrix must capture before/after visible semantics for
  snapshot states such as `queued`, `running`, `completed`, `failed`, `reused`,
  and rerun-related states:
  - status key,
  - visible label,
  - badge/tone class or semantic tone,
  - primary/secondary action availability,
  - detail route visibility,
  - disabled/loading/error affordance where relevant.
- Before and after snapshot status matrices must match. A visual redesign may
  move the status presentation, but it must not change what state the operator
  sees or which action is available.
- Layout, styling, spacing, and screenshot differences are not semantic golden
  diffs by themselves.
- If the semantic golden output changes, the PR must declare
  `Contract Impact: changed` and stop for a separate product/workflow decision.
- Record the before matrix, after matrix, and `must match` result in the PR
  evidence file.

Verification:

```powershell
npm.cmd --prefix admin-web run lint
npm.cmd --prefix admin-web run build
npm.cmd --prefix admin-web run test:e2e -- master-data-surfaces.spec.ts snapshots-surfaces.spec.ts
npm.cmd --prefix admin-web run smoke:pilot
npm.cmd run test:scripts
git diff --check
```

Stop if:

- Snapshot or master-data workflow behavior needs backend or API changes.
- Snapshot status label, tone, action availability, or detail visibility changes
  without a separate product/workflow decision.
- Snapshot semantic golden output changes in a PR that claims
  `Contract Impact: none` or `Contract Impact: intentionally unchanged`.

### PR-9: Checklist Template Builder

Risk class: `R4 workflow authoring`

Goal: modernize checklist template administration while preserving template
authoring semantics.

Page:

- `admin-web/src/pages/AdminChecklistTemplatesPage.tsx`

Scope:

- Convert builder shell, item list, scoring controls, template status panels,
  dialog/forms, and empty states.
- Preserve answer types, scoring weights, save/publish/archive behavior, and
  backend payload shape.
- Keep photo/upload-related UI out unless backend/API support already exists
  for admin template configuration.

Verification:

```powershell
npm.cmd --prefix admin-web run lint
npm.cmd --prefix admin-web run build
npm.cmd --prefix admin-web run test:e2e -- checklist-template-surfaces.spec.ts
npm.cmd run test:scripts
git diff --check
```

Stop if:

- Checklist score interpretation, answer type behavior, or payload shape would
  change.

### PR-10: Targets Admin Queue

Risk class: `R4 approval workflow`

Goal: modernize target approval admin page while preserving the existing target
request state machine.

Page:

- `admin-web/src/pages/TargetApprovalQueuePage.tsx`

Scope:

- Convert queue, filters, metric summaries, approval/revision affordances, and
  empty states.
- Preserve role behavior for `SUPER_ADMIN`, `REPORT_VIEWER`, and
  `REGION_MANAGER`.
- Preserve approve/revise payloads, note handling, status labels, route access,
  and current API hooks.

Verification:

```powershell
npm.cmd --prefix admin-web run lint
npm.cmd --prefix admin-web run build
npm.cmd --prefix admin-web run test:e2e -- admin-targets-surfaces.spec.ts store-targets-surfaces.spec.ts
npm.cmd run test:scripts
git diff --check
```

Stop if:

- A UI change requires target state-machine or API behavior changes.

### PR-11: KPI Config Governance Surface

Risk class: `R5 scoring/config`

Goal: modernize KPI config only after the rest of admin UI has stable
primitives.

Page:

- `admin-web/src/pages/AdminKpiConfigPage.tsx`

Scope:

- Convert visual layout, tables, config sections, dialogs, and empty/error
  states.
- Preserve KPI contribution, score weight, active version, publish/history, and
  validation semantics.
- Do not change scoring math, default config, backend DTOs, or API payload
  shape.

Verification:

```powershell
npm.cmd --prefix admin-web run lint
npm.cmd --prefix admin-web run build
npm.cmd --prefix admin-web run test:e2e -- kpi-config-surfaces.spec.ts
npm.cmd --prefix backend/nestjs test -- --runInBand src/modules/store-ops/application/performance-score-evaluator.service.spec.ts src/modules/store-ops/application/reporting.service.kpi-config-versioning.spec.ts
npm.cmd run test:scripts
git diff --check
```

Stop if:

- The redesign requires changing KPI scoring, versioning, or backend config
  semantics.

### PR-12: Competitions Admin Surface

Risk class: `R4/R5 workflow and scoring adjacency`

Goal: modernize competition admin without touching competition lifecycle or
scoring.

Page:

- `admin-web/src/pages/CompetitionDashboardPage.tsx`

Scope:

- Convert visual shell, teams/stages/packages/cards, status sections, dialogs,
  and empty states.
- Preserve competition creation/editing, status transitions, stage package plan
  handling, rankings display, and API payloads.
- Do not change score calculation, finalization, stage execution, review,
  cancel, clone, or access semantics.

Verification:

```powershell
npm.cmd --prefix admin-web run lint
npm.cmd --prefix admin-web run build
npm.cmd --prefix admin-web run test:e2e -- competition-surfaces.spec.ts
npm.cmd --prefix backend/nestjs test -- --runInBand src/modules/store-ops/application/competition.service.spec.ts src/modules/store-ops/infrastructure/competition.repository.spec.ts test/integration/competition.e2e-spec.ts
npm.cmd run test:scripts
git diff --check
```

Stop if:

- Any competition lifecycle, scoring, finalization, or access behavior becomes
  ambiguous.

### PR-13: Legacy Admin UI Guard And Cleanup

Risk class: `R0/R1 guard`

Goal: prevent old admin UI language from returning after migration.

Files:

- Create or extend: `scripts/store-ui-refactor-guard.test.mjs` or a new
  `scripts/admin-ui-refactor-guard.test.mjs`
- Create:
  `docs/evidence/admin-ui-modernization-v1-pr13-admin-ui-guard-YYYY-MM-DD.md`
- Modify: `package.json` if a new script guard is added
- Modify: `discipline.md` only if the admin UI rule is not already covered

Scope:

- Add guard coverage for migrated admin pages so they do not reintroduce
  `dashboard-primitives`, `hero-panel`, old `metric-card` patterns, fake data
  language, debug copy, or role-mismatched nav/action affordances.
- Add AdminSurface primitive enforcement as a positive rule, not only a legacy
  pattern ban. New admin pages and migrated admin pages must use
  `AdminSurface*` primitives from
  `admin-web/src/pages/admin-surface-primitives.tsx` instead of inventing a new
  page shell, card system, metric strip, filter bar, or state panel.
- The guard must track two explicit lists:
  - migrated/new admin pages where `AdminSurface*` usage is required,
  - unmigrated exception pages that are allowed to keep legacy primitives until
    their assigned PR lands.
- The guard must fail when a migrated/new admin page imports
  `dashboard-primitives`, uses old hero/metric classes, or defines a parallel
  surface primitive set instead of `AdminSurface*`.
- Record guard evidence showing the migrated list, exception list, forbidden
  patterns, positive `AdminSurface*` requirement, and synthetic negative cases
  that prove the guard fails closed.
- The guard's explicit purpose is to prevent primitive sprawl and lock the
  admin UI standard after migration.
- Keep exceptions explicit for pages not yet migrated when this PR lands.

Verification:

```powershell
npm.cmd run test:scripts
git diff --check
```

Stop if:

- The guard blocks unmigrated pages without a clear exception list.
- The guard can only prohibit old patterns but cannot prove migrated/new pages
  use the approved admin primitive layer.

### PR-14: Final Consistency And Closeout

Risk class: `R0 docs/process`

Goal: close the admin modernization train with evidence and remaining risk.

Files:

- Create: `docs/evidence/admin-ui-modernization-v1-closeout-YYYY-MM-DD.md`
- Modify: `current-state.md`
- Modify: `docs/plans/admin-ui-modernization-v1-plan.md`
- Modify: `docs/plans/admin-ui-modernization-v1-inventory.md`

Scope:

- Record merged PRs, route coverage, visual QA evidence, verification commands,
  old UI remnants removed, remaining parked risks, and rollback posture.
- Mark the plan closed only when all active admin routes are either migrated or
  explicitly parked with a reason and trigger.

Verification:

```powershell
npm.cmd run test:scripts
git diff --check
```

Stop if:

- Any active admin route remains half-converted without an explicit follow-up
  trigger.

## PR Operating Checklist

Every PR in this train must do the following:

- [ ] Start from fresh `origin/main`.
- [ ] Use a `codex/` branch.
- [ ] Keep one review story.
- [ ] Preserve role, API, and workflow behavior unless a separate decision PR
  explicitly says otherwise.
- [ ] Run `git diff --stat` and confirm only expected files changed.
- [ ] Run `git diff --check`.
- [ ] Read every changed file before opening the PR.
- [ ] Run the PR-specific verification commands.
- [ ] For PR-2 or shell/navigation changes, run the route/navigation parity
  guard and attach evidence that route-role and nav-visibility diffs are `0`.
- [ ] For PR-8 or snapshot UI changes, run the snapshot semantic golden fixture
  and attach evidence that status label, tone, action availability, and detail
  visibility are unchanged.
- [ ] For PR-13 and every later admin page migration, confirm AdminSurface
  primitive enforcement: migrated/new admin pages use `AdminSurface*`, and any
  legacy page remains only through the explicit exception allowlist.
- [ ] For UI PRs, capture desktop and mobile screenshots of every changed
  route plus at least one loading/empty/error/access state when reachable.
- [ ] Search changed files for old UI remnants named in this plan.
- [ ] PR body must include: summary, contract impact, what did not change,
  rollback, verification, and visual QA.
- [ ] Request Codex review.
- [ ] Merge only after GitHub/Vercel checks are green, PR is mergeable, and
  Codex review/comments are clean.
- [ ] After merge, fetch `origin/main`, verify `HEAD == origin/main`, then move
  to the next PR.

## Expected Verification Ladder

Use the smallest command set that proves the PR claim:

- Docs-only: `git diff --check`, `npm.cmd run test:scripts`.
- UI-only: `npm.cmd --prefix admin-web run lint`,
  `npm.cmd --prefix admin-web run build`, targeted Playwright, visual QA.
- Shell/navigation foundation: UI-only gates plus the route/navigation parity
  guard proving route graph, route role visibility, and admin navigation
  visibility match the PR-1 inventory baseline.
- Frontend data binding: UI-only gates plus targeted e2e asserting API-backed
  values and empty/error/access states.
- Snapshot UI/workflow surfaces: frontend data binding gates plus the snapshot
  semantic golden fixture proving status label, badge tone, action
  enabled/disabled state, and detail visibility did not drift.
- Auth/security: frontend gates plus auth/audit targeted specs and
  `npm.cmd --prefix admin-web run smoke:pilot` when route access is touched.
- Scoring/config/workflow-adjacent: frontend gates plus targeted backend specs
  that prove scoring/workflow behavior did not change.
- Admin UI guard/primitive standard: `npm.cmd run test:scripts` plus the
  AdminSurface primitive guard proving migrated/new admin pages use
  `AdminSurface*` and unmigrated pages are limited to the explicit exception
  allowlist.
- Broad final check when multiple admin domains are touched:
  `npm.cmd --prefix admin-web run check:release` and root
  `npm.cmd run check:release`.

## Completion Definition

Admin UI Modernization V1 is complete only when:

- Every active admin route in the matrix is migrated or explicitly parked with
  a trigger.
- Migrated routes no longer use `dashboard-primitives`, old hero panels, old
  metric-card language, fake data, or debug/handoff copy.
- Migrated and new admin page files use `AdminSurface*` primitives; only
  explicitly unmigrated pages remain in the exception allowlist.
- Role-aware navigation and access states match `admin-shell.tsx` and
  `admin-navigation.ts`.
- Route graph, route role visibility, and admin navigation visibility remain
  parity-guarded against the PR-1 inventory baseline.
- Snapshot status label, badge tone, action availability, and detail visibility
  have no semantic golden drift.
- Desktop and mobile screenshots exist for migrated surfaces.
- Loading, empty, error, and access states are covered by tests or visual QA.
- `current-state.md` and closeout evidence record merged PRs, verification, and
  remaining parked risks.
