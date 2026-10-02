import type { TranslateFunction, TranslationKey } from '../localization/dictionary'

const defaultMetricNames: Record<string, { labels: string[]; key: TranslationKey }> = {
  TARGET_ACHIEVEMENT: { labels: ['Target Achievement', 'Hedef gerceklestirme orani'], key: 'adminKpiConfig.metric.TARGET_ACHIEVEMENT' },
  CR: { labels: ['CR', 'Conversion Rate'], key: 'adminKpiConfig.metric.CR' },
  ATV: { labels: ['ATV', 'Average Ticket Value'], key: 'adminKpiConfig.metric.ATV' },
  UPT: { labels: ['UPT', 'Units Per Ticket'], key: 'adminKpiConfig.metric.UPT' },
  BM_CHECKLIST: { labels: ['BM Checklist'], key: 'adminKpiConfig.metric.BM_CHECKLIST' },
  VM_CHECKLIST: { labels: ['VM Checklist'], key: 'adminKpiConfig.metric.VM_CHECKLIST' },
  gsm_approval: { labels: ['GSM Onayı', 'GSM Onay', 'GSM Approval'], key: 'adminKpiConfig.metric.gsmApproval' },
  GSM_ONAY: { labels: ['GSM Onayı', 'GSM Onay', 'GSM Approval'], key: 'adminKpiConfig.metric.gsmApproval' },
}

/** Translate known display defaults without rewriting the editable config value. */
export function kpiMetricDisplayName(code: string, label: string, t: TranslateFunction) {
  const known = Object.hasOwn(defaultMetricNames, code) ? defaultMetricNames[code] : undefined
  return known?.labels.includes(label) ? t(known.key) : label.trim() || t('adminKpiConfig.newMetric')
}

export function kpiBandDisplayName(label: string, t: TranslateFunction) {
  const keys: Record<string, TranslationKey> = {
    Excellent: 'adminKpiConfig.band.excellent', Mukemmel: 'adminKpiConfig.band.excellent',
    Healthy: 'adminKpiConfig.band.healthy', Iyi: 'adminKpiConfig.band.healthy',
    'Follow up': 'adminKpiConfig.band.followup',
    Critical: 'adminKpiConfig.band.critical',
  }
  return Object.hasOwn(keys, label) ? t(keys[label]!) : label.trim() || t('adminKpiConfig.newBand')
}

export function kpiProfileDisplayText(value: string, t: TranslateFunction) {
  const keys: Record<string, TranslationKey> = {
    'Store manager owns the operational scorecard for the current store. The score is weighted and ready for future metric additions.': 'adminKpiConfig.profile.storeSummary',
    'Store personnel should have an individual scorecard that stays related to, but separate from, the store score.': 'adminKpiConfig.profile.personnelSummary',
    'New metrics such as GSM approvals should be added through the KPI catalog and score profile, not hard-coded into one page.': 'adminKpiConfig.profile.storeRule',
    'Personnel weights should live in the same rule system as store weights, but remain a separate profile.': 'adminKpiConfig.profile.personnelRule',
  }
  return Object.hasOwn(keys, value) ? t(keys[value]!) : value
}

export function kpiAuditEventLabel(eventType: string, t: TranslateFunction) {
  return t(eventType === 'kpi_config.published' ? 'adminKpiConfig.audit.published'
    : eventType === 'kpi_config.draft_saved' ? 'adminKpiConfig.audit.saved'
    : 'adminKpiConfig.audit.changed')
}
