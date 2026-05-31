# Admin UI Modernization V1 PR-13 Guard Evidence

Date: 2026-05-31
Scope: legacy admin UI guard and AdminSurface primitive enforcement
PR slice: PR-13 from `docs/plans/admin-ui-modernization-v1-plan.md`

## Migrated/new AdminSurface-required pages

The guard in `scripts/admin-ui-refactor-guard.test.mjs` tracks migrated admin
surfaces explicitly. These files are required to stay anchored to
`AdminSurface*` primitives from
`admin-web/src/pages/admin-surface-primitives.tsx`:

- `admin-web/src/pages/AdminPilotFeedbackPage.tsx`
- `admin-web/src/pages/AdminDataQualityCenterPage.tsx`
- `admin-web/src/pages/AdminInboxPage.tsx`
- `admin-web/src/pages/ReportsSummaryPage.tsx`
- `admin-web/src/pages/ReportsSnapshotRunsPage.tsx`
- `admin-web/src/pages/ReportsWorkforcePage.tsx`
- `admin-web/src/pages/ReportsKpisPage.tsx`
- `admin-web/src/pages/ReportsChecklistsPage.tsx`
- `admin-web/src/pages/ReportsTurnoverPage.tsx`
- `admin-web/src/pages/OperationsControlTowerPage.tsx`
- `admin-web/src/pages/operations-*.tsx`
- `admin-web/src/pages/AuthDashboardPage.tsx`
- `admin-web/src/features/auth/AuthDashboardSections.tsx`
- `admin-web/src/features/auth/PilotUserBindingPanel.tsx`
- `admin-web/src/features/auth/RolePermissionPreviewPanel.tsx`
- `admin-web/src/pages/AuthCatalogPage.tsx`
- `admin-web/src/pages/AuthUserAuditPage.tsx`
- `admin-web/src/pages/AuthAssignmentAuditPage.tsx`
- `admin-web/src/pages/AuthActionStoreAssignmentAuditPage.tsx`
- `admin-web/src/pages/AuditCenterPage.tsx`
- `admin-web/src/pages/IntegrationDashboardPage.tsx`
- `admin-web/src/pages/ImportBatchDetailPage.tsx`
- `admin-web/src/features/integrations/import-batch-detail-surface-primitives.tsx`
- `admin-web/src/pages/MasterDataBootstrapPage.tsx`
- `admin-web/src/pages/master-data-bootstrap-batch-detail-panel.tsx`
- `admin-web/src/pages/SnapshotsDashboardPage.tsx`
- `admin-web/src/pages/SnapshotRunDetailPage.tsx`
- `admin-web/src/pages/AdminChecklistTemplatesPage.tsx`
- `admin-web/src/pages/AdminChecklistTemplateSurface.tsx`
- `admin-web/src/pages/TargetApprovalQueuePage.tsx`
- `admin-web/src/pages/AdminKpiConfigPage.tsx`
- `admin-web/src/pages/admin-kpi-config-surface-primitives.tsx`
- `admin-web/src/pages/CompetitionDashboardPage.tsx`
- `admin-web/src/features/competitions/StageBuilderForm.tsx`
- `admin-web/src/features/competitions/competition-admin-surface-primitives.tsx`
- `admin-web/src/features/competitions/stage-builder-package-section.tsx`
- `admin-web/src/features/competitions/stage-builder-template-sections.tsx`

The route coverage test reads live route declarations from
`admin-web/src/app/admin-shell.tsx` and fails if an active admin route page is
neither in the migrated list nor in the exception allowlist. The separate
PR-2 route parity guard still verifies that the live route graph matches the
PR-1 inventory baseline.

## Explicit unmigrated exception allowlist

These active admin route pages intentionally remain outside the migrated list:

- `admin-web/src/pages/SessionReadinessPage.tsx`: diagnostic session surface is
  parked outside the admin surface migration.
- `admin-web/src/pages/AdminFeedPage.tsx`: feed composer/write behavior was
  parked for a separate behavior-preserving PR.

Both exceptions are explicit in the guard. Removing either exception requires
migrating that surface or adding a new reasoned exception in the same PR.

## Forbidden legacy patterns

Migrated surfaces fail the guard if they reintroduce:

- `dashboard-primitives` imports,
- legacy layout classes such as `hero-panel`, `hero-metrics`, `metric-card`,
  `control-button`, `ghost-button`, `action-cluster`, `form-grid`, `key-grid`,
  `stacked-row`, `field-block`, or `queue-subtitle`,
- fake admin metric/data/workflow/copy language,
- explicit debug/handoff copy language.

## Positive AdminSurface primitive requirement

The guard is not only a negative pattern scan. Every checked migrated file must
show positive `AdminSurface*` anchoring, either by importing
`admin-web/src/pages/admin-surface-primitives.tsx` directly or by importing an
approved domain helper that is itself anchored to the shared AdminSurface layer.

Domain helper primitive files are allowed only when they import the shared
AdminSurface primitive layer. A domain helper named `*surface-primitives.tsx`
that does not import `admin-surface-primitives` is treated as primitive sprawl
and fails the guard.

## Synthetic negative cases

`scripts/admin-ui-refactor-guard.test.mjs` includes fail-closed tests for:

- a synthetic migrated admin page that imports `dashboard-primitives`, uses
  `hero-panel`, and contains fake metric copy;
- a synthetic domain `fake-surface-primitives.tsx` file that defines a parallel
  primitive set without importing the shared AdminSurface layer.

## Verification

Required PR-13 commands:

```powershell
npm.cmd run test:scripts
git diff --check
```

Expected result:

- migrated list is explicit,
- exception list is explicit,
- forbidden legacy patterns are blocked,
- positive AdminSurface anchoring is required,
- synthetic negative cases prove the guard fails closed.
