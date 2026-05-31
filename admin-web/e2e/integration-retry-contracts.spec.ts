import { expect, test, type Page } from './test-fixtures'
import { setStoredLocale } from './locale-test-utils'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'store-ops-admin-session',
      JSON.stringify({
        mode: 'mock',
        mockUserId: 'integration-retry-user',
        mockRoleCodes: 'SUPER_ADMIN',
        mockCompanyIds: '00000000-0000-0000-0000-000000000001',
        bearerToken: '',
      }),
    )
  })
  await routeRetryApi(page)
})

test('admin integrations retry command posts from issue queue without changing payload contract', async ({ page }) => {
  let retryRequests = 0
  await page.route('**/api/integrations/import-batches/batch-retry-ready-1/retry', async (route) => {
    expect(route.request().method()).toBe('POST')
    retryRequests += 1
    await route.fulfill({ json: retryResponse('batch-retry-ready-1', 2, 'Retry queued from dashboard') })
  })

  await page.goto('/admin/integrations')
  await setStoredLocale(page, 'en')
  await page.getByRole('button', { name: /^Issues/ }).click()
  await expect(page.getByText('batch-retry-ready-1')).toBeVisible()
  await page.getByRole('button', { name: 'Retry batch' }).click()
  await expect(page.getByText('Retry queued from dashboard')).toBeVisible()
  expect(retryRequests).toBe(1)
})

test('admin import batch detail retry command keeps the detail route contract', async ({ page }) => {
  let retryRequests = 0
  await page.route('**/api/integrations/import-batches/batch-kpi-lineage-ui-1/retry', async (route) => {
    expect(route.request().method()).toBe('POST')
    retryRequests += 1
    await route.fulfill({ json: retryResponse('batch-kpi-lineage-ui-1', 1, 'Retry queued from detail') })
  })

  await page.goto('/admin/integrations/batch-kpi-lineage-ui-1')
  await setStoredLocale(page, 'en')
  await page.getByRole('main').getByRole('button', { name: 'Retry batch' }).click()
  await expect(page.getByText('Retry queued from detail')).toBeVisible()
  await expect(page).toHaveURL(/\/admin\/integrations\/batch-kpi-lineage-ui-1$/)
  expect(retryRequests).toBe(1)
})

async function routeRetryApi(page: Page) {
  await page.route('**/api/auth/session', async (route) => route.fulfill({ json: authSessionFixture }))
  await page.route('**/api/integrations/import-batches/overview', async (route) => route.fulfill({ json: overviewFixture }))
  await page.route('**/api/integrations/import-batches/needs-action**', async (route) => route.fulfill({ json: needsActionRetryFixture }))
  await page.route('**/api/integrations/lookups', async (route) => route.fulfill({ json: lookupsFixture }))
  await page.route('**/api/integrations/import-payload-templates**', async (route) => route.fulfill({ json: importPayloadTemplateFixture }))
  await page.route('**/api/integrations/import-batches/batch-kpi-lineage-ui-1/reconciliation', async (route) => route.fulfill({ json: reconciliationFixture }))
  await page.route('**/api/integrations/import-batches/batch-kpi-lineage-ui-1/errors**', async (route) => route.fulfill({ json: emptyListFixture }))
  await page.route('**/api/integrations/import-batches/batch-kpi-lineage-ui-1/audit**', async (route) => route.fulfill({ json: emptyListFixture }))
  await page.route('**/api/integrations/external-id-map-candidates**', async (route) => route.fulfill({ json: emptyListFixture }))
  await page.route('**/api/integrations/import-batches/batch-kpi-lineage-ui-1', async (route) => route.fulfill({ json: detailFixture }))
}

function retryResponse(batchId: string, retryCount: number, message: string) {
  return {
    command: { status: 'queued', message },
    data: { batch: { batchId, status: 'queued', retryCount } },
  }
}

const authSessionFixture = {
  authMode: 'mock',
  authenticated: true,
  user: {
    userId: 'integration-retry-user',
    roleCodes: ['SUPER_ADMIN'],
    scope: { companyIds: ['00000000-0000-0000-0000-000000000001'], regionIds: [], storeIds: [] },
    readScope: { companyIds: ['00000000-0000-0000-0000-000000000001'], regionIds: [], storeIds: [] },
    actionScope: { assignedStoreIds: [] },
    assignedStoreIds: [],
  },
  scopeSummary: { companyCount: 1, regionCount: 0, storeCount: 0, assignedStoreCount: 0 },
}

const overviewFixture = {
  totals: { all: 3, completed: 1, failed: 0, completedWithErrors: 1, pending: 0, queued: 1, processing: 0 },
  healthTotals: { healthy: 1, inProgress: 1, blocked: 0, retryReady: 1, needsAction: 0, stuck: 0 },
  actionTotals: { blocked: 0, retryReady: 1, needsAction: 0, stuck: 0 },
  latest: { completedBatchId: 'batch-completed-1', failedBatchId: null, inProgressBatchId: 'batch-queued-1', stuckBatchId: null },
}

const needsActionRetryFixture = {
  items: [{
    batchId: 'batch-retry-ready-1',
    sourceCode: 'power-bi-kpi',
    sourceName: 'Power BI KPI',
    entityType: 'kpi',
    healthState: 'retry_ready',
    recordCount: 42,
    errorCount: 3,
    retryCount: 1,
    actionReason: 'Retryable rows are waiting',
    recommendedAction: 'Retry batch',
    recommendedNextEntityType: null,
    canRetryNow: true,
  }],
  meta: { count: 1, total: 1, limit: 12, offset: 0 },
}

const lookupsFixture = {
  activeSources: [{
    sourceId: 'source-kpi-1',
    sourceCode: 'power-bi-kpi',
    sourceName: 'Power BI KPI',
    entityType: 'kpi',
    sourceSystem: 'power_bi',
    stateModel: 'closed_period',
  }],
  meta: { totalEntityTypes: 7, totalActiveSources: 1 },
}

const importPayloadTemplateFixture = {
  entityType: 'kpi',
  sourceSystem: 'power_bi',
  requestBody: { sourceCode: 'power-bi-kpi', entityType: 'kpi', fileReference: 'sample.json', rows: [] },
}

const detailFixture = {
  batch: {
    batchId: 'batch-kpi-lineage-ui-1',
    integrationSourceId: 'source-kpi-1',
    sourceCode: 'kpi-feed',
    sourceName: 'KPI Feed',
    entityType: 'kpi',
    startedAt: '2026-04-22T10:00:00.000Z',
    finishedAt: '2026-04-22T10:05:00.000Z',
    status: 'completed_with_errors',
    fileReference: 'kpis.json',
    recordCount: 2,
    errorCount: 1,
    retryCount: 0,
    lastRetriedAt: null,
    healthState: 'retry_ready',
  },
  rowStatusSummary: { processed: 1, validationFailed: 0, retryableError: 1, pending: 0 },
  dependencySummary: { employee: 0, store: 0, position: 0, region: 0, company: 0, manager: 0 },
  qualityIssueSummary: { totalIssueRows: 0, highSeverityRows: 0, items: [] },
  lineageSummary: { supported: false },
  blockedByEntityTypes: [],
  recommendedImportOrder: ['company', 'region', 'store', 'position', 'employee', 'assignment', 'kpi'],
  recommendedNextEntityType: null,
  canRetryNow: true,
  healthState: 'retry_ready',
}

const reconciliationFixture = {
  batch: detailFixture.batch,
  totals: { recordCount: 2, accountedRows: 2, unaccountedRows: 0, countsMatchRecordCount: true },
  rowStatusSummary: detailFixture.rowStatusSummary,
  rates: { processedRate: 0.5, validationFailureRate: 0, retryableErrorRate: 0.5, pendingRate: 0, accountedRate: 1 },
  reconciliation: { hasFailures: true, hasPendingRows: false, hasUnaccountedRows: false, canRetryNow: true, blockedByEntityTypes: [], recommendedNextEntityType: null },
}

const emptyListFixture = { items: [], meta: { count: 0, total: 0, limit: 25, offset: 0 } }
