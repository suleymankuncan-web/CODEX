import {
  isCookieBrowserSession,
  normalizeSession,
  type SessionState,
} from './session-storage'

export type SessionSaveTransition = {
  nextSession: SessionState
  shouldClearBrowserSessionCookie: boolean
  bearerTokenToPersist: string | null
}

export function resolveSessionSaveTransition(
  currentSession: SessionState,
  next: SessionState,
): SessionSaveTransition {
  const normalizedNext = normalizeSession(next)
  const nextSession = normalizeSession({
    ...normalizedNext,
    browserSessionKey: isCookieBrowserSession(normalizedNext)
      ? normalizedNext.browserSessionKey
      : '',
  })

  return {
    nextSession,
    shouldClearBrowserSessionCookie:
      currentSession.browserSessionTransport === 'cookie' &&
      !isCookieBrowserSession(nextSession),
    bearerTokenToPersist:
      nextSession.mode === 'bearer' && !isCookieBrowserSession(nextSession)
        ? nextSession.bearerToken
        : null,
  }
}
