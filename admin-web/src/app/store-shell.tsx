import { Suspense, type ReactNode } from 'react'
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { ScreenState, StatusPill } from '../components/dashboard-primitives'
import type { AuthSessionSummary } from '../features/auth/api'
import { LanguageToggle } from '../features/localization/LanguageToggle'
import { useLocalization } from '../features/localization/useLocalization'
import {
  StoreApprovalsPage,
  StoreChecklistsPage,
  StoreCompetitionsPage,
  StoreFeedPage,
  StoreIncentivesPage,
  StoreKpiHighlightsPage,
  StoreMyPerformancePage,
  StoreRankingsPage,
  StoreShellPreviewPage,
  StoreTasksPage,
} from './route-loaders'
import { RouteLoadingState, StoreRouteGuard } from './route-states'
import {
  buildAuthLoginPath,
  getCurrentReturnPath,
  isVisualMerchandiserOnly,
  type ShellState,
} from './shell-state'

export function StoreShell(input: {
  shellState: ShellState
  authSummary: AuthSessionSummary | null
  firstAllowedPath: string
}) {
  const { t } = useLocalization()
  const checklistOnly = isVisualMerchandiserOnly(input.authSummary)
  const location = useLocation()
  const rankingsRoute = location.pathname === '/store/rankings'
  const storeRoute = (element: ReactNode, options?: { allowVm?: boolean }) => (
    <StoreRouteGuard authSummary={input.authSummary} allowVm={options?.allowVm}>
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
    <div className={`store-shell${rankingsRoute ? ' store-shell-rankings' : ''}`}>
      {rankingsRoute ? null : (
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
      )}

      <main className="store-main" aria-label={t('adminShell.storeWorkspaceAria')}>
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
              element={storeRoute(<StoreMyPerformancePage authSummary={input.authSummary} />)}
            />
            <Route
              path="/store/rankings"
              element={storeRoute(<StoreRankingsPage authSummary={input.authSummary} />)}
            />
            <Route
              path="/store/feed"
              element={storeRoute(<StoreFeedPage authSummary={input.authSummary} />)}
            />
            <Route
              path="/store/competitions"
              element={storeRoute(<StoreCompetitionsPage authSummary={input.authSummary} />)}
            />
            <Route
              path="/store/approvals"
              element={storeRoute(<StoreApprovalsPage authSummary={input.authSummary} />)}
            />
            <Route
              path="/store/incentives"
              element={storeRoute(<StoreIncentivesPage authSummary={input.authSummary} />)}
            />
            <Route path="*" element={<Navigate to="/store" replace />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  )
}
