import { buildBoundedManagedPersonnelPage, buildSearchedManagedPersonnelPage } from './ranking-managed-personnel-page'

describe('KPI managed personnel page', () => {
  it('SH-FR-008 exposes every scoped row through bounded pages without a fixed 100-row claim', () => {
    const rows = Array.from({ length: 101 }, (_, index) => `employee-${index}`)

    expect(buildBoundedManagedPersonnelPage(rows, { limit: 50, offset: 100 })).toEqual({
      items: ['employee-100'],
      meta: { limit: 50, offset: 100, total: 101 },
    })
  })

  it('finds an assigned person beyond page one without including another store', () => {
    const rows = Array.from({ length: 51 }, (_, index) => ({
      subject: 'personnel' as const, employeeId: `employee-${index}`, displayName: `Personel ${index}`,
      storeId: 'store-1', storeName: 'Store 1', regionId: null, regionName: null,
      regionManagerUserId: null, regionManagerName: null, rank: index + 1, population: 51,
      storeRank: index + 1, storePopulation: 51, scoreValue: 80, canOpenProfile: true,
      visibility: 'detail' as const, metrics: [],
    }))
    const outside = { ...rows[50], employeeId: 'outside', storeId: 'store-2' }
    const assignments = new Map(rows.map(row => [row.employeeId, { store_id: 'store-1' }]))
    assignments.set(outside.employeeId, { store_id: 'store-2' })

    const page = buildSearchedManagedPersonnelPage([...rows, outside], assignments, ['store-1'], 'Personel 50', { limit: 50, offset: 0 })
    expect(page.meta.total).toBe(1)
    expect(page.items.map(row => row.employeeId)).toEqual(['employee-50'])

    const storeNameMatch = buildSearchedManagedPersonnelPage([...rows, outside], assignments, ['store-1'], 'Store 1', { limit: 50, offset: 0 })
    expect(storeNameMatch.meta.total).toBe(0)
  })
})
