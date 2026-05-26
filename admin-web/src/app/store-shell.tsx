import { Suspense, type ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import type { AuthSessionSummary } from '../features/auth/api'
import {
  canListTargetDistributionRequests,
  canOpenStoreChecklists,
} from '../features/auth/authorization'
import { useLocalization } from '../features/localization/useLocalization'
import { PilotFeedbackControl } from '../features/pilot-feedback/PilotFeedbackControl'
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
import { RouteLoadingState, RouteProgressState, StoreRouteGuard } from './route-states'
import { RouteRecoveryBoundary } from './route-recovery-boundary'
import { RouteTransitionFrame } from './route-transition-frame'
import {
  buildAuthLoginPath,
  getCurrentReturnPath,
  isVisualMerchandiserOnly,
  type ShellState,
} from './shell-state'
import { resolveStorePersona } from './store-navigation'
import { StoreSidebar } from './store-sidebar'
import { StoreErrorState, StoreSurfacePage } from '../pages/store-surface-primitives'

export function StoreShell(input: {
  shellState: ShellState
  authSummary: AuthSessionSummary | null
  firstAllowedPath: string
}) {
  const { t } = useLocalization()
  const checklistOnly = isVisualMerchandiserOnly(input.authSummary)
  const storePersona = resolveStorePersona(input.authSummary)
  const storeChecklistAllowed =
    storePersona !== 'personnel' &&
    canOpenStoreChecklists(input.authSummary)
  const storeTasksAllowed = storePersona !== 'personnel'
  const location = useLocation()
  const storeMeRoute = location.pathname === '/store/me'
  const storePersonnelRoute = location.pathname.startsWith('/store/personnel/')
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
      <RouteProgressState
        title={t('storeHome.shellVerifyingTitle')}
        copy={t('storeHome.shellVerifyingCopy')}
      />
    )
  }

  if (input.shellState.mode === 'rejected') {
    return (
      <StoreSurfacePage ariaLabel={t('storeHome.shellRejectedTitle')} className="tw:p-4">
        <StoreErrorState
          title={t('storeHome.shellRejectedTitle')}
          description={input.shellState.notice ?? input.shellState.errorCopy ?? t('storeHome.shellRejectedFallback')}
        />
      </StoreSurfacePage>
    )
  }

  return (
    <div
      className={`store-shell store-command-app${
        storeMeRoute || storePersonnelRoute ? ' store-shell-store-me' : ''
      }`}
    >
      <StoreSidebar
        authSummary={input.authSummary}
      />
      <PilotFeedbackControl />

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
              element={storeRoute(
                <StoreChecklistsPage authSummary={input.authSummary} />,
                {
                  allowVm: true,
                  allowed: storeChecklistAllowed,
                  firstAllowedPath: input.firstAllowedPath,
                },
              )}
            />
            <Route
              path="/store/tasks"
              element={storeRoute(
                <StoreTasksPage authSummary={input.authSummary} />,
                {
                  allowed: storeTasksAllowed,
                  firstAllowedPath: input.firstAllowedPath,
                },
              )}
            />
            <Route
              path="/store/kpis"
              element={storeRoute(<StoreKpiHighlightsPage authSummary={input.authSummary} />)}
            />
            <Route
              path="/store/me"
              element={storeRoute(<StoreMyPerformancePage authSummary={input.authSummary} />)}
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
