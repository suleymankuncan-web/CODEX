import type { AuthSessionSummary } from '../auth/api'
import { getAssignedStoreIds, hasAnyRole } from '../auth/authorization'
import type {
  SalesTargetIncentiveQueryIdentity,
  SalesTargetIncentiveRoleScope,
} from './api'

export function getSalesTargetIncentiveQueryIdentity(
  authSummary: AuthSessionSummary | null,
): SalesTargetIncentiveQueryIdentity {
  return {
    actorUserId: authSummary?.user.userId ?? null,
    roleScope: getSalesTargetIncentiveRoleScope(authSummary),
    assignedStoreIds: getAssignedStoreIds(authSummary),
  }
}

export function getSalesTargetIncentiveRoleScope(
  authSummary: AuthSessionSummary | null,
): SalesTargetIncentiveRoleScope | null {
  if (hasAnyRole(authSummary, ['REGION_MANAGER'])) return 'region'
  if (hasAnyRole(authSummary, ['STORE_MANAGER'])) return 'store'
  if (hasAnyRole(authSummary, ['STORE_PERSONNEL'])) return 'own'
  return null
}
