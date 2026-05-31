# Admin UI Modernization V1 Closeout

Date: 2026-05-31
Status: closed with explicit parked routes
Plan: `docs/plans/admin-ui-modernization-v1-plan.md`
Inventory baseline: `docs/plans/admin-ui-modernization-v1-inventory.md`

## Scope Closed

Admin UI Modernization V1 moved active admin surfaces onto the AdminSurface
primitive system while preserving route, role, API, workflow, scoring,
snapshot, import, approval, and auth semantics.

Merged PR train:

| PR | Merge commit | Scope |
| --- | --- | --- |
| #588 | `147810b0` | PR-1 route intent and contract inventory |
| #589 | `ede6a7e1` | PR-2 shell foundation and route/navigation parity guard |
| #590 | `0b015c58` | PR-3 low-risk read surfaces |
| #591 | `66244326` | PR-4 reporting surfaces |
| #592 | `6aaa3759` | PR-5 operations surface |
| #593 | `cbdc35dd` | PR-6 auth and audit surfaces |
| #594 | `a9884331` | PR-7 integration surfaces |
| #595 | `df8a04e2` | PR-8 master data and snapshot surfaces |
| #596 | `312a4126` | PR-9 checklist template surface |
| #597 | `d778ba38` | PR-10 target approval queue |
| #598 | `6df9f9c1` | PR-11 KPI config governance surface |
| #599 | `9bb056d9` | PR-12 competitions surface |
| #600 | `33340f97` | PR-13 AdminSurface primitive guard |

This closeout PR is docs/process only.

## Route Coverage

The PR-1 inventory baseline contains 31 active `/admin/*` routes and 16 admin
navigation items.

Migrated or guard-covered route groups:

- Operations: `/admin/operations`
- Data quality: `/admin/data-quality`
- Integrations: `/admin/integrations`, `/admin/integrations/:batchId`
- Master data: `/admin/master-data`, `/admin/master-data/:batchId`
- Snapshots: `/admin/snapshots`, `/admin/snapshots/:snapshotRunId`
- Inbox: `/admin/inbox`
- Checklist templates: `/admin/checklists`
- Competitions: `/admin/competitions`
- Reports: `/admin/reports`, `/admin/reports/snapshot-runs`,
  `/admin/reports/workforce/:snapshotRunId`,
  `/admin/reports/kpis/:snapshotRunId`,
  `/admin/reports/checklists/:snapshotRunId`,
  `/admin/reports/turnover/:snapshotRunId`
- Targets: `/admin/targets`
- KPI config: `/admin/kpi-config`
- Pilot feedback: `/admin/pilot-feedback`
- Auth admin: `/admin/auth`, `/admin/auth/catalog`,
  `/admin/auth/users/:userId/audit`,
  `/admin/auth/role-assignments/:assignmentId/audit`,
  `/admin/auth/action-store-assignments/:assignmentId/audit`
- Audit center: `/admin/audit`, `/admin/audit/users/:userId/audit`,
  `/admin/audit/role-assignments/:assignmentId/audit`,
  `/admin/audit/action-store-assignments/:assignmentId/audit`

Explicitly parked active admin routes:

| Route | Page | Reason | Reopen trigger |
| --- | --- | --- | --- |
| `/admin/session` | `admin-web/src/pages/SessionReadinessPage.tsx` | Diagnostic session/auth readiness surface still owns existing mock/bearer/header setup language. | Session/auth readiness is redesigned as a production admin page or the diagnostic copy is removed from the route. |
| `/admin/feed` | `admin-web/src/pages/AdminFeedPage.tsx` | Feed composer/write behavior was intentionally kept out of the read-surface PR to avoid changing publish/pin/archive workflow semantics. | A behavior-preserving feed composer modernization PR is opened with targeted feed workflow verification. |

## Evidence Index

- PR-2 route/navigation parity:
  `docs/evidence/admin-ui-modernization-v1-pr2-route-parity-2026-05-31.md`
- PR-3 visual QA:
  `docs/evidence/admin-ui-modernization-v1-pr3-visual-qa-2026-05-31.md`
- PR-4 visual QA:
  `docs/evidence/admin-ui-modernization-v1-pr4-reporting-visual-qa-2026-05-31.md`
- PR-5 visual QA:
  `docs/evidence/admin-ui-modernization-v1-pr5-operations-visual-qa-2026-05-31.md`
- PR-6 visual QA:
  `docs/evidence/admin-ui-modernization-v1-pr6-auth-audit-visual-qa-2026-05-31.md`
- PR-7 visual QA:
  `docs/evidence/admin-ui-modernization-v1-pr7-integration-visual-qa-2026-05-31.md`
- PR-8 snapshot semantic golden:
  `docs/evidence/admin-ui-modernization-v1-pr8-snapshot-golden-2026-05-31.md`
- PR-9 visual QA:
  `docs/evidence/admin-ui-modernization-v1-pr9-checklist-templates-visual-qa-2026-05-31.md`
- PR-10 visual QA:
  `docs/evidence/admin-ui-modernization-v1-pr10-targets-visual-qa-2026-05-31.md`
- PR-11 visual QA:
  `docs/evidence/admin-ui-modernization-v1-pr11-kpi-config-visual-qa-2026-05-31.md`
- PR-12 visual QA:
  `docs/evidence/admin-ui-modernization-v1-pr12-competitions-visual-qa-2026-05-31.md`
- PR-13 primitive guard:
  `docs/evidence/admin-ui-modernization-v1-pr13-admin-ui-guard-2026-05-31.md`

## Old UI Remnants

Migrated admin route files are guarded against:

- `dashboard-primitives` imports
- old hero/metric layout classes such as `hero-panel`, `hero-metrics`, and
  `metric-card`
- fake admin metrics/data/workflow/copy
- debug/handoff product copy
- parallel admin primitive helper sets that do not import shared
  `AdminSurface*` primitives

Remaining old UI patterns are intentional and outside the migrated admin
surface set:

- `admin-web/src/pages/SessionReadinessPage.tsx` - parked diagnostic admin
  route.
- `admin-web/src/pages/AdminFeedPage.tsx` - parked feed composer/write route.
- Auth callback/logout/session helper files outside the active migrated admin
  route matrix.
- Store routes and parked Store incentives work outside Admin UI
  Modernization V1.

## Verification

Closeout verification:

```powershell
npm.cmd run test:scripts
git diff --check
```

The PR train also ran PR-specific gates including admin lint/build, targeted
Playwright specs, route/navigation parity guard, snapshot semantic golden
fixture, AdminSurface primitive guard, Vercel checks, release rehearsal, and
release check on the respective PRs.

## Rollback Posture

Rollback is PR-local:

- Inventory/plan/evidence PRs can be reverted without runtime behavior impact.
- UI migration PRs were scoped by route group and preserved API/workflow
  contracts.
- PR-13 guard rollback would remove enforcement only; it does not alter runtime
  UI behavior.

No migration, data repair, queue drain, auth permission change, scoring change,
snapshot interpretation change, import lifecycle change, or approval workflow
change is required to roll back this train.

## Remaining Risks

- `/admin/feed` still needs a dedicated composer/write modernization PR before
  it can leave the exception allowlist.
- `/admin/session` remains a diagnostic surface and should not be made to look
  like an operational production page until the session/auth readiness workflow
  is deliberately re-scoped.
- Future admin routes must update the PR-1 inventory baseline and satisfy the
  AdminSurface primitive guard before merge.
