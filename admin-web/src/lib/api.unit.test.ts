import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  fetchJson,
  registerBearerTokenRefreshHandler,
  sendFormData,
  sendJson,
} from './api'
import {
  defaultSession,
  persistClientSession,
  readBrowserSessionCsrfToken,
  writeBrowserSessionCsrfToken,
  writeClientBearerSession,
} from '../features/session/session-storage'

const staleCsrfToken = 'stale-csrf-token'
const freshCsrfToken = 'fresh-csrf-token'

type TestWindow = Window & {
  __storeOpsBrowserSessionCsrfToken?: string
}

let testWindow: TestWindow
let refreshHandlerCleanup: (() => void) | undefined

describe('API CSRF recovery', () => {
  beforeEach(() => {
    const localStorage = createStorage()
    const sessionStorage = createStorage()
    const dispatchEvent = vi.fn()

    testWindow = {
      localStorage,
      sessionStorage,
      location: {
        hostname: 'localhost',
        pathname: '/admin/test',
        search: '',
      },
      dispatchEvent,
    } as unknown as TestWindow

    vi.stubGlobal('window', testWindow)
    vi.stubGlobal('fetch', vi.fn())
    writeBrowserSessionCsrfToken(staleCsrfToken)
    persistCookieSession()
  })

  afterEach(() => {
    refreshHandlerCleanup?.()
    refreshHandlerCleanup = undefined
    writeBrowserSessionCsrfToken('')
    vi.unstubAllGlobals()
  })

  it('recovers a JSON mutation with one fresh-CSRF replay', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock
      .mockResolvedValueOnce(createCsrfFailureResponse())
      .mockResolvedValueOnce(createJsonResponse({ ok: true }))
    const refreshCalls: Array<{ skipCache?: boolean }> = []
    refreshHandlerCleanup = registerBearerTokenRefreshHandler(async (input) => {
      refreshCalls.push(input ?? {})
      writeBrowserSessionCsrfToken(freshCsrfToken)
      return { refreshed: true }
    })

    const payload = { name: 'Alice', count: 2 }
    await expect(sendJson('/admin/test', { method: 'POST', body: payload })).resolves.toEqual({
      ok: true,
    })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(refreshCalls).toEqual([{ skipCache: true }])
    expect(getRequestHeaders(fetchMock, 0)).toMatchObject({
      'X-CSRF-Token': staleCsrfToken,
      'Content-Type': 'application/json',
    })
    expect(getRequestHeaders(fetchMock, 1)).toMatchObject({
      'X-CSRF-Token': freshCsrfToken,
      'Content-Type': 'application/json',
    })
    expect(getRequestInit(fetchMock, 0).credentials).toBe('include')
    expect(getRequestInit(fetchMock, 1).credentials).toBe('include')
    expect(getRequestInit(fetchMock, 0).body).toBe(JSON.stringify(payload))
    expect(getRequestInit(fetchMock, 1).body).toBe(JSON.stringify(payload))
  })

  it('recovers a multipart mutation without changing the original FormData body', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock
      .mockResolvedValueOnce(createCsrfFailureResponse())
      .mockResolvedValueOnce(createJsonResponse({ uploaded: true }))
    const refreshCalls: Array<{ skipCache?: boolean }> = []
    refreshHandlerCleanup = registerBearerTokenRefreshHandler(async (input) => {
      refreshCalls.push(input ?? {})
      writeBrowserSessionCsrfToken(freshCsrfToken)
      return { refreshed: true }
    })

    const body = new FormData()
    body.append('file', new Blob(['safe upload']), 'report.xlsx')
    body.append('periodMonth', '2026-06')

    await expect(sendFormData('/admin/upload', { method: 'POST', body })).resolves.toEqual({
      uploaded: true,
    })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(refreshCalls).toEqual([{ skipCache: true }])
    expect(getRequestHeaders(fetchMock, 0)['X-CSRF-Token']).toBe(staleCsrfToken)
    expect(getRequestHeaders(fetchMock, 1)['X-CSRF-Token']).toBe(freshCsrfToken)
    expect(getRequestInit(fetchMock, 0).credentials).toBe('include')
    expect(getRequestInit(fetchMock, 1).credentials).toBe('include')
    expect(getRequestInit(fetchMock, 0).body).toBe(body)
    expect(getRequestInit(fetchMock, 1).body).toBe(body)
  })

  it('keeps the shared retry budget when a 401 retry then receives a CSRF failure', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock
      .mockResolvedValueOnce(createJsonResponse({ message: 'expired' }, 401))
      .mockResolvedValueOnce(createCsrfFailureResponse())
    const refreshCalls: Array<{ skipCache?: boolean }> = []
    refreshHandlerCleanup = registerBearerTokenRefreshHandler(async (input) => {
      refreshCalls.push(input ?? {})
      writeBrowserSessionCsrfToken(freshCsrfToken)
      return { refreshed: true }
    })

    await expect(sendJson('/admin/test', { method: 'POST', body: { ok: true } })).rejects.toMatchObject({
      status: 403,
      message: 'CSRF token is required',
    })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(refreshCalls).toEqual([{ skipCache: true }])
    expect(getRequestHeaders(fetchMock, 1)['X-CSRF-Token']).toBe(freshCsrfToken)
    expect(testWindow.dispatchEvent).toHaveBeenCalled()
  })

  it.each([
    {
      name: 'reuses the existing error path after a second CSRF failure',
      setup: () => {
        const fetchMock = vi.mocked(fetch)
        fetchMock
          .mockResolvedValueOnce(createCsrfFailureResponse())
          .mockResolvedValueOnce(createCsrfFailureResponse())
        const refreshCalls: Array<{ skipCache?: boolean }> = []
        refreshHandlerCleanup = registerRefreshingHandler(refreshCalls)
        return { fetchMock, refreshCalls }
      },
      invoke: () => sendJson('/admin/test', { method: 'PATCH', body: { ok: true } }),
      expectedCalls: 2,
      expectedRefreshes: 1,
      expectedMessage: 'CSRF token is required',
      expectedCsrfToken: '',
    },
    {
      name: 'does not replay when the refresher is unavailable',
      setup: () => {
        const fetchMock = vi.mocked(fetch)
        fetchMock.mockResolvedValueOnce(createCsrfFailureResponse())
        return { fetchMock, refreshCalls: [] }
      },
      invoke: () => sendJson('/admin/test', { method: 'POST', body: { ok: true } }),
      expectedCalls: 1,
      expectedRefreshes: 0,
      expectedMessage: 'CSRF token is required',
    },
    {
      name: 'does not replay when the refresher fails',
      setup: () => {
        const fetchMock = vi.mocked(fetch)
        fetchMock.mockResolvedValueOnce(createCsrfFailureResponse())
        const refreshCalls: Array<{ skipCache?: boolean }> = []
        refreshHandlerCleanup = registerBearerTokenRefreshHandler(async (input) => {
          refreshCalls.push(input ?? {})
          throw new Error('refresh failed')
        })
        return { fetchMock, refreshCalls }
      },
      invoke: () => sendJson('/admin/test', { method: 'POST', body: { ok: true } }),
      expectedCalls: 1,
      expectedRefreshes: 1,
      expectedMessage: 'CSRF token is required',
    },
    {
      name: 'does not replay a generic or near-match forbidden response',
      setup: () => {
        const fetchMock = vi.mocked(fetch)
        fetchMock.mockResolvedValueOnce(createCsrfFailureResponse('CSRF token is required now'))
        return { fetchMock, refreshCalls: [] }
      },
      invoke: () => sendJson('/admin/test', { method: 'POST', body: { ok: true } }),
      expectedCalls: 1,
      expectedRefreshes: 0,
      expectedMessage: 'CSRF token is required now',
      expectedCsrfToken: '',
      expectedSessionExpired: true,
    },
    {
      name: 'does not replay a generic forbidden response',
      setup: () => {
        const fetchMock = vi.mocked(fetch)
        fetchMock.mockResolvedValueOnce(new Response('Forbidden', { status: 403 }))
        return { fetchMock, refreshCalls: [] }
      },
      invoke: () => sendJson('/admin/test', { method: 'POST', body: { ok: true } }),
      expectedCalls: 1,
      expectedRefreshes: 0,
      expectedMessage: 'Forbidden',
    },
  ])('$name', async ({
    setup,
    invoke,
    expectedCalls,
    expectedRefreshes,
    expectedMessage,
    expectedCsrfToken,
    expectedSessionExpired,
  }) => {
    const { fetchMock, refreshCalls } = setup()
    await expect(invoke()).rejects.toMatchObject({
      status: 403,
      message: expectedMessage,
    })
    expect(fetchMock).toHaveBeenCalledTimes(expectedCalls)
    expect(refreshCalls).toHaveLength(expectedRefreshes)
    if (expectedRefreshes > 0) {
      expect(refreshCalls).toEqual([{ skipCache: true }])
    }
    if (expectedCsrfToken !== undefined) {
      expect(readBrowserSessionCsrfToken()).toBe(expectedCsrfToken)
    }
    if (expectedSessionExpired) {
      expect(testWindow.dispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'store-ops-session-expired' }),
      )
    }
  })

  it('falls through session expiry when refresh succeeds without a CSRF nonce', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockResolvedValueOnce(createCsrfFailureResponse())
    const refreshCalls: Array<{ skipCache?: boolean }> = []
    refreshHandlerCleanup = registerBearerTokenRefreshHandler(async (input) => {
      refreshCalls.push(input ?? {})
      writeBrowserSessionCsrfToken('')
      return { refreshed: true }
    })

    await expect(sendJson('/admin/test', { method: 'POST', body: { ok: true } })).rejects.toMatchObject({
      status: 403,
      message: 'CSRF token is required',
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(refreshCalls).toEqual([{ skipCache: true }])
    expect(readBrowserSessionCsrfToken()).toBe('')
    expect(testWindow.dispatchEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'store-ops-session-expired' }),
    )
  })

  it('does not replay a safe GET after a canonical CSRF response', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockResolvedValueOnce(createCsrfFailureResponse())
    refreshHandlerCleanup = registerRefreshingHandler()

    await expect(fetchJson('/admin/test')).rejects.toMatchObject({
      status: 403,
      message: 'CSRF token is required',
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(getRequestHeaders(fetchMock, 0)).not.toHaveProperty('X-CSRF-Token')
    expect(refreshHandlerCleanup).toBeDefined()
  })

  it('does not replay a canonical CSRF response for bearer-header sessions', async () => {
    persistBearerSession()
    writeBrowserSessionCsrfToken(staleCsrfToken)
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockResolvedValueOnce(createCsrfFailureResponse())
    refreshHandlerCleanup = registerRefreshingHandler()

    await expect(sendJson('/admin/test', { method: 'POST', body: { ok: true } })).rejects.toMatchObject({
      status: 403,
      message: 'CSRF token is required',
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(getRequestHeaders(fetchMock, 0)).toMatchObject({ Authorization: 'Bearer test-bearer' })
    expect(getRequestHeaders(fetchMock, 0)).not.toHaveProperty('X-CSRF-Token')
  })
})

function registerRefreshingHandler(refreshCalls: Array<{ skipCache?: boolean }> = []) {
  return registerBearerTokenRefreshHandler(async (input) => {
    refreshCalls.push(input ?? {})
    writeBrowserSessionCsrfToken(freshCsrfToken)
    return { refreshed: true }
  })
}

function createCsrfFailureResponse(message = 'CSRF token is required') {
  return new Response(JSON.stringify({ message }), {
    status: 403,
    headers: { 'content-type': 'application/json' },
  })
}

function createJsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function persistCookieSession() {
  persistClientSession({
    ...defaultSession,
    mode: 'bearer',
    browserSessionTransport: 'cookie',
    browserSessionKey: 'test-session',
  })
}

function persistBearerSession() {
  persistClientSession({ ...defaultSession, mode: 'bearer', browserSessionTransport: 'bearer' })
  writeClientBearerSession('test-bearer')
}

function getRequestInit(fetchMock: ReturnType<typeof vi.fn>, index: number) {
  return fetchMock.mock.calls[index]?.[1] as RequestInit
}

function getRequestHeaders(fetchMock: ReturnType<typeof vi.fn>, index: number) {
  return getRequestInit(fetchMock, index).headers as Record<string, string>
}

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
