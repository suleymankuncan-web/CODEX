import { expect, test, type Locator, type Page } from './test-fixtures'
import { installGenericStoreApiFallbacks, installStoreContractSession } from './store-page-contract-fixtures'
import { createIncentiveWorkspace, incentiveStoreA, incentiveStoreB, routeIncentiveCommands, routeIncentiveManagerDirectory, routeIncentiveWorkspace } from './store-incentives-command-fixtures'

// Owner replaced the historical command-center prototype with Checklist/KPI list + drawer anatomy.
for (const view of ['region_manager', 'report_viewer'] as const) {
  for (const width of [1440, 1024, 390, 320]) {
    test(`${view} list and drawer remain readable at ${width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 900 })
      await prepare(page, view)
      await page.goto('/store/incentives')
      await expect(page.getByRole('heading', { name: view === 'report_viewer' ? 'LUFIAN Mağaza Primleri' : 'Bölge Primleri' })).toBeVisible()
      await expect(page.locator('.incentive-performance-metrics > button')).toHaveCount(view === 'region_manager' ? 4 : 0)
      if (view === 'report_viewer') {
        const directory = page.getByRole('complementary', { name: 'Bölge müdürleri' })
        await expect(directory).toBeVisible()
        await expect(directory.getByRole('button', { name: 'Süleyman Öztürk 2 mağaza', exact: true })).toBeVisible()
        await expect(directory).not.toContainText('İstanbul Avrupa')
        await expect(directory).not.toContainText('₺')
        if (width === 1440) {
          const left = await directory.boundingBox()
          const right = await page.locator('.incentive-performance-list').boundingBox()
          expect(left!.x + left!.width).toBeLessThan(right!.x)
        }
      }
      await expect(page.locator('.incentive-store-summary, .incentive-region-trigger')).toHaveCount(0)
      await expectFits(page, page.locator('.incentive-performance'))
      await page.screenshot({ path: testInfo.outputPath(`${view}-${width}.png`), fullPage: true })
      const opener = page.getByRole('button', { name: 'Mall of İstanbul', exact: true }).filter({ visible: true })
      await opener.click()
      const panel = page.getByRole('region', { name: 'Mall of İstanbul: Personel primleri', exact: true }).filter({ visible: true })
      await expect(opener).toHaveAttribute('aria-expanded', 'true')
      await expect(panel).toBeVisible()
      await expectFits(page, panel)
      await page.screenshot({ path: testInfo.outputPath(`accordion-${view}-${width}.png`) })
      await expect(page.getByRole('button', { name: /: Detay/ })).toHaveCount(0)
      const person = panel.getByRole('button', { name: 'Derya Uslu', exact: true })
      await person.click()
      const drawer = page.getByRole('dialog', { name: 'Derya Uslu', exact: true })
      await expect(drawer).toBeVisible()
      await expect(drawer.getByRole('heading', { name: 'Derya Uslu', exact: true })).toBeVisible()
      await expect(drawer).toContainText('Düzeltme notu')
      await expectFits(page, drawer)
      await page.screenshot({ path: testInfo.outputPath(`personnel-drawer-${view}-${width}.png`) })
      await page.keyboard.press('Escape')
      await expect(drawer).toHaveCount(0)
      await expect(person).toBeFocused()
      await opener.click()
      await expect(opener).toHaveAttribute('aria-expanded', 'false')
      await expect(panel).toHaveCount(0)
    })
  }
}

for (const width of [1440, 320]) {
  for (const state of ['correction', 'submission', 'audit'] as const) {
    test(`${state} overlay keeps its workflow controls at ${width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 900 })
      await prepare(page, state === 'audit' ? 'report_viewer' : 'region_manager', { allReviewed: true, multipleRegions: true })
      await page.goto('/store/incentives')
      if (state === 'submission') await page.getByRole('button', { name: 'Onaya gönder', exact: true }).click()
      else {
        await page.getByRole('button', { name: 'Mall of İstanbul', exact: true }).filter({ visible: true }).click()
        await page.getByRole('button', { name: state === 'audit' ? 'Süleyman Öztürk' : 'Derya Uslu', exact: true }).click()
      }
      const overlay = page.getByRole('dialog').last()
      await expect(overlay).toBeVisible()
      await expectFits(page, overlay)
      if (state === 'correction') {
        await expect(overlay.getByLabel('Final prim tutarı')).toBeVisible()
        await expect(overlay.getByLabel('Düzeltme notu')).toBeVisible()
        await expect(overlay.getByRole('button', { name: 'Kaydet', exact: true })).toBeVisible()
      } else if (state === 'submission') {
        await expect(overlay.getByLabel('Gönderilecek bölge')).toBeVisible()
        await expect(overlay.getByLabel('Gönderim notu')).toBeVisible()
      } else {
        await expect(overlay.getByText('Dönem içi mağaza desteği doğrulandı.')).toBeVisible()
        await expect(overlay.locator('input, textarea')).toHaveCount(0)
      }
      await page.screenshot({ path: testInfo.outputPath(`${state}-${width}.png`) })
    })
  }
}

test('shared calendar and metric filtering preserve the store list', async ({ page }) => {
  await prepare(page, 'region_manager')
  await page.goto('/store/incentives')
  await page.getByRole('button', { name: /^DÖNEM / }).click()
  await expect(page.locator('[data-slot="popover-content"]')).toBeVisible()
  await page.keyboard.press('Escape')
  await page.locator('.incentive-performance-metrics').getByRole('button', { name: /Düzeltme/ }).click()
  await expect(page.getByRole('button', { name: 'Mall of İstanbul' }).filter({ visible: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Marmara Forum' })).toHaveCount(0)
})

test('report viewer directory and search operate together', async ({ page }) => {
  await prepare(page, 'report_viewer', { multipleRegions: true })
  await page.goto('/store/incentives')
  const directory = page.getByRole('complementary', { name: 'Bölge müdürleri' })
  await directory.getByRole('button', { name: /Ayşe Kaya/ }).click()
  await expect(page.getByRole('button', { name: 'Akasya AVM' }).filter({ visible: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Mall of İstanbul' })).toHaveCount(0)
  await directory.getByRole('button', { name: /Tüm Mağazalar/ }).click()
  await page.getByPlaceholder('Mağaza veya personel ara').fill('Derya')
  await expect(page.getByRole('button', { name: 'Mall of İstanbul' }).filter({ visible: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Akasya AVM' })).toHaveCount(0)
})

async function prepare(page: Page, view: 'region_manager' | 'report_viewer', options?: Parameters<typeof createIncentiveWorkspace>[1]) {
  await installStoreContractSession(page, view === 'region_manager' ? 'regionManager' : 'reportViewer', view === 'region_manager' ? { actionStoreIds: [incentiveStoreA, incentiveStoreB] } : undefined)
  await installGenericStoreApiFallbacks(page)
  const workspace = createIncentiveWorkspace(view, options)
  await routeIncentiveWorkspace(page, workspace)
  if (view === 'report_viewer') await routeIncentiveManagerDirectory(page, workspace)
  if (view === 'region_manager') await routeIncentiveCommands(page, [])
}

async function expectFits(page: Page, surface: Locator) {
  const box = await surface.boundingBox()
  expect(box).not.toBeNull()
  expect(box!.x).toBeGreaterThanOrEqual(0)
  expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width + 1)
  if (await surface.getAttribute('role') === 'dialog') {
    expect(box!.y).toBeGreaterThanOrEqual(0)
    expect(box!.y + box!.height).toBeLessThanOrEqual(page.viewportSize()!.height + 1)
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1)
}
