import { describe, expect, it } from 'vitest'
import {
  resolveSafeSessionStatus,
  resolveSessionReadinessDisplayPolicy,
} from './session-readiness-display-policy'

describe('session readiness display policy', () => {
  it('keeps the editor and credential preview development-only', () => {
    expect(resolveSessionReadinessDisplayPolicy(true)).toEqual({
      canEditSession: true,
      canPreviewCredentials: true,
      canVerifyCurrentSession: true,
    })
    expect(resolveSessionReadinessDisplayPolicy(false)).toEqual({
      canEditSession: false,
      canPreviewCredentials: false,
      canVerifyCurrentSession: true,
    })
  })

  it('reduces stored session state to safe non-secret status labels', () => {
    expect(
      resolveSafeSessionStatus({ mode: 'bearer', browserSessionTransport: 'cookie' }),
    ).toEqual({ mode: 'provider', transport: 'browser_cookie' })
    expect(
      resolveSafeSessionStatus({ mode: 'bearer', browserSessionTransport: 'bearer' }),
    ).toEqual({ mode: 'provider', transport: 'provider_bearer' })
    expect(
      resolveSafeSessionStatus({ mode: 'mock', browserSessionTransport: 'bearer' }),
    ).toEqual({ mode: 'local', transport: 'local_headers' })
  })
})
