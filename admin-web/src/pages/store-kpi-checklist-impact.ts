import { toKpiDisplayNumber as toNumber } from '../features/kpi/display'

type ChecklistImpactRow = {
  actualValue: string | null
  achievementRate: string | null
  kpiCode: string
  scoreContribution: number | null | undefined
  scoreStatus: 'scored' | 'pending_normalization' | 'missing_reference' | 'missing'
  scoredRatio: number | null | undefined
}

export type ChecklistImpactComponent = {
  included: boolean
  score: number | null
  weight: number
  contribution: number | null
  status: string
  missingReason?: string
  visitCount: number
}

export function resolveLiveChecklistImpact(input: {
  rows: ChecklistImpactRow[]
  metricCode: 'BM_CHECKLIST' | 'VM_CHECKLIST'
  scoreProfile:
    | {
        metrics: Array<{
          code: string
          weightPercent: number
        }>
      }
    | undefined
}): ChecklistImpactComponent | null {
  const metricConfig = input.scoreProfile?.metrics.find(
    (metric) => metric.code === input.metricCode,
  )
  const row = input.rows.find((item) => item.kpiCode === input.metricCode)

  if (!metricConfig && !row) {
    return null
  }

  const weight = metricConfig?.weightPercent ?? row?.scoreContribution ?? 0

  if (row?.scoreStatus === 'scored' && row.actualValue !== null) {
    const score = toNumber(row.actualValue)
    const contribution =
      row.scoreContribution !== null && row.scoreContribution !== undefined
        ? row.scoreContribution
        : row.scoredRatio !== null && row.scoredRatio !== undefined
          ? row.scoredRatio * weight
          : row.achievementRate !== null && row.achievementRate !== undefined
            ? toNumber(row.achievementRate) * weight
            : null

    return {
      included: true,
      score,
      weight,
      contribution,
      status: 'included',
      visitCount: 1,
    }
  }

  return {
    included: false,
    score: null,
    weight,
    contribution: null,
    status: row?.scoreStatus ?? 'not_included',
    missingReason:
      input.metricCode === 'BM_CHECKLIST'
        ? 'bm_checklist_not_completed_for_period'
        : 'vm_checklist_not_completed_for_period',
    visitCount: 0,
  }
}
