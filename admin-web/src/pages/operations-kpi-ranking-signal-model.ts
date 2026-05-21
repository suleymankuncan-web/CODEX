import type { KpiConfigResponse, RankingSummary } from '../features/reports/api'

export type KpiRankingReadiness = {
  availablePeriodCount: number
  hasPublishedConfig: boolean
  hasRankingPeriod: boolean
  issueCount: number
  personnelPopulation: number
  storePopulation: number
  totalPopulation: number
}

export function summarizeKpiRankingReadiness(input: {
  config: KpiConfigResponse | undefined
  rankings: RankingSummary | undefined
}): KpiRankingReadiness {
  const hasPublishedConfig = Boolean(
    input.config?.metadata.versionNo ?? input.config?.metadata.publishedAt,
  )
  const hasRankingPeriod = Boolean(
    input.rankings?.source.periodStart && input.rankings.source.periodEnd,
  )
  const issueCount = Number(!hasPublishedConfig) + Number(!hasRankingPeriod)
  const storePopulation = input.rankings?.storeLeaderboard.meta.total ?? 0
  const personnelPopulation = input.rankings?.personnelLeaderboard.meta.total ?? 0

  return {
    availablePeriodCount: input.rankings?.availablePeriods.length ?? 0,
    hasPublishedConfig,
    hasRankingPeriod,
    issueCount,
    personnelPopulation,
    storePopulation,
    totalPopulation: storePopulation + personnelPopulation,
  }
}
