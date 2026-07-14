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

async function routeChecklistCommand(page: Page, requests: URL[]) {
  await page.route('**/api/checklists/command-canvas**', async (route) => {
    requests.push(new URL(route.request().url()))
    await route.fulfill({
      json: {
        data: {
          period: '2026-07',
          view: 'region_manager',
          capabilities: {
            weeklyVisitPlanningAvailable: false,
            canMaintainWeeklyVisitPlan: false,
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
