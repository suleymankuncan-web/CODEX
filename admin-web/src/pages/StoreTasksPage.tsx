import { useEffect, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, CheckCircle2, ClipboardList, ListChecks, ReceiptText, RefreshCw, TrendingUp } from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  EmptyState,
  KeyValue,
  MetricAccent,
  MetricCard,
  ScreenState,
  StatusPill,
} from '../components/dashboard-primitives'
import type { AuthSessionSummary } from '../features/auth/api'
import { getDisplayRoleCodes } from '../features/auth/display'
import { getChecklistAcknowledgements } from '../features/checklists/api'
import type { TranslateFunction, TranslationKey } from '../features/localization/dictionary'
import { useLocalization } from '../features/localization/useLocalization'
import { listStoreActionPlans } from '../features/store-actions/api'
import { buildReadOnlyStoreActionCandidates } from '../features/store-actions/candidates'
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

const actorRoleTranslationKeys: Partial<Record<string, TranslationKey>> = {
  REGION_APPROVER: 'storeTasks.role.REGION_APPROVER',
  REPORT_VIEWER: 'storeTasks.role.REPORT_VIEWER',
  STORE_MANAGER: 'storeTasks.role.STORE_MANAGER',
  STORE_PERSONNEL: 'storeTasks.role.STORE_PERSONNEL',
  SUPER_ADMIN: 'storeTasks.role.SUPER_ADMIN',
}

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
  const primaryStoreId = input.authSummary?.user.scope.storeIds[0] ?? t('storeTasks.noStoreScope')
  const inboxQuery = useQuery({
    queryKey: ['workflow-inbox'],
    queryFn: getWorkflowInbox,
    enabled: inboxEnabled,
    ...transientQueryRetryOptions,
  })
  const storeActionPlansQuery = useQuery({
    queryKey: ['store-action-plans', 'store-tasks'],
    queryFn: () => listStoreActionPlans({ limit: 20 }),
    enabled: storeActionPlansEnabled,
    ...transientQueryRetryOptions,
  })

  const items = useMemo(() => inboxQuery.data?.items ?? [], [inboxQuery.data?.items])
  const storeActionPlans = useMemo(
    () => storeActionPlansQuery.data?.items ?? [],
    [storeActionPlansQuery.data?.items],
  )
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
      <section className="page-stack">
        <section className="hero-panel store-hero-panel">
          <div>
            <div className="eyebrow">{t('storeTasks.unavailableEyebrow')}</div>
            <h2 className="hero-title">{t('storeTasks.unavailableTitle')}</h2>
            <p className="hero-copy">{t('storeTasks.unavailableCopy')}</p>
          </div>
          <div className="hero-metrics">
            <MetricAccent label={t('storeTasks.route')} value="/store/tasks" />
            <MetricAccent label={t('storeTasks.storeScope')} value={primaryStoreId} />
            <MetricAccent label={t('storeTasks.status')} value={t('storeTasks.preview')} />
          </div>
        </section>
      </section>
    )
  }

  if (inboxQuery.isLoading) {
    return (
      <ScreenState
        title={t('storeTasks.loadingTitle')}
        copy={t('storeTasks.loadingCopy')}
      />
    )
  }

  if (inboxQuery.isError) {
    return (
      <ScreenState
        title={t('storeTasks.errorTitle')}
        copy={getErrorMessage(inboxQuery.error)}
        tone="error"
        action={
          <button
            type="button"
            className="control-button"
            disabled={inboxQuery.isFetching}
            onClick={() => void inboxQuery.refetch()}
          >
            <RefreshCw size={16} />
            {inboxQuery.isFetching ? t('storeTasks.retryingAction') : t('storeTasks.retryAction')}
          </button>
        }
      />
    )
  }

  return (
    <section className="page-stack">
      <section className="hero-panel store-hero-panel">
        <div>
          <div className="eyebrow">{t('storeTasks.heroEyebrow')}</div>
          <h2 className="hero-title">{t('storeTasks.title')}</h2>
          <p className="hero-copy">{t('storeTasks.heroCopy')}</p>
        </div>
        <div className="hero-metrics">
          <MetricAccent label={t('storeTasks.route')} value="/store/tasks" />
          <MetricAccent label={t('storeTasks.storeScope')} value={primaryStoreId} />
          <MetricAccent label={t('storeTasks.queueItems')} value={String(items.length)} />
        </div>
      </section>

      <section className="metric-grid store-metric-grid">
        <MetricCard
          title={t('storeTasks.pendingActions')}
          value={pendingItems.length}
          note={t('storeTasks.pendingActionsNote')}
          icon={<Bell size={18} />}
          tone={pendingItems.length > 0 ? 'warning' : 'calm'}
        />
        <MetricCard
          title={t('storeTasks.highPriority')}
          value={items.filter((item) => item.urgency === 'high').length}
          note={t('storeTasks.highPriorityNote')}
          icon={<TrendingUp size={18} />}
          tone={items.some((item) => item.urgency === 'high') ? 'danger' : 'neutral'}
        />
        <MetricCard
          title={t('storeTasks.approvals')}
          value={approvalItems.length}
          note={t('storeTasks.approvalsNote')}
          icon={<ReceiptText size={18} />}
          tone={approvalItems.length > 0 ? 'accent' : 'neutral'}
        />
        <MetricCard
          title={t('storeTasks.acknowledgements')}
          value={acknowledgementItems.length}
          note={t('storeTasks.acknowledgementsNote')}
          icon={<ClipboardList size={18} />}
          tone={acknowledgementItems.length > 0 ? 'accent' : 'neutral'}
        />
        <MetricCard
          title={t('storeTasks.kpiFollowUps')}
          value={actionCandidates.length}
          note={t('storeTasks.kpiFollowUpsNote')}
          icon={<TrendingUp size={18} />}
          tone={actionCandidates.length > 0 ? 'warning' : 'neutral'}
        />
        {storeActionPlansEnabled ? (
          <MetricCard
            title={t('storeTasks.actionPlansMetric')}
            value={storeActionPlans.length}
            note={t('storeTasks.actionPlansMetricNote')}
            icon={<ListChecks size={18} />}
            tone={storeActionPlans.length > 0 ? 'warning' : 'neutral'}
          />
        ) : null}
      </section>

      <section className="two-up-grid">
        <article className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">{t('storeTasks.queueContext')}</div>
              <h3>{t('storeTasks.contextTitle')}</h3>
            </div>
          </div>
          <div className="key-grid">
            <KeyValue label={t('storeTasks.workTypes')} value={t('storeTasks.workTypesValue')} />
            <KeyValue
              label={t('storeTasks.kpiConnection')}
              value={
                actionCandidates.length > 0
                  ? t('storeTasks.kpiActive')
                  : t('storeTasks.kpiReady')
              }
            />
            <KeyValue label={t('storeTasks.queueStatuses')} value={t('storeTasks.queueStatusesValue')} />
            <KeyValue label={t('storeTasks.mainLayout')} value={t('storeTasks.mainLayoutValue')} />
            <KeyValue
              label={t('storeTasks.resolvedRoles')}
              value={formatDisplayRoleLabels(t, input.authSummary?.user.roleCodes)}
            />
          </div>
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">{t('storeTasks.controlBoundary')}</div>
              <h3>{t('storeTasks.boundaryTitle')}</h3>
            </div>
          </div>
          <div className="stacked-table">
            <div className="stacked-row">
              <div className="stacked-row-head">
                <strong>{t('storeTasks.noMeaningMergeTitle')}</strong>
                <CheckCircle2 size={16} />
              </div>
              <p>{t('storeTasks.noMeaningMergeCopy')}</p>
            </div>
            <div className="stacked-row">
              <div className="stacked-row-head">
                <strong>{t('storeTasks.noDesktopTableTitle')}</strong>
                <CheckCircle2 size={16} />
              </div>
              <p>{t('storeTasks.noDesktopTableCopy')}</p>
            </div>
          </div>
        </article>
      </section>

      {storeActionPlansEnabled ? (
        <StoreActionPlansPanel
          plans={storeActionPlans}
          isLoading={storeActionPlansQuery.isLoading}
          isError={storeActionPlansQuery.isError}
          isFetching={storeActionPlansQuery.isFetching}
          error={storeActionPlansQuery.error}
          locale={locale}
          t={t}
          onRetry={() => void storeActionPlansQuery.refetch()}
        />
      ) : null}

      <section className="panel">
        <div className="panel-heading">
          <div>
            <div className="eyebrow">{t('storeTasks.todayQueue')}</div>
            <h3>{t('storeTasks.queueTitle')}</h3>
          </div>
        </div>

        {items.length === 0 ? (
          <EmptyState
            title={t('storeTasks.emptyTitle')}
            copy={t('storeTasks.emptyCopy')}
          />
        ) : (
          <div className="stacked-table">
            {sortedItems.map((item) => (
              <WorkflowInboxRow
                key={`${item.sourceType}:${item.sourceId}`}
                item={item}
                locale={locale}
                t={t}
              />
            ))}
          </div>
        )}
      </section>

      <div className="action-cluster">
        <Link className="control-button store-shell-link" to="/store/checklists">
          {t('storeTasks.checklistsLink')}
        </Link>
        <Link className="control-button store-shell-link" to="/store/approvals">
          {t('storeTasks.approvalsLink')}
        </Link>
      </div>
    </section>
  )
}

function WorkflowInboxRow(input: {
  item: WorkflowInboxItem
  locale: AppLocale
  t: TranslateFunction
}) {
  return (
    <article className="stacked-row">
      <div className="stacked-row-head">
        <div>
          <strong>{input.item.title}</strong>
          <p className="queue-subtitle">{input.item.summary}</p>
        </div>
        <div className="action-cluster">
          <StatusPill tone="accent">{formatWorkflowSourceTypeLabel(input.t, input.item.sourceType)}</StatusPill>
          <StatusPill tone={mapInboxStatusTone(input.item.inboxStatus)}>
            {formatWorkflowInboxStatusLabel(input.t, input.item.inboxStatus)}
          </StatusPill>
          <StatusPill tone={mapWorkflowUrgencyTone(input.item.urgency)}>
            {formatWorkflowUrgencyLabel(input.t, input.item.urgency)}
          </StatusPill>
        </div>
      </div>

      <div className="key-grid">
        <KeyValue label={input.t('storeTasks.workType')} value={formatWorkflowItemTypeLabel(input.t, input.item.itemType)} />
        <KeyValue label={input.t('storeTasks.actorRole')} value={formatActorRoleLabel(input.t, input.item.actorRole)} />
        <KeyValue label={input.t('storeTasks.store')} value={input.item.storeName || input.item.storeId} />
        <KeyValue
          label={input.t('storeTasks.actionTime')}
          value={
            input.item.needsAttentionAt
              ? formatDateTime(input.item.needsAttentionAt, input.locale)
              : input.t('storeTasks.now')
          }
        />
      </div>

      {input.item.historyPreview ? <p className="queue-subtitle">{input.item.historyPreview}</p> : null}

      <WorkflowInboxDetail item={input.item} />

      <div className="action-cluster">
        <Link className="control-button store-shell-link" to={input.item.deepLink}>
          {formatWorkflowPrimaryActionLabel(input.t, input.item)}
        </Link>
        <span className="queue-subtitle">
          {formatWorkflowSecondaryActionLabel(input.t, input.item)}
        </span>
      </div>
    </article>
  )
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
