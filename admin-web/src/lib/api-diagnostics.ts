export type ApiFailureCategory = 'http' | 'network' | 'non_json' | 'unknown'

export type ApiFailureDiagnostic = {
  event: 'api.failure'
  route: string
  method: string
  path: string
  queryKeys: string[]
  status: number | null
  durationMs: number
  retryable: boolean
  requestAttempt: number
  errorCategory: ApiFailureCategory
  errorMessage: string
  requestId: string | null
  occurredAt: string
}

export type ApiFailureDiagnosticInput = {
  path: string
  method: string
  status: number | null
  durationMs: number
  requestAttempt: number
  errorCategory: ApiFailureCategory
  errorMessage: string
  requestId: string | null
}

declare global {
  interface Window {
    __STORE_OPS_API_FAILURES__?: ApiFailureDiagnostic[]
  }
}

const API_FAILURE_EVENT_NAME = 'store-ops-api-failure'
const API_FAILURE_LOG_PREFIX = '[store-ops:api-failure]'
const API_FAILURE_RING_LIMIT = 20
const REQUEST_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/=-]{0,127}$/

export function emitApiFailureDiagnostic(input: ApiFailureDiagnosticInput) {
  const diagnostic = buildApiFailureDiagnostic(input)

  if (typeof window === 'undefined') {
    return diagnostic
  }

  window.__STORE_OPS_API_FAILURES__ = [
    ...(window.__STORE_OPS_API_FAILURES__ ?? []),
    diagnostic,
  ].slice(-API_FAILURE_RING_LIMIT)

  console.warn(API_FAILURE_LOG_PREFIX, diagnostic)
  window.dispatchEvent(new CustomEvent(API_FAILURE_EVENT_NAME, { detail: diagnostic }))

  return diagnostic
}

function buildApiFailureDiagnostic(input: ApiFailureDiagnosticInput): ApiFailureDiagnostic {
  const sanitizedApiPath = sanitizeUrlParts(input.path)

  return {
    event: 'api.failure',
    route: getCurrentSanitizedRoute(),
    method: input.method.toUpperCase(),
    path: sanitizedApiPath.path,
    queryKeys: sanitizedApiPath.queryKeys,
    status: input.status,
    durationMs: Math.max(0, Math.round(input.durationMs)),
    retryable: isRetryableFailure(input.status, input.errorCategory),
    requestAttempt: Math.max(1, input.requestAttempt),
    errorCategory: input.errorCategory,
    errorMessage: sanitizeErrorMessage(input.errorMessage),
    requestId: sanitizeRequestId(input.requestId),
    occurredAt: new Date().toISOString(),
  }
}

export function getRequestIdFromHeaders(headers: Headers) {
  return sanitizeRequestId(
    headers.get('x-request-id') ||
    headers.get('x-correlation-id') ||
    headers.get('traceparent') ||
    null,
  )
}

function getCurrentSanitizedRoute() {
  if (typeof window === 'undefined') {
    return ''
  }

  const { pathname, search } = window.location
  return formatSanitizedUrlParts(sanitizeUrlParts(`${pathname}${search}`))
}

function sanitizeUrlParts(value: string) {
  const parsed = parseUrl(value)
  const queryKeys = Array.from(parsed.searchParams.keys()).sort()

  return {
    path: sanitizePathname(parsed.pathname),
    queryKeys,
  }
}

function parseUrl(value: string) {
  try {
    return new URL(value, 'https://store-ops.local')
  } catch {
    return new URL('/', 'https://store-ops.local')
  }
}

function formatSanitizedUrlParts(input: { path: string; queryKeys: string[] }) {
  if (input.queryKeys.length === 0) {
    return input.path
  }

  return `${input.path}?${input.queryKeys.map((key) => `${encodeURIComponent(key)}=:value`).join('&')}`
}

function sanitizePathname(pathname: string) {
  return pathname
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi, ':uuid')
    .replace(/\b\d{6,}\b/g, ':id')
}

function sanitizeErrorMessage(message: string) {
  return message.trim() || 'API request failed'
}

function sanitizeRequestId(value: string | null) {
  const normalized = value?.trim()

  if (!normalized || !REQUEST_ID_PATTERN.test(normalized)) {
    return null
  }

  return normalized
}

function isRetryableFailure(status: number | null, category: ApiFailureCategory) {
  if (category === 'network') {
    return true
  }

  if (status === null) {
    return false
  }

  return status === 408 || status === 429 || status >= 500
}
