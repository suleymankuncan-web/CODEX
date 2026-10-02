import { expect, test } from './test-fixtures'
import { routeAuthManagementApi, usersFixture } from './auth-management-test-fixtures'

test('failed profile sync can be retried and the pending badge refreshes through completion', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.addInitScript(() => {
    localStorage.setItem('store-ops-admin-session', JSON.stringify({ mode: 'mock',
      mockUserId: 'super-admin-auth-user', mockRoleCodes: 'SUPER_ADMIN,HR_ADMIN',
      mockCompanyIds: 'company-1', bearerToken: '' }))
  })
  await routeAuthManagementApi(page)
  let state = 'failed'
  let reads = 0
  let retryBody: unknown
  await page.route('**/api/auth/users?**', async (route) => {
    reads += 1
    const items = [{ ...usersFixture.items[0], firstName: 'Ada', lastName: 'Yılmaz',
      authProvider: 'oidc', identityOperation: 'update_profile', identityStatus: state }]
    await route.fulfill({ json: { items, meta: { count: 1, total: 1, limit: 10, offset: 0 } } })
    if (state === 'pending') state = 'completed'
  })
  await page.route('**/api/auth/users/user-active', async (route) => {
    expect(route.request().method()).toBe('PATCH')
    retryBody = route.request().postDataJSON()
    state = 'pending'
    await route.fulfill({ json: { command: { status: 'updated', message: 'Updated' },
      data: { user: { ...usersFixture.items[0], identityOperation: 'update_profile', identityStatus: state } } } })
  })
  await page.goto('/admin/auth')
  await expect(page.getByText('Keycloak işlemi başarısız', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Keycloak eşitlemesini yeniden dene' }).click()
  await expect(page.getByText('Güncelleniyor (Keycloak)', { exact: true })).toBeVisible()
  await expect(page.getByText('Aktif hesap', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Keycloak eşitlemesini yeniden dene' })).toHaveCount(0)
  expect(retryBody).toEqual({ username: 'store.manager' })
  expect(reads).toBeGreaterThanOrEqual(3)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})
