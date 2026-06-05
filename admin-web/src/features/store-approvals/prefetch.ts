import type { QueryKey } from '@tanstack/react-query'
import type { AuthSessionSummary } from '../auth/api'
import {
  canListTargetDistributionRequests,
  getAssignedStoreIds,
  getReadStoreIds,
  hasAnyRole,
} from '../auth/authorization'
import { getAllTargetDistributionRequests } from '../targets/api'
import {
  getOffboardingRequests,
  getSellerCodeRequests,
} from '../workforce/api'

type StoreApprovalsPersona = 'storeManager' | 'regionManager' | 'readOnly'

export type StoreApprovalsPrefetchTask = {
  queryKey: QueryKey
  queryFn: () => Promise<unknown>
  enabled?: boolean
}

export function getStoreApprovalsPrefetchTasks(
  authSummary: AuthSessionSummary | null,
): StoreApprovalsPrefetchTask[] {
  const persona = resolveStoreApprovalsPersona(authSummary)
  const assignedStoreIds = getAssignedStoreIds(authSummary)
  const readStoreIds = getReadStoreIds(authSummary)
  const roleKey = (authSummary?.user.roleCodes ?? []).join('|')
  const scopeKey = [
    persona,
    roleKey,
    assignedStoreIds.join('|'),
    readStoreIds.join('|'),
  ].join(':')
  const canListRequests = canListTargetDistributionRequests(authSummary)
  const showWorkforceQueues = persona === 'storeManager' && assignedStoreIds.length > 0

  return [
    {
      queryKey: ['target-distribution-requests', 'store-approvals-request-center', scopeKey],
      queryFn: () => getAllTargetDistributionRequests(),
      enabled: canListRequests && persona !== 'readOnly',
    },
    {
      queryKey: ['seller-code-requests', 'store-approvals-request-center', scopeKey],
      queryFn: () => getSellerCodeRequests(),
      enabled: showWorkforceQueues,
    },
    {
      queryKey: ['offboarding-requests', 'store-approvals-request-center', scopeKey],
      queryFn: () => getOffboardingRequests(),
      enabled: showWorkforceQueues,
    },
  ]
}

function resolveStoreApprovalsPersona(authSummary: AuthSessionSummary | null): StoreApprovalsPersona {
  if (hasAnyRole(authSummary, ['REGION_MANAGER', 'SUPER_ADMIN', 'REPORT_VIEWER'])) {
    return 'regionManager'
  }

  if (hasAnyRole(authSummary, ['STORE_MANAGER'])) {
    return 'storeManager'
  }

  return 'readOnly'
}
