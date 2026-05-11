import type { KpiScoreProfileMetric } from '../reports/api'

export function matchesKpiMetricCode(
  metric: KpiScoreProfileMetric,
  candidateCode: string,
) {
  if (metric.code === candidateCode) {
    return true
  }

  return metric.aliases?.includes(candidateCode) ?? false
}
