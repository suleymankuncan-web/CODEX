import type { AuthSessionSummary } from './api'
import {
  getActionStoreIds,
  getAssignedStoreIds,
  getAssignedStoreTypes,
  getReadRegionIds,
  getReadStoreIds,
} from './authorization'

function sortedUnique(values: readonly string[] | undefined) {
  return [...new Set(values ?? [])].sort()
}

export function getStoreQueryScopeSignature(authSummary: AuthSessionSummary | null) {
  const user = authSummary?.user

  if (!user) {
    return 'anonymous'
  }

  const roles = sortedUnique(user.roleCodes).join(',')
  const readRegionIds = sortedUnique(getReadRegionIds(authSummary)).join(',')
  const readStoreIds = sortedUnique(getReadStoreIds(authSummary)).join(',')
  const assignedStoreIds = sortedUnique(getAssignedStoreIds(authSummary)).join(',')
  const actionStoreIds = sortedUnique(getActionStoreIds(authSummary)).join(',')
  const assignedStoreTypes = sortedUnique(getAssignedStoreTypes(authSummary)).join(',')

  return [
    `user:${user.userId}`,
    `roles:${roles}`,
    `readRegions:${readRegionIds}`,
    `readStores:${readStoreIds}`,
    `assignedStores:${assignedStoreIds}`,
    `actionStores:${actionStoreIds}`,
    `storeTypes:${assignedStoreTypes}`,
  ].join('|')
}

export function storeChecklistAcknowledgementsQueryKey(authSummary: AuthSessionSummary | null) {
  return ['checklist-acknowledgements', getStoreQueryScopeSignature(authSummary)] as const
}

export function storeMobileChecklistsTodayQueryKey(authSummary: AuthSessionSummary | null) {
  return ['mobile-checklists-today', getStoreQueryScopeSignature(authSummary)] as const
}

export function storeWorkflowInboxQueryKey(authSummary: AuthSessionSummary | null) {
  return ['workflow-inbox', getStoreQueryScopeSignature(authSummary)] as const
}

export function storeActionPlansPageQueryKey(
  authSummary: AuthSessionSummary | null,
  offset: number,
) {
  return ['store-action-plans', 'store-tasks', 'page', getStoreQueryScopeSignature(authSummary), offset] as const
}

export function storeActionPlansActiveIndexQueryKey(authSummary: AuthSessionSummary | null) {
  return ['store-action-plans', 'store-tasks', 'active-index', getStoreQueryScopeSignature(authSummary)] as const
}

export function storeActionPlansResultIndexQueryKey(authSummary: AuthSessionSummary | null) {
  return ['store-action-plans', 'store-tasks', 'result-index', getStoreQueryScopeSignature(authSummary)] as const
}
