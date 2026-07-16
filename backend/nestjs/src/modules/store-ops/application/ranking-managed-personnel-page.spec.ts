import { buildBoundedManagedPersonnelPage } from './ranking-managed-personnel-page'

describe('KPI managed personnel page', () => {
  it('SH-FR-008 exposes every scoped row through bounded pages without a fixed 100-row claim', () => {
    const rows = Array.from({ length: 101 }, (_, index) => `employee-${index}`)

    expect(buildBoundedManagedPersonnelPage(rows, { limit: 50, offset: 100 })).toEqual({
      items: ['employee-100'],
      meta: { limit: 50, offset: 100, total: 101 },
    })
  })
})
