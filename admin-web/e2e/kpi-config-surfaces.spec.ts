import { expect, test, type Page } from './test-fixtures'

const legacySelectors = [
  '.hero-panel',
  '.metric-card',
  '.dashboard-card',
  '.status-pill',
  '.panel-heading',
  '.stacked-row',
  '.stacked-table',
  '.control-button',
  '.page-stack',
  '.key-grid',
].join(', ')

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'store-ops-admin-session',
      JSON.stringify({
        mode: 'mock',
        mockUserId: 'super-admin-kpi-surface-user',
        mockRoleCodes: 'SUPER_ADMIN',
        mockCompanyIds: '00000000-0000-0000-0000-000000000001',
        bearerToken: '',
      }),
    )
  })

  await routeAdminKpiConfigSurfaceApi(page)
})

test('admin KPI config renders on AdminSurface primitives without legacy remnants', async ({ page }) => {
  await page.goto('/admin/kpi-config')

  await expect(page.getByRole('heading', { name: 'Skor profilleri ve KPI sahipliği için admin yüzeyi.' })).toBeVisible()
  await expect(page.locator(legacySelectors)).toHaveCount(0)
  await expect(page.locator('[data-testid^="admin-metric-"]')).toHaveCount(4)
  await expect(page.getByRole('group', { name: /Store Score .* TARGET_ACHIEVEMENT/ })).toBeVisible()
  await expect(page.getByRole('group', { name: /Personnel Score .* TARGET_ACHIEVEMENT/ })).toBeVisible()
  await expect(page.locator('body')).not.toContainText('/admin/kpi-config')
  await expect(page.locator('body')).not.toContainText('ops.kpi_score_profile_config')
  await expect(page.locator('body')).not.toContainText('korelasyon')

  await page.setViewportSize({ width: 390, height: 844 })
  await page.reload()

  await expect(page.locator(legacySelectors)).toHaveCount(0)
  const hasNoHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
  )
  expect(hasNoHorizontalOverflow).toBe(true)
})

async function routeAdminKpiConfigSurfaceApi(page: Page) {
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({ json: authSessionFixture })
  })

  await page.route('**/api/reports/kpi-config/editor', async (route) => {
    await route.fulfill({ json: kpiConfigEditorFixture })
  })

  await page.route('**/api/reports/kpi-config/audit', async (route) => {
    await route.fulfill({
      json: {
        items: [
          {
            eventLogId: 'event-1',
            eventType: 'kpi_config_published',
            actorUserId: 'admin',
            occurredAt: '2026-05-20T08:00:00.000Z',
            correlationId: 'correlation-hidden',
            metadata: {
              storeMetricCount: 2,
              personnelMetricCount: 2,
              ownershipRowCount: 1,
              diffSummary: {
                storeProfile: { added: [], removed: [], changed: ['UPT'] },
                personnelProfile: { added: [], removed: [], changed: [] },
                ownershipMatrix: { added: [], removed: [], changed: [] },
                gradingBands: { added: [], removed: [], changed: [] },
              },
            },
          },
        ],
        meta: { count: 1, total: 1, limit: 20, offset: 0 },
      },
    })
  })
}

const authSessionFixture = {
  authMode: 'mock',
  authenticated: true,
  user: {
    userId: 'super-admin-kpi-surface-user',
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

const publishedConfig = {
  storeProfile: {
    profileCode: 'store',
    title: 'Store Score',
    summary: 'Published store score profile',
    futureMetricRule: 'Manual review',
    metrics: [
      {
        code: 'TARGET_ACHIEVEMENT',
        label: 'Target Achievement',
        weightPercent: 70,
        ownerRole: 'STORE_MANAGER',
        scoreBehavior: 'task_candidate',
      },
      {
        code: 'UPT',
        label: 'Units Per Ticket',
        weightPercent: 30,
        ownerRole: 'STORE_MANAGER',
        scoreBehavior: 'warning_first',
      },
    ],
  },
  personnelProfile: {
    profileCode: 'personnel',
    title: 'Personnel Score',
    summary: 'Published personnel score profile',
    futureMetricRule: 'Manual review',
    metrics: [
      {
        code: 'TARGET_ACHIEVEMENT',
        label: 'Target Achievement',
        weightPercent: 50,
        ownerRole: 'STORE_PERSONNEL',
        scoreBehavior: 'score_only',
      },
      {
        code: 'UPT',
        label: 'Units Per Ticket',
        weightPercent: 50,
        ownerRole: 'STORE_PERSONNEL',
        scoreBehavior: 'warning_first',
      },
    ],
  },
  ownershipMatrix: [
    {
      code: 'TARGET_ACHIEVEMENT',
      label: 'Target Achievement',
      visibleTo: ['STORE_MANAGER', 'STORE_PERSONNEL'],
      operationalOwner: 'STORE_MANAGER',
      contributesTo: ['store', 'personnel'],
      taskCandidate: true,
    },
  ],
  gradingBands: [
    { code: 'A', label: 'Excellent', emoji: 'A', tone: 'calm', minScore: 1 },
    { code: 'B', label: 'Healthy', emoji: 'B', tone: 'accent', minScore: 0.85 },
  ],
}

const kpiConfigEditorFixture = {
  draftConfig: publishedConfig,
  publishedConfig,
  hasUnpublishedChanges: false,
  latestPublishedVersion: {
    kpiConfigVersionId: '33333333-3333-4333-8333-333333333333',
    versionNo: 3,
    effectiveFrom: '2026-04-26T00:00:00.000Z',
    effectiveTo: null,
    publishedAt: '2026-04-26T08:00:00.000Z',
    publishedBy: 'super-admin-kpi-surface-user',
  },
}
