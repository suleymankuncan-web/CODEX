import { Activity } from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  EmptyState,
  KeyValue,
  StatusPill,
  type Tone,
} from '../components/dashboard-primitives'
import type { TranslateFunction } from '../features/localization/dictionary'
import type { WorkflowInboxItem, WorkflowUrgency } from '../features/workflow/contracts'
import { mapWorkflowUrgencyTone } from '../features/workflow/contracts'
import { getErrorMessage } from '../lib/format'
import type { WorkflowInboxPressure } from './operations-workflow-signal-model'

type WorkflowQueuePreviewItem = {
  href: string
  id: string
  meta: string
  reason: string
  status: string
  title: string
  tone: Tone
}

export function WorkflowSignalPanel(input: {
  error: unknown
  isError: boolean
  items: WorkflowInboxItem[]
  pressure: WorkflowInboxPressure
  t: TranslateFunction
}) {
  const previewItems = input.isError
    ? []
    : input.items.map((item): WorkflowQueuePreviewItem => ({
        href: item.deepLink,
        id: item.sourceId,
        meta: input.t('adminOperations.workflowItemMeta', {
          source: formatWorkflowSourceType(item.sourceType, input.t),
          urgency: formatWorkflowUrgency(item.urgency, input.t),
        }),
        reason: item.summary,
        status: formatWorkflowUrgency(item.urgency, input.t),
        title: item.title,
        tone: mapWorkflowUrgencyTone(item.urgency),
      })).slice(0, 4)

  return (
    <article className="panel">
      <div className="panel-heading panel-heading-spread">
        <div>
          <div className="eyebrow">{input.t('adminOperations.workflowEyebrow')}</div>
          <h3>{input.t('adminOperations.workflowTitle')}</h3>
          <p className="panel-copy">{input.t('adminOperations.workflowCopy')}</p>
        </div>
        <StatusPill tone={input.isError ? 'warning' : input.pressure.needsAttentionCount > 0 ? 'warning' : 'calm'}>
          {input.isError
            ? input.t('adminOperations.unavailable')
            : input.pressure.needsAttentionCount > 0
              ? input.t('adminOperations.needsAttention')
              : input.t('adminOperations.ready')}
        </StatusPill>
      </div>

      {input.isError ? (
        <div className="inline-state inline-state-warning">{getErrorMessage(input.error)}</div>
      ) : (
        <div className="key-grid">
          <KeyValue
            label={input.t('adminOperations.workflowNeedsAttention')}
            value={String(input.pressure.needsAttentionCount)}
          />
          <KeyValue
            label={input.t('adminOperations.workflowHighUrgency')}
            value={String(input.pressure.highUrgencyCount)}
          />
          <KeyValue
            label={input.t('adminOperations.workflowTotal')}
            value={String(input.pressure.total)}
          />
        </div>
      )}

      {!input.isError ? (
        <div className="queue-list">
          <div className="queue-row-head">
            <strong>{input.t('adminOperations.workflowQueueTitle')}</strong>
            <StatusPill tone={previewItems.length > 0 ? 'warning' : 'calm'}>
              {previewItems.length > 0
                ? input.t('adminOperations.queueHasItems', { count: previewItems.length })
                : input.t('adminOperations.queueClear')}
            </StatusPill>
          </div>
          {previewItems.length === 0 ? (
            <EmptyState copy={input.t('adminOperations.workflowQueueEmpty')} />
          ) : (
            previewItems.map((item) => (
              <Link className="queue-row" key={item.id} to={item.href}>
                <div className="queue-row-head">
                  <div>
                    <div className="queue-title">{item.title}</div>
                    <div className="queue-subtitle">{item.id}</div>
                  </div>
                  <StatusPill tone={item.tone}>{item.status}</StatusPill>
                </div>
                <p className="queue-reason">{item.reason}</p>
                <div className="queue-footer">
                  <span>{item.meta}</span>
                  <Activity size={16} />
                </div>
              </Link>
            ))
          )}
        </div>
      ) : null}

      <div className="toolbar-cluster">
        <Link className="back-link" to="/admin/inbox">
          <span>{input.t('adminOperations.openInbox')}</span>
        </Link>
      </div>
    </article>
  )
}

function formatWorkflowSourceType(input: WorkflowInboxItem['sourceType'], t: TranslateFunction) {
  if (input === 'target_distribution_request') return t('adminOperations.workflowSource.target')
  if (input === 'checklist_receipt') return t('adminOperations.workflowSource.checklist')
  if (input === 'kpi_exception') return t('adminOperations.workflowSource.kpi')
  if (input === 'store_action_plan') return t('adminOperations.workflowSource.actionPlan')
  return String(input).replaceAll('_', ' ')
}

function formatWorkflowUrgency(input: WorkflowUrgency, t: TranslateFunction) {
  if (input === 'high') return t('adminOperations.workflowUrgency.high')
  if (input === 'medium') return t('adminOperations.workflowUrgency.medium')
  if (input === 'low') return t('adminOperations.workflowUrgency.low')
  return input
}
