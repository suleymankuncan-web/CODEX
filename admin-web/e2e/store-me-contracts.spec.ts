import { expect, test } from './test-fixtures'
import { expectNoCriticalAxeViolations } from './axe-test-utils'
import { myPerformanceFixture } from './store-surfaces-profile-fixtures'
import {
  installGenericStoreApiFallbacks,
  installStoreContractSession,
} from './store-page-contract-fixtures'

test('store me exposes the performance card action and compact month picker', async ({ page }) => {
  await installStoreContractSession(page, 'storePersonnel')
  await installGenericStoreApiFallbacks(page)

  await page.goto('/store/me')

  await expect(page.getByRole('button', { name: 'Performans Kartı Oluştur' })).toBeVisible()
  const dateFilter = page.getByRole('button', { name: 'Tarih filtresi' })
  await expect(dateFilter).toBeVisible()
  await dateFilter.click()
  await expect(page.getByText('Tarih filtresi').last()).toBeVisible()
  await expect(page.locator('.store-me-compact-date-filter').getByText('Dönem veri')).toHaveCount(0)
})

for (const width of [1440, 390]) {
  test(`self KPI details show all monthly comparisons and three rank scopes at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await installStoreContractSession(page, 'storePersonnel')
    await installGenericStoreApiFallbacks(page)
    const availablePeriods = ['2026-04-01', '2026-05-01', '2026-03-01', '2026-02-01', '2026-01-01', '2025-04-01'].map(periodStart => ({ periodType: 'monthly', periodStart, periodEnd: periodStart.slice(0, 7) + (periodStart.endsWith('03-01') || periodStart.endsWith('01-01') ? '-31' : periodStart.endsWith('02-01') ? '-28' : '-30') }))
    const reads: string[] = []
    await page.route('**/api/reports/my-performance**', async route => {
      const start = new URL(route.request().url()).searchParams.get('periodStart') || '2026-04-01'
      reads.push(start)
      const value = start === '2026-04-01' ? 100 : start === '2026-03-01' ? 80 : 125
      const rankings = { storeRank: 1, storePopulation: 6, regionRank: 2, regionPopulation: 20, turkeyRank: 4, turkeyPopulation: 60 }
      const metrics = myPerformanceFixture.metrics.map(metric => ({ ...metric, actualValue: value, achievementRate: value / 100, contributionValue: value / 3 }))
      await route.fulfill({ json: { ...myPerformanceFixture, period: { periodStart: start, periodEnd: availablePeriods.find(p => p.periodStart === start)?.periodEnd ?? start }, availablePeriods, score: { value, matchedMetrics: 3, totalMetrics: 3 }, metrics, rankings, metricRanks: metrics.map(metric => ({ code: metric.code, label: metric.label, actualValue: metric.actualValue, ...rankings })) } })
    })
    await page.goto('/store/me')
    await expect(page.locator('.store-me-score-chart [data-slot="chart"]')).toBeVisible()
    await expect(page.locator('.store-me-score-chart .recharts-bar')).toBeVisible()
    await expect(page.locator('.store-me-score-chart').getByText('140', { exact: true })).toBeVisible()
    await expect(page.locator('.store-me-kpi-card').first()).toContainText('100 / 140')
    await expect(page.locator('.store-me-summary-strip strong').nth(1)).toHaveText('100')
    await expect(page.locator('.store-me-quote-card')).toHaveCount(0)
    await page.getByRole('button', { name: 'KPI detayları', exact: true }).click()
    const dialog = page.getByTestId('store-me-kpi-dialog')
    const april = dialog.getByRole('region', { name: 'Nisan 2026', exact: true })
    await expect(april.locator('tbody tr')).toHaveCount(4)
    for (const name of ['Performans Skoru', 'HG · Hedef Gerçekleşme', 'ATV · Ortalama Fiş Tutarı', 'UPT · Fiş Başına Ürün']) {
      const row = april.getByRole('row', { name: new RegExp(name) })
      await expect(row).toContainText('+25%')
      await expect(row).toContainText('−20%')
      for (const rank of ['1. / 6', '2. / 20', '4. / 60']) await expect(row).toContainText(rank)
    }
    expect(reads).toContain('2025-04-01')
    const increaseColor = await april.locator('[data-direction="up"]').first().evaluate(el => getComputedStyle(el).color)
    const declineColor = await april.locator('[data-direction="down"]').first().evaluate(el => getComputedStyle(el).color)
    expect(increaseColor).not.toBe(declineColor)
    await expectNoCriticalAxeViolations(page)
    expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)
    expect(await april.evaluate(el => el.scrollHeight <= el.clientHeight + 1)).toBe(true)
    await dialog.getByRole('region', { name: 'Mart 2026', exact: true }).scrollIntoViewIfNeeded()
    await expect(dialog.getByRole('region', { name: 'Mart 2026', exact: true })).toBeInViewport()
    const rect = await dialog.boundingBox()
    expect(rect!.x).toBeGreaterThanOrEqual(0)
    expect(rect!.x + rect!.width).toBeLessThanOrEqual(width)
    await dialog.getByRole('combobox', { name: 'Detay yılı' }).click()
    await page.getByRole('option', { name: '2025', exact: true }).click()
    await expect(dialog.getByRole('region', { name: 'Nisan 2025', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'KPI detaylarını kapat' }).click()
    await expect(dialog).toHaveCount(0)
  })
}

test('self KPI details distinguish failed reads from missing history and reject a fallback month', async ({ page }) => {
  await installStoreContractSession(page, 'storePersonnel')
  await installGenericStoreApiFallbacks(page)
  let failHistory = true
  const availablePeriods = ['2026-04-01', '2026-03-01'].map(periodStart => ({ periodType: 'monthly', periodStart, periodEnd: periodStart.slice(0, 7) + (periodStart.includes('-03-') ? '-31' : '-30') }))
  await page.route('**/api/reports/my-performance**', async route => {
    const start = new URL(route.request().url()).searchParams.get('periodStart') || '2026-04-01'
    if (start === '2026-03-01' && failHistory) {
      await route.fulfill({ status: 500, json: { message: 'History unavailable' } })
      return
    }
    // The server can fall back to April for an unavailable requested month.
    await route.fulfill({ json: { ...myPerformanceFixture, period: { periodStart: '2026-04-01', periodEnd: '2026-04-30' }, availablePeriods } })
  })
  await page.goto('/store/me')
  await page.getByRole('button', { name: 'KPI detayları', exact: true }).click()
  const dialog = page.getByTestId('store-me-kpi-dialog')
  await expect(dialog.getByRole('alert')).toContainText('Bazı dönemler yüklenemedi.')
  const april = dialog.getByRole('region', { name: 'Nisan 2026', exact: true })
  const row = april.getByRole('row', { name: /Performans Skoru/ })
  await expect(row).toContainText('Yüklenemedi')
  await expect(row).toContainText('Veri yok')
  failHistory = false
  await dialog.getByRole('button', { name: 'Tekrar dene' }).click()
  await expect(dialog.getByRole('alert')).toHaveCount(0)
  await expect(dialog.getByRole('region', { name: 'Mart 2026', exact: true })).toContainText('Veri yok')
  await expect(dialog.getByRole('region', { name: 'Mart 2026', exact: true }).locator('table')).toHaveCount(0)
  await expect(row.locator('[data-direction]')).toHaveCount(0)
})
