import type { AuthSessionSummary } from './api'

const targetRequestListRoles = ['STORE_MANAGER', 'SUPER_ADMIN', 'REPORT_VIEWER', 'REGION_MANAGER']
const targetRequestCreateRoles = ['STORE_MANAGER', 'SUPER_ADMIN']
const targetRequestApproveRoles = ['SUPER_ADMIN', 'REGION_MANAGER']
const checklistAcknowledgementRoles = ['STORE_MANAGER', 'SUPER_ADMIN']

export function hasAnyRole(authSummary: AuthSessionSummary | null, requiredRoles: string[]) {
  const roles = authSummary?.user.roleCodes ?? []
  return requiredRoles.some((role) => roles.includes(role))
}

export function getReadStoreIds(authSummary: AuthSessionSummary | null) {
  return authSummary?.user.readScope.storeIds ?? authSummary?.user.scope.storeIds ?? []
}

export function getAssignedStoreIds(authSummary: AuthSessionSummary | null) {
  return (
    authSummary?.user.actionScope.assignedStoreIds ??
    authSummary?.user.assignedStoreIds ??
    authSummary?.user.scope.storeIds ??
    []
  )
}

export function canActOnStore(authSummary: AuthSessionSummary | null, storeId: string | null) {
  if (!storeId) {
    return false
  }

  return getAssignedStoreIds(authSummary).includes(storeId)
}

export function canListTargetDistributionRequests(authSummary: AuthSessionSummary | null) {
  return hasAnyRole(authSummary, targetRequestListRoles)
}

export function canCreateTargetDistributionRequest(
  authSummary: AuthSessionSummary | null,
  storeId: string | null,
) {
  return hasAnyRole(authSummary, targetRequestCreateRoles) && canActOnStore(authSummary, storeId)
}

export function canApproveTargetDistributionRequest(
  authSummary: AuthSessionSummary | null,
  storeId: string | null,
) {
  return hasAnyRole(authSummary, targetRequestApproveRoles) && canActOnStore(authSummary, storeId)
}

export function canAcknowledgeChecklist(authSummary: AuthSessionSummary | null, storeId: string | null) {
  return hasAnyRole(authSummary, checklistAcknowledgementRoles) && canActOnStore(authSummary, storeId)
}
