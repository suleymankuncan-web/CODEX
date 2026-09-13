import { expect, test } from './test-fixtures'

const storeId = '00000000-0000-4000-8000-000000000100'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'store-ops-admin-session',
      JSON.stringify({
        mode: 'mock',
        mockUserId: 'bounded-target-queue-user',
        mockRoleCodes: 'SUPER_ADMIN',
        mockCompanyIds: '00000000-0000-4000-8000-000000000001',
        bearerToken: '',
      }),
    )
  })
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({
      json: {
        authMode: 'mock',
        authenticated: true,
        user: {
          userId: 'bounded-target-queue-user',
          roleCodes: ['SUPER_ADMIN'],
          scope: { companyIds: ['00000000-0000-4000-8000-000000000001'], regionIds: [], storeIds: [] },
          readScope: { companyIds: ['00000000-0000-4000-8000-000000000001'], regionIds: [], storeIds: [] },
          actionScope: { assignedStoreIds: [storeId] },
          assignedStoreIds: [storeId],
        },
        scopeSummary: { companyCount: 1, regionCount: 0, storeCount: 0, assignedStoreCount: 1 },
      },
    })
  })
})

test('admin target queues stay bounded and Store approvals load one complete paged workspace', async ({ page }) => {
  const targetCalls: URL[] = []
  await page.route('**/api/target-distributions/requests**', async (route) => {
    const requestUrl = new URL(route.request().url())
    targetCalls.push(requestUrl)
    await route.fulfill({
      json: {
        items: [],
        meta: {
          count: 0,
          total: requestUrl.searchParams.get('status') === 'approved' ? 10_000 : 0,
          limit: Number(requestUrl.searchParams.get('limit')),
          offset: Number(requestUrl.searchParams.get('offset')),
        },
      },
    })
  })
  await page.route('**/api/target-distributions/coverage**', async (route) => {
    await route.fulfill({
      json: {
        items: [],
        meta: { count: 0, total: 0, limit: 50, offset: 0 },
        summary: {
          requestMonth: '2026-07-01',
          totalEmployees: 0,
          coveredEmployees: 0,
          missingEmployees: 0,
          pendingEmployees: 0,
          conflictEmployees: 0,
          staleEmployees: 0,
          uncoveredEmployees: 0,
          coverageRate: 0,
        },
      },
    })
  })

  await page.goto('/admin/targets')
  await expect(page.getByRole('heading', { name: 'Bekleyen hedef dağıtım talepleri' })).toBeVisible()

  expect(targetCalls).toHaveLength(2)
  expect(targetCalls.map((url) => url.searchParams.toString()).sort()).toEqual([
    'status=approved&limit=5&offset=0',
    'status=pending_region_approval&limit=50&offset=0',
  ])

  const ledgerCalls: URL[] = []
  const ledgerItems = Array.from({ length: 20 }, (_, index) => ({
    requestId: `request-${String(index + 1).padStart(2, '0')}`,
    requestType: 'target',
    storeId,
    storeName: `Store ${index + 1}`,
    regionId: '00000000-0000-4000-8000-000000000010',
    regionName: 'Pilot Region',
    regionManagerNames: ['Pilot Manager'],
    status: 'pending_region_approval',
    createdAt: `2026-07-${String(20 - index).padStart(2, '0')}T09:00:00.000Z`,
    reviewedAt: null,
    updatedAt: `2026-07-${String(20 - index).padStart(2, '0')}T09:00:00.000Z`,
    waitingSince: `2026-07-${String(20 - index).padStart(2, '0')}T09:00:00.000Z`,
    nextOwner: 'region',
    dueAt: `2026-07-${String(22 - index).padStart(2, '0')}T09:00:00.000Z`,
    isOverdue: false,
    events: [],
    eventTotal: 0,
    targetLabel: `Target ${index + 1}`,
    requestMonth: '2026-07-01',
    allocationCount: 2,
    approvalMode: null,
    personDisplayName: null,
    nationalIdLast4: null,
    externalEmployeeRef: null,
  }))
  await page.route('**/api/workflow/request-center**', async (route) => {
    const requestUrl = new URL(route.request().url())
    ledgerCalls.push(requestUrl)
    const limit = Number(requestUrl.searchParams.get('limit'))
    const offset = Number(requestUrl.searchParams.get('offset'))
    const isOpenBucket = requestUrl.searchParams.get('bucket') === 'open'
    const sourceItems = isOpenBucket ? ledgerItems : []
    await route.fulfill({
      json: {
        items: sourceItems.slice(offset, offset + limit),
        meta: { count: Math.max(0, Math.min(limit, sourceItems.length - offset)), total: sourceItems.length, limit, offset },
        summary: { open: 20, done: 0, returned: 0, overdue: 0, periods: ['2026-07'] },
      },
    })
  })

  await page.goto('/store/approvals')
  await expect(page.getByTestId('store-approvals-ledger')).toBeVisible()
  expect(ledgerCalls).toHaveLength(2)
  expect(ledgerCalls.map((url) => url.searchParams.get('bucket')).sort()).toEqual(['done', 'open'])
  expect(ledgerCalls.every((url) => url.searchParams.get('limit') === '200')).toBe(true)
  expect(ledgerCalls.every((url) => url.searchParams.get('offset') === '0')).toBe(true)

  await page.getByRole('button', { name: 'Sonraki sayfa' }).click()
  await expect(page.locator('[data-testid="store-approvals-request-row"]:visible')).toHaveCount(5)
  expect(ledgerCalls).toHaveLength(2)
})
