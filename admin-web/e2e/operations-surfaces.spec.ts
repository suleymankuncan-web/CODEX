import { expect, test, type Page } from './test-fixtures'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('store-ops-app-locale', 'en')
    window.localStorage.setItem(
      'store-ops-admin-session',
      JSON.stringify({
        mode: 'mock',
        mockUserId: 'operations-admin',
        mockRoleCodes: 'SUPER_ADMIN',
        mockCompanyIds: '00000000-0000-0000-0000-000000000001',
        bearerToken: '',
      }),
    )
  })

  await routeReadyOperationsApi(page)
})

test('operations surface uses AdminSurface primitives without legacy dashboard classes', async ({ page }) => {
  await page.goto('/admin/operations')

  await expect(page.getByText('Operations Control Tower')).toBeVisible()
  await expect(page.getByTestId('admin-metric-readiness')).toContainText('Ready')
  await expect(page.getByTestId('admin-metric-operator-pressure')).toContainText('0')
  await expect(page.getByTestId('operations-metric-coverage')).toBeVisible()
  await expect(page.getByTestId('operations-action-list')).toBeVisible()
  await expect(page.getByTestId('operations-signal-freshness')).toContainText('Live')
  await expect(page.getByTestId('operations-backend-signal')).toContainText('Ready')
  await expect(page.getByTestId('operations-api-failure-snapshot')).toContainText('No API failures were captured in this browser session.')

  await expect(
    page.locator('.hero-panel, .metric-card, .accent-chip, .panel-heading, .queue-row, .key-item, .status-pill'),
  ).toHaveCount(0)
})

test('operations surface reads local sanitized API failure diagnostics', async ({ page }) => {
  await page.addInitScript(() => {
    window.__STORE_OPS_API_FAILURES__ = [
      {
        event: 'api.failure',
        route: '/admin/operations?tab=:value',
        method: 'GET',
        path: '/reports/rankings/:uuid',
        queryKeys: ['limit', 'periodStart'],
        status: 503,
        durationMs: 127,
        retryable: true,
        requestAttempt: 2,
        errorCategory: 'http',
        errorMessage: 'Request failed with status 503',
        requestId: 'req-ops-1',
        occurredAt: '2026-06-08T10:00:00.000Z',
      },
    ]
  })

  await page.goto('/admin/operations')

  const snapshot = page.getByTestId('operations-api-failure-snapshot')
  await expect(snapshot).toContainText('Recent API failure snapshot')
  await expect(snapshot).toContainText('window.__STORE_OPS_API_FAILURES__')
  await expect(snapshot).toContainText('No provider, backend endpoint, DB record, or alert delivery was added')
  await expect(snapshot).toContainText('/reports/rankings/:uuid')
  await expect(snapshot).toContainText('GET / 503 / http')
  await expect(snapshot).toContainText('Retryable')
  await expect(snapshot).toContainText('query: limit, periodStart')
  await expect(snapshot).toContainText('request: req-ops-1')
  await expect(snapshot).toContainText('127 ms')
})

test('operations surface remains mobile-width bounded', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/admin/operations')

  await expect(page.getByText('Operations Control Tower')).toBeVisible()

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(1)
})

test('Azure operations views and admin navigation stay usable across screen sizes', async ({ page }, testInfo) => {
  const writes: string[] = []
  page.on('request', (request) => {
    if (request.url().includes('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) {
      writes.push(`${request.method()} ${new URL(request.url()).pathname}`)
    }
  })

  for (const viewport of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }, { width: 390, height: 844 }, { width: 360, height: 800 }]) {
    await page.setViewportSize(viewport)
    await page.goto('/admin/operations')
    await expect(page.getByRole('heading', { name: 'Operations Control Tower', exact: true })).toBeVisible()
    await expect(page.getByTestId('operations-action-list')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
    await page.screenshot({ path: testInfo.outputPath(`operations-${viewport.width}.png`) })

    await page.getByRole('tab', { name: 'Work queues', exact: true }).click()
    await expect(page.getByTestId('operations-workforce-signal')).toBeVisible()
    await expect(page.getByTestId('operations-backend-signal')).toHaveCount(0)
    await page.getByRole('tab', { name: 'System status', exact: true }).click()
    await expect(page.getByTestId('operations-backend-signal')).toBeVisible()
    await expect(page.getByTestId('operations-workforce-signal')).toHaveCount(0)
    await page.getByRole('tab', { name: 'All signals', exact: true }).click()
    await expect(page.getByTestId('operations-workforce-signal')).toBeVisible()

    if (viewport.width < 760) {
      const menu = page.locator('.admin-command-mobile-toolbar button')
      await menu.click()
      const drawer = page.getByRole('dialog')
      await expect(drawer).toBeVisible()
      await expect(drawer.getByRole('link', { name: 'Operations', exact: true })).toBeVisible()
      await page.screenshot({ path: testInfo.outputPath(`admin-navigation-${viewport.width}.png`) })
      await page.keyboard.press('Escape')
      await expect(drawer).toHaveCount(0)
      await expect(menu).toBeFocused()
    } else {
      const toggle = page.locator('.admin-command-sidebar-toggle')
      await toggle.click()
      await expect(toggle).toHaveAttribute('aria-expanded', 'false')
      await expect(page.locator('.admin-command-app')).toHaveClass(/admin-command-app-collapsed/)
      await toggle.click()
      await expect(toggle).toHaveAttribute('aria-expanded', 'true')
    }
  }
  expect(writes).toEqual([])
})

async function routeReadyOperationsApi(page: Page) {
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({
      json: {
        authMode: 'mock',
        authenticated: true,
        user: {
          userId: 'operations-admin',
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

  await page.route('**/api/health', async (route) => {
    await route.fulfill({
      json: {
        status: 'ok',
        service: 'store-ops-api',
        timestamp: '2026-05-21T09:00:00.000Z',
        queueBackend: 'redis',
        queue: {
          backend: 'redis',
          durable: true,
          redisRequired: true,
          status: 'healthy',
          message: 'Queue is healthy.',
        },
        observability: {
          status: 'ok',
          readinessProfile: 'controlled-pilot',
        },
        checks: {
          database: { status: 'ok', latencyMs: 4 },
          redis: { status: 'ok', latencyMs: 2 },
        },
      },
    })
  })

  await page.route('**/api/integrations/import-batches/overview', async (route) => {
    await route.fulfill({
      json: {
        totals: { all: 1, completed: 1, failed: 0, completedWithErrors: 0, pending: 0, queued: 0, processing: 0 },
        healthTotals: { healthy: 1, inProgress: 0, blocked: 0, retryReady: 0, needsAction: 0, stuck: 0 },
        actionTotals: { blocked: 0, retryReady: 0, needsAction: 0, stuck: 0 },
        latest: {
          completedBatchId: 'batch-ready-1',
          failedBatchId: null,
          inProgressBatchId: null,
          stuckBatchId: null,
        },
      },
    })
  })
  await page.route('**/api/integrations/import-batches/needs-action?**', async (route) => {
    await route.fulfill({ json: { items: [], meta: { count: 0, total: 0, limit: 4, offset: 0 } } })
  })
  await page.route('**/api/snapshots/runs/overview', async (route) => {
    await route.fulfill({
      json: {
        totals: { all: 1, queued: 0, running: 0, completed: 1, failed: 0 },
        healthTotals: { healthy: 1, inProgress: 0, retryReady: 0, needsAction: 0, stuck: 0 },
        actionTotals: { retryReady: 0, stuck: 0 },
        latest: {
          completedSnapshotRunId: 'snapshot-ready-1',
          failedSnapshotRunId: null,
          inProgressSnapshotRunId: null,
          stuckSnapshotRunId: null,
        },
      },
    })
  })
  await page.route('**/api/snapshots/runs/needs-action?**', async (route) => {
    await route.fulfill({ json: { items: [], meta: { count: 0, total: 0, limit: 4, offset: 0 } } })
  })
  await page.route('**/api/workforce/seller-code-requests?**', async (route) => {
    await route.fulfill({ json: { items: [], meta: { count: 0, total: 0, limit: 50, offset: 0 } } })
  })
  await page.route('**/api/workforce/offboarding-requests?**', async (route) => {
    await route.fulfill({ json: { items: [], meta: { count: 0, total: 0, limit: 50, offset: 0 } } })
  })
  await page.route('**/api/workflow/inbox', async (route) => {
    await route.fulfill({ json: { items: [], meta: { count: 0, total: 0, limit: 50, offset: 0 } } })
  })
  await page.route('**/api/reports/kpi-config', async (route) => {
    await route.fulfill({
      json: {
        metadata: {
          kpiConfigVersionId: 'kpi-config-ready-1',
          versionNo: 1,
          effectiveFrom: '2026-05-01',
          effectiveTo: null,
          publishedAt: '2026-05-20T12:00:00.000Z',
          publishedBy: 'operations-admin',
        },
        storeProfile: {},
        personnelProfile: {},
        ownershipMatrix: [],
        gradingBands: [],
      },
    })
  })
  await page.route('**/api/reports/rankings?**', async (route) => {
    await route.fulfill({
      json: {
        source: {
          mode: 'live',
          periodType: 'monthly',
          periodStart: '2026-05-01',
          periodEnd: '2026-05-31',
        },
        access: {
          globalMode: 'full',
          canSeeGlobalDetails: true,
          canSeeManagedStorePersonnelDetails: true,
        },
        filters: { regionManagers: [], regions: [], stores: [] },
        reference: { store: { averageScore: 0, metrics: [] }, personnel: { averageScore: 0, metrics: [] } },
        storeLeaderboard: { items: [], currentStore: null, meta: { total: 0, limit: 1, offset: 0 } },
        personnelLeaderboard: {
          items: [],
          currentEmployee: null,
          managedStorePersonnel: [],
          meta: { total: 0, limit: 1, offset: 0 },
        },
        availablePeriods: [{ periodType: 'monthly', periodStart: '2026-05-01', periodEnd: '2026-05-31' }],
      },
    })
  })
}
