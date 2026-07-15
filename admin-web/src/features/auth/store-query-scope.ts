import type { AuthSessionSummary } from './api'
import {
  getActionStoreIds,
  getAssignedStoreIds,
  getAssignedStoreTypes,
  getReadCompanyIds,
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
  const readCompanyIds = sortedUnique(getReadCompanyIds(authSummary)).join(',')
  const readRegionIds = sortedUnique(getReadRegionIds(authSummary)).join(',')
  const readStoreIds = sortedUnique(getReadStoreIds(authSummary)).join(',')
  const assignedStoreIds = sortedUnique(getAssignedStoreIds(authSummary)).join(',')
  const actionStoreIds = sortedUnique(getActionStoreIds(authSummary)).join(',')
  const assignedStoreTypes = sortedUnique(getAssignedStoreTypes(authSummary)).join(',')

  return [
    `user:${user.userId}`,
    `authorization:${user.authorizationContextVersion ?? 'legacy'}`,
    `roles:${roles}`,
    `readCompanies:${readCompanyIds}`,
    `readRegions:${readRegionIds}`,
    `readStores:${readStoreIds}`,
    `assignedStores:${assignedStoreIds}`,
    `actionStores:${actionStoreIds}`,
    `storeTypes:${assignedStoreTypes}`,
  ].join('|')
}

export function retainScopedPlaceholder<T>(
  previousData: T | undefined,
  previousQueryKey: readonly unknown[] | undefined,
  currentScopeSignature: string,
  matchesCurrentFilters = true,
) {
  return previousQueryKey?.[1] === currentScopeSignature && matchesCurrentFilters
    ? previousData
    : undefined
}

export function storeChecklistAcknowledgementsQueryKey(authSummary: AuthSessionSummary | null) {
  return ['checklist-acknowledgements', getStoreQueryScopeSignature(authSummary)] as const
}

export function storeMobileChecklistsTodayQueryKey(authSummary: AuthSessionSummary | null) {
  return ['mobile-checklists-today', getStoreQueryScopeSignature(authSummary)] as const
}

export function storeChecklistCommandQueryKey(
  authSummary: AuthSessionSummary | null,
  filters: Record<string, string | number>,
) {
  return ['checklist-command', getStoreQueryScopeSignature(authSummary), filters] as const
}

export function storeChecklistCommandRegionsQueryKey(
  authSummary: AuthSessionSummary | null,
  filters: Record<string, string | number>,
) {
  return ['checklist-command-regions', getStoreQueryScopeSignature(authSummary), filters] as const
}

export function storeChecklistOperationalHistoryQueryKey(
  authSummary: AuthSessionSummary | null,
  storeId: string,
  range: string,
  kinds: readonly string[],
) {
  return [
    'checklist-operational-history',
    getStoreQueryScopeSignature(authSummary),
    storeId,
    range,
    [...new Set(kinds)].sort().join(','),
  ] as const
}

export function storeChecklistVisitPlanQueryKey(
  authSummary: AuthSessionSummary | null,
  regionId: string,
  weekStart: string,
) {
  return [
    'checklist-visit-plan',
    getStoreQueryScopeSignature(authSummary),
    regionId,
    weekStart,
  ] as const
}

export function storeChecklistVisitPlanPeriodQueryKey(
  authSummary: AuthSessionSummary | null,
  filters: Record<string, string | number>,
) {
  return ['checklist-visit-plan-period', getStoreQueryScopeSignature(authSummary), filters] as const
}

export function storeChecklistVisitPlanCandidatesQueryKey(
  authSummary: AuthSessionSummary | null,
  filters: Record<string, string | number>,
) {
  return ['checklist-visit-plan-candidates', getStoreQueryScopeSignature(authSummary), filters] as const
}

export function storeChecklistVisitPlanRegionsQueryKey(
  authSummary: AuthSessionSummary | null,
  filters: Record<string, string | number>,
) {
  return ['checklist-visit-plan-regions', getStoreQueryScopeSignature(authSummary), filters] as const
}

export function storeWorkflowInboxQueryKey(authSummary: AuthSessionSummary | null) {
  return ['workflow-inbox', getStoreQueryScopeSignature(authSummary)] as const
}

export function storeActionPlansPageQueryKey(
  authSummary: AuthSessionSummary | null,
  offset: number,
  periodKey?: string,
) {
  return ['store-action-plans', 'store-tasks', 'page', getStoreQueryScopeSignature(authSummary), periodKey ?? 'all-periods', offset] as const
}

export function storeActionPlansActiveIndexQueryKey(authSummary: AuthSessionSummary | null, periodKey?: string) {
  return ['store-action-plans', 'store-tasks', 'active-index', getStoreQueryScopeSignature(authSummary), periodKey ?? 'all-periods'] as const
}

export function storeActionPlansResultIndexQueryKey(authSummary: AuthSessionSummary | null, periodKey?: string) {
  return ['store-action-plans', 'store-tasks', 'result-index', getStoreQueryScopeSignature(authSummary), periodKey ?? 'all-periods'] as const
}
