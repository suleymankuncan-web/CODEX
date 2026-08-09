import {
  clearClientBearerSession,
  isCookieBrowserSession,
  readClientSession,
  readBrowserSessionCsrfToken,
  writeClientBearerSession,
  writeBrowserSessionCsrfToken,
} from '../features/session/session-storage'
import type { SessionState } from '../features/session/session-storage'

const CSRF_TOKEN_REQUIRED_MESSAGE = 'CSRF token is required'

export type BrowserSessionCsrfResponse = {
  csrfToken: string
  expiresAt: string
  sessionId: string
}

type SessionRefreshResult = string | { refreshed: boolean; bearerToken?: string | null } | null
type BearerTokenRefreshHandler = (input?: { skipCache?: boolean }) => Promise<SessionRefreshResult>

let bearerTokenRefreshHandler: BearerTokenRefreshHandler | null = null
let bearerTokenRefreshPromise: Promise<boolean> | null = null
let browserSessionCsrfRecoveryPromise: Promise<boolean> | null = null

export function registerBearerTokenRefreshHandler(handler: BearerTokenRefreshHandler) {
  bearerTokenRefreshHandler = handler

  return () => {
    if (bearerTokenRefreshHandler === handler) {
      bearerTokenRefreshHandler = null
    }
  }
}

export async function refreshSession(input?: { skipCache?: boolean }) {
  if (!bearerTokenRefreshHandler) {
    return false
  }

  if (!bearerTokenRefreshPromise) {
    bearerTokenRefreshPromise = bearerTokenRefreshHandler({ skipCache: Boolean(input?.skipCache) })
      .then((result) => {
        const session = readClientSession()
        const normalized = normalizeRefreshResult(result)

        if (!normalized.refreshed) {
          return false
        }

        if (isCookieBrowserSession(session)) {
          clearClientBearerSession()
          return true
        }

        const token = normalized.bearerToken?.trim() ?? ''
        if (!token) {
          return false
        }

        writeClientBearerSession(token)
        return true
      })
      .catch(() => false)
      .finally(() => {
        bearerTokenRefreshPromise = null
      })
  }

  return bearerTokenRefreshPromise
}

export function isSameOriginApi(resolveApiBaseUrl: () => string) {
  if (typeof window === 'undefined' || !window.location.origin) {
    return false
  }

  try {
    return new URL(resolveApiBaseUrl(), window.location.origin).origin === window.location.origin
  } catch {
    return false
  }
}

export async function recoverBrowserSessionCsrfToken(resolveApiBaseUrl: () => string) {
  if (!browserSessionCsrfRecoveryPromise) {
    browserSessionCsrfRecoveryPromise = performBrowserSessionCsrfRecovery(resolveApiBaseUrl).finally(() => {
      browserSessionCsrfRecoveryPromise = null
    })
  }

  return browserSessionCsrfRecoveryPromise
}

async function performBrowserSessionCsrfRecovery(resolveApiBaseUrl: () => string) {
  try {
    const response = await fetch(`${resolveApiBaseUrl()}/auth/browser-session/csrf`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
      },
      credentials: 'include',
    })

    if (!response.ok) {
      return false
    }

    const payload = (await response.json()) as Partial<BrowserSessionCsrfResponse>
    const csrfToken = typeof payload.csrfToken === 'string' ? payload.csrfToken.trim() : ''
    if (!csrfToken) {
      return false
    }

    writeBrowserSessionCsrfToken(csrfToken)
    return true
  } catch {
    return false
  }
}

export async function recoverCrossOriginBrowserSessionCsrf() {
  if (!(await refreshSession({ skipCache: true }))) {
    return false
  }

  return Boolean(readBrowserSessionCsrfToken())
}

export async function isCanonicalCsrfFailureResponse(response: Response) {
  if (response.status !== 403) {
    return false
  }

  try {
    return extractApiErrorMessage(await response.clone().text(), response.status) === CSRF_TOKEN_REQUIRED_MESSAGE
  } catch {
    return false
  }
}

export function extractApiErrorMessage(rawBody: string, status: number) {
  const trimmed = rawBody.trim()
  if (!trimmed) {
    return `Request failed with status ${status}`
  }

  try {
    const parsed = JSON.parse(trimmed) as { message?: unknown }
    if (typeof parsed.message === 'string' && parsed.message.trim()) {
      return parsed.message.trim()
    }
    if (Array.isArray(parsed.message)) {
      const joined = parsed.message.filter((item): item is string => typeof item === 'string').join(' ')
      if (joined.trim()) {
        return joined.trim()
      }
    }
  } catch {
    return trimmed
  }

  return trimmed
}

export function shouldRecoverSessionFromApiError(status: number, session: SessionState, message: string) {
  if (session.mode !== 'bearer' || typeof window === 'undefined') {
    return false
  }

  if (status === 401) {
    return true
  }

  return status === 403 && isCookieBrowserSession(session) && isCsrfFailureMessage(message)
}

function normalizeRefreshResult(result: SessionRefreshResult) {
  if (typeof result === 'string') {
    return { refreshed: Boolean(result.trim()), bearerToken: result }
  }

  return { refreshed: Boolean(result?.refreshed), bearerToken: result?.bearerToken ?? null }
}

function isCsrfFailureMessage(message: string) {
  return message.toLowerCase().includes(CSRF_TOKEN_REQUIRED_MESSAGE.toLowerCase())
}
