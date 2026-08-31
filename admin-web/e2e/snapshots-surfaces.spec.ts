import { expect, test, type Page } from './test-fixtures'
import { snapshotStatusGolden, type SnapshotStatusGoldenEntry } from './fixtures/snapshot-status-golden'

const legacyAdminSelector = [
  '.hero-panel',
  '.panel',
  '.metric-grid',
  '.metric-card',
  '.stacked-table',
  '.stacked-row',
  '.control-button',
  '.control-select',
  '.toolbar-cluster',
  '.panel-copy',
  '.page-stack',
  '.status-pill',
].join(',')

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('store-ops-app-locale', 'en')
    window.localStorage.setItem(
      'store-ops-admin-session',
      JSON.stringify({
        mode: 'mock',
        mockUserId: 'snapshot-surface-user',
        mockRoleCodes: 'SUPER_ADMIN,SNAPSHOT_OPERATOR',
        mockCompanyIds: '00000000-0000-0000-0000-000000000001',
        bearerToken: '',
      }),
    )
  })

  await routeSnapshotApi(page)
})

test('snapshot operations preserve status semantic golden on AdminSurface primitives', async ({ page }) => {
  await page.goto('/admin/snapshots')

  const main = page.getByRole('main')

  await expect(main.getByText('Snapshot Operations')).toBeVisible()
  await expect(main.getByRole('button', { name: 'Queue daily closure' })).toBeEnabled()
  await expect(main.getByRole('heading', { name: 'What to inspect first' })).toBeVisible()
  await expect(main.getByRole('heading', { name: 'Latest signal to open' })).toBeVisible()
  await expect(main.locator('[data-slot="table"]')).toHaveCount(1)

  for (const expected of snapshotStatusGolden) {
    const row = main.getByTestId(`snapshot-queue-row-${expected.snapshotRunId}`)
    await expect(row).toBeVisible()
    await expect(row).toContainText(expected.runStatusLabel)
    await expect(row).toContainText(expected.healthLabel)
    await expect(row.getByRole('link', { name: 'Open snapshot run' })).toHaveAttribute(
      'href',
      expected.detailHref,
    )

    if (expected.canRerun) {
      await expect(row.getByRole('button', { name: 'Rerun snapshot' })).toBeEnabled()
    } else {
      await expect(row.getByRole('button', { name: 'Rerun snapshot' })).toHaveCount(0)
    }
  }

  await expect(main.locator(legacyAdminSelector)).toHaveCount(0)
  await expectNoHorizontalOverflow(page)
})

test('snapshot detail preserves rerun and visibility semantics', async ({ page }) => {
  await page.goto('/admin/snapshots/snapshot-stuck-no-rerun')

  const main = page.getByRole('main')

  await expect(main.getByRole('link', { name: 'Back to snapshot operations' })).toHaveAttribute(
    'href',
    '/admin/snapshots',
  )
  await expect(main.getByRole('heading', { name: 'daily snapshot run' })).toBeVisible()
  await expect(main.getByText('Run status', { exact: true })).toBeVisible()
  await expect(main.getByText('failed').first()).toBeVisible()
  await expect(main.getByText('Health state', { exact: true })).toBeVisible()
  await expect(main.getByText('stuck').first()).toBeVisible()
  await expect(main.getByText('Can rerun', { exact: true })).toBeVisible()
  await expect(main.getByText('No').first()).toBeVisible()
  await expect(main.getByRole('button', { name: 'Rerun snapshot' })).toBeDisabled()
  await expect(main.getByText('Manual dependency review required.').first()).toBeVisible()
  await expect(main.getByText('snapshot-completed-reused')).toBeVisible()
  await expect(main.locator(legacyAdminSelector)).toHaveCount(0)
  await expectNoHorizontalOverflow(page)
})

test('snapshot needs-action export fetches every filtered server page before downloading', async ({ page }) => {
  const exportOffsets: number[] = []
  await page.unroute('**/api/snapshots/runs/needs-action?**')
  await page.route('**/api/snapshots/runs/needs-action?**', async (route) => {
    const url = new URL(route.request().url())
    const limit = Number(url.searchParams.get('limit') ?? '12')
    const offset = Number(url.searchParams.get('offset') ?? '0')
    if (limit === 200) {
      expect(url.searchParams.get('snapshotType')).toBe('daily')
      expect(url.searchParams.get('runStatus')).toBe('failed')
      exportOffsets.push(offset)
      const count = offset === 0 ? 200 : 1
      await route.fulfill({
        json: {
          items: Array.from({ length: count }, (_, index) => snapshotNeedsActionExportItem(offset + index)),
          meta: { count, total: 201, limit, offset, revision: '3'.repeat(64) },
        },
      })
      return
    }

    await route.fulfill({
      json: {
        items: [snapshotNeedsActionExportItem(0)],
        meta: { count: 1, total: 1, limit, offset },
      },
    })
  })

  await page.goto('/admin/snapshots')
  await page.getByLabel('Filter snapshot type').click()
  await page.getByRole('option', { name: 'daily' }).click()
  await page.getByLabel('Filter run status').click()
  await page.getByRole('option', { name: 'failed' }).click()

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export CSV' }).click()
  expect((await downloadPromise).suggestedFilename()).toBe('snapshot-needs-action.csv')
  await expect.poll(() => exportOffsets).toEqual([0, 200])
})

test('snapshot needs-action export refuses revision drift without downloading', async ({ page }) => {
  const exportOffsets: number[] = []
  await page.unroute('**/api/snapshots/runs/needs-action?**')
  await page.route('**/api/snapshots/runs/needs-action?**', async (route) => {
    const url = new URL(route.request().url())
    const limit = Number(url.searchParams.get('limit') ?? '12')
    const offset = Number(url.searchParams.get('offset') ?? '0')
    if (limit === 200) {
      exportOffsets.push(offset)
      const count = offset === 0 ? 200 : 1
      await route.fulfill({
        json: {
          items: Array.from({ length: count }, (_, index) => snapshotNeedsActionExportItem(offset + index)),
          meta: {
            count,
            total: 201,
            limit,
            offset,
            revision: offset === 0 ? '3'.repeat(64) : '4'.repeat(64),
          },
        },
      })
      return
    }

    await route.fulfill({
      json: {
        items: [snapshotNeedsActionExportItem(0)],
        meta: { count: 1, total: 1, limit, offset },
      },
    })
  })

  await page.goto('/admin/snapshots')

  let downloadCount = 0
  page.on('download', () => {
    downloadCount += 1
  })
  await page.getByRole('button', { name: 'Export CSV' }).click()
  await expect(page.getByText('CSV export failed; complete data could not be fetched.')).toBeVisible()
  await expect.poll(() => exportOffsets).toEqual([0, 200])
  expect(downloadCount).toBe(0)
})

test('snapshot audit export fetches every server page before downloading', async ({ page }) => {
  const exportOffsets: number[] = []
  await page.unroute('**/api/snapshots/runs/*/audit**')
  await page.route('**/api/snapshots/runs/*/audit**', async (route) => {
    const url = new URL(route.request().url())
    const limit = Number(url.searchParams.get('limit') ?? '20')
    const offset = Number(url.searchParams.get('offset') ?? '0')
    if (limit === 200) {
      exportOffsets.push(offset)
      const count = offset === 0 ? 200 : 1
      await route.fulfill({
        json: {
          items: Array.from({ length: count }, (_, index) => snapshotAuditItem(offset + index)),
          meta: { count, total: 201, limit, offset },
        },
      })
      return
    }

    await route.fulfill({
      json: {
        items: [snapshotAuditItem(0)],
        meta: { count: 1, total: 1, limit, offset },
      },
    })
  })

  await page.goto('/admin/snapshots/snapshot-stuck-no-rerun')

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export audit' }).click()
  expect((await downloadPromise).suggestedFilename()).toBe('snapshot-audit-snapshot-stuck-no-rerun.csv')
  await expect.poll(() => exportOffsets).toEqual([0, 200])
})

async function routeSnapshotApi(page: Page) {
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({ json: authSessionFixture })
  })

  await page.route('**/api/snapshots/runs/*', async (route) => {
    const snapshotRunId = route.request().url().split('/').at(-1) ?? ''
    const golden =
      snapshotStatusGolden.find((item) => item.snapshotRunId === snapshotRunId) ?? snapshotStatusGolden[0]
    await route.fulfill({ json: toSnapshotDetail(golden) })
  })

  await page.route('**/api/snapshots/runs/overview', async (route) => {
    await route.fulfill({ json: snapshotOverviewFixture })
  })

  await page.route('**/api/snapshots/daily-closure', async (route) => {
    await route.fulfill({ json: dailyClosureFixture })
  })

  await page.route('**/api/snapshots/runs/needs-action?**', async (route) => {
    await route.fulfill({
      json: {
        items: snapshotStatusGolden.map(toNeedsActionItem),
        meta: { count: snapshotStatusGolden.length, total: snapshotStatusGolden.length, limit: 12, offset: 0 },
      },
    })
  })

  await page.route('**/api/snapshots/runs/*/dependencies', async (route) => {
    const snapshotRunId = route.request().url().split('/').at(-2) ?? ''
    await route.fulfill({ json: toDependencies(snapshotRunId) })
  })

  await page.route('**/api/snapshots/runs/*/lineage', async (route) => {
    await route.fulfill({
      json: {
        snapshotRunId: 'snapshot-stuck-no-rerun',
        parent: null,
        children: [
          {
            snapshotRunId: 'snapshot-completed-reused',
            snapshotType: 'daily',
            runStatus: 'completed',
          },
        ],
      },
    })
  })

  await page.route('**/api/snapshots/runs/*/audit**', async (route) => {
    await route.fulfill({
      json: {
        items: [
          {
            eventLogId: 'snapshot-event-1',
            occurredAt: '2026-05-06T02:00:00.000Z',
            actorUserId: 'snapshot-operator',
            correlationId: 'snapshot-correlation-1',
            eventType: 'snapshot.failed',
            metadata: {},
          },
        ],
        meta: { count: 1, total: 1, limit: 50, offset: 0 },
      },
    })
  })

}

async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth))
    .toBe(true)
}

function toNeedsActionItem(item: SnapshotStatusGoldenEntry) {
  return {
    snapshotRunId: item.snapshotRunId,
    snapshotDate: '2026-05-06',
    snapshotType: 'daily',
    periodStart: '2026-05-06',
    periodEnd: '2026-05-06',
    runStatus: item.runStatus,
    healthState: item.healthState,
    generatedAt: '2026-05-06T02:00:00.000Z',
    generatedBy: 'snapshot-operator',
    startedAt: '2026-05-06T02:01:00.000Z',
    finishedAt: item.runStatus === 'running' ? null : '2026-05-06T02:03:00.000Z',
    failureReason: item.runStatus === 'failed' ? 'Fixture dependency failed' : null,
    rerunOfSnapshotRunId: null,
    kpiConfigVersion: {
      kpiConfigVersionId: '11111111-1111-4111-8111-111111111111',
      versionNo: 7,
      state: 'versioned',
    },
    actionReason: item.healthState === 'stuck' ? 'Manual dependency review required.' : 'Dependency can be reviewed safely.',
    recommendedAction: item.canRerun ? 'Rerun the snapshot after dependency recovery.' : 'Open the run detail before taking action.',
    canRerun: item.canRerun,
    rerunCount: item.canRerun ? 1 : 0,
    latestRerunSnapshotRunId: item.snapshotRunId === 'snapshot-completed-reused' ? 'snapshot-reused-child' : null,
    isStuck: item.healthState === 'stuck',
  }
}

function toSnapshotDetail(item: SnapshotStatusGoldenEntry) {
  return {
    snapshotRun: {
      ...toNeedsActionItem(item),
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
    canRerun: item.canRerun,
    rerunAllowed: true,
    rerunBlockedReason: item.canRerun ? null : 'Manual dependency review required.',
    rerunCount: item.canRerun ? 1 : 0,
    latestRerunSnapshotRunId: item.snapshotRunId === 'snapshot-completed-reused' ? 'snapshot-reused-child' : null,
    failureReason: item.runStatus === 'failed' ? 'Fixture dependency failed' : null,
  }
}

function toDependencies(snapshotRunId: string) {
  const canRerun = snapshotRunId === 'snapshot-failed-rerun'
  return {
    snapshotRunId,
    runStatus: canRerun ? 'failed' : 'running',
    rerunAllowed: true,
    rerunBlockedReason: canRerun ? null : 'Manual dependency review required.',
    checks: [
      {
        code: 'source-ready',
        status: canRerun ? 'pass' : 'fail',
        message: canRerun ? 'Source dependency recovered.' : 'Manual dependency review required.',
      },
    ],
  }
}

function snapshotAuditItem(index: number) {
  return {
    eventLogId: `snapshot-export-event-${index}`,
    occurredAt: '2026-05-06T02:00:00.000Z',
    actorUserId: 'snapshot-operator',
    correlationId: `snapshot-export-correlation-${index}`,
    eventType: 'snapshot.failed',
    metadata: {},
  }
}

function snapshotNeedsActionExportItem(index: number) {
  return {
    snapshotRunId: `snapshot-export-${index}`,
    snapshotDate: '2026-05-06',
    snapshotType: 'daily',
    periodStart: '2026-05-06',
    periodEnd: '2026-05-06',
    runStatus: 'failed',
    healthState: 'needs_action',
    generatedAt: '2026-05-06T02:00:00.000Z',
    generatedBy: 'snapshot-operator',
    startedAt: '2026-05-06T02:01:00.000Z',
    finishedAt: '2026-05-06T02:03:00.000Z',
    failureReason: 'Fixture dependency failed',
    rerunOfSnapshotRunId: null,
    kpiConfigVersion: {
      kpiConfigVersionId: '11111111-1111-4111-8111-111111111111',
      versionNo: 7,
      state: 'versioned',
    },
    actionReason: 'Review required',
    recommendedAction: 'Open the run detail before taking action.',
    canRerun: true,
    rerunCount: 0,
    latestRerunSnapshotRunId: null,
    isStuck: false,
  }
}

const authSessionFixture = {
  authMode: 'mock',
  authenticated: true,
  user: {
    userId: 'snapshot-surface-user',
    employeeId: null,
    roleCodes: ['SUPER_ADMIN', 'SNAPSHOT_OPERATOR'],
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

const snapshotOverviewFixture = {
  totals: {
    all: 4,
    queued: 0,
    running: 1,
    completed: 1,
    failed: 2,
  },
  healthTotals: {
    healthy: 0,
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
    completedSnapshotRunId: 'snapshot-completed-reused',
    failedSnapshotRunId: 'snapshot-failed-rerun',
    inProgressSnapshotRunId: 'snapshot-running',
    stuckSnapshotRunId: 'snapshot-stuck-no-rerun',
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
