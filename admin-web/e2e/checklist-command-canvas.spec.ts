import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test, type Page } from './test-fixtures'
import { installStoreContractSession } from './store-page-contract-fixtures'

const checklistCommandEvidenceDir = fileURLToPath(
  new URL('../../docs/evidence/checklist-command-canvas-visits-parity-v1-2026-07-14/', import.meta.url),
)

test('region manager command canvas reads bounded real rows and applies server controls', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await installStoreContractSession(page, 'regionManager')
  const requests: URL[] = []
  await routeChecklistCommand(page, requests)

  await page.goto('/store/checklists')

  await expect(page.getByRole('heading', { name: 'Saha Kontrolleri' })).toBeVisible()
  const parityGeometry = await page.locator('.checklist-command-parity').evaluate((root) => {
    const surface = root.querySelector<HTMLElement>('[data-testid="checklist-command-surface"]')
    const metricRail = root.querySelector<HTMLElement>('[data-testid="checklist-command-metrics"]')
    const row = root.querySelector<HTMLElement>('[data-testid="checklist-command-row"]')
    if (!surface || !metricRail || !row) throw new Error('missing parity surface')
    return {
      rootRect: root.getBoundingClientRect().toJSON(),
      metricRect: metricRail.getBoundingClientRect().toJSON(),
      surfaceRect: surface.getBoundingClientRect().toJSON(),
      fontFamily: getComputedStyle(root).fontFamily,
      maxWidth: getComputedStyle(root).maxWidth,
      surfaceRadius: getComputedStyle(surface).borderRadius,
      metricRadius: getComputedStyle(metricRail).borderRadius,
      rowMinHeight: getComputedStyle(row).minHeight,
    }
  })
  expect(parityGeometry).toMatchObject({
    fontFamily: expect.stringContaining('DM Sans'),
    maxWidth: '1065px',
    surfaceRadius: '15px',
    metricRadius: '15px',
    rowMinHeight: '64px',
  })
  expect(parityGeometry.rootRect.width).toBeCloseTo(1065, 0)
  expect(parityGeometry.metricRect.y - parityGeometry.rootRect.y).toBeCloseTo(94, 0)
  await expect(page.getByText('Marmara Park').first()).toBeVisible()
  await expect(page.getByText('92').first()).toBeVisible()
  await expect(page.getByText('Yapılmadı').first()).toBeVisible()
  await expect(page.getByText('4 gün').first()).toBeVisible()

  await page.getByRole('button', { name: /Bu ay eksik/ }).click()
  await expect.poll(() => requests.some((url) => url.searchParams.get('status') === 'needs_visit')).toBe(true)

  await page.getByRole('button', { name: 'Durum', exact: true }).click()
  await expect.poll(() => requests.some((url) => url.searchParams.get('sort') === 'status_asc')).toBe(true)

  await page.getByRole('button', { name: /Kolonlar/ }).click()
  await expect(page.getByRole('menu', { name: /Kolon/ })).toBeVisible()
  await page.getByRole('menuitemradio', { name: /Skorlar/ }).click()
  await expect(page.getByRole('button', { name: /Kolonlar Skorlar/ })).toBeVisible()
  await expect(page.getByText('ZİYARET', { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: /Kolonlar/ }).click()
  await page.getByRole('heading', { name: 'Saha Kontrolleri' }).click()
  await expect(page.getByRole('menu', { name: /Kolon/ })).toHaveCount(0)

  await page.getByRole('button', { name: /Temmuz 2026/ }).click()
  await expect(page.getByRole('dialog', { name: /Raporlama dönemi/ })).toBeVisible()
  await page.getByRole('button', { name: 'Ağustos' }).click()
  await page.getByRole('button', { name: /Uygula/ }).click()
  await expect.poll(() => requests.some((url) => url.searchParams.get('period') === '2026-08')).toBe(true)
  await page.getByRole('button', { name: /Ağustos 2026/ }).click()
  await page.getByRole('heading', { name: 'Saha Kontrolleri' }).click()
  await expect(page.getByRole('dialog', { name: /Raporlama dönemi/ })).toHaveCount(0)

  mkdirSync(checklistCommandEvidenceDir, { recursive: true })
  await page.screenshot({
    path: join(checklistCommandEvidenceDir, 'region-manager-command-canvas-desktop.png'),
    fullPage: true,
  })

  await page.getByRole('button', { name: /Checklist/ }).first().click()
  await expect(page).toHaveURL(
    /\/store\/checklists\?view=workflow&storeId=11111111-1111-4111-8111-111111111111/,
  )
})

test('region manager command canvas stays bounded as mobile cards with 30-row pages', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await installStoreContractSession(page, 'regionManager')
  await routeChecklistCommand(page, [])

  await page.goto('/store/checklists')

  await expect(page.getByRole('heading', { name: 'Saha Kontrolleri' })).toBeVisible()
  await expect(page.getByRole('article')).toHaveCount(2)
  await expect(page.getByText('1-2 / 2 mağaza')).toBeVisible()
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(1)

  mkdirSync(checklistCommandEvidenceDir, { recursive: true })
  await page.screenshot({
    path: join(checklistCommandEvidenceDir, 'region-manager-command-canvas-mobile-390.png'),
    fullPage: true,
  })
})

test('region manager plans a full Monday-Saturday week and saves one real API snapshot', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await installStoreContractSession(page, 'regionManager')
  const requests: URL[] = []
  const savedBodies: unknown[] = []
  await routeChecklistCommand(page, requests, savedBodies)

  await page.goto('/store/checklists')
  await page.getByRole('button', { name: /Ziyaret Planı/ }).click()

  await expect(page.getByRole('heading', { name: 'Saha Kontrolleri' })).toBeVisible()
  await expect(page.getByText('Ziyaret Tamamlandı')).toBeVisible()
  await expect(page.getByText('Ziyaret Bekleniyor')).toBeVisible()
  await expect(page.getByText('Checklist yapılmadı').first()).toBeVisible()
  await expect(page.getByText('Pazar plan dışı')).toBeVisible()

  await page.getByRole('button', { name: 'Haftayı Planla' }).click()
  const dialog = page.getByRole('dialog', { name: 'Ziyaret planını oluşturun' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByText('Plan kapsamı')).toBeVisible()
  await expect(dialog.getByText('Sorumlu')).toHaveCount(0)

  await dialog.getByRole('button', { name: 'Pazartesi, 13 Tem' }).click()
  await dialog.getByRole('button', { name: /Marmara Park mağazasını/ }).click()
  await expect(dialog.getByText('Marmara Park')).toHaveCount(3)
  await dialog.getByRole('button', { name: /Ziyaret Planını Kaydet/ }).click()

  await expect(dialog).toHaveCount(0)
  await expect.poll(() => savedBodies.length).toBe(1)
  expect(savedBodies[0]).toMatchObject({
    expectedRevision: 3,
    items: expect.arrayContaining([
      expect.objectContaining({ storeId: '11111111-1111-4111-8111-111111111111', plannedDate: '2026-07-13' }),
      expect.objectContaining({ storeId: '11111111-1111-4111-8111-111111111111', plannedDate: '2026-07-15' }),
    ]),
  })
})

test('weekly planner keeps 35 scoped stores and the save action reachable on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await installStoreContractSession(page, 'regionManager')
  await routeChecklistCommand(page, [])

  await page.goto('/store/checklists')
  await page.getByRole('button', { name: /Ziyaret Planı/ }).click()
  await page.getByRole('button', { name: 'Haftayı Planla' }).click()

  const dialog = page.getByRole('dialog', { name: 'Ziyaret planını oluşturun' })
  await expect(dialog.locator('.week-plan-result-row')).toHaveCount(35)
  await expect(dialog.getByRole('button', { name: 'Ziyaret Planını Kaydet' })).toBeVisible()
  const geometry = await dialog.evaluate((element) => ({
    bottom: element.getBoundingClientRect().bottom,
    width: element.getBoundingClientRect().width,
    viewportWidth: document.documentElement.clientWidth,
    pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }))
  expect(geometry.width).toBeCloseTo(390, 0)
  expect(geometry.bottom).toBeCloseTo(844, 0)
  expect(geometry.pageOverflow).toBeLessThanOrEqual(1)
})

for (const viewport of [
  { width: 1024, height: 768, evidence: 'region-manager-command-canvas-tablet-1024.png' },
  { width: 320, height: 720, evidence: 'region-manager-command-canvas-mobile-320.png' },
] as const) {
  test(`region manager command canvas has no horizontal overflow at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await installStoreContractSession(page, 'regionManager')
    await routeChecklistCommand(page, [])

    await page.goto('/store/checklists')

    await expect(page.getByRole('heading', { name: 'Saha Kontrolleri' })).toBeVisible()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(1)
    const firstActionBox = await page.getByRole('button', { name: /Checklist yap/ }).first().boundingBox()
    expect(firstActionBox).not.toBeNull()
    expect((firstActionBox?.x ?? viewport.width) + (firstActionBox?.width ?? 0)).toBeLessThanOrEqual(viewport.width)
    mkdirSync(checklistCommandEvidenceDir, { recursive: true })
    await page.screenshot({
      path: join(checklistCommandEvidenceDir, viewport.evidence),
      fullPage: true,
    })
  })
}

async function routeChecklistCommand(page: Page, requests: URL[], savedBodies: unknown[] = []) {
  await page.route('**/api/checklists/command-canvas**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    requests.push(url)
    if (url.pathname.includes('/visit-plans/')) {
      const body = request.postDataJSON()
      savedBodies.push(body)
      await route.fulfill({ json: buildVisitPlanResponse(body.items, body.expectedRevision + 1) })
      return
    }
    if (url.pathname.endsWith('/visit-plans')) {
      await route.fulfill({ json: buildVisitPlanResponse([
        { storeId: '22222222-2222-4222-8222-222222222222', plannedDate: '2026-07-14', displayOrder: 0, status: 'completed' },
        { storeId: '11111111-1111-4111-8111-111111111111', plannedDate: '2026-07-15', displayOrder: 1, status: 'waiting' },
        { storeId: '22222222-2222-4222-8222-222222222222', plannedDate: '2026-07-16', displayOrder: 2, status: 'missed' },
      ], 3) })
      return
    }
    if (url.searchParams.get('limit') === '200') {
      await route.fulfill({ json: buildCommandResponse(buildPlannerStores(), 35, 200) })
      return
    }
    await route.fulfill({
      json: {
        data: {
          period: '2026-07',
          view: 'region_manager',
          capabilities: {
            weeklyVisitPlanningAvailable: true,
            canMaintainWeeklyVisitPlan: true,
          },
          metrics: {
            totalStores: 2,
            needsVisit: 1,
            active: 0,
            pending: 0,
            completed: 1,
          },
          items: [
            {
              storeId: '11111111-1111-4111-8111-111111111111',
              storeCode: 'ST-001',
              storeName: 'Marmara Park',
              regionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
              regionName: 'Marmara',
              regionManagers: [{ displayName: 'Pilot Bölge Müdürü' }],
              bmScore: 92,
              vmScore: null,
              bmCompletedAt: '2026-07-10T09:00:00.000Z',
              vmCompletedAt: null,
              lastCompletedVisitAt: '2026-07-10T09:00:00.000Z',
              elapsedDaysSinceLastVisit: 4,
              activeChecklistCount: 0,
              pendingAcknowledgementCount: 0,
              openActionCount: 0,
              blockedActionCount: 0,
              status: 'needs_visit',
              reasonCodes: ['missing_vm_visit'],
              lastOperationalAt: '2026-07-10T09:00:00.000Z',
            },
            {
              storeId: '22222222-2222-4222-8222-222222222222',
              storeCode: 'ST-002',
              storeName: 'Mall of İstanbul',
              regionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
              regionName: 'Marmara',
              regionManagers: [{ displayName: 'Pilot Bölge Müdürü' }],
              bmScore: 88,
              vmScore: 84,
              bmCompletedAt: '2026-07-11T09:00:00.000Z',
              vmCompletedAt: '2026-07-11T10:00:00.000Z',
              lastCompletedVisitAt: '2026-07-11T10:00:00.000Z',
              elapsedDaysSinceLastVisit: 3,
              activeChecklistCount: 0,
              pendingAcknowledgementCount: 0,
              openActionCount: 0,
              blockedActionCount: 0,
              status: 'completed',
              reasonCodes: ['completed_period'],
              lastOperationalAt: '2026-07-11T10:00:00.000Z',
            },
          ],
          page: { total: 2, limit: 30, offset: 0, hasMore: false },
        },
      },
    })
  })
}

function buildPlannerStores() {
  return Array.from({ length: 35 }, (_value, index) => ({
    storeId: index === 0 ? '11111111-1111-4111-8111-111111111111' : `66666666-6666-4666-8666-${String(index).padStart(12, '0')}`,
    storeCode: `ST-${String(index + 1).padStart(3, '0')}`,
    storeName: index === 0 ? 'Marmara Park' : `Pilot Mağaza ${index + 1}`,
    regionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    regionName: 'Marmara',
    regionManagers: [{ displayName: 'Pilot Bölge Müdürü' }],
    bmScore: index % 3 === 0 ? null : 80 + (index % 15),
    vmScore: index % 4 === 0 ? null : 78 + (index % 17),
    bmCompletedAt: null,
    vmCompletedAt: null,
    lastCompletedVisitAt: null,
    elapsedDaysSinceLastVisit: null,
    activeChecklistCount: 0,
    pendingAcknowledgementCount: 0,
    openActionCount: 0,
    blockedActionCount: 0,
    status: index % 3 === 0 ? 'needs_visit' : 'completed',
    reasonCodes: index % 3 === 0 ? ['missing_bm_visit'] : ['completed_period'],
    lastOperationalAt: null,
  }))
}

function buildCommandResponse(items: ReturnType<typeof buildPlannerStores>, total: number, limit: number) {
  return {
    data: {
      period: '2026-07', view: 'region_manager',
      capabilities: { weeklyVisitPlanningAvailable: true, canMaintainWeeklyVisitPlan: true },
      metrics: { totalStores: total, needsVisit: items.filter((item) => item.status === 'needs_visit').length, active: 0, pending: 0, completed: items.filter((item) => item.status === 'completed').length },
      items,
      page: { total, limit, offset: 0, hasMore: false },
    },
  }
}

function buildVisitPlanResponse(
  items: Array<{ storeId: string; plannedDate: string; displayOrder: number; status?: 'waiting' | 'missed' | 'completed' }>,
  revision: number,
) {
  return {
    data: {
      planId: '33333333-3333-4333-8333-333333333333',
      regionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      regionName: 'Marmara',
      weekStart: '2026-07-13',
      revision,
      revisedAt: '2026-07-13T08:00:00.000Z',
      view: 'region_manager',
      capabilities: { canMaintainWeeklyVisitPlan: true },
      items: items.map((item, index) => ({
        planItemId: `44444444-4444-4444-8444-${String(index).padStart(12, '0')}`,
        storeId: item.storeId,
        storeCode: item.storeId.startsWith('1111') ? 'ST-001' : 'ST-002',
        storeName: item.storeId.startsWith('1111') ? 'Marmara Park' : 'Mall of İstanbul',
        plannedDate: item.plannedDate,
        displayOrder: item.displayOrder,
        status: item.status ?? 'waiting',
        checklistInstanceId: item.status === 'completed' ? '55555555-5555-4555-8555-555555555555' : null,
        completedAt: item.status === 'completed' ? '2026-07-14T09:00:00.000Z' : null,
      })),
    },
  }
}
