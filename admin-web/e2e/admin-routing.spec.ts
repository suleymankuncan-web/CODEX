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

test('audit center switches chrome to English copy and persists locale', async ({ page }) => {
  await page.goto('/admin/audit')

  await expect(page.getByRole('heading', { name: 'Denetim merkezi' })).toBeVisible()
  await expect(page.getByText('Son görünür olaylar')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Hesap denetim kayıtları' })).toBeVisible()
  await expect(page.getByText('Audit Center')).toHaveCount(0)
  await expect(page.locator('body')).not.toContainText('Ã')
  await expect(page.locator('body')).not.toContainText('Ä')
  await expect(page.locator('body')).not.toContainText('Å')

  await page.locator('.language-toggle-button').filter({ hasText: 'EN' }).click()

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('heading', { name: 'Audit Center' })).toBeVisible()
  await expect(page.getByText('Recent trace')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Recent account audit entries' })).toBeVisible()
  await expect(page.getByText('Denetim merkezi')).toHaveCount(0)

  await page.reload()

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('heading', { name: 'Audit Center' })).toBeVisible()
})

test('master data list renders bootstrap batches when updatedAt is absent', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', (error) => {
    pageErrors.push(error.message)
  })

  await page.goto('/admin/master-data')

  await expect(page.getByRole('heading', { name: 'Hazırlık partileri' })).toBeVisible()
  await expect(page.getByText('Accepted personnel baseline')).toBeVisible()
  expect(pageErrors).toEqual([])
})

test('master data page switches chrome to English copy and persists locale', async ({ page }) => {
  await page.goto('/admin/master-data')

  await expect(page.getByRole('heading', { name: 'Ana veri hazırlığı' })).toBeVisible()
  await expect(page.getByText('İnceleme kuyruğu')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Hazırlık partileri' })).toBeVisible()
  await expect(page.getByText('Master data bootstrap')).toHaveCount(0)
  await expect(page.locator('body')).not.toContainText('Ã')
  await expect(page.locator('body')).not.toContainText('Ä')
  await expect(page.locator('body')).not.toContainText('Å')

  await page.locator('.language-toggle-button').filter({ hasText: 'EN' }).click()

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('heading', { name: 'Master data bootstrap' })).toBeVisible()
  await expect(page.getByText('Review queue')).toBeVisible()
  await expect(
    page.getByText(
      'Open a batch to inspect row evidence, dry-run evidence, readiness counters, and promotion state.',
    ),
  ).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Bootstrap batches' })).toBeVisible()
  await expect(page.getByText('Ana veri hazırlığı')).toHaveCount(0)

  await page.reload()

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('heading', { name: 'Master data bootstrap' })).toBeVisible()
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

  await page.route('**/api/integrations/master-data-bootstrap/batches?**', async (route) => {
    await route.fulfill({
      json: {
        items: [
          {
            batchId: '8a1506af-b043-4968-9d75-d10c8d4432d5',
            companyId: '00000000-0000-0000-0000-000000000001',
            bootstrapEntity: 'personnel',
            sourceLabel: 'Accepted personnel baseline',
            fileReference: 'personnel-master-mapping-prep.xlsx#chunk-9',
            uploadedByUserId: 'admin-routing-user',
            batchStatus: 'promoted',
            rowCount: 5,
            pendingCount: 0,
            validCount: 0,
            needsReviewCount: 0,
            invalidCount: 0,
            promotedCount: 5,
            createdAt: '2026-05-04T11:51:26.982Z',
            validatedAt: '2026-05-04T11:51:27.289Z',
            promotedAt: '2026-05-04T11:52:42.761Z',
            readiness: 'closed',
            nextAction: 'closed',
          },
        ],
        meta: { count: 1, total: 10, limit: 1, offset: 0 },
      },
    })
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
