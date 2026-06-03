import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Calendar,
  CheckCircle2,
  ClipboardList,
  Layers3,
  ListChecks,
  RefreshCw,
  Route,
  Search,
  SlidersHorizontal,
  Store,
  Target,
  TrendingDown,
} from 'lucide-react'
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
  const activeTabLabel = tabs.find((tab) => tab.id === activeTab)?.label ?? t('storeTasks.allSources')
  const periodLabel = useMemo(() => resolveWorkbenchPeriodLabel(rows, locale, t), [locale, rows, t])
  const scopeLabel = persona === 'regionManager' ? t('storeTasks.regionView') : t('storeTasks.storeView')
  const statusFilterLabel = activeTab === 'closed' ? t('storeTasks.closedWork') : t('storeTasks.openWork')
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
    <StoreSurfacePage ariaLabel={t('storeTasks.title')} className="tw:mx-auto tw:w-full tw:max-w-7xl tw:gap-3">
      <WorkbenchHeader
        persona={persona}
        t={t}
      />

      <SummaryGrid summary={summary} persona={persona} t={t} />

      <section className="tw:grid tw:grid-cols-[2.4rem_minmax(0,1fr)] tw:gap-3 tw:rounded-[1.1rem] tw:border tw:border-[#10adc5]/25 tw:bg-gradient-to-r tw:from-[#10adc5]/10 tw:to-[#6847f5]/5 tw:p-3 tw:shadow-[0_14px_36px_rgba(39,58,91,0.07)] tw:md:grid-cols-[2.4rem_minmax(0,1fr)_auto] tw:md:items-center">
        <span className="tw:flex tw:size-9 tw:items-center tw:justify-center tw:rounded-xl tw:border tw:border-[#10adc5]/25 tw:bg-[#e6fbff] tw:text-[#08798d]">
          <Route className="tw:size-4" />
        </span>
        <div className="tw:min-w-0">
          <strong className="tw:block tw:text-sm tw:font-semibold tw:text-foreground">{t('storeTasks.workflowRuleTitle')}</strong>
          <span className="tw:mt-1 tw:block tw:text-xs tw:leading-5 tw:text-muted-foreground">{t('storeTasks.workflowRuleCopy')}</span>
        </div>
        <span className="tw:col-start-2 tw:inline-flex tw:min-h-7 tw:items-center tw:justify-center tw:justify-self-start tw:rounded-full tw:border tw:border-[#10adc5]/25 tw:bg-[#e6fbff] tw:px-2.5 tw:text-xs tw:font-semibold tw:text-[#08798d] tw:md:col-auto">
          {t('storeTasks.workflowRuleBadge')}
        </span>
      </section>

      <div className="tw:grid tw:gap-2.5 tw:rounded-[1.25rem] tw:border tw:border-[#dbe5f2] tw:bg-white/75 tw:p-2.5 tw:shadow-[0_16px_42px_rgba(42,57,90,0.08)] tw:backdrop-blur tw:lg:grid-cols-[minmax(240px,1fr)_repeat(4,minmax(132px,0.55fr))]">
        <label className="tw:grid tw:gap-1.5">
          <span className="tw:pl-1 tw:text-[0.68rem] tw:font-semibold tw:text-[#8793a9]">{t('storeTasks.searchLabel')}</span>
          <span className="tw:flex tw:min-h-10 tw:items-center tw:gap-2 tw:rounded-xl tw:border tw:border-[#dbe5f2] tw:bg-white/85 tw:px-3 tw:text-sm">
            <Search className="tw:size-4 tw:text-[#62708a]" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('storeTasks.searchPlaceholder')}
              className="tw:h-8 tw:border-0 tw:bg-transparent tw:px-0 tw:shadow-none tw:focus-visible:ring-0"
            />
          </span>
        </label>
        <ToolbarField label={t('storeTasks.periodLabel')} value={periodLabel} icon={<Calendar className="tw:size-4" />} />
        <ToolbarField label={t('storeTasks.scopeFilterLabel')} value={scopeLabel} icon={<Store className="tw:size-4" />} />
        <ToolbarField label={t('storeTasks.sourceFilterLabel')} value={activeTab === 'all' ? t('storeTasks.allSources') : activeTabLabel} icon={<Layers3 className="tw:size-4" />} />
        <ToolbarField label={t('storeTasks.statusFilterLabel')} value={statusFilterLabel} icon={<SlidersHorizontal className="tw:size-4" />} />
      </div>

      <WorkbenchTabs activeTab={activeTab} tabs={tabs} onTabChange={setActiveTab} />

      <section
        data-testid="store-action-plans-panel"
        className="tw:overflow-hidden tw:rounded-[1.35rem] tw:border tw:border-[#cfd9ea] tw:bg-white/85 tw:shadow-[0_24px_70px_rgba(30,52,88,0.13)] tw:backdrop-blur"
      >
        <header className="tw:flex tw:flex-col tw:gap-3 tw:border-b tw:border-[#dbe5f2] tw:px-4 tw:py-4 tw:md:flex-row tw:md:items-start tw:md:justify-between">
          <div>
            <h2 className="tw:text-base tw:font-semibold tw:leading-snug tw:text-[#071631]">
              {persona === 'regionManager'
                ? t('storeTasks.queuePanelTitleRegion')
                : t('storeTasks.queuePanelTitleStore')}
            </h2>
            <p className="tw:mt-1 tw:text-xs tw:leading-5 tw:text-[#62708a]">
              {persona === 'regionManager'
                ? t('storeTasks.queuePanelCopyRegion')
                : t('storeTasks.queuePanelCopyStore')}
            </p>
          </div>
          <span className="tw:inline-flex tw:min-h-[27px] tw:items-center tw:justify-center tw:rounded-full tw:border tw:border-[#6847f5]/20 tw:bg-[#eee9ff] tw:px-2.5 tw:text-xs tw:font-semibold tw:text-[#5a37df]">
            {t('storeTasks.queueCount', { count: workbenchRecordCount })}
          </span>
        </header>
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
      </section>
    </StoreSurfacePage>
  )
}

function ToolbarField(input: {
  label: string
  value: string
  icon: ReactNode
}) {
  return (
    <div className="tw:grid tw:gap-1.5">
      <span className="tw:pl-1 tw:text-[0.68rem] tw:font-semibold tw:text-[#8793a9]">{input.label}</span>
      <div className="tw:flex tw:min-h-10 tw:items-center tw:gap-2 tw:rounded-xl tw:border tw:border-[#dbe5f2] tw:bg-white/85 tw:px-3 tw:text-sm tw:font-medium tw:text-[#071631]">
        <span className="tw:text-[#62708a]">{input.icon}</span>
        <span className="tw:min-w-0 tw:truncate">{input.value}</span>
      </div>
    </div>
  )
}

function resolveWorkbenchPeriodLabel(
  rows: readonly WorkbenchRow[],
  locale: AppLocale,
  t: TranslateFunction,
) {
  const planDueDate = rows.find((row) => row.plan?.dueOn)?.plan?.dueOn
  const workflowDate = rows.find((row) => row.workflowItem?.needsAttentionAt || row.workflowItem?.createdAt)
    ?.workflowItem
  const rawDate = planDueDate ?? workflowDate?.needsAttentionAt ?? workflowDate?.createdAt

  if (!rawDate) {
    return t('storeTasks.currentRecordsPeriod')
  }

  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? `${rawDate}T12:00:00.000Z` : rawDate
  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) {
    return t('storeTasks.currentRecordsPeriod')
  }

  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(date)
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
      statusTone: mapPlanStatusBadgeTone(plan.status),
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
        statusTone: mapWorkflowStatusBadgeTone(item),
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

function mapPlanStatusBadgeTone(status: StoreActionPlanStatus) {
  switch (status) {
    case 'open':
    case 'in_progress':
      return 'warning'
    case 'blocked':
      return 'danger'
    case 'closed':
      return 'calm'
    case 'cancelled':
      return 'neutral'
    default:
      return 'neutral'
  }
}

function mapWorkflowState(item: WorkflowInboxItem): WorkbenchRowState {
  if (item.inboxStatus === 'needs_attention') return 'attention'
  if (item.inboxStatus === 'informational') return 'reported'
  return 'closed'
}

function mapWorkflowStatusBadgeTone(item: WorkflowInboxItem) {
  if (item.inboxStatus === 'needs_attention') return 'warning'
  if (item.inboxStatus === 'completed') return 'calm'
  if (item.inboxStatus === 'informational') return 'accent'
  return 'neutral'
}
