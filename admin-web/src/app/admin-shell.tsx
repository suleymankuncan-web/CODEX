import { Suspense, type ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { KeyRound, ShieldCheck } from 'lucide-react'
import { KeyValue, StatusPill } from '../components/dashboard-primitives'
import type { AuthSessionSummary } from '../features/auth/api'
import { formatDisplayRoles } from '../features/auth/display'
import { useLocalization } from '../features/localization/useLocalization'
import type { SessionMode } from '../features/session/session-storage'
import { NavItem } from './admin-nav-item'
import type { NavDefinition } from './admin-navigation'
import {
  AdminChecklistTemplatesPage,
  AdminFeedPage,
  AdminInboxPage,
  AdminKpiConfigPage,
  AuditCenterPage,
  AuthActionStoreAssignmentAuditPage,
  AuthAssignmentAuditPage,
  AuthCatalogPage,
  AuthDashboardPage,
  AuthUserAuditPage,
  CompetitionDashboardPage,
  ImportBatchDetailPage,
  IntegrationDashboardPage,
  MasterDataBootstrapPage,
  ReportsChecklistsPage,
  ReportsKpisPage,
  ReportsSnapshotRunsPage,
  ReportsSummaryPage,
  ReportsTurnoverPage,
  ReportsWorkforcePage,
  SnapshotRunDetailPage,
  SnapshotsDashboardPage,
  TargetApprovalQueuePage,
} from './route-loaders'
import { AdminRouteGuard, RouteLoadingState, SessionGate } from './route-states'
import { RouteRecoveryBoundary } from './route-recovery-boundary'
import { RouteTransitionFrame } from './route-transition-frame'
import {
  formatAdminShellAuthState,
  formatAdminShellSessionMode,
  formatAdminShellState,
  type ShellState,
} from './shell-state'

export function AdminShell(input: {
  sessionMode: SessionMode
  shellState: ShellState
  authSummary: AuthSessionSummary | null
  firstAllowedPath: string
  allowedAdminNav: NavDefinition[]
  authLoading: boolean
  authError: boolean
}) {
  const { t } = useLocalization()
  const roleSummary = formatDisplayRoles(input.authSummary?.user.roleCodes, t('adminShell.noResolvedRoles'))
  const scopeSummary = input.authSummary
    ? t('adminShell.scopeSummary', {
        companyCount: input.authSummary.scopeSummary.companyCount,
        regionCount: input.authSummary.scopeSummary.regionCount,
        storeCount: input.authSummary.scopeSummary.storeCount,
      })
    : t('adminShell.scopePending')
  const adminRoute = (roles: string[], element: ReactNode) => (
    <AdminRouteGuard
      shellState={input.shellState}
      authSummary={input.authSummary}
      roles={roles}
    >
      {element}
    </AdminRouteGuard>
  )

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-kicker">{t('adminShell.brandKicker')}</div>
          <h1>{t('adminShell.brandTitle')}</h1>
          <p>{t('adminShell.brandCopy')}</p>
        </div>

        <nav className="nav-stack" aria-label={t('adminShell.primaryNavigation')}>
          {input.allowedAdminNav.map((item) => (
            <NavItem key={item.to} to={item.to} icon={item.icon} label={t(item.labelKey)} />
          ))}
          <NavItem to="/store" icon={KeyRound} label={t('adminShell.nav.storePreview')} />
          <NavItem to="/auth/login" icon={ShieldCheck} label={t('adminShell.nav.realLogin')} />
        </nav>

        <div className="sidebar-note">
          <span>{t('adminShell.phaseLabel')}</span>
          <p>{t('adminShell.phaseCopy')}</p>
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div>
            <div className="eyebrow">{t('adminShell.topbarEyebrow')}</div>
            <p className="topbar-copy">{t('adminShell.topbarCopy')}</p>
          </div>
          <div className="topbar-cluster">
            <div className={`env-chip${input.shellState.mode === 'setup-required' ? ' env-chip-warning' : ''}`}>
              {t('adminShell.sessionLabel')}: {formatAdminShellSessionMode(input.sessionMode, t)}{' '}
              {input.shellState.mode === 'setup-required' ? t('adminShell.needsSetup') : t('adminShell.configured')}
            </div>
            <div className={`env-chip${input.authError ? ' env-chip-warning' : ''}`}>
              {t('adminShell.authBootstrapLabel')}: {formatAdminShellAuthState(input.authLoading, input.authError, Boolean(input.authSummary), t)}
            </div>
            <div className="env-chip">
              {t('adminShell.landingLabel')}: <code>{input.firstAllowedPath}</code>
            </div>
            {input.authSummary ? (
              <div className="env-chip">
                {t('adminShell.userLabel')}: <code>{input.authSummary.user.userId}</code>
              </div>
            ) : null}
          </div>
        </header>

        <section className="panel shell-context-panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">{t('adminShell.landingContextEyebrow')}</div>
              <h3>{t('adminShell.landingContextTitle')}</h3>
            </div>
            <StatusPill tone={input.shellState.mode === 'ready' ? 'calm' : input.shellState.mode === 'verifying' ? 'warning' : 'danger'}>
              {formatAdminShellState(input.shellState.mode, t)}
            </StatusPill>
          </div>
          <div className="key-grid">
            <KeyValue label={t('adminShell.recommendedLanding')} value={input.firstAllowedPath} />
            <KeyValue label={t('adminShell.resolvedRoles')} value={roleSummary} />
            <KeyValue label={t('adminShell.resolvedScope')} value={scopeSummary} />
            <KeyValue
              label={t('adminShell.failureHandling')}
              value={input.sessionMode === 'bearer' ? t('adminShell.failureHandlingBearer') : t('adminShell.failureHandlingMock')}
            />
          </div>
          {input.shellState.notice ? (
            <div className="shell-notice shell-notice-warning">{input.shellState.notice}</div>
          ) : null}
        </section>

        <RouteTransitionFrame>
          <RouteRecoveryBoundary firstAllowedPath={input.firstAllowedPath}>
            <Suspense fallback={<RouteLoadingState />}>
              <Routes>
            <Route path="/" element={<Navigate to={input.firstAllowedPath} replace />} />
            <Route path="/admin/session" element={<SessionGate />} />
            <Route
              path="/admin/integrations"
              element={adminRoute(['SUPER_ADMIN', 'INTEGRATION_ADMIN'], <IntegrationDashboardPage />)}
            />
            <Route
              path="/admin/integrations/:batchId"
              element={adminRoute(['SUPER_ADMIN', 'INTEGRATION_ADMIN'], <ImportBatchDetailPage />)}
            />
            <Route
              path="/admin/master-data"
              element={adminRoute(['SUPER_ADMIN', 'HR_ADMIN', 'INTEGRATION_ADMIN'], <MasterDataBootstrapPage />)}
            />
            <Route
              path="/admin/master-data/:batchId"
              element={adminRoute(['SUPER_ADMIN', 'HR_ADMIN', 'INTEGRATION_ADMIN'], <MasterDataBootstrapPage />)}
            />
            <Route
              path="/admin/snapshots"
              element={adminRoute(['SUPER_ADMIN', 'SNAPSHOT_OPERATOR'], <SnapshotsDashboardPage />)}
            />
            <Route
              path="/admin/snapshots/:snapshotRunId"
              element={adminRoute(['SUPER_ADMIN', 'SNAPSHOT_OPERATOR'], <SnapshotRunDetailPage />)}
            />
            <Route
              path="/admin/inbox"
              element={adminRoute(['SUPER_ADMIN', 'REPORT_VIEWER', 'HR_ADMIN'], <AdminInboxPage authSummary={input.authSummary} />)}
            />
            <Route
              path="/admin/feed"
              element={adminRoute(['SUPER_ADMIN', 'HR_ADMIN', 'REGION_MANAGER'], <AdminFeedPage authSummary={input.authSummary} />)}
            />
            <Route
              path="/admin/checklists"
              element={adminRoute(['SUPER_ADMIN', 'HR_ADMIN'], <AdminChecklistTemplatesPage />)}
            />
            <Route
              path="/admin/competitions"
              element={adminRoute(['SUPER_ADMIN', 'HR_ADMIN', 'REPORT_VIEWER', 'REGION_MANAGER'], <CompetitionDashboardPage authSummary={input.authSummary} />)}
            />
            <Route
              path="/admin/reports"
              element={adminRoute(['SUPER_ADMIN', 'REPORT_VIEWER'], <ReportsSummaryPage />)}
            />
            <Route
              path="/admin/reports/snapshot-runs"
              element={adminRoute(['SUPER_ADMIN', 'REPORT_VIEWER'], <ReportsSnapshotRunsPage />)}
            />
            <Route
              path="/admin/reports/workforce/:snapshotRunId"
              element={adminRoute(['SUPER_ADMIN', 'REPORT_VIEWER'], <ReportsWorkforcePage />)}
            />
            <Route
              path="/admin/reports/kpis/:snapshotRunId"
              element={adminRoute(['SUPER_ADMIN', 'REPORT_VIEWER'], <ReportsKpisPage />)}
            />
            <Route
              path="/admin/reports/checklists/:snapshotRunId"
              element={adminRoute(['SUPER_ADMIN', 'REPORT_VIEWER'], <ReportsChecklistsPage />)}
            />
            <Route
              path="/admin/reports/turnover/:snapshotRunId"
              element={adminRoute(['SUPER_ADMIN', 'REPORT_VIEWER'], <ReportsTurnoverPage />)}
            />
            <Route
              path="/admin/targets"
              element={adminRoute(['SUPER_ADMIN', 'REPORT_VIEWER', 'REGION_MANAGER'], <TargetApprovalQueuePage authSummary={input.authSummary} />)}
            />
            <Route
              path="/admin/kpi-config"
              element={adminRoute(['SUPER_ADMIN'], <AdminKpiConfigPage />)}
            />
            <Route
              path="/admin/auth"
              element={adminRoute(['SUPER_ADMIN'], <AuthDashboardPage />)}
            />
            <Route
              path="/admin/auth/catalog"
              element={adminRoute(['SUPER_ADMIN'], <AuthCatalogPage />)}
            />
            <Route
              path="/admin/auth/users/:userId/audit"
              element={adminRoute(['SUPER_ADMIN'], <AuthUserAuditPage />)}
            />
            <Route
              path="/admin/auth/role-assignments/:assignmentId/audit"
              element={adminRoute(['SUPER_ADMIN'], <AuthAssignmentAuditPage />)}
            />
            <Route
              path="/admin/auth/action-store-assignments/:assignmentId/audit"
              element={adminRoute(['SUPER_ADMIN'], <AuthActionStoreAssignmentAuditPage />)}
            />
            <Route
              path="/admin/audit/users/:userId/audit"
              element={adminRoute(['SUPER_ADMIN', 'AUDITOR'], <AuthUserAuditPage />)}
            />
            <Route
              path="/admin/audit/role-assignments/:assignmentId/audit"
              element={adminRoute(['SUPER_ADMIN', 'AUDITOR'], <AuthAssignmentAuditPage />)}
            />
            <Route
              path="/admin/audit/action-store-assignments/:assignmentId/audit"
              element={adminRoute(['SUPER_ADMIN', 'AUDITOR'], <AuthActionStoreAssignmentAuditPage />)}
            />
            <Route
              path="/admin/audit"
              element={adminRoute(['SUPER_ADMIN', 'AUDITOR'], <AuditCenterPage />)}
            />
                <Route path="*" element={<Navigate to={input.firstAllowedPath} replace />} />
              </Routes>
            </Suspense>
          </RouteRecoveryBoundary>
        </RouteTransitionFrame>
      </main>
    </div>
  )
}
