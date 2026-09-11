import { expect, test } from './test-fixtures'
import { setStoredLocale } from './locale-test-utils'
import { demoEmployeeId } from './store-surfaces-identities'
import { routeStoreSurfaceApi } from './store-surfaces-api-fixtures'
import { authSessionFixture, myPerformanceFixture } from './store-surfaces-profile-fixtures'
import { personnelRankingDetailRow, rankingsPrivilegedLowHgStoreRow, rankingsPrivilegedMissingChecklistStoreRow, scoreDisplayLeaderStoreRow, scoreDisplayFollowerStoreRow, rankingsPrivilegedDetailFixture, rankingsFixture, rankingsDailyFixture } from './store-surfaces-ranking-fixtures'

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

test('store personnel profile preserves a selected no-data period from rankings', async ({ page }) => {
  const personnelPerformanceRequests: URL[] = []
  const aprilOnlyPeriods = [
    {
      periodType: 'monthly',
      periodStart: '2026-04-01',
      periodEnd: '2026-04-30',
    },
  ]
  const noMayPersonnelDataFixture = {
    ...myPerformanceFixture,
    employee: {
      employeeId: demoEmployeeId,
      displayName: 'Unknown employee',
      storeId: null,
      storeName: null,
    },
    period: null,
    score: {
      value: 0,
      matchedMetrics: 0,
      totalMetrics: 3,
    },
    availablePeriods: aprilOnlyPeriods,
    partial: {
      isPartial: true,
      missingMetricCodes: ['TARGET_ACHIEVEMENT', 'ATV', 'UPT'],
      missingMetricLabels: ['Target Achievement', 'Average Ticket Value', 'Units Per Ticket'],
      pendingNormalizationCodes: [],
      pendingNormalizationLabels: [],
    },
    metrics: myPerformanceFixture.metrics.map((metric) => ({
      ...metric,
      actualValue: null,
      contributionValue: 0,
      dataStatus: 'missing',
      scoreStatus: 'missing',
      status: 'missing',
    })),
  }

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
    await route.fulfill({
      json: {
        ...rankingsPrivilegedDetailFixture,
        source: {
          ...rankingsPrivilegedDetailFixture.source,
          periodStart: '2026-05-01',
          periodEnd: '2026-05-31',
        },
        availablePeriods: [
          ...rankingsPrivilegedDetailFixture.availablePeriods,
          {
            periodType: 'monthly',
            periodStart: '2026-05-01',
            periodEnd: '2026-05-31',
          },
        ],
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

    if (requestUrl.searchParams.get('periodStart') === '2026-05-01') {
      await route.fulfill({ json: noMayPersonnelDataFixture })
      return
    }

    await route.fulfill({
      json: {
        ...myPerformanceFixture,
        availablePeriods: aprilOnlyPeriods,
        employee: {
          ...myPerformanceFixture.employee,
          employeeId: demoEmployeeId,
          displayName: 'Store Personnel - 1',
          storeName: 'IstinyePark Demo Store',
        },
      },
    })
  })

  await page.goto('/store/rankings')
  await page.getByRole('tab', { name: 'Personel listesi' }).click()
  await page
    .getByRole('row', { name: /Store Personnel - 1/ })
    .getByRole('button', { name: 'Profile Git' })
    .click()

  await expect.poll(() =>
    personnelPerformanceRequests.some((requestUrl) => requestUrl.searchParams.get('periodStart') === '2026-05-01'),
  ).toBe(true)
  await expect(page).toHaveURL(/periodStart=2026-05-01/)
  await expect(page.getByText('Seçilen tarih için veri bulunamadı')).toBeVisible()
})

test('store personnel profile date filter uses the shared calendar', async ({ page }) => {
  const personnelPerformanceRequests: URL[] = []
  const loadedPeriods = [
    {
      periodType: 'monthly',
      periodStart: '2026-04-01',
      periodEnd: '2026-04-30',
    },
    {
      periodType: 'monthly',
      periodStart: '2026-05-01',
      periodEnd: '2026-05-31',
    },
  ]

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
    const requestUrl = new URL(route.request().url())
    const requestedPeriodStart = requestUrl.searchParams.get('periodStart')
    personnelPerformanceRequests.push(requestUrl)

    await route.fulfill({
      json: {
        ...myPerformanceFixture,
        period: {
          periodStart: requestedPeriodStart || '2026-04-01',
          periodEnd: requestedPeriodStart?.startsWith('2026-05') ? '2026-05-31' : '2026-04-30',
        },
        availablePeriods: loadedPeriods,
        employee: {
          ...myPerformanceFixture.employee,
          employeeId: demoEmployeeId,
          displayName: 'Store Personnel - 1',
          storeName: 'IstinyePark Demo Store',
        },
      },
    })
  })

  await page.goto(`/store/personnel/${demoEmployeeId}?mode=live&periodType=monthly&periodStart=2026-04-01`)
  await page.getByRole('button', { name: /Tarih filtresi/i }).click()

  await expect(page.locator('[data-slot="calendar"]')).toBeVisible()
  await page.getByRole('combobox', { name: 'Ay seç' }).selectOption({ index: 4 })
  await page.getByRole('button', { name: 'Uygula' }).click()

  await expect.poll(() =>
    personnelPerformanceRequests.some(
      (requestUrl) =>
        requestUrl.searchParams.get('periodType') === 'monthly' &&
        requestUrl.searchParams.get('periodStart') === '2026-05-01',
    ),
  ).toBe(true)
})

test('store personnel profile derives date filters from the active period when the period list is empty', async ({ page }) => {
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
      json: {
        ...myPerformanceFixture,
        period: {
          periodStart: '2026-03-01',
          periodEnd: '2026-03-31',
        },
        availablePeriods: [],
        employee: {
          ...myPerformanceFixture.employee,
          employeeId: demoEmployeeId,
          displayName: 'Store Personnel - 1',
          storeName: 'IstinyePark Demo Store',
        },
      },
    })
  })

  await page.goto(`/store/personnel/${demoEmployeeId}?mode=live&periodType=monthly&periodStart=2026-03-01`)
  await page.getByRole('button', { name: /Tarih filtresi/i }).click()

  await expect(page.getByText('Yüklü dönem yok')).toHaveCount(0)
  await expect(page.locator('[data-slot="calendar"]')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Tarih filtresi' })).toContainText('Mart 2026')
})

test('store personnel profile keeps an explicitly selected month when it has no rows', async ({ page }) => {
  const personnelPerformanceRequests: URL[] = []
  const loadedPeriods = [
    {
      periodType: 'daily',
      periodStart: '2026-04-24',
      periodEnd: '2026-04-24',
    },
  ]
  const noMonthlyDataFixture = {
    ...myPerformanceFixture,
    employee: {
      employeeId: demoEmployeeId,
      displayName: 'Unknown employee',
      storeId: null,
      storeName: null,
    },
    period: null,
    score: {
      value: 0,
      matchedMetrics: 0,
      totalMetrics: 3,
    },
    availablePeriods: loadedPeriods,
    partial: {
      isPartial: true,
      missingMetricCodes: ['TARGET_ACHIEVEMENT', 'ATV', 'UPT'],
      missingMetricLabels: ['Target Achievement', 'Average Ticket Value', 'Units Per Ticket'],
      pendingNormalizationCodes: [],
      pendingNormalizationLabels: [],
    },
    metrics: myPerformanceFixture.metrics.map((metric) => ({
      ...metric,
      actualValue: null,
      contributionValue: 0,
      dataStatus: 'missing',
      scoreStatus: 'missing',
      status: 'missing',
    })),
  }
  const dailyPerformanceFixture = {
    ...myPerformanceFixture,
    period: {
      periodStart: '2026-04-24',
      periodEnd: '2026-04-24',
    },
    availablePeriods: loadedPeriods,
    employee: {
      ...myPerformanceFixture.employee,
      employeeId: demoEmployeeId,
      displayName: 'Store Personnel - 1',
      storeName: 'IstinyePark Demo Store',
    },
  }

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
    const requestUrl = new URL(route.request().url())
    personnelPerformanceRequests.push(requestUrl)

    await route.fulfill({
      json:
        requestUrl.searchParams.get('periodType') === 'daily'
          ? dailyPerformanceFixture
          : noMonthlyDataFixture,
    })
  })

  await page.goto(`/store/personnel/${demoEmployeeId}?mode=live&periodType=monthly&periodStart=2026-05-01`)

  await expect(page.getByText('Seçilen tarih için veri bulunamadı')).toBeVisible()
  expect(personnelPerformanceRequests.some(
    (requestUrl) => requestUrl.searchParams.get('periodType') === 'daily',
  )).toBe(false)
})

test('store personnel profile uses employee periods instead of global closed snapshots', async ({ page }) => {
  const personnelPerformanceRequests: URL[] = []
  const snapshotRunRequests: URL[] = []
  const loadedPeriods = [
    {
      periodType: 'monthly',
      periodStart: '2026-03-01',
      periodEnd: '2026-03-31',
    },
    {
      periodType: 'daily',
      periodStart: '2026-03-01',
      periodEnd: '2026-03-01',
    },
    {
      periodType: 'daily',
      periodStart: '2026-03-02',
      periodEnd: '2026-03-02',
    },
  ]
  const monthlyPerformanceFixture = {
    ...myPerformanceFixture,
    period: {
      periodStart: '2026-03-01',
      periodEnd: '2026-03-31',
    },
    availablePeriods: loadedPeriods,
    employee: {
      ...myPerformanceFixture.employee,
      employeeId: demoEmployeeId,
      displayName: 'Store Personnel - 1',
      storeName: 'IstinyePark Demo Store',
    },
  }
  const dailyPerformanceFixture = {
    ...myPerformanceFixture,
    period: {
      periodStart: '2026-03-01',
      periodEnd: '2026-03-01',
    },
    availablePeriods: loadedPeriods,
    employee: {
      ...myPerformanceFixture.employee,
      employeeId: demoEmployeeId,
      displayName: 'Store Personnel - 1',
      storeName: 'IstinyePark Demo Store',
    },
  }

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

  await page.unroute('**/api/reports/snapshot-runs**')
  await page.route('**/api/reports/snapshot-runs**', async (route) => {
    snapshotRunRequests.push(new URL(route.request().url()))
    await route.fulfill({
      json: {
        items: [
          {
            snapshotRunId: '00000000-0000-0000-0000-000000000501',
            snapshotType: 'daily',
            snapshotDate: '2026-04-24',
            runStatus: 'completed',
            generatedAt: '2026-04-24T21:00:00.000Z',
            generatedBy: null,
          },
        ],
        total: 1,
        limit: 30,
        offset: 0,
      },
    })
  })

  await page.unroute('**/api/reports/personnel-performance/**')
  await page.route('**/api/reports/personnel-performance/**', async (route) => {
    const requestUrl = new URL(route.request().url())
    personnelPerformanceRequests.push(requestUrl)

    await route.fulfill({
      json:
        requestUrl.searchParams.get('periodType') === 'daily'
          ? dailyPerformanceFixture
          : monthlyPerformanceFixture,
    })
  })

  await page.goto(`/store/personnel/${demoEmployeeId}`)
  await page.getByRole('button', { name: /Tarih filtresi/i }).click()

  await expect(page.getByText('Kapanmış performans kaydı seçimi')).toHaveCount(0)
  await expect(page.getByText('Kapanmış gün')).toHaveCount(0)
  await expect(page.locator('[data-slot="calendar"]')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Tarih filtresi' })).toContainText('Mart 2026')
  await expect(page.getByText('Nisan 2026')).toHaveCount(0)
  expect(snapshotRunRequests).toEqual([])
})

test('store personnel profile resets requested live period when switching employees', async ({ page }) => {
  const firstEmployeeId = demoEmployeeId
  const secondEmployeeId = '00000000-0000-0000-0000-000000000203'
  const personnelPerformanceRequests: URL[] = []
  const firstDailyFixture = {
    ...myPerformanceFixture,
    period: {
      periodStart: '2026-03-02',
      periodEnd: '2026-03-02',
    },
    availablePeriods: [
      {
        periodType: 'daily',
        periodStart: '2026-03-02',
        periodEnd: '2026-03-02',
      },
    ],
    employee: {
      ...myPerformanceFixture.employee,
      employeeId: firstEmployeeId,
      displayName: 'First Person',
      storeName: 'First Store',
    },
  }
  const secondMonthlyFixture = {
    ...myPerformanceFixture,
    period: {
      periodStart: '2026-04-01',
      periodEnd: '2026-04-30',
    },
    availablePeriods: [
      {
        periodType: 'monthly',
        periodStart: '2026-04-01',
        periodEnd: '2026-04-30',
      },
    ],
    employee: {
      ...myPerformanceFixture.employee,
      employeeId: secondEmployeeId,
      displayName: 'Second Person',
      storeName: 'Second Store',
    },
  }
  const secondWrongPeriodFixture = {
    ...secondMonthlyFixture,
    period: null,
    score: {
      value: 0,
      matchedMetrics: 0,
      totalMetrics: 3,
    },
    metrics: secondMonthlyFixture.metrics.map((metric) => ({
      ...metric,
      actualValue: null,
      achievementRate: null,
      actualRatio: null,
      scoredRatio: null,
      contributionValue: 0,
      dataStatus: 'missing',
      scoreStatus: 'missing',
      status: 'missing',
    })),
  }

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
    const requestUrl = new URL(route.request().url())
    const requestedEmployeeId = decodeURIComponent(requestUrl.pathname.split('/').at(-1) ?? '')
    personnelPerformanceRequests.push(requestUrl)

    if (requestedEmployeeId === firstEmployeeId) {
      await route.fulfill({ json: firstDailyFixture })
      return
    }

    const isSecondMonthlyRequest =
      requestedEmployeeId === secondEmployeeId &&
      requestUrl.searchParams.get('periodType') === 'monthly' &&
      requestUrl.searchParams.get('periodStart') === '2026-04-01'

    await route.fulfill({
      json: isSecondMonthlyRequest ? secondMonthlyFixture : secondWrongPeriodFixture,
    })
  })

  await page.goto(
    `/store/personnel/${firstEmployeeId}?mode=live&periodType=daily&periodStart=2026-03-02`,
  )
  await expect(page.getByRole('heading', { name: /First Person/i })).toBeVisible()

  personnelPerformanceRequests.length = 0
  await page.evaluate((url) => {
    window.history.pushState({}, '', url)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }, `/store/personnel/${secondEmployeeId}?mode=live&periodType=monthly&periodStart=2026-04-01`)

  await expect
    .poll(
      () =>
        personnelPerformanceRequests.find((requestUrl) =>
          requestUrl.pathname.endsWith(secondEmployeeId),
        ) !== undefined,
    )
    .toBe(true)

  const firstSecondRequest = personnelPerformanceRequests.find((requestUrl) =>
    requestUrl.pathname.endsWith(secondEmployeeId),
  )
  expect(firstSecondRequest?.searchParams.get('periodType')).toBe('monthly')
  expect(firstSecondRequest?.searchParams.get('periodStart')).toBe('2026-04-01')
  await expect(page.getByRole('heading', { name: /Second Person/i })).toBeVisible()
})

test('store rankings page switches to English copy and persists locale', async ({ page }) => {
  await page.goto('/store/rankings')

  await setStoredLocale(page, 'en')

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('heading', { name: 'Rankings' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Period filter' })).toContainText('2026')
  const monthFilter = page.getByRole('button', { name: 'Period filter' })
  await expect(monthFilter).toContainText('Apr')
  await monthFilter.click()
  await expect(page.getByRole('dialog', { name: 'Select period' }).getByRole('combobox', { name: 'Choose month' })).toHaveValue('3')
  await monthFilter.click()
  await expect(page.getByTestId('store-rankings-page')).toBeVisible()
  await expect(page.locator('header').getByText('Top 100 view', { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Turkey store ranking' })).toBeVisible()
  await expect(page.getByRole('table', { name: /Showing store results/i })).toBeVisible()
  await page.getByRole('tab', { name: 'Personnel list' }).click()
  await expect(page.getByRole('heading', { name: 'Turkey personnel ranking' })).toBeVisible()
  await expect(page.getByRole('table', { name: /Showing personnel results/i })).toBeVisible()
  await expect.poll(() => new URL(page.url()).searchParams.get('list')).toBe('personnel')
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.getByText('Mağaza ve personel sıralamaları')).toHaveCount(0)
  await expect(page.locator('body')).not.toContainText('Ã')
  await expect(page.locator('body')).not.toContainText('Ä')
  await expect(page.locator('body')).not.toContainText('Å')

  await page.reload()

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('heading', { name: 'Rankings' })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Personnel list' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('table', { name: /Showing personnel results/i })).toBeVisible()
  await expect
    .poll(
      () => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
      { message: 'store rankings should not create page-level horizontal overflow on mobile' },
    )
    .toBe(true)
})

test('store rankings personnel mobile cards keep text separated', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/store/rankings')
  await page.getByRole('tab', { name: 'Personel listesi' }).click()

  const firstPersonnelCard = page.locator('.store-rankings-table tbody tr').first()
  await expect(firstPersonnelCard.locator('.store-rankings-cell-entity')).toBeVisible()
  await expect(firstPersonnelCard.locator('.store-rankings-entity-detail')).toBeVisible()
  await expect(firstPersonnelCard.locator('.store-rankings-cell-store')).toBeHidden()
  await expect(firstPersonnelCard.locator('.store-rankings-cell-score')).toBeVisible()
  await expect(firstPersonnelCard.locator('.store-rankings-cell-action')).toBeVisible()

  const overlappingCells = await firstPersonnelCard.evaluate((row) => {
    const cells = Array.from(row.querySelectorAll('td'))
      .map((cell) => {
        const rect = cell.getBoundingClientRect()

        return {
          label: cell.getAttribute('data-label') ?? '',
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom,
          visible: rect.width > 0 && rect.height > 0,
        }
      })
      .filter((cell) => cell.visible)
    const overlaps: string[] = []

    for (let firstIndex = 0; firstIndex < cells.length; firstIndex += 1) {
      for (let secondIndex = firstIndex + 1; secondIndex < cells.length; secondIndex += 1) {
        const first = cells[firstIndex]
        const second = cells[secondIndex]
        const separated =
          first.right <= second.left + 1 ||
          second.right <= first.left + 1 ||
          first.bottom <= second.top + 1 ||
          second.bottom <= first.top + 1

        if (!separated) {
          overlaps.push(`${first.label}/${second.label}`)
        }
      }
    }

    return overlaps
  })

  expect(overlappingCells).toEqual([])
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth))
    .toBe(true)
})

test('store rankings requests exact loaded day and returns to monthly view', async ({ page }) => {
  const rankingRequests: URL[] = []

  await page.unroute('**/api/reports/rankings**')
  await page.route('**/api/reports/rankings**', async (route) => {
    const url = new URL(route.request().url())
    rankingRequests.push(url)

    await route.fulfill({
      json: url.searchParams.get('periodType') === 'daily' ? rankingsDailyFixture : rankingsFixture,
    })
  })

  await page.goto('/store/rankings')
  await expect(page.getByRole('button', { name: 'Dönem filtresi' })).toContainText('Nis 2026')
  await expect(page.getByText('Top 100 görünüm', { exact: true })).toBeVisible()
  await expect(
    page.getByText('Top 100 görünümünü, kendi mağaza ve personel konumunla birlikte takip et.'),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Dönem filtresi' }).click()
  await page.getByRole('button', { name: '15 Nisan 2026 Çarşamba' }).click()
  await page.getByRole('button', { name: 'Uygula' }).click()
  await expect
    .poll(() =>
      rankingRequests.some(
        (url) =>
          url.searchParams.get('periodType') === 'daily' &&
          url.searchParams.get('periodStart') === '2026-04-15',
      ),
    )
    .toBe(true)
  await expect(page.getByRole('button', { name: 'Dönem filtresi' })).toContainText('15 Nis 2026')
  await expect(page.getByText('Seçili gün görünümü')).toBeVisible()
  await page.getByRole('button', { name: 'Dönem filtresi' }).click()
  await page.getByRole('button', { name: 'Tüm ay' }).click()
  await expect
    .poll(() => {
      const lastRequest = rankingRequests.at(-1)

      return lastRequest
        ? `${lastRequest.searchParams.get('periodType')}:${lastRequest.searchParams.get('periodStart')}`
        : ''
    })
    .toBe('monthly:2026-04-01')
  await expect(page.getByText('Global liste Top 100 ozet; kendi konumun ayrica gorunur.')).toHaveCount(0)
  await expect(page.getByText('Siralama yuzeyi acilamadi')).toHaveCount(0)
})

test('store rankings uses Turkey reference, checklist metrics, normalized HG, and backend sort params', async ({ page }) => {
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
    const url = new URL(route.request().url())
    rankingRequests.push(url)
    const ascendingTargetSort =
      url.searchParams.get('sortKey') === 'TARGET_ACHIEVEMENT' &&
      url.searchParams.get('sortDirection') === 'asc'

    if (ascendingTargetSort) {
      await new Promise((resolve) => setTimeout(resolve, 250))
    }

    await route.fulfill({
      json: {
        ...rankingsPrivilegedDetailFixture,
        storeLeaderboard: {
          ...rankingsPrivilegedDetailFixture.storeLeaderboard,
          items: ascendingTargetSort
            ? [rankingsPrivilegedLowHgStoreRow]
            : [rankingsPrivilegedMissingChecklistStoreRow],
        },
      },
    })
  })

  await page.goto('/store/rankings')

  await expect(page.getByRole('heading', { name: 'Türkiye Referansı' })).toBeVisible()
  await expect(page.getByLabel('Seçili görünüm referansı')).toContainText('Türkiye Referansı')
  const rankingTable = page.locator('.store-rankings-table')
  await expect(rankingTable.locator('thead')).not.toContainText('KPI')
  await expect(page.locator('td[data-label="KPI özeti"]')).toHaveCount(0)
  await expect(page.locator('td[data-label="KPI summary"]')).toHaveCount(0)
  await expect(rankingTable.locator('thead')).toContainText('BM')
  await expect(rankingTable.locator('thead')).toContainText('VM')
  await expect(rankingTable.locator('thead')).toContainText('GSM')
  await expect(rankingTable.locator('thead')).toContainText('CR')
  await expect(rankingTable.getByRole('columnheader', { name: 'Aksiyon' })).toHaveCount(0)
  await expect(rankingTable.getByRole('button', { name: 'Detay aç' })).toHaveCount(0)
  await expect(rankingTable.locator('tbody')).toContainText('19,70%')
  await expect(rankingTable.locator('tbody')).toContainText('371,09%')
  await expect(rankingTable.locator('tbody')).not.toContainText('371.088.457%')
  await expect(rankingTable.locator('tbody')).toContainText('Yapılmadı')

  await page.locator('.store-rankings-sort-button', { hasText: 'HG%' }).click()
  await page.locator('.store-rankings-sort-button', { hasText: 'HG%' }).click()

  await expect(page.getByText('High HG Store')).toBeVisible()
  await expect(page.getByText('Sıralama hazırlanıyor')).toHaveCount(0)
  await expect(page.getByText('Sıralama yüzeyi açılamadı')).toHaveCount(0)
  await expect.poll(() => rankingRequests.at(-1)?.searchParams.get('sortKey')).toBe('TARGET_ACHIEVEMENT')
  await expect.poll(() => rankingRequests.at(-1)?.searchParams.get('sortDirection')).toBe('asc')
  await expect(page.getByText('Low HG Store')).toBeVisible()
  await expect(rankingTable.locator('tbody')).toContainText('%91,21')
})

test('store rankings removes signal chrome while preserving weighted score rows', async ({ page }) => {
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
    await route.fulfill({
      json: {
        ...rankingsPrivilegedDetailFixture,
        storeLeaderboard: {
          ...rankingsPrivilegedDetailFixture.storeLeaderboard,
          items: [scoreDisplayLeaderStoreRow, scoreDisplayFollowerStoreRow],
          meta: {
            total: 2,
            limit: 100,
            offset: 0,
          },
        },
      },
    })
  })

  await page.goto('/store/rankings')

  const rows = page.locator('.store-rankings-table tbody tr')
  await expect(rows.nth(0)).toContainText('Weighted Score Leader With Long Store Name')
  await expect(rows.nth(0).locator('.store-rankings-scorebar')).toContainText('112,30')
  await expect(rows.nth(1)).toContainText('Raw Delta Trap')
  await expect(rows.nth(1).locator('.store-rankings-scorebar')).toContainText('104,20')
  await expect(page.getByText('Sinyal')).toHaveCount(0)

  await expect(page.getByRole('columnheader', { name: 'Aksiyon' })).toHaveCount(0)
  await expect(rows.nth(0).getByRole('button', { name: 'Detay aç' })).toHaveCount(0)
  await expect(page.locator('.store-rankings-drawer')).toHaveCount(0)
})

test('store rankings store rows keep long names on one line without covering scores', async ({ page }) => {
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
    await route.fulfill({
      json: {
        ...rankingsPrivilegedDetailFixture,
        storeLeaderboard: {
          ...rankingsPrivilegedDetailFixture.storeLeaderboard,
          items: [
            {
              ...scoreDisplayLeaderStoreRow,
              storeName: 'Istanbul Beylikduzu Cadde Avm Metropol Outlet Uzun Magaza Adi',
            },
            scoreDisplayFollowerStoreRow,
          ],
          meta: {
            total: 2,
            limit: 100,
            offset: 0,
          },
        },
      },
    })
  })

  await page.setViewportSize({ width: 1366, height: 768 })
  await page.goto('/store/rankings')

  const firstRow = page.locator('.store-rankings-table tbody tr').first()
  const storeName = firstRow.locator('.store-rankings-entity-copy-store strong')
  await expect(storeName).toBeVisible()

  const storeTextLayout = await storeName.evaluate((node) => {
    const rect = node.getBoundingClientRect()
    const style = window.getComputedStyle(node)

    return {
      height: rect.height,
      lineHeight: Number.parseFloat(style.lineHeight),
      overflow: style.overflow,
      textOverflow: style.textOverflow,
      whiteSpace: style.whiteSpace,
    }
  })

  expect(storeTextLayout.whiteSpace).toBe('nowrap')
  expect(storeTextLayout.overflow).toBe('hidden')
  expect(storeTextLayout.textOverflow).toBe('ellipsis')
  expect(storeTextLayout.height).toBeLessThanOrEqual(storeTextLayout.lineHeight * 1.35)

  const tableWidthState = await page.locator('.store-rankings-table-wrap').evaluate((wrap) => {
    const table = wrap.querySelector('.store-rankings-table')
    const finalHeader = table?.querySelector('thead th:last-child')
    const wrapRect = wrap.getBoundingClientRect()
    const finalHeaderRect = finalHeader?.getBoundingClientRect()

    return {
      clientWidth: wrap.clientWidth,
      scrollWidth: wrap.scrollWidth,
      finalHeaderRight: finalHeaderRect?.right ?? Number.POSITIVE_INFINITY,
      wrapRight: wrapRect.right,
    }
  })

  expect(tableWidthState.scrollWidth).toBeLessThanOrEqual(tableWidthState.clientWidth + 1)
  expect(tableWidthState.finalHeaderRight).toBeLessThanOrEqual(tableWidthState.wrapRight + 1)

  const cellGap = await firstRow.evaluate((row) => {
    const storeCell = row.querySelector('.store-rankings-cell-entity')
    const scoreCell = row.querySelector('.store-rankings-cell-score')

    if (!storeCell || !scoreCell) {
      return Number.NEGATIVE_INFINITY
    }

    return scoreCell.getBoundingClientRect().left - storeCell.getBoundingClientRect().right
  })

  expect(cellGap).toBeGreaterThanOrEqual(-1)
})
