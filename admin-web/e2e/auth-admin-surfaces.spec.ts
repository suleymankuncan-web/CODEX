import { expect, test, type Page } from './test-fixtures'
import { setStoredLocale } from './locale-test-utils'

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

  await routeAuthAdminApi(page)
})

test('auth workbench remains readable and persists locale preference', async ({ page }) => {
  await page.goto('/admin/auth')

  const main = page.getByRole('main', { name: 'Erişim yönetimi' })
  const toolbar = main.locator('.auth-workbench-toolbar')

  await expect(main).toHaveAttribute('aria-label', 'Erişim yönetimi')
  await expect(main.getByRole('heading', { name: 'Erişim Yönetimi' })).toBeVisible()
  await expect(main.getByText('Kullanıcı, rol ve mağaza yetkilerini tek çalışma masasında düzenle.')).toBeVisible()
  await expect(main.getByLabel('Erişim özeti')).toContainText('Üyelik')
  await expect(main.getByLabel('Erişim özeti')).toContainText('Rol ataması')
  await expect(main.getByLabel('Erişim özeti')).toContainText('Mağaza erişimi')
  await expect(main.getByLabel('Kullanıcı ara')).toHaveValue('')
  await expect(main.getByLabel('Kullanıcı listesi')).toContainText('admin.user')
  await expect(main.getByLabel('Seçili kullanıcı')).toContainText('store.manager')
  await expect(toolbar.getByRole('button', { name: 'Rol ata' })).toBeVisible()
  await expect(toolbar.getByRole('button', { name: 'Mağaza bağla' })).toBeVisible()
  await expect(main.getByRole('button', { name: 'Üyelik oluştur' })).toBeVisible()
  await expect(main.getByText('Kontrol izi')).toBeVisible()
  await expect(page.locator('body')).not.toContainText('ÃƒÆ’')
  await expect(page.locator('body')).not.toContainText('Ãƒâ€')
  await expect(page.locator('body')).not.toContainText('Ãƒâ€¦')

  await setStoredLocale(page, 'en')

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(main.getByRole('heading', { name: 'Erişim Yönetimi' })).toBeVisible()
  await expect(main.getByText('Kullanıcı, rol ve mağaza yetkilerini tek çalışma masasında düzenle.')).toBeVisible()

  await page.reload()

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(main.getByRole('heading', { name: 'Erişim Yönetimi' })).toBeVisible()
})

test('HR admin can create a user from the access workbench', async ({ page }) => {
  let requestBody: Record<string, unknown> | null = null

  await page.route('**/api/auth/users', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback()
      return
    }

    requestBody = route.request().postDataJSON()
    await route.fulfill({
      status: 201,
      json: {
        command: { status: 'created', message: 'Üyelik oluşturuldu' },
        data: {
          user: {
            userId: '90000000-0000-4000-8000-000000000101',
            employeeId: '70000000-0000-4000-8000-000000000101',
            username: 'ayse.demir',
            email: 'ayse.demir@example.com',
            authProvider: 'clerk',
            providerSubject: null,
            isActive: true,
            lastLoginAt: null,
            createdAt: '2026-04-29T18:30:00.000Z',
          },
        },
      },
    })
  })

  await page.goto('/admin/auth')

  await page.getByRole('button', { name: 'Üyelik oluştur' }).first().click()
  const newAccount = page.locator('.auth-account-section').filter({ hasText: 'Yeni üyelik' })
  await newAccount.getByLabel('Ad soyad').fill('ayse.demir')
  await newAccount.getByLabel('E-posta').fill('ayse.demir@example.com')
  await newAccount.getByLabel('Personel').fill('70000000-0000-4000-8000-000000000101')
  await newAccount.getByRole('button', { name: 'Üyelik oluştur' }).click()

  await expect(page.getByText('Üyelik oluşturuldu')).toBeVisible()
  expect(requestBody).toMatchObject({
    username: 'ayse.demir',
    email: 'ayse.demir@example.com',
    employeeId: '70000000-0000-4000-8000-000000000101',
    authProvider: 'clerk',
  })
})

test('HR admin can search users and create assignments from the workbench', async ({ page }) => {
  const userId = '90000000-0000-4000-8000-000000000201'
  const storeId = '10000000-0000-4000-8000-000000000021'
  const companyId = '10000000-0000-4000-8000-000000000001'
  let roleAssignmentBody: Record<string, unknown> | null = null
  let actionStoreBody: Record<string, unknown> | null = null
  let userSearchQuery: string | null = null

  await page.route('**/api/auth/users?**', async (route) => {
    const url = new URL(route.request().url())
    userSearchQuery = url.searchParams.get('q')
    const items = userSearchQuery?.toLocaleLowerCase('tr-TR').includes('manager')
      ? authUsersFixture.items.filter((user) => user.userId === userId)
      : authUsersFixture.items

    await route.fulfill({
      json: {
        items,
        meta: { count: items.length, total: items.length, limit: 100, offset: 0 },
      },
    })
  })

  await page.route('**/api/auth/role-assignments', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback()
      return
    }

    roleAssignmentBody = route.request().postDataJSON()
    await route.fulfill({
      status: 201,
      json: {
        command: { status: 'created', message: 'Rol kaydedildi' },
        data: { assignment: { assignmentId: 'assignment-1' } },
      },
    })
  })

  await page.route('**/api/auth/action-store-assignments', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback()
      return
    }

    actionStoreBody = route.request().postDataJSON()
    await route.fulfill({
      status: 201,
      json: {
        command: { status: 'created', message: 'Mağaza kaydedildi' },
        data: { assignment: { assignmentId: 'action-store-assignment-1' } },
      },
    })
  })

  await page.goto('/admin/auth')

  await page.getByLabel('Kullanıcı ara').fill('manager')
  await expect(page.getByLabel('Kullanıcı listesi')).toContainText('store.manager')
  await expect(page.getByLabel('Seçili kullanıcı')).toContainText('store.manager')
  expect(userSearchQuery).toBe('manager')

  await page.getByRole('button', { name: 'Rolü kaydet' }).click()

  await expect(page.getByText('Rol kaydedildi')).toBeVisible()
  expect(roleAssignmentBody).toMatchObject({
    userId,
    roleCode: 'STORE_MANAGER',
    scopeType: 'company',
    companyId,
  })

  await page.locator('.auth-workbench-toolbar').getByRole('button', { name: 'Mağaza bağla' }).click()
  await page.locator('.auth-tray').filter({ hasText: 'Mağaza bağla' }).getByRole('combobox').click()
  await page.getByRole('option', { name: 'Marmara Park' }).click()
  await page.getByRole('button', { name: 'Mağazayı kaydet' }).click()

  await expect(page.getByText('Mağaza kaydedildi')).toBeVisible()
  expect(actionStoreBody).toMatchObject({
    userId,
    storeId,
  })
})

test('HR admin can update and deactivate selected user access', async ({ page }) => {
  const userId = '90000000-0000-4000-8000-000000000201'
  let updateBody: Record<string, unknown> | null = null
  let deactivateBody: Record<string, unknown> | null = null

  await page.route(`**/api/auth/users/${userId}`, async (route) => {
    if (route.request().method() !== 'PATCH') {
      await route.fallback()
      return
    }

    updateBody = route.request().postDataJSON()
    await route.fulfill({
      json: {
        command: { status: 'updated', message: 'Hesap güncellendi' },
        data: { user: { ...authUsersFixture.items[0], username: 'store.manager.updated' } },
      },
    })
  })

  await page.route(`**/api/auth/users/${userId}/deactivate`, async (route) => {
    deactivateBody = route.request().postDataJSON()
    await route.fulfill({
      json: {
        command: { status: 'deactivated', message: 'Hesap pasife alındı' },
        data: { accessClosure: { closedRoleAssignments: 0, closedActionStoreAssignments: 0 } },
      },
    })
  })

  await page.goto('/admin/auth')

  await page.getByRole('button', { name: 'Üyelik oluştur' }).first().click()
  const account = page.locator('.auth-account-section').filter({ hasText: 'Hesap bilgileri' })
  await account.getByLabel('Ad soyad').fill('store.manager.updated')
  await account.getByRole('button', { name: 'Bilgileri kaydet' }).click()

  await expect(page.locator('.auth-notice').filter({ hasText: 'Hesap güncellendi' })).toBeVisible()
  expect(updateBody).toMatchObject({ username: 'store.manager.updated' })

  const status = page.locator('.auth-danger-box')
  await status.getByLabel('Kapatma nedeni').fill('Görev değişikliği')
  await status.getByRole('button', { name: 'Erişimi kapat ve pasife al' }).click()
  await page.getByRole('button', { name: 'Hesabı kapat' }).click()

  await expect(page.locator('.auth-notice').filter({ hasText: 'Hesap pasife alındı' })).toBeVisible()
  expect(deactivateBody).toMatchObject({ reason: 'Görev değişikliği' })
})

test('HR admin can reactivate an inactive user from the workbench', async ({ page }) => {
  const inactiveUserId = '90000000-0000-4000-8000-000000000203'
  let reactivateCalled = false

  await page.route(`**/api/auth/users/${inactiveUserId}/reactivate`, async (route) => {
    reactivateCalled = true
    await route.fulfill({
      json: {
        command: { status: 'reactivated', message: 'Hesap aktifleştirildi' },
        data: { user: { ...authUsersFixture.items[2], isActive: true } },
      },
    })
  })

  await page.goto('/admin/auth')

  await page.getByLabel('Kullanıcı listesi').getByRole('button', { name: /inactive\.user/ }).click()
  await expect(page.getByLabel('Seçili kullanıcı')).toContainText('inactive.user')
  await page.getByRole('button', { name: 'Üyelik oluştur' }).first().click()
  await page.getByRole('button', { name: 'Hesabı aktifleştir' }).click()

  await expect(page.locator('.auth-notice').filter({ hasText: 'Hesap aktifleştirildi' })).toBeVisible()
  expect(reactivateCalled).toBe(true)
})

test('auth catalog page switches chrome to English copy and persists locale', async ({ page }) => {
  await page.goto('/admin/auth/catalog')

  const main = page.getByRole('main')

  await expect(main.getByText('Kimlik kataloğu')).toBeVisible()
  await expect(main.getByRole('heading', { name: 'Rol ve izin tanımları açık ve incelenebilir kalır.' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Auth özetine dön' })).toBeVisible()
  await expect(main.getByRole('heading', { name: 'Rol tanımları' })).toBeVisible()
  await expect(main.getByPlaceholder('Rol kodu, ad, kapsam veya izin ara')).toBeVisible()
  await expect(main.getByText('Sistem rolü', { exact: true })).toBeVisible()
  await expect(main.getByText('İzni geri al STORE_READ')).toBeVisible()
  await expect(main.getByRole('button', { name: 'İzin ver' }).first()).toBeDisabled()
  await expect(main.getByRole('heading', { name: 'İzin kataloğu' })).toBeVisible()
  await expect(main.getByText('Role and permission definitions stay explicit')).toHaveCount(0)
  await expect(page.locator('body')).not.toContainText('ÃƒÆ’')
  await expect(page.locator('body')).not.toContainText('Ãƒâ€')
  await expect(page.locator('body')).not.toContainText('Ãƒâ€¦')

  await setStoredLocale(page, 'en')

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(main.getByText('Auth Catalog')).toBeVisible()
  await expect(main.getByRole('heading', { name: 'Role and permission definitions stay explicit and inspectable.' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Back to auth overview' })).toBeVisible()
  await expect(main.getByRole('heading', { name: 'Role definitions' })).toBeVisible()
  await expect(main.getByText('Search by code, name, scope, or permission code.')).toBeVisible()
  await expect(main.getByPlaceholder('Search role code, name, scope, or permission')).toBeVisible()
  await expect(main.getByText('System role', { exact: true })).toBeVisible()
  await expect(main.getByText('Revoke STORE_READ')).toBeVisible()
  await expect(main.getByRole('button', { name: 'Grant permission' }).first()).toBeDisabled()
  await expect(main.getByRole('heading', { name: 'Permission catalog' })).toBeVisible()
  await expect(main.getByText('Rol ve izin tanımları açık')).toHaveCount(0)

  await page.reload()

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(main.getByRole('heading', { name: 'Role and permission definitions stay explicit and inspectable.' })).toBeVisible()
})

test('auth dashboard remains readable on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.addInitScript(() => {
    window.localStorage.setItem('store-ops-app-locale', 'tr')
  })
  await page.goto('/admin/auth')

  const main = page.getByRole('main', { name: 'Erişim yönetimi' })
  await expect(main.getByRole('heading', { name: 'Erişim Yönetimi' })).toBeVisible()
  await expect(main.getByLabel('Kullanıcı listesi')).toBeVisible()
  await expect(main.getByLabel('İşlem paneli')).toBeVisible()
  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  )
  expect(hasHorizontalOverflow).toBe(false)
})

async function routeAuthAdminApi(page: Page) {
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({ json: authSessionFixture })
  })

  await page.route('**/api/auth/lookups', async (route) => {
    await route.fulfill({ json: authLookupsFixture })
  })

  await page.route('**/api/auth/users?**', async (route) => {
    const url = new URL(route.request().url())
    expectAuthListLimitWithinContract(url)
    const query = url.searchParams.get('q')?.trim().toLocaleLowerCase('tr-TR') ?? ''
    const items = query
      ? authUsersFixture.items.filter((user) =>
          [user.username, user.email, user.employeeId ?? '']
            .join(' ')
            .toLocaleLowerCase('tr-TR')
            .includes(query),
        )
      : authUsersFixture.items

    await route.fulfill({
      json: { items, meta: { count: items.length, total: items.length, limit: 100, offset: 0 } },
    })
  })

  await page.route('**/api/auth/role-assignments?**', async (route) => {
    expectAuthListLimitWithinContract(new URL(route.request().url()))
    await route.fulfill({ json: authRoleAssignmentsFixture })
  })

  await page.route('**/api/auth/action-store-assignments?**', async (route) => {
    expectAuthListLimitWithinContract(new URL(route.request().url()))
    await route.fulfill({ json: authActionStoreAssignmentsFixture })
  })

  await page.route('**/api/auth/users/*/audit', async (route) => {
    await route.fulfill({ json: authAuditFixture })
  })

  await page.route('**/api/auth/roles', async (route) => {
    await route.fulfill({ json: authRolesFixture })
  })

  await page.route('**/api/auth/permissions', async (route) => {
    await route.fulfill({ json: authPermissionsFixture })
  })
}

function expectAuthListLimitWithinContract(url: URL) {
  const limit = Number(url.searchParams.get('limit') ?? 100)
  expect(limit).toBeGreaterThanOrEqual(1)
  expect(limit).toBeLessThanOrEqual(200)
}

const authSessionFixture = {
  authMode: 'mock',
  authenticated: true,
  user: {
    userId: 'super-admin-auth-user',
    employeeId: null,
    roleCodes: ['SUPER_ADMIN', 'HR_ADMIN'],
    scope: {
      companyIds: ['10000000-0000-4000-8000-000000000001'],
      regionIds: [],
      storeIds: [],
    },
    readScope: {
      companyIds: ['10000000-0000-4000-8000-000000000001'],
      regionIds: [],
      storeIds: [],
    },
    actionScope: {
      assignedStoreIds: [],
    },
    assignedStoreIds: [],
  },
  scopeSummary: {
    companyCount: 1,
    regionCount: 0,
    storeCount: 0,
    assignedStoreCount: 0,
  },
}

const authUsersFixture = {
  items: [
    {
      userId: '90000000-0000-4000-8000-000000000201',
      employeeId: '70000000-0000-4000-8000-000000000201',
      username: 'store.manager',
      email: 'store.manager@example.com',
      authProvider: 'oidc',
      providerSubject: 'provider-subject-201',
      isActive: true,
      lastLoginAt: '2026-06-01T08:30:00.000Z',
      createdAt: '2026-05-15T09:00:00.000Z',
    },
    {
      userId: '90000000-0000-4000-8000-000000000202',
      employeeId: null,
      username: 'admin.user',
      email: 'admin.user@example.com',
      authProvider: 'clerk',
      providerSubject: 'provider-subject-202',
      isActive: true,
      lastLoginAt: '2026-06-02T08:30:00.000Z',
      createdAt: '2026-05-16T09:00:00.000Z',
    },
    {
      userId: '90000000-0000-4000-8000-000000000203',
      employeeId: null,
      username: 'inactive.user',
      email: 'inactive.user@example.com',
      authProvider: 'clerk',
      providerSubject: 'provider-subject-203',
      isActive: false,
      lastLoginAt: null,
      createdAt: '2026-05-12T09:00:00.000Z',
    },
  ],
  meta: { count: 3, total: 3, limit: 100, offset: 0 },
}

const authRoleAssignmentsFixture = {
  items: [],
  meta: { count: 0, total: 0, limit: 200, offset: 0 },
}

const authActionStoreAssignmentsFixture = {
  items: [],
  meta: { count: 0, total: 0, limit: 200, offset: 0 },
}

const authAuditFixture = {
  items: [
    {
      eventLogId: 'auth-event-1',
      occurredAt: '2026-06-02T08:35:00.000Z',
      eventType: 'user_account.updated',
      actorUserId: 'super-admin-auth-user',
      correlationId: 'auth-correlation-1',
      metadata: {
        changedFields: ['email'],
        sourceContext: { module: 'auth', operation: 'update' },
        details: { email: 'admin.user@example.com' },
      },
    },
  ],
  meta: { count: 1, total: 1, limit: 50, offset: 0 },
}

const authLookupsFixture = {
  scopeTypes: ['company', 'region', 'store'],
  authProviders: ['oidc'],
  users: [],
  roles: [
    {
      roleId: 'role-store-manager',
      roleCode: 'STORE_MANAGER',
      roleName: 'Store Manager',
      scopeType: 'store',
    },
    {
      roleId: 'role-region-manager',
      roleCode: 'REGION_MANAGER',
      roleName: 'Region Manager',
      scopeType: 'region',
    },
    {
      roleId: 'role-vm',
      roleCode: 'VISUAL_MERCHANDISER',
      roleName: 'Visual Merchandiser',
      scopeType: 'store',
    },
  ],
  permissions: [],
  stores: [
    {
      storeId: '10000000-0000-4000-8000-000000000021',
      storeCode: 'SM140',
      storeName: 'Marmara Park',
      companyId: '10000000-0000-4000-8000-000000000001',
      regionId: '10000000-0000-4000-8000-000000000011',
      regionName: 'Marmara',
    },
  ],
  optionGroups: {
    users: [],
    roles: [],
    permissions: [],
    stores: [],
    scopeTypes: [],
    authProviders: [],
  },
  meta: {
    totalUsers: 0,
    totalRoles: 3,
    totalPermissions: 0,
    totalStores: 1,
  },
}

const authRolesFixture = {
  items: [
    {
      roleId: 'role-store-manager',
      roleCode: 'STORE_MANAGER',
      roleName: 'Store Manager',
      scopeType: 'store',
      description: 'Store manager pilot role',
      isSystemRole: true,
      permissions: [
        {
          permissionId: 'permission-store-read',
          permissionCode: 'STORE_READ',
          resourceName: 'store',
          actionName: 'read',
          description: 'Read store data',
        },
      ],
    },
    {
      roleId: 'role-custom-auditor',
      roleCode: 'CUSTOM_AUDITOR',
      roleName: 'Custom Auditor',
      scopeType: 'company',
      description: null,
      isSystemRole: false,
      permissions: [],
    },
  ],
  meta: { count: 2, total: 2, limit: 50, offset: 0 },
}

const authPermissionsFixture = {
  items: [
    {
      permissionId: 'permission-store-read',
      permissionCode: 'STORE_READ',
      resourceName: 'store',
      actionName: 'read',
      description: 'Read store data',
    },
    {
      permissionId: 'permission-target-write',
      permissionCode: 'TARGET_WRITE',
      resourceName: 'target',
      actionName: 'write',
      description: null,
    },
  ],
  meta: { count: 2, total: 2, limit: 50, offset: 0 },
}
