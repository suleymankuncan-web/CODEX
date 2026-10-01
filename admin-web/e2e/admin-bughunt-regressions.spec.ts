import { expect, test, type Page } from './test-fixtures'
import { routeAuthManagementApi } from './auth-management-test-fixtures'

test.beforeEach(async ({ page }) => {
  await page.route('**/api/**', route => route.fulfill({ status: 503, json: { message: 'Unmodeled synthetic API read' } }))
  await page.addInitScript(() => {
    localStorage.setItem('store-ops-app-locale', 'tr')
    localStorage.setItem('store-ops-admin-session', JSON.stringify({
      mode: 'mock', mockUserId: 'super-admin-auth-user', mockRoleCodes: 'SUPER_ADMIN,HR_ADMIN',
      mockCompanyIds: 'company-1', bearerToken: '',
    }))
  })
  await routeAuthManagementApi(page)
})

async function routeCapabilities(page: Page) {
  const revoked = new Set<string>()
  const writes: Array<{ assignmentId: string; reason: string }> = []
  await page.route('**/api/auth/user-permission-assignments?**', route => route.fulfill({ json: {
    items: ['capability-a', 'capability-b'].map((assignmentId, index) => ({
      assignmentId, roleAssignmentId: 'viewer-role', userId: 'user-active', roleCode: 'REPORT_VIEWER',
      permissionCode: index === 0 ? 'INCENTIVE_SALES_DIRECTOR_APPROVAL' : 'INCENTIVE_GENERAL_MANAGER_APPROVAL',
      resourceName: 'incentive', actionName: 'approve', scopeType: 'company', companyId: 'company-1',
      regionId: null, storeId: null, startsAt: '2026-01-01T00:00:00Z', endsAt: null,
      grantReason: 'Synthetic fixture', createdAt: '2026-01-01T00:00:00Z',
      revokedAt: revoked.has(assignmentId) ? '2026-05-15T10:00:00Z' : null,
      revokeReason: revoked.has(assignmentId) ? 'Fresh reason for A' : null,
    })), meta: { count: 2, total: 2, limit: 200, offset: 0 },
  } }))
  await page.route('**/api/auth/user-permission-assignments/*/revoke', async route => {
    expect(route.request().method()).toBe('PATCH')
    const assignmentId = new URL(route.request().url()).pathname.split('/').at(-2)!
    writes.push({ assignmentId, ...route.request().postDataJSON() })
    revoked.add(assignmentId)
    await route.fulfill({ json: { status: 'updated', message: 'Revoked', data: { assignment: {} } } })
  })
  return writes
}

function capabilityButtons(page: Page) {
  return page.getByText('Kişisel yetkiler', { exact: true }).locator('..').locator('..').getByRole('button', { name: 'Kaldır', exact: true })
}

for (const target of ['same', 'other'] as const) {
  test(`capability revoke reason resets after cancel before reopening ${target} assignment`, async ({ page }) => {
    const writes = await routeCapabilities(page)
    await page.goto('/admin/auth')
    await expect(capabilityButtons(page)).toHaveCount(2)
    await capabilityButtons(page).first().click()
    const dialog = page.getByRole('dialog', { name: 'Kişisel yetki kaldırılsın mı?' })
    await dialog.getByLabel('Yetki kaldırma gerekçesi').fill('Reason belonging to A')
    await dialog.getByRole('button', { name: 'Vazgeç' }).click()
    await expect(dialog).toBeHidden()
    await capabilityButtons(page).nth(target === 'same' ? 0 : 1).click()
    await expect(dialog.getByLabel('Yetki kaldırma gerekçesi')).toHaveValue('')
    await expect(dialog.getByRole('button', { name: 'Yetkiyi kaldır' })).toBeDisabled()
    expect(writes).toEqual([])
  })
}

test('capability revoke success clears the reason for the next assignment', async ({ page }) => {
  const writes = await routeCapabilities(page)
  await page.goto('/admin/auth')
  await expect(capabilityButtons(page)).toHaveCount(2)
  await capabilityButtons(page).first().click()
  const dialog = page.getByRole('dialog', { name: 'Kişisel yetki kaldırılsın mı?' })
  await dialog.getByLabel('Yetki kaldırma gerekçesi').fill('Fresh reason for A')
  await dialog.getByRole('button', { name: 'Yetkiyi kaldır' }).click()
  await expect(dialog).toBeHidden()
  await expect(capabilityButtons(page)).toHaveCount(1)
  await capabilityButtons(page).click()
  await expect(dialog.getByLabel('Yetki kaldırma gerekçesi')).toHaveValue('')
  await expect(dialog.getByRole('button', { name: 'Yetkiyi kaldır' })).toBeDisabled()
  expect(writes).toEqual([{ assignmentId: 'capability-a', reason: 'Fresh reason for A' }])
})

async function routeIncentives(page: Page, failCorrection = false) {
  await page.clock.setFixedTime(new Date('2026-05-15T09:00:00Z'))
  await page.route('**/api/admin/incentives?**', route => {
    const period = new URL(route.request().url()).searchParams.get('period') ?? '2026-05'
    return route.fulfill({ json: { data: {
      period, periodStart: `${period}-01`, periodEnd: `${period}-28`, periodTimezone: 'Europe/Istanbul',
      roleScope: 'admin', regionWorkflow: null, regionPackages: [], projections: [{
        period, periodTimezone: 'Europe/Istanbul', closeCutoffAt: null, ruleVersionId: 'fixture-v1',
        regionId: 'region-1', storeId: 'store-1', storeName: 'Fixture Store', storeOwnershipType: 'company',
        roleScope: 'admin', storeTarget: '1000', storeActualNetSales: '1200', storeAchievementPct: '120',
        storeGatePassed: true, calculationState: 'projected', blockedReason: null, lastImportAt: null,
        rows: ['Person A', 'Person B'].map((displayName, index) => ({
          employeeId: `employee-${index}`, displayName, participantType: 'personnel', positionCode: 'SALES_ASSOCIATE',
          normalizedFromPositionCode: null, target: '100', actualPositiveSales: '120', achievementPct: '120',
          storeAchievementPct: '120', storeGatePassed: true, rate: '0.01', rawEarnedAmount: '1.20',
          payableAmount: '1.20', correctionAmount: null, adjustmentAmount: null, finalAmount: null,
          status: 'projected', blockedReason: null, rateTableVersion: 'fixture-v1', explanation: 'Fixture', regionCorrection: null,
        })),
      }],
    } } })
  })
  const writes: Array<Record<string, unknown>> = []
  await page.route('**/api/admin/incentives/corrections', async route => {
    writes.push(route.request().postDataJSON())
    await route.fulfill(failCorrection
      ? { status: 400, json: { message: 'Synthetic correction rejected' } }
      : { json: { data: { adjustmentId: 'fixture-adjustment', status: 'approved' } } })
  })
  return writes
}

async function selectPerson(page: Page, name: string) {
  await page.getByTestId('admin-incentive-row').filter({ hasText: name }).getByRole('button', { name: 'Seç', exact: true }).click()
}

async function fillCorrection(page: Page, amount: string, reason: string) {
  await page.getByLabel('Düzeltme tutarı', { exact: true }).fill(amount)
  await page.getByRole('textbox', { name: 'Gerekçe', exact: true }).fill(reason)
}

test('incentive correction draft cannot follow a different person', async ({ page }) => {
  const writes = await routeIncentives(page)
  await page.goto('/admin/incentives')
  await selectPerson(page, 'Person A')
  await fillCorrection(page, '125.25', 'Reason for Person A')
  await selectPerson(page, 'Person B')
  await expect(page.getByLabel('Düzeltme tutarı', { exact: true })).toHaveValue('')
  await expect(page.getByRole('textbox', { name: 'Gerekçe', exact: true })).toHaveValue('')
  await page.getByRole('button', { name: 'Düzeltme uygula' }).click()
  expect(writes).toEqual([])
  await fillCorrection(page, '12.50', 'Fresh reason for Person B')
  await page.getByRole('button', { name: 'Düzeltme uygula' }).click()
  await expect.poll(() => writes).toEqual([{
    period: '2026-05', storeId: 'store-1', employeeId: 'employee-1', participantType: 'personnel',
    adjustmentAmount: '12.50', reasonCode: 'manual_review', reasonNote: 'Fresh reason for Person B',
  }])
})

test('incentive correction draft and failed feedback cannot follow another month', async ({ page }) => {
  const writes = await routeIncentives(page, true)
  await page.goto('/admin/incentives')
  await selectPerson(page, 'Person A')
  await fillCorrection(page, '125.25', 'Reason for May')
  await page.getByRole('button', { name: 'Düzeltme uygula' }).click()
  const panel = page.getByTestId('admin-incentive-correction-panel')
  await expect(panel.getByText('Düzeltme uygulanamadı', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Prim dönemi' }).click()
  const calendar = page.getByRole('dialog', { name: 'Dönem seç' })
  await calendar.getByRole('combobox', { name: 'Ay seç' }).selectOption('5')
  await calendar.getByRole('button', { name: 'Uygula' }).click()
  await expect(page.getByTestId('admin-incentive-period-summary')).toContainText('Haziran 2026')
  await expect(page.getByLabel('Düzeltme tutarı', { exact: true })).toHaveValue('')
  await expect(page.getByRole('textbox', { name: 'Gerekçe', exact: true })).toHaveValue('')
  await expect(panel.getByText('Düzeltme uygulanamadı', { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Düzeltme uygula' }).click()
  expect(writes).toHaveLength(1)
  expect(writes[0]).toMatchObject({ period: '2026-05', employeeId: 'employee-0' })
})

test('incentive correction success feedback belongs to the corrected person', async ({ page }) => {
  await routeIncentives(page)
  await page.goto('/admin/incentives')
  await selectPerson(page, 'Person A')
  await fillCorrection(page, '1.25', 'Approved reason for A')
  await page.getByRole('button', { name: 'Düzeltme uygula' }).click()
  const panel = page.getByTestId('admin-incentive-correction-panel')
  await expect(panel.getByText('Düzeltme kaydedildi', { exact: true })).toBeVisible()
  await selectPerson(page, 'Person B')
  await expect(panel.getByText('Düzeltme kaydedildi', { exact: true })).toHaveCount(0)
})

test('a deferred correction for A preserves a newer draft for B and binds the next write to B', async ({ page }) => {
  await routeIncentives(page)
  let releaseFirst: (() => void) | undefined
  const firstResponse = new Promise<void>(resolve => { releaseFirst = resolve })
  const writes: Array<Record<string, unknown>> = []
  await page.route('**/api/admin/incentives/corrections', async route => {
    writes.push(route.request().postDataJSON())
    if (writes.length === 1) await firstResponse
    await route.fulfill({ json: { data: { adjustmentId: `fixture-${writes.length}`, status: 'approved' } } })
  })
  await page.goto('/admin/incentives')
  await selectPerson(page, 'Person A')
  await fillCorrection(page, '1.25', 'Approved reason for A')
  await page.getByRole('button', { name: 'Düzeltme uygula' }).click()
  await expect.poll(() => writes.length).toBe(1)
  await selectPerson(page, 'Person B')
  await fillCorrection(page, '12.50', 'New draft belonging to B')
  releaseFirst?.()
  await expect(page.getByRole('button', { name: 'Düzeltme uygula' })).toBeEnabled()
  await expect(page.getByLabel('Düzeltme tutarı', { exact: true })).toHaveValue('12.50')
  await expect(page.getByRole('textbox', { name: 'Gerekçe', exact: true })).toHaveValue('New draft belonging to B')
  await expect(page.getByTestId('admin-incentive-correction-panel').getByText('Düzeltme kaydedildi', { exact: true })).toHaveCount(0)
  expect(writes).toHaveLength(1)
  await page.getByRole('button', { name: 'Düzeltme uygula' }).click()
  await expect.poll(() => writes).toEqual([
    { period: '2026-05', storeId: 'store-1', employeeId: 'employee-0', participantType: 'personnel', adjustmentAmount: '1.25', reasonCode: 'manual_review', reasonNote: 'Approved reason for A' },
    { period: '2026-05', storeId: 'store-1', employeeId: 'employee-1', participantType: 'personnel', adjustmentAmount: '12.50', reasonCode: 'manual_review', reasonNote: 'New draft belonging to B' },
  ])
})

async function routeKpiReport(page: Page, allUnknown: boolean) {
  await page.addInitScript(() => localStorage.setItem('store-ops-app-locale', 'en'))
  await page.route('**/api/reports/kpis?**', route => {
    const items = (allUnknown ? ['Unknown store'] : ['Known store', 'Zero store', 'Unknown store']).map(storeName => ({
      snapshotRunId: 'bughunt-snapshot', storeId: storeName, storeName, kpiId: 'fixture-sales',
      kpiCode: 'SALES', kpiName: 'Sales', periodStart: '2026-05-01', periodEnd: '2026-05-31',
      targetValue: storeName === 'Unknown store' ? null : '100',
      actualValue: storeName === 'Unknown store' ? null : storeName === 'Zero store' ? '0' : '100',
      achievementRate: storeName === 'Unknown store' ? null : storeName === 'Zero store' ? '0' : '1',
      statusBand: storeName === 'Unknown store' ? null : 'on_track',
    }))
    return route.fulfill({ json: { items, meta: { count: items.length, total: items.length, limit: 50, offset: 0 } } })
  })
}

test('KPI report distinguishes unknown values from genuine zero and averages known rates', async ({ page }) => {
  await routeKpiReport(page, false)
  await page.goto('/admin/reports/kpis/bughunt-snapshot')
  const unknown = page.getByRole('row').filter({ hasText: 'Unknown store' })
  const zero = page.getByRole('row').filter({ hasText: 'Zero store' })
  await expect(unknown.getByRole('cell').nth(2)).toHaveText('—')
  await expect(unknown.getByRole('cell').nth(3)).toHaveText('—')
  await expect(unknown.getByRole('cell').nth(4)).toHaveText('—')
  await expect(zero.getByRole('cell').nth(3)).toHaveText('0')
  await expect(zero.getByRole('cell').nth(4)).toHaveText('0%')
  await expect(page.getByTestId('admin-metric-avg-achievement')).toContainText('50%')
  await expect(page.getByTestId('admin-metric-target-total')).toContainText('200')
  await expect(page.getByTestId('admin-metric-actual-total')).toContainText('100')
})

test('KPI report keeps all-unknown summary values unknown', async ({ page }) => {
  await routeKpiReport(page, true)
  await page.goto('/admin/reports/kpis/bughunt-snapshot')
  for (const metric of ['avg-achievement', 'target-total', 'actual-total']) {
    await expect(page.getByTestId(`admin-metric-${metric}`)).toContainText('—')
    await expect(page.getByTestId(`admin-metric-${metric}`).locator('[data-slot="card-header"]')).not.toContainText('0')
  }
})
