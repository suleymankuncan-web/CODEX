import { describe, expect, it } from 'vitest'
import {
  buildChecklistPlanningDays,
  buildChecklistCommandQuery,
  buildChecklistVisitPlanCandidateQuery,
  buildChecklistVisitPlanPeriodQuery,
  buildChecklistVisitPlanRegionOptionsQuery,
  buildVisitPlanDraftFingerprint,
  createChecklistCommandPeriod,
  getStableVisitPlanSubmission,
  getChecklistPeriodWeekStart,
  getIstanbulWeekStart,
  getChecklistCommandSortLabel,
  getChecklistCommandStatusLabel,
  reconcileVisitPlanDrafts,
  resolveVisitPlanDraftConflicts,
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
    expect(getChecklistPeriodWeekStart('2026-08')).toBe('2026-08-03')

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

  it('builds bounded full-period and server-paged candidate queries', () => {
    expect(buildChecklistVisitPlanRegionOptionsQuery({ query: ' Marmara ', limit: 20, offset: 40 }).toString())
      .toBe('query=Marmara&limit=20&offset=40')

    expect(buildChecklistVisitPlanPeriodQuery({
      regionId: 'region-1', period: '2026-07', query: ' Novada ', risk: 'high',
      planStatus: 'planned', sort: 'next_plan_asc', limit: 30, offset: 60,
    }).toString()).toBe('regionId=region-1&period=2026-07&query=Novada&risk=high&planStatus=planned&sort=next_plan_asc&limit=30&offset=60')

    expect(buildChecklistVisitPlanCandidateQuery({
      regionId: 'region-1', query: ' Bursa ', limit: 20, offset: 40,
    }).toString()).toBe('regionId=region-1&query=Bursa&limit=20&offset=40')
  })

  it('reuses one idempotency key for the same draft snapshot and rotates after a change', () => {
    const keys = ['key-1', 'key-2']
    const createKey = () => keys.shift()!
    const first = getStableVisitPlanSubmission(null, 'draft-a', createKey)
    const retry = getStableVisitPlanSubmission(first, 'draft-a', createKey)
    const changed = getStableVisitPlanSubmission(retry, 'draft-b', createKey)

    expect(retry).toBe(first)
    expect(first.idempotencyKey).toBe('key-1')
    expect(changed).toEqual({ fingerprint: 'draft-b', idempotencyKey: 'key-2' })
  })

  it('reapplies local changes without deleting concurrent changes for another store', () => {
    const baseline = [
      { storeId: 'store-a', plannedDate: '2026-07-13', displayOrder: 0 },
      { storeId: 'store-b', plannedDate: '2026-07-14', displayOrder: 1 },
    ]
    const local = [
      { storeId: 'store-a', plannedDate: '2026-07-15', displayOrder: 0 },
      baseline[1]!,
    ]
    const latest = [
      ...baseline,
      { storeId: 'store-c', plannedDate: '2026-07-16', displayOrder: 2 },
    ]

    expect(reconcileVisitPlanDrafts(baseline, local, latest)).toEqual({
      items: [
        { storeId: 'store-b', plannedDate: '2026-07-14', displayOrder: 0 },
        { storeId: 'store-a', plannedDate: '2026-07-15', displayOrder: 1 },
        { storeId: 'store-c', plannedDate: '2026-07-16', displayOrder: 2 },
      ],
      conflictingStoreIds: [],
    })
  })

  it('requires an explicit choice when local and remote changes touch the same store', () => {
    const baseline = [{ storeId: 'store-a', plannedDate: '2026-07-13', displayOrder: 0 }]
    const local = [{ storeId: 'store-a', plannedDate: '2026-07-14', displayOrder: 0 }]
    const latest = [{ storeId: 'store-a', plannedDate: '2026-07-15', displayOrder: 0 }]
    const reconciliation = reconcileVisitPlanDrafts(baseline, local, latest)

    expect(reconciliation.conflictingStoreIds).toEqual(['store-a'])
    expect(resolveVisitPlanDraftConflicts(
      reconciliation.items,
      local,
      reconciliation.conflictingStoreIds,
    )).toEqual(local)
    expect(resolveVisitPlanDraftConflicts(
      reconciliation.items,
      latest,
      reconciliation.conflictingStoreIds,
    )).toEqual(latest)
  })

  it('builds an Istanbul business period from explicit month and year', () => {
    expect(createChecklistCommandPeriod(2026, 1)).toBe('2026-01')
    expect(createChecklistCommandPeriod(2026, 12)).toBe('2026-12')
  })

  it('toggles sortable headings and exposes direction in their text', () => {
    expect(toggleChecklistCommandSort('store_asc', 'store')).toBe('store_desc')
    expect(toggleChecklistCommandSort('store_desc', 'store')).toBe('store_asc')
    expect(toggleChecklistCommandSort('store_asc', 'bm')).toBe('bm_score_desc')
    expect(toggleChecklistCommandSort('bm_score_desc', 'bm')).toBe('bm_score_asc')
    expect(toggleChecklistCommandSort('bm_score_asc', 'bm')).toBe('bm_score_desc')
    expect(toggleChecklistCommandSort('store_asc', 'elapsed')).toBe('elapsed_desc')
    expect(toggleChecklistCommandSort('elapsed_desc', 'elapsed')).toBe('elapsed_asc')
    expect(toggleChecklistCommandSort('store_asc', 'status')).toBe('status_asc')
    expect(toggleChecklistCommandSort('status_asc', 'status')).toBe('status_desc')
    expect(getChecklistCommandSortLabel('Mağaza', 'store', 'store_desc')).toBe('Mağaza ↓')
    expect(getChecklistCommandSortLabel('BM', 'bm', 'store_desc')).toBe('BM')
    expect(getChecklistCommandSortLabel('Puan', 'bm', 'bm_score_asc')).toBe('Puan ↑')
    expect(getChecklistCommandSortLabel('Geçen süre', 'elapsed', 'elapsed_desc')).toBe('Geçen süre ↓')
    expect(getChecklistCommandSortLabel('Durum', 'status', 'status_asc')).toBe('Durum ↑')
  })

  it('uses the approved operational language for row states', () => {
    expect(getChecklistCommandStatusLabel('needs_visit', 'tr')).toBe('Ziyaret gerekli')
    expect(getChecklistCommandStatusLabel('active', 'tr')).toBe('Aksiyon Takipte')
    expect(getChecklistCommandStatusLabel('pending', 'tr')).toBe('Kabul bekliyor')
    expect(getChecklistCommandStatusLabel('completed', 'tr')).toBe('Tamamlandı')
  })
})
