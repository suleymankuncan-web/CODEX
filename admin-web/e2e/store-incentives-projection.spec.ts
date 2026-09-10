import { expect, test, type Page } from './test-fixtures'
import { expectCommandCanvasFrame } from './fixtures/command-canvas-parity-harness'
import { installGenericStoreApiFallbacks, installStoreContractSession } from './store-page-contract-fixtures'
import {
  createIncentiveWorkspace,
  incentiveStoreA,
  incentiveStoreB,
  routeIncentiveCommands,
  routeIncentiveWorkspace,
} from './store-incentives-command-fixtures'

test('partial optional sections retain the valid incentive hierarchy', async ({ page }) => {
  await prepareRegionManager(page)
  await routeIncentiveWorkspace(page, createIncentiveWorkspace('region_manager', { partial: true }))
  await page.goto('/store/incentives')
  await expandStore(page)

  await expect(page.getByText('Bazı bilgiler gösterilemiyor')).toBeVisible()
  await expect(page.getByText('Mall of İstanbul').first()).toBeVisible()
  await expect(page.getByText('Süleyman Öztürk').first()).toBeVisible()
})

test('empty server dataset and empty local filter use distinct honest states', async ({ page }) => {
  await prepareRegionManager(page)
  const empty = createIncentiveWorkspace('region_manager')
  empty.data.regions = []
  await routeIncentiveWorkspace(page, empty)
  await page.goto('/store/incentives')
  await expect(page.getByRole('heading', { name: 'Bu dönem için prim sonucu yok' })).toBeVisible()

  await page.unroute('**/api/store/incentives/workspace**')
  await routeIncentiveWorkspace(page, createIncentiveWorkspace('region_manager'))
  await page.reload()
  await page.getByLabel('Mağaza veya personel ara').fill('eşleşmeyen-kayıt')
  await expect(page.getByText('Bu filtrelerle eşleşen kayıt yok.')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Bu dönem için prim sonucu yok' })).toHaveCount(0)
})

test('blocking workspace error uses the new route language and retry recovers', async ({ page }) => {
  await prepareRegionManager(page)
  let allowSuccess = false
  await page.route('**/api/store/incentives/workspace**', async (route) => {
    if (!allowSuccess) {
      await route.fulfill({ status: 403, json: { message: 'forbidden' } })
      return
    }
    await route.fulfill({ json: createIncentiveWorkspace('region_manager') })
  })
  await page.goto('/store/incentives')
  await expect(page.getByRole('heading', { name: 'Prim görünümü açılamadı' })).toBeVisible()
  allowSuccess = true
  await page.getByRole('button', { name: 'Tekrar dene' }).click()
  await expect(page.getByRole('heading', { name: 'Prim Kontrol Merkezi' })).toBeVisible()
})

test('period refetch retains the previous complete workspace without a blank page', async ({ page }) => {
  await prepareRegionManager(page)
  await page.route('**/api/store/incentives/workspace**', async (route) => {
    const period = new URL(route.request().url()).searchParams.get('period')
    if (period === '2026-05') await new Promise((resolve) => setTimeout(resolve, 700))
    const fixture = createIncentiveWorkspace('region_manager')
    if (period === '2026-05') fixture.data.period = '2026-05'
    await route.fulfill({ json: fixture })
  })
  await page.goto('/store/incentives')
  await expect(page.getByText('Mall of İstanbul').first()).toBeVisible()
  await expandStore(page)
  await page.getByRole('button', { name: 'Dönem seç' }).click()
  const picker = page.getByRole('dialog', { name: 'Dönem seç' })
  await picker.getByRole('combobox', { name: 'Ay seç' }).selectOption({ label: 'May' })
  await picker.getByRole('button', { name: 'Uygula', exact: true }).click()
  await expect(page.getByText('Mall of İstanbul').first()).toBeVisible({ timeout: 300 })
  await expect(page.getByText('Prim sonuçları güncelleniyor.')).toBeAttached()
  await expect(page.getByRole('button', { name: 'Derya Uslu: Düzelt' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Onaya gönder', exact: true }).first()).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Derya Uslu: Düzelt' })).toBeEnabled()
})

test('unresolved persisted rates disable shortcuts while direct authorized correction remains available', async ({ page }) => {
  await prepareRegionManager(page)
  const fixture = createIncentiveWorkspace('region_manager')
  fixture.data.rateMetadata = { status: 'unresolved', ruleVersionCode: null, effectiveFrom: null, periodTimezone: 'Europe/Istanbul', bracketBoundaryPolicy: 'lower_inclusive_upper_exclusive', tables: [] }
  await routeIncentiveWorkspace(page, fixture)
  await page.goto('/store/incentives')
  await expandStore(page)

  await page.getByRole('button', { name: 'Derya Uslu: Düzelt' }).click()
  const drawer = page.getByRole('dialog')
  await expect(drawer.getByText('Bu dönem için oran seçenekleri kullanılamıyor.')).toBeVisible()
  await expect(drawer.getByLabel('Final prim tutarı')).toBeEnabled()
})

test('failed optimistic store review rolls back to the server-backed state', async ({ page }) => {
  await prepareRegionManager(page)
  await routeIncentiveWorkspace(page, createIncentiveWorkspace('region_manager', { allReviewed: false }))
  await page.route('**/api/store/incentives/store-reviews', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 250))
    await route.fulfill({ status: 409, json: { message: 'conflict' } })
  })
  await page.goto('/store/incentives')
  await page.getByText('Marmara Forum').click()
  await page.getByRole('button', { name: 'Kontrol et' }).click()
  await expect(page.getByText('Kontrol edildi').last()).toBeVisible({ timeout: 150 })
  await expect(page.getByRole('button', { name: 'Kontrol et' })).toBeVisible()
})

test('correction drawer closes on Escape and restores focus to its opener', async ({ page }) => {
  await prepareRegionManager(page)
  await routeIncentiveWorkspace(page, createIncentiveWorkspace('region_manager'))
  await page.goto('/store/incentives')
  await expandStore(page)
  const opener = page.getByRole('button', { name: 'Derya Uslu: Düzelt' })
  await opener.click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toBeHidden()
  await expect(opener).toBeFocused()
})

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1024, height: 768 },
  { width: 390, height: 844 },
  { width: 320, height: 844 },
]) {
  test(`Region Manager Command Canvas is accessible and overflow-safe at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await prepareRegionManager(page)
    await routeIncentiveWorkspace(page, createIncentiveWorkspace('region_manager', { multipleRegions: true }))
    await page.goto('/store/incentives')
    await expectCommandCanvasFrame(page)
  })

  test(`Report Viewer Command Canvas is accessible and overflow-safe at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await installStoreContractSession(page, 'reportViewer')
    await installGenericStoreApiFallbacks(page)
    await routeIncentiveWorkspace(page, createIncentiveWorkspace('report_viewer', { multipleRegions: true }))
    await page.goto('/store/incentives')
    await expectCommandCanvasFrame(page)
  })
}

test('local metrics, search and sort do not refetch the workspace', async ({ page }) => {
  let reads = 0
  await prepareRegionManager(page)
  await page.route('**/api/store/incentives/workspace**', async (route) => {
    reads += 1
    await route.fulfill({ json: createIncentiveWorkspace('region_manager', { allReviewed: false }) })
  })
  await page.goto('/store/incentives')
  await expect.poll(() => reads).toBe(1)

  await page.locator('.command-canvas-metric').filter({ hasText: 'Kontrol bekleyen' }).click()
  await page.getByLabel('Mağaza veya personel ara').fill('Marmara')
  await page.getByRole('button', { name: /^Mağaza: / }).click()
  await expect(page.getByText('Marmara Forum')).toBeVisible()
  await expect.poll(() => reads).toBe(1)
})

async function prepareRegionManager(page: Page) {
  await installStoreContractSession(page, 'regionManager', { actionStoreIds: [incentiveStoreA, incentiveStoreB] })
  await installGenericStoreApiFallbacks(page)
  await routeIncentiveCommands(page, [])
}

async function expandStore(page: Page, storeName = 'Mall of İstanbul') {
  const trigger = page.locator('.incentive-store-main').filter({ hasText: storeName }).first()
  if (await trigger.getAttribute('aria-expanded') === 'false') await trigger.click()
}
