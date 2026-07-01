import { expect, test, type Page } from './test-fixtures'

const legacyAdminSelector = [
  '.master-data-command-page',
  '.master-data-command-panel',
  '.master-data-command-metric',
  '.master-data-command-table',
  '.hero-panel',
  '.panel',
  '.control-button',
  '.control-select',
  '.search-field',
  '.inline-state',
].join(',')

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('store-ops-app-locale', 'tr')
    window.localStorage.setItem(
      'store-ops-admin-session',
      JSON.stringify({
        mode: 'mock',
        mockUserId: 'master-data-surface-user',
        mockRoleCodes: 'SUPER_ADMIN,HR_ADMIN,INTEGRATION_ADMIN',
        mockCompanyIds: '00000000-0000-0000-0000-000000000001',
        bearerToken: '',
      }),
    )
  })

  await routeMasterDataApi(page)
})

test('master data control center shows the approved workbench surface', async ({ page }) => {
  await page.goto('/admin/master-data')

  const main = page.getByRole('main')

  await expect(main.getByRole('heading', { name: 'Ana Veri Kontrolü' })).toBeVisible()
  await expect(main.getByText('Mağaza, personel, rol ve bölge ilişkilerini temizleyip kaydedin.')).toBeVisible()
  await expect(main.getByRole('tab', { name: /Düzeltilecekler/ })).toBeVisible()
  await expect(main.getByRole('tab', { name: /Mağazalar/ })).toBeVisible()
  await expect(main.getByRole('tab', { name: /Personel/ })).toBeVisible()
  await expect(main.getByRole('tab', { name: /İçe Aktarım/ })).toBeVisible()
  await expect(main.getByRole('heading', { name: 'Bölge müdürü ataması eksik' })).toBeVisible()
  await expect(main.getByRole('button', { name: /Değişiklikleri kaydet/ })).toBeDisabled()
  await expect(main.locator(legacyAdminSelector)).toHaveCount(0)
  await expectNoHorizontalOverflow(page)
})

test('master data import detail keeps validation and process actions', async ({ page }) => {
  await page.goto('/admin/master-data/batch-store-ready')

  const main = page.getByRole('main')
  await expect(main.getByRole('heading', { name: 'Ana Veri Kontrolü' })).toBeVisible()
  await expect(main.getByRole('tab', { name: /İçe Aktarım/ })).toHaveAttribute('aria-selected', 'true')
  await expect(main.getByRole('heading', { name: 'Store Istanbul' })).toBeVisible()
  await expect(main.getByText('#1 ST001')).toBeVisible()
  await expect(main.getByRole('button', { name: 'Kontrol' })).toBeEnabled()
  await expect(main.getByRole('button', { name: 'Kayda işle' })).toBeEnabled()
  await expectNoHorizontalOverflow(page)
})

test('master data control center stays mobile-safe', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/admin/master-data')

  const main = page.getByRole('main')
  await expect(main.getByRole('heading', { name: 'Ana Veri Kontrolü' })).toBeVisible()
  await expect(main.getByRole('heading', { name: 'Bölge müdürü ataması eksik' })).toBeVisible()
  await expectNoHorizontalOverflow(page)
})

async function routeMasterDataApi(page: Page) {
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({ json: authSessionFixture })
  })

  await page.route('**/api/integrations/master-data-quality/issues?**', async (route) => {
    await route.fulfill({ json: masterDataQualityIssuesFixture })
  })

  await page.route('**/api/integrations/master-data-quality/audit?**', async (route) => {
    await route.fulfill({ json: masterDataAuditFixture })
  })

  await page.route('**/api/integrations/store-master-lookups', async (route) => {
    await route.fulfill({ json: storeMasterLookupsFixture })
  })

  await page.route('**/api/integrations/store-master?**', async (route) => {
    await route.fulfill({ json: storeMasterListFixture })
  })

  await page.route('**/api/integrations/personnel-master-lookups', async (route) => {
    await route.fulfill({ json: personnelMasterLookupsFixture })
  })

  await page.route('**/api/integrations/personnel-master?**', async (route) => {
    await route.fulfill({ json: personnelMasterListFixture })
  })

  await page.route('**/api/integrations/master-data-bootstrap/batches/batch-store-ready/promotion-readiness', async (route) => {
    await route.fulfill({ json: masterDataReadinessFixture })
  })

  await page.route('**/api/integrations/master-data-bootstrap/batches/batch-store-ready', async (route) => {
    await route.fulfill({ json: masterDataDetailFixture })
  })

  await page.route('**/api/integrations/master-data-bootstrap/batches?**', async (route) => {
    await route.fulfill({ json: masterDataBatchListFixture })
  })
}

async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth))
    .toBe(true)
}

const authSessionFixture = {
  authMode: 'mock',
  authenticated: true,
  user: {
    userId: 'master-data-surface-user',
    employeeId: null,
    roleCodes: ['SUPER_ADMIN', 'HR_ADMIN', 'INTEGRATION_ADMIN'],
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

const masterDataQualityIssuesFixture = {
  items: [
    {
      id: 'issue-region-missing',
      issueCode: 'store_missing_region_assignment',
      severity: 'critical',
      entityType: 'store',
      entityId: '00000000-0000-0000-0000-000000000100',
      entityLabel: 'Marmara Park',
      secondaryLabel: 'Mağaza kaydı',
      problemLabel: 'Bölge müdürü ataması eksik',
      recommendedAction: 'Mağaza bölgesini ve sorumlu yöneticiyi seçin.',
      affectedModules: ['KPI', 'Hedefler', 'Primler'],
      lastSeenAt: '2026-06-30T10:00:00.000Z',
      source: 'store-master',
    },
  ],
  summary: {
    severity: { critical: 1, warning: 0, info: 0 },
    entityType: { store: 1, personnel: 0, assignment: 0, import: 0 },
  },
  meta: { count: 1, total: 1, limit: 50, offset: 0 },
}

const storeMasterListFixture = {
  items: [
    {
      storeId: '00000000-0000-0000-0000-000000000100',
      storeCode: 'ST001',
      storeName: 'Store Istanbul',
      storeType: 'company',
      status: 'active',
      kpiImportEnabled: true,
      regionId: '00000000-0000-0000-0000-000000000010',
      regionName: 'Onur Kaytan Bölgesi',
      updatedAt: '2026-06-30T10:00:00.000Z',
    },
  ],
  meta: { count: 1, total: 1, limit: 50, offset: 0 },
}

const storeMasterLookupsFixture = {
  storeTypes: [
    { value: 'company', label: 'Şirket mağazası' },
    { value: 'franchise', label: 'Bayi' },
    { value: 'operator', label: 'İşletme' },
  ],
  statuses: [
    { value: 'active', label: 'Aktif' },
    { value: 'inactive', label: 'Pasif' },
    { value: 'closed', label: 'Kapalı' },
  ],
  regions: [
    {
      regionId: '00000000-0000-0000-0000-000000000010',
      regionCode: 'ONUR',
      regionName: 'Onur Kaytan Bölgesi',
    },
  ],
}

const personnelMasterListFixture = {
  items: [
    {
      employeeId: '00000000-0000-0000-0000-000000000200',
      externalEmployeeRef: 'CORP_4218',
      firstName: 'Emine',
      lastName: 'Çavuş',
      displayName: 'Emine Çavuş',
      hireDate: '2025-06-28',
      terminationDate: null,
      employmentStatus: 'active',
      employmentType: 'full_time',
      assignmentId: '00000000-0000-0000-0000-000000000300',
      assignmentStartDate: '2025-06-28',
      storeId: '00000000-0000-0000-0000-000000000100',
      storeCode: 'ST001',
      storeName: 'Store Istanbul',
      regionId: '00000000-0000-0000-0000-000000000010',
      regionName: 'Onur Kaytan Bölgesi',
      positionId: '00000000-0000-0000-0000-000000000400',
      positionCode: 'SALES',
      positionName: 'Satış Danışmanı',
      updatedAt: '2026-06-30T10:00:00.000Z',
    },
  ],
  meta: { count: 1, total: 1, limit: 50, offset: 0 },
}

const personnelMasterLookupsFixture = {
  stores: [
    {
      storeId: '00000000-0000-0000-0000-000000000100',
      storeCode: 'ST001',
      storeName: 'Store Istanbul',
      regionId: '00000000-0000-0000-0000-000000000010',
      regionName: 'Onur Kaytan Bölgesi',
    },
  ],
  positions: [
    {
      positionId: '00000000-0000-0000-0000-000000000400',
      positionCode: 'SALES',
      positionName: 'Satış Danışmanı',
      isManagerial: false,
    },
  ],
  employmentStatuses: [
    { value: 'active', label: 'Aktif' },
    { value: 'inactive', label: 'Pasif' },
    { value: 'terminated', label: 'Ayrıldı' },
  ],
  employmentTypes: [
    { value: 'full_time', label: 'Tam zamanlı' },
    { value: 'part_time', label: 'Yarı zamanlı' },
    { value: 'temporary', label: 'Geçici' },
  ],
}

const masterDataBatchListFixture = {
  items: [
    {
      batchId: 'batch-store-ready',
      companyId: '00000000-0000-0000-0000-000000000001',
      bootstrapEntity: 'store',
      sourceLabel: 'Store Istanbul',
      fileReference: 'store-master.xlsx#sheet-1',
      uploadedByUserId: 'master-data-surface-user',
      batchStatus: 'valid',
      rowCount: 1,
      pendingCount: 0,
      validCount: 1,
      needsReviewCount: 0,
      invalidCount: 0,
      promotedCount: 0,
      createdAt: '2026-05-04T11:51:26.982Z',
      validatedAt: '2026-05-04T11:51:27.289Z',
      promotedAt: null,
      readiness: 'ready_to_promote',
      nextAction: 'ready_to_promote',
    },
  ],
  meta: { count: 1, total: 1, limit: 50, offset: 0 },
}

const masterDataDetailFixture = {
  summary: {
    ...masterDataBatchListFixture.items[0],
  },
  rows: {
    items: [
      {
        rowId: 'store-row-1',
        batchId: 'batch-store-ready',
        rowNumber: 1,
        sourceStoreCode: 'ST001',
        sourceEmployeeCode: null,
        validationStatus: 'valid',
        issueCode: null,
        issueMessage: null,
        resolvedCompanyId: '00000000-0000-0000-0000-000000000001',
        resolvedRegionId: '00000000-0000-0000-0000-000000000010',
        resolvedStoreId: '00000000-0000-0000-0000-000000000100',
        resolvedEmployeeId: null,
        resolvedPositionId: null,
        promotedEntityId: null,
        rawPayload: {},
        normalizedPayload: {
          normalizedStoreName: 'Store Istanbul',
        },
        updatedAt: '2026-05-04T11:51:27.289Z',
      },
    ],
    meta: { count: 1, total: 1, limit: 50, offset: 0 },
  },
}

const masterDataReadinessFixture = {
  summary: {
    batchId: 'batch-store-ready',
    bootstrapEntity: 'store',
    nextAction: 'ready_to_promote',
    canPromote: true,
    readyCount: 1,
    blockedCount: 0,
    needsValidationCount: 0,
    needsReviewCount: 0,
  },
  rows: {
    items: [
      {
        rowId: 'store-row-1',
        rowNumber: 1,
        sourceStoreCode: 'ST001',
        sourceEmployeeCode: null,
        promotedEntityId: null,
        promotionReadiness: 'ready',
        blockReason: null,
      },
    ],
    meta: { count: 1, total: 1, limit: 50, offset: 0 },
  },
}

const masterDataAuditFixture = {
  items: [
    {
      eventId: 'audit-1',
      eventType: 'store_master_updated',
      entityType: 'store',
      entityId: '00000000-0000-0000-0000-000000000100',
      entityLabel: 'Store Istanbul',
      actorLabel: 'Admin',
      occurredAt: '2026-06-30T10:30:00.000Z',
      summary: 'Mağaza bölgesi güncellendi.',
      metadata: {},
    },
  ],
  meta: { count: 1, total: 1, limit: 30, offset: 0 },
}
