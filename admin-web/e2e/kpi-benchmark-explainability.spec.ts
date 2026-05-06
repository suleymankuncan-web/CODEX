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
        mockRoleCodes: 'STORE_PERSONNEL,STORE_MANAGER',
        mockCompanyIds: '00000000-0000-0000-0000-000000000001',
        bearerToken: '',
      }),
    )
  })

  await routeBenchmarkExplainabilityApi(page)
})

test('kpi metrics explain capped benchmark performance', async ({ page }) => {
  await page.goto('/store/kpis')

  await expect(page.getByText('Skor limiti 120%+')).toBeVisible()
  await expect(page.getByText('Gerçek oran %148')).toBeVisible()
})

test('my performance explains missing benchmark or target', async ({ page }) => {
  await page.goto('/store/me')

  await expect(page.getByText('Eksik referans: benchmark_missing')).toBeVisible()
})

test('store KPI closed view explains effective BM and VM checklist weights', async ({ page }) => {
  await page.goto('/store/kpis')

  await page.getByRole('button', { name: 'Kapanmış gün' }).click()

  await expect(page.getByText('VM checklist: bu dönem skora dahil edilmedi')).toBeVisible()
  await expect(page.getByText('VM payı KPI tarafında kaldı')).toBeVisible()
  await expect(page.getByText('BM checklist katkısı')).toBeVisible()
  await expect(page.getByText('Configured 90/5/5')).toBeVisible()
  await expect(page.getByText('Effective 95/5/0')).toBeVisible()
})

test('store KPI closed view lets users choose a closed snapshot from the list', async ({ page }) => {
  await page.goto('/store/kpis')

  await page.getByRole('button', { name: 'Kapanmış gün' }).click()
  await expect(
    page.getByRole('option', {
      name: '20 Nis 2026 kapanışı - Nisan aylık kapanış',
    }),
  ).toBeAttached()
  await page
    .getByLabel('Kapanmış KPI kaydı seçimi')
    .selectOption('snapshot-2026-04-20')

  await expect(page.getByText('1 VM checklist yapıldı')).toBeVisible()
  await expect(page.getByText('VM checklist katkısı 5')).toBeVisible()
  await expect(page.getByText('Effective 95/0/5')).toBeVisible()
})

async function routeBenchmarkExplainabilityApi(page: Page) {
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({ json: authSessionFixture })
  })

  await page.route('**/api/reports/kpi-config', async (route) => {
    await route.fulfill({ json: kpiConfigFixture })
  })

  await page.route('**/api/reports/store-kpi-highlights**', async (route) => {
    await route.fulfill({ json: storeKpiHighlightsFixture })
  })

  await page.route('**/api/reports/snapshot-runs**', async (route) => {
    await route.fulfill({ json: snapshotRunsFixture })
  })

  await page.route('**/api/reports/kpis**', async (route) => {
    const requestUrl = new URL(route.request().url())
    await route.fulfill({
      json:
        requestUrl.searchParams.get('snapshotRunId') === 'snapshot-2026-04-20'
          ? kpiRowsFixtureForVmSnapshot
          : kpiRowsFixture,
    })
  })

  await page.route('**/api/reports/store-score-breakdown**', async (route) => {
    const requestUrl = new URL(route.request().url())
    await route.fulfill({
      json:
        requestUrl.searchParams.get('snapshotRunId') === 'snapshot-2026-04-20'
          ? storeScoreBreakdownVmFixture
          : storeScoreBreakdownFixture,
    })
  })

  await page.route('**/api/reports/my-performance**', async (route) => {
    await route.fulfill({ json: myPerformanceFixture })
  })
}

const authSessionFixture = {
  authMode: 'mock',
  authenticated: true,
  user: {
    userId: 'store-me-smoke-user',
    employeeId: demoEmployeeId,
    roleCodes: ['STORE_PERSONNEL', 'STORE_MANAGER'],
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

const kpiConfigFixture = {
  storeProfile: {
    profileCode: 'store',
    title: 'Store Score',
    summary: 'Store score profile',
    futureMetricRule: 'Manual review',
    metrics: [
      {
        code: 'UPT',
        label: 'UPT',
        weightPercent: 15,
        ownerRole: 'STORE_MANAGER',
        scoreBehavior: 'warning_first',
        direction: 'HIGHER_IS_BETTER',
        benchmarkSource: 'TURKEY_AVERAGE',
        capRatio: 1.2,
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
        scoreBehavior: 'warning_first',
        direction: 'HIGHER_IS_BETTER',
        benchmarkSource: 'TARGET',
        capRatio: 1.2,
      },
    ],
  },
  ownershipMatrix: [],
  gradingBands: [
    { code: 'A', label: 'Mukemmel', emoji: 'A', tone: 'calm', minScore: 1 },
    { code: 'D', label: 'Kritik', emoji: 'D', tone: 'danger', minScore: 0 },
  ],
  metadata: {
    kpiConfigVersionId: null,
    versionNo: null,
    effectiveFrom: null,
    effectiveTo: null,
    publishedAt: null,
    publishedBy: null,
  },
}

const storeKpiHighlightsFixture = {
  source: {
    mode: 'live',
    snapshotRunId: null,
    snapshotDate: null,
    periodType: 'daily',
  },
  store: {
    storeId: demoStoreId,
    storeName: 'IstinyePark Demo Store',
  },
  period: {
    periodStart: '2026-03-01',
    periodEnd: '2026-03-01',
  },
  score: {
    value: 0.18,
    matchedMetrics: 1,
    totalMetrics: 1,
  },
  availablePeriods: [],
  partial: {
    isPartial: false,
    missingMetricCodes: [],
    missingMetricLabels: [],
    pendingNormalizationCodes: [],
    pendingNormalizationLabels: [],
  },
  metrics: [
    {
      code: 'UPT',
      label: 'UPT',
      weightPercent: 15,
      actualValue: 4.44,
      targetValue: null,
      benchmarkValue: 3,
      benchmarkSource: 'TURKEY_AVERAGE',
      achievementRate: 1.48,
      actualRatio: 1.48,
      scoredRatio: 1.2,
      capRatio: 1.2,
      isCapped: true,
      scoreContribution: 18,
      missingReason: null,
      statusBand: 'on_track',
      dataStatus: 'reported',
      scoreStatus: 'scored',
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
    periodStart: '2026-03-01',
    periodEnd: '2026-03-01',
  },
  score: {
    value: 0,
    matchedMetrics: 0,
    totalMetrics: 1,
  },
  rankings: {
    turkeyRank: null,
    turkeyPopulation: 0,
    storeRank: null,
    storePopulation: 0,
  },
  availablePeriods: [],
  partial: {
    isPartial: true,
    missingMetricCodes: [],
    missingMetricLabels: [],
    pendingNormalizationCodes: ['TARGET_ACHIEVEMENT'],
    pendingNormalizationLabels: ['Target Achievement'],
  },
  supporting: {
    netSalesValue: null,
    targetEntryMode: 'manager_assignment',
    targetEditableByCurrentUser: false,
  },
  metrics: [
    {
      code: 'TARGET_ACHIEVEMENT',
      label: 'Target Achievement',
      weightPercent: 40,
      actualValue: 110000,
      targetValue: null,
      benchmarkValue: null,
      benchmarkSource: 'TARGET',
      achievementRate: null,
      actualRatio: null,
      scoredRatio: null,
      capRatio: 1.2,
      isCapped: false,
      missingReason: 'benchmark_missing',
      contributionValue: 0,
      dataStatus: 'reported',
      scoreStatus: 'missing_reference',
      status: 'reported',
    },
  ],
}

const snapshotRunsFixture = {
  items: [
    {
      snapshotRunId: 'snapshot-1',
      snapshotDate: '2026-03-31',
      snapshotType: 'daily',
      periodStart: '2026-03-31',
      periodEnd: '2026-03-31',
      runStatus: 'completed',
      generatedAt: '2026-04-01T00:00:00.000Z',
      generatedBy: 'system',
    },
    {
      snapshotRunId: 'snapshot-2026-04-20',
      snapshotDate: '2026-04-20',
      snapshotType: 'daily',
      periodStart: '2026-04-01',
      periodEnd: '2026-04-30',
      runStatus: 'completed',
      generatedAt: '2026-04-20T21:00:00.000Z',
      generatedBy: 'system',
    },
  ],
  meta: { count: 2, total: 2, limit: 30, offset: 0 },
}

const kpiRowsFixture = {
  items: [
    {
      snapshotRunId: 'snapshot-1',
      storeId: demoStoreId,
      kpiId: 'kpi-1',
      kpiCode: 'TARGET_ACHIEVEMENT',
      kpiName: 'Target Achievement',
      periodStart: '2026-03-31',
      periodEnd: '2026-03-31',
      targetValue: '100',
      actualValue: '100',
      achievementRate: '1',
      statusBand: 'on_track',
    },
  ],
  meta: { count: 1, total: 1, limit: 50, offset: 0 },
}

const kpiRowsFixtureForVmSnapshot = {
  items: [
    {
      snapshotRunId: 'snapshot-2026-04-20',
      storeId: demoStoreId,
      kpiId: 'kpi-1',
      kpiCode: 'TARGET_ACHIEVEMENT',
      kpiName: 'Target Achievement',
      periodStart: '2026-04-01',
      periodEnd: '2026-04-30',
      targetValue: '100',
      actualValue: '0',
      achievementRate: '0',
      statusBand: 'off_track',
    },
  ],
  meta: { count: 1, total: 1, limit: 50, offset: 0 },
}

const storeScoreBreakdownFixture = {
  snapshotRunId: 'snapshot-1',
  storeId: demoStoreId,
  scoreStatus: 'final',
  totalScore: 99,
  missingWeightPolicy: 'return_missing_weight_to_kpi',
  configuredWeights: {
    kpiPerformanceWeight: 90,
    bmChecklistWeight: 5,
    vmChecklistWeight: 5,
  },
  effectiveWeights: {
    kpiPerformanceWeight: 95,
    bmChecklistWeight: 5,
    vmChecklistWeight: 0,
  },
  components: {
    kpi: {
      included: true,
      score: 100,
      weight: 95,
      contribution: 95,
      status: 'included',
    },
    bmChecklist: {
      included: true,
      score: 80,
      weight: 5,
      contribution: 4,
      visitCount: 1,
      status: 'included',
    },
    vmChecklist: {
      included: false,
      score: null,
      weight: 0,
      contribution: null,
      visitCount: 0,
      status: 'not_included',
      missingReason: 'vm_checklist_not_completed_for_period',
    },
  },
}

const storeScoreBreakdownVmFixture = {
  snapshotRunId: 'snapshot-2026-04-20',
  storeId: demoStoreId,
  scoreStatus: 'final',
  totalScore: 5,
  missingWeightPolicy: 'return_missing_weight_to_kpi',
  configuredWeights: {
    kpiPerformanceWeight: 90,
    bmChecklistWeight: 5,
    vmChecklistWeight: 5,
  },
  effectiveWeights: {
    kpiPerformanceWeight: 95,
    bmChecklistWeight: 0,
    vmChecklistWeight: 5,
  },
  components: {
    kpi: {
      included: true,
      score: 0,
      weight: 95,
      contribution: 0,
      status: 'included',
    },
    bmChecklist: {
      included: false,
      score: null,
      weight: 0,
      contribution: null,
      visitCount: 0,
      status: 'not_included',
      missingReason: 'bm_checklist_not_completed_for_period',
    },
    vmChecklist: {
      included: true,
      score: 100,
      weight: 5,
      contribution: 5,
      visitCount: 1,
      status: 'included',
    },
  },
}
