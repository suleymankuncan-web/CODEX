import { expect, test } from './test-fixtures'

const hint = 'synthetic-rate-limit-session'
const clientSession = { mode: 'bearer', browserSessionTransport: 'cookie', browserSessionKey: hint, bearerToken: '' }
const scope = { companyIds: ['00000000-0000-0000-0000-000000000001'], regionIds: [], storeIds: [] }
const auth = { authMode: 'jwt', authenticated: true, user: {
  userId: '80000000-0000-0000-0000-000000000001', employeeId: null, roleCodes: ['HR_ADMIN'],
  scope, readScope: scope, actionScope: { assignedStoreIds: [] }, assignedStoreIds: [],
}, scopeSummary: { companyCount: 1, regionCount: 0, storeCount: 0, assignedStoreCount: 0 } }
const issued = { csrfToken: 'synthetic-recovered-csrf', sessionId: 'synthetic-recovered-sid', expiresAt: '2099-01-01T00:00:00Z', session: auth }

for (const path of ['/admin/session?keep=selected', '/store/settings?keep=selected']) {
  test(`shell 429 preserves ${path} and recovers only after an explicit cooled-down retry`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.clock.install()
    await page.addInitScript((value) => localStorage.setItem('store-ops-admin-session', JSON.stringify(value)), clientSession)
    let reads = 0
    await page.route('**/api/auth/browser-session/csrf', (route) => route.fulfill({ json: issued }))
    await page.route('**/api/auth/session', (route) => {
      reads += 1
      return route.fulfill(reads === 1
        ? { status: 429, headers: { 'Retry-After': '2' }, json: { message: 'ThrottlerException: Too Many Requests' } }
        : { json: auth })
    })
    await page.goto(path)
    const retry = page.getByRole('button', { name: /saniye sonra yeniden dene/ })
    await expect(retry).toBeDisabled()
    await expect(page.getByRole('alert')).toContainText('Kısa sürede çok fazla işlem yapıldı.')
    await expect(page.locator('a[href="/admin/master-data"]')).toHaveCount(0)
    expect(reads).toBe(1)
    expect((await retry.boundingBox())!.height).toBeGreaterThanOrEqual(44)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.clock.fastForward(3000)
    const readyRetry = page.getByRole('button', { name: 'Yeniden dene', exact: true })
    await expect(readyRetry).toBeEnabled()
    expect(reads).toBe(1)
    await readyRetry.click()
    if (path.startsWith('/admin')) {
      await expect(page.getByRole('main', { name: 'Admin çalışma alanı' })).toBeVisible()
    } else {
      await expect(page.getByTestId('store-settings-page')).toBeVisible()
    }
    expect(reads).toBe(2)
    await expect(page).toHaveURL(new RegExp(path.replace('?', '\\?')))
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('store-ops-admin-session')!).browserSessionKey)).toBe(hint)
  })
}

test('startup 429 stops immediate recovery retries and preserves the pending session until manual retry', async ({ page }) => {
  await page.clock.install()
  await page.addInitScript((value) => localStorage.setItem('store-ops-admin-session', JSON.stringify(value)), clientSession)
  let recoveries = 0
  let reads = 0
  let limited = true
  await page.route('**/api/auth/browser-session/csrf', (route) => {
    recoveries += 1
    return route.fulfill(limited
      ? { status: 429, headers: { 'Retry-After': '2' }, json: { message: 'Too Many Requests' } }
      : { json: issued })
  })
  await page.route('**/api/auth/session', (route) => { reads += 1; return route.fulfill({ json: auth }) })
  await page.goto('/admin/session?keep=selected')
  await expect(page.getByRole('button', { name: /saniye sonra yeniden dene/ })).toBeDisabled()
  const initialRecoveries = recoveries
  // Vite's development StrictMode may mount and cancel the initial effect once.
  expect(initialRecoveries).toBeLessThanOrEqual(2)
  expect(reads).toBe(0)
  await page.clock.fastForward(3000)
  await expect(page.getByRole('button', { name: 'Yeniden dene', exact: true })).toBeEnabled()
  expect(recoveries).toBe(initialRecoveries)
  limited = false
  await page.getByRole('button', { name: 'Yeniden dene', exact: true }).click()
  await expect(page.getByRole('main', { name: 'Admin çalışma alanı' })).toBeVisible()
  expect(recoveries).toBe(initialRecoveries + 1)
  await expect(page).toHaveURL(/\/admin\/session\?keep=selected/)
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('store-ops-admin-session')!).browserSessionKey)).toBe(hint)
})

test('a forbidden shell still denies access without offering transient recovery', async ({ page }) => {
  await page.addInitScript((value) => localStorage.setItem('store-ops-admin-session', JSON.stringify(value)), clientSession)
  await page.route('**/api/auth/browser-session/csrf', (route) => route.fulfill({ json: issued }))
  await page.route('**/api/auth/session', (route) => route.fulfill({ status: 403, json: { message: 'Forbidden' } }))
  await page.goto('/admin/session')
  await expect(page.getByRole('button', { name: /Yeniden dene|saniye sonra yeniden dene/ })).toHaveCount(0)
  await expect(page.locator('a[href="/admin/master-data"]')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Mevcut oturumu doğrula', exact: true })).toHaveCount(0)
})
