import { expect, test } from './test-fixtures'
import {
  installGenericStoreApiFallbacks,
  installStoreContractSession,
  storeIds,
} from './store-page-contract-fixtures'

for (const role of ['REPORT_VIEWER', 'SUPER_ADMIN']) {
  test(`KPI ${role} direct store detail uses the returned latest period throughout`, async ({ page }) => {
    await page.clock.install({ time: new Date('2026-09-22T10:00:00+03:00') })
    await installStoreContractSession(page, 'reportViewer', { roleCodes: [role] })
    await installGenericStoreApiFallbacks(page)
    await page.route('**/api/reports/rankings**', route => route.fulfill({ json: rankingsFixture() }))
    const pageErrors: string[] = []
    const periodReads: Array<string | null> = []
    page.on('pageerror', error => pageErrors.push(error.message))
    page.on('request', request => {
      if (request.url().includes('/api/reports/store-kpi-highlights')) {
        periodReads.push(new URL(request.url()).searchParams.get('periodStart'))
      }
    })

    await page.goto(`/store/kpis?storeId=${storeIds[0]}`)
    await expect(page.getByTestId('store-kpis-manager-overview')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Dönem seç', exact: true })).toContainText('Tem 2026')
    const chart = page.getByLabel('Aylık mağaza skorları')
    await expect(chart).toContainText('2026 ·')
    await expect(chart.getByRole('row', { name: 'Tem 88', exact: true })).toHaveCount(1)

    await page.getByRole('button', { name: 'Mağaza Skoru detaylarını aç', exact: true }).click()
    await expect(page.getByRole('dialog')).toContainText('Temmuz 2026')
    await expect.poll(() => periodReads).toContain('2026-06-01')
    await expect.poll(() => periodReads).toContain('2025-07-01')
    expect(pageErrors).toEqual([])
  })
}

test('KPI metric dialog distinguishes pending ranking data from missing data', async ({ page }) => {
  await installStoreContractSession(page, 'storeManager')
  await installGenericStoreApiFallbacks(page)
  let releaseRanking: () => void = () => undefined
  const pendingRanking = new Promise<void>(resolve => { releaseRanking = resolve })
  await page.route('**/api/reports/rankings**', async route => {
    await pendingRanking
    await route.fulfill({ json: rankingsFixture() })
  })

  try {
    await page.goto('/store/kpis?periodStart=2026-07-01')
    await page.getByRole('button', { name: 'Mağaza Skoru detaylarını aç', exact: true }).click()
    const dialog = page.getByRole('dialog')
    const regionRank = dialog.locator('[data-slot="card"]').filter({ hasText: 'Bölge sıralaması' })
    await expect(regionRank).toContainText('Yükleniyor')
    await expect(regionRank).not.toContainText('Sıralama verisi yok')
    releaseRanking()
    await expect(regionRank).toContainText('1. / 2 mağaza')
  } finally {
    releaseRanking()
  }
})

test('KPI region paging retains the actual previous page while pending or failed, then retries', async ({ page }) => {
  await installStoreContractSession(page, 'regionManager')
  await installGenericStoreApiFallbacks(page)
  let releasePage: () => void = () => undefined
  const pendingPage = new Promise<void>(resolve => { releasePage = resolve })
  let failPage = true
  let secondPageReads = 0
  await page.route('**/api/reports/rankings**', async route => {
    const offset = Number(new URL(route.request().url()).searchParams.get('offset') ?? 0)
    if (offset === 50) {
      secondPageReads += 1
      await pendingPage
      if (failPage) {
        await route.fulfill({ status: 503, json: { message: 'temporary failure' } })
        return
      }
    }
    await route.fulfill({ json: rankingsFixture({ storeOffset: offset, storeTotal: 51 }) })
  })

  try {
    await page.goto('/store/kpis?periodStart=2026-07-01')
    const overview = page.getByTestId('store-kpis-region-overview')
    const pager = overview.locator('.region-performance-pager')
    const next = page.getByTestId('store-kpis-region-next-page')
    await expect(pager).toContainText('1–50 / 51')
    await next.click()
    await expect.poll(() => secondPageReads).toBeGreaterThan(0)
    await expect(overview.getByText('İstanbul MOI AVM').first()).toBeVisible()
    await expect(pager).toContainText('1–50 / 51')
    await expect(next).toBeDisabled()

    releasePage()
    const failure = page.getByRole('alert').filter({ hasText: 'Önceki görünüm korunuyor' })
    await expect(failure).toBeVisible()
    await expect(next).toBeEnabled()
    await expect(pager).toContainText('1–50 / 51')
    failPage = false
    await failure.getByRole('button', { name: 'Tekrar dene' }).click()
    await expect(overview.getByText('Bursa Marka Park').first()).toBeVisible()
    await expect(pager).toContainText('51–51 / 51')
    await expect(next).toBeDisabled()
  } finally {
    releasePage()
  }
})

test('KPI company manager paging does not relabel retained managers while the next page loads', async ({ page }) => {
  await installStoreContractSession(page, 'reportViewer')
  await installGenericStoreApiFallbacks(page)
  let releasePage: () => void = () => undefined
  const pendingPage = new Promise<void>(resolve => { releasePage = resolve })
  await page.route('**/api/reports/rankings**', async route => {
    const managerOffset = Number(new URL(route.request().url()).searchParams.get('regionManagerOffset') ?? 0)
    if (managerOffset === 20) await pendingPage
    await route.fulfill({ json: rankingsFixture({ managerOffset, managerTotal: 21 }) })
  })

  try {
    await page.goto('/store/kpis?periodStart=2026-07-01')
    const directory = page.getByRole('complementary', { name: 'Bölge müdürü seçimi' })
    const pager = directory.locator('.company-performance-manager-pager')
    const next = directory.getByRole('button', { name: 'Sonraki bölge müdürleri' })
    await expect(pager).toContainText('1 / 2')
    await next.click()
    await expect(next).toBeDisabled()
    await expect(directory.getByRole('button', { name: /Onur Kaytan/ })).toBeVisible()
    await expect(pager).toContainText('1 / 2')
    releasePage()
    await expect(directory.getByRole('button', { name: /Deniz Demir/ })).toBeVisible()
    await expect(pager).toContainText('2 / 2')
  } finally {
    releasePage()
  }
})

for (const list of ['company stores', 'personnel'] as const) {
  test(`KPI ${list} pager keeps its returned offset while placeholder rows are visible`, async ({ page }) => {
    const personnel = list === 'personnel'
    await installStoreContractSession(page, personnel ? 'storeManager' : 'reportViewer')
    await installGenericStoreApiFallbacks(page)
    let releasePage: () => void = () => undefined
    const pendingPage = new Promise<void>(resolve => { releasePage = resolve })
    await page.route('**/api/reports/rankings**', async route => {
      const params = new URL(route.request().url()).searchParams
      const offset = Number(params.get('offset') ?? 0)
      if (offset === 50) await pendingPage
      await route.fulfill({ json: rankingsFixture({ storeOffset: offset, storeTotal: 51, personnelOffset: offset, personnelTotal: 51 }) })
    })

    try {
      await page.goto(`/store/kpis?periodStart=2026-07-01${personnel ? '&view=personnel' : ''}`)
      const region = page.getByRole('region', { name: personnel ? 'Personel KPI' : 'Tüm Mağazalar', exact: true })
      const pager = region.locator('.region-performance-pager')
      const next = pager.getByRole('button', { name: 'Sonraki', exact: true })
      await expect(pager).toContainText(personnel ? '1 / 2' : '1–50 / 51')
      await next.click()
      await expect(next).toBeDisabled()
      await expect(pager).toContainText(personnel ? '1 / 2' : '1–50 / 51')
      releasePage()
      await expect(pager).toContainText(personnel ? '2 / 2' : '51–51 / 51')
    } finally {
      releasePage()
    }
  })
}

function rankingsFixture(options: {
  storeOffset?: number
  storeTotal?: number
  managerOffset?: number
  managerTotal?: number
  personnelOffset?: number
  personnelTotal?: number
} = {}) {
  const storeOffset = options.storeOffset ?? 0
  const managerOffset = options.managerOffset ?? 0
  const personnelOffset = options.personnelOffset ?? 0
  const store = {
    subject: 'store', storeId: storeOffset ? storeIds[1] : storeIds[0],
    storeName: storeOffset ? 'Bursa Marka Park' : 'İstanbul MOI AVM',
    regionId: 'region-contract-1', regionName: 'Marmara',
    regionManagerUserId: 'manager-contract-1', regionManagerName: 'Onur Kaytan',
    rank: storeOffset + 1, population: options.storeTotal ?? 1, scoreValue: 88,
    visibility: 'detail', metrics: [],
  }
  const person = {
    subject: 'personnel', employeeId: `employee-${personnelOffset}`, displayName: `Personel ${personnelOffset + 1}`,
    storeId: storeIds[0], storeName: 'İstanbul MOI AVM', rank: personnelOffset + 1,
    population: options.personnelTotal ?? 1, scoreValue: 82, visibility: 'detail', canOpenProfile: false, metrics: [],
  }
  return {
    access: { canSeeGlobalDetails: true, canSeeManagedStorePersonnelDetails: true, globalMode: 'full' },
    availablePeriods: [{ periodEnd: '2026-07-31', periodStart: '2026-07-01', periodType: 'monthly' }],
    filters: { regionManagers: [], regions: [], stores: [] },
    personnelLeaderboard: {
      currentEmployee: null, items: [person], managedStorePersonnel: [person],
      meta: { limit: 50, offset: personnelOffset, total: options.personnelTotal ?? 1 },
      managedStorePersonnelMeta: { limit: 50, offset: personnelOffset, total: options.personnelTotal ?? 1 },
    },
    reference: { personnel: { averageScore: null, metrics: [] }, store: { averageScore: null, metrics: [] } },
    regionManagerLeaderboard: {
      items: [{ userId: `manager-${managerOffset}`, displayName: managerOffset ? 'Deniz Demir' : 'Onur Kaytan', storeCount: 1, riskStoreCount: 0, averageScore: 88 }],
      meta: { limit: 20, offset: managerOffset, total: options.managerTotal ?? 1 },
      riskItems: [], riskMeta: { limit: 20, offset: 0, total: 0 }, riskStoreCount: 0,
    },
    scopeSummary: { activePersonnelCount: options.personnelTotal ?? 1, storeCount: options.storeTotal ?? 1 },
    source: { mode: 'live', periodType: 'monthly', periodStart: '2026-07-01', periodEnd: '2026-07-31' },
    storeLeaderboard: {
      currentStore: store, items: [store], meta: { limit: 50, offset: storeOffset, total: options.storeTotal ?? 1 },
      currentStoreComparisons: [{ code: 'score', region: { rank: 1, population: 2 }, turkey: { rank: 1, population: 10 } }],
    },
  }
}
