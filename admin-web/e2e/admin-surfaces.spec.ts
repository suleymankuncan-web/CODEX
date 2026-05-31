import { expect, test, type Page } from './test-fixtures'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('store-ops-app-locale', 'en')
    window.localStorage.setItem(
      'store-ops-admin-session',
      JSON.stringify({
        mode: 'mock',
        mockUserId: 'admin-surfaces-smoke',
        mockRoleCodes: 'SUPER_ADMIN',
        mockCompanyIds: '00000000-0000-0000-0000-000000000001',
        bearerToken: '',
      }),
    )
  })

  await routeSuperAdminSession(page)
})

test('PR-3 migrated admin read surfaces render with honest empty states', async ({ page }) => {
  await routePilotFeedback(page)
  await page.goto('/admin/pilot-feedback')
  await expect(page.getByRole('heading', { name: 'Pilot feedback is classified in one queue.' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'No feedback visible' })).toBeVisible()

  await routeDataQuality(page)
  await page.goto('/admin/data-quality')
  await expect(page.getByRole('heading', { name: 'Data defects are separated from product issues.' })).toBeVisible()
  await expect(page.getByTestId('admin-metric-totalPressure')).toContainText('2')
  await expect(page.getByText('No pending import or mapping action.')).toBeVisible()
  await expect(page.getByText('No pending snapshot action.')).toBeVisible()

  await routeAdminInbox(page)
  await page.goto('/admin/inbox')
  await expect(page.getByRole('heading', { name: 'One queue for admin-side approvals and KPI follow-up.' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'No admin-side queue items' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'No seller code requests are pending.' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'No offboarding requests are pending.' })).toBeVisible()
})

async function routeSuperAdminSession(page: Page) {
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({
      json: {
        authMode: 'mock',
        authenticated: true,
        user: {
          userId: 'admin-surfaces-smoke',
          employeeId: null,
          roleCodes: ['SUPER_ADMIN'],
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
      },
    })
  })
}

async function routePilotFeedback(page: Page) {
  await page.route('**/api/admin/pilot-feedback**', async (route) => {
    await route.fulfill({
      json: {
        items: [],
        meta: {
          count: 0,
          total: 0,
          limit: 20,
          offset: 0,
        },
      },
    })
  })
}

async function routeDataQuality(page: Page) {
  await page.route('**/api/integrations/import-batches/overview', async (route) => {
    await route.fulfill({ json: emptyImportOverview })
  })
  await page.route('**/api/integrations/import-batches/needs-action?**', async (route) => {
    await route.fulfill({ json: emptyList })
  })
  await page.route('**/api/snapshots/runs/overview', async (route) => {
    await route.fulfill({ json: emptySnapshotOverview })
  })
  await page.route('**/api/snapshots/runs/needs-action?**', async (route) => {
    await route.fulfill({ json: emptyList })
  })
  await page.route('**/api/workforce/seller-code-requests?**', async (route) => {
    await route.fulfill({ json: emptyList })
  })
  await page.route('**/api/workforce/offboarding-requests?**', async (route) => {
    await route.fulfill({ json: emptyList })
  })
  await page.route('**/api/reports/kpi-config', async (route) => {
    await route.fulfill({ json: { metadata: { publishedAt: null, versionNo: null } } })
  })
  await page.route('**/api/reports/rankings?**', async (route) => {
    await route.fulfill({ json: { source: { periodStart: null, periodEnd: null } } })
  })
}

async function routeAdminInbox(page: Page) {
  await page.route('**/api/workflow/inbox', async (route) => {
    await route.fulfill({ json: { items: [] } })
  })
  await page.route('**/api/workforce/seller-code-reference**', async (route) => {
    await route.fulfill({ json: { lastSellerCode: null, nextSellerCodePreview: null } })
  })
  await page.route('**/api/workforce/seller-code-requests**', async (route) => {
    await route.fulfill({ json: emptyList })
  })
  await page.route('**/api/workforce/offboarding-requests**', async (route) => {
    await route.fulfill({ json: emptyList })
  })
}

const emptyList = {
  items: [],
  meta: {
    count: 0,
    total: 0,
    limit: 50,
    offset: 0,
  },
}

const emptyImportOverview = {
  totals: {
    all: 0,
    completed: 0,
    failed: 0,
    completedWithErrors: 0,
    pending: 0,
    queued: 0,
    processing: 0,
  },
  healthTotals: {
    healthy: 0,
    inProgress: 0,
    blocked: 0,
    retryReady: 0,
    needsAction: 0,
    stuck: 0,
  },
  actionTotals: {
    blocked: 0,
    retryReady: 0,
    needsAction: 0,
    stuck: 0,
  },
  latest: {
    completedBatchId: null,
    failedBatchId: null,
    inProgressBatchId: null,
    stuckBatchId: null,
  },
}

const emptySnapshotOverview = {
  totals: {
    all: 0,
    queued: 0,
    running: 0,
    completed: 0,
    failed: 0,
  },
  healthTotals: {
    healthy: 0,
    inProgress: 0,
    retryReady: 0,
    needsAction: 0,
    stuck: 0,
  },
  actionTotals: {
    retryReady: 0,
    stuck: 0,
  },
  latest: {
    completedSnapshotRunId: null,
    failedSnapshotRunId: null,
    inProgressSnapshotRunId: null,
    stuckSnapshotRunId: null,
  },
}
