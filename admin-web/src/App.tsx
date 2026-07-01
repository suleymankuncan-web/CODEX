import { useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
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
import { getBearerSessionCacheKey, isCookieBrowserSession } from './features/session/session-storage'
import { SESSION_EXPIRED_EVENT, type SessionExpiredDetail } from './lib/api'
import { StoreFeedPrototypeShell } from './prototypes/store-feed-prototype-shell'
import { StoreChecklistSessionModalV1Prototype } from './prototypes/store-checklist-session-modal-v1'
import { StoreHomeCommandV1Prototype } from './prototypes/store-home-command-v1'
import { StoreIncentivesPrototypeShell } from './prototypes/store-incentives-prototype-shell'
import { AdminMasterDataCommandV1Prototype } from './prototypes/admin/master-data-command-v1'

function App() {
  const location = useLocation()
  const pathname = location.pathname
  const isStoreIncentivesPrototype =
    import.meta.env.DEV &&
    pathname === '/store/incentives' &&
    new URLSearchParams(location.search).get('prototype') === 'command-v2'
  const isStoreHomePrototype =
    import.meta.env.DEV &&
    pathname === '/store/home' &&
    new URLSearchParams(location.search).get('prototype') === 'command-v1'
  const isStoreFeedPrototype =
    import.meta.env.DEV &&
    pathname === '/store/feed' &&
    new URLSearchParams(location.search).get('prototype') === 'region-composer-v1'
  const isStoreChecklistSessionPrototype =
    import.meta.env.DEV &&
    pathname === '/store/checklists' &&
    new URLSearchParams(location.search).get('prototype') === 'session-modal-v1'
  const isAdminMasterDataPrototype =
    import.meta.env.DEV &&
    pathname === '/admin/master-data' &&
    new URLSearchParams(location.search).get('prototype') === 'master-data-command-v1'
  const isPrototypeRoute =
    isStoreIncentivesPrototype ||
    isStoreHomePrototype ||
    isStoreFeedPrototype ||
    isStoreChecklistSessionPrototype ||
    isAdminMasterDataPrototype
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { session, isReady, isProviderSessionHydrating, expireSession } = useSession()
  const [sessionNotice, setSessionNotice] = useState<string | null>(null)
  const bearerTokenReadiness = session.bearerToken.trim() ? 'token-present' : 'token-missing'
  const bearerSessionKey = getBearerSessionCacheKey(session.bearerToken)
  const cookieSessionKey = session.browserSessionKey.trim() || 'cookie-session-missing'
  const shellBearerSessionKey = isCookieBrowserSession(session) ? cookieSessionKey : bearerSessionKey
  const currentReturnPath = getCurrentReturnPath(location)
  const sessionQuery = useQuery({
    queryKey:
      session.mode === 'bearer'
        ? [
            'shell-session',
            session.mode,
            session.browserSessionTransport,
            bearerTokenReadiness,
            shellBearerSessionKey,
          ]
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
    enabled: isReady && !isPrototypeRoute,
    retry: false,
    staleTime: 30_000,
  })

  useLayoutEffect(() => {
    const handleSessionExpired = (event: Event) => {
      const detail = (event as CustomEvent<SessionExpiredDetail>).detail
      expireSession()
      setSessionNotice(
        detail?.message
          ? `Session expired while calling ${detail.path}. Sign in again and verify the session.`
          : 'Session expired. Sign in again and verify the session.',
      )
      navigate(buildAuthLoginPath(currentReturnPath), { replace: true })
    }

    window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired)
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired)
  }, [currentReturnPath, expireSession, navigate])

  useEffect(() => {
    if (session.mode !== 'bearer') {
      return
    }

    if (session.browserSessionTransport !== 'cookie' && bearerTokenReadiness !== 'token-present') {
      return
    }

    void queryClient.invalidateQueries({
      predicate: (query) => query.queryKey[0] !== 'shell-session',
    })
  }, [
    bearerSessionKey,
    bearerTokenReadiness,
    cookieSessionKey,
    queryClient,
    session.browserSessionTransport,
    session.mode,
  ])

  const authSummary = sessionQuery.data ?? null
  const visibleSessionNotice = ['/admin/session', '/auth/login'].includes(pathname)
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
    if (isPrototypeRoute) return
    if (pathname.startsWith('/auth')) return

    preloadRouteModule(pathname)
  }, [isPrototypeRoute, pathname])

  useEffect(() => {
    if (isPrototypeRoute) return
    if (shellState.mode !== 'ready') return

    preloadRouteModule(firstAllowedPath)
    preloadRouteModule(pathname)
  }, [firstAllowedPath, isPrototypeRoute, pathname, shellState.mode])

  useEffect(() => {
    if (isPrototypeRoute) return
    if (shellState.mode !== 'ready') return

    let cancelled = false
    void import('./app/route-data-preloaders')
      .then(({ prefetchRouteData }) => {
        if (cancelled) return

        prefetchRouteData({
          queryClient,
          pathname: firstAllowedPath,
          authSummary,
        })
        prefetchRouteData({
          queryClient,
          pathname,
          authSummary,
        })
      })
      .catch(() => undefined)

    return () => {
      cancelled = true
    }
  }, [authSummary, firstAllowedPath, isPrototypeRoute, pathname, queryClient, shellState.mode])

  if (isStoreIncentivesPrototype) {
    return <StoreIncentivesPrototypeShell />
  }

  if (isStoreHomePrototype) {
    return <StoreHomeCommandV1Prototype />
  }

  if (isStoreFeedPrototype) {
    return <StoreFeedPrototypeShell />
  }

  if (isStoreChecklistSessionPrototype) {
    return <StoreChecklistSessionModalV1Prototype />
  }

  if (isAdminMasterDataPrototype) {
    return <AdminMasterDataCommandV1Prototype />
  }

  if (pathname.startsWith('/auth')) {
    return <AuthFlowShell shellState={shellState} firstAllowedPath={firstAllowedPath} />
  }

  if (pathname.startsWith('/store')) {
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
