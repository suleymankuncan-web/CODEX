import type {
  KpiOwnerRole,
  KpiScoreProfileMetric,
} from '../reports/api'

export function formatKpiOwnerRole(role: KpiOwnerRole) {
  return role.toLowerCase().replaceAll('_', ' ')
}

export function matchesKpiMetricCode(
  metric: KpiScoreProfileMetric,
  candidateCode: string,
) {
  if (metric.code === candidateCode) {
    return true
  }

  return metric.aliases?.includes(candidateCode) ?? false
}
