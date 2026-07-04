import type { TranslateFunction } from '../features/localization/dictionary'
import type { MyPerformanceMetric, MyPerformanceSummary } from '../features/reports/api'
import {
  getStoreMePerformancePercentile,
  resolveStoreMePerformanceBadge,
  type StoreMePerformanceBadge,
} from './store-me-performance-badges'

export type StoreMeShareCardViewModel = {
  badge: StoreMePerformanceBadge | null
  employeeName: string
  isAvailable: boolean
  periodKey: string
  periodLabel: string
  percentile: number | null
  score: number | null
  storeName: string
  turkeyPopulation: number | null
  turkeyRank: number | null
  unavailableReason: string | null
}

type ScoreRow = {
  scoreValue: number | null
}

type StoreMeShareCardModelInput = {
  isPartial: boolean
  performance: MyPerformanceSummary
  periodKey: string
  periodLabel: string
  previousPerformance: MyPerformanceSummary | null | undefined
  previousPeriodScore: number | null
  scoreRows: ScoreRow[]
  storeName: string
  targetMetric: MyPerformanceMetric | null | undefined
  targetProgressPercent: number | null
  t: TranslateFunction
}

function getTrustedTargetAchievementPercent(
  metric: MyPerformanceMetric | null | undefined,
  progressPercent: number | null,
) {
  if (
    !metric ||
    metric.scoreStatus === 'missing_reference' ||
    metric.scoreStatus === 'pending_normalization' ||
    metric.scoreStatus === 'missing' ||
    metric.dataStatus === 'missing'
  ) {
    return null
  }

  return progressPercent
}

function getRoundedScore(performance: MyPerformanceSummary) {
  return Number.isFinite(performance.score.value) ? Math.round(performance.score.value) : null
}

export function buildStoreMeShareCardViewModel(input: StoreMeShareCardModelInput): StoreMeShareCardViewModel {
  const employeeName = input.performance.employee?.displayName?.trim() ?? ''
  const score = getRoundedScore(input.performance)
  const targetAchievementPercent = getTrustedTargetAchievementPercent(input.targetMetric, input.targetProgressPercent)
  const percentile = getStoreMePerformancePercentile({
    turkeyPopulation: input.performance.rankings.turkeyPopulation,
    turkeyRank: input.performance.rankings.turkeyRank,
  })
  const badgeInput = {
    currentPeriodDataQuality: input.isPartial ? 'partial' as const : 'trusted' as const,
    periodKey: input.periodKey,
    previousPeriodScore: input.previousPeriodScore,
    previousPeriodTurkeyRank: input.previousPerformance?.rankings.turkeyRank ?? null,
    regionPopulation: input.performance.rankings.regionPopulation,
    regionRank: input.performance.rankings.regionRank,
    score,
    scoreHistory: input.scoreRows
      .map((row) => row.scoreValue)
      .filter((rowScore): rowScore is number => typeof rowScore === 'number' && Number.isFinite(rowScore)),
    storePopulation: input.performance.rankings.storePopulation,
    storeRank: input.performance.rankings.storeRank,
    targetAchievementPercent,
    turkeyPopulation: input.performance.rankings.turkeyPopulation,
    turkeyRank: input.performance.rankings.turkeyRank,
  }

  return {
    badge: resolveStoreMePerformanceBadge(badgeInput),
    employeeName,
    isAvailable:
      employeeName !== '' &&
      input.storeName.trim() !== '' &&
      score !== null &&
      badgeInput.turkeyRank !== null &&
      badgeInput.turkeyPopulation !== null &&
      badgeInput.turkeyPopulation > 0 &&
      !input.isPartial,
    periodKey: input.periodKey,
    periodLabel: input.periodLabel,
    percentile,
    score,
    storeName: input.storeName,
    turkeyPopulation: input.performance.rankings.turkeyPopulation,
    turkeyRank: input.performance.rankings.turkeyRank,
    unavailableReason: input.isPartial
      ? input.t('storeMe.shareCardUnavailablePartial')
      : input.t('storeMe.shareCardUnavailableCopy'),
  }
}
