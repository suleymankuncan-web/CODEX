import { expect, test, type Page } from './test-fixtures'

const companyId = '00000000-0000-0000-0000-000000000001'
const regionId = '00000000-0000-0000-0000-000000000010'
const storeId = '00000000-0000-0000-0000-000000000100'

type RoleCode = 'REGION_MANAGER' | 'STORE_MANAGER' | 'STORE_PERSONNEL' | 'VISUAL_MERCHANDISER'

function authSession(roleCode: RoleCode) {
  const isRegion = roleCode === 'REGION_MANAGER'
  const isStore = roleCode === 'STORE_MANAGER' || roleCode === 'STORE_PERSONNEL' || roleCode === 'VISUAL_MERCHANDISER'

  return {
    authMode: 'mock',
    authenticated: true,
    user: {
      userId: `${roleCode.toLowerCase()}-home-user`,
      employeeId: roleCode === 'STORE_PERSONNEL' ? 'employee-home-1' : null,
      email: `${roleCode.toLowerCase()}@example.test`,
      username: `${roleCode.toLowerCase()}-home-user`,
      displayName:
        roleCode === 'REGION_MANAGER'
          ? 'Onur Kaytan'
          : roleCode === 'STORE_MANAGER'
            ? 'Mert Alcan'
            : 'Store Kullanıcısı',
      roleCodes: [roleCode],
      scope: {
        companyIds: [companyId],
        regionIds: isRegion ? [regionId] : [],
        storeIds: isStore ? [storeId] : [],
      },
      readScope: {
        companyIds: [companyId],
        regionIds: isRegion ? [regionId] : [],
        storeIds: isStore ? [storeId] : [],
      },
      actionScope: {
        assignedStoreIds: roleCode === 'STORE_MANAGER' ? [storeId] : [],
      },
      assignedStoreIds: roleCode === 'STORE_MANAGER' ? [storeId] : [],
    },
    scopeSummary: {
      companyCount: 1,
      regionCount: isRegion ? 1 : 0,
      storeCount: isRegion ? 30 : 1,
      assignedStoreCount: roleCode === 'STORE_MANAGER' ? 1 : 0,
    },
  }
}

async function routeAuth(page: Page, roleCode: RoleCode) {
  const session = authSession(roleCode)
  const user = session.user

  await page.addInitScript(
    (input) => {
      window.localStorage.setItem(
        'store-ops-admin-session',
        JSON.stringify({
          mode: 'mock',
          mockUserId: input.userId,
          mockRoleCodes: input.roleCodes.join(','),
          mockCompanyIds: input.companyIds.join(','),
          mockStoreIds: input.storeIds.join(','),
          mockReadStoreIds: input.readStoreIds.join(','),
          mockAssignedStoreIds: input.assignedStoreIds.join(','),
          mockRegionIds: input.regionIds.join(','),
          mockReadRegionIds: input.readRegionIds.join(','),
          bearerToken: '',
        }),
      )
    },
    {
      userId: user.userId,
      roleCodes: user.roleCodes,
      companyIds: user.scope.companyIds,
      storeIds: user.scope.storeIds,
      readStoreIds: user.readScope.storeIds,
      assignedStoreIds: user.assignedStoreIds,
      regionIds: user.scope.regionIds,
      readRegionIds: user.readScope.regionIds,
    },
  )

  await page.route('**/api/auth/bootstrap', async (route) => {
    await route.fulfill({
      json: {
        authMode: 'mock',
        provider: {
          configured: false,
          authorizationUrl: null,
          clientId: null,
          scope: null,
          responseType: null,
          audience: null,
          callbackPath: '/auth/callback',
          tokenUrl: null,
          logoutUrl: null,
          postLogoutRedirectPath: '/auth/login',
        },
      },
    })
  })

  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({ json: session })
  })
}

test('store home production route renders the approved command surface for region manager', async ({ page }) => {
  await routeAuth(page, 'REGION_MANAGER')

  await page.goto('/store/home')

  await expect(page.getByTestId('store-home-command')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Günlük Operasyon', exact: true })).toBeVisible()
  await expect(page.locator('.store-home-ops .sh-command-bar')).toBeVisible()
  await expect(page.locator('.store-home-ops .sh-metric')).toHaveCount(4)
  await expect(page.getByRole('heading', { name: 'Öncelik akışı', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Duyurular', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Hızlı geçiş', exact: true })).toBeVisible()
  await expect(page.getByTestId('store-home-dashboard').getByText('Bölge müdürü', { exact: true })).toBeVisible()
})

test('store home keeps manager actions role-aware inside the command surface', async ({ page }) => {
  await routeAuth(page, 'STORE_MANAGER')

  await page.goto('/store/home')

  await expect(page.getByTestId('store-home-command')).toBeVisible()
  await expect(page.getByTestId('store-home-dashboard').getByText('Mağaza müdürü', { exact: true })).toBeVisible()
  await expect(page.getByText('Görevler').first()).toBeVisible()
  await expect(page.getByText('Bölge portföyü')).toHaveCount(0)
})

test('store home keeps personnel away from manager-only command items', async ({ page }) => {
  await routeAuth(page, 'STORE_PERSONNEL')

  await page.goto('/store/home')

  await expect(page.getByTestId('store-home-command')).toBeVisible()
  await expect(page.getByTestId('store-home-dashboard').getByText('Mağaza personeli', { exact: true })).toBeVisible()
  await expect(page.getByText('Hedef kararı')).toHaveCount(0)
  await expect(page.getByText('Prim paketi')).toHaveCount(0)
})
