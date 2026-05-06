import { expect, test, type Page } from '@playwright/test'

const storeId = '00000000-0000-0000-0000-000000000100'
const employeeId = '00000000-0000-0000-0000-000000000200'
const regionId = '00000000-0000-0000-0000-000000000010'
const companyId = '00000000-0000-0000-0000-000000000001'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'store-ops-admin-session',
      JSON.stringify({
        mode: 'mock',
        mockUserId: 'pilot-smoke-user',
        mockRoleCodes:
          'SUPER_ADMIN,INTEGRATION_ADMIN,REPORT_VIEWER,REGION_MANAGER,STORE_MANAGER',
        mockCompanyIds: '00000000-0000-0000-0000-000000000001',
        bearerToken: '',
      }),
    )
  })

  await routePilotSmokeApi(page)
})

test('core admin routes open without unavailable states', async ({ page }) => {
  const monitor = watchPilotFailures(page)
  const routes = [
    {
      path: '/admin/integrations',
      heading: page.getByRole('heading', { name: 'Needs-action batches' }),
    },
    {
      path: '/admin/master-data',
      heading: page.getByRole('heading', { name: 'Bootstrap batches' }),
    },
    {
      path: '/admin/targets',
      heading: page.getByRole('heading', { name: 'Pending target distribution requests' }),
    },
  ]

  for (const route of routes) {
    await page.goto(route.path)
    await expect(page).toHaveURL(new RegExp(`${route.path.replaceAll('/', '\\/')}$`))
    await expect(route.heading).toBeVisible()
    await expectHealthySurface(page)
  }

  monitor.expectClean()
})

test('core store routes open without unavailable states', async ({ page }) => {
  const monitor = watchPilotFailures(page)
  const routes = [
    {
      path: '/store',
      heading: page.getByRole('heading', { name: /Mevcut kullan/i }),
    },
    {
      path: '/store/me',
      heading: page.getByRole('heading', { name: /Benim performansim/i }),
    },
    {
      path: '/store/rankings',
      heading: page.getByRole('heading', { name: /Magaza ve personel rankingleri/i }),
    },
    {
      path: '/store/approvals',
      heading: page.getByRole('heading', { name: 'Submit a target distribution request' }),
    },
  ]

  for (const route of routes) {
    await page.goto(route.path)
    await expect(page).toHaveURL(new RegExp(`${route.path.replaceAll('/', '\\/')}$`))
    await expect(route.heading).toBeVisible()
    await expectHealthySurface(page)
  }

  monitor.expectClean()
})

test('protected route refresh returns to the same route', async ({ page }) => {
  const monitor = watchPilotFailures(page)

  await page.goto('/store/rankings')
  await page.reload()

  await expect(page).toHaveURL(/\/store\/rankings$/)
  await expect(page.getByRole('heading', { name: /Magaza ve personel rankingleri/i })).toBeVisible()
  await expectHealthySurface(page)
  monitor.expectClean()
})

async function expectHealthySurface(page: Page) {
  await expect(page.locator('body')).not.toContainText(
    /unavailable|acilamadi|could not load|couldn't load|route not available|session rejected/i,
  )
}

function watchPilotFailures(page: Page) {
  const failedRequests: string[] = []
  const failedResponses: string[] = []
  const pageErrors: string[] = []

  page.on('requestfailed', (request) => {
    if (request.url().includes('/api/')) {
      failedRequests.push(`${request.method()} ${request.url()}`)
    }
  })
  page.on('response', (response) => {
    if (response.url().includes('/api/') && response.status() >= 400) {
      failedResponses.push(`${response.status()} ${response.url()}`)
    }
  })
  page.on('pageerror', (error) => {
    pageErrors.push(error.message)
  })

  return {
    expectClean() {
      expect(failedRequests, 'API requests should not fail at the network layer').toEqual([])
      expect(failedResponses, 'API responses should not return error status codes').toEqual([])
      expect(pageErrors, 'Pilot smoke routes should not raise page errors').toEqual([])
    },
  }
}

async function routePilotSmokeApi(page: Page) {
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({ json: authSessionFixture })
  })

  await page.route('**/api/feed?**', async (route) => {
    await route.fulfill({ json: feedFixture })
  })

  await page.route('**/api/integrations/import-batches/overview', async (route) => {
    await route.fulfill({ json: importOverviewFixture })
  })
  await page.route('**/api/integrations/import-batches/needs-action?**', async (route) => {
    await route.fulfill({ json: emptyListFixture })
  })
  await page.route('**/api/integrations/lookups', async (route) => {
    await route.fulfill({ json: integrationLookupsFixture })
  })
  await page.route('**/api/integrations/import-payload-templates**', async (route) => {
    await route.fulfill({ json: importPayloadTemplateFixture })
  })
  await page.route('**/api/integrations/store-master-lookups', async (route) => {
    await route.fulfill({ json: storeMasterLookupsFixture })
  })
  await page.route('**/api/integrations/store-master**', async (route) => {
    await route.fulfill({ json: storeMasterFixture })
  })
  await page.route('**/api/integrations/master-data-bootstrap/batches?**', async (route) => {
    await route.fulfill({ json: masterDataFixture })
  })

  await page.route('**/api/target-distributions/requests**', async (route) => {
    await route.fulfill({ json: targetRequestsFixture })
  })
  await page.route('**/api/target-distributions/coverage**', async (route) => {
    await route.fulfill({ json: targetCoverageFixture })
  })
  await page.route('**/api/target-distributions/store-personnel?**', async (route) => {
    await route.fulfill({ json: storePersonnelFixture })
  })
  await page.route('**/api/workforce/position-options?**', async (route) => {
    await route.fulfill({ json: positionOptionsFixture })
  })
  await page.route('**/api/workforce/store-employees?**', async (route) => {
    await route.fulfill({ json: storeEmployeesFixture })
  })
  await page.route('**/api/workforce/seller-code-requests?**', async (route) => {
    await route.fulfill({ json: emptyListFixture })
  })
  await page.route('**/api/workforce/offboarding-requests?**', async (route) => {
    await route.fulfill({ json: emptyListFixture })
  })

  await page.route('**/api/reports/kpi-config', async (route) => {
    await route.fulfill({ json: kpiConfigFixture })
  })
  await page.route('**/api/reports/my-performance**', async (route) => {
    await route.fulfill({ json: myPerformanceFixture })
  })
  await page.route('**/api/reports/rankings?**', async (route) => {
    await route.fulfill({ json: rankingsFixture })
  })
}

const authSessionFixture = {
  authMode: 'mock',
  authenticated: true,
  user: {
    userId: 'pilot-smoke-user',
    employeeId,
    roleCodes: [
      'SUPER_ADMIN',
      'INTEGRATION_ADMIN',
      'REPORT_VIEWER',
      'REGION_MANAGER',
      'STORE_MANAGER',
    ],
    scope: {
      companyIds: [companyId],
      regionIds: [regionId],
      storeIds: [storeId],
    },
    readScope: {
      companyIds: [companyId],
      regionIds: [regionId],
      storeIds: [storeId],
    },
    actionScope: {
      assignedStoreIds: [storeId],
    },
    assignedStoreIds: [storeId],
  },
  scopeSummary: {
    companyCount: 1,
    regionCount: 1,
    storeCount: 1,
    assignedStoreCount: 1,
  },
}

const emptyListFixture = {
  items: [],
  meta: { count: 0, total: 0, limit: 50, offset: 0 },
}

const feedFixture = {
  items: [
    {
      feedPostId: 'pilot-feed-1',
      postType: 'announcement',
      title: 'Pilot announcement',
      body: 'Pilot store shell announcement.',
      linkLabel: null,
      linkUrl: null,
      visibilityScopeType: 'store',
      visibilityScopeIds: [storeId],
      isPinned: true,
      publishStatus: 'published',
      publishedAt: '2026-05-01T08:00:00.000Z',
      startsAt: null,
      endsAt: null,
      metricCode: null,
      metricLabel: null,
      challengeStartsOn: null,
      challengeEndsOn: null,
      targetRoute: null,
      createdByUserId: 'pilot-smoke-user',
      updatedByUserId: 'pilot-smoke-user',
      createdAt: '2026-05-01T08:00:00.000Z',
      updatedAt: '2026-05-01T08:00:00.000Z',
    },
  ],
  meta: { count: 1, total: 1, limit: 50, offset: 0 },
}

const importOverviewFixture = {
  totals: {
    all: 3,
    completed: 1,
    failed: 0,
    completedWithErrors: 1,
    pending: 0,
    queued: 1,
    processing: 0,
  },
  healthTotals: {
    healthy: 1,
    inProgress: 1,
    blocked: 0,
    retryReady: 1,
    needsAction: 0,
    stuck: 0,
  },
  actionTotals: {
    blocked: 0,
    retryReady: 1,
    needsAction: 0,
    stuck: 0,
  },
  latest: {
    completedBatchId: 'batch-completed-1',
    failedBatchId: null,
    inProgressBatchId: 'batch-queued-1',
    stuckBatchId: null,
  },
}

const integrationLookupsFixture = {
  activeSources: [
    {
      sourceId: 'source-kpi-1',
      sourceCode: 'power-bi-kpi',
      sourceName: 'Power BI KPI',
      entityType: 'kpi',
      sourceSystem: 'power_bi',
      stateModel: 'closed_period',
    },
  ],
  meta: {
    totalEntityTypes: 7,
    totalActiveSources: 1,
  },
}

const importPayloadTemplateFixture = {
  entityType: 'kpi',
  sourceSystem: 'power_bi',
  requestBody: {
    sourceCode: 'power-bi-kpi',
    entityType: 'kpi',
    fileReference: 'sample.json',
    sourceCapturedAt: '2026-05-01T08:00:00.000Z',
    sourceWindowStartedAt: '2026-05-01T00:00:00.000Z',
    sourceWindowEndedAt: '2026-05-31T23:59:59.000Z',
    rows: [],
  },
}

const storeMasterLookupsFixture = {
  storeTypes: [
    { value: 'company', label: 'Company' },
    { value: 'franchise', label: 'Franchise' },
    { value: 'operator', label: 'Operator' },
  ],
  statuses: [
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
    { value: 'closed', label: 'Closed' },
  ],
  regions: [
    {
      regionId,
      regionCode: 'PILOT',
      regionName: 'Pilot Region',
    },
  ],
}

const storeMasterFixture = {
  items: [
    {
      storeId,
      storeCode: 'PILOT-100',
      storeName: 'Pilot Store',
      storeType: 'company',
      status: 'active',
      kpiImportEnabled: true,
      regionId,
      regionName: 'Pilot Region',
    },
  ],
  meta: { count: 1, total: 1, limit: 200, offset: 0 },
}

const masterDataFixture = {
  items: [
    {
      batchId: '8a1506af-b043-4968-9d75-d10c8d4432d5',
      companyId,
      bootstrapEntity: 'personnel',
      sourceLabel: 'Accepted personnel baseline',
      fileReference: 'personnel-master-mapping-prep.xlsx#chunk-9',
      uploadedByUserId: 'pilot-smoke-user',
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
  meta: { count: 1, total: 1, limit: 20, offset: 0 },
}

const targetRequestsFixture = {
  items: [],
  meta: { count: 0, total: 0, limit: 50, offset: 0 },
}

const targetCoverageFixture = {
  items: [
    {
      storeId,
      storeName: 'Pilot Store',
      employeeId,
      displayName: 'Pilot Store Manager',
      externalEmployeeRef: 'SM-1',
      targetReferenceId: 'target-reference-1',
      targetValue: 150000,
      pendingRequestId: null,
      pendingTargetValue: null,
      staleTargetReferenceId: null,
      targetStatus: 'approved',
    },
  ],
  meta: { count: 1, total: 1, limit: 50, offset: 0 },
  summary: {
    requestMonth: '2026-05-01',
    totalEmployees: 1,
    coveredEmployees: 1,
    missingEmployees: 0,
    pendingEmployees: 0,
    conflictEmployees: 0,
    staleEmployees: 0,
    uncoveredEmployees: 0,
    coverageRate: 1,
  },
}

const storePersonnelFixture = {
  items: [
    {
      employeeId,
      displayName: 'Pilot Store Manager',
      externalEmployeeRef: 'SM-1',
      periodStart: '2026-05-01',
      periodEnd: '2026-05-31',
      netSalesValue: 1000,
    },
  ],
  meta: { count: 1, total: 1, limit: 50, offset: 0 },
}

const positionOptionsFixture = {
  items: [
    {
      positionId: '44444444-4444-4444-8444-444444444444',
      positionCode: 'STORE_MANAGER',
      positionName: 'Store Manager',
      jobFamily: 'store',
      isManagerial: true,
    },
  ],
  meta: { count: 1, total: 1, limit: 50, offset: 0 },
}

const storeEmployeesFixture = {
  items: [
    {
      employeeId,
      displayName: 'Pilot Store Manager',
      externalEmployeeRef: 'SM-1',
      storeId,
      positionId: '44444444-4444-4444-8444-444444444444',
      positionCode: 'STORE_MANAGER',
      positionName: 'Store Manager',
      assignmentStartDate: '2026-05-01',
      employmentStatus: 'active',
    },
  ],
  meta: { count: 1, total: 1, limit: 50, offset: 0 },
}

const kpiConfigFixture = {
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
    futureMetricRule: 'No new metrics in pilot smoke.',
    metrics: [],
  },
  personnelProfile: {
    profileCode: 'personnel',
    title: 'Personnel',
    summary: 'Personnel score',
    futureMetricRule: 'No new metrics in pilot smoke.',
    metrics: [],
  },
  ownershipMatrix: [],
  gradingBands: [
    { code: 'A', label: 'Strong', emoji: 'A', tone: 'calm', minScore: 80 },
    { code: 'B', label: 'Good', emoji: 'B', tone: 'accent', minScore: 60 },
    { code: 'C', label: 'Focus', emoji: 'C', tone: 'warning', minScore: 0 },
  ],
}

const myPerformanceFixture = {
  source: { mode: 'live', snapshotRunId: null, snapshotDate: null },
  employee: { employeeId, displayName: 'Pilot Store Manager', storeId, storeName: 'Pilot Store' },
  period: { periodStart: '2026-05-01', periodEnd: '2026-05-31' },
  score: { value: 87, matchedMetrics: 1, totalMetrics: 1 },
  rankings: { turkeyRank: 12, turkeyPopulation: 100, storeRank: 1, storePopulation: 4 },
  availablePeriods: [{ periodType: 'monthly', periodStart: '2026-05-01', periodEnd: '2026-05-31' }],
  partial: {
    isPartial: false,
    missingMetricCodes: [],
    missingMetricLabels: [],
    pendingNormalizationCodes: [],
    pendingNormalizationLabels: [],
  },
  supporting: {
    netSalesValue: 1000,
    targetEntryMode: 'manager_assignment',
    targetEditableByCurrentUser: false,
  },
  metrics: [
    {
      code: 'TARGET_ACHIEVEMENT',
      label: 'Target achievement',
      weightPercent: 100,
      actualValue: 0.87,
      targetValue: 1,
      achievementRate: 0.87,
      benchmarkValue: null,
      benchmarkSource: 'TARGET',
      contributionValue: 87,
      dataStatus: 'reported',
      scoreStatus: 'scored',
      status: 'reported',
    },
  ],
}

const rankingStoreRow = {
  subject: 'store',
  storeId,
  storeName: 'Pilot Store',
  regionId,
  regionName: 'Pilot Region',
  regionManagerUserId: 'region-manager-user',
  regionManagerName: 'Pilot Region Manager',
  rank: 1,
  population: 100,
  scoreValue: 90,
  visibility: 'detail',
  metrics: [
    {
      code: 'TARGET_ACHIEVEMENT',
      label: 'Target achievement',
      actualValue: 0.9,
      targetValue: 1,
      benchmarkValue: null,
      contributionValue: 90,
    },
  ],
}

const rankingPersonnelRow = {
  subject: 'personnel',
  employeeId,
  displayName: 'Pilot Store Manager',
  storeId,
  storeName: 'Pilot Store',
  regionId,
  regionName: 'Pilot Region',
  regionManagerUserId: 'region-manager-user',
  regionManagerName: 'Pilot Region Manager',
  rank: 1,
  population: 100,
  storeRank: 1,
  storePopulation: 4,
  scoreValue: 87,
  visibility: 'detail',
  metrics: [
    {
      code: 'TARGET_ACHIEVEMENT',
      label: 'Target achievement',
      actualValue: 0.87,
      targetValue: 1,
      benchmarkValue: null,
      contributionValue: 87,
    },
  ],
}

const rankingsFixture = {
  source: { mode: 'live', periodType: 'monthly', periodStart: '2026-05-01', periodEnd: '2026-05-31' },
  access: {
    globalMode: 'full',
    canSeeGlobalDetails: true,
    canSeeManagedStorePersonnelDetails: true,
  },
  filters: {
    regionManagers: [{ id: 'region-manager-user', label: 'Pilot Region Manager' }],
    regions: [{ id: regionId, label: 'Pilot Region' }],
    stores: [{ id: storeId, label: 'Pilot Store' }],
  },
  storeLeaderboard: {
    items: [rankingStoreRow],
    currentStore: rankingStoreRow,
    meta: { total: 1, limit: 100, offset: 0 },
  },
  personnelLeaderboard: {
    items: [rankingPersonnelRow],
    currentEmployee: rankingPersonnelRow,
    managedStorePersonnel: [rankingPersonnelRow],
    meta: { total: 1, limit: 100, offset: 0 },
  },
  availablePeriods: [{ periodType: 'monthly', periodStart: '2026-05-01', periodEnd: '2026-05-31' }],
}
