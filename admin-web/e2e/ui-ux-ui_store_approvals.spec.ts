import { expect, test, type Page } from './test-fixtures'
import {
  installGenericStoreApiFallbacks,
  installStoreContractSession,
  regionId,
  storeIds,
} from './store-page-contract-fixtures'
import type { RequestCenterItem } from '../src/features/store-approvals/request-center-api'

test('request header sorts retain their labels and ordering in the sort filter', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await prepare(page, 'regionManager')
  await page.goto('/store/approvals')

  const table = page.locator('.approvals-command-desktop table')
  const rows = page.locator('[data-testid="store-approvals-request-row"]:visible')
  const sort = page.getByRole('combobox', { name: 'Son güncellenen', exact: true })
  await expect(rows).toHaveCount(2)

  await table.getByRole('button', { name: 'Mağaza', exact: true }).click()
  await expect(sort).toHaveText('Mağaza Z-A')
  await expect(rows.first()).toContainText('Mall of İstanbul')
  await table.getByRole('button', { name: 'Mağaza', exact: true }).click()
  await expect(sort).toHaveText('Mağaza A-Z')
  await expect(rows.first()).toContainText('Bursa Downtown AVM')

  await table.getByRole('button', { name: 'Talep', exact: true }).click()
  await expect(sort).toHaveText('Talep tipi (azalan)')
  await expect(rows.first()).toContainText('Temmuz hedefi')
  await table.getByRole('button', { name: 'Talep', exact: true }).click()
  await expect(sort).toHaveText('Talep tipi')
  await expect(rows.first()).toContainText('Örnek Personel')

  await table.getByRole('button', { name: 'Bekleme', exact: true }).click()
  await expect(sort).toHaveText('En uzun bekleyen')
  await expect(rows.first()).toContainText('Temmuz hedefi')
  await table.getByRole('button', { name: 'Bekleme', exact: true }).click()
  await expect(sort).toHaveText('En kısa bekleyen')
  await expect(rows.first()).toContainText('Örnek Personel')

  await page.setViewportSize({ width: 390, height: 844 })
  await expect(sort).toHaveText('En kısa bekleyen')
  await expect(rows.first()).toContainText('Örnek Personel')
  await sort.click()
  await page.getByRole('option', { name: 'Mağaza Z-A', exact: true }).click()
  await expect(sort).toHaveText('Mağaza Z-A')
  await expect(rows.first()).toContainText('Mall of İstanbul')
})

test('request manager directory exposes failure and retry while fallback entries remain usable', async ({ page }) => {
  await prepare(page, 'reportViewer')
  let directoryAvailable = false
  await page.route('**/api/org/region-managers', route => directoryAvailable
    ? route.fulfill({ json: { items: managerItems } })
    : route.fulfill({ status: 503, json: { message: 'Bölge müdürleri yüklenemedi.' } }))
  await page.goto('/store/approvals')

  const directory = page.getByRole('complementary', { name: 'Bölge müdürleri' })
  const rows = page.locator('[data-testid="store-approvals-request-row"]:visible')
  await expect(rows).toHaveCount(2)
  await expect(directory.getByText('Mert Yalçın', { exact: true })).toBeVisible()
  await expect(directory.getByText('Can Kaya', { exact: true })).toBeVisible()
  await expect(directory.getByRole('alert')).toContainText('Bölge müdürleri yüklenemedi.')
  await directory.getByRole('button', { name: /Mert Yalçın/ }).click()
  await expect(rows).toHaveCount(1)

  directoryAvailable = true
  await directory.getByRole('button', { name: 'Tekrar dene', exact: true }).click()
  await expect(directory.getByRole('alert')).toHaveCount(0)
  await expect(directory.getByText('Derya Akın', { exact: true })).toBeVisible()
  await expect(directory.getByRole('button', { name: /Tüm mağazalar/ })).toHaveAttribute('aria-current', 'true')
  await expect(rows).toHaveCount(2)
  await directory.getByText('Derya Akın', { exact: true }).click()
  await expect(page.getByText('Bu görünümde talep yok', { exact: true })).toBeVisible()
})

test('request manager directory recovers its page when refreshed entries shrink', async ({ page }) => {
  await prepare(page, 'reportViewer')
  let directoryAvailable = false
  await page.route('**/api/org/region-managers', route => directoryAvailable
    ? route.fulfill({ json: { items: managerItems } })
    : route.fulfill({ status: 503, json: { message: 'Bölge müdürleri yüklenemedi.' } }))
  const items = Array.from({ length: 44 }, (_, index) => ({
    ...requestItems()[0],
    requestId: `directory-request-${index}`,
    regionManagerNames: [`Müdür ${String(index + 1).padStart(2, '0')}`],
  }))
  await page.route('**/api/workflow/request-center**', route => {
    const rows = new URL(route.request().url()).searchParams.get('bucket') === 'done' ? [] : items
    return route.fulfill({ json: {
      items: rows, meta: { count: rows.length, total: rows.length, limit: 200, offset: 0 },
      summary: { open: items.length, done: 0, returned: 0, overdue: items.length, periods: ['2026-07'] },
    } })
  })
  await page.goto('/store/approvals')
  const directory = page.getByRole('complementary', { name: 'Bölge müdürleri' })
  await expect(directory.getByRole('alert')).toBeVisible()
  await directory.getByRole('button', { name: 'Sonraki bölge müdürü sayfası' }).click()
  await expect(directory.getByText('Müdür 21', { exact: true })).toBeVisible()
  directoryAvailable = true
  await directory.getByRole('button', { name: 'Tekrar dene', exact: true }).click()
  await expect(directory.getByText('Mert Yalçın', { exact: true })).toBeVisible()
  await expect(directory.getByRole('button', { name: 'Önceki bölge müdürü sayfası' })).toBeDisabled()
  await expect(directory.getByRole('button', { name: 'Sonraki bölge müdürü sayfası' })).toBeDisabled()
})

const managerItems = [
  { userId: 'manager-one', displayName: 'Mert Yalçın', storeIds: [storeIds[0]] },
  { userId: 'manager-two', displayName: 'Can Kaya', storeIds: [storeIds[1]] },
  { userId: 'manager-without-requests', displayName: 'Derya Akın', storeIds: [] },
]

async function prepare(page: Page, persona: 'regionManager' | 'reportViewer') {
  await installStoreContractSession(page, persona)
  await installGenericStoreApiFallbacks(page)
  await page.route('**/api/org/region-managers', route => route.fulfill({ json: { items: managerItems } }))
  await page.route('**/api/workflow/request-center**', route => {
    const bucket = new URL(route.request().url()).searchParams.get('bucket')
    const items = bucket === 'done' ? [] : requestItems()
    return route.fulfill({ json: {
      items,
      meta: { count: items.length, total: items.length, limit: 200, offset: 0 },
      summary: { open: 2, done: 0, returned: 1, overdue: 1, periods: ['2026-07'] },
    } })
  })
}

function requestItems(): RequestCenterItem[] {
  const common = {
    regionId,
    regionName: 'Marmara',
    createdAt: '2026-07-10T09:00:00.000Z',
    eventTotal: 1,
    approvalMode: null,
    nationalIdLast4: null,
  }
  return [
    {
      ...common,
      requestId: 'request-target-sort',
      requestType: 'target',
      storeId: storeIds[0],
      storeName: 'Mall of İstanbul',
      regionManagerNames: ['Mert Yalçın'],
      status: 'pending_region_approval',
      updatedAt: '2026-07-12T09:00:00.000Z',
      waitingSince: '2026-07-10T09:00:00.000Z',
      nextOwner: 'region',
      dueAt: '2026-07-12T09:00:00.000Z',
      isOverdue: true,
      events: [{ eventId: 'event-target-sort', type: 'created', occurredAt: '2026-07-10T09:00:00.000Z', actorDisplayName: 'Mağaza Müdürü' }],
      targetLabel: 'Temmuz hedefi',
      requestMonth: '2026-07-01',
      allocationCount: 4,
      personDisplayName: null,
      externalEmployeeRef: null,
    },
    {
      ...common,
      requestId: 'request-offboarding-sort',
      requestType: 'offboarding',
      storeId: storeIds[1],
      storeName: 'Bursa Downtown AVM',
      regionManagerNames: ['Can Kaya'],
      status: 'rejected',
      updatedAt: '2026-07-13T09:00:00.000Z',
      waitingSince: '2026-07-13T09:00:00.000Z',
      nextOwner: 'store',
      dueAt: null,
      isOverdue: false,
      events: [{ eventId: 'event-offboarding-sort', type: 'returned', occurredAt: '2026-07-13T09:00:00.000Z', actorDisplayName: 'İK' }],
      targetLabel: null,
      requestMonth: null,
      allocationCount: null,
      personDisplayName: 'Örnek Personel',
      externalEmployeeRef: 'EMP-SAFE',
    },
  ]
}
