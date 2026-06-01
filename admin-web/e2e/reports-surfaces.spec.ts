import { expect, test, type Page } from './test-fixtures'

const legacyReportSelector = [
  '.hero-panel',
  '.panel',
  '.metric-grid',
  '.metric-card',
  '.stacked-table',
  '.stacked-row',
  '.accent-chip',
  '.control-button',
  '.control-select',
  '.toolbar-cluster',
  '.panel-copy',
].join(',')

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('store-ops-app-locale', 'en')
    window.localStorage.setItem(
      'store-ops-admin-session',
      JSON.stringify({
        mode: 'mock',
        mockUserId: 'reports-surface-user',
        mockRoleCodes: 'SUPER_ADMIN,REPORT_VIEWER,AUDITOR,SNAPSHOT_OPERATOR',
        mockCompanyIds: '00000000-0000-0000-0000-000000000001',
        bearerToken: '',
      }),
    )
  })

  await routeReportsApi(page)
})

test('reports hub and snapshot chooser keep route semantics on AdminSurface primitives', async ({ page }) => {
  await page.goto('/admin/reports')

  let main = page.getByRole('main')

  await expect(main.getByRole('heading', { name: 'Read-only reporting from the latest trustworthy snapshot.' })).toBeVisible()
  await expect(main.getByText('Total report rows')).toBeVisible()
  await expect(main.getByRole('heading', { name: 'Reporting anchor' })).toBeVisible()
  await expect(main.getByRole('heading', { name: 'Which reports this snapshot output feeds' })).toBeVisible()
  await expect(main.getByText('/api/reports/summary')).toHaveCount(0)
  await expect(main.getByRole('link', { name: 'Open drill-down chooser' })).toHaveAttribute(
    'href',
    '/admin/reports/snapshot-runs',
  )
  await expect(main.getByRole('link', { name: 'Open workforce report for snapshot-versioned' })).toHaveAttribute(
    'href',
    '/admin/reports/workforce/snapshot-versioned',
  )
  await expect(main.locator('[data-slot="table"]')).toHaveCount(2)
  await expect(main.locator(legacyReportSelector)).toHaveCount(0)
  await expectNoHorizontalOverflow(page)

  await page.goto('/admin/reports/snapshot-runs')

  main = page.getByRole('main')

  await expect(main.getByRole('heading', { name: 'Recent reporting runs' })).toBeVisible()
  await expect(main.getByText('KPI config version').first()).toBeVisible()
  await expect(main.getByText('v7')).toBeVisible()
  await expect(main.getByRole('link', { name: 'Open workforce for snapshot-versioned' })).toHaveAttribute(
    'href',
    '/admin/reports/workforce/snapshot-versioned',
  )
  await expect(main.getByRole('combobox', { name: 'Sort rows' })).toBeVisible()
  await expect(main.getByRole('button', { name: 'Export CSV' })).toBeVisible()
  await expect(main.locator('[data-slot="table"]')).toHaveCount(1)
  await expect(main.locator(legacyReportSelector)).toHaveCount(0)
  await expectNoHorizontalOverflow(page)
})

const detailScenarios = [
  {
    url: '/admin/reports/workforce/snapshot-versioned',
    heading: 'Workforce rows for one immutable reporting context.',
    contextHeading: 'Selected workforce snapshot',
    tableHeading: 'Store-position staffing balance',
    rowText: 'store-istanbul-001',
    placeholder: 'Search by store, position, or gap',
    statusText: 'Gap detected',
  },
  {
    url: '/admin/reports/kpis/snapshot-versioned',
    heading: 'KPI rows for one immutable reporting context.',
    contextHeading: 'Selected KPI snapshot',
    tableHeading: 'Store-KPI performance rows',
    rowText: 'kpi-upt',
    placeholder: 'Search by store, KPI, status, or value',
    statusText: 'At risk',
  },
  {
    url: '/admin/reports/checklists/snapshot-versioned',
    heading: 'Checklist rows for one immutable reporting context.',
    contextHeading: 'Selected checklist snapshot',
    tableHeading: 'Store-template compliance rows',
    rowText: 'bm-visit',
    placeholder: 'Search by store, template, score, or issue count',
    statusText: 'Critical findings',
  },
  {
    url: '/admin/reports/turnover/snapshot-versioned',
    heading: 'Turnover rows for one immutable reporting context.',
    contextHeading: 'Selected turnover snapshot',
    tableHeading: 'Company, region, and store turnover rows',
    rowText: 'region-marmara',
    placeholder: 'Search by scope, org id, leavers, or turnover',
    statusText: '18%',
  },
]

for (const scenario of detailScenarios) {
  test(`${scenario.tableHeading} renders report data without legacy surface classes`, async ({ page }) => {
    await page.goto(scenario.url)

    const main = page.getByRole('main')

    await expect(main.getByRole('heading', { name: scenario.heading })).toBeVisible()
    await expect(main.getByRole('link', { name: 'Choose another snapshot' })).toHaveAttribute(
      'href',
      '/admin/reports/snapshot-runs',
    )
    await expect(main.getByText('Rows in view')).toBeVisible()
    await expect(main.getByRole('heading', { name: scenario.contextHeading })).toBeVisible()
    await expect(main.getByRole('heading', { name: scenario.tableHeading })).toBeVisible()
    await expect(main.getByPlaceholder(scenario.placeholder)).toBeVisible()
    await expect(main.getByRole('button', { name: 'Export CSV' })).toBeVisible()
    await expect(main.getByText(scenario.rowText)).toBeVisible()
    await expect(main.getByText(scenario.statusText).first()).toBeVisible()
    await expect(main.locator('[data-slot="table"]')).toHaveCount(1)
    await expect(main.locator(legacyReportSelector)).toHaveCount(0)
    await expectNoHorizontalOverflow(page)
  })
}

test('reports detail controls remain bounded on mobile width', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 })
  await page.goto('/admin/reports/workforce/snapshot-versioned')

  const main = page.getByRole('main')

  await expect(main.getByRole('heading', { name: 'Store-position staffing balance' })).toBeVisible()
  await expect(main.getByPlaceholder('Search by store, position, or gap')).toBeVisible()
  await expect(main.getByRole('combobox', { name: 'Sort rows' })).toBeVisible()
  await expect(main.getByRole('button', { name: 'Export CSV' })).toBeVisible()
  await expect(main.locator(legacyReportSelector)).toHaveCount(0)
  await expectNoHorizontalOverflow(page)
})

async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth))
    .toBe(true)
}

async function routeReportsApi(page: Page) {
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({ json: authSessionFixture })
  })

  await page.route('**/api/reports/summary', async (route) => {
    await route.fulfill({ json: reportingSummaryFixture })
  })

  await page.route('**/api/reports/snapshot-runs?**', async (route) => {
    await route.fulfill({ json: snapshotRunsFixture })
  })

  await page.route('**/api/reports/workforce?**', async (route) => {
    await route.fulfill({ json: workforceReportFixture })
  })

  await page.route('**/api/reports/kpis?**', async (route) => {
    await route.fulfill({ json: kpiReportFixture })
  })

  await page.route('**/api/reports/checklists?**', async (route) => {
    await route.fulfill({ json: checklistReportFixture })
  })

  await page.route('**/api/reports/turnover?**', async (route) => {
    await route.fulfill({ json: turnoverReportFixture })
  })
}

const authSessionFixture = {
  authMode: 'mock',
  authenticated: true,
  user: {
    userId: 'reports-surface-user',
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
      generatedBy: 'reports-surface-user',
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

const workforceReportFixture = {
  items: [
    {
      snapshotRunId: 'snapshot-versioned',
      storeId: 'store-istanbul-001',
      positionId: 'sales-consultant',
      activeHeadcount: '8',
      activeFte: '8',
      plannedHeadcount: '10',
      plannedFte: '10',
      gapHeadcount: '-2',
      gapFte: '-2',
    },
    {
      snapshotRunId: 'snapshot-versioned',
      storeId: 'store-ankara-002',
      positionId: 'store-manager',
      activeHeadcount: '1',
      activeFte: '1',
      plannedHeadcount: '1',
      plannedFte: '1',
      gapHeadcount: '0',
      gapFte: '0',
    },
  ],
  meta: { count: 2, total: 2, limit: 50, offset: 0 },
}

const kpiReportFixture = {
  items: [
    {
      snapshotRunId: 'snapshot-versioned',
      storeId: 'store-istanbul-001',
      kpiId: 'kpi-upt',
      kpiCode: 'UPT',
      kpiName: 'Units per transaction',
      periodStart: '2026-04-26',
      periodEnd: '2026-04-26',
      targetValue: '100',
      actualValue: '84',
      achievementRate: '0.84',
      statusBand: 'at_risk',
    },
    {
      snapshotRunId: 'snapshot-versioned',
      storeId: 'store-ankara-002',
      kpiId: 'kpi-sales',
      kpiCode: 'SALES',
      kpiName: 'Sales',
      periodStart: '2026-04-26',
      periodEnd: '2026-04-26',
      targetValue: '100',
      actualValue: '104',
      achievementRate: '1.04',
      statusBand: 'on_track',
    },
  ],
  meta: { count: 2, total: 2, limit: 50, offset: 0 },
}

const checklistReportFixture = {
  items: [
    {
      snapshotRunId: 'snapshot-versioned',
      storeId: 'store-istanbul-001',
      checklistTemplateId: 'bm-visit',
      auditCount: 2,
      avgScore: '82',
      complianceRate: '0.82',
      criticalIssueCount: 1,
    },
    {
      snapshotRunId: 'snapshot-versioned',
      storeId: 'store-ankara-002',
      checklistTemplateId: 'vm-visit',
      auditCount: 1,
      avgScore: '96',
      complianceRate: '0.96',
      criticalIssueCount: 0,
    },
  ],
  meta: { count: 2, total: 2, limit: 50, offset: 0 },
}

const turnoverReportFixture = {
  items: [
    {
      snapshotRunId: 'snapshot-versioned',
      scopeType: 'store',
      companyId: null,
      regionId: null,
      storeId: 'store-istanbul-001',
      periodStart: '2026-04-01',
      periodEnd: '2026-04-30',
      openingHeadcount: '12',
      closingHeadcount: '10',
      avgHeadcount: '11',
      leaverCount: 2,
      turnoverRate: '0.18',
    },
    {
      snapshotRunId: 'snapshot-versioned',
      scopeType: 'region',
      companyId: null,
      regionId: 'region-marmara',
      storeId: null,
      periodStart: '2026-04-01',
      periodEnd: '2026-04-30',
      openingHeadcount: '120',
      closingHeadcount: '118',
      avgHeadcount: '119',
      leaverCount: 3,
      turnoverRate: '0.03',
    },
  ],
  meta: { count: 2, total: 2, limit: 50, offset: 0 },
}
