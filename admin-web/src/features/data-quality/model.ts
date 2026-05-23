import type { ImportOverview, NeedsActionItem } from '../integrations/api'
import type { KpiConfigResponse, RankingSummary } from '../reports/api'
import type { SnapshotNeedsActionItem, SnapshotOverview } from '../snapshots/api'
import type { OffboardingRequests, SellerCodeRequests } from '../workforce/api'

export type DataQualityCenterSummary = {
  blockedBatchCount: number
  importActionCount: number
  mappingEntityTypes: string[]
  previewErrorRows: number
  snapshotActionCount: number
  snapshotRetryReadyCount: number
  workforcePendingCount: number
  sellerCodePendingCount: number
  offboardingPendingCount: number
  sourceTrustGapCount: number
  totalPressure: number
}

export function summarizeDataQualityCenter(input: {
  importItems: NeedsActionItem[]
  importOverview: ImportOverview | undefined
  kpiConfig: KpiConfigResponse | undefined
  rankings: RankingSummary | undefined
  snapshotItems: SnapshotNeedsActionItem[]
  snapshotOverview: SnapshotOverview | undefined
  sellerCodeRequests: SellerCodeRequests | undefined
  offboardingRequests: OffboardingRequests | undefined
}): DataQualityCenterSummary {
  const mappingEntityTypes = new Set<string>()

  for (const item of input.importItems) {
    for (const entityType of item.blockedByEntityTypes) {
      mappingEntityTypes.add(entityType)
    }
  }

  const importActionCount =
    (input.importOverview?.healthTotals.blocked ?? 0) +
    (input.importOverview?.healthTotals.needsAction ?? 0) +
    (input.importOverview?.healthTotals.retryReady ?? 0) +
    (input.importOverview?.healthTotals.stuck ?? 0)
  const snapshotActionCount =
    (input.snapshotOverview?.healthTotals.needsAction ?? 0) +
    (input.snapshotOverview?.healthTotals.retryReady ?? 0) +
    (input.snapshotOverview?.healthTotals.stuck ?? 0)
  const previewErrorRows = input.importItems.reduce(
    (total, item) => total + item.errorCount,
    0,
  )
  const sellerCodePendingCount = input.sellerCodeRequests?.meta.total ?? 0
  const offboardingPendingCount = input.offboardingRequests?.meta.total ?? 0
  const sourceTrustGapCount = countSourceTrustGaps(input.kpiConfig, input.rankings)

  return {
    blockedBatchCount: input.importOverview?.healthTotals.blocked ?? 0,
    importActionCount,
    mappingEntityTypes: [...mappingEntityTypes].sort(),
    previewErrorRows,
    snapshotActionCount,
    snapshotRetryReadyCount: input.snapshotOverview?.healthTotals.retryReady ?? 0,
    workforcePendingCount: sellerCodePendingCount + offboardingPendingCount,
    sellerCodePendingCount,
    offboardingPendingCount,
    sourceTrustGapCount,
    totalPressure:
      importActionCount +
      snapshotActionCount +
      sellerCodePendingCount +
      offboardingPendingCount +
      sourceTrustGapCount,
  }
}

function countSourceTrustGaps(
  kpiConfig: KpiConfigResponse | undefined,
  rankings: RankingSummary | undefined,
) {
  let gaps = 0

  if (!kpiConfig?.metadata.publishedAt || !kpiConfig.metadata.versionNo) {
    gaps += 1
  }

  if (!rankings?.source.periodStart || !rankings.source.periodEnd) {
    gaps += 1
  }

  return gaps
}
