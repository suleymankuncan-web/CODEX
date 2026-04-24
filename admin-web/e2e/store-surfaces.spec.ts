import { expect, test, type Page } from '@playwright/test'

const demoStoreId = '00000000-0000-0000-0000-000000000100'
const demoEmployeeId = '00000000-0000-0000-0000-000000000202'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'store-ops-admin-session',
      JSON.stringify({
        mode: 'mock',
        mockUserId: 'store-me-smoke-user',
        mockRoleCodes: 'STORE_PERSONNEL',
        mockCompanyIds: '00000000-0000-0000-0000-000000000001',
        bearerToken: '',
      }),
    )
  })

  await routeStoreSurfaceApi(page)
})

test('store self-performance page renders live score, metrics, and ranks', async ({ page }) => {
  await page.goto('/store/me')

  await expect(page.getByRole('heading', { name: /Store personnel icin/i })).toBeVisible()
  await expect(page.getByText('Weighted score')).toBeVisible()
  await expect(page.getByText('Turkey ranking')).toBeVisible()
  await expect(page.getByText('Store ranking')).toBeVisible()
  await expect(page.getByText('TARGET_ACHIEVEMENT')).toBeVisible()
  await expect(page.getByText('ATV')).toBeVisible()
  await expect(page.getByText('UPT')).toBeVisible()
  await expect(page.getByText('Performans yuzeyi acilamadi')).toHaveCount(0)
})

test('store shell exposes a main landmark and hides technical auth roles', async ({ page }) => {
  await page.goto('/store/me')

  await expect(page.getByRole('main', { name: 'Store workspace' })).toBeVisible()
  await expect(page.getByText('STORE_PERSONNEL, STORE_MANAGER')).toBeVisible()
  await expect(page.getByText('offline_access')).toHaveCount(0)
  await expect(page.getByText('uma_authorization')).toHaveCount(0)
  await expect(page.getByText('default-roles-store-ops')).toHaveCount(0)
})

test('store rankings page renders closed leaderboard and metric mini-ranks', async ({ page }) => {
  await page.goto('/store/rankings')

  await expect(page.getByRole('heading', { name: /Gunluk ve aylik closure ranking/i })).toBeVisible()
  await expect(page.getByText('Current rank')).toBeVisible()
  await expect(page.getByText('Store Personnel - 1/4')).toBeVisible()
  await expect(page.getByText('KPI mini-ranks')).toBeVisible()
  await expect(page.getByText('TR 1/4')).toBeVisible()
  await expect(page.getByText('Siralama yuzeyi acilamadi')).toHaveCount(0)
})

test('store tasks page renders readable Turkish queue labels', async ({ page }) => {
  await page.goto('/store/tasks')

  await expect(page.getByRole('heading', { name: /One queue for actionable work/i })).toBeVisible()
  await expect(page.getByText('Önce bakılması gereken işler.')).toBeVisible()
  await expect(page.getByText('İş tipi')).toBeVisible()
  await expect(page.getByText('Aksiyon zamanı')).toBeVisible()
  await expect(page.getByText('Görev')).toBeVisible()
  await expect(page.getByText('Detay aç')).toBeVisible()
  await expect(page.locator('body')).not.toContainText('Ã')
  await expect(page.locator('body')).not.toContainText('Ä')
  await expect(page.locator('body')).not.toContainText('Å')
})

async function routeStoreSurfaceApi(page: Page) {
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({ json: authSessionFixture })
  })

  await page.route('**/api/reports/kpi-config', async (route) => {
    await route.fulfill({ json: kpiConfigFixture })
  })

  await page.route('**/api/reports/my-performance**', async (route) => {
    await route.fulfill({ json: myPerformanceFixture })
  })

  await page.route('**/api/reports/leaderboards/closed**', async (route) => {
    await route.fulfill({ json: closedLeaderboardFixture })
  })

  await page.route('**/api/reports/snapshot-runs**', async (route) => {
    await route.fulfill({
      json: {
        items: [
          {
            snapshotRunId: 'snapshot-2026-04-24',
            snapshotDate: '2026-04-24',
            snapshotType: 'daily',
            periodStart: '2026-04-24',
            periodEnd: '2026-04-24',
            runStatus: 'completed',
            generatedAt: '2026-04-24T08:00:00.000Z',
            generatedBy: 'release-smoke',
          },
        ],
        meta: {
          count: 1,
          total: 1,
          limit: 30,
          offset: 0,
        },
      },
    })
  })

  await page.route('**/api/workflow/inbox', async (route) => {
    await route.fulfill({ json: workflowInboxFixture })
  })
}

const authSessionFixture = {
  authMode: 'mock',
  authenticated: true,
  user: {
    userId: 'store-me-smoke-user',
    employeeId: demoEmployeeId,
    roleCodes: ['STORE_PERSONNEL', 'STORE_MANAGER', 'offline_access', 'uma_authorization', 'default-roles-store-ops'],
    scope: {
      companyIds: ['00000000-0000-0000-0000-000000000001'],
      regionIds: ['00000000-0000-0000-0000-000000000010'],
      storeIds: [demoStoreId],
    },
    readScope: {
      companyIds: ['00000000-0000-0000-0000-000000000001'],
      regionIds: ['00000000-0000-0000-0000-000000000010'],
      storeIds: [demoStoreId],
    },
    actionScope: {
      assignedStoreIds: [demoStoreId],
    },
    assignedStoreIds: [demoStoreId],
  },
  scopeSummary: {
    companyCount: 1,
    regionCount: 1,
    storeCount: 1,
    assignedStoreCount: 1,
  },
}

const workflowInboxFixture = {
  items: [
    {
      itemType: 'task',
      sourceType: 'kpi_exception',
      sourceId: 'snapshot-2026-04-24:store:kpi',
      title: 'UPT at risk',
      summary: 'IstinyePark Demo Store icin KPI exception takibi gerekiyor',
      storeId: demoStoreId,
      storeName: 'IstinyePark Demo Store',
      workflowStatus: 'at_risk',
      inboxStatus: 'needs_attention',
      urgency: 'high',
      createdAt: '2026-04-24T08:00:00.000Z',
      needsAttentionAt: '2026-04-24T08:00:00.000Z',
      actorRole: 'STORE_MANAGER',
      primaryActionLabel: 'Open KPI detail',
      secondaryActionLabel: 'Detay aç',
      deepLink: '/store/kpis',
      historyPreview: 'Achievement 84%',
    },
  ],
  meta: {
    count: 1,
    total: 1,
    limit: 30,
    offset: 0,
  },
}

const kpiConfigFixture = {
  storeProfile: {
    profileCode: 'store',
    title: 'Store Score',
    summary: 'Store score profile',
    futureMetricRule: 'Manual review',
    metrics: [
      {
        code: 'TARGET_ACHIEVEMENT',
        label: 'Target Achievement',
        weightPercent: 35,
        ownerRole: 'STORE_MANAGER',
        scoreBehavior: 'score_only',
      },
    ],
  },
  personnelProfile: {
    profileCode: 'personnel',
    title: 'Personnel Score',
    summary: 'Personnel score profile',
    futureMetricRule: 'Manual review',
    metrics: [
      {
        code: 'TARGET_ACHIEVEMENT',
        label: 'Target Achievement',
        weightPercent: 40,
        ownerRole: 'STORE_PERSONNEL',
        scoreBehavior: 'score_only',
      },
      {
        code: 'ATV',
        label: 'Average Ticket Value',
        weightPercent: 30,
        ownerRole: 'STORE_PERSONNEL',
        scoreBehavior: 'score_only',
      },
      {
        code: 'UPT',
        label: 'Units Per Ticket',
        weightPercent: 30,
        ownerRole: 'STORE_PERSONNEL',
        scoreBehavior: 'score_only',
      },
    ],
  },
  ownershipMatrix: [],
  gradingBands: [
    {
      code: 'A',
      label: 'Excellent',
      emoji: 'A',
      tone: 'calm',
      minScore: 90,
    },
    {
      code: 'B',
      label: 'Healthy',
      emoji: 'B',
      tone: 'accent',
      minScore: 75,
    },
  ],
}

const myPerformanceFixture = {
  source: {
    mode: 'live',
    snapshotRunId: null,
    snapshotDate: null,
  },
  employee: {
    employeeId: demoEmployeeId,
    displayName: 'Store Personnel',
    storeId: demoStoreId,
    storeName: 'IstinyePark Demo Store',
  },
  period: {
    periodStart: '2026-04-01',
    periodEnd: '2026-04-30',
  },
  score: {
    value: 91.5,
    matchedMetrics: 3,
    totalMetrics: 3,
  },
  rankings: {
    turkeyRank: 1,
    turkeyPopulation: 4,
    storeRank: 1,
    storePopulation: 3,
  },
  availablePeriods: [
    {
      periodType: 'monthly',
      periodStart: '2026-04-01',
      periodEnd: '2026-04-30',
    },
  ],
  partial: {
    isPartial: false,
    missingMetricCodes: [],
    missingMetricLabels: [],
    pendingNormalizationCodes: [],
    pendingNormalizationLabels: [],
  },
  supporting: {
    netSalesValue: 145000,
    targetEntryMode: 'manager_assignment',
    targetEditableByCurrentUser: false,
  },
  metrics: [
    {
      code: 'TARGET_ACHIEVEMENT',
      label: 'Target Achievement',
      weightPercent: 40,
      actualValue: 0.98,
      targetValue: null,
      achievementRate: 0.98,
      contributionValue: 39.2,
      dataStatus: 'reported',
      scoreStatus: 'scored',
      status: 'reported',
    },
    {
      code: 'ATV',
      label: 'Average Ticket Value',
      weightPercent: 30,
      actualValue: 96,
      targetValue: null,
      achievementRate: 96,
      contributionValue: 28.8,
      dataStatus: 'reported',
      scoreStatus: 'scored',
      status: 'reported',
    },
    {
      code: 'UPT',
      label: 'Units Per Ticket',
      weightPercent: 30,
      actualValue: 95,
      targetValue: null,
      achievementRate: 95,
      contributionValue: 28.5,
      dataStatus: 'reported',
      scoreStatus: 'scored',
      status: 'reported',
    },
  ],
}

const closedLeaderboardFixture = {
  source: {
    mode: 'closed',
    periodType: 'daily',
    state: 'closed',
    snapshotRunId: 'snapshot-2026-04-24',
    snapshotDate: '2026-04-24',
    periodStart: '2026-04-24',
    periodEnd: '2026-04-24',
  },
  currentEmployee: {
    employeeId: demoEmployeeId,
    displayName: 'Store Personnel',
    storeId: demoStoreId,
    storeName: 'IstinyePark Demo Store',
    scoreValue: 91.5,
    rankings: {
      turkeyRank: 1,
      turkeyPopulation: 4,
      storeRank: 1,
      storePopulation: 3,
    },
    coverage: {
      closedDaysInPeriod: 1,
      daysWithPerformance: 1,
      minimumRequiredDays: 1,
      isEligibleForRanking: true,
    },
    metricRanks: [
      {
        code: 'TARGET_ACHIEVEMENT',
        label: 'Target Achievement',
        actualValue: 0.98,
        storeRank: 1,
        storePopulation: 3,
        turkeyRank: 1,
        turkeyPopulation: 4,
      },
      {
        code: 'ATV',
        label: 'Average Ticket Value',
        actualValue: 96,
        storeRank: 1,
        storePopulation: 3,
        turkeyRank: 2,
        turkeyPopulation: 4,
      },
      {
        code: 'UPT',
        label: 'Units Per Ticket',
        actualValue: 95,
        storeRank: 1,
        storePopulation: 3,
        turkeyRank: 1,
        turkeyPopulation: 4,
      },
    ],
  },
  personnelTop: [
    {
      employeeId: demoEmployeeId,
      displayName: 'Store Personnel',
      storeId: demoStoreId,
      storeName: 'IstinyePark Demo Store',
      scoreValue: 91.5,
      rankings: {
        turkeyRank: 1,
        turkeyPopulation: 4,
        storeRank: 1,
        storePopulation: 3,
      },
      coverage: {
        closedDaysInPeriod: 1,
        daysWithPerformance: 1,
        minimumRequiredDays: 1,
        isEligibleForRanking: true,
      },
      metricRanks: [],
    },
  ],
}
