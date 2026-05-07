import { expect, test, type Page } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'store-ops-admin-session',
      JSON.stringify({
        mode: 'mock',
        mockUserId: 'admin-routing-user',
        mockRoleCodes: 'SUPER_ADMIN,INTEGRATION_ADMIN,HR_ADMIN,REPORT_VIEWER,AUDITOR',
        mockCompanyIds: '00000000-0000-0000-0000-000000000001',
        bearerToken: '',
      }),
    )
  })

  await routeAdminShellApi(page)
})

test('session nav opens the session readiness surface for ready admin sessions', async ({ page }) => {
  await page.goto('/admin/session')

  await expect(page).toHaveURL(/\/admin\/session$/)
  await expect(page.getByRole('heading', { name: /Prepare the shell for real auth/i })).toBeVisible()
})

test('admin shell switches chrome to English copy and persists locale', async ({ page }) => {
  await page.goto('/admin/audit')

  await expect(page.getByText('Mağaza Operasyon Kontrol')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Entegrasyonlar' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Ana Veri' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Denetim' })).toBeVisible()
  await expect(page.getByText('Üretim UX ve gerçek kimlik')).toBeVisible()
  await expect(page.getByText('Store Ops Control')).toHaveCount(0)
  await expect(page.locator('body')).not.toContainText('Ã')
  await expect(page.locator('body')).not.toContainText('Ä')
  await expect(page.locator('body')).not.toContainText('Å')

  await page.locator('.language-toggle-button').filter({ hasText: 'EN' }).click()

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByText('Store Ops Control')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Integrations' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Master Data' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Audit' })).toBeVisible()
  await expect(page.getByText('Production UX And Real Auth')).toBeVisible()
  await expect(page.getByText('Mağaza Operasyon Kontrol')).toHaveCount(0)

  await page.reload()

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByText('Store Ops Control')).toBeVisible()
})

test('audit center user detail links stay inside the audit namespace', async ({ page }) => {
  await page.goto('/admin/audit')

  const userAuditLink = page.locator('a[href$="/users/user-1/audit"]').first()
  await expect(userAuditLink).toHaveAttribute('href', '/admin/audit/users/user-1/audit')
  await userAuditLink.click()

  await expect(page).toHaveURL(/\/admin\/audit\/users\/user-1\/audit$/)
  await expect(page.getByRole('heading', { name: /User account audit trail/i })).toBeVisible()
  await expect(page.getByRole('link', { name: /Back to audit center/i })).toBeVisible()
})

test('audit center switches chrome to English copy and persists locale', async ({ page }) => {
  await page.goto('/admin/audit')

  await expect(page.getByRole('heading', { name: 'Denetim merkezi' })).toBeVisible()
  await expect(page.getByText('Son görünür olaylar')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Hesap denetim kayıtları' })).toBeVisible()
  await expect(page.getByText('Audit Center')).toHaveCount(0)
  await expect(page.locator('body')).not.toContainText('Ã')
  await expect(page.locator('body')).not.toContainText('Ä')
  await expect(page.locator('body')).not.toContainText('Å')

  await page.locator('.language-toggle-button').filter({ hasText: 'EN' }).click()

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('heading', { name: 'Audit Center' })).toBeVisible()
  await expect(page.getByText('Recent trace')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Recent account audit entries' })).toBeVisible()
  await expect(page.getByText('Denetim merkezi')).toHaveCount(0)

  await page.reload()

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('heading', { name: 'Audit Center' })).toBeVisible()
})

test('master data list renders bootstrap batches when updatedAt is absent', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', (error) => {
    pageErrors.push(error.message)
  })

  await page.goto('/admin/master-data')

  await expect(page.getByRole('heading', { name: 'Hazırlık partileri' })).toBeVisible()
  await expect(page.getByText('Accepted personnel baseline')).toBeVisible()
  expect(pageErrors).toEqual([])
})

test('master data page switches chrome to English copy and persists locale', async ({ page }) => {
  await page.goto('/admin/master-data')

  await expect(page.getByRole('heading', { name: 'Ana veri hazırlığı' })).toBeVisible()
  await expect(page.getByText('İnceleme kuyruğu')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Hazırlık partileri' })).toBeVisible()
  await expect(page.getByText('Master data bootstrap')).toHaveCount(0)
  await expect(page.locator('body')).not.toContainText('Ã')
  await expect(page.locator('body')).not.toContainText('Ä')
  await expect(page.locator('body')).not.toContainText('Å')

  await page.locator('.language-toggle-button').filter({ hasText: 'EN' }).click()

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('heading', { name: 'Master data bootstrap' })).toBeVisible()
  await expect(page.getByText('Review queue')).toBeVisible()
  await expect(
    page.getByText(
      'Open a batch to inspect row evidence, dry-run evidence, readiness counters, and promotion state.',
    ),
  ).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Bootstrap batches' })).toBeVisible()
  await expect(page.getByText('Ana veri hazırlığı')).toHaveCount(0)

  await page.reload()

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('heading', { name: 'Master data bootstrap' })).toBeVisible()
})

test('admin checklist templates page switches chrome to English copy and persists locale', async ({ page }) => {
  await page.goto('/admin/checklists')

  await expect(page.getByRole('main').getByText('Checklistler', { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'HR şablonları, yayınlanmadan önce taslak olarak hazırlanır.' })).toBeVisible()
  await expect(page.getByText('Taslak pilot')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Şablon durumu' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Yayın kuralı' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'HR checklist şablon yönetimi' })).toBeVisible()
  await expect(page.getByText('Form editörü sıradaki küçük parça')).toBeVisible()
  await expect(page.getByText('Checklists')).toHaveCount(0)
  await expect(page.locator('body')).not.toContainText('Ãƒ')
  await expect(page.locator('body')).not.toContainText('Ã„')
  await expect(page.locator('body')).not.toContainText('Ã…')

  await page.locator('.language-toggle-button').filter({ hasText: 'EN' }).click()

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('main').getByText('Checklists', { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'HR templates are drafted before publication.' })).toBeVisible()
  await expect(page.getByText('Draft pilot')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Template status' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Publish rule' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'HR checklist template management' })).toBeVisible()
  await expect(page.getByText('Form editor is the next small slice')).toBeVisible()
  await expect(page.getByText('Checklistler')).toHaveCount(0)

  await page.reload()

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('heading', { name: 'HR templates are drafted before publication.' })).toBeVisible()
})

test('snapshot operations page switches chrome to English copy and persists locale', async ({ page }) => {
  await page.goto('/admin/snapshots')

  await expect(page.getByText('Snapshot operasyonları')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Değişmez çalışmalar yeniden çalıştırmadan önce görünür olmalı.' })).toBeVisible()
  await expect(page.getByText('Günlük kapanış', { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Dün değişmez tarihe dönüşmeli' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Operatör ilgisi isteyen çalışmalar' })).toBeVisible()
  await expect(page.getByPlaceholder('Çalışma, tip, gerekçe veya durum ara')).toBeVisible()
  await expect(page.getByText('Snapshot Operations')).toHaveCount(0)
  await expect(page.locator('body')).not.toContainText('Ãƒ')
  await expect(page.locator('body')).not.toContainText('Ã„')
  await expect(page.locator('body')).not.toContainText('Ã…')

  await page.locator('.language-toggle-button').filter({ hasText: 'EN' }).click()

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByText('Snapshot Operations')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Immutable runs need visibility before they need reruns.' })).toBeVisible()
  await expect(page.getByText('Daily closure', { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Yesterday should become immutable history' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Runs needing operator attention' })).toBeVisible()
  await expect(page.getByPlaceholder('Search by run, type, reason, or state')).toBeVisible()
  await expect(page.getByText('Snapshot operasyonları')).toHaveCount(0)

  await page.reload()

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('heading', { name: 'Immutable runs need visibility before they need reruns.' })).toBeVisible()
})

test('snapshot run detail page switches chrome to English copy and persists locale', async ({ page }) => {
  await page.goto('/admin/snapshots/snapshot-run-1')

  await expect(page.getByRole('link', { name: 'Snapshot operasyonlarına dön' })).toBeVisible()
  await expect(page.getByText('Snapshot çalışma detayı')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Günlük snapshot çalışması' })).toBeVisible()
  await expect(page.getByText('Toplam rapor satırı')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Çalışma özeti' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Bağımlılıklar ve kontroller' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Materialize edilen rapor kesitleri' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Operatör izi' })).toBeVisible()
  await expect(page.getByText('Snapshot Run Detail')).toHaveCount(0)
  await expect(page.locator('body')).not.toContainText('Ãƒ')
  await expect(page.locator('body')).not.toContainText('Ã„')
  await expect(page.locator('body')).not.toContainText('Ã…')

  await page.locator('.language-toggle-button').filter({ hasText: 'EN' }).click()

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('link', { name: 'Back to snapshot operations' })).toBeVisible()
  await expect(page.getByText('Snapshot Run Detail')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'daily snapshot run' })).toBeVisible()
  await expect(page.getByText('Total report rows')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Run summary' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Dependencies and checks' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Materialized report slices' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Operator-visible trace' })).toBeVisible()
  await expect(page.getByText('Snapshot çalışma detayı')).toHaveCount(0)

  await page.reload()

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('heading', { name: 'daily snapshot run' })).toBeVisible()
})

async function routeAdminShellApi(page: Page) {
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({ json: authSessionFixture })
  })

  await page.route('**/api/auth/users?**', async (route) => {
    await route.fulfill({
      json: {
        items: [
          {
            userId: 'user-1',
            employeeId: null,
            username: 'admin.user',
            email: 'admin@example.com',
            authProvider: 'oidc',
            providerSubject: 'provider-user-1',
            isActive: true,
            lastLoginAt: null,
            createdAt: '2026-05-01T09:00:00.000Z',
          },
        ],
        meta: { count: 1, total: 1, limit: 50, offset: 0 },
      },
    })
  })

  await page.route('**/api/auth/role-assignments?**', async (route) => {
    await route.fulfill({ json: emptyListFixture })
  })

  await page.route('**/api/auth/users/user-1/audit', async (route) => {
    await route.fulfill({ json: emptyListFixture })
  })

  await page.route('**/api/integrations/import-batches/needs-action?**', async (route) => {
    await route.fulfill({ json: emptyListFixture })
  })

  await page.route('**/api/snapshots/runs/overview', async (route) => {
    await route.fulfill({ json: snapshotOverviewFixture })
  })

  await page.route('**/api/snapshots/daily-closure', async (route) => {
    await route.fulfill({ json: dailyClosureFixture })
  })

  await page.route('**/api/snapshots/runs/needs-action?**', async (route) => {
    await route.fulfill({ json: snapshotNeedsActionFixture })
  })

  await page.route('**/api/snapshots/runs/snapshot-run-1/dependencies', async (route) => {
    await route.fulfill({ json: snapshotDependenciesFixture })
  })

  await page.route('**/api/snapshots/runs/snapshot-run-1/lineage', async (route) => {
    await route.fulfill({ json: snapshotLineageFixture })
  })

  await page.route('**/api/snapshots/runs/snapshot-run-1/audit', async (route) => {
    await route.fulfill({ json: snapshotAuditFixture })
  })

  await page.route('**/api/snapshots/runs/snapshot-run-1', async (route) => {
    await route.fulfill({ json: snapshotDetailFixture })
  })

  await page.route('**/api/integrations/master-data-bootstrap/batches?**', async (route) => {
    await route.fulfill({
      json: {
        items: [
          {
            batchId: '8a1506af-b043-4968-9d75-d10c8d4432d5',
            companyId: '00000000-0000-0000-0000-000000000001',
            bootstrapEntity: 'personnel',
            sourceLabel: 'Accepted personnel baseline',
            fileReference: 'personnel-master-mapping-prep.xlsx#chunk-9',
            uploadedByUserId: 'admin-routing-user',
            batchStatus: 'promoted',
            rowCount: 5,
            pendingCount: 0,
            validCount: 0,
            needsReviewCount: 0,
            invalidCount: 0,
            promotedCount: 5,
            createdAt: '2026-05-04T11:51:26.982Z',
            validatedAt: '2026-05-04T11:51:27.289Z',
            promotedAt: '2026-05-04T11:52:42.761Z',
            readiness: 'closed',
            nextAction: 'closed',
          },
        ],
        meta: { count: 1, total: 10, limit: 1, offset: 0 },
      },
    })
  })
}

const authSessionFixture = {
  authMode: 'mock',
  authenticated: true,
  user: {
    userId: 'admin-routing-user',
    employeeId: null,
    roleCodes: ['SUPER_ADMIN', 'INTEGRATION_ADMIN', 'HR_ADMIN', 'REPORT_VIEWER', 'AUDITOR'],
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

const emptyListFixture = {
  items: [],
  meta: {
    count: 0,
    total: 0,
    limit: 50,
    offset: 0,
  },
}

const snapshotOverviewFixture = {
  totals: {
    all: 4,
    queued: 1,
    running: 1,
    completed: 1,
    failed: 1,
  },
  healthTotals: {
    healthy: 1,
    inProgress: 1,
    retryReady: 1,
    needsAction: 0,
    stuck: 1,
  },
  actionTotals: {
    retryReady: 1,
    stuck: 1,
  },
  latest: {
    completedSnapshotRunId: 'snapshot-completed-1',
    failedSnapshotRunId: 'snapshot-run-1',
    inProgressSnapshotRunId: 'snapshot-running-1',
    stuckSnapshotRunId: 'snapshot-stuck-1',
  },
}

const dailyClosureFixture = {
  automationEnabled: true,
  automationPollMinutes: 15,
  timezone: 'Europe/Istanbul',
  referenceAt: '2026-05-07T09:00:00.000Z',
  localDate: '2026-05-07',
  closureDate: '2026-05-06',
  healthState: 'retry_ready',
  dueNow: true,
  canQueue: true,
  canRerun: false,
  recommendedAction: 'Queue the daily closure for yesterday.',
  existingSnapshotRunId: null,
  existingRunStatus: null,
  existingFailureReason: null,
  existingGeneratedAt: null,
}

const snapshotNeedsActionFixture = {
  items: [
    {
      snapshotRunId: 'snapshot-run-1',
      snapshotDate: '2026-05-06',
      snapshotType: 'daily',
      periodStart: '2026-05-06',
      periodEnd: '2026-05-06',
      runStatus: 'failed',
      healthState: 'retry_ready',
      generatedAt: '2026-05-06T02:00:00.000Z',
      generatedBy: 'admin-routing-user',
      startedAt: '2026-05-06T02:01:00.000Z',
      finishedAt: '2026-05-06T02:03:00.000Z',
      failureReason: 'Fixture dependency failed',
      rerunOfSnapshotRunId: null,
      kpiConfigVersion: {
        kpiConfigVersionId: '11111111-1111-4111-8111-111111111111',
        versionNo: 7,
        state: 'versioned',
      },
      actionReason: 'Dependency can be retried safely.',
      recommendedAction: 'Rerun the snapshot after dependency recovery.',
      canRerun: true,
      rerunCount: 1,
      latestRerunSnapshotRunId: null,
      isStuck: false,
    },
  ],
  meta: { count: 1, total: 1, limit: 12, offset: 0 },
}

const snapshotDetailFixture = {
  snapshotRun: {
    snapshotRunId: 'snapshot-run-1',
    snapshotDate: '2026-05-06',
    snapshotType: 'daily',
    periodStart: '2026-05-06',
    periodEnd: '2026-05-06',
    runStatus: 'failed',
    healthState: 'retry_ready',
    generatedAt: '2026-05-06T02:00:00.000Z',
    generatedBy: 'admin-routing-user',
    startedAt: '2026-05-06T02:01:00.000Z',
    finishedAt: '2026-05-06T02:03:00.000Z',
    failureReason: 'Fixture dependency failed',
    rerunOfSnapshotRunId: null,
    kpiConfigVersion: {
      kpiConfigVersionId: '11111111-1111-4111-8111-111111111111',
      versionNo: 7,
      state: 'versioned',
    },
  },
  cards: {
    workforceRows: 12,
    kpiRows: 24,
    checklistRows: 6,
    turnoverRows: 3,
  },
  canRerun: true,
  rerunAllowed: true,
  rerunBlockedReason: null,
  rerunCount: 1,
  latestRerunSnapshotRunId: null,
  failureReason: 'Fixture dependency failed',
}

const snapshotDependenciesFixture = {
  snapshotRunId: 'snapshot-run-1',
  runStatus: 'failed',
  rerunAllowed: true,
  rerunBlockedReason: null,
  checks: [
    {
      code: 'source-ready',
      status: 'pass',
      message: 'Source dependency recovered.',
    },
  ],
}

const snapshotLineageFixture = {
  snapshotRunId: 'snapshot-run-1',
  parent: null,
  children: [],
}

const snapshotAuditFixture = {
  items: [
    {
      eventLogId: 'event-1',
      occurredAt: '2026-05-06T02:00:00.000Z',
      actorUserId: 'admin-routing-user',
      correlationId: 'correlation-1',
      eventType: 'snapshot.failed',
      metadata: {},
    },
  ],
  meta: { count: 1, total: 1, limit: 50, offset: 0 },
}
