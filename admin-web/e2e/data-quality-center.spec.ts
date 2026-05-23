import { expect, test, type Page } from './test-fixtures'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('store-ops-app-locale', 'en')
    window.localStorage.setItem(
      'store-ops-admin-session',
      JSON.stringify({
        mode: 'mock',
        mockUserId: 'data-quality-admin',
        mockRoleCodes: 'SUPER_ADMIN',
        mockCompanyIds: '00000000-0000-0000-0000-000000000001',
        bearerToken: '',
      }),
    )
  })

  await routeDataQualityApi(page, dataQualitySessionFixture)
})

test('data quality center composes read-only trust signals', async ({ page }) => {
  await page.goto('/admin/data-quality')

  const main = page.getByRole('main')
  await expect(page).toHaveURL(/\/admin\/data-quality$/)
  await expect(page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Data Quality' })).toBeVisible()
  await expect(main.getByRole('heading', { name: 'Data defects are separated from product issues.' })).toBeVisible()
  await expect(page.locator('.accent-chip').filter({ hasText: 'Route' })).toContainText('/admin/data-quality')
  await expect(page.locator('.accent-chip').filter({ hasText: 'Total pressure' })).toContainText('61')
  await expect(page.locator('.metric-card').filter({ hasText: 'Import' })).toContainText('3')
  await expect(page.locator('.metric-card').filter({ hasText: 'Snapshot' })).toContainText('1')
  await expect(page.locator('.metric-card').filter({ hasText: 'Workforce' })).toContainText('57')
  await expect(page.locator('.metric-card').filter({ hasText: 'Source trust' })).toContainText('0')
  await expect(main.getByRole('heading', { name: 'Import and mapping pressure' })).toBeVisible()
  await expect(main.getByText('batch-dq-1')).toBeVisible()
  await expect(main.getByText('store, personnel')).toBeVisible()
  await expect(main.getByRole('heading', { name: 'Snapshot freshness' })).toBeVisible()
  await expect(main.getByText('snapshot-dq-1')).toBeVisible()
  await expect(main.getByRole('heading', { name: 'Workforce identity pressure' })).toBeVisible()
  await expect(page.locator('.key-item').filter({ hasText: 'Seller-code requests' })).toContainText('33')
  await expect(page.locator('.key-item').filter({ hasText: 'Offboarding requests' })).toContainText('24')
  await expect(main.getByRole('heading', { name: 'Source-of-truth guardrail' })).toBeVisible()
  await expect(page.locator('.key-item').filter({ hasText: 'Published KPI config' })).toContainText('v8')
  await expect(page.locator('.key-item').filter({ hasText: 'Leaderboard source period' })).toContainText('2026-05-01 - 2026-05-31')
  await expect(main.getByRole('link', { name: /Open integration detail/i }).first()).toHaveAttribute('href', '/admin/integrations/batch-dq-1')
  await expect(main.getByRole('link', { name: /Open snapshot detail/i }).first()).toHaveAttribute('href', '/admin/snapshots/snapshot-dq-1')
  await expect(main.getByRole('link', { name: /Open admin inbox/i })).toHaveAttribute('href', '/admin/inbox')
  await expect(main.getByRole('link', { name: /Open KPI config/i })).toHaveAttribute('href', '/admin/kpi-config')
})

test('data quality center stays super-admin scoped', async ({ page }) => {
  await page.unroute('**/api/auth/session')
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({
      json: {
        ...dataQualitySessionFixture,
        user: {
          ...dataQualitySessionFixture.user,
          roleCodes: ['REPORT_VIEWER'],
        },
      },
    })
  })

  await page.goto('/admin/data-quality')

  await expect(page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Data Quality' })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Route not available for this role' })).toBeVisible()
})

test('data quality center waits for all signal queries before rendering metrics', async ({ page }) => {
  await page.unroute('**/api/workforce/seller-code-requests?**')
  let releaseSellerCodeRequest: (() => void) | null = null
  await page.route('**/api/workforce/seller-code-requests?**', async (route) => {
    await new Promise<void>((resolve) => {
      releaseSellerCodeRequest = resolve
    })
    await route.fulfill({ json: sellerCodeRequestsFixture })
  })

  await page.goto('/admin/data-quality')

  await expect(page.getByRole('heading', { name: 'Loading data quality center' })).toBeVisible()
  await expect(page.getByText('Total pressure')).toHaveCount(0)
  await expect.poll(() => releaseSellerCodeRequest !== null).toBeTruthy()
  releaseSellerCodeRequest?.()

  await expect(page.getByRole('heading', { name: 'Data defects are separated from product issues.' })).toBeVisible()
  await expect(page.locator('.accent-chip').filter({ hasText: 'Total pressure' })).toContainText('61')
})

test('data quality center keeps mobile width bounded', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/admin/data-quality')

  await expect(page.getByRole('heading', { name: 'Data defects are separated from product issues.' })).toBeVisible()

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(1)
})

async function routeDataQualityApi(page: Page, sessionFixture: typeof dataQualitySessionFixture) {
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({ json: sessionFixture })
  })

  await page.route('**/api/integrations/import-batches/overview', async (route) => {
    await route.fulfill({ json: importOverviewFixture })
  })

  await page.route('**/api/integrations/import-batches/needs-action?**', async (route) => {
    await route.fulfill({ json: importNeedsActionFixture })
  })

  await page.route('**/api/snapshots/runs/overview', async (route) => {
    await route.fulfill({ json: snapshotOverviewFixture })
  })

  await page.route('**/api/snapshots/runs/needs-action?**', async (route) => {
    await route.fulfill({ json: snapshotNeedsActionFixture })
  })

  await page.route('**/api/workforce/seller-code-requests?**', async (route) => {
    await route.fulfill({ json: sellerCodeRequestsFixture })
  })

  await page.route('**/api/workforce/offboarding-requests?**', async (route) => {
    await route.fulfill({ json: offboardingRequestsFixture })
  })

  await page.route('**/api/reports/kpi-config', async (route) => {
    await route.fulfill({ json: kpiConfigFixture })
  })

  await page.route('**/api/reports/rankings?**', async (route) => {
    await route.fulfill({ json: rankingsFixture })
  })
}

const dataQualitySessionFixture = {
  authMode: 'mock',
  authenticated: true,
  user: {
    userId: 'data-quality-admin',
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
}

const importOverviewFixture = {
  totals: {
    all: 5,
    completed: 3,
    failed: 1,
    completedWithErrors: 1,
    pending: 0,
    queued: 0,
    processing: 0,
  },
  healthTotals: {
    healthy: 2,
    inProgress: 0,
    blocked: 1,
    retryReady: 1,
    needsAction: 1,
    stuck: 0,
  },
  actionTotals: {
    blocked: 1,
    retryReady: 1,
    needsAction: 1,
    stuck: 0,
  },
  latest: {
    completedBatchId: 'batch-completed-1',
    failedBatchId: 'batch-dq-1',
    inProgressBatchId: null,
    stuckBatchId: null,
  },
}

const importNeedsActionFixture = {
  items: [
    {
      batchId: 'batch-dq-1',
      integrationSourceId: 'source-power-bi',
      sourceCode: 'POWER_BI',
      sourceName: 'Power BI',
      entityType: 'kpi',
      startedAt: '2026-05-21T08:00:00.000Z',
      finishedAt: null,
      status: 'failed',
      fileReference: 'data-quality.xlsx',
      recordCount: 120,
      errorCount: 9,
      retryCount: 1,
      lastRetriedAt: null,
      healthState: 'retry_ready',
      actionReason: 'Mapping recovery is ready for review.',
      recommendedAction: 'Open integration detail before retrying.',
      blockedByEntityTypes: ['store', 'personnel'],
      recommendedNextEntityType: null,
      canRetryNow: true,
      isStuck: false,
    },
  ],
  meta: {
    count: 1,
    total: 1,
    limit: 6,
    offset: 0,
  },
}

const snapshotOverviewFixture = {
  totals: {
    all: 4,
    queued: 0,
    running: 0,
    completed: 3,
    failed: 1,
  },
  healthTotals: {
    healthy: 3,
    inProgress: 0,
    retryReady: 1,
    needsAction: 0,
    stuck: 0,
  },
  actionTotals: {
    retryReady: 1,
    stuck: 0,
  },
  latest: {
    completedSnapshotRunId: 'snapshot-completed-1',
    failedSnapshotRunId: 'snapshot-dq-1',
    inProgressSnapshotRunId: null,
    stuckSnapshotRunId: null,
  },
}

const snapshotNeedsActionFixture = {
  items: [
    {
      snapshotRunId: 'snapshot-dq-1',
      snapshotDate: '2026-05-20',
      snapshotType: 'daily',
      periodStart: '2026-05-20',
      periodEnd: '2026-05-20',
      runStatus: 'failed',
      healthState: 'retry_ready',
      generatedAt: '2026-05-20T02:00:00.000Z',
      generatedBy: 'data-quality-admin',
      startedAt: '2026-05-20T02:01:00.000Z',
      finishedAt: '2026-05-20T02:04:00.000Z',
      failureReason: 'Fixture dependency recovered',
      rerunOfSnapshotRunId: null,
      kpiConfigVersion: {
        kpiConfigVersionId: '11111111-1111-4111-8111-111111111111',
        versionNo: 8,
        state: 'versioned',
      },
      actionReason: 'Dependency recovered and rerun is safe.',
      recommendedAction: 'Open snapshot operations before rerun.',
      canRerun: true,
      rerunCount: 1,
      latestRerunSnapshotRunId: null,
      isStuck: false,
    },
  ],
  meta: {
    count: 1,
    total: 1,
    limit: 6,
    offset: 0,
  },
}

const sellerCodeRequestsFixture = {
  items: [],
  meta: {
    count: 0,
    total: 33,
    limit: 50,
    offset: 0,
  },
}

const offboardingRequestsFixture = {
  items: [],
  meta: {
    count: 0,
    total: 24,
    limit: 50,
    offset: 0,
  },
}

const kpiConfigFixture = {
  metadata: {
    kpiConfigVersionId: 'kpi-config-version-8',
    versionNo: 8,
    effectiveFrom: '2026-05-01',
    effectiveTo: null,
    publishedAt: '2026-05-20T12:00:00.000Z',
    publishedBy: 'data-quality-admin',
  },
  storeProfile: {
    targetAchievementWeight: 70,
    kpiPerformanceWeight: 20,
    bmChecklistWeight: 5,
    vmChecklistWeight: 5,
  },
  personnelProfile: {
    targetAchievementWeight: 70,
    kpiPerformanceWeight: 20,
    bmChecklistWeight: 5,
    vmChecklistWeight: 5,
  },
  ownershipMatrix: [],
  gradingBands: [],
}

const rankingsFixture = {
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
  filters: {
    regionManagers: [],
    regions: [],
    stores: [],
  },
  reference: {
    store: {
      averageScore: 82,
      metrics: [],
    },
    personnel: {
      averageScore: 78,
      metrics: [],
    },
  },
  storeLeaderboard: {
    items: [],
    currentStore: null,
    meta: {
      total: 1,
      limit: 1,
      offset: 0,
    },
  },
  personnelLeaderboard: {
    items: [],
    currentEmployee: null,
    managedStorePersonnel: [],
    meta: {
      total: 42,
      limit: 1,
      offset: 0,
    },
  },
  availablePeriods: [],
}
