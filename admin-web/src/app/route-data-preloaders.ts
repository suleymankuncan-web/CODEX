import type { QueryClient, QueryKey } from '@tanstack/react-query'
import { getAuthLookups, type AuthSessionSummary } from '../features/auth/api'
import { canReadChecklistResults, hasAnyRole } from '../features/auth/authorization'
import {
  getChecklistAcknowledgements,
  getMobileChecklistToday,
} from '../features/checklists/api'
import { listCompetitions } from '../features/competitions/api'
import { getAdminFeedPosts, getVisibleFeedPosts } from '../features/feed/api'
import {
  getImportOverview,
  getImportPayloadTemplate,
  getIntegrationLookups,
  getMasterDataBootstrapBatches,
  getNeedsAction,
} from '../features/integrations/api'
import {
  getKpiConfig,
  getMyPerformance,
  getRankings,
  getStoreKpiHighlights,
} from '../features/reports/api'
import { getOperationsHealth } from '../features/operations/api'
import { getSnapshotNeedsAction, getSnapshotOverview } from '../features/snapshots/api'
import { getStoreApprovalsPrefetchTasks } from '../features/store-approvals/prefetch'
import {
  getTargetCoverage,
  getTargetDistributionRequests,
} from '../features/targets/api'
import {
  getOffboardingRequests,
  getSellerCodeReference,
  getSellerCodeRequests,
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
const adminFeedRoles = ['SUPER_ADMIN', 'HR_ADMIN', 'REGION_MANAGER']
const adminInboxRoles = ['SUPER_ADMIN', 'REPORT_VIEWER', 'HR_ADMIN']
const adminInboxWorkforceRoles = ['SUPER_ADMIN', 'HR_ADMIN']
const adminCompetitionRoles = ['SUPER_ADMIN', 'HR_ADMIN', 'REPORT_VIEWER', 'REGION_MANAGER']
const adminIntegrationRoles = ['SUPER_ADMIN', 'INTEGRATION_ADMIN']
const adminMasterDataRoles = ['SUPER_ADMIN', 'HR_ADMIN', 'INTEGRATION_ADMIN']
const adminOperationsRoles = ['SUPER_ADMIN']
const adminTargetRoles = ['SUPER_ADMIN', 'REPORT_VIEWER', 'REGION_MANAGER']
const storeCompetitionRoles = ['STORE_PERSONNEL', 'STORE_MANAGER']
const storeReportingRoles = ['SUPER_ADMIN', 'REPORT_VIEWER', 'AUDITOR', 'STORE_MANAGER']
const workflowInboxRoles = ['STORE_MANAGER', 'SUPER_ADMIN', 'REPORT_VIEWER']
const checklistVisitManagerRoles = ['REGION_MANAGER', 'VISUAL_MERCHANDISER', 'SUPER_ADMIN']
const routePrefetchStaleTimeMs = 30_000

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
      staleTime: routePrefetchStaleTimeMs,
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

  if (pathname === '/store/feed') {
    return getStoreFeedPrefetchTasks(authSummary)
  }

  if (pathname === '/store/competitions') {
    return getStoreCompetitionsPrefetchTasks(authSummary)
  }

  if (pathname === '/store/tasks') {
    return getStoreTasksPrefetchTasks(authSummary)
  }

  if (pathname === '/store/approvals') {
    return getStoreApprovalsPrefetchTasks(authSummary)
  }

  if (pathname === '/admin/integrations') {
    return getAdminIntegrationsPrefetchTasks(authSummary)
  }

  if (pathname === '/admin/operations') {
    return getAdminOperationsPrefetchTasks(authSummary)
  }

  if (pathname === '/admin/master-data') {
    return getAdminMasterDataPrefetchTasks(authSummary)
  }

  if (pathname === '/admin/feed') {
    return getAdminFeedPrefetchTasks(authSummary)
  }

  if (pathname === '/admin/competitions') {
    return getAdminCompetitionsPrefetchTasks(authSummary)
  }

  if (pathname === '/admin/inbox') {
    return getAdminInboxPrefetchTasks(authSummary)
  }

  if (pathname === '/admin/targets') {
    return getAdminTargetsPrefetchTasks(authSummary)
  }

  return []
}

function getStoreHomePrefetchTasks(authSummary: AuthSessionSummary | null): PrefetchTask[] {
  return [
    ...getStoreTasksPrefetchTasks(authSummary),
    ...getStoreChecklistsPrefetchTasks(authSummary),
  ]
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

function getStoreFeedPrefetchTasks(authSummary: AuthSessionSummary | null): PrefetchTask[] {
  return [
    {
      queryKey: ['visible-feed'],
      queryFn: getVisibleFeedPosts,
      enabled: Boolean(authSummary),
    },
  ]
}

function getStoreCompetitionsPrefetchTasks(authSummary: AuthSessionSummary | null): PrefetchTask[] {
  return [
    {
      queryKey: ['store-competitions'],
      queryFn: listCompetitions,
      enabled: hasAnyRole(authSummary, storeCompetitionRoles),
    },
  ]
}

function getAdminCompetitionsPrefetchTasks(authSummary: AuthSessionSummary | null): PrefetchTask[] {
  return [
    {
      queryKey: ['competitions'],
      queryFn: listCompetitions,
      enabled: hasAnyRole(authSummary, adminCompetitionRoles),
    },
  ]
}

function getStoreChecklistsPrefetchTasks(authSummary: AuthSessionSummary | null): PrefetchTask[] {
  const canReadChecklists = canReadChecklistResults(authSummary)
  const canManageChecklistVisits = hasAnyRole(authSummary, checklistVisitManagerRoles)

  return [
    {
      queryKey: ['checklist-acknowledgements'],
      queryFn: getChecklistAcknowledgements,
      enabled: canReadChecklists,
    },
    {
      queryKey: ['mobile-checklists-today'],
      queryFn: getMobileChecklistToday,
      enabled: canManageChecklistVisits,
    },
  ]
}

function getAdminIntegrationsPrefetchTasks(authSummary: AuthSessionSummary | null): PrefetchTask[] {
  const enabled = hasAnyRole(authSummary, adminIntegrationRoles)
  return [
    {
      queryKey: ['integration-overview'],
      queryFn: getImportOverview,
      enabled,
    },
    {
      queryKey: ['integration-needs-action', 0, '', ''],
      queryFn: () => getNeedsAction({ limit: 12, offset: 0 }),
      enabled,
    },
    {
      queryKey: ['integration-import-template', 'power_bi'],
      queryFn: () =>
        getImportPayloadTemplate({
          entityType: 'kpi',
          sourceSystem: 'power_bi',
        }),
      enabled,
    },
    {
      queryKey: ['integration-lookups'],
      queryFn: getIntegrationLookups,
      enabled,
    },
  ]
}

function getAdminOperationsPrefetchTasks(authSummary: AuthSessionSummary | null): PrefetchTask[] {
  const enabled = hasAnyRole(authSummary, adminOperationsRoles)

  return [
    {
      queryKey: ['operations-health'],
      queryFn: getOperationsHealth,
      enabled,
    },
    {
      queryKey: ['integration-overview'],
      queryFn: getImportOverview,
      enabled,
    },
    {
      queryKey: ['integration-needs-action', 0, '', '', 4],
      queryFn: () => getNeedsAction({ limit: 4, offset: 0 }),
      enabled,
    },
    {
      queryKey: ['snapshot-overview'],
      queryFn: getSnapshotOverview,
      enabled,
    },
    {
      queryKey: ['snapshot-needs-action', 0, '', '', 4],
      queryFn: () => getSnapshotNeedsAction({ limit: 4, offset: 0 }),
      enabled,
    },
  ]
}

function getAdminMasterDataPrefetchTasks(authSummary: AuthSessionSummary | null): PrefetchTask[] {
  return [
    {
      queryKey: ['master-data-bootstrap-batches', 'all', 'all', ''],
      queryFn: () => getMasterDataBootstrapBatches({ limit: 50, offset: 0 }),
      enabled: hasAnyRole(authSummary, adminMasterDataRoles),
    },
  ]
}

function getAdminFeedPrefetchTasks(authSummary: AuthSessionSummary | null): PrefetchTask[] {
  const enabled = hasAnyRole(authSummary, adminFeedRoles)
  return [
    {
      queryKey: ['admin-feed'],
      queryFn: getAdminFeedPosts,
      enabled,
    },
    {
      queryKey: ['auth-lookups'],
      queryFn: getAuthLookups,
      enabled,
    },
  ]
}

function getAdminInboxPrefetchTasks(authSummary: AuthSessionSummary | null): PrefetchTask[] {
  const inboxEnabled = hasAnyRole(authSummary, adminInboxRoles)
  const workforceEnabled = hasAnyRole(authSummary, adminInboxWorkforceRoles)
  return [
    {
      queryKey: ['workflow-inbox', 'admin'],
      queryFn: getWorkflowInbox,
      enabled: inboxEnabled,
    },
    {
      queryKey: ['seller-code-reference', 'franchise'],
      queryFn: getSellerCodeReference,
      enabled: workforceEnabled,
    },
    {
      queryKey: ['seller-code-requests', 'pending_hr_approval'],
      queryFn: () => getSellerCodeRequests({ status: 'pending_hr_approval' }),
      enabled: workforceEnabled,
    },
    {
      queryKey: ['offboarding-requests', 'pending_hr_approval'],
      queryFn: () => getOffboardingRequests({ status: 'pending_hr_approval' }),
      enabled: workforceEnabled,
    },
  ]
}

function getAdminTargetsPrefetchTasks(authSummary: AuthSessionSummary | null): PrefetchTask[] {
  const enabled = hasAnyRole(authSummary, adminTargetRoles)
  const currentRequestMonth = getCurrentRequestMonth()

  return [
    {
      queryKey: ['target-distribution-requests', 'approval-queue'],
      queryFn: () => getTargetDistributionRequests(),
      enabled,
    },
    {
      queryKey: ['target-distribution-coverage', currentRequestMonth],
      queryFn: () => getTargetCoverage({ requestMonth: currentRequestMonth }),
      enabled,
    },
  ]
}

function getCurrentRequestMonth() {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')

  return `${now.getFullYear()}-${month}-01`
}
