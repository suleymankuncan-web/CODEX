import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Bell, CheckCircle2, ReceiptText, TrendingUp } from 'lucide-react'
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

function canUseAdminInbox(authSummary: AuthSessionSummary | null) {
  const roles = authSummary?.user.roleCodes ?? []
  return roles.includes('SUPER_ADMIN') || roles.includes('REPORT_VIEWER')
}

export function AdminInboxPage(input: { authSummary: AuthSessionSummary | null }) {
  const inboxEnabled = canUseAdminInbox(input.authSummary)
  const regionScope = input.authSummary?.user.scope.regionIds.join(', ') || 'No region scope'

  const inboxQuery = useQuery({
    queryKey: ['workflow-inbox', 'admin'],
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

  const pendingItems = items.filter((item) => item.inboxStatus === 'needs_attention')
  const approvalItems = items.filter((item) => item.itemType === 'approval')
  const taskItems = items.filter((item) => item.itemType === 'task')

  if (!inboxEnabled) {
    return (
      <ScreenState
        title="Admin inbox unavailable"
        copy="Bu yüzey raporlama veya yönetici rolü gerektirir."
        tone="error"
      />
    )
  }

  if (inboxQuery.isLoading) {
    return (
      <ScreenState
        title="Loading admin inbox"
        copy="Approvals ve KPI exception item'lari tek kuyrukta toplanıyor."
      />
    )
  }

  if (inboxQuery.isError) {
    return (
      <ScreenState
        title="Admin inbox unavailable"
        copy={getErrorMessage(inboxQuery.error)}
        tone="error"
      />
    )
  }

  return (
    <section className="page-stack">
      <section className="hero-panel">
        <div>
          <div className="eyebrow">Admin Inbox</div>
          <h2 className="hero-title">One queue for admin-side approvals and KPI follow-up.</h2>
          <p className="hero-copy">
            Store tarafında kullandığımız ortak workflow dili şimdi admin yüzeyine de taşındı.
          </p>
        </div>
        <div className="hero-metrics">
          <MetricAccent label="Route" value="/admin/inbox" />
          <MetricAccent label="Region scope" value={regionScope} />
          <MetricAccent label="Queue items" value={String(items.length)} />
        </div>
      </section>

      <section className="metric-grid">
        <MetricCard
          title="Needs attention"
          value={pendingItems.length}
          note="Şu an aksiyon bekleyen iş sayısı."
          icon={<Bell size={18} />}
          tone={pendingItems.length > 0 ? 'warning' : 'calm'}
        />
        <MetricCard
          title="Approvals"
          value={approvalItems.length}
          note="Region onayı bekleyen target dağıtım talepleri."
          icon={<ReceiptText size={18} />}
          tone={approvalItems.length > 0 ? 'accent' : 'neutral'}
        />
        <MetricCard
          title="KPI tasks"
          value={taskItems.length}
          note="KPI exception’dan üretilen takip işleri."
          icon={<TrendingUp size={18} />}
          tone={taskItems.length > 0 ? 'warning' : 'neutral'}
        />
        <MetricCard
          title="Completed"
          value={items.filter((item) => item.inboxStatus === 'completed').length}
          note="Bu queue slice içinde kapanmış işler."
          icon={<CheckCircle2 size={18} />}
          tone="calm"
        />
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <div className="eyebrow">Admin Queue</div>
            <h3>Shared workflow contract in admin shell</h3>
          </div>
        </div>

        {sortedItems.length === 0 ? (
          <EmptyState
            title="No admin-side queue items"
            copy="Approval veya KPI review işi düştüğünde burada görünecek."
          />
        ) : (
          <div className="stacked-table">
            {sortedItems.map((item) => (
              <AdminInboxRow key={`${item.sourceType}:${item.sourceId}`} item={item} />
            ))}
          </div>
        )}
      </section>
    </section>
  )
}

function AdminInboxRow(input: { item: WorkflowInboxItem }) {
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
        <Link className="control-button" to={input.item.deepLink}>
          {input.item.primaryActionLabel}
        </Link>
      </div>
    </article>
  )
}
