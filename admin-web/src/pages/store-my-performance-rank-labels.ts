import type { TranslateFunction } from '../features/localization/dictionary'

type RegionRankSource = {
  regionPopulation?: number | null
  regionRank?: number | null
}

export function formatRank(input: number | null | undefined, t: TranslateFunction) {
  return input ? `${input}.` : t('storeMe.noData')
}

export function formatPopulation(input: number | null | undefined, t: TranslateFunction) {
  return input && input > 0 ? t('storeMe.rankPopulation', { count: input }) : t('storeMe.noData')
}

export function formatRegionRankLabels(input: RegionRankSource | null | undefined, t: TranslateFunction) {
  return {
    regionPopulationLabel: formatPopulation(input?.regionPopulation, t),
    regionRankLabel: formatRank(input?.regionRank, t),
  }
}
