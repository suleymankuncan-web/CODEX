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
            firstName: 'Zeliha', lastName: 'Durmaz',
            email: 'report.viewer@example.com', authProvider: 'oidc',
            providerSubject: null, isActive: false, identityLifecycleStatus: 'pending',
            lastLoginAt: null, createdAt: '2026-08-29T09:00:00.000Z',
          },
        },
      },
    })
  })

  await page.goto('/admin/auth')
  await page.getByRole('button', { name: 'Kullanıcı ekle' }).click()
  const dialog = page.getByRole('dialog', { name: 'Kullanıcı ekle' })
  await expect(dialog).toContainText('Keycloak hesabı otomatik oluşturulur')
  await dialog.getByLabel('Ad', { exact: true }).fill('Zeliha')
  await dialog.getByLabel('Soyad').fill('Durmaz')
  await dialog.getByLabel('Kullanıcı adı').fill('report.viewer')
  await expect(dialog.getByLabel('Ad', { exact: true })).toHaveValue('Zeliha')
  await expect(dialog.getByLabel('Soyad')).toHaveValue('Durmaz')
  await dialog.getByLabel('E-posta').fill('report.viewer@example.com')
  await dialog.getByRole('button', { name: 'Oluştur' }).click()

  await expect(dialog).toBeHidden()
  expect(requestBody).toEqual({
    username: 'report.viewer',
    firstName: 'Zeliha',
    lastName: 'Durmaz',
    email: 'report.viewer@example.com',
    authProvider: 'oidc',
  })
})

test('HR admin edits profile fields without losing uppercase names', async ({ page }) => {
  let requestBody: Record<string, unknown> | null = null
  await page.route('**/api/auth/users/user-active', async (route) => {
    if (route.request().method() !== 'PATCH') return route.fallback()
    requestBody = route.request().postDataJSON()
    await route.fulfill({ json: {
      command: { status: 'updated', message: 'Updated' },
      data: { user: { ...usersFixture.items[0], ...requestBody } },
    } })
  })

  await page.goto('/admin/auth')
  await page.getByRole('button', { name: 'Bilgileri düzenle' }).click()
  const dialog = page.getByRole('dialog', { name: 'Kullanıcı bilgilerini düzenle' })
  await dialog.getByLabel('Ad', { exact: true }).fill('SÜLEYMAN')
  await dialog.getByLabel('Soyad').fill('KUNCAN')
  await dialog.getByLabel('Kullanıcı adı').fill('suleyman.kuncan')
  await expect(dialog.getByLabel('Ad', { exact: true })).toHaveValue('SÜLEYMAN')
  await expect(dialog.getByLabel('Soyad')).toHaveValue('KUNCAN')
  await dialog.getByRole('button', { name: 'Kaydet' }).click()

  await expect(dialog).toBeHidden()
  expect(requestBody).toEqual({
    username: 'suleyman.kuncan', firstName: 'SÜLEYMAN', lastName: 'KUNCAN',
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

test('role assignment dialog resets across users and close cycles', async ({ page }) => {
  const roleAssignmentBodies: Array<Record<string, unknown>> = []
  await page.route('**/api/auth/role-assignments', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback()
    roleAssignmentBodies.push(route.request().postDataJSON())
    await route.fulfill({ status: 201, json: { command: { status: 'created', message: 'Assigned' }, data: { assignment: {} } } })
  })

  await page.goto('/admin/auth')
  const main = page.getByRole('main')
  await expect(main.getByRole('button', { name: 'Rol ekle' })).toBeEnabled()
  await main.getByRole('button', { name: 'Rol ekle' }).click()
  const roleDialog = page.getByRole('dialog', { name: 'Rol ekle' })

  await roleDialog.getByLabel('Rol').click()
  await expect(page.getByRole('option', { name: 'Sistem yöneticisi' })).toBeVisible()
  await page.getByRole('option', { name: 'Mağaza müdürü' }).click()
  await roleDialog.getByLabel('Rol mağazası').click()
  await page.getByRole('option', { name: 'Demo Store' }).click()
  await expect(roleDialog.getByRole('button', { name: 'Rolü ata' })).toBeEnabled()
  await roleDialog.getByRole('button', { name: 'Vazgeç' }).click()
  await expect(roleDialog).toBeHidden()

  await main.getByLabel('Kullanıcı listesi').getByRole('button', { name: /inactive\.user/ }).click()
  await main.getByRole('button', { name: 'Rol ekle' }).click()
  const reopenedDialog = page.getByRole('dialog', { name: 'Rol ekle' })
  await expect(reopenedDialog.getByLabel('Rol')).toContainText('Rol seçin')
  await expect(reopenedDialog.getByLabel('Rol mağazası')).toHaveCount(0)
  await expect(reopenedDialog.getByRole('button', { name: 'Rolü ata' })).toBeDisabled()
  expect(roleAssignmentBodies).toHaveLength(0)
})

test('role assignment dialog blocks a write after background assignment refetch failure', async ({ page }) => {
  const roleAssignmentBodies: Array<Record<string, unknown>> = []
  let roleAssignmentGets = 0
  await page.route('**/api/auth/role-assignments?**', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback()
    roleAssignmentGets += 1
    if (roleAssignmentGets === 1) return route.fulfill({ json: emptyList })
    await route.fulfill({ status: 500, json: { message: 'Role assignments unavailable' } })
  })
  await page.route('**/api/auth/role-assignments', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback()
    roleAssignmentBodies.push(route.request().postDataJSON())
    await route.fulfill({ status: 201, json: { command: { status: 'created', message: 'Assigned' }, data: { assignment: {} } } })
  })

  await page.goto('/admin/auth')
  const main = page.getByRole('main')
  await expect(main.getByRole('button', { name: 'Rol ekle' })).toBeEnabled()
  await main.getByRole('button', { name: 'Rol ekle' }).click()
  const roleDialog = page.getByRole('dialog', { name: 'Rol ekle' })
  await roleDialog.getByLabel('Rol').click()
  await page.getByRole('option', { name: 'Mağaza müdürü' }).click()
  await roleDialog.getByLabel('Rol mağazası').click()
  await page.getByRole('option', { name: 'Demo Store' }).click()
  await expect(roleDialog.getByRole('button', { name: 'Rolü ata' })).toBeEnabled()

  await triggerAuthBackgroundRefetch(page)
  await expect.poll(() => roleAssignmentGets).toBeGreaterThan(1)
  await expect(roleDialog.getByRole('alert')).toContainText('Güncel rol ve kapsam alınamadı')
  await expect(roleDialog.getByRole('button', { name: 'Rolü ata' })).toBeDisabled()
  await roleDialog.getByRole('button', { name: 'Rolü ata' }).dispatchEvent('click')
  expect(roleAssignmentBodies).toHaveLength(0)
})

test('store assignment dialog blocks a write after background assignment refetch failure', async ({ page }) => {
  const storeAssignmentBodies: Array<Record<string, unknown>> = []
  let storeAssignmentGets = 0
  await page.route('**/api/auth/action-store-assignments?**', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback()
    storeAssignmentGets += 1
    if (storeAssignmentGets === 1) return route.fulfill({ json: emptyList })
    await route.fulfill({ status: 500, json: { message: 'Store assignments unavailable' } })
  })
  await page.route('**/api/auth/action-store-assignments/batch', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback()
    storeAssignmentBodies.push(route.request().postDataJSON())
    await route.fulfill({ status: 201, json: { command: { status: 'created', message: 'Assigned' }, data: { assignments: [] } } })
  })

  await page.goto('/admin/auth')
  const main = page.getByRole('main')
  await expect(main.getByRole('button', { name: 'Mağaza ekle' })).toBeEnabled()
  await main.getByRole('button', { name: 'Mağaza ekle' }).click()
  const storeDialog = page.getByRole('dialog', { name: 'Mağaza erişimi ekle' })
  await storeDialog.getByRole('button', { name: /Demo Store/ }).click()
  await expect(storeDialog.getByRole('button', { name: 'Seçilenlere erişim ver' })).toBeEnabled()

  await triggerAuthBackgroundRefetch(page)
  await expect.poll(() => storeAssignmentGets).toBeGreaterThan(1)
  await expect(storeDialog.getByRole('alert')).toContainText('Güncel mağaza erişimi ve mağaza listesi alınamadı')
  await expect(storeDialog.getByRole('button', { name: 'Seçilenlere erişim ver' })).toBeDisabled()
  await storeDialog.getByRole('button', { name: 'Seçilenlere erişim ver' }).dispatchEvent('click')
  expect(storeAssignmentBodies).toHaveLength(0)
})

test('role assignment failure stays fail-closed without blocking store access', async ({ page }) => {
  await page.route('**/api/auth/role-assignments?**', async (route) => {
    await route.fulfill({ status: 500, json: { message: 'Role assignments unavailable' } })
  })

  await page.goto('/admin/auth')
  const main = page.getByRole('main')
  const roleBlock = main.getByText('Roller', { exact: true }).locator('..').locator('..')
  const storeBlock = main.getByText('Mağaza erişimi', { exact: true }).locator('..').locator('..')

  await expect(roleBlock.getByRole('alert')).toContainText('Roller alınamadı')
  await expect(roleBlock.getByText('Rol ataması yok', { exact: true })).toHaveCount(0)
  await expect(roleBlock.getByRole('button', { name: 'Rol ekle' })).toBeDisabled()
  await expect(storeBlock.getByText('Doğrudan mağaza erişimi yok', { exact: true })).toBeVisible()
  await expect(storeBlock.getByRole('button', { name: 'Mağaza ekle' })).toBeEnabled()
})

test('store assignment failure stays fail-closed without blocking role access', async ({ page }) => {
  await page.route('**/api/auth/action-store-assignments?**', async (route) => {
    await route.fulfill({ status: 500, json: { message: 'Store assignments unavailable' } })
  })

  await page.goto('/admin/auth')
  const main = page.getByRole('main')
  const roleBlock = main.getByText('Roller', { exact: true }).locator('..').locator('..')
  const storeBlock = main.getByText('Mağaza erişimi', { exact: true }).locator('..').locator('..')

  await expect(storeBlock.getByRole('alert')).toContainText('Mağaza erişimi alınamadı')
  await expect(storeBlock.getByText('Doğrudan mağaza erişimi yok', { exact: true })).toHaveCount(0)
  await expect(storeBlock.getByRole('button', { name: 'Mağaza ekle' })).toBeDisabled()
  await expect(roleBlock.getByText('Rol ataması yok', { exact: true })).toBeVisible()
  await expect(roleBlock.getByRole('button', { name: 'Rol ekle' })).toBeEnabled()
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

async function triggerAuthBackgroundRefetch(page: Page) {
  let deactivationRequests = 0
  await page.route('**/api/auth/users/user-active/deactivate', async (route) => {
    if (route.request().method() !== 'PATCH') return route.fallback()
    deactivationRequests += 1
    await route.fulfill({
      json: {
        command: { status: 'deactivated', message: 'Deactivated' },
        data: { accessClosure: { closedRoleAssignments: 0, closedActionStoreAssignments: 0 } },
      },
    })
  })
  await page.locator('button').filter({ hasText: 'Devre dışı bırak' }).first().dispatchEvent('click')
  const deactivateDialog = page.getByRole('dialog', { name: 'Hesap devre dışı bırakılsın mı?' })
  await deactivateDialog.getByRole('button', { name: 'Devre dışı bırak' }).click()
  await expect.poll(() => deactivationRequests).toBe(1)
}

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

const emptyList = { items: [], meta: { count: 0, total: 0, limit: 200, offset: 0 } }


test('Prim Onayı is individual, persists across reload and can be revoked', async ({ page }) => {
  let enabled = false
  const changes: boolean[] = []
  await page.route('**/api/auth/role-assignments?**', (route) => route.fulfill({ json: {
    items: [{ assignmentId: 'viewer-assignment', userId: 'user-active', roleCode: 'REPORT_VIEWER', roleName: 'Viewer', scopeType: 'company', companyId: 'company-1', regionId: null, storeId: null, active: true, incentiveApproval: enabled }], meta: { total: 1, count: 1, limit: 100, offset: 0 },
  } }))
  await page.route('**/api/auth/role-assignments/viewer-assignment/incentive-approval', async (route) => {
    expect(route.request().method()).toBe('PATCH')
    enabled = route.request().postDataJSON().enabled
    changes.push(enabled)
    await route.fulfill({ json: { command: { status: 'updated' }, data: { assignment: { incentiveApproval: enabled } } } })
  })
  await page.goto('/admin/auth')
  const checkbox = page.getByRole('checkbox', { name: 'Prim Onayı' })
  await expect(checkbox).not.toBeChecked()
  await checkbox.click()
  await expect(checkbox).toBeChecked()
  await page.reload()
  await expect(checkbox).toBeChecked()
  await checkbox.click()
  await expect(checkbox).not.toBeChecked()
  expect(changes).toEqual([true, false])
})

test('new Report Viewer assignment includes opt-in Prim Onayı and resets it on role change', async ({ page }) => {
  await page.route('**/api/auth/lookups', (route) => route.fulfill({ json: { ...lookupsFixture, roles: [...lookupsFixture.roles, { roleCode: 'REPORT_VIEWER', roleName: 'Viewer', scopeType: 'company' }] } }))
  let payload: unknown
  await page.route('**/api/auth/role-assignments', async (route) => {
    payload = route.request().postDataJSON()
    await route.fulfill({ status: 201, json: { command: { status: 'created' }, data: { assignment: {} } } })
  })
  await page.goto('/admin/auth')
  await page.getByRole('button', { name: 'Rol ekle' }).click()
  const dialog = page.getByRole('dialog', { name: 'Rol ekle' })
  await dialog.getByLabel('Rol', { exact: true }).click()
  await page.getByRole('option', { name: 'Rapor görüntüleyici' }).click()
  await expect(dialog.getByRole('checkbox', { name: 'Prim Onayı' })).not.toBeChecked()
  await dialog.getByRole('checkbox', { name: 'Prim Onayı' }).check()
  await dialog.getByLabel('Rol', { exact: true }).click()
  await page.getByRole('option', { name: 'Sistem yöneticisi' }).click()
  await expect(dialog.getByRole('checkbox', { name: 'Prim Onayı' })).toHaveCount(0)
  await dialog.getByLabel('Rol', { exact: true }).click()
  await page.getByRole('option', { name: 'Rapor görüntüleyici' }).click()
  await expect(dialog.getByRole('checkbox', { name: 'Prim Onayı' })).not.toBeChecked()
  await dialog.getByRole('checkbox', { name: 'Prim Onayı' }).check()
  await dialog.getByRole('button', { name: 'Rolü ata' }).click()
  await expect.poll(() => payload).toMatchObject({ userId: 'user-active', roleCode: 'REPORT_VIEWER', scopeType: 'company', companyId: 'company-1', incentiveApproval: true })
})
