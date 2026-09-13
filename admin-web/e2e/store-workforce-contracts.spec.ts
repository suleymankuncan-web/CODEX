import { expect, test, type Page } from './test-fixtures'
import {
  installGenericStoreApiFallbacks,
  installStoreContractSession,
  regionId,
  storeIds,
} from './store-page-contract-fixtures'

test('region workforce uses one bounded workspace request and local decision filters', async ({ page }) => {
  await installStoreContractSession(page, 'regionManager')
  await installGenericStoreApiFallbacks(page)
  let workspaceRequests = 0
  await routeWorkforceWorkspace(page, () => { workspaceRequests += 1 })

  await page.goto('/store/workforce')
  await expect(page.getByRole('heading', { name: 'Norm Kadro' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Balıkesir 10 Burda AVM/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Bursa Downtown AVM/ })).toBeVisible()
  expect(workspaceRequests).toBe(1)

  await page.getByRole('button', { name: /Eksik mağaza/ }).click()
  await expect(page.getByRole('button', { name: /Balıkesir 10 Burda AVM/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Bursa Downtown AVM/ })).toHaveCount(0)
  expect(workspaceRequests).toBe(2)
})

test('region workforce renders a non-fixed 36-store scope in one bounded page', async ({ page }) => {
  await installStoreContractSession(page, 'regionManager')
  await installGenericStoreApiFallbacks(page)
  let workspaceRequests = 0
  await page.route('**/api/store/workforce/workspace**', async (route) => {
    workspaceRequests += 1
    const stores = Array.from({ length: 36 }, (_, index) => createStore(`scope-${index + 1}`, `Kapsam Mağaza ${String(index + 1).padStart(2, '0')}`, index))
    await route.fulfill({ json: { data: createWorkspace(stores) } })
  })

  await page.goto('/store/workforce')
  await expect(page.getByTestId('store-workforce-region-row')).toHaveCount(36)
  await expect(page.getByText('Kapsam Mağaza 36')).toBeVisible()
  expect(workspaceRequests).toBe(1)
})

test('global shortage rail reaches a matching store beyond the first 50-store page', async ({ page }) => {
  await installStoreContractSession(page, 'regionManager')
  await installGenericStoreApiFallbacks(page)
  let workspaceRequests = 0
  await page.route('**/api/store/workforce/workspace**', async (route) => {
    workspaceRequests += 1
    const url = new URL(route.request().url())
    const allStores = Array.from({ length: 51 }, (_, index) => createStore(
      `scope-${index + 1}`,
      index === 50 ? 'Sayfa Dışı Eksik Mağaza' : `Dengeli Mağaza ${String(index + 1).padStart(2, '0')}`,
      index + 1,
    ))
    allStores.forEach((store) => { store.norm = 3; store.gap = 0; store.shortageDays = null })
    allStores[50].norm = 5
    allStores[50].gap = 2
    const filtered = url.searchParams.get('status') === 'shortage' ? [allStores[50]] : allStores
    const offset = Number(url.searchParams.get('offset') ?? '0')
    const limit = Number(url.searchParams.get('limit') ?? '50')
    const workspace = createWorkspace(filtered.slice(offset, offset + limit))
    workspace.stores.total = filtered.length
    workspace.stores.offset = offset
    workspace.stores.limit = limit
    workspace.stores.hasMore = offset + limit < filtered.length
    workspace.summary.totalStores = 51
    workspace.summary.shortageStores = 1
    await route.fulfill({ json: { data: workspace } })
  })

  await page.goto('/store/workforce')
  await expect(page.getByText('Sayfa Dışı Eksik Mağaza')).toHaveCount(0)
  await page.getByRole('button', { name: /Eksik mağaza/ }).click()
  await expect(page.getByRole('button', { name: /Sayfa Dışı Eksik Mağaza/ })).toBeVisible()
  expect(workspaceRequests).toBe(2)
})

test('store detail exposes employment facts and entry-exit-only history', async ({ page }) => {
  await installStoreContractSession(page, 'regionManager')
  await installGenericStoreApiFallbacks(page)
  await routeWorkforceWorkspace(page)

  await page.goto('/store/workforce')
  await page.getByRole('button', { name: /Balıkesir 10 Burda AVM/ }).click()
  const detail = page.getByTestId('store-workforce-region-detail-dialog')
  await expect(detail.getByRole('heading', { name: 'Balıkesir 10 Burda AVM' })).toBeVisible()
  await expect(detail.getByText('Satış Danışmanı').first()).toBeVisible()
  await expect(detail.getByText(/KPI|Güçlü|Takipte|Geride/)).toHaveCount(0)
  await page.getByRole('button', { name: 'Mağaza personel geçmişi' }).click()
  const history = page.getByRole('dialog', { name: 'Balıkesir 10 Burda AVM · Personel geçmişi' })
  await expect(history.getByText('İşe giriş', { exact: true }).first()).toBeVisible()
  await expect(history.getByText('İşten çıkış', { exact: true }).first()).toBeVisible()
  await expect(history.getByText('Toplam çalışma', { exact: true }).first()).toBeVisible()
  await expect(page.getByText(/puan|destek|rol değiş/i)).toHaveCount(0)
  await page.getByRole('button', { name: /Sonraki/ }).click()
  await expect(page.getByText('Geçmiş Personel 21')).toBeVisible()
})

async function routeWorkforceWorkspace(page: Page, onRequest: () => void = () => undefined) {
  await page.route('**/api/store/workforce/workspace**', async (route) => {
    onRequest()
    const url = new URL(route.request().url())
    const historyStoreId = url.searchParams.get('historyStoreId')
    const historyOffset = Number(url.searchParams.get('historyOffset') ?? '0')
    await route.fulfill({ json: { data: workspaceFixture(historyStoreId, historyOffset) } })
  })
}

function createStore(storeId: string, storeName: string, index: number) {
  return {
    companyId: '00000000-0000-4000-8000-000000000001', companyName: 'HR Axis',
    regionId, regionName: 'Marmara', regionManagerName: 'Mert Yalçın',
    storeId, storeCode: `STORE-${index + 1}`,
    storeName,
    storeStatus: 'active', norm: index === 0 ? 4 : 3, active: 3,
    averageTenureDays: 365 + index,
    gap: index === 0 ? 1 : 0, shortageDays: index === 0 ? 7 : null,
    personnelTotal: 1, personnelLimit: 50, personnelOffset: 0, personnelHasMore: false,
    personnel: [{ employeeId: `${storeId}-employee`, displayName: 'Ayşe Çetin',
      positionId: '55555555-5555-4555-8555-555555555555', positionCode: 'SALES',
      positionName: 'Satış Danışmanı', assignmentStartDate: '2025-01-04', employmentStatus: 'active' }],
  }
}

function createWorkspace(stores: ReturnType<typeof createStore>[]) {
  return {
    view: 'region_manager',
    summary: { totalStores: stores.length, activePersonnel: stores.length * 3, shortageStores: 1, openPositions: 1, averageTenureDays: 365 },
    stores: { items: stores, total: stores.length, limit: 50, offset: 0, hasMore: false },
    history: null,
    capabilities: { canCreateSellerCodeRequest: false, canCreateOffboardingRequest: false },
  }
}

function workspaceFixture(historyStoreId: string | null, historyOffset = 0) {
  const stores = storeIds.map((storeId, index) => createStore(
    storeId,
    ['Balıkesir 10 Burda AVM', 'Bursa Downtown AVM', 'İstanbul MOI AVM'][index],
    index,
  ))
  const historyItems = Array.from({ length: 21 }, (_, index) => ({
    employeeId: `history-employee-${index + 1}`, displayName: `Geçmiş Personel ${index + 1}`, entryDate: '2023-05-08',
    exitDate: '2026-05-31', totalWorkingDays: 1119,
  }))
  const historyPage = historyItems.slice(historyOffset, historyOffset + 20)
  return {
    view: 'region_manager',
    summary: { totalStores: 3, activePersonnel: 9, shortageStores: 1, openPositions: 1, averageTenureDays: 365 },
    stores: { items: stores, total: 3, limit: 50, offset: 0, hasMore: false },
    history: historyStoreId ? { storeId: historyStoreId, items: historyPage, total: 21, limit: 20, offset: historyOffset, hasMore: historyOffset + historyPage.length < 21 } : null,
    capabilities: { canCreateSellerCodeRequest: false, canCreateOffboardingRequest: false },
  }
}


test('store manager stages personnel corrections with Turkish confirmation and no roster mutation', async ({ page }) => {
  await installStoreContractSession(page, 'storeManager')
  await installGenericStoreApiFallbacks(page)
  const store = createStore(storeIds[0], 'Test Mağaza', 0)
  const workspace = { ...createWorkspace([store]), view: 'store_manager' }
  await page.route('**/api/store/workforce/workspace**', (route) => route.fulfill({ json: { data: workspace } }))
  const values = { firstName: 'Ayşe', lastName: 'Çetin', email: 'ayse@example.com', phoneNumber: '5391234567', nationalIdLast4: '1234', hireDate: '2026-09-07', employmentType: 'full_time', positionId: store.personnel[0].positionId }
  let submitted: Record<string, unknown> | null = null
  let pending = false
  await page.route('**/api/workforce/personnel-corrections**', async (route) => {
    const request = route.request()
    if (request.method() === 'POST') { submitted = request.postDataJSON(); pending = true; await route.fulfill({ status: 201, json: { request_id: 'request-1' } }); return }
    if (request.url().includes('/personnel/')) { await route.fulfill({ json: { revision: 'revision-1', values, positions: [{ positionId: values.positionId, positionName: 'Satış Danışmanı' }] } }); return }
    await route.fulfill({ json: { items: pending ? [{ request_id: 'request-1', employee_id: store.personnel[0].employeeId, store_name: store.storeName, request_status: 'pending_hr_approval', request_reason: 'İsim düzeltmesi', previous_values: values, proposed_values: { ...values, firstName: 'Ayşen' }, review_note: null }] : [] } })
  })
  await page.goto('/store/workforce')
  await page.getByRole('button', { name: 'Düzenle' }).first().click()
  await page.getByRole('textbox', { name: 'Ad', exact: true }).fill('Ayşen')
  await page.getByRole('textbox', { name: 'TC kimlik no', exact: true }).fill('10000000146')
  await page.getByRole('textbox', { name: 'Düzeltme gerekçesi' }).fill('İsim düzeltmesi')
  await page.getByRole('button', { name: 'İK onayına gönder' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByText('Talebiniz İK onayına gönderildi.')).toBeVisible()
  expect(submitted).toMatchObject({ employeeId: store.personnel[0].employeeId, storeId: store.storeId, expectedRevision: 'revision-1', proposed: { firstName: 'Ayşen', nationalId: '10000000146', phoneNumber: '5391234567' } })
  await expect(page.getByText('Ayşe Çetin', { exact: true }).first()).toBeVisible()
})
