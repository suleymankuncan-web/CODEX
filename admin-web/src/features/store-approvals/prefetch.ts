import type { QueryKey } from '@tanstack/react-query'
import type { AuthSessionSummary } from '../auth/api'
import {
  canListTargetDistributionRequests,
  hasAnyRole,
} from '../auth/authorization'
import { getRequestCenterWorkspace } from './request-center-api'

type StoreApprovalsPersona = 'storeManager' | 'regionManager' | 'reportViewer' | 'readOnly'

export type StoreApprovalsPrefetchTask = {
  queryKey: QueryKey
  queryFn: () => Promise<unknown>
  enabled?: boolean
}

export function getStoreApprovalsPrefetchTasks(
  authSummary: AuthSessionSummary | null,
): StoreApprovalsPrefetchTask[] {
  const persona = resolveStoreApprovalsPersona(authSummary)
  const scopeKey = [
    persona,
    authSummary?.user.userId ?? 'anonymous',
    authSummary?.user.roleCodes.join('|') ?? '',
    authSummary?.user.readScope.companyIds.join('|') ?? '',
    authSummary?.user.readScope.regionIds.join('|') ?? '',
    authSummary?.user.readScope.storeIds.join('|') ?? '',
    authSummary?.user.actionScope.assignedStoreIds.join('|') ?? '',
  ].join(':')
  const canListRequests = canListTargetDistributionRequests(authSummary)

  return [
    {
      queryKey: ['request-center-workspace', scopeKey],
      queryFn: getRequestCenterWorkspace,
      enabled: canListRequests && persona !== 'readOnly',
    },
  ]
}

function resolveStoreApprovalsPersona(authSummary: AuthSessionSummary | null): StoreApprovalsPersona {
  if (hasAnyRole(authSummary, ['REPORT_VIEWER'])) {
    return 'reportViewer'
  }

  if (hasAnyRole(authSummary, ['REGION_MANAGER', 'SUPER_ADMIN'])) {
    return 'regionManager'
  }

  if (hasAnyRole(authSummary, ['STORE_MANAGER'])) {
    return 'storeManager'
  }

  return 'readOnly'
}
