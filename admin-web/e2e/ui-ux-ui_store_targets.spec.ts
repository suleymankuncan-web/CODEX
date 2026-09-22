import { expect, test } from './test-fixtures'
import { installGenericStoreApiFallbacks, installStoreContractSession } from './store-page-contract-fixtures'
import { routeStoreManagerTargetCommand } from './store-targets-store-manager-command-fixtures'

test('Store Manager locks the submitted draft and period until the request settles, then preserves failed input', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-07-15T09:00:00+03:00'))
  await installStoreContractSession(page, 'storeManager')
  await installGenericStoreApiFallbacks(page)
  await routeStoreManagerTargetCommand(page)

  let releaseRequest = () => {}
  const requestGate = new Promise<void>((resolve) => { releaseRequest = resolve })
  const payloads: unknown[] = []
  await page.route('**/api/target-distributions/requests', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback()
    payloads.push(route.request().postDataJSON())
    await requestGate
    await route.fulfill({ status: 500, json: { message: 'target submission unavailable' } })
  })

  await page.goto('/store/targets')
  const total = page.getByLabel('Toplam mağaza hedefi')
  const firstDays = page.getByLabel('Derya Uslu hedef dağıtım günü')
  const secondDays = page.getByLabel('Can Erdem hedef dağıtım günü')
  const note = page.getByLabel('Onay notu', { exact: true })
  const period = page.getByRole('button', { name: 'Görüntülenen dönem', exact: true })
  const history = page.getByRole('button', { name: 'Geçmiş Hedefler', exact: true })
  await expect(page.getByText('Dağılım tamamlandı', { exact: true })).toHaveCount(0)
  await total.fill('10000000.10')
  await firstDays.fill('26')
  await secondDays.fill('26')
  await expect(page.getByText('Dağılım tamamlandı', { exact: true })).toBeVisible()
  await note.fill('Gönderilen dağılım notu.')
  const submittedRequest = page.waitForRequest((request) => request.url().endsWith('/api/target-distributions/requests') && request.method() === 'POST')
  await page.getByRole('button', { name: 'Onaya gönder', exact: true }).click()
  await submittedRequest

  try {
    await expect(total).toBeDisabled()
    await expect(firstDays).toBeDisabled()
    await expect(secondDays).toBeDisabled()
    await expect(note).toBeDisabled()
    await expect(period).toBeDisabled()
    await expect(history).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Gönderiliyor', exact: true })).toBeDisabled()
    expect(payloads).toHaveLength(1)
    expect(payloads[0]).toMatchObject({ totalTargetValue: 10000000.1, requestReason: 'Gönderilen dağılım notu.' })
  } finally {
    releaseRequest()
  }

  await expect(page.locator('.hr-axis-toast__title')).toHaveText('target submission unavailable')
  await expect(total).toBeEnabled()
  await expect(firstDays).toBeEnabled()
  await expect(note).toBeEnabled()
  await expect(period).toBeEnabled()
  await expect(history).toBeEnabled()
  await expect(total).toHaveValue('10000000.10')
  await expect(firstDays).toHaveValue('26')
  await expect(secondDays).toHaveValue('26')
  await expect(note).toHaveValue('Gönderilen dağılım notu.')
  await expect(page.getByRole('button', { name: 'Onaya gönder', exact: true })).toBeEnabled()
})

for (const width of [700, 1024]) {
  test(`Store Manager allocation columns stay inside their clipping surface at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 844 })
    await page.clock.setFixedTime(new Date('2026-07-15T09:00:00+03:00'))
    await installStoreContractSession(page, 'storeManager')
    await installGenericStoreApiFallbacks(page)
    await routeStoreManagerTargetCommand(page)
    await page.goto('/store/targets')
    const row = page.locator('.target-store-allocation-row').first()
    await expect(row).toBeVisible()
    const bounds = await row.evaluate((element) => {
      const surface = element.closest('.target-store-distribution')!
      const surfaceBounds = surface.getBoundingClientRect()
      const lastColumnBounds = element.lastElementChild!.getBoundingClientRect()
      return {
        surfaceLeft: surfaceBounds.left,
        surfaceRight: surfaceBounds.right,
        lastColumnLeft: lastColumnBounds.left,
        lastColumnRight: lastColumnBounds.right,
      }
    })
    expect(bounds.lastColumnLeft).toBeGreaterThanOrEqual(bounds.surfaceLeft)
    expect(bounds.lastColumnRight).toBeLessThanOrEqual(bounds.surfaceRight + 1)
    await page.screenshot({ path: testInfo.outputPath(`targets-${width}.png`), fullPage: true })
  })
}
