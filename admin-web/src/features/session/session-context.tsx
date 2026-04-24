import {
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

  const value = useMemo<SessionContextValue>(
    () => ({
      session,
      isReady: isSessionReady(session),
      saveSession: (next) => setSession(normalizeSession(next)),
      resetSession: () => setSession(defaultSession),
      expireSession: () =>
        setSession((current) =>
          normalizeSession({
            ...current,
            bearerToken: '',
          }),
        ),
      startBearerSession: (token, providerIdToken) =>
        {
          writeClientBearerSession(token, providerIdToken)
          setSession((current) =>
            normalizeSession({
              ...current,
              mode: 'bearer',
              bearerToken: token,
            }),
          )
        },
      clearToBearerMode: () =>
        {
          clearClientBearerSession()
          setSession((current) =>
            normalizeSession({
              ...current,
              mode: 'bearer',
              bearerToken: '',
            }),
          )
        },
    }),
    [session],
  )

  return <SessionContext.Provider value={value}>{input.children}</SessionContext.Provider>
}
