import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { AuthBootstrap } from './api'

const api = vi.hoisted(() => ({ createManagedBrowserSession: vi.fn() }))
vi.mock('../../lib/api', () => api)
import { buildProviderLoginUrl, exchangeAuthorizationCodeForToken, readPendingLoginReturnPath, UnavailablePkceLoginStateError } from './auth-flow'

const origin = 'https://axis.example.test'
const reference = 'urn:ietf:params:oauth:request_uri:1234567890abcdefghijklmnopqrstuv'
const bootstrap: AuthBootstrap = { authMode: 'jwt', provider: {
  configured: true, managedBrowserSession: true,
  authorizationUrl: origin + '/realms/store-ops/protocol/openid-connect/auth',
  clientId: 'store-ops-admin-web', scope: 'openid profile email roles', responseType: 'code',
  audience: null, callbackPath: '/auth/callback', tokenUrl: origin + '/realms/store-ops/protocol/openid-connect/token',
  logoutUrl: null, postLogoutRedirectPath: '/auth/login',
} }
const storage = new Map<string, string>()
const fetchMock = vi.fn()
beforeEach(() => {
  storage.clear()
  vi.stubEnv('VITE_OIDC_PAR_ENABLED', 'true')
  vi.stubGlobal('window', { location: { origin }, crypto: globalThis.crypto, btoa: globalThis.btoa,
    sessionStorage: { getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) },
  })
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockImplementation(async () => new Response(JSON.stringify({ request_uri: reference, expires_in: 60 }), { status: 201 }))
})
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); fetchMock.mockReset(); api.createManagedBrowserSession.mockReset() })

it('keeps the verifier in the same tab and redeems the callback through the managed session', async () => {
  const login = new URL((await buildProviderLoginUrl({ bootstrap, returnTo: '/store/me' }))!)
  expect(login.pathname).toBe('/realms/store-ops/protocol/openid-connect/auth')
  expect([...login.searchParams.keys()]).toEqual(['client_id', 'request_uri'])
  const saved = JSON.parse(storage.get('store-ops-admin-pkce-login')!)
  const request = fetchMock.mock.calls[0]
  if (!request) throw new Error('PAR request missing')
  const body = new URLSearchParams(request[1].body)
  expect(body.get('state')).toBe(saved.state)
  expect(body.get('code_challenge_method')).toBe('S256')
  expect(body.has('code_verifier')).toBe(false)
  expect(saved.returnTo).toBe('/store/me')
  expect(saved.authorizationExpiresAt).toBeGreaterThan(saved.createdAt)
  expect(saved.authorizationExpiresAt).toBeLessThanOrEqual(saved.createdAt + 60_000)
  api.createManagedBrowserSession.mockResolvedValue({ sessionId: 'synthetic-session' })
  const result = await exchangeAuthorizationCodeForToken({ code: 'synthetic-code', state: saved.state, bootstrap })
  expect(api.createManagedBrowserSession).toHaveBeenCalledWith({ code: 'synthetic-code', state: saved.state,
    codeVerifier: saved.codeVerifier, redirectUri: origin + '/auth/callback' })
  expect(result.returnTo).toBe('/store/me')
  expect(storage.has('store-ops-admin-pkce-login')).toBe(false)
})

it('retains the original provider flow when PAR is not opted in', async () => {
  vi.stubEnv('VITE_OIDC_PAR_ENABLED', 'false')
  const login = new URL((await buildProviderLoginUrl({ bootstrap }))!)
  expect(login.pathname).toBe('/realms/store-ops/protocol/openid-connect/auth')
  expect(login.searchParams.get('code_challenge_method')).toBe('S256')
  expect(fetchMock).not.toHaveBeenCalled()
})

it('rejects a slow PAR response after a newer same-tab login has replaced its verifier', async () => {
  let finishFirst: ((response: Response) => void) | undefined
  fetchMock.mockImplementationOnce(() => new Promise<Response>((resolve) => { finishFirst = resolve }))
  const first = buildProviderLoginUrl({ bootstrap })
  const rejected = expect(first).rejects.toThrow('invalid')
  await vi.waitFor(() => expect(finishFirst).toBeDefined())
  const second = await buildProviderLoginUrl({ bootstrap, returnTo: '/store/me' })
  expect(second).toContain('request_uri=')
  const latest = storage.get('store-ops-admin-pkce-login')
  finishFirst!(new Response(JSON.stringify({ request_uri: reference, expires_in: 60 }), { status: 201 }))
  await rejected
  expect(storage.get('store-ops-admin-pkce-login')).toBe(latest)
  expect(JSON.parse(storage.get('store-ops-admin-pkce-login')!).returnTo).toBe('/store/me')
})

it('rejects mismatched callback state before any token or session request', async () => {
  await buildProviderLoginUrl({ bootstrap })
  await expect(exchangeAuthorizationCodeForToken({ code: 'synthetic-code', state: 'wrong-state', bootstrap })).rejects.toThrow('invalid')
  expect(api.createManagedBrowserSession).not.toHaveBeenCalled()
})

it('classifies absent same-tab state for a fresh handshake without redeeming the old code', async () => {
  await expect(exchangeAuthorizationCodeForToken({ code: 'old-code', state: 'old-state', bootstrap }))
    .rejects.toBeInstanceOf(UnavailablePkceLoginStateError)
  expect(api.createManagedBrowserSession).not.toHaveBeenCalled()
})

it('does not classify a mismatched callback as recoverable even when the stored attempt has expired', async () => {
  await buildProviderLoginUrl({ bootstrap })
  const key = 'store-ops-admin-pkce-login'
  const saved = JSON.parse(storage.get(key)!)
  storage.set(key, JSON.stringify({ ...saved, createdAt: Date.now() - 11 * 60 * 1000 }))
  const error = await exchangeAuthorizationCodeForToken({ code: 'old-code', state: 'wrong-state', bootstrap }).catch((value: unknown) => value)
  expect(error).not.toBeInstanceOf(UnavailablePkceLoginStateError)
  expect(api.createManagedBrowserSession).not.toHaveBeenCalled()
})

it.each(['invalid-date', null, Date.now() + 60_000])('rejects malformed or future attempt timestamps: %s', async (createdAt) => {
  await buildProviderLoginUrl({ bootstrap })
  const key = 'store-ops-admin-pkce-login'
  const saved = JSON.parse(storage.get(key)!)
  storage.set(key, JSON.stringify({ ...saved, createdAt }))
  const error = await exchangeAuthorizationCodeForToken({ code: 'old-code', state: saved.state, bootstrap }).catch((value: unknown) => value)
  expect(error).toBeInstanceOf(Error)
  expect(error).not.toBeInstanceOf(UnavailablePkceLoginStateError)
  expect(api.createManagedBrowserSession).not.toHaveBeenCalled()
})

it('rejects stale same-tab callbacks without changing session lifetime', async () => {
  await buildProviderLoginUrl({ bootstrap })
  const key = 'store-ops-admin-pkce-login'
  const saved = JSON.parse(storage.get(key)!)
  storage.set(key, JSON.stringify({ ...saved, createdAt: Date.now() - 11 * 60 * 1000 }))
  await expect(exchangeAuthorizationCodeForToken({ code: 'synthetic-code', state: saved.state, bootstrap })).rejects.toThrow('expired')
  expect(api.createManagedBrowserSession).not.toHaveBeenCalled()
})

it('preserves a native refresh destination while creating a fresh verifier and state', async () => {
  await buildProviderLoginUrl({ bootstrap, returnTo: '/store/me' })
  const previous = JSON.parse(storage.get('store-ops-admin-pkce-login')!)
  const returnTo = readPendingLoginReturnPath()
  expect(returnTo).toBe('/store/me')
  expect(JSON.parse(storage.get('store-ops-admin-pkce-login')!)).toEqual(previous)
  await buildProviderLoginUrl({ bootstrap, returnTo: returnTo! })
  const next = JSON.parse(storage.get('store-ops-admin-pkce-login')!)
  expect(next.returnTo).toBe('/store/me')
  expect(next.state).not.toBe(previous.state)
  expect(next.codeVerifier).not.toBe(previous.codeVerifier)
})

it.each([
  { createdAt: Date.now() - 11 * 60 * 1000 },
  { createdAt: Date.now() + 60_000 },
  { createdAt: null },
  { state: null },
  { codeVerifier: '' },
  { returnTo: '//outside.example/path' },
  { returnTo: '/auth/callback?code=old-code' },
])('ignores an invalid pending destination: %j', async (overrides) => {
  await buildProviderLoginUrl({ bootstrap, returnTo: '/store/me' })
  const key = 'store-ops-admin-pkce-login'
  storage.set(key, JSON.stringify({ ...JSON.parse(storage.get(key)!), ...overrides }))
  expect(readPendingLoginReturnPath()).toBeNull()
})

it('tolerates absent, malformed or restricted storage while checking the pending destination', () => {
  expect(readPendingLoginReturnPath()).toBeNull()
  storage.set('store-ops-admin-pkce-login', 'not-json')
  expect(readPendingLoginReturnPath()).toBeNull()
  vi.spyOn(window.sessionStorage, 'getItem').mockImplementation(() => { throw new Error('Storage restricted') })
  expect(readPendingLoginReturnPath()).toBeNull()
})

it('does not use the presentation deadline to reject a valid PKCE callback', async () => {
  await buildProviderLoginUrl({ bootstrap })
  const key = 'store-ops-admin-pkce-login'
  const saved = JSON.parse(storage.get(key)!)
  storage.set(key, JSON.stringify({ ...saved, authorizationExpiresAt: Date.now() - 1000 }))
  api.createManagedBrowserSession.mockResolvedValue({ sessionId: 'synthetic-session' })
  await exchangeAuthorizationCodeForToken({ code: 'synthetic-code', state: saved.state, bootstrap })
  expect(api.createManagedBrowserSession).toHaveBeenCalledTimes(1)
})
