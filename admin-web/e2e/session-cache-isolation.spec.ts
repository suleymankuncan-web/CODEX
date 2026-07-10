import { expect, test } from './test-fixtures'

const companyId = '00000000-0000-0000-0000-000000000001'

test('persona switch never renders the prior identity protected cache', async ({ page }) => {
  let userBSessionRequests = 0
  let userBOverviewRequests = 0
  let releaseUserBOverview = () => undefined
  const userBOverviewGate = new Promise<void>((resolve) => {
    releaseUserBOverview = resolve
  })

  await page.addInitScript(({ companyId }) => {
    window.localStorage.setItem(
      'store-ops-admin-session',
      JSON.stringify({
        mode: 'mock',
        browserSessionTransport: 'bearer',
        mockUserId: 'persona-a',
        mockRoleCodes: 'SUPER_ADMIN',
        mockCompanyIds: companyId,
        mockStoreIds: '',
        mockReadStoreIds: '',
        mockAssignedStoreIds: '',
        mockRegionIds: '',
        mockReadRegionIds: '',
        bearerToken: '',
        browserSessionKey: '',
      }),
    )
  }, { companyId })

  await page.route('**/api/auth/session', async (route) => {
    const userId = route.request().headers()['x-user-id'] ?? 'persona-a'
    if (userId === 'persona-b') {
      userBSessionRequests += 1
    }

    await route.fulfill({ json: authSession(userId) })
  })

  await page.route('**/api/integrations/import-batches/overview', async (route) => {
    const userId = route.request().headers()['x-user-id'] ?? 'persona-a'
    if (userId === 'persona-b') {
      userBOverviewRequests += 1
      await userBOverviewGate
    }

    await route.fulfill({ json: overview(userId === 'persona-b' ? 222 : 111) })
  })

  await page.route('**/api/integrations/import-batches/needs-action**', async (route) => {
    await route.fulfill({
      json: { items: [], meta: { count: 0, total: 0, limit: 12, offset: 0 } },
    })
  })
  await page.route('**/api/integrations/lookups', async (route) => {
    await route.fulfill({
      json: { activeSources: [], meta: { totalEntityTypes: 0, totalActiveSources: 0 } },
    })
  })
  await page.route('**/api/integrations/import-payload-templates**', async (route) => {
    await route.fulfill({
      json: { entityType: 'kpi', sourceSystem: 'power_bi', requestBody: { rows: [] } },
    })
  })

  await page.goto('/admin/integrations')
  await expect(page.getByText(/111$/)).toBeVisible()

  await page.evaluate(() => {
    window.history.pushState(null, '', '/admin/session')
    window.dispatchEvent(new PopStateEvent('popstate'))
  })
  await page.getByLabel(/Kullan|User/).fill('persona-b')
  await page.getByRole('button', { name: /kaydet|Save/i }).click()

  await expect.poll(() => userBSessionRequests).toBeGreaterThan(0)

  await page.evaluate(() => {
    window.history.pushState(null, '', '/admin/integrations')
    window.dispatchEvent(new PopStateEvent('popstate'))
  })

  expect(await page.getByText(/111$/).count()).toBe(0)
  await expect.poll(() => userBOverviewRequests).toBeGreaterThan(0)
  releaseUserBOverview()
  await expect(page.getByText(/222$/)).toBeVisible()
})

function authSession(userId: string) {
  return {
    authMode: 'mock',
    authenticated: true,
    user: {
      userId,
      employeeId: null,
      displayName: null,
      username: null,
      email: null,
      roleCodes: ['SUPER_ADMIN'],
      scope: { companyIds: [companyId], regionIds: [], storeIds: [] },
      readScope: { companyIds: [companyId], regionIds: [], storeIds: [] },
      actionScope: { assignedStoreIds: [], assignedStoreTypes: [] },
      assignedStoreIds: [],
    },
    scopeSummary: {
      companyCount: 1,
      regionCount: 0,
      storeCount: 0,
      assignedStoreCount: 0,
    },
  }
}

function overview(total: number) {
  return {
    totals: {
      all: total,
      completed: 0,
      failed: 0,
      completedWithErrors: 0,
      pending: 0,
      queued: 0,
      processing: 0,
    },
    healthTotals: {
      healthy: 0,
      inProgress: 0,
      blocked: 0,
      retryReady: 0,
      needsAction: 0,
      stuck: 0,
    },
    actionTotals: { blocked: 0, retryReady: 0, needsAction: 0, stuck: 0 },
    latest: {
      completedBatchId: null,
      failedBatchId: null,
      inProgressBatchId: null,
      stuckBatchId: null,
    },
  }
}
