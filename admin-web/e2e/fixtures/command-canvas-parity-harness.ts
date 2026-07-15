import AxeBuilder from '@axe-core/playwright'
import { expect, type Locator, type Page } from '@playwright/test'

export const commandCanvasViewports = [
  { width: 1440, height: 900 },
  { width: 1024, height: 768 },
  { width: 390, height: 844 },
  { width: 320, height: 844 },
] as const

export async function expectCommandCanvasFrame(page: Page) {
  await expect(page.locator('.store-shell')).toBeVisible()
  await expect(page.locator('.store-main')).toBeVisible()
  await expect(page.locator('[data-command-canvas-page]')).toHaveCount(1)

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBeLessThanOrEqual(0)

  const results = await new AxeBuilder({ page })
    .include('[data-command-canvas-page]')
    .analyze()
  expect(results.violations).toEqual([])
}

export async function expectCommandCanvasReference(page: Page, snapshotName: string) {
  await expectCommandCanvasFrame(page)
  await expect(page.locator('.store-shell')).toHaveScreenshot(snapshotName, {
    animations: 'disabled',
  })
}

export async function expectOverlayCloseAndFocusRestore(input: {
  page: Page
  opener: Locator
  overlay: Locator
}) {
  await expect(input.overlay).toBeVisible()
  await input.page.keyboard.press('Escape')
  await expect(input.overlay).toBeHidden()
  await expect(input.opener).toBeFocused()
}
