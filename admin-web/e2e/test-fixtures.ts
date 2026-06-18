import { expect, test as base } from '@playwright/test'
import type { BrowserContext, Locator, Page, Route } from '@playwright/test'

type JsonBody = Record<string, unknown> | unknown[] | string | number | boolean | null
type ApiFallbackRoute = {
  pattern: string
  resolve: (method: string, url: URL) => JsonBody | null
}

const emptyList = (url: URL) => {
  const limit = Number(url.searchParams.get('limit') ?? '50')
  const offset = Number(url.searchParams.get('offset') ?? '0')

  return {
    items: [],
    meta: {
      count: 0,
      total: 0,
      limit: Number.isFinite(limit) ? limit : 50,
      offset: Number.isFinite(offset) ? offset : 0,
    },
  }
}

const integrationOverview = {
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

const integrationLookups = {
  activeSources: [
    {
      sourceId: 'e2e-source-power-bi',
      sourceCode: 'POWER_BI',
      sourceName: 'Power BI',
      entityType: 'kpi',
      sourceSystem: 'power_bi',
      stateModel: 'active',
    },
  ],
  meta: {
    totalEntityTypes: 1,
    totalActiveSources: 1,
  },
}

const importPayloadTemplate = {
  entityType: 'kpi',
  sourceSystem: 'power_bi',
  canonicalContract: {
    envelopeFields: ['sourceCode', 'entityType', 'rows'],
    canonicalKpiRowFields: ['storeExternalRef', 'metricCode', 'value'],
    importedMetricCodes: [],
    derivedMetricCodes: [],
    checklistMetricCodes: [],
    dataQualityIssueCodes: [],
    rules: [],
  },
  normalizedBehavior: [],
  note: 'E2E background prefetch fallback',
  requestBody: {
    sourceCode: 'POWER_BI',
    entityType: 'kpi',
    rows: [],
  },
}

const emptyMobileChecklistToday = {
  data: {
    stores: [],
    templates: [],
    activeInstances: [],
    completedThisMonth: [],
    pendingAcknowledgements: [],
    monthlySummaries: [],
  },
}

const kpiConfig = {
  storeProfile: {
    profileCode: 'store',
    title: 'Store score',
    summary: 'E2E fallback score profile',
    metrics: [],
    futureMetricRule: 'Fallback only for background prefetch.',
  },
  personnelProfile: {
    profileCode: 'personnel',
    title: 'Personnel score',
    summary: 'E2E fallback score profile',
    metrics: [],
    futureMetricRule: 'Fallback only for background prefetch.',
  },
  ownershipMatrix: [],
  gradingBands: [
    {
      code: 'fallback',
      label: 'Fallback',
      emoji: 'F',
      tone: 'neutral',
      minScore: 0,
    },
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

const myPerformance = {
  source: {
    mode: 'live',
    snapshotRunId: null,
    snapshotDate: null,
  },
  employee: null,
  period: null,
  score: {
    value: 0,
    matchedMetrics: 0,
    totalMetrics: 0,
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
  },
  metrics: [],
}

const reportingSummary = {
  latestCompletedSnapshotRun: null,
  cards: {
    workforceRows: 0,
    kpiRows: 0,
    checklistRows: 0,
    turnoverRows: 0,
  },
}

const sellerCodeReference = {
  storeType: 'franchise',
  prefix: 'FM',
  lastSellerCode: null,
  nextSellerCodePreview: null,
}

const authSessionFallback = {
  authMode: 'mock',
  authenticated: false,
  user: {
    userId: 'e2e-fallback-user',
    employeeId: null,
    roleCodes: [],
    scope: {
      companyIds: [],
      regionIds: [],
      storeIds: [],
    },
    readScope: {
      companyIds: [],
      regionIds: [],
      storeIds: [],
    },
    actionScope: {
      assignedStoreIds: [],
    },
    assignedStoreIds: [],
  },
  scopeSummary: {
    companyCount: 0,
    regionCount: 0,
    storeCount: 0,
    assignedStoreCount: 0,
  },
}

const targetCoverage = (url: URL) => ({
  ...emptyList(url),
  summary: {
    requestMonth: url.searchParams.get('requestMonth') ?? '2026-05',
    totalEmployees: 0,
    coveredEmployees: 0,
    missingEmployees: 0,
    pendingEmployees: 0,
    conflictEmployees: 0,
    staleEmployees: 0,
    uncoveredEmployees: 0,
    coverageRate: 0,
  },
})

const emptyStoreIncentives = (roleScope: 'own' | 'store' | 'region' | 'admin') => ({
  data: {
    period: '2026-06',
    periodStart: '2026-06-01',
    periodEnd: '2026-06-30',
    periodTimezone: 'Europe/Istanbul',
    roleScope,
    projections: [],
  },
})

function resolveE2eApiFallback(method: string, url: URL): JsonBody | null {
  const path = url.pathname.replace(/^\/api/, '')

  if (method === 'GET' && path === '/auth/session') {
    return authSessionFallback
  }

  if (method === 'GET' && path === '/competitions') {
    return emptyList(url)
  }

  if (method === 'GET' && path === '/integrations/import-batches/overview') {
    return integrationOverview
  }

  if (method === 'GET' && path === '/integrations/import-batches/needs-action') {
    return emptyList(url)
  }

  if (method === 'GET' && path === '/integrations/import-payload-templates') {
    return importPayloadTemplate
  }

  if (method === 'GET' && path === '/integrations/lookups') {
    return integrationLookups
  }

  if (method === 'POST' && path === '/checklists/acknowledgements/list') {
    return emptyList(url)
  }

  if (method === 'GET' && path === '/workflow/inbox') {
    return emptyList(url)
  }

  if (method === 'GET' && path === '/mobile/checklists/today') {
    return emptyMobileChecklistToday
  }

  if (method === 'GET' && path === '/reports/my-performance') {
    return myPerformance
  }

  if (method === 'GET' && path === '/reports/kpi-config') {
    return kpiConfig
  }

  if (method === 'GET' && path === '/reports/summary') {
    return reportingSummary
  }

  if (method === 'GET' && path === '/reports/snapshot-runs') {
    return emptyList(url)
  }

  if (method === 'GET' && path === '/workforce/seller-code-reference') {
    return sellerCodeReference
  }

  if (
    method === 'GET' &&
    (path === '/workforce/seller-code-requests' ||
      path === '/workforce/offboarding-requests' ||
      path === '/workforce/position-options' ||
      path === '/workforce/store-employees' ||
      path === '/target-distributions/store-personnel' ||
      path === '/target-distributions/requests')
  ) {
    return emptyList(url)
  }

  if (method === 'GET' && path === '/target-distributions/coverage') {
    return targetCoverage(url)
  }

  if (method === 'GET' && path === '/store/me/incentives') {
    return emptyStoreIncentives('own')
  }

  if (method === 'GET' && path === '/store/incentives') {
    return emptyStoreIncentives('store')
  }

  if (method === 'GET' && path === '/admin/incentives') {
    return emptyStoreIncentives('admin')
  }

  if (method === 'POST' && path === '/admin/incentives/corrections') {
    return {
      data: {
        adjustmentId: 'e2e-fallback-adjustment',
        phase: 'pre_close',
        adjustmentScope: 'projection',
        adjustmentType: 'correction',
        periodKey: '2026-06',
        storeId: 'e2e-store',
        employeeId: 'e2e-employee',
        participantType: 'personnel',
        beforeAmount: '0.00',
        adjustmentAmount: '0.01',
        afterAmount: '0.01',
        status: 'approved',
      },
    }
  }

  return null
}

const apiFallbackRoutes: ApiFallbackRoute[] = [
  {
    pattern: '**/api/auth/session',
    resolve: resolveE2eApiFallback,
  },
  {
    pattern: '**/api/competitions',
    resolve: resolveE2eApiFallback,
  },
  {
    pattern: '**/api/integrations/import-batches/overview',
    resolve: resolveE2eApiFallback,
  },
  {
    pattern: '**/api/integrations/import-batches/needs-action**',
    resolve: resolveE2eApiFallback,
  },
  {
    pattern: '**/api/integrations/import-payload-templates**',
    resolve: resolveE2eApiFallback,
  },
  {
    pattern: '**/api/integrations/lookups',
    resolve: resolveE2eApiFallback,
  },
  {
    pattern: '**/api/checklists/acknowledgements/list',
    resolve: resolveE2eApiFallback,
  },
  {
    pattern: '**/api/workflow/inbox',
    resolve: resolveE2eApiFallback,
  },
  {
    pattern: '**/api/mobile/checklists/today',
    resolve: resolveE2eApiFallback,
  },
  {
    pattern: '**/api/reports/my-performance**',
    resolve: resolveE2eApiFallback,
  },
  {
    pattern: '**/api/reports/kpi-config',
    resolve: resolveE2eApiFallback,
  },
  {
    pattern: '**/api/reports/summary',
    resolve: resolveE2eApiFallback,
  },
  {
    pattern: '**/api/reports/snapshot-runs**',
    resolve: resolveE2eApiFallback,
  },
  {
    pattern: '**/api/workforce/seller-code-reference**',
    resolve: resolveE2eApiFallback,
  },
  {
    pattern: '**/api/workforce/seller-code-requests**',
    resolve: resolveE2eApiFallback,
  },
  {
    pattern: '**/api/workforce/offboarding-requests**',
    resolve: resolveE2eApiFallback,
  },
  {
    pattern: '**/api/workforce/position-options**',
    resolve: resolveE2eApiFallback,
  },
  {
    pattern: '**/api/workforce/store-employees**',
    resolve: resolveE2eApiFallback,
  },
  {
    pattern: '**/api/target-distributions/store-personnel**',
    resolve: resolveE2eApiFallback,
  },
  {
    pattern: '**/api/target-distributions/requests**',
    resolve: resolveE2eApiFallback,
  },
  {
    pattern: '**/api/target-distributions/coverage**',
    resolve: resolveE2eApiFallback,
  },
  {
    pattern: '**/api/store/me/incentives',
    resolve: resolveE2eApiFallback,
  },
  {
    pattern: '**/api/store/incentives',
    resolve: resolveE2eApiFallback,
  },
  {
    pattern: '**/api/admin/incentives**',
    resolve: resolveE2eApiFallback,
  },
]

async function installE2eApiFallbacks(context: BrowserContext) {
  for (const fallbackRoute of apiFallbackRoutes) {
    await context.route(fallbackRoute.pattern, async (route: Route) => {
      const request = route.request()
      const fallback = fallbackRoute.resolve(request.method(), new URL(request.url()))

      if (fallback !== null) {
        await route.fulfill({ json: fallback })
        return
      }

      await route.fallback()
    })
  }
}

export const test = base.extend<{ context: BrowserContext }>({
  context: async ({ context }, use) => {
    await installE2eApiFallbacks(context)

    await use(context)
  },
})

export { expect }
export type { BrowserContext, Locator, Page }
