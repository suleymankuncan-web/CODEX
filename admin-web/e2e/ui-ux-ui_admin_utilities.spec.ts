import { expect, test, type Page } from './test-fixtures'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('store-ops-app-locale', 'en')
    window.localStorage.setItem(
      'store-ops-admin-session',
      JSON.stringify({
        mode: 'mock',
        mockUserId: 'audit-recovery-admin',
        mockRoleCodes: 'SUPER_ADMIN,AUDITOR',
        mockCompanyIds: '10000000-0000-4000-8000-000000000001',
        bearerToken: '',
      }),
    )
  })

  await routeSessionAndOperationalAuditSources(page)
})

test('audit center keeps available sections visible and retries a failed primary source', async ({ page }) => {
  let userAttempts = 0
  await page.route('**/api/auth/users?**', async (route) => {
    userAttempts += 1
    if (userAttempts <= 4) {
      await route.fulfill({ status: 503, json: { message: 'temporary failure' } })
      return
    }

    await route.fulfill({ json: userListFixture })
  })
  await page.route('**/api/auth/users/user-1/audit**', async (route) => {
    await route.fulfill({ json: emptyListFixture })
  })

  await page.goto('/admin/audit')

  const main = page.getByRole('main')
  await expect(main.getByRole('heading', { name: 'Audit Center' })).toBeVisible()
  await expect(main.getByText('Some audit sources could not be loaded')).toBeVisible()
  await expect(main.getByText('This audit source could not be loaded right now.')).toBeVisible()
  await expect(main.getByRole('heading', { name: 'Scoped access audit trails' })).toBeVisible()

  await main.getByRole('button', { name: 'Try again' }).click()

  await expect(main.getByText('Some audit sources could not be loaded')).toHaveCount(0)
  await expect(main.getByText('super.admin', { exact: true })).toBeVisible()
  expect(userAttempts).toBe(5)
})

test('audit center marks missing recent auth traces and retries them', async ({ page }) => {
  let traceAttempts = 0
  await page.route('**/api/auth/users?**', async (route) => {
    await route.fulfill({ json: userListFixture })
  })
  await page.route('**/api/auth/users/user-1/audit**', async (route) => {
    traceAttempts += 1
    if (traceAttempts <= 4) {
      await route.fulfill({ status: 503, json: { message: 'temporary failure' } })
      return
    }

    await route.fulfill({ json: userAuditFixture })
  })

  await page.goto('/admin/audit')

  const main = page.getByRole('main')
  await expect(main.getByText('Some auth traces could not be loaded')).toBeVisible()
  await expect(main.getByText('Incomplete', { exact: true })).toBeVisible()

  await main.getByRole('button', { name: 'Try again' }).click()

  await expect(main.getByText('Some auth traces could not be loaded')).toHaveCount(0)
  await expect(main.getByText('USER_UPDATED')).toBeVisible()
  await expect(main.getByText('Live slice', { exact: true })).toBeVisible()
  expect(traceAttempts).toBe(5)
})

test('audit center removes cached traces when their source read is denied', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-22T09:00:00Z'))
  let denyUsers = false
  await page.route('**/api/auth/users?**', route => denyUsers
    ? route.fulfill({ status: 403, json: { message: 'Forbidden' } })
    : route.fulfill({ json: userListFixture }))
  await page.route('**/api/auth/users/user-1/audit**', route => route.fulfill({ json: userAuditFixture }))
  await page.goto('/admin/audit')
  await expect(page.getByText('USER_UPDATED', { exact: true })).toBeVisible()
  denyUsers = true
  await page.clock.setFixedTime(new Date('2026-09-22T09:02:00Z'))
  await page.getByRole('link', { name: 'Session', exact: true }).click()
  await page.getByRole('link', { name: 'Audit', exact: true }).click()
  await expect(page.getByText('Some audit sources could not be loaded')).toBeVisible()
  await expect(page.getByText('USER_UPDATED', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Scoped access audit trails' })).toBeVisible()
})

async function routeSessionAndOperationalAuditSources(page: Page) {
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({ json: authSessionFixture })
  })
  await page.route('**/api/auth/role-assignments?**', async (route) => {
    await route.fulfill({ json: emptyListFixture })
  })
  await page.route('**/api/integrations/import-batches/needs-action?**', async (route) => {
    await route.fulfill({ json: emptyListFixture })
  })
  await page.route('**/api/snapshots/runs/needs-action?**', async (route) => {
    await route.fulfill({ json: emptyListFixture })
  })
}

const authSessionFixture = {
  authMode: 'mock',
  authenticated: true,
  user: {
    userId: 'audit-recovery-admin',
    employeeId: null,
    roleCodes: ['SUPER_ADMIN', 'AUDITOR'],
    scope: { companyIds: [], regionIds: [], storeIds: [] },
    readScope: { companyIds: [], regionIds: [], storeIds: [] },
    actionScope: { assignedStoreIds: [] },
    assignedStoreIds: [],
  },
  scopeSummary: { companyCount: 0, regionCount: 0, storeCount: 0, assignedStoreCount: 0 },
}

const userFixture = {
  userId: 'user-1',
  employeeId: null,
  username: 'super.admin',
  email: 'super.admin@example.com',
  authProvider: 'mock',
  providerSubject: 'user-1',
  isActive: true,
  lastLoginAt: null,
  createdAt: '2026-09-22T08:00:00.000Z',
}

const userListFixture = {
  items: [userFixture],
  meta: { count: 1, total: 1, limit: 50, offset: 0 },
}

const userAuditFixture = {
  items: [
    {
      eventLogId: 'event-1',
      occurredAt: '2026-09-22T08:30:00.000Z',
      actorUserId: 'audit-recovery-admin',
      correlationId: 'correlation-1',
      eventType: 'USER_UPDATED',
      metadata: {},
    },
  ],
  meta: { count: 1, total: 1, limit: 1, offset: 0 },
}

const emptyListFixture = {
  items: [],
  meta: { count: 0, total: 0, limit: 50, offset: 0 },
}
