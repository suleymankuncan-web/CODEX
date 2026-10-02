import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'

const origin = 'https://axis-login.example.test'
const path = '/realms/store-ops/login-actions/authenticate'
const script = readFileSync(new URL('../../infra/onprem/core/keycloak/themes/hr-axis/login/resources/js/login-address.js', import.meta.url), 'utf8')

for (const mobile of [false, true]) {
  test(`native login keeps a clean address through errors, refresh and successful submission (${mobile ? 'mobile' : 'desktop'})`, async ({ page }) => {
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 })
    let sessions = 0
    let submissions = 0
    await page.route(origin + '/**', async (route) => {
      const request = route.request()
      const url = new URL(request.url())
      if (url.pathname === '/auth/login') {
        sessions += 1
        return route.fulfill({ contentType: 'text/html', body: `<script>location.replace(${JSON.stringify(`${origin}${path}?client_id=store-ops-admin-web&tab_id=session-${sessions}&client_data=native-session`)});</script>` })
      }
      if (url.pathname === '/auth/callback') {
        expect(url.searchParams.get('code')).toBe('native-code')
        expect(url.searchParams.get('state')).toBe('native-state')
        return route.fulfill({ contentType: 'text/html', body: '<h1>Signed in</h1>' })
      }
      if (url.pathname === path && request.method() === 'POST') {
        expect(url.searchParams.get('session_code')).toBe('native-session-code')
        expect(url.searchParams.get('execution')).toBe('native-execution')
        expect(url.searchParams.get('tab_id')).toBe(`session-${sessions}`)
        submissions += 1
        if (new URLSearchParams(request.postData()!).get('password') === 'valid-fixture-password') {
          return route.fulfill({ contentType: 'text/html', body: `<script>location.replace(${JSON.stringify(origin + '/auth/callback?code=native-code&state=native-state')});</script>` })
        }
      }
      if (url.pathname === path) {
        const action = `${origin}${path}?client_id=store-ops-admin-web&session_code=native-session-code&execution=native-execution&tab_id=session-${sessions}`
        return route.fulfill({ contentType: 'text/html', body: `<!doctype html><title>Axis Lufian</title><script>${script}</script>
          ${request.method() === 'POST' ? '<p role="alert">Invalid password</p>' : ''}
          <form action="${action.replaceAll('&', '&amp;')}" method="post">
            <label>Username<input name="username"></label><label>Password<input name="password" type="password"></label>
            <button>Sign in</button></form>
          <a href="${origin}/realms/store-ops/login-actions/reset-credentials?client_id=store-ops-admin-web&amp;tab_id=session-${sessions}">Reset password</a>
          ${request.method() === 'POST' ? `<script>history.replaceState(history.state, '', ${JSON.stringify(request.url())});</script>` : ''}` })
      }
      return route.fulfill({ status: 404 })
    })
    await page.goto(origin + '/auth/login')
    await expect(page).toHaveURL(origin + '/auth/login')
    expect(await page.locator('form').getAttribute('action')).toContain('session_code=native-session-code')
    expect(await page.getByRole('link', { name: 'Reset password' }).getAttribute('href')).toContain('/login-actions/reset-credentials?')
    await page.getByLabel('Username').fill('synthetic-user')
    await page.getByLabel('Password').fill('wrong-fixture-password')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByRole('alert')).toHaveText('Invalid password')
    await expect(page).toHaveURL(origin + '/auth/login')
    await page.reload()
    await expect(page.getByRole('alert')).toHaveCount(0)
    await expect(page).toHaveURL(origin + '/auth/login')
    expect(sessions).toBe(2)
    await page.getByLabel('Username').fill('synthetic-user')
    await page.getByLabel('Password').fill('valid-fixture-password')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByRole('heading', { name: 'Signed in' })).toBeVisible()
    expect(submissions).toBe(2)
  })
}

test('restricted browser history leaves native credentials usable', async ({ page }) => {
  await page.addInitScript(() => {
    history.replaceState = () => { throw new DOMException('Restricted history', 'SecurityError') }
  })
  const url = `${origin}${path}?client_id=store-ops-admin-web&tab_id=fixture`
  await page.route(origin + '/**', (route) => route.fulfill({ contentType: 'text/html', body: `<!doctype html><script>${script}</script><form action="${url}" method="post"><label>Password<input type="password"></label><button>Sign in</button></form>` }))
  await page.goto(url)
  await expect(page).toHaveURL(url)
  await page.getByLabel('Password').fill('synthetic-password')
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeEnabled()
})
