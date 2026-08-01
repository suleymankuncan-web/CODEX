import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import { expect, test, type Page } from './test-fixtures'
import { expectCommandCanvasFrame } from './fixtures/command-canvas-parity-harness'
import { installGenericStoreApiFallbacks, installStoreContractSession } from './store-page-contract-fixtures'
import { routeTargetWorkspace } from './store-targets-command-fixtures'
import { routeStoreManagerTargetCommand } from './store-targets-store-manager-command-fixtures'

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-07-15T09:00:00+03:00'))
})

const capture = process.env.CAPTURE_COMMAND_CANVAS_EVIDENCE === '1'

type Rect = { x: number; y: number; width: number; height: number }
type TargetGeometry = Record<string, Rect | number | null>
const geometryManifest = JSON.parse(readFileSync(fileURLToPath(new URL(
  '../../docs/evidence/store-command-canvas-parity/targets/prototype-geometry-v1.json',
  import.meta.url,
)), 'utf8')) as { tolerancePx: number; scenarios: Record<string, TargetGeometry> }

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
    await page.getByRole('button', { name: 'Daha fazla mağaza göster' }).click()
    if (scenario.view === 'report_viewer') await page.getByRole('button', { name: /Deniz Akar/ }).click()
    await expectCommandCanvasFrame(page)
    await page.evaluate(async () => { await document.fonts.ready })
    const geometry = await measureTargetGeometry(page)
    expectGeometryToMatch(geometry, geometryManifest.scenarios[scenario.file], geometryManifest.tolerancePx)
    if (capture) console.log(JSON.stringify({ scenario: scenario.file, geometry }))
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
      await expect(drawer.getByRole('button', { name: 'Onayla' })).toHaveCount(0)
    } else {
      await drawer.getByRole('button', { name: /Derya Uslu/ }).click()
      await expect(drawer.getByLabel('Derya Uslu hedefi')).toBeVisible()
      await expect(drawer.getByRole('button', { name: 'Onayla' })).toBeVisible()
    }
    if (scenario.width === 1440) {
      expect(Math.round((await drawer.boundingBox())?.width ?? 0)).toBe(460)
      const cards = await drawer.locator('.target-command-drawer-metrics > div').evaluateAll((elements) =>
        elements.map((element) => ({
          x: element.getBoundingClientRect().x,
          y: element.getBoundingClientRect().y,
        })),
      )
      expect(cards).toHaveLength(4)
      expect(cards[0]?.y).toBe(cards[1]?.y)
      expect(cards[2]?.y).toBe(cards[3]?.y)
      expect(cards[2]?.y).toBeGreaterThan(cards[0]?.y ?? 0)
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
    await expect(page.getByRole('heading', { name: 'Mağaza Hedef Dağılımı' })).toBeVisible()
    await expectCommandCanvasFrame(page)
    await page.evaluate(async () => { await document.fonts.ready })
    const geometry = await measureTargetGeometry(page)
    expectGeometryToMatch(geometry, geometryManifest.scenarios[scenario.file], geometryManifest.tolerancePx)
    if (capture) console.log(JSON.stringify({ scenario: scenario.file, geometry }))
    await expect(page.locator('.target-store-distribution')).toHaveCount(1)
    await expect(page.locator('.command-canvas-metric')).toHaveCount(4)
    await expect(page.getByLabel('Toplam mağaza hedefi')).toHaveCSS('font-size', '16px')
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
    const opener = page.locator('.target-entry-period').getByRole('button').first()
    await opener.click()
    const picker = page.locator('.target-entry-period-popover')
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
  return fileURLToPath(new URL(`../../docs/evidence/store-command-canvas-parity/targets/${file}`, import.meta.url))
}

async function measureTargetGeometry(page: Page): Promise<TargetGeometry> {
  return page.evaluate(() => {
    const root = document.querySelector<HTMLElement>('[data-command-canvas-page]')
    if (!root) throw new Error('Command Canvas root is missing.')
    const rootRect = root.getBoundingClientRect()
    const rect = (selector: string) => {
      const element = document.querySelector<HTMLElement>(selector)
      if (!element) return null
      const value = element.getBoundingClientRect()
      return {
        x: Math.round((value.x - rootRect.x) * 100) / 100,
        y: Math.round((value.y - rootRect.y) * 100) / 100,
        width: Math.round(value.width * 100) / 100,
        height: Math.round(value.height * 100) / 100,
      }
    }
    return {
      pageWidth: Math.round(rootRect.width * 100) / 100,
      header: rect('.command-canvas-page-header'),
      headerAction: rect('.command-canvas-page-header > .command-canvas-action-cluster'),
      metrics: rect('[data-command-metric-rail]'),
      filter: rect('[data-command-canvas-filter-bar]'),
      workspace: rect('.target-command-workbench'),
      viewerIntro: rect('.target-command-viewer-intro'),
      firstRegion: rect('.target-command-region-head'),
      firstStore: rect('.target-command-row'),
      distribution: rect('.target-store-distribution'),
      distributionTop: rect('.target-store-distribution')?.y ?? null,
      distributionWidth: rect('.target-store-distribution')?.width ?? null,
    }
  })
}

function expectGeometryToMatch(actual: TargetGeometry, expected: TargetGeometry | undefined, tolerancePx: number) {
  expect(expected, 'Prototype geometry scenario is missing from the committed manifest.').toBeDefined()
  for (const [key, expectedValue] of Object.entries(expected ?? {})) {
    const actualValue = actual[key]
    if (typeof expectedValue === 'number') {
      expect(actualValue, `${key} must be numeric.`).toEqual(expect.any(Number))
      expect(Math.abs((actualValue as number) - expectedValue), `${key} exceeds the ${tolerancePx}px parity tolerance.`).toBeLessThanOrEqual(tolerancePx)
      continue
    }
    expect(actualValue, `${key} is missing from production geometry.`).not.toBeNull()
    for (const coordinate of ['x', 'y', 'width', 'height'] as const) {
      expect(
        Math.abs((actualValue as Rect)[coordinate] - expectedValue[coordinate]),
        `${key}.${coordinate} exceeds the ${tolerancePx}px parity tolerance.`,
      ).toBeLessThanOrEqual(tolerancePx)
    }
  }
}
