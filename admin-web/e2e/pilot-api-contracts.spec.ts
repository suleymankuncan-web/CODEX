import { expect, test, type Page } from '@playwright/test'

const storeId = '00000000-0000-0000-0000-000000000100'
const employeeId = '00000000-0000-0000-0000-000000000200'
const companyId = '00000000-0000-0000-0000-000000000001'
const regionId = '00000000-0000-0000-0000-000000000010'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'store-ops-admin-session',
      JSON.stringify({
        mode: 'mock',
        mockUserId: 'contract-user',
        mockRoleCodes: 'SUPER_ADMIN,INTEGRATION_ADMIN,REGION_MANAGER,STORE_MANAGER',
        mockCompanyIds: '00000000-0000-0000-0000-000000000001',
        bearerToken: '',
      }),
    )
  })
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({ json: authSession })
  })
})

test('master data renders promoted batches when updatedAt is absent', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))

  await page.route('**/api/integrations/master-data-bootstrap/batches?**', async (route) => {
    await route.fulfill({ json: masterDataWithoutUpdatedAt })
  })

  await page.goto('/admin/master-data')

  await expect(page.getByText('Accepted personnel baseline')).toBeVisible()
  expect(pageErrors).toEqual([])
})

test('store my performance renders fallback data when optional support fields are absent', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await routeStoreMeMinimalApi(page)

  await page.goto('/store/me')

  await expect(page.getByRole('heading', { name: /Store personnel icin/i })).toBeVisible()
  await expect(page.getByText('Pilot Employee')).toBeVisible()
  expect(pageErrors).toEqual([])
})

test('rankings render summary rows without metric detail arrays', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))

  await page.route('**/api/reports/rankings?**', async (route) => {
    await route.fulfill({ json: rankingsWithoutMetrics })
  })

  await page.goto('/store/rankings')

  await expect(page.getByText('Pilot Store').first()).toBeVisible()
  await expect(page.getByText('Pilot Employee')).toBeVisible()
  expect(pageErrors).toEqual([])
})

test('store approvals render pending requests with nullable approval fields', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await routeStoreApprovalsMinimalApi(page)

  await page.goto('/store/approvals')

  await expect(page.getByText('May target split')).toBeVisible()
  await expect(page.getByText('Pending', { exact: true })).toBeVisible()
  expect(pageErrors).toEqual([])
})

async function routeStoreMeMinimalApi(page: Page) {
  await page.route('**/api/reports/kpi-config', async (route) => {
    await route.fulfill({ json: kpiConfig })
  })
  await page.route('**/api/reports/my-performance**', async (route) => {
    await route.fulfill({ json: myPerformanceWithoutOptionalSupport })
  })
}

async function routeStoreApprovalsMinimalApi(page: Page) {
  await page.route('**/api/target-distributions/requests**', async (route) => {
    await route.fulfill({ json: pendingTargetRequests })
  })
  await page.route('**/api/target-distributions/store-personnel?**', async (route) => {
    await route.fulfill({ json: emptyList })
  })
  await page.route('**/api/workforce/position-options?**', async (route) => {
    await route.fulfill({ json: emptyList })
  })
  await page.route('**/api/workforce/store-employees?**', async (route) => {
    await route.fulfill({ json: emptyList })
  })
  await page.route('**/api/workforce/seller-code-requests?**', async (route) => {
    await route.fulfill({ json: emptyList })
  })
  await page.route('**/api/workforce/offboarding-requests?**', async (route) => {
    await route.fulfill({ json: emptyList })
  })
}

const authSession = {
  authMode: 'mock',
  authenticated: true,
  user: {
    userId: 'contract-user',
    employeeId,
    roleCodes: ['SUPER_ADMIN', 'INTEGRATION_ADMIN', 'REGION_MANAGER', 'STORE_MANAGER'],
    scope: { companyIds: [companyId], regionIds: [regionId], storeIds: [storeId] },
    readScope: { companyIds: [companyId], regionIds: [regionId], storeIds: [storeId] },
    actionScope: { assignedStoreIds: [storeId] },
    assignedStoreIds: [storeId],
  },
  scopeSummary: { companyCount: 1, regionCount: 1, storeCount: 1, assignedStoreCount: 1 },
}

const emptyList = {
  items: [],
  meta: { count: 0, total: 0, limit: 50, offset: 0 },
}

const masterDataWithoutUpdatedAt = {
  items: [
    {
      batchId: 'batch-1',
      companyId,
      bootstrapEntity: 'personnel',
      sourceLabel: 'Accepted personnel baseline',
      fileReference: 'personnel.xlsx',
      uploadedByUserId: 'contract-user',
      batchStatus: 'promoted',
      rowCount: 1,
      pendingCount: 0,
      validCount: 0,
      needsReviewCount: 0,
      invalidCount: 0,
      promotedCount: 1,
      createdAt: '2026-05-04T11:51:26.982Z',
      validatedAt: '2026-05-04T11:51:27.289Z',
      promotedAt: '2026-05-04T11:52:42.761Z',
      readiness: 'closed',
      nextAction: 'closed',
    },
  ],
  meta: { count: 1, total: 1, limit: 20, offset: 0 },
}

const kpiConfig = {
  metadata: {
    kpiConfigVersionId: null,
    versionNo: null,
    effectiveFrom: null,
    effectiveTo: null,
    publishedAt: null,
    publishedBy: null,
  },
  storeProfile: {
    profileCode: 'store',
    title: 'Store',
    summary: 'Store score',
    futureMetricRule: 'No new metrics in contract smoke.',
    metrics: [],
  },
  personnelProfile: {
    profileCode: 'personnel',
    title: 'Personnel',
    summary: 'Personnel score',
    futureMetricRule: 'No new metrics in contract smoke.',
    metrics: [],
  },
  ownershipMatrix: [],
  gradingBands: [{ code: 'C', label: 'Focus', emoji: 'C', tone: 'warning', minScore: 0 }],
}

const myPerformanceWithoutOptionalSupport = {
  source: { mode: 'live', snapshotRunId: null, snapshotDate: null },
  employee: { employeeId, displayName: 'Pilot Employee', storeId, storeName: 'Pilot Store' },
  period: null,
  score: { value: 0, matchedMetrics: 0, totalMetrics: 1 },
  rankings: { turkeyRank: null, turkeyPopulation: 0, storeRank: null, storePopulation: 0 },
  availablePeriods: [],
  metrics: [],
}

const rankingsWithoutMetrics = {
  source: { mode: 'live', periodType: 'monthly', periodStart: null, periodEnd: null },
  access: {
    globalMode: 'top100',
    canSeeGlobalDetails: false,
    canSeeManagedStorePersonnelDetails: true,
  },
  filters: { regionManagers: [], regions: [], stores: [] },
  storeLeaderboard: {
    items: [
      {
        subject: 'store',
        storeId,
        storeName: 'Pilot Store',
        regionId: null,
        regionName: null,
        regionManagerUserId: null,
        regionManagerName: null,
        rank: 1,
        population: 100,
        scoreValue: 90,
        visibility: 'summary',
      },
    ],
    currentStore: null,
    meta: { total: 100, limit: 100, offset: 0 },
  },
  personnelLeaderboard: {
    items: [
      {
        subject: 'personnel',
        employeeId,
        displayName: 'Pilot Employee',
        storeId,
        storeName: 'Pilot Store',
        regionId: null,
        regionName: null,
        regionManagerUserId: null,
        regionManagerName: null,
        rank: 2,
        population: 100,
        storeRank: null,
        storePopulation: 0,
        scoreValue: 87,
        visibility: 'summary',
      },
    ],
    currentEmployee: null,
    managedStorePersonnel: [],
    meta: { total: 100, limit: 100, offset: 0 },
  },
  availablePeriods: [],
}

const pendingTargetRequests = {
  items: [
    {
      requestId: 'request-1',
      companyId,
      regionId,
      storeId,
      storeName: 'Pilot Store',
      requestMonth: '2026-05-01',
      targetLabel: 'May target split',
      totalTargetValue: 1000,
      allocationCount: 1,
      status: 'pending_region_approval',
      requestReason: null,
      allocations: [],
      submittedByUserId: 'contract-user',
      approvedByUserId: null,
      approvedAt: null,
      approvalNote: null,
      createdAt: '2026-05-04T11:51:26.982Z',
      updatedAt: '2026-05-04T11:51:26.982Z',
    },
  ],
  meta: { count: 1, total: 1, limit: 50, offset: 0 },
}
