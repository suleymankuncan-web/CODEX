import { expect, test, type Locator, type Page } from './test-fixtures'
import { expectNoCriticalAxeViolations } from './axe-test-utils'
import { routeAuthManagementApi, lookupsFixture, usersFixture, emptyList } from './auth-management-test-fixtures'
import { routeMasterDataControlApi } from './master-data-control-test-fixtures'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem('store-ops-admin-session', JSON.stringify({
    mode: 'mock', mockUserId: 'admin-modal-user', mockRoleCodes: 'SUPER_ADMIN,HR_ADMIN',
    mockCompanyIds: 'company-1', bearerToken: '',
  })))
  await routeAuthManagementApi(page)
  await page.route('**/api/auth/user-permission-assignments?**', route => route.fulfill({ json: emptyList }))
  await routeMasterDataControlApi(page)
  await page.route('**/api/integrations/master-data-bootstrap/batches?**', route => route.fulfill({ json: emptyList }))
})

for (const viewport of [
  { width: 1440, height: 900 }, { width: 1024, height: 768 },
  { width: 390, height: 844 }, { width: 360, height: 800 },
]) {
  test(`Auth forms keep actions reachable at ${viewport.width}x${viewport.height}`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport)
    await longAuthMetadata(page)
    await page.goto('/admin/auth')
    const opener = page.getByRole('button', { name: 'Kullanıcı ekle', exact: true })
    await opener.click()
    const create = page.getByRole('dialog', { name: 'Kullanıcı ekle', exact: true })
    await assertBoundedModal(page, create)
    await create.getByRole('button', { name: 'Kapat', exact: true }).click()
    await expect(opener).toBeFocused()

    const editOpener = page.getByRole('button', { name: 'Bilgileri düzenle' })
    await editOpener.click()
    const edit = page.getByRole('dialog', { name: 'Kullanıcı bilgilerini düzenle' })
    await assertBoundedModal(page, edit)
    await page.keyboard.press('Escape')
    await expect(editOpener).toBeFocused()

    await page.getByRole('button', { name: 'Rol ekle', exact: true }).click()
    const role = page.getByRole('dialog', { name: 'Rol ekle', exact: true })
    await role.getByLabel('Rol', { exact: true }).click()
    await page.getByRole('option', { name: 'Mağaza müdürü', exact: true }).click()
    await role.getByLabel('Rol mağazası').click()
    await page.getByRole('option').first().click()
    await assertBoundedModal(page, role)
    await page.keyboard.press('Escape')

    const storeOpener = page.getByRole('button', { name: 'Mağaza ekle', exact: true })
    await storeOpener.click()
    const stores = page.getByRole('dialog', { name: 'Mağaza erişimi ekle' })
    const options = stores.getByLabel('Mağaza seçim listesi').getByRole('button')
    for (let index = 0; index < 6; index++) await options.nth(index).click()
    await expect(stores.getByLabel('Seçilen mağazalar').getByRole('button')).toHaveCount(6)
    await assertBoundedModal(page, stores)
    expect(await stores.getByLabel('Mağaza seçim listesi').evaluate(element => element.scrollHeight > element.clientHeight)).toBe(true)
    await stores.screenshot({ path: testInfo.outputPath(`auth-stores-${viewport.width}.png`) })
    await stores.getByRole('button', { name: 'Vazgeç' }).click()
    await expect(storeOpener).toBeFocused()
  })

  test(`Master forms scroll only their body at ${viewport.width}x${viewport.height}`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport)
    await page.goto('/admin/master-data')
    const main = page.getByRole('main')
    await main.getByRole('button', { name: 'Mağaza ekle', exact: true }).click()
    const store = page.getByRole('dialog', { name: 'Mağaza ekle', exact: true })
    for (let index = 0; index < 8; index++) await store.getByRole('button', { name: 'E-posta ekle' }).click()
    const email = store.getByLabel('Mağaza e-posta adresi 8')
    await email.fill('long-store-contact-address@example.com')
    await assertBoundedModal(page, store, true)
    await store.screenshot({ path: testInfo.outputPath(`master-emails-${viewport.width}.png`) })
    await store.getByRole('button', { name: 'Vazgeç' }).click()
    await main.getByRole('tab', { name: 'Personel', exact: true }).click()
    const opener = main.getByRole('button', { name: 'Personel girişi', exact: true })
    await opener.click()
    const entry = page.getByRole('dialog', { name: 'Personel girişi', exact: true })
    await assertBoundedModal(page, entry, viewport.width < 640)
    await entry.screenshot({ path: testInfo.outputPath(`personnel-entry-${viewport.width}.png`) })
    await page.keyboard.press('Escape')
    await expect(opener).toBeFocused()
  })
}

test('short mobile form traps keyboard focus and connects labels, hints and errors', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 568 })
  await page.goto('/admin/master-data')
  await page.getByRole('tab', { name: 'Personel', exact: true }).click()
  const opener = page.getByRole('button', { name: 'Personel girişi', exact: true })
  await opener.click()
  const dialog = page.getByRole('dialog', { name: 'Personel girişi', exact: true })
  await assertBoundedModal(page, dialog, true)
  await dialog.locator('label').filter({ hasText: /^Ad$/ }).click()
  await expect(dialog.getByLabel('Ad', { exact: true })).toBeFocused()
  const nationalId = dialog.getByLabel('T.C. kimlik numarası')
  await nationalId.fill('123')
  await expect(nationalId).toHaveAttribute('aria-invalid', 'true')
  await expect(nationalId).toHaveAccessibleDescription(/11 haneli.*Geçerli bir T.C./)
  await dialog.locator('label').filter({ hasText: /^Mağaza$/ }).click()
  await expect(page.getByRole('combobox', { name: 'Mağaza ara' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(dialog.getByRole('combobox', { name: 'Mağaza seç' })).toBeFocused()
  for (let index = 0; index < 20; index++) {
    await page.keyboard.press('Tab')
    expect(await dialog.evaluate(element => element.contains(document.activeElement))).toBe(true)
  }
  await expectNoCriticalAxeViolations(page)
  await page.keyboard.press('Escape')
  await expect(opener).toBeFocused()
})

test('short Auth form keeps the provider selector and helpers usable', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 360, height: 568 })
  await page.goto('/admin/auth')
  const opener = page.getByRole('button', { name: 'Kullanıcı ekle', exact: true })
  await opener.click()
  const dialog = page.getByRole('dialog', { name: 'Kullanıcı ekle', exact: true })
  await dialog.locator('label').filter({ hasText: /^Kullanıcı adı$/ }).click()
  await expect(dialog.getByLabel('Kullanıcı adı', { exact: true })).toBeFocused()
  await expect(dialog.getByLabel('Kullanıcı adı', { exact: true })).toHaveAccessibleDescription(/Giriş adı boşluk içermez/)
  await dialog.locator('label').filter({ hasText: /^Kimlik sağlayıcı$/ }).click()
  await expect(page.getByRole('listbox')).toBeVisible()
  await expect(page.getByRole('option', { name: 'Yerel', exact: true })).toHaveCSS('min-height', '44px')
  await page.getByRole('option', { name: 'Yerel', exact: true }).click()
  await dialog.getByLabel('Sağlayıcı kullanıcı kimliği').fill('synthetic-provider-subject')
  await assertBoundedModal(page, dialog, true)
  await dialog.screenshot({ path: testInfo.outputPath('auth-create-short-mobile.png') })
  await page.mouse.click(4, 4)
  await expect(dialog).toBeHidden()
  await expect(opener).toBeFocused()
})

test('long capability text wraps and decisions stay reachable on a short phone', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 360, height: 568 })
  await longAuthMetadata(page)
  await page.route('**/api/auth/role-assignments?**', route => route.fulfill({ json: {
    ...emptyList, items: [{ assignmentId: 'viewer-assignment', roleCode: 'REPORT_VIEWER', roleName: 'Viewer',
      userId: 'user-active', scopeType: 'company', companyId: 'company-1', regionId: null, storeId: null,
      active: true, effectiveFrom: null, effectiveTo: null }],
  } }))
  await page.route('**/api/auth/permissions', route => route.fulfill({ json: {
    ...emptyList, items: [{ permissionId: 'permission-sales-director', permissionCode: 'INCENTIVE_SALES_DIRECTOR_APPROVAL',
      resourceName: 'incentive', actionName: 'approve_sales_director', description: 'Sales Director approval' }],
  } }))
  await page.goto('/admin/auth')
  const opener = page.getByRole('button', { name: 'Yetki ekle', exact: true })
  await opener.click()
  const dialog = page.getByRole('dialog', { name: 'Kişisel yetki ekle' })
  await dialog.getByLabel('Yetkinin bağlı olduğu rol').click()
  await page.getByRole('option', { name: /Rapor görüntüleyici/ }).click()
  await dialog.getByLabel('Kişisel yetki', { exact: true }).click()
  await page.getByRole('option', { name: /Bölge Müdürü prim paketlerini/ }).click()
  expect((await dialog.getByLabel('Kişisel yetki', { exact: true }).boundingBox())!.height).toBeGreaterThan(44)
  await dialog.getByLabel('Yetki gerekçesi').fill('Synthetic sales director responsibility')
  await assertBoundedModal(page, dialog, true)
  await dialog.screenshot({ path: testInfo.outputPath('auth-capability-short-mobile.png') })
  await page.keyboard.press('Escape')
  await expect(opener).toBeFocused()
})

test('successful save restores its opener, and a removed opener falls back to main', async ({ page }) => {
  await page.goto('/admin/auth')
  await page.route('**/api/auth/users', route => route.fulfill({ status: 201, json: {
    command: { status: 'created' }, data: { user: { ...usersFixture.items[0], userId: 'created-user' } },
  } }))
  const opener = page.getByRole('button', { name: 'Kullanıcı ekle', exact: true })
  await opener.click()
  const dialog = page.getByRole('dialog', { name: 'Kullanıcı ekle', exact: true })
  await dialog.getByLabel('Ad', { exact: true }).fill('Test')
  await dialog.getByLabel('Soyad', { exact: true }).fill('Person')
  await dialog.getByLabel('Kullanıcı adı', { exact: true }).fill('test.person')
  await dialog.getByLabel('E-posta', { exact: true }).fill('test.person@example.com')
  await dialog.getByRole('button', { name: 'Oluştur', exact: true }).click()
  await expect(dialog).toBeHidden()
  await expect(opener).toBeFocused()

  await page.getByRole('button', { name: 'Devre dışı bırak', exact: true }).click()
  const confirm = page.getByRole('dialog', { name: 'Hesap devre dışı bırakılsın mı?' })
  await page.route('**/api/auth/users/user-active/deactivate', async route => {
    await page.route('**/api/auth/users?**', next => next.fulfill({ json: { ...usersFixture, items: [], meta: { ...usersFixture.meta, total: 0, count: 0 } } }))
    await route.fulfill({ json: { command: { status: 'deactivated' }, data: { accessClosure: {} } } })
  })
  await confirm.getByRole('button', { name: 'Devre dışı bırak', exact: true }).click()
  await expect(confirm).toBeHidden()
  await expect(page.getByRole('main')).toBeFocused()
})

async function longAuthMetadata(page: Page) {
  await page.route('**/api/auth/users?**', route => route.fulfill({ json: {
    ...usersFixture, items: [{ ...usersFixture.items[0], username: 'long.synthetic.account.'.repeat(4) }],
  } }))
  await page.route('**/api/auth/lookups', route => route.fulfill({ json: {
    ...lookupsFixture, stores: Array.from({ length: 20 }, (_, index) => ({
      ...lookupsFixture.stores[0], storeId: `store-${index}`, storeCode: `S${index}`,
      storeName: `Uzun mağaza adı ${index} ${'Mağaza tanımı '.repeat(7)}`,
    })),
  } }))
}

async function assertBoundedModal(page: Page, dialog: Locator, mustScroll = false) {
  const viewport = page.viewportSize()!
  await expect(dialog).toBeVisible()
  const header = dialog.locator('[data-slot="dialog-header"]')
  const footer = dialog.locator('[data-slot="dialog-footer"]')
  const body = dialog.locator('[data-admin-dialog-body]')
  await expect(footer).toBeVisible()
  const bounds = await dialog.boundingBox()
  expect(bounds!.y).toBeGreaterThanOrEqual(15)
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height - 15)
  expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
  expect(await body.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
  if (mustScroll) expect(await body.evaluate(element => element.scrollHeight > element.clientHeight)).toBe(true)
  const before = { header: await header.boundingBox(), footer: await footer.boundingBox() }
  await body.evaluate(element => { element.scrollTop = element.scrollHeight })
  expect((await header.boundingBox())!.y).toBeCloseTo(before.header!.y, 0)
  expect((await footer.boundingBox())!.y).toBeCloseTo(before.footer!.y, 0)
  const buttons = footer.getByRole('button').or(dialog.getByRole('button', { name: 'Kapat', exact: true }))
  for (const button of await buttons.all()) {
    const box = await button.boundingBox()
    const minimum = viewport.width < 640 || await button.getAttribute('data-slot') === 'dialog-close' ? 44 : 40
    expect(box!.height).toBeGreaterThanOrEqual(minimum)
    expect(box!.width).toBeGreaterThanOrEqual(44)
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height - 15)
  }
}
