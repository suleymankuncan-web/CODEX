import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CheckCircle2,
  ClipboardList,
  ListChecks,
  RefreshCw,
  Search,
  Target,
  TrendingDown,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import type { AuthSessionSummary } from '../features/auth/api'
import { getChecklistAcknowledgements } from '../features/checklists/api'
import type { TranslateFunction } from '../features/localization/dictionary'
import { useLocalization } from '../features/localization/useLocalization'
import {
  listStoreActionPlans,
  type StoreActionPlan,
  type StoreActionPlanStatus,
} from '../features/store-actions/api'
import {
  buildReadOnlyStoreActionCandidates,
  type ReadOnlyStoreActionCandidate,
} from '../features/store-actions/candidates'
import { getStoreApprovalsPrefetchTasks } from '../features/store-approvals/prefetch'
import {
  AccessState,
  SummaryGrid,
  StoreTasksWorkbenchBody,
  WorkbenchHeader,
  WorkbenchTabs,
} from '../features/store-tasks/store-tasks-workbench'
import {
  formatActionPlanDate,
  formatDisplayRoleLabels,
  formatStoreActionPlanPriority,
  formatStoreActionPlanSource,
  formatStoreActionPlanStatus,
  formatWorkflowInboxStatusLabel,
  formatWorkflowSourceType,
  formatWorkflowUrgencyLabel,
  getPlanSourceKey,
  getWorkflowSourceKey,
  mapStoreActionPlanPriorityTone,
  mapStoreActionPlanStatusTone,
  mapWorkflowTone,
  mapWorkflowUrgencyTone,
  type TaskPersona,
  type WorkbenchRow,
  type WorkbenchRowFamily,
  type WorkbenchRowState,
  type WorkbenchSummary,
  type WorkbenchTabId,
} from '../features/store-tasks/store-tasks-workbench-model'
import { getWorkflowInbox } from '../features/workflow/api'
import type { WorkflowInboxItem } from '../features/workflow/contracts'
import { formatDateTime, getErrorMessage } from '../lib/format'
import type { AppLocale } from '../lib/i18n'
import { transientQueryRetryOptions } from '../lib/query-retry'
import {
  StoreErrorState,
  StoreLoadingState,
  StoreStatusBadge,
  StoreSurfacePage,
} from './store-surface-primitives'

const STORE_ACTION_PLAN_PAGE_SIZE = 20
const STORE_ACTION_PLAN_ACTIVE_INDEX_LIMIT = 100
const ACTIVE_STORE_ACTION_PLAN_STATUSES = [
  'open',
  'in_progress',
  'blocked',
] as const satisfies readonly StoreActionPlanStatus[]

function canUseWorkflowInbox(authSummary: AuthSessionSummary | null) {
  const roles = authSummary?.user.roleCodes ?? []
  return (
    roles.includes('STORE_MANAGER') ||
    roles.includes('SUPER_ADMIN') ||
    roles.includes('REPORT_VIEWER') ||
    roles.includes('REGION_MANAGER')
  )
}

function canUseStoreActionPlans(authSummary: AuthSessionSummary | null) {
  const roles = authSummary?.user.roleCodes ?? []
  return roles.includes('STORE_MANAGER') || roles.includes('SUPER_ADMIN')
}

function resolveTaskPersona(authSummary: AuthSessionSummary | null): TaskPersona {
  const roles = authSummary?.user.roleCodes ?? []
  if (roles.includes('STORE_MANAGER') || roles.includes('SUPER_ADMIN')) return 'storeManager'
  if (roles.includes('REGION_MANAGER')) return 'regionManager'
  return 'readOnly'
}

async function listActiveStoreActionPlans() {
  const responses = await Promise.all(
    ACTIVE_STORE_ACTION_PLAN_STATUSES.map((status) =>
      listStoreActionPlans({
        status,
        limit: STORE_ACTION_PLAN_ACTIVE_INDEX_LIMIT,
        offset: 0,
      }),
    ),
  )

  return mergeActionPlans(responses.flatMap((response) => response.items), [])
}

function mergeActionPlans(
  primaryPlans: readonly StoreActionPlan[],
  supplementalPlans: readonly StoreActionPlan[],
) {
  const plansById = new Map<string, StoreActionPlan>()
  for (const plan of primaryPlans) {
    plansById.set(plan.actionPlanId, plan)
  }
  for (const plan of supplementalPlans) {
    if (!plansById.has(plan.actionPlanId)) {
      plansById.set(plan.actionPlanId, plan)
    }
  }
  return [...plansById.values()]
}

export function StoreTasksPage(input: {
  authSummary: AuthSessionSummary | null
}) {
  const { locale, t } = useLocalization()
  const queryClient = useQueryClient()
  const inboxEnabled = canUseWorkflowInbox(input.authSummary)
  const storeActionPlansEnabled = canUseStoreActionPlans(input.authSummary)
  const persona = resolveTaskPersona(input.authSummary)
  const [storeActionPlansOffset, setStoreActionPlansOffset] = useState(0)
  const [activeTab, setActiveTab] = useState<WorkbenchTabId>('all')
  const [search, setSearch] = useState('')
  const primaryStoreId = input.authSummary?.user.scope.storeIds[0] ?? t('storeTasks.noStoreScope')
  const inboxQuery = useQuery({
    queryKey: ['workflow-inbox'],
    queryFn: getWorkflowInbox,
    enabled: inboxEnabled,
    ...transientQueryRetryOptions,
  })
  const storeActionPlansQuery = useQuery({
    queryKey: ['store-action-plans', 'store-tasks', storeActionPlansOffset],
    queryFn: () =>
      listStoreActionPlans({
        limit: STORE_ACTION_PLAN_PAGE_SIZE,
        offset: storeActionPlansOffset,
      }),
    enabled: storeActionPlansEnabled,
    ...transientQueryRetryOptions,
  })
  const activeStoreActionPlansQuery = useQuery({
    queryKey: ['store-action-plans', 'store-tasks', 'active-index'],
    queryFn: listActiveStoreActionPlans,
    enabled: storeActionPlansEnabled,
    ...transientQueryRetryOptions,
  })

  const items = useMemo(() => inboxQuery.data?.items ?? [], [inboxQuery.data?.items])
  const storeActionPlans = useMemo(
    () => storeActionPlansQuery.data?.items ?? [],
    [storeActionPlansQuery.data?.items],
  )
  const activeStoreActionPlans = useMemo(
    () => activeStoreActionPlansQuery.data ?? [],
    [activeStoreActionPlansQuery.data],
  )
  const visibleStoreActionPlans = useMemo(
    () => mergeActionPlans(storeActionPlans, activeStoreActionPlans),
    [activeStoreActionPlans, storeActionPlans],
  )
  const storeActionPlansMeta = storeActionPlansQuery.data?.meta

  useEffect(() => {
    if (
      !storeActionPlansEnabled ||
      storeActionPlansQuery.isFetching ||
      !storeActionPlansMeta ||
      storeActionPlans.length > 0 ||
      storeActionPlansMeta.total === 0 ||
      storeActionPlansOffset === 0
    ) {
      return
    }

    const lastAvailableOffset =
      Math.floor((storeActionPlansMeta.total - 1) / STORE_ACTION_PLAN_PAGE_SIZE) *
      STORE_ACTION_PLAN_PAGE_SIZE
    const previousPageOffset = Math.max(0, storeActionPlansOffset - STORE_ACTION_PLAN_PAGE_SIZE)
    const nextOffset = Math.min(lastAvailableOffset, previousPageOffset)

    const timeoutId = window.setTimeout(() => {
      setStoreActionPlansOffset(nextOffset)
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [
    storeActionPlans.length,
    storeActionPlansEnabled,
    storeActionPlansMeta,
    storeActionPlansOffset,
    storeActionPlansQuery.isFetching,
  ])

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
  const rows = useMemo(
    () =>
      buildWorkbenchRows({
        plans: visibleStoreActionPlans,
        workflowItems: sortedItems,
        suppressAllWorkflowActionPlanRows:
          storeActionPlansEnabled &&
          !storeActionPlansQuery.isError &&
          (storeActionPlansMeta?.total ?? 0) > 0 &&
          (storeActionPlansMeta?.total ?? 0) <= storeActionPlans.length,
        actionCandidatesBySource,
        locale,
        t,
      }),
    [
      actionCandidatesBySource,
      locale,
      sortedItems,
      storeActionPlans,
      storeActionPlansEnabled,
      storeActionPlansMeta?.total,
      storeActionPlansQuery.isError,
      t,
      visibleStoreActionPlans,
    ],
  )
  const workbenchRecordCount = useMemo(
    () =>
      (storeActionPlansEnabled
        ? (storeActionPlansMeta?.total ?? storeActionPlans.length)
        : 0) + rows.filter((row) => row.source === 'workflow').length,
    [rows, storeActionPlans.length, storeActionPlansEnabled, storeActionPlansMeta?.total],
  )
  const filteredRows = useMemo(
    () => filterRowsBySearchAndTab(rows, search, activeTab),
    [activeTab, rows, search],
  )
  const visibleRows = useMemo(() => sortRowsForWorkbench(filteredRows), [filteredRows])
  const summary = useMemo(() => buildSummary(rows), [rows])
  const tabs = useMemo(() => buildTabs(rows, t), [rows, t])
  const hasChecklistReceiptAction = useMemo(
    () => items.some((item) => item.sourceType === 'checklist_receipt'),
    [items],
  )
  const hasStoreApprovalAction = useMemo(
    () =>
      items.some(
        (item) =>
          item.sourceType === 'target_distribution_request' ||
          item.deepLink.startsWith('/store/approvals'),
      ),
    [items],
  )

  useEffect(() => {
    if (!hasChecklistReceiptAction) return

    void queryClient.prefetchQuery({
      queryKey: ['checklist-acknowledgements'],
      queryFn: getChecklistAcknowledgements,
      ...transientQueryRetryOptions,
    }).catch(() => undefined)
  }, [hasChecklistReceiptAction, queryClient])

  useEffect(() => {
    if (!hasStoreApprovalAction || !input.authSummary) return

    getStoreApprovalsPrefetchTasks(input.authSummary).forEach((task) => {
      if (task.enabled === false) {
        return
      }

      void queryClient.prefetchQuery({
        queryKey: task.queryKey,
        queryFn: task.queryFn,
        ...transientQueryRetryOptions,
      }).catch(() => undefined)
    })
  }, [hasStoreApprovalAction, input.authSummary, queryClient])

  if (!inboxEnabled) {
    return (
      <StoreSurfacePage ariaLabel={t('storeTasks.unavailableEyebrow')}>
        <AccessState authSummary={input.authSummary} primaryStoreId={primaryStoreId} t={t} />
      </StoreSurfacePage>
    )
  }

  if (inboxQuery.isLoading) {
    return <StoreLoadingState title={t('storeTasks.loadingTitle')} description={t('storeTasks.loadingCopy')} />
  }

  if (inboxQuery.isError) {
    return (
      <StoreSurfacePage ariaLabel={t('storeTasks.title')}>
        <StoreErrorState
          title={t('storeTasks.errorTitle')}
          description={getErrorMessage(inboxQuery.error)}
          action={{
            disabled: inboxQuery.isFetching,
            icon: <RefreshCw data-icon="inline-start" />,
            label: inboxQuery.isFetching ? t('storeTasks.retryingAction') : t('storeTasks.retryAction'),
            onClick: () => void inboxQuery.refetch(),
            variant: 'outline',
          }}
        />
      </StoreSurfacePage>
    )
  }

  return (
    <StoreSurfacePage ariaLabel={t('storeTasks.title')} className="tw:gap-3">
      <WorkbenchHeader
        persona={persona}
        summary={summary}
        primaryStoreId={primaryStoreId}
        roleLabel={formatDisplayRoleLabels(t, input.authSummary?.user.roleCodes)}
        t={t}
      />

      <SummaryGrid summary={summary} persona={persona} t={t} />

      <Card className="tw:overflow-hidden tw:border-border/80 tw:bg-card/85 tw:shadow-sm">
        <CardContent className="tw:p-3">
          <div className="tw:flex tw:flex-col tw:gap-3 tw:lg:flex-row tw:lg:items-center tw:lg:justify-between">
            <label className="tw:flex tw:min-h-10 tw:flex-1 tw:items-center tw:gap-2 tw:rounded-xl tw:border tw:border-border tw:bg-background/85 tw:px-3 tw:text-sm tw:shadow-xs tw:lg:max-w-md">
              <Search className="tw:size-4 tw:text-muted-foreground" />
              <span className="tw:sr-only">{t('storeTasks.searchLabel')}</span>
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t('storeTasks.searchPlaceholder')}
                className="tw:h-8 tw:border-0 tw:bg-transparent tw:px-0 tw:shadow-none tw:focus-visible:ring-0"
              />
            </label>
            <div className="tw:flex tw:flex-wrap tw:gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={inboxQuery.isFetching || storeActionPlansQuery.isFetching}
                onClick={() => {
                  void inboxQuery.refetch()
                  if (storeActionPlansEnabled) void storeActionPlansQuery.refetch()
                }}
              >
                <RefreshCw data-icon="inline-start" />
                {t('storeTasks.refreshAction')}
              </Button>
              <Button asChild variant="outline">
                <Link to="/store/checklists">
                  <ClipboardList data-icon="inline-start" />
                  {t('storeTasks.checklistsLink')}
                </Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card
        data-testid="store-action-plans-panel"
        className="tw:overflow-hidden tw:border-border/80 tw:bg-card/90 tw:shadow-sm"
      >
        <CardHeader className="tw:border-b tw:border-border/70 tw:bg-muted/25 tw:p-0">
          <div className="tw:flex tw:flex-col tw:gap-3 tw:p-4 tw:md:flex-row tw:md:items-start tw:md:justify-between">
            <div>
              <CardTitle>
                <h2 className="tw:text-base tw:font-semibold tw:leading-snug tw:text-foreground">
                  {t('storeTasks.actionPlansTitle')}
                </h2>
              </CardTitle>
              <CardDescription className="tw:mt-1">
                {persona === 'regionManager'
                  ? t('storeTasks.workbenchRegionDescription')
                  : t('storeTasks.workbenchStoreDescription')}
              </CardDescription>
            </div>
            <StoreStatusBadge tone={summary.pending > 0 ? 'warning' : 'calm'}>
              {t('storeTasks.actionPlansCount', { count: workbenchRecordCount })}
            </StoreStatusBadge>
          </div>
          <WorkbenchTabs activeTab={activeTab} tabs={tabs} onTabChange={setActiveTab} />
        </CardHeader>
        <CardContent className="tw:p-0">
          <StoreTasksWorkbenchBody
            rows={visibleRows}
            allRows={rows}
            search={search}
            persona={persona}
            storeActionPlansEnabled={storeActionPlansEnabled}
            storeActionPlansMeta={storeActionPlansMeta}
            isStoreActionPlansLoading={storeActionPlansQuery.isLoading}
            isStoreActionPlansError={storeActionPlansQuery.isError}
            isStoreActionPlansFetching={storeActionPlansQuery.isFetching}
            storeActionPlansError={storeActionPlansQuery.error}
            locale={locale}
            t={t}
            onActionPlanCreated={() => setStoreActionPlansOffset(0)}
            onRetryStoreActionPlans={() => void storeActionPlansQuery.refetch()}
            onPreviousPage={() =>
              setStoreActionPlansOffset((offset) => Math.max(0, offset - STORE_ACTION_PLAN_PAGE_SIZE))
            }
            onNextPage={() =>
              setStoreActionPlansOffset((offset) => offset + STORE_ACTION_PLAN_PAGE_SIZE)
            }
          />
        </CardContent>
      </Card>
    </StoreSurfacePage>
  )
}

function buildWorkbenchRows(input: {
  plans: readonly StoreActionPlan[]
  workflowItems: readonly WorkflowInboxItem[]
  suppressAllWorkflowActionPlanRows: boolean
  actionCandidatesBySource: Map<string, ReadOnlyStoreActionCandidate>
  locale: AppLocale
  t: TranslateFunction
}): WorkbenchRow[] {
  const workflowPlanRowsById = new Map(
    input.workflowItems
      .filter((item) => item.sourceType === 'store_action_plan')
      .map((item) => [item.sourceId, item]),
  )
  const persistedPlanIds = new Set(input.plans.map((plan) => plan.actionPlanId))
  const persistedPlanSourceKeys = new Set(
    input.plans.map((plan) => getPlanSourceKey(plan.storeId, plan.sourceType, plan.sourceId)),
  )
  const planRows = input.plans.map((plan): WorkbenchRow => {
    const workflowPlanRow = workflowPlanRowsById.get(plan.actionPlanId)
    return {
      id: `plan:${plan.actionPlanId}`,
      source: 'plan',
      family: mapPlanFamily(plan),
      state: mapPlanState(plan),
      title: plan.title,
      summary: plan.summary?.trim() || input.t('storeTasks.actionPlansNoSummary'),
      storeId: plan.storeId,
      storeName: workflowPlanRow?.storeName || plan.storeId,
      statusLabel: formatStoreActionPlanStatus(input.t, plan.status),
      priorityLabel: formatStoreActionPlanPriority(input.t, plan.priority),
      dueLabel: formatActionPlanDate(plan.dueOn, input.locale),
      evidenceLabel: plan.resolutionNote
        ? input.t('storeTasks.evidenceReported')
        : plan.cancelReason
          ? input.t('storeTasks.evidenceCancelled')
          : input.t('storeTasks.evidenceOpen'),
      sourceLabel: formatStoreActionPlanSource(input.t, plan.sourceType),
      tone: mapStoreActionPlanStatusTone(plan.status),
      priorityTone: mapStoreActionPlanPriorityTone(plan.priority),
      plan,
    }
  })

  const workflowRows = input.workflowItems
    .filter((item) => {
      if (item.sourceType === 'store_action_plan') {
        return !input.suppressAllWorkflowActionPlanRows && !persistedPlanIds.has(item.sourceId)
      }

      return !persistedPlanSourceKeys.has(getWorkflowSourceKey(item.storeId, item.sourceType, item.sourceId))
    })
    .map((item): WorkbenchRow => {
      const candidate = input.actionCandidatesBySource.get(
        getWorkflowSourceKey(item.storeId, item.sourceType, item.sourceId),
      )
      const row: WorkbenchRow = {
        id: `workflow:${item.sourceType}:${item.sourceId}`,
        source: 'workflow',
        family: mapWorkflowFamily(item),
        state: mapWorkflowState(item),
        title: item.title,
        summary: item.summary,
        storeId: item.storeId,
        storeName: item.storeName || item.storeId,
        statusLabel: formatWorkflowInboxStatusLabel(input.t, item.inboxStatus),
        priorityLabel: formatWorkflowUrgencyLabel(input.t, item.urgency),
        dueLabel: item.needsAttentionAt
          ? formatDateTime(item.needsAttentionAt, input.locale)
          : item.createdAt
            ? formatDateTime(item.createdAt, input.locale)
            : input.t('storeTasks.noTime'),
        evidenceLabel: item.historyPreview ? input.t('storeTasks.evidenceHasContext') : input.t('storeTasks.evidenceSource'),
        sourceLabel: formatWorkflowSourceType(input.t, item.sourceType),
        ...(item.historyPreview ? { historyPreview: item.historyPreview } : {}),
        tone: mapWorkflowTone(item),
        priorityTone: mapWorkflowUrgencyTone(item.urgency),
        workflowItem: item,
      }
      if (candidate) {
        row.candidate = candidate
      }
      return row
    })

  return [...planRows, ...workflowRows]
}

function buildSummary(rows: readonly WorkbenchRow[]): WorkbenchSummary {
  return {
    total: rows.length,
    pending: rows.filter((row) => row.state === 'attention' || row.state === 'working').length,
    checklist: rows.filter((row) => row.family === 'checklist').length,
    projection: rows.filter((row) => row.family === 'projection').length,
    reported: rows.filter((row) => row.state === 'reported' || row.state === 'closed').length,
  }
}

function buildTabs(rows: readonly WorkbenchRow[], t: TranslateFunction) {
  return [
    {
      id: 'all' as const,
      label: t('storeTasks.tab.all'),
      count: rows.length,
      icon: <ListChecks className="tw:size-4" />,
    },
    {
      id: 'checklist' as const,
      label: t('storeTasks.tab.checklist'),
      count: rows.filter((row) => row.family === 'checklist').length,
      icon: <ClipboardList className="tw:size-4" />,
    },
    {
      id: 'projection' as const,
      label: t('storeTasks.tab.projection'),
      count: rows.filter((row) => row.family === 'projection').length,
      icon: <TrendingDown className="tw:size-4" />,
    },
    {
      id: 'targets' as const,
      label: t('storeTasks.tab.targets'),
      count: rows.filter((row) => row.family === 'targets').length,
      icon: <Target className="tw:size-4" />,
    },
    {
      id: 'closed' as const,
      label: t('storeTasks.tab.closed'),
      count: rows.filter((row) => row.state === 'reported' || row.state === 'closed').length,
      icon: <CheckCircle2 className="tw:size-4" />,
    },
  ]
}

function filterRowsBySearchAndTab(rows: readonly WorkbenchRow[], search: string, tab: WorkbenchTabId) {
  const normalizedSearch = search.trim().toLocaleLowerCase('tr-TR')
  return rows.filter((row) => {
    const tabMatch =
      tab === 'all' ||
      (tab === 'checklist' && row.family === 'checklist') ||
      (tab === 'projection' && row.family === 'projection') ||
      (tab === 'targets' && row.family === 'targets') ||
      (tab === 'closed' && (row.state === 'reported' || row.state === 'closed'))

    if (!tabMatch) {
      return false
    }

    if (!normalizedSearch) {
      return true
    }

    return `${row.title} ${row.summary} ${row.storeName} ${row.storeId}`
      .toLocaleLowerCase('tr-TR')
      .includes(normalizedSearch)
  })
}

function sortRowsForWorkbench(rows: readonly WorkbenchRow[]) {
  const stateRank: Record<WorkbenchRowState, number> = {
    attention: 0,
    working: 1,
    reported: 2,
    closed: 3,
  }
  const toneRank = {
    danger: 0,
    warning: 1,
    accent: 2,
    calm: 3,
    neutral: 4,
  }

  return [...rows].sort((left, right) => {
    const stateDelta = stateRank[left.state] - stateRank[right.state]
    if (stateDelta !== 0) return stateDelta
    const toneDelta = toneRank[left.tone] - toneRank[right.tone]
    if (toneDelta !== 0) return toneDelta
    return left.title.localeCompare(right.title, 'tr-TR')
  })
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

function mapPlanFamily(plan: StoreActionPlan): WorkbenchRowFamily {
  if (plan.sourceType === 'checklist_remediation') return 'checklist'
  if (plan.sourceType === 'kpi_exception') return 'projection'
  return 'other'
}

function mapWorkflowFamily(item: WorkflowInboxItem): WorkbenchRowFamily {
  if (item.sourceType === 'checklist_receipt' || item.sourceType === 'store_action_plan') return 'checklist'
  if (item.sourceType === 'kpi_exception') return 'projection'
  if (item.sourceType === 'target_distribution_request') return 'targets'
  return 'other'
}

function mapPlanState(plan: StoreActionPlan): WorkbenchRowState {
  if (plan.status === 'open' || plan.status === 'blocked') return 'attention'
  if (plan.status === 'in_progress') return 'working'
  if (plan.status === 'closed') return 'reported'
  return 'closed'
}

function mapWorkflowState(item: WorkflowInboxItem): WorkbenchRowState {
  if (item.inboxStatus === 'needs_attention') return 'attention'
  if (item.inboxStatus === 'informational') return 'reported'
  return 'closed'
}
