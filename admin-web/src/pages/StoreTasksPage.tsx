import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, ClipboardList, ListChecks, ReceiptText, RefreshCw, TrendingUp } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import type { AuthSessionSummary } from '../features/auth/api'
import { getDisplayRoleCodes } from '../features/auth/display'
import { getChecklistAcknowledgements } from '../features/checklists/api'
import type { TranslateFunction, TranslationKey } from '../features/localization/dictionary'
import { useLocalization } from '../features/localization/useLocalization'
import { listStoreActionPlans } from '../features/store-actions/api'
import { StoreActionPlanCreateControl } from '../features/store-actions/StoreActionPlanCreateControl'
import {
  buildReadOnlyStoreActionCandidates,
  type ReadOnlyStoreActionCandidate,
} from '../features/store-actions/candidates'
import { StoreActionPlansPanel } from '../features/store-actions/StoreActionPlansPanel'
import { getStoreApprovalsPrefetchTasks } from '../features/store-approvals/prefetch'
import { WorkflowInboxDetail } from '../features/workflow/WorkflowInboxDetail'
import { getWorkflowInbox } from '../features/workflow/api'
import {
  mapInboxStatusTone,
  mapWorkflowUrgencyTone,
  type WorkflowInboxItem,
} from '../features/workflow/contracts'
import { formatDateTime, formatState, getErrorMessage } from '../lib/format'
import type { AppLocale } from '../lib/i18n'
import { transientQueryRetryOptions } from '../lib/query-retry'
import {
  StoreEmptyState,
  StoreErrorState,
  StoreInfoGrid,
  StoreLoadingState,
  StoreMetricCard,
  StoreMetricGrid,
  StoreSectionCard,
  StoreStackedList,
  StoreStackedRow,
  StoreStatusBadge,
  StoreSurfaceHeader,
  StoreSurfacePage,
  type StoreSurfaceTone,
} from './store-surface-primitives'

const actorRoleTranslationKeys: Partial<Record<string, TranslationKey>> = {
  REGION_APPROVER: 'storeTasks.role.REGION_APPROVER',
  REPORT_VIEWER: 'storeTasks.role.REPORT_VIEWER',
  STORE_MANAGER: 'storeTasks.role.STORE_MANAGER',
  STORE_PERSONNEL: 'storeTasks.role.STORE_PERSONNEL',
  SUPER_ADMIN: 'storeTasks.role.SUPER_ADMIN',
}
const STORE_ACTION_PLAN_PAGE_SIZE = 20

function canUseWorkflowInbox(authSummary: AuthSessionSummary | null) {
  const roles = authSummary?.user.roleCodes ?? []
  return roles.includes('STORE_MANAGER') || roles.includes('SUPER_ADMIN') || roles.includes('REPORT_VIEWER')
}

function canUseStoreActionPlans(authSummary: AuthSessionSummary | null) {
  const roles = authSummary?.user.roleCodes ?? []
  return roles.includes('STORE_MANAGER') || roles.includes('SUPER_ADMIN')
}

export function StoreTasksPage(input: {
  authSummary: AuthSessionSummary | null
}) {
  const { locale, t } = useLocalization()
  const queryClient = useQueryClient()
  const inboxEnabled = canUseWorkflowInbox(input.authSummary)
  const storeActionPlansEnabled = canUseStoreActionPlans(input.authSummary)
  const [storeActionPlansOffset, setStoreActionPlansOffset] = useState(0)
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

  const items = useMemo(() => inboxQuery.data?.items ?? [], [inboxQuery.data?.items])
  const storeActionPlans = useMemo(
    () => storeActionPlansQuery.data?.items ?? [],
    [storeActionPlansQuery.data?.items],
  )
  const storeActionPlansMeta = storeActionPlansQuery.data?.meta
  const storeActionPlansTotal = storeActionPlansMeta?.total ?? storeActionPlans.length
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
  const sortedItems = useMemo(() => {
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
  }, [items])
  const pendingItems = useMemo(
    () => items.filter((item) => item.inboxStatus === 'needs_attention'),
    [items],
  )
  const approvalItems = useMemo(
    () => items.filter((item) => item.itemType === 'approval'),
    [items],
  )
  const acknowledgementItems = useMemo(
    () => items.filter((item) => item.itemType === 'acknowledgement'),
    [items],
  )
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
        <StoreSurfaceHeader
          eyebrow={t('storeTasks.unavailableEyebrow')}
          title={t('storeTasks.unavailableTitle')}
          description={t('storeTasks.unavailableCopy')}
          badges={[
            { label: `${t('storeTasks.storeScope')}: ${primaryStoreId}`, tone: 'neutral' },
            {
              label: formatDisplayRoleLabels(t, input.authSummary?.user.roleCodes),
              tone: 'warning',
            },
          ]}
        />
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
    <StoreSurfacePage ariaLabel={t('storeTasks.title')}>
      <StoreSurfaceHeader
        eyebrow={t('storeTasks.heroEyebrow')}
        title={t('storeTasks.title')}
        description={t('storeTasks.heroCopy')}
        badges={[
          { label: `${t('storeTasks.storeScope')}: ${primaryStoreId}`, tone: 'neutral' },
          { label: `${t('storeTasks.queueItems')}: ${items.length}`, tone: 'accent' },
          {
            label: formatDisplayRoleLabels(t, input.authSummary?.user.roleCodes),
            tone: 'calm',
          },
        ]}
      />

      <StoreMetricGrid>
        <StoreMetricCard
          title={t('storeTasks.pendingActions')}
          value={pendingItems.length}
          note={t('storeTasks.pendingActionsNote')}
          icon={<Bell data-icon="inline-start" />}
          tone={pendingItems.length > 0 ? 'warning' : 'calm'}
        />
        <StoreMetricCard
          title={t('storeTasks.highPriority')}
          value={items.filter((item) => item.urgency === 'high').length}
          note={t('storeTasks.highPriorityNote')}
          icon={<TrendingUp data-icon="inline-start" />}
          tone={items.some((item) => item.urgency === 'high') ? 'danger' : 'neutral'}
        />
        <StoreMetricCard
          title={t('storeTasks.approvals')}
          value={approvalItems.length}
          note={t('storeTasks.approvalsNote')}
          icon={<ReceiptText data-icon="inline-start" />}
          tone={approvalItems.length > 0 ? 'accent' : 'neutral'}
        />
        <StoreMetricCard
          title={t('storeTasks.acknowledgements')}
          value={acknowledgementItems.length}
          note={t('storeTasks.acknowledgementsNote')}
          icon={<ClipboardList data-icon="inline-start" />}
          tone={acknowledgementItems.length > 0 ? 'accent' : 'neutral'}
        />
        <StoreMetricCard
          title={t('storeTasks.kpiFollowUps')}
          value={actionCandidates.length}
          note={t('storeTasks.kpiFollowUpsNote')}
          icon={<TrendingUp data-icon="inline-start" />}
          tone={actionCandidates.length > 0 ? 'warning' : 'neutral'}
        />
        {storeActionPlansEnabled ? (
          <StoreMetricCard
            title={t('storeTasks.actionPlansMetric')}
            value={storeActionPlansTotal}
            note={t('storeTasks.actionPlansMetricNote')}
            icon={<ListChecks data-icon="inline-start" />}
            tone={storeActionPlansTotal > 0 ? 'warning' : 'neutral'}
          />
        ) : null}
      </StoreMetricGrid>

      <StoreSectionCard title={t('storeTasks.contextTitle')} description={t('storeTasks.queueContext')}>
        <StoreInfoGrid
          items={[
            { label: t('storeTasks.workTypes'), value: t('storeTasks.workTypesValue') },
            {
              label: t('storeTasks.kpiConnection'),
              value: actionCandidates.length > 0 ? t('storeTasks.kpiActive') : t('storeTasks.kpiReady'),
              tone: actionCandidates.length > 0 ? 'warning' : 'calm',
            },
            { label: t('storeTasks.queueStatuses'), value: t('storeTasks.queueStatusesValue') },
            {
              label: t('storeTasks.resolvedRoles'),
              value: formatDisplayRoleLabels(t, input.authSummary?.user.roleCodes),
            },
          ]}
        />
      </StoreSectionCard>

      {storeActionPlansEnabled ? (
        <StoreActionPlansPanel
          plans={storeActionPlans}
          meta={storeActionPlansMeta}
          isLoading={storeActionPlansQuery.isLoading}
          isError={storeActionPlansQuery.isError}
          isFetching={storeActionPlansQuery.isFetching}
          error={storeActionPlansQuery.error}
          locale={locale}
          t={t}
          onRetry={() => void storeActionPlansQuery.refetch()}
          onPreviousPage={() =>
            setStoreActionPlansOffset((offset) => Math.max(0, offset - STORE_ACTION_PLAN_PAGE_SIZE))
          }
          onNextPage={() =>
            setStoreActionPlansOffset((offset) => offset + STORE_ACTION_PLAN_PAGE_SIZE)
          }
        />
      ) : null}

      <StoreSectionCard title={t('storeTasks.queueTitle')} description={t('storeTasks.todayQueue')}>
        {items.length === 0 ? (
          <StoreEmptyState
            title={t('storeTasks.emptyTitle')}
            description={t('storeTasks.emptyCopy')}
          />
        ) : (
          <StoreStackedList>
            {sortedItems.map((item) => (
              <WorkflowInboxRow
                key={`${item.sourceType}:${item.sourceId}`}
                item={item}
                actionCandidate={
                  storeActionPlansEnabled
                    ? actionCandidatesBySource.get(getWorkflowSourceKey(item.storeId, item.sourceType, item.sourceId))
                    : undefined
                }
                locale={locale}
                t={t}
                onActionPlanCreated={() => setStoreActionPlansOffset(0)}
              />
            ))}
          </StoreStackedList>
        )}
      </StoreSectionCard>

      <div className="tw:flex tw:flex-wrap tw:gap-2">
        <Button asChild variant="outline">
          <Link to="/store/checklists">{t('storeTasks.checklistsLink')}</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/store/approvals">{t('storeTasks.approvalsLink')}</Link>
        </Button>
      </div>
    </StoreSurfacePage>
  )
}

function WorkflowInboxRow(input: {
  item: WorkflowInboxItem
  actionCandidate: ReadOnlyStoreActionCandidate | undefined
  locale: AppLocale
  t: TranslateFunction
  onActionPlanCreated: () => void
}) {
  return (
    <StoreStackedRow testId="store-task-queue-row">
      <div className="tw:flex tw:flex-col tw:gap-3">
        <div className="tw:flex tw:flex-col tw:gap-3 tw:md:flex-row tw:md:items-start tw:md:justify-between">
          <div className="tw:min-w-0">
            <strong className="tw:block tw:text-sm tw:font-semibold tw:text-foreground">
              {input.item.title}
            </strong>
            <p className="tw:mt-1 tw:text-sm tw:leading-6 tw:text-muted-foreground">
              {input.item.summary}
            </p>
          </div>
          <div className="tw:flex tw:flex-wrap tw:gap-2">
            <StoreStatusBadge tone="accent">{formatWorkflowSourceTypeLabel(input.t, input.item.sourceType)}</StoreStatusBadge>
            <StoreStatusBadge tone={mapInboxStatusTone(input.item.inboxStatus) as StoreSurfaceTone}>
              {formatWorkflowInboxStatusLabel(input.t, input.item.inboxStatus)}
            </StoreStatusBadge>
            <StoreStatusBadge tone={mapWorkflowUrgencyTone(input.item.urgency) as StoreSurfaceTone}>
              {formatWorkflowUrgencyLabel(input.t, input.item.urgency)}
            </StoreStatusBadge>
          </div>
        </div>

        <StoreInfoGrid
          items={[
            {
              label: input.t('storeTasks.workType'),
              value: formatWorkflowItemTypeLabel(input.t, input.item.itemType),
            },
            {
              label: input.t('storeTasks.actorRole'),
              value: formatActorRoleLabel(input.t, input.item.actorRole),
            },
            {
              label: input.t('storeTasks.store'),
              value: input.item.storeName || input.item.storeId,
            },
            {
              label: input.t('storeTasks.actionTime'),
              value: input.item.needsAttentionAt
                ? formatDateTime(input.item.needsAttentionAt, input.locale)
                : input.t('storeTasks.now'),
            },
          ]}
        />

        {input.item.historyPreview ? (
          <p className="tw:text-sm tw:leading-6 tw:text-muted-foreground">{input.item.historyPreview}</p>
        ) : null}

        <WorkflowInboxDetail item={input.item} />

        <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-2">
          <Button asChild size="sm">
            <Link to={input.item.deepLink}>{formatWorkflowPrimaryActionLabel(input.t, input.item)}</Link>
          </Button>
          {input.actionCandidate ? (
            <StoreActionPlanCreateControl
              candidate={input.actionCandidate}
              t={input.t}
              onCreated={input.onActionPlanCreated}
            />
          ) : null}
          <span className="tw:text-sm tw:text-muted-foreground">
            {formatWorkflowSecondaryActionLabel(input.t, input.item)}
          </span>
        </div>
      </div>
    </StoreStackedRow>
  )
}

function getWorkflowSourceKey(storeId: string, sourceType: WorkflowInboxItem['sourceType'], sourceId: string) {
  return `${storeId}:${sourceType}:${sourceId}`
}

function formatDisplayRoleLabels(t: TranslateFunction, roleCodes: readonly string[] | null | undefined) {
  const displayRoleCodes = getDisplayRoleCodes(roleCodes)

  if (displayRoleCodes.length === 0) {
    return t('storeTasks.noRoles')
  }

  return displayRoleCodes.map((roleCode) => formatActorRoleLabel(t, roleCode)).join(', ')
}

function formatActorRoleLabel(t: TranslateFunction, roleCode: string) {
  const translationKey = actorRoleTranslationKeys[roleCode]
  return translationKey ? t(translationKey) : formatState(roleCode)
}

function formatWorkflowItemTypeLabel(t: TranslateFunction, type: WorkflowInboxItem['itemType']) {
  switch (type) {
    case 'approval':
      return t('storeTasks.itemType.approval')
    case 'acknowledgement':
      return t('storeTasks.itemType.acknowledgement')
    case 'task':
      return t('storeTasks.itemType.task')
    case 'notification':
      return t('storeTasks.itemType.notification')
    default:
      return type
  }
}

function formatWorkflowSourceTypeLabel(t: TranslateFunction, sourceType: WorkflowInboxItem['sourceType']) {
  switch (sourceType) {
    case 'target_distribution_request':
      return t('storeTasks.sourceType.target_distribution_request')
    case 'checklist_receipt':
      return t('storeTasks.sourceType.checklist_receipt')
    case 'kpi_exception':
      return t('storeTasks.sourceType.kpi_exception')
    case 'store_action_plan':
      return t('storeTasks.sourceType.store_action_plan')
    default:
      return sourceType
  }
}

function formatWorkflowPrimaryActionLabel(t: TranslateFunction, item: WorkflowInboxItem) {
  switch (item.sourceType) {
    case 'target_distribution_request':
      return item.inboxStatus === 'needs_attention'
        ? t('storeTasks.primary.targetApprove')
        : t('storeTasks.primary.targetHistory')
    case 'checklist_receipt':
      return item.inboxStatus === 'needs_attention'
        ? t('storeTasks.primary.checklistAccept')
        : t('storeTasks.primary.checklistRecord')
    case 'kpi_exception':
      return t('storeTasks.primary.kpiDetail')
    case 'store_action_plan':
      return t('storeTasks.primary.actionPlan')
    default:
      return item.primaryActionLabel
  }
}

function formatWorkflowSecondaryActionLabel(t: TranslateFunction, item: WorkflowInboxItem) {
  switch (item.sourceType) {
    case 'target_distribution_request':
      return t('storeTasks.secondary.targetDetail')
    case 'checklist_receipt':
      return t('storeTasks.secondary.checklistResult')
    case 'kpi_exception':
      return t('storeTasks.secondary.kpiDeviation')
    case 'store_action_plan':
      return t('storeTasks.secondary.actionPlan')
    default:
      return item.secondaryActionLabel ?? t('storeTasks.secondary.targetDetail')
  }
}

function formatWorkflowInboxStatusLabel(t: TranslateFunction, status: WorkflowInboxItem['inboxStatus']) {
  switch (status) {
    case 'needs_attention':
      return t('storeTasks.inboxStatus.needs_attention')
    case 'completed':
      return t('storeTasks.inboxStatus.completed')
    case 'informational':
      return t('storeTasks.inboxStatus.informational')
    default:
      return formatState(status)
  }
}

function formatWorkflowUrgencyLabel(t: TranslateFunction, urgency: WorkflowInboxItem['urgency']) {
  switch (urgency) {
    case 'high':
      return t('storeTasks.urgency.high')
    case 'medium':
      return t('storeTasks.urgency.medium')
    case 'low':
      return t('storeTasks.urgency.low')
    default:
      return formatState(urgency)
  }
}
