import * as Sentry from '@sentry/react'
import type { ErrorEvent, Exception, StackFrame, Stacktrace } from '@sentry/react'

type FrontendCaptureContext = {
  event: string
  source: string
  severity?: 'error' | 'warning'
}

const maxTextLength = 1000
const maxTagLength = 200
let initialized = false
let listenersInstalled = false

export function initializeFrontendSentry() {
  if (initialized) return true

  const dsn = import.meta.env.VITE_SENTRY_DSN?.trim()
  const enabled = import.meta.env.VITE_SENTRY_ENABLED?.trim().toLowerCase() === 'true'

  if (!dsn || !enabled) return false

  try {
    Sentry.init({
      dsn,
      enabled: true,
      environment:
        import.meta.env.VITE_SENTRY_ENVIRONMENT?.trim() ||
        (import.meta.env.PROD ? 'production' : 'development'),
      release: import.meta.env.VITE_SENTRY_RELEASE?.trim() || undefined,
      sendDefaultPii: false,
      sendClientReports: false,
      defaultIntegrations: [],
      maxBreadcrumbs: 0,
      tracesSampleRate: 0,
      profilesSampleRate: 0,
      beforeSend: sanitizeSentryEvent,
    })
    initialized = true
    installGlobalErrorListeners()
    return true
  } catch (error) {
    console.warn(
      JSON.stringify({
        event: 'observability.frontend.initialization_failed',
        reason: sanitizeText(error),
      }),
    )
    return false
  }
}

export function captureFrontendException(
  error: unknown,
  context: FrontendCaptureContext,
) {
  if (!initialized) return false

  try {
    Sentry.withScope((scope) => {
      scope.setLevel(context.severity ?? 'error')
      scope.setTag('runtime', 'frontend')
      scope.setTag('event', safeTag(context.event))
      scope.setTag('source', safeTag(context.source))
      Sentry.captureException(createSafeError(error))
    })
    return true
  } catch (captureError) {
    console.warn(
      JSON.stringify({
        event: 'observability.frontend.capture_failed',
        reason: sanitizeText(captureError),
      }),
    )
    return false
  }
}

export function sanitizeSentryEvent(event: ErrorEvent): ErrorEvent {
  const safe = { ...event } as ErrorEvent & Record<string, unknown>

  delete safe.request
  delete safe.user
  delete safe.breadcrumbs
  delete safe.extra
  delete safe.contexts

  if (typeof safe.message === 'string') {
    safe.message = sanitizeText(safe.message)
  }

  const exception = safe.exception as
    | { values?: Array<Record<string, unknown>> }
    | undefined
  if (exception?.values) {
    safe.exception = {
      values: exception.values.map<Exception>((value) => {
        const safeValue: Exception = {
          type: sanitizeText(value.type),
          value: sanitizeText(value.value),
        }
        const stacktrace = sanitizeStacktrace(value.stacktrace)
        if (stacktrace) safeValue.stacktrace = stacktrace
        return safeValue
      }),
    }
  }

  if (safe.tags && typeof safe.tags === 'object') {
    safe.tags = Object.fromEntries(
      Object.entries(safe.tags as Record<string, unknown>).map(([key, value]) => [
        key,
        safeTag(value),
      ]),
    )
  }

  return safe
}

function installGlobalErrorListeners() {
  if (listenersInstalled || typeof window === 'undefined') return
  listenersInstalled = true

  window.addEventListener('error', (event) => {
    captureFrontendException(event.error ?? new Error(event.message), {
      event: 'window.error',
      source: 'window.error',
    })
  })

  window.addEventListener('unhandledrejection', (event) => {
    captureFrontendException(event.reason, {
      event: 'window.unhandled_rejection',
      source: 'window.unhandledrejection',
    })
  })
}

function createSafeError(error: unknown) {
  const originalMessage = error instanceof Error ? error.message : String(error)
  const safeError = new Error(sanitizeText(originalMessage))

  if (error instanceof Error) {
    safeError.name = sanitizeText(error.name)
    if (error.stack) safeError.stack = sanitizeText(error.stack)
  }

  return safeError
}

function sanitizeStacktrace(value: unknown): Stacktrace | undefined {
  if (!value || typeof value !== 'object') return undefined

  const frames = (value as { frames?: unknown }).frames
  if (!Array.isArray(frames)) return undefined

  return {
    frames: frames.map<StackFrame>((frame) => {
      if (!frame || typeof frame !== 'object') return {}

      const source = frame as Record<string, unknown>
      const safeFrame: StackFrame = {
        filename: sanitizeText(source.filename),
        function: sanitizeText(source.function),
        module: sanitizeText(source.module),
      }
      if (typeof source.lineno === 'number') safeFrame.lineno = source.lineno
      if (typeof source.colno === 'number') safeFrame.colno = source.colno
      return safeFrame
    }),
  }
}

function sanitizeText(value: unknown) {
  const text = typeof value === 'string' ? value : String(value ?? 'unknown')

  return text
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [redacted]')
    .replace(/\b(?:postgres(?:ql)?|rediss?):\/\/[^\s"'<>]+/gi, '[redacted-url]')
    .replace(
      /["']?\b(authorization|client_secret|password|pwd|refresh_token|secret|token)\b["']?\s*[=:]\s*("[^"]*"|'[^']*'|[^;\s&,}]+)/gi,
      '$1=[redacted]',
    )
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[redacted-email]')
    .replace(/\b(?:\+?\d[\d\s().-]{7,}\d)\b/g, '[redacted-phone]')
    .slice(0, maxTextLength)
}

function safeTag(value: unknown) {
  return sanitizeText(value).slice(0, maxTagLength)
}
