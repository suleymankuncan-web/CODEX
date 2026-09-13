import { fileURLToPath } from 'node:url'
import { expect, test, type Page } from './test-fixtures'
import { installGenericStoreApiFallbacks, installStoreContractSession } from './store-page-contract-fixtures'
import { routeTargetWorkspace } from './store-targets-command-fixtures'
import { routeStoreManagerTargetCommand } from './store-targets-store-manager-command-fixtures'

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-07-15T09:00:00+03:00'))
})

const capture = process.env.CAPTURE_COMMAND_CANVAS_EVIDENCE === '1'

for (const scenario of [
  {
    persona: 'regionManager' as const,
    view: 'region_manager' as const,
    width: 1440,
    height: 900,
    file: 'region-manager-desktop.png',
  },
  {
    persona: 'regionManager' as const,
    view: 'region_manager' as const,
    width: 1024,
    height: 768,
    file: 'region-manager-compact.png',
  },
  {
    persona: 'regionManager' as const,
    view: 'region_manager' as const,
    width: 390,
    height: 844,
    file: 'region-manager-mobile.png',
  },
  {
    persona: 'regionManager' as const,
    view: 'region_manager' as const,
    width: 320,
    height: 844,
    file: 'region-manager-narrow.png',
  },
  {
    persona: 'reportViewer' as const,
    view: 'report_viewer' as const,
    width: 1440,
    height: 900,
    file: 'report-viewer-desktop.png',
  },
  {
    persona: 'reportViewer' as const,
    view: 'report_viewer' as const,
    width: 1024,
    height: 768,
    file: 'report-viewer-compact.png',
  },
  {
    persona: 'reportViewer' as const,
    view: 'report_viewer' as const,
    width: 390,
    height: 844,
    file: 'report-viewer-mobile.png',
  },
  {
    persona: 'reportViewer' as const,
    view: 'report_viewer' as const,
    width: 320,
    height: 844,
    file: 'report-viewer-narrow.png',
  },
]) {
  test(`Targets ${scenario.view} frame at ${scenario.width}x${scenario.height}`, async ({ page }) => {
    await page.setViewportSize({
      width: scenario.width,
      height: scenario.height,
    })
    await prepare(page, scenario.persona, scenario.view)
    await page.goto('/store/targets')
    await expect(
      page.getByRole('heading', {
        name: scenario.view === 'report_viewer' ? 'Şirket hedef görünümü' : 'Hedef Kontrol Masası',
      }),
    ).toBeVisible()
    if (scenario.view === 'region_manager') {
      await page.getByRole('button', { name: 'Daha fazla mağaza göster' }).click()
    }
    await expectAzureTargetFrame(page)
    await page.evaluate(async () => { await document.fonts.ready })
    await expect(page.locator('[data-command-canvas-page]')).toHaveCount(1)
    await expect(page.locator('.target-command-row')).toHaveCount(3)
    await expect(page.locator('.role-switcher')).toHaveCount(0)
    await expect(page.locator('.targets-prototype, .targets-ledger')).toHaveCount(0)
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
    ).toBe(true)
    if (capture)
      await page.locator('.store-shell').screenshot({
        animations: 'disabled',
        path: evidencePath(scenario.file),
      })
  })
}

for (const scenario of [
  {
    persona: 'regionManager' as const,
    view: 'region_manager' as const,
    width: 1440,
    height: 900,
    file: 'region-manager-drawer-desktop.png',
  },
  {
    persona: 'regionManager' as const,
    view: 'region_manager' as const,
    width: 320,
    height: 844,
    file: 'region-manager-drawer-narrow.png',
  },
  {
    persona: 'reportViewer' as const,
    view: 'report_viewer' as const,
    width: 1440,
    height: 900,
    file: 'report-viewer-drawer-desktop.png',
  },
  {
    persona: 'reportViewer' as const,
    view: 'report_viewer' as const,
    width: 320,
    height: 844,
    file: 'report-viewer-drawer-narrow.png',
  },
]) {
  test(`Targets ${scenario.view} drawer at ${scenario.width}x${scenario.height}`, async ({ page }) => {
    await page.setViewportSize({
      width: scenario.width,
      height: scenario.height,
    })
    await prepare(page, scenario.persona, scenario.view)
    await page.goto('/store/targets')
    await page.getByRole('button', { name: /Mall of İstanbul/ }).click()
    const drawer = page.getByRole('dialog')
    await expect(drawer).toBeVisible()
    await expect(drawer.getByText('Kalan bakiye').first()).toBeVisible()
    if (scenario.view === 'report_viewer') {
      await expect(drawer.locator('input, textarea, select')).toHaveCount(0)
      await expect(drawer.getByRole('button', { name: 'Dağılımı onayla' })).toHaveCount(0)
    } else {
      await drawer.getByRole('button', { name: 'Günleri düzenle' }).click()
      await expect(drawer.getByLabel('Derya Uslu dağıtım günü')).toBeVisible()
      await expect(drawer.getByRole('button', { name: 'Dağılımı onayla' })).toBeVisible()
    }
    if (scenario.width === 1440) {
      expect(Math.round((await drawer.boundingBox())?.width ?? 0)).toBe(1120)
      const cards = await drawer.locator('.target-review-stats > div').evaluateAll((elements) =>
        elements.map((element) => ({
          x: element.getBoundingClientRect().x,
          y: element.getBoundingClientRect().y,
        })),
      )
      expect(cards).toHaveLength(4)
      expect(cards[0]?.y).toBe(cards[1]?.y)
      expect(cards[0]?.y).toBe(cards[2]?.y)
      expect(cards[0]?.y).toBe(cards[3]?.y)
    }
    expect(await drawer.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true)
    if (capture)
      await page.screenshot({
        animations: 'disabled',
        path: evidencePath(scenario.file),
      })
  })
}

for (const scenario of [
  { width: 1440, height: 900, file: 'store-manager-desktop.png' },
  { width: 1024, height: 768, file: 'store-manager-compact.png' },
  { width: 390, height: 844, file: 'store-manager-mobile.png' },
  { width: 320, height: 844, file: 'store-manager-narrow.png' },
]) {
  test(`Targets store_manager frame at ${scenario.width}x${scenario.height}`, async ({ page }) => {
    await page.setViewportSize({
      width: scenario.width,
      height: scenario.height,
    })
    await installStoreContractSession(page, 'storeManager')
    await installGenericStoreApiFallbacks(page)
    await routeStoreManagerTargetCommand(page)
    await page.goto('/store/targets')
    await expect(page.getByRole('heading', { name: 'Mall of İstanbul' })).toBeVisible()
    await expectAzureTargetFrame(page)
    await page.evaluate(async () => { await document.fonts.ready })
    await expect(page.locator('.target-store-distribution')).toHaveCount(1)
    await expect(page.locator('.command-canvas-metric')).toHaveCount(4)
    await expect(page.getByLabel('Toplam mağaza hedefi')).toHaveCSS(
      'font-size',
      scenario.width >= 768 ? '18px' : '16px',
    )
    await expect(page.locator('.role-switcher')).toHaveCount(0)
    await expect(page.locator('.targets-prototype, .targets-ledger')).toHaveCount(0)
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
    ).toBe(true)
    if (capture)
      await page.locator('.store-shell').screenshot({
        animations: 'disabled',
        path: evidencePath(scenario.file),
      })
  })
}

for (const scenario of [
  { width: 1440, height: 900, file: 'store-manager-period-desktop.png' },
  { width: 320, height: 844, file: 'store-manager-period-narrow.png' },
]) {
  test(`Targets store_manager period picker at ${scenario.width}x${scenario.height}`, async ({ page }) => {
    await page.setViewportSize({
      width: scenario.width,
      height: scenario.height,
    })
    await installStoreContractSession(page, 'storeManager')
    await installGenericStoreApiFallbacks(page)
    await routeStoreManagerTargetCommand(page)
    await page.goto('/store/targets')
    const opener = page.locator('.operations-period').first()
    await opener.click()
    const picker = page.getByRole('dialog', { name: 'Hedef dönemi seç' })
    await expect(picker).toBeVisible()
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
    ).toBe(true)
    expect(await picker.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true)
    if (capture)
      await page.screenshot({
        animations: 'disabled',
        path: evidencePath(scenario.file),
      })
  })
}

async function prepare(
  page: Page,
  persona: 'regionManager' | 'reportViewer',
  view: 'region_manager' | 'report_viewer',
) {
  await installStoreContractSession(page, persona)
  await installGenericStoreApiFallbacks(page)
  await routeTargetWorkspace(page, view)
}

function evidencePath(file: string) {
  return fileURLToPath(new URL(`../test-results/targets-azure/${file}`, import.meta.url))
}

async function expectAzureTargetFrame(page: Page) {
  const header = page.locator('.operations-header')
  await expect(header).toBeVisible()
  const rect = await header.boundingBox()
  expect(rect?.width).toBeLessThanOrEqual(1280)
  if ((page.viewportSize()?.width ?? 0) >= 1024) {
    expect(rect?.height).toBeLessThanOrEqual((page.viewportSize()?.width ?? 0) >= 1280 ? 112 : 124)
    await expect(header.locator('h1')).toHaveCSS('font-size', '24px')
  }
  const metrics = page.locator('.command-canvas-metric')
  await expect(metrics).toHaveCount(4)
  expect(await metrics.first().evaluate(el => el.getBoundingClientRect().height)).toBeLessThanOrEqual(100)
}
