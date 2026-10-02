import { describe, expect, it } from 'vitest'
import { translate, type TranslateFunction } from '../localization/dictionary'
import { kpiAuditEventLabel, kpiBandDisplayName, kpiMetricDisplayName, kpiProfileDisplayText } from './kpi-config-display'

const tr: TranslateFunction = (key, params) => translate('tr', key, params)
const en: TranslateFunction = (key, params) => translate('en', key, params)

describe('KPI settings presentation preserves configured content', () => {
  it('translates known metric defaults while preserving custom names and blank rows', () => {
    expect(kpiMetricDisplayName('TARGET_ACHIEVEMENT', 'Target Achievement', tr)).toBe('Hedef gerçekleşme')
    expect(kpiMetricDisplayName('CR', 'CR', tr)).toBe('Dönüşüm oranı (CR)')
    expect(kpiMetricDisplayName('UPT', 'Units Per Ticket', en)).toBe('Units per ticket (UPT)')
    expect(kpiMetricDisplayName('UPT', 'Benim özel KPI adım', tr)).toBe('Benim özel KPI adım')
    expect(kpiMetricDisplayName('CUSTOM', 'Custom score', tr)).toBe('Custom score')
    expect(kpiMetricDisplayName('toString', 'Custom score', tr)).toBe('Custom score')
    expect(kpiMetricDisplayName('', '', tr)).toBe('Yeni KPI')
  })

  it('understands canonical and legacy GSM names without replacing a custom label', () => {
    for (const code of ['gsm_approval', 'GSM_ONAY']) {
      expect(kpiMetricDisplayName(code, 'GSM Approval', tr)).toBe('GSM Onayı')
      expect(kpiMetricDisplayName(code, 'GSM Onay', tr)).toBe('GSM Onayı')
      expect(kpiMetricDisplayName(code, 'Özel onay adı', tr)).toBe('Özel onay adı')
    }
  })

  it('localizes standard band and profile text while keeping custom configuration text', () => {
    expect(kpiBandDisplayName('Excellent', tr)).toBe('Mükemmel')
    expect(kpiBandDisplayName('İstisnai durum', tr)).toBe('İstisnai durum')
    expect(kpiBandDisplayName('constructor', tr)).toBe('constructor')
    expect(kpiProfileDisplayText('Personnel weights should live in the same rule system as store weights, but remain a separate profile.', tr)).toBe('Personel ağırlıkları ayrı bir profil olarak yönetilir.')
    expect(kpiProfileDisplayText('Company specific rule', tr)).toBe('Company specific rule')
  })

  it('names actual audit event types without exposing raw event names', () => {
    expect(kpiAuditEventLabel('kpi_config.draft_saved', tr)).toBe('Taslak kaydedildi')
    expect(kpiAuditEventLabel('kpi_config.published', tr)).toBe('Ayarlar yayınlandı')
    expect(kpiAuditEventLabel('kpi_config.updated', tr)).toBe('Ayarlar güncellendi')
    expect(kpiAuditEventLabel('unknown.internal.event', tr)).toBe('Ayarlar güncellendi')
  })
})
