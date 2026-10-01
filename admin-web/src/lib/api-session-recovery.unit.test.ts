import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchJson, recoverBrowserSessionAfterReload, sendJson } from './api'
import { defaultSession, readClientSession, persistClientSession, readBrowserSessionCsrfToken, writeBrowserSessionCsrfToken } from '../features/session/session-storage'
const staleCsrfToken = 'stale-csrf-token'
const freshCsrfToken = 'fresh-csrf-token'
let testWindow: Window
describe('managed API session isolation and recovery', () => {
  beforeEach(() => {
    testWindow = { localStorage: createStorage(), sessionStorage: createStorage(),
      location: { hostname: 'localhost', origin: 'http://localhost:5173', pathname: '/admin/test', search: '' },
      dispatchEvent: vi.fn() } as unknown as Window
    vi.stubGlobal('window', testWindow)
    vi.stubGlobal('fetch', vi.fn())
    writeBrowserSessionCsrfToken(staleCsrfToken)
    persistClientSession({ ...defaultSession, mode: 'bearer', browserSessionTransport: 'cookie', browserSessionKey: 'test-session' })
  })
  afterEach(() => { writeBrowserSessionCsrfToken(''); vi.unstubAllGlobals() })
  it('retains identity and nonce on transient reload recovery but recognizes an expired cookie', async () => {
    const before = readClientSession()
    vi.mocked(fetch).mockResolvedValueOnce(createJsonResponse({ message: 'temporary' }, 503))
    await expect(recoverBrowserSessionAfterReload(new AbortController().signal)).rejects.toMatchObject({ status: 503 })
    expect(readClientSession()).toEqual(before)
    expect(readBrowserSessionCsrfToken()).toBe(staleCsrfToken)
    vi.mocked(fetch).mockResolvedValueOnce(createJsonResponse({}, 401))
    await expect(recoverBrowserSessionAfterReload(new AbortController().signal)).resolves.toBeNull()
  })

  it('a retired in-flight 401 cannot clear the nonce or expire a replacement login', async () => {
    let finish!: (response: Response) => void
    vi.mocked(fetch).mockImplementation(() => new Promise((resolve) => { finish = resolve }))
    const pending = fetchJson('/admin/retired-request')
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
    persistClientSession({ ...readClientSession(), browserSessionKey: 'replacement-session' })
    writeBrowserSessionCsrfToken(freshCsrfToken)
    finish(createJsonResponse({ message: 'Unauthorized' }, 401))
    await expect(pending).rejects.toMatchObject({ status: 401 })
    expect(readClientSession().browserSessionKey).toBe('replacement-session')
    expect(readBrowserSessionCsrfToken()).toBe(freshCsrfToken)
    expect(testWindow.dispatchEvent).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'store-ops-session-expired' }))
  })

  it('a retired mutation cannot replay its body under a replacement cookie session', async () => {
    let finish!: (response: Response) => void
    vi.mocked(fetch).mockImplementation(() => new Promise((resolve) => { finish = resolve }))
    const pending = sendJson('/admin/test', { method: 'POST', body: { owner: 'previous-session' } })
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
    persistClientSession({ ...readClientSession(), browserSessionKey: 'replacement-session' })
    writeBrowserSessionCsrfToken(freshCsrfToken)
    finish(createCsrfFailureResponse())
    await expect(pending).rejects.toMatchObject({ status: 403 })
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(readBrowserSessionCsrfToken()).toBe(freshCsrfToken)
    expect(testWindow.dispatchEvent).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'store-ops-session-expired' }))
  })

  it('a temporary missing-nonce recovery failure blocks writes without expiring the session', async () => {
    writeBrowserSessionCsrfToken('')
    vi.mocked(fetch).mockResolvedValueOnce(createJsonResponse({}, 503))
    await expect(sendJson('/admin/test', { method: 'POST', body: {} })).rejects.toThrow('temporarily unavailable')
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(readClientSession().browserSessionKey).toBe('test-session')
    expect(testWindow.dispatchEvent).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'store-ops-session-expired' }))
  })

  it('actual missing-nonce expiry blocks the business write and expires only its owning session', async () => {
    writeBrowserSessionCsrfToken('')
    vi.mocked(fetch).mockResolvedValueOnce(createJsonResponse({}, 401))
    await expect(sendJson('/admin/test', { method: 'POST', body: {} })).rejects.toMatchObject({ status: 401 })
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(testWindow.dispatchEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'store-ops-session-expired',
      detail: expect.objectContaining({ status: 401, sessionKey: 'test-session' }) }))
  })
})
function createJsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } })
}
function createCsrfFailureResponse() { return createJsonResponse({ message: 'CSRF token is required' }, 403) }

function createStorage() {
  const values = new Map<string, string>()

  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value)
    },
    removeItem: (key: string) => {
      values.delete(key)
    },
    clear: () => {
      values.clear()
    },
    key: (index: number) => Array.from(values.keys())[index] ?? null,
    get length() {
      return values.size
    },
  } as Storage
}
