import type { TranslateFunction } from '../features/localization/dictionary'
import type { WorkflowInboxPressure } from './operations-workflow-signal-model'
import type { WorkforcePressure } from './operations-workforce-signal-model'

type OperatorActionTone = 'calm' | 'warning' | 'accent' | 'danger' | 'neutral'

type DataQualitySnapshot = {
  blockedBatchCount: number
  errorRowCount: number
  mappingEntityTypes: string[]
  snapshotIssueCount: number
}

export type OperatorAction = {
  href?: string
  id: string
  reason: string
  status: string
  subtitle: string
  title: string
  tone: OperatorActionTone
}

export function buildOperatorActions(input: {
  dataQuality: DataQualitySnapshot
  hasSignalError: boolean
  hasWorkforceSignalError: boolean
  hasWorkflowSignalError: boolean
  importActionCount: number
  snapshotActionCount: number
  t: TranslateFunction
  workflowPressure: WorkflowInboxPressure
  workforcePressure: WorkforcePressure
}): OperatorAction[] {
  const actions: OperatorAction[] = []
  const hasDataQualityPressure =
    input.dataQuality.errorRowCount > 0 ||
    input.dataQuality.blockedBatchCount > 0 ||
    input.dataQuality.mappingEntityTypes.length > 0 ||
    input.dataQuality.snapshotIssueCount > 0

  if (input.hasSignalError) {
    actions.push({
      id: 'signal-unavailable',
      title: input.t('adminOperations.actionSignalTitle'),
      subtitle: input.t('adminOperations.actionSignalSubtitle'),
      reason: input.t('adminOperations.actionSignalReason'),
      status: input.t('adminOperations.attention'),
      tone: 'warning',
    })
  }

  if (input.importActionCount > 0) {
    actions.push({
      href: '/admin/integrations',
      id: 'import-queue',
      title: input.t('adminOperations.actionImportTitle'),
      subtitle: input.t('adminOperations.actionImportSubtitle'),
      reason: input.t('adminOperations.actionImportReason', {
        count: input.importActionCount,
      }),
      status: input.t('adminOperations.queueHasItems', { count: input.importActionCount }),
      tone: 'warning',
    })
  }

  if (hasDataQualityPressure) {
    actions.push({
      href: '/admin/integrations',
      id: 'data-quality',
      title: input.t('adminOperations.actionDataQualityTitle'),
      subtitle: input.t('adminOperations.actionDataQualitySubtitle'),
      reason: input.t('adminOperations.actionDataQualityReason', {
        blocked: input.dataQuality.blockedBatchCount,
        errors: input.dataQuality.errorRowCount,
        snapshots: input.dataQuality.snapshotIssueCount,
      }),
      status: input.t('adminOperations.needsAttention'),
      tone: 'warning',
    })
  }

  if (input.snapshotActionCount > 0) {
    actions.push({
      href: '/admin/snapshots',
      id: 'snapshot-queue',
      title: input.t('adminOperations.actionSnapshotTitle'),
      subtitle: input.t('adminOperations.actionSnapshotSubtitle'),
      reason: input.t('adminOperations.actionSnapshotReason', {
        count: input.snapshotActionCount,
      }),
      status: input.t('adminOperations.queueHasItems', { count: input.snapshotActionCount }),
      tone: 'warning',
    })
  }

  if (!input.hasWorkforceSignalError && input.workforcePressure.total > 0) {
    actions.push({
      href: '/admin/inbox',
      id: 'workforce-queue',
      title: input.t('adminOperations.actionWorkforceTitle'),
      subtitle: input.t('adminOperations.actionWorkforceSubtitle'),
      reason: input.t('adminOperations.actionWorkforceReason', {
        offboarding: input.workforcePressure.offboardingCount,
        seller: input.workforcePressure.sellerCodeCount,
      }),
      status: input.t('adminOperations.queueHasItems', {
        count: input.workforcePressure.total,
      }),
      tone: 'warning',
    })
  }

  if (!input.hasWorkflowSignalError && input.workflowPressure.needsAttentionCount > 0) {
    actions.push({
      href: '/admin/inbox',
      id: 'workflow-inbox',
      title: input.t('adminOperations.actionWorkflowTitle'),
      subtitle: input.t('adminOperations.actionWorkflowSubtitle'),
      reason: input.t('adminOperations.actionWorkflowReason', {
        high: input.workflowPressure.highUrgencyCount,
        total: input.workflowPressure.total,
      }),
      status: input.t('adminOperations.queueHasItems', {
        count: input.workflowPressure.needsAttentionCount,
      }),
      tone: input.workflowPressure.highUrgencyCount > 0 ? 'danger' : 'warning',
    })
  }

  actions.push({
    id: 'external-evidence',
    title: input.t('adminOperations.actionExternalTitle'),
    subtitle: input.t('adminOperations.actionExternalSubtitle'),
    reason: input.t('adminOperations.actionExternalReason'),
    status: input.t('adminOperations.inputNeeded'),
    tone: 'warning',
  })

  return actions
}
