import { describe, expect, it } from 'vitest'
import {
  buildKpiMonthlyHistory,
  classifyKpiReference,
  classifyPersonnelPerformance,
  groupKpiStoresByRegionManager,
  sortKpiStoreRows,
  toHundredPointLiveStoreScore,
} from './store-kpis-command-contract'

describe('KPI Command Canvas contract', () => {
  it('renders the live store score contract on a 100-point scale', () => {
    expect(toHundredPointLiveStoreScore(0.98)).toBe(98)
    expect(toHundredPointLiveStoreScore(1)).toBe(100)
    expect(toHundredPointLiveStoreScore(1.2)).toBe(120)
    expect(toHundredPointLiveStoreScore(91.5)).toBe(91.5)
    expect(toHundredPointLiveStoreScore(98)).toBe(98)
    expect(toHundredPointLiveStoreScore(null)).toBeNull()
    expect(toHundredPointLiveStoreScore(Number.NaN)).toBeNull()
  })

  it('KPI-FR-003 / AC-KPI-003 keeps reference thresholds distinct from personnel status', () => {
    expect(classifyKpiReference({ actual: 100, reference: 100 })).toEqual({
      kind: 'good',
      label: 'good',
      ratio: 1,
    })
    expect(classifyKpiReference({ actual: 80.01, reference: 100 })).toMatchObject({
      kind: 'watch',
      label: 'watch',
    })
    expect(classifyKpiReference({ actual: 80, reference: 100 })).toMatchObject({
      kind: 'action',
      label: 'action',
    })
    expect(classifyKpiReference({ actual: null, reference: 100 })).toEqual({
      kind: 'action',
      label: 'action',
      ratio: null,
    })
    expect(classifyKpiReference({ actual: 80, reference: 0 })).toEqual({
      kind: 'unavailable',
      label: 'unavailable',
      ratio: null,
    })
  })

  it('KPI-FR-003 classifies personnel performance without reusing KPI reference labels', () => {
    expect(classifyPersonnelPerformance(85)).toBe('strong')
    expect(classifyPersonnelPerformance(84.99)).toBe('watch')
    expect(classifyPersonnelPerformance(75)).toBe('watch')
    expect(classifyPersonnelPerformance(74.99)).toBe('behind')
    expect(classifyPersonnelPerformance(null)).toBe('unavailable')
  })

  it('KPI-FR-005 / AC-KPI-004 preserves internal missing months as null gaps', () => {
    expect(buildKpiMonthlyHistory({
      year: 2026,
      rows: [
        { periodStart: '2026-01-01', score: 82 },
        { periodStart: '2026-03-01', score: 88 },
      ],
    })).toEqual([
      { periodStart: '2026-01-01', score: 82 },
      { periodStart: '2026-02-01', score: null },
      { periodStart: '2026-03-01', score: 88 },
      { periodStart: '2026-04-01', score: null },
      { periodStart: '2026-05-01', score: null },
      { periodStart: '2026-06-01', score: null },
      { periodStart: '2026-07-01', score: null },
      { periodStart: '2026-08-01', score: null },
      { periodStart: '2026-09-01', score: null },
      { periodStart: '2026-10-01', score: null },
      { periodStart: '2026-11-01', score: null },
      { periodStart: '2026-12-01', score: null },
    ])
  })

  it('KPI-FR-001 groups one bounded Report Viewer page by Region Manager without inventing identity', () => {
    const groups = groupKpiStoresByRegionManager([
      storeRow({ storeId: 'store-b', storeName: 'B Store', regionManagerUserId: 'rm-1', regionManagerName: 'Ayse' }),
      storeRow({ storeId: 'store-a', storeName: 'A Store', regionManagerUserId: 'rm-1', regionManagerName: 'Ayse' }),
      storeRow({ storeId: 'store-c', storeName: 'C Store', regionManagerUserId: null, regionManagerName: null }),
    ])

    expect(groups).toEqual([
      {
        key: 'rm-1',
        manager: { displayName: 'Ayse', userId: 'rm-1' },
        stores: [expect.objectContaining({ storeId: 'store-a' }), expect.objectContaining({ storeId: 'store-b' })],
      },
      {
        key: 'unavailable',
        manager: null,
        stores: [expect.objectContaining({ storeId: 'store-c' })],
      },
    ])
  })

  it('SH-FR-006/007 sorts one bounded store page locally with nulls last and stable IDs', () => {
    const rows = [
      storeRow({ storeId: 'store-c', storeName: 'C Store', regionManagerUserId: 'rm-1', regionManagerName: 'Ayse', scoreValue: Number.NaN }),
      storeRow({ storeId: 'store-b', storeName: 'B Store', regionManagerUserId: 'rm-1', regionManagerName: 'Ayse', scoreValue: 80 }),
      storeRow({ storeId: 'store-a', storeName: 'A Store', regionManagerUserId: 'rm-1', regionManagerName: 'Ayse', scoreValue: 80 }),
    ]

    expect(sortKpiStoreRows(rows, 'score', 'asc').map((row) => row.storeId)).toEqual([
      'store-a',
      'store-b',
      'store-c',
    ])
    expect(sortKpiStoreRows(rows, 'score', 'desc').map((row) => row.storeId)).toEqual([
      'store-a',
      'store-b',
      'store-c',
    ])
  })
})

function storeRow(input: {
  storeId: string
  storeName: string
  regionManagerUserId: string | null
  regionManagerName: string | null
  scoreValue?: number
}) {
  return {
    subject: 'store' as const,
    regionId: null,
    regionName: null,
    rank: 1,
    population: 3,
    scoreValue: input.scoreValue ?? 80,
    visibility: 'detail' as const,
    ...input,
  }
}
