import { expect, test, type Page } from './test-fixtures'
import { expectNoCriticalAxeViolations } from './axe-test-utils'
import { pressTabFromDocumentStart } from './keyboard-test-utils'
import { routeMasterDataControlApi } from './master-data-control-test-fixtures'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'store-ops-admin-session',
      JSON.stringify({
        mode: 'mock',
        mockUserId: 'master-data-surface-user',
        mockRoleCodes: 'SUPER_ADMIN,HR_ADMIN',
        mockCompanyIds: '00000000-0000-0000-0000-000000000001',
        bearerToken: '',
      }),
    )
  })
  await page.route('**/api/auth/session', (route) => route.fulfill({ json: authSessionFixture }))
  await routeMasterDataControlApi(page)
})

test('master data exposes the current store and personnel management surface', async ({ page }) => {
  await page.goto('/admin/master-data')

  const main = page.getByRole('main')
  await expect(main.getByRole('heading', { name: 'Mağaza ve personel' })).toBeVisible()
  await expect(main.getByRole('tab', { name: 'Mağazalar' })).toHaveAttribute('aria-selected', 'true')
  await expect(main.getByRole('tab', { name: 'Personel' })).toBeVisible()
  await expect(main.getByRole('table', { name: 'Mağazalar' })).toContainText('Eda Doğanay')
  await expect(main).not.toContainText('onprem.region-manager')
  await expect(main).not.toContainText('Ana Veri Kontrolü')
  await main.getByRole('tab', { name: 'Personel' }).click()
  const personnelTable = main.getByRole('table', { name: 'Personel' })
  await expect(personnelTable.getByRole('columnheader', { name: 'Kullanıcı hesabı' })).toBeVisible()
  await expect(personnelTable.getByText('Aktif', { exact: true }).first()).toBeVisible()
  await expect(personnelTable.getByText('Hazırlanıyor', { exact: true }).first()).toBeVisible()
  await expect(personnelTable.getByText('Hesap yok', { exact: true }).first()).toBeVisible()
  await expect(main.getByRole('region', { name: 'Satışlarda görülen personeller' })).toHaveCount(0)
  await expectNoHorizontalOverflow(page)
})

test('admin shell skip link moves focus to the main landmark', async ({ page }) => {
  await page.goto('/admin/master-data')

  const main = page.getByRole('main')
  const skipLink = page.getByRole('link', { name: 'Ana içeriğe geç' })
  await pressTabFromDocumentStart(page, skipLink)
  await expect(skipLink).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(main).toBeFocused()
  await expect(main).toHaveAttribute('id', 'application-main-content')
})

test('loaded master data management state has no critical WCAG violations', async ({ page }) => {
  await page.goto('/admin/master-data')
  await expect(page.getByRole('heading', { name: 'Mağaza ve personel' })).toBeVisible()

  await expectNoCriticalAxeViolations(page)
})

test('master data management stays mobile-safe', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/admin/master-data')

  const main = page.getByRole('main')
  await expect(main.getByRole('heading', { name: 'Mağaza ve personel' })).toBeVisible()
  await expect(main.getByRole('table', { name: 'Mağazalar' })).toHaveCount(0)
  await expect(main.getByRole('button').filter({ hasText: 'Eda Doğanay' }).first()).toBeVisible()
  await expectNoHorizontalOverflow(page)
})

test('store contact rows keep focus while typing and remain removable', async ({ page }) => {
  await page.goto('/admin/master-data')
  await page.getByRole('button', { name: 'Accepted personnel baseline mağazasını düzenle' }).click()
  const dialog = page.getByRole('dialog', { name: 'Mağazayı düzenle' })
  const existingEmail = dialog.getByLabel('Mağaza e-posta adresi 1')
  await existingEmail.fill('')
  await existingEmail.pressSequentially('typed@example.com')
  await expect(existingEmail).toBeFocused()
  await expect(existingEmail).toHaveValue('typed@example.com')
  await dialog.getByRole('button', { name: 'E-posta ekle' }).click()
  const secondEmail = dialog.getByLabel('Mağaza e-posta adresi 2')
  await secondEmail.pressSequentially('ops@example.com')
  await expect(secondEmail).toBeFocused()
  await dialog.getByRole('button', { name: /E-posta 2 adresini kaldır/ }).click()
  await expect(dialog.getByLabel('Mağaza e-posta adresi 2')).toHaveCount(0)
})

async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth))
    .toBe(true)
}

const authSessionFixture = {
  authMode: 'mock',
  authenticated: true,
  user: {
    userId: 'master-data-surface-user',
    employeeId: null,
    roleCodes: ['SUPER_ADMIN', 'HR_ADMIN'],
    scope: { companyIds: ['00000000-0000-0000-0000-000000000001'], regionIds: [], storeIds: [] },
    readScope: { companyIds: ['00000000-0000-0000-0000-000000000001'], regionIds: [], storeIds: [] },
    actionScope: { assignedStoreIds: [] },
    assignedStoreIds: [],
  },
  scopeSummary: { companyCount: 1, regionCount: 0, storeCount: 0, assignedStoreCount: 0 },
}
