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
        origin: 'http://localhost:5173',
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
      .mockResolvedValueOnce(createCsrfRecoveryResponse())
      .mockResolvedValueOnce(createJsonResponse({ ok: true }))

    const payload = { name: 'Alice', count: 2 }
    await expect(sendJson('/admin/test', { method: 'POST', body: payload })).resolves.toEqual({
      ok: true,
    })

    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(getRequestHeaders(fetchMock, 0)).toMatchObject({
      'X-CSRF-Token': staleCsrfToken,
      'Content-Type': 'application/json',
    })
    expect(getRequestHeaders(fetchMock, 2)).toMatchObject({
      'X-CSRF-Token': freshCsrfToken,
      'Content-Type': 'application/json',
    })
    expect(getRequestInit(fetchMock, 0).credentials).toBe('include')
    expect(getRequestInit(fetchMock, 1).credentials).toBe('include')
    expect(getRequestInit(fetchMock, 2).credentials).toBe('include')
    expect(getRequestInit(fetchMock, 0).body).toBe(JSON.stringify(payload))
    expect(getRequestInit(fetchMock, 2).body).toBe(JSON.stringify(payload))
  })

  it('recovers a JSON mutation through the provider-neutral nonce endpoint without a refresh handler', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock
      .mockResolvedValueOnce(createCsrfFailureResponse())
      .mockResolvedValueOnce(createCsrfRecoveryResponse())
      .mockResolvedValueOnce(createJsonResponse({ ok: true }))

    await expect(sendJson('/admin/test', { method: 'POST', body: { ok: true } })).resolves.toEqual({
      ok: true,
    })

    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(getRequestUrl(fetchMock, 1)).toContain('/auth/browser-session/csrf')
    expect(getRequestInit(fetchMock, 1).credentials).toBe('include')
    expect(getRequestHeaders(fetchMock, 2)['X-CSRF-Token']).toBe(freshCsrfToken)
  })

  it('recovers a missing initial nonce before sending the unsafe business request', async () => {
    writeBrowserSessionCsrfToken('')
    const fetchMock = vi.mocked(fetch)
    fetchMock
      .mockResolvedValueOnce(createCsrfRecoveryResponse())
      .mockResolvedValueOnce(createJsonResponse({ ok: true }))

    await expect(sendJson('/admin/test', { method: 'POST', body: { ok: true } })).resolves.toEqual({
      ok: true,
    })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(getRequestUrl(fetchMock, 0)).toContain('/auth/browser-session/csrf')
    expect(getRequestHeaders(fetchMock, 1)['X-CSRF-Token']).toBe(freshCsrfToken)
  })

  it('fails closed when provider-neutral nonce recovery fails', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock
      .mockResolvedValueOnce(createCsrfFailureResponse())
      .mockResolvedValueOnce(new Response('expired', { status: 401 }))

    await expect(sendJson('/admin/test', { method: 'POST', body: { ok: true } })).rejects.toMatchObject({
      status: 403,
      message: 'CSRF token is required',
    })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(testWindow.dispatchEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'store-ops-session-expired' }),
    )
  })

  it('uses the registered refresh handler for a hosted cross-origin cookie session', async () => {
    Object.assign(testWindow.location, {
      hostname: 'staging.hr-axis.com',
      origin: 'https://staging.hr-axis.com',
    })
    const fetchMock = vi.mocked(fetch)
    fetchMock
      .mockResolvedValueOnce(createCsrfFailureResponse())
      .mockResolvedValueOnce(createJsonResponse({ ok: true }))
    const refreshCalls: Array<{ skipCache?: boolean }> = []
    refreshHandlerCleanup = registerRefreshingHandler(refreshCalls)

    await expect(sendJson('/admin/test', { method: 'POST', body: { ok: true } })).resolves.toEqual({
      ok: true,
    })

    expect(refreshCalls).toEqual([{ skipCache: true }])
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/auth/browser-session/csrf'))).toBe(false)
    expect(getRequestHeaders(fetchMock, 1)['X-CSRF-Token']).toBe(freshCsrfToken)
  })

  it('uses the registered refresh handler before a hosted cross-origin unsafe request when the nonce is missing', async () => {
    Object.assign(testWindow.location, {
      hostname: 'staging.hr-axis.com',
      origin: 'https://staging.hr-axis.com',
    })
    writeBrowserSessionCsrfToken('')
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockResolvedValueOnce(createJsonResponse({ ok: true }))
    const refreshCalls: Array<{ skipCache?: boolean }> = []
    refreshHandlerCleanup = registerRefreshingHandler(refreshCalls)

    await expect(sendJson('/admin/test', { method: 'POST', body: { ok: true } })).resolves.toEqual({
      ok: true,
    })

    expect(refreshCalls).toEqual([{ skipCache: true }])
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(getRequestUrl(fetchMock, 0)).toBe('https://api-staging.hr-axis.com/api/admin/test')
    expect(getRequestHeaders(fetchMock, 0)['X-CSRF-Token']).toBe(freshCsrfToken)
  })

  it('fails closed for a hosted cross-origin cookie session when the refresh handler is unavailable', async () => {
    Object.assign(testWindow.location, {
      hostname: 'staging.hr-axis.com',
      origin: 'https://staging.hr-axis.com',
    })
    writeBrowserSessionCsrfToken('')
    const fetchMock = vi.mocked(fetch)

    await expect(sendJson('/admin/test', { method: 'POST', body: { ok: true } })).rejects.toMatchObject({
      status: 401,
    })

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('replays FormData with the same body identity through provider-neutral recovery', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock
      .mockResolvedValueOnce(createCsrfFailureResponse())
      .mockResolvedValueOnce(createCsrfRecoveryResponse())
      .mockResolvedValueOnce(createJsonResponse({ uploaded: true }))
    const body = new FormData()
    body.append('file', new Blob(['safe upload']), 'report.xlsx')

    await expect(sendFormData('/admin/upload', { method: 'POST', body })).resolves.toEqual({
      uploaded: true,
    })

    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(getRequestInit(fetchMock, 0).body).toBe(body)
    expect(getRequestInit(fetchMock, 2).body).toBe(body)
  })

  it('keeps the two-business-attempt budget after a second CSRF failure', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock
      .mockResolvedValueOnce(createCsrfFailureResponse())
      .mockResolvedValueOnce(createCsrfRecoveryResponse())
      .mockResolvedValueOnce(createCsrfFailureResponse())

    await expect(sendJson('/admin/test', { method: 'PATCH', body: { ok: true } })).rejects.toMatchObject({
      status: 403,
      message: 'CSRF token is required',
    })

    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(getRequestUrl(fetchMock, 1)).toContain('/auth/browser-session/csrf')
  })

  it('single-flights concurrent CSRF recoveries and shares the fresh nonce', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock
      .mockResolvedValueOnce(createCsrfFailureResponse())
      .mockResolvedValueOnce(createCsrfFailureResponse())
      .mockResolvedValueOnce(createCsrfRecoveryResponse())
      .mockResolvedValueOnce(createJsonResponse({ ok: 'first' }))
      .mockResolvedValueOnce(createJsonResponse({ ok: 'second' }))

    const [first, second] = await Promise.all([
      sendJson('/admin/first', { method: 'POST', body: { ok: true } }),
      sendJson('/admin/second', { method: 'POST', body: { ok: true } }),
    ])

    expect(first).toEqual({ ok: 'first' })
    expect(second).toEqual({ ok: 'second' })
    expect(fetchMock).toHaveBeenCalledTimes(5)
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('/auth/browser-session/csrf'))).toHaveLength(1)
    expect(getRequestHeaders(fetchMock, 3)['X-CSRF-Token']).toBe(freshCsrfToken)
    expect(getRequestHeaders(fetchMock, 4)['X-CSRF-Token']).toBe(freshCsrfToken)
  })

  it('reuses a completed recovery for a stale response that resolves afterward', async () => {
    const fetchMock = vi.mocked(fetch)
    const firstFailure = createDeferred<Response>()
    const secondFailure = createDeferred<Response>()
    let businessRequestCount = 0
    fetchMock.mockImplementation((url) => {
      if (String(url).includes('/auth/browser-session/csrf')) {
        return Promise.resolve(createCsrfRecoveryResponse())
      }

      businessRequestCount += 1
      if (businessRequestCount === 1) {
        return firstFailure.promise
      }
      if (businessRequestCount === 2) {
        return secondFailure.promise
      }

      return Promise.resolve(createJsonResponse({ ok: businessRequestCount === 3 ? 'first' : 'second' }))
    })

    const firstRequest = sendJson('/admin/first', { method: 'POST', body: { ok: true } })
    const secondRequest = sendJson('/admin/second', { method: 'POST', body: { ok: true } })
    await waitForCondition(() => fetchMock.mock.calls.length === 2)

    firstFailure.resolve(createCsrfFailureResponse())
    await waitForCondition(() => readBrowserSessionCsrfToken() === freshCsrfToken)
    secondFailure.resolve(createCsrfFailureResponse())

    await expect(firstRequest).resolves.toEqual({ ok: 'first' })
    await expect(secondRequest).resolves.toEqual({ ok: 'second' })

    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('/auth/browser-session/csrf'))).toHaveLength(1)
    expect(fetchMock).toHaveBeenCalledTimes(5)
    expect(getRequestHeaders(fetchMock, 3)['X-CSRF-Token']).toBe(freshCsrfToken)
    expect(getRequestHeaders(fetchMock, 4)['X-CSRF-Token']).toBe(freshCsrfToken)
  })

  it('recovers a multipart mutation without changing the original FormData body', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock
      .mockResolvedValueOnce(createCsrfFailureResponse())
      .mockResolvedValueOnce(createCsrfRecoveryResponse())
      .mockResolvedValueOnce(createJsonResponse({ uploaded: true }))

    const body = new FormData()
    body.append('file', new Blob(['safe upload']), 'report.xlsx')
    body.append('periodMonth', '2026-06')

    await expect(sendFormData('/admin/upload', { method: 'POST', body })).resolves.toEqual({
      uploaded: true,
    })

    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(getRequestHeaders(fetchMock, 0)['X-CSRF-Token']).toBe(staleCsrfToken)
    expect(getRequestHeaders(fetchMock, 2)['X-CSRF-Token']).toBe(freshCsrfToken)
    expect(getRequestInit(fetchMock, 0).credentials).toBe('include')
    expect(getRequestInit(fetchMock, 2).credentials).toBe('include')
    expect(getRequestInit(fetchMock, 0).body).toBe(body)
    expect(getRequestInit(fetchMock, 2).body).toBe(body)
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
      .mockResolvedValueOnce(createCsrfRecoveryResponse())
          .mockResolvedValueOnce(createCsrfFailureResponse())
        return { fetchMock, refreshCalls: [] }
      },
      invoke: () => sendJson('/admin/test', { method: 'PATCH', body: { ok: true } }),
      expectedCalls: 3,
      expectedRefreshes: 0,
      expectedMessage: 'CSRF token is required',
      expectedCsrfToken: '',
    },
    {
      name: 'does not replay when the refresher is unavailable',
      setup: () => {
        const fetchMock = vi.mocked(fetch)
        fetchMock
          .mockResolvedValueOnce(createCsrfFailureResponse())
          .mockResolvedValueOnce(new Response('expired', { status: 401 }))
        return { fetchMock, refreshCalls: [] }
      },
      invoke: () => sendJson('/admin/test', { method: 'POST', body: { ok: true } }),
      expectedCalls: 2,
      expectedRefreshes: 0,
      expectedMessage: 'CSRF token is required',
    },
    {
      name: 'does not replay when the refresher fails',
      setup: () => {
        const fetchMock = vi.mocked(fetch)
        fetchMock
          .mockResolvedValueOnce(createCsrfFailureResponse())
          .mockResolvedValueOnce(new Response('expired', { status: 401 }))
        return { fetchMock, refreshCalls: [] }
      },
      invoke: () => sendJson('/admin/test', { method: 'POST', body: { ok: true } }),
      expectedCalls: 2,
      expectedRefreshes: 0,
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
    fetchMock
      .mockResolvedValueOnce(createCsrfFailureResponse())
      .mockResolvedValueOnce(createJsonResponse({ ok: true }))

    await expect(sendJson('/admin/test', { method: 'POST', body: { ok: true } })).rejects.toMatchObject({
      status: 403,
      message: 'CSRF token is required',
    })

    expect(fetchMock).toHaveBeenCalledTimes(2)
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

function createCsrfRecoveryResponse() {
  return createJsonResponse({
    csrfToken: freshCsrfToken,
    expiresAt: '2026-08-09T00:00:00.000Z',
    sessionId: 'session-1',
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

function getRequestUrl(fetchMock: ReturnType<typeof vi.fn>, index: number) {
  return fetchMock.mock.calls[index]?.[0] as string
}

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve
    reject = promiseReject
  })

  return { promise, resolve, reject }
}

async function waitForCondition(condition: () => boolean) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (condition()) {
      return
    }

    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0)
    })
  }

  throw new Error('Timed out waiting for the fetch sequence')
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
