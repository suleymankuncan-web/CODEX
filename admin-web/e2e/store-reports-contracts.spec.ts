import { expect, test } from './test-fixtures'
import {
  installGenericStoreApiFallbacks,
  installStoreContractSession,
} from './store-page-contract-fixtures'

test.beforeEach(async ({ page }) => {
  await page.route('**/api/org/region-managers', route => route.fulfill({ json: { items: [
    { userId: 'reports-manager', displayName: 'Bölge Müdürü', storeIds: ['reports-store'] },
  ] } }))
})

test('reports downloads the selected month package as an Excel file', async ({ page }) => {
  await installStoreContractSession(page, 'regionManager')
  await installGenericStoreApiFallbacks(page)
  await page.route('**/api/reports/store-monthly-package.xlsx?**', async (route) => {
    await route.fulfill({
      body: Buffer.from('PK\u0003\u0004store-report-contract'),
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
  })

  await page.goto('/store/reports')

  const button = page.getByRole('button', { name: 'Excel indir' })
  await expect(button).toBeEnabled()

  const downloadPromise = page.waitForEvent('download')
  await button.click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/^magaza-izleyis-\d{4}-\d{2}\.xlsx$/)
})

for (const persona of ['regionManager', 'reportViewer', 'storeManager'] as const) {
  test(`reports keeps Excel but removes duplicate KPI store table for ${persona}`, async ({ page }) => {
    await installStoreContractSession(page, persona)
    await installGenericStoreApiFallbacks(page)
    await page.goto('/store/reports')
    await expect(page.getByRole('button', { name: 'Excel indir' })).toBeEnabled()
    await expect(page.locator('.store-reports-command table')).toHaveCount(0)
    await expect(page.locator('.store-reports-command .src-table')).toHaveCount(0)
    const contents = page.locator('.src-sections')
    await expect(contents).toHaveAttribute('open', '')
    await expect(contents.locator('.src-section-list')).toBeVisible()
    await contents.locator('summary').focus()
    await page.keyboard.press('Enter')
    await expect(contents).not.toHaveAttribute('open')
    await page.keyboard.press('Enter')
    await expect(contents).toHaveAttribute('open', '')
  })

  for (const viewport of [
    { width: 1440, height: 1200 },
    { width: 1024, height: 768 },
    { width: 390, height: 844 },
    { width: 360, height: 800 },
  ]) {
    test(`reports stays compact for ${persona} at ${viewport.width}x${viewport.height}`, async ({ page }) => {
      await page.setViewportSize(viewport)
      await installStoreContractSession(page, persona)
      await installGenericStoreApiFallbacks(page)
      await page.goto('/store/reports')
      await expect(page.getByRole('button', { name: 'Excel indir' })).toBeEnabled()
      const contents = page.locator('.src-sections')
      await expect(contents).toHaveAttribute('open', '')

      // Both expanded and collapsed content must leave spare height below the
      // work area, rather than stretching the header and metrics to fill it.
      for (const expanded of [true, false]) {
        if (!expanded) await contents.locator('summary').click()
        const header = await page.locator('.store-reports-command .operations-header').boundingBox()
        expect(header?.height).toBeLessThanOrEqual(viewport.width > 600 ? 96 : 192)
        const metrics = page.locator('.src-metric')
        await expect(metrics).toHaveCount(4)
        for (const metric of await metrics.all()) {
          expect((await metric.boundingBox())?.height).toBeLessThanOrEqual(viewport.width > 600 ? 112 : 144)
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
      }
    })
  }
}
