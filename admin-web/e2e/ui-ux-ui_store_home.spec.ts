import { expect, test } from './test-fixtures'
import { installGenericStoreApiFallbacks, installStoreContractSession } from './store-page-contract-fixtures'

test('home attention filter retains loading summaries until the workload is known', async ({ page }) => {
  await installStoreContractSession(page, 'storeManager')
  await installGenericStoreApiFallbacks(page)

  let releaseWorkflow = () => {}
  const workflowReady = new Promise<void>((resolve) => { releaseWorkflow = resolve })
  await page.route('**/api/workflow/inbox', async (route) => {
    await workflowReady
    await route.fulfill({ json: { items: [], meta: { count: 0, limit: 30, offset: 0, total: 0 } } })
  })

  try {
    await page.goto('/store/home')
    await expect(page.getByTestId('store-home-checklist-card').getByText('Tamam', { exact: true })).toBeVisible()
    const attention = page.getByRole('button', { name: /Dikkat bekleyen/ })
    await expect(attention.locator('strong')).toHaveText('Bekliyor')
    await expect(attention).toContainText('Yükleniyor')
    await expect(page.getByRole('heading', { name: 'Bekleyen talep yok' })).toHaveCount(0)

    await attention.click()
    await expect(attention).toHaveAttribute('aria-pressed', 'true')
    await expect(page.locator('.sh-agenda-row')).toHaveCount(1)
    await expect(page.getByRole('heading', { name: 'Talep özeti yükleniyor' })).toBeVisible()
    await expect(page.locator('.sh-dashboard-empty')).toHaveCount(0)

    releaseWorkflow()
    await expect(attention.locator('strong')).toHaveText('0')
    await expect(attention).toContainText('Gündem temiz')
    await expect(page.getByText('Bu başlıkta bekleyen iş yok', { exact: true })).toBeVisible()
  } finally {
    releaseWorkflow()
  }
})

test('home attention filter keeps a failed summary visible without declaring a clear agenda', async ({ page }) => {
  await installStoreContractSession(page, 'storeManager')
  await installGenericStoreApiFallbacks(page)
  await page.route('**/api/workflow/inbox', async (route) => {
    await route.fulfill({ status: 503, json: { message: 'Service unavailable' } })
  })

  await page.goto('/store/home')
  await expect(page.getByRole('heading', { name: 'Talep özeti açılamadı' })).toBeVisible()
  const attention = page.getByRole('button', { name: /Dikkat bekleyen/ })
  await expect(attention.locator('strong')).toHaveText('—')
  await expect(attention).toContainText('Bilgi eksik')

  await attention.click()
  await expect(page.getByRole('heading', { name: 'Talep özeti açılamadı' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Talepleri aç', exact: true })).toHaveAttribute('href', '/store/approvals')
  await expect(page.locator('.sh-dashboard-empty')).toHaveCount(0)
  await expect(attention).not.toContainText('Gündem temiz')
})
