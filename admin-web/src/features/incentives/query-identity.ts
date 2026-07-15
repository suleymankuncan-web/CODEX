import type { AuthSessionSummary } from '../auth/api'
import {
  getAssignedStoreIds,
  getAssignedStoreTypes,
  getReadCompanyIds,
  getReadRegionIds,
  getReadStoreIds,
  hasAnyRole,
} from '../auth/authorization'
import type {
  SalesTargetIncentiveQueryIdentity,
  SalesTargetIncentiveRoleScope,
  SalesTargetIncentiveWorkspaceQueryIdentity,
} from './api'

export function getSalesTargetIncentiveWorkspaceQueryIdentity(
  authSummary: AuthSessionSummary | null,
): SalesTargetIncentiveWorkspaceQueryIdentity {
  return {
    actorUserId: authSummary?.user.userId ?? null,
    roleCodes: authSummary?.user.roleCodes ?? [],
    readCompanyIds: getReadCompanyIds(authSummary),
    readRegionIds: getReadRegionIds(authSummary),
    readStoreIds: getReadStoreIds(authSummary),
    assignedStoreIds: getAssignedStoreIds(authSummary),
  }
}

export function getSalesTargetIncentiveQueryIdentity(
  authSummary: AuthSessionSummary | null,
): SalesTargetIncentiveQueryIdentity {
  return {
    actorUserId: authSummary?.user.userId ?? null,
    roleScope: getSalesTargetIncentiveRoleScope(authSummary),
    assignedStoreIds: getAssignedStoreIds(authSummary),
    assignedStoreTypes: getAssignedStoreTypes(authSummary),
  }
}

export function getSalesTargetIncentiveRoleScope(
  authSummary: AuthSessionSummary | null,
): SalesTargetIncentiveRoleScope | null {
  if (hasAnyRole(authSummary, ['REPORT_VIEWER'])) return 'admin'
  if (hasAnyRole(authSummary, ['REGION_MANAGER'])) return 'region'
  if (hasAnyRole(authSummary, ['STORE_MANAGER'])) return 'store'
  if (hasAnyRole(authSummary, ['STORE_PERSONNEL'])) return 'own'
  return null
}
