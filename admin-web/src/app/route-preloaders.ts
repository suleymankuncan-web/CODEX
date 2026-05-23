const routePreloaders: Array<{
  match: (pathname: string) => boolean
  preload: () => Promise<unknown>
}> = [
  {
    match: (pathname) => pathname.startsWith('/store/personnel/'),
    preload: () => import('../pages/StorePersonnelPerformancePage'),
  },
  {
    match: (pathname) => pathname === '/store' || pathname === '/store/home',
    preload: () => import('../pages/StoreHomePage'),
  },
  { match: (pathname) => pathname === '/store/me', preload: () => import('../pages/StoreMyPerformancePage') },
  { match: (pathname) => pathname === '/store/rankings', preload: () => import('../pages/StoreRankingsPage') },
  { match: (pathname) => pathname === '/store/kpis', preload: () => import('../pages/StoreKpiHighlightsPage') },
  { match: (pathname) => pathname === '/store/checklists', preload: () => import('../pages/StoreChecklistsPage') },
  { match: (pathname) => pathname === '/store/tasks', preload: () => import('../pages/StoreTasksPage') },
  { match: (pathname) => pathname === '/store/feed', preload: () => import('../pages/StoreFeedPage') },
  { match: (pathname) => pathname === '/store/competitions', preload: () => import('../pages/StoreCompetitionsPage') },
  { match: (pathname) => pathname === '/store/approvals', preload: () => import('../pages/StoreApprovalsPage') },
  { match: (pathname) => pathname === '/store/incentives', preload: () => import('../pages/StoreIncentivesPage') },
  { match: (pathname) => pathname === '/store/settings', preload: () => import('../pages/StoreSettingsPage') },
  { match: (pathname) => pathname === '/store/targets', preload: () => import('../pages/StoreTargetsPage') },
  { match: (pathname) => pathname === '/store/reports', preload: () => import('../pages/StoreReportsPage') },
  { match: (pathname) => pathname === '/admin/session', preload: () => import('../pages/SessionReadinessPage') },
  { match: (pathname) => pathname === '/admin/operations', preload: () => import('../pages/OperationsControlTowerPage') },
  { match: (pathname) => pathname === '/admin/data-quality', preload: () => import('../pages/AdminDataQualityCenterPage') },
  { match: (pathname) => pathname.startsWith('/admin/integrations/'), preload: () => import('../pages/ImportBatchDetailPage') },
  { match: (pathname) => pathname === '/admin/integrations', preload: () => import('../pages/IntegrationDashboardPage') },
  { match: (pathname) => pathname.startsWith('/admin/master-data'), preload: () => import('../pages/MasterDataBootstrapPage') },
  { match: (pathname) => pathname.startsWith('/admin/snapshots/'), preload: () => import('../pages/SnapshotRunDetailPage') },
  { match: (pathname) => pathname === '/admin/snapshots', preload: () => import('../pages/SnapshotsDashboardPage') },
  { match: (pathname) => pathname === '/admin/inbox', preload: () => import('../pages/AdminInboxPage') },
  { match: (pathname) => pathname === '/admin/feed', preload: () => import('../pages/AdminFeedPage') },
  { match: (pathname) => pathname === '/admin/checklists', preload: () => import('../pages/AdminChecklistTemplatesPage') },
  { match: (pathname) => pathname === '/admin/competitions', preload: () => import('../pages/CompetitionDashboardPage') },
  { match: (pathname) => pathname === '/admin/reports', preload: () => import('../pages/ReportsSummaryPage') },
  { match: (pathname) => pathname === '/admin/reports/snapshot-runs', preload: () => import('../pages/ReportsSnapshotRunsPage') },
  { match: (pathname) => pathname.startsWith('/admin/reports/workforce/'), preload: () => import('../pages/ReportsWorkforcePage') },
  { match: (pathname) => pathname.startsWith('/admin/reports/kpis/'), preload: () => import('../pages/ReportsKpisPage') },
  { match: (pathname) => pathname.startsWith('/admin/reports/checklists/'), preload: () => import('../pages/ReportsChecklistsPage') },
  { match: (pathname) => pathname.startsWith('/admin/reports/turnover/'), preload: () => import('../pages/ReportsTurnoverPage') },
  { match: (pathname) => pathname === '/admin/targets', preload: () => import('../pages/TargetApprovalQueuePage') },
  { match: (pathname) => pathname === '/admin/kpi-config', preload: () => import('../pages/AdminKpiConfigPage') },
  { match: (pathname) => pathname === '/admin/pilot-feedback', preload: () => import('../pages/AdminPilotFeedbackPage') },
  { match: (pathname) => pathname === '/admin/auth/catalog', preload: () => import('../pages/AuthCatalogPage') },
  { match: (pathname) => pathname.startsWith('/admin/auth/users/'), preload: () => import('../pages/AuthUserAuditPage') },
  { match: (pathname) => pathname.startsWith('/admin/auth/role-assignments/'), preload: () => import('../pages/AuthAssignmentAuditPage') },
  { match: (pathname) => pathname.startsWith('/admin/auth/action-store-assignments/'), preload: () => import('../pages/AuthActionStoreAssignmentAuditPage') },
  { match: (pathname) => pathname === '/admin/auth', preload: () => import('../pages/AuthDashboardPage') },
  { match: (pathname) => pathname.startsWith('/admin/audit/users/'), preload: () => import('../pages/AuthUserAuditPage') },
  { match: (pathname) => pathname.startsWith('/admin/audit/role-assignments/'), preload: () => import('../pages/AuthAssignmentAuditPage') },
  { match: (pathname) => pathname.startsWith('/admin/audit/action-store-assignments/'), preload: () => import('../pages/AuthActionStoreAssignmentAuditPage') },
  { match: (pathname) => pathname === '/admin/audit', preload: () => import('../pages/AuditCenterPage') },
  { match: (pathname) => pathname === '/auth/login', preload: () => import('../pages/AuthLoginPage') },
]

export function preloadRouteModule(pathname: string) {
  const preload = routePreloaders.find((route) => route.match(pathname))?.preload
  if (!preload) return

  void preload().catch(() => undefined)
}
