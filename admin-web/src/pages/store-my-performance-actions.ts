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
  code: string
  deltaValue: number | null
  displayValue: string
  label: string
  progressPercent: number
}

function uniqueLabels(labels: string[]) {
  return Array.from(new Set(labels.map((label) => label.trim()).filter(Boolean)))
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

  if (targetCard && input.targetProgressPercent > 0 && input.targetProgressPercent < 100) {
    pushAction({
      id: 'target-behind',
      icon: 'target',
      variant: 'secondary',
      badge: input.t('storeMe.priorityOne'),
      title: input.t('storeMe.action.targetBehind.title'),
      copy: input.t('storeMe.action.targetBehind.copy', { value: input.targetProgressPercent }),
    })
  }

  if (atvCard && (atvCard.progressPercent < 80 || (atvCard.deltaValue ?? 0) < 0)) {
    pushAction({
      id: 'atv-watch',
      icon: 'metric',
      variant: 'outline',
      badge: input.t('storeMe.opportunity'),
      title: input.t('storeMe.action.atvWatch.title'),
      copy: input.t('storeMe.action.atvWatch.copy', { value: atvCard.displayValue }),
    })
  }

  if (uptCard && (uptCard.progressPercent < 80 || (uptCard.deltaValue ?? 0) < 0)) {
    pushAction({
      id: 'upt-watch',
      icon: 'metric',
      variant: 'outline',
      badge: input.t('storeMe.opportunity'),
      title: input.t('storeMe.action.uptWatch.title'),
      copy: input.t('storeMe.action.uptWatch.copy', { value: uptCard.displayValue }),
    })
  }

  if ((input.samePeriodScoreDeltaValue ?? 0) < 0) {
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

  if (actions.length === 0) {
    const strongestMetric = input.metricCards
      .filter((card) => card.progressPercent > 0)
      .toSorted((left, right) => right.progressPercent - left.progressPercent)
      .at(0)

    pushAction({
      id: 'maintain-rhythm',
      icon: 'rhythm',
      variant: 'secondary',
      badge: input.t('storeMe.follow'),
      title: input.t('storeMe.action.maintain.title'),
      copy: input.t('storeMe.action.maintain.copy', {
        metric: strongestMetric?.label ?? input.t('storeMe.score'),
      }),
    })
  }

  return actions.slice(0, 4)
}
