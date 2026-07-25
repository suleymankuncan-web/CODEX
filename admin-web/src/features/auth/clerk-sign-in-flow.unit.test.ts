import { describe, expect, it } from 'vitest'
import {
  finalizeClerkSignIn,
  readClerkErrorCode,
  restartClerkSignIn,
  resolveClerkAppSessionHandoffView,
  resolveClerkCompletionView,
  resolveClerkSignInView,
  resolveClerkSignInError,
} from './clerk-sign-in-flow'

describe('Clerk custom sign-in flow', () => {
  it('keeps the provider handoff passive only while app-session verification is active', () => {
    expect(resolveClerkAppSessionHandoffView('verifying')).toBe('verifying')
    expect(resolveClerkAppSessionHandoffView('setup-required')).toBe('recover')
    expect(resolveClerkAppSessionHandoffView('rejected')).toBe('recover')
  })

  it('clears the app session before provider sign-out', async () => {
    const calls: string[] = []
    const outcome = await restartClerkSignIn({
      clearAppSession: async () => { calls.push('clear-app-session') },
      signOutProvider: async () => { calls.push('sign-out-provider') },
    })

    expect(outcome).toBe('complete')
    expect(calls).toEqual(['clear-app-session', 'sign-out-provider'])
  })

  it('fails closed when app cleanup or provider sign-out fails', async () => {
    let providerSignOutCalls = 0
    const cleanupFailure = await restartClerkSignIn({
      clearAppSession: async () => { throw new Error('cleanup failed') },
      signOutProvider: async () => { providerSignOutCalls += 1 },
    })
    const providerFailure = await restartClerkSignIn({
      clearAppSession: async () => undefined,
      signOutProvider: async () => { throw new Error('provider sign-out failed') },
    })

    expect(cleanupFailure).toBe('failed')
    expect(providerSignOutCalls).toBe(0)
    expect(providerFailure).toBe('failed')
  })

  it('starts with identifier collection', () => {
    expect(resolveClerkSignInView({
      status: 'needs_identifier',
      firstFactorStrategies: [],
      secondFactorStrategies: [],
    })).toBe('identifier')
  })

  it('allows only the configured password first factor', () => {
    expect(resolveClerkSignInView({
      status: 'needs_first_factor',
      firstFactorStrategies: ['password'],
      secondFactorStrategies: [],
    })).toBe('password')

    expect(resolveClerkSignInView({
      status: 'needs_first_factor',
      firstFactorStrategies: ['passkey'],
      secondFactorStrategies: [],
    })).toBe('unsupported')
  })

  it.each(['needs_second_factor', 'needs_client_trust'] as const)(
    'uses email code for %s and fails closed for other factors',
    (status) => {
      expect(resolveClerkSignInView({
        status,
        firstFactorStrategies: ['password'],
        secondFactorStrategies: ['email_code'],
      })).toBe('email-code')

      expect(resolveClerkSignInView({
        status,
        firstFactorStrategies: ['password'],
        secondFactorStrategies: ['totp'],
      })).toBe('unsupported')
    },
  )

  it('allows finalization only for complete attempts', () => {
    expect(resolveClerkSignInView({
      status: 'complete',
      firstFactorStrategies: ['password'],
      secondFactorStrategies: [],
    })).toBe('complete')

    expect(resolveClerkSignInView({
      status: 'needs_new_password',
      firstFactorStrategies: ['password'],
      secondFactorStrategies: [],
    })).toBe('unsupported')
  })

  it('maps provider failures to non-enumerating application messages', () => {
    expect(resolveClerkSignInError('form_identifier_not_found')).toBe('credentials')
    expect(resolveClerkSignInError('form_password_incorrect')).toBe('credentials')
    expect(resolveClerkSignInError('form_code_incorrect')).toBe('verification')
    expect(resolveClerkSignInError('unknown_provider_error')).toBe('generic')
  })

  it('prefers the nested Clerk API error code over its generic wrapper', () => {
    expect(readClerkErrorCode({
      code: 'api_response_error',
      errors: [{ code: 'form_password_incorrect' }],
    })).toBe('form_password_incorrect')
  })

  it('keeps finalize failure visible and recoverable after Clerk completes', () => {
    expect(resolveClerkCompletionView('complete', 'finalizing')).toBe('finalizing')
    expect(resolveClerkCompletionView('complete', 'failed')).toBe('finalize-failed')
  })

  it('accepts only an active Clerk session without pending tasks', async () => {
    const active = await finalizeClerkSignIn(async ({ navigate }) => {
      await navigate({ session: { status: 'active' } })
      return { error: null }
    })
    const pending = await finalizeClerkSignIn(async ({ navigate }) => {
      await navigate({ session: { status: 'pending', currentTask: { key: 'choose-organization' } } })
      return { error: null }
    })
    const failed = await finalizeClerkSignIn(async () => ({ error: new Error('activation failed') }))

    expect(active).toBe('active')
    expect(pending).toBe('failed')
    expect(failed).toBe('failed')
  })
})
