import { KeyValue, StatusPill, type Tone } from '../../components/dashboard-primitives'
import { formatDateTime, formatState } from '../../lib/format'
import type { WorkflowInboxItem } from './contracts'

type InboxDetailSignal = {
  value: string
  tone: Tone
}

type WorkflowInboxDetailModel = {
  detailSummary: string
  dueSignal: InboxDetailSignal
  escalation: InboxDetailSignal
  sourceAction: string
}

export function WorkflowInboxDetail(input: { item: WorkflowInboxItem }) {
  const detail = resolveWorkflowInboxDetail(input.item)

  return (
    <div aria-label="Inbox item detail" className="stacked-row-detail">
      <div className="queue-meta" aria-label="Inbox governance signals">
        <StatusPill tone={detail.dueSignal.tone}>{detail.dueSignal.value}</StatusPill>
        <StatusPill tone={detail.escalation.tone}>{detail.escalation.value}</StatusPill>
      </div>
      <div className="key-grid">
        <KeyValue label="Detay ozeti" value={detail.detailSummary} />
        <KeyValue label="Due sinyali" value={resolveDueValue(input.item)} />
        <KeyValue label="Escalation" value={detail.escalation.value} />
        <KeyValue label="Kaynak aksiyonu" value={detail.sourceAction} />
      </div>
    </div>
  )
}

function resolveWorkflowInboxDetail(item: WorkflowInboxItem): WorkflowInboxDetailModel {
  return {
    detailSummary: `${formatState(item.itemType)} · ${formatState(item.workflowStatus)} · ${formatState(item.actorRole)}`,
    dueSignal: resolveDueSignal(item),
    escalation: resolveEscalationSignal(item),
    sourceAction: resolveSourceAction(item),
  }
}

function resolveDueSignal(item: WorkflowInboxItem): InboxDetailSignal {
  if (item.inboxStatus === 'completed') {
    return { value: 'Kapandi', tone: 'calm' }
  }

  if (item.urgency === 'high') {
    return { value: 'Bugun ele al', tone: 'danger' }
  }

  if (item.urgency === 'medium') {
    return { value: 'Planli takip', tone: 'warning' }
  }

  return { value: 'Dusuk oncelik', tone: 'accent' }
}

function resolveEscalationSignal(item: WorkflowInboxItem): InboxDetailSignal {
  if (item.inboxStatus !== 'needs_attention') {
    return { value: 'Escalation yok', tone: 'calm' }
  }

  if (item.urgency === 'high') {
    return { value: 'Escalation aday', tone: 'danger' }
  }

  if (item.urgency === 'medium') {
    return { value: 'Takipte tut', tone: 'warning' }
  }

  return { value: 'Izlemede', tone: 'accent' }
}

function resolveSourceAction(item: WorkflowInboxItem) {
  switch (item.sourceType) {
    case 'target_distribution_request':
      return 'Karar ekranina git'
    case 'checklist_receipt':
      return 'Checklist receipt ac'
    case 'kpi_exception':
      return 'KPI detayina git'
    default:
      return item.primaryActionLabel
  }
}

function resolveDueValue(item: WorkflowInboxItem) {
  const dateValue = item.needsAttentionAt ?? item.createdAt
  return dateValue ? formatDateTime(dateValue) : 'Due yok'
}
