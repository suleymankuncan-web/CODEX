import { KeyValue, StatusPill, type Tone } from '../../components/dashboard-primitives'
import { formatDateTime, formatState } from '../../lib/format'
import { formatWorkflowItemType, type WorkflowInboxItem } from './contracts'

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
        <KeyValue label="Detay özeti" value={detail.detailSummary} />
        <KeyValue label="Zaman sinyali" value={resolveDueValue(input.item)} />
        <KeyValue label="Yükseltme" value={detail.escalation.value} />
        <KeyValue label="Kaynak aksiyonu" value={detail.sourceAction} />
      </div>
    </div>
  )
}

function resolveWorkflowInboxDetail(item: WorkflowInboxItem): WorkflowInboxDetailModel {
  return {
    detailSummary: `${formatWorkflowItemType(item.itemType)} · ${formatWorkflowStatus(item.workflowStatus)} · ${formatState(item.actorRole)}`,
    dueSignal: resolveDueSignal(item),
    escalation: resolveEscalationSignal(item),
    sourceAction: resolveSourceAction(item),
  }
}

function formatWorkflowStatus(status: string) {
  switch (status) {
    case 'at_risk':
      return 'riskte'
    case 'off_track':
      return 'rotadan sapmış'
    case 'pending_region_approval':
      return 'bölge onayı bekliyor'
    case 'completed':
      return 'tamamlandı'
    default:
      return formatState(status)
  }
}

function resolveDueSignal(item: WorkflowInboxItem): InboxDetailSignal {
  if (item.inboxStatus === 'completed') {
    return { value: 'Kapandı', tone: 'calm' }
  }

  if (item.urgency === 'high') {
    return { value: 'Bugün ele al', tone: 'danger' }
  }

  if (item.urgency === 'medium') {
    return { value: 'Planlı takip', tone: 'warning' }
  }

  return { value: 'Düşük öncelik', tone: 'accent' }
}

function resolveEscalationSignal(item: WorkflowInboxItem): InboxDetailSignal {
  if (item.inboxStatus !== 'needs_attention') {
    return { value: 'Yükseltme yok', tone: 'calm' }
  }

  if (item.urgency === 'high') {
    return { value: 'Yükseltme adayı', tone: 'danger' }
  }

  if (item.urgency === 'medium') {
    return { value: 'Takipte tut', tone: 'warning' }
  }

  return { value: 'İzlemede', tone: 'accent' }
}

function resolveSourceAction(item: WorkflowInboxItem) {
  switch (item.sourceType) {
    case 'target_distribution_request':
      return 'Karar ekranına git'
    case 'checklist_receipt':
      return 'Checklist sonucunu aç'
    case 'kpi_exception':
      return 'KPI detayına git'
    default:
      return item.primaryActionLabel
  }
}

function resolveDueValue(item: WorkflowInboxItem) {
  const dateValue = item.needsAttentionAt ?? item.createdAt
  return dateValue ? formatDateTime(dateValue) : 'Zaman yok'
}
