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
  it('KPI-FR-001 keeps Report Viewer at company hierarchy without a URL store selection', () => {
    expect(resolveCompanyStoreSelection({
      isReportViewer: true,
      selectedStoreId: '',
      stores,
    })).toMatchObject({
      effectiveStoreId: undefined,
      selectedStoreId: '',
      options: [{ storeId: 'store-1' }, { storeId: 'store-2' }],
    })
  })

  it('EC-002 fails closed when a Report Viewer URL store is outside the returned company list', () => {
    expect(resolveCompanyStoreSelection({
      isReportViewer: true,
      selectedStoreId: 'store-from-another-company',
      stores,
    })).toMatchObject({ effectiveStoreId: undefined, selectedStoreId: '' })
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
