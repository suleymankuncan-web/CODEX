import { expect, test } from './test-fixtures'
import { myPerformanceFixture } from './store-surfaces-profile-fixtures'
import { installGenericStoreApiFallbacks, installStoreContractSession } from './store-page-contract-fixtures'

test('daily personnel comparison uses the previous calendar month and month/empty choices persist', async ({ page }) => {
  await installStoreContractSession(page, 'storeManager')
  await installGenericStoreApiFallbacks(page)
  const employeeId = myPerformanceFixture.employee!.employeeId
  const reads: Array<{ start: string; type: string | null }> = []
  await page.route('**/api/reports/personnel-performance/**', async route => {
    const query = new URL(route.request().url()).searchParams
    const start = query.get('periodStart') || '2026-09-05'
    const type = query.get('periodType')
    reads.push({ start, type })
    const missing = start.startsWith('2024')
    const end = type === 'monthly' ? start.slice(0, 7) + '-31' : query.get('periodEnd') || start
    await route.fulfill({ json: { ...myPerformanceFixture,
      period: missing ? null : { periodStart: start, periodEnd: end },
      availablePeriods: [{ periodType: 'monthly', periodStart: '2026-08-01', periodEnd: '2026-08-31' }],
      score: { value: start === '2026-08-05' ? 80 : 100, matchedMetrics: 3, totalMetrics: 3 },
      metrics: myPerformanceFixture.metrics.map(metric => ({ ...metric, actualValue: start === '2026-08-05' ? 80 : 100 })),
    } })
  })
  await page.goto(`/store/personnel/${employeeId}?mode=live&periodType=daily&periodStart=2026-09-05`)
  await expect.poll(() => reads.some(r => r.start === '2026-08-05' && r.type === 'daily')).toBe(true)
  await expect(page.locator('.store-me-kpi-card').filter({ hasText: 'UPT' }).first()).toContainText('+25')
  await page.getByRole('button', { name: 'Tarih filtresi', exact: true }).click()
  await page.getByRole('combobox', { name: 'Ay seç', exact: true }).selectOption({ label: 'Ağu' })
  await page.getByRole('button', { name: 'Uygula', exact: true }).click()
  await expect.poll(() => reads.some(r => r.start === '2026-08-01' && r.type === 'monthly')).toBe(true)
  await expect(page.getByRole('button', { name: 'Tarih filtresi', exact: true })).toContainText('Ağustos 2026')
  await page.getByRole('button', { name: 'Tarih filtresi', exact: true }).click()
  await page.getByRole('combobox', { name: 'Yıl seç', exact: true }).selectOption('2024')
  await page.getByRole('button', { name: 'Uygula', exact: true }).click()
  await expect(page.getByText('Seçilen tarih için veri bulunamadı', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Tarih filtresi', exact: true })).toContainText('Ağustos 2024')
  await expect(page.locator('.store-me-kpi-card')).toHaveCount(0)
})
