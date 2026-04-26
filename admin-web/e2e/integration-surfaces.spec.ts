import { expect, test, type Page } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'store-ops-admin-session',
      JSON.stringify({
        mode: 'mock',
        mockUserId: 'integration-lineage-user',
        mockRoleCodes: 'SUPER_ADMIN',
        mockCompanyIds: '00000000-0000-0000-0000-000000000001',
        bearerToken: '',
      }),
    )
  })

  await routeIntegrationApi(page)
})

test('admin import batch detail explains KPI row lineage evidence', async ({ page }) => {
  await page.goto('/admin/integrations/batch-kpi-lineage-ui-1')

  const lineagePanel = page.getByLabel('Import row lineage evidence')
  await expect(lineagePanel.getByRole('heading', { name: 'Source row lineage' })).toBeVisible()
  await expect(lineagePanel.getByText('Trace-ready rows')).toBeVisible()
  await expect(lineagePanel.getByText('2 / 2')).toHaveCount(2)
  await expect(lineagePanel.getByText('Readable references')).toBeVisible()
  await expect(lineagePanel.getByText('other:UPT:daily:2026-04-22:2026-04-22:M-10:S-100')).toBeVisible()
  const rowLineage = page.getByLabel('Row lineage evidence', { exact: true })
  await expect(rowLineage.getByText('other:UPT:daily:2026-04-22:2026-04-22:M-10:S-100')).toBeVisible()
  await expect(rowLineage.getByText('bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb')).toBeVisible()
  await expect(page.getByText('Batch detail unavailable')).toHaveCount(0)
})

async function routeIntegrationApi(page: Page) {
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({ json: authSessionFixture })
  })

  await page.route('**/api/integrations/import-batches/batch-kpi-lineage-ui-1/reconciliation', async (route) => {
    await route.fulfill({ json: reconciliationFixture })
  })

  await page.route('**/api/integrations/import-batches/batch-kpi-lineage-ui-1/errors**', async (route) => {
    await route.fulfill({ json: errorsFixture })
  })

  await page.route('**/api/integrations/import-batches/batch-kpi-lineage-ui-1/audit**', async (route) => {
    await route.fulfill({ json: auditFixture })
  })

  await page.route('**/api/integrations/import-batches/batch-kpi-lineage-ui-1', async (route) => {
    await route.fulfill({ json: detailFixture })
  })
}

const authSessionFixture = {
  authMode: 'mock',
  authenticated: true,
  user: {
    userId: 'integration-lineage-user',
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
  rowStatusSummary: {
    processed: 1,
    validationFailed: 0,
    retryableError: 1,
    pending: 0,
  },
  dependencySummary: {
    employee: 0,
    store: 1,
    position: 0,
    region: 0,
    company: 0,
    manager: 0,
  },
  lineageSummary: {
    supported: true,
    rowHashCount: 2,
    rawRowReferenceCount: 2,
    sampleRowHash: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    sampleRawRowReference: 'other:UPT:daily:2026-04-22:2026-04-22:M-10:S-100',
  },
  blockedByEntityTypes: [],
  recommendedImportOrder: ['company', 'region', 'store', 'position', 'employee', 'assignment', 'kpi'],
  recommendedNextEntityType: null,
  canRetryNow: true,
  healthState: 'retry_ready',
}

const reconciliationFixture = {
  batch: detailFixture.batch,
  totals: {
    recordCount: 2,
    accountedRows: 2,
    unaccountedRows: 0,
    countsMatchRecordCount: true,
  },
  rowStatusSummary: detailFixture.rowStatusSummary,
  rates: {
    processedRate: 0.5,
    validationFailureRate: 0,
    retryableErrorRate: 0.5,
    pendingRate: 0,
    accountedRate: 1,
  },
  reconciliation: {
    hasFailures: true,
    hasPendingRows: false,
    hasUnaccountedRows: false,
    canRetryNow: true,
    blockedByEntityTypes: [],
    recommendedNextEntityType: null,
  },
}

const errorsFixture = {
  items: [
    {
      rowId: 'kpi-row-1',
      sourceRef: 'UPT',
      rowHash: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      rawRowReference: 'other:UPT:daily:2026-04-22:2026-04-22:M-10:S-100',
      normalizedStatus: 'retryable_error',
      errorCategory: 'missing_dependency',
      validationError: 'store reference could not be resolved',
      processedAt: null,
    },
  ],
  meta: {
    count: 1,
    total: 1,
    limit: 20,
    offset: 0,
  },
}

const auditFixture = {
  items: [],
  meta: {
    count: 0,
    total: 0,
    limit: 20,
    offset: 0,
  },
}
