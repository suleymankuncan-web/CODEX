const AUTHORIZATION_PATH = '/realms/store-ops/protocol/openid-connect/auth'
const PAR_PATH = '/realms/store-ops/protocol/openid-connect/ext/par/request'
const REQUEST_URI = /^urn:ietf:params:oauth:request_uri:[A-Za-z0-9_-]{16,128}$/

/** Keep PKCE and callback parameters in the PAR body, never in the login URL. */
export async function buildPushedAuthorizationLoginUrl(authorization: URL) {
  if (authorization.origin !== window.location.origin ||
    authorization.pathname !== AUTHORIZATION_PATH || authorization.hash ||
    authorization.searchParams.get('response_type') !== 'code' ||
    authorization.searchParams.get('code_challenge_method') !== 'S256') {
    throw new Error('Short login is not configured for this provider')
  }

  const clientId = authorization.searchParams.get('client_id')
  if (!clientId || !authorization.searchParams.get('state') ||
    !authorization.searchParams.get('code_challenge')) {
    throw new Error('Short login requires a complete PKCE request')
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)
  try {
    const endpoint = new URL(PAR_PATH, authorization.origin)
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: authorization.searchParams.toString(),
      credentials: 'omit',
      redirect: 'error',
      cache: 'no-store',
      signal: controller.signal,
    })
    if (response.status !== 201) throw new Error('Short login request was rejected')
    const payload: unknown = await response.json()
    if (!payload || typeof payload !== 'object' || !('request_uri' in payload) ||
      typeof payload.request_uri !== 'string' || !REQUEST_URI.test(payload.request_uri) ||
      !('expires_in' in payload) || typeof payload.expires_in !== 'number' ||
      !Number.isInteger(payload.expires_in) || payload.expires_in <= 0 || payload.expires_in > 600) {
      throw new Error('Short login returned an invalid reference')
    }
    const login = new URL(AUTHORIZATION_PATH, authorization.origin)
    login.searchParams.set('client_id', clientId)
    login.searchParams.set('request_uri', payload.request_uri)
    return login.toString()
  } finally {
    clearTimeout(timeout)
  }
}
