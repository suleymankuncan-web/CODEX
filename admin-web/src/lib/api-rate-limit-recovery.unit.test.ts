import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchBlob, fetchJson, sendFormData, sendJson, SESSION_EXPIRED_EVENT } from './api'
import { assertApiRateLimitReady } from './api-rate-limit'
import { defaultSession, persistClientSession, readBrowserSessionCsrfToken, readClientSession, writeBrowserSessionCsrfToken } from '../features/session/session-storage'

function storage() {
  const values = new Map<string, string>()
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) }
}

describe('API rate-limit recovery without losing authentication or replaying writes', () => {
  const dispatchEvent = vi.fn()
  beforeEach(() => {
    vi.useFakeTimers(); vi.setSystemTime(Date.parse('2026-10-02T20:00:00Z'))
    dispatchEvent.mockClear()
    vi.stubGlobal('window', { localStorage: storage(), sessionStorage: storage(),
      location: { hostname: 'localhost', origin: 'http://localhost:5173', pathname: '/store/home', search: '' }, dispatchEvent })
    vi.stubGlobal('fetch', vi.fn())
    persistClientSession({ ...defaultSession, mode: 'bearer', browserSessionTransport: 'cookie', browserSessionKey: 'synthetic-cookie-session' })
    writeBrowserSessionCsrfToken('synthetic-existing-csrf')
  })
  afterEach(() => {
    vi.advanceTimersByTime(3_600_001); assertApiRateLimitReady(); writeBrowserSessionCsrfToken('')
    vi.useRealTimers(); vi.unstubAllGlobals()
  })

  it.each(['json', 'form', 'blob'] as const)('recovers %s requests only after cooldown, preserving session', async (kind) => {
    const mocked = vi.mocked(fetch)
    mocked.mockResolvedValueOnce(new Response(JSON.stringify({ message: 'Rate limit exceeded' }), { status: 429, headers: { 'Retry-After': '2' } }))
    const request = kind === 'json'
      ? sendJson('/synthetic/resource', { method: 'POST', body: { value: 'synthetic' } })
      : kind === 'form' ? sendFormData('/synthetic/resource', { method: 'POST', body: new FormData() }) : fetchBlob('/synthetic/export')
    await expect(request).rejects.toMatchObject({ status: 429, retryAt: Date.now() + 2000 })
    await expect(fetchJson('/synthetic/other')).rejects.toMatchObject({ status: 429 })
    expect(mocked).toHaveBeenCalledTimes(1)
    expect(readClientSession().browserSessionKey).toBe('synthetic-cookie-session')
    expect(readBrowserSessionCsrfToken()).toBe('synthetic-existing-csrf')
    expect(dispatchEvent.mock.calls.some(([event]) => event.type === SESSION_EXPIRED_EVENT)).toBe(false)
    vi.advanceTimersByTime(2000)
    // Time passing does not replay any saved write or start an unsolicited request.
    expect(mocked).toHaveBeenCalledTimes(1)
    mocked.mockResolvedValueOnce(new Response(JSON.stringify({ recovered: true }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    await expect(fetchJson('/synthetic/other')).resolves.toEqual({ recovered: true })
    expect(mocked).toHaveBeenCalledTimes(2)
    expect(mocked.mock.calls[1]?.[1]?.method).toBe('GET')
  })
})
