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
