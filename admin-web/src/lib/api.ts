import {
  buildSessionHeaders,
  clearClientBearerSession,
  isBearerTokenExpiringSoon,
  readClientSession,
  writeClientBearerSession,
} from '../features/session/session-storage'
import type { SessionState } from '../features/session/session-storage'

const DEFAULT_API_BASE_URL = '/api'
const STAGING_HOST_API_BASE_URL = 'https://api-staging.hr-axis.com/api'
const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim() || DEFAULT_API_BASE_URL

type JsonMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
type BearerTokenRefreshHandler = (input?: { skipCache?: boolean }) => Promise<string | null>

let bearerTokenRefreshHandler: BearerTokenRefreshHandler | null = null
let bearerTokenRefreshPromise: Promise<string | null> | null = null

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

export function registerBearerTokenRefreshHandler(handler: BearerTokenRefreshHandler) {
  bearerTokenRefreshHandler = handler

  return () => {
    if (bearerTokenRefreshHandler === handler) {
      bearerTokenRefreshHandler = null
    }
  }
}

async function requestJson<T>(path: string, input?: { method?: JsonMethod; body?: unknown }): Promise<T> {
  const body = input?.body !== undefined ? JSON.stringify(input.body) : undefined
  const prepared = await prepareHeaders(input?.body !== undefined)

  let response = await fetch(`${resolveApiBaseUrl()}${path}`, {
    method: input?.method ?? 'GET',
    headers: prepared.headers,
    body,
  })

  if (response.status === 401 && prepared.session.mode === 'bearer') {
    const retryHeaders = await prepareRefreshedHeaders(input?.body !== undefined, { skipCache: true })
    if (retryHeaders) {
      response = await fetch(`${resolveApiBaseUrl()}${path}`, {
        method: input?.method ?? 'GET',
        headers: retryHeaders,
        body,
      })
    }
  }

  if (!response.ok) {
    await throwApiError(response, path, prepared.session)
  }

  return parseJsonResponse<T>(response, path)
}

async function requestFormData<T>(
  path: string,
  input: {
    method: Exclude<JsonMethod, 'GET'>
    body: FormData
  },
): Promise<T> {
  const prepared = await prepareHeaders(false)

  let response = await fetch(`${resolveApiBaseUrl()}${path}`, {
    method: input.method,
    headers: prepared.headers,
    body: input.body,
  })

  if (response.status === 401 && prepared.session.mode === 'bearer') {
    const retryHeaders = await prepareRefreshedHeaders(false, { skipCache: true })
    if (retryHeaders) {
      response = await fetch(`${resolveApiBaseUrl()}${path}`, {
        method: input.method,
        headers: retryHeaders,
        body: input.body,
      })
    }
  }

  if (!response.ok) {
    await throwApiError(response, path, prepared.session)
  }

  return parseJsonResponse<T>(response, path)
}

export async function fetchJson<T>(path: string): Promise<T> {
  return requestJson<T>(path)
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

async function prepareHeaders(hasJsonBody: boolean) {
  const session = readClientSession()
  const headers = buildRequestHeaders(session, hasJsonBody)

  if (session.mode !== 'bearer') {
    return { session, headers }
  }

  if (headers.Authorization && !isBearerTokenExpiringSoon(session.bearerToken)) {
    return { session, headers }
  }

  const refreshedHeaders = await prepareRefreshedHeaders(hasJsonBody, { skipCache: true })
  if (!refreshedHeaders) {
    return { session, headers }
  }

  return {
    session: readClientSession(),
    headers: refreshedHeaders,
  }
}

function buildRequestHeaders(session: SessionState, hasJsonBody: boolean) {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...buildSessionHeaders(session),
  }

  if (hasJsonBody) {
    headers['Content-Type'] = 'application/json'
  }

  return headers
}

async function prepareRefreshedHeaders(hasJsonBody: boolean, input?: { skipCache?: boolean }) {
  const refreshedToken = await refreshBearerToken(input)
  if (!refreshedToken) {
    return null
  }

  const refreshedSession = readClientSession()
  const headers = buildRequestHeaders(refreshedSession, hasJsonBody)
  return headers.Authorization ? headers : null
}

async function refreshBearerToken(input?: { skipCache?: boolean }) {
  if (!bearerTokenRefreshHandler) {
    return null
  }

  if (!bearerTokenRefreshPromise) {
    bearerTokenRefreshPromise = bearerTokenRefreshHandler({ skipCache: Boolean(input?.skipCache) })
      .then((result) => {
        const token = result?.trim() ?? ''
        if (!token) {
          return null
        }

        writeClientBearerSession(token)
        return token
      })
      .catch(() => null)
      .finally(() => {
        bearerTokenRefreshPromise = null
      })
  }

  try {
    const token = await bearerTokenRefreshPromise
    if (!token) {
      return null
    }

    return token
  } catch {
    return null
  }
}

async function throwApiError(response: Response, path: string, session: SessionState): Promise<never> {
  const fallbackText = await response.text()
  const message = fallbackText || `Request failed with status ${response.status}`

  if (response.status === 401 && session.mode === 'bearer' && typeof window !== 'undefined') {
    clearClientBearerSession()
    window.dispatchEvent(
      new CustomEvent<SessionExpiredDetail>(SESSION_EXPIRED_EVENT, {
        detail: {
          path,
          message,
          status: response.status,
        },
      }),
    )
  }

  throw new ApiError(response.status, message)
}

async function parseJsonResponse<T>(response: Response, path: string): Promise<T> {
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.toLowerCase().includes('application/json')) {
    const body = await response.text()
    throw new ApiError(
      response.status,
      `API returned a non-JSON response for ${path}. Check VITE_API_BASE_URL or the staging API rewrite. ${body.slice(0, 160)}`,
    )
  }

  return response.json() as Promise<T>
}
