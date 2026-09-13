import { fileURLToPath } from 'node:url'
import { expect, test, type Page } from './test-fixtures'
import { expectCommandCanvasFrame } from './fixtures/command-canvas-parity-harness'
import {
  installGenericStoreApiFallbacks,
  installStoreContractSession,
  regionId,
  storeIds,
} from './store-page-contract-fixtures'

const capture = process.env.CAPTURE_COMMAND_CANVAS_EVIDENCE === '1'
const evidenceRoot = '../../docs/evidence/store-command-canvas-parity/workforce'

for (const viewport of [
  { width: 1440, height: 900, file: 'store-manager-desktop.png' },
  { width: 1024, height: 768, file: 'store-manager-compact.png' },
  { width: 390, height: 844, file: 'store-manager-mobile.png' },
  { width: 320, height: 844, file: 'store-manager-narrow.png' },
]) {
  test(`Workforce store_manager frame at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await prepare(page, 'storeManager', 'store_manager')
    await page.goto('/store/workforce')

    await expect(page.getByRole('heading', { name: 'Norm Kadro', exact: true })).toBeVisible()
    await expect(page.locator('.command-canvas-metric')).toHaveCount(4)
    await expectStableMetricGeometry(page)
    await expect(page.getByTestId('store-workforce-personnel-list')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Personel sicil talebi' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'İşten ayrılma talebi' })).toBeVisible()
    await expectCommandCanvasFrame(page)
    await expectNoPrototypeOrLegacyOwner(page)
    await expectNoHorizontalOverflow(page)
    await page.evaluate(async () => { await document.fonts.ready })

    if (capture) {
      await page.locator('.store-shell').screenshot({
        animations: 'disabled',
        path: evidencePath(viewport.file),
      })
    }
  })
}

async function expectStableMetricGeometry(page: Page) {
  const metrics = page.locator('.command-canvas-metric')
  const initial = await metrics.evaluateAll((elements) =>
    elements.map((element) => {
      const rect = element.getBoundingClientRect()
      return { width: rect.width, height: rect.height }
    }),
  )

  for (let index = 0; index < 4; index += 1) {
    await metrics.nth(index).click()
    const current = await metrics.evaluateAll((elements) =>
      elements.map((element) => {
        const rect = element.getBoundingClientRect()
        return { width: rect.width, height: rect.height }
      }),
    )
    expect(current).toEqual(initial)
  }
  await metrics.first().click()
}

for (const scenario of [
  { persona: 'regionManager' as const, view: 'region_manager' as const, file: 'region-manager-desktop.png' },
  { persona: 'reportViewer' as const, view: 'report_viewer' as const, file: 'report-viewer-desktop.png' },
]) {
  test(`Workforce ${scenario.view} role hierarchy stays scoped and production-only`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await prepare(page, scenario.persona, scenario.view)
    await page.goto('/store/workforce')

    await expect(page.getByTestId('store-workforce-region-row')).toHaveCount(3)
    await expect(page.getByRole('complementary', { name: 'Bölge müdürleri', exact: true })).toHaveCount(scenario.view === 'report_viewer' ? 1 : 0)
    if (scenario.view === 'report_viewer') {
      await expect(page.locator('.operations-directory-items').getByRole('radio', { name: /Bölge Müdürü A/ })).toHaveCount(1)
      await expect(page.locator('.operations-directory-items').getByRole('radio', { name: /Bölge Müdürü B/ })).toHaveCount(1)
    }
    await expect(page.getByRole('button', { name: /Personel sicil talebi|İşten ayrılma talebi/ })).toHaveCount(0)
    await expectCommandCanvasFrame(page)
    await expectNoPrototypeOrLegacyOwner(page)
    await expectNoHorizontalOverflow(page)

    if (capture) {
      await page.locator('.store-shell').screenshot({
        animations: 'disabled',
        path: evidencePath(scenario.file),
      })
    }
  })
}

for (const viewport of [
  { width: 1440, height: 900, file: 'store-manager-history-desktop.png' },
  { width: 390, height: 844, file: 'store-manager-history-mobile.png' },
]) {
  test(`Workforce entry-exit history at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await prepare(page, 'storeManager', 'store_manager')
    await page.goto('/store/workforce')
    await page.getByRole('button', { name: 'Mağaza personel geçmişi' }).click()

    const drawer = page.getByRole('dialog')
    await expect(drawer).toBeVisible()
    await expect(drawer.getByText('İşe giriş').first()).toBeVisible()
    await expect(drawer.getByText('İşten çıkış').first()).toBeVisible()
    await expect(drawer.getByText('Toplam çalışma').first()).toBeVisible()
    await expect(drawer.getByText(/KPI|puan|rol değişimi|görev/i)).toHaveCount(0)
    expect(await drawer.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true)

    if (capture) {
      await page.screenshot({
        animations: 'disabled',
        path: evidencePath(viewport.file),
      })
    }
  })
}

async function prepare(
  page: Page,
  persona: 'storeManager' | 'regionManager' | 'reportViewer',
  view: 'store_manager' | 'region_manager' | 'report_viewer',
) {
  await installStoreContractSession(page, persona)
  await installGenericStoreApiFallbacks(page)
  await page.route('**/api/org/region-managers', route => route.fulfill({ json: { items: [
    { userId: 'manager-a', displayName: 'Bölge Müdürü A', storeIds: [storeIds[0], storeIds[2]] },
    { userId: 'manager-b', displayName: 'Bölge Müdürü B', storeIds: [storeIds[1]] },
    { userId: 'manager-empty', displayName: 'Yeni Bölge Müdürü', storeIds: [] },
  ] } }))
  await page.route('**/api/store/workforce/workspace**', async (route) => {
    const url = new URL(route.request().url())
    const historyStoreId = url.searchParams.get('historyStoreId')
    const historyOffset = Number(url.searchParams.get('historyOffset') ?? '0')
    const data = createWorkspace(view, historyStoreId, historyOffset)
    const manager = url.searchParams.get('regionManagerUserId')
    if (manager) {
      data.stores.items = data.stores.items.filter(store => manager === 'manager-a' ? [storeIds[0], storeIds[2]].includes(store.storeId) : manager === 'manager-b' ? store.storeId === storeIds[1] : false)
      data.stores.total = data.stores.items.length
      data.summary.totalStores = data.stores.items.length
    }
    await route.fulfill({ json: { data } })
  })
}

function createWorkspace(
  view: 'store_manager' | 'region_manager' | 'report_viewer',
  historyStoreId: string | null,
  historyOffset: number,
) {
  const managers = ['Bölge Müdürü A', 'Bölge Müdürü B', 'Bölge Müdürü A']
  const names = ['Mall of İstanbul', 'İstinyePark İzmir', 'Bursa Downtown AVM']
  const stores = (view === 'store_manager' ? [storeIds[0]] : storeIds).map((storeId, index) => {
    const personnel = Array.from({ length: view === 'store_manager' ? 8 : 2 }, (_, personIndex) => ({
      employeeId: `${storeId}-employee-${personIndex + 1}`,
      displayName: ['Aslı Çetin', 'Burak Erol', 'Buse Eren', 'Can Özkan', 'Ceren Polat', 'Derya Kaya', 'Ece Yılmaz', 'Elif Öztürk'][personIndex] ?? `Personel ${personIndex + 1}`,
      positionId: `position-${personIndex + 1}`,
      positionCode: personIndex === 3 ? 'DEPUTY_MANAGER' : 'SALES',
      positionName: personIndex === 3 ? 'Müdür Yardımcısı' : 'Satış Danışmanı',
      assignmentStartDate: `202${3 + (personIndex % 3)}-0${1 + (personIndex % 8)}-04`,
      employmentStatus: 'active',
    }))
    return {
      companyId: 'company-contract-1',
      companyName: 'HR Axis',
      regionId: index === 1 ? `${regionId}-second` : regionId,
      regionName: index === 1 ? 'Ege' : 'Marmara',
      regionManagerName: managers[index],
      storeId,
      storeCode: `STORE-${index + 1}`,
      storeName: names[index],
      storeStatus: 'active',
      norm: personnel.length + (index === 2 ? 1 : 0),
      active: personnel.length,
      averageTenureDays: 680 - index * 50,
      gap: index === 2 ? 1 : 0,
      shortageDays: null,
      personnel,
      personnelTotal: personnel.length,
      personnelLimit: 50,
      personnelOffset: 0,
      personnelHasMore: false,
    }
  })
  const historyItems = Array.from({ length: 21 }, (_, index) => ({
    employeeId: `history-${index + 1}`,
    displayName: `Geçmiş Personel ${index + 1}`,
    entryDate: '2023-05-08',
    exitDate: index === 0 ? null : '2026-05-31',
    totalWorkingDays: 1119,
  }))
  const historyPage = historyItems.slice(historyOffset, historyOffset + 20)

  return {
    view,
    summary: {
      totalStores: stores.length,
      activePersonnel: stores.reduce((sum, store) => sum + store.active, 0),
      shortageStores: stores.filter((store) => (store.gap ?? 0) > 0).length,
      openPositions: stores.reduce((sum, store) => sum + Math.max(0, store.gap ?? 0), 0),
      averageTenureDays: 680,
    },
    stores: { items: stores, total: stores.length, limit: 50, offset: 0, hasMore: false },
    history: historyStoreId ? {
      storeId: historyStoreId,
      items: historyPage,
      total: historyItems.length,
      limit: 20,
      offset: historyOffset,
      hasMore: historyOffset + historyPage.length < historyItems.length,
    } : null,
    capabilities: {
      canCreateSellerCodeRequest: view === 'store_manager',
      canCreateOffboardingRequest: view === 'store_manager',
    },
  }
}

async function expectNoPrototypeOrLegacyOwner(page: Page) {
  await expect(page.locator('.role-switcher, .labs-bar, .workforce-prototype')).toHaveCount(0)
  await expect(page.locator('.store-workforce-command-list, .store-workforce-command-modal')).toHaveCount(0)
  await expect(page.locator('[data-command-canvas-page]')).toHaveCount(1)
}

async function expectNoHorizontalOverflow(page: Page) {
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
  ).toBe(true)
}

function evidencePath(file: string) {
  return fileURLToPath(new URL(`${evidenceRoot}/${file}`, import.meta.url))
}


test('Workforce real manager directory retains managers without rows and filters by user identity', async ({ page }) => {
  await prepare(page, 'reportViewer', 'report_viewer')
  await page.goto('/store/workforce')
  const directory = page.getByRole('complementary', { name: 'Bölge müdürleri', exact: true })
  await expect(directory.getByRole('radio', { name: /Yeni Bölge Müdürü/ })).toBeVisible()
  const selectedRequest = page.waitForRequest(request => request.url().includes('/api/store/workforce/workspace') && new URL(request.url()).searchParams.get('regionManagerUserId') === 'manager-b')
  await directory.getByRole('radio', { name: /Bölge Müdürü B/ }).click()
  expect(new URL((await selectedRequest).url()).searchParams.has('regionId')).toBe(false)
  await expect(page.getByTestId('store-workforce-region-row')).toHaveCount(1)
  await expect(page.getByTestId('store-workforce-region-row')).toContainText('İstinyePark İzmir')
  await directory.getByRole('radio', { name: /Yeni Bölge Müdürü/ }).click()
  await expect(page.getByText('Bu seçimde mağaza yok')).toBeVisible()
  await expect(directory.getByRole('radio', { name: /Bölge Müdürü A/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Personel sicil talebi|İşten ayrılma talebi|Bilgileri düzenle/ })).toHaveCount(0)
})
