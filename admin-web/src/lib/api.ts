import {
  buildSessionHeaders,
  clearClientBearerSession,
  readClientSession,
} from '../features/session/session-storage'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? '/api'

type JsonMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE'

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

  const response = await fetch(`${apiBaseUrl}${path}`, {
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

  return response.json() as Promise<T>
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

  const response = await fetch(`${apiBaseUrl}${path}`, {
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

  return response.json() as Promise<T>
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
