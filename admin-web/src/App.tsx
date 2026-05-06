import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { NavLink, Navigate, Route, Routes, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { BarChart3, Bell, ClipboardList, DatabaseZap, Fingerprint, KeyRound, Layers3, Megaphone, ShieldCheck, SlidersHorizontal, Target, Trophy } from 'lucide-react'
import { KeyValue, ScreenState, StatusPill } from './components/dashboard-primitives'
import { getAuthSession, type AuthSessionSummary } from './features/auth/api'
import { formatDisplayRoles } from './features/auth/display'
import { sanitizeAuthReturnPath } from './features/auth/return-path'
import { LanguageToggle } from './features/localization/LanguageToggle'
import { useLocalization } from './features/localization/useLocalization'
import { useSession } from './features/session/session-context-value'
import { describeSessionMode, getBearerSessionCacheKey } from './features/session/session-storage'
import { SESSION_EXPIRED_EVENT, type SessionExpiredDetail, ApiError } from './lib/api'

const AuditCenterPage = lazy(() => import('./pages/AuditCenterPage').then((module) => ({ default: module.AuditCenterPage })))
const AdminFeedPage = lazy(() => import('./pages/AdminFeedPage').then((module) => ({ default: module.AdminFeedPage })))
const AdminChecklistTemplatesPage = lazy(() => import('./pages/AdminChecklistTemplatesPage').then((module) => ({ default: module.AdminChecklistTemplatesPage })))
const AdminKpiConfigPage = lazy(() => import('./pages/AdminKpiConfigPage').then((module) => ({ default: module.AdminKpiConfigPage })))
const AdminInboxPage = lazy(() => import('./pages/AdminInboxPage').then((module) => ({ default: module.AdminInboxPage })))
const AuthActionStoreAssignmentAuditPage = lazy(() => import('./pages/AuthActionStoreAssignmentAuditPage').then((module) => ({ default: module.AuthActionStoreAssignmentAuditPage })))
const AuthAssignmentAuditPage = lazy(() => import('./pages/AuthAssignmentAuditPage').then((module) => ({ default: module.AuthAssignmentAuditPage })))
const AuthCallbackPage = lazy(() => import('./pages/AuthCallbackPage').then((module) => ({ default: module.AuthCallbackPage })))
const AuthCatalogPage = lazy(() => import('./pages/AuthCatalogPage').then((module) => ({ default: module.AuthCatalogPage })))
const AuthDashboardPage = lazy(() => import('./pages/AuthDashboardPage').then((module) => ({ default: module.AuthDashboardPage })))
const AuthLoginPage = lazy(() => import('./pages/AuthLoginPage').then((module) => ({ default: module.AuthLoginPage })))
const AuthLogoutPage = lazy(() => import('./pages/AuthLogoutPage').then((module) => ({ default: module.AuthLogoutPage })))
const AuthUserAuditPage = lazy(() => import('./pages/AuthUserAuditPage').then((module) => ({ default: module.AuthUserAuditPage })))
const CompetitionDashboardPage = lazy(() => import('./pages/CompetitionDashboardPage').then((module) => ({ default: module.CompetitionDashboardPage })))
const ImportBatchDetailPage = lazy(() => import('./pages/ImportBatchDetailPage').then((module) => ({ default: module.ImportBatchDetailPage })))
const IntegrationDashboardPage = lazy(() => import('./pages/IntegrationDashboardPage').then((module) => ({ default: module.IntegrationDashboardPage })))
const MasterDataBootstrapPage = lazy(() => import('./pages/MasterDataBootstrapPage').then((module) => ({ default: module.MasterDataBootstrapPage })))
const ReportsChecklistsPage = lazy(() => import('./pages/ReportsChecklistsPage').then((module) => ({ default: module.ReportsChecklistsPage })))
const ReportsKpisPage = lazy(() => import('./pages/ReportsKpisPage').then((module) => ({ default: module.ReportsKpisPage })))
const ReportsSnapshotRunsPage = lazy(() => import('./pages/ReportsSnapshotRunsPage').then((module) => ({ default: module.ReportsSnapshotRunsPage })))
const ReportsSummaryPage = lazy(() => import('./pages/ReportsSummaryPage').then((module) => ({ default: module.ReportsSummaryPage })))
const ReportsTurnoverPage = lazy(() => import('./pages/ReportsTurnoverPage').then((module) => ({ default: module.ReportsTurnoverPage })))
const ReportsWorkforcePage = lazy(() => import('./pages/ReportsWorkforcePage').then((module) => ({ default: module.ReportsWorkforcePage })))
const SessionReadinessPage = lazy(() => import('./pages/SessionReadinessPage').then((module) => ({ default: module.SessionReadinessPage })))
const SnapshotRunDetailPage = lazy(() => import('./pages/SnapshotRunDetailPage').then((module) => ({ default: module.SnapshotRunDetailPage })))
const SnapshotsDashboardPage = lazy(() => import('./pages/SnapshotsDashboardPage').then((module) => ({ default: module.SnapshotsDashboardPage })))
const StoreApprovalsPage = lazy(() => import('./pages/StoreApprovalsPage').then((module) => ({ default: module.StoreApprovalsPage })))
const StoreChecklistsPage = lazy(() => import('./pages/StoreChecklistsPage').then((module) => ({ default: module.StoreChecklistsPage })))
const StoreCompetitionsPage = lazy(() => import('./pages/StoreCompetitionsPage').then((module) => ({ default: module.StoreCompetitionsPage })))
const StoreFeedPage = lazy(() => import('./pages/StoreFeedPage').then((module) => ({ default: module.StoreFeedPage })))
const StoreIncentivesPage = lazy(() => import('./pages/StoreIncentivesPage').then((module) => ({ default: module.StoreIncentivesPage })))
const StoreKpiHighlightsPage = lazy(() => import('./pages/StoreKpiHighlightsPage').then((module) => ({ default: module.StoreKpiHighlightsPage })))
const StoreMyPerformancePage = lazy(() => import('./pages/StoreMyPerformancePage').then((module) => ({ default: module.StoreMyPerformancePage })))
const StoreRankingsPage = lazy(() => import('./pages/StoreRankingsPage').then((module) => ({ default: module.StoreRankingsPage })))
const StoreShellPreviewPage = lazy(() => import('./pages/StoreShellPreviewPage').then((module) => ({ default: module.StoreShellPreviewPage })))
const StoreTasksPage = lazy(() => import('./pages/StoreTasksPage').then((module) => ({ default: module.StoreTasksPage })))
const TargetApprovalQueuePage = lazy(() => import('./pages/TargetApprovalQueuePage').then((module) => ({ default: module.TargetApprovalQueuePage })))

type NavDefinition = {
  to: string
  icon: ReactNode
  label: string
  roles?: string[]
}

const adminNavDefinitions: NavDefinition[] = [
  {
    to: '/admin/integrations',
    icon: <DatabaseZap size={18} />,
    label: 'Integrations',
    roles: ['SUPER_ADMIN', 'INTEGRATION_ADMIN'],
  },
  {
    to: '/admin/master-data',
    icon: <DatabaseZap size={18} />,
    label: 'Master Data',
    roles: ['SUPER_ADMIN', 'HR_ADMIN', 'INTEGRATION_ADMIN'],
  },
  {
    to: '/admin/snapshots',
    icon: <Layers3 size={18} />,
    label: 'Snapshots',
    roles: ['SUPER_ADMIN', 'SNAPSHOT_OPERATOR'],
  },
  {
    to: '/admin/inbox',
    icon: <Bell size={18} />,
    label: 'Inbox',
    roles: ['SUPER_ADMIN', 'REPORT_VIEWER', 'HR_ADMIN'],
  },
  {
    to: '/admin/feed',
    icon: <Megaphone size={18} />,
    label: 'Duyurular',
    roles: ['SUPER_ADMIN', 'HR_ADMIN', 'REGION_MANAGER'],
  },
  {
    to: '/admin/checklists',
    icon: <ClipboardList size={18} />,
    label: 'Checklistler',
    roles: ['SUPER_ADMIN', 'HR_ADMIN'],
  },
  {
    to: '/admin/competitions',
    icon: <Trophy size={18} />,
    label: 'Competitions',
    roles: ['SUPER_ADMIN', 'HR_ADMIN', 'REPORT_VIEWER', 'REGION_MANAGER'],
  },
  {
    to: '/admin/reports',
    icon: <BarChart3 size={18} />,
    label: 'Reports',
    roles: ['SUPER_ADMIN', 'REPORT_VIEWER'],
  },
  {
    to: '/admin/targets',
    icon: <Target size={18} />,
    label: 'Targets',
    roles: ['SUPER_ADMIN', 'REPORT_VIEWER', 'REGION_MANAGER'],
  },
  {
    to: '/admin/kpi-config',
    icon: <SlidersHorizontal size={18} />,
    label: 'KPI Config',
    roles: ['SUPER_ADMIN'],
  },
  {
    to: '/admin/auth',
    icon: <ShieldCheck size={18} />,
    label: 'Auth',
    roles: ['SUPER_ADMIN'],
  },
  {
    to: '/admin/audit',
    icon: <Fingerprint size={18} />,
    label: 'Audit',
    roles: ['SUPER_ADMIN', 'AUDITOR'],
  },
  {
    to: '/admin/session',
    icon: <KeyRound size={18} />,
    label: 'Session',
  },
]

function App() {
  const location = useLocation()
  const navigate = useNavigate()
  const { session, isReady, isProviderSessionHydrating, expireSession } = useSession()
  const [sessionNotice, setSessionNotice] = useState<string | null>(null)
  const bearerTokenReadiness = session.bearerToken.trim() ? 'token-present' : 'token-missing'
  const bearerSessionKey = getBearerSessionCacheKey(session.bearerToken)
  const currentReturnPath = getCurrentReturnPath(location)
  const sessionQuery = useQuery({
    queryKey:
      session.mode === 'bearer'
        ? ['shell-session', session.mode, bearerTokenReadiness, bearerSessionKey]
        : [
            'shell-session',
            session.mode,
            session.mockUserId,
            session.mockRoleCodes,
            session.mockCompanyIds,
          ],
    queryFn: getAuthSession,
    enabled: isReady,
    retry: false,
    staleTime: 30_000,
  })

  useEffect(() => {
    const handleSessionExpired = (event: Event) => {
      const detail = (event as CustomEvent<SessionExpiredDetail>).detail
      expireSession()
      setSessionNotice(
        detail?.message
          ? `Session expired while calling ${detail.path}. Update the bearer token and verify again.`
          : 'Session expired. Update the bearer token and verify again.',
      )
      navigate(buildAuthLoginPath(currentReturnPath), { replace: true })
    }

    window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired)
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired)
  }, [currentReturnPath, expireSession, navigate])

  const authSummary = sessionQuery.data ?? null
  const visibleSessionNotice = ['/admin/session', '/auth/login'].includes(location.pathname)
    ? sessionNotice
    : null
  const allowedAdminNav = useMemo(
    () => adminNavDefinitions.filter((item) => isNavAllowed(item, authSummary)),
    [authSummary],
  )
  const firstAllowedPath = useMemo(
    () => resolveLandingPath(authSummary, isReady),
    [authSummary, isReady],
  )
  const shellState = getShellState({
    isReady,
    authSummary,
    authError: sessionQuery.isError,
    authLoading: sessionQuery.isLoading,
    authErrorDetail: sessionQuery.error,
    firstAllowedPath,
    sessionNotice: visibleSessionNotice,
    providerSessionHydrating: isProviderSessionHydrating,
  })

  if (location.pathname.startsWith('/auth')) {
    return <AuthFlowShell shellState={shellState} firstAllowedPath={firstAllowedPath} />
  }

  if (location.pathname.startsWith('/store')) {
    return (
      <StoreShell
        shellState={shellState}
        authSummary={authSummary}
        firstAllowedPath={firstAllowedPath}
      />
    )
  }

  const roleSummary = formatDisplayRoles(authSummary?.user.roleCodes, 'No resolved roles')
  const scopeSummary = authSummary
    ? `${authSummary.scopeSummary.companyCount} company · ${authSummary.scopeSummary.regionCount} region · ${authSummary.scopeSummary.storeCount} store`
    : 'Scope resolves after session verification'

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-kicker">Store Ops Control</div>
          <h1>Production shell for scoped operators, auditors, and reporting users.</h1>
          <p>
            Phase 7 shifts the app from a development-friendly dashboard into a role-aware
            operational surface that can later branch cleanly into store-user experiences.
          </p>
        </div>

        <nav className="nav-stack" aria-label="Primary">
          {allowedAdminNav.map((item) => (
            <NavItem key={item.to} to={item.to} icon={item.icon} label={item.label} />
          ))}
          <NavItem to="/store" icon={<KeyRound size={18} />} label="Store Preview" />
          <NavItem to="/auth/login" icon={<ShieldCheck size={18} />} label="Real Login" />
        </nav>

        <div className="sidebar-note">
          <span>Phase 7</span>
          <p>
            Real auth bootstrap, role-aware navigation, and clean future separation between admin
            and store-user product surfaces.
          </p>
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div>
            <div className="eyebrow">Production UX And Real Auth</div>
            <p className="topbar-copy">
              The shell now verifies session state before exposing admin surfaces, expires bearer
              sessions cleanly on `401`, and routes users toward the first view their role set can
              actually use.
            </p>
          </div>
          <div className="topbar-cluster">
            <LanguageToggle />
            <div className={`env-chip${isReady ? '' : ' env-chip-warning'}`}>
              Session: {describeSessionMode(session.mode)} {isReady ? 'configured' : 'needs setup'}
            </div>
            <div className={`env-chip${sessionQuery.isError ? ' env-chip-warning' : ''}`}>
              Auth bootstrap:{' '}
              {sessionQuery.isLoading
                ? 'checking'
                : sessionQuery.isError
                  ? 'rejected'
                  : authSummary
                    ? 'verified'
                    : 'idle'}
            </div>
            <div className="env-chip">
              Landing: <code>{firstAllowedPath}</code>
            </div>
            {authSummary ? (
              <div className="env-chip">
                User: <code>{authSummary.user.userId}</code>
              </div>
            ) : null}
          </div>
        </header>

        <section className="panel shell-context-panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">Landing Context</div>
              <h3>Why this shell is sending the user here</h3>
            </div>
            <StatusPill tone={shellState.mode === 'ready' ? 'calm' : shellState.mode === 'verifying' ? 'warning' : 'danger'}>
              {shellState.mode === 'ready'
                ? 'Ready'
                : shellState.mode === 'verifying'
                  ? 'Checking'
                  : shellState.mode === 'setup-required'
                    ? 'Needs setup'
                    : 'Attention'}
            </StatusPill>
          </div>
          <div className="key-grid">
            <KeyValue label="Recommended landing" value={firstAllowedPath} />
            <KeyValue label="Resolved roles" value={roleSummary} />
            <KeyValue label="Resolved scope" value={scopeSummary} />
            <KeyValue
              label="Failure handling"
              value={session.mode === 'bearer' ? '401 clears bearer session and returns to /auth/login' : 'Mock session stays local for dev flow'}
            />
          </div>
          {shellState.notice ? (
            <div className="shell-notice shell-notice-warning">{shellState.notice}</div>
          ) : null}
        </section>

        <Suspense fallback={<RouteLoadingState />}>
          <Routes>
            <Route path="/" element={<Navigate to={firstAllowedPath} replace />} />
            <Route
              path="/admin/session"
              element={<SessionGate />}
            />
            <Route
              path="/admin/integrations"
              element={guardRoute(shellState, authSummary, ['SUPER_ADMIN', 'INTEGRATION_ADMIN'], <IntegrationDashboardPage />)}
            />
            <Route
              path="/admin/integrations/:batchId"
              element={guardRoute(shellState, authSummary, ['SUPER_ADMIN', 'INTEGRATION_ADMIN'], <ImportBatchDetailPage />)}
            />
            <Route
              path="/admin/master-data"
              element={guardRoute(shellState, authSummary, ['SUPER_ADMIN', 'HR_ADMIN', 'INTEGRATION_ADMIN'], <MasterDataBootstrapPage />)}
            />
            <Route
              path="/admin/master-data/:batchId"
              element={guardRoute(shellState, authSummary, ['SUPER_ADMIN', 'HR_ADMIN', 'INTEGRATION_ADMIN'], <MasterDataBootstrapPage />)}
            />
            <Route
              path="/admin/snapshots"
              element={guardRoute(shellState, authSummary, ['SUPER_ADMIN', 'SNAPSHOT_OPERATOR'], <SnapshotsDashboardPage />)}
            />
            <Route
              path="/admin/snapshots/:snapshotRunId"
              element={guardRoute(shellState, authSummary, ['SUPER_ADMIN', 'SNAPSHOT_OPERATOR'], <SnapshotRunDetailPage />)}
            />
            <Route
              path="/admin/inbox"
              element={guardRoute(shellState, authSummary, ['SUPER_ADMIN', 'REPORT_VIEWER', 'HR_ADMIN'], <AdminInboxPage authSummary={authSummary} />)}
            />
            <Route
              path="/admin/feed"
              element={guardRoute(shellState, authSummary, ['SUPER_ADMIN', 'HR_ADMIN', 'REGION_MANAGER'], <AdminFeedPage authSummary={authSummary} />)}
            />
            <Route
              path="/admin/checklists"
              element={guardRoute(shellState, authSummary, ['SUPER_ADMIN', 'HR_ADMIN'], <AdminChecklistTemplatesPage />)}
            />
            <Route
              path="/admin/competitions"
              element={guardRoute(shellState, authSummary, ['SUPER_ADMIN', 'HR_ADMIN', 'REPORT_VIEWER', 'REGION_MANAGER'], <CompetitionDashboardPage authSummary={authSummary} />)}
            />
            <Route
              path="/admin/reports"
              element={guardRoute(shellState, authSummary, ['SUPER_ADMIN', 'REPORT_VIEWER'], <ReportsSummaryPage />)}
            />
            <Route
              path="/admin/reports/snapshot-runs"
              element={guardRoute(shellState, authSummary, ['SUPER_ADMIN', 'REPORT_VIEWER'], <ReportsSnapshotRunsPage />)}
            />
            <Route
              path="/admin/reports/workforce/:snapshotRunId"
              element={guardRoute(shellState, authSummary, ['SUPER_ADMIN', 'REPORT_VIEWER'], <ReportsWorkforcePage />)}
            />
            <Route
              path="/admin/reports/kpis/:snapshotRunId"
              element={guardRoute(shellState, authSummary, ['SUPER_ADMIN', 'REPORT_VIEWER'], <ReportsKpisPage />)}
            />
            <Route
              path="/admin/reports/checklists/:snapshotRunId"
              element={guardRoute(shellState, authSummary, ['SUPER_ADMIN', 'REPORT_VIEWER'], <ReportsChecklistsPage />)}
            />
            <Route
              path="/admin/reports/turnover/:snapshotRunId"
              element={guardRoute(shellState, authSummary, ['SUPER_ADMIN', 'REPORT_VIEWER'], <ReportsTurnoverPage />)}
            />
            <Route
              path="/admin/targets"
              element={guardRoute(shellState, authSummary, ['SUPER_ADMIN', 'REPORT_VIEWER', 'REGION_MANAGER'], <TargetApprovalQueuePage authSummary={authSummary} />)}
            />
            <Route
              path="/admin/kpi-config"
              element={guardRoute(shellState, authSummary, ['SUPER_ADMIN'], <AdminKpiConfigPage />)}
            />
            <Route
              path="/admin/auth"
              element={guardRoute(shellState, authSummary, ['SUPER_ADMIN'], <AuthDashboardPage />)}
            />
            <Route
              path="/admin/auth/catalog"
              element={guardRoute(shellState, authSummary, ['SUPER_ADMIN'], <AuthCatalogPage />)}
            />
            <Route
              path="/admin/auth/users/:userId/audit"
              element={guardRoute(shellState, authSummary, ['SUPER_ADMIN'], <AuthUserAuditPage />)}
            />
            <Route
              path="/admin/auth/role-assignments/:assignmentId/audit"
              element={guardRoute(shellState, authSummary, ['SUPER_ADMIN'], <AuthAssignmentAuditPage />)}
            />
            <Route
              path="/admin/auth/action-store-assignments/:assignmentId/audit"
              element={guardRoute(shellState, authSummary, ['SUPER_ADMIN'], <AuthActionStoreAssignmentAuditPage />)}
            />
            <Route
              path="/admin/audit/users/:userId/audit"
              element={guardRoute(shellState, authSummary, ['SUPER_ADMIN', 'AUDITOR'], <AuthUserAuditPage />)}
            />
            <Route
              path="/admin/audit/role-assignments/:assignmentId/audit"
              element={guardRoute(shellState, authSummary, ['SUPER_ADMIN', 'AUDITOR'], <AuthAssignmentAuditPage />)}
            />
            <Route
              path="/admin/audit/action-store-assignments/:assignmentId/audit"
              element={guardRoute(shellState, authSummary, ['SUPER_ADMIN', 'AUDITOR'], <AuthActionStoreAssignmentAuditPage />)}
            />
            <Route
              path="/admin/audit"
              element={guardRoute(shellState, authSummary, ['SUPER_ADMIN', 'AUDITOR'], <AuditCenterPage />)}
            />
            <Route path="*" element={<Navigate to={firstAllowedPath} replace />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  )
}

function AuthFlowShell(input: { shellState: ShellState; firstAllowedPath: string }) {
  const [searchParams] = useSearchParams()
  const returnTo = sanitizeAuthReturnPath(searchParams.get('returnTo'))
  const readyPath = returnTo ?? input.firstAllowedPath

  return (
    <div className="auth-flow-shell">
      <Suspense fallback={<RouteLoadingState />}>
        <Routes>
          <Route
            path="/auth/login"
            element={
              input.shellState.mode === 'ready' ? (
                <Navigate to={readyPath} replace />
              ) : (
                <AuthLoginPage />
              )
            }
          />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route path="/auth/logout" element={<AuthLogoutPage />} />
          <Route path="*" element={<Navigate to="/auth/login" replace />} />
        </Routes>
      </Suspense>
    </div>
  )
}

function StoreShell(input: {
  shellState: ShellState
  authSummary: AuthSessionSummary | null
  firstAllowedPath: string
}) {
  const { t } = useLocalization()
  const checklistOnly = isVisualMerchandiserOnly(input.authSummary)
  const location = useLocation()

  if (input.shellState.mode === 'setup-required') {
    return <Navigate to={buildAuthLoginPath(getCurrentReturnPath(location))} replace />
  }

  if (input.shellState.mode === 'verifying') {
    return (
      <ScreenState
        title={t('storeHome.shellVerifyingTitle')}
        copy={t('storeHome.shellVerifyingCopy')}
      />
    )
  }

  if (input.shellState.mode === 'rejected') {
    return (
      <ScreenState
        title={t('storeHome.shellRejectedTitle')}
        copy={input.shellState.notice ?? input.shellState.errorCopy ?? t('storeHome.shellRejectedFallback')}
        tone="error"
      />
    )
  }

  return (
    <div className="store-shell">
      <header className="store-shell-header">
        <div>
          <div className="eyebrow">{t('storeHome.shellEyebrow')}</div>
          <h1>{t('storeHome.shellTitle')}</h1>
          <p className="topbar-copy">{t('storeHome.shellCopy')}</p>
        </div>
        <div className="topbar-cluster">
          <LanguageToggle />
          <StatusPill tone="accent">{t('storeHome.preview')}</StatusPill>
          <NavLink to="/auth/login" className="control-button store-shell-link">
            {t('storeHome.realLogin')}
          </NavLink>
          {!checklistOnly ? (
            <>
          <NavLink to="/admin/reports" className="control-button store-shell-link">
            {t('storeHome.adminReports')}
          </NavLink>
          <NavLink to="/store/feed" className="control-button store-shell-link">
            {t('storeHome.announcements')}
          </NavLink>
          <NavLink to="/store/competitions" className="control-button store-shell-link">
            {t('storeHome.competitions')}
          </NavLink>
            </>
          ) : null}
        </div>
      </header>

      <main className="store-main" aria-label="Store workspace">
        <Suspense fallback={<RouteLoadingState />}>
          <Routes>
            <Route
              path="/store"
              element={checklistOnly ? (
                <Navigate to="/store/checklists" replace />
              ) : (
                <StoreShellPreviewPage
                  authSummary={input.authSummary}
                  recommendedLanding={input.firstAllowedPath}
                />
              )}
            />
            <Route
              path="/store/home"
              element={checklistOnly ? (
                <Navigate to="/store/checklists" replace />
              ) : (
                <StoreShellPreviewPage
                  authSummary={input.authSummary}
                  recommendedLanding={input.firstAllowedPath}
                />
              )}
            />
            <Route
              path="/store/checklists"
              element={guardStoreRoute(input.authSummary, <StoreChecklistsPage authSummary={input.authSummary} />, { allowVm: true })}
            />
            <Route
              path="/store/tasks"
              element={guardStoreRoute(input.authSummary, <StoreTasksPage authSummary={input.authSummary} />)}
            />
            <Route
              path="/store/kpis"
              element={guardStoreRoute(input.authSummary, <StoreKpiHighlightsPage authSummary={input.authSummary} />)}
            />
            <Route
              path="/store/me"
              element={guardStoreRoute(input.authSummary, <StoreMyPerformancePage authSummary={input.authSummary} />)}
            />
            <Route
              path="/store/rankings"
              element={guardStoreRoute(input.authSummary, <StoreRankingsPage authSummary={input.authSummary} />)}
            />
            <Route
              path="/store/feed"
              element={guardStoreRoute(input.authSummary, <StoreFeedPage authSummary={input.authSummary} />)}
            />
            <Route
              path="/store/competitions"
              element={guardStoreRoute(input.authSummary, <StoreCompetitionsPage authSummary={input.authSummary} />)}
            />
            <Route
              path="/store/approvals"
              element={guardStoreRoute(input.authSummary, <StoreApprovalsPage authSummary={input.authSummary} />)}
            />
            <Route
              path="/store/incentives"
              element={guardStoreRoute(input.authSummary, <StoreIncentivesPage authSummary={input.authSummary} />)}
            />
            <Route path="*" element={<Navigate to="/store" replace />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  )
}

function RouteLoadingState() {
  return <ScreenState title="Loading route" copy="Preparing the requested surface." />
}

function guardStoreRoute(
  authSummary: AuthSessionSummary | null,
  element: ReactNode,
  options?: { allowVm?: boolean },
) {
  if (isVisualMerchandiserOnly(authSummary) && !options?.allowVm) {
    return <ForbiddenRoute firstAllowedPath="/store/checklists" />
  }

  return <>{element}</>
}

function SessionGate() {
  return <SessionReadinessPage />
}

function guardRoute(
  shellState: ShellState,
  authSummary: AuthSessionSummary | null,
  roles: string[],
  element: ReactNode,
) {
  if (shellState.mode === 'setup-required') {
    return <Navigate to="/auth/login" replace />
  }

  if (shellState.mode === 'verifying') {
    return (
      <ScreenState
        title="Verifying session"
        copy="The shell is confirming the current auth mode through /api/auth/session before it opens protected routes."
      />
    )
  }

  if (shellState.mode === 'rejected') {
    return (
      <ScreenState
        title="Session rejected"
        copy={shellState.notice ?? shellState.errorCopy ?? 'The backend did not accept the current session. Update the auth mode or bearer token before entering protected routes.'}
        tone="error"
      />
    )
  }

  if (!hasAnyRole(authSummary?.user.roleCodes ?? [], roles)) {
    return <ForbiddenRoute firstAllowedPath={shellState.firstAllowedPath} />
  }

  return <>{element}</>
}

function ForbiddenRoute(input: { firstAllowedPath: string }) {
  return (
    <ScreenState
      title="Route not available for this role"
      copy={`This session is authenticated, but the current role set does not permit this surface. Return to ${input.firstAllowedPath} instead.`}
      tone="error"
    />
  )
}

type ShellState = {
  mode: 'setup-required' | 'verifying' | 'rejected' | 'ready'
  firstAllowedPath: string
  notice: string | null
  errorCopy: string | null
}

function getShellState(input: {
  isReady: boolean
  authSummary: AuthSessionSummary | null
  authError: boolean
  authLoading: boolean
  authErrorDetail: unknown
  firstAllowedPath: string
  sessionNotice: string | null
  providerSessionHydrating: boolean
}): ShellState {
  const errorCopy = resolveAuthErrorCopy(input.authErrorDetail)

  if (!input.isReady && input.providerSessionHydrating) {
    return {
      mode: 'verifying',
      firstAllowedPath: input.firstAllowedPath,
      notice: input.sessionNotice,
      errorCopy,
    }
  }

  if (!input.isReady) {
    return {
      mode: 'setup-required',
      firstAllowedPath: input.firstAllowedPath,
      notice: input.sessionNotice,
      errorCopy,
    }
  }

  if (input.authLoading) {
    return {
      mode: 'verifying',
      firstAllowedPath: input.firstAllowedPath,
      notice: input.sessionNotice,
      errorCopy,
    }
  }

  if (input.authError || !input.authSummary) {
    return {
      mode: 'rejected',
      firstAllowedPath: input.firstAllowedPath,
      notice: input.sessionNotice,
      errorCopy,
    }
  }

  return {
    mode: 'ready',
    firstAllowedPath: input.firstAllowedPath,
    notice: input.sessionNotice,
    errorCopy,
  }
}

function resolveLandingPath(authSummary: AuthSessionSummary | null, isReady: boolean) {
  if (!isReady) {
    return '/auth/login'
  }

  const roles = authSummary?.user.roleCodes ?? []

  if (hasAnyRole(roles, ['SUPER_ADMIN', 'INTEGRATION_ADMIN'])) {
    return '/admin/integrations'
  }

  if (hasAnyRole(roles, ['SUPER_ADMIN', 'SNAPSHOT_OPERATOR'])) {
    return '/admin/snapshots'
  }

  if (hasAnyRole(roles, ['HR_ADMIN'])) {
    return '/admin/competitions'
  }

  if (hasAnyRole(roles, ['REGION_MANAGER'])) {
    return '/admin/targets'
  }

  if (hasAnyRole(roles, ['SUPER_ADMIN', 'REPORT_VIEWER'])) {
    return '/admin/reports'
  }

  if (hasAnyRole(roles, ['SUPER_ADMIN', 'AUDITOR'])) {
    return '/admin/audit'
  }

  if (hasAnyRole(roles, ['SUPER_ADMIN'])) {
    return '/admin/auth'
  }

  if (hasAnyRole(roles, ['VISUAL_MERCHANDISER'])) {
    return '/store/checklists'
  }

  return '/store'
}

function resolveAuthErrorCopy(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return 'Session verification failed with 401. Refresh the bearer token or continue through the real login route.'
    }

    if (error.status === 403) {
      return 'Session verified but does not have access to the requested shell surface. Use a route that matches the current role and scope.'
    }
  }

  if (error instanceof Error) {
    return error.message
  }

  return null
}

function isNavAllowed(item: NavDefinition, authSummary: AuthSessionSummary | null) {
  if (!item.roles) {
    return true
  }

  return hasAnyRole(authSummary?.user.roleCodes ?? [], item.roles)
}

function isVisualMerchandiserOnly(authSummary: AuthSessionSummary | null) {
  const roles = authSummary?.user.roleCodes ?? []
  const broadRoles = ['SUPER_ADMIN', 'HR_ADMIN', 'REGION_MANAGER', 'STORE_MANAGER', 'STORE_PERSONNEL']
  return roles.includes('VISUAL_MERCHANDISER') && !hasAnyRole(roles, broadRoles)
}

function hasAnyRole(userRoles: string[], requiredRoles: string[]) {
  return requiredRoles.some((role) => userRoles.includes(role))
}

function getCurrentReturnPath(location: ReturnType<typeof useLocation>) {
  return `${location.pathname}${location.search}${location.hash}`
}

function buildAuthLoginPath(returnTo: string) {
  return `/auth/login?returnTo=${encodeURIComponent(returnTo)}`
}

function NavItem(input: {
  to: string
  icon: ReactNode
  label: string
}) {
  return (
    <NavLink
      to={input.to}
      className={({ isActive }) => `nav-link${isActive ? ' nav-link-active' : ''}`}
    >
      {input.icon}
      <span>{input.label}</span>
    </NavLink>
  )
}

export default App
