import { expect, test } from './test-fixtures'
import {
  installGenericStoreApiFallbacks,
  installStoreContractSession,
} from './store-page-contract-fixtures'

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
