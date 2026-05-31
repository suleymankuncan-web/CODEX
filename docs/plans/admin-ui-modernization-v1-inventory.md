# Admin UI Modernization V1 Inventory

Status: PR-1 route intent and contract freeze
Date: 2026-05-31
Source plan: `docs/plans/admin-ui-modernization-v1-plan.md`

This document is the baseline for the Admin UI Modernization V1 PR train. It
freezes the active `/admin/*` route graph, role visibility, navigation
visibility, data sources, state expectations, and migration risk before any
runtime UI refactor starts.

## Guardrails

- Runtime code is unchanged by this inventory.
- API request/response shapes, DB schema, auth/permission semantics, scoring,
  snapshot interpretation, import lifecycle, approval workflows, and route
  behavior must stay unchanged during UI migration PRs.
- Converted admin pages must use shadcn/ui, Tailwind v4, lucide icons, and the
  AdminSurface primitive layer introduced in PR-2.
- Existing Store UI, user prototypes, `.agents`, and parked Store incentives
  decisions are outside this train.
- Any missing data must render loading, empty, error, or access states. Do not
  invent admin metrics or fake operational copy.

## Route Role Baseline

The following block is intentionally stable and parseable enough for the PR-2
route/navigation parity guard.

```json
{
  "routes": [
    { "path": "/admin/session", "page": "SessionReadinessPage", "roles": [], "navId": "session", "navVisible": true },
    { "path": "/admin/operations", "page": "OperationsControlTowerPage", "roles": ["SUPER_ADMIN"], "navId": "operations", "navVisible": true },
    { "path": "/admin/data-quality", "page": "AdminDataQualityCenterPage", "roles": ["SUPER_ADMIN"], "navId": "dataQuality", "navVisible": true },
    { "path": "/admin/integrations", "page": "IntegrationDashboardPage", "roles": ["SUPER_ADMIN", "INTEGRATION_ADMIN"], "navId": "integrations", "navVisible": true },
    { "path": "/admin/integrations/:batchId", "page": "ImportBatchDetailPage", "roles": ["SUPER_ADMIN", "INTEGRATION_ADMIN"], "navId": null, "navVisible": false },
    { "path": "/admin/master-data", "page": "MasterDataBootstrapPage", "roles": ["SUPER_ADMIN", "HR_ADMIN", "INTEGRATION_ADMIN"], "navId": "masterData", "navVisible": true },
    { "path": "/admin/master-data/:batchId", "page": "MasterDataBootstrapPage", "roles": ["SUPER_ADMIN", "HR_ADMIN", "INTEGRATION_ADMIN"], "navId": null, "navVisible": false },
    { "path": "/admin/snapshots", "page": "SnapshotsDashboardPage", "roles": ["SUPER_ADMIN", "SNAPSHOT_OPERATOR"], "navId": "snapshots", "navVisible": true },
    { "path": "/admin/snapshots/:snapshotRunId", "page": "SnapshotRunDetailPage", "roles": ["SUPER_ADMIN", "SNAPSHOT_OPERATOR"], "navId": null, "navVisible": false },
    { "path": "/admin/inbox", "page": "AdminInboxPage", "roles": ["SUPER_ADMIN", "REPORT_VIEWER", "HR_ADMIN"], "navId": "inbox", "navVisible": true },
    { "path": "/admin/feed", "page": "AdminFeedPage", "roles": ["SUPER_ADMIN", "HR_ADMIN", "REGION_MANAGER"], "navId": "feed", "navVisible": true },
    { "path": "/admin/checklists", "page": "AdminChecklistTemplatesPage", "roles": ["SUPER_ADMIN", "HR_ADMIN"], "navId": "checklists", "navVisible": true },
    { "path": "/admin/competitions", "page": "CompetitionDashboardPage", "roles": ["SUPER_ADMIN", "HR_ADMIN", "REPORT_VIEWER", "REGION_MANAGER"], "navId": "competitions", "navVisible": true },
    { "path": "/admin/reports", "page": "ReportsSummaryPage", "roles": ["SUPER_ADMIN", "REPORT_VIEWER"], "navId": "reports", "navVisible": true },
    { "path": "/admin/reports/snapshot-runs", "page": "ReportsSnapshotRunsPage", "roles": ["SUPER_ADMIN", "REPORT_VIEWER"], "navId": null, "navVisible": false },
    { "path": "/admin/reports/workforce/:snapshotRunId", "page": "ReportsWorkforcePage", "roles": ["SUPER_ADMIN", "REPORT_VIEWER"], "navId": null, "navVisible": false },
    { "path": "/admin/reports/kpis/:snapshotRunId", "page": "ReportsKpisPage", "roles": ["SUPER_ADMIN", "REPORT_VIEWER"], "navId": null, "navVisible": false },
    { "path": "/admin/reports/checklists/:snapshotRunId", "page": "ReportsChecklistsPage", "roles": ["SUPER_ADMIN", "REPORT_VIEWER"], "navId": null, "navVisible": false },
    { "path": "/admin/reports/turnover/:snapshotRunId", "page": "ReportsTurnoverPage", "roles": ["SUPER_ADMIN", "REPORT_VIEWER"], "navId": null, "navVisible": false },
    { "path": "/admin/targets", "page": "TargetApprovalQueuePage", "roles": ["SUPER_ADMIN", "REPORT_VIEWER", "REGION_MANAGER"], "navId": "targets", "navVisible": true },
    { "path": "/admin/kpi-config", "page": "AdminKpiConfigPage", "roles": ["SUPER_ADMIN"], "navId": "kpiConfig", "navVisible": true },
    { "path": "/admin/pilot-feedback", "page": "AdminPilotFeedbackPage", "roles": ["SUPER_ADMIN"], "navId": "pilotFeedback", "navVisible": true },
    { "path": "/admin/auth", "page": "AuthDashboardPage", "roles": ["SUPER_ADMIN"], "navId": "auth", "navVisible": true },
    { "path": "/admin/auth/catalog", "page": "AuthCatalogPage", "roles": ["SUPER_ADMIN"], "navId": null, "navVisible": false },
    { "path": "/admin/auth/users/:userId/audit", "page": "AuthUserAuditPage", "roles": ["SUPER_ADMIN"], "navId": null, "navVisible": false },
    { "path": "/admin/auth/role-assignments/:assignmentId/audit", "page": "AuthAssignmentAuditPage", "roles": ["SUPER_ADMIN"], "navId": null, "navVisible": false },
    { "path": "/admin/auth/action-store-assignments/:assignmentId/audit", "page": "AuthActionStoreAssignmentAuditPage", "roles": ["SUPER_ADMIN"], "navId": null, "navVisible": false },
    { "path": "/admin/audit", "page": "AuditCenterPage", "roles": ["SUPER_ADMIN", "AUDITOR"], "navId": "audit", "navVisible": true },
    { "path": "/admin/audit/users/:userId/audit", "page": "AuthUserAuditPage", "roles": ["SUPER_ADMIN", "AUDITOR"], "navId": null, "navVisible": false },
    { "path": "/admin/audit/role-assignments/:assignmentId/audit", "page": "AuthAssignmentAuditPage", "roles": ["SUPER_ADMIN", "AUDITOR"], "navId": null, "navVisible": false },
    { "path": "/admin/audit/action-store-assignments/:assignmentId/audit", "page": "AuthActionStoreAssignmentAuditPage", "roles": ["SUPER_ADMIN", "AUDITOR"], "navId": null, "navVisible": false }
  ],
  "navigation": [
    { "id": "operations", "to": "/admin/operations", "roles": ["SUPER_ADMIN"] },
    { "id": "dataQuality", "to": "/admin/data-quality", "roles": ["SUPER_ADMIN"] },
    { "id": "integrations", "to": "/admin/integrations", "roles": ["SUPER_ADMIN", "INTEGRATION_ADMIN"] },
    { "id": "masterData", "to": "/admin/master-data", "roles": ["SUPER_ADMIN", "HR_ADMIN", "INTEGRATION_ADMIN"] },
    { "id": "snapshots", "to": "/admin/snapshots", "roles": ["SUPER_ADMIN", "SNAPSHOT_OPERATOR"] },
    { "id": "inbox", "to": "/admin/inbox", "roles": ["SUPER_ADMIN", "REPORT_VIEWER", "HR_ADMIN"] },
    { "id": "feed", "to": "/admin/feed", "roles": ["SUPER_ADMIN", "HR_ADMIN", "REGION_MANAGER"] },
    { "id": "checklists", "to": "/admin/checklists", "roles": ["SUPER_ADMIN", "HR_ADMIN"] },
    { "id": "competitions", "to": "/admin/competitions", "roles": ["SUPER_ADMIN", "HR_ADMIN", "REPORT_VIEWER", "REGION_MANAGER"] },
    { "id": "reports", "to": "/admin/reports", "roles": ["SUPER_ADMIN", "REPORT_VIEWER"] },
    { "id": "targets", "to": "/admin/targets", "roles": ["SUPER_ADMIN", "REPORT_VIEWER", "REGION_MANAGER"] },
    { "id": "kpiConfig", "to": "/admin/kpi-config", "roles": ["SUPER_ADMIN"] },
    { "id": "pilotFeedback", "to": "/admin/pilot-feedback", "roles": ["SUPER_ADMIN"] },
    { "id": "auth", "to": "/admin/auth", "roles": ["SUPER_ADMIN"] },
    { "id": "audit", "to": "/admin/audit", "roles": ["SUPER_ADMIN", "AUDITOR"] },
    { "id": "session", "to": "/admin/session", "roles": [] }
  ],
  "rolesForParityMatrix": [
    "SUPER_ADMIN",
    "HR_ADMIN",
    "INTEGRATION_ADMIN",
    "SNAPSHOT_OPERATOR",
    "REPORT_VIEWER",
    "REGION_MANAGER",
    "AUDITOR",
    "NO_SPECIAL_ADMIN_ROLE"
  ]
}
```

## Route Intent Matrix

| Surface | Routes | Page file(s) | Purpose | Roles/persona | Real data/query evidence | Primary action | Required states | Risk | Old UI remnants | Verification target | Protected behavior |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Session | `/admin/session` | `admin-web/src/pages/SessionReadinessPage.tsx`; rendered through `SessionGate` | Choose or inspect local session mode and auth readiness. | All authenticated users; development/operator session setup. | `getAuthSession`; `features/session/session-storage`; local session context. | Save/update session mode and headers/token. | loading, rejected auth, setup-required, invalid session form. | R1 shell/state | `dashboard-primitives`, `hero-panel`, session mock wording is existing diagnostic copy. | `admin-routing.spec.ts`; PR-2 shell screenshots. | Do not change mock/bearer storage, return path, auth recovery, or first allowed route behavior. |
| Operations | `/admin/operations` | `OperationsControlTowerPage.tsx`; `operations-*.tsx`; `operations-*-model.ts` | Read operational health, freshness, workflow, workforce, ranking, and data-quality signals. | `SUPER_ADMIN`. | `getOperationsHealth`, `getImportOverview`, `getNeedsAction`, `getSnapshotOverview`, `getSnapshotNeedsAction`, `getKpiConfig`, `getRankings`, workforce/workflow queries; prefetch `getAdminOperationsPrefetchTasks`. | Inspect health signals and follow existing links/actions. | loading, API error, empty signal lists, stale/needs-action states. | R2 read dashboard | `dashboard-primitives`, `operations-hero`, `hero-panel`, `MetricAccent`, `StatusPill`. | `operations-control-tower.spec.ts`. | Do not change thresholds, freshness calculations, signal priority, or status mapping. |
| Data quality | `/admin/data-quality` | `AdminDataQualityCenterPage.tsx` | Read cross-domain data quality queues and blockers. | `SUPER_ADMIN`. | Import/snapshot needs-action, seller-code/offboarding pending queries, KPI config, rankings; prefetch `getAdminDataQualityPrefetchTasks`. | Inspect queue items and navigate to source workflows. | loading, API error, empty queue, unavailable overview. | R2 read dashboard | `dashboard-primitives`, `hero-panel`, `hero-metrics`. | `data-quality-center.spec.ts`. | Do not change data-quality classification, queue limits, or source links. |
| Integrations | `/admin/integrations`; `/admin/integrations/:batchId` | `IntegrationDashboardPage.tsx`; `ImportBatchDetailPage.tsx` | Manage import overview, payload template creation/upload, queue review, retry/detail investigation. | `SUPER_ADMIN`, `INTEGRATION_ADMIN`. | `getImportOverview`, `getNeedsAction`, `getIntegrationLookups`, `getImportPayloadTemplate`, batch detail APIs; prefetch `getAdminIntegrationsPrefetchTasks`. | Upload/create import evidence, inspect batch, retry or navigate to detail where existing UI allows. | loading, upload pending, error, empty queue, detail not found, source governance states. | R4 import workflow | `dashboard-primitives`, `hero-panel`, `hero-panel-detail`, `ScreenState`. | `integration-surfaces.spec.ts`. | Do not change upload payloads, source selection, retry behavior, polling, JSON/Power BI/Excel governance wording, or lineage evidence meaning. |
| Master data | `/admin/master-data`; `/admin/master-data/:batchId` | `MasterDataBootstrapPage.tsx`; `master-data-bootstrap-model.ts` | Validate and promote master-data bootstrap batches. | `SUPER_ADMIN`, `HR_ADMIN`, `INTEGRATION_ADMIN`. | `getMasterDataBootstrapBatches` plus bootstrap validation/promotion APIs; prefetch `getAdminMasterDataPrefetchTasks`. | Inspect batch, validate, promote, or review affected entities. | loading, empty batch list, validation error, promotion pending, batch detail missing. | R4/R5 workflow/import lifecycle | `dashboard-primitives`, old panels, large workflow shell. | Master-data targeted tests/e2e before migration. | Do not change validation/promotion semantics, batch status mapping, source evidence, transaction expectations, or route params. |
| Snapshots | `/admin/snapshots`; `/admin/snapshots/:snapshotRunId` | `SnapshotsDashboardPage.tsx`; `SnapshotRunDetailPage.tsx` | Monitor snapshot health, daily closure, reruns, and run detail. | `SUPER_ADMIN`, `SNAPSHOT_OPERATOR`. | `getSnapshotOverview`, `getDailyClosureStatus`, `getSnapshotNeedsAction`, `runDailyClosure`, `rerunSnapshotRun`, snapshot detail APIs. | Queue daily closure or rerun only through existing enabled actions. | loading, queue error, daily closure unavailable, empty needs-action queue, run detail missing. | R5 snapshot workflow | `dashboard-primitives`, `hero-panel`, `hero-panel-detail`, metric cards. | PR-8 snapshot semantic golden fixture plus snapshot e2e. | Do not change status labels, badge tones, action enabled/disabled logic, detail visibility, rerun payloads, or daily closure behavior. |
| Inbox | `/admin/inbox` | `AdminInboxPage.tsx`; `WorkflowInboxDetail` | Review workflow inbox plus workforce seller-code/offboarding approvals. | `SUPER_ADMIN`, `REPORT_VIEWER`, `HR_ADMIN`; workforce actions depend on existing auth helper behavior. | `getWorkflowInbox`, seller-code reference, seller-code/offboarding request APIs; prefetch `getAdminInboxPrefetchTasks`. | Approve/reject workforce requests where existing permission allows; inspect workflow detail. | loading, API error, empty inbox, permission-disabled actions. | R2/R4 action queue | `dashboard-primitives`, `hero-panel`, `hero-metrics`. | `admin-inbox.spec.ts`; auth/workforce targeted checks if actions move. | Do not change approval/rejection payloads, invalidation keys, status transition copy, or action permission checks. |
| Feed | `/admin/feed` | `AdminFeedPage.tsx` | Create, publish, pin, unpin, archive and filter admin feed posts. | `SUPER_ADMIN`, `HR_ADMIN`, `REGION_MANAGER`. | `getAdminFeedPosts`, `getAuthLookups`, feed mutations; prefetch `getAdminFeedPrefetchTasks`. | Create or manage post state with existing controls. | loading, lookup error, feed error, empty posts, mutation pending. | R2/R4 if composer changes | `dashboard-primitives`, `hero-panel`, `hero-metrics`. | `feed-surfaces.spec.ts`. | Do not change target audience payload, publish/pin/archive mutations, route placeholders, or visible feed invalidation. |
| Checklist templates | `/admin/checklists` | `AdminChecklistTemplatesPage.tsx` | Author BM/VM checklist templates and publish them. | `SUPER_ADMIN`, `HR_ADMIN`. | `createAdminChecklistTemplate`, `publishAdminChecklistTemplate`; company scope from auth summary. | Edit template draft, save, publish. | missing company scope, invalid score/weight, mutation pending, publish error. | R4 workflow authoring | Local draft seed data exists as current authoring starter state; no `dashboard-primitives` import, but old custom form/table classes remain. | Checklist template e2e/characterization before PR-9. | Do not change answer types, score weights, low score thresholds, expectedValue payload, company scope, save/publish/archive semantics, or backend payload shape. |
| Competitions | `/admin/competitions` | `CompetitionDashboardPage.tsx`; `features/competitions/*` | Manage competition creation, teams, stages, stage package plans, and rankings display. | `SUPER_ADMIN`, `HR_ADMIN`, `REPORT_VIEWER`, `REGION_MANAGER`. | `listCompetitions`, competition detail/mutation APIs; prefetch `getAdminCompetitionsPrefetchTasks`. | Create/update competition entities and inspect results through existing controls. | loading, empty competition list, mutation error, read-only role constraints. | R4/R5 workflow/scoring adjacency | `dashboard-primitives`, `hero-panel`, `metric-card`. | `competition-surfaces.spec.ts` plus backend competition tests if behavior-adjacent. | Do not change lifecycle transitions, scoring, finalization, stage execution, review, cancel, clone, access semantics, or payloads. |
| Reports | `/admin/reports`; `/admin/reports/snapshot-runs`; `/admin/reports/workforce/:snapshotRunId`; `/admin/reports/kpis/:snapshotRunId`; `/admin/reports/checklists/:snapshotRunId`; `/admin/reports/turnover/:snapshotRunId` | `ReportsSummaryPage.tsx`; `ReportsSnapshotRunsPage.tsx`; `ReportsWorkforcePage.tsx`; `ReportsKpisPage.tsx`; `ReportsChecklistsPage.tsx`; `ReportsTurnoverPage.tsx` | Browse snapshot runs and read workforce, KPI, checklist, and turnover reports. | `SUPER_ADMIN`, `REPORT_VIEWER`. | `getReportingSummary`, `getReportingSnapshotRuns`, `getWorkforceReport`, `getKpiReport`, `getChecklistReport`, `getTurnoverReport`. | Select/read report detail; export/download where existing tools allow. | loading, API error, no snapshot run, empty report rows, invalid route param. | R2 read/reporting | `dashboard-primitives`, `hero-panel`, `hero-metrics`, `ReportingToolbar`. | Reporting e2e or page-specific targeted specs. | Do not change report calculations, labels, snapshot route params, CSV/export meaning, or API response interpretation. |
| Targets | `/admin/targets` | `TargetApprovalQueuePage.tsx` | Review target distribution coverage and approve pending target requests. | `SUPER_ADMIN`, `REPORT_VIEWER`, `REGION_MANAGER`; action enabled by existing auth helpers. | `getAllTargetDistributionRequests`, `getTargetCoverage`, `approveTargetDistributionRequest`; prefetch `getAdminTargetsPrefetchTasks`. | Approve pending target request when allowed. | loading, error, empty pending queue, coverage loading/error, disabled unauthorized action. | R4 approval workflow | `dashboard-primitives`, `hero-panel`, `MetricCard`. | `admin-targets.spec.ts`; future `admin-targets-surfaces.spec.ts`. | Do not change approve payloads, note handling, status labels, request month handling, coverage summary, or permission checks. |
| KPI config | `/admin/kpi-config` | `AdminKpiConfigPage.tsx` | Govern KPI config version, weights, audit, save, and publish. | `SUPER_ADMIN`. | `getKpiConfigEditor`, `getKpiConfigAudit`, save/publish KPI config APIs. | Save draft config and publish active version. | loading, config/audit error, validation error, mutation pending. | R5 scoring/config | `dashboard-primitives`, `hero-panel`, `hero-metrics`. | `admin-kpi-config.spec.ts`; `kpi-config-versioning.spec.ts`; backend scoring specs. | Do not change scoring math, contribution weights, active version semantics, validation, default config, backend DTOs, or publish payloads. |
| Pilot feedback | `/admin/pilot-feedback` | `AdminPilotFeedbackPage.tsx` | Review and classify pilot feedback. | `SUPER_ADMIN`. | `listPilotFeedback`, classify/respond pilot feedback APIs. | Classify or respond using existing mutation. | loading, error, empty list, mutation pending. | R2 read/admin response | `dashboard-primitives`, `hero-panel`, `hero-metrics`. | `pilot-feedback.spec.ts`. | Do not change feedback status/classification values, response payloads, pagination, or filters. |
| Auth admin | `/admin/auth`; `/admin/auth/catalog`; `/admin/auth/users/:userId/audit`; `/admin/auth/role-assignments/:assignmentId/audit`; `/admin/auth/action-store-assignments/:assignmentId/audit` | `AuthDashboardPage.tsx`; `AuthDashboardSections.tsx`; `AuthCatalogPage.tsx`; auth audit detail pages | Manage auth users, role/action-store assignments, catalog permissions, and audit detail. | `SUPER_ADMIN`. | `getAuthLookups`, user/account/role/permission/action-store APIs, audit APIs. | Create/update auth assignments and inspect audit trail. | loading, lookup error, mutation error, empty users/assignments, audit detail missing. | R5 auth/security | `dashboard-primitives`, `hero-panel`, `ScreenState`, old auth panels. | `auth-admin-surfaces.spec.ts`; `pilot-smoke.spec.ts`; auth evidence guard if touched. | Do not change role/action-store assignment command shape, audit links, correlation ids, permission semantics, or search behavior. |
| Audit center | `/admin/audit`; `/admin/audit/users/:userId/audit`; `/admin/audit/role-assignments/:assignmentId/audit`; `/admin/audit/action-store-assignments/:assignmentId/audit` | `AuditCenterPage.tsx`; auth audit detail pages; `audit-navigation.ts` | Security/audit read surface for auditors and super admins. | `SUPER_ADMIN`, `AUDITOR`. | auth audit APIs, `getNeedsAction`, `getSnapshotNeedsAction`. | Inspect audit trails and navigate to detail routes. | loading, error, empty audit lists, detail not found/access denied. | R5 audit/security | `dashboard-primitives`, `hero-panel`, `hero-metrics`. | Audit targeted e2e plus auth-admin surfaces. | Do not change audit visibility, audit route params, detail links, correlation id display, or role access. |

## Current Legacy UI Inventory

Source search shows the admin train starts with these active legacy patterns:

- `dashboard-primitives` imported by most admin pages and route states.
- `hero-panel`, `hero-title`, `hero-copy`, `hero-metrics`, `metric-card`,
  `MetricAccent`, `MetricCard`, `StatusPill`, and `ScreenState` on admin
  operational pages.
- `admin-command-*` shell classes in `admin-shell.tsx`,
  `admin-sidebar.tsx`, and `admin-command-shell.css`.
- Session/auth diagnostic surfaces legitimately use words like `mock`, bearer
  token, headers, and callback placeholder. Treat those as diagnostic copy, not
  Store/product fake metric permission.

## Coverage And Characterization Needs

Must not move without targeted characterization or e2e evidence:

- PR-2 shell/navigation: route graph, route role list, nav list, route role
  visibility matrix, and nav visibility matrix must match this inventory.
- PR-6 auth/audit: preserve auth command payloads, audit links, role visibility,
  and smoke coverage.
- PR-8 snapshots: add deterministic semantic golden coverage for status label,
  badge tone, action enabled/disabled state, and detail visibility before UI
  changes are accepted.
- PR-9 checklists: characterize answer type, score weight, low-score note, and
  expectedValue payload behavior before modernizing the builder.
- PR-10 targets: preserve approval permission helpers, approval payloads, note
  handling, status labels, and coverage semantics.
- PR-11 KPI config: preserve scoring/config semantics with frontend and backend
  scoring/versioning tests.
- PR-12 competitions: preserve lifecycle, scoring, finalization, stage package
  plan handling, and access behavior with frontend and backend targeted tests.

## PR-2 Parity Expectations

The PR-2 guard must fail if any of the following differ from this inventory
without an explicit route/access decision PR:

- Route path set.
- Route role list per path.
- Page component per path.
- Nav item set.
- Nav item role list.
- Nav item target path.
- Route visibility matrix for the listed parity roles.
- Navigation visibility matrix for the listed parity roles.

Detail routes are route parity inputs, but they are not navigation parity
requirements unless `navVisible` is `true` in the JSON baseline.
