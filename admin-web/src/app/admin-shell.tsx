import { Suspense, useState, type ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router'
import type { AuthSessionSummary } from '../features/auth/api'
import { useLocalization } from '../features/localization/useLocalization'
import { PilotFeedbackControl } from '../features/pilot-feedback/PilotFeedbackControl'
import type { SessionMode } from '../features/session/session-storage'
import { AdminSidebar } from './admin-sidebar'
import { ApplicationSkipLink, applicationMainContentId } from './application-skip-link'
import type { NavDefinition } from './admin-navigation'
import {
  AdminChecklistTemplatesPage,
  AdminFeedPage,
  AdminInboxPage,
  AdminIncentivesPage,
  AdminKpiConfigPage,
  AdminDataQualityCenterPage,
  AdminPilotFeedbackPage,
  AuditCenterPage,
  AuthActionStoreAssignmentAuditPage,
  AuthAssignmentAuditPage,
  AuthCatalogPage,
  AuthManagementPage,
  AuthUserAuditPage,
  CompetitionDashboardPage,
  ImportBatchDetailPage,
  IntegrationDashboardPage,
  MasterDataBootstrapPage,
  OperationsControlTowerPage,
  ReportsChecklistsPage,
  ReportsKpisPage,
  ReportsSnapshotRunsPage,
  ReportsSummaryPage,
  ReportsTurnoverPage,
  ReportsWorkforcePage,
  SessionReadinessPage,
  SnapshotRunDetailPage,
  SnapshotsDashboardPage,
  TargetApprovalQueuePage,
} from './route-loaders'
import { AdminRouteGuard, RouteLoadingState } from './route-states'
import { RouteRecoveryBoundary } from './route-recovery-boundary'
import { RouteTransitionFrame } from './route-transition-frame'
import type { ShellState } from './shell-state'

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
  const location = useLocation()
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const isMasterDataSurface = location.pathname.startsWith('/admin/master-data')
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
    <div
      className={[
        'admin-command-app',
        isSidebarCollapsed ? 'admin-command-app-collapsed' : '',
        isMasterDataSurface ? 'admin-command-app-master-data' : '',
      ].filter(Boolean).join(' ')}
      data-admin-surface-foundation="v1"
    >
      <ApplicationSkipLink />
      <AdminSidebar
        allowedAdminNav={input.allowedAdminNav}
        authSummary={input.authSummary}
        collapsed={isSidebarCollapsed}
        onCollapsedChange={setIsSidebarCollapsed}
      />
      {input.shellState.mode === 'ready' ? <PilotFeedbackControl /> : null}

      <main
        className="admin-command-main"
        aria-label={t('adminShell.adminWorkspaceAria')}
        id={applicationMainContentId}
        tabIndex={-1}
      >
        <RouteTransitionFrame>
          <RouteRecoveryBoundary firstAllowedPath={input.firstAllowedPath}>
            <Suspense fallback={<RouteLoadingState />}>
              <Routes>
            <Route path="/" element={<Navigate to={input.firstAllowedPath} replace />} />
            <Route
              path="/admin/session"
              element={adminRoute([
                'SUPER_ADMIN',
                'INTEGRATION_ADMIN',
                'HR_ADMIN',
                'SNAPSHOT_OPERATOR',
                'REGION_MANAGER',
                'AUDITOR',
                'STORE_MANAGER',
                'STORE_PERSONNEL',
                'VISUAL_MERCHANDISER',
              ],
                <SessionReadinessPage />,
              )}
            />
            <Route
              path="/admin/operations"
              element={adminRoute(['SUPER_ADMIN'], <OperationsControlTowerPage />)}
            />
            <Route
              path="/admin/data-quality"
              element={adminRoute(['SUPER_ADMIN'], <AdminDataQualityCenterPage />)}
            />
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
              element={adminRoute(['SUPER_ADMIN', 'HR_ADMIN'], <AdminInboxPage authSummary={input.authSummary} />)}
            />
            <Route
              path="/admin/feed"
              element={adminRoute(['SUPER_ADMIN', 'HR_ADMIN', 'REGION_MANAGER'], <AdminFeedPage authSummary={input.authSummary} />)}
            />
            <Route
              path="/admin/checklists"
              element={adminRoute(['SUPER_ADMIN', 'HR_ADMIN'], <AdminChecklistTemplatesPage authSummary={input.authSummary} />)}
            />
            <Route
              path="/admin/competitions"
              element={adminRoute(['SUPER_ADMIN', 'HR_ADMIN', 'REGION_MANAGER'], <CompetitionDashboardPage authSummary={input.authSummary} />)}
            />
            <Route
              path="/admin/reports"
              element={adminRoute(['SUPER_ADMIN'], <ReportsSummaryPage />)}
            />
            <Route
              path="/admin/reports/snapshot-runs"
              element={adminRoute(['SUPER_ADMIN'], <ReportsSnapshotRunsPage />)}
            />
            <Route
              path="/admin/reports/workforce/:snapshotRunId"
              element={adminRoute(['SUPER_ADMIN'], <ReportsWorkforcePage />)}
            />
            <Route
              path="/admin/reports/kpis/:snapshotRunId"
              element={adminRoute(['SUPER_ADMIN'], <ReportsKpisPage />)}
            />
            <Route
              path="/admin/reports/checklists/:snapshotRunId"
              element={adminRoute(['SUPER_ADMIN'], <ReportsChecklistsPage />)}
            />
            <Route
              path="/admin/reports/turnover/:snapshotRunId"
              element={adminRoute(['SUPER_ADMIN'], <ReportsTurnoverPage />)}
            />
            <Route
              path="/admin/targets"
              element={adminRoute(['SUPER_ADMIN', 'REGION_MANAGER'], <TargetApprovalQueuePage authSummary={input.authSummary} />)}
            />
            <Route
              path="/admin/incentives"
              element={adminRoute(['SUPER_ADMIN'], <AdminIncentivesPage authSummary={input.authSummary} />)}
            />
            <Route
              path="/admin/kpi-config"
              element={adminRoute(['SUPER_ADMIN'], <AdminKpiConfigPage />)}
            />
            <Route
              path="/admin/pilot-feedback"
              element={adminRoute(['SUPER_ADMIN'], <AdminPilotFeedbackPage />)}
            />
            <Route
              path="/admin/auth"
              element={adminRoute(['SUPER_ADMIN'], <AuthManagementPage />)}
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
