import type { Page } from './test-fixtures'

export async function routeAuthManagementApi(page: Page) {
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
  await page.route('**/api/auth/user-permission-assignments?**', (route) => route.fulfill({ json: emptyList }))
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

export const usersFixture = {
  items: [
    { userId: 'user-active', employeeId: null, username: 'store.manager', email: 'store.manager@example.com', authProvider: 'clerk', providerSubject: 'user_store', isActive: true, lastLoginAt: null, createdAt: '2026-08-01T09:00:00.000Z' },
    { userId: 'user-inactive', employeeId: null, username: 'inactive.user', email: 'inactive@example.com', authProvider: 'clerk', providerSubject: 'user_inactive', isActive: false, lastLoginAt: null, createdAt: '2026-08-01T09:00:00.000Z' },
  ],
  meta: { count: 2, total: 2, limit: 10, offset: 0 },
}

export const lookupsFixture = {
  scopeTypes: ['company', 'region', 'store'], authProviders: ['clerk'], users: [], permissions: [],
  roles: [
    { roleId: 'role-super-admin', roleCode: 'SUPER_ADMIN', roleName: 'Super Admin', scopeType: 'company' },
    { roleId: 'role-store-manager', roleCode: 'STORE_MANAGER', roleName: 'Store Manager', scopeType: 'store' },
  ],
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

export const emptyList = { items: [], meta: { count: 0, total: 0, limit: 200, offset: 0 } }
