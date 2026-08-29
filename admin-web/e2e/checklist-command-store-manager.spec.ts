import { expect, test, type Page } from './test-fixtures'
import { checklistEvidenceOutputPath } from './checklist-evidence-output'
import { createStoreContractSession, installGenericStoreApiFallbacks, installStoreContractSession } from './store-page-contract-fixtures'

const storeA = '11111111-1111-4111-8111-111111111111'
const storeB = '22222222-2222-4222-8222-222222222222'
const pendingInstance = '33333333-3333-4333-8333-333333333331'
const acceptedInstance = '33333333-3333-4333-8333-333333333332'
const secondSameStoreInstance = '33333333-3333-4333-8333-333333333333'

const acknowledgements = [
  acknowledgement(pendingInstance, storeA, 'Marmara Park', 'BM Mağaza Ziyareti', null, 88, '2026-07-14T10:00:00.000Z'),
  acknowledgement(acceptedInstance, storeB, 'İstinyePark İzmir', 'VM Görsel Kontrolü', {
    checklistAcknowledgementId: '44444444-4444-4444-8444-444444444441',
    acknowledgedByUserId: 'user-store-manager', acknowledgementNote: 'Kabul edildi', acknowledgedAt: '2026-07-15T10:00:00.000Z',
  }, null, '2026-07-15T09:00:00.000Z'),
  acknowledgement(secondSameStoreInstance, storeA, 'Marmara Park', 'BM Mağaza Ziyareti', {
    checklistAcknowledgementId: '44444444-4444-4444-8444-444444444442',
    acknowledgedByUserId: 'user-store-manager', acknowledgementNote: null, acknowledgedAt: '2026-07-16T10:00:00.000Z',
  }, 92, '2026-07-16T09:00:00.000Z'),
]

test.beforeEach(async ({ page }) => {
  await installStoreContractSession(page, 'storeManager')
  await installGenericStoreApiFallbacks(page)
  const session = createStoreContractSession('storeManager')
  session.user.scope.storeIds = [storeA, storeB]
  session.user.readScope.storeIds = [storeA, storeB]
  session.user.actionScope.assignedStoreIds = [storeA, storeB]
  session.user.assignedStoreIds = [storeA, storeB]
  session.scopeSummary.storeCount = 2
  session.scopeSummary.assignedStoreCount = 2
  await page.unroute('**/api/auth/session')
  await page.route('**/api/auth/session', async (route) => route.fulfill({ json: session }))
  await routeStoreManagerAcknowledgements(page)
})

test('Store Manager sees every completed checklist instance separately without starting checklist or visit flows', async ({ page }) => {
  const requests = { command: 0, today: 0, start: 0, plan: 0 }
  page.on('request', (request) => {
    const path = new URL(request.url()).pathname
    if (path === '/api/checklists/command-canvas') requests.command += 1
    if (path === '/api/mobile/checklists/today') requests.today += 1
    if (request.method() === 'POST' && path === '/api/mobile/checklists/instances') requests.start += 1
    if (path.includes('/visit-plans')) requests.plan += 1
  })

  await page.goto('/store/checklists')

  await expect(page.getByRole('heading', { name: 'Mağaza Kontrol Merkezi' })).toBeVisible()
  await expect(page.getByTestId('store-manager-checklist-instance-row')).toHaveCount(3)
  await expect(page.getByText('Marmara Park')).toHaveCount(2)
  await expect(page.getByText('Mağaza Müdürü Onayı Bekliyor')).toBeVisible()
  await expect(page.getByText('Skor yok')).toBeVisible()
  await expect.poll(() => requests).toEqual({ command: 0, today: 0, start: 0, plan: 0 })
})

test('Store Manager opens the exact pending and acknowledged checklist result', async ({ page }) => {
  await page.goto('/store/checklists')

  await page.getByRole('button', { name: 'İncele ve kabul et' }).click()
  await expect(page).toHaveURL(new RegExp(`overlay=result.*checklistInstanceId=${pendingInstance}`))
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: 'Kapat', exact: true }).click()
  await page.getByRole('button', { name: 'Checklist panelini kapat' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)

  await page.getByRole('button', { name: 'Sonucu gör' }).first().click()
  await expect(page).toHaveURL(new RegExp(`overlay=result.*checklistInstanceId=${acceptedInstance}`))
  await expect(page.getByRole('dialog')).toBeVisible()
})

test('Store Manager opens its scoped Living Store Record and returns focus on close', async ({ page }) => {
  await page.goto('/store/checklists')
  const opener = page.getByRole('button', { name: 'Mağaza kaydı' }).first()
  await opener.click()
  await expect(page.getByRole('dialog', { name: 'Marmara Park mağaza kaydı' })).toBeVisible()
  await expect(page.getByText('Denetim tamamlandı')).toBeVisible()
  await page.getByRole('button', { name: 'Mağaza kaydını kapat' }).click()
  await expect(opener).toBeFocused()
})

test('Store Manager checklist instance surface remains bounded at all acceptance viewports', async ({ page }, testInfo) => {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }, { width: 390, height: 844 }, { width: 320, height: 844 }] as const) {
    await page.setViewportSize(viewport)
    await page.goto('/store/checklists')
    await expect(page.getByRole('heading', { name: 'Mağaza Kontrol Merkezi' })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.screenshot({ path: checklistEvidenceOutputPath(testInfo, `checklist-task-workflow-consistency-v1/store-manager-${viewport.width}x${viewport.height}.png`), fullPage: true })
  }
})

test('Store Manager fails closed when acknowledgement scope is rejected', async ({ page }) => {
  await page.unroute('**/api/checklists/acknowledgements/list')
  await page.route('**/api/checklists/acknowledgements/list', async (route) => route.fulfill({ status: 403, json: { message: 'forbidden' } }))
  await page.goto('/store/checklists')
  await expect(page.getByText('Checklistler açılamadı')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Tekrar dene' })).toBeVisible()
})

async function routeStoreManagerAcknowledgements(page: Page) {
  await page.route('**/api/checklists/acknowledgements/list', async (route) => {
    const body = route.request().postDataJSON() as { checklistInstanceId?: string; limit?: number; offset?: number; status?: string }
    let items = acknowledgements
    if (body.checklistInstanceId) items = items.filter((item) => item.checklistInstanceId === body.checklistInstanceId)
    if (body.status === 'pending_acknowledgement') items = items.filter((item) => item.acknowledgement === null)
    if (body.status === 'acknowledged') items = items.filter((item) => item.acknowledgement !== null)
    const total = items.length
    const offset = body.offset ?? 0
    const limit = body.limit ?? 50
    await route.fulfill({ json: { items: items.slice(offset, offset + limit), meta: { count: Math.min(limit, total), limit, offset, total } } })
  })
  await page.route('**/api/checklists/command-canvas/stores/*/operational-history**', async (route) => {
    await route.fulfill({ json: { data: { store: { id: storeA, name: 'Marmara Park', city: null, district: null }, summary: { eventCount: 1, completedAuditCount: 1, completedVisitCount: 1, assignedTaskCount: 0, resolvedTaskCount: 0, openTaskCount: 0 }, items: [{ id: 'opaque-event', kind: 'checklist_completed', occurredAt: '2026-07-14T10:00:00.000Z', title: 'Denetim tamamlandı', detail: null, actorSnapshot: { displayName: 'Onur Kaytan', roleLabel: 'Bölge Müdürü', assignmentLabel: 'Marmara', identityStatus: 'captured' }, details: [] }], page: { nextCursor: null, hasMore: false } } } })
  })
}

function acknowledgement(
  checklistInstanceId: string,
  storeId: string,
  storeName: string,
  templateName: string,
  value: { checklistAcknowledgementId: string; acknowledgedByUserId: string; acknowledgementNote: string | null; acknowledgedAt: string } | null,
  totalScore: number | null,
  completedAt: string,
) {
  return {
    checklistInstanceId, checklistTemplateId: `template-${checklistInstanceId}`, templateName,
    templateType: templateName.startsWith('VM') ? 'VM_STORE_VISIT' : 'BM_STORE_VISIT', category: 'visit',
    storeId, storeName, completedByUserId: 'user-region-manager', completedAt, status: 'completed', totalScore,
    complianceRate: totalScore, responses: [], acknowledgement: value,
  }
}
