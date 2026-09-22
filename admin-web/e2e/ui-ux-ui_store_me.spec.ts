import { expect, test } from './test-fixtures'
import { myPerformanceFixture } from './store-surfaces-profile-fixtures'
import { installGenericStoreApiFallbacks, installStoreContractSession } from './store-page-contract-fixtures'

test.beforeEach(async ({ page }) => {
  await installStoreContractSession(page, 'storePersonnel')
  await installGenericStoreApiFallbacks(page)
})

for (const width of [1440, 1024, 390, 320]) {
  test(`self performance keeps the active month and share dialog within ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 568 })
    await page.route('**/api/reports/my-performance**', async route => {
      await route.fulfill({ json: {
        ...myPerformanceFixture,
        period: { periodStart: '2026-04-01', periodEnd: '2026-04-30' },
        availablePeriods: [
          { periodType: 'monthly', periodStart: '2026-04-01', periodEnd: '2026-04-30' },
          { periodType: 'monthly', periodStart: '2026-05-01', periodEnd: '2026-05-31' },
        ],
      } })
    })

    await page.goto('/store/me')
    await expect(page.getByRole('button', { name: 'Tarih filtresi' })).toContainText('Nisan 2026')
    const trigger = page.getByRole('button', { name: 'Performans Kartı Oluştur', exact: true })
    await trigger.click()
    const dialog = page.getByRole('dialog', { name: 'Performans Kartı Oluştur' })
    await expect(dialog.getByTestId('store-me-share-card-preview')).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Close', exact: true })).toHaveCount(0)
    const bounds = await dialog.boundingBox()
    expect(bounds).not.toBeNull()
    expect(bounds!.x).toBeGreaterThanOrEqual(0)
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width)
    expect(bounds!.y).toBeGreaterThanOrEqual(0)
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(568)
    await dialog.getByRole('button', { name: 'PNG indir' }).scrollIntoViewIfNeeded()
    await expect(dialog.getByRole('button', { name: 'PNG indir' })).toBeInViewport()
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(trigger).toBeFocused()
  })
}

test('missing target and UPT values do not present measured zero progress', async ({ page }) => {
  let hasTargetRatio = false
  await page.route('**/api/reports/my-performance**', async route => {
    await route.fulfill({ json: {
      ...myPerformanceFixture,
      partial: { ...myPerformanceFixture.partial, isPartial: true },
      metrics: myPerformanceFixture.metrics.map(metric => metric.code === 'TARGET_ACHIEVEMENT'
        ? { ...metric, actualValue: 92002, targetValue: hasTargetRatio ? 100000 : null,
            achievementRate: hasTargetRatio ? 0 : null, actualRatio: hasTargetRatio ? 0 : null,
            scoreStatus: hasTargetRatio ? 'scored' : 'missing_reference' }
        : metric.code === 'UPT'
          ? { ...metric, actualValue: null, dataStatus: 'missing', scoreStatus: 'missing', status: 'missing' }
          : metric),
    } })
  })
  await page.goto('/store/me')
  const target = page.getByTestId('store-me-target-progress-card')
  await expect(target.locator('.store-me-kpi-head strong')).toHaveText('Eksik referans')
  await expect(target.getByRole('progressbar')).toHaveCount(0)
  await expect(target).not.toContainText('Hedefin %0')
  const upt = page.getByTestId('store-me-metric-card').filter({ hasText: 'UPT' })
  await expect(upt.locator('.store-me-kpi-progress')).toHaveText('Veri yok')
  await expect(upt.getByRole('progressbar')).toHaveCount(0)

  hasTargetRatio = true
  await page.reload()
  await expect(target.locator('.store-me-kpi-head strong')).toHaveText('%0')
  await expect(target.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0')
})

test('share dialog resets failed download feedback and both dialogs return keyboard focus', async ({ page }) => {
  await page.route('**/api/reports/my-performance**', async route => {
    await route.fulfill({ json: myPerformanceFixture })
  })
  await page.goto('/store/me')
  const detailsTrigger = page.getByRole('button', { name: 'KPI detayları', exact: true })
  await detailsTrigger.click()
  await page.getByRole('button', { name: 'KPI detaylarını kapat' }).click()
  await expect(detailsTrigger).toBeFocused()

  await page.evaluate(() => {
    HTMLCanvasElement.prototype.toDataURL = () => { throw new Error('Expected export failure') }
  })
  const shareTrigger = page.getByRole('button', { name: 'Performans Kartı Oluştur', exact: true })
  await shareTrigger.click()
  const dialog = page.getByRole('dialog', { name: 'Performans Kartı Oluştur' })
  await dialog.getByRole('button', { name: 'PNG indir' }).click()
  await expect(dialog.getByText('Performans kartı oluşturulamadı.')).toBeVisible()
  await dialog.getByRole('button', { name: 'Kapat', exact: true }).first().click()
  await expect(shareTrigger).toBeFocused()
  await shareTrigger.click()
  await expect(dialog.getByText('Performans kartı oluşturulamadı.')).toHaveCount(0)
  await expect(dialog.getByRole('button', { name: 'PNG indir' })).toBeEnabled()
})
