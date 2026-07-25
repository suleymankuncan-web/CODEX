import { AlertTriangle, ArrowRight, CheckCircle2 } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '../components/ui/button'
import type { TranslateFunction } from '../features/localization/dictionary'
import type { DailyClosureStatus, SnapshotOverview } from '../features/snapshots/api'
import {
  formatSnapshotState,
  mapSnapshotSurfaceTone,
} from '../features/snapshots/snapshot-surface-semantics'
import {
  AdminKeyValue as KeyValue,
  AdminKeyValueGrid,
  AdminSurfaceBadge,
  AdminSurfaceEmpty,
  AdminSurfaceSection,
  type AdminSurfaceTone,
} from './admin-surface-primitives'

export function SnapshotOperationsBrief(input: {
  dailyClosure: DailyClosureStatus
  overview: SnapshotOverview
  t: TranslateFunction
}) {
  const pressureCount = input.overview.healthTotals.stuck + input.overview.healthTotals.retryReady
  const pressureTone = getPressureTone(input.overview)
  const latestSignal = getLatestSignal(input.overview, input.t)
  const latestEvidence = latestSignal?.snapshotRunId ?? input.t('adminSnapshots.noRunsEvidence')

  return (
    <div className="tw:grid tw:grid-cols-1 tw:gap-3 tw:xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
      <AdminSurfaceSection
        eyebrow={input.t('adminSnapshots.decisionBriefEyebrow')}
        title={input.t('adminSnapshots.decisionBriefTitle')}
        description={input.t('adminSnapshots.decisionBriefCopy')}
        badge={
          <AdminSurfaceBadge tone={pressureTone}>
            {input.t('adminSnapshots.queuePressureValue', { count: pressureCount })}
          </AdminSurfaceBadge>
        }
      >
        <AdminKeyValueGrid className="tw:lg:grid-cols-3">
          <KeyValue
            label={input.t('adminSnapshots.queuePressure')}
            value={input.t('adminSnapshots.queuePressureValue', { count: pressureCount })}
          />
          <KeyValue
            label={input.t('adminSnapshots.closureGate')}
            value={
              input.dailyClosure.canQueue
                ? input.t('adminSnapshots.readyToQueue')
                : input.t('adminSnapshots.waitingOrClosed')
            }
          />
          <KeyValue label={input.t('adminSnapshots.latestSignal')} value={latestEvidence} />
        </AdminKeyValueGrid>
      </AdminSurfaceSection>

      <AdminSurfaceSection
        eyebrow={input.t('adminSnapshots.priorityRunEyebrow')}
        title={input.t('adminSnapshots.priorityRunTitle')}
        badge={
          latestSignal ? (
            <AdminSurfaceBadge tone={latestSignal.tone}>
              {latestSignal.label}
            </AdminSurfaceBadge>
          ) : (
            <AdminSurfaceBadge tone="success">{input.t('adminSnapshots.noActionNeeded')}</AdminSurfaceBadge>
          )
        }
        actions={
          latestSignal ? (
            <Button asChild size="sm" variant="outline">
              <Link to={`/admin/snapshots/${latestSignal.snapshotRunId}`}>
                {input.t('adminSnapshots.openSnapshotRun')}
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          ) : null
        }
      >
        {latestSignal ? (
          <>
            <AdminKeyValueGrid className="tw:lg:grid-cols-3">
              <KeyValue
                label={input.t('adminSnapshots.snapshotRunId')}
                value={latestSignal.snapshotRunId}
              />
              <KeyValue
                label={input.t('adminSnapshots.latestSignal')}
                value={latestSignal.label}
              />
              <KeyValue
                label={input.t('adminSnapshots.queuePressure')}
                value={input.t('adminSnapshots.queuePressureValue', { count: pressureCount })}
              />
            </AdminKeyValueGrid>
            <div className="tw:grid tw:gap-2 tw:rounded-lg tw:border tw:border-border tw:bg-background/60 tw:p-3 tw:text-sm">
              <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-2">
                {latestSignal.tone === 'danger' ? (
                  <AlertTriangle className="tw:size-4 tw:text-rose-600" aria-hidden="true" />
                ) : (
                  <CheckCircle2 className="tw:size-4 tw:text-emerald-600" aria-hidden="true" />
                )}
                <span className="tw:font-medium">{latestSignal.description}</span>
              </div>
              <span className="tw:text-muted-foreground">{input.t('adminSnapshots.openLatestSignalCopy')}</span>
            </div>
          </>
        ) : (
          <AdminSurfaceEmpty
            title={input.t('adminSnapshots.emptyDecisionTitle')}
            copy={input.t('adminSnapshots.emptyDecisionCopy')}
          />
        )}
      </AdminSurfaceSection>
    </div>
  )
}

function getPressureTone(overview: SnapshotOverview): AdminSurfaceTone {
  if (overview.healthTotals.stuck > 0) return 'danger'
  if (overview.healthTotals.retryReady > 0) return 'accent'
  if (overview.healthTotals.inProgress > 0) return 'neutral'
  return 'success'
}

function getLatestSignal(overview: SnapshotOverview, t: TranslateFunction): {
  description: string
  label: string
  snapshotRunId: string
  tone: AdminSurfaceTone
} | null {
  if (overview.latest.stuckSnapshotRunId) {
    return {
      description: t('adminSnapshots.stuckNote'),
      label: formatSnapshotState('stuck', t),
      snapshotRunId: overview.latest.stuckSnapshotRunId,
      tone: 'danger',
    }
  }
  if (overview.latest.failedSnapshotRunId) {
    return {
      description: t('adminSnapshots.retryReadyNote'),
      label: formatSnapshotState('failed', t),
      snapshotRunId: overview.latest.failedSnapshotRunId,
      tone: mapSnapshotSurfaceTone('retry_ready'),
    }
  }
  if (overview.latest.inProgressSnapshotRunId) {
    return {
      description: t('adminSnapshots.inProgressNote', {
        count: overview.healthTotals.inProgress,
      }),
      label: formatSnapshotState('in_progress', t),
      snapshotRunId: overview.latest.inProgressSnapshotRunId,
      tone: 'neutral',
    }
  }
  if (overview.latest.completedSnapshotRunId) {
    return {
      description: t('adminSnapshots.healthyNote', {
        count: overview.healthTotals.healthy,
      }),
      label: formatSnapshotState('healthy', t),
      snapshotRunId: overview.latest.completedSnapshotRunId,
      tone: 'success',
    }
  }
  return null
}
