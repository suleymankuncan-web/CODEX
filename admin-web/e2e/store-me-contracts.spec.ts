import { expect, test } from './test-fixtures'
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
