import { expect, test } from './test-fixtures'
import {
  installGenericStoreApiFallbacks,
  installStoreContractSession,
} from './store-page-contract-fixtures'

test('region manager can compose a plain feed post', async ({ page }) => {
  await installStoreContractSession(page, 'regionManager')
  await installGenericStoreApiFallbacks(page)

  await page.goto('/store/feed')

  await expect(page.getByPlaceholder('Ne paylaşmak istersin?')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sabitle' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Paylaş' })).toBeVisible()
})

test('store manager reads feed posts without composer controls', async ({ page }) => {
  await installStoreContractSession(page, 'storeManager')
  await installGenericStoreApiFallbacks(page)

  await page.goto('/store/feed')

  await expect(page.getByPlaceholder('Ne paylaşmak istersin?')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Paylaş' })).toHaveCount(0)
  await expect(page.getByTestId('store-feed-post-row').first()).toBeVisible()
})
