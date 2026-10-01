import { expect, test, type Page } from './test-fixtures'

const csrfToken = 'stale-upload-csrf-token'
const companyId = '00000000-0000-0000-0000-000000000001'

const authSession = {
  authMode: 'jwt',
  authenticated: true,
  user: {
    userId: 'integration-upload-cookie-user',
    employeeId: null,
    roleCodes: ['SUPER_ADMIN'],
    scope: {
      companyIds: [companyId],
      regionIds: [],
      storeIds: [],
    },
    readScope: {
      companyIds: [companyId],
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

test('admin Power BI upload routes stale cookie-session CSRF failures to session recovery', async ({
  page,
}) => {
  let uploadCsrfHeader = ''

  await installCookieSession(page)
  await routeAuthSession(page)
  await page.route('**/api/auth/browser-session/csrf', async (route) => {
    await route.fulfill({ status: 401, json: { message: 'Browser session has ended' } })
  })
  await page.route('**/api/auth/browser-session', async (route) => {
    await route.fulfill({ json: { cleared: true } })
  })
  await page.route('**/api/integrations/power-bi-export-upload', async (route) => {
    uploadCsrfHeader = route.request().headers()['x-csrf-token'] ?? ''
    await route.fulfill({
      status: 403,
      contentType: 'application/json',
      body: JSON.stringify({
        correlationId: 'csrf-upload-regression',
        errorCode: 'FORBIDDEN',
        message: 'CSRF token is required',
        path: '/api/integrations/power-bi-export-upload',
        statusCode: 403,
        timestamp: '2026-06-16T21:49:44.304Z',
      }),
    })
  })
  await page.goto('/admin/integrations')
  await page.locator('input[type="file"]').first().setInputFiles({
    name: 'personnel.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: Buffer.from('safe-test-upload'),
  })
  const sessionExpired = page.evaluate(
    () =>
      new Promise<{ path: string; status: number }>((resolve) => {
        window.addEventListener(
          'store-ops-session-expired',
          (event) => {
            const detail = (event as CustomEvent<{ path: string; status: number }>).detail
            resolve({ path: detail.path, status: detail.status })
          },
          { once: true },
        )
      }),
  )
  await page.getByRole('button', { name: /Power BI export/i }).click()

  await expect.poll(() => uploadCsrfHeader).toBe(csrfToken)
  await expect(sessionExpired).resolves.toEqual({
    path: '/integrations/power-bi-export-upload',
    status: 403,
  })
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as Window & { __storeOpsBrowserSessionCsrfToken?: string })
          .__storeOpsBrowserSessionCsrfToken ?? 'not-cleared',
      ),
    )
    .toBe('')
  await expect(page).toHaveURL(/\/auth\/login/)
})

test('admin Power BI upload success stays in the same document', async ({ page }) => {
  let uploadCount = 0
  let navigationCount = 0

  await installCookieSession(page)
  await routeAuthSession(page)
  await page.route('**/api/integrations/power-bi-export-upload', async (route) => {
    uploadCount += 1
    await route.fulfill({ json: createUploadSuccessResponse() })
  })

  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) {
      navigationCount += 1
    }
  })

  await page.goto('/admin/integrations')
  navigationCount = 0
  await page.evaluate(() => {
    ;(window as Window & { __powerBiUploadDocumentMarker?: string }).__powerBiUploadDocumentMarker =
      'same-document'
  })
  await page.locator('input[type="file"]').first().setInputFiles({
    name: 'personnel.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: Buffer.from('safe-test-upload'),
  })
  await page.getByRole('button', { name: /Power BI export/i }).click()

  await expect.poll(() => uploadCount).toBe(1)
  await expect(page.getByText('Power BI upload accepted')).toBeVisible()
  await expect(page).toHaveURL(/\/admin\/integrations$/)
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as Window & { __powerBiUploadDocumentMarker?: string })
            .__powerBiUploadDocumentMarker ?? '',
      ),
    )
    .toBe('same-document')
  expect(navigationCount).toBe(0)
})

test('temporary upload CSRF recovery keeps the session and allows a later retry', async ({ page }) => {
  let recoveryCount = 0, uploadCount = 0
  await installCookieSession(page)
  await routeAuthSession(page)
  await page.route('**/api/auth/browser-session/csrf', async (route) => {
    recoveryCount += 1
    await route.fulfill(recoveryCount === 1
      ? { status: 503, json: { message: 'Temporarily unavailable' } }
      : { json: { csrfToken: 'fresh-upload-csrf-token' } })
  })
  await page.route('**/api/integrations/power-bi-export-upload', async (route) => {
    uploadCount += 1
    await route.fulfill(route.request().headers()['x-csrf-token'] === 'fresh-upload-csrf-token'
      ? { json: createUploadSuccessResponse() }
      : { status: 403, json: { message: 'CSRF token is required' } })
  })
  await page.goto('/admin/integrations')
  await page.evaluate(() => {
    const state = window as Window & { __uploadExpiryEvents?: number }
    state.__uploadExpiryEvents = 0
    window.addEventListener('store-ops-session-expired', () => { state.__uploadExpiryEvents! += 1 })
  })
  await page.locator('input[type="file"]').first().setInputFiles({
    name: 'personnel.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: Buffer.from('safe-test-upload'),
  })
  await page.getByRole('button', { name: /Power BI export/i }).click()
  await expect(page.getByText('Session recovery is temporarily unavailable', { exact: true })).toBeVisible()
  await expect(page).toHaveURL(/\/admin\/integrations$/)
  expect(uploadCount).toBe(1)
  expect(await page.evaluate(() => (window as Window & { __uploadExpiryEvents?: number }).__uploadExpiryEvents)).toBe(0)
  expect(await page.evaluate(() => window.__storeOpsBrowserSessionCsrfToken)).toBe(csrfToken)
  await page.getByRole('button', { name: /Power BI export/i }).click()
  await expect(page.getByText('Power BI upload accepted')).toBeVisible()
  expect(uploadCount).toBe(3)
  expect(recoveryCount).toBe(2)
  await expect(page).toHaveURL(/\/admin\/integrations$/)
})

async function installCookieSession(page: Page) {
  await page.addInitScript(
    ({ csrfToken }) => {
      window.localStorage.setItem(
        'store-ops-admin-session',
        JSON.stringify({
          mode: 'bearer',
          browserSessionTransport: 'cookie',
          mockUserId: 'integration-upload-cookie-user',
          mockRoleCodes: 'SUPER_ADMIN',
          mockCompanyIds: '00000000-0000-0000-0000-000000000001',
          mockStoreIds: '',
          mockReadStoreIds: '',
          mockAssignedStoreIds: '',
          mockRegionIds: '',
          mockReadRegionIds: '',
          bearerToken: '',
          browserSessionKey: 'cookie-session-upload-regression',
        }),
      )
      window.__storeOpsBrowserSessionCsrfToken = csrfToken
    },
    { csrfToken },
  )
}

async function routeAuthSession(page: Page) {
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({ json: authSession })
  })
}

function createUploadSuccessResponse() {
  return {
    command: {
      status: 'created',
      message: 'Power BI upload accepted',
    },
    data: {
      batch: {
        batchId: 'batch-upload-success',
        status: 'queued',
      },
      summary: {
        periodMonth: '2026-05',
        periodType: 'monthly',
        periodStart: '2026-05-01',
        periodEnd: '2026-05-31',
        personnelRowsRead: 1,
        storeRowsRead: 0,
        canonicalRowCount: 1,
        personnelGrossSalesRows: 1,
        negativePersonnelRowsIgnored: 0,
        ignoredPersonnelRows: 0,
        ignoredStoreRows: 0,
        scopeExcludedPersonnelRows: 0,
        scopeExcludedStoreRows: 0,
        reconciliation: {
          comparedStoreCount: 0,
          balancedStoreCount: 0,
          warningStoreCount: 0,
          items: [],
        },
        mappingMode: 'external_id',
      },
    },
  }
}
