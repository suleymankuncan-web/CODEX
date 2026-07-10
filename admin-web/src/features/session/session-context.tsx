import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { isClerkSessionProviderAvailable } from '../auth/clerk-config'
import { clearBrowserSessionCookie, createBrowserSession } from '../../lib/api'
import {
  SessionContext,
  type ProviderSessionStartOptions,
  type SessionContextValue,
} from './session-context-value'
import {
  clearClientBearerSession,
  defaultSession,
  isCookieBrowserSession,
  isSessionReady,
  normalizeSession,
  persistClientSession,
  readClientSession,
  writeBrowserSessionCsrfToken,
  writeClientBearerSession,
  type SessionState,
} from './session-storage'

export function SessionProvider(input: { children: ReactNode }) {
  const [session, setSession] = useState<SessionState>(() => readClientSession())
  const sessionRef = useRef(session)
  const browserSessionAuthorizationFingerprintRef = useRef('')
  const [isProviderSessionHydrating, setProviderSessionHydrating] = useState(() =>
    isClerkSessionProviderAvailable(),
  )

  useEffect(() => {
    sessionRef.current = session
  }, [session])

  useEffect(() => {
    persistClientSession(session)
  }, [session])

  const saveSession = useCallback(async (next: SessionState) => {
    const normalizedNext = normalizeSession(next)
    const nextSession = normalizeSession({
      ...normalizedNext,
      browserSessionKey: isCookieBrowserSession(normalizedNext)
        ? normalizedNext.browserSessionKey
        : '',
    })

    if (
      sessionRef.current.browserSessionTransport === 'cookie' &&
      !isCookieBrowserSession(nextSession)
    ) {
      try {
        await clearBrowserSessionCookie()
      } catch (error) {
        clearClientBearerSession()
        throw error
      }
    }

    if (nextSession.mode === 'bearer' && !isCookieBrowserSession(nextSession)) {
      writeClientBearerSession(nextSession.bearerToken)
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
