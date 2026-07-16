import type { StoreRankingRow } from './ranking.contract'
import { buildRegionManagerSummary } from './ranking-region-manager-summary'

describe('KPI Region Manager summary', () => {
  it('KPI-FR-001 keeps a manager with 51 stores in one authoritative bounded summary row', () => {
    const stores = [
      ...Array.from({ length: 51 }, (_, index) => row({
        storeId: `store-${String(index).padStart(2, '0')}`,
        regionManagerUserId: 'manager-1',
        regionManagerName: 'Onur Kaytan',
        scoreValue: index === 0 ? 70 : 90,
      })),
      row({ storeId: 'store-other', regionManagerUserId: 'manager-2', regionManagerName: 'Zeynep Ak', scoreValue: 80 }),
    ]

    expect(buildRegionManagerSummary(stores, { limit: 1, offset: 0 })).toEqual({
      items: [{
        averageScore: expect.closeTo((70 + 50 * 90) / 51),
        displayName: 'Onur Kaytan',
        riskStoreCount: 1,
        storeCount: 51,
        userId: 'manager-1',
      }],
      meta: { limit: 1, offset: 0, total: 2 },
      riskItems: [{
        averageScore: expect.closeTo((70 + 50 * 90) / 51),
        displayName: 'Onur Kaytan',
        riskStoreCount: 1,
        storeCount: 51,
        userId: 'manager-1',
      }],
      riskMeta: { limit: 1, offset: 0, total: 1 },
      riskStoreCount: 1,
    })
  })

  it('keeps stores without a manager explicit and last', () => {
    const result = buildRegionManagerSummary([
      row({ storeId: 'store-unassigned', regionManagerUserId: null, regionManagerName: null, scoreValue: 72 }),
      row({ storeId: 'store-owned', regionManagerUserId: 'manager-1', regionManagerName: 'Ayşe Ak', scoreValue: 88 }),
    ], { limit: 50, offset: 0 })

    expect(result.items.map((item) => item.userId)).toEqual(['manager-1', null])
    expect(result.riskStoreCount).toBe(1)
  })

  it('returns the complete risk-manager page beside the ordinary page', () => {
    const result = buildRegionManagerSummary([
      row({ storeId: 'store-safe', regionManagerUserId: 'manager-safe', regionManagerName: 'Safe Manager', scoreValue: 90 }),
      row({ storeId: 'store-risk', regionManagerUserId: 'manager-risk', regionManagerName: 'Risk Manager', scoreValue: 60 }),
    ], { limit: 20, offset: 0, riskOffset: 0 })

    expect(result.items).toHaveLength(2)
    expect(result.riskItems).toHaveLength(1)
    expect(result.riskItems[0]?.userId).toBe('manager-risk')
    expect(result.riskMeta.total).toBe(1)
    expect(result.riskStoreCount).toBe(1)
  })
})

function row(input: {
  storeId: string
  regionManagerUserId: string | null
  regionManagerName: string | null
  scoreValue: number
}) {
  return {
    subject: 'store',
    storeName: input.storeId,
    regionId: null,
    regionName: null,
    rank: 1,
    population: 1,
    visibility: 'detail',
    metrics: [],
    ...input,
  } as StoreRankingRow
}
