import {
  buildSessionHeaders,
  clearClientBearerSession,
  readClientSession,
} from '../features/session/session-storage'

const DEFAULT_API_BASE_URL = '/api'
const STAGING_HOST_API_BASE_URL = 'https://api-staging.hr-axis.com/api'
const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim() || DEFAULT_API_BASE_URL

type JsonMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

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

async function requestJson<T>(path: string, input?: { method?: JsonMethod; body?: unknown }): Promise<T> {
  const session = readClientSession()
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...buildSessionHeaders(session),
  }

  if (input?.body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }

  const response = await fetch(`${resolveApiBaseUrl()}${path}`, {
    method: input?.method ?? 'GET',
    headers,
    body: input?.body !== undefined ? JSON.stringify(input.body) : undefined,
  })

  if (!response.ok) {
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

  return parseJsonResponse<T>(response, path)
}

async function requestFormData<T>(
  path: string,
  input: {
    method: Exclude<JsonMethod, 'GET'>
    body: FormData
  },
): Promise<T> {
  const session = readClientSession()
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...buildSessionHeaders(session),
  }

  const response = await fetch(`${resolveApiBaseUrl()}${path}`, {
    method: input.method,
    headers,
    body: input.body,
  })

  if (!response.ok) {
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
