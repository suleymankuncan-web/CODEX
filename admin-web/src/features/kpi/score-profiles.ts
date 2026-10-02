import type { KpiScoreProfileMetric } from '../reports/api'

export function matchesKpiMetricCode(
  metric: Pick<KpiScoreProfileMetric, 'code' | 'aliases'>,
  candidateCode: string,
) {
  if (normalizeMetricCode(metric.code) === normalizeMetricCode(candidateCode)) {
    return true
  }

  return metric.aliases?.some(
    (alias) => normalizeMetricCode(alias) === normalizeMetricCode(candidateCode),
  ) ?? false
}

function normalizeMetricCode(input: string) {
  const normalized = input.trim().toLowerCase()
  if (normalized === 'gsm_approval' || normalized === 'gsm_onay') {
    return 'gsm_approval'
  }

  return normalized
}
