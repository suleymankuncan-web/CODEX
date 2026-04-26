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
  await expect(page.getByText('Skor yorumu')).toBeVisible()
  await expect(page.getByText('Guclu performans')).toBeVisible()
  await expect(page.getByText('Veri guveni: 3/3 metrik skorlandi.')).toBeVisible()
  await expect(page.getByText('Veri kaynagi').first()).toBeVisible()
  await expect(page.getByText('Derived score signal')).toBeVisible()
  await expect(page.getByText('Imported operational data').first()).toBeVisible()
  await expect(page.getByText('Turkey ranking')).toBeVisible()
  await expect(page.getByText('Store ranking')).toBeVisible()
  await expect(page.getByText('TARGET_ACHIEVEMENT')).toBeVisible()
  await expect(page.getByText('ATV', { exact: true })).toBeVisible()
  await expect(page.getByText('UPT', { exact: true })).toBeVisible()
  await expect(page.getByText('Performans yuzeyi acilamadi')).toHaveCount(0)
})

test('store KPI highlights page explains metric source semantics', async ({ page }) => {
  await page.goto('/store/kpis')

  await expect(page.getByText('Weighted Score Summary')).toBeVisible()
  await expect(page.getByText('Veri kaynagi').first()).toBeVisible()
  await expect(page.getByText('Derived score signal')).toBeVisible()
  await expect(page.getByText('Imported operational data').first()).toBeVisible()
  await expect(page.getByText('KPI rows unavailable')).toHaveCount(0)
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

  await expect(page.getByRole('heading', { name: /Gunluk ve aylik kapanis siralamasi/i })).toBeVisible()
  await expect(page.getByText('Mevcut siralama')).toBeVisible()
  await expect(page.getByText('Store Personnel - 1/4')).toBeVisible()
  await expect(page.getByText('KPI mini siralari')).toBeVisible()
  await expect(page.getByText('TR 1/4')).toBeVisible()
  await expect(page.getByText('Siralama yuzeyi acilamadi')).toHaveCount(0)
})

test('store rankings page explains monthly preview-only ranking', async ({ page }) => {
  await page.goto('/store/rankings')
  await page.getByRole('button', { name: 'Aylik' }).click()

  const rankingExplanation = page.getByLabel('Ranking explanation')
  await expect(rankingExplanation.getByText('On izleme')).toBeVisible()
  await expect(rankingExplanation.getByText('1 kapali performans gunu daha gerekiyor')).toBeVisible()
  await expect(page.getByText('Siralama yok').first()).toBeVisible()
  await expect(page.getByText('2/2 kapali gun').first()).toBeVisible()
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

test('store competitions page renders scoped contribution details', async ({ page }) => {
  await page.goto('/store/competitions')

  await expect(page.getByRole('heading', { name: /Store competitions/i })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'April Region Challenge' })).toBeVisible()
  const readSummary = page.getByLabel('Store competition read summary')
  const contributionRows = page.getByLabel('Scoped store competition contributions')
  await expect(readSummary.getByText('Okuma özeti')).toBeVisible()
  await expect(readSummary.getByText('95% katkı kapsamı')).toBeVisible()
  await expect(contributionRows.getByText('Katkı sağlığı')).toBeVisible()
  await expect(contributionRows.getByText('Kısmi katkı').first()).toBeVisible()
  await expect(contributionRows.getByText('BM checklist', { exact: true })).toBeVisible()
  await expect(page.getByText('Kapsamdaki katkılar')).toBeVisible()
  await expect(page.getByText('IstinyePark Demo Store')).toBeVisible()
  await expect(page.getByText('93.50')).toBeVisible()
  await expect(page.getByText('Outside Region Store')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Recalculate/ })).toHaveCount(0)
})

test('language toggle localizes competition read labels and persists preference', async ({ page }) => {
  await page.goto('/store/competitions')

  const readSummary = page.getByLabel('Store competition read summary')
  const contributionRows = page.getByLabel('Scoped store competition contributions')

  await expect(readSummary.getByRole('heading', { name: 'Okuma özeti' })).toBeVisible()
  await expect(readSummary.getByText('95% katkı kapsamı')).toBeVisible()
  await expect(contributionRows.getByText('Katkı sağlığı')).toBeVisible()
  await expect(contributionRows.getByText('Kısmi katkı').first()).toBeVisible()

  await page.getByRole('button', { name: 'İngilizceye geç' }).click()

  await expect(readSummary.getByRole('heading', { name: 'Read summary' })).toBeVisible()
  await expect(readSummary.getByText('95% contribution coverage')).toBeVisible()
  await expect(contributionRows.getByText('Contribution health')).toBeVisible()
  await expect(contributionRows.getByText('Partial contribution').first()).toBeVisible()

  await page.reload()

  await expect(readSummary.getByRole('heading', { name: 'Read summary' })).toBeVisible()
  await expect(contributionRows.getByText('Contribution health')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Switch language to Turkish' })).toHaveAttribute(
    'aria-pressed',
    'false',
  )
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

  await page.route('**/api/reports/store-kpi-highlights**', async (route) => {
    await route.fulfill({ json: storeKpiHighlightsFixture })
  })

  await page.route('**/api/reports/leaderboards/closed**', async (route) => {
    const requestUrl = new URL(route.request().url())
    await route.fulfill({
      json:
        requestUrl.searchParams.get('periodType') === 'monthly'
          ? closedLeaderboardMonthlyPreviewFixture
          : closedLeaderboardFixture,
    })
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

  await page.route('**/api/competitions**', async (route) => {
    const request = route.request()
    const pathname = new URL(request.url()).pathname

    if (request.method() === 'GET' && pathname.endsWith('/api/competitions')) {
      await route.fulfill({
        json: {
          items: [competitionFixture],
          meta: { count: 1, total: 1, limit: 50, offset: 0 },
        },
      })
      return
    }

    if (
      request.method() === 'GET' &&
      pathname.endsWith(`/api/competitions/${competitionFixture.competitionId}`)
    ) {
      await route.fulfill({ json: competitionDetailFixture })
      return
    }

    await route.fulfill({
      status: 403,
      json: { message: 'Store competition surface is read-only' },
    })
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
      {
        code: 'UPT',
        label: 'Units Per Ticket',
        weightPercent: 25,
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

const storeKpiHighlightsFixture = {
  source: {
    mode: 'live',
    snapshotRunId: null,
    snapshotDate: null,
    periodType: 'monthly',
  },
  store: {
    storeId: demoStoreId,
    storeName: 'IstinyePark Demo Store',
  },
  period: {
    periodStart: '2026-04-01',
    periodEnd: '2026-04-30',
  },
  score: {
    value: 91.5,
    matchedMetrics: 2,
    totalMetrics: 2,
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
  metrics: [
    {
      code: 'TARGET_ACHIEVEMENT',
      label: 'Target Achievement',
      weightPercent: 35,
      actualValue: 0.98,
      targetValue: null,
      achievementRate: 0.98,
      statusBand: 'exceeded',
      dataStatus: 'reported',
      scoreStatus: 'scored',
    },
    {
      code: 'UPT',
      label: 'Units Per Ticket',
      weightPercent: 25,
      actualValue: 95,
      targetValue: null,
      achievementRate: 95,
      statusBand: 'on_track',
      dataStatus: 'reported',
      scoreStatus: 'scored',
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
    rankingStatus: 'official',
    eligibilityReason: 'eligible',
    neededPerformanceDays: 0,
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
      rankingStatus: 'official',
      eligibilityReason: 'eligible',
      neededPerformanceDays: 0,
      metricRanks: [],
    },
  ],
}

const closedLeaderboardMonthlyPreviewFixture = {
  ...closedLeaderboardFixture,
  source: {
    ...closedLeaderboardFixture.source,
    periodType: 'monthly',
    snapshotRunId: null,
    snapshotDate: '2026-04-02',
    periodStart: '2026-04-01',
    periodEnd: '2026-04-30',
  },
  currentEmployee: {
    ...closedLeaderboardFixture.currentEmployee,
    rankings: {
      turkeyRank: null,
      turkeyPopulation: 4,
      storeRank: null,
      storePopulation: 3,
    },
    coverage: {
      closedDaysInPeriod: 2,
      daysWithPerformance: 2,
      minimumRequiredDays: 3,
      isEligibleForRanking: false,
    },
    rankingStatus: 'preview_only',
    eligibilityReason: 'needs_more_closed_days',
    neededPerformanceDays: 1,
  },
  personnelTop: [
    {
      ...closedLeaderboardFixture.personnelTop[0],
      rankings: {
        turkeyRank: null,
        turkeyPopulation: 4,
        storeRank: null,
        storePopulation: 3,
      },
      coverage: {
        closedDaysInPeriod: 2,
        daysWithPerformance: 2,
        minimumRequiredDays: 3,
        isEligibleForRanking: false,
      },
      rankingStatus: 'preview_only',
      eligibilityReason: 'needs_more_closed_days',
      neededPerformanceDays: 1,
    },
  ],
}

const competitionFixture = {
  competitionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  competitionCode: 'APRIL_REGION_CHALLENGE',
  competitionName: 'April Region Challenge',
  description: null,
  competitionType: 'region_challenge',
  lifecycleState: 'active',
  startsOn: '2026-04-22',
  endsOn: '2026-04-24',
}

const competitionDetailFixture = {
  competition: competitionFixture,
  stages: [
    {
      competitionStageId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      competitionId: competitionFixture.competitionId,
      stageCode: 'QUALIFIER',
      stageName: 'Qualifier',
      stageOrder: 1,
      stageType: 'qualifier',
      startsOn: '2026-04-22',
      endsOn: '2026-04-24',
      lifecycleState: 'active',
      finalizationState: null,
    },
  ],
  teams: [
    {
      competitionTeamId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      teamCode: 'MARMARA_DEMO',
      teamName: 'Marmara Demo',
      teamOrder: 1,
      stores: [
        {
          storeId: demoStoreId,
          storeCode: 'DEMO-100',
          storeName: 'IstinyePark Demo Store',
          regionId: '00000000-0000-0000-0000-000000000010',
        },
      ],
    },
  ],
  latestScores: [
    {
      stageId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      teamId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      teamCode: 'MARMARA_DEMO',
      teamName: 'Marmara Demo',
      snapshotDate: '2026-04-22',
      scoreValue: 92.45,
      validStoreCount: 1,
      totalStoreCount: 1,
      coverageRate: 1,
      rankPosition: 1,
      rankingPopulation: 2,
    },
  ],
  warnings: [],
  storeContributions: [
    {
      stageId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      teamId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      teamCode: 'MARMARA_DEMO',
      teamName: 'Marmara Demo',
      storeId: demoStoreId,
      storeCode: 'DEMO-100',
      storeName: 'IstinyePark Demo Store',
      regionId: '00000000-0000-0000-0000-000000000010',
      snapshotDate: '2026-04-22',
      scoreValue: 93.5,
      reportedWeightPercent: 95,
      expectedWeightPercent: 100,
      hasDailyData: true,
      missingKpiCodes: ['BM_CHECKLIST'],
    },
  ],
}
