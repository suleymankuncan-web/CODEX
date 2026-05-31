# Admin Operational UX V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve active `/admin/*` pages into product-quality operational
management surfaces on top of the closed Admin UI Modernization V1 foundation.

**Architecture:** V2 is a usability and product-quality pass, not a repeat of
the V1 migration and not a freestyle redesign. First freeze page intent,
operational UX gaps, mobile risks, and AdminSurface primitive sufficiency in a
docs-only audit. Then execute small risk-group PRs that improve clarity,
density, state readability, and action hierarchy while preserving all runtime
contracts and workflows.

**Tech Stack:** React 19, Vite, shadcn/ui primitives in
`admin-web/src/components/ui`, Tailwind v4 utilities, lucide-react icons,
TanStack Query, React Router, Playwright, existing API clients, and the
existing `AdminSurface*` primitive layer in
`admin-web/src/pages/admin-surface-primitives.tsx`.

---

## Status

Status: `active plan`
Date: 2026-06-01

This plan starts after Admin UI Modernization V1 closed. V1 moved admin
surfaces to shadcn/ui + Tailwind v4 + lucide-react + `AdminSurface*` and added
the admin UI guard. V2 must improve operational quality without reopening the
V1 migration as broad churn.

## Source Documents

Read before PR-1:

- `current-state.md`
- `sokrates.md`
- `discipline.md`
- `docs/README.md`
- `docs/plans/admin-ui-modernization-v1-plan.md`
- `docs/plans/admin-ui-modernization-v1-inventory.md`
- `docs/evidence/admin-ui-modernization-v1-closeout-2026-05-31.md`
- `admin-web/src/app/admin-shell.tsx`
- `admin-web/src/app/admin-navigation.ts`
- `scripts/admin-route-parity-guard.test.mjs`
- `scripts/admin-ui-refactor-guard.test.mjs`
- All active `/admin/*` page files listed in the V1 inventory.

## Objective Questions

Every improved admin surface must answer quickly:

- What is happening?
- What is risky?
- What needs action?
- What can I safely do now?
- What evidence supports this state?

## Non-Goals

Do not change:

- API request or response shape.
- Backend code, DB schema, migrations, auth semantics, permission semantics,
  role semantics, scope semantics, scoring, ranking, snapshot interpretation,
  import lifecycle, BullMQ behavior, polling, retry behavior, approval state
  machines, or business workflows.
- Existing data source ownership. If data is not available from real API/model
  state, remove the unsupported section or show honest loading, empty, error,
  or access state.
- Store UI routes or user-created prototype files.
- Parked routes unless a PR explicitly owns the parked-route decision.

Do not add:

- Fake data, fake metrics, fake scores, fake coaching, fake workflow copy,
  placeholder business copy, or new product features.
- Decorative modules that do not help the operator understand state or act.
- New `AdminSurface*` primitives without PR-1 proof that at least two route
  groups need the same operational pattern.

## Dirty Worktree Rule

- Do not touch unrelated dirty or untracked files.
- Stop only when dirty or untracked files overlap the current PR scope.
- If unrelated dirty/untracked files exist, mention them in the PR prep note and
  leave them untouched.

## Known Parked Routes

These are explicit V1 closeout exceptions and must not be forced into product
UI by V2:

| Route | Page | Current decision | Reopen trigger |
| --- | --- | --- | --- |
| `/admin/session` | `admin-web/src/pages/SessionReadinessPage.tsx` | Diagnostic session/auth readiness surface. | Product decision to turn session readiness into a production admin surface or remove diagnostic copy from the route. |
| `/admin/feed` | `admin-web/src/pages/AdminFeedPage.tsx` | Feed composer/write behavior remains parked. | Separate behavior-preserving feed composer modernization PR with targeted feed workflow verification. |

## Quality Rubric

Score every active admin route in PR-1 using this rubric:

| Dimension | Question | Evidence required |
| --- | --- | --- |
| Operational clarity | Can the user understand the situation in 5 seconds? | First viewport structure, headline, status hierarchy, and primary data. |
| Action clarity | Is the primary action obvious and safe? | Primary action placement, disabled/enabled state, role behavior, and recovery path. |
| Data honesty | Is every metric/copy backed by real data? | API/query/model/config source or explicit empty/access state. |
| Density | Are cards, whitespace, and explanatory copy unnecessarily bloated? | Layout scan for oversized headers, duplicated descriptions, nested cards, and low-signal panels. |
| Role fit | Are actions and links appropriate for the current role? | `admin-shell.tsx`, `admin-navigation.ts`, auth helper, and existing disabled/access behavior. |
| Mobile resilience | Do filters, tables, modals, and actions work without overflow? | Desktop/mobile screenshot or targeted visual QA notes. |
| Decision latency | How directly can the operator reach the page's primary decision? | `low`, `medium`, or `high` with a short reason based on required filters, panels, tabs, details, or context switches. |
| Evidence confidence | Can the operator understand why the current state, risk level, recommendation, or action state exists using visible evidence on the page? | `clear`, `partial`, or `weak` with visible evidence type or missing-evidence reason. |

Use `clear`, `partial`, or `weak` for all dimensions except Decision Latency.
Use `low`, `medium`, or `high` for Decision Latency:

- `low`: the primary decision is visible in the first viewport with no required
  navigation.
- `medium`: one filter, expansion, tab, or detail context is needed.
- `high`: multiple context switches, hidden dependencies, or unclear
  drill-downs are needed.

Visible evidence can be a timestamp, source, status reason, count breakdown,
validation result, audit trace, linked batch, linked snapshot, linked request,
or disabled-action reason. If evidence is weak because the current API/model
does not expose the reason, do not invent evidence. Mark it as `weak` and
record the needed product/API decision or parked follow-up.

A `weak` score or `high` Decision Latency must have an actionable route-group
recommendation or a parked reason.

## AdminSurface Primitive Usage Map

PR-1 must include an AdminSurface primitive usage map before any runtime code
changes.

Existing shared primitives:

- `AdminSurfacePage`
- `AdminSurfaceHeader`
- `AdminMetricStrip`
- `AdminStatePanel`
- `AdminSurfaceSection`
- `AdminKeyValueGrid`
- `AdminKeyValue`
- `AdminSurfaceEmpty`
- `AdminFilterBar`
- `AdminActionRow`
- `AdminSurfaceBadge`
- `AdminSurfaceSkeleton`

For each route group, record:

- currently used `AdminSurface*` primitives,
- missing operational pattern, if any,
- whether existing primitives are sufficient,
- repeated layout need shared by at least two route groups,
- proposed primitive only when justified,
- why a new primitive is not needed when existing primitives are enough,
- guard/evidence update needed if a new primitive is introduced.

New primitive rule:

- Add a new AdminSurface primitive only if PR-1 proves at least two route
  groups need the same operational pattern.
- The pattern must not be expressible cleanly with existing primitives.
- The primitive must improve consistency without hiding page-specific workflow.
- The same PR must update admin UI guard/evidence if the guard needs to know
  about the new primitive or helper.
- If these conditions are not met, PR-2 is docs-only or skipped.

Candidate primitive names are examples, not pre-approved work:

- `OperationalHeader`
- `StatusStrip`
- `CommandFilterBar`
- `ActionQueue`
- `EvidencePanel`
- `DenseDataTable`
- `RiskStatePanel`

## Admin UX Audit Matrix Schema

PR-1 must create `docs/plans/admin-operational-ux-v2-audit-matrix.md` with one
row per active route or route group.

Required columns:

| Column | Required content |
| --- | --- |
| Route | Exact route path from `admin-shell.tsx`. |
| Page file | Exact source file(s). |
| Allowed roles | Roles from `admin-shell.tsx`; note nav visibility if different. |
| Real purpose | Product purpose in operator language. |
| User intent | What the operator came to decide or do. |
| Primary action | Main safe action, or `read-only`. |
| Secondary actions | Supporting actions, filters, detail navigation, or exports. |
| Data sources/API hooks | Existing query/mutation/client names; no guessed sources. |
| Type | `read`, `write`, `workflow`, `config`, `audit`, `reporting`, or mixed. |
| Risk class | Use discipline risk classes and V1 route risk. |
| Current UX problem | Concrete issue: hierarchy, density, action ambiguity, state clarity, mobile overflow, etc. |
| Mobile risk | Table, toolbar, modal, filter, action wrapping, or none. |
| Decision latency | `low`, `medium`, or `high`; include the required step/context-switch reason. |
| Evidence confidence | `clear`, `partial`, or `weak`; include visible evidence type or missing-evidence reason. |
| Visible evidence | Timestamp, source, status reason, count breakdown, validation result, audit trace, linked batch/snapshot/request, disabled-action reason, or `not exposed by current model`. |
| Ideal operational layout | Header/status/filter/main work area/action queue/evidence shape. |
| Required AdminSurface pattern | Existing primitive list or justified missing pattern. |
| Loading/empty/error/access quality | `clear`, `partial`, `weak`, or `unreachable in local QA`. |
| Old UI remnants | Any active old primitive/class/copy in the route group, or `none`. |
| Verification target | Existing e2e/spec/guard/build command. |
| Behavior freeze needed | Yes/no; name characterization or golden target when yes. |
| V2 decision | `improve now`, `grouped`, `parked`, or `no runtime change needed`. |

## Route Groups

Use risk-group PRs, not arbitrary page-by-page batching:

| Route group | Routes | V2 intent |
| --- | --- | --- |
| Operations + Data Quality + Workflow Inbox | `/admin/operations`, `/admin/data-quality`, `/admin/inbox` | Make "where is the problem?" and "what needs approval?" clear through compact signals, risk/action queues, and drill-downs. |
| Integrations + Master Data | `/admin/integrations`, `/admin/integrations/:batchId`, `/admin/master-data`, `/admin/master-data/:batchId` | Make import, batch, validation, and promotion workflows safer and clearer. |
| Snapshots + Reports | `/admin/snapshots`, `/admin/snapshots/:snapshotRunId`, `/admin/reports`, report detail routes | Clarify reliability, readable reports, enabled actions, and snapshot semantic state. |
| Targets + KPI Config | `/admin/targets`, `/admin/kpi-config` | Improve governance, approval clarity, change impact, and audit confidence. |
| Checklist Templates + Competitions | `/admin/checklists`, `/admin/competitions` | Improve workflow authoring readability and section/step structure. |
| Auth + Audit + Pilot Feedback | `/admin/auth`, auth audit routes, `/admin/audit`, audit detail routes, `/admin/pilot-feedback` | Make security/audit/admin-response surfaces quiet, serious, traceable, and role-safe. |
| Parked routes | `/admin/session`, `/admin/feed` | Re-evaluate decision only; do not force product UI. |

## PR Train

### PR-1: Admin UX Audit Matrix

Risk class: `R0 docs/process`

Goal: create the source-of-truth V2 audit before runtime UI work.

Files:

- Create: `docs/plans/admin-operational-ux-v2-audit-matrix.md`
- Modify: `current-state.md` only if the plan becomes the active frontend
  direction.

Steps:

- [ ] Start from fresh `origin/main` on a `codex/` branch.
- [ ] Read every source document listed in this plan.
- [ ] Parse active admin routes and roles from `admin-shell.tsx`.
- [ ] Cross-check navigation visibility from `admin-navigation.ts`.
- [ ] Inspect every active admin page file and feature helper named by the V1
  inventory.
- [ ] Fill the Admin UX Audit Matrix with route, intent, data, action, state,
  mobile, Decision Latency, Evidence Confidence, risk, and verification
  evidence.
- [ ] Fill the AdminSurface Primitive Usage Map.
- [ ] Mark `/admin/session` and `/admin/feed` as known parked unless repo
  evidence proves a safe behavior-preserving PR is ready.
- [ ] Choose the final V2 route-group PR order using risk class, `high`
  Decision Latency, `weak` Evidence Confidence, and workflow criticality as
  prioritization inputs.
- [ ] Run `npm.cmd run test:scripts`.
- [ ] Run `git diff --stat` and confirm docs-only scope.
- [ ] Run `git diff --check`.
- [ ] Open PR, request release-blocking Codex review, wait for checks, merge
  only when clean, and verify local `main` equals `origin/main`.

Stop if:

- Active route list differs from the V1 inventory without an explicit route
  decision.
- A page's data source, primary action, or role behavior cannot be determined
  from repo evidence.
- PR-1 would require runtime code to answer the audit.

### PR-2: Admin Operational Surface Standards

Risk class: `R1 UI-only` if runtime primitives change; `R0 docs/process` if
docs-only or skipped.

Goal: decide whether existing AdminSurface primitives are sufficient and add
only justified shared operational primitives.

Decision source:

- PR-1 AdminSurface Primitive Usage Map.

Files:

- Modify only if justified: `admin-web/src/pages/admin-surface-primitives.tsx`
- Modify only if guard needs it: `scripts/admin-ui-refactor-guard.test.mjs`
- Create evidence:
  `docs/evidence/admin-operational-ux-v2-pr2-surface-standards-YYYY-MM-DD.md`

Steps:

- [ ] Start from fresh `origin/main`.
- [ ] Read the PR-1 primitive usage map.
- [ ] If existing primitives are sufficient, record that decision and skip
  runtime primitive work.
- [ ] If a new primitive is justified, write a narrow API for the shared pattern
  only.
- [ ] Keep primitive names generic to operation structure, not to one page.
- [ ] Update admin UI guard/evidence if a new helper or primitive anchor needs
  enforcement.
- [ ] Run `npm.cmd --prefix admin-web run lint`.
- [ ] Run `npm.cmd --prefix admin-web run build`.
- [ ] Run `npm.cmd run test:scripts`.
- [ ] Run `git diff --stat` and `git diff --check`.
- [ ] Capture a small usage screenshot only if runtime primitive examples are
  changed.
- [ ] Open PR, request release-blocking Codex review, wait for checks, merge
  only when clean, and verify local `main` equals `origin/main`.

Stop if:

- Only one route group needs the proposed primitive.
- The primitive would hide page-specific workflow or behavior.
- The primitive API encourages fake metrics, decorative modules, or ambiguous
  action slots.

### PR-3: Operations + Data Quality + Workflow Inbox

Risk class: `R2 frontend data binding` plus protected `R4` workflow action
surface

Goal: make "where is the problem?" and "what needs approval?" surfaces compact,
prioritized, and actionable.

Primary files:

- `admin-web/src/pages/OperationsControlTowerPage.tsx`
- `admin-web/src/pages/operations-*.tsx`
- `admin-web/src/pages/AdminDataQualityCenterPage.tsx`
- `admin-web/src/pages/AdminInboxPage.tsx`

UX direction:

- Compact first viewport with status/risk signal hierarchy.
- Separate health from risk and action queues.
- Keep drill-downs explicit and role-safe.
- Keep workflow inbox approvals visually clearer without moving permission,
  payload, invalidation, or status-transition behavior.
- Remove low-signal explanatory copy and repeated card rhythm when it hides the
  action.

Protected behavior:

- Do not change thresholds, freshness calculations, signal priority, data
  quality classification, queue limits, source links, query keys, workflow
  inbox approval/rejection payloads, invalidation keys, status transition copy,
  action permission checks, or API interpretation.

Verification:

```powershell
npm.cmd --prefix admin-web run lint
npm.cmd --prefix admin-web run build
npm.cmd --prefix admin-web run test:e2e -- operations-control-tower.spec.ts data-quality-center.spec.ts admin-inbox.spec.ts
npm.cmd run test:scripts
git diff --check
```

Visual QA:

- Desktop and mobile screenshots for `/admin/operations` and
  `/admin/data-quality`.
- Desktop and mobile screenshots for `/admin/inbox`, including existing
  disabled/permission-aware action states when reachable through mocks.
- Loading/empty/error state notes when reachable through existing mocks.

### PR-4: Integrations + Master Data

Risk class: `R4 workflow/import lifecycle`

Goal: make import, batch, validation, and promotion workflows safer and clearer.

Primary files:

- `admin-web/src/pages/IntegrationDashboardPage.tsx`
- `admin-web/src/pages/ImportBatchDetailPage.tsx`
- `admin-web/src/features/integrations/*`
- `admin-web/src/pages/MasterDataBootstrapPage.tsx`
- `admin-web/src/pages/master-data-bootstrap-*`

UX direction:

- Surface queue state, failure reason, retry/promote eligibility, evidence, and
  status progression.
- Make destructive or lifecycle actions visually clear without changing their
  enablement.
- Use existing data only; do not invent import quality metrics.

Protected behavior:

- Do not change upload payloads, source selection, retry behavior, polling,
  validation, promotion, batch status mapping, transaction expectations, or
  route params.

Verification:

```powershell
npm.cmd --prefix admin-web run lint
npm.cmd --prefix admin-web run build
npm.cmd --prefix admin-web run test:e2e -- integration-surfaces.spec.ts master-data-surfaces.spec.ts
npm.cmd run test:scripts
git diff --check
```

Visual QA:

- Desktop and mobile screenshots for `/admin/integrations`,
  `/admin/integrations/:batchId`, `/admin/master-data`, and
  `/admin/master-data/:batchId` using existing test routes or local mocks.

Stop if:

- The UX improvement requires changing import retry, validation, promotion, or
  lifecycle semantics.

### PR-5: Snapshots + Reports

Risk class: `R5 snapshot workflow` plus `R2 reporting`

Goal: clarify which snapshots are reliable, which reports are readable, and
which actions are enabled.

Primary files:

- `admin-web/src/pages/SnapshotsDashboardPage.tsx`
- `admin-web/src/pages/SnapshotRunDetailPage.tsx`
- `admin-web/src/pages/ReportsSummaryPage.tsx`
- `admin-web/src/pages/ReportsSnapshotRunsPage.tsx`
- `admin-web/src/pages/ReportsWorkforcePage.tsx`
- `admin-web/src/pages/ReportsKpisPage.tsx`
- `admin-web/src/pages/ReportsChecklistsPage.tsx`
- `admin-web/src/pages/ReportsTurnoverPage.tsx`

UX direction:

- Preserve snapshot semantic output while improving hierarchy and density.
- Make enabled/disabled actions explainable from existing state.
- Keep report detail surfaces table-first and readable on mobile.

Protected behavior:

- Do not change snapshot status labels, badge tones, action enabled/disabled
  logic, detail visibility, rerun payloads, daily closure behavior, report
  calculations, export meaning, route params, or API response interpretation.

Verification:

```powershell
npm.cmd --prefix admin-web run lint
npm.cmd --prefix admin-web run build
npm.cmd --prefix admin-web run test:e2e -- snapshots-surfaces.spec.ts reports-surfaces.spec.ts
npm.cmd run test:scripts
git diff --check
```

Required guard:

- Snapshot semantic golden output must remain unchanged: status label, badge
  tone, action enabled/disabled state, and detail visibility.

Stop if:

- Snapshot semantic golden output drifts.

### PR-6: Targets + KPI Config

Risk class: `R4 approval workflow` plus `R5 scoring/config`

Goal: improve governance and approval clarity.

Primary files:

- `admin-web/src/pages/TargetApprovalQueuePage.tsx`
- `admin-web/src/pages/AdminKpiConfigPage.tsx`
- `admin-web/src/pages/admin-kpi-config-surface-primitives.tsx`

UX direction:

- Clarify pending, approved, error, and blocked states.
- Make role-based action availability visible without changing permission
  behavior.
- Improve change impact and audit confidence with existing data.

Protected behavior:

- Do not change target approval payloads, note handling, request month handling,
  coverage semantics, permission checks, scoring math, contribution weights,
  active version semantics, validation, default config, backend DTOs, save
  payloads, or publish payloads.

Verification:

```powershell
npm.cmd --prefix admin-web run lint
npm.cmd --prefix admin-web run build
npm.cmd --prefix admin-web run test:e2e -- admin-targets.spec.ts admin-targets-surfaces.spec.ts admin-kpi-config.spec.ts kpi-config-surfaces.spec.ts kpi-config-versioning.spec.ts
npm.cmd run test:scripts
git diff --check
```

Stop if:

- Any UI improvement requires changing scoring or approval semantics.

### PR-7: Checklist Templates + Competitions

Risk class: `R4 workflow authoring` plus `R5 workflow/scoring adjacency`

Goal: improve workflow authoring readability without changing authoring
contracts.

Primary files:

- `admin-web/src/pages/AdminChecklistTemplatesPage.tsx`
- `admin-web/src/pages/AdminChecklistTemplateSurface.tsx`
- `admin-web/src/pages/CompetitionDashboardPage.tsx`
- `admin-web/src/features/competitions/*`

UX direction:

- Reduce form/table chaos.
- Strengthen section and step structure.
- Clarify draft/publish/status state with existing fields only.
- Keep authoring surfaces compact and operational, not decorative.

Protected behavior:

- Do not change checklist answer types, score weights, low score thresholds,
  expectedValue payloads, company scope, save/publish/archive semantics,
  competition lifecycle transitions, scoring, finalization, stage execution,
  review, cancel, clone, access semantics, or payloads.

Verification:

```powershell
npm.cmd --prefix admin-web run lint
npm.cmd --prefix admin-web run build
npm.cmd --prefix admin-web run test:e2e -- checklist-template-surfaces.spec.ts competition-surfaces.spec.ts
npm.cmd run test:scripts
git diff --check
```

Stop if:

- A clearer authoring flow would require changing payload shape or state
  machine semantics.

### PR-8: Auth + Audit + Pilot Feedback

Risk class: `R5 auth/security` plus `R2 admin response`

Goal: make security, audit, and pilot feedback surfaces quiet, serious,
traceable, and trustworthy.

Primary files:

- `admin-web/src/pages/AuthDashboardPage.tsx`
- `admin-web/src/features/auth/*`
- `admin-web/src/pages/AuthCatalogPage.tsx`
- `admin-web/src/pages/AuthUserAuditPage.tsx`
- `admin-web/src/pages/AuthAssignmentAuditPage.tsx`
- `admin-web/src/pages/AuthActionStoreAssignmentAuditPage.tsx`
- `admin-web/src/pages/AuditCenterPage.tsx`
- `admin-web/src/pages/AdminPilotFeedbackPage.tsx`

UX direction:

- Clarify role/action visibility and audit trace.
- Keep security screens dense, sober, and explicit.
- Preserve correlation IDs and audit navigation.
- Improve pilot feedback classification readability without changing mutation
  behavior.

Protected behavior:

- Do not change auth commands, role assignment command shape,
  action-store assignment behavior, permission semantics, audit links,
  correlation IDs, search behavior, feedback status/classification values,
  response payloads, pagination, or filters.

Verification:

```powershell
npm.cmd --prefix admin-web run lint
npm.cmd --prefix admin-web run build
npm.cmd --prefix admin-web run test:e2e -- auth-admin-surfaces.spec.ts audit-surfaces.spec.ts pilot-feedback.spec.ts
npm.cmd --prefix admin-web run smoke:pilot
npm.cmd run test:scripts
git diff --check
```

Stop if:

- Auth or audit visibility semantics would change.

### PR-9: Parked Routes Decision

Risk class: `R0 docs/process` unless runtime work is explicitly justified by a
separate decision.

Goal: re-evaluate `/admin/session` and `/admin/feed` without forcing product UI.

Files:

- Create evidence:
  `docs/evidence/admin-operational-ux-v2-pr9-parked-routes-YYYY-MM-DD.md`
- Modify: `docs/plans/admin-operational-ux-v2-audit-matrix.md`
- Modify: `current-state.md` if parked status changes.

Steps:

- [ ] Inspect `/admin/session` and confirm whether diagnostic session/auth
  readiness remains the correct product stance.
- [ ] Inspect `/admin/feed` and confirm whether feed composer/write behavior is
  still too workflow-heavy for a polish-only PR.
- [ ] Keep each route parked with reason and trigger unless a separate product
  decision and behavior-preserving verification path exists.
- [ ] Run `npm.cmd run test:scripts`.
- [ ] Run `git diff --stat` and `git diff --check`.
- [ ] Open PR, request release-blocking Codex review, wait for checks, merge
  only when clean, and verify local `main` equals `origin/main`.

Stop if:

- Productization would require behavior, permissions, payload, or workflow
  changes.

### PR-10: Final Consistency And Closeout

Risk class: `R0 docs/process`

Goal: close Admin Operational UX V2 with evidence and remaining risk.

Files:

- Create:
  `docs/evidence/admin-operational-ux-v2-closeout-YYYY-MM-DD.md`
- Modify: `current-state.md`
- Modify: `docs/plans/admin-operational-ux-v2-plan.md`
- Modify: `docs/plans/admin-operational-ux-v2-audit-matrix.md`

Steps:

- [ ] Record merged PRs, route coverage, visual QA evidence, verification
  commands, old UI remnants removed, parked routes, and rollback posture.
- [ ] Run old class/copy scan for migrated Admin Operational UX V2 scope.
- [ ] Run admin UI guard and route parity guard through `npm.cmd run
  test:scripts`.
- [ ] Confirm no fake data/copy was added.
- [ ] Confirm all changed route groups have desktop and mobile visual evidence.
- [ ] Run `git diff --stat` and `git diff --check`.
- [ ] Open PR, request release-blocking Codex review, wait for checks, merge
  only when clean, and verify local `main` equals `origin/main`.

Stop if:

- Any improved route remains half-converted or lacks explicit parked evidence.

## Per-PR Operating Checklist

Every PR in this train must:

- [ ] Start from fresh `origin/main`.
- [ ] Use a `codex/` branch.
- [ ] Keep one review story.
- [ ] Confirm risk class and `Contract Impact`.
- [ ] Define what will not change.
- [ ] Implement only the PR scope.
- [ ] Use shadcn/ui, Tailwind v4, lucide-react, and existing AdminSurface
  primitives unless PR-2 justified a new shared primitive.
- [ ] Run PR-specific verification.
- [ ] Run `npm.cmd run test:scripts`.
- [ ] Run `git diff --stat`.
- [ ] Run `git diff --check`.
- [ ] Read every changed file.
- [ ] Capture desktop and mobile screenshots for changed routes.
- [ ] Check loading, empty, error, and access states when reachable.
- [ ] Search changed files for old UI remnants, fake data/copy, debug/handoff
  copy, and mixed old/new UI patterns.
- [ ] Perform release-blocking local self-review.
- [ ] Request Codex review in release-blocking mode.
- [ ] Merge only after checks are green, PR is mergeable, and Codex review is
  clean.
- [ ] After merge, verify local `main` equals `origin/main`.
- [ ] Continue to the next PR only after merge closeout is complete.

## Release-Blocking Review Prompt

Use this exact review prompt when requesting Codex review:

```text
Review this PR as a release-blocking reviewer. Focus only on P0 correctness bugs, P1 behavior drift, P1 contract changes, P1 auth/permission issues, P1 workflow/state transition regressions, P1 boundary violations, P1 rollback risks, P1 verification gaps and scope creep introduced by this PR. Ignore naming, style, formatting, alternative architecture suggestions, future refactor ideas, nice-to-have improvements, performance speculation without evidence, code that existed before this PR, parked risks, unrelated technical debt and out-of-scope domains. Do not propose improvements, new features or redesigns. Only identify actionable release-blocking defects introduced by this PR. If behavior is unchanged, rollback is safe, boundaries are respected and verification is sufficient, respond with exactly: "No major issues found."
```

## Stop Conditions

Stop immediately if:

- A behavior change is required.
- Fake data or unsupported metrics would be needed.
- API/auth/workflow/scoring/snapshot/import semantics would change.
- A product decision is needed.
- A PR gets too large or mixes risk groups.
- Verification fails.
- Role/navigation/access behavior drifts.
- Snapshot semantic golden output drifts.
- External input or secrets are required.
- Dirty files overlap the current PR scope.

## Success Definition

Admin Operational UX V2 is complete when:

- Every active admin route is improved or explicitly parked.
- Each improved page clearly answers what is happening, what is risky, what
  needs action, what can be safely done now, and what evidence supports it.
- High Decision Latency and weak Evidence Confidence findings are either
  improved, explicitly parked with a trigger, or recorded as a product/API
  follow-up without invented evidence.
- Typography, spacing, button tone, cards, icons, tables, filters, status
  panels, empty/error/access states, and mobile behavior are consistent.
- No fake data exists.
- No old UI remnants remain in migrated Admin Operational UX V2 scope except
  explicitly parked routes/files.
- API, DB, auth, permission, scoring, workflow, queue, import, snapshot, route,
  role, payload, polling, retry, status, approval, and business behavior are
  preserved.
- Desktop/mobile visual QA and closeout evidence are recorded.
- `current-state.md` points to the final closeout evidence.

## Execution Rule

Begin with PR-1 only. Do not change runtime code until the Admin UX Audit Matrix
and AdminSurface Primitive Usage Map are complete and merged.
