import type { Page } from './test-fixtures'

export type StoreContractPersona =
  | 'regionManager'
  | 'storeManager'
  | 'storePersonnel'
  | 'visualMerchandiser'

export const companyId = 'company-contract-1'
export const regionId = 'region-contract-1'
export const storeIds = [
  'store-contract-balikesir',
  'store-contract-bursa',
  'store-contract-istanbul',
] as const
export const employeeIds = ['employee-contract-1', 'employee-contract-2'] as const

type JsonBody = Record<string, unknown> | unknown[] | string | number | boolean | null

const roleByPersona: Record<StoreContractPersona, string> = {
  regionManager: 'REGION_MANAGER',
  storeManager: 'STORE_MANAGER',
  storePersonnel: 'STORE_PERSONNEL',
  visualMerchandiser: 'VISUAL_MERCHANDISER',
}

const personaDisplayName: Record<StoreContractPersona, string> = {
  regionManager: 'Onur Kaytan',
  storeManager: 'Mert Alcan',
  storePersonnel: 'Ayşe Yılmaz',
  visualMerchandiser: 'Visual Merchandiser',
}

export function createStoreContractSession(persona: StoreContractPersona) {
  const roleCode = roleByPersona[persona]
  const isRegionManager = persona === 'regionManager'
  const isStoreScoped = persona !== 'regionManager'
  const assignedStoreIds = persona === 'storeManager' ? [storeIds[0]] : []
  const readStoreIds = isRegionManager ? [...storeIds] : isStoreScoped ? [storeIds[0]] : []
  const actionStoreIds = persona === 'storeManager' ? [storeIds[0]] : []

  return {
    authMode: 'mock',
    authenticated: true,
    user: {
      userId: `${persona}-contract-user`,
      employeeId: persona === 'storePersonnel' ? employeeIds[0] : null,
      email: `${persona}@example.test`,
      username: `${persona}-contract-user`,
      displayName: personaDisplayName[persona],
      roleCodes: [roleCode],
      scope: {
        companyIds: [companyId],
        regionIds: isRegionManager ? [regionId] : [],
        storeIds: isStoreScoped ? [storeIds[0]] : [],
      },
      readScope: {
        companyIds: [companyId],
        regionIds: isRegionManager ? [regionId] : [],
        storeIds: readStoreIds,
      },
      actionScope: {
        assignedStoreIds: actionStoreIds,
        assignedStoreTypes: actionStoreIds.length > 0 ? ['company'] : [],
      },
      assignedStoreIds,
    },
    scopeSummary: {
      companyCount: 1,
      regionCount: isRegionManager ? 1 : 0,
      storeCount: isRegionManager ? storeIds.length : readStoreIds.length,
      assignedStoreCount: assignedStoreIds.length,
    },
  }
}

export async function installStoreContractSession(page: Page, persona: StoreContractPersona) {
  const session = createStoreContractSession(persona)
  const user = session.user

  await page.addInitScript((input) => {
    window.localStorage.setItem(
      'store-ops-admin-session',
      JSON.stringify({
        mode: 'mock',
        mockUserId: input.userId,
        mockRoleCodes: input.roleCodes.join(','),
        mockCompanyIds: input.companyIds.join(','),
        mockRegionIds: input.regionIds.join(','),
        mockReadRegionIds: input.readRegionIds.join(','),
        mockStoreIds: input.storeIds.join(','),
        mockReadStoreIds: input.readStoreIds.join(','),
        mockAssignedStoreIds: input.assignedStoreIds.join(','),
        bearerToken: '',
      }),
    )
  }, {
    assignedStoreIds: user.assignedStoreIds,
    companyIds: user.scope.companyIds,
    readRegionIds: user.readScope.regionIds,
    readStoreIds: user.readScope.storeIds,
    regionIds: user.scope.regionIds,
    roleCodes: user.roleCodes,
    storeIds: user.scope.storeIds,
    userId: user.userId,
  })

  await page.unroute('**/api/auth/bootstrap').catch(() => undefined)
  await page.unroute('**/api/auth/session').catch(() => undefined)

  await page.route('**/api/auth/bootstrap', async (route) => {
    await route.fulfill({
      json: {
        authMode: 'mock',
        provider: {
          audience: null,
          authorizationUrl: null,
          callbackPath: '/auth/callback',
          clientId: null,
          configured: false,
          logoutUrl: null,
          postLogoutRedirectPath: '/auth/login',
          responseType: null,
          scope: null,
          tokenUrl: null,
        },
      },
    })
  })

  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({ json: session })
  })
}

export async function installGenericStoreApiFallbacks(page: Page) {
  await page.route('**/api/**', async (route) => {
    const fallback = resolveStoreContractApiFallback(route.request().method(), new URL(route.request().url()))
    if (fallback !== null) {
      await route.fulfill({ json: fallback })
      return
    }

    await route.fallback()
  })
}

function resolveStoreContractApiFallback(method: string, url: URL): JsonBody | null {
  const path = url.pathname.replace(/^\/api/, '')

  if (method !== 'GET' && method !== 'POST') return null
  if (path === '/auth/session' || path === '/auth/bootstrap') return null

  if (path === '/workflow/inbox') return emptyList(url)
  if (path === '/feed' || path === '/feed/posts') return createFeedPosts(url)
  if (path === '/store-actions/plans') return emptyList(url)
  if (path === '/competitions') return emptyList(url)
  if (path === '/mobile/checklists/today') return createChecklistTodayFixture()
  if (path === '/checklists/acknowledgements/list') return emptyList(url)
  if (path === '/reports/kpi-config') return createKpiConfig()
  if (path === '/reports/rankings') return createRankingsFixture(url)
  if (path === '/reports/store-kpi-highlights') return createStoreKpiHighlights()
  if (path === '/reports/store-score-breakdown') return createStoreScoreBreakdown()
  if (path === '/reports/my-performance') return createMyPerformance()
  if (path.startsWith('/reports/personnel-performance/')) return createMyPerformance()
  if (path === '/reports/summary') return createReportingSummary()
  if (path === '/reports/snapshot-runs') return emptyList(url)
  if (path === '/reports/store-monthly-package') return createStoreMonthlyPackage()
  if (path === '/reports/workforce') return emptyList(url)
  if (path === '/reports/kpis') return emptyList(url)
  if (path === '/reports/checklists') return emptyList(url)
  if (path === '/reports/turnover') return emptyList(url)
  if (path === '/target-distributions/coverage') return createTargetCoverage(url)
  if (path === '/target-distributions/requests') return emptyList(url)
  if (path === '/target-distributions/store-personnel') return emptyList(url)
  if (path === '/workforce/seller-code-reference') return createSellerCodeReference()
  if (path === '/workforce/seller-code-requests') return emptyList(url)
  if (path === '/workforce/offboarding-requests') return emptyList(url)
  if (path === '/workforce/position-options') return emptyList(url)
  if (path === '/workforce/store-employees') return emptyList(url)
  if (path === '/store/me/incentives') return createStoreIncentives('own')
  if (path === '/store/incentives') return createStoreIncentives('region')
  if (path === '/admin/incentives') return createStoreIncentives('admin')

  return null
}

function emptyList(url: URL) {
  const limit = Number(url.searchParams.get('limit') ?? '50')
  const offset = Number(url.searchParams.get('offset') ?? '0')

  return {
    items: [],
    meta: {
      count: 0,
      limit: Number.isFinite(limit) ? limit : 50,
      offset: Number.isFinite(offset) ? offset : 0,
      total: 0,
    },
  }
}

function createFeedPosts(url: URL) {
  return {
    ...emptyList(url),
    items: [
      {
        authorName: 'Onur Kaytan',
        body: 'Haftalık mağaza duyurusu yayınlandı.',
        createdAt: '2026-07-01T09:00:00.000Z',
        id: 'feed-contract-1',
        isPinned: true,
      },
    ],
  }
}

function createChecklistTodayFixture() {
  return {
    data: {
      activeInstances: [],
      completedThisMonth: [],
      monthlySummaries: [],
      pendingAcknowledgements: [],
      stores: storeIds.map((storeId, index) => ({
        city: ['Balıkesir', 'Bursa', 'İstanbul'][index],
        storeId,
        storeName: ['Balıkesir 10 Burda AVM', 'Bursa Downtown AVM', 'İstanbul MOI AVM'][index],
      })),
      templates: [
        {
          checklistTemplateId: 'template-contract-bm',
          items: [],
          templateCode: 'BM_STORE_VISIT_2026',
          templateName: 'BM Mağaza Ziyareti',
          templateType: 'BM_STORE_VISIT',
          versionNo: 1,
        },
        {
          checklistTemplateId: 'template-contract-vm',
          items: [],
          templateCode: 'VM_STORE_VISIT_2026',
          templateName: 'VM Mağaza Ziyareti',
          templateType: 'VM_STORE_VISIT',
          versionNo: 1,
        },
      ],
    },
  }
}

function createKpiConfig() {
  return {
    gradingBands: [{ code: 'strong', emoji: '', label: 'Güçlü', minScore: 80, tone: 'positive' }],
    metadata: {
      effectiveFrom: null,
      effectiveTo: null,
      kpiConfigVersionId: null,
      publishedAt: null,
      publishedBy: null,
      versionNo: null,
    },
    ownershipMatrix: [],
    personnelProfile: {
      futureMetricRule: 'Yeni metrikler katalog üzerinden eklenir.',
      metrics: [],
      profileCode: 'personnel',
      summary: 'Personel skoru',
      title: 'Personel skoru',
    },
    storeProfile: {
      futureMetricRule: 'Yeni metrikler katalog üzerinden eklenir.',
      metrics: [],
      profileCode: 'store',
      summary: 'Mağaza skoru',
      title: 'Mağaza skoru',
    },
  }
}

function createRankingsFixture(url: URL) {
  const periodStart = url.searchParams.get('periodStart') ?? '2026-07-01'
  const periodEnd = periodStart.replace(/-\d{2}$/, '-31')
  const storeRow = {
    city: 'İstanbul',
    metrics: [],
    rank: 1,
    scoreValue: 88,
    storeId: storeIds[0],
    storeName: 'İstanbul MOI AVM',
    visibility: 'summary',
  }
  const personnelRow = {
    displayName: 'Ayşe Yılmaz',
    employeeId: employeeIds[0],
    metricRanks: [],
    rank: 1,
    rankings: {
      storePopulation: 4,
      storeRank: 1,
      turkeyPopulation: 120,
      turkeyRank: 12,
    },
    scoreValue: 82,
    storeId: storeIds[0],
    storeName: 'İstanbul MOI AVM',
    visibility: 'summary',
  }

  return {
    access: {
      canSeeGlobalDetails: true,
      canSeeManagedStorePersonnelDetails: true,
      globalMode: 'full',
    },
    availablePeriods: [{ periodEnd, periodStart, periodType: 'monthly' }],
    filters: {
      regionManagers: [{ id: 'region-manager-contract', label: 'Onur Kaytan' }],
      regions: [{ id: regionId, label: 'Onur Kaytan Bölgesi' }],
      stores: [{ id: storeIds[0], label: 'İstanbul MOI AVM' }],
    },
    personnelLeaderboard: {
      currentEmployee: personnelRow,
      items: [personnelRow],
      managedStorePersonnel: [personnelRow],
      meta: { limit: 100, offset: 0, total: 1 },
    },
    reference: {
      personnel: { averageScore: 72, metrics: [] },
      store: { averageScore: 80, metrics: [] },
    },
    source: {
      mode: 'live',
      periodEnd,
      periodStart,
      periodType: 'monthly',
    },
    storeLeaderboard: {
      currentStore: storeRow,
      items: [storeRow],
      meta: { limit: 100, offset: 0, total: 1 },
    },
  }
}

function createStoreKpiHighlights() {
  return {
    availablePeriods: [
      { periodEnd: '2026-07-31', periodStart: '2026-07-01', periodType: 'monthly' },
    ],
    metrics: [
      {
        achievementRate: 1.05,
        actualValue: 105,
        code: 'TARGET_ACHIEVEMENT',
        dataStatus: 'reported',
        label: 'Hedef gerçekleşme',
        scoreStatus: 'scored',
        statusBand: 'on_track',
        targetValue: 100,
        weightPercent: 35,
      },
    ],
    partial: {
      isPartial: false,
      missingMetricCodes: [],
      missingMetricLabels: [],
      pendingNormalizationCodes: [],
      pendingNormalizationLabels: [],
    },
    period: { periodEnd: '2026-07-31', periodStart: '2026-07-01' },
    score: { matchedMetrics: 1, totalMetrics: 1, value: 88 },
    source: { mode: 'live', periodType: 'monthly', snapshotDate: null, snapshotRunId: null },
    store: { storeId: storeIds[0], storeName: 'İstanbul MOI AVM' },
  }
}

function createStoreScoreBreakdown() {
  return {
    items: [],
    meta: { count: 0, limit: 50, offset: 0, total: 0 },
    store: { storeId: storeIds[0], storeName: 'İstanbul MOI AVM' },
  }
}

function createMyPerformance() {
  return {
    availablePeriods: [
      { periodEnd: '2026-07-31', periodStart: '2026-07-01', periodType: 'monthly' },
    ],
    employee: {
      displayName: 'Ayşe Yılmaz',
      employeeId: employeeIds[0],
      positionName: 'Satış danışmanı',
      storeId: storeIds[0],
      storeName: 'İstanbul MOI AVM',
    },
    metrics: [
      {
        achievementRate: 1.12,
        actualValue: 112,
        code: 'TARGET_ACHIEVEMENT',
        dataStatus: 'reported',
        label: 'Hedef Gerçekleştirme',
        scoreStatus: 'scored',
        statusBand: 'on_track',
        targetValue: 100,
        weightPercent: 35,
      },
    ],
    partial: {
      isPartial: false,
      missingMetricCodes: [],
      missingMetricLabels: [],
      pendingNormalizationCodes: [],
      pendingNormalizationLabels: [],
    },
    period: { periodEnd: '2026-07-31', periodStart: '2026-07-01' },
    rankings: {
      storePopulation: 4,
      storeRank: 1,
      turkeyPopulation: 120,
      turkeyRank: 12,
    },
    score: { matchedMetrics: 1, totalMetrics: 1, value: 82 },
    source: { mode: 'live', periodType: 'monthly', snapshotDate: null, snapshotRunId: null },
  }
}

function createReportingSummary() {
  return {
    cards: {
      checklistRows: 0,
      kpiRows: 0,
      turnoverRows: 0,
      workforceRows: 0,
    },
    latestCompletedSnapshotRun: null,
  }
}

function createStoreMonthlyPackage() {
  return {
    generatedAt: '2026-07-01T09:00:00.000Z',
    isCurrentPeriod: true,
    period: '2026-07',
    rows: [],
    sections: [
      { code: 'kpis', label: 'KPI kolonları', ready: true, status: 'ready', value: 'Skor' },
      { code: 'visits', label: 'Ziyaret', ready: true, status: 'ready', value: 'Son ziyaret' },
    ],
    storeCount: storeIds.length,
  }
}

function createTargetCoverage(url: URL) {
  return {
    ...emptyList(url),
    summary: {
      conflictEmployees: 0,
      coverageRate: 0,
      coveredEmployees: 0,
      missingEmployees: 0,
      pendingEmployees: 0,
      requestMonth: url.searchParams.get('requestMonth') ?? '2026-07',
      staleEmployees: 0,
      totalEmployees: 0,
      uncoveredEmployees: 0,
    },
  }
}

function createSellerCodeReference() {
  return {
    lastSellerCode: null,
    nextSellerCodePreview: null,
    prefix: 'DNMSL',
    storeType: 'company',
  }
}

function createStoreIncentives(roleScope: 'own' | 'store' | 'region' | 'admin') {
  return {
    data: {
      period: '2026-07',
      periodEnd: '2026-07-31',
      periodStart: '2026-07-01',
      periodTimezone: 'Europe/Istanbul',
      projections: [],
      roleScope,
    },
  }
}
