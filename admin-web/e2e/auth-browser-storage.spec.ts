import { expect, test } from './test-fixtures'

const state = 'synthetic-storage-state'
const verifier = 'v'.repeat(43)
const originSession = { mode: 'bearer', browserSessionTransport: 'cookie', browserSessionKey: '', bearerToken: '' }
const bootstrap = { authMode: 'jwt', provider: { configured: true, managedBrowserSession: true,
  authorizationUrl: '/oidc/authorize', tokenUrl: '/oidc/token', clientId: 'synthetic-client',
  scope: 'openid profile email', responseType: 'code', callbackPath: '/auth/callback',
  logoutUrl: null, audience: null, postLogoutRedirectPath: '/auth/login' } }
const issued = { csrfToken: 'new-session-nonce', sessionId: 'synthetic-session', expiresAt: '2099-01-01T00:00:00Z', session: { authenticated: true } }

test('blocked site storage shows a usable login error without provider requests or a redirect loop', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get: () => { throw new DOMException('Blocked', 'SecurityError') } })
    Object.defineProperty(window, 'sessionStorage', { get: () => { throw new DOMException('Blocked', 'SecurityError') } })
  })
  await page.route('**/api/auth/bootstrap', route => route.fulfill({ json: { ...bootstrap,
    provider: { ...bootstrap.provider, authorizationUrl: new URL('/oidc/authorize', route.request().url()).toString() },
  } }))
  // A local mock build has configured default credentials even without storage.
  // Keep this scenario unauthenticated, as the deployed cookie build is.
  await page.route('**/api/auth/session', route => route.fulfill({ status: 401, json: { message: 'Unauthorized' } }))
  const providerRequests: string[] = []
  page.on('request', request => { if (/\/oidc\/|\/ext\/par\//.test(request.url())) providerRequests.push(request.url()) })
  await page.goto('/auth/login')
  await expect(page.getByText(/Giriş için gerekli tarayıcı depolamasına erişilemiyor/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Tekrar dene' })).toBeEnabled()
  await expect(page).toHaveURL(/\/auth\/login$/)
  expect(providerRequests).toEqual([])
  expect(errors).toEqual([])
})

test('a callback with blocked tab storage offers fresh login without exchanging the old code', async ({ page }) => {
  await page.addInitScript(value => {
    localStorage.setItem('store-ops-admin-session', JSON.stringify(value))
    Object.defineProperty(window, 'sessionStorage', { get: () => { throw new DOMException('Blocked', 'SecurityError') } })
  }, originSession)
  await page.route('**/api/auth/bootstrap', route => route.fulfill({ json: bootstrap }))
  let exchanges = 0
  await page.route('**/api/auth/browser-session/oidc', route => { exchanges += 1; return route.fulfill({ json: issued }) })
  await page.goto(`/auth/callback?code=old-code&state=${state}`)
  await expect(page.getByText(/Giriş için gerekli tarayıcı depolamasına erişilemiyor/)).toBeVisible()
  await expect(page.getByRole('link', { name: 'Kurumsal girişi yeniden başlat' })).toHaveAttribute('href', '/auth/login')
  await expect(page.getByRole('button', { name: 'Yeniden dene', exact: true })).toHaveCount(0)
  expect(exchanges).toBe(0)
  await expect(page).toHaveURL(/\/auth\/callback\?/)
})

for (const failure of ['absent', 'older-account'] as const) {
  test(`an ${failure} cookie stops login before protected reads and never replays the code`, async ({ page }) => {
    await page.addInitScript(({ value, state, verifier }) => {
      localStorage.setItem('store-ops-admin-session', JSON.stringify(value))
      sessionStorage.setItem('store-ops-admin-pkce-login', JSON.stringify({ state, codeVerifier: verifier, returnTo: '/admin/session', createdAt: Date.now() }))
    }, { value: originSession, state, verifier })
    await page.route('**/api/auth/bootstrap', route => route.fulfill({ json: bootstrap }))
    let exchanges = 0
    let confirmations = 0
    let protectedReads = 0
    await page.route('**/api/auth/browser-session/oidc', route => { exchanges += 1; return route.fulfill({ json: issued }) })
    await page.route('**/api/auth/browser-session/csrf', route => {
      confirmations += 1
      return route.fulfill(failure === 'absent' ? { status: 401, json: { message: 'Unauthorized' } } : { json: { csrfToken: 'older-account-nonce' } })
    })
    await page.route('**/api/auth/session', route => { protectedReads += 1; return route.fulfill({ status: 401 }) })
    await page.goto(`/auth/callback?code=synthetic-code&state=${state}`)
    await expect(page.getByText(/Giriş oturumu bu tarayıcıda doğrulanamadı/)).toBeVisible()
    const restart = page.getByRole('link', { name: 'Kurumsal girişi yeniden başlat' })
    expect((await restart.boundingBox())!.height).toBeGreaterThanOrEqual(44)
    await expect(restart).toHaveAttribute('href', '/auth/login')
    await expect(page.getByRole('button', { name: 'Yeniden dene', exact: true })).toHaveCount(0)
    expect(exchanges).toBe(1)
    expect(confirmations).toBe(1)
    expect(protectedReads).toBe(0)
    expect(await page.evaluate(() => sessionStorage.getItem('store-ops-admin-pkce-login'))).toContain(verifier)
    expect(await page.evaluate(() => sessionStorage.getItem('store-ops-admin-bearer-token'))).toBeNull()
    await expect(page).toHaveURL(/\/auth\/callback\?/)
  })
}
