import { expect, test, type Page } from './test-fixtures'
import { expectNoCriticalAxeViolations } from './axe-test-utils'
import { routeMasterDataControlApi } from './master-data-control-test-fixtures'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'store-ops-admin-session',
      JSON.stringify({
        mode: 'mock',
        mockUserId: '10000000-0000-4000-8000-000000000099',
        mockRoleCodes: 'SUPER_ADMIN,HR_ADMIN,INTEGRATION_ADMIN',
        mockCompanyIds: '10000000-0000-4000-8000-000000000001',
        bearerToken: '',
      }),
    )
  })
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({ json: authSessionFixture })
  })
})

test('master data uses region-manager identities and exposes direct personnel entry', async ({ page }, testInfo) => {
  await routeMasterDataControlApi(page)
  let createStoreBody: Record<string, unknown> | null = null
  let updateStoreBody: Record<string, unknown> | null = null
  let createPersonnelBody: Record<string, unknown> | null = null
  let updatePersonnelBody: Record<string, unknown> | null = null
  await page.route('**/api/integrations/store-master', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback()
    createStoreBody = route.request().postDataJSON()
    await route.fulfill({
      status: 201,
      json: {
        command: { status: 'created', message: 'Store created' },
        data: { storeMaster: {} },
      },
    })
  })
  await page.route('**/api/integrations/store-master/*', async (route) => {
    if (route.request().method() !== 'PATCH') return route.fallback()
    updateStoreBody = route.request().postDataJSON()
    await route.fulfill({
      json: {
        command: { status: 'updated', message: 'Store updated' },
        data: { storeMaster: {} },
      },
    })
  })

  await page.route('**/api/integrations/personnel-master', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback()
    createPersonnelBody = route.request().postDataJSON()
    await route.fulfill({
      status: 201,
      json: {
        command: { status: 'created', message: 'Personnel created' },
        data: { personnelMaster: {} },
      },
    })
  })
  await page.route('**/api/integrations/personnel-master/*', async (route) => {
    if (route.request().method() !== 'PATCH' || route.request().url().endsWith('/terminate')) return route.fallback()
    updatePersonnelBody = route.request().postDataJSON()
    await route.fulfill({
      json: {
        command: { status: 'updated', message: 'Personnel updated' },
        data: { personnelMaster: {} },
      },
    })
  })

  await page.goto('/admin/master-data')
  const main = page.getByRole('main')
  await expect(main.getByRole('heading', { name: 'Mağaza ve personel' })).toBeVisible()
  await expect(main.getByRole('table', { name: 'Mağazalar' })).toContainText('Eda Doğanay')
  await expect(main).not.toContainText('onprem.region-manager')
  await expect(main).not.toContainText('Pilot Bolgesi')
  await expect(main.getByRole('tab', { name: 'Mağazalar' })).toHaveAttribute('aria-selected', 'true')
  await expect(main.getByRole('button', { name: 'Mağaza ekle' })).toHaveCSS('background-color', 'rgb(50, 93, 175)')
  const firstStoreRowHeight = await main.getByRole('table', { name: 'Mağazalar' }).locator('tbody tr').first().evaluate((row) => row.getBoundingClientRect().height)
  expect(firstStoreRowHeight).toBeGreaterThanOrEqual(56)
  expect(firstStoreRowHeight).toBeLessThanOrEqual(72)
  await expect(main).toContainText('1-20 / 25 mağaza')
  await expect(main.getByRole('table', { name: 'Mağazalar' }).locator('tbody tr')).toHaveCount(20)
  await main.getByRole('button', { name: 'Sonraki mağaza sayfası' }).click()
  await expect(main).toContainText('21-25 / 25 mağaza')
  await main.getByRole('button', { name: 'Önceki mağaza sayfası' }).click()

  await main.getByRole('button', { name: 'Mağaza ekle' }).click()
  const dialog = page.getByRole('dialog', { name: 'Mağaza ekle' })
  const textboxes = dialog.getByRole('textbox')
  await textboxes.nth(0).fill('Yeni Mağaza')
  await textboxes.nth(1).fill('NEW-101')
  await dialog.getByRole('combobox').nth(0).click()
  await page.getByRole('option', { name: /Eda Doğanay/ }).click()
  await dialog.getByRole('button', { name: 'Kaydet' }).click()

  expect(createStoreBody).toEqual(expect.objectContaining({
    storeCode: 'NEW-101',
    storeName: 'Yeni Mağaza',
    regionId: '00000000-0000-0000-0000-000000000010',
    regionManagerUserId: '00000000-0000-0000-0000-000000000502',
  }))

  await main
    .getByRole('table', { name: 'Mağazalar' })
    .locator('tbody tr')
    .first()
    .getByRole('button')
    .click()
  const editDialog = page.getByRole('dialog', { name: 'Mağazayı düzenle' })
  await expect(editDialog.getByRole('combobox', { name: 'Bölge müdürü' })).toHaveText(/Eda Doğanay/)
  await editDialog.getByRole('combobox', { name: 'Mağaza durumu' }).click()
  await page.getByRole('option', { name: 'Pasif' }).click()
  await expect(editDialog.getByRole('button', { name: 'Kaydet' })).toBeEnabled()
  await editDialog.getByRole('combobox', { name: 'Bölge müdürü' }).click()
  await page.getByRole('option', { name: /Can Yılmaz/ }).click()
  await editDialog.getByRole('button', { name: 'Kaydet' }).click()
  expect(updateStoreBody).toEqual(expect.objectContaining({
    regionId: '00000000-0000-0000-0000-000000000010',
    regionManagerUserId: '00000000-0000-0000-0000-000000000512',
    status: 'inactive',
  }))

  await main.getByRole('tab', { name: 'Personel' }).click()
  const personnelDownloadPromise = page.waitForEvent('download')
  await main.getByRole('button', { name: 'Excel indir' }).click()
  const personnelDownload = await personnelDownloadPromise
  expect(personnelDownload.suggestedFilename()).toMatch(/^personel-listesi-\d{4}-\d{2}-\d{2}\.xlsx$/)
  await expect(main.getByRole('table', { name: 'Personel' }).locator('tbody tr')).toHaveCount(20)
  await expect(main).toContainText('1-20 / 25 personel')
  await main.getByRole('group', { name: 'Personel durumu' }).screenshot({
    path: testInfo.outputPath('personnel-status-control.png'),
  })
  await main.getByRole('radio', { name: 'İşten çıkanlar' }).click()
  await expect(main.getByRole('table', { name: 'Personel' }).locator('tbody tr')).toHaveCount(3)
  await expect(main).toContainText('1-3 / 3 personel')
  await main.getByRole('radio', { name: 'Aktif' }).click()
  await main.getByRole('button', { name: 'Pilot Personel personelini düzenle' }).click()
  const personnelEditor = page.getByRole('dialog', { name: 'Personel bilgilerini düzenle' })
  await expect(personnelEditor.getByRole('textbox', { name: 'T.C. (değiştirilemez)' })).toBeDisabled()
  await personnelEditor.getByRole('textbox', { name: 'Telefon numarası' }).fill('+90 555 222 33 44')
  await personnelEditor.screenshot({ path: testInfo.outputPath('personnel-editor-desktop.png') })
  await personnelEditor.getByRole('button', { name: 'Değişiklikleri kaydet' }).click()
  expect(updatePersonnelBody).toEqual(expect.objectContaining({
    firstName: 'Pilot',
    lastName: 'Personel',
    phoneNumber: '+90 555 222 33 44',
    storeId: '00000000-0000-0000-0000-000000000100',
    positionId: '00000000-0000-0000-0000-000000000400',
    expectedUpdatedAt: '2026-06-30T10:00:00.000Z',
  }))
  await main.getByRole('button', { name: 'Personel girişi' }).click()
  const personnelDialog = page.getByRole('dialog', { name: 'Personel girişi' })
  await expect(personnelDialog).not.toContainText('Personel kaydını oluşturun ve ilk mağaza atamasını yapın.')
  await personnelDialog.getByRole('textbox', { name: 'Ad', exact: true }).fill('Ada')
  await personnelDialog.getByRole('textbox', { name: 'Soyad' }).fill('Lovelace')
  await personnelDialog.getByRole('textbox', { name: 'T.C. kimlik numarası' }).fill('12345678901')
  await personnelDialog.getByRole('textbox', { name: 'Telefon numarası' }).fill('+90 555 111 22 33')
  await personnelDialog.getByRole('textbox', { name: 'Sicil numarası' }).fill('EMP-NEW')
  await personnelDialog.getByRole('combobox', { name: 'Mağaza seç' }).click()
  await expect(page.getByRole('listbox', { name: 'Mağazalar' }).getByRole('option')).toHaveCount(160)
  await page.getByRole('combobox', { name: 'Mağaza ara' }).fill('Şube 159')
  await expect(page.getByRole('listbox', { name: 'Mağazalar' }).getByRole('option')).toHaveCount(1)
  await page.getByRole('option', { name: /Şube 159/ }).click()
  await expect(personnelDialog.getByRole('combobox', { name: 'Mağaza seç' })).toContainText('Şube 159')
  await personnelDialog.getByRole('combobox', { name: 'Pozisyon' }).click()
  await expect(page.getByRole('option')).toHaveCount(5)
  await expect(page.getByRole('option', { name: 'Demo Store Manager' })).toHaveCount(0)
  await page.getByRole('option', { name: 'Satış Danışmanı', exact: true }).click()
  await personnelDialog.screenshot({ path: testInfo.outputPath('personnel-entry-desktop.png') })
  await personnelDialog.getByRole('button', { name: 'Girişi tamamla' }).click()
  expect(createPersonnelBody).toEqual(expect.objectContaining({
    firstName: 'Ada',
    lastName: 'Lovelace',
    nationalId: '12345678901',
    phoneNumber: '+90 555 111 22 33',
    externalEmployeeRef: 'EMP-NEW',
    storeId: '00000000-0000-0000-0001-000000000159',
    positionId: '00000000-0000-0000-0000-000000000400',
  }))
  await expectNoCriticalAxeViolations(page)
})

for (const viewport of [
  { label: 'desktop', width: 1440, height: 900 },
  { label: 'compact-desktop', width: 1024, height: 768 },
  { label: 'mobile', width: 390, height: 844 },
  { label: 'compact-mobile', width: 360, height: 800 },
]) {
  test(`master data golden slice remains bounded at ${viewport.width}x${viewport.height}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await routeMasterDataControlApi(page)
    await page.goto('/admin/master-data')

    const main = page.getByRole('main')
    await expect(main.getByRole('heading', { name: 'Mağaza ve personel' })).toBeVisible()
    await expect(main.getByTestId('master-data-management-surface')).toBeVisible()
    await expect(main).not.toContainText('onprem.region-manager')

    const viewportGeometry = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }))
    expect(viewportGeometry.scrollWidth).toBeLessThanOrEqual(viewportGeometry.clientWidth)

    if (viewport.width >= 768) {
      await expect(main.getByRole('table', { name: 'Mağazalar' })).toBeVisible()
    } else {
      await expect(main.getByRole('table', { name: 'Mağazalar' })).toHaveCount(0)
      await expect(main.getByRole('button').filter({ hasText: 'Eda Doğanay' }).first()).toBeVisible()
    }

    await page.screenshot({
      path: testInfo.outputPath(`master-data-${viewport.label}.png`),
      fullPage: true,
    })

    if (viewport.width < 768) {
      await main.getByRole('tab', { name: 'Personel' }).click()
      await main.getByRole('group', { name: 'Personel durumu' }).screenshot({
        path: testInfo.outputPath(`personnel-status-${viewport.label}.png`),
      })
      await main.getByRole('button', { name: 'Personel girişi' }).click()
      const personnelDialog = page.getByRole('dialog', { name: 'Personel girişi' })
      await expect(personnelDialog.getByRole('textbox', { name: 'T.C. kimlik numarası' })).toBeVisible()
      await expect(personnelDialog.getByRole('textbox', { name: 'Telefon numarası' })).toBeVisible()
      await page.screenshot({
        path: testInfo.outputPath(`personnel-entry-${viewport.label}.png`),
        fullPage: true,
      })
    }
  })
}

test('auth management keeps users and global role permissions explicit', async ({ page }, testInfo) => {
  await routeAuthManagementApi(page)
  const storeAssignmentBodies: Array<Record<string, unknown>> = []
  await page.route('**/api/auth/action-store-assignments/batch', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback()
    storeAssignmentBodies.push(route.request().postDataJSON())
    await route.fulfill({ status: 201, json: { command: { status: 'created', message: 'Assigned' }, data: { assignments: [] } } })
  })
  const usersRequestPromise = page.waitForRequest('**/api/auth/users?**')
  await page.goto('/admin/auth')
  const usersRequestUrl = new URL((await usersRequestPromise).url())
  expect(usersRequestUrl.searchParams.get('limit')).toBe('10')
  expect(usersRequestUrl.searchParams.get('offset')).toBe('0')
  const main = page.getByRole('main')

  await expect(main.getByRole('heading', { name: 'Kullanıcılar ve yetkiler' })).toBeVisible()
  await expect(main.getByLabel('Kullanıcı listesi')).toContainText('store.manager')
  await expect(main.getByText('Mağaza erişimi', { exact: true })).toBeVisible()
  await main.getByRole('button', { name: 'Mağaza ekle' }).click()
  const storeDialog = page.getByRole('dialog', { name: 'Mağaza erişimi ekle' })
  await storeDialog.getByRole('button', { name: /Demo Store/ }).click()
  await storeDialog.getByRole('button', { name: /Kadıköy Store/ }).click()
  await expect(storeDialog).toContainText('2 mağaza seçildi')
  await storeDialog.screenshot({ path: testInfo.outputPath('auth-store-multi-select.png') })
  await storeDialog.getByRole('button', { name: 'Seçilenlere erişim ver' }).click()
  await expect.poll(() => storeAssignmentBodies.length).toBe(1)
  expect(storeAssignmentBodies).toEqual([
    { userId: 'user-1', storeIds: ['store-1', 'store-2'] },
  ])
  await page.screenshot({ path: testInfo.outputPath('auth-users-desktop.png'), fullPage: true })
  await main.getByRole('button', { name: 'Rol yetkileri' }).click()
  await expect(main.getByRole('heading', { name: 'Rol yetkileri' })).toBeVisible()
  await expect(main.getByText('Mağaza verilerini görüntüleyebilir.')).toBeVisible()
  await expect(main.getByText('Read store data')).toHaveCount(0)
  await page.screenshot({ path: testInfo.outputPath('auth-permissions-desktop.png'), fullPage: true })

  const storePermission = main.getByRole('checkbox').first()
  await storePermission.click()
  await expect(page.getByRole('dialog', { name: 'Rol yetkisi değiştirilsin mi?' })).toBeVisible()
  await expectNoCriticalAxeViolations(page)
})

test('management workspaces remain usable without horizontal overflow on mobile', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await routeMasterDataControlApi(page)
  await page.goto('/admin/master-data')

  const masterMain = page.getByRole('main')
  await expect(masterMain.getByRole('heading', { name: 'Mağaza ve personel' })).toBeVisible()
  await expect(masterMain.getByRole('button').filter({ hasText: 'Eda Doğanay' }).first()).toBeVisible()
  await expect(page.locator('html')).toHaveJSProperty('scrollWidth', 390)

  await routeAuthManagementApi(page)
  await page.goto('/admin/auth')

  const authMain = page.getByRole('main')
  await expect(authMain.getByRole('heading', { name: 'Kullanıcılar ve yetkiler' })).toBeVisible()
  await expect(authMain.getByLabel('Kullanıcı listesi')).toContainText('store.manager')
  await expect(page.locator('html')).toHaveJSProperty('scrollWidth', 390)
  await page.screenshot({ path: testInfo.outputPath('auth-users-mobile.png'), fullPage: true })
  await authMain.getByRole('button', { name: 'Mağaza ekle' }).click()
  const mobileStoreDialog = page.getByRole('dialog', { name: 'Mağaza erişimi ekle' })
  await mobileStoreDialog.getByRole('button', { name: /Demo Store/ }).click()
  await expect(mobileStoreDialog).toContainText('1 mağaza seçildi')
  await expect(page.locator('html')).toHaveJSProperty('scrollWidth', 390)
  await page.screenshot({ path: testInfo.outputPath('auth-store-multi-select-mobile.png'), fullPage: true })
  await mobileStoreDialog.getByRole('button', { name: 'Vazgeç' }).click()
  await authMain.getByRole('button', { name: 'Rol yetkileri' }).click()
  await expect(authMain.getByText('Mağaza verilerini görüntüleyebilir.')).toBeVisible()
  await expect(page.locator('html')).toHaveJSProperty('scrollWidth', 390)
  await page.screenshot({ path: testInfo.outputPath('auth-permissions-mobile.png'), fullPage: true })
})

async function routeAuthManagementApi(page: Page) {
  await page.route('**/api/auth/lookups', (route) => route.fulfill({ json: authLookupsFixture }))
  await page.route('**/api/auth/users?**', (route) => route.fulfill({ json: authUsersFixture }))
  await page.route('**/api/auth/roles', (route) => route.fulfill({ json: authRolesFixture }))
  await page.route('**/api/auth/permissions', (route) => route.fulfill({ json: authPermissionsFixture }))
  await page.route('**/api/auth/role-assignments?**', (route) => route.fulfill({ json: emptyList }))
  await page.route('**/api/auth/action-store-assignments?**', (route) => route.fulfill({ json: emptyList }))
}

const authSessionFixture = {
  authMode: 'mock',
  authenticated: true,
  user: {
    userId: '10000000-0000-4000-8000-000000000099',
    employeeId: null,
    roleCodes: ['SUPER_ADMIN', 'HR_ADMIN', 'INTEGRATION_ADMIN'],
    scope: { companyIds: ['10000000-0000-4000-8000-000000000001'], regionIds: [], storeIds: [] },
    readScope: { companyIds: ['10000000-0000-4000-8000-000000000001'], regionIds: [], storeIds: [] },
    actionScope: { assignedStoreIds: [], assignedStoreTypes: [] },
    assignedStoreIds: [],
  },
  scopeSummary: { companyCount: 1, regionCount: 0, storeCount: 0, assignedStoreCount: 0 },
}

const authUsersFixture = {
  items: [
    { userId: 'user-1', employeeId: null, username: 'store.manager', email: 'store.manager@example.com', authProvider: 'clerk', providerSubject: 'user_store', isActive: true, lastLoginAt: null, createdAt: '2026-08-01T09:00:00.000Z' },
    { userId: 'user-2', employeeId: null, username: 'admin.user', email: 'admin@example.com', authProvider: 'clerk', providerSubject: 'user_admin', isActive: true, lastLoginAt: null, createdAt: '2026-08-01T09:00:00.000Z' },
  ],
  meta: { count: 2, total: 2, limit: 100, offset: 0 },
}

const authLookupsFixture = {
  scopeTypes: ['company', 'region', 'store'], authProviders: ['clerk'], users: [], permissions: [],
  roles: [{ roleId: 'role-1', roleCode: 'STORE_MANAGER', roleName: 'Mağaza Müdürü', scopeType: 'store' }],
  stores: [
    { storeId: 'store-1', storeCode: 'S1', storeName: 'Demo Store', companyId: 'company-1', regionId: 'region-1', regionName: 'Marmara' },
    { storeId: 'store-2', storeCode: 'S2', storeName: 'Kadıköy Store', companyId: 'company-1', regionId: 'region-1', regionName: 'Marmara' },
    { storeId: 'store-3', storeCode: 'S3', storeName: 'Beşiktaş Store', companyId: 'company-1', regionId: 'region-1', regionName: 'Marmara' },
  ],
  optionGroups: { users: [], roles: [], permissions: [], stores: [], scopeTypes: [], authProviders: [] },
  meta: { totalUsers: 2, totalRoles: 1, totalPermissions: 2, totalStores: 3 },
}

const authRolesFixture = {
  items: [{
    roleId: 'role-1', roleCode: 'STORE_MANAGER', roleName: 'Mağaza Müdürü', scopeType: 'store', description: null, isSystemRole: true,
    permissions: [{ permissionCode: 'STORE_READ', resourceName: 'store', actionName: 'read' }],
  }],
  meta: { count: 1, total: 1, limit: 50, offset: 0 },
}

const authPermissionsFixture = {
  items: [
    { permissionId: 'permission-1', permissionCode: 'STORE_READ', resourceName: 'store', actionName: 'read', description: 'Read store data' },
    { permissionId: 'permission-2', permissionCode: 'STORE_WRITE', resourceName: 'store', actionName: 'write', description: 'Edit store data' },
  ],
  meta: { count: 2, total: 2, limit: 50, offset: 0 },
}

const emptyList = { items: [], meta: { count: 0, total: 0, limit: 100, offset: 0 } }
