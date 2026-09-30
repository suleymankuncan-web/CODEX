import { expect, test } from './test-fixtures'
import { installGenericStoreApiFallbacks, installStoreContractSession, storeIds } from './store-page-contract-fixtures'
import { routeReturns, returnRow } from './store-returns-fixtures'

for (const width of [1440, 1024, 390, 360]) {
  test(`KPI shows canonical net and shared dated returns at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await installStoreContractSession(page, 'storeManager')
    await installGenericStoreApiFallbacks(page)
    const reads = await routeReturns(page, { other: [
      returnRow({ returnId: 'outside-norm', category: 'out_of_norm', displayName: 'Norm Dışı Satıcı' }),
      returnRow({ returnId: 'cross-store', category: 'cross_store', displayName: 'İlk Satıcı', originalStoreCode: 'SYN-LP', originalStoreName: 'Sentetik LP Mağaza' }),
      returnRow({ returnId: 'external', direction: 'external', receivingStoreCode: 'SYN-EXTERNAL', receivingStoreName: null }),
    ] })
    await page.goto('/store/kpis')
    const summary = page.getByRole('region', { name: 'İadeler sonrası satış özeti' })
    await expect(summary).toContainText('₺1.950,00')
    await expect(summary).toContainText('-₺650,00')
    const trigger = summary.getByRole('button', { name: 'İadeler', exact: true })
    await trigger.click()
    const dialog = page.getByRole('dialog', { name: /İadeler ·/ })
    await expect(dialog.getByRole('switch')).not.toBeChecked()
    await expect(dialog.getByText('Norm Satıcısı', { exact: true })).toBeVisible()
    await expect(dialog.getByText('Mağaza İçi İade', { exact: true })).toBeVisible()
    await dialog.getByRole('switch').click()
    await expect(dialog.getByText('Norm Dışı İade', { exact: true })).toBeVisible()
    await expect(dialog.getByText('Mağaza Dışı İade', { exact: true })).toBeVisible()
    await expect(dialog.getByText('Sentetik LP Mağaza', { exact: true })).toBeVisible()
    await expect(dialog.getByText('Dış mağazada iade · Bilgi', { exact: true })).toBeVisible()
    await expect(dialog.getByText('-₺650,00', { exact: true })).toBeVisible()
    await expect.poll(() => dialog.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(2)
    expect(reads.every(url => url.searchParams.get('storeId') === storeIds[0] && url.searchParams.get('periodStart') === '2026-07-01' && url.searchParams.get('periodEnd') === '2026-07-31')).toBe(true)
    expect(reads.every(url => [...url.searchParams.keys()].every(key => ['storeId', 'periodStart', 'periodEnd', 'category', 'offset', 'limit'].includes(key)))).toBe(true)
    await dialog.getByRole('button', { name: 'İadeleri kapat' }).click()
    await expect(trigger).toBeFocused()
  })
}

test('return paging and missing-day evidence retain independent totals', async ({ page }) => {
  await installStoreContractSession(page, 'storeManager')
  await installGenericStoreApiFallbacks(page)
  const reads = await routeReturns(page, {
    inside: Array.from({ length: 51 }, (_, index) => returnRow({ returnId: `row-${index}`, displayName: `Satıcı ${index + 1}` })),
    ledger: { coverage: { expectedDays: 31, coveredDays: 30, missingDates: ['2026-07-12'], status: 'partial', unresolvedRows: 1 } },
  })
  await page.goto('/store/kpis')
  await page.getByRole('button', { name: 'İadeler', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: /İadeler ·/ })
  await expect(dialog).toContainText('Bazı günlerin verisi eksik')
  await dialog.getByText('Eksik günler', { exact: false }).click()
  await expect(dialog).toContainText('12 Tem 2026')
  await expect(dialog.locator('[data-return-id]')).toHaveCount(50)
  await dialog.getByRole('button', { name: 'Sonraki', exact: true }).click()
  await expect(dialog.getByText('Satıcı 51', { exact: true })).toBeVisible()
  await expect(dialog.locator('[data-return-id]')).toHaveCount(1)
  await expect(dialog.getByText('-₺650,00', { exact: true })).toBeVisible()
  expect(reads.some(url => url.searchParams.get('offset') === '50')).toBe(true)
})

test('a forbidden filtered response hides cached return records and totals', async ({ page }) => {
  await installStoreContractSession(page, 'storeManager')
  await installGenericStoreApiFallbacks(page)
  await routeReturns(page)
  await page.goto('/store/kpis')
  await page.getByRole('button', { name: 'İadeler', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: /İadeler ·/ })
  await expect(dialog.getByText('Norm Satıcısı', { exact: true })).toBeVisible()
  await page.route('**/api/reports/store-returns?**', route => route.fulfill({ status: 403, json: { message: 'Forbidden' } }))
  await dialog.getByRole('switch').click()
  await expect(dialog).toContainText('İadeleri görüntüleme yetkiniz yok.')
  await expect(dialog.getByText('Norm Satıcısı', { exact: true })).toHaveCount(0)
  await expect(dialog.getByText('-₺650,00', { exact: true })).toHaveCount(0)
})
