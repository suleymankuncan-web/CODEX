import type {
  KpiOwnerRole,
  KpiScoreProfileMetric,
} from '../reports/api'

export function formatKpiOwnerRole(role: KpiOwnerRole) {
  switch (role) {
    case 'DEPUTY_GM':
      return 'Genel müdür yardımcısı'
    case 'REGION_MANAGER':
      return 'Bölge müdürü'
    case 'STORE_MANAGER':
      return 'Mağaza müdürü'
    case 'STORE_PERSONNEL':
      return 'Mağaza personeli'
    case 'VISUAL_TEAM':
      return 'Görsel ekip'
    default:
      return String(role).toLowerCase().replaceAll('_', ' ')
  }
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
