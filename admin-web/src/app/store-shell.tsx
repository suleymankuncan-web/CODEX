import { Suspense, useState, type ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { ScreenState } from '../components/dashboard-primitives'
import type { AuthSessionSummary } from '../features/auth/api'
import { canListTargetDistributionRequests } from '../features/auth/authorization'
import { useLocalization } from '../features/localization/useLocalization'
import {
  StoreApprovalsPage,
  StoreChecklistsPage,
  StoreCompetitionsPage,
  StoreFeedPage,
  StoreHomePage,
  StoreIncentivesPage,
  StoreKpiHighlightsPage,
  StoreMyPerformancePage,
  StorePersonnelPerformancePage,
  StoreRankingsPage,
  StoreReportsPage,
  StoreSettingsPage,
  StoreTargetsPage,
  StoreTasksPage,
} from './route-loaders'
import { RouteLoadingState, StoreRouteGuard } from './route-states'
import { RouteRecoveryBoundary } from './route-recovery-boundary'
import { RouteTransitionFrame } from './route-transition-frame'
import {
  buildAuthLoginPath,
  getCurrentReturnPath,
  isVisualMerchandiserOnly,
  type ShellState,
} from './shell-state'
import { StoreSidebar } from './store-sidebar'

export function StoreShell(input: {
  shellState: ShellState
  authSummary: AuthSessionSummary | null
  firstAllowedPath: string
}) {
  const { t } = useLocalization()
  const checklistOnly = isVisualMerchandiserOnly(input.authSummary)
  const location = useLocation()
  const rankingsRoute = location.pathname === '/store/rankings'
  const storeMeRoute = location.pathname === '/store/me'
  const storePersonnelRoute = location.pathname.startsWith('/store/personnel/')
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const storeRoute = (element: ReactNode, options?: {
    allowVm?: boolean
    allowed?: boolean
    firstAllowedPath?: string
  }) => (
    <StoreRouteGuard
      authSummary={input.authSummary}
      {...(options?.allowVm === undefined ? {} : { allowVm: options.allowVm })}
      {...(options?.allowed === undefined ? {} : { allowed: options.allowed })}
      {...(options?.firstAllowedPath === undefined ? {} : { firstAllowedPath: options.firstAllowedPath })}
    >
      {element}
    </StoreRouteGuard>
  )

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
    <div
      className={`store-shell store-command-app${
        isSidebarCollapsed ? ' store-command-app-collapsed' : ''
      }${rankingsRoute ? ' store-shell-rankings' : ''}${
        storeMeRoute || storePersonnelRoute ? ' store-shell-store-me' : ''
      }`}
    >
      <StoreSidebar
        authSummary={input.authSummary}
        collapsed={isSidebarCollapsed}
        onCollapsedChange={setIsSidebarCollapsed}
      />

      <main className="store-main store-command-main" aria-label={t('adminShell.storeWorkspaceAria')}>
        <RouteTransitionFrame>
          <RouteRecoveryBoundary firstAllowedPath={input.firstAllowedPath}>
            <Suspense fallback={<RouteLoadingState />}>
              <Routes>
            <Route
              path="/store"
              element={checklistOnly ? (
                <Navigate to="/store/checklists" replace />
              ) : (
                <StoreHomePage authSummary={input.authSummary} />
              )}
            />
            <Route
              path="/store/home"
              element={checklistOnly ? (
                <Navigate to="/store/checklists" replace />
              ) : (
                <StoreHomePage authSummary={input.authSummary} />
              )}
            />
            <Route
              path="/store/checklists"
              element={storeRoute(<StoreChecklistsPage authSummary={input.authSummary} />, { allowVm: true })}
            />
            <Route
              path="/store/tasks"
              element={storeRoute(<StoreTasksPage authSummary={input.authSummary} />)}
            />
            <Route
              path="/store/kpis"
              element={storeRoute(<StoreKpiHighlightsPage authSummary={input.authSummary} />)}
            />
            <Route
              path="/store/me"
              element={storeRoute(<StoreMyPerformancePage authSummary={input.authSummary} showInternalRail={false} />)}
            />
            <Route
              path="/store/personnel/:employeeId"
              element={storeRoute(<StorePersonnelPerformancePage authSummary={input.authSummary} />)}
            />
            <Route
              path="/store/rankings"
              element={storeRoute(<StoreRankingsPage authSummary={input.authSummary} />)}
            />
            <Route
              path="/store/feed"
              element={storeRoute(<StoreFeedPage authSummary={input.authSummary} />, { allowVm: true })}
            />
            <Route
              path="/store/competitions"
              element={storeRoute(<StoreCompetitionsPage authSummary={input.authSummary} />)}
            />
            <Route
              path="/store/approvals"
              element={storeRoute(
                <StoreApprovalsPage authSummary={input.authSummary} />,
                {
                  allowed: canListTargetDistributionRequests(input.authSummary),
                  firstAllowedPath: input.firstAllowedPath,
                },
              )}
            />
            <Route
              path="/store/incentives"
              element={storeRoute(<StoreIncentivesPage authSummary={input.authSummary} />)}
            />
            <Route
              path="/store/settings"
              element={storeRoute(<StoreSettingsPage />, { allowVm: true })}
            />
            <Route
              path="/store/targets"
              element={storeRoute(<StoreTargetsPage />)}
            />
            <Route
              path="/store/reports"
              element={storeRoute(<StoreReportsPage />)}
            />
                <Route path="*" element={<Navigate to="/store" replace />} />
              </Routes>
            </Suspense>
          </RouteRecoveryBoundary>
        </RouteTransitionFrame>
      </main>
    </div>
  )
}
