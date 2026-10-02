import { expect, test } from './test-fixtures'
import { expectNoCriticalAxeViolations } from './axe-test-utils'
import { setStoredLocale } from './locale-test-utils'
import { installGenericStoreApiFallbacks, installStoreContractSession } from './store-page-contract-fixtures'
import { createStoreKpiHighlightsFixture, routeKpiContractApi } from './store-kpis-contract-fixtures'

test('GSM summary keeps the actual percentage and accessible details across Store viewports and languages', async ({ page }, testInfo) => {
  await installStoreContractSession(page, 'storeManager')
  await installGenericStoreApiFallbacks(page)
  await routeKpiContractApi(page)
  await page.route('**/api/reports/store-kpi-highlights**', async route => {
    const fixture = createStoreKpiHighlightsFixture()
    await route.fulfill({ json: { ...fixture, metrics: fixture.metrics.map(metric => metric.code === 'gsm_approval' ? { ...metric, actualValue: 40.25 } : metric) } })
  })
  await page.goto('/store/kpis?periodStart=2026-07-01')
  const summary = page.getByRole('group', { name: 'Mağaza KPI özeti', exact: true })
  for (const [width, height] of [[1440, 900], [1024, 768], [390, 844], [360, 800]]) {
    await page.setViewportSize({ width, height })
    await expect(summary.getByRole('button', { name: 'Mağaza GSM detaylarını aç', exact: true })).toHaveText('%40,25')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    if (width >= 768) {
      if (width === 1024) await expect(page.getByRole('columnheader', { name: 'Gerçekleşen', exact: true })).toHaveCSS('text-transform', 'none')
      const actualCell = page.getByRole('region', { name: 'Mağaza KPI değerleri', exact: true }).getByRole('row', { name: /Hedef Gerçekleşme/ }).getByRole('cell').nth(1)
      const cellBounds = await actualCell.boundingBox()
      const valueBounds = await actualCell.getByRole('button').boundingBox()
      expect(valueBounds!.x).toBeGreaterThanOrEqual(cellBounds!.x)
      expect(valueBounds!.x + valueBounds!.width).toBeLessThanOrEqual(cellBounds!.x + cellBounds!.width)
    }
    await page.screenshot({ path: testInfo.outputPath(`store-kpi-gsm-${width}.png`), fullPage: true })
  }
  await expectNoCriticalAxeViolations(page)
  await setStoredLocale(page, 'en')
  const englishSummary = page.getByRole('group', { name: 'Store KPI summary', exact: true })
  await expect(englishSummary.getByRole('button', { name: 'Store GSM details', exact: true })).toHaveText('%40.25')
  await englishSummary.getByRole('button', { name: 'Store GSM details', exact: true }).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('GSM summary and details preserve legacy versioned metric codes without inventing a score', async ({ page }) => {
  await installStoreContractSession(page, 'storeManager')
  await installGenericStoreApiFallbacks(page)
  const fixture = createStoreKpiHighlightsFixture()
  await routeKpiContractApi(page, { highlightResponse: { ...fixture, metrics: fixture.metrics.map(metric => metric.code === 'gsm_approval' ? { ...metric, code: 'GSM_ONAY' } : metric) } })
  await page.goto('/store/kpis?periodStart=2026-07-01')
  const summary = page.getByRole('group', { name: 'Mağaza KPI özeti', exact: true })
  await expect(summary.getByRole('button', { name: 'Mağaza GSM detaylarını aç', exact: true })).toHaveText('%40')
  await expect(page.getByRole('row', { name: /GSM Onayı/ })).toContainText('2,00 puan')
  await summary.getByRole('button', { name: 'Mağaza GSM detaylarını aç', exact: true }).click()
  await expect(page.getByRole('dialog').locator('.manager-kpi-summary [data-slot="card-title"]').first()).toHaveText('%40')
})
