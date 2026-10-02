import { expect, test } from './test-fixtures'
import type { Page } from './test-fixtures'

const authPath = '/realms/store-ops/protocol/openid-connect/auth'
const parPath = '/realms/store-ops/protocol/openid-connect/ext/par/request'
const reference = 'urn:ietf:params:oauth:request_uri:1234567890abcdefghijklmnopqrstuv'
const pushed = process.env.VITE_OIDC_PAR_ENABLED === 'true'
const direct = process.env.VITE_OIDC_AUTO_REDIRECT === 'true' && process.env.VITE_AUTH_PROVIDER === 'oidc'

async function provider(page: Page) {
  let exchanges = 0
  const requests: URLSearchParams[] = []
  await page.addInitScript(() => {
    localStorage.setItem('store-ops-admin-session', JSON.stringify({ mode: 'bearer',
      browserSessionTransport: 'cookie', browserSessionKey: '', bearerToken: '' }))
  })
  await page.route('**/api/auth/bootstrap', (route) => {
    const origin = new URL(route.request().url()).origin
    return route.fulfill({ json: { authMode: 'jwt', provider: { configured: true,
      managedBrowserSession: true, authorizationUrl: origin + authPath, clientId: 'store-ops-admin-web',
      responseType: 'code', callbackPath: '/auth/callback', tokenUrl: origin + '/oidc/token',
      scope: 'openid profile email roles', audience: null, logoutUrl: null,
      postLogoutRedirectPath: '/auth/login' } } })
  })
  await page.route('**' + parPath, async (route) => {
    expect(route.request().method()).toBe('POST')
    requests.push(new URLSearchParams(route.request().postData() ?? ''))
    await route.fulfill({ status: 201, json: { request_uri: reference, expires_in: 60 } })
  })
  await page.route('**' + authPath + '?**', (route) => route.fulfill({ contentType: 'text/html',
    body: '<!doctype html><title>Identity provider</title><h1>Provider sign in</h1>' }))
  await page.route('**/api/auth/browser-session/oidc', async (route) => {
    exchanges += 1
    await route.fulfill({ status: 500 })
  })
  return { requests, exchangeCount: () => exchanges }
}

test('login hands off the same-tab PKCE request with the selected provider transport', async ({ page }) => {
  const observed = await provider(page)
  await page.goto('/auth/login?returnTo=%2Fstore%2Fme')
  if (!direct) await page.locator('a.auth-login-primary').click()
  await expect(page.getByRole('heading', { name: 'Provider sign in' })).toBeVisible()
  const url = new URL(page.url())
  const saved = await page.evaluate(() => JSON.parse(sessionStorage.getItem('store-ops-admin-pkce-login')!))
  expect(saved.returnTo).toBe('/store/me')
  expect(saved.codeVerifier.length).toBeGreaterThanOrEqual(43)
  if (pushed) {
    expect([...url.searchParams.keys()]).toEqual(['client_id', 'request_uri'])
    expect(observed.requests.length).toBeGreaterThan(0)
    expect(observed.requests.at(-1)!.get('state')).toBe(saved.state)
    expect(observed.requests.at(-1)!.has('code_verifier')).toBe(false)
  } else {
    expect(observed.requests).toHaveLength(0)
    expect(url.searchParams.get('state')).toBe(saved.state)
    expect(url.searchParams.get('code_challenge_method')).toBe('S256')
  }
})

test('reopening an old callback never exchanges its code and recovers direct on-prem login', async ({ page }) => {
  const observed = await provider(page)
  await page.goto('/auth/callback?code=old-consumed-code&state=old-state')
  if (direct) {
    await expect(page.getByRole('heading', { name: 'Provider sign in' })).toBeVisible()
    expect(page.url()).not.toContain('old-consumed-code')
  } else {
    await expect(page.getByRole('button', { name: 'Kurumsal girişi yeniden başlat' })).toBeVisible()
  }
  expect(observed.exchangeCount()).toBe(0)
})

test('a mismatched callback stays rejected instead of silently starting another login', async ({ page }) => {
  const observed = await provider(page)
  await page.addInitScript(() => {
    sessionStorage.setItem('store-ops-admin-pkce-login', JSON.stringify({ state: 'expected-state',
      codeVerifier: 'v'.repeat(43), returnTo: '/store', createdAt: Date.now() }))
  })
  await page.goto('/auth/callback?code=untrusted-code&state=wrong-state')
  await expect(page.getByText('PKCE login state is invalid', { exact: true })).toBeVisible()
  expect(observed.exchangeCount()).toBe(0)
  expect(observed.requests).toHaveLength(0)
})

test('refreshing the native clean address keeps the destination and completes a fresh handshake', async ({ page }) => {
  await provider(page)
  await page.goto('/auth/login?returnTo=%2Fstore%2Fme')
  if (!direct) await page.locator('a.auth-login-primary').click()
  await expect(page.getByRole('heading', { name: 'Provider sign in' })).toBeVisible()
  const previous = await page.evaluate(() => JSON.parse(sessionStorage.getItem('store-ops-admin-pkce-login')!))
  // The native-address helper is exercised separately against native POSTs.
  await page.evaluate(() => history.replaceState(history.state, '', '/auth/login'))
  await page.reload()
  if (!direct) await page.locator('a.auth-login-primary').click()
  await expect(page.getByRole('heading', { name: 'Provider sign in' })).toBeVisible()
  const next = await page.evaluate(() => JSON.parse(sessionStorage.getItem('store-ops-admin-pkce-login')!))
  expect(next.returnTo).toBe(direct ? '/store/me' : '/store')
  expect(next.state).not.toBe(previous.state)
  expect(next.codeVerifier).not.toBe(previous.codeVerifier)
  // Hosted/manual entry has no masked native page and retains its default
  // destination behavior; completion below belongs to the direct flow.
  if (!direct) return
  const scope = { companyIds: ['00000000-0000-0000-0000-000000000001'], regionIds: [], storeIds: [] }
  const session = { authMode: 'jwt', authenticated: true, user: {
    userId: '80000000-0000-0000-0000-000000000001', employeeId: null, roleCodes: ['HR_ADMIN'],
    scope, readScope: scope, actionScope: { assignedStoreIds: [] }, assignedStoreIds: [],
  }, scopeSummary: { companyCount: 1, regionCount: 0, storeCount: 0, assignedStoreCount: 0 } }
  const issued = { csrfToken: 'synthetic-csrf', sessionId: 'synthetic-session', expiresAt: '2099-01-01T00:00:00Z', session }
  await page.route('**/api/auth/browser-session/oidc', async (route) => {
    expect(route.request().postDataJSON()).toMatchObject({ state: next.state, codeVerifier: next.codeVerifier })
    await route.fulfill({ json: issued })
  })
  await page.route('**/api/auth/browser-session/csrf', (route) => route.fulfill({ json: issued }))
  await page.route('**/api/auth/session', (route) => route.fulfill({ json: session }))
  await page.goto(`/auth/callback?code=synthetic-code&state=${encodeURIComponent(next.state)}`)
  await expect(page).toHaveURL(/\/store\/me$/)
})

test('a provider error has an explicit fresh-login recovery', async ({ page }) => {
  await provider(page)
  await page.goto('/auth/callback?error=temporarily_unavailable&error_description=Sign-in+expired')
  await expect(page.getByText('Sign-in expired', { exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'Kurumsal girişi yeniden başlat' }).click()
  if (!direct) await page.locator('a.auth-login-primary').click()
  await expect(page.getByRole('heading', { name: 'Provider sign in' })).toBeVisible()
})
