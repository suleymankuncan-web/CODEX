import { afterEach, describe, expect, it, vi } from 'vitest'

class MemoryStorage {
  private readonly values = new Map<string, string>()

  getItem(key: string) {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string) {
    this.values.set(key, value)
  }

  removeItem(key: string) {
    this.values.delete(key)
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe('readClientSession', () => {
  it('recovers configured mock mode when a stale bearer session has no token', async () => {
    vi.stubEnv('DEV', true)
    vi.stubEnv('VITE_AUTH_MODE', 'mock')
    vi.stubEnv('VITE_USER_ID', '80000000-0000-0000-0000-000000000001')
    const { defaultSession, readClientSession } = await import('./session-storage')
    const localStorage = new MemoryStorage()
    const sessionStorage = new MemoryStorage()
    localStorage.setItem('store-ops-admin-session', JSON.stringify({
      ...defaultSession,
      mode: 'bearer',
      browserSessionTransport: 'bearer',
      mockUserId: '80000000-0000-0000-0000-000000000012',
      bearerToken: '',
    }))
    vi.stubGlobal('window', { localStorage, sessionStorage })

    expect(readClientSession()).toMatchObject({
      mode: 'mock',
      browserSessionTransport: 'bearer',
      bearerToken: '',
      mockUserId: defaultSession.mockUserId,
    })
  })

  it('keeps a bearer session when a token is present', async () => {
    vi.stubEnv('VITE_AUTH_MODE', 'mock')
    const { defaultSession, readClientSession } = await import('./session-storage')
    const localStorage = new MemoryStorage()
    const sessionStorage = new MemoryStorage()
    localStorage.setItem('store-ops-admin-session', JSON.stringify({
      ...defaultSession,
      mode: 'bearer',
      browserSessionTransport: 'bearer',
    }))
    sessionStorage.setItem('store-ops-admin-bearer-token', 'synthetic-local-token')
    vi.stubGlobal('window', { localStorage, sessionStorage })

    expect(readClientSession()).toMatchObject({
      mode: 'bearer',
      bearerToken: 'synthetic-local-token',
    })
  })

  it('keeps a token-missing bearer session fail-closed outside development', async () => {
    vi.stubEnv('DEV', false)
    vi.stubEnv('VITE_AUTH_MODE', 'mock')
    const { defaultSession, readClientSession } = await import('./session-storage')
    const localStorage = new MemoryStorage()
    const sessionStorage = new MemoryStorage()
    localStorage.setItem('store-ops-admin-session', JSON.stringify({
      ...defaultSession,
      mode: 'bearer',
      browserSessionTransport: 'bearer',
      bearerToken: '',
    }))
    vi.stubGlobal('window', { localStorage, sessionStorage })

    expect(readClientSession()).toMatchObject({
      mode: 'bearer',
      bearerToken: '',
    })
  })
})
