import { expect, test, type Page } from './test-fixtures'
import { expectNoCriticalAxeViolations } from './axe-test-utils'
import {
  installGenericStoreApiFallbacks,
  installStoreContractSession,
  storeIds,
} from './store-page-contract-fixtures'

test('store KPI score source renders configured GSM and checklist contributors without raw metric ids', async ({ page }) => {
  await installStoreContractSession(page, 'storeManager')
  await installGenericStoreApiFallbacks(page)
  await routeKpiContractApi(page)

  await page.goto('/store/kpis')

  await expect(page.getByRole('heading', { name: 'Mağaza KPI katkı kırılımı' })).toBeVisible()
  await expect(page.getByText('GSM Onayı').first()).toBeVisible()
  await expect(page.getByText('BM Checklist').first()).toBeVisible()
  await expect(page.getByText('VM Checklist').first()).toBeVisible()
  const gsmRow = page.getByRole('row', { name: /GSM Onay/ })
  await expect(gsmRow.getByText('%56,2')).toBeVisible()
  await expect(page.locator('body')).not.toContainText('gsm_approval')
  await expect(page.locator('body')).not.toContainText('TARGET_ACHIEVEMENT')
})

test('store KPI period picker opens as floating month-year picker without pushing content', async ({ page }) => {
  await installStoreContractSession(page, 'storeManager')
  await installGenericStoreApiFallbacks(page)
  await routeKpiContractApi(page)

  await page.goto('/store/kpis')

  const sourceHeading = page.getByRole('heading', { name: 'Mağaza KPI katkı kırılımı' })
  await expect(sourceHeading).toBeVisible()
  const before = await sourceHeading.boundingBox()
  expect(before).not.toBeNull()

  await page.getByRole('button', { name: /KPI dönemi/ }).first().click()

  const pickerDialog = page.getByRole('dialog')
  await expect(pickerDialog.getByText('Dönem seç')).toBeVisible()
  await expect(pickerDialog.getByRole('button', { name: 'Haz' })).toBeVisible()
  await expect(pickerDialog.getByRole('button', { name: 'Gün' })).toHaveCount(0)
  const after = await sourceHeading.boundingBox()
  expect(after).not.toBeNull()
  expect(Math.abs((after?.y ?? 0) - (before?.y ?? 0))).toBeLessThanOrEqual(2)
})

test('KPI-FR-001 / AC-KPI-001 Report Viewer drills Region Manager to store with period preserved and no mutation', async ({ page }) => {
  await installStoreContractSession(page, 'reportViewer')
  await installGenericStoreApiFallbacks(page)
  await routeKpiContractApi(page)
  const mutations: string[] = []

  await page.route('**/api/reports/rankings**', async (route) => {
    if (route.request().method() !== 'GET') mutations.push(route.request().method())
    await route.fulfill({ json: createCompanyRankingsFixture() })
  })

  await page.goto('/store/kpis?periodStart=2026-07-01')

  const company = page.getByTestId('store-kpis-company-overview')
  await expect(company).toBeVisible()
  await expect(company.getByText('Onur Kaytan')).toBeVisible()
  await expect(page.getByTestId('store-kpi-company-store-selector')).toHaveCount(0)
  await company.getByRole('button', { name: /Onur Kaytan/ }).click()
  const storeLink = company.getByRole('link', { name: /İstanbul MOI AVM/ })
  await expect(storeLink).toBeVisible()
  await expect(storeLink).toHaveAttribute('href', /storeId=store-contract-balikesir/)
  await expect(storeLink).toHaveAttribute('href', /periodStart=2026-07-01/)
  expect(mutations).toEqual([])
})

test('SH-FR-006 / AC-003 KPI decision rail filters locally without refetching the workspace', async ({ page }) => {
  await installStoreContractSession(page, 'storeManager')
  await installGenericStoreApiFallbacks(page)
  let highlightReads = 0
  await routeKpiContractApi(page, {
    onHighlightRead: () => {
      highlightReads += 1
    },
  })

  await page.goto('/store/kpis?periodStart=2026-07-01')
  await expect(page.getByRole('heading', { name: 'Mağaza KPI katkı kırılımı' })).toBeVisible()
  const initialReads = highlightReads

  const targetRail = page.getByRole('button', { name: /Hedef gerçekleşme/ }).first()
  await targetRail.click()

  await expect(targetRail).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('row', { name: /Fiş başı ürün/ })).toHaveCount(0)
  expect(highlightReads).toBe(initialReads)
})

test('SH-FR-008 Region Manager can reach the next bounded store page', async ({ page }) => {
  await installStoreContractSession(page, 'regionManager')
  await installGenericStoreApiFallbacks(page)
  await routeKpiContractApi(page)
  const offsets: string[] = []

  await page.route('**/api/reports/rankings**', async (route) => {
    const url = new URL(route.request().url())
    offsets.push(url.searchParams.get('offset') ?? '0')
    const offset = Number(url.searchParams.get('offset') ?? 0)
    const fixture = createCompanyRankingsFixture()
    await route.fulfill({
      json: {
        ...fixture,
        storeLeaderboard: {
          ...fixture.storeLeaderboard,
          items: offset === 0 ? fixture.storeLeaderboard.items : [fixture.storeLeaderboard.items[0]],
          meta: { limit: 50, offset, total: 51 },
        },
      },
    })
  })

  await page.goto('/store/kpis?periodStart=2026-07-01')
  await expect(page.getByTestId('store-kpis-region-overview')).toBeVisible()
  await page.getByTestId('store-kpis-region-next-page').click()
  await expect.poll(() => offsets).toContain('50')
})

test('SH-FR-006/007 mobile Region Manager sort is local and uses the desktop sort contract', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await installStoreContractSession(page, 'regionManager')
  await installGenericStoreApiFallbacks(page)
  await routeKpiContractApi(page)
  let rankingReads = 0
  await page.route('**/api/reports/rankings**', async (route) => {
    rankingReads += 1
    await route.fulfill({ json: createCompanyRankingsFixture() })
  })

  await page.goto('/store/kpis?periodStart=2026-07-01')
  await expect(page.getByTestId('store-kpis-region-overview')).toBeVisible()
  const initialReads = rankingReads
  const mobileSort = page.getByRole('button', { name: 'UPT sütununa göre sırala' })
  await mobileSort.click()
  await expect(mobileSort).toHaveAttribute('aria-label', 'UPT sütununa göre sırala')
  expect(rankingReads).toBe(initialReads)
})

test('EC-001 mixed Report Viewer role remains on the read-only company presentation', async ({ page }) => {
  await installStoreContractSession(page, 'reportViewer', {
    roleCodes: ['REGION_MANAGER', 'REPORT_VIEWER'],
  })
  await installGenericStoreApiFallbacks(page)
  await routeKpiContractApi(page)
  const mutations: string[] = []

  await page.route('**/api/reports/rankings**', async (route) => {
    if (route.request().method() !== 'GET') mutations.push(route.request().method())
    await route.fulfill({ json: createCompanyRankingsFixture() })
  })

  await page.goto('/store/kpis?periodStart=2026-07-01')
  await expect(page.getByTestId('store-kpis-company-overview')).toBeVisible()
  await expect(page.getByTestId('store-kpis-region-overview')).toHaveCount(0)
  await expect(page.getByTestId('store-kpi-company-store-selector')).toHaveCount(0)
  expect(mutations).toEqual([])
})

for (const scenario of [
  { persona: 'storeManager' as const, url: '/store/kpis?periodStart=2026-07-01' },
  { persona: 'regionManager' as const, url: `/store/kpis?storeId=${storeIds[0]}&periodStart=2026-07-01` },
  { persona: 'reportViewer' as const, url: `/store/kpis?storeId=${storeIds[0]}&periodStart=2026-07-01` },
]) {
  test(`KPI-FR-001/004 ${scenario.persona} Profile Git preserves the selected month`, async ({ page }) => {
    await installStoreContractSession(page, scenario.persona)
    await installGenericStoreApiFallbacks(page)
    await routeKpiContractApi(page)
    await page.route('**/api/reports/rankings**', async (route) => {
      await route.fulfill({ json: createPersonnelRankingsFixture() })
    })

    await page.goto(scenario.url)
    await page.getByRole('tab', { name: /Personel KPI/ }).click()
    const profileLink = page.getByRole('link', { name: /Profile Git/ })
    await expect(profileLink).toBeVisible()
    await expect(profileLink).toHaveAttribute('href', /periodStart=2026-07-01/)
    await expect(profileLink).toHaveAttribute('href', /\/store\/personnel\/employee-contract-1/)
  })
}

test('SH-FR-014 personnel null metrics stay unavailable instead of becoming zero', async ({ page }) => {
  await installStoreContractSession(page, 'storeManager')
  await installGenericStoreApiFallbacks(page)
  await routeKpiContractApi(page)
  await page.route('**/api/reports/rankings**', async (route) => {
    await route.fulfill({ json: createPersonnelRankingsFixture({ nullMetrics: true }) })
  })

  await page.goto('/store/kpis?periodStart=2026-07-01')
  await page.getByRole('tab', { name: /Personel KPI/ }).click()
  const row = page.getByRole('row', { name: /Süleyman Öztürk/ })
  await expect(row).toBeVisible()
  await expect(row).toContainText('-')
  await expect(row).not.toContainText('₺0')
})

test('KPI-FR-002 missing sources keep all seven locked rows in order', async ({ page }) => {
  await installStoreContractSession(page, 'storeManager')
  await installGenericStoreApiFallbacks(page)
  await routeKpiContractApi(page)
  await page.unroute('**/api/reports/store-kpi-highlights**')
  await page.route('**/api/reports/store-kpi-highlights**', async (route) => {
    const fixture = createStoreKpiHighlightsFixture()
    await route.fulfill({
      json: {
        ...fixture,
        metrics: fixture.metrics.filter((metric) => !['gsm_approval', 'BM_CHECKLIST'].includes(metric.code)),
      },
    })
  })

  await page.goto('/store/kpis?periodStart=2026-07-01')
  await expect(page.getByRole('heading', { name: 'Mağaza KPI katkı kırılımı' })).toBeVisible()
  const rows = await page.locator('table tbody tr').allTextContents()
  const labels = ['Hedef gerçekleşme', 'Fiş başı ürün', 'Ortalama sepet', 'CR', 'GSM Onayı', 'BM Checklist', 'VM Checklist']
  expect(labels.map((label) => rows.findIndex((row) => row.toLocaleLowerCase('tr').includes(label.toLocaleLowerCase('tr'))))).toEqual([0, 1, 2, 3, 4, 5, 6])
  await expect(page.getByRole('row', { name: /GSM Onayı/ })).toContainText('Veri yok')
})

test('SH-FR-008 Store Manager can reach personnel beyond the first bounded page', async ({ page }) => {
  await installStoreContractSession(page, 'storeManager')
  await installGenericStoreApiFallbacks(page)
  await routeKpiContractApi(page)
  const managedOffsets: string[] = []
  await page.route('**/api/reports/rankings**', async (route) => {
    const url = new URL(route.request().url())
    const offset = url.searchParams.get('managedPersonnelOffset') ?? '0'
    managedOffsets.push(offset)
    const fixture = createPersonnelRankingsFixture()
    await route.fulfill({
      json: {
        ...fixture,
        personnelLeaderboard: {
          ...fixture.personnelLeaderboard,
          managedStorePersonnelMeta: { limit: 50, offset: Number(offset), total: 51 },
        },
      },
    })
  })

  await page.goto('/store/kpis?periodStart=2026-07-01')
  await page.getByRole('tab', { name: /Personel KPI/ }).click()
  await page.getByRole('navigation', { name: 'Personel sayfaları' }).getByRole('button', { name: 'Sonraki' }).click()
  await expect.poll(() => managedOffsets).toContain('50')
})

test('SH-FR-009/014 authoritative partial KPI state stays distinct from ordinary missing data', async ({ page }) => {
  await installStoreContractSession(page, 'storeManager')
  await installGenericStoreApiFallbacks(page)
  const fixture = createStoreKpiHighlightsFixture()
  const partialReads: boolean[] = []
  page.on('response', async (response) => {
    if (!response.url().includes('/api/reports/store-kpi-highlights')) return
    const body = await response.json().catch(() => null) as { partial?: { isPartial?: boolean } } | null
    partialReads.push(body?.partial?.isPartial === true)
  })
  await routeKpiContractApi(page, { highlightResponse: { ...fixture, partial: {
      isPartial: true,
      missingMetricCodes: ['gsm_approval'], missingMetricLabels: ['GSM Onayı'],
      pendingNormalizationCodes: ['UPT'], pendingNormalizationLabels: ['Fiş başı ürün'],
    } } })

  await page.goto('/store/kpis?periodStart=2026-07-01')
  await expect.poll(() => partialReads).toContain(true)
  const partialState = page.getByRole('status', { name: 'Mağaza skoru henüz tam değil' })
  await expect(partialState).toContainText('GSM Onayı')
  await expect(partialState).toContainText('Fiş başı ürün')
})

test('KPI-FR-005 trend transport error is retryable and never rendered as a no-data month', async ({ page }) => {
  await installStoreContractSession(page, 'storeManager')
  await installGenericStoreApiFallbacks(page)
  await routeKpiContractApi(page)
  let failedReads = 0
  await page.route('**/api/reports/store-kpi-highlights**', async (route) => {
    const url = new URL(route.request().url())
    if (url.searchParams.get('periodStart') === '2026-06-01') {
      failedReads += 1
      await route.fulfill({ status: 503, json: { message: 'temporary trend failure' } })
      return
    }
    await route.fulfill({ json: createStoreKpiHighlightsFixture() })
  })

  await page.goto('/store/kpis?periodStart=2026-07-01')
  const trend = page.getByRole('region', { name: 'Aylık mağaza skor trendi' })
  await expect(trend.getByText('Aylık trend alınamadı')).toBeVisible()
  await expect(trend.getByText('Haziran').locator('..')).toContainText('Yüklenemedi')
  const readsBeforeRetry = failedReads
  await trend.getByRole('button', { name: 'Tekrar dene' }).click()
  await expect.poll(() => failedReads).toBeGreaterThan(readsBeforeRetry)
})

test('SH-FR-009 core background refresh failure retains the complete KPI workspace', async ({ page }) => {
  await installStoreContractSession(page, 'storeManager')
  await installGenericStoreApiFallbacks(page)
  await routeKpiContractApi(page)
  let highlightReads = 0
  await page.route('**/api/reports/store-kpi-highlights**', async (route) => {
    highlightReads += 1
    if (highlightReads > 1) {
      await route.fulfill({ status: 503, json: { message: 'temporary refresh failure' } })
      return
    }
    await route.fulfill({ json: createStoreKpiHighlightsFixture() })
  })

  await page.goto('/store/kpis?periodStart=2026-07-01')
  const contributionTitle = page.getByRole('heading', { name: 'Mağaza KPI katkı kırılımı' })
  await expect(contributionTitle).toBeVisible()
  await page.getByRole('button', { name: 'Veriyi yenile' }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'Önceki görünüm korunuyor' })).toBeVisible()
  await expect(contributionTitle).toBeVisible()
})

test('SH-FR-005/006 Report Viewer risk rail filters the complete company hierarchy locally', async ({ page }) => {
  await installStoreContractSession(page, 'reportViewer')
  await installGenericStoreApiFallbacks(page)
  await routeKpiContractApi(page)
  let rankingReads = 0
  await page.route('**/api/reports/rankings**', async (route) => {
    rankingReads += 1
    const fixture = createCompanyRankingsFixture()
    await route.fulfill({
      json: {
        ...fixture,
        regionManagerLeaderboard: {
          ...fixture.regionManagerLeaderboard,
          meta: { ...fixture.regionManagerLeaderboard.meta, total: 7 },
          riskMeta: { ...fixture.regionManagerLeaderboard.riskMeta, total: 1 },
        },
      },
    })
  })

  await page.goto('/store/kpis?periodStart=2026-07-01')
  await expect(page.getByText('Onur Kaytan')).toBeVisible()
  const managerMetric = page.getByRole('button', { name: /Bölge yöneticisi/ })
  await expect(managerMetric).toContainText('7')
  const readsBeforeFilter = rankingReads
  await page.getByRole('button', { name: /75 puanın altında/ }).click()
  await expect(page.getByText('Onur Kaytan')).toBeVisible()
  await expect(managerMetric).toContainText('7')
  await page.waitForTimeout(250)
  expect(rankingReads).toBe(readsBeforeFilter)
})

test('SH-FR-008 company sort and period transitions reset parent and nested pagination', async ({ page }) => {
  await installStoreContractSession(page, 'reportViewer')
  await installGenericStoreApiFallbacks(page)
  await routeKpiContractApi(page)
  const parentOffsets: string[] = []
  const managerReads: Array<{ offset: string; period: string }> = []
  await page.route('**/api/reports/rankings**', async (route) => {
    const url = new URL(route.request().url())
    const fixture = createCompanyRankingsFixture()
    const withPeriods = {
      ...fixture,
      availablePeriods: [
        { periodEnd: '2026-06-30', periodStart: '2026-06-01', periodType: 'monthly' as const },
        ...fixture.availablePeriods,
      ],
    }
    if (url.searchParams.get('regionManagerUserId')) {
      managerReads.push({
        offset: url.searchParams.get('offset') ?? '0',
        period: url.searchParams.get('periodStart') ?? '',
      })
      await route.fulfill({
        json: {
          ...withPeriods,
          storeLeaderboard: {
            ...withPeriods.storeLeaderboard,
            meta: { limit: 50, offset: Number(url.searchParams.get('offset') ?? 0), total: 51 },
          },
        },
      })
      return
    }

    parentOffsets.push(url.searchParams.get('regionManagerOffset') ?? '0')
    await route.fulfill({
      json: {
        ...withPeriods,
        regionManagerLeaderboard: {
          ...withPeriods.regionManagerLeaderboard,
          meta: { limit: 20, offset: Number(url.searchParams.get('regionManagerOffset') ?? 0), total: 21 },
        },
      },
    })
  })

  await page.goto('/store/kpis?periodStart=2026-07-01')
  await page.getByRole('button', { name: 'Sonraki' }).click()
  await expect.poll(() => parentOffsets).toContain('20')
  await page.getByRole('button', { name: /Mağaza sayısı/ }).click()
  await expect(page.getByText('1 / 2 sayfa')).toBeVisible()

  await page.getByRole('button', { name: /Onur Kaytan/ }).click()
  await page.getByRole('navigation', { name: /Bölge müdürü mağaza sayfaları/ }).getByRole('button', { name: 'Sonraki' }).click()
  await expect.poll(() => managerReads.some((read) => read.offset === '50')).toBe(true)
  await page.getByRole('button', { name: /Şirket KPI dönemi/ }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Haz' }).click()
  await page.getByRole('button', { name: /Onur Kaytan/ }).click()
  await expect.poll(() => managerReads.at(-1)).toEqual({ offset: '0', period: '2026-06-01' })
})

test('KPI-FR-001 unassigned company stores remain drillable for Report Viewer', async ({ page }) => {
  await installStoreContractSession(page, 'reportViewer')
  await installGenericStoreApiFallbacks(page)
  await routeKpiContractApi(page)
  const unassignedValues: string[] = []
  await page.route('**/api/reports/rankings**', async (route) => {
    const url = new URL(route.request().url())
    const fixture = createCompanyRankingsFixture()
    if (url.searchParams.get('regionManagerUnassigned') === 'true') {
      unassignedValues.push('true')
      await route.fulfill({ json: { ...fixture, storeLeaderboard: { ...fixture.storeLeaderboard, items: [{ ...fixture.storeLeaderboard.items[0], regionManagerUserId: null, regionManagerName: null }] } } })
      return
    }
    await route.fulfill({ json: { ...fixture, regionManagerLeaderboard: { ...fixture.regionManagerLeaderboard, items: [{ userId: null, displayName: null, storeCount: 1, riskStoreCount: 0, averageScore: 86 }], meta: { limit: 20, offset: 0, total: 1 } } } })
  })

  await page.goto('/store/kpis?periodStart=2026-07-01')
  await page.getByRole('button', { name: /Bölge yöneticisi bilgisi yok/ }).click()
  await expect.poll(() => unassignedValues).toContain('true')
  await expect(page.getByRole('link', { name: /İstanbul MOI AVM/ })).toBeVisible()
})

test('SH-FR-009 background region paging error retains prior rows and exposes retry', async ({ page }) => {
  await installStoreContractSession(page, 'regionManager')
  await installGenericStoreApiFallbacks(page)
  await routeKpiContractApi(page)
  let failedPageReads = 0
  await page.route('**/api/reports/rankings**', async (route) => {
    const url = new URL(route.request().url())
    if (url.searchParams.get('offset') === '50') {
      failedPageReads += 1
      await route.fulfill({ status: 503, json: { message: 'temporary page failure' } })
      return
    }
    const fixture = createCompanyRankingsFixture()
    await route.fulfill({ json: { ...fixture, storeLeaderboard: { ...fixture.storeLeaderboard, meta: { limit: 50, offset: 0, total: 51 } } } })
  })

  await page.goto('/store/kpis?periodStart=2026-07-01')
  const regionOverview = page.getByTestId('store-kpis-region-overview')
  await expect(regionOverview.getByText('İstanbul MOI AVM').first()).toBeVisible()
  await page.getByTestId('store-kpis-region-next-page').click()
  await expect.poll(() => failedPageReads, { timeout: 15_000 }).toBeGreaterThanOrEqual(3)
  const backgroundError = page.getByRole('alert').filter({ hasText: 'Önceki görünüm korunuyor' })
  await expect(backgroundError).toBeVisible()
  await expect(regionOverview.getByText('İstanbul MOI AVM').first()).toBeVisible()
  const readsBeforeRetry = failedPageReads
  await backgroundError.getByRole('button', { name: 'Tekrar dene' }).click()
  await expect.poll(() => failedPageReads).toBeGreaterThan(readsBeforeRetry)
})

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1024, height: 768 },
  { width: 390, height: 844 },
  { width: 320, height: 844 },
]) {
  test(`SH-FR-003/004/007 KPI visual contract ${viewport.width}x${viewport.height}`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport)
    await installStoreContractSession(page, 'regionManager')
    await installGenericStoreApiFallbacks(page)
    await routeKpiContractApi(page)
    await page.route('**/api/reports/rankings**', async (route) => {
      await route.fulfill({ json: createCompanyRankingsFixture() })
    })
    const consoleErrors: string[] = []
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text())
    })

    await page.goto('/store/kpis?periodStart=2026-07-01')
    await expect(page.getByTestId('store-kpis-region-overview')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Bölge mağazaları' })).toBeVisible()

    const overflow = await page.evaluate(() => ({
      body: document.body.scrollWidth - document.body.clientWidth,
      root: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }))
    expect(overflow.body).toBeLessThanOrEqual(0)
    expect(overflow.root).toBeLessThanOrEqual(0)
    expect(consoleErrors).toEqual([])

    if (viewport.width === 1440) {
      await expectNoCriticalAxeViolations(page)
      await page.getByRole('button', { name: 'Bölge KPI dönemi' }).click()
      await expect(page.getByRole('dialog')).toBeVisible()
      await expectNoCriticalAxeViolations(page)
      await page.keyboard.press('Escape')
    }

    if (viewport.width <= 390) {
      const inputFontSizes = await page.locator('input').evaluateAll((inputs) =>
        inputs.map((input) => Number.parseFloat(window.getComputedStyle(input).fontSize)),
      )
      expect(inputFontSizes.every((size) => size >= 16)).toBe(true)
    }

    const capturePath = process.env.KPI_CAPTURE_DIR
      ? `${process.env.KPI_CAPTURE_DIR}/kpi-${viewport.width}x${viewport.height}.png`
      : undefined
    const screenshot = await page.screenshot({ fullPage: true, path: capturePath })
    await testInfo.attach(`kpi-${viewport.width}x${viewport.height}`, {
      body: screenshot,
      contentType: 'image/png',
    })
  })
}

async function routeKpiContractApi(
  page: Page,
  options: {
    highlightResponse?: ReturnType<typeof createStoreKpiHighlightsFixture>
    onHighlightRead?: () => void
  } = {},
) {
  await page.route('**/api/reports/kpi-config', async (route) => {
    await route.fulfill({ json: createKpiConfigFixture() })
  })
  await page.route('**/api/reports/store-kpi-highlights**', async (route) => {
    options.onHighlightRead?.()
    await route.fulfill({ json: options.highlightResponse ?? createStoreKpiHighlightsFixture() })
  })
  await page.route('**/api/reports/rankings**', async (route) => {
    await route.fulfill({ json: createEmptyRankingsFixture() })
  })
}

function createKpiConfigFixture() {
  const metrics = [
    profileMetric('TARGET_ACHIEVEMENT', 'Hedef gerçekleşme', 35, ['STORE_SALES', 'SALES_TARGET_ACHIEVEMENT']),
    profileMetric('UPT', 'Fiş başı ürün', 15),
    profileMetric('ATV', 'Ortalama sepet', 15),
    profileMetric('CR', 'CR', 20),
    profileMetric('GSM_ONAY', 'GSM Onayı', 5, ['gsm_approval']),
    profileMetric('BM_CHECKLIST', 'BM Checklist', 5),
    profileMetric('VM_CHECKLIST', 'VM Checklist', 5),
  ]

  return {
    gradingBands: [
      { code: 'strong', emoji: '', label: 'Güçlü', minScore: 80, tone: 'calm' },
    ],
    metadata: {
      effectiveFrom: null,
      effectiveTo: null,
      kpiConfigVersionId: null,
      publishedAt: null,
      publishedBy: null,
      versionNo: null,
    },
    ownershipMatrix: [],
    personnelProfile: {
      futureMetricRule: 'Yeni metrikler katalog üzerinden eklenir.',
      metrics: [],
      profileCode: 'personnel',
      summary: 'Personel skoru',
      title: 'Personel skoru',
    },
    storeProfile: {
      futureMetricRule: 'Yeni metrikler katalog üzerinden eklenir.',
      metrics,
      profileCode: 'store',
      summary: 'Mağaza skoru',
      title: 'Mağaza skoru',
    },
  }
}

function createStoreKpiHighlightsFixture() {
  return {
    availablePeriods: [
      { periodEnd: '2026-06-30', periodStart: '2026-06-01', periodType: 'monthly' },
      { periodEnd: '2026-07-31', periodStart: '2026-07-01', periodType: 'monthly' },
    ],
    metrics: [
      metricRow('TARGET_ACHIEVEMENT', 'Hedef gerçekleşme', 3_049_207.79, 2_750_000, 1.1088, 38.8),
      metricRow('UPT', 'Fiş başı ürün', 4.15, 3.09, 1.34, 18),
      metricRow('ATV', 'Ortalama sepet', 5503.99, 3628.54, 1.52, 18),
      metricRow('CR', 'CR', 0.1834, 0.1405, 1.31, 24),
      metricRow('gsm_approval', 'GSM Onayı', 40, 56.2, 0.4, 2, { targetValue: null }),
      metricRow('BM_CHECKLIST', 'BM Checklist', 80, 100, 0.8, 4),
      metricRow('VM_CHECKLIST', 'VM Checklist', 90, 100, 0.9, 4.5),
    ],
    partial: {
      isPartial: false,
      missingMetricCodes: [],
      missingMetricLabels: [],
      pendingNormalizationCodes: [],
      pendingNormalizationLabels: [],
    },
    period: { periodEnd: '2026-07-31', periodStart: '2026-07-01' },
    score: { matchedMetrics: 7, totalMetrics: 7, value: 92 },
    source: { mode: 'live', periodType: 'monthly', snapshotDate: null, snapshotRunId: null },
    store: { storeId: storeIds[0], storeName: 'İstanbul MOI AVM' },
  }
}

function createEmptyRankingsFixture() {
  return {
    access: {
      canSeeGlobalDetails: false,
      canSeeManagedStorePersonnelDetails: true,
      globalMode: 'summary',
    },
    availablePeriods: [
      { periodEnd: '2026-07-31', periodStart: '2026-07-01', periodType: 'monthly' },
    ],
    filters: { regionManagers: [], regions: [], stores: [] },
    personnelLeaderboard: {
      currentEmployee: null,
      items: [],
      managedStorePersonnel: [],
      managedStorePersonnelMeta: { limit: 50, offset: 0, total: 0 },
      meta: { limit: 100, offset: 0, total: 0 },
    },
    reference: {
      personnel: { averageScore: null, metrics: [] },
      store: { averageScore: null, metrics: [] },
    },
    scopeSummary: { activePersonnelCount: 0, storeCount: 1 },
    regionManagerLeaderboard: {
      items: [],
      meta: { limit: 20, offset: 0, total: 0 },
      riskItems: [],
      riskMeta: { limit: 20, offset: 0, total: 0 },
      riskStoreCount: 0,
    },
    source: {
      mode: 'live',
      periodEnd: '2026-07-31',
      periodStart: '2026-07-01',
      periodType: 'monthly',
    },
    storeLeaderboard: {
      currentStore: null,
      items: [],
      meta: { limit: 100, offset: 0, total: 0 },
    },
  }
}

function createCompanyRankingsFixture() {
  const stores = [
    {
      subject: 'store',
      storeId: storeIds[0],
      storeName: 'İstanbul MOI AVM',
      regionId: 'region-1',
      regionName: 'Marmara',
      regionManagerUserId: 'rm-1',
      regionManagerName: 'Onur Kaytan',
      rank: 1,
      population: 2,
      scoreValue: 86,
      visibility: 'detail',
      metrics: [],
    },
    {
      subject: 'store',
      storeId: storeIds[1],
      storeName: 'Bursa Marka Park',
      regionId: 'region-1',
      regionName: 'Marmara',
      regionManagerUserId: 'rm-1',
      regionManagerName: 'Onur Kaytan',
      rank: 2,
      population: 2,
      scoreValue: 70,
      visibility: 'detail',
      metrics: [],
    },
  ]

  return {
    ...createEmptyRankingsFixture(),
    availablePeriods: [
      { periodEnd: '2026-07-31', periodStart: '2026-07-01', periodType: 'monthly' },
    ],
    filters: {
      regionManagers: [{ id: 'rm-1', label: 'Onur Kaytan' }],
      regions: [{ id: 'region-1', label: 'Marmara' }],
      stores: stores.map((store) => ({ id: store.storeId, label: store.storeName })),
    },
    regionManagerLeaderboard: {
      items: [{
        userId: 'rm-1',
        displayName: 'Onur Kaytan',
        storeCount: 2,
        riskStoreCount: 1,
        averageScore: 78,
      }],
      meta: { limit: 20, offset: 0, total: 1 },
      riskItems: [{
        userId: 'rm-1',
        displayName: 'Onur Kaytan',
        storeCount: 2,
        riskStoreCount: 1,
        averageScore: 78,
      }],
      riskMeta: { limit: 20, offset: 0, total: 1 },
      riskStoreCount: 1,
    },
    scopeSummary: { activePersonnelCount: 12, storeCount: 2 },
    source: {
      mode: 'live',
      periodEnd: '2026-07-31',
      periodStart: '2026-07-01',
      periodType: 'monthly',
    },
    storeLeaderboard: {
      currentStore: null,
      items: stores,
      meta: { limit: 50, offset: 0, total: 2 },
    },
  }
}

function createPersonnelRankingsFixture(options: { nullMetrics?: boolean } = {}) {
  const actual = options.nullMetrics ? null : 4.2
  const personnel = {
    subject: 'personnel',
    employeeId: 'employee-contract-1',
    displayName: 'Süleyman Öztürk',
    storeId: storeIds[0],
    storeName: 'İstanbul MOI AVM',
    regionId: 'region-1',
    regionName: 'Marmara',
    regionManagerUserId: 'rm-1',
    regionManagerName: 'Onur Kaytan',
    rank: 1,
    population: 1,
    scoreValue: 86,
    visibility: 'detail',
    canOpenProfile: true,
    metrics: [
      { code: 'TARGET_ACHIEVEMENT', label: 'Hedef gerçekleşme', actualValue: options.nullMetrics ? null : 110, targetValue: 100, benchmarkValue: 100, contributionValue: options.nullMetrics ? null : 35 },
      { code: 'UPT', label: 'Fiş başı ürün', actualValue: actual, targetValue: 3.1, benchmarkValue: 3.1, contributionValue: options.nullMetrics ? null : 15 },
      { code: 'ATV', label: 'Ortalama sepet', actualValue: options.nullMetrics ? null : 4300, targetValue: 3500, benchmarkValue: 3500, contributionValue: options.nullMetrics ? null : 15 },
    ],
  }
  const base = createEmptyRankingsFixture()
  return {
    ...base,
    personnelLeaderboard: {
      currentEmployee: null,
      items: [personnel],
      managedStorePersonnel: [personnel],
      managedStorePersonnelMeta: { limit: 50, offset: 0, total: 1 },
      meta: { limit: 50, offset: 0, total: 1 },
    },
  }
}

function profileMetric(code: string, label: string, weightPercent: number, aliases: string[] = []) {
  return {
    aliases,
    benchmarkSource: code.includes('CHECKLIST') ? 'CHECKLIST_SCORE' : code === 'TARGET_ACHIEVEMENT' ? 'TARGET' : 'TURKEY_AVERAGE',
    capRatio: 1.2,
    code,
    direction: 'HIGHER_IS_BETTER',
    label,
    ownerRole: 'STORE_MANAGER',
    scoreBehavior: code === 'GSM_ONAY' ? 'warning_first' : 'task_candidate',
    weightPercent,
  }
}

function metricRow(
  code: string,
  label: string,
  actualValue: number,
  benchmarkValue: number,
  achievementRate: number,
  scoreContribution: number,
  options: { targetValue?: number | null } = {},
) {
  const targetValue = Object.prototype.hasOwnProperty.call(options, 'targetValue')
    ? options.targetValue
    : benchmarkValue

  return {
    achievementRate,
    actualRatio: achievementRate,
    actualValue,
    benchmarkSource: code.includes('CHECKLIST') ? 'CHECKLIST_SCORE' : 'TURKEY_AVERAGE',
    benchmarkValue,
    capRatio: 1.2,
    code,
    dataStatus: 'reported',
    isCapped: false,
    label,
    scoredRatio: achievementRate,
    scoreContribution,
    scoreStatus: 'scored',
    statusBand: 'on_track',
    targetValue,
    weightPercent: code === 'TARGET_ACHIEVEMENT' ? 35 : code === 'CR' ? 20 : code === 'GSM_ONAY' || code === 'gsm_approval' || code.includes('CHECKLIST') ? 5 : 15,
  }
}
