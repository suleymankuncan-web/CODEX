import { expect, test, type Page } from './test-fixtures'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'store-ops-admin-session',
      JSON.stringify({
        mode: 'mock',
        mockUserId: 'super-admin-auth-user',
        mockRoleCodes: 'SUPER_ADMIN,HR_ADMIN',
        mockCompanyIds: '10000000-0000-4000-8000-000000000001',
        bearerToken: '',
      }),
    )
  })
  await routeAuthManagementApi(page)
})

test('auth management keeps the current user and permission workspaces explicit', async ({ page }) => {
  await page.goto('/admin/auth')

  const main = page.getByRole('main')
  await expect(main.getByRole('heading', { name: 'Kullanıcılar ve yetkiler' })).toBeVisible()
  await expect(main.getByLabel('Kullanıcı listesi')).toContainText('store.manager')
  await expect(main.getByText('Mağaza erişimi', { exact: true })).toBeVisible()
  await expect(main.getByRole('button', { name: 'Kullanıcı ekle' })).toBeVisible()

  const search = main.getByLabel('Kullanıcı ara')
  await search.fill('inactive')
  await expect(search).toBeFocused()
  await expect(main.getByLabel('Kullanıcı listesi')).toContainText('inactive.user')

  await main.getByRole('button', { name: 'Rol yetkileri' }).click()
  await expect(main.getByRole('heading', { name: 'Rol yetkileri' })).toBeVisible()
  await expect(main.getByText('Mağaza verilerini görüntüleyebilir.')).toBeVisible()
})

test('HR admin creates a management user with one request', async ({ page }) => {
  let requestBody: Record<string, unknown> | null = null
  await page.route('**/api/auth/users', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback()
    requestBody = route.request().postDataJSON()
    await route.fulfill({
      status: 201,
      json: {
        command: { status: 'created', message: 'Created' },
        data: {
          user: {
            userId: 'user-created', employeeId: null, username: 'report.viewer',
            email: 'report.viewer@example.com', authProvider: 'clerk',
            providerSubject: 'user_report_viewer', isActive: true,
            lastLoginAt: null, createdAt: '2026-08-29T09:00:00.000Z',
          },
        },
      },
    })
  })

  await page.goto('/admin/auth')
  await page.getByRole('button', { name: 'Kullanıcı ekle' }).click()
  const dialog = page.getByRole('dialog', { name: 'Kullanıcı ekle' })
  await dialog.getByLabel('Kullanıcı adı').fill('report.viewer')
  await dialog.getByLabel('E-posta').fill('report.viewer@example.com')
  await dialog.getByLabel('Sağlayıcı kullanıcı kimliği').fill('user_report_viewer')
  await dialog.getByRole('button', { name: 'Oluştur' }).click()

  await expect(dialog).toBeHidden()
  expect(requestBody).toEqual({
    username: 'report.viewer',
    email: 'report.viewer@example.com',
    authProvider: 'clerk',
    providerSubject: 'user_report_viewer',
  })
})

test('HR admin deactivates and reactivates accounts through confirmations', async ({ page }) => {
  let deactivationBody: Record<string, unknown> | null = null
  let reactivated = false
  await page.route('**/api/auth/users/user-active/deactivate', async (route) => {
    deactivationBody = route.request().postDataJSON()
    await route.fulfill({
      json: {
        command: { status: 'deactivated', message: 'Deactivated' },
        data: { accessClosure: { closedRoleAssignments: 0, closedActionStoreAssignments: 0 } },
      },
    })
  })
  await page.route('**/api/auth/users/user-inactive/reactivate', async (route) => {
    reactivated = true
    await route.fulfill({
      json: {
        command: { status: 'reactivated', message: 'Reactivated' },
        data: { user: { ...usersFixture.items[1], isActive: true } },
      },
    })
  })

  await page.goto('/admin/auth')
  await page.getByRole('button', { name: 'Devre dışı bırak' }).click()
  const deactivateDialog = page.getByRole('dialog', { name: 'Hesap devre dışı bırakılsın mı?' })
  await deactivateDialog.getByRole('button', { name: 'Devre dışı bırak' }).click()
  expect(deactivationBody).toEqual({ reason: 'Admin yönetim ekranından devre dışı bırakıldı' })

  await page.getByLabel('Kullanıcı listesi').getByRole('button', { name: /inactive\.user/ }).click()
  await page.getByRole('button', { name: 'Yeniden etkinleştir' }).click()
  const reactivateDialog = page.getByRole('dialog', { name: 'Hesap yeniden etkinleştirilsin mi?' })
  await reactivateDialog.getByRole('button', { name: 'Etkinleştir' }).click()
  expect(reactivated).toBe(true)
})

test('auth catalog remains independently inspectable', async ({ page }) => {
  await page.goto('/admin/auth/catalog')
  const main = page.getByRole('main')
  await expect(main.getByText('Kimlik kataloğu')).toBeVisible()
  await expect(main.getByRole('heading', { name: 'Rol tanımları' })).toBeVisible()
  await expect(main.getByRole('heading', { name: 'İzin kataloğu' })).toBeVisible()
  await expect(main.getByText('Sistem rolü', { exact: true })).toBeVisible()
})

test('auth management remains bounded on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/admin/auth')
  const main = page.getByRole('main')
  await expect(main.getByRole('heading', { name: 'Kullanıcılar ve yetkiler' })).toBeVisible()
  await expect(main.getByLabel('Kullanıcı listesi')).toBeVisible()
  const geometry = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }))
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth)
})

async function routeAuthManagementApi(page: Page) {
  await page.route('**/api/auth/session', (route) => route.fulfill({ json: sessionFixture }))
  await page.route('**/api/auth/lookups', (route) => route.fulfill({ json: lookupsFixture }))
  await page.route('**/api/auth/users?**', async (route) => {
    const url = new URL(route.request().url())
    const query = url.searchParams.get('q')?.trim().toLocaleLowerCase('tr-TR') ?? ''
    const items = query
      ? usersFixture.items.filter((user) => `${user.username} ${user.email}`.toLocaleLowerCase('tr-TR').includes(query))
      : usersFixture.items
    await route.fulfill({ json: { items, meta: { count: items.length, total: items.length, limit: 10, offset: 0 } } })
  })
  await page.route('**/api/auth/role-assignments?**', (route) => route.fulfill({ json: emptyList }))
  await page.route('**/api/auth/action-store-assignments?**', (route) => route.fulfill({ json: emptyList }))
  await page.route('**/api/auth/roles', (route) => route.fulfill({ json: rolesFixture }))
  await page.route('**/api/auth/permissions', (route) => route.fulfill({ json: permissionsFixture }))
}

const sessionFixture = {
  authMode: 'mock', authenticated: true,
  user: {
    userId: 'super-admin-auth-user', employeeId: null,
    roleCodes: ['SUPER_ADMIN', 'HR_ADMIN'],
    scope: { companyIds: ['company-1'], regionIds: [], storeIds: [] },
    readScope: { companyIds: ['company-1'], regionIds: [], storeIds: [] },
    actionScope: { assignedStoreIds: [], assignedStoreTypes: [] }, assignedStoreIds: [],
  },
  scopeSummary: { companyCount: 1, regionCount: 0, storeCount: 0, assignedStoreCount: 0 },
}

const usersFixture = {
  items: [
    { userId: 'user-active', employeeId: null, username: 'store.manager', email: 'store.manager@example.com', authProvider: 'clerk', providerSubject: 'user_store', isActive: true, lastLoginAt: null, createdAt: '2026-08-01T09:00:00.000Z' },
    { userId: 'user-inactive', employeeId: null, username: 'inactive.user', email: 'inactive@example.com', authProvider: 'clerk', providerSubject: 'user_inactive', isActive: false, lastLoginAt: null, createdAt: '2026-08-01T09:00:00.000Z' },
  ],
  meta: { count: 2, total: 2, limit: 10, offset: 0 },
}

const lookupsFixture = {
  scopeTypes: ['company', 'region', 'store'], authProviders: ['clerk'], users: [], permissions: [],
  roles: [{ roleId: 'role-store-manager', roleCode: 'STORE_MANAGER', roleName: 'Store Manager', scopeType: 'store' }],
  stores: [{ storeId: 'store-1', storeCode: 'S1', storeName: 'Demo Store', companyId: 'company-1', regionId: 'region-1', regionName: 'Marmara' }],
}

const rolesFixture = {
  items: [{
    roleId: 'role-store-manager', roleCode: 'STORE_MANAGER', roleName: 'Store Manager',
    scopeType: 'store', description: null, isSystemRole: true,
    permissions: [{ permissionId: 'permission-store-read', permissionCode: 'STORE_READ', resourceName: 'store', actionName: 'read', description: 'Read store data' }],
  }],
  meta: { count: 1, total: 1, limit: 50, offset: 0 },
}

const permissionsFixture = {
  items: [{ permissionId: 'permission-store-read', permissionCode: 'STORE_READ', resourceName: 'store', actionName: 'read', description: 'Read store data' }],
  meta: { count: 1, total: 1, limit: 50, offset: 0 },
}

const emptyList = { items: [], meta: { count: 0, total: 0, limit: 200, offset: 0 } }
