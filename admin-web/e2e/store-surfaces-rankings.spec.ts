import { expect, test } from './test-fixtures'
import { demoEmployeeId } from './store-surfaces-identities'
import { routeStoreSurfaceApi } from './store-surfaces-api-fixtures'
import { authSessionFixture, myPerformanceFixture } from './store-surfaces-profile-fixtures'
import { storeRankingSummaryRow, personnelRankingDetailRow, regionManagerInScopePersonnelRow, regionManagerOutOfScopePersonnelRow, rankingsPrivilegedDetailStoreRow, rankingsPrivilegedDetailFixture, rankingsFixture } from './store-surfaces-ranking-fixtures'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'store-ops-admin-session',
      JSON.stringify({
        mode: 'mock',
        mockUserId: 'store-me-smoke-user',
        mockRoleCodes: 'STORE_PERSONNEL',
        mockCompanyIds: '00000000-0000-0000-0000-000000000001',
        bearerToken: '',
      }),
    )
  })

  await routeStoreSurfaceApi(page)
})

test('store rankings page renders Plum ranking table without signal chrome', async ({ page }) => {
  await page.goto('/store/rankings')

  await expect(page.getByRole('heading', { name: 'Sıralamalar' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Yıl filtresi' })).toContainText('2026')
  const monthFilter = page.getByRole('button', { name: 'Ay filtresi' })
  await expect(monthFilter).toContainText('Nis')
  await monthFilter.click()
  await expect(page.getByRole('checkbox', { name: 'Nis' })).toBeChecked()
  await page.getByRole('button', { name: 'Gün filtresi' }).click()
  await expect(page.getByRole('checkbox', { name: 'Nis' })).toHaveCount(0)
  await expect(page.getByRole('checkbox', { name: 'Tüm ay' })).toBeChecked()
  await page.getByRole('button', { name: 'Gün filtresi' }).click()
  await expect(page.getByTestId('store-rankings-page')).toBeVisible()
  await expect(page.getByText('Top 100 görünüm', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Seçili görünüm referansı')).toContainText('Türkiye Referansı')
  await expect(page.getByLabel('Sıralama güven özeti')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Türkiye mağaza sıralaması' })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Skor/ })).toBeVisible()
  await expect(page.locator('.store-rankings-scorebar').first()).toBeVisible()
  await expect(page.getByText('Sinyal')).toHaveCount(0)
  await page.getByRole('tab', { name: 'Personel listesi' }).click()
  await expect(page.getByRole('heading', { name: 'Türkiye personel sıralaması' })).toBeVisible()
  await expect(page.getByText('Store Personnel - 1').first()).toBeVisible()
  await expect(page.locator('.store-rankings-scorebar').first()).toBeVisible()
  await expect(page.getByText('Sinyal')).toHaveCount(0)
  await expect(page.getByText('Magaza ve personel rankingleri')).toHaveCount(0)
  await expect(page.getByText('Top 100 gorunumu')).toHaveCount(0)
  await expect(page.getByText('Turkiye magaza siralamasi')).toHaveCount(0)
  await expect(page.getByText('Turkiye personel siralamasi')).toHaveCount(0)
  await expect(page.getByText('Kendi magaza sirasi')).toHaveCount(0)
  await expect(page.getByText('Kendi personel sirasi')).toHaveCount(0)
  await expect(page.getByText('Siralama yuzeyi acilamadi')).toHaveCount(0)
})

test('store rankings retries a transient API failure without leaving the user stuck', async ({ page }) => {
  let rankingAttempts = 0

  await page.unroute('**/api/reports/rankings**')
  await page.route('**/api/reports/rankings**', async (route) => {
    rankingAttempts += 1

    if (rankingAttempts === 1) {
      await route.fulfill({ status: 503, json: { message: 'Temporary rankings outage' } })
      return
    }

    await route.fulfill({ json: rankingsFixture })
  })

  await page.goto('/store/rankings')

  await expect.poll(() => rankingAttempts).toBeGreaterThanOrEqual(2)
  await expect(page.getByTestId('store-rankings-page')).toBeVisible()
  await expect(page.getByText('IstinyePark Demo Store')).toBeVisible()
  await expect(page.getByText('Siralama yuzeyi acilamadi')).toHaveCount(0)
})

test('store rankings keeps non-privileged rows summary-only and backend-gated', async ({ page }) => {
  let personnelPerformanceRequests = 0

  await page.unroute('**/api/auth/session')
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({
      json: {
        ...authSessionFixture,
        user: {
          ...authSessionFixture.user,
          roleCodes: ['STORE_PERSONNEL'],
        },
      },
    })
  })

  await page.unroute('**/api/reports/rankings**')
  await page.route('**/api/reports/rankings**', async (route) => {
    await route.fulfill({
      json: {
        ...rankingsFixture,
        storeLeaderboard: {
          ...rankingsFixture.storeLeaderboard,
          items: [
            {
              ...storeRankingSummaryRow,
              metrics: rankingsPrivilegedDetailStoreRow.metrics,
            },
          ],
        },
        personnelLeaderboard: {
          items: [
            {
              ...personnelRankingDetailRow,
              employeeId: '99999999-9999-4999-8999-999999999998',
              displayName: 'Other Top Personnel',
              canOpenProfile: false,
            },
          ],
          currentEmployee: null,
          managedStorePersonnel: [],
          meta: {
            total: 420,
            limit: 100,
            offset: 0,
          },
        },
      },
    })
  })

  await page.unroute('**/api/reports/personnel-performance/**')
  await page.route('**/api/reports/personnel-performance/**', async (route) => {
    personnelPerformanceRequests += 1
    await route.fulfill({ status: 403, json: { message: 'Forbidden' } })
  })

  await page.goto('/store/rankings')

  const rankingTable = page.locator('.store-rankings-table')
  await expect(page.getByText('Top 100 görünüm', { exact: true })).toBeVisible()
  await expect(rankingTable.getByRole('columnheader', { name: /UPT/ })).toHaveCount(0)
  await expect(rankingTable.getByRole('columnheader', { name: /BM/ })).toHaveCount(0)
  await expect(rankingTable.getByRole('button', { name: 'Detay aç' })).toHaveCount(0)

  await page.getByRole('tab', { name: 'Personel listesi' }).click()
  await expect(page.getByRole('row', { name: /Other Top Personnel/ })).toBeVisible()
  await expect(rankingTable.getByRole('columnheader', { name: /ATV/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Profile Git' })).toHaveCount(0)
  await expect.poll(() => personnelPerformanceRequests).toBe(0)
})

test('store personnel profile hides backend denial details on direct access', async ({ page }) => {
  const deniedEmployeeId = '99999999-9999-4999-8999-999999999998'

  await page.unroute('**/api/auth/session')
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({
      json: {
        ...authSessionFixture,
        user: {
          ...authSessionFixture.user,
          userId: 'region-ranking-user',
          roleCodes: ['REGION_MANAGER'],
        },
      },
    })
  })

  await page.unroute('**/api/reports/personnel-performance/**')
  await page.route('**/api/reports/personnel-performance/**', async (route) => {
    await route.fulfill({
      status: 403,
      json: { message: `Forbidden employee ${deniedEmployeeId}` },
    })
  })

  await page.goto(`/store/personnel/${deniedEmployeeId}`)

  await expect(page.getByRole('heading', { name: 'Personel profili açılamıyor' })).toBeVisible()
  await expect(page.getByText('Bu personel profiline erişiminiz yok.')).toBeVisible()
  await expect(page.locator('body')).not.toContainText('Forbidden employee')
  await expect(page.locator('body')).not.toContainText(deniedEmployeeId)
})

test('store rankings personnel detail opens the selected personnel performance profile', async ({ page }) => {
  const personnelPerformanceRequests: URL[] = []
  const rankingRequests: URL[] = []

  await page.unroute('**/api/auth/session')
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({
      json: {
        ...authSessionFixture,
        user: {
          ...authSessionFixture.user,
          userId: 'region-ranking-user',
          roleCodes: ['REGION_MANAGER'],
        },
      },
    })
  })

  await page.unroute('**/api/reports/rankings**')
  await page.route('**/api/reports/rankings**', async (route) => {
    rankingRequests.push(new URL(route.request().url()))
    await route.fulfill({
      json: {
        ...rankingsPrivilegedDetailFixture,
        personnelLeaderboard: {
          items: [personnelRankingDetailRow],
          currentEmployee: null,
          managedStorePersonnel: [],
          meta: {
            total: 1,
            limit: 100,
            offset: 0,
          },
        },
      },
    })
  })
  await page.unroute('**/api/reports/personnel-performance/**')
  await page.route('**/api/reports/personnel-performance/**', async (route) => {
    const requestUrl = new URL(route.request().url())
    personnelPerformanceRequests.push(requestUrl)
    await route.fulfill({
      json: {
        ...myPerformanceFixture,
        employee: {
          ...myPerformanceFixture.employee,
          employeeId: demoEmployeeId,
          displayName: 'Store Personnel - 1',
          storeName: 'IstinyePark Demo Store',
        },
      },
    })
  })

  await page.goto('/store/rankings?list=personnel&period=2026-04-01&q=Store&sort=ATV&dir=asc&page=2')
  await expect(page.getByRole('tab', { name: 'Personel listesi' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('searchbox', { name: 'Personel arama' })).toHaveValue('Store')
  await expect.poll(() =>
    rankingRequests.some((requestUrl) =>
      requestUrl.searchParams.get('periodStart') === '2026-04-01' &&
      requestUrl.searchParams.get('search') === 'Store' &&
      requestUrl.searchParams.get('sortKey') === 'ATV' &&
      requestUrl.searchParams.get('sortDirection') === 'asc' &&
      requestUrl.searchParams.get('offset') === '100',
    ),
  ).toBe(true)
  const personnelRow = page.getByRole('row', { name: /Store Personnel - 1/ })
  await personnelRow.getByRole('button', { name: 'Profile Git' }).click()
  await expect(page.locator('.store-rankings-drawer')).toHaveCount(0)

  await expect(page).toHaveURL(new RegExp(`/store/personnel/${demoEmployeeId}\\?`))
  await expect.poll(() => new URL(page.url()).searchParams.get('mode')).toBe('live')
  await expect.poll(() => new URL(page.url()).searchParams.get('periodType')).toBe('monthly')
  await expect.poll(() => new URL(page.url()).searchParams.get('periodStart')).toBe('2026-04-01')
  await expect(page.locator('[data-testid="store-me-page"]')).toBeVisible()
  const storeMeHeader = page.locator('.store-me-compact-header')
  await expect(storeMeHeader.getByRole('heading', { name: /Store Personnel - 1/i })).toBeVisible()
  await expect(storeMeHeader).toContainText('IstinyePark Demo Store')
  await expect(page.locator('[data-testid="store-me-metric-card"]')).toHaveCount(3)
  await expect(page.locator('[data-testid="store-me-metric-card"]').filter({ hasText: 'CR' })).toHaveCount(0)
  await expect
    .poll(() =>
      personnelPerformanceRequests.some((requestUrl) => requestUrl.searchParams.get('periodStart') === '2026-04-01'),
    )
    .toBe(true)

  await page.goBack()
  await expect(page).toHaveURL(/\/store\/rankings\?/)
  const returnedParams = new URL(page.url()).searchParams
  expect(returnedParams.get('list')).toBe('personnel')
  expect(returnedParams.get('period')).toBe('2026-04-01')
  expect(returnedParams.get('q')).toBe('Store')
  expect(returnedParams.get('sort')).toBe('ATV')
  expect(returnedParams.get('dir')).toBe('asc')
  expect(returnedParams.get('page')).toBe('2')
  await expect(page.getByRole('tab', { name: 'Personel listesi' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('searchbox', { name: 'Personel arama' })).toHaveValue('Store')
  await expect(page.getByRole('row', { name: /Store Personnel - 1/ })).toBeVisible()
})

test('region manager rankings opens only in-region personnel profile actions', async ({ page }) => {
  const personnelPerformanceRequests: URL[] = []

  await page.unroute('**/api/auth/session')
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({
      json: {
        ...authSessionFixture,
        user: {
          ...authSessionFixture.user,
          userId: 'region-ranking-user',
          employeeId: '00000000-0000-0000-0000-000000000301',
          roleCodes: ['REGION_MANAGER'],
          scope: {
            companyIds: ['company-1'],
            regionIds: ['region-1'],
            storeIds: [],
          },
          readScope: {
            companyIds: ['company-1'],
            regionIds: ['region-1'],
            storeIds: [],
          },
          actionScope: {
            assignedStoreIds: ['store-in-region'],
          },
          assignedStoreIds: ['store-in-region'],
        },
      },
    })
  })

  await page.unroute('**/api/reports/rankings**')
  await page.route('**/api/reports/rankings**', async (route) => {
    await route.fulfill({
      json: {
        ...rankingsPrivilegedDetailFixture,
        personnelLeaderboard: {
          items: [regionManagerInScopePersonnelRow, regionManagerOutOfScopePersonnelRow],
          currentEmployee: null,
          managedStorePersonnel: [],
          meta: {
            total: 2,
            limit: 100,
            offset: 0,
          },
        },
      },
    })
  })

  await page.unroute('**/api/reports/personnel-performance/**')
  await page.route('**/api/reports/personnel-performance/**', async (route) => {
    const requestUrl = new URL(route.request().url())
    personnelPerformanceRequests.push(requestUrl)
    await route.fulfill({
      json: {
        ...myPerformanceFixture,
        employee: {
          ...myPerformanceFixture.employee,
          employeeId: demoEmployeeId,
          displayName: 'BM Region Personnel',
          storeName: 'BM Region Store',
        },
      },
    })
  })

  await page.goto('/store/rankings')
  await page.getByRole('tab', { name: 'Personel listesi' }).click()

  const inScopeRow = page.getByRole('row', { name: /BM Region Personnel/ })
  await inScopeRow.getByRole('button', { name: 'Profile Git' }).click()
  await expect(page.locator('.store-rankings-drawer')).toHaveCount(0)
  await expect(page).toHaveURL(new RegExp(`/store/personnel/${demoEmployeeId}\\?`))
  await expect(page.locator('[data-testid="store-me-page"]')).toBeVisible()
  const inScopeRequestCount = personnelPerformanceRequests.length
  expect(inScopeRequestCount).toBeGreaterThan(0)

  await page.goto('/store/rankings')
  await page.getByRole('tab', { name: 'Personel listesi' }).click()
  const outOfScopeRow = page.getByRole('row', { name: /Other Region Personnel/ })
  await expect(outOfScopeRow).toBeVisible()
  await expect(outOfScopeRow.getByRole('button', { name: 'Profile Git' })).toHaveCount(0)
  await expect(page.locator('.store-rankings-drawer')).toHaveCount(0)
  await expect.poll(() => personnelPerformanceRequests.length).toBe(inScopeRequestCount)
})
