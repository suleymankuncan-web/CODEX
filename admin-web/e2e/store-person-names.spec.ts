import { readFileSync } from 'node:fs'
import { expect, test } from './test-fixtures'
import { createStoreAuthSession, routeStoreSurfaceApi } from './store-surfaces-api-fixtures'
import { demoStoreId } from './store-surfaces-identities'

for (const role of ['SUPER_ADMIN', 'HR_ADMIN', 'REGION_MANAGER', 'REPORT_VIEWER', 'STORE_MANAGER', 'STORE_PERSONNEL', 'VISUAL_MERCHANDISER']) {
  test(`${role} sees the saved full name across Store chrome`, async ({ page }) => {
    await page.addInitScript((roleCode) => {
      localStorage.setItem('store-ops-admin-session', JSON.stringify({ mode: 'mock', mockUserId: 'store-me-smoke-user', mockRoleCodes: roleCode, mockCompanyIds: '00000000-0000-0000-0000-000000000001', bearerToken: '' }))
    }, role)
    await routeStoreSurfaceApi(page)
    const session = createStoreAuthSession({ roleCodes: [role], readStoreIds: [demoStoreId], scopeStoreIds: [demoStoreId], actionStoreIds: [demoStoreId], legacyAssignedStoreIds: [demoStoreId], assignedStoreTypes: ['company'] })
    await page.route('**/api/auth/session', (route) => route.fulfill({ json: {
      ...session, user: { ...session.user, displayName: 'Onur Kaytan', username: 'onurkaytan' },
    } }))
    const routes = role === 'VISUAL_MERCHANDISER' ? ['/store/settings'] : ['/store', '/store/settings', '/store/checklists']
    for (const route of routes) {
      await page.goto(route)
      await expect(page.locator('.store-command-sidebar-footer')).toContainText('Onur Kaytan')
      await expect(page.locator('.store-command-sidebar-footer')).not.toContainText('onurkaytan')
    }
  })
}

test('application tab uses Axis Lufian and the original logo', async ({ page }) => {
  await page.goto('/auth/login')
  await expect(page).toHaveTitle('Axis Lufian')
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href', '/axis-lufian-favicon.png')
  const icon = await page.request.get('/axis-lufian-favicon.png')
  expect(icon.status()).toBe(200)
  expect(await icon.body()).toEqual(readFileSync(new URL('../src/assets/hr-axis-06-mark-transparent.png', import.meta.url)))
})
