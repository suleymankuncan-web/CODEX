import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { isClerkSessionProviderAvailable } from '../auth/clerk-config'
import { clearBrowserSessionCookie, createBrowserSession, recoverBrowserSessionAfterReload, type BrowserSessionCreateResponse } from '../../lib/api'
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
  const [sessionRecoveryFailed, setSessionRecoveryFailed] = useState(false)
  const [recoveryAttempt, setRecoveryAttempt] = useState(0)
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
    const recover = async () => {
      setSessionRecoveryFailed(false)
      setProviderSessionHydrating(true)
      for (let attempt = 0; attempt < 3 && !cancelled; attempt += 1) {
        const timeout = window.setTimeout(() => controller.abort(), 15_000)
        try {
          const nonce = await recoverBrowserSessionAfterReload(controller.signal)
          if (cancelled || sessionRef.current.browserSessionKey !== initial.browserSessionKey) return
          writeBrowserSessionCsrfToken(nonce ?? '')
          const next = normalizeSession({ ...sessionRef.current, browserSessionKey: nonce ? initial.browserSessionKey : '' })
          sessionRef.current = next
          persistClientSession(next)
          setSession(next)
          setProviderSessionHydrating(false)
          return
        } catch {
          if (cancelled || sessionRef.current.browserSessionKey !== initial.browserSessionKey) return
          if (controller.signal.aborted || attempt === 2) {
            setSessionRecoveryFailed(true)
            return
          }
          await new Promise((resolve) => window.setTimeout(resolve, 1000 * (attempt + 1)))
        } finally { window.clearTimeout(timeout) }
      }
    }
    void recover()
    return () => { cancelled = true; controller.abort() }
  }, [recoveryAttempt])

  const retrySessionRecovery = useCallback(() => setRecoveryAttempt((current) => current + 1), [])

  const startManagedSession = useCallback((browserSession: BrowserSessionCreateResponse) => {
    writeBrowserSessionCsrfToken(browserSession.csrfToken)
    clearClientBearerSession()
    const next = normalizeSession({ ...sessionRef.current, mode: 'bearer', browserSessionTransport: 'cookie',
      bearerToken: '', browserSessionKey: createBrowserSessionCacheKey() })
    browserSessionAuthorizationFingerprintRef.current = createStableAuthorizationFingerprint(browserSession.session)
    sessionRef.current = next
    persistClientSession(next)
    setSession(next)
    setProviderSessionHydrating(false)
    setSessionRecoveryFailed(false)
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
      sessionRecoveryFailed,
      retrySessionRecovery,
      startManagedSession,
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
      sessionRecoveryFailed,
      retrySessionRecovery,
      startManagedSession,
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
