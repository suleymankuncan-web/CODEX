import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useLocation, useNavigate } from 'react-router-dom'
import { AdminShell } from './app/admin-shell'
import { adminNavDefinitions, isNavAllowed } from './app/admin-navigation'
import { AuthFlowShell } from './app/auth-flow-shell'
import {
  buildAuthLoginPath,
  getCurrentReturnPath,
  getShellState,
  resolveLandingPath,
} from './app/shell-state'
import { preloadRouteModule } from './app/route-preloaders'
import { StoreShell } from './app/store-shell'
import { getAuthSession } from './features/auth/api'
import { useSession } from './features/session/session-context-value'
import { getBearerSessionCacheKey } from './features/session/session-storage'
import { SESSION_EXPIRED_EVENT, type SessionExpiredDetail } from './lib/api'

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
            session.mockStoreIds,
            session.mockReadStoreIds,
            session.mockAssignedStoreIds,
            session.mockRegionIds,
            session.mockReadRegionIds,
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

  useEffect(() => {
    if (shellState.mode !== 'ready') return

    preloadRouteModule(firstAllowedPath)
    preloadRouteModule(location.pathname)
  }, [firstAllowedPath, location.pathname, shellState.mode])

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

  return (
    <AdminShell
      sessionMode={session.mode}
      shellState={shellState}
      authSummary={authSummary}
      firstAllowedPath={firstAllowedPath}
      allowedAdminNav={allowedAdminNav}
      authLoading={sessionQuery.isLoading}
      authError={sessionQuery.isError}
    />
  )
}

export default App
