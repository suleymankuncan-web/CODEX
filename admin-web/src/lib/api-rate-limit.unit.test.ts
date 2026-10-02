import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from './api-error'
import { apiErrorFromResponse, assertApiRateLimitReady, getRateLimitErrorMessage, getRateLimitRemainingSeconds } from './api-rate-limit'
import { getErrorMessage, getUserFacingErrorMessage } from './format'
import { notificationErrorMessage } from './notification-messages'

const now = Date.parse('2026-10-02T20:00:00Z')
describe('rate-limit cooldown metadata and presentation', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(now) })
  afterEach(() => { vi.advanceTimersByTime(3_600_001); assertApiRateLimitReady(); vi.useRealTimers() })

  it.each([
    [{ 'Retry-After': '7' }, 7],
    [{ 'Retry-After': 'Fri, 02 Oct 2026 20:00:09 GMT' }, 9],
    [{ 'X-RateLimit-Reset': '2026-10-02T20:00:11Z' }, 11],
    [{ 'Retry-After': 'garbage' }, 60],
    [{ 'Retry-After': '-1' }, 60],
    [{ 'Retry-After': '0' }, 1],
    [{ 'Retry-After': '99999999999999999' }, 3600],
    [{}, 60],
  ])('interprets only bounded cooldowns from %j', (headers, seconds) => {
    const error = apiErrorFromResponse(new Response('', { status: 429, headers }), 'Rate limit exceeded')
    expect(error.retryAt).toBe(now + seconds * 1000)
    expect(getRateLimitRemainingSeconds(error)).toBe(seconds)
    expect(() => assertApiRateLimitReady()).toThrow(ApiError)
    vi.advanceTimersByTime(seconds * 1000)
    expect(() => assertApiRateLimitReady()).not.toThrow()
  })

  it('handles server clock skew and prefers its Retry-After duration', () => {
    const error = apiErrorFromResponse(new Response('', { status: 429, headers: {
      Date: 'Fri, 02 Oct 2026 19:50:00 GMT', 'Retry-After': 'Fri, 02 Oct 2026 19:50:10 GMT',
    } }), 'Rate limit exceeded')
    expect(error.retryAt).toBe(now + 10_000)
  })

  it('does not shorten a longer cooldown when concurrent responses finish out of order', () => {
    apiErrorFromResponse(new Response('', { status: 429, headers: { 'Retry-After': '12' } }), 'limited')
    const error = apiErrorFromResponse(new Response('', { status: 429, headers: { 'Retry-After': '2' } }), 'limited')
    expect(getRateLimitRemainingSeconds(error)).toBe(12)
  })

  it('localizes rate errors across page errors and mutation notifications without exposing server text', () => {
    const error = new ApiError(429, 'Rate limit exceeded /api/private', now + 8000)
    for (const copy of [getErrorMessage(error), getUserFacingErrorMessage(error, 'Fallback'), notificationErrorMessage(error, 'Fallback')]) {
      expect(copy).toContain('8 saniye'); expect(copy).not.toContain('/api/'); expect(copy).not.toContain('Rate limit')
    }
    expect(getRateLimitErrorMessage(error, 'en')).toContain('Wait 8 seconds')
    expect(getRateLimitErrorMessage(new ApiError(403, 'Forbidden'))).toBeNull()
  })

  it('keeps non-rate failures and authorization errors unchanged', () => {
    const error = apiErrorFromResponse(new Response('', { status: 403, headers: { 'Retry-After': '9' } }), 'Forbidden')
    expect(error).toMatchObject({ status: 403, message: 'Forbidden', retryAt: null })
    expect(() => assertApiRateLimitReady()).not.toThrow()
  })

  it('preserves cancellation instead of presenting an abandoned request as a new rate error', () => {
    apiErrorFromResponse(new Response('', { status: 429, headers: { 'Retry-After': '7' } }), 'limited')
    const controller = new AbortController(); controller.abort()
    expect(() => assertApiRateLimitReady(controller.signal)).toThrowError(expect.objectContaining({ name: 'AbortError' }))
  })
})
