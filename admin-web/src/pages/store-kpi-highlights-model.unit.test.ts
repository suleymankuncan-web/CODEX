import { describe, expect, it } from 'vitest'
import { resolveCompanyStoreSelection } from './store-kpi-company-selection'

const stores = [
  {
    company_id: 'company-1',
    region_id: 'region-1',
    status: 'active',
    store_code: 'IST-01',
    store_id: 'store-1',
    store_name: 'Istanbul Store',
  },
  {
    company_id: 'company-1',
    region_id: 'region-2',
    status: 'active',
    store_code: 'ANK-01',
    store_id: 'store-2',
    store_name: 'Ankara Store',
  },
]

describe('resolveCompanyStoreSelection', () => {
  it('uses a validated company store when Report Viewer has no URL selection', () => {
    expect(resolveCompanyStoreSelection({
      isReportViewer: true,
      selectedStoreId: '',
      stores,
    })).toMatchObject({
      effectiveStoreId: 'store-1',
      selectedStoreId: 'store-1',
      options: [{ storeId: 'store-1' }, { storeId: 'store-2' }],
    })
  })

  it('falls back to the company portfolio when a URL store is outside the returned list', () => {
    expect(resolveCompanyStoreSelection({
      isReportViewer: true,
      selectedStoreId: 'store-from-another-company',
      stores,
    }).effectiveStoreId).toBe('store-1')
  })

  it('keeps existing assigned-store behavior for non-Report Viewer roles', () => {
    expect(resolveCompanyStoreSelection({
      isReportViewer: false,
      primaryStoreId: 'store-1',
      selectedStoreId: '',
      stores: [],
    })).toMatchObject({
      effectiveStoreId: 'store-1',
      selectedStoreId: '',
    })
  })
})
