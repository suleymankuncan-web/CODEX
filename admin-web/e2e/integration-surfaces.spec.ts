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

  const qualityPanel = page.getByLabel('Import data quality summary')
  await expect(qualityPanel.getByRole('heading', { name: 'Data quality summary' })).toBeVisible()
  await expect(qualityPanel.getByText('Issue rows')).toBeVisible()
  await expect(qualityPanel.getByText('High severity rows')).toBeVisible()
  await expect(qualityPanel.getByText('Unmapped store')).toBeVisible()
  await expect(qualityPanel.getByText('mapping / high / 1 row')).toBeVisible()
  await expect(page.getByText('quality issue unmapped_store')).toBeVisible()

  const mappingPanel = page.getByLabel('External ID mapping approval')
  await expect(mappingPanel.getByText('External store')).toBeVisible()
  await expect(mappingPanel.getByRole('textbox', { name: 'Search internal store candidates' })).toBeVisible()
  await expect(mappingPanel.getByRole('combobox', { name: 'Map to internal store' })).toBeVisible()
  await mappingPanel.getByRole('textbox', { name: 'Search internal store candidates' }).fill('Marmara')
  await mappingPanel
    .getByRole('combobox', { name: 'Map to internal store' })
    .selectOption({ label: 'Marmara Park - MP001 / active' })
  await mappingPanel.getByRole('button', { name: 'Approve mapping' }).click()
  await expect(page.getByText('External ID mapping approved')).toBeVisible()
  await expect(page.getByText('Batch detail unavailable')).toHaveCount(0)
})

test('admin dashboard manages store master data import controls', async ({ page }) => {
  await page.goto('/admin/integrations')

  const scopePanel = page.getByLabel('Store master data')
  await expect(scopePanel.getByRole('heading', { name: 'Store master data' })).toBeVisible()
  await expect(scopePanel.getByText('Marmara Park')).toBeVisible()
  await expect(scopePanel.getByText('MP001 / Marmara / company')).toBeVisible()

  const scopeToggle = scopePanel.getByRole('checkbox', { name: 'Marmara Park KPI import enabled' })
  await expect(scopeToggle).toBeChecked()
  await scopePanel.getByRole('combobox', { name: 'Marmara Park store type' }).selectOption('franchise')

  await expect(page.getByText('Store master data updated')).toBeVisible()
})

test('admin dashboard exposes Power BI period controls', async ({ page }) => {
  await page.goto('/admin/integrations')

  await expect(page.getByLabel('Donem tipi')).toBeVisible()
  await page.getByLabel('Donem tipi').selectOption('daily')
  await expect(page.getByLabel('Baslangic')).toBeVisible()
  await expect(page.getByLabel('Bitis')).toBeDisabled()

  await page.getByLabel('Donem tipi').selectOption('custom')
  await expect(page.getByLabel('Bitis')).toBeEnabled()
})

async function routeIntegrationApi(page: Page) {
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({ json: authSessionFixture })
  })

  await page.route('**/api/integrations/import-batches/overview', async (route) => {
    await route.fulfill({ json: overviewFixture })
  })

  await page.route('**/api/integrations/import-batches/needs-action**', async (route) => {
    await route.fulfill({ json: needsActionFixture })
  })

  await page.route('**/api/integrations/lookups', async (route) => {
    await route.fulfill({ json: lookupsFixture })
  })

  await page.route('**/api/integrations/import-payload-templates**', async (route) => {
    await route.fulfill({ json: importPayloadTemplateFixture })
  })

  await page.route('**/api/integrations/store-master-lookups', async (route) => {
    await route.fulfill({ json: storeMasterLookupsFixture })
  })

  await page.route('**/api/integrations/store-master**', async (route) => {
    if (route.request().method() === 'PATCH') {
      const body = route.request().postDataJSON()
      expect(body).toEqual({
        storeType: 'franchise',
        regionId: '22222222-2222-4222-8222-222222222222',
        status: 'active',
        kpiImportEnabled: true,
      })
      await route.fulfill({
        json: {
          command: {
            status: 'updated',
            message: 'Store master data updated',
          },
          data: {
            storeMaster: {
              ...storeMasterFixture.items[0],
              storeType: 'franchise',
            },
          },
        },
      })
      return
    }

    await route.fulfill({ json: storeMasterFixture })
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

  await page.route('**/api/integrations/external-id-map-candidates**', async (route) => {
    await route.fulfill({ json: externalIdMapCandidatesFixture })
  })

  await page.route('**/api/integrations/external-id-maps', async (route) => {
    const body = route.request().postDataJSON()
    expect(body).toMatchObject({
      integrationSourceId: '11111111-1111-4111-8111-111111111111',
      entityType: 'store',
      externalId: 'powerbi:MARMARA PARK',
      internalId: '44444444-4444-4444-8444-444444444444',
    })
    await route.fulfill({
      json: {
        command: {
          status: 'updated',
          message: 'External ID mapping approved',
        },
        data: {
          mapping: {
            ...body,
            internalTableName: 'ops.store',
          },
        },
      },
    })
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

const overviewFixture = {
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

const needsActionFixture = {
  items: [],
  meta: {
    count: 0,
    total: 0,
    limit: 12,
    offset: 0,
  },
}

const lookupsFixture = {
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
      regionId: '22222222-2222-4222-8222-222222222222',
      regionCode: 'MARMARA',
      regionName: 'Marmara',
    },
    {
      regionId: '66666666-6666-4666-8666-666666666666',
      regionCode: 'KARADENIZ',
      regionName: 'Karadeniz',
    },
  ],
}

const storeMasterFixture = {
  items: [
    {
      storeId: '44444444-4444-4444-8444-444444444444',
      storeCode: 'MP001',
      storeName: 'Marmara Park',
      storeType: 'company',
      status: 'active',
      kpiImportEnabled: true,
      regionId: '22222222-2222-4222-8222-222222222222',
      regionName: 'Marmara',
    },
    {
      storeId: '55555555-5555-4555-8555-555555555555',
      storeCode: 'GAR001',
      storeName: 'Garaj Outlet',
      storeType: 'company',
      status: 'active',
      kpiImportEnabled: false,
      regionId: '22222222-2222-4222-8222-222222222222',
      regionName: 'Marmara',
    },
  ],
  meta: {
    count: 2,
    total: 2,
    limit: 50,
    offset: 0,
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
  qualityIssueSummary: {
    totalIssueRows: 1,
    highSeverityRows: 1,
    items: [
      {
        code: 'unmapped_store',
        label: 'Unmapped store',
        owner: 'mapping',
        severity: 'high',
        description: 'The row references a store that is not mapped to an internal store.',
        count: 1,
      },
    ],
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
      qualityIssueCode: 'unmapped_store',
      mappingCandidate: {
        integrationSourceId: '11111111-1111-4111-8111-111111111111',
        entityType: 'store',
        externalId: 'powerbi:MARMARA PARK',
        internalTableName: 'ops.store',
      },
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

const externalIdMapCandidatesFixture = {
  items: [
    {
      entityType: 'store',
      internalId: '44444444-4444-4444-8444-444444444444',
      label: 'Marmara Park',
      secondaryLabel: 'MP001 / active',
      internalTableName: 'ops.store',
    },
  ],
  meta: {
    count: 1,
    total: 1,
    limit: 25,
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
