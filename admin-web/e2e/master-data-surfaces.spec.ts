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
    window.localStorage.setItem('store-ops-app-locale', 'en')
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

test('master data bootstrap surface preserves selected batch workflow actions', async ({ page }) => {
  await page.goto('/admin/master-data/batch-store-ready')

  const main = page.getByRole('main')

  await expect(main.getByRole('heading', { name: 'Master Data Command Center' })).toBeVisible()
  await expect(main.getByRole('heading', { name: 'Promotion decisions follow the batch state.' })).toBeVisible()
  await expect(main.getByRole('heading', { name: 'Baseline files before live promotion' })).toBeVisible()
  await expect(main.getByText('batch-store-ready').first()).toBeVisible()
  await expect(main.getByText('Ready rows')).toBeVisible()
  await expect(main.getByText('can promote')).toBeVisible()
  await expect(main.getByRole('button', { name: 'Validate batch' })).toBeEnabled()
  await expect(main.getByRole('button', { name: 'Promote stores' })).toBeEnabled()
  await expect(main.getByText('#1 Store Istanbul')).toBeVisible()
  await expect(main.locator('[data-slot="table"]')).toHaveCount(1)
  await expect(main.locator(legacyAdminSelector)).toHaveCount(0)
  await expectNoHorizontalOverflow(page)
})

test('master data bootstrap detail stays mobile-safe', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/admin/master-data/batch-store-ready')

  const main = page.getByRole('main')
  await expect(main.getByRole('heading', { name: 'Master Data Command Center' })).toBeVisible()
  await expect(main.getByRole('heading', { name: 'Promotion decisions follow the batch state.' })).toBeVisible()
  await expect(main.getByText('batch-store-ready').first()).toBeVisible()
  await expectNoHorizontalOverflow(page)
})

async function routeMasterDataApi(page: Page) {
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({ json: authSessionFixture })
  })

  await page.route('**/api/integrations/master-data-bootstrap/batches?**', async (route) => {
    await route.fulfill({ json: masterDataBatchListFixture })
  })

  await page.route('**/api/integrations/master-data-bootstrap/batches/batch-store-ready/promotion-readiness', async (route) => {
    await route.fulfill({ json: masterDataReadinessFixture })
  })

  await page.route('**/api/integrations/master-data-bootstrap/batches/batch-store-ready', async (route) => {
    await route.fulfill({ json: masterDataDetailFixture })
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
