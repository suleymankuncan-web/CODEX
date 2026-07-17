import { fileURLToPath } from 'node:url'
import { expect, test, type Page } from './test-fixtures'
import { expectNoCriticalAxeViolations } from './axe-test-utils'
import { expectCommandCanvasFrame } from './fixtures/command-canvas-parity-harness'
import {
  installGenericStoreApiFallbacks,
  installStoreContractSession,
  regionId,
  storeIds,
} from './store-page-contract-fixtures'

const capture = process.env.CAPTURE_COMMAND_CANVAS_EVIDENCE === '1'
const evidenceRoot = '../../docs/evidence/store-command-canvas-parity/approvals'

for (const viewport of [
  { width: 1440, height: 900, file: 'region-manager-desktop.png' },
  { width: 1024, height: 768, file: 'region-manager-compact.png' },
  { width: 390, height: 844, file: 'region-manager-mobile.png' },
  { width: 320, height: 844, file: 'region-manager-narrow.png' },
]) {
  test(`Approvals region_manager frame at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await prepare(page, 'regionManager')
    await page.goto('/store/approvals')

    await expect(page.getByRole('heading', { name: 'Talep Merkezi', exact: true })).toBeVisible()
    await expect(page.locator('.command-canvas-metric')).toHaveCount(4)
    await expectStableMetricGeometry(page)
    await expect(page.locator('[data-testid="store-approvals-request-row"]:visible')).toHaveCount(2)
    await expectCommandCanvasFrame(page)
    await expectNoLegacyOwner(page)
    await expectNoHorizontalOverflow(page)
    if (viewport.width === 1440) await expectNoCriticalAxeViolations(page)
    await page.evaluate(async () => { await document.fonts.ready })

    if (capture) {
      await page.locator('.store-shell').screenshot({
        animations: 'disabled',
        path: evidencePath(viewport.file),
      })
    }
  })
}

async function expectStableMetricGeometry(page: Page) {
  const metrics = page.locator('.command-canvas-metric')
  const initial = await metrics.evaluateAll((elements) =>
    elements.map((element) => {
      const rect = element.getBoundingClientRect()
      return { width: rect.width, height: rect.height }
    }),
  )

  for (let index = 0; index < 4; index += 1) {
    await metrics.nth(index).click()
    const current = await metrics.evaluateAll((elements) =>
      elements.map((element) => {
        const rect = element.getBoundingClientRect()
        return { width: rect.width, height: rect.height }
      }),
    )
    expect(current).toEqual(initial)
  }
  await metrics.first().click()
}

test('Approvals Report Viewer remains company-scoped and read-only', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await prepare(page, 'reportViewer')
  const mutations: string[] = []
  page.on('request', (request) => {
    if (
      request.url().includes('/api/') &&
      !['GET', 'HEAD', 'OPTIONS'].includes(request.method().toUpperCase())
    ) {
      mutations.push(`${request.method()} ${new URL(request.url()).pathname}`)
    }
  })

  await page.goto('/store/approvals')
  await expect(page.getByRole('heading', { name: 'Şirket talepleri' })).toBeVisible()
  await expect(page.getByText('Mert Yalçın').first()).toBeVisible()
  await expect(page.getByText('Can Kaya').first()).toBeVisible()
  await expectNoLegacyOwner(page)
  expect(mutations).toEqual([])

  if (capture) {
    await page.locator('.store-shell').screenshot({
      animations: 'disabled',
      path: evidencePath('report-viewer-desktop.png'),
    })
  }
})

async function prepare(
  page: Page,
  persona: 'regionManager' | 'reportViewer',
) {
  await installStoreContractSession(page, persona)
  await installGenericStoreApiFallbacks(page)
  await page.route('**/api/workflow/request-center**', async (route) => {
    const url = new URL(route.request().url())
    const type = url.searchParams.get('type') ?? 'all'
    const bucket = url.searchParams.get('bucket') ?? 'open'
    const status = url.searchParams.get('status') ?? 'all'
    const items = requestItems().filter((item) => {
      if (type !== 'all' && item.requestType !== type) return false
      if (bucket === 'done' && item.status !== 'approved') return false
      if (bucket === 'open' && item.status === 'approved') return false
      if (status === 'pending' && ['approved', 'rejected'].includes(item.status)) return false
      if (status === 'returned' && item.status !== 'rejected') return false
      if (status === 'approved' && item.status !== 'approved') return false
      return true
    })
    await route.fulfill({
      json: {
        items,
        meta: { count: items.length, total: items.length, limit: 15, offset: 0 },
        summary: { open: 2, done: 0, returned: 1, overdue: 1, periods: ['2026-07'] },
      },
    })
  })
}

function requestItems() {
  return [
    {
      requestId: 'request-target-1',
      requestType: 'target',
      storeId: storeIds[0],
      storeName: 'Mall of İstanbul',
      regionId,
      regionName: 'Marmara',
      regionManagerNames: ['Mert Yalçın'],
      status: 'pending_region_approval',
      createdAt: '2026-07-10T09:00:00.000Z',
      updatedAt: '2026-07-12T09:00:00.000Z',
      waitingSince: '2026-07-10T09:00:00.000Z',
      nextOwner: 'region',
      dueAt: '2026-07-12T09:00:00.000Z',
      isOverdue: true,
      events: [{
        eventId: 'event-target-1',
        type: 'created',
        occurredAt: '2026-07-10T09:00:00.000Z',
        actorDisplayName: 'Mağaza Müdürü',
      }],
      eventTotal: 1,
      targetLabel: 'Temmuz hedefi',
      requestMonth: '2026-07-01',
      allocationCount: 4,
      approvalMode: null,
      personDisplayName: null,
      nationalIdLast4: null,
      externalEmployeeRef: null,
    },
    {
      requestId: 'request-offboarding-1',
      requestType: 'offboarding',
      storeId: storeIds[1],
      storeName: 'Bursa Downtown AVM',
      regionId: '00000000-0000-0000-0000-000000000020',
      regionName: 'Güney Marmara',
      regionManagerNames: ['Can Kaya'],
      status: 'rejected',
      createdAt: '2026-07-11T09:00:00.000Z',
      updatedAt: '2026-07-13T09:00:00.000Z',
      waitingSince: '2026-07-13T09:00:00.000Z',
      nextOwner: 'store',
      dueAt: null,
      isOverdue: false,
      events: [{
        eventId: 'event-offboarding-1',
        type: 'returned',
        occurredAt: '2026-07-13T09:00:00.000Z',
        actorDisplayName: 'İK',
      }],
      eventTotal: 1,
      targetLabel: null,
      requestMonth: null,
      allocationCount: null,
      approvalMode: null,
      personDisplayName: 'Örnek Personel',
      nationalIdLast4: null,
      externalEmployeeRef: 'EMP-SAFE',
    },
  ]
}

async function expectNoLegacyOwner(page: Page) {
  await expect(page.locator(
    '.store-approvals-workbench, .store-approvals-ledger-grid, .store-approvals-ledger-table, .store-approvals-action-workbench, .role-switcher, .labs-bar',
  )).toHaveCount(0)
}

async function expectNoHorizontalOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true)
}

function evidencePath(file: string) {
  return fileURLToPath(new URL(`${evidenceRoot}/${file}`, import.meta.url))
}
