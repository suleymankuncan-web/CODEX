import { Link } from 'react-router-dom'
import { Button } from '../components/ui/button'
import type { TranslateFunction } from '../features/localization/dictionary'
import type { WorkflowInboxItem, WorkflowUrgency } from '../features/workflow/contracts'
import { mapWorkflowUrgencyTone } from '../features/workflow/contracts'
import { getErrorMessage } from '../lib/format'
import type { WorkflowInboxPressure } from './operations-workflow-signal-model'
import {
  OperationsInlineState,
  OperationsKeyValue,
  OperationsKeyValueGrid,
  OperationsPanel,
  OperationsQueueList,
  OperationsStatusBadge,
  type OperationsTone,
} from './operations-surface-primitives'

type WorkflowQueuePreviewItem = {
  href: string
  id: string
  meta: string
  reason: string
  status: string
  title: string
  tone: OperationsTone
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
    <OperationsPanel
      eyebrow={input.t('adminOperations.workflowEyebrow')}
      title={input.t('adminOperations.workflowTitle')}
      description={input.t('adminOperations.workflowCopy')}
      testId="operations-workflow-signal"
      badge={
        <OperationsStatusBadge tone={input.isError ? 'warning' : input.pressure.needsAttentionCount > 0 ? 'warning' : 'calm'}>
          {input.isError
            ? input.t('adminOperations.unavailable')
            : input.pressure.needsAttentionCount > 0
              ? input.t('adminOperations.needsAttention')
              : input.t('adminOperations.ready')}
        </OperationsStatusBadge>
      }
      actions={
        <Button asChild size="sm" variant="outline">
          <Link to="/admin/inbox">{input.t('adminOperations.openInbox')}</Link>
        </Button>
      }
    >

      {input.isError ? (
        <OperationsInlineState tone="warning">{getErrorMessage(input.error)}</OperationsInlineState>
      ) : (
        <OperationsKeyValueGrid>
          <OperationsKeyValue
            label={input.t('adminOperations.workflowNeedsAttention')}
            value={String(input.pressure.needsAttentionCount)}
          />
          <OperationsKeyValue
            label={input.t('adminOperations.workflowHighUrgency')}
            value={String(input.pressure.highUrgencyCount)}
          />
          <OperationsKeyValue
            label={input.t('adminOperations.workflowTotal')}
            value={String(input.pressure.total)}
          />
        </OperationsKeyValueGrid>
      )}

      {!input.isError ? (
        <OperationsQueueList
          emptyCopy={input.t('adminOperations.workflowQueueEmpty')}
          header={input.t('adminOperations.workflowQueueTitle')}
          status={
            <OperationsStatusBadge tone={previewItems.length > 0 ? 'warning' : 'calm'}>
              {previewItems.length > 0
                ? input.t('adminOperations.queueHasItems', { count: previewItems.length })
                : input.t('adminOperations.queueClear')}
            </OperationsStatusBadge>
          }
          items={previewItems.map((item) => ({
            footer: item.meta,
            href: item.href,
            id: item.id,
            meta: item.id,
            reason: item.reason,
            status: item.status,
            title: item.title,
            tone: item.tone,
          }))}
        />
      ) : null}
    </OperationsPanel>
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
