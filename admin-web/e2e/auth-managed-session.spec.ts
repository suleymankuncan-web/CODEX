import { expect, test } from './test-fixtures'

const hint = 'synthetic-persisted-session'
const state = 'synthetic-managed-login-state'
const verifier = 'v'.repeat(43)
const csrfToken = 'synthetic-managed-csrf'
const scope = { companyIds: ['00000000-0000-0000-0000-000000000001'], regionIds: [], storeIds: [] }
const session = { mode: 'bearer', browserSessionTransport: 'cookie', browserSessionKey: hint, bearerToken: '' }
const auth = { authMode: 'jwt', authenticated: true, user: {
  userId: '80000000-0000-0000-0000-000000000001', employeeId: null, roleCodes: ['HR_ADMIN'],
  scope, readScope: scope, actionScope: { assignedStoreIds: [] }, assignedStoreIds: [],
}, scopeSummary: { companyCount: 1, regionCount: 0, storeCount: 0, assignedStoreCount: 0 } }
const issued = { csrfToken, sessionId: 'synthetic-managed-sid', expiresAt: '2099-01-01T00:00:00Z', session: auth }
const bootstrap = { authMode: 'jwt', provider: { configured: true, managedBrowserSession: true,
  authorizationUrl: '/oidc/authorize', tokenUrl: '/oidc/token', clientId: 'synthetic-client',
  scope: 'openid profile email', responseType: 'code', callbackPath: '/auth/callback',
  logoutUrl: null, audience: null, postLogoutRedirectPath: '/auth/login' } }

for (const failure of ['unavailable', 'network'] as const) {
  test(`reload ${failure} retains route, hides protected data, and recovers the same session on retry`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.addInitScript((value) => {
      window.localStorage.setItem('store-ops-admin-session', JSON.stringify(value))
    }, session)
    let recoveries = 0
    let recovered = false
    let reads = 0
    await page.route('**/api/auth/browser-session/csrf', async (route) => {
      recoveries += 1
      if (!recovered) {
        if (failure === 'network') await route.abort('failed')
        else await route.fulfill({ status: 503, json: { message: 'temporary' } })
      } else await route.fulfill({ json: issued })
    })
    await page.route('**/api/auth/session', async (route) => { reads += 1; await route.fulfill({ json: auth }) })
    await page.goto('/admin/session?keep=selected')
    await expect(page.getByRole('alert')).toContainText('Oturum doğrulanamıyor')
    expect(recoveries).toBe(3)
    expect(reads).toBe(0)
    await expect(page).toHaveURL(/\/admin\/session\?keep=selected/)
    await expect(page.locator('a[href="/admin/master-data"]')).toHaveCount(0)
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('store-ops-admin-session')!).browserSessionKey)).toBe(hint)
    recovered = true
    await page.getByRole('button', { name: 'Yeniden dene' }).click()
    await expect(page.getByRole('heading', { name: 'Mevcut oturumu güvenle doğrulayın.' })).toBeVisible()
    expect(reads).toBeGreaterThan(0)
    await expect(page).toHaveURL(/\/admin\/session\?keep=selected/)
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('store-ops-admin-session')!).browserSessionKey)).toBe(hint)
  })
}

test('managed PKCE retries confirmation without consuming local state or exposing provider tokens', async ({ page }) => {
  await page.addInitScript(({ state, verifier }) => {
    localStorage.setItem('store-ops-admin-session', JSON.stringify({ mode: 'bearer', browserSessionTransport: 'cookie', browserSessionKey: '', bearerToken: '' }))
    sessionStorage.setItem('store-ops-admin-pkce-login', JSON.stringify({ state, codeVerifier: verifier, returnTo: '/admin/session', createdAt: Date.now() }))
  }, { state, verifier })
  let exchanges = 0
  let providerCalls = 0
  await page.route('**/oidc/token', async (route) => { providerCalls += 1; await route.fulfill({ status: 500 }) })
  await page.route('**/api/auth/bootstrap', (route) => route.fulfill({ json: bootstrap }))
  await page.route('**/api/auth/browser-session/oidc', async (route) => {
    exchanges += 1
    const input = route.request().postDataJSON()
    expect(input).toEqual({ code: 'synthetic-code', codeVerifier: verifier, state,
      redirectUri: new URL('/auth/callback', route.request().url()).toString() })
    expect(route.request().headers().authorization).toBeUndefined()
    await route.fulfill(exchanges === 1 ? { status: 503, json: { message: 'temporary' } } : { json: issued })
  })
  await page.route('**/api/auth/session', (route) => route.fulfill({ json: auth }))
  await page.goto(`/auth/callback?code=synthetic-code&state=${state}`)
  await expect(page.getByRole('button', { name: 'Yeniden dene' })).toBeVisible()
  expect(await page.evaluate(() => sessionStorage.getItem('store-ops-admin-pkce-login'))).toContain(verifier)
  await page.getByRole('button', { name: 'Yeniden dene' }).click()
  await expect(page).toHaveURL(/\/admin\/session/)
  await expect(page.locator('a[href="/admin/master-data"]')).toBeVisible()
  expect(exchanges).toBe(2)
  expect(providerCalls).toBe(0)
  const tokens = await page.evaluate(() => [sessionStorage.getItem('store-ops-admin-bearer-token'),
    sessionStorage.getItem('store-ops-admin-provider-id-token'), sessionStorage.getItem('store-ops-admin-pkce-login')])
  expect(tokens).toEqual([null, null, null])
})
