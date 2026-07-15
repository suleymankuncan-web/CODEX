import type { QueryClient, QueryKey } from '@tanstack/react-query'
import { getAuthLookups, type AuthSessionSummary } from '../features/auth/api'
import {
  canCreateTargetDistributionRequest,
  canListTargetDistributionRequests,
  canReadChecklistResults,
  getAssignedStoreIds,
  hasAnyRole,
} from '../features/auth/authorization'
import {
  storeChecklistAcknowledgementsQueryKey,
  storeMobileChecklistsTodayQueryKey,
  storeWorkflowInboxQueryKey,
} from '../features/auth/store-query-scope'
import {
  getChecklistAcknowledgements,
  getMobileChecklistToday,
} from '../features/checklists/api'
import { listCompetitions } from '../features/competitions/api'
import {
  getAdminFeedPosts,
  getAdminFeedQueryKey,
  getVisibleFeedPosts,
  getVisibleFeedQueryKey,
} from '../features/feed/api'
import {
  getStoreSalesTargetIncentiveWorkspace,
  storeSalesTargetIncentiveWorkspaceQueryKey,
} from '../features/incentives/api'
import { getSalesTargetIncentiveWorkspaceQueryIdentity } from '../features/incentives/query-identity'
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
  getTargetDistributionRequests,
  getStoreTargetingPersonnel,
  getTargetCoverage,
} from '../features/targets/api'
import {
  getOffboardingRequests,
  getSellerCodeReference,
  getSellerCodeRequests,
} from '../features/workforce/api'
import { getWorkflowInbox } from '../features/workflow/api'
import { transientQueryRetryOptions } from '../lib/query-retry'
import {
  canOpenStoreIncentives,
  findStoreRouteDefinition,
  type StoreRouteId,
} from './store-route-registry'

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

const rankingRoles = ['STORE_PERSONNEL', 'STORE_MANAGER', 'REGION_MANAGER', 'SUPER_ADMIN', 'REPORT_VIEWER']
const adminFeedRoles = ['SUPER_ADMIN', 'HR_ADMIN', 'REGION_MANAGER']
const adminInboxRoles = ['SUPER_ADMIN', 'REPORT_VIEWER', 'HR_ADMIN']
const adminInboxWorkforceRoles = ['SUPER_ADMIN', 'HR_ADMIN']
const adminCompetitionRoles = ['SUPER_ADMIN', 'HR_ADMIN', 'REPORT_VIEWER', 'REGION_MANAGER']
const adminIntegrationRoles = ['SUPER_ADMIN', 'INTEGRATION_ADMIN']
const adminMasterDataRoles = ['SUPER_ADMIN', 'HR_ADMIN', 'INTEGRATION_ADMIN']
const adminOperationsRoles = ['SUPER_ADMIN']
const adminDataQualityRoles = ['SUPER_ADMIN']
const adminTargetRoles = ['SUPER_ADMIN', 'REPORT_VIEWER', 'REGION_MANAGER']
const storeCompetitionRoles = ['STORE_PERSONNEL', 'STORE_MANAGER', 'REPORT_VIEWER']
const storeReportingRoles = ['SUPER_ADMIN', 'REPORT_VIEWER', 'AUDITOR', 'REGION_MANAGER']
const workflowInboxRoles = ['STORE_MANAGER', 'SUPER_ADMIN', 'REPORT_VIEWER', 'REGION_MANAGER']
const checklistVisitManagerRoles = ['REGION_MANAGER', 'VISUAL_MERCHANDISER', 'SUPER_ADMIN']
const routePrefetchStaleTimeMs = 30_000
const storeRouteDataPrefetchAllowedRoutes = new Set<StoreRouteId>(['home', 'feed', 'incentives'])

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
  const storeRoute = findStoreRouteDefinition(pathname)
  if (storeRoute) {
    return getStoreRoutePrefetchTasks(storeRoute.id, authSummary)
  }

  if (pathname === '/admin/integrations') {
    return getAdminIntegrationsPrefetchTasks(authSummary)
  }

  if (pathname === '/admin/operations') {
    return getAdminOperationsPrefetchTasks(authSummary)
  }

  if (pathname === '/admin/data-quality') {
    return getAdminDataQualityPrefetchTasks(authSummary)
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

function getStoreRoutePrefetchTasks(
  routeId: StoreRouteId,
  authSummary: AuthSessionSummary | null,
): PrefetchTask[] {
  if (!storeRouteDataPrefetchAllowedRoutes.has(routeId)) {
    return []
  }

  switch (routeId) {
    case 'home':
      return getStoreHomePrefetchTasks(authSummary)
    case 'me':
      return getStoreMePrefetchTasks(authSummary)
    case 'kpis':
      return getStoreKpiPrefetchTasks(authSummary)
    case 'rankings':
      return getStoreRankingsPrefetchTasks(authSummary)
    case 'checklists':
      return getStoreChecklistsPrefetchTasks(authSummary)
    case 'feed':
      return getStoreFeedPrefetchTasks(authSummary)
    case 'competitions':
      return getStoreCompetitionsPrefetchTasks(authSummary)
    case 'tasks':
      return getStoreTasksPrefetchTasks(authSummary)
    case 'approvals':
      return canListTargetDistributionRequests(authSummary)
        ? getStoreApprovalsPrefetchTasks(authSummary)
        : []
    case 'incentives':
      return getStoreIncentivesPrefetchTasks(authSummary)
    case 'targets':
      return getStoreTargetsPrefetchTasks(authSummary)
    case 'personnel':
    case 'reports':
    case 'settings':
    case 'workforce':
      return []
    default:
      return []
  }
}

function getStoreIncentivesPrefetchTasks(authSummary: AuthSessionSummary | null): PrefetchTask[] {
  const incentivesQueryIdentity = getSalesTargetIncentiveWorkspaceQueryIdentity(authSummary)

  return [
    {
      queryKey: storeSalesTargetIncentiveWorkspaceQueryKey(undefined, incentivesQueryIdentity),
      queryFn: () => getStoreSalesTargetIncentiveWorkspace(),
      enabled: canOpenStoreIncentives(authSummary),
    },
  ]
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
      queryKey: storeWorkflowInboxQueryKey(authSummary),
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
  const hasRegionManagerRole = hasAnyRole(authSummary, ['REGION_MANAGER'])
  const hasGlobalStoreDetailDefault = hasAnyRole(authSummary, [
    'SUPER_ADMIN',
    'REPORT_VIEWER',
    'AUDITOR',
  ])
  const hasStoreDetailDefault =
    (!hasRegionManagerRole || hasGlobalStoreDetailDefault) && hasAnyRole(authSummary, [
      'SUPER_ADMIN',
      'REPORT_VIEWER',
      'AUDITOR',
      'STORE_MANAGER',
    ])

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
      enabled: reportingAllowed && (!hasRegionManagerRole || hasStoreDetailDefault),
    },
    {
      queryKey: ['store-kpis-region-overview', 'monthly', '', 'score', 'desc', authSummary?.user.userId ?? '', 0],
      queryFn: () =>
        getRankings({
          periodType: 'monthly',
          ...(authSummary?.user.userId ? { regionManagerUserId: authSummary.user.userId } : {}),
          sortKey: 'score',
          sortDirection: 'desc',
          limit: 100,
          offset: 0,
        }),
      enabled:
        reportingAllowed &&
        hasRegionManagerRole &&
        !hasGlobalStoreDetailDefault &&
        Boolean(authSummary?.user.userId),
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
      queryKey: getVisibleFeedQueryKey(authSummary),
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
      queryKey: storeChecklistAcknowledgementsQueryKey(authSummary),
      queryFn: getChecklistAcknowledgements,
      enabled: canReadChecklists,
    },
    {
      queryKey: storeMobileChecklistsTodayQueryKey(authSummary),
      queryFn: getMobileChecklistToday,
      enabled: canManageChecklistVisits,
    },
  ]
}

function getStoreTargetsPrefetchTasks(authSummary: AuthSessionSummary | null): PrefetchTask[] {
  const enabled = canListTargetDistributionRequests(authSummary)
  const currentRequestMonth = getCurrentRequestMonth()
  const assignedStoreId = getAssignedStoreIds(authSummary)[0] ?? ''

  return [
    {
      queryKey: [
        'target-distribution-requests',
        'store-targets',
        currentRequestMonth,
        assignedStoreId || 'all',
      ],
      queryFn: () =>
        getTargetDistributionRequests({
          requestMonth: currentRequestMonth,
          ...(assignedStoreId ? { storeId: assignedStoreId } : {}),
          limit: 200,
          offset: 0,
        }),
      enabled,
    },
    {
      queryKey: ['target-distribution-coverage', 'store-targets', currentRequestMonth, 'all'],
      queryFn: () => getTargetCoverage({ requestMonth: currentRequestMonth }),
      enabled,
    },
    {
      queryKey: ['store-targeting-personnel', 'store-targets', assignedStoreId],
      queryFn: () => getStoreTargetingPersonnel(assignedStoreId),
      enabled: canCreateTargetDistributionRequest(authSummary, assignedStoreId || null),
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

function getAdminDataQualityPrefetchTasks(authSummary: AuthSessionSummary | null): PrefetchTask[] {
  const enabled = hasAnyRole(authSummary, adminDataQualityRoles)

  return [
    {
      queryKey: ['integration-overview'],
      queryFn: getImportOverview,
      enabled,
    },
    {
      queryKey: ['integration-needs-action', 0, '', '', 6],
      queryFn: () => getNeedsAction({ limit: 6, offset: 0 }),
      enabled,
    },
    {
      queryKey: ['snapshot-overview'],
      queryFn: getSnapshotOverview,
      enabled,
    },
    {
      queryKey: ['snapshot-needs-action', 0, '', '', 6],
      queryFn: () => getSnapshotNeedsAction({ limit: 6, offset: 0 }),
      enabled,
    },
    {
      queryKey: ['seller-code-requests', 'pending_hr_approval'],
      queryFn: () => getSellerCodeRequests({ status: 'pending_hr_approval' }),
      enabled,
    },
    {
      queryKey: ['offboarding-requests', 'pending_hr_approval'],
      queryFn: () => getOffboardingRequests({ status: 'pending_hr_approval' }),
      enabled,
    },
    {
      queryKey: ['kpi-config'],
      queryFn: getKpiConfig,
      enabled,
    },
    {
      queryKey: ['operations-rankings', 'monthly', 1],
      queryFn: () => getRankings({ limit: 1 }),
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
      queryKey: getAdminFeedQueryKey(authSummary),
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
      queryKey: ['target-distribution-requests', 'approval-queue', 'pending', 50, 0],
      queryFn: () => getTargetDistributionRequests({
        status: 'pending_region_approval',
        limit: 50,
        offset: 0,
      }),
      enabled,
    },
    {
      queryKey: ['target-distribution-requests', 'approval-queue', 'approved-recent', 5, 0],
      queryFn: () => getTargetDistributionRequests({
        status: 'approved',
        limit: 5,
        offset: 0,
      }),
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
