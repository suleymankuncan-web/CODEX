import { expect, test } from './test-fixtures'
import {
  companyId,
  installGenericStoreApiFallbacks,
  installStoreContractSession,
  regionId,
  storeIds,
} from './store-page-contract-fixtures'

const requestedStoreId = storeIds[0]
const detailPath = `/store/kpis?storeId=${requestedStoreId}&periodStart=2026-07-01`
const readableStore = {
  company_id: companyId,
  region_id: regionId,
  status: 'active',
  store_code: 'CONTRACT-1',
  store_id: requestedStoreId,
  store_name: 'İstanbul MOI AVM',
}

test.beforeEach(async ({ page }) => {
  await page.route('**/api/**', route => route.fulfill({ status: 503,
    json: { message: 'Unmodeled synthetic endpoint' } }))
})

for (const role of ['REPORT_VIEWER', 'SUPER_ADMIN']) {
  for (const status of [500, 403]) {
    test(`${role} selected KPI store load ${status} remains detail error and retry opens that store`, async ({ page }) => {
      await installStoreContractSession(page, 'reportViewer', { roleCodes: [role] })
      await installGenericStoreApiFallbacks(page)
      let recovered = false
      let storeListReads = 0
      const highlightsReads: URL[] = []
      page.on('request', request => {
        const url = new URL(request.url())
        if (url.pathname === '/api/reports/store-kpi-highlights') highlightsReads.push(url)
      })
      await page.route('**/api/org/stores', async route => {
        storeListReads += 1
        if (!recovered) {
          await route.fulfill({ status, json: { message: status === 403 ? 'Forbidden' : 'Store list unavailable' } })
          return
        }
        await route.fulfill({ json: { items: [readableStore], meta: { total: 1 } } })
      })

      await page.goto(detailPath)
      await expect(page.getByRole('heading', { name: 'Mağaza listesi açılamadı', exact: true })).toBeVisible()
      await expect(page.getByTestId('store-kpis-company-overview')).toHaveCount(0)
      await expect(page.getByTestId('store-kpis-manager-overview')).toHaveCount(0)
      expect(highlightsReads).toEqual([])
      expect(new URL(page.url()).searchParams.get('storeId')).toBe(requestedStoreId)

      const failedReads = storeListReads
      recovered = true
      await page.getByRole('button', { name: 'Tekrar dene', exact: true }).click()
      const detail = page.getByTestId('store-kpis-manager-overview')
      await expect(detail).toBeVisible()
      await expect(detail.getByRole('heading', { name: readableStore.store_name, exact: true })).toBeVisible()
      expect(storeListReads).toBeGreaterThan(failedReads)
      expect(highlightsReads.length).toBeGreaterThan(0)
      expect(highlightsReads.every(url => url.searchParams.get('storeId') === requestedStoreId)).toBe(true)
      expect(highlightsReads.every(url => url.searchParams.get('periodStart') === '2026-07-01')).toBe(true)
      await expect(page.getByTestId('store-kpis-company-overview')).toHaveCount(0)
      expect(new URL(page.url()).searchParams.get('storeId')).toBe(requestedStoreId)
    })
  }

  for (const outcome of ['empty', 'omitted'] as const) {
    test(`${role} selected KPI store ${outcome} remains unavailable without querying its highlights`, async ({ page }) => {
      await installStoreContractSession(page, 'reportViewer', { roleCodes: [role] })
      await installGenericStoreApiFallbacks(page)
      const highlightsReads: string[] = []
      page.on('request', request => {
        if (new URL(request.url()).pathname === '/api/reports/store-kpi-highlights') highlightsReads.push(request.url())
      })
      await page.route('**/api/org/stores', async route => {
        const items = outcome === 'empty' ? [] : [{ ...readableStore, store_id: storeIds[1], store_name: 'Bursa Downtown AVM' }]
        await route.fulfill({ json: { items, meta: { total: items.length } } })
      })

      await page.goto(detailPath)
      await expect(page.getByRole('heading', { name: 'Yetkili mağaza bulunamadı', exact: true })).toBeVisible()
      await expect(page.getByTestId('store-kpis-company-overview')).toHaveCount(0)
      await expect(page.getByTestId('store-kpis-manager-overview')).toHaveCount(0)
      expect(highlightsReads).toEqual([])
      expect(new URL(page.url()).searchParams.get('storeId')).toBe(requestedStoreId)
    })
  }
}
