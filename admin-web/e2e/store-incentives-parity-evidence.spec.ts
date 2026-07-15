import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import { expect, test, type Locator, type Page } from './test-fixtures'
import { expectCommandCanvasFrame } from './fixtures/command-canvas-parity-harness'
import { installGenericStoreApiFallbacks, installStoreContractSession } from './store-page-contract-fixtures'
import {
  createIncentiveWorkspace,
  incentiveStoreA,
  incentiveStoreB,
  routeIncentiveCommands,
  routeIncentiveWorkspace,
} from './store-incentives-command-fixtures'

const captureEvidence = process.env.CAPTURE_COMMAND_CANVAS_EVIDENCE === '1'
type Rect = { x: number; y: number; width: number; height: number }
type Geometry = Record<string, Rect | number | null>
const geometryManifest = JSON.parse(readFileSync(fileURLToPath(new URL(
  '../../docs/evidence/store-command-canvas-parity/incentives/prototype-geometry-v1.json',
  import.meta.url,
)), 'utf8')) as { tolerancePx: number; scenarios: Record<string, Geometry> }

for (const scenario of [
  { persona: 'regionManager' as const, view: 'region_manager' as const, width: 1440, height: 900, file: 'region-manager-desktop.png' },
  { persona: 'regionManager' as const, view: 'region_manager' as const, width: 1024, height: 768, file: 'region-manager-compact.png' },
  { persona: 'regionManager' as const, view: 'region_manager' as const, width: 390, height: 844, file: 'region-manager-mobile.png' },
  { persona: 'regionManager' as const, view: 'region_manager' as const, width: 320, height: 844, file: 'region-manager-narrow.png' },
  { persona: 'reportViewer' as const, view: 'report_viewer' as const, width: 1440, height: 900, file: 'report-viewer-desktop.png' },
  { persona: 'reportViewer' as const, view: 'report_viewer' as const, width: 1024, height: 768, file: 'report-viewer-compact.png' },
  { persona: 'reportViewer' as const, view: 'report_viewer' as const, width: 390, height: 844, file: 'report-viewer-mobile.png' },
  { persona: 'reportViewer' as const, view: 'report_viewer' as const, width: 320, height: 844, file: 'report-viewer-narrow.png' },
]) {
  test(`captures ${scenario.view} parity evidence at ${scenario.width}x${scenario.height}`, async ({ page }) => {
    await page.setViewportSize({ width: scenario.width, height: scenario.height })
    await prepare(page, scenario.persona, scenario.view)
    await page.goto('/store/incentives')
    await expect(page.getByRole('heading', { name: scenario.view === 'report_viewer' ? 'Şirket Prim Görünümü' : 'Prim Kontrol Merkezi' })).toBeVisible()
    await expectCommandCanvasFrame(page)
    await page.evaluate(async () => { await document.fonts.ready })

    const geometry = await measureGeometry(page)
    expectGeometryToMatch(geometry, geometryManifest.scenarios[scenario.file], geometryManifest.tolerancePx)
    if (captureEvidence) console.log(JSON.stringify({ scenario: scenario.file, geometry }))

    if (captureEvidence) {
      await page.locator('.store-shell').screenshot({
        animations: 'disabled',
        path: fileURLToPath(new URL(`../../docs/evidence/store-command-canvas-parity/incentives/${scenario.file}`, import.meta.url)),
      })
    }
  })
}

for (const scenario of [
  { state: 'correction-drawer' as const, persona: 'regionManager' as const, view: 'region_manager' as const, width: 1440, height: 900, file: 'region-manager-correction-drawer-desktop.png' },
  { state: 'correction-drawer' as const, persona: 'regionManager' as const, view: 'region_manager' as const, width: 320, height: 844, file: 'region-manager-correction-drawer-narrow.png' },
  { state: 'submit-dialog' as const, persona: 'regionManager' as const, view: 'region_manager' as const, width: 1440, height: 900, file: 'region-manager-submit-dialog-desktop.png' },
  { state: 'submit-dialog' as const, persona: 'regionManager' as const, view: 'region_manager' as const, width: 320, height: 844, file: 'region-manager-submit-dialog-narrow.png' },
  { state: 'audit-drawer' as const, persona: 'reportViewer' as const, view: 'report_viewer' as const, width: 1440, height: 900, file: 'report-viewer-audit-drawer-desktop.png' },
  { state: 'audit-drawer' as const, persona: 'reportViewer' as const, view: 'report_viewer' as const, width: 320, height: 844, file: 'report-viewer-audit-drawer-narrow.png' },
]) {
  test(`captures ${scenario.state} parity evidence at ${scenario.width}x${scenario.height}`, async ({ page }) => {
    await page.setViewportSize({ width: scenario.width, height: scenario.height })
    await prepare(page, scenario.persona, scenario.view, scenario.state === 'submit-dialog' ? { allReviewed: true, multipleRegions: true } : undefined)
    await page.goto('/store/incentives')
    if (scenario.state === 'correction-drawer') await page.getByRole('button', { name: 'Derya Uslu: Düzelt' }).click()
    if (scenario.state === 'submit-dialog') await page.getByRole('button', { name: 'Onaya gönder', exact: true }).first().click()
    if (scenario.state === 'audit-drawer') await page.getByRole('button', { name: 'Süleyman Öztürk: Düzeltmeyi görüntüle' }).click()
    const overlay = page.getByRole('dialog')
    await expect(overlay).toBeVisible()
    await expectOverlaySemantics(overlay, scenario.state)
    await expectOverlayFitsViewport(page, overlay)
    if (captureEvidence) await capturePageEvidence(page, scenario.file)
  })
}

async function expectOverlaySemantics(overlay: Locator, state: 'correction-drawer' | 'submit-dialog' | 'audit-drawer') {
  if (state === 'correction-drawer') {
    await expect(overlay.getByRole('heading', { name: 'Derya Uslu' })).toBeVisible()
    await expect(overlay.getByText('Hedef gerçekleşme')).toBeVisible()
    await expect(overlay.locator('.incentive-drawer-stat')).toHaveCount(4)
    await expect(overlay.locator('.incentive-rate-option')).toHaveCount(5)
    await expect(overlay.getByLabel('Final prim tutarı')).toBeVisible()
    await expect(overlay.getByLabel('Düzeltme notu')).toBeVisible()
    await expect(overlay.getByRole('button', { name: 'Kaydet' })).toBeVisible()
    return
  }
  if (state === 'submit-dialog') {
    await expect(overlay.getByRole('heading', { name: 'Haziran 2026 primlerini onaya gönder' })).toBeVisible()
    await expect(overlay.locator('.incentive-confirm-total')).toBeVisible()
    await expect(overlay.locator('.incentive-confirm-grid .incentive-drawer-stat')).toHaveCount(4)
    await expect(overlay.getByLabel('Gönderilecek bölge')).toBeVisible()
    await expect(overlay.getByLabel('Gönderim notu')).toBeVisible()
    return
  }
  await expect(overlay.getByRole('heading', { name: 'Düzeltme kaydı' })).toBeVisible()
  await expect(overlay.getByText('Düzeltme notu')).toBeVisible()
  await expect(overlay.locator('input, textarea, select')).toHaveCount(0)
  await expect(overlay.getByRole('button')).toHaveCount(1)
}

test('captures the open period picker and active metric without blanking the workspace', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await prepare(page, 'regionManager', 'region_manager')
  await page.goto('/store/incentives')
  await page.getByRole('button', { name: 'Dönem seç' }).click()
  await expect(page.locator('[data-slot="popover-content"]')).toBeVisible()
  await expect(page.getByText('Mall of İstanbul').first()).toBeVisible()
  if (captureEvidence) await capturePageEvidence(page, 'region-manager-period-picker-mobile.png')
  await page.keyboard.press('Escape')
  await page.locator('.command-canvas-metric[data-tone="cyan"]').click()
  await expect(page.getByText('Mall of İstanbul').first()).toBeVisible()
  if (captureEvidence) await capturePageEvidence(page, 'region-manager-active-metric-mobile.png')
})

async function prepare(
  page: Page,
  persona: 'regionManager' | 'reportViewer',
  view: 'region_manager' | 'report_viewer',
  options?: NonNullable<Parameters<typeof createIncentiveWorkspace>[1]>,
) {
  await installStoreContractSession(page, persona, persona === 'regionManager' ? { actionStoreIds: [incentiveStoreA, incentiveStoreB] } : undefined)
  await installGenericStoreApiFallbacks(page)
  await routeIncentiveWorkspace(page, createIncentiveWorkspace(view, { prototypeParity: true, ...options }))
  if (persona === 'regionManager') await routeIncentiveCommands(page, [])
}

async function expectOverlayFitsViewport(page: Page, overlay: Locator) {
  const box = await overlay.boundingBox()
  expect(box).not.toBeNull()
  const viewport = page.viewportSize()
  expect(viewport).not.toBeNull()
  expect(box!.x).toBeGreaterThanOrEqual(0)
  expect(box!.y).toBeGreaterThanOrEqual(0)
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width + 1)
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height + 1)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(1)
}

async function capturePageEvidence(page: Page, file: string) {
  await page.screenshot({
    animations: 'disabled',
    path: fileURLToPath(new URL(`../../docs/evidence/store-command-canvas-parity/incentives/${file}`, import.meta.url)),
  })
}

async function measureGeometry(page: Page) {
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
      metrics: rect('[data-command-metric-rail]'),
      filter: rect('[data-command-canvas-filter-bar]'),
      tabs: rect('.incentive-workspace-tabs'),
      section: rect('.incentive-viewer-section-header'),
      list: rect('[data-command-canvas-list]'),
      firstStore: rect('.incentive-store-summary'),
      firstRegion: rect('.incentive-region-trigger'),
      firstPeopleTable: rect('.incentive-person-table'),
      firstPerson: rect('.incentive-person-row'),
    }
  })
}

function expectGeometryToMatch(actual: Geometry, expected: Geometry | undefined, tolerancePx: number) {
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
