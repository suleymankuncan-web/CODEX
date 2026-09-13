import { expect, test, type Page } from './test-fixtures'
import { setStoredLocale } from './locale-test-utils'

const companyId = '00000000-0000-0000-0000-000000000001'
const regionId = '00000000-0000-0000-0000-000000000010'
const approvalRegionId = '00000000-0000-0000-0000-000000000011'
const pendingRegionId = '00000000-0000-0000-0000-000000000012'
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
  const packageReviewBodies: Array<Record<string, unknown>> = []
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
  await page.route('**/api/admin/incentives/region-packages/reviews', async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>
    packageReviewBodies.push(body)
    await route.fulfill({
      json: {
        data: {
          period: body.period,
          regionId: body.regionId,
          regionPackageId: '00000000-0000-0000-0000-000000000901',
          status: body.decision === 'approve' ? 'admin_approved' : 'admin_returned',
          reviewedByUserId: 'admin-incentive-user',
          reviewedAt: '2026-06-02T10:00:00.000Z',
          reviewNote: body.reviewNote ?? null,
        },
      },
    })
  })

  await page.goto('/admin/incentives')

  await expect(page.getByTestId('admin-incentives-page')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Prim yönetimi' })).toBeVisible()
  const submittedPackage = page.getByTestId('admin-incentive-region-package').filter({ hasText: 'Eda Doğanay' })
  await expect(submittedPackage.getByText('Bölge müdürü tarafından onaya gönderildi')).toBeVisible()
  await expect(submittedPackage.getByText('2 mağaza')).toBeVisible()
  await submittedPackage.getByRole('button', { name: /Eda Doğanay/ }).click()
  await expect(submittedPackage.getByText('Bölge kontrolü sonrası final prim düzeltmesi')).toBeVisible()
  await expect(submittedPackage.getByText('4.085,25 TL')).toBeVisible()
  await expect(submittedPackage.getByRole('button', { name: 'Revizyon iste' })).toBeDisabled()
  await submittedPackage.getByLabel(/revizyon notu/i).fill('Final prim tutarı tekrar kontrol edilmeli')
  await submittedPackage.getByRole('button', { name: 'Revizyon iste' }).click()
  await expect.poll(() => packageReviewBodies.length).toBe(1)
  expect(packageReviewBodies[0]).toMatchObject({
    period: '2026-05',
    regionId,
    decision: 'return',
    reviewNote: 'Final prim tutarı tekrar kontrol edilmeli',
  })
  const approvalPackage = page.getByTestId('admin-incentive-region-package').filter({ hasText: 'Levent Yılmaz' })
  await expect(approvalPackage.getByText('Bölge müdürü tarafından onaya gönderildi')).toBeVisible()
  await approvalPackage.getByRole('button', { name: /Levent Yılmaz/ }).click()
  await approvalPackage.getByRole('button', { name: 'Onayla' }).click()
  await expect.poll(() => packageReviewBodies.length).toBe(2)
  expect(packageReviewBodies[1]).toMatchObject({
    period: '2026-05',
    regionId: approvalRegionId,
    decision: 'approve',
  })
  await expect(
    page.getByTestId('admin-incentive-region-package').filter({ hasText: 'Onur Kaytan' }).getByText('Onaya gönderilmedi'),
  ).toBeVisible()

  const personnelRow = page.getByTestId('admin-incentive-row').filter({ hasText: 'Ali Can' })
  await expect(personnelRow.getByRole('cell', { name: 'Marmara Park' })).toBeVisible()
  await expect(personnelRow.getByRole('cell', { name: 'Ali Can' })).toBeVisible()
  await expect(personnelRow.getByRole('cell', { name: '200.000,00 TL' })).toBeVisible()
  await expect(personnelRow.getByRole('cell', { name: '240.000,00 TL' })).toBeVisible()
  await expect(personnelRow.getByRole('cell', { name: '%120,00' })).toBeVisible()
  await expect(personnelRow.getByRole('cell', { name: '3.960,00 TL' }).first()).toBeVisible()
  await expect(personnelRow.getByText('Düzeltme', { exact: true })).toBeVisible()
  await expect(personnelRow.getByText('125,25 TL')).toBeVisible()
  await expect(personnelRow.getByText('Kapanış', { exact: true })).toBeVisible()
  await expect(personnelRow.getByText('-50,00 TL')).toBeVisible()
  await expect(personnelRow.getByRole('cell', { name: '4.035,25 TL' })).toBeVisible()
  await expect(page.getByTestId('admin-metric-personnel-sales-source')).toContainText('1/1')

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: "Excel'e aktar" }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe('prim-raporu-2026-05.xls')

  await personnelRow.getByRole('button', { name: 'Seç' }).click()
  await page.getByLabel('Düzeltme tutarı').fill('125.25')
  await page.getByLabel('Gerekçe').fill('Admin onaylı satış hedef primi düzeltmesi')
  await page.getByRole('button', { name: 'Düzeltme uygula' }).click()

  await expect(page.locator('.hr-axis-toast__title').getByText('Düzeltme kaydedildi')).toBeVisible()
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

test('admin incentives switches owned product copy to English and preserves source rows', async ({ page }) => {
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
  await page.goto('/admin/incentives')
  await setStoredLocale(page, 'en')

  await expect(page.getByRole('heading', { name: 'Incentive management' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Export to Excel' })).toBeVisible()
  await expect(page.getByRole('columnheader', { name: 'Store' })).toBeVisible()
  await expect(page.getByText('Ali Can')).toBeVisible()
  await expect(page.getByRole('heading', { name: /Prim y.*netimi/ })).toHaveCount(0)

  await setStoredLocale(page, 'tr')
  await expect(page.getByRole('heading', { name: 'Prim yönetimi' })).toBeVisible()
  await expect(page.getByText('Ali Can')).toBeVisible()
})

test('admin incentive period filter requests the selected year and month', async ({ page }) => {
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

  const requestedUrls: string[] = []
  await page.route('**/api/admin/incentives**', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback()
      return
    }

    requestedUrls.push(route.request().url())
    await route.fulfill({ json: adminIncentivesFixture })
  })

  await page.goto('/admin/incentives')
  await expect(page.getByTestId('admin-incentives-page')).toBeVisible()

  requestedUrls.length = 0
  await page.getByRole('button', { name: 'Prim dönemi' }).click()
  const calendar = page.getByRole('dialog', { name: 'Dönem seç' })
  await calendar.getByRole('combobox', { name: 'Yıl seç' }).selectOption('2025')
  await calendar.getByRole('combobox', { name: 'Yıl seç' }).selectOption('2026')
  await calendar.getByRole('combobox', { name: 'Ay seç' }).selectOption('4')
  await calendar.getByRole('button', { name: 'Uygula' }).click()
  await expect.poll(() => requestedUrls.some((url) => url.includes('period=2026-05'))).toBe(true)
  await expect(page.getByTestId('admin-incentive-period-summary')).toContainText('Mayıs 2026')
})

test('admin incentive default period follows Istanbul month boundary', async ({ page }) => {
  await page.addInitScript(() => {
    const fixedNow = new Date('2026-05-31T21:30:00.000Z').valueOf()
    const OriginalDate = Date
    class FixedDate extends OriginalDate {
      constructor(...args: ConstructorParameters<DateConstructor>) {
        super(...(args.length > 0 ? args : [fixedNow]))
      }

      static now() {
        return fixedNow
      }
    }
    window.Date = FixedDate as DateConstructor
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

  const requestedUrls: string[] = []
  await page.route('**/api/admin/incentives**', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback()
      return
    }

    requestedUrls.push(route.request().url())
    await route.fulfill({ json: adminIncentivesFixture })
  })

  await page.goto('/admin/incentives')
  await expect(page.getByTestId('admin-incentives-page')).toBeVisible()

  expect(requestedUrls.some((url) => url.includes('period=2026-06'))).toBe(true)
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
    regionWorkflow: null,
    regionPackages: [
      {
        regionId,
        regionName: 'Eda Doğanay Bölgesi',
        regionManagerUserId: 'region-manager-user',
        regionManagerName: 'Eda Doğanay',
        submittedByUserId: 'region-manager-user',
        submittedByName: 'Eda Doğanay',
        submittedAt: '2026-06-01T09:00:00.000Z',
        reviewedByUserId: null,
        reviewedByName: null,
        reviewedAt: null,
        reviewNote: null,
        status: 'submitted',
        storeCount: 3,
        reviewedStoreCount: 2,
        submittedStoreCount: 2,
        draftCorrectionCount: 0,
        submittedCorrectionCount: 1,
      },
      {
        regionId: approvalRegionId,
        regionName: 'Levent Yılmaz Bölgesi',
        regionManagerUserId: 'region-manager-levent',
        regionManagerName: 'Levent Yılmaz',
        submittedByUserId: 'region-manager-levent',
        submittedByName: 'Levent Yılmaz',
        submittedAt: '2026-06-01T10:00:00.000Z',
        reviewedByUserId: null,
        reviewedByName: null,
        reviewedAt: null,
        reviewNote: null,
        status: 'submitted',
        storeCount: 2,
        reviewedStoreCount: 2,
        submittedStoreCount: 2,
        draftCorrectionCount: 0,
        submittedCorrectionCount: 0,
      },
      {
        regionId: pendingRegionId,
        regionName: 'Onur Kaytan Bölgesi',
        regionManagerUserId: 'region-manager-onur',
        regionManagerName: 'Onur Kaytan',
        submittedByUserId: null,
        submittedByName: null,
        submittedAt: null,
        reviewedByUserId: null,
        reviewedByName: null,
        reviewedAt: null,
        reviewNote: null,
        status: 'not_submitted',
        storeCount: 4,
        reviewedStoreCount: 0,
        submittedStoreCount: 0,
        draftCorrectionCount: 0,
        submittedCorrectionCount: 0,
      },
    ],
    projections: [
      {
        period: '2026-05',
        periodTimezone: 'Europe/Istanbul',
        closeCutoffAt: null,
        ruleVersionId: 'sales-target-incentive-v1.0.0',
        regionId,
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
            regionCorrection: null,
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
            regionCorrection: {
              correctionId: '00000000-0000-0000-0000-000000000902',
              status: 'submitted',
              targetScope: 'final_snapshot',
              beforeAmount: '3960.00',
              adjustmentAmount: '125.25',
              finalAmount: '4085.25',
              reasonNote: 'Bölge kontrolü sonrası final prim düzeltmesi',
              createdByUserId: 'region-manager-user',
              createdAt: '2026-06-01T08:30:00.000Z',
              submittedAt: '2026-06-01T09:00:00.000Z',
              reviewedAt: null,
              reviewNote: null,
            },
          },
        ],
      },
    ],
  },
}
