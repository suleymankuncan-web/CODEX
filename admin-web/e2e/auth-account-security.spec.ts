import { expect, test, type Page } from './test-fixtures'
import { routeAuthManagementApi, usersFixture } from './auth-management-test-fixtures'

const emptySecurity = { passwordState: 'unknown', passwordSetAt: null, observedAt: null,
  lastLoginAt: null, lastActiveAt: null, requests: [] as Array<Record<string, unknown>> }
const sent = (state = 'sent') => ({ requestId: '10000000-0000-4000-8000-000000000001', kind: 'reset', state,
  requestedAt: '2026-10-01T08:00:00Z', sentAt: state === 'unconfirmed' ? null : '2026-10-01T08:01:00Z',
  expiresAt: '2026-10-02T08:00:00Z', completedObservedAt: null, verifiedPasswordSetAt: null, errorCode: null })

async function setup(page: Page, security: Record<string, unknown> = emptySecurity) {
  await page.addInitScript(() => window.localStorage.setItem('store-ops-admin-session', JSON.stringify({
    mode: 'mock', mockUserId: 'super-admin-auth-user', mockRoleCodes: 'SUPER_ADMIN', mockCompanyIds: 'company-1', bearerToken: '',
  })))
  await routeAuthManagementApi(page)
  await page.route('**/api/auth/users?**', route => route.fulfill({ json: { ...usersFixture,
    items: usersFixture.items.map(user => ({ ...user, authProvider: 'oidc' })) } }))
  await page.route('**/api/auth/users/*/security', route => route.fulfill({ json: security }))
}

test('account security remains separate from default access, with unknown history and mobile touch targets', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await setup(page)
  await page.goto('/admin/auth')
  await expect(page.getByText('Mağaza erişimi', { exact: true })).toBeVisible()
  await expect(page.getByText('Şifre ve oturum', { exact: true })).toBeHidden()
  await page.getByRole('tab', { name: 'Hesap ve güvenlik' }).click()
  await expect(page.getByText('Henüz doğrulanmadı', { exact: true })).toBeVisible()
  await expect(page.getByText('Kayıtlı bağlantı isteği yok.')).toBeVisible()
  for (const name of ['Hesap ve güvenlik', 'Erişim']) {
    expect((await page.getByRole('tab', { name, exact: true }).boundingBox())!.height).toBeGreaterThanOrEqual(44)
  }
  expect((await page.getByRole('button', { name: 'Bağlantı gönder', exact: true }).boundingBox())!.height).toBeGreaterThanOrEqual(44)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.getByRole('tab', { name: 'Erişim', exact: true }).click()
  await page.getByRole('button', { name: 'Rol ekle', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Rol ekle', exact: true })).toBeVisible()
})

test('a present password and a sent reset remain distinct, with Istanbul timestamps', async ({ page }) => {
  await setup(page, { ...emptySecurity, passwordState: 'present', passwordSetAt: '2026-09-30T19:30:00Z',
    observedAt: '2026-10-01T08:01:00Z', lastLoginAt: '2026-10-01T07:00:00Z', lastActiveAt: '2026-10-01T08:00:00Z', requests: [sent()] })
  await page.goto('/admin/auth')
  await page.getByRole('tab', { name: 'Hesap ve güvenlik' }).click()
  await expect(page.getByText('Şifre mevcut', { exact: true })).toBeVisible()
  await expect(page.getByText('Bağlantı gönderildi', { exact: true })).toBeVisible()
  await expect(page.getByText('Şifre değişimi doğrulandı', { exact: true })).toBeHidden()
  await expect(page.getByText(/30 Eyl 2026 22:30/)).toBeVisible()
  await expect(page.getByText('Son aktif', { exact: true }).locator('..').getByText('1 Eki 2026 11:00', { exact: true })).toBeVisible()
})

test('an unconfirmed request retries with the same idempotency identifier', async ({ page }) => {
  await setup(page)
  const bodies: Array<{ requestId: string; kind: string }> = []
  let latest: Record<string, unknown> | null = null
  await page.route('**/api/auth/users/*/security', route => route.fulfill({ json: { ...emptySecurity, requests: latest ? [latest] : [] } }))
  await page.route('**/api/auth/users/*/password-links', route => {
    const body = route.request().postDataJSON() as { requestId: string; kind: string }
    bodies.push(body)
    if (bodies.length === 1) return route.fulfill({ status: 503, json: { message: 'temporary' } })
    latest = { ...sent('queued'), ...body, sentAt: null, expiresAt: null }
    return route.fulfill({ status: 201, json: { requestId: body.requestId, state: 'queued' } })
  })
  await page.goto('/admin/auth')
  await page.getByRole('tab', { name: 'Hesap ve güvenlik' }).click()
  await page.getByRole('button', { name: 'Bağlantı gönder', exact: true }).click()
  await page.getByRole('button', { name: 'İsteği yeniden dene', exact: true }).click()
  await expect(page.getByText('Kuyrukta', { exact: true })).toBeVisible()
  expect(bodies).toHaveLength(2)
  expect(bodies[1]).toEqual(bodies[0])
  expect(bodies[0].requestId).toMatch(/^[0-9a-f-]{36}$/)
  await expect(page.getByRole('button', { name: 'İşleniyor', exact: true })).toBeDisabled()
  await expect(page.getByText('Şifre değişimi doğrulandı', { exact: true })).toBeHidden()
})

test('expired and unconfirmed history preserves unknown password state and disables inactive-account commands', async ({ page }) => {
  await setup(page, { ...emptySecurity, requests: [sent('unconfirmed'), { ...sent('expired'), requestId: '10000000-0000-4000-8000-000000000002' }] })
  await page.goto('/admin/auth')
  await page.getByRole('tab', { name: 'Hesap ve güvenlik' }).click()
  await expect(page.getByText('Gönderim doğrulanamadı', { exact: true })).toBeVisible()
  await expect(page.getByText('Takip süresi doldu', { exact: true })).toBeVisible()
  await page.getByLabel('Kullanıcı listesi').getByRole('button', { name: /Ece Demir/ }).click()
  await expect(page.getByRole('tab', { name: 'Erişim', exact: true })).toHaveAttribute('data-state', 'active')
  await page.getByRole('tab', { name: 'Hesap ve güvenlik' }).click()
  await expect(page.getByRole('button', { name: 'Tekrar gönder', exact: true })).toBeDisabled()
})

test('unavailable metadata offers recovery without enabling a password command', async ({ page }) => {
  await setup(page)
  let failed = true
  await page.route('**/api/auth/users/*/security', route => failed ? route.fulfill({ status: 503, json: { message: 'temporary' } }) : route.fulfill({ json: emptySecurity }))
  await page.goto('/admin/auth')
  await page.getByRole('tab', { name: 'Hesap ve güvenlik' }).click()
  await expect(page.getByRole('alert')).toContainText('Hesap bilgileri güncellenemedi')
  await expect(page.getByRole('button', { name: 'Bağlantı gönder', exact: true })).toBeHidden()
  failed = false
  await page.getByRole('button', { name: 'Yenile', exact: true }).click()
  await expect(page.getByText('Henüz doğrulanmadı', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Bağlantı gönder', exact: true })).toBeEnabled()
})

test('a limited link request reports the wait and retries explicitly with the original request identifier', async ({ page }) => {
  await page.clock.install()
  await setup(page)
  const bodies: Array<{ requestId: string; kind: string }> = []
  await page.route('**/api/auth/users/*/password-links', route => {
    const body = route.request().postDataJSON() as { requestId: string; kind: string }
    bodies.push(body)
    return route.fulfill(bodies.length === 1 ? { status: 429, headers: { 'Retry-After': '2' }, json: { message: 'Rate limit exceeded' } } : { status: 201, json: { requestId: body.requestId, state: 'queued' } })
  })
  await page.goto('/admin/auth')
  await page.getByRole('tab', { name: 'Hesap ve güvenlik' }).click()
  await page.getByRole('button', { name: 'Bağlantı gönder', exact: true }).click()
  await expect(page.locator('[data-sonner-toast]')).toContainText('Kısa sürede çok fazla işlem yapıldı.')
  await page.getByRole('button', { name: 'İsteği yeniden dene', exact: true }).click()
  expect(bodies).toHaveLength(1)
  await page.clock.fastForward(3000)
  expect(bodies).toHaveLength(1)
  await page.getByRole('button', { name: 'İsteği yeniden dene', exact: true }).click()
  await expect(page.getByText('Bağlantı isteği kuyruğa alındı.')).toBeVisible()
  expect(bodies).toHaveLength(2)
  expect(bodies[1]).toEqual(bodies[0])
})

test('pending and inactive-account handlers cannot issue duplicate password links', async ({ page }) => {
  await setup(page)
  let writes = 0
  let release = () => {}
  const held = new Promise<void>(resolve => { release = resolve })
  await page.route('**/api/auth/users/*/password-links', async route => { writes += 1; await held; await route.fulfill({ status: 201, json: { requestId: route.request().postDataJSON().requestId, state: 'queued' } }) })
  await page.goto('/admin/auth')
  await page.getByRole('tab', { name: 'Hesap ve güvenlik' }).click()
  try {
    await page.getByRole('button', { name: 'Bağlantı gönder', exact: true }).click()
    await expect.poll(() => writes).toBe(1)
    await page.getByRole('button', { name: 'İşleniyor', exact: true }).dispatchEvent('click')
    expect(writes).toBe(1)
  } finally { release() }
  await expect(page.getByText('Bağlantı isteği kuyruğa alındı.')).toBeVisible()
  await page.getByLabel('Kullanıcı listesi').getByRole('button', { name: /Ece Demir/ }).click()
  await page.getByRole('tab', { name: 'Hesap ve güvenlik' }).click()
  await page.getByRole('button', { name: 'Bağlantı gönder', exact: true }).dispatchEvent('click')
  expect(writes).toBe(1)
})
