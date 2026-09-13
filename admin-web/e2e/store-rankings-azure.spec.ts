import AxeBuilder from '@axe-core/playwright'
import { expect, test } from './test-fixtures'
import { routeStoreSurfaceApi } from './store-surfaces-api-fixtures'
import { authSessionFixture } from './store-surfaces-profile-fixtures'
import { rankingsPrivilegedDetailFixture, personnelRankingDetailRow } from './store-surfaces-ranking-fixtures'

const fixture = {
  ...rankingsPrivilegedDetailFixture,
  personnelLeaderboard: {
    ...rankingsPrivilegedDetailFixture.personnelLeaderboard,
    items: [personnelRankingDetailRow],
    meta: { total: 1, limit: 100, offset: 0 },
  },
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem('store-ops-admin-session', JSON.stringify({ mode: 'mock', mockUserId: 'ranking-viewer', mockRoleCodes: 'REPORT_VIEWER', mockCompanyIds: '00000000-0000-0000-0000-000000000001', bearerToken: '' })))
  await routeStoreSurfaceApi(page)
  await page.route('**/api/auth/session', route => route.fulfill({ json: { ...authSessionFixture, user: { ...authSessionFixture.user, userId: 'ranking-viewer', roleCodes: ['REPORT_VIEWER'] } } }))
  await page.route('**/api/reports/rankings**', route => route.fulfill({ json: fixture }))
})

for (const width of [1440, 1024, 390, 320]) {
  test(`Azure rankings stays readable and accessible at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/store/rankings')
    const surface = page.getByTestId('store-rankings-page')
    await expect(surface.locator('tbody tr').first()).toBeVisible()
    expect((await surface.boundingBox())!.x + (await surface.boundingBox())!.width).toBeLessThanOrEqual(width)
    await expect(surface.getByRole('columnheader', { name: 'ATV', exact: true })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
    expect(await surface.locator('.store-rankings-table-wrap').evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1)
    const accessibility = await new AxeBuilder({ page }).include('[data-testid="store-rankings-page"]').withTags(['wcag2a', 'wcag2aa']).analyze()
    expect(accessibility.violations).toEqual([])
    await page.screenshot({ path: testInfo.outputPath(`rankings-${width}.png`), fullPage: true })
    await page.getByRole('tab', { name: /Personel listesi/ }).click()
    await expect(page.getByTestId('personnel-ranking-row').first()).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
    await page.screenshot({ path: testInfo.outputPath(`rankings-personnel-${width}.png`), fullPage: true })
  })
}

test('search and manager selection send the existing server filters', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-12T12:00:00Z'))
  const queries: URLSearchParams[] = []
  await page.route('**/api/reports/rankings**', route => {
    queries.push(new URL(route.request().url()).searchParams)
    return route.fulfill({ json: fixture })
  })
  await page.goto('/store/rankings')
  const search = page.locator('.store-rankings-search-field input')
  await expect(search).toBeVisible()
  expect(queries.at(-1)?.get('periodStart')).toBe('2026-09-01')
  await search.fill('İstinye')
  await expect.poll(() => queries.at(-1)?.get('search')).toBe('İstinye')
  await expect(search).toHaveValue('İstinye')
  await page.locator('.store-rankings-filters').getByRole('combobox').click()
  await page.getByRole('option', { name: 'Region Manager', exact: true }).click()
  await expect.poll(() => queries.at(-1)?.get('regionManagerUserId')).toBe('region-manager-1')
  await expect(page).toHaveURL(/regionManager=region-manager-1/)
})

test('switching lists resets pagination and uses the selected lists total', async ({ page }) => {
  const offsets: string[] = []
  await page.route('**/api/reports/rankings**', route => {
    offsets.push(new URL(route.request().url()).searchParams.get('offset') ?? '0')
    return route.fulfill({ json: { ...fixture,
      storeLeaderboard: { ...fixture.storeLeaderboard, meta: { total: 201, limit: 100, offset: Number(offsets.at(-1)) } },
      personnelLeaderboard: { ...fixture.personnelLeaderboard, meta: { total: 1, limit: 100, offset: Number(offsets.at(-1)) } },
    } })
  })
  await page.goto('/store/rankings?page=2')
  await expect(page.locator('tbody tr').first()).toBeVisible()
  expect(offsets.at(-1)).toBe('100')
  await page.getByRole('tab', { name: /Personel listesi/ }).click()
  await expect.poll(() => offsets.at(-1)).toBe('0')
  await expect(page.locator('.store-rankings-page-actions button').last()).toBeDisabled()
  await expect(page).not.toHaveURL(/page=/)
})

test('missing national reference never substitutes the displayed stores average', async ({ page }) => {
  await page.route('**/api/reports/rankings**', route => route.fulfill({ json: { ...fixture, reference: undefined } }))
  await page.goto('/store/rankings')
  const reference = page.locator('.store-rankings-reference-strip')
  await expect(reference).toBeVisible()
  for (const value of await reference.locator('dd').allTextContents()) expect(value).toBe('Veri yok')
})

test('a denied filter request removes previously displayed ranking rows', async ({ page }) => {
  await page.route('**/api/reports/rankings**', route => new URL(route.request().url()).searchParams.has('search')
    ? route.fulfill({ status: 403, json: { message: 'Forbidden' } })
    : route.fulfill({ json: fixture }))
  await page.goto('/store/rankings')
  await expect(page.locator('tbody tr').first()).toBeVisible()
  await page.locator('.store-rankings-search-field input').fill('Denied')
  await expect(page.locator('.store-rankings-table')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Dönem filtresi' })).toBeVisible()
})


test('shared calendar commits exact inclusive ranges, cancels drafts and restores full month', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 })
  const queries: URLSearchParams[] = []
  await page.route('**/api/reports/rankings**', route => {
    const query = new URL(route.request().url()).searchParams
    queries.push(query)
    return route.fulfill({ json: { ...fixture, source: { ...fixture.source, periodType: query.get('periodType'), periodStart: query.get('periodStart'), periodEnd: query.get('periodEnd') || '2026-09-30' } } })
  })
  await page.goto('/store/rankings?period=2026-09-01&page=2')
  await expect(page.locator('tbody tr').first()).toBeVisible()
  expect(queries.at(-1)?.get('periodType')).toBe('monthly')
  const trigger = page.getByRole('button', { name: 'Dönem filtresi' })
  await trigger.click()
  const calendar = page.getByRole('dialog', { name: 'Dönem seç' })
  await calendar.locator('button[data-day]').filter({ hasText: /^2$/ }).first().click()
  await calendar.getByRole('combobox', { name: 'Ay seç' }).selectOption('9')
  await calendar.locator('button[data-day]').filter({ hasText: /^3$/ }).first().click()
  expect(queries.at(-1)?.get('periodEnd')).toBeNull()
  await calendar.getByRole('button', { name: 'Uygula', exact: true }).click()
  await expect.poll(() => queries.at(-1)?.get('periodEnd')).toBe('2026-10-03')
  expect(queries.at(-1)?.get('periodStart')).toBe('2026-09-02')
  expect(queries.at(-1)?.get('periodType')).toBe('daily')
  expect(queries.at(-1)?.get('offset') ?? '0').toBe('0')
  await expect(page).toHaveURL(/from=2026-09-02&to=2026-10-03/)
  await expect(page.locator('.store-rankings-reference-title')).toContainText('3 Eki 2026')
  expect((await trigger.boundingBox())!.x + (await trigger.boundingBox())!.width).toBeLessThanOrEqual(320)
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
  await page.reload()
  await expect(trigger).toContainText('3 Eki 2026')
  await trigger.click()
  await calendar.locator('button[data-day]').filter({ hasText: /^5$/ }).first().click()
  await page.keyboard.press('Escape')
  expect(queries.at(-1)?.get('periodEnd')).toBe('2026-10-03')
  await trigger.click()
  await calendar.getByRole('button', { name: 'Tüm ay', exact: true }).click()
  await expect.poll(() => queries.at(-1)?.get('periodType')).toBe('monthly')
  expect(queries.at(-1)?.get('periodStart')).toBe('2026-09-01')
  expect(queries.at(-1)?.get('periodEnd')).toBeNull()
  await expect(page).not.toHaveURL(/from=|to=|page=/)
})
