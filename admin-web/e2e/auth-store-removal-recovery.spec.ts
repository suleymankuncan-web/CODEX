import { expect, test, type Page } from './test-fixtures'
import { routeAuthManagementApi, emptyList, lookupsFixture } from './auth-management-test-fixtures'

const store = (id: string, userId = 'user-active') => ({
  assignmentId: id, userId, username: 'region.manager', email: 'synthetic@example.com',
  storeId: `store-${id}`, storeCode: id, storeName: `Synthetic Store ${id}`,
  companyId: 'company-1', regionId: 'region-1', regionName: 'Marmara',
  startAt: '2026-08-01T00:00:00Z', endAt: null, createdAt: '2026-08-01T00:00:00Z',
})
const list = (items: ReturnType<typeof store>[]) => ({ items, meta: { count: items.length, total: items.length, limit: 200, offset: 0 } })
const storeBlock = (page: Page) => page.getByText('Mağaza erişimi', { exact: true }).locator('..').locator('..')
const row = (page: Page, id: string) => storeBlock(page).getByText(`Synthetic Store ${id}`, { exact: true }).locator('..').locator('..')

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('store-ops-admin-session', JSON.stringify({
    mode: 'mock', mockUserId: 'super-admin-auth-user', mockRoleCodes: 'SUPER_ADMIN,HR_ADMIN',
    mockCompanyIds: '10000000-0000-4000-8000-000000000001', bearerToken: '',
  })))
  await routeAuthManagementApi(page)
  await page.route('**/api/auth/role-assignments?**', route => route.fulfill({ json: {
    items: [{ assignmentId: 'synthetic-region-role', userId: 'user-active', roleCode: 'REGION_MANAGER',
      scopeType: 'company', companyId: 'company-1', regionId: null, storeId: null, effectiveFrom: null, effectiveTo: null }],
    meta: { count: 1, total: 1, limit: 100, offset: 0 },
  } }))
})

test('rapid store removals serialize writes and refresh only the affected store list', async ({ page }) => {
  let items = [store('one'), store('two')]
  let gets = 0
  const writes: string[] = []
  const otherReads: string[] = []
  page.on('request', request => {
    const url = new URL(request.url())
    if (request.method() === 'GET' && url.pathname.startsWith('/api/auth/') && !url.pathname.endsWith('/action-store-assignments')) otherReads.push(url.pathname)
  })
  await page.route('**/api/auth/action-store-assignments?**', route => { gets += 1; return route.fulfill({ json: list(items) }) })
  let release = () => {}
  const held = new Promise<void>(resolve => { release = resolve })
  await page.route('**/api/auth/action-store-assignments/*/deactivate', async route => {
    const id = new URL(route.request().url()).pathname.split('/').at(-2)!
    writes.push(id)
    if (id === 'one') await held
    items = items.filter(item => item.assignmentId !== id)
    await route.fulfill({ json: { command: { status: 'updated', message: 'Updated' }, data: { assignment: { ...store(id), endAt: '2026-10-02T00:00:00Z' } } } })
  })
  await page.goto('/admin/auth')
  await expect(storeBlock(page).getByRole('button', { name: 'Mağaza ekle' })).toBeEnabled()
  await expect(page.getByText('Bölge müdürü', { exact: true })).toBeVisible()
  const before = [...otherReads]
  try {
    await row(page, 'one').getByRole('button', { name: 'Kaldır', exact: true }).click()
    await expect.poll(() => writes.length).toBe(1)
    await expect(row(page, 'one').getByRole('button', { name: 'Kaldırılıyor' })).toBeDisabled()
    await expect(row(page, 'two').getByRole('button', { name: 'Kaldır' })).toBeDisabled()
    await expect(storeBlock(page).getByRole('button', { name: 'Mağaza ekle' })).toBeDisabled()
    await row(page, 'one').getByRole('button').dispatchEvent('click')
    await row(page, 'two').getByRole('button').dispatchEvent('click')
    expect(writes).toEqual(['one'])
  } finally { release() }
  await expect(row(page, 'one')).toHaveCount(0)
  await expect(row(page, 'two').getByRole('button')).toBeEnabled()
  expect(gets).toBe(2)
  expect(otherReads).toEqual(before)
  await row(page, 'two').getByRole('button').click()
  await expect(storeBlock(page).getByText('Doğrudan mağaza erişimi yok')).toBeVisible()
  expect(writes).toEqual(['one', 'two'])
  expect(gets).toBe(3)
  expect(otherReads).toEqual(before)
})

test('an in-flight removal refreshes its original user after the selection changes', async ({ page }) => {
  const reads: string[] = []
  let removed = false
  let started = false
  let release = () => {}
  const held = new Promise<void>(resolve => { release = resolve })
  await page.route('**/api/auth/action-store-assignments?**', route => {
    const user = new URL(route.request().url()).searchParams.get('userId')!
    reads.push(user)
    return route.fulfill({ json: list(user === 'user-active' ? (removed ? [] : [store('one')]) : [store('other', user)]) })
  })
  await page.route('**/api/auth/action-store-assignments/one/deactivate', async route => {
    started = true
    await held
    removed = true
    await route.fulfill({ json: { command: { status: 'updated', message: 'Updated' }, data: { assignment: store('one') } } })
  })
  await page.goto('/admin/auth')
  try {
    await row(page, 'one').getByRole('button').click()
    await expect.poll(() => started).toBe(true)
    await page.getByLabel('Kullanıcı listesi').getByRole('button', { name: /Ece Demir/ }).click()
    await expect(row(page, 'other')).toBeVisible()
  } finally { release() }
  await expect(storeBlock(page).getByRole('button', { name: 'Mağaza ekle' })).toBeEnabled()
  expect(reads.filter(user => user === 'user-inactive')).toHaveLength(1)
  await page.getByLabel('Kullanıcı listesi').getByRole('button', { name: /Ada Yılmaz/ }).click()
  await expect(storeBlock(page).getByText('Doğrudan mağaza erişimi yok')).toBeVisible()
  expect(reads.filter(user => user === 'user-active')).toHaveLength(2)
})

test('twenty consecutive removals stay within one write and one list read per action', async ({ page }) => {
  let items = Array.from({ length: 20 }, (_, index) => store(String(index + 1)))
  let gets = 0
  let writes = 0
  const otherReads: string[] = []
  page.on('request', request => {
    const url = new URL(request.url())
    if (request.method() === 'GET' && url.pathname.startsWith('/api/auth/') && !url.pathname.endsWith('/action-store-assignments')) otherReads.push(url.pathname)
  })
  await page.route('**/api/auth/action-store-assignments?**', route => { gets += 1; return route.fulfill({ json: list(items) }) })
  await page.route('**/api/auth/action-store-assignments/*/deactivate', route => {
    const id = new URL(route.request().url()).pathname.split('/').at(-2)!
    writes += 1
    items = items.filter(item => item.assignmentId !== id)
    return route.fulfill({ json: { command: { status: 'updated', message: 'Updated' }, data: { assignment: { ...store(id), endAt: '2026-10-02T00:00:00Z' } } } })
  })
  await page.goto('/admin/auth')
  await expect(storeBlock(page).getByRole('button', { name: 'Mağaza ekle' })).toBeEnabled()
  await expect(page.getByText('Bölge müdürü', { exact: true })).toBeVisible()
  const before = [...otherReads]
  for (let index = 1; index <= 20; index += 1) {
    await row(page, String(index)).getByRole('button', { name: 'Kaldır', exact: true }).click()
    await expect(row(page, String(index))).toHaveCount(0)
    await expect(storeBlock(page).getByRole('button', { name: 'Mağaza ekle' })).toBeEnabled()
  }
  await expect(storeBlock(page).getByText('Doğrudan mağaza erişimi yok')).toBeVisible()
  expect(writes).toBe(20)
  expect(gets).toBe(21)
  expect(otherReads).toEqual(before)
  await expect(page).toHaveURL(/\/admin\/auth$/)
})

test('a limited removal keeps the store and allows an explicit retry without replay', async ({ page }) => {
  await page.clock.install()
  let gets = 0
  let writes = 0
  let removed = false
  await page.route('**/api/auth/action-store-assignments?**', route => { gets += 1; return route.fulfill({ json: removed ? emptyList : list([store('one')]) }) })
  await page.route('**/api/auth/action-store-assignments/one/deactivate', route => {
    writes += 1
    if (writes === 1) return route.fulfill({ status: 429, headers: { 'Retry-After': '2' }, json: { message: 'Rate limit exceeded' } })
    removed = true
    return route.fulfill({ json: { command: { status: 'updated', message: 'Updated' }, data: { assignment: store('one') } } })
  })
  await page.goto('/admin/auth')
  await row(page, 'one').getByRole('button').click()
  await expect(page.locator('[data-sonner-toast]')).toContainText('Kısa sürede çok fazla işlem yapıldı.')
  await expect(row(page, 'one').getByRole('button')).toBeEnabled()
  await row(page, 'one').getByRole('button').click()
  expect(writes).toBe(1)
  expect(gets).toBe(1)
  await page.clock.fastForward(3000)
  expect(writes).toBe(1)
  await row(page, 'one').getByRole('button').click()
  await expect(storeBlock(page).getByText('Doğrudan mağaza erişimi yok')).toBeVisible()
  expect(writes).toBe(2)
  expect(gets).toBe(2)
  await expect(page).toHaveURL(/\/admin\/auth$/)
})

test('a limited list refresh reports the cooldown and retries only the read', async ({ page }) => {
  await page.clock.install()
  let gets = 0
  let writes = 0
  await page.route('**/api/auth/action-store-assignments?**', route => {
    gets += 1
    if (gets === 1) return route.fulfill({ json: list([store('one')]) })
    if (gets === 2) return route.fulfill({ status: 429, headers: { 'Retry-After': '2' }, json: { message: 'Rate limit exceeded' } })
    return route.fulfill({ json: emptyList })
  })
  await page.route('**/api/auth/action-store-assignments/one/deactivate', route => { writes += 1; return route.fulfill({ json: { command: { status: 'updated', message: 'Updated' }, data: { assignment: store('one') } } }) })
  await page.goto('/admin/auth')
  await row(page, 'one').getByRole('button').click()
  await expect(storeBlock(page).getByRole('alert')).toContainText('Kısa sürede çok fazla işlem yapıldı.')
  expect(gets).toBe(2)
  await page.clock.fastForward(3000)
  expect(gets).toBe(2)
  await storeBlock(page).getByRole('button', { name: 'Yeniden dene' }).click()
  await expect(storeBlock(page).getByText('Doğrudan mağaza erişimi yok')).toBeVisible()
  expect(gets).toBe(3)
  expect(writes).toBe(1)
})

for (const failure of ['limited', 'indeterminate'] as const) {
  test(`a ${failure} batch preserves access data and retries only unassigned stores`, async ({ page }) => {
    await page.clock.install()
    let items = [store('one')]
    let gets = 0
    const bodies: Array<{ userId: string; storeIds: string[] }> = []
    await page.route('**/api/auth/lookups', route => route.fulfill({ json: { ...lookupsFixture, stores: ['one', 'two', 'three'].map(id => ({ storeId: `store-${id}`, storeCode: id, storeName: `Synthetic Store ${id}`, companyId: 'company-1', regionId: 'region-1', regionName: 'Marmara' })) } }))
    await page.route('**/api/auth/action-store-assignments?**', route => { gets += 1; return route.fulfill({ json: list(items) }) })
    await page.route('**/api/auth/action-store-assignments/batch', route => {
      bodies.push(route.request().postDataJSON())
      if (bodies.length === 1) {
        if (failure === 'limited') return route.fulfill({ status: 429, headers: { 'Retry-After': '2' }, json: { message: 'Rate limit exceeded' } })
        items.push(store('two'))
        return route.abort('failed')
      }
      items = ['one', 'two', 'three'].map(id => store(id))
      return route.fulfill({ json: { command: { status: 'created', message: 'Created' } } })
    })
    await page.goto('/admin/auth')
    await storeBlock(page).getByRole('button', { name: 'Mağaza ekle' }).click()
    const dialog = page.getByRole('dialog', { name: 'Mağaza erişimi ekle' })
    const choices = dialog.getByLabel('Mağaza seçim listesi')
    await choices.getByRole('button', { name: /Synthetic Store two/ }).click()
    await choices.getByRole('button', { name: /Synthetic Store three/ }).click()
    await dialog.getByRole('button', { name: 'Seçilenlere erişim ver' }).click()
    await expect(page.locator('[data-sonner-toast]')).toContainText(failure === 'limited' ? 'Kısa sürede çok fazla işlem yapıldı.' : 'Sunucuya bağlanılamadı. Bağlantınızı kontrol edip tekrar deneyin.')
    await expect(storeBlock(page).getByRole('alert')).toHaveCount(0)
    if (failure === 'limited') {
      expect(gets).toBe(1)
      await page.clock.fastForward(3000)
    } else {
      await expect(choices.getByRole('button', { name: /Synthetic Store two/ })).toBeDisabled()
      expect(gets).toBe(2)
      await expect(dialog.getByText('1 mağaza seçildi')).toBeVisible()
    }
    expect(bodies).toHaveLength(1)
    await dialog.getByRole('button', { name: 'Seçilenlere erişim ver' }).click()
    await expect(dialog).toHaveCount(0)
    expect(bodies[1]).toEqual({ userId: 'user-active', storeIds: failure === 'limited' ? ['store-two', 'store-three'] : ['store-three'] })
    await expect(row(page, 'three')).toBeVisible()
  })
}

test('a lost removal response refreshes the accepted result without a duplicate write', async ({ page }) => {
  let removed = false
  let gets = 0
  let writes = 0
  await page.route('**/api/auth/action-store-assignments?**', route => { gets += 1; return route.fulfill({ json: removed ? emptyList : list([store('one')]) }) })
  await page.route('**/api/auth/action-store-assignments/one/deactivate', route => { writes += 1; removed = true; return route.abort('failed') })
  await page.goto('/admin/auth')
  await row(page, 'one').getByRole('button').click()
  await expect(storeBlock(page).getByText('Doğrudan mağaza erişimi yok')).toBeVisible()
  expect(writes).toBe(1)
  expect(gets).toBe(2)
})

test('role removal also blocks duplicate writes while preserving required role refreshes', async ({ page }) => {
  let writes = 0
  let release = () => {}
  const held = new Promise<void>(resolve => { release = resolve })
  await page.route('**/api/auth/role-assignments/synthetic-region-role/deactivate', async route => { writes += 1; await held; await route.fulfill({ json: { command: { status: 'updated', message: 'Updated' } } }) })
  await page.goto('/admin/auth')
  const block = page.getByText('Roller', { exact: true }).locator('..').locator('..')
  try {
    await block.getByRole('button', { name: 'Kaldır', exact: true }).click()
    await expect.poll(() => writes).toBe(1)
    await expect(block.getByRole('button', { name: 'Kaldırılıyor' })).toBeDisabled()
    await expect(block.getByRole('button', { name: 'Rol ekle' })).toBeDisabled()
    await block.getByRole('button', { name: 'Kaldırılıyor' }).dispatchEvent('click')
    expect(writes).toBe(1)
  } finally { release() }
  await expect(page.getByText('Rol ataması kaldırıldı.', { exact: true })).toBeVisible()
  expect(writes).toBe(1)
})
