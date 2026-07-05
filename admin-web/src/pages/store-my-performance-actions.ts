import type { TranslateFunction } from '../features/localization/dictionary'
import type { MyPerformanceSummary } from '../features/reports/api'

export type StoreMyPerformanceTodayAction = {
  badge: string
  copy: string
  icon: 'data' | 'metric' | 'rhythm' | 'target'
  id: string
  title: string
  variant: 'default' | 'secondary' | 'outline' | 'destructive'
}

type TodayActionMetricCard = {
  actionValueAvailable?: boolean
  code: string
  deltaValue: number | null
  displayValue: string
  label: string
  progressPercent: number
}

const KPI_AVERAGE_THRESHOLD_PERCENT = 100
const SIGNIFICANT_REGRESSION_PERCENT = -5
const TARGET_BEHIND_THRESHOLD_PERCENT = 100

type MetricAttentionReason = 'below-average' | 'regression'

function uniqueLabels(labels: string[]) {
  return Array.from(new Set(labels.map((label) => label.trim()).filter(Boolean)))
}

function hasActionValue(metricCard: TodayActionMetricCard | null) {
  return Boolean(metricCard?.actionValueAvailable ?? true)
}

function getMetricAttentionReason(metricCard: TodayActionMetricCard | null): MetricAttentionReason | null {
  if (!metricCard || !hasActionValue(metricCard)) {
    return null
  }

  if (metricCard.progressPercent > 0 && metricCard.progressPercent < KPI_AVERAGE_THRESHOLD_PERCENT) {
    return 'below-average'
  }

  if (
    metricCard.progressPercent >= KPI_AVERAGE_THRESHOLD_PERCENT &&
    metricCard.deltaValue !== null &&
    metricCard.deltaValue <= SIGNIFICANT_REGRESSION_PERCENT
  ) {
    return 'regression'
  }

  return null
}

export function buildStoreMyPerformanceTodayActions(input: {
  metricCards: TodayActionMetricCard[]
  partial: NonNullable<MyPerformanceSummary['partial']>
  pendingNormalizationLabels: string[]
  samePeriodScoreDelta: string | null
  samePeriodScoreDeltaValue: number | null
  t: TranslateFunction
  targetProgressPercent: number
}): StoreMyPerformanceTodayAction[] {
  const actions: StoreMyPerformanceTodayAction[] = []
  const pushAction = (action: StoreMyPerformanceTodayAction) => {
    if (!actions.some((existing) => existing.id === action.id)) {
      actions.push(action)
    }
  }
  const labels = uniqueLabels([
    ...input.partial.missingMetricLabels,
    ...input.pendingNormalizationLabels,
  ])
  const labelSummary = labels.length ? labels.join(', ') : input.t('storeMe.noMetricDetail')
  const atvCard = input.metricCards.find((card) => card.code === 'ATV') ?? null
  const uptCard = input.metricCards.find((card) => card.code === 'UPT') ?? null
  const targetCard = input.metricCards.find((card) => card.code === 'TARGET_ACHIEVEMENT') ?? null

  if (input.partial.isPartial || labels.length > 0) {
    pushAction({
      id: 'data-confidence',
      icon: 'data',
      variant: 'destructive',
      badge: input.t('storeMe.data'),
      title: input.t('storeMe.action.dataConfidence.title'),
      copy: input.t('storeMe.action.dataConfidence.copy', { labels: labelSummary }),
    })
  }

  if (
    targetCard &&
    hasActionValue(targetCard) &&
    input.targetProgressPercent > 0 &&
    input.targetProgressPercent < TARGET_BEHIND_THRESHOLD_PERCENT
  ) {
    pushAction({
      id: 'target-behind',
      icon: 'target',
      variant: 'secondary',
      badge: input.t('storeMe.priorityOne'),
      title: input.t('storeMe.action.targetBehind.title'),
      copy: input.t('storeMe.action.targetBehind.copy', { value: input.targetProgressPercent }),
    })
  }

  const atvAttentionReason = getMetricAttentionReason(atvCard)

  if (atvCard && atvAttentionReason !== null) {
    pushAction({
      id: atvAttentionReason === 'regression' ? 'atv-regression' : 'atv-below-average',
      icon: 'metric',
      variant: 'outline',
      badge: input.t('storeMe.opportunity'),
      title:
        atvAttentionReason === 'regression'
          ? input.t('storeMe.action.atvRegression.title')
          : input.t('storeMe.action.atvWatch.title'),
      copy: input.t(
        atvAttentionReason === 'regression'
          ? 'storeMe.action.atvRegression.copy'
          : 'storeMe.action.atvWatch.copy',
        { value: atvCard.displayValue },
      ),
    })
  }

  const uptAttentionReason = getMetricAttentionReason(uptCard)

  if (uptCard && uptAttentionReason !== null) {
    pushAction({
      id: uptAttentionReason === 'regression' ? 'upt-regression' : 'upt-below-average',
      icon: 'metric',
      variant: 'outline',
      badge: input.t('storeMe.opportunity'),
      title:
        uptAttentionReason === 'regression'
          ? input.t('storeMe.action.uptRegression.title')
          : input.t('storeMe.action.uptWatch.title'),
      copy: input.t(
        uptAttentionReason === 'regression'
          ? 'storeMe.action.uptRegression.copy'
          : 'storeMe.action.uptWatch.copy',
        { value: uptCard.displayValue },
      ),
    })
  }

  if (
    input.samePeriodScoreDeltaValue !== null &&
    input.samePeriodScoreDeltaValue <= SIGNIFICANT_REGRESSION_PERCENT
  ) {
    pushAction({
      id: 'score-trend',
      icon: 'rhythm',
      variant: 'outline',
      badge: input.t('storeMe.follow'),
      title: input.t('storeMe.action.scoreTrend.title'),
      copy: input.t('storeMe.action.scoreTrend.copy', {
        delta: input.samePeriodScoreDelta ?? input.t('storeMe.noTrendData'),
      }),
    })
  }

  return actions.slice(0, 4)
}
