import { expect, test, type Page } from './test-fixtures'
import { setStoredLocale } from './locale-test-utils'

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

  await setStoredLocale(page, 'en')

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

  await setStoredLocale(page, 'en')

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

test('workforce report page switches drill-down chrome to English copy and persists locale', async ({ page }) => {
  await page.goto('/admin/reports/workforce/snapshot-versioned')

  await expect(page.getByText('Raporlama detayı')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Tek değişmez raporlama bağlamı için işgücü satırları.' })).toBeVisible()
  await expect(page.getByText('Görünen satırlar')).toBeVisible()
  await expect(page.getByText('Açığı olan mağazalar')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Başka snapshot seç' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Seçili işgücü snapshotı' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Aktif kadro' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Planlanan kadro' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Mağaza-pozisyon kadro dengesi' })).toBeVisible()
  await expect(page.getByText('Personel açığı tespit edildi')).toBeVisible()
  await expect(page.getByText('Dengeli')).toBeVisible()
  await expect(page.getByPlaceholder('Mağaza, pozisyon veya açık ara')).toBeVisible()
  await expect(page.getByText('Reporting Drill-Down')).toHaveCount(0)
  await expect(page.getByText('Workforce rows for one immutable reporting context.')).toHaveCount(0)
  await expect(page.getByText('Gap detected')).toHaveCount(0)
  await expect(page.locator('body')).not.toContainText('ÃƒÆ’')
  await expect(page.locator('body')).not.toContainText('Ãƒâ€')
  await expect(page.locator('body')).not.toContainText('Ãƒâ€¦')

  await setStoredLocale(page, 'en')

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByText('Reporting Drill-Down')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Workforce rows for one immutable reporting context.' })).toBeVisible()
  await expect(page.getByText('Rows in view')).toBeVisible()
  await expect(page.getByText('Stores with gap')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Choose another snapshot' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Selected workforce snapshot' })).toBeVisible()
  await expect(page.getByText('Gap detected')).toBeVisible()
  await expect(page.getByText('Balanced')).toBeVisible()
  await expect(page.getByPlaceholder('Search by store, position, or gap')).toBeVisible()
  await expect(page.getByText('Raporlama detayı')).toHaveCount(0)
  await expect(page.getByText('Personel açığı tespit edildi')).toHaveCount(0)

  await page.reload()

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('heading', { name: 'Workforce rows for one immutable reporting context.' })).toBeVisible()
})

test('KPI report page switches drill-down chrome to English copy and persists locale', async ({ page }) => {
  await page.goto('/admin/reports/kpis/snapshot-versioned')

  await expect(page.getByText('Raporlama detayı')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Tek değişmez raporlama bağlamı için KPI satırları.' })).toBeVisible()
  await expect(page.getByText('Ortalama başarı', { exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Başka snapshot seç' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Seçili KPI snapshotı' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Mağaza-KPI performans satırları' })).toBeVisible()
  await expect(page.getByText('Riskte').first()).toBeVisible()
  await expect(page.getByText('Hedef değer', { exact: true }).first()).toBeVisible()
  await expect(page.getByPlaceholder('Mağaza, KPI, durum veya değer ara')).toBeVisible()
  await expect(page.getByText('KPI rows for one immutable reporting context.')).toHaveCount(0)
  await expect(page.getByText('Status band')).toHaveCount(0)
  await expect(page.locator('body')).not.toContainText('ÃƒÆ’')
  await expect(page.locator('body')).not.toContainText('Ãƒâ€')
  await expect(page.locator('body')).not.toContainText('Ãƒâ€¦')

  await setStoredLocale(page, 'en')

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('heading', { name: 'KPI rows for one immutable reporting context.' })).toBeVisible()
  await expect(page.getByText('Avg achievement', { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Selected KPI snapshot' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Store-KPI performance rows' })).toBeVisible()
  await expect(page.getByText('At risk').first()).toBeVisible()
  await expect(page.getByText('Target value', { exact: true }).first()).toBeVisible()
  await expect(page.getByPlaceholder('Search by store, KPI, status, or value')).toBeVisible()
  await expect(page.getByText('Raporlama detayı')).toHaveCount(0)

  await page.reload()

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('heading', { name: 'KPI rows for one immutable reporting context.' })).toBeVisible()
})

test('checklist report page switches drill-down chrome to English copy and persists locale', async ({ page }) => {
  await page.goto('/admin/reports/checklists/snapshot-versioned')

  await expect(page.getByText('Raporlama detayı')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Tek değişmez raporlama bağlamı için checklist satırları.' })).toBeVisible()
  await expect(page.getByText('Ortalama uyum', { exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Başka snapshot seç' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Seçili checklist snapshotı' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Mağaza-template uyum satırları' })).toBeVisible()
  await expect(page.getByText('Kritik bulgu', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('Uyumlu')).toBeVisible()
  await expect(page.getByPlaceholder('Mağaza, template, skor veya bulgu sayısı ara')).toBeVisible()
  await expect(page.getByText('Checklist rows for one immutable reporting context.')).toHaveCount(0)
  await expect(page.getByText('Critical findings')).toHaveCount(0)
  await expect(page.locator('body')).not.toContainText('ÃƒÆ’')
  await expect(page.locator('body')).not.toContainText('Ãƒâ€')
  await expect(page.locator('body')).not.toContainText('Ãƒâ€¦')

  await setStoredLocale(page, 'en')

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('heading', { name: 'Checklist rows for one immutable reporting context.' })).toBeVisible()
  await expect(page.getByText('Avg compliance', { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Selected checklist snapshot' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Store-template compliance rows' })).toBeVisible()
  await expect(page.getByText('Critical findings', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('Compliant')).toBeVisible()
  await expect(page.getByPlaceholder('Search by store, template, score, or issue count')).toBeVisible()
  await expect(page.getByText('Raporlama detayı')).toHaveCount(0)

  await page.reload()

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('heading', { name: 'Checklist rows for one immutable reporting context.' })).toBeVisible()
})

test('turnover report page switches drill-down chrome to English copy and persists locale', async ({ page }) => {
  await page.goto('/admin/reports/turnover/snapshot-versioned')

  await expect(page.getByText('Raporlama detayı')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Tek değişmez raporlama bağlamı için personel çıkışı satırları.' })).toBeVisible()
  await expect(page.getByText('Ortalama çıkış oranı', { exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Başka snapshot seç' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Seçili personel çıkışı snapshotı' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Şirket, bölge ve mağaza çıkış satırları' })).toBeVisible()
  await expect(page.getByText('Ayrılan sayısı', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('Çıkış oranı', { exact: true }).first()).toBeVisible()
  await expect(page.getByPlaceholder('Kapsam, organizasyon ID, ayrılan veya çıkış oranı ara')).toBeVisible()
  await expect(page.getByText('Turnover rows for one immutable reporting context.')).toHaveCount(0)
  await expect(page.getByText('Leaver count')).toHaveCount(0)
  await expect(page.locator('body')).not.toContainText('ÃƒÆ’')
  await expect(page.locator('body')).not.toContainText('Ãƒâ€')
  await expect(page.locator('body')).not.toContainText('Ãƒâ€¦')

  await setStoredLocale(page, 'en')

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('heading', { name: 'Turnover rows for one immutable reporting context.' })).toBeVisible()
  await expect(page.getByText('Avg turnover', { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Selected turnover snapshot' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Company, region, and store turnover rows' })).toBeVisible()
  await expect(page.getByText('Leaver count', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('Turnover rate', { exact: true }).first()).toBeVisible()
  await expect(page.getByPlaceholder('Search by scope, org id, leavers, or turnover')).toBeVisible()
  await expect(page.getByText('Raporlama detayı')).toHaveCount(0)

  await page.reload()

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('heading', { name: 'Turnover rows for one immutable reporting context.' })).toBeVisible()
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
