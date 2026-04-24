import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, ClipboardList, Bell, ReceiptText, TrendingUp } from 'lucide-react'
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
import { getWorkflowInbox } from '../features/workflow/api'
import {
  formatWorkflowItemType,
  formatWorkflowSourceType,
  mapInboxStatusTone,
  mapWorkflowUrgencyTone,
  type WorkflowInboxItem,
} from '../features/workflow/contracts'
import { formatDateTime, formatState, getErrorMessage } from '../lib/format'

function canUseWorkflowInbox(authSummary: AuthSessionSummary | null) {
  const roles = authSummary?.user.roleCodes ?? []
  return roles.includes('STORE_MANAGER') || roles.includes('SUPER_ADMIN') || roles.includes('REPORT_VIEWER')
}

export function StoreTasksPage(input: {
  authSummary: AuthSessionSummary | null
}) {
  const inboxEnabled = canUseWorkflowInbox(input.authSummary)
  const primaryStoreId = input.authSummary?.user.scope.storeIds[0] ?? 'No store scope'
  const inboxQuery = useQuery({
    queryKey: ['workflow-inbox'],
    queryFn: getWorkflowInbox,
    enabled: inboxEnabled,
    retry: false,
  })

  const items = useMemo(() => inboxQuery.data?.items ?? [], [inboxQuery.data?.items])
  const sortedItems = useMemo(() => {
    const urgencyRank = { high: 0, medium: 1, low: 2 }
    const statusRank = { needs_attention: 0, informational: 1, completed: 2 }

    return [...items].sort((left, right) => {
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
  const taskItems = useMemo(
    () => items.filter((item) => item.itemType === 'task'),
    [items],
  )

  if (!inboxEnabled) {
    return (
      <section className="page-stack">
        <section className="hero-panel store-hero-panel">
          <div>
            <div className="eyebrow">Store Tasks</div>
            <h2 className="hero-title">Shared workflow inbox needs a resolved operational role before it can open.</h2>
            <p className="hero-copy">
              The Phase 3 queue is now contract-based, but this session still needs a role that can
              consume approvals, acknowledgements, or reporting-backed work.
            </p>
          </div>
          <div className="hero-metrics">
            <MetricAccent label="Route" value="/store/tasks" />
            <MetricAccent label="Store scope" value={primaryStoreId} />
            <MetricAccent label="State" value="Preview" />
          </div>
        </section>
      </section>
    )
  }

  if (inboxQuery.isLoading) {
    return (
      <ScreenState
        title="Loading shared inbox"
        copy="Pulling approval and acknowledgement work into one mobile-friendly queue."
      />
    )
  }

  if (inboxQuery.isError) {
    return (
      <ScreenState
        title="Shared inbox unavailable"
        copy={getErrorMessage(inboxQuery.error)}
        tone="error"
      />
    )
  }

  return (
    <section className="page-stack">
      <section className="hero-panel store-hero-panel">
        <div>
          <div className="eyebrow">Shared Inbox</div>
          <h2 className="hero-title">One queue for actionable work across approvals and acknowledgements.</h2>
          <p className="hero-copy">
            This is the first concrete Phase 3 surface. It keeps workflow types distinct, but gives
            store-facing work one shared queue language, one urgency model, and one mobile-first
            reading pattern.
          </p>
        </div>
        <div className="hero-metrics">
          <MetricAccent label="Route" value="/store/tasks" />
          <MetricAccent label="Store scope" value={primaryStoreId} />
          <MetricAccent label="Queue items" value={String(items.length)} />
        </div>
      </section>

      <section className="metric-grid store-metric-grid">
        <MetricCard
          title="Needs attention"
          value={pendingItems.length}
          note="Items that still require an action from the current role set."
          icon={<Bell size={18} />}
          tone={pendingItems.length > 0 ? 'warning' : 'calm'}
        />
        <MetricCard
          title="High urgency"
          value={items.filter((item) => item.urgency === 'high').length}
          note="Önce bakılması gereken işler."
          icon={<TrendingUp size={18} />}
          tone={items.some((item) => item.urgency === 'high') ? 'danger' : 'neutral'}
        />
        <MetricCard
          title="Approvals"
          value={approvalItems.length}
          note="Decision-based workflow items coming from target distribution."
          icon={<ReceiptText size={18} />}
          tone={approvalItems.length > 0 ? 'accent' : 'neutral'}
        />
        <MetricCard
          title="Acknowledgements"
          value={acknowledgementItems.length}
          note="Receipt-style work that confirms checklist visibility and acceptance."
          icon={<ClipboardList size={18} />}
          tone={acknowledgementItems.length > 0 ? 'accent' : 'neutral'}
        />
        <MetricCard
          title="KPI tasks"
          value={taskItems.length}
          note="Exception-based work elevated from KPI performance signals."
          icon={<TrendingUp size={18} />}
          tone={taskItems.length > 0 ? 'warning' : 'neutral'}
        />
      </section>

      <section className="two-up-grid">
        <article className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">Queue Context</div>
              <h3>What this inbox normalizes</h3>
            </div>
          </div>
          <div className="key-grid">
            <KeyValue label="Workflow types" value="approval, acknowledgement" />
            <KeyValue label="Task hooks" value={taskItems.length > 0 ? 'kpi_exception active' : 'kpi_exception ready'} />
            <KeyValue label="Inbox statuses" value="needs_attention, completed, informational" />
            <KeyValue label="Primary layout" value="stacked rows, mobile-first" />
            <KeyValue label="Resolved roles" value={input.authSummary?.user.roleCodes.join(', ') || 'none'} />
          </div>
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">Guardrail</div>
              <h3>What this queue does not do</h3>
            </div>
          </div>
          <div className="stacked-table">
            <div className="stacked-row">
              <div className="stacked-row-head">
                <strong>It does not merge workflow meanings</strong>
                <CheckCircle2 size={16} />
              </div>
              <p>Approvals still require decisions. Acknowledgements still confirm receipt. Shared inbox does not flatten them into one status machine.</p>
            </div>
            <div className="stacked-row">
              <div className="stacked-row-head">
                <strong>It does not require desktop tables</strong>
                <CheckCircle2 size={16} />
              </div>
              <p>Each row carries urgency, title, summary, and one primary action path without needing wide grids.</p>
            </div>
          </div>
        </article>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <div className="eyebrow">Today&apos;s Queue</div>
            <h3>Actionable work in a shared contract</h3>
          </div>
        </div>

        {items.length === 0 ? (
          <EmptyState
            title="No actionable items right now"
            copy="Approvals, acknowledgements, and future KPI exceptions will appear here once they enter the shared workflow queue."
          />
        ) : (
          <div className="stacked-table">
            {sortedItems.map((item) => (
              <WorkflowInboxRow key={`${item.sourceType}:${item.sourceId}`} item={item} />
            ))}
          </div>
        )}
      </section>

      <div className="action-cluster">
        <Link className="control-button store-shell-link" to="/store/checklists">
          Store checklists
        </Link>
        <Link className="control-button store-shell-link" to="/store/approvals">
          Store approvals
        </Link>
      </div>
    </section>
  )
}

function WorkflowInboxRow(input: { item: WorkflowInboxItem }) {
  return (
    <article className="stacked-row">
      <div className="stacked-row-head">
        <div>
          <strong>{input.item.title}</strong>
          <p className="queue-subtitle">{input.item.summary}</p>
        </div>
        <div className="action-cluster">
          <StatusPill tone="accent">{formatWorkflowSourceType(input.item.sourceType)}</StatusPill>
          <StatusPill tone={mapInboxStatusTone(input.item.inboxStatus)}>
            {formatState(input.item.inboxStatus)}
          </StatusPill>
          <StatusPill tone={mapWorkflowUrgencyTone(input.item.urgency)}>
            {formatState(input.item.urgency)}
          </StatusPill>
        </div>
      </div>

      <div className="key-grid">
        <KeyValue label="İş tipi" value={formatWorkflowItemType(input.item.itemType)} />
        <KeyValue label="Actor role" value={formatState(input.item.actorRole)} />
        <KeyValue label="Store" value={input.item.storeName || input.item.storeId} />
        <KeyValue
          label="Aksiyon zamanı"
          value={input.item.needsAttentionAt ? formatDateTime(input.item.needsAttentionAt) : 'Now'}
        />
      </div>

      {input.item.historyPreview ? <p className="queue-subtitle">{input.item.historyPreview}</p> : null}

      <div className="action-cluster">
        <Link className="control-button store-shell-link" to={input.item.deepLink}>
          {input.item.primaryActionLabel}
        </Link>
        <span className="queue-subtitle">
          {input.item.secondaryActionLabel ?? 'Detay aç'}
        </span>
      </div>
    </article>
  )
}
