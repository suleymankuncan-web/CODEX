import { expect, test, type Page } from '@playwright/test'

const storeManagerSession = {
  authMode: 'mock',
  authenticated: true,
  user: {
    userId: 'store-manager-user',
    employeeId: 'store-manager-employee',
    roleCodes: ['STORE_MANAGER'],
    scope: {
      companyIds: ['00000000-0000-0000-0000-000000000001'],
      regionIds: ['00000000-0000-0000-0000-000000000010'],
      storeIds: ['00000000-0000-0000-0000-000000000100'],
    },
    readScope: {
      companyIds: ['00000000-0000-0000-0000-000000000001'],
      regionIds: ['00000000-0000-0000-0000-000000000010'],
      storeIds: ['00000000-0000-0000-0000-000000000100'],
    },
    actionScope: {
      assignedStoreIds: ['00000000-0000-0000-0000-000000000100'],
    },
    assignedStoreIds: ['00000000-0000-0000-0000-000000000100'],
  },
  scopeSummary: {
    companyCount: 1,
    regionCount: 1,
    storeCount: 1,
    assignedStoreCount: 1,
  },
}

const adminToken = buildJwt('admin-user')
const storeManagerToken = buildJwt('store-manager-user')

const superAdminSession = {
  authMode: 'jwt',
  authenticated: true,
  user: {
    userId: 'admin-user',
    employeeId: 'admin-employee',
    roleCodes: ['SUPER_ADMIN', 'INTEGRATION_ADMIN'],
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

test('store shell preserves requested store route when bearer session needs login', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'store-ops-admin-session',
      JSON.stringify({
        mode: 'bearer',
        mockUserId: 'store-manager-user',
        mockRoleCodes: 'STORE_MANAGER',
        mockCompanyIds: '00000000-0000-0000-0000-000000000001',
        bearerToken: '',
      }),
    )
    window.sessionStorage.removeItem('store-ops-admin-bearer-token')
  })
  await routeOidcBootstrap(page)

  await page.goto('/store/approvals')

  await expect(page).toHaveURL(/\/auth\/login\?returnTo=%2Fstore%2Fapprovals$/)
  await expect(page.getByText('/store/approvals')).toBeVisible()
})

test('auth login returns ready store-manager sessions to the requested store route', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'store-ops-admin-session',
      JSON.stringify({
        mode: 'mock',
        mockUserId: 'store-manager-user',
        mockRoleCodes: 'STORE_MANAGER',
        mockCompanyIds: '00000000-0000-0000-0000-000000000001',
        bearerToken: '',
      }),
    )
  })
  await routeAuthBootstrap(page)
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({ json: storeManagerSession })
  })

  await page.goto('/auth/login?returnTo=/store/approvals')

  await expect(page).toHaveURL(/\/store\/approvals$/)
})

test('bearer session refetches when the token identity changes in the same tab', async ({ page }) => {
  await page.addInitScript((token) => {
    if (window.sessionStorage.getItem('store-ops-test-session-seeded')) {
      return
    }

    window.localStorage.setItem(
      'store-ops-admin-session',
      JSON.stringify({
        mode: 'bearer',
        mockUserId: 'unused-mock-user',
        mockRoleCodes: 'SUPER_ADMIN',
        mockCompanyIds: '00000000-0000-0000-0000-000000000001',
        bearerToken: '',
      }),
    )
    window.sessionStorage.setItem('store-ops-admin-bearer-token', token)
    window.sessionStorage.setItem('store-ops-test-session-seeded', '1')
  }, adminToken)
  await routeOidcBootstrap(page)
  const authSessionRequests: string[] = []
  await page.route('**/api/auth/session', async (route) => {
    const authorization = route.request().headers().authorization ?? ''
    authSessionRequests.push(authorization)
    await route.fulfill({
      json: authorization.includes(storeManagerToken) ? storeManagerSession : superAdminSession,
    })
  })

  await page.goto('/admin/integrations')
  await expect(page.getByText('User:').locator('..').getByText('admin-user')).toBeVisible()

  await page.evaluate(() => {
    window.sessionStorage.setItem(
      'store-ops-admin-pkce-login',
      JSON.stringify({
        state: 'switch-state',
        codeVerifier: 'test-verifier',
        returnTo: '/admin/integrations',
        createdAt: Date.now(),
      }),
    )
  })
  await page.route('**/oidc/token', async (route) => {
    await route.fulfill({
      json: {
        access_token: storeManagerToken,
      },
    })
  })
  await page.goto('/auth/callback?code=switch-code&state=switch-state')
  await expect(page).toHaveURL(/\/admin\/integrations$/)
  await expect
    .poll(() => page.evaluate(() => window.sessionStorage.getItem('store-ops-admin-bearer-token')))
    .toBe(storeManagerToken)

  await expect(page.getByText('User:').locator('..').getByText('store-manager-user')).toBeVisible()
  await expect(page.getByText('Route not available for this role')).toBeVisible()
})

test('auth login ignores protocol-relative return targets for ready sessions', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'store-ops-admin-session',
      JSON.stringify({
        mode: 'mock',
        mockUserId: 'store-manager-user',
        mockRoleCodes: 'STORE_MANAGER',
        mockCompanyIds: '00000000-0000-0000-0000-000000000001',
        bearerToken: '',
      }),
    )
  })
  await routeAuthBootstrap(page)
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({ json: storeManagerSession })
  })

  await page.goto('/auth/login?returnTo=//evil.example/store/me')

  await expect(page).toHaveURL(/\/store$/)
  expect(page.url()).not.toContain('evil.example')
})

test('oidc callback ignores protocol-relative stored return targets', async ({ page }) => {
  await page.addInitScript(() => {
    window.sessionStorage.setItem(
      'store-ops-admin-pkce-login',
      JSON.stringify({
        state: 'return-state',
        codeVerifier: 'test-verifier',
        returnTo: '//evil.example/store/me',
        createdAt: Date.now(),
      }),
    )
  })
  await routeOidcBootstrap(page)
  await page.route('**/oidc/token', async (route) => {
    await route.fulfill({
      json: {
        access_token: 'eyJhbGciOiJub25lIn0.eyJzdWIiOiJzdG9yZS1tYW5hZ2VyIn0.signature',
      },
    })
  })
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({ json: storeManagerSession })
  })

  await page.goto('/auth/callback?code=test-code&state=return-state')

  await expect(page).toHaveURL(/\/store$/)
  expect(page.url()).not.toContain('evil.example')
})

test('auth login returns after a session-expired notice once the session is ready again', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'store-ops-admin-session',
      JSON.stringify({
        mode: 'mock',
        mockUserId: 'store-manager-user',
        mockRoleCodes: 'STORE_MANAGER',
        mockCompanyIds: '00000000-0000-0000-0000-000000000001',
        bearerToken: '',
      }),
    )
  })
  await routeAuthBootstrap(page)
  await page.route('**/api/auth/session', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 500))
    await route.fulfill({ json: storeManagerSession })
  })

  await page.goto('/store/me')
  await page.waitForTimeout(100)
  await page.evaluate(() => {
    window.dispatchEvent(
      new CustomEvent('store-ops-session-expired', {
        detail: {
          path: '/reports/my-performance',
          message: 'Expired test token',
          status: 401,
        },
      }),
    )
  })

  await expect(page).toHaveURL(/\/store\/me$/)
})

async function routeAuthBootstrap(page: Page) {
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
}

async function routeOidcBootstrap(page: Page) {
  await page.route('**/api/auth/bootstrap', async (route) => {
    await route.fulfill({
      json: {
        authMode: 'jwt',
        provider: {
          configured: true,
          authorizationUrl: 'https://id.example/authorize',
          clientId: 'store-ops-client',
          scope: 'openid profile email',
          responseType: 'code',
          audience: null,
          callbackPath: '/auth/callback',
          tokenUrl: '/oidc/token',
          logoutUrl: null,
          postLogoutRedirectPath: '/auth/login',
        },
      },
    })
  })
}

function buildJwt(sub: string) {
  const header = base64Url(JSON.stringify({ alg: 'none', typ: 'JWT' }))
  const payload = base64Url(
    JSON.stringify({
      sub,
      exp: Math.floor(Date.now() / 1000) + 60 * 60,
      iat: Math.floor(Date.now() / 1000),
    }),
  )

  return `${header}.${payload}.signature`
}

function base64Url(value: string) {
  return Buffer.from(value, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}
