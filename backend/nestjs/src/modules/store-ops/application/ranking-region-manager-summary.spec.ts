import type { StoreRankingRow } from './ranking.contract'
import { buildRegionManagerSummary } from './ranking-region-manager-summary'

describe('KPI Region Manager summary', () => {
  it('keeps reference performance and the 52.5 boundary outside the risk list', () => {
    const rows = [70, 52.5, 52.49].map((scoreValue, i) => row({storeId: String(i), regionManagerUserId: 'm', regionManagerName: 'M', scoreValue}));
    expect(buildRegionManagerSummary(rows, {limit: 10, offset: 0}).riskStoreCount).toBe(1);
  });
  it('KPI-FR-001 keeps a manager with 51 stores in one authoritative bounded summary row', () => {
    const stores = [
      ...Array.from({ length: 51 }, (_, index) => row({
        storeId: `store-${String(index).padStart(2, '0')}`,
        regionManagerUserId: 'manager-1',
        regionManagerName: 'Onur Kaytan',
        scoreValue: index === 0 ? 49 : 63,
      })),
      row({ storeId: 'store-other', regionManagerUserId: 'manager-2', regionManagerName: 'Zeynep Ak', scoreValue: 80 }),
    ]

    expect(buildRegionManagerSummary(stores, { limit: 1, offset: 0 })).toEqual({
      items: [{
        averageScore: expect.closeTo((49 + 50 * 63) / 51),
        displayName: 'Onur Kaytan',
        riskStoreCount: 1,
        storeCount: 51,
        userId: 'manager-1',
      }],
      meta: { limit: 1, offset: 0, total: 2 },
      riskItems: [{
        averageScore: expect.closeTo((49 + 50 * 63) / 51),
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
      row({ storeId: 'store-unassigned', regionManagerUserId: null, regionManagerName: null, scoreValue: 50.4 }),
      row({ storeId: 'store-owned', regionManagerUserId: 'manager-1', regionManagerName: 'Ayşe Ak', scoreValue: 88 }),
    ], { limit: 50, offset: 0 })

    expect(result.items.map((item) => item.userId)).toEqual(['manager-1', null])
    expect(result.riskStoreCount).toBe(1)
  })

  it('returns the complete risk-manager page beside the ordinary page', () => {
    const result = buildRegionManagerSummary([
      row({ storeId: 'store-safe', regionManagerUserId: 'manager-safe', regionManagerName: 'Safe Manager', scoreValue: 90 }),
      row({ storeId: 'store-risk', regionManagerUserId: 'manager-risk', regionManagerName: 'Risk Manager', scoreValue: 42 }),
    ], { limit: 20, offset: 0, riskOffset: 0 })

    expect(result.items).toHaveLength(2)
    expect(result.riskItems).toHaveLength(1)
    expect(result.riskItems[0]?.userId).toBe('manager-risk')
    expect(result.riskMeta.total).toBe(1)
    expect(result.riskStoreCount).toBe(1)
  })

  it('keeps active role-assigned managers visible when the period has no KPI rows for them', () => {
    const result = buildRegionManagerSummary([
      row({ storeId: 'store-owned', regionManagerUserId: 'manager-1', regionManagerName: 'Ayşe Ak', scoreValue: 88 }),
    ], { limit: 50, offset: 0 }, [
      { id: 'manager-1', label: 'Ayşe Ak' },
      { id: 'manager-2', label: 'Mert Yılmaz', storeIds: ['store-2', 'store-3'] },
    ])

    expect(result.items).toEqual([
      expect.objectContaining({ userId: 'manager-1', storeCount: 1, averageScore: 88 }),
      expect.objectContaining({ userId: 'manager-2', storeCount: 2, averageScore: null }),
    ])
    expect(result.meta.total).toBe(2)
  })

  it('uses the direct store directory when more than one manager is assigned to a store', () => {
    const result = buildRegionManagerSummary([
      row({ storeId: 'shared-store', regionManagerUserId: 'manager-1', regionManagerName: 'Ayşe Ak', scoreValue: 76 }),
    ], { limit: 50, offset: 0 }, [
      { id: 'manager-1', label: 'Ayşe Ak', storeIds: ['shared-store'] },
      { id: 'manager-2', label: 'Mert Yılmaz', storeIds: ['shared-store'] },
    ])

    expect(result.items).toEqual([
      expect.objectContaining({ userId: 'manager-1', storeCount: 1, averageScore: 76 }),
      expect.objectContaining({ userId: 'manager-2', storeCount: 1, averageScore: 76 }),
    ])
  })

  it('finds a manager on a later page before applying the manager page limit', () => {
    const result = buildRegionManagerSummary([
      row({ storeId: 'store-1', regionManagerUserId: 'manager-1', regionManagerName: 'Ayşe Ak', scoreValue: 88 }),
      row({ storeId: 'store-2', regionManagerUserId: 'manager-2', regionManagerName: 'Zeynep Ak', scoreValue: 42 }),
    ], { limit: 1, offset: 0, search: 'ZEYNEP' })

    expect(result.items.map(item => item.userId)).toEqual(['manager-2'])
    expect(result.meta.total).toBe(1)
    expect(result.riskItems.map(item => item.userId)).toEqual(['manager-2'])
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
