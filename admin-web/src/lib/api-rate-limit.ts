import { ApiError } from './api-error'

const MAX_COOLDOWN_MS = 3_600_000
const FALLBACK_COOLDOWN_MS = 60_000
let cooldownUntil = 0

export function getRateLimitRemainingSeconds(error: unknown, now = Date.now()) {
  if (!(error instanceof ApiError) || error.status !== 429 || !Number.isFinite(error.retryAt)) return 0
  return Math.max(0, Math.ceil(((error.retryAt ?? now) - now) / 1000))
}

export function getRateLimitErrorMessage(error: unknown, locale: 'tr' | 'en' = 'tr', now = Date.now()) {
  if (!(error instanceof ApiError) || error.status !== 429) return null
  const seconds = getRateLimitRemainingSeconds(error, now)
  return locale === 'tr'
    ? `Kısa sürede çok fazla işlem yapıldı. ${seconds > 0 ? `${seconds} saniye bekleyip` : 'Biraz bekleyip'} tekrar deneyin. Sayfayı açık tutabilirsiniz.`
    : `Too many actions in a short time. ${seconds > 0 ? `Wait ${seconds} seconds and try again.` : 'Wait a moment and try again.'} You can keep this page open.`
}

function responseRetryAt(headers: Headers, now: number) {
  const retry = headers.get('Retry-After')?.trim()
  const serverNow = Date.parse(headers.get('Date') ?? '')
  const base = Number.isFinite(serverNow) ? serverNow : now
  let delay = retry && /^\d+$/.test(retry) ? Number(retry) * 1000 : NaN
  if (!Number.isFinite(delay) && retry) delay = Date.parse(retry) - base
  if (!Number.isFinite(delay)) delay = Date.parse(headers.get('X-RateLimit-Reset') ?? '') - base
  if (!Number.isFinite(delay) || delay < 0) delay = FALLBACK_COOLDOWN_MS
  return now + Math.max(1000, Math.min(delay, MAX_COOLDOWN_MS))
}

export function apiErrorFromResponse(response: Response, message: string) {
  if (response.status !== 429) return new ApiError(response.status, message)
  const retryAt = responseRetryAt(response.headers, Date.now())
  cooldownUntil = Math.max(cooldownUntil, retryAt)
  const error = new ApiError(429, message, cooldownUntil)
  return new ApiError(429, getRateLimitErrorMessage(error)!, cooldownUntil)
}

// The server's IP limit remains authoritative. During its announced cooldown,
// fail visibly instead of flooding it again; never queue or replay a write.
export function assertApiRateLimitReady(signal?: AbortSignal | null) {
  if (signal?.aborted) throw signal.reason ?? new DOMException('Request aborted', 'AbortError')
  if (Date.now() >= cooldownUntil) { cooldownUntil = 0; return }
  const error = new ApiError(429, '', cooldownUntil)
  throw new ApiError(429, getRateLimitErrorMessage(error)!, cooldownUntil)
}
