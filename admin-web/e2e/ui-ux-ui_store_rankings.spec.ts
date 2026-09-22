import { expect, test } from './test-fixtures'
import { routeStoreSurfaceApi } from './store-surfaces-api-fixtures'
import { authSessionFixture } from './store-surfaces-profile-fixtures'
import { rankingsFixture, rankingsPrivilegedDetailFixture, rankingsPrivilegedDetailStoreRow } from './store-surfaces-ranking-fixtures'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem('store-ops-admin-session', JSON.stringify({
    mode: 'mock', mockUserId: 'rankings-ui-audit', mockRoleCodes: 'STORE_PERSONNEL',
    mockCompanyIds: '00000000-0000-0000-0000-000000000001', bearerToken: '',
  })))
  await routeStoreSurfaceApi(page)
  await page.route('**/api/auth/session', route => route.fulfill({ json: {
    ...authSessionFixture,
    user: { ...authSessionFixture.user, userId: 'rankings-ui-audit', roleCodes: ['STORE_PERSONNEL'] },
  } }))
})

test('local search labels match each list and empty results show a zero range', async ({ page }) => {
  await page.goto('/store/rankings?period=2026-04-01')
  const search = page.getByRole('searchbox', { name: 'Mağaza Ara', exact: true })
  await expect(search).toBeVisible()
  await expect(page.locator('.store-rankings-pagination > span')).toHaveText('1-1 / 240')

  await search.fill('Eşleşmeyen kayıt')
  await expect(page.getByText('Bu seçim için mağaza sıralaması yok.', { exact: true })).toBeVisible()
  await expect(page.locator('.store-rankings-pagination > span')).toHaveText('0-0 / 240')
  await expect(page.locator('.store-rankings-table caption')).toContainText('0-0')

  await page.getByRole('tab', { name: /Personel listesi/ }).click()
  await expect(page.getByRole('searchbox', { name: 'Personel arama', exact: true })).toHaveValue('Eşleşmeyen kayıt')
  await expect(page.getByText('Bu seçim için personel sıralaması yok.', { exact: true })).toBeVisible()
  await expect(page.locator('.store-rankings-pagination > span')).toHaveText('0-0 / 420')
  await expect(page.locator('.store-rankings-table caption')).toContainText('0-0')

  await page.getByRole('button', { name: 'Temizle', exact: true }).click()
  await expect(page.getByTestId('personnel-ranking-row')).toHaveCount(rankingsFixture.personnelLeaderboard.items.length)
  await expect(page.locator('.store-rankings-pagination > span')).toHaveText('1-1 / 420')
})

test('pending pagination keeps the displayed range and prevents skipping pages', async ({ page }) => {
  await page.route('**/api/auth/session', route => route.fulfill({ json: {
    ...authSessionFixture,
    user: { ...authSessionFixture.user, userId: 'rankings-ui-audit', roleCodes: ['REPORT_VIEWER'] },
  } }))
  let releasePage: () => void = () => undefined
  const nextPageReady = new Promise<void>(resolve => { releasePage = resolve })
  const requestedOffsets: number[] = []
  await page.route('**/api/reports/rankings**', async route => {
    const offset = Number(new URL(route.request().url()).searchParams.get('offset') ?? '0')
    requestedOffsets.push(offset)
    if (offset === 100) await nextPageReady
    await route.fulfill({ json: {
      ...rankingsPrivilegedDetailFixture,
      storeLeaderboard: {
        ...rankingsPrivilegedDetailFixture.storeLeaderboard,
        items: Array.from({ length: Math.min(100, 201 - offset) }, (_, index) => ({
          ...rankingsPrivilegedDetailStoreRow,
          storeId: `store-${offset + index + 1}`,
          storeName: `Mağaza ${offset + index + 1}`,
          rank: offset + index + 1,
        })),
        meta: { total: 201, limit: 100, offset },
      },
    } })
  })

  try {
    await page.goto('/store/rankings?period=2026-04-01')
    const pageInfo = page.locator('.store-rankings-pagination > span')
    const previous = page.getByRole('button', { name: 'Önceki sıralama sayfası', exact: true })
    const next = page.getByRole('button', { name: 'Sonraki sıralama sayfası', exact: true })
    await expect(pageInfo).toHaveText('1-100 / 201')
    await next.click()
    await expect(page.locator('.store-rankings-table-wrap')).toHaveAttribute('aria-busy', 'true')
    await expect(pageInfo).toHaveText('1-100 / 201')
    await expect(previous).toBeDisabled()
    await expect(next).toBeDisabled()
    expect(requestedOffsets).not.toContain(200)

    releasePage()
    await expect(pageInfo).toHaveText('101-200 / 201')
    await expect(page.locator('.store-rankings-table tbody tr').first()).toContainText('Mağaza 101')
    await expect(previous).toBeEnabled()
    await expect(next).toBeEnabled()
  } finally {
    releasePage()
  }
})

test('an empty page after the result set shrinks does not show an inverted range', async ({ page }) => {
  await page.route('**/api/auth/session', route => route.fulfill({ json: {
    ...authSessionFixture,
    user: { ...authSessionFixture.user, userId: 'rankings-ui-audit', roleCodes: ['REPORT_VIEWER'] },
  } }))
  await page.route('**/api/reports/rankings**', route => route.fulfill({ json: {
    ...rankingsPrivilegedDetailFixture,
    storeLeaderboard: {
      ...rankingsPrivilegedDetailFixture.storeLeaderboard,
      items: [],
      meta: { total: 1, limit: 100, offset: 100 },
    },
  } }))
  await page.goto('/store/rankings?period=2026-04-01&page=2')
  await expect(page.getByText('Bu seçim için mağaza sıralaması yok.', { exact: true })).toBeVisible()
  await expect(page.locator('.store-rankings-pagination > span')).toHaveText('0-0 / 1')
  await expect(page.locator('.store-rankings-table caption')).toContainText('0-0')
  await expect(page.getByRole('button', { name: 'Önceki sıralama sayfası', exact: true })).toBeEnabled()
})

for (const width of [320, 390]) {
  test(`ranking tab labels and counts fit within the board at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 844 })
    await page.goto('/store/rankings?period=2026-04-01')
    const board = page.locator('.store-rankings-board')
    await expect(board.locator('tbody tr').first()).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath(`rankings-tabs-${width}.png`), fullPage: true })
    const boardBounds = await board.boundingBox()
    expect(boardBounds).not.toBeNull()

    for (const name of [/Mağaza listesi/, /Personel listesi/]) {
      const tab = page.getByRole('tab', { name })
      const tabBounds = await tab.boundingBox()
      expect(tabBounds).not.toBeNull()
      expect(tabBounds!.x).toBeGreaterThanOrEqual(boardBounds!.x)
      expect(tabBounds!.x + tabBounds!.width).toBeLessThanOrEqual(boardBounds!.x + boardBounds!.width)
      expect(await tab.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1)
      const badgeBounds = await tab.locator('[data-slot="badge"]').boundingBox()
      expect(badgeBounds).not.toBeNull()
      expect(badgeBounds!.x + badgeBounds!.width).toBeLessThanOrEqual(boardBounds!.x + boardBounds!.width)
    }
  })
}
