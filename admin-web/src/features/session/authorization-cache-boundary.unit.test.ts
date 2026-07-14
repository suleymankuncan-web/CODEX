import { describe, expect, it } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import type { AuthSessionSummary } from '../auth/api'
import {
  buildEffectiveAuthorizationFingerprint,
  isolateAuthorizationCache,
  resolveEffectiveAuthorizationFingerprint,
  shouldRefreshShellSessionForBearerRenewal,
} from './authorization-cache-boundary'

function session(input?: {
  userId?: string
  roleCodes?: string[]
  readStoreIds?: string[]
  legacyAssignedStoreIds?: string[]
  displayName?: string
  email?: string
  authorizationContextVersion?: string
}): AuthSessionSummary {
  return {
    authMode: 'bearer',
    authenticated: true,
    user: {
      userId: input?.userId ?? 'user-a',
      employeeId: null,
      displayName: input?.displayName ?? 'Sanitized Person',
      username: 'sanitized.user',
      email: input?.email ?? 'sanitized@example.invalid',
      roleCodes: input?.roleCodes ?? ['STORE_MANAGER', 'REPORT_VIEWER'],
      authorizationContextVersion: input?.authorizationContextVersion ?? 'v1:baseline',
      scope: {
        companyIds: ['company-a'],
        regionIds: ['region-b', 'region-a'],
        storeIds: ['store-b', 'store-a'],
      },
      readScope: {
        companyIds: ['company-a'],
        regionIds: ['region-b', 'region-a'],
        storeIds: input?.readStoreIds ?? ['store-b', 'store-a'],
      },
      actionScope: {
        assignedStoreIds: ['store-b', 'store-a'],
        assignedStoreTypes: ['franchise', 'company'],
      },
      assignedStoreIds: input?.legacyAssignedStoreIds ?? ['store-b', 'store-a'],
    },
    scopeSummary: {
      companyCount: 1,
      regionCount: 2,
      storeCount: 2,
      assignedStoreCount: 2,
    },
  }
}

describe('effective authorization fingerprint', () => {
  it('is order-independent and changes with effective identity or authority', () => {
    const baseline = buildEffectiveAuthorizationFingerprint(session())
    const reordered = buildEffectiveAuthorizationFingerprint(
      session({
        roleCodes: ['REPORT_VIEWER', 'STORE_MANAGER'],
        readStoreIds: ['store-a', 'store-b'],
      }),
    )

    expect(reordered).toBe(baseline)
    expect(buildEffectiveAuthorizationFingerprint(session({ userId: 'user-b' }))).not.toBe(
      baseline,
    )
    expect(buildEffectiveAuthorizationFingerprint(session({ roleCodes: ['STORE_MANAGER'] }))).not.toBe(
      baseline,
    )
    expect(buildEffectiveAuthorizationFingerprint(session({ readStoreIds: ['store-a'] }))).not.toBe(
      baseline,
    )
  })

  it('removes prior protected query and mutation state but preserves public and active shell data', async () => {
    const queryClient = new QueryClient()
    const activeShellSessionQueryKey = ['shell-session', 'bearer', 'cookie', 'user-b']

    queryClient.setQueryData(['store-kpis-live'], { marker: 'user-a-protected' })
    queryClient.setQueryData(['shell-session', 'bearer', 'cookie', 'user-a'], session())
    queryClient.setQueryData(activeShellSessionQueryKey, session({ userId: 'user-b' }))
    queryClient.setQueryData(['auth-bootstrap'], { provider: 'sanitized' })
    queryClient.getMutationCache().build(queryClient, {
      mutationKey: ['store-action-plan', 'user-a'],
      mutationFn: async () => ({ ok: true }),
    })

    await isolateAuthorizationCache({ queryClient, activeShellSessionQueryKey })

    expect(queryClient.getQueryData(['store-kpis-live'])).toBeUndefined()
    expect(
      queryClient.getQueryData(['shell-session', 'bearer', 'cookie', 'user-a']),
    ).toBeUndefined()
    expect(queryClient.getQueryData(activeShellSessionQueryKey)).toEqual(
      session({ userId: 'user-b' }),
    )
    expect(queryClient.getQueryData(['auth-bootstrap'])).toEqual({ provider: 'sanitized' })
    expect(queryClient.getMutationCache().getAll()).toHaveLength(0)
  })

  it('changes when role partitions change even if aggregate scopes stay identical', () => {
    const baseline = buildEffectiveAuthorizationFingerprint(session({ authorizationContextVersion: `v1:${'a'.repeat(64)}` }))
    const repartitioned = buildEffectiveAuthorizationFingerprint(session({ authorizationContextVersion: `v1:${'b'.repeat(64)}` }))
    expect(repartitioned).not.toBe(baseline)
  })

  it('refreshes the shell once only for a renewed raw token under the same bearer identity key', () => {
    const baseline = {
      mode: 'bearer' as const,
      browserSessionTransport: 'bearer' as const,
      previousToken: 'token-a',
      currentToken: 'token-b',
      previousSessionKey: 'identity:stable-user',
      currentSessionKey: 'identity:stable-user',
    }

    expect(shouldRefreshShellSessionForBearerRenewal(baseline)).toBe(true)
    expect(
      shouldRefreshShellSessionForBearerRenewal({
        ...baseline,
        currentSessionKey: 'identity:different-user',
      }),
    ).toBe(false)
    expect(
      shouldRefreshShellSessionForBearerRenewal({
        ...baseline,
        browserSessionTransport: 'cookie',
      }),
    ).toBe(false)
    expect(
      shouldRefreshShellSessionForBearerRenewal({
        ...baseline,
        currentToken: baseline.previousToken,
      }),
    ).toBe(false)
  })

  it('distinguishes a pending session handoff from a settled unauthenticated session', () => {
    expect(
      resolveEffectiveAuthorizationFingerprint({
        authSummary: null,
        isSessionReady: true,
        isShellSessionPending: true,
      }),
    ).toBeNull()
    expect(
      resolveEffectiveAuthorizationFingerprint({
        authSummary: null,
        isSessionReady: true,
        isShellSessionPending: false,
      }),
    ).toBe('authorization:unauthenticated')
    expect(
      resolveEffectiveAuthorizationFingerprint({
        authSummary: session(),
        isSessionReady: true,
        isShellSessionPending: false,
      }),
    ).toBe(buildEffectiveAuthorizationFingerprint(session()))
  })

  it('fails closed without throwing for a structurally incomplete authorization response', () => {
    const incomplete = {
      authenticated: true,
    } as unknown as AuthSessionSummary

    expect(buildEffectiveAuthorizationFingerprint(null)).toBe(
      'authorization:unauthenticated',
    )
    expect(() => buildEffectiveAuthorizationFingerprint(incomplete)).not.toThrow()
    expect(buildEffectiveAuthorizationFingerprint(incomplete)).toBe(
      'authorization:unauthenticated',
    )
  })

  it('tracks legacy action scope without including presentation PII', () => {
    const baseline = buildEffectiveAuthorizationFingerprint(session())
    const presentationChanged = buildEffectiveAuthorizationFingerprint(
      session({
        displayName: 'Different Sanitized Person',
        email: 'different@example.invalid',
      }),
    )

    expect(presentationChanged).toBe(baseline)
    expect(baseline).not.toContain('Sanitized Person')
    expect(baseline).not.toContain('sanitized@example.invalid')
    expect(
      buildEffectiveAuthorizationFingerprint(
        session({ legacyAssignedStoreIds: ['store-a'] }),
      ),
    ).not.toBe(baseline)
  })

  it('drains an old identity mutation before the final protected cache removal', async () => {
    const queryClient = new QueryClient()
    const activeShellSessionQueryKey = ['shell-session', 'bearer', 'cookie', 'user-b']
    let releaseMutation: () => void = () => undefined
    const mutationGate = new Promise<void>((resolve) => {
      releaseMutation = resolve
    })
    const mutation = queryClient.getMutationCache().build(queryClient, {
      mutationKey: ['old-identity-command'],
      mutationFn: async () => {
        await mutationGate
        return { marker: 'old-identity-result' }
      },
      onSuccess: (result) => {
        queryClient.setQueryData(['protected-late-result'], result)
      },
    })

    const mutationPromise = mutation.execute(undefined)
    const isolationPromise = isolateAuthorizationCache({
      queryClient,
      activeShellSessionQueryKey,
    })
    releaseMutation()
    await Promise.all([mutationPromise, isolationPromise])

    expect(queryClient.getQueryData(['protected-late-result'])).toBeUndefined()
    expect(queryClient.getMutationCache().getAll()).toHaveLength(0)
  })

  it('skips an outdated final sweep when a newer authorization transition wins', async () => {
    const queryClient = new QueryClient()
    let transitionIsCurrent = true
    let releaseMutation: () => void = () => undefined
    const mutationGate = new Promise<void>((resolve) => {
      releaseMutation = resolve
    })
    const mutation = queryClient.getMutationCache().build(queryClient, {
      mutationFn: async () => mutationGate,
    })
    const mutationPromise = mutation.execute(undefined)
    queryClient.setQueryData(['newer-transition-data'], { marker: 'keep' })

    const staleIsolation = isolateAuthorizationCache({
      queryClient,
      activeShellSessionQueryKey: ['shell-session', 'older-transition'],
      isCurrent: () => transitionIsCurrent,
    })
    transitionIsCurrent = false
    releaseMutation()
    await Promise.all([mutationPromise, staleIsolation])

    expect(queryClient.getQueryData(['newer-transition-data'])).toEqual({ marker: 'keep' })
  })

  it('removes the signed-in cache on logout and keeps public bootstrap for re-login', async () => {
    const queryClient = new QueryClient()
    queryClient.setQueryData(['store-kpis-live'], { marker: 'signed-in-user' })
    queryClient.setQueryData(['shell-session', 'bearer', 'cookie', 'signed-in'], session())
    queryClient.setQueryData(['auth-bootstrap'], { provider: 'sanitized' })

    await isolateAuthorizationCache({
      queryClient,
      activeShellSessionQueryKey: ['shell-session', 'bearer', 'cookie', 'signed-out'],
    })

    expect(queryClient.getQueryData(['store-kpis-live'])).toBeUndefined()
    expect(
      queryClient.getQueryData(['shell-session', 'bearer', 'cookie', 'signed-in']),
    ).toBeUndefined()
    expect(queryClient.getQueryData(['auth-bootstrap'])).toEqual({ provider: 'sanitized' })

    queryClient.setQueryData(
      ['shell-session', 'bearer', 'cookie', 're-login'],
      session({ userId: 'user-b' }),
    )
    expect(
      queryClient.getQueryData(['shell-session', 'bearer', 'cookie', 're-login']),
    ).toEqual(session({ userId: 'user-b' }))
  })
})
