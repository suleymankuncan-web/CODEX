import { expect, test } from './test-fixtures'
import {
  installGenericStoreApiFallbacks,
  installStoreContractSession,
} from './store-page-contract-fixtures'

test('home keeps the compact daily operations command surface', async ({ page }) => {
  await installStoreContractSession(page, 'regionManager')
  await installGenericStoreApiFallbacks(page)

  await page.goto('/store/home')

  await expect(page.getByTestId('store-home-command')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Günlük Operasyon', exact: true })).toBeVisible()
  await expect(page.locator('.store-home-ops .sh-metric')).toHaveCount(4)
  await expect(page.getByRole('heading', { name: 'Öncelik akışı', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Duyurular', exact: true })).toBeVisible()
})
