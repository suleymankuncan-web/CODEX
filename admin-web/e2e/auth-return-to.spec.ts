import { expect, test } from '@playwright/test'

const demoStoreId = '00000000-0000-0000-0000-000000000100'
const demoEmployeeId = '00000000-0000-0000-0000-000000000202'

test('ready auth login preserves store returnTo instead of falling back to admin landing', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'store-ops-admin-session',
      JSON.stringify({
        mode: 'mock',
        mockUserId: 'store-manager-admin',
        mockRoleCodes: 'SUPER_ADMIN,STORE_MANAGER',
        mockCompanyIds: '00000000-0000-0000-0000-000000000001',
        bearerToken: '',
      }),
    )
  })

  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({
      json: {
        authMode: 'mock',
        authenticated: true,
        user: {
          userId: 'store-manager-admin',
          employeeId: demoEmployeeId,
          roleCodes: ['SUPER_ADMIN', 'STORE_MANAGER'],
          scope: {
            companyIds: ['00000000-0000-0000-0000-000000000001'],
            regionIds: ['00000000-0000-0000-0000-000000000010'],
            storeIds: [demoStoreId],
          },
          readScope: {
            companyIds: ['00000000-0000-0000-0000-000000000001'],
            regionIds: ['00000000-0000-0000-0000-000000000010'],
            storeIds: [demoStoreId],
          },
          actionScope: {
            assignedStoreIds: [demoStoreId],
          },
          assignedStoreIds: [demoStoreId],
        },
        scopeSummary: {
          companyCount: 1,
          regionCount: 1,
          storeCount: 1,
          assignedStoreCount: 1,
        },
      },
    })
  })
  await page.route('**/api/auth/bootstrap', async (route) => {
    await route.fulfill({
      json: {
        authMode: 'jwt',
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

  await page.goto('/auth/login?returnTo=/store/rankings')

  await expect(page).toHaveURL(/\/store\/rankings$/)
})
