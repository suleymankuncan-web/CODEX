import { expect, test, type Page } from './test-fixtures'
import {
  companyId,
  installGenericStoreApiFallbacks,
  installStoreContractSession,
  regionId,
  storeIds,
} from './store-page-contract-fixtures'
import type { WorkforceCommandStore, WorkforceCommandWorkspace } from '../src/features/workforce/api'

test('workforce store search stays available after the server returns no matches', async ({ page }) => {
  await prepareWorkforce(page, 'regionManager')
  await page.goto('/store/workforce')

  const search = page.getByRole('textbox', { name: 'Mağaza ara' })
  await expect(page.getByTestId('store-workforce-region-row')).toHaveCount(1)
  const emptyResponse = page.waitForResponse(response =>
    response.url().includes('/api/store/workforce/workspace')
    && new URL(response.url()).searchParams.get('q') === 'Eşleşmeyen mağaza',
  )
  await search.fill('Eşleşmeyen mağaza')
  await emptyResponse

  await expect(page.getByRole('region', { name: 'Kadro çalışma alanı' })).toHaveAttribute('aria-busy', 'false')
  await expect(page.locator('.workforce-store-search [data-slot="badge"]')).toHaveText('0')
  await expect(page.getByText('Sonuç bulunamadı', { exact: true })).toBeVisible()
  await expect(search).toBeVisible()
  await expect(search).toHaveValue('Eşleşmeyen mağaza')

  await search.clear()
  await expect(page.getByTestId('store-workforce-region-row')).toHaveCount(1)
  await expect(search).toHaveValue('')
})

test('workforce report viewer can search when the directory narrows the desktop board', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 })
  await prepareWorkforce(page, 'reportViewer')
  await page.goto('/store/workforce')

  await expect(page.getByRole('complementary', { name: 'Bölge müdürleri', exact: true })).toBeVisible()
  const board = page.getByRole('region', { name: 'Kadro çalışma alanı' })
  expect(await board.evaluate(element => element.clientWidth)).toBeLessThanOrEqual(650)
  const search = page.getByRole('textbox', { name: 'Mağaza ara' })
  await expect(search).toBeVisible()
  await search.fill('İstinyePark')
  await expect(page.getByTestId('store-workforce-region-row')).toHaveCount(1)
  await expect(search).toHaveValue('İstinyePark')
})

test('returned personnel requests show loading before a confirmed empty response', async ({ page }) => {
  await prepareWorkforce(page, 'storeManager')
  let releaseRequests!: () => void
  const pending = new Promise<void>(resolve => { releaseRequests = resolve })
  for (const path of ['seller-code-requests', 'offboarding-requests']) {
    await page.route(`**/api/workforce/${path}**`, async route => {
      await pending
      await route.fulfill({ json: { items: [], meta: { count: 0, total: 0, limit: 50, offset: 0 } } })
    })
  }
  try {
    await page.goto('/store/workforce')
    await page.getByRole('button', { name: 'İade edilen talepler', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'İade edilen talepler', exact: true })
    await expect(dialog.getByRole('status')).toHaveText('İade edilen talepler yükleniyor…')
    await expect(dialog.getByText('Düzeltme bekleyen personel talebi yok')).toHaveCount(0)
    releaseRequests()
    await expect(dialog.getByText('Düzeltme bekleyen personel talebi yok')).toBeVisible()
    await expect(dialog.getByRole('status')).toHaveCount(0)
  } finally {
    releaseRequests()
  }
})

async function prepareWorkforce(page: Page, persona: 'regionManager' | 'reportViewer' | 'storeManager') {
  await installStoreContractSession(page, persona)
  await installGenericStoreApiFallbacks(page)
  await page.route('**/api/org/region-managers', route => route.fulfill({ json: { items: [
    { userId: 'workforce-manager', displayName: 'Bölge Müdürü', storeIds: [storeIds[0]] },
  ] } }))
  await page.route('**/api/store/workforce/workspace**', async route => {
    const query = new URL(route.request().url()).searchParams.get('q')?.trim().toLocaleLowerCase('tr-TR') ?? ''
    const store: WorkforceCommandStore = {
      companyId,
      companyName: 'HR Axis',
      regionId,
      regionName: 'Marmara',
      regionManagerName: 'Bölge Müdürü',
      storeId: storeIds[0],
      storeCode: 'ISTINYE',
      storeName: 'İstinyePark',
      storeStatus: 'active',
      norm: 3,
      active: 3,
      averageTenureDays: 365,
      gap: 0,
      shortageDays: null,
      personnel: [],
      personnelTotal: 3,
      personnelLimit: 50,
      personnelOffset: 0,
      personnelHasMore: false,
    }
    const stores = store.storeName.toLocaleLowerCase('tr-TR').includes(query) ? [store] : []
    const data: WorkforceCommandWorkspace = {
      view: persona === 'reportViewer' ? 'report_viewer' : persona === 'storeManager' ? 'store_manager' : 'region_manager',
      summary: { totalStores: 1, activePersonnel: 3, shortageStores: 0, openPositions: 0, turnoverRate: null, averageTenureDays: 365 },
      stores: { items: stores, total: stores.length, limit: 50, offset: 0, hasMore: false },
      history: null,
      capabilities: { canCreateSellerCodeRequest: persona === 'storeManager', canCreateOffboardingRequest: persona === 'storeManager' },
    }
    await route.fulfill({ json: { data } })
  })
}
