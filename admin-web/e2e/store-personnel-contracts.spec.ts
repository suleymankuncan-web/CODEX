import { expect, test } from './test-fixtures'
import {
  employeeIds,
  installGenericStoreApiFallbacks,
  installStoreContractSession,
} from './store-page-contract-fixtures'

test('store personnel sees a safe denial instead of another personnel profile', async ({ page }) => {
  await installStoreContractSession(page, 'storePersonnel')
  await installGenericStoreApiFallbacks(page)
  await page.route(`**/api/reports/personnel-performance/${employeeIds[1]}**`, async (route) => {
    await route.fulfill({
      status: 403,
      json: { message: 'Forbidden' },
    })
  })

  await page.goto(`/store/personnel/${employeeIds[1]}`)

  await expect(page.getByRole('heading', { name: 'Personel profili açılamıyor' })).toBeVisible()
  await expect(page.getByText('Performans skoru')).toHaveCount(0)
})
