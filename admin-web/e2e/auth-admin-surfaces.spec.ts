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

test('auth dashboard page switches chrome to English copy and persists locale', async ({ page }) => {
  await page.goto('/admin/auth')

  const main = page.getByRole('main')

  await expect(main.getByText('Auth operasyonları')).toBeVisible()
  await expect(main.getByRole('heading', { name: 'Kullanıcılar, roller ve kapsam duruşu tek operatör görünümünde.' })).toBeVisible()
  await expect(main.getByRole('heading', { name: 'Pilot kullanıcı bağlantısı' })).toBeVisible()
  const preview = main.getByTestId('role-permission-preview')
  await expect(preview.getByRole('heading', { name: 'Rol, rota ve kapsam kararlari okunabilir kalsin.' })).toBeVisible()
  await expect(preview.getByLabel('On izlenecek rol')).toHaveValue('SUPER_ADMIN')
  await preview.getByLabel('On izlenecek rol').selectOption('REPORT_VIEWER')
  await expect(preview.locator('article').filter({ hasText: '/admin/reports' }).getByText('Gorunur')).toBeVisible()
  await expect(preview.locator('article').filter({ hasText: '/admin/auth' }).getByText('Kapali')).toBeVisible()
  await expect(
    preview.locator('article').filter({ hasText: '/store' }).first().getByText('Gorunur', { exact: true }),
  ).toBeVisible()
  await expect(preview.locator('article').filter({ hasText: '/store/reports' }).getByText('Gorunur')).toBeVisible()
  await expect(preview.locator('article').filter({ hasText: '/store/feed' }).getByText('Gorunur')).toBeVisible()
  await preview.getByLabel('On izlenecek rol').selectOption('STORE_PERSONNEL')
  await expect(preview.locator('article').filter({ hasText: '/store/checklists' }).getByText('Kapali')).toBeVisible()
  await expect(main.getByRole('heading', { name: 'Yeni hesap' })).toBeVisible()
  await expect(main.getByRole('heading', { name: 'Kapsamlı rol yetkisi' })).toBeVisible()
  await expect(main.getByRole('heading', { name: 'Operasyonel aksiyonlar için atanmış mağazalar' })).toBeVisible()
  await expect(main.getByRole('heading', { name: 'Rol atama kuyruğu' })).toBeVisible()
  await expect(main.getByRole('link', { name: 'Kataloğu aç' }).first()).toBeVisible()
  await expect(main.getByText('Users, roles, and scope posture')).toHaveCount(0)
  await expect(page.locator('body')).not.toContainText('ÃƒÆ’')
  await expect(page.locator('body')).not.toContainText('Ãƒâ€')
  await expect(page.locator('body')).not.toContainText('Ãƒâ€¦')

  await setStoredLocale(page, 'en')

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(main.getByText('Auth Admin', { exact: true })).toBeVisible()
  await expect(main.getByRole('heading', { name: 'Users, roles, and scope posture in one operator view.' })).toBeVisible()
  await expect(preview.getByRole('heading', { name: 'Keep role, route, and scope decisions inspectable.' })).toBeVisible()
  await expect(preview.getByLabel('Role to preview')).toHaveValue('SUPER_ADMIN')
  await preview.getByLabel('Role to preview').selectOption('REPORT_VIEWER')
  await expect(preview.locator('article').filter({ hasText: '/admin/reports' }).getByText('Visible')).toBeVisible()
  await expect(preview.locator('article').filter({ hasText: '/admin/auth' }).getByText('Closed')).toBeVisible()
  await expect(main.getByRole('heading', { name: 'Pilot user binding' })).toBeVisible()
  await expect(main.getByRole('heading', { name: 'New account' })).toBeVisible()
  await expect(main.getByRole('heading', { name: 'Scoped role grant' })).toBeVisible()
  await expect(main.getByRole('heading', { name: 'Assigned stores for operational actions' })).toBeVisible()
  await expect(main.getByRole('heading', { name: 'Role assignment queue' })).toBeVisible()
  await expect(
    main.getByText('Search by user, role, store, or scope identifiers to inspect the current access map.'),
  ).toBeVisible()
  await expect(main.getByRole('link', { name: 'Open catalog' }).first()).toBeVisible()
  await expect(main.getByText('Auth operasyonları')).toHaveCount(0)

  await page.reload()

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(main.getByRole('heading', { name: 'Users, roles, and scope posture in one operator view.' })).toBeVisible()
})

test('HR admin can submit a pilot user binding', async ({ page }) => {
  let requestBody: Record<string, unknown> | null = null

  await page.route('**/api/auth/pilot-user-bindings', async (route) => {
    requestBody = route.request().postDataJSON()
    await route.fulfill({
      status: 201,
      json: {
        command: { status: 'created', message: 'Pilot user binding created' },
        data: {
          binding: {
            user: {
              userId: '90000000-0000-4000-8000-000000000101',
              employeeId: '70000000-0000-4000-8000-000000000101',
              username: 'ayse.demir',
              email: 'ayse.demir@example.com',
              authProvider: 'oidc',
              providerSubject: '2f7b9d1e-8a41-4c7e-9d63-0d6b3c9a5f22',
              isActive: true,
              lastLoginAt: null,
              createdAt: '2026-04-29T18:30:00.000Z',
            },
            roleAssignments: [],
            actionStoreAssignments: [],
            employee: {
              employeeId: '70000000-0000-4000-8000-000000000101',
              employeeCode: 'FM8375',
              firstName: 'Ayse',
              lastName: 'Demir',
              storeId: '10000000-0000-4000-8000-000000000021',
              storeCode: 'SM140',
              storeName: 'Marmara Park',
            },
          },
        },
      },
    })
  })

  await page.goto('/admin/auth')

  await expect(page.getByRole('heading', { name: 'Pilot kullanıcı bağlantısı' })).toBeVisible()
  await page.getByLabel('Pilot personel id').fill('70000000-0000-4000-8000-000000000101')
  await page.getByLabel('Pilot sağlayıcı subject').fill('2f7b9d1e-8a41-4c7e-9d63-0d6b3c9a5f22')
  await page.getByLabel('Pilot kullanıcı adı').fill('ayse.demir')
  await page.getByLabel('Pilot e-posta').fill('ayse.demir@example.com')
  await page.getByLabel('Pilot rolü').selectOption('STORE_MANAGER')
  await page.getByLabel('Pilot mağazaları').selectOption('10000000-0000-4000-8000-000000000021')
  await page.getByRole('button', { name: 'Pilot bağlantısı oluştur' }).click()

  await expect(page.getByText('Pilot user binding created')).toBeVisible()
  expect(requestBody?.roleCode).toBe('STORE_MANAGER')
  expect(requestBody?.storeIds).toEqual(['10000000-0000-4000-8000-000000000021'])
})

test('HR admin can search auth users and stores while creating assignments', async ({ page }) => {
  const userId = '90000000-0000-4000-8000-000000000201'
  const storeId = '10000000-0000-4000-8000-000000000021'
  const companyId = '10000000-0000-4000-8000-000000000001'
  const regionId = '10000000-0000-4000-8000-000000000011'
  let roleAssignmentBody: Record<string, unknown> | null = null
  let actionStoreBody: Record<string, unknown> | null = null

  await page.route('**/api/auth/lookups/users/search?**', async (route) => {
    const url = new URL(route.request().url())
    expect(url.searchParams.get('q')?.length).toBeGreaterThanOrEqual(2)
    await route.fulfill({
      json: {
        items: [
          {
            userId,
            username: 'store.manager',
            email: 'store.manager@example.com',
            authProvider: 'oidc',
            providerSubject: 'provider-subject-201',
          },
        ],
        meta: { query: url.searchParams.get('q'), count: 1, limit: 20 },
      },
    })
  })

  await page.route('**/api/auth/lookups/stores/search?**', async (route) => {
    const url = new URL(route.request().url())
    expect(url.searchParams.get('q')?.length).toBeGreaterThanOrEqual(2)
    await route.fulfill({
      json: {
        items: [
          {
            storeId,
            storeCode: 'SM140',
            storeName: 'Marmara Park',
            companyId,
            regionId,
            regionName: 'Marmara',
          },
        ],
        meta: { query: url.searchParams.get('q'), count: 1, limit: 20 },
      },
    })
  })

  await page.route('**/api/auth/role-assignments', async (route) => {
    roleAssignmentBody = route.request().postDataJSON()
    await route.fulfill({
      status: 201,
      json: {
        command: { status: 'created', message: 'Role assignment created' },
        data: { assignment: { assignmentId: 'assignment-1' } },
      },
    })
  })

  await page.route('**/api/auth/action-store-assignments', async (route) => {
    actionStoreBody = route.request().postDataJSON()
    await route.fulfill({
      status: 201,
      json: {
        command: { status: 'created', message: 'Action store assignment created' },
        data: { assignment: { assignmentId: 'action-store-assignment-1' } },
      },
    })
  })

  await page.goto('/admin/auth')

  await page.getByLabel('Rol yetkisi için kullanıcı ara').fill('manager')
  await expect(page.getByLabel('Rol yetkisi kullanıcısı')).toContainText('store.manager')
  await page.getByLabel('Rol yetkisi kullanıcısı').selectOption(userId)
  await page.getByLabel('Rol yetkisi rolü').selectOption('STORE_MANAGER')
  await page.getByLabel('Rol yetkisi kapsam tipi').selectOption('store')
  await page.getByLabel('Rol yetkisi için mağaza ara').fill('marmara')
  await expect(page.getByLabel('Rol yetkisi mağazası')).toContainText('SM140')
  await page.getByLabel('Rol yetkisi mağazası').selectOption(storeId)
  await page.getByRole('button', { name: 'Yetki oluştur' }).click()

  await expect(page.getByText('Role assignment created')).toBeVisible()
  expect(roleAssignmentBody).toMatchObject({
    userId,
    roleCode: 'STORE_MANAGER',
    scopeType: 'store',
    companyId,
    regionId,
    storeId,
  })

  await page.getByLabel('Aksiyon erişimi için kullanıcı ara').fill('manager')
  await expect(page.getByLabel('Aksiyon erişimi kullanıcısı')).toContainText('store.manager')
  await page.getByLabel('Aksiyon erişimi kullanıcısı').selectOption(userId)
  await page.getByLabel('Aksiyon erişimi için mağaza ara').fill('marmara')
  await expect(page.getByLabel('Aksiyon mağazası')).toContainText('SM140')
  await page.getByLabel('Aksiyon mağazası').selectOption(storeId)
  await page.getByRole('button', { name: 'Aksiyon mağazası ata' }).click()

  await expect(page.getByText('Action store assignment created')).toBeVisible()
  expect(actionStoreBody).toMatchObject({
    userId,
    storeId,
  })
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

async function routeAuthAdminApi(page: Page) {
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({ json: authSessionFixture })
  })

  await page.route('**/api/auth/lookups', async (route) => {
    await route.fulfill({ json: authLookupsFixture })
  })

  await page.route('**/api/auth/users?**', async (route) => {
    await route.fulfill({ json: { items: [], meta: { count: 0, total: 0, limit: 50, offset: 0 } } })
  })

  await page.route('**/api/auth/role-assignments?**', async (route) => {
    await route.fulfill({ json: { items: [], meta: { count: 0, total: 0, limit: 50, offset: 0 } } })
  })

  await page.route('**/api/auth/action-store-assignments?**', async (route) => {
    await route.fulfill({ json: { items: [], meta: { count: 0, total: 0, limit: 50, offset: 0 } } })
  })

  await page.route('**/api/auth/roles', async (route) => {
    await route.fulfill({ json: authRolesFixture })
  })

  await page.route('**/api/auth/permissions', async (route) => {
    await route.fulfill({ json: authPermissionsFixture })
  })
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
