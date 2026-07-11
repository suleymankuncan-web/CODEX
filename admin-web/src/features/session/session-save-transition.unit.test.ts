import { describe, expect, it } from 'vitest'
import { defaultSession, type SessionState } from './session-storage'
import { resolveSessionSaveTransition } from './session-save-transition'

const cookieSession: SessionState = {
  ...defaultSession,
  mode: 'bearer',
  browserSessionTransport: 'cookie',
  browserSessionKey: 'cookie-session-key',
}

describe('session save transition', () => {
  it('requires cookie clearing before a development editor switches to mock mode', () => {
    const transition = resolveSessionSaveTransition(cookieSession, {
      ...defaultSession,
      mode: 'mock',
      mockUserId: 'local-dev-user',
    })

    expect(transition.shouldClearBrowserSessionCookie).toBe(true)
    expect(transition.nextSession.mode).toBe('mock')
    expect(transition.nextSession.browserSessionKey).toBe('')
    expect(transition.bearerTokenToPersist).toBeNull()
  })

  it('preserves a renewed cookie transport without exposing a bearer token', () => {
    const transition = resolveSessionSaveTransition(cookieSession, {
      ...cookieSession,
      browserSessionKey: 'renewed-cookie-session-key',
    })

    expect(transition.shouldClearBrowserSessionCookie).toBe(false)
    expect(transition.nextSession.browserSessionKey).toBe('renewed-cookie-session-key')
    expect(transition.bearerTokenToPersist).toBeNull()
  })

  it('keeps the existing bearer fallback persistence decision', () => {
    const transition = resolveSessionSaveTransition(defaultSession, {
      ...defaultSession,
      mode: 'bearer',
      bearerToken: 'synthetic-local-token',
    })

    expect(transition.shouldClearBrowserSessionCookie).toBe(false)
    expect(transition.nextSession.browserSessionKey).toBe('')
    expect(transition.bearerTokenToPersist).toBe('synthetic-local-token')
  })
})
