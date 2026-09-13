import { expect, test } from './test-fixtures'
import { installGenericStoreApiFallbacks, installStoreContractSession } from './store-page-contract-fixtures'
import { createTargetWorkspace, routeTargetWorkspace } from './store-targets-command-fixtures'

test('Report Viewer selects an actual manager without target rows and retains the full directory', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-07-15T09:00:00+03:00'))
  await installStoreContractSession(page, 'reportViewer')
  await installGenericStoreApiFallbacks(page)
  const api = await routeTargetWorkspace(page, 'report_viewer')
  let selected = ''
  await page.route('**/api/store/targets/workspace**', async route => {
    const url = new URL(route.request().url())
    selected = url.searchParams.get('regionManagerUserId') ?? ''
    const offset = Number(url.searchParams.get('offset') ?? '0')
    const payload = createTargetWorkspace('report_viewer', { offset })
    if (selected === 'manager-empty') {
      payload.data.companies = []
      payload.data.pagination = { total: 0, offset: 0, limit: 50, hasMore: false }
      payload.data.summary = { totalStores: 0, pendingStores: 0, approvedStores: 0, adjustedApprovedStores: 0, returnedStores: 0, missingStores: 0, totalTargetValue: '0' }
    }
    await route.fulfill({ json: payload })
  })
  await page.goto('/store/targets')
  const directory = page.getByRole('complementary', { name: 'Bölge müdürleri' })
  await expect(directory.getByText('Selin Yılmaz')).toBeVisible()
  await directory.getByRole('button', { name: /Selin Yılmaz/ }).click()
  await expect(page.getByText('Yetkili hedef kaydı bulunamadı')).toBeVisible()
  expect(selected).toBe('manager-empty')
  await expect(directory.getByText('Süleyman Öztürk')).toBeVisible()
  await expect(directory.getByText('Deniz Akar')).toBeVisible()
  await directory.getByRole('button', { name: /Tüm mağazalar/ }).click()
  await expect(page.getByText('Mall of İstanbul').first()).toBeVisible()
  await expect(directory.getByRole('button', { name: /Tüm mağazalar/ })).toHaveAttribute('aria-current', 'true')
  expect(api.mutations).toEqual([])
})

test('directory failure retains target records and offers recovery', async ({ page }) => {
  await installStoreContractSession(page, 'reportViewer')
  await installGenericStoreApiFallbacks(page)
  await routeTargetWorkspace(page, 'report_viewer')
  await page.route('**/api/org/region-managers', route => route.fulfill({ status: 503, json: { message: 'Unavailable' } }))
  await page.goto('/store/targets')
  await expect(page.getByText('Bölge müdürleri yüklenemedi.')).toBeVisible()
  await expect(page.getByText('Mall of İstanbul').first()).toBeVisible()
  await expect(page.getByRole('alert').getByRole('button', { name: 'Tekrar dene' })).toBeVisible()
})
