import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test, type Page } from './test-fixtures'

const demoStoreId = '00000000-0000-0000-0000-000000000100'
const secondStoreId = '00000000-0000-0000-0000-000000000101'
const demoRegionId = '00000000-0000-0000-0000-000000000010'
const demoEmployeeId = '00000000-0000-0000-0000-000000000202'
const evidenceDir = fileURLToPath(
  new URL(
    '../../docs/evidence/sales-target-incentive-v1-pr6-store-ui-visual-qa-2026-06-18/',
    import.meta.url,
  ),
)

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'store-ops-admin-session',
      JSON.stringify({
        mode: 'mock',
        mockUserId: 'store-incentive-user',
        mockRoleCodes: 'STORE_PERSONNEL',
        mockCompanyIds: '00000000-0000-0000-0000-000000000001',
        bearerToken: '',
      }),
    )
  })

  await routePerformanceApi(page)
})

test('store personnel sees own incentive card on My Performance without store incentive navigation', async ({ page }) => {
  await routeAuthSession(page, createAuthSession(['STORE_PERSONNEL']))
  await routeOwnIncentive(page, ownIncentiveFixture)
  await routeStoreIncentives(page, storeIncentiveFixture)

  await page.goto('/store/me')

  await expect(page.getByTestId('store-me-incentive-card')).toBeVisible()
  await expect(page.getByText('Hak edilen prim')).toBeVisible()
  await expect(page.getByText('12.300,00 TL')).toBeVisible()
  await expect(page.getByLabel(/personeli prim tablosu/i)).toBeVisible()
  await expect(page.locator('.store-command-nav').getByRole('link', { name: 'Primler' })).toHaveCount(0)
})

test('store manager sees incentive navigation and store projection rows', async ({ page }) => {
  await routeAuthSession(page, createAuthSession(['STORE_MANAGER']))
  await routeStoreIncentives(page, storeIncentiveFixture)

  await page.goto('/store/home')

  await expect(page.locator('.store-command-nav').getByRole('link', { name: 'Primler' })).toBeVisible()
  await page.locator('.store-command-nav').getByRole('link', { name: 'Primler' }).click()

  await expect(page).toHaveURL(/\/store\/incentives$/)
  await expect(page.getByTestId('store-incentives-page')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Mağaza prim görünümü' })).toBeVisible()
  await expect(page.getByText('Mağaza müdürü prim tablosu')).toBeVisible()
  await expect(page.getByText('Satış personeli prim tablosu')).toBeVisible()
  await expect(page.getByText('15.000,00 TL')).toBeVisible()
  await expect(page.getByText('Store Personnel')).toBeVisible()
  await expect(page.getByText('16.500,00 TL')).toBeVisible()
})

test('region manager sees assigned stores grouped by store', async ({ page }) => {
  await routeAuthSession(page, createAuthSession(['REGION_MANAGER'], {
    readStoreIds: [demoStoreId, secondStoreId],
    scopeStoreIds: [],
    readRegionIds: [demoRegionId],
    scopeRegionIds: [demoRegionId],
    actionStoreIds: [demoStoreId, secondStoreId],
  }))
  await routeStoreIncentives(page, regionIncentiveFixture)

  await page.goto('/store/incentives')

  await expect(page.getByRole('heading', { name: 'Bölge prim görünümü' })).toBeVisible()
  await expect(page.getByText('IstinyePark Demo Store')).toBeVisible()
  await expect(page.getByText('Marmara Forum')).toBeVisible()
  await expect(page.getByText('Second Store Personnel')).toBeVisible()
})

test('cashier and non-company store users do not see incentive surfaces', async ({ page }) => {
  await routeAuthSession(page, createAuthSession(['STORE_PERSONNEL']))
  await routeOwnIncentive(page, null, 404)
  await routeStoreIncentives(page, emptyIncentiveFixture)

  await page.goto('/store/me')

  await expect(page.getByTestId('store-me-incentive-card')).toHaveCount(0)
  await expect(page.locator('.store-command-nav').getByRole('link', { name: 'Primler' })).toHaveCount(0)

  await routeAuthSession(page, createAuthSession(['STORE_MANAGER']))
  await page.goto('/store/home')

  await expect(page.locator('.store-command-nav').getByRole('link', { name: 'Primler' })).toHaveCount(0)
})

test('captures responsive visual evidence for eligible incentive state', async ({ page }) => {
  mkdirSync(evidenceDir, { recursive: true })

  await routeAuthSession(page, createAuthSession(['STORE_MANAGER']))
  await routeStoreIncentives(page, storeIncentiveFixture)

  await page.setViewportSize({ width: 1440, height: 1100 })
  await page.goto('/store/incentives')
  await expect(page.getByTestId('store-incentives-page')).toBeVisible()
  await expectNoHorizontalOverflow(page)
  await page.screenshot({
    path: join(evidenceDir, 'store-incentives-manager-desktop.png'),
    fullPage: true,
  })

  await page.setViewportSize({ width: 390, height: 1200 })
  await page.goto('/store/incentives')
  await expect(page.getByTestId('store-incentives-page')).toBeVisible()
  await expectNoHorizontalOverflow(page)
  await page.screenshot({
    path: join(evidenceDir, 'store-incentives-manager-mobile-390.png'),
    fullPage: true,
  })
})

test('captures responsive visual evidence for hidden incentive state', async ({ page }) => {
  mkdirSync(evidenceDir, { recursive: true })

  await routeAuthSession(page, createAuthSession(['STORE_MANAGER']))
  await routeStoreIncentives(page, emptyIncentiveFixture)

  await page.setViewportSize({ width: 1440, height: 1100 })
  await page.goto('/store/home')
  await expect(page.getByTestId('store-home-dashboard')).toBeVisible()
  await expect(page.locator('.store-command-nav').getByRole('link', { name: 'Primler' })).toHaveCount(0)
  await expectNoHorizontalOverflow(page)
  await page.screenshot({
    path: join(evidenceDir, 'store-incentives-hidden-desktop.png'),
    fullPage: true,
  })

  await page.setViewportSize({ width: 390, height: 1200 })
  await page.goto('/store/home')
  await expect(page.getByTestId('store-home-dashboard')).toBeVisible()
  await expect(page.locator('.store-command-nav').getByRole('link', { name: 'Primler' })).toHaveCount(0)
  await expectNoHorizontalOverflow(page)
  await page.screenshot({
    path: join(evidenceDir, 'store-incentives-hidden-mobile-390.png'),
    fullPage: true,
  })
})

async function routeAuthSession(page: Page, authSession: ReturnType<typeof createAuthSession>) {
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({ json: authSession })
  })
}

async function routeOwnIncentive(page: Page, fixture: unknown, status = 200) {
  await page.route('**/api/store/me/incentives**', async (route) => {
    await route.fulfill({
      status,
      json: fixture ?? { message: 'Incentive projection is not available' },
    })
  })
}

async function routeStoreIncentives(page: Page, fixture: unknown) {
  await page.unroute('**/api/store/incentives**')
  await page.route('**/api/store/incentives**', async (route) => {
    await route.fulfill({ json: fixture })
  })
}

async function routePerformanceApi(page: Page) {
  await page.route('**/api/reports/my-performance**', async (route) => {
    await route.fulfill({ json: myPerformanceFixture })
  })

  await page.route('**/api/reports/kpi-config', async (route) => {
    await route.fulfill({ json: kpiConfigFixture })
  })
}

async function expectNoHorizontalOverflow(page: Page) {
  const hasHorizontalOverflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth > window.innerWidth
  })
  expect(hasHorizontalOverflow).toBe(false)
}

function createAuthSession(
  roleCodes: string[],
  input?: {
    readStoreIds?: string[]
    scopeStoreIds?: string[]
    readRegionIds?: string[]
    scopeRegionIds?: string[]
    actionStoreIds?: string[]
  },
) {
  const readStoreIds = input?.readStoreIds ?? [demoStoreId]
  const scopeStoreIds = input?.scopeStoreIds ?? [demoStoreId]
  const actionStoreIds = input?.actionStoreIds ?? [demoStoreId]

  return {
    authMode: 'mock',
    authenticated: true,
    user: {
      userId: 'store-incentive-user',
      employeeId: demoEmployeeId,
      roleCodes,
      scope: {
        companyIds: ['00000000-0000-0000-0000-000000000001'],
        regionIds: input?.scopeRegionIds ?? [demoRegionId],
        storeIds: scopeStoreIds,
      },
      readScope: {
        companyIds: ['00000000-0000-0000-0000-000000000001'],
        regionIds: input?.readRegionIds ?? [demoRegionId],
        storeIds: readStoreIds,
      },
      actionScope: {
        assignedStoreIds: actionStoreIds,
      },
      assignedStoreIds: actionStoreIds,
    },
    scopeSummary: {
      companyCount: 1,
      regionCount: input?.readRegionIds?.length ?? 1,
      storeCount: readStoreIds.length,
      assignedStoreCount: actionStoreIds.length,
    },
  }
}

const myPerformanceFixture = {
  source: {
    mode: 'live',
    snapshotRunId: null,
    snapshotDate: null,
  },
  employee: {
    employeeId: demoEmployeeId,
    displayName: 'Store Personnel',
    storeId: demoStoreId,
    storeName: 'IstinyePark Demo Store',
  },
  period: {
    periodStart: '2026-06-01',
    periodEnd: '2026-06-30',
  },
  score: {
    value: 82,
    matchedMetrics: 1,
    totalMetrics: 1,
  },
  rankings: {
    turkeyRank: 14,
    turkeyPopulation: 100,
    storeRank: 2,
    storePopulation: 8,
  },
  availablePeriods: [
    {
      periodType: 'monthly',
      periodStart: '2026-06-01',
      periodEnd: '2026-06-30',
    },
  ],
  partial: {
    isPartial: false,
    missingMetricCodes: [],
    missingMetricLabels: [],
    pendingNormalizationCodes: [],
    pendingNormalizationLabels: [],
  },
  supporting: {
    netSalesValue: 820000,
    targetEntryMode: 'manager_assignment',
    targetEditableByCurrentUser: false,
  },
  metrics: [
    {
      code: 'TARGET_ACHIEVEMENT',
      label: 'HG',
      weightPercent: 100,
      actualValue: 820000,
      targetValue: 1000000,
      achievementRate: 0.82,
      contributionValue: 82,
      dataStatus: 'reported',
      scoreStatus: 'scored',
      status: 'reported',
    },
  ],
}

const kpiConfigFixture = {
  storeProfile: {
    profileCode: 'store',
    title: 'Store score',
    summary: 'Store score profile',
    metrics: [],
    futureMetricRule: 'None',
  },
  personnelProfile: {
    profileCode: 'personnel',
    title: 'Personnel score',
    summary: 'Personnel score profile',
    metrics: [],
    futureMetricRule: 'None',
  },
  ownershipMatrix: [],
  gradingBands: [
    {
      code: 'good',
      label: 'İyi',
      emoji: 'IYI',
      tone: 'calm',
      minScore: 80,
    },
  ],
  metadata: {
    kpiConfigVersionId: null,
    versionNo: null,
    effectiveFrom: null,
    effectiveTo: null,
    publishedAt: null,
    publishedBy: null,
  },
}

const ownIncentiveFixture = {
  data: {
    period: '2026-06',
    periodStart: '2026-06-01',
    periodEnd: '2026-06-30',
    periodTimezone: 'Europe/Istanbul',
    roleScope: 'own',
    projections: [
      {
        period: '2026-06',
        periodTimezone: 'Europe/Istanbul',
        closeCutoffAt: null,
        ruleVersionId: 'sales-target-incentive-v1.0.0',
        storeId: demoStoreId,
        storeName: 'IstinyePark Demo Store',
        storeOwnershipType: 'company',
        roleScope: 'own',
        storeTarget: '1000000.00',
        storeActualNetSales: '1000000.00',
        storeAchievementPct: '100.0000',
        storeGatePassed: true,
        calculationState: 'projected',
        blockedReason: null,
        lastImportAt: '2026-06-18T08:00:00.000Z',
        rows: [
          {
            employeeId: demoEmployeeId,
            displayName: 'Store Personnel',
            participantType: 'personnel',
            positionCode: 'SALES_ASSOCIATE',
            normalizedFromPositionCode: null,
            target: '1000000.00',
            actualPositiveSales: '820000.00',
            achievementPct: '82.0000',
            storeAchievementPct: '100.0000',
            storeGatePassed: true,
            rate: '0.0150',
            rawEarnedAmount: '12300.000000',
            payableAmount: '12300.00',
            correctionAmount: null,
            adjustmentAmount: null,
            finalAmount: null,
            status: 'projected',
            blockedReason: null,
            rateTableVersion: 'personnel-sales-target-v1.0.0',
            explanation: 'Güncel hedef ve satış kaynağına göre hesaplandı.',
          },
        ],
      },
    ],
  },
}

const storeIncentiveFixture = {
  data: {
    ...ownIncentiveFixture.data,
    roleScope: 'store',
    projections: [
      {
        ...ownIncentiveFixture.data.projections[0],
        roleScope: 'store',
        rows: [
          {
            employeeId: 'manager-1',
            displayName: 'Store Manager',
            participantType: 'store_manager',
            positionCode: 'STORE_MANAGER',
            normalizedFromPositionCode: null,
            target: '1000000.00',
            actualPositiveSales: '1500000.00',
            achievementPct: '150.0000',
            storeAchievementPct: '150.0000',
            storeGatePassed: null,
            rate: '0.0100',
            rawEarnedAmount: '15000.000000',
            payableAmount: '15000.00',
            correctionAmount: null,
            adjustmentAmount: null,
            finalAmount: null,
            status: 'projected',
            blockedReason: null,
            rateTableVersion: 'manager-sales-target-v1.0.0',
            explanation: 'Güncel hedef ve satış kaynağına göre hesaplandı.',
          },
          {
            ...ownIncentiveFixture.data.projections[0].rows[0],
            actualPositiveSales: '1000000.00',
            achievementPct: '100.0000',
            rawEarnedAmount: '16500.000000',
            payableAmount: '16500.00',
            rate: '0.0165',
          },
        ],
      },
    ],
  },
}

const regionIncentiveFixture = {
  data: {
    ...storeIncentiveFixture.data,
    roleScope: 'region',
    projections: [
      storeIncentiveFixture.data.projections[0],
      {
        ...storeIncentiveFixture.data.projections[0],
        storeId: secondStoreId,
        storeName: 'Marmara Forum',
        rows: [
          storeIncentiveFixture.data.projections[0].rows[0],
          {
            ...storeIncentiveFixture.data.projections[0].rows[1],
            employeeId: 'second-personnel',
            displayName: 'Second Store Personnel',
          },
        ],
      },
    ],
  },
}

const emptyIncentiveFixture = {
  data: {
    period: '2026-06',
    periodStart: '2026-06-01',
    periodEnd: '2026-06-30',
    periodTimezone: 'Europe/Istanbul',
    roleScope: 'store',
    projections: [],
  },
}
