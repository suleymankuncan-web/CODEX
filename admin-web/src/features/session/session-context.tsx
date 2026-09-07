import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { isClerkSessionProviderAvailable } from '../auth/clerk-config'
import { clearBrowserSessionCookie, createBrowserSession, recoverBrowserSessionAfterReload } from '../../lib/api'
import {
  SessionContext,
  type ProviderSessionStartOptions,
  type SessionContextValue,
} from './session-context-value'
import {
  clearClientBearerSession,
  defaultSession,
  isSessionReady,
  isCookieBrowserSession,
  normalizeSession,
  persistClientSession,
  readClientSession,
  writeBrowserSessionCsrfToken,
  writeClientBearerSession,
  type SessionState,
} from './session-storage'
import { resolveSessionSaveTransition } from './session-save-transition'

export function SessionProvider(input: { children: ReactNode }) {
  const [session, setSession] = useState<SessionState>(() => readClientSession())
  const sessionRef = useRef(session)
  const browserSessionAuthorizationFingerprintRef = useRef('')
  const [isProviderSessionHydrating, setProviderSessionHydrating] = useState(() =>
    isClerkSessionProviderAvailable() || (isCookieBrowserSession(session) && Boolean(session.browserSessionKey) && !isSessionReady(session)),
  )

  useEffect(() => {
    sessionRef.current = session
  }, [session])

  useEffect(() => {
    persistClientSession(session)
  }, [session])

  useEffect(() => {
    const initial = sessionRef.current
    if (isClerkSessionProviderAvailable() || !isCookieBrowserSession(initial) ||
      !initial.browserSessionKey || isSessionReady(initial)) return
    const controller = new AbortController()
    let cancelled = false
    const timeout = window.setTimeout(() => controller.abort(), 15_000)
    void recoverBrowserSessionAfterReload(controller.signal).catch(() => null).then((nonce) => {
      if (cancelled) return
      setSession((current) => {
        if (cancelled || !isCookieBrowserSession(current) || current.browserSessionKey !== initial.browserSessionKey) return current
        writeBrowserSessionCsrfToken(nonce ?? '')
        return normalizeSession({ ...current, browserSessionKey: nonce ? current.browserSessionKey : '' })
      })
      setProviderSessionHydrating(false)
    }).finally(() => window.clearTimeout(timeout))
    return () => { cancelled = true; controller.abort(); window.clearTimeout(timeout) }
  }, [])

  const saveSession = useCallback(async (next: SessionState) => {
    const transition = resolveSessionSaveTransition(sessionRef.current, next)
    const { nextSession } = transition

    if (transition.shouldClearBrowserSessionCookie) {
      try {
        await clearBrowserSessionCookie()
      } catch (error) {
        clearClientBearerSession()
        throw error
      }
    }

    if (transition.bearerTokenToPersist !== null) {
      writeClientBearerSession(transition.bearerTokenToPersist)
    } else {
      clearClientBearerSession()
    }

    persistClientSession(nextSession)
    setSession(nextSession)
  }, [])

  const resetSession = useCallback(async () => {
    if (sessionRef.current.browserSessionTransport === 'cookie') {
      try {
        await clearBrowserSessionCookie()
      } catch (error) {
        clearClientBearerSession()
        throw error
      }
    } else {
      clearClientBearerSession()
    }
    setSession(defaultSession)
  }, [])

  const expireSession = useCallback(() => {
    if (sessionRef.current.browserSessionTransport === 'cookie') {
      writeBrowserSessionCsrfToken('')
      clearClientBearerSession()
      void clearBrowserSessionCookie().catch(() => undefined)
    } else {
      clearClientBearerSession()
    }
    setSession((current) =>
      normalizeSession({
        ...current,
        bearerToken: '',
        browserSessionKey: '',
      }),
    )
  }, [])

  const startBearerSession = useCallback((token: string, providerIdToken?: string | null) => {
    writeClientBearerSession(token, providerIdToken)
    setSession((current) =>
      normalizeSession({
        ...current,
        mode: 'bearer',
        bearerToken: token,
        browserSessionKey: '',
      }),
    )
  }, [])

  const startProviderSession = useCallback(async (
    token: string,
    providerIdToken?: string | null,
    options?: ProviderSessionStartOptions,
  ) => {
    if (sessionRef.current.browserSessionTransport === 'cookie') {
      const browserSession = await createBrowserSession(token)
      const authorizationFingerprint = createStableAuthorizationFingerprint(browserSession.session)
      const shouldRenewBrowserSessionKey = Boolean(
        options?.intent === 'renew' &&
          authorizationFingerprint &&
          browserSessionAuthorizationFingerprintRef.current === authorizationFingerprint,
      )

      browserSessionAuthorizationFingerprintRef.current = authorizationFingerprint
      const browserSessionTransport = sessionRef.current.browserSessionTransport
      setSession((current) =>
        normalizeSession({
          ...current,
          mode: 'bearer',
          browserSessionTransport,
          bearerToken: '',
          browserSessionKey:
            shouldRenewBrowserSessionKey
              ? current.browserSessionKey.trim() || createBrowserSessionCacheKey()
              : createBrowserSessionCacheKey(),
        }),
      )
      return
    }

    startBearerSession(token, providerIdToken)
  }, [startBearerSession])

  const clearProviderSession = useCallback(async () => {
    if (sessionRef.current.browserSessionTransport === 'cookie') {
      try {
        await clearBrowserSessionCookie()
      } catch (error) {
        clearClientBearerSession()
        throw error
      }
    } else {
      clearClientBearerSession()
    }

    browserSessionAuthorizationFingerprintRef.current = ''
    setSession((current) =>
      normalizeSession({
        ...current,
        mode: 'bearer',
        browserSessionTransport: sessionRef.current.browserSessionTransport,
        bearerToken: '',
        browserSessionKey: '',
      }),
    )
  }, [])

  const clearToBearerMode = useCallback(() => {
    clearClientBearerSession()
    setSession((current) =>
      normalizeSession({
        ...current,
        mode: 'bearer',
        bearerToken: '',
        browserSessionKey: '',
      }),
    )
  }, [])

  const value = useMemo<SessionContextValue>(
    () => ({
      session,
      isReady: isSessionReady(session),
      isProviderSessionHydrating,
      saveSession,
      resetSession,
      expireSession,
      startBearerSession,
      startProviderSession,
      clearProviderSession,
      clearToBearerMode,
      setProviderSessionHydrating,
    }),
    [
      clearToBearerMode,
      expireSession,
      isProviderSessionHydrating,
      resetSession,
      saveSession,
      session,
      startBearerSession,
      startProviderSession,
      clearProviderSession,
    ],
  )

  return <SessionContext.Provider value={value}>{input.children}</SessionContext.Provider>
}

function createBrowserSessionCacheKey() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

function createStableAuthorizationFingerprint(value: unknown): string {
  if (!value || typeof value !== 'object') {
    return ''
  }

  return stableStringify(value)
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).sort().join(',')}]`
  }

  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`)
      .join(',')}}`
  }

  return JSON.stringify(value) ?? 'null'
}
