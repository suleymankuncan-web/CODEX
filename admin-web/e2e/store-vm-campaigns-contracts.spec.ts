import { expect, test } from './test-fixtures'
import { createStoreContractSession, installStoreContractSession, type StoreContractPersona } from './store-page-contract-fixtures'
import { expectNoCriticalAxeViolations } from './axe-test-utils'

// Retired Store pages must stay inaccessible even with publisher/admin privileges.
// Admin-side competition workflows are tested separately and remain enabled.
for (const persona of ['regionManager', 'storeManager', 'storePersonnel', 'visualMerchandiser', 'reportViewer', 'superAdmin'] as const) {
  test(`retired Store pages deny ${persona}, omit navigation and never load feature data`, async ({ page }) => {
    const source: StoreContractPersona = persona === 'superAdmin' ? 'reportViewer' : persona
    const options = persona === 'superAdmin' ? { roleCodes: ['SUPER_ADMIN'] } : undefined
    await installStoreContractSession(page, source, options)
    if (persona === 'visualMerchandiser') {
      const session = createStoreContractSession(source)
      await page.unroute('**/api/auth/session')
      await page.route('**/api/auth/session', route => route.fulfill({ json: {
        ...session, user: { ...session.user, permissionScopes: { VM_REFERENCE_PUBLISHER: { companyIds: session.user.scope.companyIds } } },
      } }))
    }
    const featureRequests: string[] = []
    page.on('request', request => {
      if (/\/api\/(competitions|mobile\/visual-campaigns|visual-merchandising|visual-comparisons)/.test(new URL(request.url()).pathname)) featureRequests.push(request.url())
    })
    await page.setViewportSize({ width: persona === 'storePersonnel' ? 360 : 1440, height: 900 })
    for (const path of ['/store/visual-campaigns', '/store/competitions']) {
      await page.goto(path)
      await expect(page.getByRole('heading', { name: /Bu rol için rota kullanılamaz|Route not available/i })).toBeVisible()
      await expect(page.locator('.store-command-nav a[href="/store/visual-campaigns"]')).toHaveCount(0)
      await expect(page.locator('.store-command-nav a[href="/store/competitions"]')).toHaveCount(0)
      await page.reload()
      await expect(page.getByRole('heading', { name: /Bu rol için rota kullanılamaz|Route not available/i })).toBeVisible()
    }
    expect(featureRequests).toEqual([])
    await expectNoCriticalAxeViolations(page)
  })
}
