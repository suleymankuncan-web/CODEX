import { describe, expect, it } from 'vitest'
import {
  buildChecklistCommandQuery,
  createChecklistCommandPeriod,
  getChecklistCommandSortLabel,
  getChecklistCommandStatusLabel,
  toggleChecklistCommandSort,
} from './model'

describe('checklist command canvas model', () => {
  it('serializes one bounded server page without blank filters', () => {
    expect(
      buildChecklistCommandQuery({
        period: '2026-07',
        status: 'all',
        sort: 'store_asc',
        query: '  Novada  ',
        limit: 30,
        offset: 0,
      }).toString(),
    ).toBe('period=2026-07&sort=store_asc&q=Novada&limit=30&offset=0')
  })

  it('builds an Istanbul business period from explicit month and year', () => {
    expect(createChecklistCommandPeriod(2026, 1)).toBe('2026-01')
    expect(createChecklistCommandPeriod(2026, 12)).toBe('2026-12')
  })

  it('toggles sortable headings and exposes direction in their text', () => {
    expect(toggleChecklistCommandSort('store_asc', 'store')).toBe('store_desc')
    expect(toggleChecklistCommandSort('store_desc', 'store')).toBe('store_asc')
    expect(toggleChecklistCommandSort('store_asc', 'bm')).toBe('bm_score_desc')
    expect(toggleChecklistCommandSort('store_asc', 'status')).toBe('status_asc')
    expect(toggleChecklistCommandSort('status_asc', 'status')).toBe('status_desc')
    expect(getChecklistCommandSortLabel('Mağaza', 'store', 'store_desc')).toBe('Mağaza ↓')
    expect(getChecklistCommandSortLabel('BM', 'bm', 'store_desc')).toBe('BM')
    expect(getChecklistCommandSortLabel('Durum', 'status', 'status_asc')).toBe('Durum ↑')
  })

  it('uses the approved operational language for row states', () => {
    expect(getChecklistCommandStatusLabel('needs_visit', 'tr')).toBe('Ziyaret gerekli')
    expect(getChecklistCommandStatusLabel('active', 'tr')).toBe('Aksiyon Takipte')
    expect(getChecklistCommandStatusLabel('pending', 'tr')).toBe('Kabul bekliyor')
    expect(getChecklistCommandStatusLabel('completed', 'tr')).toBe('Tamamlandı')
  })
})
