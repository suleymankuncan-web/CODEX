import type { NeedsActionItem } from '../features/integrations/api'
import type { RankingSummary } from '../features/reports/api'
import type { SnapshotNeedsActionItem } from '../features/snapshots/api'
import type { OffboardingRequest, SellerCodeRequest } from '../features/workforce/api'
import type { KpiRankingReadiness } from './operations-kpi-ranking-signal-model'
import type { WorkflowInboxPressure } from './operations-workflow-signal-model'
import type { WorkforcePressure } from './operations-workforce-signal-model'

export type OperationsSignalFreshnessItem = {
  count: number | null
  family: 'import' | 'snapshot' | 'workforce' | 'workflow' | 'kpi'
  href: string
  lastObservedAt: string | null
  status: 'attention' | 'loading' | 'ready' | 'unavailable'
}

export function summarizeSignalFreshness(input: {
  importActionCount: number
  importItems: NeedsActionItem[]
  importState: SignalSourceState
  kpiRankingReadiness: KpiRankingReadiness
  kpiState: SignalSourceState
  rankings: RankingSummary | undefined
  snapshotActionCount: number
  snapshotItems: SnapshotNeedsActionItem[]
  snapshotState: SignalSourceState
  workflowItems: Array<{
    createdAt?: string | null
    needsAttentionAt?: string | null
  }>
  workflowPressure: WorkflowInboxPressure
  workflowState: SignalSourceState
  workforcePressure: WorkforcePressure
  workforceState: SignalSourceState
  sellerCodeItems: SellerCodeRequest[]
  offboardingItems: OffboardingRequest[]
}): OperationsSignalFreshnessItem[] {
  return [
    {
      family: 'import',
      count: resolveSignalCount(input.importState, input.importActionCount),
      href: '/admin/integrations',
      lastObservedAt: newestTimestamp(
        input.importItems.flatMap((item) => [item.finishedAt, item.startedAt]),
      ),
      status: resolveSignalStatus(input.importState, input.importActionCount),
    },
    {
      family: 'snapshot',
      count: resolveSignalCount(input.snapshotState, input.snapshotActionCount),
      href: '/admin/snapshots',
      lastObservedAt: newestTimestamp(
        input.snapshotItems.flatMap((item) => [item.finishedAt, item.generatedAt, item.snapshotDate]),
      ),
      status: resolveSignalStatus(input.snapshotState, input.snapshotActionCount),
    },
    {
      family: 'workforce',
      count: resolveSignalCount(input.workforceState, input.workforcePressure.total),
      href: '/admin/inbox',
      lastObservedAt: newestTimestamp(
        [...input.sellerCodeItems, ...input.offboardingItems].flatMap((item) => [
          item.updatedAt,
          item.createdAt,
        ]),
      ),
      status: resolveSignalStatus(input.workforceState, input.workforcePressure.total),
    },
    {
      family: 'workflow',
      count: resolveSignalCount(input.workflowState, input.workflowPressure.needsAttentionCount),
      href: '/admin/inbox',
      lastObservedAt: newestTimestamp(
        input.workflowItems.flatMap((item) => [item.needsAttentionAt, item.createdAt]),
      ),
      status: resolveSignalStatus(input.workflowState, input.workflowPressure.needsAttentionCount),
    },
    {
      family: 'kpi',
      count: resolveSignalCount(input.kpiState, input.kpiRankingReadiness.issueCount),
      href: '/admin/reports',
      lastObservedAt: input.rankings?.source.periodEnd ?? null,
      status: resolveSignalStatus(input.kpiState, input.kpiRankingReadiness.issueCount),
    },
  ]
}

export type SignalSourceState = {
  isError: boolean
  isLoading: boolean
}

export function signalStateFromQueries(...queries: SignalSourceState[]): SignalSourceState {
  return {
    isError: queries.some((query) => query.isError),
    isLoading: queries.some((query) => query.isLoading),
  }
}

function resolveSignalCount(state: SignalSourceState, count: number) {
  return state.isError || state.isLoading ? null : count
}

function resolveSignalStatus(state: SignalSourceState, count: number): OperationsSignalFreshnessItem['status'] {
  if (state.isError) return 'unavailable'
  if (state.isLoading) return 'loading'
  return count > 0 ? 'attention' : 'ready'
}

function newestTimestamp(values: Array<string | null | undefined>) {
  const sorted = values
    .filter((value): value is string => Boolean(value))
    .map((value) => ({ value, time: new Date(value).getTime() }))
    .filter((item) => Number.isFinite(item.time))
    .sort((left, right) => right.time - left.time)

  return sorted[0]?.value ?? null
}
