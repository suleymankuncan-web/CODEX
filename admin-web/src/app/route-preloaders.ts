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
  { match: (pathname) => pathname.startsWith('/admin/integrations/'), preload: () => import('../pages/ImportBatchDetailPage') },
  { match: (pathname) => pathname === '/admin/integrations', preload: () => import('../pages/IntegrationDashboardPage') },
  { match: (pathname) => pathname.startsWith('/admin/master-data'), preload: () => import('../pages/MasterDataBootstrapPage') },
  { match: (pathname) => pathname === '/admin/reports', preload: () => import('../pages/ReportsSummaryPage') },
  { match: (pathname) => pathname === '/admin/targets', preload: () => import('../pages/TargetApprovalQueuePage') },
  { match: (pathname) => pathname === '/admin/auth', preload: () => import('../pages/AuthDashboardPage') },
  { match: (pathname) => pathname === '/auth/login', preload: () => import('../pages/AuthLoginPage') },
]

export function preloadRouteModule(pathname: string) {
  const preload = routePreloaders.find((route) => route.match(pathname))?.preload
  if (!preload) return

  void preload().catch(() => undefined)
}
