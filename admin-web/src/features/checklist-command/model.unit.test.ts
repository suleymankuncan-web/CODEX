import { describe, expect, it } from 'vitest'
import {
  buildChecklistPlanningDays,
  buildChecklistCommandQuery,
  buildVisitPlanDraftFingerprint,
  createChecklistCommandPeriod,
  getIstanbulWeekStart,
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
    ).toBe('period=2026-07&sort=store_asc&query=Novada&limit=30&offset=0')
  })

  it('resolves the Istanbul business week to Monday and exposes Monday through Saturday', () => {
    expect(getIstanbulWeekStart(new Date('2026-07-14T21:30:00.000Z'))).toBe('2026-07-13')

    expect(buildChecklistPlanningDays('2026-07-13', 'tr')).toEqual([
      { isoDate: '2026-07-13', dayLabel: 'Pazartesi', shortLabel: 'Pzt', dateLabel: '13 Tem' },
      { isoDate: '2026-07-14', dayLabel: 'Salı', shortLabel: 'Sal', dateLabel: '14 Tem' },
      { isoDate: '2026-07-15', dayLabel: 'Çarşamba', shortLabel: 'Çar', dateLabel: '15 Tem' },
      { isoDate: '2026-07-16', dayLabel: 'Perşembe', shortLabel: 'Per', dateLabel: '16 Tem' },
      { isoDate: '2026-07-17', dayLabel: 'Cuma', shortLabel: 'Cum', dateLabel: '17 Tem' },
      { isoDate: '2026-07-18', dayLabel: 'Cumartesi', shortLabel: 'Cmt', dateLabel: '18 Tem' },
    ])
  })

  it('fingerprints a full-week draft independent of row order while preserving different days', () => {
    const first = [
      { storeId: 'store-a', plannedDate: '2026-07-13', displayOrder: 0 },
      { storeId: 'store-a', plannedDate: '2026-07-15', displayOrder: 1 },
    ]

    expect(buildVisitPlanDraftFingerprint(first)).toBe(
      buildVisitPlanDraftFingerprint([first[1]!, first[0]!]),
    )
    expect(buildVisitPlanDraftFingerprint(first)).not.toBe(
      buildVisitPlanDraftFingerprint([{ ...first[1]!, plannedDate: '2026-07-16' }, first[0]!]),
    )
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
