import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildPushedAuthorizationLoginUrl } from './pushed-authorization'

const origin = 'https://axis.example.test'
const reference = 'urn:ietf:params:oauth:request_uri:1234567890abcdefghijklmnopqrstuv'
function authorization() {
  const url = new URL('/realms/store-ops/protocol/openid-connect/auth', origin)
  url.search = new URLSearchParams({
    client_id: 'store-ops-admin-web', redirect_uri: origin + '/auth/callback',
    response_type: 'code', scope: 'openid profile email roles', state: 'synthetic-state',
    code_challenge: 'synthetic-pkce-challenge', code_challenge_method: 'S256',
  }).toString()
  return url
}

describe('short PAR login', () => {
  const fetchMock = vi.fn()
  beforeEach(() => {
    vi.stubGlobal('window', { location: { origin } })
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ request_uri: reference, expires_in: 60 }), { status: 201 }))
  })
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); fetchMock.mockReset(); vi.useRealTimers() })

  it('posts the unchanged PKCE request and navigates with only the client and reference', async () => {
    const original = authorization()
    const result = new URL(await buildPushedAuthorizationLoginUrl(original))
    expect(result.origin).toBe(origin)
    expect(result.pathname).toBe('/realms/store-ops/protocol/openid-connect/auth')
    expect([...result.searchParams.keys()]).toEqual(['client_id', 'request_uri'])
    expect(result.searchParams.get('request_uri')).toBe(reference)
    expect(result.toString().length).toBeLessThan(original.toString().length)
    const call = fetchMock.mock.calls[0]
    if (!call) throw new Error('PAR request was not sent')
    const [endpoint, options] = call
    expect(String(endpoint)).toBe(origin + '/realms/store-ops/protocol/openid-connect/ext/par/request')
    expect(options).toMatchObject({ method: 'POST', body: original.searchParams.toString(),
      credentials: 'omit', redirect: 'error', cache: 'no-store' })
    expect(options.body).not.toContain('code_verifier')
  })

  it.each(['https://outside.example.test/realms/store-ops/protocol/openid-connect/auth',
    origin + '/admin/realms', origin + '/realms/another/protocol/openid-connect/auth'])(
  'rejects an unapproved provider before sending any request: %s', async (url) => {
    const value = authorization()
    const replacement = new URL(url)
    replacement.search = value.search
    await expect(buildPushedAuthorizationLoginUrl(replacement)).rejects.toThrow('not configured')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each(['response_type', 'code_challenge_method', 'state', 'code_challenge', 'client_id'])(
  'rejects an incomplete or non-PKCE request: %s', async (key) => {
    const url = authorization(); url.searchParams.delete(key)
    await expect(buildPushedAuthorizationLoginUrl(url)).rejects.toThrow()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each([200, 400, 401, 500])('does not fall back to the long URL on HTTP %i', async (status) => {
    fetchMock.mockResolvedValue(new Response('{}', { status }))
    await expect(buildPushedAuthorizationLoginUrl(authorization())).rejects.toThrow('rejected')
  })

  it.each([
    { request_uri: 'https://outside.example.test', expires_in: 60 },
    { request_uri: reference + '&redirect_uri=evil', expires_in: 60 },
    { request_uri: reference, expires_in: 0 },
    { request_uri: reference, expires_in: 601 },
    { request_uri: reference, expires_in: '60' },
    { request_uri: reference, expires_in: 1.5 },
    null,
  ])('rejects malformed, expired or unsafe references', async (payload) => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(payload), { status: 201 }))
    await expect(buildPushedAuthorizationLoginUrl(authorization())).rejects.toThrow('invalid reference')
  })

  it('bounds a stalled provider request and clears the timer', async () => {
    vi.useFakeTimers()
    fetchMock.mockImplementation((_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(new Error('aborted')))
    }))
    const assertion = expect(buildPushedAuthorizationLoginUrl(authorization())).rejects.toThrow('aborted')
    await vi.advanceTimersByTimeAsync(15000)
    await assertion
    expect(vi.getTimerCount()).toBe(0)
  })
})
