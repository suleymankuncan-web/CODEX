import type { AuthSessionSummary } from './api'

export const targetRequestListRoles = ['STORE_MANAGER', 'SUPER_ADMIN', 'REPORT_VIEWER', 'REGION_MANAGER']
const targetRequestCreateRoles = ['STORE_MANAGER', 'SUPER_ADMIN']
const targetRequestApproveRoles = ['SUPER_ADMIN', 'REGION_MANAGER']
const checklistAcknowledgementRoles = ['STORE_MANAGER', 'SUPER_ADMIN']
export const checklistResultReadRoles = [
  'STORE_MANAGER',
  'SUPER_ADMIN',
  'REPORT_VIEWER',
  'REGION_MANAGER',
  'VISUAL_MERCHANDISER',
]
export const storeWorkforceRouteRoles = ['STORE_MANAGER', 'REGION_MANAGER', 'SUPER_ADMIN', 'REPORT_VIEWER']

export function hasAnyRole(authSummary: AuthSessionSummary | null, requiredRoles: string[]) {
  const roles = authSummary?.user.roleCodes ?? []
  return requiredRoles.some((role) => roles.includes(role))
}

// Presentation only: keep the authenticated role and server scope unchanged.
export function usesStoreReportViewerView(authSummary: AuthSessionSummary | null) {
  return hasAnyRole(authSummary, ['SUPER_ADMIN', 'REPORT_VIEWER'])
}

export function getReadStoreIds(authSummary: AuthSessionSummary | null) {
  return authSummary?.user.readScope.storeIds ?? authSummary?.user.scope.storeIds ?? []
}

export function getReadRegionIds(authSummary: AuthSessionSummary | null) {
  return authSummary?.user.readScope.regionIds ?? authSummary?.user.scope.regionIds ?? []
}

export function getReadCompanyIds(authSummary: AuthSessionSummary | null) {
  return authSummary?.user.readScope.companyIds ?? authSummary?.user.scope.companyIds ?? []
}

export function getAssignedStoreIds(authSummary: AuthSessionSummary | null) {
  return (
    authSummary?.user.actionScope.assignedStoreIds ??
    authSummary?.user.assignedStoreIds ??
    authSummary?.user.scope.storeIds ??
    []
  )
}

export function getAssignedStoreTypes(authSummary: AuthSessionSummary | null) {
  return authSummary?.user.actionScope.assignedStoreTypes ?? []
}

export function getActionStoreIds(authSummary: AuthSessionSummary | null) {
  return (
    authSummary?.user.actionScope.assignedStoreIds ??
    authSummary?.user.assignedStoreIds ??
    []
  )
}

function canActOnStore(authSummary: AuthSessionSummary | null, storeId: string | null) {
  if (!storeId) {
    return false
  }

  return getActionStoreIds(authSummary).includes(storeId)
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

export function canReadChecklistResults(authSummary: AuthSessionSummary | null) {
  return hasAnyRole(authSummary, checklistResultReadRoles)
}

export function canOpenStoreChecklists(authSummary: AuthSessionSummary | null) {
  return canReadChecklistResults(authSummary)
}

export function canOpenStoreWorkforce(authSummary: AuthSessionSummary | null) {
  const canOpenAsStoreManager =
    hasAnyRole(authSummary, ['STORE_MANAGER']) && getActionStoreIds(authSummary).length > 0
  const canOpenAsRegionManager =
    hasAnyRole(authSummary, ['REGION_MANAGER']) &&
    getActionStoreIds(authSummary).length > 0
  const canOpenAsReportViewer =
    usesStoreReportViewerView(authSummary) && getReadCompanyIds(authSummary).length > 0

  return canOpenAsStoreManager || canOpenAsRegionManager || canOpenAsReportViewer
}
