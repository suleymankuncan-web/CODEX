import { expect, test, type Page } from '@playwright/test'

test('keeps language control on store home and out of work surfaces', async ({ page }) => {
  await seedMockSession(page)
  await routeEntryApi(page)

  await page.goto('/store')

  await expect(page.locator('.language-toggle-button')).toHaveCount(2)

  await page.goto('/admin/integrations')

  await expect(page.locator('.language-toggle-button')).toHaveCount(0)
})

test('keeps auth entry free of the language control', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'store-ops-admin-session',
      JSON.stringify({
        mode: 'bearer',
        mockUserId: 'entry-user',
        mockRoleCodes: 'SUPER_ADMIN',
        mockCompanyIds: '00000000-0000-0000-0000-000000000001',
        bearerToken: '',
      }),
    )
  })
  await page.route('**/api/auth/bootstrap', async (route) => {
    await route.fulfill({
      json: {
        authMode: 'bearer',
        providerConfigured: false,
        clerkConfigured: false,
        loginUrl: null,
      },
    })
  })

  await page.goto('/auth/login')

  await expect(page.locator('.language-toggle-button')).toHaveCount(0)
})

async function seedMockSession(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'store-ops-admin-session',
      JSON.stringify({
        mode: 'mock',
        mockUserId: 'entry-user',
        mockRoleCodes: 'SUPER_ADMIN,INTEGRATION_ADMIN,STORE_MANAGER,STORE_PERSONNEL',
        mockCompanyIds: '00000000-0000-0000-0000-000000000001',
        bearerToken: '',
      }),
    )
  })
}

async function routeEntryApi(page: Page) {
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({ json: authSessionFixture })
  })

  await page.route('**/api/feed?**', async (route) => {
    await route.fulfill({
      json: {
        items: [],
        meta: { count: 0, total: 0, limit: 50, offset: 0 },
      },
    })
  })

  await page.route('**/api/integrations/import-batches**', async (route) => {
    await route.fulfill({
      json: {
        items: [],
        meta: { count: 0, total: 0, limit: 50, offset: 0 },
      },
    })
  })

  await page.route('**/api/integrations/import-payload-templates**', async (route) => {
    await route.fulfill({ json: { items: [] } })
  })

  await page.route('**/api/integrations/lookups', async (route) => {
    await route.fulfill({
      json: {
        sourceSystems: [],
        entityTypes: [],
      },
    })
  })

  await page.route('**/api/integrations/store-master**', async (route) => {
    await route.fulfill({
      json: {
        items: [],
        meta: { count: 0, total: 0, limit: 200, offset: 0 },
      },
    })
  })

  await page.route('**/api/integrations/store-master-lookups', async (route) => {
    await route.fulfill({
      json: {
        regions: [],
        channels: [],
        concepts: [],
      },
    })
  })
}

const authSessionFixture = {
  authMode: 'mock',
  authenticated: true,
  user: {
    userId: 'entry-user',
    employeeId: null,
    roleCodes: ['SUPER_ADMIN', 'INTEGRATION_ADMIN', 'STORE_MANAGER', 'STORE_PERSONNEL'],
    scope: {
      companyIds: ['00000000-0000-0000-0000-000000000001'],
      regionIds: [],
      storeIds: [],
    },
    readScope: {
      companyIds: ['00000000-0000-0000-0000-000000000001'],
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
