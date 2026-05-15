import type { QueryKey } from '@tanstack/react-query'
import type { AuthSessionSummary } from '../auth/api'
import {
  canCreateTargetDistributionRequest,
  canListTargetDistributionRequests,
  getAssignedStoreIds,
  getReadStoreIds,
  hasAnyRole,
} from '../auth/authorization'
import {
  getStoreTargetingPersonnel,
  getTargetDistributionRequests,
} from '../targets/api'
import {
  getOffboardingRequests,
  getPositionOptions,
  getSellerCodeRequests,
  getStoreEmployees,
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
  const primaryStoreId = assignedStoreIds[0] ?? null
  const storeId = primaryStoreId ?? ''
  const roleKey = (authSummary?.user.roleCodes ?? []).join('|')
  const scopeKey = [
    persona,
    roleKey,
    readStoreIds.join('|'),
    assignedStoreIds.join('|'),
    storeId,
  ].join(':')
  const canListRequests = canListTargetDistributionRequests(authSummary)
  const canCreateForStore = canCreateTargetDistributionRequest(authSummary, storeId || null)
  const showTargetSubmission = persona === 'storeManager' && canCreateForStore
  const showWorkforceHrQueues = persona === 'storeManager' && canCreateForStore

  return [
    {
      queryKey: ['target-distribution-requests', 'store-approvals-ledger', scopeKey],
      queryFn: () => getTargetDistributionRequests(),
      enabled: canListRequests && persona !== 'readOnly',
    },
    {
      queryKey: ['store-targeting-personnel', 'store-approvals-ledger', scopeKey],
      queryFn: () => getStoreTargetingPersonnel(storeId),
      enabled: showTargetSubmission,
    },
    {
      queryKey: ['workforce-position-options', 'store-approvals-ledger', scopeKey],
      queryFn: () => getPositionOptions(storeId),
      enabled: showWorkforceHrQueues,
    },
    {
      queryKey: ['workforce-store-employees', 'store-approvals-ledger', scopeKey],
      queryFn: () => getStoreEmployees(storeId),
      enabled: showWorkforceHrQueues,
    },
    {
      queryKey: ['seller-code-requests', 'rejected', 'store-approvals-ledger', scopeKey],
      queryFn: () => getSellerCodeRequests({ status: 'rejected' }),
      enabled: showWorkforceHrQueues,
    },
    {
      queryKey: ['offboarding-requests', 'rejected', 'store-approvals-ledger', scopeKey],
      queryFn: () => getOffboardingRequests({ status: 'rejected' }),
      enabled: showWorkforceHrQueues,
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
