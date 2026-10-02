import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { establishManagedBrowserSession as Establish } from './api-browser-session'
import type { BrowserLoginUnavailableError as Unavailable } from './browser-login-error'
import type { ApiError } from './api-error'
let establishManagedBrowserSession: typeof Establish
let BrowserLoginUnavailableError: typeof Unavailable
let ApiErrorConstructor: typeof ApiError

const input = { code: 'synthetic-code', state: 'same-tab-state', codeVerifier: 'v'.repeat(43), redirectUri: 'https://axis.example.test/auth/callback' }
const issued = { csrfToken: 'synthetic-issued-nonce', sessionId: 'synthetic-session', expiresAt: '2099-01-01T00:00:00Z', session: { authenticated: true } }
const fetchMock = vi.fn()
beforeEach(async () => {
  vi.resetModules()
  ;({ establishManagedBrowserSession } = await import('./api-browser-session'))
  ;({ BrowserLoginUnavailableError } = await import('./browser-login-error'))
  ;({ ApiError: ApiErrorConstructor } = await import('./api-error'))
  vi.stubGlobal('window', { location: { origin: 'https://axis.example.test' } })
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => { vi.unstubAllGlobals(); fetchMock.mockReset(); vi.resetModules() })

it('confirms the newly issued cookie nonce before returning a managed session', async () => {
  fetchMock.mockResolvedValueOnce(Response.json(issued)).mockResolvedValueOnce(Response.json({ csrfToken: issued.csrfToken }))
  await expect(establishManagedBrowserSession('/api', input)).resolves.toEqual(issued)
  expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(['/api/auth/browser-session/oidc', '/api/auth/browser-session/csrf'])
  for (const [, init] of fetchMock.mock.calls) expect(init.credentials).toBe('include')
})

it.each([null, 'older-account-nonce'])('blocks an absent or older cookie without replaying the exchange: %s', async (nonce) => {
  fetchMock.mockResolvedValueOnce(Response.json(issued)).mockResolvedValueOnce(nonce ? Response.json({ csrfToken: nonce }) : new Response(null, { status: 401 }))
  await expect(establishManagedBrowserSession('/api', input)).rejects.toBeInstanceOf(BrowserLoginUnavailableError)
  expect(fetchMock).toHaveBeenCalledTimes(2)
})

it('retains cooldown metadata if the cookie confirmation is limited', async () => {
  fetchMock.mockResolvedValueOnce(Response.json(issued)).mockResolvedValueOnce(new Response(null, { status: 429, headers: { 'Retry-After': '5' } }))
  const error = await establishManagedBrowserSession('/api', input).catch((value: unknown) => value)
  expect(error).toBeInstanceOf(ApiErrorConstructor)
  expect(error).toMatchObject({ status: 429 })
  expect((error as ApiError).retryAt).toBeGreaterThan(Date.now())
  expect(fetchMock).toHaveBeenCalledTimes(2)
})

it('does not probe or repeat a rejected exchange', async () => {
  fetchMock.mockResolvedValueOnce(new Response(null, { status: 403 }))
  await expect(establishManagedBrowserSession('/api', input)).rejects.toMatchObject({ status: 403 })
  expect(fetchMock).toHaveBeenCalledTimes(1)
})
