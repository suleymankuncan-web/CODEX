import { Suspense, type ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router'
import type { AuthSessionSummary } from '../features/auth/api'
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
  StoreWorkforcePage,
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
import {
  findStoreRouteDefinition,
  getStoreRouteDefinitions,
  getStoreLandingPath,
  isStoreRouteAllowed,
  type StoreRouteDefinition,
  type StoreRouteId,
} from './store-route-registry'
import { StoreSidebar } from './store-sidebar'
import { StoreErrorState, StoreSurfacePage } from '../pages/store-surface-primitives'
import { ApplicationSkipLink, applicationMainContentId } from './application-skip-link'

export function StoreShell(input: {
  shellState: ShellState
  authSummary: AuthSessionSummary | null
  firstAllowedPath: string
}) {
  const { t } = useLocalization()
  const checklistOnly = isVisualMerchandiserOnly(input.authSummary)
  const location = useLocation()
  const activeStoreRoute = findStoreRouteDefinition(location.pathname)
  const storeLandingPath = getStoreLandingPath(input.authSummary)
  const storeHomeRoute = activeStoreRoute?.id === 'home'
  const storeMeRoute = activeStoreRoute?.id === 'me'
  const storePersonnelRoute = activeStoreRoute?.id === 'personnel'
  const storeChecklistRoute = activeStoreRoute?.id === 'checklists'
  const storeIncentivesRoute = activeStoreRoute?.id === 'incentives'
  const storeFeedRoute = activeStoreRoute?.id === 'feed'
  const storeReportsRoute = activeStoreRoute?.id === 'reports'
  const checklistOnlyRoute = storeChecklistRoute && checklistOnly
  const storeRoute = (route: StoreRouteDefinition, element: ReactNode) => (
    <StoreRouteGuard
      authSummary={input.authSummary}
      {...(route.allowVisualMerchandiser === undefined ? {} : { allowVm: route.allowVisualMerchandiser })}
      allowed={isStoreRouteAllowed(route, input.authSummary)}
      firstAllowedPath={input.firstAllowedPath}
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

  if (location.pathname === '/store' && storeLandingPath !== '/store/home') {
    return <Navigate to={storeLandingPath} replace />
  }

  return (
    <div
      className={`store-shell store-command-app${
        storeHomeRoute ? ' store-shell-store-home' : ''
      }${
        storeMeRoute || storePersonnelRoute ? ' store-shell-store-me' : ''
      }${
        checklistOnlyRoute ? ' store-shell-store-checklists' : ''
      }${
        storeChecklistRoute ? ' store-shell-checklist-command' : ''
      }${
        storeIncentivesRoute ? ' store-shell-store-incentives' : ''
      }${
        storeFeedRoute ? ' store-shell-store-feed' : ''
      }${
        storeReportsRoute ? ' store-shell-store-reports' : ''
      }`}
    >
      <ApplicationSkipLink />
      {checklistOnlyRoute ? null : (
        <StoreSidebar
          authSummary={input.authSummary}
        />
      )}
      {checklistOnlyRoute ? null : <PilotFeedbackControl />}

      <main
        className="store-main store-command-main"
        aria-label={t('adminShell.storeWorkspaceAria')}
        id={applicationMainContentId}
        tabIndex={-1}
      >
        <RouteTransitionFrame>
          <RouteRecoveryBoundary firstAllowedPath={input.firstAllowedPath}>
            <Suspense fallback={<RouteLoadingState />}>
              <Routes>
                {getStoreRouteDefinitions().flatMap((route) =>
                  [route.routePath, ...(route.aliases ?? [])].map((path) => (
                    <Route
                      path={path}
                      key={`${route.id}:${path}`}
                      element={renderStoreRoute({
                        authSummary: input.authSummary,
                        checklistOnly,
                        route,
                        storeRoute,
                      })}
                    />
                  )),
                )}
                <Route path="*" element={<Navigate to="/store" replace />} />
              </Routes>
            </Suspense>
          </RouteRecoveryBoundary>
        </RouteTransitionFrame>
      </main>
    </div>
  )
}

function renderStoreRoute(input: {
  authSummary: AuthSessionSummary | null
  checklistOnly: boolean
  route: StoreRouteDefinition
  storeRoute: (route: StoreRouteDefinition, element: ReactNode) => ReactNode
}) {
  if (input.route.id === 'home' && input.checklistOnly) {
    return <Navigate to="/store/checklists" replace />
  }

  return input.storeRoute(input.route, getStoreRouteElement(input.route.id, input.authSummary))
}

function getStoreRouteElement(routeId: StoreRouteId, authSummary: AuthSessionSummary | null) {
  switch (routeId) {
    case 'home':
      return <StoreHomePage authSummary={authSummary} />
    case 'checklists':
      return <StoreChecklistsPage authSummary={authSummary} />
    case 'tasks':
      return <StoreTasksPage authSummary={authSummary} />
    case 'kpis':
      return <StoreKpiHighlightsPage authSummary={authSummary} />
    case 'me':
      return <StoreMyPerformancePage authSummary={authSummary} />
    case 'personnel':
      return <StorePersonnelPerformancePage authSummary={authSummary} />
    case 'rankings':
      return <StoreRankingsPage authSummary={authSummary} />
    case 'feed':
      return <StoreFeedPage authSummary={authSummary} />
    case 'competitions':
      return <StoreCompetitionsPage authSummary={authSummary} />
    case 'approvals':
      return <StoreApprovalsPage authSummary={authSummary} />
    case 'incentives':
      return <StoreIncentivesPage authSummary={authSummary} />
    case 'settings':
      return <StoreSettingsPage authSummary={authSummary} />
    case 'targets':
      return <StoreTargetsPage authSummary={authSummary} />
    case 'workforce':
      return <StoreWorkforcePage authSummary={authSummary} />
    case 'reports':
      return <StoreReportsPage authSummary={authSummary} />
    default:
      return <Navigate to="/store" replace />
  }
}
