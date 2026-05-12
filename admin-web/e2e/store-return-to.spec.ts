import { expect, test, type Page } from '@playwright/test'
import { setStoredLocale } from './locale-test-utils'

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

test('auth login and callback pages switch chrome to English copy and persist locale', async ({ page }) => {
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
  await routeAuthBootstrap(page)

  await page.goto('/auth/login?returnTo=/store/approvals')

  await expect(page.locator('html')).toHaveAttribute('lang', 'tr')
  await expect(page.getByText('Kimlik girişi')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Uygulama admin veya mağaza kabuklarını açmadan önce gerçek giriş buradan yapılacak.' })).toBeVisible()
  await expect(page.getByText('Sağlayıcı akışı', { exact: true })).toBeVisible()
  await expect(page.getByText('Ortam gerekli', { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Bu route şu anda ne yapabilir' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Callback route simülasyonu' })).toBeVisible()
  await expect(page.getByText('Auth Entry')).toHaveCount(0)
  await expect(page.locator('body')).not.toContainText('ÃƒÆ’')
  await expect(page.locator('body')).not.toContainText('Ãƒâ€')
  await expect(page.locator('body')).not.toContainText('Ãƒâ€¦')

  await setStoredLocale(page, 'en')

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByText('Auth Entry')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Real login will enter here before the app opens admin or store shells.' })).toBeVisible()
  await expect(page.getByText('Provider flow', { exact: true })).toBeVisible()
  await expect(page.getByText('Needs env', { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'What this route can do now' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Simulate callback route' })).toBeVisible()
  await expect(page.getByText('Kimlik girişi')).toHaveCount(0)

  await page.reload()

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('heading', { name: 'Real login will enter here before the app opens admin or store shells.' })).toBeVisible()

  await page.goto('/auth/callback#access_token=demo-placeholder-token&state=%2Fstore%2Fapprovals')

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('heading', { name: 'Manual token callback is disabled' })).toBeVisible()
  await expect(page.getByText('Production hardening')).toBeVisible()

  await page.evaluate(() => {
    window.localStorage.setItem('store-ops-app-locale', 'tr')
  })
  await page.goto('/auth/callback?access_token=demo-placeholder-token&state=%2Fstore%2Fapprovals')

  await expect(page.locator('html')).toHaveAttribute('lang', 'tr')
  await expect(page.getByRole('heading', { name: 'Manuel token callback kapalı' })).toBeVisible()
  await expect(page.getByText('Production sertleştirme')).toBeVisible()
  await expect(page.getByText('Manual token callback is disabled')).toHaveCount(0)
})

test('auth logout page switches chrome to English copy and persists locale while clearing the session', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'store-ops-admin-session',
      JSON.stringify({
        mode: 'bearer',
        mockUserId: 'store-manager-user',
        mockRoleCodes: 'STORE_MANAGER',
        mockCompanyIds: '00000000-0000-0000-0000-000000000001',
        bearerToken: 'demo-token',
      }),
    )
    window.sessionStorage.setItem('store-ops-admin-bearer-token', 'demo-token')
  })
  await page.route('**/api/auth/bootstrap', async () => {
    await new Promise(() => undefined)
  })

  await page.goto('/auth/logout')

  await expect(page.locator('html')).toHaveAttribute('lang', 'tr')
  await expect(page.getByRole('heading', { name: 'Çıkış yapılıyor' })).toBeVisible()
  await expect(page.getByText('İstemci bearer oturumu temizleniyor')).toBeVisible()
  await expect(page.getByText('Signing out')).toHaveCount(0)
  await expect(page.locator('body')).not.toContainText('ÃƒÆ’')
  await expect(page.locator('body')).not.toContainText('Ãƒâ€')
  await expect(page.locator('body')).not.toContainText('Ãƒâ€¦')

  await setStoredLocale(page, 'en')

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('heading', { name: 'Signing out' })).toBeVisible()
  await expect(page.getByText('The client bearer session is being cleared')).toBeVisible()
  await expect(page.getByText('Çıkış yapılıyor')).toHaveCount(0)

  await page.reload()

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('heading', { name: 'Signing out' })).toBeVisible()
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
  await expect(page.getByText('Kullanıcı:').locator('..').getByText('admin-user')).toBeVisible()

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

  await expect(page.getByText('Kullanıcı:').locator('..').getByText('store-manager-user')).toBeVisible()
  await expect(page.getByText('Bu rol için rota kullanılamaz')).toBeVisible()
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
