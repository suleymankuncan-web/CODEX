import { expect, test, type Page } from '@playwright/test'
import { setStoredLocale } from './locale-test-utils'

const companyId = '00000000-0000-0000-0000-000000000001'
const regionId = '00000000-0000-0000-0000-000000000010'
const storeId = '00000000-0000-0000-0000-000000000100'

test('admin feed allows HR admin to publish a challenge post', async ({ page }) => {
  let createdPayload: unknown = null
  await seedMockSession(page, 'HR_ADMIN', 'hr-feed-smoke-user')
  await routeFeedApi(page, hrSessionFixture, {
    onCreateFeedPost: (payload) => {
      createdPayload = payload
    },
  })

  await page.goto('/admin/feed')

  await expect(page.getByRole('heading', { name: 'Feed postu oluştur' })).toBeVisible()
  await page.getByLabel('Tip').selectOption('challenge')
  await page.getByLabel('Başlık').fill('May UPT Challenge')
  await page.getByLabel('Gövde').fill('UPT focus window for the current month.')
  await page.getByLabel('Yarışma başlangıcı').fill('2026-05-01')
  await page.getByLabel('Yarışma bitişi').fill('2026-05-31')
  await page.getByRole('button', { name: 'Postu yayınla' }).click()

  await expect(page.getByText('Feed post created')).toBeVisible()
  expect(createdPayload).toMatchObject({
    postType: 'challenge',
    title: 'May UPT Challenge',
    body: 'UPT focus window for the current month.',
    visibilityScopeType: 'company',
    visibilityScopeIds: [],
    publishStatus: 'published',
    metricCode: 'upt',
    metricLabel: 'UPT',
    challengeStartsOn: '2026-05-01',
    challengeEndsOn: '2026-05-31',
    targetRoute: '/store/rankings',
  })
})

test('admin feed retries transient feed and lookup failures without leaving the user stuck', async ({ page }) => {
  let feedAttempts = 0
  let lookupAttempts = 0
  await seedMockSession(page, 'HR_ADMIN', 'hr-feed-transient-user')

  await page.route('**/api/**', async (route) => {
    const request = route.request()
    const pathname = new URL(request.url()).pathname

    if (pathname.endsWith('/api/auth/session')) {
      await route.fulfill({ json: hrSessionFixture })
      return
    }

    if (pathname.endsWith('/api/auth/lookups')) {
      lookupAttempts += 1
      if (lookupAttempts === 1) {
        await route.fulfill({ status: 503, json: { message: 'Temporary lookup outage' } })
        return
      }

      await route.fulfill({ json: authLookupsFixture })
      return
    }

    if (request.method() === 'GET' && pathname.endsWith('/api/admin/feed')) {
      feedAttempts += 1
      if (feedAttempts === 1) {
        await route.fulfill({ status: 503, json: { message: 'Temporary feed outage' } })
        return
      }

      await route.fulfill({
        json: {
          items: [feedPostFixture],
          meta: { count: 1, total: 1, limit: 50, offset: 0 },
        },
      })
      return
    }

    await route.fulfill({ json: {} })
  })

  await page.goto('/admin/feed')

  await expect.poll(() => feedAttempts).toBeGreaterThanOrEqual(2)
  await expect.poll(() => lookupAttempts).toBeGreaterThanOrEqual(2)
  await expect(page.getByText('May UPT Challenge')).toBeVisible()
  await expect(page.getByText(/Duyurular a..lamad./i)).toHaveCount(0)
})

test('region manager feed composer defaults to own region and hides company scope', async ({ page }) => {
  await seedMockSession(page, 'REGION_MANAGER', 'region-feed-smoke-user')
  await routeFeedApi(page, regionManagerSessionFixture)

  await page.goto('/admin/feed')

  await expect(page.getByRole('heading', { name: 'Feed postu oluştur' })).toBeVisible()
  const composer = page.locator('article.panel').filter({
    has: page.getByRole('heading', { name: 'Feed postu oluştur' }),
  })
  const scopeSelect = composer.locator('label').filter({ hasText: 'Kapsam' }).locator('select').first()
  const regionSelect = composer.locator('label').filter({ hasText: 'Bölge id' }).locator('select').first()
  await expect(scopeSelect).toHaveValue('region')
  await expect(scopeSelect).not.toContainText('Şirket')
  await expect(regionSelect).toHaveValue(regionId)
})

test('admin feed switches chrome to English copy and persists locale', async ({ page }) => {
  await seedMockSession(page, 'HR_ADMIN', 'hr-feed-english-user')
  await routeFeedApi(page, hrSessionFixture)

  await page.goto('/admin/feed')

  await expect(page.getByRole('heading', { name: 'Kontrollü şirket ve bölge duyuruları' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Feed postu oluştur' })).toBeVisible()
  await expect(page.getByText('Toplam post')).toBeVisible()
  await expect(page.getByText('Post kütüphanesi')).toBeVisible()
  await expect(page.getByText('Company and region announcements in one controlled feed.')).toHaveCount(0)
  await expect(page.locator('body')).not.toContainText('Ã')
  await expect(page.locator('body')).not.toContainText('Ä')
  await expect(page.locator('body')).not.toContainText('Å')

  await setStoredLocale(page, 'en')

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('heading', { name: 'Company and region announcements in one controlled feed.' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Create feed post' })).toBeVisible()
  await expect(page.getByText('Total posts')).toBeVisible()
  await expect(page.getByText('Post library')).toBeVisible()
  await expect(page.getByText('Kontrollü şirket ve bölge duyuruları')).toHaveCount(0)

  await page.reload()

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('heading', { name: 'Company and region announcements in one controlled feed.' })).toBeVisible()
})

test('store feed renders pinned challenge posts with ranking link', async ({ page }) => {
  await seedMockSession(page, 'STORE_PERSONNEL', 'store-feed-smoke-user')
  await routeFeedApi(page, storeSessionFixture)

  await page.goto('/store/feed')

  await expect(page.getByRole('heading', { name: 'Görünen duyurular' })).toBeVisible()
  const postRow = page.locator('.stacked-row').filter({ hasText: 'May UPT Challenge' })
  await expect(postRow).toBeVisible()
  await expect(postRow.getByText('Sabit', { exact: true })).toBeVisible()
  await expect(postRow.getByText('UPT', { exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Open rankings' })).toHaveAttribute('href', '/store/rankings')
})

test('store feed switches to English copy and persists locale', async ({ page }) => {
  await seedMockSession(page, 'STORE_PERSONNEL', 'store-feed-english-user')
  await routeFeedApi(page, storeSessionFixture)

  await page.goto('/store/feed')

  await setStoredLocale(page, 'en')

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('heading', { name: 'Visible announcements' })).toBeVisible()
  await expect(page.getByText('Company, region, and store announcements in one feed.')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Visible posts' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Pinned posts' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Challenge announcements' })).toBeVisible()

  const postRow = page.locator('.stacked-row').filter({ hasText: 'May UPT Challenge' })
  await expect(postRow.getByText('Pinned', { exact: true })).toBeVisible()
  await expect(postRow.getByText('Challenge', { exact: true })).toBeVisible()
  await expect(postRow.getByText('Company', { exact: true })).toBeVisible()
  await expect(page.locator('body')).not.toContainText('Ãƒ')
  await expect(page.locator('body')).not.toContainText('Ã„')
  await expect(page.locator('body')).not.toContainText('Ã…')

  await page.reload()

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('heading', { name: 'Visible announcements' })).toBeVisible()
})

test('store home links to announcements without rendering pinned feed preview', async ({ page }) => {
  await seedMockSession(page, 'STORE_PERSONNEL', 'store-home-feed-smoke-user')
  await routeFeedApi(page, storeSessionFixture)

  await page.goto('/store')

  await expect(page.getByRole('heading', { name: /ana ekranı hazır/i })).toBeVisible()
  await expect(
    page.locator('.store-command-nav').getByRole('link', { name: 'Duyurular', exact: true }),
  ).toHaveAttribute('href', '/store/feed')
  await expect(page.getByText('Sabit duyurular')).toHaveCount(0)
  await expect(page.getByText('May UPT Challenge')).toHaveCount(0)
})

async function seedMockSession(page: Page, roleCodes: string, userId: string) {
  await page.addInitScript(
    ({ companyId: seededCompanyId, roleCodes: seededRoleCodes, userId: seededUserId }) => {
      window.localStorage.setItem(
        'store-ops-admin-session',
        JSON.stringify({
          mode: 'mock',
          mockUserId: seededUserId,
          mockRoleCodes: seededRoleCodes,
          mockCompanyIds: seededCompanyId,
          bearerToken: '',
        }),
      )
    },
    { companyId, roleCodes, userId },
  )
}

async function routeFeedApi(
  page: Page,
  authSession: unknown,
  options?: {
    onCreateFeedPost?: (payload: unknown) => void
  },
) {
  await page.route('**/api/**', async (route) => {
    const request = route.request()
    const pathname = new URL(request.url()).pathname

    if (pathname.endsWith('/api/auth/session')) {
      await route.fulfill({ json: authSession })
      return
    }

    if (pathname.endsWith('/api/auth/lookups')) {
      await route.fulfill({ json: authLookupsFixture })
      return
    }

    if (request.method() === 'GET' && pathname.endsWith('/api/admin/feed')) {
      await route.fulfill({
        json: {
          items: [feedPostFixture],
          meta: { count: 1, total: 1, limit: 50, offset: 0 },
        },
      })
      return
    }

    if (request.method() === 'GET' && pathname.endsWith('/api/feed')) {
      await route.fulfill({
        json: {
          items: [feedPostFixture],
          meta: { count: 1, total: 1, limit: 50, offset: 0 },
        },
      })
      return
    }

    if (request.method() === 'POST' && pathname.endsWith('/api/admin/feed')) {
      const payload = request.postDataJSON()
      options?.onCreateFeedPost?.(payload)
      await route.fulfill({
        json: {
          command: { status: 'created', message: 'Feed post created' },
          data: {
            feedPost: {
              ...feedPostFixture,
              ...(payload as Record<string, unknown>),
              feedPostId: '22222222-2222-4222-8222-222222222222',
              createdAt: '2026-04-26T10:00:00.000Z',
              updatedAt: '2026-04-26T10:00:00.000Z',
            },
          },
        },
      })
      return
    }

    if (request.method() === 'POST' && pathname.includes('/api/admin/feed/')) {
      await route.fulfill({
        json: {
          command: { status: 'ok', message: 'Feed post updated' },
          data: { feedPost: feedPostFixture },
        },
      })
      return
    }

    await route.fulfill({ json: {} })
  })
}

const feedPostFixture = {
  feedPostId: '11111111-1111-4111-8111-111111111111',
  postType: 'challenge',
  title: 'May UPT Challenge',
  body: 'UPT focus window for the current month.',
  linkLabel: 'Open rankings',
  linkUrl: '/store/rankings',
  visibilityScopeType: 'company',
  visibilityScopeIds: [],
  isPinned: true,
  publishStatus: 'published',
  publishedAt: '2026-04-26T09:00:00.000Z',
  startsAt: null,
  endsAt: null,
  metricCode: 'upt',
  metricLabel: 'UPT',
  challengeStartsOn: '2026-05-01',
  challengeEndsOn: '2026-05-31',
  targetRoute: '/store/rankings',
  createdByUserId: companyId,
  updatedByUserId: companyId,
  createdAt: '2026-04-26T09:00:00.000Z',
  updatedAt: '2026-04-26T09:00:00.000Z',
}

const hrSessionFixture = {
  authMode: 'mock',
  authenticated: true,
  user: {
    userId: 'hr-feed-smoke-user',
    employeeId: null,
    roleCodes: ['HR_ADMIN'],
    scope: {
      companyIds: [companyId],
      regionIds: [],
      storeIds: [],
    },
    readScope: {
      companyIds: [companyId],
      regionIds: [],
      storeIds: [],
    },
    actionScope: {
      assignedStoreIds: [],
    },
    assignedStoreIds: [],
  },
  scopeSummary: {
    companyCount: 1,
    regionCount: 0,
    storeCount: 0,
    assignedStoreCount: 0,
  },
}

const regionManagerSessionFixture = {
  ...hrSessionFixture,
  user: {
    ...hrSessionFixture.user,
    userId: 'region-feed-smoke-user',
    roleCodes: ['REGION_MANAGER'],
    scope: {
      companyIds: [],
      regionIds: [regionId],
      storeIds: [],
    },
    readScope: {
      companyIds: [],
      regionIds: [regionId],
      storeIds: [],
    },
  },
  scopeSummary: {
    companyCount: 0,
    regionCount: 1,
    storeCount: 0,
    assignedStoreCount: 0,
  },
}

const storeSessionFixture = {
  ...hrSessionFixture,
  user: {
    ...hrSessionFixture.user,
    userId: 'store-feed-smoke-user',
    employeeId: '00000000-0000-0000-0000-000000000202',
    roleCodes: ['STORE_PERSONNEL'],
    scope: {
      companyIds: [companyId],
      regionIds: [regionId],
      storeIds: [storeId],
    },
    readScope: {
      companyIds: [companyId],
      regionIds: [regionId],
      storeIds: [storeId],
    },
    actionScope: {
      assignedStoreIds: [storeId],
    },
    assignedStoreIds: [storeId],
  },
  scopeSummary: {
    companyCount: 1,
    regionCount: 1,
    storeCount: 1,
    assignedStoreCount: 1,
  },
}

const authLookupsFixture = {
  scopeTypes: ['company', 'region', 'store'],
  authProviders: ['mock', 'oidc'],
  users: [],
  roles: [],
  permissions: [],
  stores: [
    {
      storeId,
      storeCode: 'DEMO-100',
      storeName: 'IstinyePark Demo Store',
      companyId,
      regionId,
      regionName: 'Marmara',
    },
  ],
  optionGroups: {
    users: [],
    roles: [],
    permissions: [],
    stores: [],
    scopeTypes: [
      { value: 'company', label: 'company' },
      { value: 'region', label: 'region' },
      { value: 'store', label: 'store' },
    ],
    authProviders: [
      { value: 'mock', label: 'mock' },
      { value: 'oidc', label: 'oidc' },
    ],
  },
  meta: {
    totalUsers: 0,
    totalRoles: 0,
    totalPermissions: 0,
    totalStores: 1,
  },
}
