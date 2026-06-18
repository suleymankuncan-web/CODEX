import { expect, test, type Page } from './test-fixtures'

const companyId = '00000000-0000-0000-0000-000000000001'
const regionId = '00000000-0000-0000-0000-000000000010'
const storeId = '00000000-0000-0000-0000-000000000100'
const managerEmployeeId = '00000000-0000-0000-0000-000000000201'
const personnelEmployeeId = '00000000-0000-0000-0000-000000000202'

test('super admin reads incentive projections and submits an audited correction', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'store-ops-admin-session',
      JSON.stringify({
        mode: 'mock',
        mockUserId: 'admin-incentive-user',
        mockRoleCodes: 'SUPER_ADMIN,INTEGRATION_ADMIN,HR_ADMIN,REPORT_VIEWER,AUDITOR',
        mockCompanyIds: '00000000-0000-0000-0000-000000000001',
        bearerToken: '',
      }),
    )
  })
  await routeAuthSession(page, createAuthSession(['SUPER_ADMIN', 'INTEGRATION_ADMIN', 'HR_ADMIN', 'REPORT_VIEWER', 'AUDITOR']))
  await routeAdminIncentives(page)

  let correctionBody: Record<string, unknown> | null = null
  await page.route('**/api/admin/incentives/corrections', async (route) => {
    correctionBody = route.request().postDataJSON() as Record<string, unknown>
    await route.fulfill({
      json: {
        data: {
          adjustmentId: '00000000-0000-0000-0000-000000000801',
          phase: 'pre_close',
          adjustmentScope: 'projection',
          adjustmentType: 'correction',
          periodKey: '2026-05',
          storeId,
          employeeId: personnelEmployeeId,
          participantType: 'personnel',
          beforeAmount: '3960.00',
          adjustmentAmount: '125.25',
          afterAmount: '4085.25',
          status: 'approved',
        },
      },
    })
  })

  await page.goto('/admin/incentives')

  await expect(page.getByTestId('admin-incentives-page')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Prim yönetimi' })).toBeVisible()
  const personnelRow = page.getByTestId('admin-incentive-row').filter({ hasText: 'Ali Can' })
  await expect(personnelRow.getByRole('cell', { name: 'Marmara Park' })).toBeVisible()
  await expect(personnelRow.getByRole('cell', { name: 'Ali Can' })).toBeVisible()
  await expect(personnelRow.getByRole('cell', { name: '3.960,00 TL' }).first()).toBeVisible()
  await expect(personnelRow.getByText('Düzeltme', { exact: true })).toBeVisible()
  await expect(personnelRow.getByText('125,25 TL')).toBeVisible()
  await expect(personnelRow.getByText('Kapanış', { exact: true })).toBeVisible()
  await expect(personnelRow.getByText('-50,00 TL')).toBeVisible()
  await expect(personnelRow.getByRole('cell', { name: '4.035,25 TL' })).toBeVisible()

  await personnelRow.getByRole('button', { name: 'Seç' }).click()
  await page.getByLabel('Düzeltme tutarı').fill('125.25')
  await page.getByLabel('Gerekçe').fill('Admin onaylı satış hedef primi düzeltmesi')
  await page.getByRole('button', { name: 'Düzeltme uygula' }).click()

  await expect(page.getByText('Düzeltme kaydedildi')).toBeVisible()
  expect(correctionBody).toMatchObject({
    period: '2026-05',
    storeId,
    employeeId: personnelEmployeeId,
    participantType: 'personnel',
    adjustmentAmount: '125.25',
    reasonCode: 'manual_review',
    reasonNote: 'Admin onaylı satış hedef primi düzeltmesi',
  })
})

test('non super admin does not see admin incentive navigation', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'store-ops-admin-session',
      JSON.stringify({
        mode: 'mock',
        mockUserId: 'hr-admin-user',
        mockRoleCodes: 'HR_ADMIN',
        mockCompanyIds: '00000000-0000-0000-0000-000000000001',
        mockStoreIds: '',
        mockReadStoreIds: '',
        mockAssignedStoreIds: '',
        mockRegionIds: '',
        mockReadRegionIds: '',
        bearerToken: '',
      }),
    )
  })
  await routeAuthSession(page, createAuthSession(['HR_ADMIN']))

  await page.goto('/admin/checklists')

  await expect(page.locator('.admin-command-nav').getByRole('link', { name: 'Primler' })).toHaveCount(0)
})

async function routeAuthSession(page: Page, authSession: ReturnType<typeof createAuthSession>) {
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({ json: authSession })
  })
}

async function routeAdminIncentives(page: Page) {
  await page.route('**/api/admin/incentives**', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback()
      return
    }

    await route.fulfill({ json: adminIncentivesFixture })
  })
}

function createAuthSession(roleCodes: string[]) {
  return {
    authMode: 'mock',
    authenticated: true,
    user: {
      userId: 'admin-incentive-user',
      employeeId: null,
      roleCodes,
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
}

const adminIncentivesFixture = {
  data: {
    period: '2026-05',
    periodStart: '2026-05-01',
    periodEnd: '2026-05-31',
    periodTimezone: 'Europe/Istanbul',
    roleScope: 'admin',
    projections: [
      {
        period: '2026-05',
        periodTimezone: 'Europe/Istanbul',
        closeCutoffAt: null,
        ruleVersionId: 'sales-target-incentive-v1.0.0',
        storeId,
        storeName: 'Marmara Park',
        storeOwnershipType: 'company',
        roleScope: 'admin',
        storeTarget: '1000000.0000',
        storeActualNetSales: '1150000.0000',
        storeAchievementPct: '115.0000',
        storeGatePassed: true,
        calculationState: 'projected',
        blockedReason: null,
        lastImportAt: '2026-05-31T21:00:00.000Z',
        rows: [
          {
            employeeId: managerEmployeeId,
            displayName: 'Ada Yılmaz',
            participantType: 'store_manager',
            positionCode: 'STORE_MANAGER',
            normalizedFromPositionCode: null,
            target: '1000000.0000',
            actualPositiveSales: '1150000.0000',
            achievementPct: '115.0000',
            storeAchievementPct: null,
            storeGatePassed: null,
            rate: '0.0100',
            rawEarnedAmount: '11500.000000',
            payableAmount: '11500.00',
            correctionAmount: null,
            adjustmentAmount: null,
            finalAmount: null,
            status: 'projected',
            blockedReason: null,
            rateTableVersion: 'manager-sales-target-v1.0.0',
            explanation: 'Güncel hedef ve satış kaynağına göre hesaplandı.',
          },
          {
            employeeId: personnelEmployeeId,
            displayName: 'Ali Can',
            participantType: 'personnel',
            positionCode: 'SALES_ASSOCIATE',
            normalizedFromPositionCode: null,
            target: '200000.0000',
            actualPositiveSales: '240000.0000',
            achievementPct: '120.0000',
            storeAchievementPct: '115.0000',
            storeGatePassed: true,
            rate: '0.0165',
            rawEarnedAmount: '3960.000000',
            payableAmount: '3960.00',
            correctionAmount: '125.25',
            adjustmentAmount: '-50.00',
            finalAmount: '4035.25',
            status: 'adjusted',
            blockedReason: null,
            rateTableVersion: 'personnel-sales-target-v1.0.0',
            explanation: 'Güncel hedef ve satış kaynağına göre hesaplandı.',
          },
        ],
      },
    ],
  },
}
