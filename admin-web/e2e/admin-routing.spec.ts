import { expect, test, type Page } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'store-ops-admin-session',
      JSON.stringify({
        mode: 'mock',
        mockUserId: 'admin-routing-user',
        mockRoleCodes: 'SUPER_ADMIN,INTEGRATION_ADMIN,HR_ADMIN,REPORT_VIEWER,AUDITOR',
        mockCompanyIds: '00000000-0000-0000-0000-000000000001',
        bearerToken: '',
      }),
    )
  })

  await routeAdminShellApi(page)
})

test('session nav opens the session readiness surface for ready admin sessions', async ({ page }) => {
  await page.goto('/admin/session')

  await expect(page).toHaveURL(/\/admin\/session$/)
  await expect(page.getByRole('heading', { name: /Prepare the shell for real auth/i })).toBeVisible()
})

test('audit center user detail links stay inside the audit namespace', async ({ page }) => {
  await page.goto('/admin/audit')

  const userAuditLink = page.locator('a[href$="/users/user-1/audit"]').first()
  await expect(userAuditLink).toHaveAttribute('href', '/admin/audit/users/user-1/audit')
  await userAuditLink.click()

  await expect(page).toHaveURL(/\/admin\/audit\/users\/user-1\/audit$/)
  await expect(page.getByRole('heading', { name: /User account audit trail/i })).toBeVisible()
  await expect(page.getByRole('link', { name: /Back to audit center/i })).toBeVisible()
})

async function routeAdminShellApi(page: Page) {
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({ json: authSessionFixture })
  })

  await page.route('**/api/auth/users?**', async (route) => {
    await route.fulfill({
      json: {
        items: [
          {
            userId: 'user-1',
            employeeId: null,
            username: 'admin.user',
            email: 'admin@example.com',
            authProvider: 'oidc',
            providerSubject: 'provider-user-1',
            isActive: true,
            lastLoginAt: null,
            createdAt: '2026-05-01T09:00:00.000Z',
          },
        ],
        meta: { count: 1, total: 1, limit: 50, offset: 0 },
      },
    })
  })

  await page.route('**/api/auth/role-assignments?**', async (route) => {
    await route.fulfill({ json: emptyListFixture })
  })

  await page.route('**/api/auth/users/user-1/audit', async (route) => {
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
    userId: 'admin-routing-user',
    employeeId: null,
    roleCodes: ['SUPER_ADMIN', 'INTEGRATION_ADMIN', 'HR_ADMIN', 'REPORT_VIEWER', 'AUDITOR'],
    scope: {
      companyIds: ['00000000-0000-0000-0000-000000000001'],
      regionIds: [],
      storeIds: [],
    },
    readScope: {
      companyIds: ['00000000-0000-0000-0000-000000000001'],
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

const emptyListFixture = {
  items: [],
  meta: {
    count: 0,
    total: 0,
    limit: 50,
    offset: 0,
  },
}
