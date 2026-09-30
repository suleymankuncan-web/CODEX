import { ApiError } from './api-error'
import { isSameOriginApi } from './api-session-recovery'
import type { BrowserSessionCreateResponse } from './api'

// Initial same-origin recovery returns a nonce to the owning session transition.
// It does not mutate CSRF memory before that transition confirms it is current.
export async function recoverManagedBrowserSession(apiBaseUrl: string, signal: AbortSignal): Promise<string | null> {
  if (!isSameOriginApi(() => apiBaseUrl)) return null
  const response = await fetch(`${apiBaseUrl}/auth/browser-session/csrf`, {
    method: 'POST', headers: { Accept: 'application/json' }, credentials: 'include', signal,
  })
  if (response.status === 401) return null
  if (!response.ok) throw new ApiError(response.status, "Session recovery is temporarily unavailable")
  const payload = await response.json() as { csrfToken?: unknown }
  if (typeof payload.csrfToken !== 'string' || !payload.csrfToken.trim()) throw new ApiError(503, 'Session recovery response is unavailable')
  return payload.csrfToken.trim()
}

export async function establishManagedBrowserSession(apiBaseUrl: string, input: { code: string; codeVerifier: string; state: string; redirectUri: string }) {
  if (!isSameOriginApi(() => apiBaseUrl)) throw new ApiError(400, 'Managed login requires the application origin')
  const response = await fetch(`${apiBaseUrl}/auth/browser-session/oidc`, {
    method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    credentials: 'include', body: JSON.stringify(input), signal: AbortSignal.timeout(30_000),
  })
  if (!response.ok) throw new ApiError(response.status, 'Login could not be confirmed. Retry or restart login.')
  const payload = await response.json() as BrowserSessionCreateResponse
  if (typeof payload.csrfToken !== 'string' || !payload.csrfToken.trim() ||
    typeof payload.sessionId !== 'string' || !payload.sessionId.trim() ||
    typeof payload.expiresAt !== 'string' || !Number.isFinite(Date.parse(payload.expiresAt)) ||
    !payload.session || typeof payload.session !== 'object' || !('authenticated' in payload.session) ||
    payload.session.authenticated !== true) throw new ApiError(503, 'Login response is unavailable')
  return payload
}
