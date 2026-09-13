import { describe, expect, it } from 'vitest'
import type { WorkforceCommandStore } from './api'
import {
  filterAndSortPersonnel,
  filterAndSortStores,
  workforceWorkspaceQueryKey,
  workforceStoreStatus,
} from './workforce-command-model'

const store = (input: Partial<WorkforceCommandStore> & Pick<WorkforceCommandStore, 'storeId' | 'storeName'>): WorkforceCommandStore => ({
  companyId: 'company', companyName: 'Company', regionId: 'region', regionName: 'Region',
  regionManagerName: 'Manager', storeCode: input.storeId, storeStatus: 'active', norm: 5,
  active: 5, averageTenureDays: 365, gap: 0, shortageDays: null, personnel: [], personnelTotal: 0, ...input,
  personnelLimit: 50, personnelOffset: 0, personnelHasMore: false,
})

describe('workforce command model', () => {
  it('filters a loaded page locally without changing its source dataset', () => {
    const stores = [store({ storeId: 'a', storeName: 'Alpha', gap: 2 }), store({ storeId: 'b', storeName: 'Beta' })]
    const result = filterAndSortStores({ stores, query: '', status: 'all', rail: 'gap', sort: 'store', direction: 'ascending' })
    expect(result.map((item) => item.storeId)).toEqual(['a'])
    expect(stores).toHaveLength(2)
  })

  it('keeps missing norms distinct from a balanced zero gap', () => {
    expect(workforceStoreStatus(store({ storeId: 'a', storeName: 'A', norm: null, gap: null }))).toBe('unconfigured')
    expect(workforceStoreStatus(store({ storeId: 'b', storeName: 'B', norm: 5, gap: 0 }))).toBe('balanced')
  })

  it('sorts missing employment dates last in both directions', () => {
    const personnel = [
      { employeeId: 'missing', displayName: 'B', positionId: 'p', positionCode: 'P', positionName: 'P', assignmentStartDate: null, employmentStatus: 'active' },
      { employeeId: 'known', displayName: 'A', positionId: 'p', positionCode: 'P', positionName: 'P', assignmentStartDate: '2025-01-01', employmentStatus: 'active' },
    ]
    expect(filterAndSortPersonnel({ personnel, query: '', position: 'all', sort: 'start', direction: 'descending', now: new Date('2026-01-01') }).map((item) => item.employeeId)).toEqual(['known', 'missing'])
  })

  it('binds workspace cache identity to the resolved role scope', () => {
    const common = {
      offset: 0,
      personnelOffset: 0,
      query: '',
      status: 'all' as const,
      sort: 'store' as const,
      direction: 'ascending' as const,
      rail: 'all' as const,
    }
    const reportViewer = workforceWorkspaceQueryKey({ ...common, scopeSignature: 'REPORT_VIEWER:company-a' })
    const storeManager = workforceWorkspaceQueryKey({ ...common, scopeSignature: 'STORE_MANAGER:store-a' })

    expect(reportViewer).not.toEqual(storeManager)
    expect(reportViewer[1]).toBe('REPORT_VIEWER:company-a')
    expect(storeManager[1]).toBe('STORE_MANAGER:store-a')
  })
  it('keeps real manager user selections in separate workspace caches', () => {
    const common = { scopeSignature: 'REPORT_VIEWER:company', offset: 0, personnelOffset: 0, query: '', status: 'all' as const, sort: 'store' as const, direction: 'ascending' as const, rail: 'all' as const }
    expect(workforceWorkspaceQueryKey({ ...common, regionManagerUserId: 'user-a' })).not.toEqual(workforceWorkspaceQueryKey({ ...common, regionManagerUserId: 'user-b' }))
    expect(workforceWorkspaceQueryKey(common)).not.toEqual(workforceWorkspaceQueryKey({ ...common, regionManagerUserId: 'user-a' }))
  })

})
