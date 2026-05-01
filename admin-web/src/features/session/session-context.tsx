import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { SessionContext, type SessionContextValue } from './session-context-value'
import {
  clearClientBearerSession,
  defaultSession,
  isSessionReady,
  normalizeSession,
  persistClientSession,
  readClientSession,
  writeClientBearerSession,
  type SessionState,
} from './session-storage'

export function SessionProvider(input: { children: ReactNode }) {
  const [session, setSession] = useState<SessionState>(() => readClientSession())

  useEffect(() => {
    persistClientSession(session)
  }, [session])

  const saveSession = useCallback((next: SessionState) => {
    setSession(normalizeSession(next))
  }, [])

  const resetSession = useCallback(() => {
    setSession(defaultSession)
  }, [])

  const expireSession = useCallback(() => {
    setSession((current) =>
      normalizeSession({
        ...current,
        bearerToken: '',
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
      }),
    )
  }, [])

  const value = useMemo<SessionContextValue>(
    () => ({
      session,
      isReady: isSessionReady(session),
      saveSession,
      resetSession,
      expireSession,
      startBearerSession,
      clearToBearerMode,
    }),
    [
      clearToBearerMode,
      expireSession,
      resetSession,
      saveSession,
      session,
      startBearerSession,
    ],
  )

  return <SessionContext.Provider value={value}>{input.children}</SessionContext.Provider>
}
