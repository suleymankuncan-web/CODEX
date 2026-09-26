import { expect, test, type Page } from './test-fixtures'
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

  await expect(page.getByText('Gönderi oluşturuldu.')).toBeVisible()
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

test('region manager feed composer targets assigned stores without a region selector', async ({ page }) => {
  let createdPayload: Record<string, unknown> | null = null
  await seedMockSession(page, 'REGION_MANAGER', 'region-feed-smoke-user')
  await routeFeedApi(page, regionManagerSessionFixture, {
    onCreateFeedPost: (payload) => { createdPayload = payload as Record<string, unknown> },
  })

  await page.goto('/admin/feed')

  await expect(page.getByRole('heading', { name: 'Feed postu oluştur' })).toBeVisible()
  const composer = page.locator('.admin-feed-composer').filter({
    has: page.getByRole('heading', { name: 'Feed postu oluştur' }),
  })
  const scopeSelect = composer.locator('label').filter({ hasText: 'Kapsam' }).locator('select').first()
  const storeSelect = composer.getByRole('combobox', { name: 'Mağaza', exact: true })
  await expect(scopeSelect).toHaveValue('store')
  await expect(scopeSelect).not.toContainText('Şirket')
  await expect(storeSelect).toHaveValue('')
  await expect(storeSelect).toContainText('Atanan 1 mağazanın tamamı')
  await page.getByLabel('Başlık').fill('Atanan mağaza duyurusu')
  await page.getByLabel('Gövde').fill('Günlük operasyon notu')
  await page.getByRole('button', { name: 'Postu yayınla' }).click()
  expect(createdPayload).toMatchObject({ visibilityScopeType: 'store', visibilityScopeIds: [storeId] })
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

test('store feed renders prototype-parity read-only surface for store personnel', async ({ page }) => {
  await seedMockSession(page, 'STORE_PERSONNEL', 'store-feed-smoke-user')
  await routeFeedApi(page, storeSessionFixture)

  await page.goto('/store/feed')

  await expect(page.getByRole('heading', { name: 'Duyurular' })).toBeVisible()
  await expect(page.getByText('Personel', { exact: true })).toBeVisible()
  await expect(page.getByText('Görünür duyuru')).toBeVisible()
  await expect(page.getByText('Sabitlenen')).toBeVisible()
  await expect(page.getByText('Bugün paylaşılan')).toBeVisible()
  await expect(page.getByText('Yetkili mağaza', { exact: true })).toBeVisible()
  await expect(page.getByPlaceholder('Ne paylaşmak istersin?')).toHaveCount(0)
  await expect(page.getByLabel('Gönderi seçenekleri')).toHaveCount(0)

  const postRow = page.getByTestId('store-feed-post-row').filter({ hasText: 'UPT focus window for the current month.' })
  await expect(postRow).toBeVisible()
  await expect(postRow.getByText('Sabit', { exact: true })).toBeVisible()
  await expect(postRow.getByText('UPT', { exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Open rankings' })).toHaveAttribute('href', '/store/rankings')
})

test('store feed keeps pinned posts first and source copy stable across locale changes', async ({ page }) => {
  await seedMockSession(page, 'STORE_PERSONNEL', 'store-feed-english-user')
  await routeFeedApi(page, storeSessionFixture)

  await page.goto('/store/feed')

  await setStoredLocale(page, 'en')

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('heading', { name: 'Announcements' })).toBeVisible()
  await expect(page.getByText('Announcements and updates shared with your stores.')).toBeVisible()
  await expect(page.getByText('Visible announcements', { exact: true })).toBeVisible()

  const rows = page.getByTestId('store-feed-post-row')
  await expect(rows.first()).toContainText('UPT focus window for the current month.')
  await expect(rows.first().getByText('Pinned', { exact: true })).toBeVisible()
  await expect(page.locator('body')).not.toContainText('Ãƒ')
  await expect(page.locator('body')).not.toContainText('Ã„')
  await expect(page.locator('body')).not.toContainText('Ã…')

  await page.reload()

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('heading', { name: 'Announcements' })).toBeVisible()

  await setStoredLocale(page, 'tr')

  await expect(page.getByRole('heading', { name: 'Duyurular' })).toBeVisible()
  await expect(rows.first()).toContainText('UPT focus window for the current month.')
})

test('region manager store feed supports composer, edit, pin menu, archive undo, and unclipped last menu', async ({ page }) => {
  let createdPayload: Record<string, unknown> | null = null
  let updatedPayload: Record<string, unknown> | null = null
  let archivedPostId: string | null = null

  await seedMockSession(page, 'REGION_MANAGER', 'region-store-feed-user')
  await routeFeedApi(page, regionManagerSessionFixture, {
    feedPosts: [
      { ...secondaryFeedPostFixture, visibilityScopeType: 'store', visibilityScopeIds: [storeId] },
      { ...feedPostFixture, visibilityScopeType: 'store', visibilityScopeIds: [storeId] },
    ],
    onArchiveFeedPost: (feedPostId) => {
      archivedPostId = feedPostId
    },
    onCreateFeedPost: (payload) => {
      createdPayload = payload as Record<string, unknown>
    },
    onUpdateFeedPost: (_feedPostId, payload) => {
      updatedPayload = payload as Record<string, unknown>
    },
  })

  await page.goto('/store/feed')

  await expect(page.getByPlaceholder('Ne paylaşmak istersin?')).toBeVisible()
  await expect(page.getByLabel('Gönderi seçenekleri').first()).toBeVisible()

  await page.getByPlaceholder('Ne paylaşmak istersin?').fill('Bölge toplantısı bugün 15:00')
  await page.getByRole('button', { name: 'Sabitle' }).click()
  await page.getByRole('button', { name: 'Paylaş' }).click()

  await expect(page.getByText('Müdür duyurusu sabitlenerek paylaşıldı.')).toBeVisible()
  expect(createdPayload).toMatchObject({
    postType: 'announcement',
    title: 'Bölge toplantısı bugün 15:00',
    body: 'Bölge toplantısı bugün 15:00',
    visibilityScopeType: 'store',
    visibilityScopeIds: [storeId],
    isPinned: true,
    publishStatus: 'published',
  })

  const firstMenuButton = page.getByLabel('Gönderi seçenekleri').first()
  await firstMenuButton.click()
  await page.getByRole('menuitem', { name: 'Düzenle' }).click()
  await page.getByLabel('Gönderi metnini düzenle').fill('Güncellenen bölge duyurusu')
  await page.getByRole('button', { name: 'Kaydet' }).click()

  await expect(page.getByText('Gönderi güncellendi.')).toBeVisible()
  expect(updatedPayload).toMatchObject({
    title: 'Güncellenen bölge duyurusu',
    body: 'Güncellenen bölge duyurusu',
  })

  await firstMenuButton.click()
  await expect(page.getByRole('menuitem', { name: 'Sabitlemeden kaldır' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('menu')).toHaveCount(0)

  const lastMenuButton = page.getByLabel('Gönderi seçenekleri').last()
  await lastMenuButton.click()
  const menuBox = await page.getByRole('menu').boundingBox()
  const viewport = page.viewportSize()
  expect(menuBox).not.toBeNull()
  expect(viewport).not.toBeNull()
  expect(menuBox!.y + menuBox!.height).toBeLessThanOrEqual(viewport!.height)

  await page.getByRole('menuitem', { name: 'Yayından kaldır' }).click()
  await expect(page.getByText('Gönderi yayından kaldırıldı.')).toBeVisible()
  await page.getByRole('button', { name: 'Geri al' }).click()
  await expect(page.getByText('Gönderi geri alındı.')).toBeVisible()
  await page.waitForTimeout(4800)
  expect(archivedPostId).toBeNull()
})

test('store home links to announcements without rendering pinned feed preview', async ({ page }) => {
  await seedMockSession(page, 'STORE_PERSONNEL', 'store-home-feed-smoke-user')
  await routeFeedApi(page, storeSessionFixture)

  await page.goto('/store/home')

  await expect(page.locator('.store-command-home')).toBeVisible()
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
    feedPosts?: Array<typeof feedPostFixture>
    onArchiveFeedPost?: (feedPostId: string) => void
    onCreateFeedPost?: (payload: unknown) => void
    onUpdateFeedPost?: (feedPostId: string, payload: unknown) => void
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
          items: options?.feedPosts ?? [secondaryFeedPostFixture, feedPostFixture],
          meta: { count: 2, total: 2, limit: 50, offset: 0 },
        },
      })
      return
    }

    if (request.method() === 'GET' && pathname.endsWith('/api/feed')) {
      await route.fulfill({
        json: {
          items: options?.feedPosts ?? [secondaryFeedPostFixture, feedPostFixture],
          meta: { count: 2, total: 2, limit: 50, offset: 0 },
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

    if (request.method() === 'PUT' && pathname.includes('/api/admin/feed/')) {
      const feedPostId = pathname.split('/').at(-1) ?? ''
      const payload = request.postDataJSON()
      options?.onUpdateFeedPost?.(feedPostId, payload)
      await route.fulfill({
        json: {
          command: { status: 'updated', message: 'Feed post updated' },
          data: {
            feedPost: {
              ...(options?.feedPosts?.find(post => post.feedPostId === feedPostId) ?? feedPostFixture),
              ...(payload as Record<string, unknown>),
              updatedAt: '2026-04-26T11:00:00.000Z',
            },
          },
        },
      })
      return
    }

    if (request.method() === 'POST' && pathname.includes('/api/admin/feed/')) {
      const parts = pathname.split('/')
      const action = parts.at(-1)
      const feedPostId = parts.at(-2) ?? ''
      if (action === 'archive') {
        options?.onArchiveFeedPost?.(feedPostId)
      }
      await route.fulfill({
        json: {
          command: { status: 'ok', message: 'Feed post updated' },
          data: { feedPost: options?.feedPosts?.find(post => post.feedPostId === feedPostId) ?? feedPostFixture },
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

const secondaryFeedPostFixture = {
  ...feedPostFixture,
  feedPostId: '33333333-3333-4333-8333-333333333333',
  postType: 'announcement',
  title: 'Visual checklist reminder',
  body: 'Vitrin kontrol listesi cuma kapanışına kadar tamamlanacak.',
  linkLabel: null,
  linkUrl: null,
  isPinned: false,
  publishedAt: '2026-04-25T17:45:00.000Z',
  metricCode: null,
  metricLabel: null,
  challengeStartsOn: null,
  challengeEndsOn: null,
  targetRoute: null,
  createdAt: '2026-04-25T17:45:00.000Z',
  updatedAt: '2026-04-25T17:45:00.000Z',
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
    actionScope: { assignedStoreIds: [storeId] },
    assignedStoreIds: [storeId],
  },
  scopeSummary: {
    companyCount: 0,
    regionCount: 1,
    storeCount: 0,
    assignedStoreCount: 1,
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
