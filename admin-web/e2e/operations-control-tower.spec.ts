import { expect, test, type Locator, type Page } from './test-fixtures'
import { setStoredLocale } from './locale-test-utils'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'store-ops-admin-session',
      JSON.stringify({
        mode: 'mock',
        mockUserId: 'operations-admin',
        mockRoleCodes: 'SUPER_ADMIN',
        mockCompanyIds: '00000000-0000-0000-0000-000000000001',
        bearerToken: '',
      }),
    )
  })

  await routeOperationsApi(page, operationsSessionFixture)
})

test('operations control tower composes read-only readiness signals', async ({ page }) => {
  await page.goto('/admin/operations')

  const main = page.getByRole('main')
  await expect(page).toHaveURL(/\/admin\/operations$/)
  await expect(page.getByRole('navigation', { name: 'Birincil' }).getByRole('link', { name: 'Operasyon' })).toBeVisible()
  await expect(main.getByText('Operasyon kontrol kulesi')).toBeVisible()
  await expect(main.getByRole('heading', { name: 'Pilot güven sinyalleri tek ekranda görünmeli.' })).toBeVisible()
  await expect(main.getByRole('heading', { name: 'Backend', exact: true })).toBeVisible()
  await expect(main.getByRole('heading', { name: 'Import', exact: true })).toBeVisible()
  await expect(main.getByRole('heading', { name: 'Veri kalitesi', exact: true })).toBeVisible()
  await expect(main.getByRole('heading', { name: 'Snapshot', exact: true })).toBeVisible()
  await expect(main.getByRole('heading', { name: 'Dış kanıt', exact: true })).toBeVisible()
  await expect(main.getByRole('heading', { name: 'Workforce', exact: true })).toBeVisible()
  await expect(main.getByRole('heading', { name: 'Workflow', exact: true })).toBeVisible()
  await expect(main.getByRole('heading', { name: 'KPI / Rankings', exact: true })).toBeVisible()
  await expect(main.getByRole('heading', { name: 'Operatör aksiyon listesi' })).toBeVisible()
  await expect(main.getByText('Import kuyruğunu aç')).toBeVisible()
  await expect(main.getByText('Veri kalitesi sinyalini doğrula')).toBeVisible()
  await expect(main.getByText('Snapshot kuyruğunu aç')).toBeVisible()
  await expect(main.getByText('Workforce kuyruğunu aç')).toBeVisible()
  await expect(main.getByText('Dış kanıt inputlarını toparla')).toBeVisible()
  await expect(main.getByRole('heading', { name: 'Sinyal tazeliği ve kuyruk baskısı' })).toBeVisible()
  const trFreshnessPanel = page.getByTestId('operations-signal-freshness')
  await expect(operationQueueRow(trFreshnessPanel, 'Import kuyruğu')).toContainText('3 açık sinyal')
  await expect(operationQueueRow(trFreshnessPanel, 'Workforce kimliği')).toContainText('104 açık sinyal')
  await expect(main.getByRole('heading', { name: 'Data quality ve mapping sinyali' })).toBeVisible()
  await expect(main.getByRole('heading', { name: 'Workforce request pressure' })).toBeVisible()
  await expect(main.getByText('Önizleme hata satırı', { exact: true })).toBeVisible()
  await expect(main.getByText('Seller-code isteği', { exact: true })).toBeVisible()
  await expect(main.getByText('Offboarding isteği', { exact: true })).toBeVisible()
  await expect(main.getByText('mağaza', { exact: true })).toBeVisible()
  await expect(main.getByText('batch-ops-1')).toBeVisible()
  await expect(main.getByText('snapshot-ops-1', { exact: true })).toBeVisible()
  await expect(main.getByText('55555555-5555-4555-8555-555555555555')).toBeVisible()
  await expect(main.getByText('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee')).toBeVisible()
  await expect(main.getByText('Staging auth/session kanıtı')).toBeVisible()
  await expect(main.getByRole('heading', { name: 'Canlı, planlı ve input bekleyen sinyaller' })).toBeVisible()
  await expect(main.getByText('Backend / DB / Queue')).toBeVisible()
  await expect(main.getByText('Auth / Role / Scope')).toBeVisible()
  await expect(main.getByText('Workforce Requests')).toBeVisible()
  await expect(main.getByText('Workflow Inbox', { exact: true })).toBeVisible()
  await expect(operationQueueRow(page.getByTestId('operations-metric-coverage'), 'KPI / Rankings')).toContainText('Canlı')
  await expect(main.getByRole('link', { name: /Entegrasyon panelini aç/i })).toHaveAttribute('href', '/admin/integrations')
  await expect(main.getByRole('link', { name: /Workforce Requests/i })).toHaveAttribute('href', '/admin/inbox')
  await expect(main.getByRole('link', { name: /Admin inbox aç/i }).first()).toHaveAttribute('href', '/admin/inbox')
  await expect(main.getByRole('link', { name: /Snapshot operasyonlarını aç/i })).toHaveAttribute('href', '/admin/snapshots')
  await expect(page.locator('body')).not.toContainText('Ãƒ')

  await setStoredLocale(page, 'en')

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(main.getByText('Operations Control Tower')).toBeVisible()
  const capacityPanel = page.getByTestId('operations-capacity-readiness')
  await expect(capacityPanel).toBeVisible()
  await expect(capacityPanel).toContainText('Public staging baseline')
  await expect(capacityPanel).toContainText('Protected role baseline')
  await expect(capacityPanel).toContainText('Blocked')
  await expect(page.locator('body')).not.toContainText(/production ready|broad launch approved/i)
  await expect(main.getByRole('heading', { name: 'Pilot confidence signals should be visible in one place.' })).toBeVisible()
  await expect(main.getByRole('heading', { name: 'Operator action list' })).toBeVisible()
  await expect(main.getByText('Open import queue')).toBeVisible()
  await expect(main.getByText('Verify data quality signal')).toBeVisible()
  await expect(main.getByText('Open snapshot queue')).toBeVisible()
  await expect(main.getByText('Open workforce queue')).toBeVisible()
  await expect(main.getByText('Open workflow inbox')).toBeVisible()
  await expect(main.getByText('Gather external evidence inputs')).toBeVisible()
  await expect(main.getByRole('heading', { name: 'Signal freshness and queue pressure' })).toBeVisible()
  const freshnessPanel = page.getByTestId('operations-signal-freshness')
  await expect(operationQueueRow(freshnessPanel, 'Import queue')).toContainText('3 open signals')
  await expect(operationQueueRow(freshnessPanel, 'Snapshot freshness')).toContainText('1 open signals')
  await expect(operationQueueRow(freshnessPanel, 'Workforce identity')).toContainText('104 open signals')
  await expect(operationQueueRow(freshnessPanel, 'Workflow inbox')).toContainText('3 open signals')
  await expect(operationQueueRow(freshnessPanel, 'KPI / rankings source')).toContainText('0 open signals')
  await expect(operationQueueRow(freshnessPanel, 'Import queue')).toHaveAttribute('href', '/admin/integrations')
  await expect(operationQueueRow(freshnessPanel, 'Snapshot freshness')).toHaveAttribute('href', '/admin/snapshots')
  await expect(operationQueueRow(freshnessPanel, 'Workflow inbox')).toHaveAttribute('href', '/admin/inbox')
  await expect(operationQueueRow(freshnessPanel, 'KPI / rankings source')).toHaveAttribute('href', '/admin/reports')
  await expect(main.getByRole('heading', { name: 'Data quality', exact: true })).toBeVisible()
  await expect(main.getByRole('heading', { name: 'Data quality and mapping signal' })).toBeVisible()
  await expect(main.getByRole('heading', { name: 'Workforce request pressure' })).toBeVisible()
  await expect(main.getByText('Preview error rows', { exact: true })).toBeVisible()
  await expect(main.getByText('store', { exact: true })).toBeVisible()
  await expect(main.getByText('External evidence', { exact: true })).toBeVisible()
  await expect(main.getByText('Workforce', { exact: true })).toBeVisible()
  await expect(main.getByText('Workflow', { exact: true })).toBeVisible()
  await expect(main.getByRole('heading', { name: 'KPI / Rankings', exact: true })).toBeVisible()
  await expect(page.getByTestId('admin-metric-operator-pressure')).toContainText('111')
  await expect(page.getByTestId('admin-metric-workforce')).toContainText('104')
  await expect(page.getByTestId('admin-metric-workflow')).toContainText('3')
  await expect(page.getByTestId('admin-metric-kpi-rankings')).toContainText('Ready')
  const workforcePanel = page.getByTestId('operations-workforce-signal')
  await expect(workforcePanel).toContainText('Seller-code requests')
  await expect(workforcePanel).toContainText('51')
  await expect(workforcePanel).toContainText('Offboarding requests')
  await expect(workforcePanel).toContainText('53')
  await expect(workforcePanel).toContainText('Total workforce pressure')
  await expect(workforcePanel).toContainText('104')
  await expect(main.getByRole('heading', { name: 'Workflow inbox pressure' })).toBeVisible()
  const workflowPanel = page.getByTestId('operations-workflow-signal')
  await expect(workflowPanel).toContainText('High urgency')
  await expect(workflowPanel).toContainText('1')
  await expect(workflowPanel).toContainText('Total workflow pressure')
  await expect(workflowPanel).toContainText('3')
  await expect(main.getByRole('heading', { name: 'KPI and ranking readiness' })).toBeVisible()
  const kpiPanel = page.getByTestId('operations-kpi-ranking-signal')
  await expect(kpiPanel).toContainText('Published KPI config')
  await expect(kpiPanel).toContainText('v4')
  await expect(kpiPanel).toContainText('Leaderboard population')
  await expect(kpiPanel).toContainText('1 stores, 42 personnel')
  await expect(main.getByText('Staging auth/session evidence')).toBeVisible()
  await expect(main.getByRole('heading', { name: 'Live, planned, and input-blocked signals' })).toBeVisible()
  await expect(main.getByText('Auth / Role / Scope')).toBeVisible()
  await expect(main.getByText('Workflow Inbox', { exact: true })).toBeVisible()
  await expect(main.getByText('Release / External Evidence')).toBeVisible()
  await expect(operationQueueRow(page.getByTestId('operations-metric-coverage'), 'KPI / Rankings')).toContainText('Live')
  await expect(main.getByText('Operasyon kontrol kulesi')).toHaveCount(0)
})

test('operations route stays super-admin scoped', async ({ page }) => {
  await page.unroute('**/api/auth/session')
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({
      json: {
        ...operationsSessionFixture,
        user: {
          ...operationsSessionFixture.user,
          roleCodes: ['REPORT_VIEWER'],
        },
      },
    })
  })

  await page.goto('/admin/operations')

  await expect(page.getByRole('navigation', { name: 'Birincil' }).getByRole('link', { name: 'Operasyon' })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Bu rol için rota kullanılamaz' })).toBeVisible()
})

test('operations capacity evidence expires on the documented boundary', async ({ page }) => {
  await setInitialLocale(page, 'en')
  await page.clock.setFixedTime(new Date('2026-06-27T10:00:00.000Z'))
  await page.goto('/admin/operations')

  const capacityPanel = page.getByTestId('operations-capacity-readiness')
  await expect(capacityPanel).toContainText('Passed')

  await page.clock.setFixedTime(new Date('2026-06-28T10:00:00.000Z'))
  await page.reload()

  await expect(capacityPanel).toContainText('Stale')
  await expect(capacityPanel).toContainText(
    'Refresh public capacity evidence before using it for the controlled pilot decision.',
  )
  await expect(capacityPanel).not.toContainText(
    'Controlled pilot can continue only under limited concurrency assumptions.',
  )
  await expect(capacityPanel).toContainText('Protected role baseline')
  await expect(capacityPanel).toContainText('Blocked')
})

test('operations capacity panel refreshes without reload at the stale boundary', async ({ page }) => {
  await setInitialLocale(page, 'en')
  await page.clock.install({ time: new Date('2026-06-27T23:58:00.000Z') })
  await page.goto('/admin/operations')

  const capacityPanel = page.getByTestId('operations-capacity-readiness')
  const capacityStatus = capacityPanel
    .getByTestId('operations-queue-row')
    .filter({ hasText: 'Public staging baseline' })
    .locator('[data-slot="badge"]')
  await expect(capacityStatus).toHaveText('Passed')
  await expect(capacityPanel).toContainText('Controlled pilot can continue only under limited concurrency assumptions.')

  await page.clock.runFor(122_000)

  await expect(capacityStatus).toHaveText('Stale')
  await expect(capacityPanel).toContainText(
    'Refresh public capacity evidence before using it for the controlled pilot decision.',
  )
  await expect(capacityPanel).not.toContainText(
    'Controlled pilot can continue only under limited concurrency assumptions.',
  )
})

test('operations readiness treats queue preview failures as attention', async ({ page }) => {
  await setInitialLocale(page, 'en')
  await page.unroute('**/api/integrations/import-batches/needs-action?**')
  await page.route('**/api/integrations/import-batches/needs-action?**', async (route) => {
    await route.fulfill({
      status: 503,
      json: { message: 'Import needs-action unavailable' },
    })
  })

  await page.goto('/admin/operations')

  const main = page.getByRole('main')
  const freshnessPanel = page.getByTestId('operations-signal-freshness')
  await expect(main.getByText('Attention', { exact: true }).first()).toBeVisible()
  await expect(main.getByRole('heading', { name: 'Import', exact: true })).toBeVisible()
  await expect(main.getByText('Unavailable', { exact: true }).first()).toBeVisible()
  await expect(freshnessPanel).toContainText('Unavailable')
  await expect(operationQueueRow(freshnessPanel, 'Import queue')).toContainText('Unavailable')
})

test('operations backend metric treats health error payloads as failures', async ({ page }) => {
  await setInitialLocale(page, 'en')
  await page.unroute('**/api/health')
  await page.route('**/api/health', async (route) => {
    await route.fulfill({
      json: {
        ...healthFixture,
        status: 'error',
        queue: {
          ...healthFixture.queue,
          status: 'error',
          message: 'Queue posture is unhealthy.',
        },
      },
    })
  })

  await page.goto('/admin/operations')

  const main = page.getByRole('main')
  const backendMetric = page.getByTestId('admin-metric-backend')
  await expect(main.getByText('Attention', { exact: true })).toBeVisible()
  await expect(backendMetric).toHaveClass(/tw:bg-rose-50\/70/)
  await expect(backendMetric).toContainText('Unavailable')
  await expect(backendMetric).toContainText('The health endpoint reports an error; deployment/readiness needs review.')
})

test('operations workforce metric treats request errors as unavailable', async ({ page }) => {
  await setInitialLocale(page, 'en')
  await page.unroute('**/api/workforce/seller-code-requests?**')
  await page.route('**/api/workforce/seller-code-requests?**', async (route) => {
    await route.fulfill({
      status: 503,
      json: { message: 'Seller code request queue unavailable' },
    })
  })

  await page.goto('/admin/operations')

  const main = page.getByRole('main')
  const workforceMetric = page.getByTestId('admin-metric-workforce')
  const workforcePanel = page.getByTestId('operations-workforce-signal')
  const freshnessPanel = page.getByTestId('operations-signal-freshness')
  await expect(main.getByText('Attention', { exact: true }).first()).toBeVisible()
  await expect(workforceMetric).toHaveClass(/tw:bg-warning-soft/)
  await expect(workforceMetric).toContainText('Unavailable')
  await expect(workforcePanel.getByText('Unavailable', { exact: true })).toBeVisible()
  await expect(operationQueueRow(freshnessPanel, 'Workforce identity')).toContainText('Unavailable')
  await expect(workforcePanel).toContainText('Seller code request queue unavailable')
  await expect(page.getByTestId('admin-metric-operator-pressure')).toContainText('7')
  await expect(main.getByText('Open workforce queue')).toHaveCount(0)
})

test('operations workflow metric treats inbox errors as unavailable', async ({ page }) => {
  await setInitialLocale(page, 'en')
  await page.unroute('**/api/workflow/inbox')
  await page.route('**/api/workflow/inbox', async (route) => {
    await route.fulfill({
      status: 503,
      json: { message: 'Workflow inbox unavailable' },
    })
  })

  await page.goto('/admin/operations')

  const main = page.getByRole('main')
  const workflowMetric = page.getByTestId('admin-metric-workflow')
  const workflowPanel = page.getByTestId('operations-workflow-signal')
  const freshnessPanel = page.getByTestId('operations-signal-freshness')
  await expect(main.getByText('Attention', { exact: true }).first()).toBeVisible()
  await expect(workflowMetric).toHaveClass(/tw:bg-warning-soft/)
  await expect(workflowMetric).toContainText('Unavailable')
  await expect(workflowPanel.getByText('Unavailable', { exact: true })).toBeVisible()
  await expect(operationQueueRow(freshnessPanel, 'Workflow inbox')).toContainText('Unavailable')
  await expect(workflowPanel).toContainText('Workflow inbox unavailable')
  await expect(workflowPanel.getByText('Workflow action preview', { exact: true })).toHaveCount(0)
  await expect(page.getByTestId('admin-metric-operator-pressure')).toContainText('108')
  await expect(main.getByText('Open workflow inbox')).toHaveCount(0)
})

test('operations kpi ranking metric treats report errors as unavailable', async ({ page }) => {
  await setInitialLocale(page, 'en')
  await page.unroute('**/api/reports/rankings?**')
  await page.route('**/api/reports/rankings?**', async (route) => {
    await route.fulfill({
      status: 503,
      json: { message: 'Rankings unavailable' },
    })
  })

  await page.goto('/admin/operations')

  const main = page.getByRole('main')
  const kpiMetric = page.getByTestId('admin-metric-kpi-rankings')
  const kpiPanel = page.getByTestId('operations-kpi-ranking-signal')
  const freshnessPanel = page.getByTestId('operations-signal-freshness')
  await expect(main.getByText('Attention', { exact: true }).first()).toBeVisible()
  await expect(kpiMetric).toHaveClass(/tw:bg-warning-soft/)
  await expect(kpiMetric).toContainText('Unavailable')
  await expect(kpiPanel.getByText('Unavailable', { exact: true })).toBeVisible()
  await expect(operationQueueRow(freshnessPanel, 'KPI / rankings source')).toContainText('Unavailable')
  await expect(kpiPanel).toContainText('Rankings unavailable')
  await expect(kpiPanel.getByText('Leaderboard period', { exact: true })).toHaveCount(0)
  await expect(page.getByTestId('admin-metric-operator-pressure')).toContainText('111')
})

test('operations kpi ranking metadata gaps feed readiness pressure', async ({ page }) => {
  await setInitialLocale(page, 'en')
  await page.unroute('**/api/reports/kpi-config')
  await page.route('**/api/reports/kpi-config', async (route) => {
    await route.fulfill({
      json: {
        ...kpiConfigFixture,
        metadata: {
          ...kpiConfigFixture.metadata,
          publishedAt: null,
          versionNo: null,
        },
      },
    })
  })
  await page.unroute('**/api/reports/rankings?**')
  await page.route('**/api/reports/rankings?**', async (route) => {
    await route.fulfill({
      json: {
        ...rankingsFixture,
        source: {
          ...rankingsFixture.source,
          periodEnd: null,
          periodStart: null,
        },
      },
    })
  })

  await page.goto('/admin/operations')

  const main = page.getByRole('main')
  const kpiMetric = page.getByTestId('admin-metric-kpi-rankings')
  const kpiPanel = page.getByTestId('operations-kpi-ranking-signal')
  await expect(main.getByText('Controlled', { exact: true }).first()).toBeVisible()
  await expect(kpiMetric).toHaveClass(/tw:bg-warning-soft/)
  await expect(kpiMetric).toContainText('Needs attention')
  await expect(kpiPanel.getByText('Needs attention', { exact: true })).toBeVisible()
  await expect(page.getByTestId('admin-metric-operator-pressure')).toContainText('113')
})

test('operations control tower keeps mobile width bounded', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/admin/operations')

  await expect(page.getByRole('heading', { name: 'Pilot güven sinyalleri tek ekranda görünmeli.' })).toBeVisible()

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(1)
})

function operationQueueRow(scope: Locator, text: string) {
  return scope.getByTestId('operations-queue-row').filter({ hasText: text }).first()
}

async function routeOperationsApi(page: Page, sessionFixture: typeof operationsSessionFixture) {
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({ json: sessionFixture })
  })

  await page.route('**/api/health', async (route) => {
    await route.fulfill({ json: healthFixture })
  })

  await page.route('**/api/integrations/import-batches/overview', async (route) => {
    await route.fulfill({ json: importOverviewFixture })
  })

  await page.route('**/api/integrations/import-batches/needs-action?**', async (route) => {
    await route.fulfill({ json: importNeedsActionFixture })
  })

  await page.route('**/api/snapshots/runs/overview', async (route) => {
    await route.fulfill({ json: snapshotOverviewFixture })
  })

  await page.route('**/api/snapshots/runs/needs-action?**', async (route) => {
    await route.fulfill({ json: snapshotNeedsActionFixture })
  })

  await page.route('**/api/workforce/seller-code-requests?**', async (route) => {
    await route.fulfill({ json: sellerCodeRequestsFixture })
  })

  await page.route('**/api/workforce/offboarding-requests?**', async (route) => {
    await route.fulfill({ json: offboardingRequestsFixture })
  })

  await page.route('**/api/workflow/inbox', async (route) => {
    await route.fulfill({ json: workflowInboxFixture })
  })

  await page.route('**/api/reports/kpi-config', async (route) => {
    await route.fulfill({ json: kpiConfigFixture })
  })

  await page.route('**/api/reports/rankings?**', async (route) => {
    await route.fulfill({ json: rankingsFixture })
  })
}

async function setInitialLocale(page: Page, locale: 'tr' | 'en') {
  await page.addInitScript((nextLocale) => {
    window.localStorage.setItem('store-ops-app-locale', nextLocale)
  }, locale)
}

const operationsSessionFixture = {
  authMode: 'mock',
  authenticated: true,
  user: {
    userId: 'operations-admin',
    employeeId: null,
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

const healthFixture = {
  status: 'ok',
  service: 'store-ops-api',
  timestamp: '2026-05-21T09:00:00.000Z',
  queueBackend: 'in-memory',
  queue: {
    backend: 'in-memory',
    durable: false,
    redisRequired: false,
    status: 'process-local',
    message: 'In-memory queue is process-local; acceptable for controlled pilot only.',
  },
  observability: {
    status: 'ok',
    errorTracking: {
      dsnConfigured: false,
      enabled: false,
      environment: 'staging',
      externalDelivery: 'not-enabled',
      mode: 'log-only',
    },
    logLevel: 'info',
    readinessProfile: 'controlled-pilot',
  },
  checks: {
    database: {
      status: 'ok',
      latencyMs: 4,
    },
    redis: {
      status: 'skipped',
      latencyMs: 0,
      message: 'Redis health check skipped for process-local queue posture.',
    },
  },
}

const importOverviewFixture = {
  totals: {
    all: 5,
    completed: 3,
    failed: 1,
    completedWithErrors: 1,
    pending: 0,
    queued: 0,
    processing: 0,
  },
  healthTotals: {
    healthy: 3,
    inProgress: 0,
    blocked: 1,
    retryReady: 1,
    needsAction: 1,
    stuck: 0,
  },
  actionTotals: {
    blocked: 1,
    retryReady: 1,
    needsAction: 1,
    stuck: 0,
  },
  latest: {
    completedBatchId: 'batch-completed-1',
    failedBatchId: 'batch-ops-1',
    inProgressBatchId: null,
    stuckBatchId: null,
  },
}

const importNeedsActionFixture = {
  items: [
    {
      batchId: 'batch-ops-1',
      integrationSourceId: 'source-power-bi',
      sourceCode: 'POWER_BI',
      sourceName: 'Power BI',
      entityType: 'kpi',
      startedAt: '2026-05-21T08:00:00.000Z',
      finishedAt: null,
      status: 'failed',
      fileReference: 'ops-control-tower.xlsx',
      recordCount: 120,
      errorCount: 7,
      retryCount: 1,
      lastRetriedAt: null,
      healthState: 'retry_ready',
      actionReason: 'Mapping recovery is complete; retry can be attempted from the integration panel.',
      recommendedAction: 'Open integration detail before retrying.',
      blockedByEntityTypes: ['store'],
      recommendedNextEntityType: null,
      canRetryNow: true,
      isStuck: false,
    },
  ],
  meta: {
    count: 1,
    total: 1,
    limit: 4,
    offset: 0,
  },
}

const snapshotOverviewFixture = {
  totals: {
    all: 4,
    queued: 0,
    running: 1,
    completed: 2,
    failed: 1,
  },
  healthTotals: {
    healthy: 2,
    inProgress: 1,
    retryReady: 1,
    needsAction: 0,
    stuck: 0,
  },
  actionTotals: {
    retryReady: 1,
    stuck: 0,
  },
  latest: {
    completedSnapshotRunId: 'snapshot-completed-1',
    failedSnapshotRunId: 'snapshot-ops-1',
    inProgressSnapshotRunId: 'snapshot-running-1',
    stuckSnapshotRunId: null,
  },
}

const snapshotNeedsActionFixture = {
  items: [
    {
      snapshotRunId: 'snapshot-ops-1',
      snapshotDate: '2026-05-20',
      snapshotType: 'daily',
      periodStart: '2026-05-20',
      periodEnd: '2026-05-20',
      runStatus: 'failed',
      healthState: 'retry_ready',
      generatedAt: '2026-05-20T02:00:00.000Z',
      generatedBy: 'operations-admin',
      startedAt: '2026-05-20T02:01:00.000Z',
      finishedAt: '2026-05-20T02:04:00.000Z',
      failureReason: 'Fixture dependency recovered',
      rerunOfSnapshotRunId: null,
      kpiConfigVersion: {
        kpiConfigVersionId: '11111111-1111-4111-8111-111111111111',
        versionNo: 7,
        state: 'versioned',
      },
      actionReason: 'Dependency recovered and rerun is safe.',
      recommendedAction: 'Open snapshot operations and rerun the failed daily snapshot.',
      canRerun: true,
      rerunCount: 1,
      latestRerunSnapshotRunId: null,
      isStuck: false,
    },
  ],
  meta: {
    count: 1,
    total: 1,
    limit: 4,
    offset: 0,
  },
}

const workflowInboxFixture = {
  items: [
    {
      itemType: 'approval',
      sourceType: 'target_distribution_request',
      sourceId: 'target-request-ops-1',
      title: 'May Target Distribution',
      summary: 'Marmara Park target distribution is waiting for region approval.',
      companyId: '00000000-0000-0000-0000-000000000001',
      regionId: '00000000-0000-0000-0000-000000000010',
      storeId: '00000000-0000-0000-0000-000000000100',
      storeName: 'Marmara Park',
      workflowStatus: 'pending_region_approval',
      inboxStatus: 'needs_attention',
      urgency: 'medium',
      createdAt: '2026-05-21T07:30:00.000Z',
      needsAttentionAt: '2026-05-21T07:30:00.000Z',
      actorRole: 'REGION_APPROVER',
      primaryActionLabel: 'Approve request',
      secondaryActionLabel: 'Open detail',
      deepLink: '/admin/targets',
      historyPreview: 'Submitted by store manager',
    },
    {
      itemType: 'task',
      sourceType: 'kpi_exception',
      sourceId: 'snapshot-ops-1:store-1:kpi-1',
      title: 'Conversion off track',
      summary: 'Marmara Park conversion needs KPI exception follow-up.',
      companyId: '00000000-0000-0000-0000-000000000001',
      regionId: '00000000-0000-0000-0000-000000000010',
      storeId: '00000000-0000-0000-0000-000000000100',
      storeName: 'Marmara Park',
      workflowStatus: 'off_track',
      inboxStatus: 'needs_attention',
      urgency: 'high',
      createdAt: '2026-05-20T21:00:00.000Z',
      needsAttentionAt: '2026-05-20T21:00:00.000Z',
      actorRole: 'STORE_MANAGER',
      primaryActionLabel: 'Open KPI detail',
      secondaryActionLabel: 'Review exception',
      deepLink: '/admin/reports/kpis/snapshot-ops-1',
      historyPreview: 'Achievement 62%',
    },
    {
      itemType: 'acknowledgement',
      sourceType: 'checklist_receipt',
      sourceId: 'checklist-instance-ops-1',
      title: 'BM visit result',
      summary: 'Marmara Park completed checklist is waiting for acknowledgement.',
      companyId: '00000000-0000-0000-0000-000000000001',
      regionId: '00000000-0000-0000-0000-000000000010',
      storeId: '00000000-0000-0000-0000-000000000100',
      storeName: 'Marmara Park',
      workflowStatus: 'completed',
      inboxStatus: 'needs_attention',
      urgency: 'medium',
      createdAt: '2026-05-20T09:30:00.000Z',
      needsAttentionAt: '2026-05-20T09:30:00.000Z',
      actorRole: 'STORE_MANAGER',
      primaryActionLabel: 'Acknowledge',
      secondaryActionLabel: 'Open checklist receipt',
      deepLink: '/store/checklists?tab=inbox&result=checklist-instance-ops-1',
      historyPreview: 'BM score 82',
    },
  ],
  meta: {
    count: 3,
    total: 3,
    limit: 50,
    offset: 0,
  },
}

const kpiConfigFixture = {
  metadata: {
    kpiConfigVersionId: 'kpi-config-version-4',
    versionNo: 4,
    effectiveFrom: '2026-05-01',
    effectiveTo: null,
    publishedAt: '2026-05-20T12:00:00.000Z',
    publishedBy: 'operations-admin',
  },
  storeProfile: {
    targetAchievementWeight: 70,
    kpiPerformanceWeight: 20,
    bmChecklistWeight: 5,
    vmChecklistWeight: 5,
  },
  personnelProfile: {
    targetAchievementWeight: 70,
    kpiPerformanceWeight: 20,
    bmChecklistWeight: 5,
    vmChecklistWeight: 5,
  },
  ownershipMatrix: [],
  gradingBands: [],
}

const rankingsFixture = {
  source: {
    mode: 'live',
    periodType: 'monthly',
    periodStart: '2026-05-01',
    periodEnd: '2026-05-31',
  },
  access: {
    globalMode: 'full',
    canSeeGlobalDetails: true,
    canSeeManagedStorePersonnelDetails: true,
  },
  filters: {
    regionManagers: [],
    regions: [],
    stores: [],
  },
  reference: {
    store: {
      averageScore: 82,
      metrics: [],
    },
    personnel: {
      averageScore: 78,
      metrics: [],
    },
  },
  storeLeaderboard: {
    items: [],
    currentStore: null,
    meta: {
      total: 1,
      limit: 1,
      offset: 0,
    },
  },
  personnelLeaderboard: {
    items: [],
    currentEmployee: null,
    managedStorePersonnel: [],
    meta: {
      total: 42,
      limit: 1,
      offset: 0,
    },
  },
  availablePeriods: [
    {
      periodType: 'monthly',
      periodStart: '2026-05-01',
      periodEnd: '2026-05-31',
    },
    {
      periodType: 'monthly',
      periodStart: '2026-04-01',
      periodEnd: '2026-04-30',
    },
  ],
}

const sellerCodeRequestsFixture = {
  items: [
    {
      requestId: '55555555-5555-4555-8555-555555555555',
      companyId: '00000000-0000-0000-0000-000000000001',
      regionId: '00000000-0000-0000-0000-000000000010',
      storeId: '00000000-0000-0000-0000-000000000100',
      storeCode: 'MP001',
      storeName: 'Marmara Park',
      storeType: 'franchise',
      requestType: 'create_code',
      status: 'pending_hr_approval',
      firstName: 'Ayse',
      lastName: 'Yilmaz',
      nationalIdLast4: '8901',
      phoneNumber: '05551234567',
      hireDate: '2026-05-01',
      requestedPositionId: '44444444-4444-4444-8444-444444444444',
      positionCode: 'SALES_CONSULTANT',
      positionName: 'Sales Consultant',
      employmentType: 'full_time',
      requestedSellerCode: null,
      approvedSellerCode: null,
      lastReferenceSellerCode: 'FM8375',
      submittedByUserId: 'store-manager-1',
      reviewedByUserId: null,
      reviewedAt: null,
      reviewNote: null,
      employeeId: null,
      createdAt: '2026-04-27T12:00:00.000Z',
      updatedAt: '2026-04-27T12:00:00.000Z',
    },
  ],
  meta: {
    count: 1,
    total: 51,
    limit: 50,
    offset: 0,
  },
}

const offboardingRequestsFixture = {
  items: [
    {
      requestId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      companyId: '00000000-0000-0000-0000-000000000001',
      regionId: '00000000-0000-0000-0000-000000000010',
      storeId: '00000000-0000-0000-0000-000000000100',
      storeCode: 'MP001',
      storeName: 'Marmara Park',
      employeeId: '00000000-0000-0000-0000-000000000202',
      displayName: 'Store Personnel',
      externalEmployeeRef: 'FM8001',
      positionCode: 'SALES_CONSULTANT',
      positionName: 'Sales Consultant',
      status: 'pending_hr_approval',
      terminationDate: '2026-05-10',
      terminationReason: 'resignation',
      requestReason: 'Personel istifa etti',
      submittedByUserId: 'store-manager-1',
      reviewedByUserId: null,
      reviewedAt: null,
      reviewNote: null,
      createdAt: '2026-04-27T12:00:00.000Z',
      updatedAt: '2026-04-27T12:00:00.000Z',
    },
  ],
  meta: {
    count: 1,
    total: 53,
    limit: 50,
    offset: 0,
  },
}
