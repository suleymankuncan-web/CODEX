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

test('admin import batch detail switches chrome to English copy and persists locale', async ({ page }) => {
  await page.goto('/admin/integrations/batch-kpi-lineage-ui-1')

  const main = page.getByRole('main')
  const heroMetrics = main.locator('.hero-metrics')

  await expect(page.getByRole('link', { name: 'Entegrasyon kuyruğuna dön' })).toBeVisible()
  await expect(main.getByText('Aktarım parti detayı')).toBeVisible()
  await expect(heroMetrics.getByText('Kayıt', { exact: true })).toBeVisible()
  await expect(heroMetrics.getByText('Hata', { exact: true })).toBeVisible()
  await expect(heroMetrics.getByText('Şimdi tekrar dene', { exact: true })).toBeVisible()
  await expect(main.getByLabel('Aktarım karar kanıtı')).toBeVisible()
  await expect(main.getByRole('heading', { name: 'Operatör karar kanıtı' })).toBeVisible()
  await expect(main.getByText('Paylaşılan operatör dilini kullanır: Go / Conditional Go / No-Go.')).toBeVisible()
  await expect(main.getByRole('heading', { name: 'Parti özeti' })).toBeVisible()
  await expect(main.getByRole('heading', { name: 'İlerlemeyi ne engelliyor' })).toBeVisible()
  await expect(main.getByRole('heading', { name: 'Veri kalitesi özeti' })).toBeVisible()
  await expect(main.getByRole('heading', { name: 'Eşleşmeyen ve şüpheli satırlar' })).toBeVisible()
  await expect(main.getByRole('heading', { name: 'Kaynak satır soy ağacı' })).toBeVisible()
  await expect(main.getByRole('heading', { name: 'Parti muhasebesi' })).toBeVisible()
  await expect(main.getByRole('heading', { name: 'Satırlar neden başarısız oldu' })).toBeVisible()
  await expect(main.getByRole('heading', { name: 'Operatör görünür izi' })).toBeVisible()
  await expect(main.getByRole('button', { name: 'Partiyi tekrar dene' })).toBeVisible()
  await expect(main.getByRole('button', { name: 'İnceleme satırlarını dışa aktar' })).toBeVisible()
  await expect(main.getByRole('button', { name: 'Hataları dışa aktar' })).toBeVisible()
  await expect(main.getByRole('button', { name: 'Denetimi dışa aktar' })).toBeVisible()
  await expect(main.getByText('Import Batch Detail')).toHaveCount(0)
  await expect(main.getByText('Source row lineage')).toHaveCount(0)
  await expect(page.locator('body')).not.toContainText('Ãƒ')
  await expect(page.locator('body')).not.toContainText('Ã„')
  await expect(page.locator('body')).not.toContainText('Ã…')

  await page.locator('.language-toggle-button').filter({ hasText: 'EN' }).click()

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('link', { name: 'Back to integration queue' })).toBeVisible()
  await expect(main.getByText('Import Batch Detail')).toBeVisible()
  await expect(heroMetrics.getByText('Records', { exact: true })).toBeVisible()
  await expect(heroMetrics.getByText('Errors', { exact: true })).toBeVisible()
  await expect(heroMetrics.getByText('Retry now', { exact: true })).toBeVisible()
  await expect(main.getByLabel('Import decision evidence')).toBeVisible()
  await expect(main.getByRole('heading', { name: 'Operator decision evidence' })).toBeVisible()
  await expect(main.getByRole('heading', { name: 'Source row lineage' })).toBeVisible()
  await expect(main.getByRole('heading', { name: 'Why rows failed' })).toBeVisible()
  await expect(main.getByRole('button', { name: 'Export errors' })).toBeVisible()
  await expect(main.getByText('Aktarım parti detayı')).toHaveCount(0)

  await page.reload()

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(main.getByRole('heading', { name: 'Operator decision evidence' })).toBeVisible()
})

test('admin import batch detail explains KPI row lineage evidence', async ({ page }) => {
  await page.goto('/admin/integrations/batch-kpi-lineage-ui-1')

  const decisionPanel = page.getByLabel('Aktarım karar kanıtı')
  await expect(decisionPanel.getByRole('heading', { name: 'Operatör karar kanıtı' })).toBeVisible()
  await expect(decisionPanel.getByText('Go / Conditional Go / No-Go')).toBeVisible()
  await expect(decisionPanel.getByText('Conditional Go', { exact: true })).toBeVisible()
  await expect(
    decisionPanel.getByText(
      'Conditional Go: bu partiyi temiz saymadan önce satır kanıtını, kalite kontrolünü, tekrar deneme kanıtını ve bağımlılık eşlemesini incele.',
    ),
  ).toBeVisible()
  await expect(decisionPanel.getByText('Satır muhasebesi', { exact: true })).toBeVisible()
  await expect(decisionPanel.getByText('Muhasebeleşti ve eşleşti')).toBeVisible()
  await expect(decisionPanel.getByText('Kalite kontrolü', { exact: true })).toBeVisible()
  await expect(decisionPanel.getByText('1 yüksek öncelikli satır')).toBeVisible()
  await expect(decisionPanel.getByText('Tekrar deneme kanıtı', { exact: true })).toBeVisible()
  await expect(decisionPanel.getByText('Tekrar denenebilir')).toBeVisible()

  const lineagePanel = page.getByLabel('Aktarım satır soy ağacı kanıtı')
  await expect(lineagePanel.getByRole('heading', { name: 'Kaynak satır soy ağacı' })).toBeVisible()
  await expect(lineagePanel.getByText('İzlenebilir satırlar')).toBeVisible()
  await expect(lineagePanel.getByText('2 / 2')).toHaveCount(2)
  await expect(lineagePanel.getByText('Okunabilir referanslar')).toBeVisible()
  await expect(lineagePanel.getByText('other:UPT:daily:2026-04-22:2026-04-22:M-10:S-100')).toBeVisible()
  const rowLineage = page.getByLabel('Satır soy ağacı kanıtı', { exact: true })
  await expect(rowLineage.getByText('other:UPT:daily:2026-04-22:2026-04-22:M-10:S-100')).toBeVisible()
  await expect(rowLineage.getByText('bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb')).toBeVisible()

  const qualityPanel = page.getByLabel('Aktarım veri kalitesi özeti')
  await expect(qualityPanel.getByRole('heading', { name: 'Veri kalitesi özeti' })).toBeVisible()
  await expect(qualityPanel.getByText('Sorun satırları')).toBeVisible()
  await expect(qualityPanel.getByText('Yüksek öncelikli satırlar')).toBeVisible()
  await expect(qualityPanel.getByText('Eşleşmeyen mağaza')).toBeVisible()
  await expect(qualityPanel.getByText('eşleme / yüksek / 1 satır')).toBeVisible()
  await expect(page.getByText('kalite sorunu unmapped_store')).toBeVisible()

  const mappingPanel = page.getByLabel('Dış ID eşleme onayı')
  await expect(mappingPanel.getByText('Dış mağaza')).toBeVisible()
  await expect(mappingPanel.getByRole('textbox', { name: 'İç mağaza adaylarında ara' })).toBeVisible()
  await expect(mappingPanel.getByRole('combobox', { name: 'İç mağaza ile eşleştir' })).toBeVisible()
  await mappingPanel.getByRole('textbox', { name: 'İç mağaza adaylarında ara' }).fill('Marmara')
  await mappingPanel
    .getByRole('combobox', { name: 'İç mağaza ile eşleştir' })
    .selectOption({ label: 'Marmara Park - MP001 / active' })
  await mappingPanel.getByRole('button', { name: 'Eşlemeyi onayla' }).click()
  await expect(page.getByText('External ID mapping approved')).toBeVisible()
  await expect(page.getByText('Parti detayı açılamadı')).toHaveCount(0)
})

test('admin dashboard manages store master data import controls', async ({ page }) => {
  await page.goto('/admin/integrations')

  const scopePanel = page.getByLabel('Mağaza ana verisi')
  await expect(scopePanel.getByRole('heading', { name: 'Mağaza ana verisi' })).toBeVisible()
  await expect(scopePanel.getByText('Marmara Park')).toBeVisible()
  await expect(scopePanel.getByText('MP001 / Marmara / şirket')).toBeVisible()

  const scopeToggle = scopePanel.getByRole('checkbox', { name: 'Marmara Park KPI import aktif' })
  await expect(scopeToggle).toBeChecked()
  await scopePanel.getByRole('combobox', { name: 'Marmara Park mağaza tipi' }).selectOption('franchise')

  await expect(page.getByText('Store master data updated')).toBeVisible()
})

test('admin integrations page switches chrome to English copy and persists locale', async ({ page }) => {
  await page.goto('/admin/integrations')

  await expect(page.getByRole('heading', { name: 'Entegrasyon operasyonları' })).toBeVisible()
  await expect(page.getByText('İşlem kuyruğu')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Aksiyon bekleyen partiler' })).toBeVisible()
  await expect(page.getByText('Integration Operations')).toHaveCount(0)
  await expect(page.locator('body')).not.toContainText('Ã')
  await expect(page.locator('body')).not.toContainText('Ä')
  await expect(page.locator('body')).not.toContainText('Å')

  await page.locator('.language-toggle-button').filter({ hasText: 'EN' }).click()

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByText('Integration Operations')).toBeVisible()
  await expect(
    page.getByRole('heading', {
      name: 'See friction early, not after the batch disappears into the queue.',
    }),
  ).toBeVisible()
  await expect(page.getByText('Operator queue')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Needs-action batches' })).toBeVisible()
  await expect(page.getByText('Entegrasyon operasyonları')).toHaveCount(0)

  await page.reload()

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByText('Integration Operations')).toBeVisible()
})

test('admin dashboard exposes Power BI period controls', async ({ page }) => {
  await page.goto('/admin/integrations')

  await expect(page.getByLabel('Dönem tipi')).toBeVisible()
  await page.getByLabel('Dönem tipi').selectOption('daily')
  await expect(page.getByLabel('Başlangıç')).toBeVisible()
  await expect(page.getByLabel('Bitiş')).toBeDisabled()

  await page.getByLabel('Dönem tipi').selectOption('custom')
  await expect(page.getByLabel('Bitiş')).toBeEnabled()
})

test('admin dashboard explains why Power BI export upload is unavailable', async ({ page }) => {
  await page.unroute('**/api/integrations/lookups')
  await page.route('**/api/integrations/lookups', async (route) => {
    await route.fulfill({ json: noPowerBiSourceLookupsFixture })
  })

  await page.goto('/admin/integrations')

  await expect(page.getByRole('button', { name: 'Power BI export yükle' })).toBeDisabled()
  await expect(page.getByText('Power BI yükleme hazır değil')).toBeVisible()
  await expect(page.getByText('Aktif Power BI KPI source yok.')).toBeVisible()
  await expect(page.getByText('Personel veya mağaza Excel dosyası seç.')).toBeVisible()
})

test('admin master data bootstrap surface exposes personnel promotion evidence', async ({ page }) => {
  await page.goto('/admin/master-data/bootstrap-batch-personnel-1')

  await expect(page.getByRole('heading', { name: 'Ana veri hazırlığı' })).toBeVisible()
  await expect(
    page.getByText(
      'Satır kanıtı, prova kanıtı, hazırlık sayaçları ve aktarım durumunu incelemek için bir parti aç.',
    ),
  ).toBeVisible()
  await expect(page.getByText('aktarıma hazır').first()).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Aktarılan satırlar', exact: true })).toBeVisible()
  await expect(page.getByText('1 / 2').first()).toBeVisible()
  await expect(page.getByText('employee-live-1').first()).toBeVisible()

  const dryRunPanel = page.getByLabel('Ana veri aktarım prova kanıtı')
  await expect(
    dryRunPanel.getByRole('heading', { name: 'Aktarım prova kanıtı' }),
  ).toBeVisible()
  await expect(
    dryRunPanel.getByText(
      'Yalnızca prova kanıtı. Bu panelden satır aktarılmaz; aktarım hâlâ açık komut gerektirir.',
    ),
  ).toBeVisible()
  await expect(dryRunPanel.getByText('#1 FM8375')).toBeVisible()
  await expect(dryRunPanel.getByText('hazır', { exact: true })).toBeVisible()
  await expect(dryRunPanel.getByText('#2 FM8374')).toBeVisible()
  await expect(dryRunPanel.getByText('zaten aktarıldı').first()).toBeVisible()
  await expect(dryRunPanel.getByText('employee-live-1')).toBeVisible()

  await page.getByRole('button', { name: 'Personeli aktar' }).click()
  await expect(page.getByText('Personnel bootstrap rows promoted')).toBeVisible()
  await expect(page.getByText('assignment-live-1')).toBeVisible()
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

  await page.route('**/api/integrations/master-data-bootstrap/batches?**', async (route) => {
    await route.fulfill({ json: masterDataBootstrapBatchesFixture })
  })

  await page.route(
    '**/api/integrations/master-data-bootstrap/batches/bootstrap-batch-personnel-1/promotion-readiness',
    async (route) => {
      await route.fulfill({ json: masterDataBootstrapReadinessFixture })
    },
  )

  await page.route(
    '**/api/integrations/master-data-bootstrap/batches/bootstrap-batch-personnel-1/promote-personnel',
    async (route) => {
      expect(route.request().method()).toBe('POST')
      await route.fulfill({ json: masterDataBootstrapPromotionFixture })
    },
  )

  await page.route(
    '**/api/integrations/master-data-bootstrap/batches/bootstrap-batch-personnel-1/promote-stores',
    async () => {
      throw new Error('Personnel batch must not call store promotion endpoint')
    },
  )

  await page.route(
    '**/api/integrations/master-data-bootstrap/batches/bootstrap-batch-personnel-1',
    async (route) => {
      await route.fulfill({ json: masterDataBootstrapDetailFixture })
    },
  )
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

const noPowerBiSourceLookupsFixture = {
  activeSources: [],
  meta: {
    totalEntityTypes: 7,
    totalActiveSources: 0,
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

const masterDataBootstrapBatchSummary = {
  batchId: 'bootstrap-batch-personnel-1',
  companyId: '00000000-0000-4000-8000-000000000001',
  bootstrapEntity: 'personnel',
  sourceLabel: 'March personnel baseline',
  fileReference: 'PERSONEL TABLO.xlsx',
  batchStatus: 'ready_to_promote',
  rowCount: 2,
  pendingCount: 0,
  validCount: 1,
  needsReviewCount: 0,
  invalidCount: 0,
  promotedCount: 1,
  createdByUserId: 'integration-lineage-user',
  createdAt: '2026-04-29T08:00:00.000Z',
  updatedAt: '2026-04-29T09:00:00.000Z',
  promotedAt: null,
}

const masterDataBootstrapBatchesFixture = {
  items: [
    {
      ...masterDataBootstrapBatchSummary,
      readiness: 'ready_to_promote',
      nextAction: 'wait_for_promotion_decision',
    },
  ],
  meta: {
    count: 1,
    total: 1,
    limit: 20,
    offset: 0,
  },
}

const masterDataBootstrapDetailFixture = {
  summary: {
    ...masterDataBootstrapBatchSummary,
    statusCounts: {
      pending: 0,
      valid: 1,
      needsReview: 0,
      invalid: 0,
      promoted: 1,
    },
  },
  rows: {
    items: [
      {
        rowId: 'personnel-row-ready-1',
        rowNumber: 1,
        sourceStoreCode: 'SM140',
        sourceEmployeeCode: 'FM8375',
        validationStatus: 'valid',
        issueCode: null,
        issueMessage: null,
        resolvedCompanyId: '00000000-0000-4000-8000-000000000001',
        resolvedRegionId: 'region-live-1',
        resolvedStoreId: 'store-live-1',
        resolvedEmployeeId: null,
        resolvedPositionId: 'position-live-1',
        promotedEntityId: null,
        rawPayload: {
          firstName: 'Ayse',
          lastName: 'Yilmaz',
        },
        normalizedPayload: {
          normalizedFirstName: 'Ayse',
          normalizedLastName: 'Yilmaz',
          normalizedEmployeeCode: 'FM8375',
          normalizedStoreCode: 'SM140',
          normalizedPositionCode: 'SALES_ASSOCIATE',
          normalizedHireDate: '2026-03-01',
          normalizedEmploymentType: 'full_time',
        },
      },
      {
        rowId: 'personnel-row-promoted-1',
        rowNumber: 2,
        sourceStoreCode: 'SM140',
        sourceEmployeeCode: 'FM8374',
        validationStatus: 'promoted',
        issueCode: null,
        issueMessage: null,
        resolvedCompanyId: '00000000-0000-4000-8000-000000000001',
        resolvedRegionId: 'region-live-1',
        resolvedStoreId: 'store-live-1',
        resolvedEmployeeId: 'employee-live-1',
        resolvedPositionId: 'position-live-1',
        promotedEntityId: 'employee-live-1',
        rawPayload: {
          firstName: 'Fatma',
          lastName: 'Demir',
        },
        normalizedPayload: {
          normalizedFirstName: 'Fatma',
          normalizedLastName: 'Demir',
          normalizedEmployeeCode: 'FM8374',
          normalizedStoreCode: 'SM140',
          normalizedPositionCode: 'SALES_ASSOCIATE',
          normalizedHireDate: '2026-03-01',
          normalizedEmploymentType: 'full_time',
        },
      },
    ],
    meta: {
      count: 2,
      total: 2,
      limit: 2,
      offset: 0,
    },
  },
}

const masterDataBootstrapReadinessFixture = {
  summary: {
    batchId: 'bootstrap-batch-personnel-1',
    bootstrapEntity: 'personnel',
    batchStatus: 'ready_to_promote',
    rowCount: 2,
    readyCount: 1,
    waitingBatchCount: 0,
    needsValidationCount: 0,
    needsReviewCount: 0,
    blockedCount: 0,
    alreadyPromotedCount: 1,
    canPromote: true,
    nextAction: 'promote_ready_rows',
  },
  rows: {
    items: [
      {
        rowId: 'personnel-row-ready-1',
        rowNumber: 1,
        sourceStoreCode: 'SM140',
        sourceEmployeeCode: 'FM8375',
        validationStatus: 'valid',
        promotedEntityId: null,
        promotionReadiness: 'ready',
        blockReason: null,
      },
      {
        rowId: 'personnel-row-promoted-1',
        rowNumber: 2,
        sourceStoreCode: 'SM140',
        sourceEmployeeCode: 'FM8374',
        validationStatus: 'promoted',
        promotedEntityId: 'employee-live-1',
        promotionReadiness: 'already_promoted',
        blockReason: 'already_promoted',
      },
    ],
    meta: {
      count: 2,
      total: 2,
      limit: 2,
      offset: 0,
    },
  },
}

const masterDataBootstrapPromotionFixture = {
  command: {
    status: 'promoted',
    message: 'Personnel bootstrap rows promoted',
  },
  data: {
    batch: {
      ...masterDataBootstrapBatchSummary,
      batchStatus: 'promoted',
      validCount: 0,
      promotedCount: 2,
      promotedRows: [
        {
          rowId: 'personnel-row-ready-1',
          promotedEntityId: 'employee-live-2',
          assignmentId: 'assignment-live-1',
        },
      ],
    },
    promotedRows: [
      {
        rowId: 'personnel-row-ready-1',
        promotedEntityId: 'employee-live-2',
        assignmentId: 'assignment-live-1',
      },
    ],
  },
}
