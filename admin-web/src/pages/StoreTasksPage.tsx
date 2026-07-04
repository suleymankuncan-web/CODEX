import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { RefreshCw } from 'lucide-react'
import type { AuthSessionSummary } from '../features/auth/api'
import {
  storeActionPlansActiveIndexQueryKey,
  storeActionPlansPageQueryKey,
  storeActionPlansResultIndexQueryKey,
  storeChecklistAcknowledgementsQueryKey,
  storeWorkflowInboxQueryKey,
} from '../features/auth/store-query-scope'
import { getChecklistAcknowledgements } from '../features/checklists/api'
import { useLocalization } from '../features/localization/useLocalization'
import {
  listStoreActionPlans,
  type StoreActionPlanStatus,
} from '../features/store-actions/api'
import {
  buildReadOnlyStoreActionCandidates,
  type ReadOnlyStoreActionCandidate,
} from '../features/store-actions/candidates'
import {
  StoreTasksAccessState,
  StoreTasksCommandCenter,
} from '../features/store-tasks/store-tasks-workbench'
import {
  ACTIVE_STORE_ACTION_PLAN_STATUSES,
  RESULT_STORE_ACTION_PLAN_STATUSES,
  buildStoreTaskCommandRows,
  buildStoreTasksSummary,
  filterStoreTaskRows,
  getCurrentMonthKey,
  getWorkflowSourceKey,
  mergeActionPlans,
  type StoreTaskFilter,
  type StoreTasksPersona,
} from '../features/store-tasks/store-tasks-command-center-model'
import { getWorkflowInbox } from '../features/workflow/api'
import type { WorkflowInboxItem } from '../features/workflow/contracts'
import { getUserFacingErrorMessage } from '../lib/format'
import { transientQueryRetryOptions } from '../lib/query-retry'
import {
  StoreErrorState,
  StoreLoadingState,
  StoreSurfacePage,
} from './store-surface-primitives'

const STORE_ACTION_PLAN_PAGE_SIZE = 20
const STORE_ACTION_PLAN_INDEX_LIMIT = 100

function canUseWorkflowInbox(authSummary: AuthSessionSummary | null) {
  const roles = authSummary?.user.roleCodes ?? []
  return (
    roles.includes('STORE_MANAGER') ||
    roles.includes('SUPER_ADMIN') ||
    roles.includes('REPORT_VIEWER') ||
    roles.includes('REGION_MANAGER')
  )
}

function canReadStoreActionPlans(authSummary: AuthSessionSummary | null) {
  const roles = authSummary?.user.roleCodes ?? []
  return roles.includes('STORE_MANAGER') || roles.includes('SUPER_ADMIN') || roles.includes('REGION_MANAGER')
}

function canMutateStoreActionPlans(authSummary: AuthSessionSummary | null) {
  const roles = authSummary?.user.roleCodes ?? []
  return roles.includes('STORE_MANAGER') || roles.includes('SUPER_ADMIN')
}

function resolveTaskPersona(authSummary: AuthSessionSummary | null): StoreTasksPersona {
  const roles = authSummary?.user.roleCodes ?? []
  if (roles.includes('STORE_MANAGER') || roles.includes('SUPER_ADMIN')) return 'storeManager'
  if (roles.includes('REGION_MANAGER')) return 'regionManager'
  return 'readOnly'
}

async function listStoreActionPlansByStatuses(statuses: readonly StoreActionPlanStatus[]) {
  const responses = await Promise.all(
    statuses.map((status) =>
      listStoreActionPlans({
        status,
        limit: STORE_ACTION_PLAN_INDEX_LIMIT,
        offset: 0,
      }),
    ),
  )

  return mergeActionPlans(responses.flatMap((response) => response.items), [])
}

export function StoreTasksPage(input: {
  authSummary: AuthSessionSummary | null
}) {
  const { locale, t } = useLocalization()
  const queryClient = useQueryClient()
  const inboxEnabled = canUseWorkflowInbox(input.authSummary)
  const storeActionPlansEnabled = canReadStoreActionPlans(input.authSummary)
  const canMutatePlans = canMutateStoreActionPlans(input.authSummary)
  const persona = resolveTaskPersona(input.authSummary)
  const [storeActionPlansOffset, setStoreActionPlansOffset] = useState(0)
  const [selectedPeriod, setSelectedPeriod] = useState(() => getCurrentMonthKey())
  const regionMode = 'results'
  const [activeFilter, setActiveFilter] = useState<StoreTaskFilter>('all')
  const [search, setSearch] = useState('')
  const workflowInboxQueryKey = useMemo(
    () => storeWorkflowInboxQueryKey(input.authSummary),
    [input.authSummary],
  )
  const storeActionPlansPageKey = useMemo(
    () => storeActionPlansPageQueryKey(input.authSummary, storeActionPlansOffset),
    [input.authSummary, storeActionPlansOffset],
  )
  const activeStoreActionPlansQueryKey = useMemo(
    () => storeActionPlansActiveIndexQueryKey(input.authSummary),
    [input.authSummary],
  )
  const resultStoreActionPlansQueryKey = useMemo(
    () => storeActionPlansResultIndexQueryKey(input.authSummary),
    [input.authSummary],
  )
  const checklistAcknowledgementsQueryKey = useMemo(
    () => storeChecklistAcknowledgementsQueryKey(input.authSummary),
    [input.authSummary],
  )

  const inboxQuery = useQuery({
    queryKey: workflowInboxQueryKey,
    queryFn: getWorkflowInbox,
    enabled: inboxEnabled,
    ...transientQueryRetryOptions,
  })
  const storeActionPlansPageQuery = useQuery({
    queryKey: storeActionPlansPageKey,
    queryFn: () =>
      listStoreActionPlans({
        limit: STORE_ACTION_PLAN_PAGE_SIZE,
        offset: storeActionPlansOffset,
      }),
    enabled: storeActionPlansEnabled && persona !== 'regionManager',
    ...transientQueryRetryOptions,
  })
  const activeStoreActionPlansQuery = useQuery({
    queryKey: activeStoreActionPlansQueryKey,
    queryFn: () => listStoreActionPlansByStatuses(ACTIVE_STORE_ACTION_PLAN_STATUSES),
    enabled: storeActionPlansEnabled && persona !== 'regionManager',
    ...transientQueryRetryOptions,
  })
  const resultStoreActionPlansQuery = useQuery({
    queryKey: resultStoreActionPlansQueryKey,
    queryFn: () => listStoreActionPlansByStatuses(RESULT_STORE_ACTION_PLAN_STATUSES),
    enabled: storeActionPlansEnabled,
    ...transientQueryRetryOptions,
  })

  const items = useMemo(() => inboxQuery.data?.items ?? [], [inboxQuery.data?.items])
  const sortedItems = useMemo(() => sortWorkflowItems(items), [items])
  const actionCandidates = useMemo(
    () => buildReadOnlyStoreActionCandidates(items),
    [items],
  )
  const actionCandidatesBySource = useMemo(
    () =>
      new Map<string, ReadOnlyStoreActionCandidate>(
        actionCandidates.map((candidate) => [
          getWorkflowSourceKey(candidate.storeId, candidate.sourceType, candidate.sourceId),
          candidate,
        ] as [string, ReadOnlyStoreActionCandidate]),
      ),
    [actionCandidates],
  )
  const storeActionPlans = useMemo(
    () =>
      mergeActionPlans(
        storeActionPlansPageQuery.data?.items ?? [],
        mergeActionPlans(activeStoreActionPlansQuery.data ?? [], resultStoreActionPlansQuery.data ?? []),
      ),
    [
      activeStoreActionPlansQuery.data,
      resultStoreActionPlansQuery.data,
      storeActionPlansPageQuery.data?.items,
    ],
  )
  const rows = useMemo(
    () =>
      buildStoreTaskCommandRows({
        plans: storeActionPlans,
        workflowItems: sortedItems,
        actionCandidatesBySource,
        selectedPeriod,
        locale,
      }),
    [actionCandidatesBySource, locale, selectedPeriod, sortedItems, storeActionPlans],
  )
  const rowsForSummary = useMemo(
    () =>
      filterStoreTaskRows({
        rows,
        persona,
        regionMode,
        activeFilter: 'all',
        search: '',
      }),
    [persona, regionMode, rows],
  )
  const visibleRows = useMemo(
    () =>
      filterStoreTaskRows({
        rows,
        persona,
        regionMode,
        activeFilter,
        search,
      }),
    [activeFilter, persona, regionMode, rows, search],
  )
  const summary = useMemo(() => buildStoreTasksSummary(rowsForSummary), [rowsForSummary])
  const actionPlanError =
    storeActionPlansPageQuery.error ??
    activeStoreActionPlansQuery.error ??
    resultStoreActionPlansQuery.error
  const actionPlansAreLoading =
    storeActionPlansEnabled &&
    (storeActionPlansPageQuery.isLoading ||
      activeStoreActionPlansQuery.isLoading ||
      resultStoreActionPlansQuery.isLoading)
  const actionPlansAreFetching =
    storeActionPlansPageQuery.isFetching ||
    activeStoreActionPlansQuery.isFetching ||
    resultStoreActionPlansQuery.isFetching

  useEffect(() => {
    if (!items.some((item) => item.sourceType === 'checklist_receipt')) return

    void queryClient.prefetchQuery({
      queryKey: checklistAcknowledgementsQueryKey,
      queryFn: () => getChecklistAcknowledgements(),
      ...transientQueryRetryOptions,
    }).catch(() => undefined)
  }, [checklistAcknowledgementsQueryKey, items, queryClient])

  if (!inboxEnabled) {
    return (
      <StoreSurfacePage ariaLabel={t('storeTasks.unavailableEyebrow')}>
        <StoreTasksAccessState authSummary={input.authSummary} />
      </StoreSurfacePage>
    )
  }

  if (inboxQuery.isLoading) {
    return <StoreLoadingState title="Görevler yükleniyor" description="Mağaza aksiyonları hazırlanıyor." />
  }

  if (inboxQuery.isError) {
    return (
      <StoreSurfacePage ariaLabel="Görevler">
        <StoreErrorState
          title="Görevler açılamadı"
          description={getUserFacingErrorMessage(
            inboxQuery.error,
            'Görevler alınamadı. Dönemi kontrol edip tekrar deneyin.',
          )}
          action={{
            disabled: inboxQuery.isFetching,
            icon: <RefreshCw data-icon="inline-start" />,
            label: inboxQuery.isFetching ? 'Yenileniyor' : 'Tekrar dene',
            onClick: () => void inboxQuery.refetch(),
            variant: 'outline',
          }}
        />
      </StoreSurfacePage>
    )
  }

  return (
    <StoreSurfacePage ariaLabel="Görevler" className="tw:mx-auto tw:w-full tw:max-w-[1360px]">
      <StoreTasksCommandCenter
        rows={visibleRows}
        allRows={rows}
        summary={summary}
        persona={persona}
        regionMode={regionMode}
        selectedPeriod={selectedPeriod}
        search={search}
        activeFilter={activeFilter}
        locale={locale}
        canMutate={canMutatePlans}
        isLoading={actionPlansAreLoading}
        isFetching={actionPlansAreFetching || inboxQuery.isFetching}
        error={actionPlanError}
        pageMeta={storeActionPlansPageQuery.data?.meta}
        onSearchChange={setSearch}
        onActiveFilterChange={setActiveFilter}
        onSelectedPeriodChange={setSelectedPeriod}
        onRefresh={() => {
          void Promise.all([
            inboxQuery.refetch(),
            storeActionPlansPageQuery.refetch(),
            activeStoreActionPlansQuery.refetch(),
            resultStoreActionPlansQuery.refetch(),
          ])
        }}
        onActionPlanCreated={() => setStoreActionPlansOffset(0)}
        onRetryActionPlans={() => {
          void Promise.all([
            storeActionPlansPageQuery.refetch(),
            activeStoreActionPlansQuery.refetch(),
            resultStoreActionPlansQuery.refetch(),
          ])
        }}
        onPreviousPage={() =>
          setStoreActionPlansOffset((offset) => Math.max(0, offset - STORE_ACTION_PLAN_PAGE_SIZE))
        }
        onNextPage={() =>
          setStoreActionPlansOffset((offset) => offset + STORE_ACTION_PLAN_PAGE_SIZE)
        }
      />
    </StoreSurfacePage>
  )
}

function sortWorkflowItems(items: readonly WorkflowInboxItem[]) {
  const urgencyRank = { high: 0, medium: 1, low: 2 }
  const statusRank = { needs_attention: 0, informational: 1, completed: 2 }

  return items.toSorted((left, right) => {
    const statusDelta = statusRank[left.inboxStatus] - statusRank[right.inboxStatus]
    if (statusDelta !== 0) return statusDelta

    const urgencyDelta = urgencyRank[left.urgency] - urgencyRank[right.urgency]
    if (urgencyDelta !== 0) return urgencyDelta

    const leftTime = new Date(left.needsAttentionAt ?? left.createdAt ?? 0).getTime()
    const rightTime = new Date(right.needsAttentionAt ?? right.createdAt ?? 0).getTime()
    return rightTime - leftTime
  })
}
