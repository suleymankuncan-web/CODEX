import {
  buildSessionHeaders,
  clearClientBearerSession,
  isBearerTokenExpiringSoon,
  isCookieBrowserSession,
  readBrowserSessionCsrfToken,
  readClientSession,
  writeBrowserSessionCsrfToken,
} from '../features/session/session-storage'
import type { SessionState } from '../features/session/session-storage'
import {
  extractApiErrorMessage,
  isCanonicalCsrfFailureResponse,
  refreshSession,
  shouldRecoverSessionFromApiError,
} from './api-session-recovery'
import {
  emitApiFailureDiagnostic,
  getRequestIdFromHeaders,
  type ApiFailureCategory,
} from './api-diagnostics'

const DEFAULT_API_BASE_URL = '/api'
const STAGING_HOST_API_BASE_URL = 'https://api-staging.hr-axis.com/api'
const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim() || DEFAULT_API_BASE_URL

type JsonMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
type ApiRequestContext = {
  method: JsonMethod
  durationMs: number
  requestAttempt: number
}
type BrowserSessionCreateResponse = {
  csrfToken: string
  expiresAt: string
  sessionId: string
  session: unknown
}

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export type SessionExpiredDetail = {
  path: string
  message: string
  status: number
}

export const SESSION_EXPIRED_EVENT = 'store-ops-session-expired'
export { registerBearerTokenRefreshHandler } from './api-session-recovery'

async function requestJson<T>(path: string, input?: { method?: JsonMethod; body?: unknown }): Promise<T> {
  const body = input?.body !== undefined ? JSON.stringify(input.body) : undefined
  const method = input?.method ?? 'GET'
  const prepared = await prepareHeaders(path, input?.body !== undefined, method)

  let attempt = await performFetchAttempt(
    path,
    buildJsonRequest(method, prepared.session, prepared.headers, body),
  )
  let response = attempt.response

  if (response.status === 401 && prepared.session.mode === 'bearer') {
    const retryHeaders = await prepareRefreshedHeaders(path, input?.body !== undefined, method, { skipCache: true })
    if (retryHeaders) {
      attempt = await performFetchAttempt(
        path,
        buildJsonRequest(method, readClientSession(), retryHeaders, body),
        2,
      )
      response = attempt.response
    }
  } else if (
    isUnsafeMethod(method) &&
    isCookieBrowserSession(prepared.session) &&
    (await isCanonicalCsrfFailureResponse(response))
  ) {
    const retryHeaders = await prepareCsrfRecoveryHeaders(input?.body !== undefined, method)
    if (retryHeaders) {
      const retrySession = readClientSession()
      if (isCookieBrowserSession(retrySession)) {
        attempt = await performFetchAttempt(
          path,
          buildJsonRequest(method, retrySession, retryHeaders, body),
          2,
        )
        response = attempt.response
      }
    }
  }

  if (!response.ok) {
    await throwApiError(response, path, prepared.session, {
      method,
      durationMs: attempt.durationMs,
      requestAttempt: attempt.requestAttempt,
    })
  }

  return parseJsonResponse<T>(response, path, {
    method,
    durationMs: attempt.durationMs,
    requestAttempt: attempt.requestAttempt,
  })
}

async function requestFormData<T>(
  path: string,
  input: {
    method: Exclude<JsonMethod, 'GET'>
    body: FormData
  },
): Promise<T> {
  const prepared = await prepareHeaders(path, false, input.method)

  let attempt = await performFetchAttempt(path, {
    method: input.method,
    headers: prepared.headers,
    body: input.body,
    ...(isCookieBrowserSession(prepared.session) ? { credentials: 'include' as const } : {}),
  })
  let response = attempt.response

  if (response.status === 401 && prepared.session.mode === 'bearer') {
    const retryHeaders = await prepareRefreshedHeaders(path, false, input.method, { skipCache: true })
    if (retryHeaders) {
      const retrySession = readClientSession()
      attempt = await performFetchAttempt(
        path,
        {
          method: input.method,
          headers: retryHeaders,
          body: input.body,
          ...(isCookieBrowserSession(retrySession) ? { credentials: 'include' as const } : {}),
        },
        2,
      )
      response = attempt.response
    }
  } else if (
    isUnsafeMethod(input.method) &&
    isCookieBrowserSession(prepared.session) &&
    (await isCanonicalCsrfFailureResponse(response))
  ) {
    const retryHeaders = await prepareCsrfRecoveryHeaders(false, input.method)
    if (retryHeaders) {
      const retrySession = readClientSession()
      if (isCookieBrowserSession(retrySession)) {
        attempt = await performFetchAttempt(
          path,
          {
            method: input.method,
            headers: retryHeaders,
            body: input.body,
            credentials: 'include',
          },
          2,
        )
        response = attempt.response
      }
    }
  }

  if (!response.ok) {
    await throwApiError(response, path, prepared.session, {
      method: input.method,
      durationMs: attempt.durationMs,
      requestAttempt: attempt.requestAttempt,
    })
  }

  return parseJsonResponse<T>(response, path, {
    method: input.method,
    durationMs: attempt.durationMs,
    requestAttempt: attempt.requestAttempt,
  })
}

async function requestBlob(path: string): Promise<Blob> {
  const method = 'GET'
  const prepared = await prepareHeaders(path, false, method)

  let attempt = await performFetchAttempt(
    path,
    {
      method,
      headers: prepared.headers,
      ...(isCookieBrowserSession(prepared.session) ? { credentials: 'include' as const } : {}),
    },
  )
  let response = attempt.response

  if (response.status === 401 && prepared.session.mode === 'bearer') {
    const retryHeaders = await prepareRefreshedHeaders(path, false, method, { skipCache: true })
    if (retryHeaders) {
      const retrySession = readClientSession()
      attempt = await performFetchAttempt(
        path,
        {
          method,
          headers: retryHeaders,
          ...(isCookieBrowserSession(retrySession) ? { credentials: 'include' as const } : {}),
        },
        2,
      )
      response = attempt.response
    }
  }

  if (!response.ok) {
    await throwApiError(response, path, prepared.session, {
      method,
      durationMs: attempt.durationMs,
      requestAttempt: attempt.requestAttempt,
    })
  }

  return response.blob()
}

export async function fetchJson<T>(path: string): Promise<T> {
  return requestJson<T>(path)
}

export async function fetchBlob(path: string): Promise<Blob> {
  return requestBlob(path)
}

export async function sendJson<T>(
  path: string,
  input: {
    method: Exclude<JsonMethod, 'GET'>
    body?: unknown
  },
): Promise<T> {
  return requestJson<T>(path, input)
}

export async function sendFormData<T>(
  path: string,
  input: {
    method: Exclude<JsonMethod, 'GET'>
    body: FormData
  },
): Promise<T> {
  return requestFormData<T>(path, input)
}

function buildJsonRequest(
  method: JsonMethod,
  session: SessionState,
  headers: Record<string, string>,
  body: string | undefined,
): RequestInit & { method: JsonMethod } {
  const request: RequestInit & { method: JsonMethod } = {
    method,
    headers,
    ...(isCookieBrowserSession(session) ? { credentials: 'include' as const } : {}),
  }

  if (body !== undefined) {
    request.body = body
  }

  return request
}

async function performFetchAttempt(
  path: string,
  request: RequestInit & { method: JsonMethod },
  requestAttempt = 1,
) {
  const startedAt = getCurrentTimeMs()

  try {
    const response = await fetch(`${resolveApiBaseUrl()}${path}`, request)
    return {
      response,
      durationMs: getCurrentTimeMs() - startedAt,
      requestAttempt,
    }
  } catch (error) {
    emitApiFailureDiagnostic({
      path,
      method: request.method,
      status: null,
      durationMs: getCurrentTimeMs() - startedAt,
      requestAttempt,
      errorCategory: 'network',
      errorMessage: getNetworkFailureMessage(error),
      requestId: null,
    })
    throw error
  }
}

function resolveApiBaseUrl() {
  if (
    configuredApiBaseUrl === DEFAULT_API_BASE_URL &&
    typeof window !== 'undefined' &&
    window.location.hostname === 'staging.hr-axis.com'
  ) {
    return STAGING_HOST_API_BASE_URL
  }

  return configuredApiBaseUrl
}

export async function createBrowserSession(providerToken: string) {
  const token = providerToken.trim()
  if (!token) {
    throw new ApiError(401, 'Bearer token is required')
  }

  const response = await fetch(`${resolveApiBaseUrl()}/auth/browser-session`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
    credentials: 'include',
  })

  if (!response.ok) {
    throw new ApiError(response.status, await response.text())
  }

  const payload = (await response.json()) as BrowserSessionCreateResponse
  writeBrowserSessionCsrfToken(typeof payload.csrfToken === 'string' ? payload.csrfToken : '')
  clearClientBearerSession()
  return payload
}

export async function clearBrowserSessionCookie() {
  const response = await fetch(`${resolveApiBaseUrl()}/auth/browser-session`, {
    method: 'DELETE',
    headers: {
      Accept: 'application/json',
    },
    credentials: 'include',
  })

  if (!response.ok) {
    throw new ApiError(response.status, await response.text())
  }

  writeBrowserSessionCsrfToken('')
  clearClientBearerSession()
}

async function prepareHeaders(path: string, hasJsonBody: boolean, method: JsonMethod) {
  const session = readClientSession()
  assertBrowserSessionCsrfAvailable(session, path, method)
  const headers = buildRequestHeaders(session, hasJsonBody, method)

  if (session.mode !== 'bearer') {
    return { session, headers }
  }

  if (isCookieBrowserSession(session)) {
    return { session, headers }
  }

  if (headers.Authorization && !isBearerTokenExpiringSoon(session.bearerToken)) {
    return { session, headers }
  }

  const refreshedHeaders = await prepareRefreshedHeaders(path, hasJsonBody, method, { skipCache: true })
  if (!refreshedHeaders) {
    return { session, headers }
  }

  return {
    session: readClientSession(),
    headers: refreshedHeaders,
  }
}

function buildRequestHeaders(session: SessionState, hasJsonBody: boolean, method: JsonMethod) {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...buildSessionHeaders(session),
  }

  if (hasJsonBody) {
    headers['Content-Type'] = 'application/json'
  }

  const csrfToken = readBrowserSessionCsrfToken()
  if (isUnsafeMethod(method) && isCookieBrowserSession(session) && csrfToken) {
    headers['X-CSRF-Token'] = csrfToken
  }

  return headers
}

async function prepareRefreshedHeaders(
  path: string,
  hasJsonBody: boolean,
  method: JsonMethod,
  input?: { skipCache?: boolean },
) {
  const refreshed = await refreshSession(input)
  if (!refreshed) {
    return null
  }

  const refreshedSession = readClientSession()
  assertBrowserSessionCsrfAvailable(refreshedSession, path, method)
  const headers = buildRequestHeaders(refreshedSession, hasJsonBody, method)
  return isCookieBrowserSession(refreshedSession) || headers.Authorization ? headers : null
}

async function prepareCsrfRecoveryHeaders(hasJsonBody: boolean, method: JsonMethod) {
  try {
    const refreshed = await refreshSession({ skipCache: true })
    if (!refreshed) {
      return null
    }

    const refreshedSession = readClientSession()
    if (!isCookieBrowserSession(refreshedSession) || !readBrowserSessionCsrfToken()) {
      return null
    }

    return buildRequestHeaders(refreshedSession, hasJsonBody, method)
  } catch {
    return null
  }
}

async function throwApiError(
  response: Response,
  path: string,
  session: SessionState,
  context: ApiRequestContext,
): Promise<never> {
  const fallbackText = await response.text()
  const message = extractApiErrorMessage(fallbackText, response.status)

  emitResponseFailureDiagnostic(response, path, context, 'http', `Request failed with status ${response.status}`)

  if (shouldRecoverSessionFromApiError(response.status, session, message)) {
    dispatchSessionExpired(path, message, response.status)
  }

  throw new ApiError(response.status, message)
}

function dispatchSessionExpired(path: string, message: string, status: number) {
  clearClientBearerSession()
  writeBrowserSessionCsrfToken('')
  window.dispatchEvent(
    new CustomEvent<SessionExpiredDetail>(SESSION_EXPIRED_EVENT, {
      detail: {
        path,
        message,
        status,
      },
    }),
  )
}

async function parseJsonResponse<T>(
  response: Response,
  path: string,
  context: ApiRequestContext,
): Promise<T> {
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.toLowerCase().includes('application/json')) {
    await response.text()
    emitResponseFailureDiagnostic(response, path, context, 'non_json', 'API returned a non-JSON response')
    throw new ApiError(
      response.status,
      `API returned a non-JSON response for ${path}. Check VITE_API_BASE_URL or the staging API rewrite.`,
    )
  }

  try {
    return (await response.json()) as T
  } catch (error) {
    emitResponseFailureDiagnostic(response, path, context, 'non_json', 'API returned invalid JSON')
    throw error
  }
}

function emitResponseFailureDiagnostic(
  response: Response,
  path: string,
  context: ApiRequestContext,
  errorCategory: ApiFailureCategory,
  errorMessage: string,
) {
  emitApiFailureDiagnostic({
    path,
    method: context.method,
    status: response.status,
    durationMs: context.durationMs,
    requestAttempt: context.requestAttempt,
    errorCategory,
    errorMessage,
    requestId: getRequestIdFromHeaders(response.headers),
  })
}

function getCurrentTimeMs() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now()
}

function getNetworkFailureMessage(error: unknown) {
  if (error instanceof Error && error.name.trim()) {
    return `Network request failed (${error.name})`
  }

  return 'Network request failed'
}

function assertBrowserSessionCsrfAvailable(session: SessionState, path: string, method: JsonMethod) {
  if (!isUnsafeMethod(method) || !isCookieBrowserSession(session) || readBrowserSessionCsrfToken()) {
    return
  }

  const message = 'Cookie session requires a fresh CSRF token. Sign in again and retry the request.'

  if (typeof window !== 'undefined') {
    clearClientBearerSession()
    window.dispatchEvent(
      new CustomEvent<SessionExpiredDetail>(SESSION_EXPIRED_EVENT, {
        detail: {
          path,
          message,
          status: 401,
        },
      }),
    )
  }

  throw new ApiError(401, message)
}

function isUnsafeMethod(method: JsonMethod) {
  return method !== 'GET'
}
