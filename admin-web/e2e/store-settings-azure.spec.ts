import AxeBuilder from '@axe-core/playwright'
import { expect, test } from './test-fixtures'
import { installGenericStoreApiFallbacks, installStoreContractSession } from './store-page-contract-fixtures'

for (const persona of ['regionManager', 'storeManager', 'reportViewer'] as const) {
  for (const width of [1440, 320]) {
    test(`settings preserves identity, account boundaries and sections for ${persona} at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      await installStoreContractSession(page, persona)
      await installGenericStoreApiFallbacks(page)
      const writes: string[] = []
      page.on('request', request => {
        const path = new URL(request.url()).pathname
        // The shell preloads acknowledgements through this read-only POST endpoint.
        const acknowledgementRead = request.method() === 'POST' && path === '/api/checklists/acknowledgements/list'
        if (path.startsWith('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(request.method()) && !acknowledgementRead) writes.push(request.url())
      })
      await page.goto('/store/settings?section=profile')
      const surface = page.getByTestId('store-settings-page')
      await expect(surface.getByRole('heading', { name: 'Profil ve ayarlar' })).toBeVisible()
      await expect(surface.getByText(`${persona}@example.test`, { exact: true })).toBeVisible()
      await expect(surface.getByRole('tab', { name: 'Profil', exact: true })).toHaveAttribute('aria-selected', 'true')
      await expect(surface.getByRole('button', { name: 'Hesap yönetimi kullanılamıyor' })).toBeDisabled()
      await expect(surface.getByRole('textbox')).toHaveCount(0)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
      await expect(surface.locator('.operations-header')).toBeVisible()
      const accessibility = await new AxeBuilder({ page }).include('[data-testid="store-settings-page"]').analyze()
      expect(accessibility.violations).toEqual([])
      await surface.getByRole('tab', { name: 'Tercihler', exact: true }).click()
      await expect(page).toHaveURL(/section=preferences/)
      await expect(surface.getByRole('heading', { name: 'Uygulama tercihleri' })).toBeVisible()
      await surface.getByRole('radio', { name: 'İngilizceye geç' }).click()
      await expect(surface.getByRole('heading', { name: 'Application preferences' })).toBeVisible()
      expect(await page.evaluate(() => localStorage.getItem('store-ops-app-locale'))).toBe('en')
      await page.reload()
      await expect(surface.getByRole('tab', { name: 'Preferences', exact: true })).toHaveAttribute('aria-selected', 'true')
      await surface.getByRole('tab', { name: 'Security', exact: true }).click()
      await expect(page).toHaveURL(/section=security/)
      await expect(surface.getByRole('link', { name: 'Sign out', exact: true })).toHaveAttribute('href', '/auth/logout')
      await expect(surface.getByRole('tabpanel').getByRole('button', { name: 'Account management unavailable' })).toBeDisabled()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
      expect(writes).toEqual([])
    })
  }
}

test('settings deep links keep accessible keyboard tabs and unknown sections fall back to profile', async ({ page }) => {
  await installStoreContractSession(page, 'storeManager')
  await installGenericStoreApiFallbacks(page)
  await page.goto('/store/settings?section=security')
  const security = page.getByRole('tab', { name: 'Güvenlik', exact: true })
  await expect(security).toHaveAttribute('aria-selected', 'true')
  await security.focus()
  await page.keyboard.press('ArrowLeft')
  await expect(page.getByRole('tab', { name: 'Tercihler', exact: true })).toBeFocused()
  await expect(page).toHaveURL(/section=preferences/)
  await page.goto('/store/settings?section=unknown')
  await expect(page.getByRole('tab', { name: 'Profil', exact: true })).toHaveAttribute('aria-selected', 'true')
})
