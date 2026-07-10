import { useLayoutEffect, useRef, useState } from 'react'
import { hashKey, type QueryClient, type QueryKey } from '@tanstack/react-query'
import type { AuthSessionSummary } from '../auth/api'

const unauthenticatedFingerprint = 'authorization:unauthenticated'

export function buildEffectiveAuthorizationFingerprint(
  authSummary: AuthSessionSummary | null,
) {
  const user = authSummary?.user
  if (!authSummary?.authenticated || !user?.userId?.trim()) {
    return unauthenticatedFingerprint
  }

  const value = JSON.stringify({
    userId: user.userId.trim(),
    roleCodes: sortedUnique(user.roleCodes ?? []),
    scope: {
      companyIds: sortedUnique(user.scope?.companyIds ?? []),
      regionIds: sortedUnique(user.scope?.regionIds ?? []),
      storeIds: sortedUnique(user.scope?.storeIds ?? []),
    },
    readScope: {
      companyIds: sortedUnique(user.readScope?.companyIds ?? []),
      regionIds: sortedUnique(user.readScope?.regionIds ?? []),
      storeIds: sortedUnique(user.readScope?.storeIds ?? []),
    },
    actionScope: {
      assignedStoreIds: sortedUnique(user.actionScope?.assignedStoreIds ?? []),
      assignedStoreTypes: sortedUnique(user.actionScope?.assignedStoreTypes ?? []),
    },
    legacyAssignedStoreIds: sortedUnique(user.assignedStoreIds ?? []),
  })

  return `authorization:${hashFingerprint(value)}`
}

export async function isolateAuthorizationCache(input: {
  queryClient: QueryClient
  activeShellSessionQueryKey: QueryKey
  isCurrent?: () => boolean
}) {
  const shouldRemove = (query: { queryKey: QueryKey }) =>
    !isAuthorizationBoundaryPreservedQuery(
      query.queryKey,
      input.activeShellSessionQueryKey,
    )

  await waitForActiveMutations(input.queryClient)
  if (input.isCurrent && !input.isCurrent()) {
    return
  }

  await input.queryClient.cancelQueries({ predicate: shouldRemove })
  input.queryClient.removeQueries({ predicate: shouldRemove })
  input.queryClient.getMutationCache().clear()
}

export function isAuthorizationBoundaryPreservedQuery(
  queryKey: QueryKey,
  activeShellSessionQueryKey: QueryKey,
) {
  if (queryKey[0] === 'auth-bootstrap') {
    return true
  }

  return queryKey[0] === 'shell-session' && hashKey(queryKey) === hashKey(activeShellSessionQueryKey)
}

export function useAuthorizationCacheBoundary(input: {
  queryClient: QueryClient
  authSummary: AuthSessionSummary | null
  activeShellSessionQueryKey: QueryKey
  isSessionReady: boolean
  isShellSessionPending: boolean
}) {
  const fingerprint = resolveEffectiveAuthorizationFingerprint(input)
  const committedFingerprintRef = useRef<string | null>(fingerprint)
  const transitionIdRef = useRef(0)
  const [committedFingerprint, setCommittedFingerprint] = useState<string | null>(fingerprint)
  const activeShellSessionQueryHash = hashKey(input.activeShellSessionQueryKey)

  useLayoutEffect(() => {
    if (fingerprint === null || committedFingerprintRef.current === fingerprint) {
      return
    }

    const transitionId = transitionIdRef.current + 1
    transitionIdRef.current = transitionId
    let active = true

    void isolateAuthorizationCache({
      queryClient: input.queryClient,
      activeShellSessionQueryKey: input.activeShellSessionQueryKey,
      isCurrent: () => active && transitionIdRef.current === transitionId,
    }).then(() => {
      if (!active || transitionIdRef.current !== transitionId) {
        return
      }

      committedFingerprintRef.current = fingerprint
      setCommittedFingerprint(fingerprint)
    })

    return () => {
      active = false
    }
  }, [activeShellSessionQueryHash, fingerprint, input.activeShellSessionQueryKey, input.queryClient])

  return fingerprint !== null && committedFingerprint === fingerprint
}

export function resolveEffectiveAuthorizationFingerprint(input: {
  authSummary: AuthSessionSummary | null
  isSessionReady: boolean
  isShellSessionPending: boolean
}) {
  if (input.authSummary) {
    return buildEffectiveAuthorizationFingerprint(input.authSummary)
  }

  return input.isSessionReady && input.isShellSessionPending
    ? null
    : unauthenticatedFingerprint
}

export function shouldRefreshShellSessionForBearerRenewal(input: {
  mode: 'mock' | 'bearer'
  browserSessionTransport: 'bearer' | 'cookie'
  previousToken: string
  currentToken: string
  previousSessionKey: string
  currentSessionKey: string
}) {
  return Boolean(
    input.mode === 'bearer' &&
      input.browserSessionTransport === 'bearer' &&
      input.previousToken &&
      input.currentToken &&
      input.previousToken !== input.currentToken &&
      input.previousSessionKey === input.currentSessionKey,
  )
}

function sortedUnique(values: readonly unknown[]) {
  return [
    ...new Set(
      values
        .filter((value): value is string => typeof value === 'string')
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ].sort()
}

async function waitForActiveMutations(queryClient: QueryClient) {
  if (queryClient.isMutating() === 0) {
    return
  }

  await new Promise<void>((resolve) => {
    let unsubscribe = () => undefined
    const finishWhenIdle = () => {
      if (queryClient.isMutating() !== 0) {
        return
      }

      unsubscribe()
      resolve()
    }

    unsubscribe = queryClient.getMutationCache().subscribe(finishWhenIdle)
    finishWhenIdle()
  })
}

function hashFingerprint(value: string) {
  let primaryHash = 0x811c9dc5
  let secondaryHash = 0x9e3779b9

  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index)
    primaryHash ^= code
    primaryHash = Math.imul(primaryHash, 0x01000193)
    secondaryHash ^= code + index
    secondaryHash = Math.imul(secondaryHash, 0x85ebca6b)
  }

  return `${(primaryHash >>> 0).toString(36)}${(secondaryHash >>> 0).toString(36)}`
}
