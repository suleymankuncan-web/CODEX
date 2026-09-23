import { expect, test, type Page } from './test-fixtures'
import { expectNoCriticalAxeViolations } from './axe-test-utils'
import { myPerformanceFixture } from './store-surfaces-profile-fixtures'
import { createEmptyRankingsFixture } from './store-kpis-empty-rankings-fixture'
import {
  installGenericStoreApiFallbacks,
  installStoreContractSession,
  storeIds,
} from './store-page-contract-fixtures'
test('store manager uses shadcn chart and opens every KPI with scoped ranks and period comparisons', async ({ page }) => {
  await installStoreContractSession(page, 'storeManager')
  await installGenericStoreApiFallbacks(page)
  await routeKpiContractApi(page)
  await page.route('**/api/reports/store-kpi-highlights**', async route => {
    const start = new URL(route.request().url()).searchParams.get('periodStart')
    const fixture = createStoreKpiHighlightsFixture()
    const baseline = start !== '2026-07-01'
    const previousYear = start === '2025-07-01'
    await route.fulfill({json: {...fixture, score: {...fixture.score, value: previousYear ? 1.2 : baseline ? .8 : .96},
      metrics: fixture.metrics.map(metric => ({...metric, actualValue: metric.actualValue === null ? null : previousYear ? metric.actualValue * 2 : baseline ? metric.actualValue / 2 : metric.actualValue})),
      availablePeriods: [{periodType:'monthly',periodStart:'2026-06-01T00:00:00.000Z',periodEnd:'2026-06-30'},{periodType:'monthly',periodStart:'2026-07-01T00:00:00.000Z',periodEnd:'2026-07-31'}],
    }})
  })
  await page.route('**/api/reports/rankings**', async route => {
    const fixture = createPersonnelRankingsFixture()
    await route.fulfill({json: {...fixture,storeLeaderboard:{...fixture.storeLeaderboard,currentStoreComparisons:['score','TARGET_ACHIEVEMENT','ATV','UPT','CR','gsm_approval','BM_CHECKLIST','VM_CHECKLIST'].map(code=>({code,region:{rank:2,population:11},turkey:{rank:5,population:19}}))}}})
  })
  await page.goto('/store/kpis?periodStart=2026-07-01')
  await expect(page.getByRole('columnheader',{name:'Gerçekleşme Oranı',exact:true})).toBeVisible()
  const chart = page.getByLabel('Aylık mağaza skorları')
  await expect(chart.locator('[data-slot=chart]')).toBeVisible()
  await expect(chart.getByRole('row',{name:'Haz 80',exact:true})).toHaveCount(1)
  await expect(chart.getByRole('row',{name:'Tem 96',exact:true})).toHaveCount(1)
  await expect(chart.locator('.recharts-label-list text')).toHaveText(['80', '96'])
  const kpiTable = page.getByRole('region', {name:'Mağaza KPI değerleri',exact:true})
  await kpiTable.getByText('Ortalama Fiş Tutarı', {exact:true}).click()
  await expect(page.getByRole('dialog')).toContainText('Ortalama Fiş Tutarı · Detay')
  await page.getByRole('button', {name:'Kapat',exact:true}).click()
  await kpiTable.getByRole('row', {name:/Ortalama Fiş Tutarı/}).getByRole('cell').nth(2).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', {name:'Kapat',exact:true}).click()
  await kpiTable.getByRole('button', {name:'ATV detaylarını aç',exact:true}).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', {name:'Kapat',exact:true}).click()
  for (const name of ['Mağaza Skoru','HG%','ATV','UPT','CR','GSM','BM','VM']) {
    await page.getByRole('button',{name:`${name} detaylarını aç`,exact:true}).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText('2. / 11 mağaza')
    await expect(dialog).toContainText('5. / 19 mağaza')
    await expect(dialog.getByRole('row',{name:/Önceki ay/})).toContainText(name === 'Mağaza Skoru' ? '20% artış' : '100% artış')
    await expect(dialog.getByRole('row',{name:/Geçen yıl/})).toContainText('düşüş')
    await expect(dialog.locator('[data-trend="positive"]')).toContainText('+')
    await expect(dialog.locator('[data-trend="negative"]')).toContainText('−')
    await expect(dialog.locator('[data-trend="positive"]')).toHaveCSS('color', 'rgb(6, 95, 70)')
    expect(await dialog.locator('[data-trend="negative"]').evaluate(el => getComputedStyle(el).color)).not.toBe(await dialog.locator('[data-trend="positive"]').evaluate(el => getComputedStyle(el).color))
    await dialog.getByRole('button',{name:'Kapat',exact:true}).click()
  }
  await page.setViewportSize({width:390,height:844})
  await page.getByRole('button',{name:'Mağaza Skoru detaylarını aç',exact:true}).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  const bounds = await dialog.boundingBox()
  expect(bounds!.x).toBeGreaterThanOrEqual(0)
  expect(bounds!.x+bounds!.width).toBeLessThanOrEqual(390)
  await expectNoCriticalAxeViolations(page)
})
test('personnel store score allocation uses server shares, survives filtering and follows the selected period', async ({ page }) => {
  await installStoreContractSession(page, 'storeManager')
  await installGenericStoreApiFallbacks(page)
  await routeKpiContractApi(page)
  await page.route('**/api/reports/store-kpi-highlights**', async route => {
    const fixture = createStoreKpiHighlightsFixture()
    const daily = new URL(route.request().url()).searchParams.get('periodType') === 'daily'
    await route.fulfill({ json: { ...fixture, score: { ...fixture.score, value: daily ? 80 : 95 }, period: daily ? { periodStart: '2026-07-05', periodEnd: '2026-07-10' } : fixture.period } })
  })
  await page.route('**/api/reports/rankings**', async route => {
    const fixture = createPersonnelRankingsFixture()
    const params = new URL(route.request().url()).searchParams
    const daily = params.get('periodType') === 'daily'
    const first = { ...fixture.personnelLeaderboard.items[0], storeScoreShare: daily ? 0.25 : 43 / 95 }
    const rows = [first, { ...first, employeeId: 'employee-2', displayName: 'Ece Demo', storeScoreShare: daily ? 0.75 : 52 / 95 }]
    const search = params.get('search')?.trim().toLocaleLowerCase('tr-TR') ?? ''
    const matchingRows = search ? rows.filter(row => row.displayName.toLocaleLowerCase('tr-TR').includes(search)) : rows
    await route.fulfill({ json: { ...fixture, personnelLeaderboard: { ...fixture.personnelLeaderboard, items: matchingRows, managedStorePersonnel: matchingRows, managedStorePersonnelMeta: { limit: 50, offset: 0, total: matchingRows.length } } } })
  })
  await page.goto('/store/kpis?periodStart=2026-07-01&view=personnel')
  const people = page.getByRole('region', { name: 'Personel KPI', exact: true })
  await expect(people.getByRole('columnheader', { name: 'Mağaza Skor Etkisi' })).toBeVisible()
  await expect(people.getByRole('row', { name: /Süleyman Öztürk/ })).toContainText('43,00 puan')
  await expect(people.getByRole('row', { name: /Ece Demo/ })).toContainText('52,00 puan')
  await people.getByRole('textbox', { name: 'Personel ara', exact: true }).fill('Süleyman')
  await expect(people.locator('tbody tr')).toHaveCount(1)
  await expect(people.locator('tbody tr')).toContainText('43,00 puan')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/store/kpis?periodStart=2026-07-05&periodEnd=2026-07-10&periodType=daily&view=personnel')
  await expect(people.getByRole('row', { name: /Süleyman Öztürk/ })).toContainText('20,00 puan')
  await expect(people.getByRole('row', { name: /Ece Demo/ })).toContainText('60,00 puan')
  await expect(page.getByText('Mağaza Skor Etkisi nasıl hesaplanır?')).toBeVisible()
  await expectNoCriticalAxeViolations(page)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  const profileReads: string[] = []
  await page.route('**/api/reports/personnel-performance/**', async route => {
    profileReads.push(route.request().url())
    const params = new URL(route.request().url()).searchParams
    await route.fulfill({ json: { ...myPerformanceFixture,
      period: { periodStart: params.get('periodStart'), periodEnd: params.get('periodEnd') ?? params.get('periodStart') },
      score: { value: 81.9, matchedMetrics: 3, totalMetrics: 3 },
    } })
  })
  const detail = people.getByRole('row', { name: /Süleyman Öztürk/ }).getByRole('link')
  await expect(detail).toHaveAttribute('href', /periodEnd=2026-07-10/)
  await detail.click()
  await expect(page).toHaveURL(/periodEnd=2026-07-10/)
  await expect.poll(() => profileReads.some(url => url.includes('periodStart=2026-07-05') && url.includes('periodEnd=2026-07-10'))).toBe(true)
  await expect(page.locator('.store-me-kpi-card').first()).toContainText('82 / 140')
  await page.reload()
  await expect(page.locator('.store-me-kpi-card').first()).toContainText('82 / 140')
})
test('store manager defaults to the current month and shares calendar day and range across both views', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-09-10T10:00:00+03:00') })
  await installStoreContractSession(page, 'storeManager')
  await installGenericStoreApiFallbacks(page)
  await routeKpiContractApi(page)
  const reads: Array<{ path: string; start: string | null; end: string | null; type: string | null }> = []
  for (const path of ['store-kpi-highlights', 'rankings']) await page.route(`**/api/reports/${path}**`, async route => {
    const params = new URL(route.request().url()).searchParams
    const start = params.get('periodStart')
    const end = params.get('periodEnd')
    const type = params.get('periodType')
    reads.push({ path, start, end, type })
    const fixture = path === 'rankings' ? createPersonnelRankingsFixture() : {
      ...createStoreKpiHighlightsFixture(), period: { periodStart: start, periodEnd: end ?? '2026-09-30' },
    }
    await route.fulfill({ json: fixture })
  })
  await page.goto('/store/kpis')
  const calendar = page.getByRole('button', { name: 'Dönem seç', exact: true })
  await expect(calendar).toContainText('Eyl 2026')
  for (const path of ['store-kpi-highlights', 'rankings']) await expect.poll(() => reads.some(r => r.path === path && r.start === '2026-09-01' && r.type === 'monthly' && !r.end)).toBe(true)
  await expect(page.getByRole('button', { name: /Canlı dönem|Kapanmış gün/ })).toHaveCount(0)
  await showPersonnel(page)
  await expect(page.getByRole('group', { name: 'Mağaza KPI özeti' })).toHaveCount(0)
  await calendar.click()
  const picker = page.getByRole('dialog', { name: 'Dönem seç' })
  await picker.getByRole('button', { name: '2 Eylül 2026 Çarşamba', exact: true }).click()
  await picker.getByRole('button', { name: '4 Eylül 2026 Cuma', exact: true }).click()
  await expect(picker.getByRole('gridcell', { selected: true })).toHaveCount(3)
  await picker.getByRole('button', { name: 'Uygula', exact: true }).click()
  for (const path of ['store-kpi-highlights', 'rankings']) await expect.poll(() => reads.some(r => r.path === path && r.start === '2026-09-02' && r.end === '2026-09-04' && r.type === 'daily')).toBe(true)
  await page.reload()
  await expect(page.locator('.manager-performance-title p').filter({hasText:'Personel Performansı'})).toBeVisible()
  await page.getByRole('button', { name: 'Mağaza Performansı', exact: true }).click()
  await expect(calendar).toContainText('2 Eyl 2026 – 4 Eyl 2026')
  await calendar.click()
  await picker.getByRole('button', { name: '7 Eylül 2026 Pazartesi', exact: true }).click()
  await picker.getByRole('button', { name: /^7 Eylül 2026 Pazartesi/ }).click()
  await picker.getByRole('button', { name: 'Uygula', exact: true }).click()
  for (const path of ['store-kpi-highlights', 'rankings']) await expect.poll(() => reads.some(r => r.path === path && r.start === '2026-09-07' && r.end === '2026-09-07')).toBe(true)
  await calendar.click()
  await picker.getByRole('button', { name: 'Tüm ay', exact: true }).click()
  await expect(calendar).toContainText('Eyl 2026')
  await expect(page).not.toHaveURL(/periodEnd=/)
})
test('store manager overview keeps scoped personnel, accurate ratios and recoverable search on desktop and mobile', async ({ page }) => {
  await installStoreContractSession(page, 'storeManager')
  await installGenericStoreApiFallbacks(page)
  await routeKpiContractApi(page)
  await page.route('**/api/reports/rankings**', async route => {
    const fixture = createPersonnelRankingsFixture()
    const search = new URL(route.request().url()).searchParams.get('search')?.trim().toLocaleLowerCase('tr-TR') ?? ''
    const managedRows = fixture.personnelLeaderboard.managedStorePersonnel.filter(row => !search || row.displayName.toLocaleLowerCase('tr-TR').includes(search))
    await route.fulfill({ json: { ...fixture, personnelLeaderboard: {
      ...fixture.personnelLeaderboard,
      items: [{ ...fixture.personnelLeaderboard.items[0], employeeId: 'outside-store', displayName: 'Başka Mağaza Personeli' }],
      managedStorePersonnel: managedRows,
      managedStorePersonnelMeta: { limit: 50, offset: 0, total: managedRows.length },
    } } })
  })
  await page.goto('/store/kpis?periodStart=2026-07-01')
  const overview = page.getByTestId('store-kpis-manager-overview')
  await expect(overview.getByRole('heading', { name: 'İstanbul MOI AVM' })).toBeVisible()
  await expect(overview.getByRole('group', { name: 'Mağaza KPI özeti' })).toContainText('4,15')
  await showPersonnel(page)
  const people = page.getByRole('region', { name: 'Personel KPI', exact: true })
  await expect(people).not.toContainText('Başka Mağaza Personeli')
  await expect(people.getByRole('row', { name: /Süleyman Öztürk/ })).toContainText('%110')
  const search = people.getByRole('textbox', { name: 'Personel ara' })
  await search.fill('eşleşme yok')
  await expect(people.getByText('Personel bulunamadı', { exact: true })).toBeVisible()
  await search.fill('')
  await expect(people.getByRole('link', { name: 'Süleyman Öztürk — Detay' })).toBeVisible()
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(search).toBeVisible()
  await expect(people.getByRole('link', { name: 'Süleyman Öztürk — Detay' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
  await page.getByRole('button', { name: 'Mağaza Performansı', exact: true }).click()
  const columns = await overview.locator('.region-performance-metrics').evaluate(element => getComputedStyle(element).gridTemplateColumns.split(' ').length)
  expect(columns).toBe(2)
})
test('store KPI score source renders configured GSM and checklist contributors without raw metric ids', async ({ page }) => {
  await installStoreContractSession(page, 'storeManager')
  await installGenericStoreApiFallbacks(page)
  await routeKpiContractApi(page)
  await page.goto('/store/kpis')
  await openCalculation(page)
  await expect(page.getByRole('region', { name: 'Mağaza KPI değerleri', exact: true })).toBeVisible()
  await expect(page.getByText('GSM Onayı').first()).toBeVisible()
  await expect(page.getByText('Bölge Müdürü Checklist').first()).toBeVisible()
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

  await openCalculation(page)
  const sourceHeading = page.getByRole('region', { name: 'Mağaza KPI değerleri', exact: true })
  await expect(sourceHeading).toBeVisible()
  const before = await sourceHeading.boundingBox()
  expect(before).not.toBeNull()

  await page.getByRole('button', { name: 'Dönem seç', exact: true }).click()

  const pickerDialog = page.getByRole('dialog')
  await expect(pickerDialog.getByText('Dönem seç')).toBeVisible()
  await expect(pickerDialog.getByRole('combobox', { name: 'Ay seç' })).toBeVisible()
  await expect(pickerDialog.getByRole('combobox', { name: 'Yıl seç' })).toBeVisible()
  await expect(pickerDialog.getByRole('grid')).toBeVisible()
  await expect(pickerDialog.getByRole('button', { name: 'Gün', exact: true })).toHaveCount(0)
  const after = await sourceHeading.boundingBox()
  expect(after).not.toBeNull()
  expect(Math.abs((after?.y ?? 0) - (before?.y ?? 0))).toBeLessThanOrEqual(2)
})

test('KPI calendar applies an inclusive date range, preserves it on reload and drill, and restores the full month', async ({ page }) => {
  await installStoreContractSession(page, 'reportViewer')
  await installGenericStoreApiFallbacks(page)
  await routeKpiContractApi(page)
  const reads: string[] = []
  await page.route('**/api/reports/rankings**', async route => {
    const url = new URL(route.request().url())
    reads.push(url.search)
    const fixture = createCompanyRankingsFixture()
    await route.fulfill({ json: { ...fixture, source: { ...fixture.source, periodType: url.searchParams.get('periodType'), periodStart: url.searchParams.get('periodStart'), periodEnd: url.searchParams.get('periodEnd') } } })
  })
  await page.goto('/store/kpis?periodStart=2026-07-01')
  await page.getByRole('button', { name: 'Şirket KPI dönemi', exact: true }).click()
  const picker = page.getByRole('dialog', { name: 'Dönem seç' })
  await picker.getByRole('button', { name: '1 Temmuz 2026 Çarşamba', exact: true }).click()
  await picker.getByRole('button', { name: '5 Temmuz 2026 Pazar', exact: true }).click()
  await picker.getByRole('button', { name: 'Uygula', exact: true }).click()
  await expect(page).toHaveURL(/periodEnd=2026-07-05/)
  await expect.poll(() => reads.some(value => value.includes('periodType=daily') && value.includes('periodStart=2026-07-01') && value.includes('periodEnd=2026-07-05'))).toBe(true)
  await page.reload()
  await expect(page.getByRole('link', { name: /— Detay/ }).first()).toHaveAttribute('href', /periodEnd=2026-07-05/)
  await page.getByRole('button', { name: 'Şirket KPI dönemi', exact: true }).click()
  await expect(picker.getByRole('gridcell', { selected: true })).toHaveCount(5)
  await picker.getByRole('button', { name: /^3 Temmuz 2026/ }).click()
  await expect(picker.getByRole('button', { name: 'Uygula', exact: true })).toBeDisabled()
  await picker.getByRole('button', { name: /^8 Temmuz 2026/ }).click()
  await expect(picker.getByRole('gridcell', { selected: true })).toHaveCount(6)
  await picker.getByRole('button', { name: 'Uygula', exact: true }).click()
  await expect(page).toHaveURL(/periodStart=2026-07-03/)
  await expect(page).toHaveURL(/periodEnd=2026-07-08/)
  await page.getByRole('button', { name: 'Şirket KPI dönemi', exact: true }).click()
  await picker.getByRole('button', { name: 'Tüm ay', exact: true }).click()
  await expect(page).not.toHaveURL(/periodEnd=/)
  await expect.poll(() => reads.at(-1)?.includes('periodType=monthly')).toBe(true)
})

test('KPI calendar allows every month and day and explains dates without data', async ({ page }) => {
  await installStoreContractSession(page, 'reportViewer')
  await installGenericStoreApiFallbacks(page)
  await routeKpiContractApi(page)
  await page.route('**/api/reports/rankings**', async route => {
    const url = new URL(route.request().url())
    const fixture = createCompanyRankingsFixture()
    if (url.searchParams.get('periodStart')?.startsWith('2026-12')) {
      fixture.storeLeaderboard.items = []
      fixture.storeLeaderboard.meta.total = 0
      fixture.regionManagerLeaderboard.items = []
      fixture.regionManagerLeaderboard.meta.total = 0
    }
    await route.fulfill({ json: fixture })
  })
  await page.goto('/store/kpis?periodStart=2026-09-01')
  await page.getByRole('button', { name: 'Şirket KPI dönemi', exact: true }).click()
  const picker = page.getByRole('dialog', { name: 'Dönem seç' })
  await expect(picker.getByRole('combobox', { name: 'Ay seç' }).locator('option')).toHaveCount(12)
  await picker.getByRole('combobox', { name: 'Ay seç' }).selectOption('11')
  await expect(picker.getByRole('button', { name: 'Tüm ay', exact: true })).toBeEnabled()
  await expect(picker.getByRole('grid').locator('button:disabled')).toHaveCount(0)
  await picker.getByRole('button', { name: '15 Aralık 2026 Salı', exact: true }).click()
  await picker.getByRole('button', { name: '20 Aralık 2026 Pazar', exact: true }).click()
  await expect(picker.getByRole('gridcell', { selected: true })).toHaveCount(6)
  const middleDay = picker.locator('button[data-range-middle="true"]').first()
  await expect(middleDay).toHaveCSS('background-color', 'rgb(237, 244, 255)')
  await expect(picker.locator('button[data-range-start="true"]')).toHaveCSS('background-color', 'rgb(207, 224, 251)')
  await expect(picker.getByRole('button', { name: '22 Aralık 2026 Salı', exact: true })).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  await page.setViewportSize({ width: 390, height: 844 })
  await expect.poll(async () => {
    const bounds = await picker.boundingBox()
    return bounds ? bounds.x + bounds.width : Infinity
  }).toBeLessThanOrEqual(378)
  const calendarBounds = await picker.boundingBox()
  expect(calendarBounds).not.toBeNull()
  expect(calendarBounds!.x).toBeGreaterThanOrEqual(12)
  expect(calendarBounds!.x + calendarBounds!.width).toBeLessThanOrEqual(378)
  await page.screenshot({ path: test.info().outputPath('calendar-mobile.png') })
  await picker.getByRole('button', { name: 'Uygula', exact: true }).click()
  await expect(page).toHaveURL(/periodEnd=2026-12-20/)
  await expect(page.getByText('Seçilen tarih için veri bulunamadı', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Şirket KPI dönemi', exact: true }).click()
  await picker.getByRole('button', { name: 'Tüm ay', exact: true }).click()
  await expect(page).toHaveURL(/periodStart=2026-12-01/)
  await expect(page).not.toHaveURL(/periodEnd=/)
  await expect(page.getByText('Seçilen tarih için veri bulunamadı', { exact: true })).toBeVisible()
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

for (const scenario of [
  { width: 1440, query: 'periodStart=2026-07-01' },
  { width: 390, query: 'periodStart=2026-07-05&periodEnd=2026-07-10&periodType=daily' },
]) {
  for (const role of ['REGION_MANAGER', 'REPORT_VIEWER', 'SUPER_ADMIN']) {
  test(`${role} detail reuses the new store UI and preserves scope and period at ${scenario.width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: scenario.width, height: 900 })
    await installStoreContractSession(page, role === 'REGION_MANAGER' ? 'regionManager' : 'reportViewer', { roleCodes: [role] })
    await installGenericStoreApiFallbacks(page)
    await routeKpiContractApi(page)
    await page.route('**/api/reports/rankings**', async route => {
      const selectedStore = new URL(route.request().url()).searchParams.get('storeId')
      await route.fulfill({ json: selectedStore ? createPersonnelRankingsFixture() : createCompanyRankingsFixture() })
    })
    await page.goto(`/store/kpis?${scenario.query}`)
    await page.getByRole('link', { name: 'İstanbul MOI AVM — Detay', exact: true }).filter({ visible: true }).click()
    const detail = page.getByTestId('store-kpis-manager-overview')
    await expect(detail).toBeVisible()
    await expect(detail.getByRole('heading', { name: 'İstanbul MOI AVM', exact: true })).toBeVisible()
    await expect(detail.locator('.manager-performance-store tbody tr')).toHaveCount(7)
    await expect(detail.getByLabel('Aylık mağaza skorları')).toBeVisible()
    const values = detail.locator('.region-performance-metrics strong')
    await expect(values).toHaveCount(4)
    const sizes = await values.evaluateAll(nodes => nodes.map(node => Number.parseFloat(getComputedStyle(node).fontSize)))
    expect(sizes.every(size => size <= (scenario.width < 768 ? 20 : 22))).toBe(true)
    if (role === 'SUPER_ADMIN') await page.screenshot({ path: testInfo.outputPath(`admin-store-${scenario.width}.png`), fullPage: true })

    await expect(page.getByRole('heading', { name: 'Mağaza KPI katkı kırılımı' })).toHaveCount(0)
    await detail.getByRole('button', { name: 'Mağaza Skoru detaylarını aç', exact: true }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.getByRole('button', { name: 'Kapat', exact: true }).click()
    await showPersonnel(page)
    await expect(page.getByRole('row', { name: /Süleyman Öztürk/ })).toBeVisible()
    for (const [key, value] of new URLSearchParams(scenario.query)) expect(new URL(page.url()).searchParams.get(key)).toBe(value)
    expect(new URL(page.url()).searchParams.get('storeId')).toBe(storeIds[0])
    await page.reload()
    await expect(page.getByRole('region', { name: 'Personel KPI', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Mağaza Performansı', exact: true }).click()
    await expectNoCriticalAxeViolations(page)
    const widths = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }))
    expect(widths.document).toBeLessThanOrEqual(widths.viewport)
    await page.getByRole('link', { name: 'Mağaza listesine dön', exact: true }).click()
    await expect(page.getByTestId(role === 'REGION_MANAGER' ? 'store-kpis-region-overview' : 'store-kpis-company-overview')).toBeVisible()
    expect(new URL(page.url()).searchParams.has('storeId')).toBe(false)
    for (const [key, value] of new URLSearchParams(scenario.query)) expect(new URL(page.url()).searchParams.get(key)).toBe(value)
  })
}
}

test('Region Manager denied store detail never renders the performance surface', async ({ page }) => {
  await installStoreContractSession(page, 'regionManager')
  await installGenericStoreApiFallbacks(page)
  await routeKpiContractApi(page)
  await page.route('**/api/reports/store-kpi-highlights**', route => route.fulfill({ status: 403, json: { message: 'Forbidden' } }))
  await page.goto(`/store/kpis?storeId=${storeIds[0]}&periodStart=2026-07-01`)
  await expect(page.getByText('Bu oturum canlı mağaza KPI verisini okuyamıyor.')).toBeVisible()
  await expect(page.getByTestId('store-kpis-manager-overview')).toHaveCount(0)
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
  const mobileSort = page.getByRole('combobox', { name: 'KPI sıralama seçenekleri' })
  await mobileSort.click()
  await page.getByRole('option', { name: 'UPT · Artan' }).click()
  await expect(mobileSort).toContainText('UPT · Artan')
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
    await showPersonnel(page)
    const profileLink = page.getByRole('link', { name: /Profile Git|Süleyman Öztürk — Detay/ })
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
  await showPersonnel(page)
  const row = page.getByRole('row', { name: /Süleyman Öztürk/ })
  await expect(row).toBeVisible()
  await expect(row.getByRole('cell', { name: 'Veri yok', exact: true })).toHaveCount(3)
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
  await openCalculation(page)
  await expect(page.getByRole('region', { name: 'Mağaza KPI değerleri', exact: true })).toBeVisible()
  const rows = await page.locator('.manager-performance-store table tbody tr').allTextContents()
  const labels = ['Hedef Gerçekleşme', 'Ortalama Fiş Tutarı', 'Fiş Başına Ürün', 'CR', 'GSM Onayı', 'Bölge Müdürü Checklist', 'VM Checklist']
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
  await showPersonnel(page)
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
  await openCalculation(page)
  await expect.poll(() => partialReads).toContain(true)
  await expect(page.getByRole('status', { name: 'Mağaza skoru henüz tam değil' })).toHaveCount(0)
  await expect(page.getByRole('row', { name: /GSM Onayı/ })).toBeVisible()
  await expect(page.getByRole('row', { name: /Fiş Başına Ürün/ })).toBeVisible()
})

test('KPI-FR-005 trend transport error is retryable and never rendered as a no-data month', async ({ page }) => {
  await installStoreContractSession(page, 'regionManager')
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

  await page.goto(`/store/kpis?storeId=${storeIds[0]}&periodStart=2026-07-01`)
  const trend = page.getByLabel('Aylık mağaza skorları')
  await expect(trend.getByText('Skor geçmişinin bir bölümü yüklenemedi.')).toBeVisible()
  await expect(trend.getByRole('row', { name: 'Haz Yüklenemedi', exact: true })).toHaveCount(1)
  const readsBeforeRetry = failedReads
  await trend.getByRole('button', { name: 'Tekrar dene' }).click()
  await expect.poll(() => failedReads).toBeGreaterThan(readsBeforeRetry)
})

test('SH-FR-009 KPI workspace omits the removed manual refresh control', async ({ page }) => {
  await installStoreContractSession(page, 'storeManager')
  await installGenericStoreApiFallbacks(page)
  await routeKpiContractApi(page)
  await page.goto('/store/kpis?periodStart=2026-07-01')
  await openCalculation(page)
  const contributionTitle = page.getByRole('region', { name: 'Mağaza KPI değerleri', exact: true })
  await expect(contributionTitle).toBeVisible()
  await expect(page.getByRole('button', { name: 'Veriyi yenile' })).toHaveCount(0)
})

test('Report Viewer manager sidebar shows scores and filters all stores without metric cards', async ({ page }) => {
  await installStoreContractSession(page, 'reportViewer')
  await installGenericStoreApiFallbacks(page)
  await routeKpiContractApi(page)
  const reads: Array<string | null> = []
  await page.route('**/api/reports/rankings**', async route => {
    const url = new URL(route.request().url())
    const manager = url.searchParams.get('regionManagerUserId')
    reads.push(manager)
    const fixture = createCompanyRankingsFixture()
    await route.fulfill({ json: manager ? { ...fixture, storeLeaderboard: { ...fixture.storeLeaderboard, items: [fixture.storeLeaderboard.items[0]], meta: { limit: 50, offset: 0, total: 1 } } } : fixture })
  })
  await page.goto('/store/kpis?periodStart=2026-07-01')
  const company = page.getByTestId('store-kpis-company-overview')
  await expect(company.getByRole('heading', { name: 'LUFIAN Mağaza Performansı' })).toBeVisible()
  await expect(company.locator('[data-slot="card"]')).toHaveCount(0)
  const manager = company.getByRole('button', { name: 'Onur Kaytan Bölge puanı: 78', exact: true })
  await expect(manager).toBeVisible()
  await expect(company.getByRole('button', { name: 'Tüm Mağazalar', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(company.getByRole('link', { name: /Bursa Marka Park/ })).toBeVisible()
  await manager.click()
  await expect.poll(() => reads).toContain('rm-1')
  await expect(company.getByRole('link', { name: /Bursa Marka Park/ })).toHaveCount(0)
  await company.getByRole('button', { name: 'Tüm Mağazalar', exact: true }).click()
  await expect(company.getByRole('link', { name: /Bursa Marka Park/ })).toBeVisible()
})
test('SH-FR-008 company period transitions reset manager and store pagination', async ({ page }) => {
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
  await page.getByRole('button', { name: 'Sonraki bölge müdürleri' }).click()
  await expect.poll(() => parentOffsets).toContain('20')
  await expect(page.getByText('2 / 2', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: /Onur Kaytan/ }).click()
  await page.getByRole('navigation', { name: 'Mağaza sayfaları', exact: true }).getByRole('button', { name: 'Sonraki' }).click()
  await expect.poll(() => managerReads.some((read) => read.offset === '50')).toBe(true)
  await page.getByRole('button', { name: /Şirket KPI dönemi/ }).click()
  await page.getByRole('dialog').getByRole('combobox', { name: 'Ay seç' }).selectOption({ label: 'Haz' })
  await page.getByRole('dialog').getByRole('button', { name: 'Tüm ay' }).click()
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
  await page.getByRole('button', { name: /Bölge müdürü bilgisi yok/ }).click()
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
    await expect(page.getByRole('textbox', { name: /Mağaza ara/i }).first()).toBeVisible()
    await expectStableKpiMetricGeometry(page)

    const overflow = await page.evaluate(() => ({
      body: document.body.scrollWidth - document.body.clientWidth,
      root: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }))
    expect(overflow.body).toBeLessThanOrEqual(0)
    expect(overflow.root).toBeLessThanOrEqual(0)
    expect(consoleErrors).toEqual([])

    if (viewport.width === 1440) {
      await expectNoCriticalAxeViolations(page)
      await page.getByRole('button', { name: 'Müdür KPI dönemi' }).click()
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

async function expectStableKpiMetricGeometry(page: Page) {
  const metrics = page.locator('.region-performance-metrics [data-slot=card]')
  await expect(metrics).toHaveCount(4)
  const initial = await metrics.evaluateAll((elements) =>
    elements.map((element) => {
      const rect = element.getBoundingClientRect()
      return { width: rect.width, height: rect.height }
    }),
  )

  for (let index = 0; index < 4; index += 1) {
    await metrics.nth(index).click()
    const current = await metrics.evaluateAll((elements) =>
      elements.map((element) => {
        const rect = element.getBoundingClientRect()
        return { width: rect.width, height: rect.height }
      }),
    )
    expect(current).toEqual(initial)
  }
  await metrics.first().click()
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


test('daily KPI selection binds store and personnel reads to the same day and survives reload', async ({ page }) => {
  await installStoreContractSession(page, 'storeManager')
  await installGenericStoreApiFallbacks(page)
  await routeKpiContractApi(page)
  const reads: Array<{ path: string; type: string | null; start: string | null }> = []
  await page.route('**/api/reports/store-kpi-highlights**', async (route) => {
    const url = new URL(route.request().url())
    reads.push({ path: 'store', type: url.searchParams.get('periodType'), start: url.searchParams.get('periodStart') })
    const fixture = createStoreKpiHighlightsFixture()
    const daily = url.searchParams.get('periodType') === 'daily'
    await route.fulfill({ json: daily ? {
      ...fixture,
      source: { ...fixture.source, periodType: 'daily' },
      period: { periodStart: '2026-07-06', periodEnd: '2026-07-06' },
      availablePeriods: [{ periodType: 'daily', periodStart: '2026-07-06', periodEnd: '2026-07-06' }],
    } : fixture })
  })
  await page.route('**/api/reports/rankings**', async (route) => {
    const url = new URL(route.request().url())
    reads.push({ path: 'personnel', type: url.searchParams.get('periodType'), start: url.searchParams.get('periodStart') })
    await route.fulfill({ json: createEmptyRankingsFixture() })
  })
  await page.goto('/store/kpis?periodType=daily&periodStart=2026-07-06')
  await expect(page.getByRole('combobox', { name: 'KPI dönem türü' })).toHaveCount(0)
  const day = page.getByRole('button', { name: 'Dönem seç', exact: true })
  await expect(day).toContainText('6 Tem 2026')
  await expect.poll(() => reads.some(r => r.path === 'store' && r.type === 'daily' && r.start === '2026-07-06')).toBe(true)
  await expect.poll(() => reads.some(r => r.path === 'personnel' && r.type === 'daily' && r.start === '2026-07-06')).toBe(true)
  await page.reload()
  await expect(day).toContainText('6 Tem 2026')
  await day.click()
  await page.getByRole('button', { name: 'Tüm ay', exact: true }).click()
  await expect(day).toBeVisible()
  await expect(page).toHaveURL(/periodStart=2026-07-01/)
  await expect.poll(() => reads.some(r => r.path === 'store' && r.type === 'monthly' && r.start === '2026-07-01')).toBe(true)
})


test('company administrator reads selected-store personnel without an action-store assignment', async ({ page }) => {
  await installStoreContractSession(page, 'reportViewer', { roleCodes: ['SUPER_ADMIN'], actionStoreIds: [] })
  await installGenericStoreApiFallbacks(page)
  await routeKpiContractApi(page)
  await page.route('**/api/reports/rankings**', async (route) => {
    const fixture = createPersonnelRankingsFixture()
    await route.fulfill({ json: { ...fixture, personnelLeaderboard: { ...fixture.personnelLeaderboard,
      managedStorePersonnel: [], managedStorePersonnelMeta: { total: 0, limit: 50, offset: 0 },
    } } })
  })
  await page.goto(`/store/kpis?storeId=${storeIds[0]}&periodType=daily&periodStart=2026-07-06`)
  await showPersonnel(page)
  await expect(page.getByRole('row', { name: /Süleyman Öztürk/ })).toBeVisible()
  const profile = page.getByRole('row', { name: /Süleyman Öztürk/ }).getByRole('link', { name: /Detay/ })
  await expect(profile).toHaveAttribute('href', /periodType=daily/)
  await expect(profile).toHaveAttribute('href', /periodStart=2026-07-06/)
})

async function openCalculation(page: Page) {
  await expect(page.getByRole('region', { name: 'Mağaza KPI değerleri', exact: true })).toBeVisible()
}

async function showPersonnel(page: Page) {
  await expect(page.getByRole('main')).toBeVisible()
  const managerView = page.getByTestId('store-kpis-manager-overview')
  await expect(managerView.or(page.getByRole('button', { name: /Personel KPI/ }))).toBeVisible()
  if (await managerView.isVisible()) await page.getByRole('button', { name: 'Personel Performansı', exact: true }).click()
  else await page.getByRole('button', { name: /Personel KPI/ }).click()
}
