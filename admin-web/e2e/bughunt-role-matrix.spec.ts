import { expect, test } from './test-fixtures'
import { employeeIds, installGenericStoreApiFallbacks, installStoreContractSession, type StoreContractPersona } from './store-page-contract-fixtures'

// Synthetic route health inventory; server/provider authorization is verified separately.
const common = ['home', 'feed', 'settings']
const management = [...common, 'checklists', 'rankings', 'kpis', 'approvals', 'targets', 'workforce', 'tasks', 'reports', 'personnel']
const roles: Array<{ role: string; persona: StoreContractPersona; allowed: string[] }> = [
  { role: 'SUPER_ADMIN', persona: 'reportViewer', allowed: management },
  { role: 'HR_ADMIN', persona: 'reportViewer', allowed: common },
  { role: 'REPORT_VIEWER', persona: 'reportViewer', allowed: [...management, 'incentives'] },
  { role: 'REGION_MANAGER', persona: 'regionManager', allowed: [...management, 'incentives'] },
  { role: 'STORE_MANAGER', persona: 'storeManager', allowed: [...management, 'me'] },
  { role: 'STORE_PERSONNEL', persona: 'storePersonnel', allowed: [...common, 'rankings', 'me', 'personnel'] },
  { role: 'VISUAL_MERCHANDISER', persona: 'visualMerchandiser', allowed: [...common, 'checklists'] },
]
const routes = ['home', 'checklists', 'visual-campaigns', 'tasks', 'kpis', 'me', 'personnel', 'rankings', 'feed', 'competitions', 'approvals', 'incentives', 'settings', 'targets', 'workforce', 'reports']

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  for (const { role, persona, allowed } of roles) {
    test(`${role} Store route health at ${viewport.width}px`, async ({ page }) => {
      test.setTimeout(180_000)
      await page.setViewportSize(viewport)
      const errors: string[] = []
      page.on('pageerror', error => errors.push(error.message))
      await page.route('**/api/**', route => route.fulfill({ status: 503,
        json: { message: 'Unmodeled synthetic endpoint' } }))
      await installStoreContractSession(page, persona, { roleCodes: [role] })
      await installGenericStoreApiFallbacks(page)
      for (const route of routes) {
        await test.step(route, async () => {
          await page.goto(route === 'personnel' ? `/store/personnel/${employeeIds[0]}` : `/store/${route}`)
          await expect(page.getByRole('main')).toBeVisible()
          const denied = page.getByRole('heading', { name: /rota kullan|Route not available/i })
          if (allowed.includes(route)) await expect.soft(denied).toHaveCount(0)
          else await expect.soft(denied).toBeVisible()
          await expect.soft(page.getByText('Sayfa geçişi tamamlanamadı', { exact: true })).toHaveCount(0)
          expect.soft(errors, `${role}/${route} runtime errors`).toEqual([])
          expect.soft(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 4), `${role}/${route} horizontal overflow`).toBe(true)
        })
      }
    })
  }
}
