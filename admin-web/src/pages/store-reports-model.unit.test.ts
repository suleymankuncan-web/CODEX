import { describe, expect, it } from 'vitest'
import { translate, type TranslateFunction } from '@/features/localization/dictionary'
import type { StoreMonthlyReportPackage } from '@/features/reports/api'
import { buildStoreReportsViewModel, filterStoreReportRows } from './store-reports-model'

const t: TranslateFunction = (key, params) => translate('tr', key, params)
const summary: StoreMonthlyReportPackage = { period: '2026-06', periodLabel: 'Haziran 2026', coverageLabel: '1-30 Haziran', isCurrentPeriod: false, storeCount: 2, sections: [{ code: 'kpis', label: 'KPI kolonları', value: 'Skor', status: 'ready' }], items: [{ storeName: 'İstanbul Merkez', city: 'Marmara' }, { storeName: 'Ankara Mağazası', city: 'İç Anadolu' }] }

describe('store reports presentation', () => {
  it('does not claim a package or counts before data arrives', () => {
    const model = buildStoreReportsViewModel(null, t, { period: 'Haziran 2026' })
    expect(model.metrics.slice(0, 3).map(metric => metric.value)).toEqual(['Veri yok', 'Veri yok', 'Veri yok'])
    expect(model.sections.every(section => section.status === 'missing')).toBe(true)
  })

  it('binds store and ready-section counts independently and keeps absent sections missing', () => {
    const model = buildStoreReportsViewModel(summary, t)
    expect(model.metrics.find(metric => metric.id === 'scope')?.value).toBe('2')
    expect(model.metrics.find(metric => metric.id === 'detail-output')?.value).toBe('1')
    expect(model.metrics.find(metric => metric.id === 'period-state')?.value).toBe('Bekliyor')
    expect(model.sections.filter(section => section.status === 'missing')).toHaveLength(6)
  })

  it('filters real store and region fields using Turkish casing without searching manager names', () => {
    expect(filterStoreReportRows(summary.items, 'istanbul', 'tr')).toEqual([summary.items[0]])
    expect(filterStoreReportRows(summary.items, 'iç anadolu', 'tr')).toEqual([summary.items[1]])
    expect(filterStoreReportRows(summary.items, 'no match', 'tr')).toEqual([])
    expect(filterStoreReportRows(summary.items, ' ', 'tr')).toBe(summary.items)
  })
})
