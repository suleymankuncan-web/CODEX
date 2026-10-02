import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'

const origin = 'https://axis-login.example.test'
const path = '/realms/store-ops/login-actions/authenticate'
const theme = new URL('../../infra/onprem/core/keycloak/themes/hr-axis/login/resources/js/', import.meta.url)
const address = readFileSync(new URL('login-address.js', theme), 'utf8')
const expiry = readFileSync(new URL('login-expiry.js', theme), 'utf8')
const data = Buffer.from(JSON.stringify({ st: 'fixture-state' })).toString('base64url')
const action = `${origin}${path}?client_id=store-ops-admin-web&client_data=${data}&session_code=native`

async function provider(page: import('@playwright/test').Page, state = 'fixture-state') {
  let posts = 0
  let attempts = 0
  await page.route(origin + '/**', async (route) => {
    const request = route.request()
    if (request.method() === 'POST') posts += 1
    if (new URL(request.url()).pathname === '/auth/login') {
      attempts += 1
      return route.fulfill({ contentType: 'text/html', body: '<h1>Fresh login</h1>' })
    }
    await route.fulfill({ contentType: 'text/html', body: `<!doctype html><style>[hidden]{display:none!important}</style>
      <script>sessionStorage.setItem('store-ops-admin-pkce-login',JSON.stringify({state:${JSON.stringify(state)},createdAt:Date.now(),authorizationExpiresAt:Date.now()+3000}));</script>
      <script>${address}</script><script defer src="${origin}/expiry.js"></script>
      <form id="kc-form-login" action="${action.replaceAll('&', '&amp;')}" method="post">
      <label>Username<input name="username"></label><label>Password<input name="password" type="password"></label><button>Sign in</button></form>
      <div id="axis-login-expired" role="alert" hidden>Session expired<a href="/auth/login">Restart sign in</a></div>
      <a id="axis-login-restart" href="/auth/login">Restart sign in</a>` })
  })
  await page.route(origin + '/expiry.js', (route) => route.fulfill({ contentType: 'text/javascript', body: expiry }))
  return { posts: () => posts, attempts: () => attempts }
}

for (const mobile of [false, true]) {
  test(`expired native attempt has a usable fresh restart and sends no credentials (${mobile ? 'mobile' : 'desktop'})`, async ({ page }) => {
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 })
    await page.clock.install()
    const observed = await provider(page)
    await page.goto(action)
    await expect(page).toHaveURL(origin + '/auth/login')
    await page.getByLabel('Password').fill('synthetic-password')
    await page.clock.fastForward(3001)
    await expect(page.getByRole('alert')).toBeVisible()
    await expect(page.locator('#kc-form-login')).toBeHidden()
    // Capture-phase protection also blocks a stale form submitted by script.
    expect(await page.locator('#kc-form-login').evaluate((form) => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))).toBe(false)
    expect(observed.posts()).toBe(0)
    await page.getByRole('link', { name: 'Restart sign in' }).click()
    await expect(page.getByRole('heading', { name: 'Fresh login' })).toBeVisible()
    expect(observed.attempts()).toBe(1)
  })
}

test('a restored form never adopts a newer same-tab attempt deadline', async ({ page }) => {
  const observed = await provider(page)
  await page.goto(action)
  await expect(page.getByLabel('Password')).toBeVisible()
  await page.evaluate(() => {
    sessionStorage.setItem('store-ops-admin-pkce-login', JSON.stringify({ state: 'newer-state', createdAt: Date.now(), authorizationExpiresAt: Date.now() + 60000 }))
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }))
  })
  await expect(page.getByRole('alert')).toBeVisible()
  expect(observed.posts()).toBe(0)
})

test('unrelated login state cannot disable an external native form', async ({ page }) => {
  await page.clock.install()
  await provider(page, 'unrelated-state')
  await page.goto(action)
  await page.clock.fastForward(3001)
  await expect(page.getByRole('alert')).toBeHidden()
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeEnabled()
})
