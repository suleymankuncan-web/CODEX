import { expect, test } from './test-fixtures'
import {
  employeeIds,
  installGenericStoreApiFallbacks,
  installStoreContractSession,
} from './store-page-contract-fixtures'
import { myPerformanceFixture } from './store-surfaces-profile-fixtures'

const cases = [
  {
    name: 'ignores a range without live mode',
    query: 'periodType=daily&periodStart=2026-04-20&periodEnd=2026-04-24',
    start: null,
    end: null,
  },
  {
    name: 'ignores a range from closed mode',
    query: 'mode=closed&periodType=daily&periodStart=2026-04-20&periodEnd=2026-04-24',
    start: null,
    end: null,
  },
  {
    name: 'ignores a range end without a start',
    query: 'mode=live&periodType=daily&periodEnd=2026-04-24',
    start: null,
    end: null,
  },
  {
    name: 'preserves both dates for an explicit live daily range',
    query: 'mode=live&periodType=daily&periodStart=2026-04-20&periodEnd=2026-04-24',
    start: '2026-04-20',
    end: '2026-04-24',
  },
]

for (const scenario of cases) {
  test(`personnel profile ${scenario.name}`, async ({ page }) => {
    await installStoreContractSession(page, 'regionManager')
    await installGenericStoreApiFallbacks(page)
    const reads: URL[] = []
    await page.route('**/api/reports/personnel-performance/**', async (route) => {
      const url = new URL(route.request().url())
      reads.push(url)
      const periodStart = url.searchParams.get('periodStart') || '2026-04-24'
      const periodEnd = url.searchParams.get('periodEnd') || periodStart
      await route.fulfill({
        json: {
          ...myPerformanceFixture,
          employee: { ...myPerformanceFixture.employee, employeeId: employeeIds[0] },
          period: { periodStart, periodEnd },
          availablePeriods: [
            { periodType: 'daily', periodStart: '2026-04-24', periodEnd: '2026-04-24' },
          ],
        },
      })
    })

    await page.goto(`/store/personnel/${employeeIds[0]}?${scenario.query}`)
    await expect(page.getByRole('heading', { name: 'Store Personnel', exact: true })).toBeVisible()

    const firstRead = reads[0]
    expect(firstRead?.searchParams.get('mode')).toBe('live')
    expect(firstRead?.searchParams.get('periodType')).toBe('daily')
    expect(firstRead?.searchParams.get('periodStart')).toBe(scenario.start)
    expect(firstRead?.searchParams.get('periodEnd')).toBe(scenario.end)
  })
}
