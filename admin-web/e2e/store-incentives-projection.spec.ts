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

test('store manager sees incentive navigation and store projection rows without approval flow', async ({ page }) => {
  await routeAuthSession(page, createAuthSession(['STORE_MANAGER']))
  await routeStoreIncentives(page, storeIncentiveFixture)

  await page.goto('/store/home')

  await expect(page.locator('.store-command-nav').getByRole('link', { name: 'Primler' })).toBeVisible()
  await page.locator('.store-command-nav').getByRole('link', { name: 'Primler' }).click()

  await expect(page).toHaveURL(/\/store\/incentives$/)
  await expect(page.getByTestId('store-incentives-page')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Mağaza primleri' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Onaya gönder/i })).toHaveCount(0)
  await expect(page.getByRole('checkbox', { name: 'Kontrol edildi' })).toHaveCount(0)
  await expect(page.getByText('Mağaza müdürü prim tablosu')).toBeVisible()
  await expect(page.getByText('Satış personeli prim tablosu')).toBeVisible()
  await expect(page.getByText('15.000,00 TL').first()).toBeVisible()
  await expect(page.getByText('Store Personnel')).toBeVisible()
  await expect(page.getByText('16.500,00 TL').first()).toBeVisible()
})

test('region manager sees incentive navigation before incentive rows resolve', async ({ page }) => {
  let releaseIncentives!: () => void
  const incentivesDeferred = new Promise<void>((resolve) => {
    releaseIncentives = resolve
  })

  await routeAuthSession(page, createRegionManagerSession())
  await page.unroute('**/api/store/incentives**')
  await page.route('**/api/store/incentives**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    if (request.method() !== 'GET' || url.pathname !== '/api/store/incentives') {
      await route.fallback()
      return
    }

    await incentivesDeferred
    await route.fulfill({ json: regionIncentiveFixture })
  })

  try {
    await page.goto('/store/home')

    await expect(page.getByTestId('store-home-dashboard')).toBeVisible()
    await expect(
      page.locator('.store-command-nav').getByRole('link', { name: 'Primler' }),
    ).toBeVisible({ timeout: 1_000 })
  } finally {
    releaseIncentives()
  }
})

test('region manager sees assigned stores grouped by store with approval controls', async ({ page }) => {
  await routeAuthSession(page, createRegionManagerSession())
  await routeStoreIncentives(page, regionIncentiveFixture)

  await page.goto('/store/incentives')

  await expect(page.getByRole('heading', { name: 'Primler' })).toBeVisible()
  await expect(page.getByRole('button', { name: /IstinyePark Demo Store/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Marmara Forum/ })).toBeVisible()
  await page.getByRole('button', { name: /Marmara Forum/ }).click()
  await expect(page.getByRole('button', { name: 'Second Store Personnel' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Onaya gönder/i })).toBeDisabled()
  await expect(page.getByRole('button', { name: /Excel/i })).toBeVisible()
  await expect(page.getByRole('checkbox', { name: 'Kontrol edildi' })).toBeVisible()
})

test('region manager marks a store reviewed with period and store id', async ({ page }) => {
  const requests: unknown[] = []
  await routeAuthSession(page, createRegionManagerSession())
  await routeStoreIncentives(page, regionIncentiveFixture)
  await routeRegionIncentiveMutations(page, { reviewRequests: requests })

  await page.goto('/store/incentives')
  await page.getByRole('checkbox', { name: 'Kontrol edildi' }).first().click()

  await expect.poll(() => requests.length).toBe(1)
  expect(requests[0]).toMatchObject({
    period: '2026-06',
    storeId: demoStoreId,
    reviewStatus: 'reviewed',
  })
})

test('region manager saves a final amount correction from the personnel sheet', async ({ page }) => {
  const requests: unknown[] = []
  await routeAuthSession(page, createRegionManagerSession())
  await routeStoreIncentives(page, regionAllReviewedFixture)
  await routeRegionIncentiveMutations(page, { correctionRequests: requests })

  await page.goto('/store/incentives')
  await page.getByRole('button', { name: 'Store Personnel' }).click()
  await expect(page.getByRole('heading', { name: 'Store Personnel' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Hakediş özeti' })).toBeVisible()
  await page.getByLabel('Final prim tutarı').fill('17000.25')
  await expect(page.getByLabel('Final prim tutarı')).toHaveValue('17.000,25')
  await page.getByLabel('Düzeltme notu').fill('Bölge kontrolü sonrası final prim düzeltmesi')
  await page.getByRole('button', { name: 'Kaydet' }).click()

  await expect.poll(() => requests.length).toBe(1)
  expect(requests[0]).toMatchObject({
    period: '2026-06',
    storeId: demoStoreId,
    employeeId: demoEmployeeId,
    participantType: 'personnel',
    finalAmount: '17000.25',
    reasonNote: 'Bölge kontrolü sonrası final prim düzeltmesi',
  })
})

test('region manager sees saved draft correction amount in totals and sheet input', async ({ page }) => {
  await routeAuthSession(page, createRegionManagerSession())
  await routeStoreIncentives(page, regionDraftCorrectionFixture)

  await page.goto('/store/incentives')

  await expect(page.getByText('63.500,25 TL').first()).toBeVisible()
  await page.getByRole('button', { name: 'Store Personnel' }).click()
  await expect(page.getByLabel('Final prim tutarı')).toHaveValue('17.000,25')
})

test('region manager cannot save an invalid final correction amount', async ({ page }) => {
  const requests: unknown[] = []
  await routeAuthSession(page, createRegionManagerSession())
  await routeStoreIncentives(page, regionAllReviewedFixture)
  await routeRegionIncentiveMutations(page, { correctionRequests: requests })

  await page.goto('/store/incentives')
  await page.getByRole('button', { name: 'Store Personnel' }).click()
  await page.getByLabel('Final prim tutarı').fill('yanlış tutar')
  await page.getByLabel('Düzeltme notu').fill('Bölge kontrolü sonrası final prim düzeltmesi')

  await expect(page.getByText('Geçerli bir tutar girin.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Kaydet' })).toBeDisabled()
  expect(requests).toHaveLength(0)
})

test('region manager cannot save a negative final correction amount', async ({ page }) => {
  const requests: unknown[] = []
  await routeAuthSession(page, createRegionManagerSession())
  await routeStoreIncentives(page, regionAllReviewedFixture)
  await routeRegionIncentiveMutations(page, { correctionRequests: requests })

  await page.goto('/store/incentives')
  await page.getByRole('button', { name: 'Store Personnel' }).click()
  await page.getByLabel(/Final prim tutar/).fill('-1')
  await page.getByLabel(/notu/).fill('BÃƒÂ¶lge kontrolÃƒÂ¼ sonrasÃ„Â± final prim dÃƒÂ¼zeltmesi')

  await expect(page.getByText(/tutar girin/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Kaydet' })).toBeDisabled()
  expect(requests).toHaveLength(0)
})

test('region manager cannot save an over-precision final correction amount', async ({ page }) => {
  const requests: unknown[] = []
  await routeAuthSession(page, createRegionManagerSession())
  await routeStoreIncentives(page, regionAllReviewedFixture)
  await routeRegionIncentiveMutations(page, { correctionRequests: requests })

  await page.goto('/store/incentives')
  await page.getByRole('button', { name: 'Store Personnel' }).click()
  await page.getByLabel(/Final prim tutar/).fill('17000.255')
  await page.getByLabel(/notu/).fill('BÃ¶lge kontrolÃ¼ sonrasÄ± final prim dÃ¼zeltmesi')

  await expect(page.getByText(/tutar girin/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Kaydet' })).toBeDisabled()
  expect(requests).toHaveLength(0)
})

test('store incentives empty period keeps the period picker available', async ({ page }) => {
  await routeAuthSession(page, createRegionManagerSession())
  await routeStoreIncentives(page, emptyRegionIncentiveFixture)

  await page.goto('/store/incentives')

  await expect(page.getByText('Prim kaydı bulunamadı').first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Haziran 2026' })).toBeVisible()
})

test('region manager submits the reviewed period package once all stores are checked', async ({ page }) => {
  const requests: unknown[] = []
  await routeAuthSession(page, createRegionManagerSession())
  await routeStoreIncentives(page, regionAllReviewedFixture)
  await routeRegionIncentiveMutations(page, { submitRequests: requests })

  await page.goto('/store/incentives')
  await page.getByRole('button', { name: 'Onaya gönder' }).click()
  await expect(page.getByRole('heading', { name: 'Haziran 2026 primlerini onaya gönder' })).toBeVisible()
  await page.getByRole('button', { name: 'Onaya gönder' }).last().click()

  await expect.poll(() => requests.length).toBe(1)
  expect(requests[0]).toMatchObject({
    period: '2026-06',
    regionId: demoRegionId,
  })
})

test('region manager approval controls stay disabled before month close', async ({ page }) => {
  await routeAuthSession(page, createRegionManagerSession())
  await routeStoreIncentives(page, regionProjectionOnlyFixture)

  await page.goto('/store/incentives')

  await expect(page.getByText(/Ay kapan.*bekliyor/).first()).toBeVisible()
  await expect(page.getByRole('button', { name: /Onaya gönder/i })).toBeDisabled()
  await expect(page.getByRole('checkbox', { name: 'Kontrol edildi' }).first()).toBeDisabled()
  await page.getByRole('button', { name: 'Store Personnel' }).click()
  await expect(page.getByRole('button', { name: 'Kaydet' })).toBeDisabled()
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

  await page.goto('/store/incentives')

  await expect(page.getByText('Prim kaydÄ± bulunamadÄ±')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Haziran 2026' })).toHaveCount(0)
  await expect(page.getByTestId('store-incentives-page')).toHaveCount(0)
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

test('captures responsive visual evidence for region manager incentive command state', async ({ page }) => {
  mkdirSync(evidenceDir, { recursive: true })

  await routeAuthSession(page, createRegionManagerSession())
  await routeStoreIncentives(page, regionIncentiveFixture)

  await page.setViewportSize({ width: 1440, height: 1100 })
  await page.goto('/store/incentives')
  await expect(page.getByTestId('store-incentives-page')).toBeVisible()
  await expectNoHorizontalOverflow(page)
  await page.screenshot({
    path: join(evidenceDir, 'store-incentives-region-manager-desktop.png'),
    fullPage: true,
  })

  await page.getByRole('button', { name: /Marmara Forum/ }).click()
  await page.getByRole('button', { name: 'Second Store Personnel' }).click()
  await expect(page.getByRole('dialog', { name: 'Second Store Personnel' })).toBeVisible()
  await expect(page.locator('.pilot-feedback-control')).toBeHidden()
  await page.screenshot({
    path: join(evidenceDir, 'store-incentives-region-manager-sheet-desktop.png'),
    fullPage: true,
  })

  await page.setViewportSize({ width: 390, height: 1200 })
  await page.goto('/store/incentives')
  await expect(page.getByTestId('store-incentives-page')).toBeVisible()
  await expectNoHorizontalOverflow(page)
  await page.screenshot({
    path: join(evidenceDir, 'store-incentives-region-manager-mobile-390.png'),
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
    const request = route.request()
    const url = new URL(request.url())
    if (request.method() !== 'GET' || url.pathname !== '/api/store/incentives') {
      await route.fallback()
      return
    }

    await route.fulfill({ json: fixture })
  })
}

async function routeRegionIncentiveMutations(
  page: Page,
  captures: {
    reviewRequests?: unknown[]
    correctionRequests?: unknown[]
    submitRequests?: unknown[]
  } = {},
) {
  await page.route('**/api/store/incentives/store-reviews', async (route) => {
    captures.reviewRequests?.push(await route.request().postDataJSON())
    await route.fulfill({
      status: 201,
      json: {
        data: {
          period: '2026-06',
          storeId: demoStoreId,
          reviewStatus: 'reviewed',
          reviewedByUserId: 'store-incentive-user',
          reviewedAt: '2026-06-30T10:00:00.000Z',
        },
      },
    })
  })

  await page.route('**/api/store/incentives/corrections', async (route) => {
    captures.correctionRequests?.push(await route.request().postDataJSON())
    await route.fulfill({
      status: 201,
      json: {
        data: {
          correctionId: 'correction-1',
          status: 'draft',
          targetScope: 'final_snapshot',
          beforeAmount: '16500.00',
          adjustmentAmount: '500.25',
          finalAmount: '17000.25',
          reasonNote: 'Bölge kontrolü sonrası final prim düzeltmesi',
          createdByUserId: 'store-incentive-user',
          createdAt: '2026-06-30T10:00:00.000Z',
          submittedAt: null,
          reviewedAt: null,
          reviewNote: null,
        },
      },
    })
  })

  await page.route('**/api/store/incentives/submissions', async (route) => {
    captures.submitRequests?.push(await route.request().postDataJSON())
    await route.fulfill({
      status: 201,
      json: {
        data: {
          period: '2026-06',
          regionId: demoRegionId,
          regionPackageId: 'package-1',
          regionPackageStatus: 'submitted',
          submittedAt: '2026-06-30T10:00:00.000Z',
          reviewedAt: null,
          reviewNote: null,
        },
      },
    })
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

function createRegionManagerSession() {
  return createAuthSession(['REGION_MANAGER'], {
    readStoreIds: [demoStoreId, secondStoreId],
    scopeStoreIds: [],
    readRegionIds: [demoRegionId],
    scopeRegionIds: [demoRegionId],
    actionStoreIds: [demoStoreId, secondStoreId],
  })
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

const ownIncentiveRow = {
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
  regionCorrection: null,
}

const storeManagerRow = {
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
  regionCorrection: null,
}

const storePersonnelRow = {
  ...ownIncentiveRow,
  actualPositiveSales: '1000000.00',
  achievementPct: '100.0000',
  rawEarnedAmount: '16500.000000',
  payableAmount: '16500.00',
  rate: '0.0165',
}

const baseProjection = {
  period: '2026-06',
  periodTimezone: 'Europe/Istanbul',
  closeCutoffAt: '2026-06-30T20:59:59.000Z',
  ruleVersionId: 'sales-target-incentive-v1.0.0',
  storeId: demoStoreId,
  storeName: 'IstinyePark Demo Store',
  storeOwnershipType: 'company',
  roleScope: 'store',
  storeTarget: '1000000.00',
  storeActualNetSales: '1500000.00',
  storeAchievementPct: '150.0000',
  storeGatePassed: true,
  calculationState: 'projected',
  blockedReason: null,
  lastImportAt: '2026-06-18T08:00:00.000Z',
  review: null,
  rows: [storeManagerRow, storePersonnelRow],
}

const ownIncentiveFixture = {
  data: {
    period: '2026-06',
    periodStart: '2026-06-01',
    periodEnd: '2026-06-30',
    periodTimezone: 'Europe/Istanbul',
    roleScope: 'own',
    regionWorkflow: null,
    projections: [
      {
        ...baseProjection,
        roleScope: 'own',
        rows: [ownIncentiveRow],
      },
    ],
  },
}

const storeIncentiveFixture = {
  data: {
    ...ownIncentiveFixture.data,
    roleScope: 'store',
    regionWorkflow: null,
    projections: [
      {
        ...baseProjection,
        roleScope: 'store',
      },
    ],
  },
}

const pendingReview = {
  storeReviewStatus: 'pending_review',
  reviewedByUserId: null,
  reviewedAt: null,
  periodCloseStatus: 'closed',
  workflowLockedReason: null,
}

const reviewedReview = {
  storeReviewStatus: 'reviewed',
  reviewedByUserId: 'store-incentive-user',
  reviewedAt: '2026-06-30T10:00:00.000Z',
  periodCloseStatus: 'closed',
  workflowLockedReason: null,
}

const projectionOnlyReview = {
  ...pendingReview,
  periodCloseStatus: 'projection_only',
  workflowLockedReason: 'period_not_closed',
}

const regionWorkflow = {
  regionId: demoRegionId,
  regionPackageStatus: 'not_submitted',
  regionPackageId: null,
  submittedAt: null,
  reviewedAt: null,
  workflowLockedReason: null,
}

const secondProjection = {
  ...baseProjection,
  storeId: secondStoreId,
  storeName: 'Marmara Forum',
  rows: [
    {
      ...storeManagerRow,
      employeeId: 'second-manager',
    },
    {
      ...storePersonnelRow,
      employeeId: 'second-personnel',
      displayName: 'Second Store Personnel',
    },
  ],
}

const regionIncentiveFixture = {
  data: {
    ...storeIncentiveFixture.data,
    roleScope: 'region',
    regionWorkflow,
    projections: [
      {
        ...baseProjection,
        roleScope: 'region',
        review: pendingReview,
      },
      {
        ...secondProjection,
        roleScope: 'region',
        review: reviewedReview,
      },
    ],
  },
}

const regionAllReviewedFixture = {
  data: {
    ...regionIncentiveFixture.data,
    projections: regionIncentiveFixture.data.projections.map((projection) => ({
      ...projection,
      review: reviewedReview,
    })),
  },
}

const draftCorrection = {
  correctionId: 'draft-correction-1',
  status: 'draft',
  targetScope: 'final_snapshot',
  beforeAmount: '16500.00',
  adjustmentAmount: '500.25',
  finalAmount: '17000.25',
  reasonNote: 'Bölge kontrolü sonrası final prim düzeltmesi',
  createdByUserId: 'store-incentive-user',
  createdAt: '2026-06-30T11:00:00.000Z',
  submittedAt: null,
  reviewedAt: null,
  reviewNote: null,
}

const regionDraftCorrectionFixture = {
  data: {
    ...regionAllReviewedFixture.data,
    projections: regionAllReviewedFixture.data.projections.map((projection, projectionIndex) => ({
      ...projection,
      rows: projection.rows.map((row) =>
        projectionIndex === 0 && row.employeeId === demoEmployeeId
          ? { ...row, regionCorrection: draftCorrection }
          : row,
      ),
    })),
  },
}

const regionProjectionOnlyFixture = {
  data: {
    ...regionIncentiveFixture.data,
    projections: regionIncentiveFixture.data.projections.map((projection) => ({
      ...projection,
      review: projectionOnlyReview,
    })),
  },
}

const emptyIncentiveFixture = {
  data: {
    period: '2026-06',
    periodStart: '2026-06-01',
    periodEnd: '2026-06-30',
    periodTimezone: 'Europe/Istanbul',
    roleScope: 'store',
    regionWorkflow: null,
    projections: [],
  },
}

const emptyRegionIncentiveFixture = {
  data: {
    ...emptyIncentiveFixture.data,
    roleScope: 'region',
    regionWorkflow,
  },
}
