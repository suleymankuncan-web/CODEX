import { expect, test, type Page } from './test-fixtures'
import { expectNoCriticalAxeViolations } from './axe-test-utils'
import { pressTabFromDocumentStart } from './keyboard-test-utils'
import { routeMasterDataControlApi } from './master-data-control-test-fixtures'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'store-ops-admin-session',
      JSON.stringify({
        mode: 'mock',
        mockUserId: 'master-data-surface-user',
        mockRoleCodes: 'SUPER_ADMIN,HR_ADMIN,INTEGRATION_ADMIN',
        mockCompanyIds: '00000000-0000-0000-0000-000000000001',
        bearerToken: '',
      }),
    )
  })
  await page.route('**/api/auth/session', (route) => route.fulfill({ json: authSessionFixture }))
  await routeMasterDataControlApi(page)
})

test('master data exposes the current store and personnel management surface', async ({ page }) => {
  await page.goto('/admin/master-data')

  const main = page.getByRole('main')
  await expect(main.getByRole('heading', { name: 'Mağaza ve personel' })).toBeVisible()
  await expect(main.getByRole('tab', { name: 'Mağazalar' })).toHaveAttribute('aria-selected', 'true')
  await expect(main.getByRole('tab', { name: 'Personel' })).toBeVisible()
  await expect(main.getByRole('table', { name: 'Mağazalar' })).toContainText('Eda Doğanay')
  await expect(main).not.toContainText('onprem.region-manager')
  await expect(main).not.toContainText('Ana Veri Kontrolü')
  await expectNoHorizontalOverflow(page)
})

test('admin shell skip link moves focus to the main landmark', async ({ page }) => {
  await page.goto('/admin/master-data')

  const main = page.getByRole('main')
  const skipLink = page.getByRole('link', { name: 'Ana içeriğe geç' })
  await pressTabFromDocumentStart(page, skipLink)
  await expect(skipLink).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(main).toBeFocused()
  await expect(main).toHaveAttribute('id', 'application-main-content')
})

test('loaded master data management state has no critical WCAG violations', async ({ page }) => {
  await page.goto('/admin/master-data')
  await expect(page.getByRole('heading', { name: 'Mağaza ve personel' })).toBeVisible()

  await expectNoCriticalAxeViolations(page)
})

test('master data management stays mobile-safe', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/admin/master-data')

  const main = page.getByRole('main')
  await expect(main.getByRole('heading', { name: 'Mağaza ve personel' })).toBeVisible()
  await expect(main.getByRole('table', { name: 'Mağazalar' })).toHaveCount(0)
  await expect(main.getByRole('button').filter({ hasText: 'Eda Doğanay' }).first()).toBeVisible()
  await expectNoHorizontalOverflow(page)
})

async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth))
    .toBe(true)
}

const authSessionFixture = {
  authMode: 'mock',
  authenticated: true,
  user: {
    userId: 'master-data-surface-user',
    employeeId: null,
    roleCodes: ['SUPER_ADMIN', 'HR_ADMIN', 'INTEGRATION_ADMIN'],
    scope: { companyIds: ['00000000-0000-0000-0000-000000000001'], regionIds: [], storeIds: [] },
    readScope: { companyIds: ['00000000-0000-0000-0000-000000000001'], regionIds: [], storeIds: [] },
    actionScope: { assignedStoreIds: [] },
    assignedStoreIds: [],
  },
  scopeSummary: { companyCount: 1, regionCount: 0, storeCount: 0, assignedStoreCount: 0 },
}

for (const viewport of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }, { width: 390, height: 844 }, { width: 360, height: 800 }]) {
  test(`sales personnel observations remain read-only at ${viewport.width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport)
    const queries: URLSearchParams[] = []
    await page.route('**/api/integrations/personnel-observations?**', async (route) => {
      expect(route.request().method()).toBe('GET')
      const query = new URL(route.request().url()).searchParams
      queries.push(query)
      const offset = Number(query.get('offset'))
      const items = query.get('q') ? [] : Array.from({ length: offset ? 1 : 20 }, (_, index) => ({
        sourceId: '00000000-0000-0000-0000-000000000010',
        businessDate: '2026-09-07',
        storeId: '00000000-0000-0000-0000-000000000020',
        storeCode: 'M001', storeName: 'Observation test store', personnelCode: `OBS${offset + index + 1}`,
      }))
      await route.fulfill({ json: { items, meta: { count: items.length, total: query.get('q') ? 0 : 21, limit: 20, offset } } })
    })
    await page.goto('/admin/master-data')
    await page.getByRole('tab', { name: 'Personel', exact: true }).click()
    const section = page.getByRole('region', { name: 'Satışlarda görülen personeller' })
    await expect(section).toContainText('çalışan kadrosu, işe giriş veya mağaza ataması anlamına gelmez')
    await expect(section).toContainText('OBS1')
    await expect(section.getByRole('button', { name: /Düzenle|Sil|İşe giriş|İşten çıkış/ })).toHaveCount(0)
    expect(queries[0].get('limit')).toBe('20')
    expect((Date.parse(queries[0].get('toDate')!) - Date.parse(queries[0].get('fromDate')!)) / 86400000).toBe(29)
    await section.getByRole('button', { name: 'Sonraki gözlemler' }).click()
    await expect(section).toContainText('21-21 / 21 gözlem')
    expect(queries.at(-1)?.get('offset')).toBe('20')
    await expect(section.getByRole('button', { name: 'Sonraki gözlemler' })).toBeDisabled()
    await expectNoHorizontalOverflow(page)
    await section.scrollIntoViewIfNeeded()
    await page.screenshot({ path: testInfo.outputPath(`observations-${viewport.width}.png`), fullPage: true })
    await section.screenshot({ path: testInfo.outputPath(`observation-section-${viewport.width}.png`) })
    await section.getByRole('textbox', { name: 'Personel kodu ara' }).fill('ABSENT')
    await expect(section).toContainText('gözlem yok')
    expect(queries.at(-1)?.get('offset')).toBe('0')
    expect(queries.at(-1)?.get('q')).toBe('ABSENT')
  })
}

test('sales personnel observations show loading and recover from a read failure', async ({ page }) => {
  let releaseRequest: () => void = () => undefined
  const requestGate = new Promise<void>((resolve) => { releaseRequest = resolve })
  let fails = true
  await page.route('**/api/integrations/personnel-observations?**', async (route) => {
    await requestGate
    await route.fulfill(fails ? { status: 503, json: { message: 'unavailable' } } : { json: { items: [], meta: { count: 0, total: 0, limit: 20, offset: 0 } } })
  })
  await page.goto('/admin/master-data')
  await page.getByRole('tab', { name: 'Personel', exact: true }).click()
  const section = page.getByRole('region', { name: 'Satışlarda görülen personeller' })
  await expect(section).toContainText('personeller yükleniyor')
  releaseRequest()
  await expect(section).toContainText('personeller alınamadı', { timeout: 20000 })
  await expect(section).not.toContainText('gözlem yok')
  fails = false
  await section.getByRole('button', { name: 'Tekrar dene' }).click()
  await expect(section).toContainText('gözlem yok')
})
