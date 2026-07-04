import { expect, test, type Page } from './test-fixtures'

const companyId = '00000000-0000-0000-0000-000000000001'
const storeId = '00000000-0000-0000-0000-000000000100'
const employeeId = '00000000-0000-0000-0000-000000000202'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'store-ops-admin-session',
      JSON.stringify({
        mode: 'mock',
        mockUserId: 'store-personnel-persona-user',
        mockRoleCodes: 'STORE_PERSONNEL',
        mockCompanyIds: '00000000-0000-0000-0000-000000000001',
        mockStoreIds: '00000000-0000-0000-0000-000000000100',
        mockReadStoreIds: '00000000-0000-0000-0000-000000000100',
        bearerToken: '',
      }),
    )
  })

  await routeStorePersonnelApi(page)
})

test('store personnel lands on personal performance and only sees personnel navigation', async ({ page }) => {
  await page.goto('/store')

  await expect(page).toHaveURL(/\/store\/me(?:$|\?)/)
  await expect(page.getByTestId('store-me-page')).toBeVisible()
  await expect(page.getByRole('heading', { name: /Store Personnel.*IstinyePark Demo Store/i })).toBeVisible()

  const nav = page.locator('.store-command-nav')
  await expect(nav.locator('a[href="/store/home"]')).toBeVisible()
  await expect(nav.locator('a[href="/store/me"]')).toBeVisible()
  await expect(nav.locator('a[href="/store/rankings"]')).toBeVisible()
  await expect(nav.locator('a[href="/store/feed"]')).toBeVisible()
  await expect(nav.locator('a[href="/store/settings"]')).toBeVisible()

  await expect(nav.locator('a[href="/store/approvals"]')).toHaveCount(0)
  await expect(nav.locator('a[href="/store/targets"]')).toHaveCount(0)
  await expect(nav.locator('a[href="/store/checklists"]')).toHaveCount(0)
  await expect(nav.locator('a[href="/store/tasks"]')).toHaveCount(0)
  await expect(nav.locator('a[href="/store/kpis"]')).toHaveCount(0)
  await expect(nav.locator('a[href="/store/incentives"]')).toHaveCount(0)
  await expect(nav.locator('a[href="/store/workforce"]')).toHaveCount(0)
  await expect(nav.locator('a[href="/store/reports"]')).toHaveCount(0)
})

test('store personnel home and feed stay read-only', async ({ page }) => {
  await page.goto('/store/home')

  await expect(page.getByTestId('store-home-command')).toBeVisible()
  await expect(page.getByTestId('store-home-dashboard').getByText('Mağaza personeli', { exact: true })).toBeVisible()
  await expect(page.locator('a[href="/store/me"]').first()).toBeVisible()
  await expect(page.locator('a[href="/store/rankings"]').first()).toBeVisible()
  await expect(page.locator('a[href="/store/feed"]').first()).toBeVisible()
  await expect(page.locator('a[href="/store/tasks"]')).toHaveCount(0)
  await expect(page.locator('a[href="/store/checklists"]')).toHaveCount(0)
  await expect(page.locator('a[href="/store/kpis"]')).toHaveCount(0)

  await page.goto('/store/feed')

  await expect(page.getByRole('heading', { name: 'Duyurular' })).toBeVisible()
  await expect(page.getByText('Pilot mağaza duyurusu')).toBeVisible()
  await expect(page.getByPlaceholder('Bölge mağazalarına ne duyurmak istiyorsun?')).toHaveCount(0)
  await expect(page.getByLabel('Gönderi seçenekleri')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Paylaş' })).toHaveCount(0)
})

test('store personnel direct management routes stop before protected data loads', async ({ page }) => {
  const requestCounts = new Map<string, number>()
  const protectedPatterns = [
    ['workflow', '**/api/workflow/inbox**'],
    ['store-actions', '**/api/store-actions/plans**'],
    ['checklist-acknowledgements', '**/api/checklists/acknowledgements/list'],
    ['mobile-checklists', '**/api/mobile/checklists/today'],
    ['target-requests', '**/api/target-distributions/requests**'],
    ['target-coverage', '**/api/target-distributions/coverage**'],
    ['target-personnel', '**/api/target-distributions/store-personnel**'],
    ['workforce-employees', '**/api/workforce/store-employees**'],
    ['workforce-gap', '**/api/workforce/headcount-gap**'],
    ['store-kpis', '**/api/reports/store-kpi-highlights**'],
    ['store-incentives', '**/api/store/incentives**'],
  ] as const

  for (const [key, pattern] of protectedPatterns) {
    requestCounts.set(key, 0)
    await page.unroute(pattern).catch(() => undefined)
    await page.route(pattern, async (route) => {
      requestCounts.set(key, (requestCounts.get(key) ?? 0) + 1)
      await route.fulfill({ json: { items: [], meta: { count: 0, total: 0, limit: 50, offset: 0 } } })
    })
  }

  for (const routePath of [
    '/store/tasks',
    '/store/checklists',
    '/store/approvals',
    '/store/targets',
    '/store/workforce',
    '/store/reports',
    '/store/kpis',
    '/store/incentives',
  ]) {
    await page.goto(routePath)
    await expect(page.getByRole('heading', { name: /rota kullan|route not available/i })).toBeVisible()
    await expect(page.getByText('/store/me')).toBeVisible()
  }

  for (const [key, count] of requestCounts) {
    expect(count, `${key} should not be requested for forbidden Store Personnel routes`).toBe(0)
  }
})

async function routeStorePersonnelApi(page: Page) {
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({ json: storePersonnelSession })
  })
  await page.route('**/api/feed**', async (route) => {
    await route.fulfill({ json: feedFixture })
  })
  await page.route('**/api/reports/my-performance**', async (route) => {
    await route.fulfill({ json: myPerformanceFixture })
  })
  await page.route('**/api/reports/kpi-config', async (route) => {
    await route.fulfill({ json: kpiConfigFixture })
  })
  await page.route('**/api/reports/rankings**', async (route) => {
    await route.fulfill({ json: rankingsFixture })
  })
  await page.route('**/api/store/me/incentives', async (route) => {
    await route.fulfill({ json: ownIncentiveFixture })
  })
}

const storePersonnelSession = {
  authMode: 'mock',
  authenticated: true,
  user: {
    userId: 'store-personnel-persona-user',
    employeeId,
    email: 'store.personnel@example.test',
    username: 'store-personnel-persona-user',
    displayName: 'Store Personnel',
    roleCodes: ['STORE_PERSONNEL'],
    scope: { companyIds: [companyId], regionIds: [], storeIds: [storeId] },
    readScope: { companyIds: [companyId], regionIds: [], storeIds: [storeId] },
    actionScope: { assignedStoreIds: [] },
    assignedStoreIds: [],
  },
  scopeSummary: { companyCount: 1, regionCount: 0, storeCount: 1, assignedStoreCount: 0 },
}

const feedFixture = {
  items: [{
    feedPostId: 'feed-1',
    postType: 'announcement',
    title: null,
    body: 'Pilot mağaza duyurusu',
    linkLabel: null,
    linkUrl: null,
    visibilityScopeType: 'store',
    visibilityScopeIds: [storeId],
    isPinned: true,
    publishStatus: 'published',
    publishedAt: '2026-06-01T08:00:00.000Z',
    startsAt: null,
    endsAt: null,
    metricCode: null,
    metricLabel: null,
    challengeStartsOn: null,
    challengeEndsOn: null,
    targetRoute: null,
    createdByUserId: 'region-user-1',
    updatedByUserId: 'region-user-1',
    createdAt: '2026-06-01T08:00:00.000Z',
    updatedAt: '2026-06-01T08:00:00.000Z',
  }],
  meta: { count: 1, total: 1, limit: 50, offset: 0 },
}

const kpiConfigFixture = {
  storeProfile: { profileCode: 'store', title: 'Store score', summary: '', metrics: [], futureMetricRule: '' },
  personnelProfile: {
    profileCode: 'personnel',
    title: 'Personnel score',
    summary: '',
    metrics: [
      {
        code: 'TARGET_ACHIEVEMENT',
        label: 'Hedef gerçekleşme',
        weightPercent: 40,
        ownerRole: 'STORE_PERSONNEL',
        scoreBehavior: 'task_candidate',
      },
    ],
    futureMetricRule: '',
  },
  ownershipMatrix: [],
  gradingBands: [],
  metadata: {
    kpiConfigVersionId: null,
    versionNo: null,
    effectiveFrom: null,
    effectiveTo: null,
    publishedAt: null,
    publishedBy: null,
  },
}

const myPerformanceFixture = {
  source: { mode: 'live', snapshotRunId: null, snapshotDate: null },
  employee: {
    employeeId,
    displayName: 'Store Personnel',
    storeId,
    storeName: 'IstinyePark Demo Store',
  },
  period: { periodStart: '2026-06-01', periodEnd: '2026-06-30' },
  score: { value: 91.5, matchedMetrics: 1, totalMetrics: 1 },
  rankings: { turkeyRank: 18, turkeyPopulation: 420, storeRank: 2, storePopulation: 5 },
  coverage: { targetAchievement: 112.3, targetValue: 100000, actualValue: 112300 },
  availablePeriods: [
    { periodType: 'monthly', periodStart: '2026-06-01', periodEnd: '2026-06-30' },
  ],
  partial: {
    isPartial: false,
    missingMetricCodes: [],
    missingMetricLabels: [],
    pendingNormalizationCodes: [],
    pendingNormalizationLabels: [],
  },
  supporting: {
    netSalesValue: 112300,
    targetEntryMode: 'manager_assignment',
    targetEditableByCurrentUser: false,
  },
  metrics: [
    {
      code: 'TARGET_ACHIEVEMENT',
      label: 'Hedef gerçekleşme',
      scoreValue: 91.5,
      contributionValue: 36.6,
      weightPercent: 40,
      actualValue: 112300,
      targetValue: 100000,
      achievementRate: 112.3,
      status: 'healthy',
      dataStatus: 'complete',
      scoreStatus: 'complete',
    },
  ],
}

const rankingsFixture = {
  items: [],
  meta: { count: 0, total: 0, limit: 100, offset: 0 },
  period: { periodStart: '2026-06-01', periodEnd: '2026-06-30', periodType: 'monthly' },
}

const ownIncentiveFixture = {
  data: {
    period: '2026-06',
    periodStart: '2026-06-01',
    periodEnd: '2026-06-30',
    periodTimezone: 'Europe/Istanbul',
    roleScope: 'own',
    projections: [
      {
        period: '2026-06',
        periodTimezone: 'Europe/Istanbul',
        closeCutoffAt: null,
        ruleVersionId: 'sales-target-incentive-v1.0.0',
        storeId,
        storeName: 'IstinyePark Demo Store',
        storeOwnershipType: 'company',
        roleScope: 'own',
        storeTarget: '1000000.00',
        storeActualNetSales: '1150000.00',
        storeAchievementPct: '115.0000',
        storeGatePassed: true,
        calculationState: 'projected',
        blockedReason: null,
        lastImportAt: '2026-06-18T08:00:00.000Z',
        rows: [
          {
            employeeId,
            displayName: 'Store Personnel',
            participantType: 'personnel',
            positionCode: 'SALES_ASSOCIATE',
            normalizedFromPositionCode: null,
            target: '100000.00',
            actualPositiveSales: '112300.00',
            achievementPct: '112.3000',
            storeAchievementPct: '115.0000',
            storeGatePassed: true,
            rate: '0.0165',
            rawEarnedAmount: '1852.950000',
            payableAmount: '1852.95',
            correctionAmount: null,
            adjustmentAmount: null,
            finalAmount: null,
            status: 'projected',
            blockedReason: null,
            rateTableVersion: 'personnel-sales-target-v1.0.0',
            explanation: 'Fixture projection.',
          },
        ],
      },
    ],
  },
}
