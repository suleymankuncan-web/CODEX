import { fileURLToPath } from 'node:url'
import { expect, test, type Page } from './test-fixtures'
import { expectCommandCanvasFrame } from './fixtures/command-canvas-parity-harness'
import {
  installGenericStoreApiFallbacks,
  installStoreContractSession,
} from './store-page-contract-fixtures'

const capture = process.env.CAPTURE_COMMAND_CANVAS_EVIDENCE === '1'
const evidenceRoot = '../../docs/evidence/store-command-canvas-parity/tasks'

for (const viewport of [
  { width: 1440, height: 900, file: 'store-manager-desktop.png' },
  { width: 1024, height: 768, file: 'store-manager-compact.png' },
  { width: 390, height: 844, file: 'store-manager-mobile.png' },
  { width: 320, height: 844, file: 'store-manager-narrow.png' },
]) {
  test(`Tasks store_manager frame at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await prepare(page, 'storeManager', 'store_manager')
    await page.goto('/store/tasks')

    await expect(page.getByRole('heading', { name: 'Görevler', exact: true })).toBeVisible()
    await expect(page.locator('.command-canvas-metric')).toHaveCount(4)
    await expect(page.getByTestId('store-action-plan-row')).toHaveCount(4)
    await expect(page.locator('.tasks-command-list-head .command-canvas-sort-heading button')).toHaveCount(6)
    await expectCommandCanvasFrame(page)
    await expectNoPrototypeOrLegacyOwner(page)
    await expectNoHorizontalOverflow(page)
    await page.evaluate(async () => { await document.fonts.ready })

    if (capture) {
      await page.locator('.store-shell').screenshot({
        animations: 'disabled',
        path: evidencePath(viewport.file),
      })
    }
  })
}

for (const scenario of [
  { persona: 'regionManager' as const, view: 'region_manager' as const, file: 'region-manager-desktop.png' },
  { persona: 'reportViewer' as const, view: 'report_viewer' as const, file: 'report-viewer-desktop.png' },
]) {
  test(`Tasks ${scenario.view} result view stays read-only`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await prepare(page, scenario.persona, scenario.view)
    await page.goto('/store/tasks')

    await expect(page.getByText('Tamamlanan mağaza aksiyonlarını ve denetlenebilir sonuç geçmişini inceleyin.')).toBeVisible()
    await expect(page.getByTestId('store-action-plan-row')).toHaveCount(2)
    await page.getByTestId('store-action-plan-row').first().click()
    const drawer = page.getByRole('dialog', { name: 'Görev detayı' })
    await expect(drawer).toBeVisible()
    await expect(drawer.getByText('Mağaza müdürü notu')).toBeVisible()
    await expect(drawer.getByRole('button', { name: /İşleme al|Bloke et|Çözüm bildir|İptal et/ })).toHaveCount(0)
    await page.keyboard.press('Escape')
    await expect(drawer).toBeHidden()
    await page.getByLabel('Duruma göre filtrele').click()
    await expect(page.getByRole('option', { name: 'Açık', exact: true })).toHaveCount(0)
    await page.keyboard.press('Escape')
    await expectNoHorizontalOverflow(page)

    if (capture) {
      await page.screenshot({
        animations: 'disabled',
        path: evidencePath(scenario.file),
      })
    }
  })
}

test('Tasks audit drawer reaches every event beyond the former 100-row ceiling', async ({ page }) => {
  await prepare(page, 'storeManager', 'store_manager')
  const requestedOffsets: number[] = []
  const events = Array.from({ length: 105 }, (_, index) => ({
    eventId: `event-${index + 1}`,
    eventType: 'store_action_plan.status_updated',
    occurredAt: new Date(Date.UTC(2026, 6, 17, 12, 0, index)).toISOString(),
    actorDisplayName: `Denetim ${index + 1}`,
    actorRoleLabel: 'Mağaza Müdürü',
    note: `Sayfa ${Math.floor(index / 20) + 1}`,
  }))
  await page.unroute('**/api/store/tasks/*/events**')
  await page.route('**/api/store/tasks/*/events**', async (route) => {
    const url = new URL(route.request().url())
    const offset = Number(url.searchParams.get('offset') ?? 0)
    const limit = Number(url.searchParams.get('limit') ?? 20)
    requestedOffsets.push(offset)
    await route.fulfill({
      json: {
        data: {
          items: events.slice(offset, offset + limit),
          total: events.length,
          limit,
          offset,
        },
      },
    })
  })
  await page.goto('/store/tasks')
  await page.getByTestId('store-action-plan-row').first().click()
  const drawer = page.getByRole('dialog', { name: 'Görev detayı' })
  for (let pageIndex = 0; pageIndex < 5; pageIndex += 1) {
    await drawer.getByRole('button', { name: 'Daha fazla göster' }).click()
  }
  await expect(drawer.getByText('Denetim 105')).toBeVisible()
  await expect(drawer.getByRole('button', { name: 'Daha fazla göster' })).toHaveCount(0)
  expect(requestedOffsets).toEqual([0, 20, 40, 60, 80, 100])
})

test('Tasks drawer clears unsaved command state when selection changes', async ({ page }) => {
  await prepare(page, 'storeManager', 'store_manager')
  await page.goto('/store/tasks')
  const rows = page.getByTestId('store-action-plan-row')
  await rows.filter({ hasText: 'Vitrin düzeni takip maddesi' }).click()
  const firstDrawer = page.getByRole('dialog', { name: 'Görev detayı' })
  await firstDrawer.getByPlaceholder('Kısa not yaz').fill('Başka mağazaya taşınmamalı')
  await page.keyboard.press('Escape')
  await expect(firstDrawer).toBeHidden()
  await rows.filter({ hasText: 'UPT aksiyon planı' }).click()
  await expect(page.getByRole('dialog', { name: 'Görev detayı' }).getByPlaceholder('Kısa not yaz')).toHaveValue('')
})

test('Tasks renders unavailable source state instead of a fabricated link', async ({ page }) => {
  await prepare(page, 'storeManager', 'store_manager')
  await page.goto('/store/tasks')
  await page.getByTestId('store-action-plan-row').filter({ hasText: 'Reyon iletişim kontrolü' }).click()
  const drawer = page.getByRole('dialog', { name: 'Görev detayı' })
  await expect(drawer.getByText('Kaynak artık kullanılamıyor.')).toBeVisible()
  await expect(drawer.getByRole('link', { name: 'Kaynağı aç' })).toHaveCount(0)
})

test('Tasks mobile controls preserve readable inputs, touch rows, and sorting access', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await prepare(page, 'storeManager', 'store_manager')
  await page.goto('/store/tasks')
  const search = page.getByLabel('Görev veya mağaza ara')
  expect(await search.evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(16)
  expect((await page.getByTestId('store-action-plan-row').first().boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44)
  await page.getByLabel('Görevleri sırala').click()
  await page.getByRole('option', { name: 'Kaynağa göre' }).click()
  await expect(page.getByTestId('store-action-plan-row').first()).toContainText('Checklist')
})

for (const viewport of [
  { width: 1440, height: 900, file: 'task-drawer-desktop.png' },
  { width: 390, height: 844, file: 'task-drawer-mobile.png' },
]) {
  test(`Tasks audit drawer at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await prepare(page, 'storeManager', 'store_manager')
    await page.goto('/store/tasks')
    await page.getByTestId('store-action-plan-row').first().click()

    const drawer = page.getByRole('dialog', { name: 'Görev detayı' })
    await expect(drawer).toBeVisible()
    await expect(drawer.getByText('Denetim geçmişi')).toBeVisible()
    await expect(drawer.getByText('Mağaza Müdürü')).toBeVisible()
    await expect(drawer.getByText('Sistem')).toBeVisible()
    expect(await drawer.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true)

    if (capture) {
      await page.screenshot({
        animations: 'disabled',
        path: evidencePath(viewport.file),
      })
    }
  })
}

async function prepare(
  page: Page,
  persona: 'storeManager' | 'regionManager' | 'reportViewer',
  view: 'store_manager' | 'region_manager' | 'report_viewer',
) {
  await page.clock.setFixedTime(new Date('2026-07-17T12:00:00.000Z'))
  await installStoreContractSession(page, persona)
  await installGenericStoreApiFallbacks(page)
  await page.route('**/api/store/tasks/*/events**', async (route) => {
    await route.fulfill({
      json: {
        data: {
          items: auditEvents,
          total: auditEvents.length,
          limit: 20,
          offset: 0,
          hasMore: false,
        },
      },
    })
  })
  await page.route('**/api/store/tasks/workspace**', async (route) => {
    const visibleItems = view === 'store_manager'
      ? taskItems
      : taskItems.filter((item) => item.status === 'closed' || item.status === 'cancelled')
    await route.fulfill({
      json: {
        data: {
          view,
          capabilities: {
            canStart: view === 'store_manager',
            canUpdate: view === 'store_manager',
            canComplete: view === 'store_manager',
            canCancel: view === 'store_manager',
          },
          items: visibleItems,
          summary: {
            retained: visibleItems.length,
            actionable: visibleItems.filter((item) => ['open', 'in_progress', 'blocked'].includes(item.status)).length,
            completed: visibleItems.filter((item) => item.status === 'closed').length,
            cancelled: visibleItems.filter((item) => item.status === 'cancelled').length,
            checklist: visibleItems.filter((item) => item.source.type === 'checklist_remediation').length,
          },
          page: {
            total: visibleItems.length,
            limit: 20,
            offset: 0,
            count: visibleItems.length,
            hasMore: false,
          },
        },
      },
    })
  })
}

const auditEvents = [
  {
    eventId: 'event-created',
    eventType: 'store_action_plan.created',
    occurredAt: '2026-07-11T08:10:00.000Z',
    actorDisplayName: 'Sistem',
    actorRoleLabel: null,
    note: 'Checklist sonucu aksiyon planına dönüştürüldü.',
  },
  {
    eventId: 'event-progress',
    eventType: 'store_action_plan.status_updated',
    occurredAt: '2026-07-12T09:25:00.000Z',
    actorDisplayName: 'Seda Akın',
    actorRoleLabel: 'Mağaza Müdürü',
    note: 'Vitrin düzenlemesi işleme alındı.',
  },
]

const taskItems = [
  taskItem({
    id: 'task-open',
    title: 'Vitrin düzeni takip maddesi',
    summary: 'Yeni sezon yerleşim standardını tamamlayın.',
    store: 'Mall of İstanbul',
    status: 'open',
    priority: 'high',
    sourceType: 'checklist_remediation',
  }),
  taskItem({
    id: 'task-progress',
    title: 'UPT aksiyon planı',
    summary: 'Ekip bazlı satış ritmini takip edin.',
    store: 'İstinyePark İzmir',
    status: 'in_progress',
    priority: 'medium',
    sourceType: 'kpi_exception',
  }),
  taskItem({
    id: 'task-closed',
    title: 'Müşteri karşılama standardı',
    summary: 'Saha gözlemi tamamlandı.',
    store: 'Bursa Downtown AVM',
    status: 'closed',
    priority: 'low',
    sourceType: 'checklist_remediation',
  }),
  taskItem({
    id: 'task-cancelled',
    title: 'Reyon iletişim kontrolü',
    summary: 'Kampanya değişikliği nedeniyle kapatıldı.',
    store: 'Balıkesir 10 Burda AVM',
    status: 'cancelled',
    priority: 'medium',
    sourceType: 'kpi_exception',
    deepLink: null,
  }),
]

function taskItem(input: {
  id: string
  title: string
  summary: string
  store: string
  status: 'open' | 'in_progress' | 'closed' | 'cancelled'
  priority: 'low' | 'medium' | 'high'
  sourceType: 'checklist_remediation' | 'kpi_exception'
  deepLink?: string | null
}) {
  return {
    actionPlanId: input.id,
    storeId: `store-${input.id}`,
    storeName: input.store,
    title: input.title,
    summary: input.summary,
    priority: input.priority,
    status: input.status,
    dueOn: '2026-07-20',
    createdAt: '2026-07-11T08:10:00.000Z',
    updatedAt: '2026-07-12T09:25:00.000Z',
    completedAt: input.status === 'closed' || input.status === 'cancelled'
      ? '2026-07-14T16:30:00.000Z'
      : null,
    resultNote: input.status === 'closed' ? 'Mağaza kontrolü tamamlandı.' : null,
    source: {
      type: input.sourceType,
      id: `source-${input.id}`,
      deepLink: input.deepLink === undefined
        ? input.sourceType === 'checklist_remediation' ? '/store/checklists' : '/store/kpis'
        : input.deepLink,
    },
    events: {
      items: auditEvents,
      total: auditEvents.length,
      limit: 20,
      hasMore: false,
    },
  }
}

async function expectNoPrototypeOrLegacyOwner(page: Page) {
  await expect(page.locator('.role-switcher, .labs-bar, .tasks-prototype')).toHaveCount(0)
  await expect(page.locator('.store-tasks-workbench, .store-tasks-command-center')).toHaveCount(0)
  await expect(page.locator('[data-command-canvas-page]')).toHaveCount(1)
}

async function expectNoHorizontalOverflow(page: Page) {
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
  ).toBe(true)
}

function evidencePath(file: string) {
  return fileURLToPath(new URL(`${evidenceRoot}/${file}`, import.meta.url))
}
