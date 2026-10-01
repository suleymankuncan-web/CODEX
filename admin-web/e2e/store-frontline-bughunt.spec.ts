import { expect, test, type Page } from './test-fixtures'
import {
  employeeIds,
  installGenericStoreApiFallbacks,
  installStoreContractSession,
} from './store-page-contract-fixtures'
import { myPerformanceFixture } from './store-surfaces-profile-fixtures'

test.use({ timezoneId: 'UTC' })

test.beforeEach(async ({ page }) => {
  await page.route('**/api/**', route => route.fulfill({ status: 503, json: { message: 'Unmodeled test API request' } }))
  await page.addInitScript(() => window.localStorage.setItem('store-ops-app-locale', 'tr'))
})

for (const persona of ['storePersonnel', 'storeManager'] as const) {
  test(`${persona} KPI details includes monthly performance backed only by daily facts`, async ({ page }) => {
    await installStoreContractSession(page, persona)
    await installGenericStoreApiFallbacks(page)
    const reads: URL[] = []
    const pattern = persona === 'storePersonnel'
      ? '**/api/reports/my-performance**'
      : '**/api/reports/personnel-performance/**'
    await page.route(pattern, async route => {
      const url = new URL(route.request().url())
      reads.push(url)
      const start = url.searchParams.get('periodStart') ?? ''
      const month = start.slice(0, 7)
      const fullMonth = url.searchParams.get('periodType') === 'daily'
        && ['2026-08', '2026-09'].includes(month)
        && start.endsWith('-01')
        && url.searchParams.get('periodEnd') === `${month}-${month === '2026-08' ? '31' : '30'}`
      const populated = fullMonth
      await route.fulfill({ json: {
        ...myPerformanceFixture,
        employee: { ...myPerformanceFixture.employee, employeeId: employeeIds[0] },
        availablePeriods: ['2026-08-13', '2026-09-13'].map(date => ({
          periodType: 'daily', periodStart: date, periodEnd: date,
        })),
        period: populated ? { periodStart: start, periodEnd: url.searchParams.get('periodEnd') } : null,
        score: { value: month === '2026-08' ? 41 : 82, matchedMetrics: populated ? 3 : 0, totalMetrics: 3 },
        metrics: populated ? myPerformanceFixture.metrics
          : myPerformanceFixture.metrics.map(metric => ({ ...metric, actualValue: null })),
      } })
    })
    await page.goto(persona === 'storePersonnel' ? '/store/me'
      : `/store/personnel/${employeeIds[0]}?mode=live&periodType=monthly&periodStart=2026-09-01`)

    await expect(page.getByRole('button', { name: 'Tarih filtresi' })).toContainText('Eylül 2026')
    await page.getByRole('button', { name: 'KPI detayları', exact: true }).click()
    const dialog = page.getByTestId('store-me-kpi-dialog')
    const september = dialog.getByRole('region', { name: 'Eylül 2026', exact: true })
    await expect(september.locator('tbody tr')).toHaveCount(4)
    const score = september.getByRole('row', { name: /Performans Skoru/ })
    await expect(score).toContainText('82')
    await expect(score).toContainText('+100%')
    await expect(score).toContainText('Veri yok')
    await expect(dialog).not.toContainText('Bu yıl için aylık KPI verisi bulunamadı.')
    expect(reads.some(url => url.searchParams.get('periodType') === 'daily'
      && url.searchParams.get('periodStart') === '2026-08-01'
      && url.searchParams.get('periodEnd') === '2026-08-31')).toBe(true)
    expect(reads.some(url => url.searchParams.get('periodStart') === '2025-09-01')).toBe(false)
  })
}

async function installRankings(page: Page) {
  await installStoreContractSession(page, 'storePersonnel')
  await installGenericStoreApiFallbacks(page)
}

test('rankings hydrates a same mounted route destination and browser back', async ({ page }) => {
  await installRankings(page)
  const first = '/store/rankings?list=personnel&period=2026-09-01&q=Ay%C5%9Fe&sort=UPT&dir=asc'
  const second = '/store/rankings?period=2026-08-01&q=%C4%B0stanbul'
  await page.goto(first)
  await expect(page.getByRole('tab', { name: /^Personel listesi/ })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('searchbox')).toHaveValue('Ayşe')
  const documentHandle = await page.evaluateHandle(() => document)
  await page.evaluate(destination => {
    window.history.pushState({}, '', destination)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }, second)

  await expect(page.getByRole('tab', { name: /^Mağaza listesi/ })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('searchbox')).toHaveValue('İstanbul')
  await expect(page.getByRole('button', { name: 'Dönem filtresi' })).toContainText('Ağu 2026')
  await expect.poll(() => page.evaluate(() => new URLSearchParams(location.search).get('sort'))).toBeNull()
  await page.goBack()
  await expect(page.getByRole('tab', { name: /^Personel listesi/ })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('searchbox')).toHaveValue('Ayşe')
  await expect(page.getByRole('button', { name: 'Dönem filtresi' })).toContainText('Eyl 2026')
  await expect.poll(() => page.evaluate(() => new URLSearchParams(location.search).get('sort'))).toBe('UPT')
  expect(await documentHandle.evaluate(previous => previous === document)).toBe(true)
})

test('privileged rankings keeps typing focus and debounce across URL hydration and history', async ({ page }) => {
  await installStoreContractSession(page, 'regionManager')
  await installGenericStoreApiFallbacks(page)
  const requests: Array<{ period: string; search: string }> = []
  page.on('request', request => {
    const url = new URL(request.url())
    if (url.pathname === '/api/reports/rankings') requests.push({
      period: url.searchParams.get('periodStart') ?? '',
      search: url.searchParams.get('search') ?? '',
    })
  })
  await page.goto('/store/rankings?period=2026-09-01&q=Ali')
  await expect(page.getByRole('searchbox')).toHaveValue('Ali')
  await expect.poll(() => requests.at(-1)).toEqual({ period: '2026-09-01', search: 'Ali' })
  await page.clock.install()
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000))
  await page.evaluate(() => {
    window.history.pushState({}, '', '/store/rankings?period=2026-08-01&q=Istanbul')
    window.dispatchEvent(new PopStateEvent('popstate'))
  })
  const search = page.getByRole('searchbox')
  await expect(search).toHaveValue('Istanbul')
  await page.clock.runFor(300)
  await expect.poll(() => requests.at(-1)).toEqual({ period: '2026-08-01', search: 'Istanbul' })
  requests.length = 0
  await search.press('ControlOrMeta+A')
  await search.press('Backspace')
  await search.pressSequentially('Ayşe ')
  await expect(search).toBeFocused()
  await expect(search).toHaveValue('Ayşe ')
  await page.clock.runFor(299)
  expect(requests).toHaveLength(0)
  await page.clock.runFor(1)
  await expect.poll(() => requests).toEqual([{ period: '2026-08-01', search: 'Ayşe ' }])
  await expect.poll(() => page.evaluate(() => new URLSearchParams(location.search).get('q'))).toBe('Ayşe')
  await expect(search).toBeFocused()
  await page.goBack()
  await expect(search).toHaveValue('Ali')
  await page.clock.runFor(300)
  await expect(page.getByRole('button', { name: 'Dönem filtresi' })).toContainText('Eyl 2026')
  await expect.poll(() => page.evaluate(() => new URLSearchParams(location.search).get('q'))).toBe('Ali')
  await page.goForward()
  await expect(search).toHaveValue('Ayşe')
  await page.clock.runFor(300)
  await expect(page.getByRole('button', { name: 'Dönem filtresi' })).toContainText('Ağu 2026')
  await expect.poll(() => page.evaluate(() => new URLSearchParams(location.search).get('q'))).toBe('Ayşe')
})

for (const action of ['open', 'clear'] as const) {
  test(`rankings ${action} uses the Istanbul month after midnight in a UTC browser`, async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-09-30T21:30:00Z'))
    await installRankings(page)
    const requestedPeriods: string[] = []
    page.on('request', request => {
      const url = new URL(request.url())
      if (url.pathname === '/api/reports/rankings') requestedPeriods.push(url.searchParams.get('periodStart') ?? '')
    })
    await page.goto(action === 'open' ? '/store/rankings' : '/store/rankings?period=2026-08-01&q=Ay%C5%9Fe')
    await expect(page.getByTestId('store-rankings-page')).toBeVisible()
    if (action === 'clear') await page.getByRole('button', { name: 'Temizle', exact: true }).click()

    await expect.poll(() => page.evaluate(() => new URLSearchParams(location.search).get('period'))).toBe('2026-10-01')
    await expect(page.getByRole('button', { name: 'Dönem filtresi' })).toContainText('Eki 2026')
    await expect.poll(() => requestedPeriods.includes('2026-10-01')).toBe(true)
  })
}
