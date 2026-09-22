import { expect, test, type Page } from './test-fixtures'

const companyId = '00000000-0000-0000-0000-000000000001'
const regionId = '00000000-0000-0000-0000-000000000010'
const storeId = '00000000-0000-0000-0000-000000000100'

test('target coverage failure does not present synthetic zero coverage and keeps retry available', async ({ page }) => {
  await seedAdminSession(page, ['SUPER_ADMIN'])
  await routeSession(page, ['SUPER_ADMIN'])
  await page.route('**/api/target-distributions/requests**', async (route) => {
    await route.fulfill({ json: { items: [], meta: { count: 0, total: 0, limit: 50, offset: 0 } } })
  })
  await page.route('**/api/target-distributions/coverage**', async (route) => {
    await route.fulfill({ status: 503, json: { message: 'Coverage temporarily unavailable' } })
  })

  await page.goto('/admin/targets')

  await expect(page.getByTestId('admin-metric-target-coverage-rate')).toContainText('—')
  await expect(page.getByTestId('admin-metric-personnel-in-target-scope')).toContainText('—')
  await expect(page.getByRole('button', { name: 'Tekrar dene' })).toBeVisible()
})

test('incentive package disclosure exposes its expanded relationship', async ({ page }) => {
  await seedAdminSession(page, ['SUPER_ADMIN'])
  await routeSession(page, ['SUPER_ADMIN'])
  await page.route('**/api/admin/incentives**', async (route) => {
    await route.fulfill({
      json: {
        data: {
          period: '2026-09',
          periodStart: '2026-09-01',
          periodEnd: '2026-09-30',
          periodTimezone: 'Europe/Istanbul',
          roleScope: 'admin',
          regionWorkflow: null,
          regionPackages: [{
            regionId,
            regionName: 'Marmara',
            regionManagerUserId: 'manager-1',
            regionManagerName: 'Eda Doğanay',
            submittedByUserId: 'manager-1',
            submittedByName: 'Eda Doğanay',
            submittedAt: '2026-09-20T09:00:00.000Z',
            reviewedByUserId: null,
            reviewedByName: null,
            reviewedAt: null,
            reviewNote: null,
            status: 'submitted',
            storeCount: 1,
            reviewedStoreCount: 1,
            submittedStoreCount: 1,
            draftCorrectionCount: 0,
            submittedCorrectionCount: 0,
          }],
          projections: [],
        },
      },
    })
  })

  await page.goto('/admin/incentives')

  const disclosure = page.getByTestId('admin-incentive-region-package').getByRole('button', { name: /Eda Doğanay/ })
  await expect(disclosure).toHaveAttribute('aria-expanded', 'false')
  const detailId = await disclosure.getAttribute('aria-controls')
  expect(detailId).toBeTruthy()
  await disclosure.click()
  await expect(disclosure).toHaveAttribute('aria-expanded', 'true')
  await expect(page.locator(`#${detailId}`)).toBeVisible()
})

test('feed row commands lock while a command for the same post is pending', async ({ page }) => {
  await seedAdminSession(page, ['HR_ADMIN'])
  await routeSession(page, ['HR_ADMIN'])
  await page.route('**/api/auth/lookups', async (route) => {
    await route.fulfill({ json: createLookups() })
  })
  await page.route('**/api/admin/feed?**', async (route) => {
    await route.fulfill({
      json: {
        items: [createFeedPost()],
        meta: { count: 1, total: 1, limit: 50, offset: 0 },
      },
    })
  })
  let releasePin: (() => void) | undefined
  await page.route('**/api/admin/feed/feed-post-1/pin', async (route) => {
    await new Promise<void>((resolve) => { releasePin = resolve })
    await route.fulfill({
      json: {
        command: { status: 'accepted', message: 'Feed post pinned' },
        data: { feedPost: { ...createFeedPost(), isPinned: true } },
      },
    })
  })

  await page.goto('/admin/feed')
  const post = page.locator('article').filter({ hasText: 'Operational notice' })
  await post.getByRole('button', { name: 'Sabitle' }).click()

  await expect(post).toHaveAttribute('aria-busy', 'true')
  await expect(post.getByRole('button', { name: 'Sabitle' })).toBeDisabled()
  await expect(post.getByRole('button', { name: 'Arşivle' })).toBeDisabled()
  releasePin?.()
})

test('feed commands keep every in-flight post locked when another post starts', async ({ page }) => {
  await seedAdminSession(page, ['HR_ADMIN'])
  await routeSession(page, ['HR_ADMIN'])
  await page.route('**/api/auth/lookups', route => route.fulfill({ json: createLookups() }))
  await page.route('**/api/admin/feed?**', route => route.fulfill({ json: {
    items: [createFeedPost(), { ...createFeedPost(), feedPostId: 'feed-post-2', title: 'Second notice' }],
    meta: { count: 2, total: 2, limit: 50, offset: 0 },
  } }))
  let release = () => {}
  const gate = new Promise<void>(resolve => { release = resolve })
  const requests: string[] = []
  await page.route('**/api/admin/feed/*/pin', async route => {
    requests.push(route.request().url())
    await gate
    await route.fulfill({ status: 503, json: { message: 'Temporary failure' } })
  })
  await page.goto('/admin/feed')
  const first = page.locator('article').filter({ hasText: 'Operational notice' })
  const second = page.locator('article').filter({ hasText: 'Second notice' })
  try {
    await first.getByRole('button', { name: 'Sabitle', exact: true }).click()
    await second.getByRole('button', { name: 'Sabitle', exact: true }).click()
    await expect.poll(() => requests.length).toBe(2)
    await expect(first.getByRole('button', { name: 'Sabitle', exact: true })).toBeDisabled()
    await expect(first.getByRole('button', { name: 'Arşivle', exact: true })).toBeDisabled()
    await expect(second.getByRole('button', { name: 'Sabitle', exact: true })).toBeDisabled()
  } finally { release() }
})

async function seedAdminSession(page: Page, roles: string[]) {
  await page.addInitScript(({ seededCompanyId, seededRoles }) => {
    window.localStorage.setItem('store-ops-admin-session', JSON.stringify({
      mode: 'mock',
      mockUserId: 'ui-admin-workflows-user',
      mockRoleCodes: seededRoles.join(','),
      mockCompanyIds: seededCompanyId,
      bearerToken: '',
    }))
  }, { seededCompanyId: companyId, seededRoles: roles })
}

async function routeSession(page: Page, roles: string[]) {
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({ json: createSession(roles) })
  })
}

function createSession(roles: string[]) {
  return {
    authMode: 'mock',
    authenticated: true,
    user: {
      userId: 'ui-admin-workflows-user',
      employeeId: null,
      roleCodes: roles,
      scope: { companyIds: [companyId], regionIds: [regionId], storeIds: [storeId] },
      readScope: { companyIds: [companyId], regionIds: [regionId], storeIds: [storeId] },
      actionScope: { assignedStoreIds: [storeId] },
      assignedStoreIds: [storeId],
    },
    scopeSummary: { companyCount: 1, regionCount: 1, storeCount: 1, assignedStoreCount: 1 },
  }
}

function createLookups() {
  return {
    scopeTypes: ['company', 'region', 'store'],
    authProviders: ['mock'],
    users: [], roles: [], permissions: [],
    stores: [{ storeId, storeCode: 'DEMO-100', storeName: 'Marmara Park', companyId, regionId, regionName: 'Marmara' }],
    optionGroups: { users: [], roles: [], permissions: [], stores: [], scopeTypes: [], authProviders: [] },
    meta: { totalUsers: 0, totalRoles: 0, totalPermissions: 0, totalStores: 1 },
  }
}

function createFeedPost() {
  return {
    feedPostId: 'feed-post-1',
    postType: 'announcement',
    title: 'Operational notice',
    body: 'Store operations update.',
    linkLabel: null,
    linkUrl: null,
    visibilityScopeType: 'company',
    visibilityScopeIds: [],
    isPinned: false,
    publishStatus: 'published',
    publishedAt: '2026-09-20T09:00:00.000Z',
    startsAt: null,
    endsAt: null,
    metricCode: null,
    metricLabel: null,
    challengeStartsOn: null,
    challengeEndsOn: null,
    targetRoute: null,
    createdByUserId: 'ui-admin-workflows-user',
    updatedByUserId: 'ui-admin-workflows-user',
    createdAt: '2026-09-20T09:00:00.000Z',
    updatedAt: '2026-09-20T09:00:00.000Z',
  }
}
