import { Suspense, useState, type ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import type { AuthSessionSummary } from '../features/auth/api'
import { useLocalization } from '../features/localization/useLocalization'
import type { SessionMode } from '../features/session/session-storage'
import { AdminSidebar } from './admin-sidebar'
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
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
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
    <div className={`admin-command-app${isSidebarCollapsed ? ' admin-command-app-collapsed' : ''}`}>
      <AdminSidebar
        allowedAdminNav={input.allowedAdminNav}
        authSummary={input.authSummary}
        collapsed={isSidebarCollapsed}
        onCollapsedChange={setIsSidebarCollapsed}
      />

      <main className="admin-command-main" aria-label={t('adminShell.adminWorkspaceAria')}>
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
