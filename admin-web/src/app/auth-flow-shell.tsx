import { Suspense } from 'react'
import { Navigate, Route, Routes, useSearchParams } from 'react-router-dom'
import { sanitizeAuthReturnPath } from '../features/auth/return-path'
import { AuthCallbackPage, AuthLoginPage, AuthLogoutPage } from './route-loaders'
import { RouteLoadingState } from './route-states'
import type { ShellState } from './shell-state'

export function AuthFlowShell(input: { shellState: ShellState; firstAllowedPath: string }) {
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
