import { expect, test, type Page } from './test-fixtures'
import {
  installGenericStoreApiFallbacks,
  installStoreContractSession,
  regionId,
  storeIds,
} from './store-page-contract-fixtures'

test('workforce region table uses full surface without selected-store side panel', async ({ page }) => {
  await installStoreContractSession(page, 'regionManager')
  await installGenericStoreApiFallbacks(page)
  await routeWorkforceContractApi(page)

  await page.goto('/store/workforce')

  await expect(page.getByRole('heading', { name: 'Norm Kadro' })).toBeVisible()
  await expect(page.getByText('Seçili mağaza')).toHaveCount(0)
  await expect(page.getByTestId('store-workforce-region-rows')).toBeVisible()
  await expect(page.getByTestId('store-workforce-region-row')).toHaveCount(3)
})

test('workforce detail dialog keeps active tab visible and footer close action usable', async ({ page }) => {
  await installStoreContractSession(page, 'regionManager')
  await installGenericStoreApiFallbacks(page)
  await routeWorkforceContractApi(page)

  await page.goto('/store/workforce')
  await page.getByTestId('store-workforce-region-row').first().getByRole('button', { name: /Detay/i }).click()

  const dialog = page.getByTestId('store-workforce-region-detail-dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog.locator('.swc-tab-trigger.active', { hasText: 'Personel' })).toBeVisible()
  await dialog.getByRole('button', { name: 'Pozisyon' }).click()
  await expect(dialog.locator('.swc-tab-trigger.active', { hasText: 'Pozisyon' })).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Kapat' }).last()).toBeVisible()
})

async function routeWorkforceContractApi(page: Page) {
  await page.route('**/api/org/stores', async (route) => {
    await route.fulfill({
      json: {
        items: storeIds.map((storeId, index) => ({
          company_id: 'company-contract-1',
          region_id: regionId,
          status: 'active',
          store_code: `STORE-${index + 1}`,
          store_id: storeId,
          store_name: ['Balıkesir 10 Burda AVM', 'Bursa Downtown AVM', 'İstanbul MOI AVM'][index],
        })),
        meta: { total: storeIds.length },
      },
    })
  })
  await page.route('**/api/workforce/store-employees**', async (route) => {
    const url = new URL(route.request().url())
    const storeId = url.searchParams.get('storeId') ?? storeIds[0]
    await route.fulfill({ json: createStoreEmployeesFixture(storeId) })
  })
  await page.route('**/api/workforce/headcount-gap**', async (route) => {
    const url = new URL(route.request().url())
    const storeId = url.searchParams.get('storeId') ?? storeIds[0]
    await route.fulfill({ json: createHeadcountGapFixture(storeId) })
  })
}

function createStoreEmployeesFixture(storeId: string) {
  const namesByStore: Record<string, string[]> = {
    [storeIds[0]]: ['Mert Alcan', 'Emine Çavuş', 'Gürkan Çakar'],
    [storeIds[1]]: ['Ayşe Yılmaz', 'Cem Aksoy', 'Deniz Kaya'],
    [storeIds[2]]: ['Süleyman Öztürk', 'Kenan Eryiğit', 'Sinem Tekkur'],
  }
  const names = namesByStore[storeId] ?? namesByStore[storeIds[0]]

  return {
    items: names.map((name, index) => ({
      assignmentStartDate: `2026-0${index + 1}-10`,
      displayName: name,
      employeeId: `${storeId}-employee-${index + 1}`,
      externalEmployeeRef: `DNMSL${100 + index}`,
      positionCode: index === 0 ? 'STORE_MANAGER' : 'SALES_ASSOCIATE',
      positionName: index === 0 ? 'Mağaza Müdürü' : 'Satış Danışmanı',
      storeId,
    })),
    meta: { count: names.length, limit: 50, offset: 0, total: names.length },
  }
}

function createHeadcountGapFixture(storeId: string) {
  const planned = storeId === storeIds[0] ? 4 : 3
  const active = 3
  const gap = active - planned
  return {
    active_fte: String(active),
    active_headcount: String(active),
    fte_gap: String(gap),
    headcount_gap: String(gap),
    planned_fte: String(planned),
    planned_headcount: String(planned),
    shortage_days: storeId === storeIds[0] ? 7 : null,
    shortage_started_on: storeId === storeIds[0] ? '2026-06-29' : null,
    store_id: storeId,
    turnover_rate: storeId === storeIds[0] ? 12.5 : 8.1,
  }
}
