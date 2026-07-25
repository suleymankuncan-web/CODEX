import { Suspense } from 'react'
import { Navigate, Route, Routes, useLocation, useSearchParams } from 'react-router'
import { sanitizeAuthReturnPath } from '../features/auth/return-path'
import { AuthCallbackPage, AuthLoginPage, AuthLogoutPage } from './route-loaders'
import { RouteLoadingState } from './route-states'
import { RouteRecoveryBoundary } from './route-recovery-boundary'
import type { ShellState } from './shell-state'

export function AuthFlowShell(input: { shellState: ShellState; firstAllowedPath: string }) {
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const returnTo = sanitizeAuthReturnPath(searchParams.get('returnTo'))
  const readyPath = returnTo ?? input.firstAllowedPath
  const shellClassName = location.pathname === '/auth/login' ? 'auth-flow-shell auth-flow-shell-login' : 'auth-flow-shell'

  return (
    <div className={shellClassName}>
      <RouteRecoveryBoundary firstAllowedPath={readyPath}>
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
      </RouteRecoveryBoundary>
    </div>
  )
}
