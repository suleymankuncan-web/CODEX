import { expect, test } from './test-fixtures'

const accessToken = 'synthetic-access-token-for-cookie-transport'
const idToken = 'synthetic-id-token-that-must-not-be-stored'
const csrfToken = 'synthetic-csrf-nonce'
const pkceState = 'synthetic-pkce-state'
const codeVerifier = 'synthetic-code-verifier'
const companyId = '00000000-0000-0000-0000-000000000001'

const cookieTransportSession = {
  mode: 'bearer',
  browserSessionTransport: 'cookie',
  mockUserId: '80000000-0000-0000-0000-000000000001',
  mockRoleCodes: 'SUPER_ADMIN',
  mockCompanyIds: '00000000-0000-0000-0000-000000000001',
  mockStoreIds: '',
  mockReadStoreIds: '',
  mockAssignedStoreIds: '',
  mockRegionIds: '',
  mockReadRegionIds: '',
  bearerToken: '',
}

const authSession = {
  authMode: 'jwt',
  authenticated: true,
  user: {
    userId: '80000000-0000-0000-0000-000000000001',
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

test('PKCE callback creates cookie session without storing provider tokens', async ({ page }) => {
  let browserSessionAuthorization = ''
  let browserSessionCreateCount = 0
  let browserSessionClearCount = 0
  let feedPostCount = 0
  let feedPostCsrf = ''
  let feedPostAuthorization: string | undefined

  await page.route('**/api/auth/bootstrap', async (route) => {
    await route.fulfill({
      json: {
        auth: {
          mode: 'bearer',
          scope: 'openid profile email',
          responseType: 'code',
          audience: null,
          callbackPath: '/auth/callback',
          tokenUrl: '/oidc/token',
          logoutUrl: null,
          postLogoutRedirectPath: '/auth/login',
        },
        provider: {
          configured: true,
          authorizationUrl: '/oidc/authorize',
          clientId: 'synthetic-client',
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

  await page.route('**/oidc/token', async (route) => {
    const body = route.request().postData() ?? ''
    expect(body).toContain(`code_verifier=${codeVerifier}`)
    await route.fulfill({
      json: {
        access_token: accessToken,
        id_token: idToken,
      },
    })
  })

  await page.route('**/api/auth/browser-session', async (route) => {
    const request = route.request()

    if (request.method() === 'POST') {
      browserSessionCreateCount += 1
      browserSessionAuthorization = request.headers().authorization ?? ''
      await route.fulfill({
        headers: {
          'Set-Cookie': 'store_ops_app_session=synthetic-cookie; Path=/; HttpOnly; SameSite=Lax',
        },
        json: {
          csrfToken,
          expiresAt: '2026-06-12T02:00:00.000Z',
          sessionId: 'synthetic-session-id',
          session: authSession,
        },
      })
      return
    }

    if (request.method() === 'DELETE') {
      browserSessionClearCount += 1
      await route.fulfill({ json: { cleared: true } })
      return
    }

    await route.fallback()
  })

  await page.route('**/api/auth/session', async (route) => {
    if (new URL(route.request().url()).pathname !== '/api/auth/session') {
      await route.fallback()
      return
    }

    expect(route.request().headers().authorization).toBeUndefined()
    await route.fulfill({ json: authSession })
  })

  await page.route('**/api/auth/lookups', async (route) => {
    await route.fulfill({
      json: {
        scopeTypes: ['company', 'region', 'store'],
        authProviders: ['oidc'],
        users: [],
        roles: [],
        permissions: [],
        stores: [],
        optionGroups: {
          users: [],
          roles: [],
          permissions: [],
          stores: [],
          scopeTypes: [{ value: 'company', label: 'company' }],
          authProviders: [{ value: 'oidc', label: 'oidc' }],
        },
        meta: {
          totalUsers: 0,
          totalRoles: 0,
          totalPermissions: 0,
          totalStores: 0,
        },
      },
    })
  })

  await page.route('**/api/admin/feed**', async (route) => {
    const request = route.request()

    if (request.method() === 'POST') {
      feedPostCount += 1
      feedPostCsrf = request.headers()['x-csrf-token'] ?? ''
      feedPostAuthorization = request.headers().authorization
      await route.fulfill({
        json: {
          command: { status: 'created', message: 'Feed post created' },
          data: {
            feedPost: {
              feedPostId: '22222222-2222-4222-8222-222222222222',
              postType: 'challenge',
              title: 'Cookie Session Challenge',
              body: 'Cookie transport unsafe request proof.',
              visibilityScopeType: 'company',
              visibilityScopeIds: [],
              isPinned: false,
              publishStatus: 'published',
              publishedAt: '2026-06-12T01:00:00.000Z',
              startsAt: null,
              endsAt: null,
              metricCode: 'upt',
              metricLabel: 'UPT',
              challengeStartsOn: '2026-06-01',
              challengeEndsOn: '2026-06-30',
              targetRoute: '/store/rankings',
              createdByUserId: companyId,
              updatedByUserId: companyId,
              createdAt: '2026-06-12T01:00:00.000Z',
              updatedAt: '2026-06-12T01:00:00.000Z',
            },
          },
        },
      })
      return
    }

    await route.fulfill({
      json: {
        items: [],
        meta: { count: 0, total: 0, limit: 50, offset: 0 },
      },
    })
  })

  await page.route('**/api/competitions**', async (route) => {
    await route.fulfill({
      json: {
        items: [],
        meta: { count: 0, total: 0, limit: 50, offset: 0 },
      },
    })
  })

  await page.addInitScript(
    ({ session, state, verifier }) => {
      window.localStorage.setItem('store-ops-admin-session', JSON.stringify(session))
      window.sessionStorage.setItem(
        'store-ops-admin-pkce-login',
        JSON.stringify({
          state,
          codeVerifier: verifier,
          returnTo: '/admin/session',
          createdAt: Date.now(),
        }),
      )
    },
    {
      session: cookieTransportSession,
      state: pkceState,
      verifier: codeVerifier,
    },
  )

  await page.goto(`/auth/callback?code=synthetic-code&state=${pkceState}`)
  await expect(page).toHaveURL(/\/admin\/session/)
  await expect.poll(() => browserSessionCreateCount).toBe(1)
  expect(browserSessionAuthorization).toBe(`Bearer ${accessToken}`)

  const storageState = await page.evaluate(() => ({
    bearerToken: window.sessionStorage.getItem('store-ops-admin-bearer-token'),
    providerIdToken: window.sessionStorage.getItem('store-ops-admin-provider-id-token'),
    pkceState: window.sessionStorage.getItem('store-ops-admin-pkce-login'),
    persistedSession: window.localStorage.getItem('store-ops-admin-session'),
    csrfMemory: window.__storeOpsBrowserSessionCsrfToken,
  }))

  expect(storageState.bearerToken).toBeNull()
  expect(storageState.providerIdToken).toBeNull()
  expect(storageState.pkceState).toBeNull()
  expect(storageState.persistedSession).not.toContain(accessToken)
  expect(storageState.persistedSession).not.toContain(idToken)
  expect(storageState.persistedSession).toContain('"browserSessionTransport":"cookie"')
  expect(storageState.csrfMemory).toBe(csrfToken)

  await page.evaluate(() => {
    window.history.pushState(null, '', '/admin/feed')
    window.dispatchEvent(new PopStateEvent('popstate'))
  })
  await expect(page.getByRole('heading', { name: 'Feed postu oluştur' })).toBeVisible()
  await page.getByLabel('Tip').selectOption('challenge')
  await page.getByLabel('Başlık').fill('Cookie Session Challenge')
  await page.getByLabel('Gövde').fill('Cookie transport unsafe request proof.')
  await page.getByLabel('Yarışma başlangıcı').fill('2026-06-01')
  await page.getByLabel('Yarışma bitişi').fill('2026-06-30')
  await page.getByRole('button', { name: 'Postu yayınla' }).click()

  await expect(page.getByText('Feed post created')).toBeVisible()
  expect(feedPostCount).toBe(1)
  expect(feedPostCsrf).toBe(csrfToken)
  expect(feedPostAuthorization).toBeUndefined()

  await page.goto('/admin/session')
  await page.getByRole('button', { name: /Mock/ }).click()
  await page.getByLabel(/Kullan|User/).fill('mock-cookie-clear-user')
  await page.getByRole('button', { name: /kaydet|Save/i }).click()
  await expect.poll(() => browserSessionClearCount).toBe(1)

  await expect
    .poll(() => page.evaluate(() => window.localStorage.getItem('store-ops-admin-session') ?? ''))
    .toContain('"mode":"mock"')

  const storageAfterMockSave = await page.evaluate(() => ({
    bearerToken: window.sessionStorage.getItem('store-ops-admin-bearer-token'),
    providerIdToken: window.sessionStorage.getItem('store-ops-admin-provider-id-token'),
    persistedSession: window.localStorage.getItem('store-ops-admin-session'),
  }))

  expect(storageAfterMockSave.bearerToken).toBeNull()
  expect(storageAfterMockSave.providerIdToken).toBeNull()
  expect(storageAfterMockSave.persistedSession).toContain('mock-cookie-clear-user')
  expect(storageAfterMockSave.persistedSession).toContain('"browserSessionKey":""')

  await page.goto('/auth/logout')
  await expect.poll(() => browserSessionClearCount).toBe(2)
})
