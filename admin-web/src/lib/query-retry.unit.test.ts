import { describe, expect, it } from 'vitest'
import { ApiError } from './api'
import { transientQueryRetryOptions } from './query-retry'

describe('transient query retry policy', () => {
  it.each([401, 403])('does not retry terminal permission status %s', (status) => {
    expect(transientQueryRetryOptions.retry(0, new ApiError(status, 'permission denied'))).toBe(false)
  })

  it.each([408, 429, 500, 503])('retries transient HTTP status %s', (status) => {
    expect(transientQueryRetryOptions.retry(0, new ApiError(status, 'temporary failure'))).toBe(true)
  })

  it('caps transient and network retries at two retries', () => {
    const apiError = new ApiError(503, 'temporary failure')
    const networkError = new TypeError('network failure')

    expect(transientQueryRetryOptions.retry(0, apiError)).toBe(true)
    expect(transientQueryRetryOptions.retry(1, apiError)).toBe(true)
    expect(transientQueryRetryOptions.retry(2, apiError)).toBe(false)
    expect(transientQueryRetryOptions.retry(0, networkError)).toBe(true)
    expect(transientQueryRetryOptions.retry(1, networkError)).toBe(true)
    expect(transientQueryRetryOptions.retry(2, networkError)).toBe(false)
  })
})
