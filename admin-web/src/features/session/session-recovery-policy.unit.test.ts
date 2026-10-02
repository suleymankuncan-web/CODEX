import { describe, expect, it } from 'vitest'
import { ApiError } from '../../lib/api-error'
import { canRetrySessionRead } from './session-recovery-policy'

describe('manual shell session recovery', () => {
  it.each([429, 500, 503])('allows a fresh read after transient status %s', (status) => {
    expect(canRetrySessionRead(new ApiError(status, 'temporary'))).toBe(true)
  })

  it.each([400, 401, 403, 404, 409])('keeps status %s outside transient recovery', (status) => {
    expect(canRetrySessionRead(new ApiError(status, 'rejected'))).toBe(false)
  })

  it('allows a network failure without classifying unknown failures as recoverable', () => {
    expect(canRetrySessionRead(new TypeError('Failed to fetch'))).toBe(true)
    expect(canRetrySessionRead(new Error('Unexpected failure'))).toBe(false)
    expect(canRetrySessionRead(null)).toBe(false)
  })
})
