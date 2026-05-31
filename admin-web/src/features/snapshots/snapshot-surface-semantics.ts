import type { TranslateFunction } from '../localization/dictionary'

export type SnapshotSurfaceTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'cyan'

export function formatSnapshotType(input: string, t: TranslateFunction) {
  if (input === 'daily') return t('adminSnapshots.type.daily')
  if (input === 'weekly') return t('adminSnapshots.type.weekly')
  if (input === 'monthly') return t('adminSnapshots.type.monthly')
  if (input === 'payroll') return t('adminSnapshots.type.payroll')
  if (input === 'compliance') return t('adminSnapshots.type.compliance')
  return input.replaceAll('_', ' ')
}

export function formatSnapshotState(input: string, t: TranslateFunction) {
  if (input === 'queued') return t('adminSnapshots.status.queued')
  if (input === 'running') return t('adminSnapshots.status.running')
  if (input === 'completed') return t('adminSnapshots.status.completed')
  if (input === 'failed') return t('adminSnapshots.status.failed')
  if (input === 'healthy') return t('adminSnapshots.health.healthy')
  if (input === 'in_progress') return t('adminSnapshots.health.inProgress')
  if (input === 'retry_ready') return t('adminSnapshots.health.retryReady')
  if (input === 'needs_action') return t('adminSnapshots.health.needsAction')
  if (input === 'stuck') return t('adminSnapshots.health.stuck')
  return input.replaceAll('_', ' ')
}

export function mapSnapshotSurfaceTone(state: string): SnapshotSurfaceTone {
  if (state === 'healthy' || state === 'completed') return 'success'
  if (state === 'ready' || state === 'retry_ready') return 'accent'
  if (state === 'blocked') return 'warning'
  if (state === 'stuck' || state === 'needs_action') return 'danger'
  return 'neutral'
}
