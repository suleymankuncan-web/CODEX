# Admin Pages Operational Prototype Parity V1 Route Baseline

Date: 2026-06-30

Branch: `codex/admin-pages-operational-pr0`

Risk class: `R0 docs/process`

## Decision

The Admin Pages Operational Prototype Parity Train starts as a docs/evidence
baseline before runtime UI work. Runtime work begins in the next PR with the
Operations, Inbox, and Data Quality route group.

This evidence locks the route inventory, role baseline, parked route decisions,
and verification expectations used by
`docs/superpowers/plans/2026-06-30-admin-pages-operational-prototype-parity-train-v1.md`.

## Sources Read

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
- `admin-web/src/app/admin-navigation.ts`
- `admin-web/src/app/admin-shell.tsx`
- Existing admin e2e/spec file names under `admin-web/e2e`

## Route And Role Baseline

Authoritative current route wiring is in `admin-web/src/app/admin-shell.tsx`.
Navigation visibility is in `admin-web/src/app/admin-navigation.ts`. The older
route/role inventory remains in
`docs/plans/admin-ui-modernization-v1-inventory.md`, and the V2 intent/risk
matrix remains in `docs/plans/admin-operational-ux-v2-audit-matrix.md`.

| Route group | Routes | Page file(s) | Roles | Existing verification |
| --- | --- | --- | --- | --- |
| Operations | `/admin/operations` | `OperationsControlTowerPage.tsx`, `operations-*.tsx` | `SUPER_ADMIN` | `operations-control-tower.spec.ts`, `operations-surfaces.spec.ts` |
| Workflow Inbox | `/admin/inbox` | `AdminInboxPage.tsx` | `SUPER_ADMIN`, `REPORT_VIEWER`, `HR_ADMIN` | `admin-surfaces.spec.ts`, workflow coverage in existing e2e |
| Data Quality | `/admin/data-quality` | `AdminDataQualityCenterPage.tsx` | `SUPER_ADMIN` | `data-quality-center.spec.ts`, `admin-surfaces.spec.ts` |
| Integrations | `/admin/integrations`, `/admin/integrations/:batchId` | `IntegrationDashboardPage.tsx`, `ImportBatchDetailPage.tsx` | `SUPER_ADMIN`, `INTEGRATION_ADMIN` | `integration-surfaces.spec.ts`, `integration-retry-contracts.spec.ts`, `integration-upload-csrf.spec.ts` |
| Master Data | `/admin/master-data`, `/admin/master-data/:batchId` | `MasterDataBootstrapPage.tsx` | `SUPER_ADMIN`, `HR_ADMIN`, `INTEGRATION_ADMIN` | `master-data-surfaces.spec.ts`, `integration-surfaces.spec.ts`, `pilot-api-contracts.spec.ts` |
| Snapshots | `/admin/snapshots`, `/admin/snapshots/:snapshotRunId` | `SnapshotsDashboardPage.tsx`, `SnapshotRunDetailPage.tsx` | `SUPER_ADMIN`, `SNAPSHOT_OPERATOR` | `snapshots-surfaces.spec.ts`, snapshot status golden fixtures |
| Reports | `/admin/reports`, `/admin/reports/snapshot-runs`, `/admin/reports/workforce/:snapshotRunId`, `/admin/reports/kpis/:snapshotRunId`, `/admin/reports/checklists/:snapshotRunId`, `/admin/reports/turnover/:snapshotRunId` | `ReportsSummaryPage.tsx`, `ReportsSnapshotRunsPage.tsx`, report detail pages | `SUPER_ADMIN`, `REPORT_VIEWER` | `reports-surfaces.spec.ts`, `kpi-config-versioning.spec.ts` |
| Targets | `/admin/targets` | `TargetApprovalQueuePage.tsx` | `SUPER_ADMIN`, `REPORT_VIEWER`, `REGION_MANAGER` | `admin-targets.spec.ts`, `admin-targets-surfaces.spec.ts` |
| Incentives | `/admin/incentives` | `AdminIncentivesPage.tsx` | `SUPER_ADMIN` | `admin-web/e2e/test-fixtures.ts` covers admin incentive API mocks; targeted coverage should be checked before runtime PR |
| KPI Config | `/admin/kpi-config` | `AdminKpiConfigPage.tsx`, `admin-kpi-config-surface-primitives.tsx` | `SUPER_ADMIN` | `admin-kpi-config.spec.ts`, `kpi-config-surfaces.spec.ts`, `kpi-config-versioning.spec.ts` |
| Checklist Templates | `/admin/checklists` | `AdminChecklistTemplatesPage.tsx`, `AdminChecklistTemplateSurface.tsx` | `SUPER_ADMIN`, `HR_ADMIN` | `checklist-template-surfaces.spec.ts`, `admin-routing.spec.ts` |
| Competitions | `/admin/competitions` | `CompetitionDashboardPage.tsx`, `features/competitions/*` | `SUPER_ADMIN`, `HR_ADMIN`, `REPORT_VIEWER`, `REGION_MANAGER` | `competition-surfaces.spec.ts` |
| Auth Admin | `/admin/auth`, `/admin/auth/catalog`, `/admin/auth/users/:userId/audit`, `/admin/auth/role-assignments/:assignmentId/audit`, `/admin/auth/action-store-assignments/:assignmentId/audit` | `AuthDashboardPage.tsx`, `AuthCatalogPage.tsx`, auth audit detail pages | `SUPER_ADMIN` | `auth-admin-surfaces.spec.ts`, `admin-routing.spec.ts` |
| Audit | `/admin/audit`, `/admin/audit/users/:userId/audit`, `/admin/audit/role-assignments/:assignmentId/audit`, `/admin/audit/action-store-assignments/:assignmentId/audit` | `AuditCenterPage.tsx`, auth audit detail pages | `SUPER_ADMIN`, `AUDITOR` | `audit-surfaces.spec.ts`, `admin-routing.spec.ts`, `auth-admin-surfaces.spec.ts` |
| Pilot Feedback | `/admin/pilot-feedback` | `AdminPilotFeedbackPage.tsx` | `SUPER_ADMIN` | `pilot-feedback.spec.ts`, `admin-surfaces.spec.ts` |
| Admin Feed | `/admin/feed` | `AdminFeedPage.tsx` | `SUPER_ADMIN`, `HR_ADMIN`, `REGION_MANAGER` | `feed-surfaces.spec.ts`; reopened and modernized in PR7 |
| Session Readiness | `/admin/session` | `SessionReadinessPage.tsx`, `SessionGate` | unguarded diagnostic route | `admin-routing.spec.ts`, `auth-cookie-session.spec.ts`; parked diagnostic route |

## Parked Route Decisions

### `/admin/feed`

Status: reopened and modernized in PR7.

Reason:

- Prior V1/V2 evidence explicitly parked it because composer/write behavior
  includes publish, pin, unpin, archive, visibility, role-scope defaults, query
  invalidation, and Store Feed visibility.
- PR7 reopened it as a dedicated feed workflow PR, preserved the behavior
  contract, and verified it with `feed-surfaces.spec.ts`.

Reopen gate satisfied by PR7:

- Read `AdminFeedPage.tsx` and `features/feed/api.ts`.
- Freeze existing payloads and mutation semantics.
- Run or extend `feed-surfaces.spec.ts`.
- Treat any publish/pin/archive payload change as behavior-adjacent.

### `/admin/session`

Status: parked diagnostic route.

Reason:

- Prior V1/V2 evidence intentionally kept diagnostic session/auth readiness
  language and setup behavior out of product UI migration.
- It is not a product admin work surface unless explicitly productized.

Reopen gate:

- User explicitly asks to convert session readiness into a product admin
  settings/readiness surface.
- Diagnostic mock/bearer/header copy is removed or translated.
- `admin-routing.spec.ts` and auth/session route tests remain green.

## PR0 Plan Review

No blocking plan concern was found for PR0.

Non-blocking notes for later runtime PRs:

- The PR train is large. Each route group must split further if it stops having
  one review story.
- Operations is a fanout-heavy read surface. PR1 must not add new data reads or
  polling.
- Incentives currently has less obvious dedicated e2e naming than other admin
  routes. PR4 must identify existing targeted coverage or add narrow coverage
  before runtime changes.
- Feed was reopened in PR7 with behavior-preserving composer coverage.

## Behavior Freeze

The train must preserve:

- API response shapes and frontend payloads.
- Auth, role, scope, and route guard behavior.
- DB schema and migrations.
- Import upload, retry, reconciliation, and promotion behavior.
- Snapshot run, rerun, dependency, lineage, and report semantics.
- KPI scoring, ranking, checklist weights, and competition lifecycle behavior.
- Target and incentive approval semantics.
- Feed publish/pin/archive behavior was owned by PR7 and stayed behavior-preserving.

## Verification For This PR

Required:

```powershell
git diff --check
```

Optional broader docs guard if the PR later adds script/process changes:

```powershell
npm.cmd run test:scripts
```

Runtime UI, API, DB, and generated client checks are not required for this
docs-only baseline PR.
