import { expect, test, type Page } from '@playwright/test'

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

  await expect(page.getByRole('heading', { name: 'Pilot user binding' })).toBeVisible()
  await page.getByLabel('Pilot employee id').fill('70000000-0000-4000-8000-000000000101')
  await page.getByLabel('Pilot provider subject').fill('2f7b9d1e-8a41-4c7e-9d63-0d6b3c9a5f22')
  await page.getByLabel('Pilot username').fill('ayse.demir')
  await page.getByLabel('Pilot email').fill('ayse.demir@example.com')
  await page.getByLabel('Pilot role').selectOption('STORE_MANAGER')
  await page.getByLabel('Pilot stores').selectOption('10000000-0000-4000-8000-000000000021')
  await page.getByRole('button', { name: 'Create pilot binding' }).click()

  await expect(page.getByText('Pilot user binding created')).toBeVisible()
  expect(requestBody?.roleCode).toBe('STORE_MANAGER')
  expect(requestBody?.storeIds).toEqual(['10000000-0000-4000-8000-000000000021'])
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
