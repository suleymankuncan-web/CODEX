import { expect, test } from './test-fixtures'
import {
  installGenericStoreApiFallbacks,
  installStoreContractSession,
} from './store-page-contract-fixtures'

test('tasks queue uses sortable command-canvas result headers', async ({ page }) => {
  await installStoreContractSession(page, 'regionManager')
  await installGenericStoreApiFallbacks(page)

  await page.goto('/store/tasks')

  const panel = page.getByTestId('store-action-plans-panel')
  await expect(panel.getByRole('button', { name: /^Tarih:/ })).toBeVisible()
  await expect(panel.getByRole('button', { name: /^Mağaza:/ })).toBeVisible()
  await expect(panel.getByRole('button', { name: /^Kaynak:/ })).toBeVisible()
  await expect(panel.getByText('Atanma', { exact: true })).toHaveCount(0)
  await expect(panel.getByRole('columnheader', { name: 'Süre', exact: true })).toHaveCount(0)
})
