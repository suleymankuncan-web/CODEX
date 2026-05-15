import type { QueryClient, QueryKey } from '@tanstack/react-query'
import type { AuthSessionSummary } from '../features/auth/api'
import {
  canCreateTargetDistributionRequest,
  canListTargetDistributionRequests,
  getAssignedStoreIds,
  getReadStoreIds,
  hasAnyRole,
} from '../features/auth/authorization'
import {
  getChecklistAcknowledgements,
  getMobileChecklistToday,
} from '../features/checklists/api'
import {
  getKpiConfig,
  getMyPerformance,
  getRankings,
  getStoreKpiHighlights,
} from '../features/reports/api'
import {
  getStoreTargetingPersonnel,
  getTargetDistributionRequests,
} from '../features/targets/api'
import {
  getOffboardingRequests,
  getPositionOptions,
  getSellerCodeRequests,
  getStoreEmployees,
} from '../features/workforce/api'
import { getWorkflowInbox } from '../features/workflow/api'
import { transientQueryRetryOptions } from '../lib/query-retry'

type RouteDataPrefetchInput = {
  queryClient: QueryClient
  pathname: string
  authSummary: AuthSessionSummary | null
}

type PrefetchTask = {
  queryKey: QueryKey
  queryFn: () => Promise<unknown>
  enabled?: boolean
}

const rankingRoles = ['STORE_PERSONNEL', 'STORE_MANAGER', 'REGION_MANAGER', 'SUPER_ADMIN']
const storeReportingRoles = ['SUPER_ADMIN', 'REPORT_VIEWER', 'AUDITOR', 'STORE_MANAGER']
const workflowInboxRoles = ['STORE_MANAGER', 'SUPER_ADMIN', 'REPORT_VIEWER']

export function prefetchRouteData(input: RouteDataPrefetchInput) {
  const tasks = resolveRoutePrefetchTasks(input.pathname, input.authSummary)
  if (tasks.length === 0) {
    return
  }

  tasks.forEach((task) => {
    if (task.enabled === false) {
      return
    }

    void input.queryClient.prefetchQuery({
      queryKey: task.queryKey,
      queryFn: task.queryFn,
      ...transientQueryRetryOptions,
    }).catch(() => undefined)
  })
}

function resolveRoutePrefetchTasks(
  pathname: string,
  authSummary: AuthSessionSummary | null,
): PrefetchTask[] {
  if (pathname === '/store' || pathname === '/store/home') {
    return getStoreHomePrefetchTasks(authSummary)
  }

  if (pathname === '/store/me') {
    return getStoreMePrefetchTasks(authSummary)
  }

  if (pathname === '/store/kpis') {
    return getStoreKpiPrefetchTasks(authSummary)
  }

  if (pathname === '/store/rankings') {
    return getStoreRankingsPrefetchTasks(authSummary)
  }

  if (pathname === '/store/checklists') {
    return getStoreChecklistsPrefetchTasks(authSummary)
  }

  if (pathname === '/store/tasks') {
    return getStoreTasksPrefetchTasks(authSummary)
  }

  if (pathname === '/store/approvals') {
    return getStoreApprovalsPrefetchTasks(authSummary)
  }

  return []
}

function getStoreHomePrefetchTasks(authSummary: AuthSessionSummary | null): PrefetchTask[] {
  return getStoreTasksPrefetchTasks(authSummary)
}

function getStoreTasksPrefetchTasks(authSummary: AuthSessionSummary | null): PrefetchTask[] {
  return [
    {
      queryKey: ['workflow-inbox'],
      queryFn: getWorkflowInbox,
      enabled: hasAnyRole(authSummary, workflowInboxRoles),
    },
  ]
}

function getStoreMePrefetchTasks(authSummary: AuthSessionSummary | null): PrefetchTask[] {
  const enabled = hasAnyRole(authSummary, ['STORE_PERSONNEL', 'STORE_MANAGER'])
  return [
    {
      queryKey: ['store-me-kpi-config'],
      queryFn: getKpiConfig,
      enabled,
    },
    {
      queryKey: ['my-performance', 'live', 'monthly', '', ''],
      queryFn: () =>
        getMyPerformance({
          mode: 'live',
          periodType: 'monthly',
        }),
      enabled,
    },
  ]
}

function getStoreKpiPrefetchTasks(authSummary: AuthSessionSummary | null): PrefetchTask[] {
  const reportingAllowed = hasAnyRole(authSummary, storeReportingRoles)
  return [
    {
      queryKey: ['store-kpi-config'],
      queryFn: getKpiConfig,
      enabled: Boolean(authSummary),
    },
    {
      queryKey: ['store-kpis-live', 'latest-monthly'],
      queryFn: () =>
        getStoreKpiHighlights({
          periodType: 'monthly',
        }),
      enabled: reportingAllowed,
    },
  ]
}

function getStoreRankingsPrefetchTasks(authSummary: AuthSessionSummary | null): PrefetchTask[] {
  return [
    {
      queryKey: ['ranking-v1', 'latest', '', '', '', '', 'score', 'desc', 0],
      queryFn: () =>
        getRankings({
          limit: 100,
          offset: 0,
        }),
      enabled: hasAnyRole(authSummary, rankingRoles),
    },
  ]
}

function getStoreChecklistsPrefetchTasks(authSummary: AuthSessionSummary | null): PrefetchTask[] {
  const roles = authSummary?.user.roleCodes ?? []
  const canReadChecklists = hasAnyRole(authSummary, [
    'STORE_MANAGER',
    'SUPER_ADMIN',
    'REPORT_VIEWER',
    'REGION_MANAGER',
    'VISUAL_MERCHANDISER',
  ])

  return [
    {
      queryKey: ['checklist-acknowledgements'],
      queryFn: getChecklistAcknowledgements,
      enabled: roles.includes('STORE_MANAGER') || roles.includes('SUPER_ADMIN'),
    },
    {
      queryKey: ['mobile-checklists-today'],
      queryFn: getMobileChecklistToday,
      enabled: canReadChecklists,
    },
  ]
}

function getStoreApprovalsPrefetchTasks(authSummary: AuthSessionSummary | null): PrefetchTask[] {
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

function resolveStoreApprovalsPersona(authSummary: AuthSessionSummary | null) {
  if (hasAnyRole(authSummary, ['REGION_MANAGER', 'SUPER_ADMIN', 'REPORT_VIEWER'])) {
    return 'regionManager'
  }

  if (hasAnyRole(authSummary, ['STORE_MANAGER'])) {
    return 'storeManager'
  }

  return 'readOnly'
}
