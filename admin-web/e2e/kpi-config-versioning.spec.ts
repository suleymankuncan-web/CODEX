import { expect, test, type Page } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'store-ops-admin-session',
      JSON.stringify({
        mode: 'mock',
        mockUserId: 'super-admin-versioning-user',
        mockRoleCodes: 'SUPER_ADMIN,REPORT_VIEWER,AUDITOR,SNAPSHOT_OPERATOR',
        mockCompanyIds: '00000000-0000-0000-0000-000000000001',
        bearerToken: '',
      }),
    )
  })

  await routeVersioningApi(page)
})

test('admin KPI config page shows latest version metadata', async ({ page }) => {
  await page.goto('/admin/kpi-config')

  await expect(page.getByText('Sürümlü şema')).toBeVisible()
  await expect(page.getByText('Aktif', { exact: true })).toBeVisible()
  await expect(page.getByText('Son sürüm')).toBeVisible()
  await expect(page.getByText('v7')).toBeVisible()
  await expect(page.getByText('V1 için geri dönüş aktif değil')).toBeVisible()
})

test('snapshot runs page localizes KPI config version reporting context', async ({ page }) => {
  await page.goto('/admin/reports/snapshot-runs')

  await expect(page.getByRole('heading', { name: 'Son raporlama çalışmaları' })).toBeVisible()
  await expect(page.getByText('Snapshot bağlamları')).toBeVisible()
  await expect(page.getByText('KPI ayar sürümü').first()).toBeVisible()
  await expect(page.getByText('v7')).toBeVisible()
  await expect(page.getByText('Yönetişim öncesi snapshot')).toBeVisible()
  await expect(page.getByRole('link', { name: 'İşgücünü aç' }).first()).toBeVisible()
  await expect(page.getByText('KPI config version')).toHaveCount(0)
  await expect(page.locator('body')).not.toContainText('Ã')
  await expect(page.locator('body')).not.toContainText('Ä')
  await expect(page.locator('body')).not.toContainText('Å')

  await page.locator('.language-toggle-button').filter({ hasText: 'EN' }).click()

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('heading', { name: 'Recent reporting runs' })).toBeVisible()
  await expect(page.getByText('Snapshot contexts')).toBeVisible()
  await expect(page.getByText('KPI config version').first()).toBeVisible()
  await expect(page.getByText('Pre-governance snapshot')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Open workforce' }).first()).toBeVisible()
  await expect(page.getByText('KPI ayar sürümü')).toHaveCount(0)

  await page.reload()

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('heading', { name: 'Recent reporting runs' })).toBeVisible()
})

test('reports summary page switches hub chrome to English copy and persists locale', async ({ page }) => {
  await page.goto('/admin/reports')

  await expect(page.getByText('Raporlama özeti')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Güvenilir son snapshot üzerinden salt okunur raporlama.' })).toBeVisible()
  await expect(page.getByText('Toplam rapor satırı')).toBeVisible()
  await expect(page.getByText('Son tamamlanan snapshot')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Raporlama bağlamı', exact: true })).toBeVisible()
  await expect(page.getByText('Snapshot çalışma ID')).toBeVisible()
  await expect(page.getByText('tamamlandı').first()).toBeVisible()
  await expect(page.getByRole('link', { name: 'Detay seçiciyi aç' })).toBeVisible()
  await expect(page.getByText('Reporting Summary')).toHaveCount(0)
  await expect(page.getByText('Total report rows')).toHaveCount(0)
  await expect(page.getByText('Open drill-down chooser')).toHaveCount(0)
  await expect(page.locator('body')).not.toContainText('Ãƒ')
  await expect(page.locator('body')).not.toContainText('Ã„')
  await expect(page.locator('body')).not.toContainText('Ã…')

  await page.locator('.language-toggle-button').filter({ hasText: 'EN' }).click()

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByText('Reporting Summary')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Read-only reporting from the latest trustworthy snapshot.' })).toBeVisible()
  await expect(page.getByText('Total report rows')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Reporting anchor' })).toBeVisible()
  await expect(page.getByText('completed').first()).toBeVisible()
  await expect(page.getByRole('link', { name: 'Open drill-down chooser' })).toBeVisible()
  await expect(page.getByText('Raporlama özeti')).toHaveCount(0)
  await expect(page.getByText('Toplam rapor satırı')).toHaveCount(0)

  await page.reload()

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('heading', { name: 'Read-only reporting from the latest trustworthy snapshot.' })).toBeVisible()
})

async function routeVersioningApi(page: Page) {
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({ json: authSessionFixture })
  })

  await page.route('**/api/reports/summary', async (route) => {
    await route.fulfill({ json: reportingSummaryFixture })
  })

  await page.route('**/api/reports/kpi-config/editor', async (route) => {
    await route.fulfill({ json: kpiConfigEditorFixture })
  })

  await page.route('**/api/reports/kpi-config/audit', async (route) => {
    await route.fulfill({ json: { items: [], meta: { count: 0, total: 0, limit: 20, offset: 0 } } })
  })

  await page.route('**/api/reports/snapshot-runs?**', async (route) => {
    await route.fulfill({ json: snapshotRunsFixture })
  })
}

const authSessionFixture = {
  authMode: 'mock',
  authenticated: true,
  user: {
    userId: 'super-admin-versioning-user',
    roleCodes: ['SUPER_ADMIN', 'REPORT_VIEWER', 'AUDITOR', 'SNAPSHOT_OPERATOR'],
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

const config = {
  storeProfile: {
    profileCode: 'store',
    title: 'Store Score',
    summary: 'Store summary',
    futureMetricRule: 'Add through config',
    metrics: [
      {
        code: 'TARGET_ACHIEVEMENT',
        label: 'Target',
        weightPercent: 100,
        ownerRole: 'STORE_MANAGER',
        scoreBehavior: 'task_candidate',
      },
    ],
  },
  personnelProfile: {
    profileCode: 'personnel',
    title: 'Personnel Score',
    summary: 'Personnel summary',
    futureMetricRule: 'Add through config',
    metrics: [
      {
        code: 'UPT',
        label: 'UPT',
        weightPercent: 100,
        ownerRole: 'STORE_PERSONNEL',
        scoreBehavior: 'warning_first',
      },
    ],
  },
  ownershipMatrix: [
    {
      code: 'UPT',
      label: 'UPT',
      visibleTo: ['STORE_MANAGER', 'STORE_PERSONNEL'],
      operationalOwner: 'STORE_MANAGER',
      contributesTo: ['store', 'personnel'],
      taskCandidate: false,
    },
  ],
  gradingBands: [
    { code: 'A', label: 'Excellent', emoji: 'A', tone: 'calm', minScore: 1 },
  ],
}

const kpiConfigEditorFixture = {
  draftConfig: config,
  publishedConfig: config,
  hasUnpublishedChanges: false,
  latestPublishedVersion: {
    kpiConfigVersionId: '11111111-1111-4111-8111-111111111111',
    versionNo: 7,
    lifecycleState: 'published',
    effectiveFrom: '2026-04-26T00:00:00.000Z',
    effectiveTo: null,
    publishedAt: '2026-04-26T09:00:00.000Z',
    publishedBy: 'super-admin-versioning-user',
  },
}

const snapshotRunsFixture = {
  items: [
    {
      snapshotRunId: 'snapshot-versioned',
      snapshotDate: '2026-04-26',
      snapshotType: 'daily',
      periodStart: '2026-04-26',
      periodEnd: '2026-04-26',
      runStatus: 'completed',
      generatedAt: '2026-04-26T01:00:00.000Z',
      generatedBy: 'super-admin-versioning-user',
      kpiConfigVersion: {
        kpiConfigVersionId: '11111111-1111-4111-8111-111111111111',
        versionNo: 7,
        state: 'versioned',
      },
    },
    {
      snapshotRunId: 'snapshot-pre-governance',
      snapshotDate: '2026-04-25',
      snapshotType: 'daily',
      periodStart: '2026-04-25',
      periodEnd: '2026-04-25',
      runStatus: 'completed',
      generatedAt: '2026-04-25T01:00:00.000Z',
      generatedBy: 'system',
      kpiConfigVersion: {
        kpiConfigVersionId: null,
        versionNo: null,
        state: 'pre_governance',
      },
    },
  ],
  meta: { count: 2, total: 2, limit: 8, offset: 0 },
}

const reportingSummaryFixture = {
  latestCompletedSnapshotRun: snapshotRunsFixture.items[0],
  cards: {
    workforceRows: 12,
    kpiRows: 24,
    checklistRows: 6,
    turnoverRows: 3,
  },
}
