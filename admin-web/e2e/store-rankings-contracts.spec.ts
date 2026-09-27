import { expect, test, type Page } from './test-fixtures'
import {
  employeeIds,
  installGenericStoreApiFallbacks,
  installStoreContractSession,
  regionId,
  storeIds,
  type StoreContractPersona,
} from './store-page-contract-fixtures'

for (const persona of ['reportViewer', 'regionManager', 'storeManager', 'storePersonnel'] satisfies StoreContractPersona[]) {
  test(`ranking tabs and real-sized counts never overlap for ${persona}`, async ({ page }) => {
    await installStoreContractSession(page, persona)
    await installGenericStoreApiFallbacks(page)
    await page.route('**/api/reports/rankings**', async (route) => {
      const fixture = createRankingsContractFixture()
      fixture.storeLeaderboard.meta.total = 153
      fixture.personnelLeaderboard.meta.total = 974
      await route.fulfill({ json: fixture })
    })
    await page.goto('/store/rankings?period=2026-07-01')
    await expect(page.getByRole('tab', { name: 'Mağaza listesi 153' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Personel listesi 974' })).toBeVisible()
    for (const width of [1280, 1440, 360, 320]) {
      await page.setViewportSize({ width, height: 900 })
      await expect.poll(async () => page.locator('.store-rankings-list-toolbar').evaluate((toolbar) => {
        const tabs = [...toolbar.querySelectorAll<HTMLElement>('[data-slot="tabs-trigger"]')]
        const filters = toolbar.querySelector('.store-rankings-filters')?.getBoundingClientRect()
        if (tabs.length !== 2 || !filters) return false
        const [left, right] = tabs.map((tab) => tab.getBoundingClientRect())
        return left.right <= right.left
          && tabs.every((tab) => tab.scrollWidth <= tab.getBoundingClientRect().width + 1)
          && left.left >= 0 && right.right <= innerWidth
          && (innerWidth < 1280 || (right.right + 8 <= filters.left && Math.abs(right.y - filters.y) < 10))
          && document.documentElement.scrollWidth <= innerWidth
      })).toBe(true)
    }
    await page.setViewportSize({ width: 1280, height: 900 })
    const before = await page.getByRole('tablist').boundingBox()
    await page.getByRole('searchbox', { name: 'Mağaza Ara' }).fill('Marmara')
    await expect(page.getByRole('searchbox', { name: 'Mağaza Ara' })).toHaveValue('Marmara')
    await page.getByRole('button', { name: 'Temizle', exact: true }).click()
    await expect(page.getByRole('searchbox', { name: 'Mağaza Ara' })).toHaveValue('')
    await expect.poll(async () => (await page.getByRole('tablist').boundingBox())?.y).toBe(before?.y)
  })
}

test('personnel ranking keeps tab state and exposes no profile navigation', async ({ page }) => {
  await installStoreContractSession(page, 'regionManager')
  await installGenericStoreApiFallbacks(page)
  await routeRankingsContractApi(page)

  await page.goto('/store/rankings?list=personnel&period=2026-07-01')

  await expect(page.getByRole('heading', { name: 'Türkiye personel sıralaması' })).toBeVisible()
  const firstRank = await page.locator('[data-testid="personnel-ranking-rank"]').first().innerText()
  expect(firstRank.trim()).toBe('#6')
  await expect(page.getByRole('button', { name: 'Profile Git' })).toHaveCount(0)
  await expect(page.locator('.store-rankings-board a')).toHaveCount(0)
  await expect(page).toHaveURL(/\/store\/rankings\?list=personnel/)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Türkiye personel sıralaması' })).toBeVisible()
  await expect(page.locator('[data-testid="personnel-ranking-rank"]').first()).toHaveText('#6')
})

test('official personnel ranking surface does not render store-manager rows', async ({ page }) => {
  await installStoreContractSession(page, 'regionManager')
  await installGenericStoreApiFallbacks(page)
  await routeRankingsContractApi(page)

  await page.goto('/store/rankings?list=personnel&period=2026-07-01')

  await expect(page.getByText('Satış Danışmanı Ayşe')).toBeVisible()
  await expect(page.getByText('Mağaza Müdürü Mehmet')).toHaveCount(0)
})

test('ranking search waits for typing to stop and cancels the previous request without an error', async ({ page }) => {
  await installStoreContractSession(page, 'regionManager')
  await installGenericStoreApiFallbacks(page)
  await page.addInitScript(() => {
    const originalFetch = window.fetch.bind(window)
    window.fetch = (...args) => {
      const [resource, options] = args
      const path = typeof resource === 'string' ? resource : resource instanceof Request ? resource.url : String(resource)
      const search = new URL(path, window.location.href).searchParams.get('search')
      if (path.includes('/reports/rankings') && search && options?.signal) {
        options.signal.addEventListener('abort', () => {
          const state = window as Window & { rankingSearchAborts?: string[] }
          state.rankingSearchAborts ??= []
          state.rankingSearchAborts.push(search)
        }, { once: true })
      }
      return originalFetch(...args)
    }
  })

  const requests: string[] = []
  let releaseFirstSearch: (() => void) | undefined
  await page.route('**/api/reports/rankings**', async (route) => {
    const search = new URL(route.request().url()).searchParams.get('search') ?? ''
    requests.push(search)
    if (search === 'Ali') await new Promise<void>(resolve => { releaseFirstSearch = resolve })
    await route.fulfill({ json: createRankingsContractFixture() }).catch(() => undefined)
  })

  await page.goto('/store/rankings?period=2026-07-01')
  await expect(page.getByRole('heading', { name: 'Türkiye mağaza sıralaması' })).toBeVisible()
  requests.length = 0
  await page.clock.install()
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000))

  const search = page.getByRole('searchbox', { name: 'Mağaza Ara' })
  await search.pressSequentially('Ali')
  await page.clock.runFor(299)
  expect(requests).toHaveLength(0)
  await page.clock.runFor(1)
  await expect.poll(() => requests).toEqual(['Ali'])

  await search.fill('Fatih')
  await page.clock.runFor(300)
  await expect.poll(() => requests).toEqual(['Ali', 'Fatih'])
  await expect.poll(() => page.evaluate(() => (window as Window & { rankingSearchAborts?: string[] }).rankingSearchAborts ?? []))
    .toContain('Ali')
  releaseFirstSearch?.()
  await expect(page.getByText('Liste güncellenemedi.')).toHaveCount(0)
  await expect(page.getByText('Sıralama verisi alınamadı.')).toHaveCount(0)
  expect(await page.evaluate(() => (window as Window & { __STORE_OPS_API_FAILURES__?: { path: string }[] })
    .__STORE_OPS_API_FAILURES__?.filter(event => event.path === '/reports/rankings').length ?? 0)).toBe(0)
})

async function routeRankingsContractApi(page: Page) {
  await page.route('**/api/reports/rankings**', async (route) => {
    await route.fulfill({ json: createRankingsContractFixture() })
  })
}

function createRankingsContractFixture() {
  const personnelRow = {
    canOpenProfile: true,
    displayName: 'Satış Danışmanı Ayşe',
    employeeId: employeeIds[0],
    metrics: [
      metric('UPT', 'UPT', 3.4),
      metric('ATV', 'ATV', 5400),
      metric('TARGET_ACHIEVEMENT', 'Hedef Gerçekleştirme', 1.18),
    ],
    population: 84,
    rank: 6,
    regionId,
    regionManagerName: 'Onur Kaytan',
    regionManagerUserId: 'region-manager-contract',
    regionName: 'Onur Kaytan Bölgesi',
    scoreValue: 88,
    storeId: storeIds[0],
    storeName: 'İstanbul MOI AVM',
    storePopulation: 5,
    storeRank: 1,
    subject: 'personnel',
    visibility: 'detail',
  }
  const storeRow = {
    metrics: [
      metric('UPT', 'UPT', 3.1),
      metric('ATV', 'ATV', 3600),
      metric('CR', 'CR', 0.18),
      metric('TARGET_ACHIEVEMENT', 'Hedef Gerçekleştirme', 1.05),
      metric('gsm_approval', 'GSM Onayı', 42),
      metric('BM_CHECKLIST', 'BM Checklist', 80),
      metric('VM_CHECKLIST', 'VM Checklist', 91),
    ],
    population: 30,
    rank: 3,
    regionId,
    regionManagerName: 'Onur Kaytan',
    regionManagerUserId: 'region-manager-contract',
    regionName: 'Onur Kaytan Bölgesi',
    scoreValue: 82,
    storeId: storeIds[0],
    storeName: 'İstanbul MOI AVM',
    subject: 'store',
    visibility: 'detail',
  }

  return {
    access: {
      canSeeGlobalDetails: true,
      canSeeManagedStorePersonnelDetails: true,
      globalMode: 'full',
    },
    availablePeriods: [
      { periodEnd: '2026-07-31', periodStart: '2026-07-01', periodType: 'monthly' },
    ],
    filters: {
      regionManagers: [{ id: 'region-manager-contract', label: 'Onur Kaytan' }],
      regions: [{ id: regionId, label: 'Onur Kaytan Bölgesi' }],
      stores: [{ id: storeIds[0], label: 'İstanbul MOI AVM' }],
    },
    personnelLeaderboard: {
      currentEmployee: personnelRow,
      items: [personnelRow],
      managedStorePersonnel: [personnelRow],
      meta: { limit: 100, offset: 0, total: 1 },
    },
    reference: {
      personnel: { averageScore: 72, metrics: [metric('UPT', 'UPT', 2.8)] },
      store: { averageScore: 80, metrics: [metric('gsm_approval', 'GSM Onayı', 38)] },
    },
    scopeSummary: {
      activePersonnelCount: 84,
      storeCount: 30,
    },
    source: {
      mode: 'live',
      periodEnd: '2026-07-31',
      periodStart: '2026-07-01',
      periodType: 'monthly',
    },
    storeLeaderboard: {
      currentStore: storeRow,
      items: [storeRow],
      meta: { limit: 100, offset: 0, total: 1 },
    },
  }
}

function metric(code: string, label: string, actualValue: number) {
  return {
    actualValue,
    benchmarkValue: null,
    code,
    contributionValue: actualValue,
    label,
    targetValue: null,
  }
}
