import { expect, test, type Locator, type Page } from './test-fixtures'
import { setStoredLocale } from './locale-test-utils'
import { routeMasterDataControlApi } from './master-data-control-test-fixtures'
import { readComputedStyle } from './style-test-utils'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'store-ops-admin-session',
      JSON.stringify({
        mode: 'mock',
        mockUserId: 'admin-routing-user',
        mockRoleCodes: 'SUPER_ADMIN,INTEGRATION_ADMIN,HR_ADMIN,REPORT_VIEWER,AUDITOR',
        mockCompanyIds: '00000000-0000-0000-0000-000000000001',
        bearerToken: '',
      }),
    )
  })

  await routeAdminShellApi(page)
})

test('production session readiness is read-only and persists locale', async ({ page }) => {
  await page.goto('/admin/session')

  const main = page.getByRole('main')
  const heroMetrics = main.locator('.hero-metrics')
  const body = page.locator('body')

  await expect(page).toHaveURL(/\/admin\/session$/)
  await expect(main.getByText('Oturum durumu').first()).toBeVisible()
  await expect(main.getByRole('heading', { name: 'Mevcut oturumu güvenle doğrulayın.' })).toBeVisible()
  await expect(heroMetrics.getByText('Mod', { exact: true })).toBeVisible()
  await expect(heroMetrics.getByText('Yerel oturum', { exact: true })).toBeVisible()
  await expect(heroMetrics.getByText('Hazır', { exact: true })).toBeVisible()
  await expect(main.getByTestId('session-readonly-panel')).toBeVisible()
  await expect(main.getByRole('button', { name: 'Mevcut oturumu doğrula' })).toBeVisible()
  await expect(main.getByTestId('session-development-editor')).toHaveCount(0)
  await expect(main.getByTestId('session-development-preview')).toHaveCount(0)
  await expect(main.locator('input, textarea')).toHaveCount(0)
  await expect(main.getByRole('button', { name: /Mock|Bearer token|kaydet|varsayılan/i })).toHaveCount(0)
  await expect(main).not.toContainText('admin-routing-user')
  await expect(main).not.toContainText('00000000-0000-0000-0000-000000000001')
  await expect(main).not.toContainText('İstek önizlemesi')
  await expect(body).not.toContainText('ÃƒÆ’')
  await expect(body).not.toContainText('Ãƒâ€')
  await expect(body).not.toContainText('Ãƒâ€¦')

  await setStoredLocale(page, 'en')

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(main.getByText('Session status').first()).toBeVisible()
  await expect(main.getByRole('heading', { name: 'Verify the current session safely.' })).toBeVisible()
  await expect(heroMetrics.getByText('Mode', { exact: true })).toBeVisible()
  await expect(heroMetrics.getByText('Local session', { exact: true })).toBeVisible()
  await expect(heroMetrics.getByText('Ready', { exact: true })).toBeVisible()
  await expect(main.getByRole('button', { name: 'Verify current session' })).toBeVisible()
  await expect(main.getByRole('button', { name: /Mock headers|Bearer token|Save session|Reset/i })).toHaveCount(0)
  await expect(main.getByTestId('session-development-editor')).toHaveCount(0)

  await page.reload()

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(main.getByRole('heading', { name: 'Verify the current session safely.' })).toBeVisible()
})

test('production session readiness never renders persisted credential fragments', async ({ page }) => {
  await page.goto('/admin/session')
  await page.evaluate(() => {
    window.localStorage.setItem(
      'store-ops-admin-session',
      JSON.stringify({
        mode: 'bearer',
        browserSessionTransport: 'bearer',
        mockUserId: 'production-secret-identity-fragment',
        mockRoleCodes: 'SUPER_ADMIN',
        mockCompanyIds: 'production-secret-company-fragment',
        bearerToken: '',
      }),
    )
    window.sessionStorage.setItem(
      'store-ops-admin-bearer-token',
      'production-secret-token-fragment',
    )
  })
  await page.reload()

  const main = page.getByRole('main')
  await expect(main.getByTestId('session-readonly-panel')).toBeVisible()
  await expect(main.locator('input, textarea')).toHaveCount(0)
  await expect(main.getByTestId('session-development-editor')).toHaveCount(0)
  await expect(main).not.toContainText('production-secret-token-fragment')
  await expect(main).not.toContainText('production-secret-identity-fragment')
  await expect(main).not.toContainText('production-secret-company-fragment')
})

test('admin shell switches chrome to English copy and persists locale', async ({ page }) => {
  await page.goto('/admin/audit')

  const sidebar = page.locator('.admin-command-sidebar')
  const sidebarNav = sidebar.locator('.admin-command-nav')

  await expect(sidebar).toBeVisible()
  await expect(sidebar.locator('.admin-command-brand').getByText('LUFIAN')).toBeVisible()
  await expect(sidebarNav.getByRole('link', { name: 'Entegrasyonlar' })).toBeVisible()
  await expect(sidebarNav.getByRole('link', { name: 'Ana Veri' })).toBeVisible()
  await expect(sidebarNav.getByRole('link', { name: 'Denetim' })).toBeVisible()
  await expect(sidebar.getByRole('link', { name: 'Oturum' })).toBeVisible()
  await expect(page.locator('.shell-context-panel')).toHaveCount(0)
  await expect(page.getByText('Mağaza Operasyon Kontrol')).toHaveCount(0)
  await expect(page.getByText('Üretim UX ve gerçek kimlik')).toHaveCount(0)
  await expect(page.getByText('Store Ops Control')).toHaveCount(0)
  await expect(page.locator('body')).not.toContainText('Ã')
  await expect(page.locator('body')).not.toContainText('Ä')
  await expect(page.locator('body')).not.toContainText('Å')

  await setStoredLocale(page, 'en')

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(sidebar.locator('.admin-command-brand').getByText('LUFIAN')).toBeVisible()
  await expect(sidebarNav.getByRole('link', { name: 'Integrations' })).toBeVisible()
  await expect(sidebarNav.getByRole('link', { name: 'Master Data' })).toBeVisible()
  await expect(sidebarNav.getByRole('link', { name: 'Audit', exact: true })).toBeVisible()
  await expect(sidebar.getByRole('link', { name: 'Session' })).toBeVisible()
  await expect(page.getByText('Production UX And Real Auth')).toHaveCount(0)
  await expect(page.getByText('Mağaza Operasyon Kontrol')).toHaveCount(0)

  await page.reload()

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(sidebar.locator('.admin-command-brand').getByText('LUFIAN')).toBeVisible()
})

test('admin shell uses locked Plum Glacier sidebar palette tokens', async ({ page }) => {
  await page.goto('/admin/audit')

  const sidebar = page.locator('.admin-command-sidebar')
  await expect(sidebar).toBeVisible()

  const app = await readComputedStyle(page, '.admin-command-app')
  expect(app.backgroundColor).toBe('rgb(248, 245, 251)')
  expect(app.backgroundImage).toContain('rgba(248, 245, 251, 0.98)')
  expect(app.backgroundImage).toContain('rgba(237, 247, 246, 0.94)')
  expect(app.color).toBe('rgb(23, 20, 33)')

  const activeNav = await readComputedStyle(page, '.admin-command-nav-link-active')
  expect(activeNav.backgroundImage).toContain('rgba(124, 58, 237, 0.12)')
  expect(activeNav.backgroundImage).toContain('rgba(19, 167, 179, 0.12)')
  expect(activeNav.color).toBe('rgb(76, 42, 165)')

  const sidebarStyle = await readComputedStyle(page, '.admin-command-sidebar')
  expect(sidebarStyle.backgroundColor).toBe('rgba(255, 255, 255, 0.72)')
  expect(sidebarStyle.borderColor).toContain('rgba(36, 28, 50, 0.1)')

  const avatar = await readComputedStyle(page, '.admin-command-avatar')
  expect(avatar.backgroundColor).toBe('rgba(19, 167, 179, 0.12)')
  expect(avatar.color).toBe('rgb(8, 123, 134)')

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  )
  expect(hasHorizontalOverflow).toBe(false)
})

test('admin sidebar prefetches integration data before opening integrations', async ({ page }) => {
  let overviewRequests = 0
  let needsActionRequests = 0
  let lookupsRequests = 0
  let templateRequests = 0

  await page.unroute('**/api/integrations/import-batches/overview')
  await page.unroute('**/api/integrations/import-batches/needs-action?**')
  await page.unroute('**/api/integrations/lookups')
  await page.unroute('**/api/integrations/import-payload-templates**')
  await page.route('**/api/integrations/import-batches/overview', async (route) => {
    overviewRequests += 1
    await route.fulfill({ json: integrationOverviewFixture })
  })
  await page.route('**/api/integrations/import-batches/needs-action?**', async (route) => {
    const url = new URL(route.request().url())
    if (url.searchParams.get('limit') === '12' && url.searchParams.get('offset') === '0') {
      needsActionRequests += 1
    }
    await route.fulfill({ json: emptyListFixture })
  })
  await page.route('**/api/integrations/lookups', async (route) => {
    lookupsRequests += 1
    await route.fulfill({ json: integrationLookupsFixture })
  })
  await page.route('**/api/integrations/import-payload-templates**', async (route) => {
    templateRequests += 1
    await route.fulfill({ json: integrationTemplateFixture })
  })

  await page.goto('/admin/audit')

  const integrationLink = page.getByRole('link', { name: 'Entegrasyonlar' })
  await expect(integrationLink).toBeVisible()

  await integrationLink.hover()

  await expect.poll(() => overviewRequests).toBeGreaterThanOrEqual(1)
  await expect.poll(() => needsActionRequests).toBeGreaterThanOrEqual(1)
  await expect.poll(() => lookupsRequests).toBeGreaterThanOrEqual(1)
  await expect.poll(() => templateRequests).toBeGreaterThanOrEqual(1)
  const prefetchedOverviewRequests = overviewRequests
  const prefetchedNeedsActionRequests = needsActionRequests
  const prefetchedLookupsRequests = lookupsRequests
  const prefetchedTemplateRequests = templateRequests

  await integrationLink.click()

  await expect(page).toHaveURL(/\/admin\/integrations$/)
  await expect(page.getByText('batch-admin-prefetch-1').first()).toBeVisible()
  await expect.poll(() => overviewRequests, { timeout: 1000 }).toBe(prefetchedOverviewRequests)
  await expect.poll(() => needsActionRequests, { timeout: 1000 }).toBe(prefetchedNeedsActionRequests)
  await expect.poll(() => lookupsRequests, { timeout: 1000 }).toBe(prefetchedLookupsRequests)
  await expect.poll(() => templateRequests, { timeout: 1000 }).toBe(prefetchedTemplateRequests)
})

test('admin sidebar prefetches target queue data before opening targets', async ({ page }) => {
  let requestsCalls = 0
  let coverageCalls = 0

  await page.route('**/api/target-distributions/requests**', async (route) => {
    requestsCalls += 1
    const status = new URL(route.request().url()).searchParams.get('status')
    if (status === 'approved') {
      await route.fulfill({
        json: { items: [], meta: { count: 0, total: 0, limit: 5, offset: 0 } },
      })
      return
    }
    await route.fulfill({ json: targetDistributionRequestsPrefetchFixture })
  })
  await page.route('**/api/target-distributions/coverage**', async (route) => {
    coverageCalls += 1
    await route.fulfill({ json: targetCoveragePrefetchFixture })
  })
  await page.route('**/api/integrations/import-batches/overview', async (route) => {
    await route.fulfill({ json: integrationOverviewFixture })
  })
  await page.route('**/api/integrations/import-batches/needs-action?**', async (route) => {
    await route.fulfill({ json: emptyListFixture })
  })
  await page.route('**/api/integrations/lookups', async (route) => {
    await route.fulfill({ json: integrationLookupsFixture })
  })
  await page.route('**/api/integrations/import-payload-templates**', async (route) => {
    await route.fulfill({ json: integrationTemplateFixture })
  })

  await page.goto('/admin/session')

  const targetLink = page.locator('a[href="/admin/targets"]')
  await expect(targetLink).toBeVisible()

  await targetLink.hover()

  await expect.poll(() => requestsCalls).toBe(2)
  await expect.poll(() => coverageCalls).toBeGreaterThanOrEqual(1)
  const prefetchedRequestsCalls = requestsCalls
  const prefetchedCoverageCalls = coverageCalls

  await targetLink.click()

  await expect(page).toHaveURL(/\/admin\/targets$/)
  await expect(page.getByText('Target Prefetch Request')).toBeVisible()
  await expect.poll(() => requestsCalls, { timeout: 1000 }).toBe(prefetchedRequestsCalls)
  await expect.poll(() => coverageCalls, { timeout: 1000 }).toBe(prefetchedCoverageCalls)
})

test('admin sidebar collapses without losing navigation targets', async ({ page }) => {
  await page.goto('/admin/audit')

  await page.getByRole('button', { name: /daralt/i }).click()

  const sidebarNav = page.locator('.admin-command-nav')
  await expect(page.locator('.admin-command-app')).toHaveClass(/admin-command-app-collapsed/)
  await expect(sidebarNav.getByRole('link', { name: 'Denetim' })).toBeVisible()
  await sidebarNav.getByRole('link', { name: 'Raporlar' }).click()
  await expect(page).toHaveURL(/\/admin\/reports$/)
})

test('admin command shell keeps navigation responsive across lazy routes', async ({ page }) => {
  await page.goto('/admin/audit')

  await page.getByRole('link', { name: 'Raporlar' }).click()
  await expect(page).toHaveURL(/\/admin\/reports$/)
  await expect(page.getByRole('main')).toBeVisible()

  await page.getByRole('link', { name: 'Gelen Kutusu' }).click()
  await expect(page).toHaveURL(/\/admin\/inbox$/)
  await expect(page.getByRole('main')).toBeVisible()

  await expect(page.getByText('Sayfa geçişi tamamlanamadı')).toHaveCount(0)
})

test('admin shell fallback states switch chrome to English copy and persist locale', async ({ page }) => {
  await page.unroute('**/api/auth/session')
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({ json: auditorOnlySessionFixture })
  })

  await page.goto('/admin/auth')

  const main = page.getByRole('main')
  await expect(page.getByRole('navigation', { name: 'Birincil' })).toBeVisible()
  await expect(main.getByRole('heading', { name: 'Bu rol için rota kullanılamaz' })).toBeVisible()
  await expect(
    main.getByText('Bu oturum kimliği doğrulandı, ancak mevcut rol seti bu yüzeye izin vermiyor. Bunun yerine /admin/audit yoluna dön.'),
  ).toBeVisible()
  await expect(main.getByText('Route not available for this role')).toHaveCount(0)
  await expect(page.locator('body')).not.toContainText('Ãƒ')
  await expect(page.locator('body')).not.toContainText('Ã„')
  await expect(page.locator('body')).not.toContainText('Ã…')

  await setStoredLocale(page, 'en')

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible()
  await expect(main.getByRole('heading', { name: 'Route not available for this role' })).toBeVisible()
  await expect(
    main.getByText('This session is authenticated, but the current role set does not permit this surface. Return to /admin/audit instead.'),
  ).toBeVisible()
  await expect(main.getByText('Bu rol için rota kullanılamaz')).toHaveCount(0)

  await page.reload()

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(main.getByRole('heading', { name: 'Route not available for this role' })).toBeVisible()
})

test('audit center user detail links stay inside the audit namespace', async ({ page }) => {
  await page.goto('/admin/audit')

  const userAuditLink = page.locator('a[href$="/users/user-1/audit"]').first()
  await expect(userAuditLink).toHaveAttribute('href', '/admin/audit/users/user-1/audit')
  await userAuditLink.click()

  await expect(page).toHaveURL(/\/admin\/audit\/users\/user-1\/audit$/)
  await expect(page.getByRole('heading', { name: /Kullanıcı hesabı denetim izi/i })).toBeVisible()
  await expect(page.getByRole('link', { name: /Denetim merkezine dön/i })).toBeVisible()
})

const authAuditDetailCases = [
  {
    name: 'user audit detail',
    path: '/admin/audit/users/user-1/audit',
    trHeading: 'Kullanıcı hesabı denetim izi.',
    trTimelineTitle: 'Kullanıcı olayları',
    enHeading: 'User account audit trail.',
    enTimelineTitle: 'User events',
  },
  {
    name: 'role assignment audit detail',
    path: '/admin/audit/role-assignments/assignment-1/audit',
    trHeading: 'Rol ataması denetim izi.',
    trTimelineTitle: 'Atama olayları',
    enHeading: 'Role assignment audit trail.',
    enTimelineTitle: 'Assignment events',
  },
  {
    name: 'action store assignment audit detail',
    path: '/admin/audit/action-store-assignments/action-store-assignment-1/audit',
    trHeading: 'Aksiyon mağaza ataması denetim izi.',
    trTimelineTitle: 'Aksiyon mağaza olayları',
    enHeading: 'Action store assignment audit trail.',
    enTimelineTitle: 'Action store events',
  },
]

for (const detail of authAuditDetailCases) {
  test(`${detail.name} switches chrome to English copy and persists locale`, async ({ page }) => {
    await page.goto(detail.path)

    const main = page.getByRole('main')

    await expect(main.getByText('Kimlik denetimi')).toBeVisible()
    await expect(main.getByRole('heading', { name: detail.trHeading })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Denetim merkezine dön' })).toBeVisible()
    await expect(main.getByText('Denetim zaman çizelgesi')).toBeVisible()
    await expect(main.getByRole('heading', { name: detail.trTimelineTitle })).toBeVisible()
    await expect(main.getByText('Aktör: audit-admin | Modül: auth | Operasyon: update')).toBeVisible()
    await expect(main.getByText('Olay kayıt id')).toBeVisible()
    await expect(main.getByText('Korelasyon id')).toBeVisible()
    await expect(main.getByText('Değişen alanlar')).toBeVisible()
    await expect(main.getByText(detail.enHeading)).toHaveCount(0)
    await expect(page.locator('body')).not.toContainText('ÃƒÆ’')
    await expect(page.locator('body')).not.toContainText('Ãƒâ€')
    await expect(page.locator('body')).not.toContainText('Ãƒâ€¦')

    await setStoredLocale(page, 'en')

    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expect(main.getByText('Auth Audit')).toBeVisible()
    await expect(main.getByRole('heading', { name: detail.enHeading })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Back to audit center' })).toBeVisible()
    await expect(main.getByText('Audit timeline')).toBeVisible()
    await expect(main.getByRole('heading', { name: detail.enTimelineTitle })).toBeVisible()
    await expect(main.getByText('Actor: audit-admin | Module: auth | Operation: update')).toBeVisible()
    await expect(main.getByText('Event log id')).toBeVisible()
    await expect(main.getByText('Correlation id')).toBeVisible()
    await expect(main.getByText('Changed fields')).toBeVisible()
    await expect(main.getByText(detail.trHeading)).toHaveCount(0)

    await page.reload()

    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expect(main.getByRole('heading', { name: detail.enHeading })).toBeVisible()
  })
}

test('auth audit detail trio stays bounded on mobile width', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })

  for (const detail of authAuditDetailCases) {
    await page.goto(detail.path)

    const main = page.getByRole('main')
    await expect(main.getByRole('heading', { name: detail.trHeading })).toBeVisible()
    await expect(main.getByRole('heading', { name: detail.trTimelineTitle })).toBeVisible()
    await expect(main.getByText('Aktör: audit-admin | Modül: auth | Operasyon: update')).toBeVisible()

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow).toBeLessThanOrEqual(1)
  }
})

test('audit center switches chrome to English copy and persists locale', async ({ page }) => {
  await page.goto('/admin/audit')

  await expect(page.getByRole('heading', { name: 'Denetim merkezi' })).toBeVisible()
  await expect(page.getByText('Son görünür olaylar')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Hesap denetim kayıtları' })).toBeVisible()
  await expect(page.getByText('Audit Center')).toHaveCount(0)
  await expect(page.locator('body')).not.toContainText('Ã')
  await expect(page.locator('body')).not.toContainText('Ä')
  await expect(page.locator('body')).not.toContainText('Å')

  await setStoredLocale(page, 'en')

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('heading', { name: 'Audit Center' })).toBeVisible()
  await expect(page.getByText('Recent trace')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Recent account audit entries' })).toBeVisible()
  await expect(page.getByText('Denetim merkezi')).toHaveCount(0)

  await page.reload()

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('heading', { name: 'Audit Center' })).toBeVisible()
})

test('master data route exposes the current store and personnel workspace', async ({ page }) => {
  await page.goto('/admin/master-data')

  const main = page.getByRole('main')
  await expect(main.getByRole('heading', { name: 'Mağaza ve personel' })).toBeVisible()
  await expect(main.getByRole('tab', { name: 'Mağazalar' })).toBeVisible()
  await expect(main.getByRole('tab', { name: 'Personel' })).toBeVisible()
  await expect(page.getByText('Master data bootstrap')).toHaveCount(0)
  await expect(page.locator('body')).not.toContainText('Ã')
  await expect(page.locator('body')).not.toContainText('Ä')
  await expect(page.locator('body')).not.toContainText('Å')
})

test('admin checklist templates page switches chrome to English copy and persists locale', async ({ page }) => {
  await page.goto('/admin/checklists')

  const main = page.getByRole('main')

  await expect(main.getByText('Admin checklist', { exact: true })).toBeVisible()
  await expect(main.getByRole('heading', { name: 'Checklist şablon editörü' })).toBeVisible()
  await expect(
    main.getByText('Bölüm ekle, madde ekle, ağırlıkları 100’e tamamla ve yayınla.'),
  ).toBeVisible()
  await expect(main.getByRole('button', { name: 'Bölüm Ekle' }).first()).toBeVisible()
  await expect(main.getByRole('button', { name: 'Taslak Kaydet' })).toBeVisible()
  await expect(main.getByRole('button', { name: 'Yayınla' })).toBeVisible()
  await expect(main.getByText('Toplam ağırlık: 100/100')).toBeVisible()
  await expect(main.getByText('Checklist template editor')).toHaveCount(0)
  await expect(page.locator('body')).not.toContainText('Ãƒ')
  await expect(page.locator('body')).not.toContainText('Ã„')
  await expect(page.locator('body')).not.toContainText('Ã…')

  await setStoredLocale(page, 'en')

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(main.getByText('Admin checklist', { exact: true })).toBeVisible()
  await expect(main.getByRole('heading', { name: 'Checklist template editor' })).toBeVisible()
  await expect(
    main.getByText('Add sections, add items, bring weights to 100, and publish.'),
  ).toBeVisible()
  await expect(main.getByRole('button', { name: 'Add Section' }).first()).toBeVisible()
  await expect(main.getByRole('button', { name: 'Save Draft' })).toBeVisible()
  await expect(main.getByRole('button', { name: 'Publish' })).toBeVisible()
  await expect(main.getByText('Total weight: 100/100')).toBeVisible()
  await expect(main.getByText('Checklist şablon editörü')).toHaveCount(0)

  await page.reload()

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(main.getByRole('heading', { name: 'Checklist template editor' })).toBeVisible()
})

test('admin checklist editor keeps BM and VM template drafts separate', async ({ page }) => {
  await page.goto('/admin/checklists')

  const main = page.getByRole('main')
  const templateTypeSelect = main.getByLabel(/Checklist tipi|Checklist type/)
  const firstQuestion = main.getByTestId('checklist-question-input').first()

  await expect(firstQuestion).toHaveValue(/Vitrin sezon/i)

  await chooseChecklistTemplate(page, templateTypeSelect, 'VM Checklist')
  await expect(firstQuestion).toHaveValue('Vitrin konsepti VM standardına uygun mu?')

  await firstQuestion.fill('VM-only fixture question')
  await expect(firstQuestion).toHaveValue('VM-only fixture question')

  await chooseChecklistTemplate(page, templateTypeSelect, 'BM Checklist')
  await expect(firstQuestion).toHaveValue(/Vitrin sezon/i)
  await expect(firstQuestion).not.toHaveValue('VM-only fixture question')

  await chooseChecklistTemplate(page, templateTypeSelect, 'VM Checklist')
  await expect(firstQuestion).toHaveValue('VM-only fixture question')
})

test('admin checklist template editor stays bounded on mobile width', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/admin/checklists')
  await setStoredLocale(page, 'en')

  const main = page.getByRole('main')
  const templateTypeSelect = main.getByLabel('Checklist type')
  const firstQuestion = main.getByTestId('checklist-question-input').first()

  await expect(main.getByRole('heading', { name: 'Checklist template editor' })).toBeVisible()
  await expect(main.getByTestId('checklist-template-editor')).toBeVisible()
  await expect(main.getByTestId('admin-metric-weight')).toBeVisible()
  await expect(main.getByTestId('checklist-item-editor').first()).toBeVisible()
  await expect(main.getByRole('button', { name: 'Add Section' }).first()).toBeVisible()
  await expectNoHorizontalOverflow(page)

  await chooseChecklistTemplate(page, templateTypeSelect, 'VM Checklist')
  await expect(firstQuestion).toHaveValue('Vitrin konsepti VM standardına uygun mu?')
  await expectNoHorizontalOverflow(page)
})

test('snapshot operations page switches chrome to English copy and persists locale', async ({ page }) => {
  await page.goto('/admin/snapshots')

  await expect(page.getByText('Snapshot operasyonları')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Değişmez çalışmalar yeniden çalıştırmadan önce görünür olmalı.' })).toBeVisible()
  await expect(page.getByText('Günlük kapanış', { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Dün değişmez tarihe dönüşmeli' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Operatör ilgisi isteyen çalışmalar' })).toBeVisible()
  await expect(page.getByPlaceholder('Çalışma, tip, gerekçe veya durum ara')).toBeVisible()
  await expect(page.getByText('Snapshot Operations')).toHaveCount(0)
  await expect(page.locator('body')).not.toContainText('Ãƒ')
  await expect(page.locator('body')).not.toContainText('Ã„')
  await expect(page.locator('body')).not.toContainText('Ã…')

  await setStoredLocale(page, 'en')

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByText('Snapshot Operations')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Immutable runs need visibility before they need reruns.' })).toBeVisible()
  await expect(page.getByText('Daily closure', { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Yesterday should become immutable history' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Runs needing operator attention' })).toBeVisible()
  await expect(page.getByPlaceholder('Search by run, type, reason, or state')).toBeVisible()
  await expect(page.getByText('Snapshot operasyonları')).toHaveCount(0)

  await page.reload()

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('heading', { name: 'Immutable runs need visibility before they need reruns.' })).toBeVisible()
})

test('snapshot run detail page switches chrome to English copy and persists locale', async ({ page }) => {
  await page.goto('/admin/snapshots/snapshot-run-1')

  await expect(page.getByRole('link', { name: 'Snapshot operasyonlarına dön' })).toBeVisible()
  await expect(page.getByText('Snapshot çalışma detayı')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Günlük snapshot çalışması' })).toBeVisible()
  await expect(page.getByText('Toplam rapor satırı')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Çalışma özeti' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Bağımlılıklar ve kontroller' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Materialize edilen rapor kesitleri' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Operatör izi' })).toBeVisible()
  await expect(page.getByText('Snapshot Run Detail')).toHaveCount(0)
  await expect(page.locator('body')).not.toContainText('Ãƒ')
  await expect(page.locator('body')).not.toContainText('Ã„')
  await expect(page.locator('body')).not.toContainText('Ã…')

  await setStoredLocale(page, 'en')

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('link', { name: 'Back to snapshot operations' })).toBeVisible()
  await expect(page.getByText('Snapshot Run Detail')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'daily snapshot run' })).toBeVisible()
  await expect(page.getByText('Total report rows')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Run summary' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Dependencies and checks' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Materialized report slices' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Operator-visible trace' })).toBeVisible()
  await expect(page.getByText('Snapshot çalışma detayı')).toHaveCount(0)

  await page.reload()

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('heading', { name: 'daily snapshot run' })).toBeVisible()
})

test('snapshot operations routes stay bounded on mobile width', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })

  await page.goto('/admin/snapshots')
  await setStoredLocale(page, 'en')

  let main = page.getByRole('main')

  await expect(page).toHaveURL(/\/admin\/snapshots$/)
  await expect(main.getByText('Snapshot Operations')).toBeVisible()
  await expect(
    main.getByRole('heading', { name: 'Immutable runs need visibility before they need reruns.' }),
  ).toBeVisible()
  await expect(main.getByRole('heading', { name: 'Runs needing operator attention' })).toBeVisible()
  await expect(main.getByPlaceholder('Search by run, type, reason, or state')).toBeVisible()
  await expectNoHorizontalOverflow(page)

  await page.goto('/admin/snapshots/snapshot-run-1')
  await setStoredLocale(page, 'en')

  main = page.getByRole('main')

  await expect(page).toHaveURL(/\/admin\/snapshots\/snapshot-run-1$/)
  await expect(main.getByRole('link', { name: 'Back to snapshot operations' })).toBeVisible()
  await expect(main.getByText('Snapshot Run Detail')).toBeVisible()
  await expect(main.getByRole('heading', { name: 'daily snapshot run' })).toBeVisible()
  await expect(main.getByRole('heading', { name: 'Run summary' })).toBeVisible()
  await expect(main.getByRole('heading', { name: 'Dependencies and checks' })).toBeVisible()
  await expect(main.getByRole('heading', { name: 'Materialized report slices' })).toBeVisible()
  await expect(main.getByRole('heading', { name: 'Operator-visible trace' })).toBeVisible()
  await expectNoHorizontalOverflow(page)
})

async function chooseChecklistTemplate(page: Page, trigger: Locator, optionName: string) {
  await trigger.click()
  await page.getByRole('option', { name: optionName }).click()
}

async function expectNoHorizontalOverflow(page: Page) {
  const measurements = await page.evaluate(() => ({
    bodyWidth: document.body.scrollWidth,
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }))

  expect(
    Math.max(measurements.bodyWidth, measurements.documentWidth) - measurements.viewportWidth,
  ).toBeLessThanOrEqual(1)
}

async function routeAdminShellApi(page: Page) {
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({ json: authSessionFixture })
  })

  await page.route('**/api/auth/users?**', async (route) => {
    await route.fulfill({
      json: {
        items: [
          {
            userId: 'user-1',
            employeeId: null,
            username: 'admin.user',
            email: 'admin@example.com',
            authProvider: 'oidc',
            providerSubject: 'provider-user-1',
            isActive: true,
            lastLoginAt: null,
            createdAt: '2026-05-01T09:00:00.000Z',
          },
        ],
        meta: { count: 1, total: 1, limit: 50, offset: 0 },
      },
    })
  })

  await page.route('**/api/auth/role-assignments?**', async (route) => {
    await route.fulfill({ json: emptyListFixture })
  })

  await page.route('**/api/auth/users/user-1/audit**', async (route) => {
    await route.fulfill({ json: authAuditFixture })
  })

  await page.route('**/api/auth/role-assignments/assignment-1/audit**', async (route) => {
    await route.fulfill({ json: authAuditFixture })
  })

  await page.route('**/api/auth/action-store-assignments/action-store-assignment-1/audit**', async (route) => {
    await route.fulfill({ json: authAuditFixture })
  })

  await page.route('**/api/integrations/import-batches/needs-action?**', async (route) => {
    await route.fulfill({ json: emptyListFixture })
  })

  await page.route('**/api/snapshots/runs/overview', async (route) => {
    await route.fulfill({ json: snapshotOverviewFixture })
  })

  await page.route('**/api/snapshots/daily-closure', async (route) => {
    await route.fulfill({ json: dailyClosureFixture })
  })

  await page.route('**/api/snapshots/runs/needs-action?**', async (route) => {
    await route.fulfill({ json: snapshotNeedsActionFixture })
  })

  await page.route('**/api/snapshots/runs/snapshot-run-1/dependencies', async (route) => {
    await route.fulfill({ json: snapshotDependenciesFixture })
  })

  await page.route('**/api/snapshots/runs/snapshot-run-1/lineage', async (route) => {
    await route.fulfill({ json: snapshotLineageFixture })
  })

  await page.route('**/api/snapshots/runs/snapshot-run-1/audit**', async (route) => {
    await route.fulfill({ json: snapshotAuditFixture })
  })

  await page.route('**/api/snapshots/runs/snapshot-run-1', async (route) => {
    await route.fulfill({ json: snapshotDetailFixture })
  })

  await routeMasterDataControlApi(page)

  await page.route('**/api/integrations/master-data-bootstrap/batches?**', async (route) => {
    await route.fulfill({
      json: {
        items: [
          {
            batchId: '8a1506af-b043-4968-9d75-d10c8d4432d5',
            companyId: '00000000-0000-0000-0000-000000000001',
            bootstrapEntity: 'personnel',
            sourceLabel: 'Accepted personnel baseline',
            fileReference: 'personnel-master-mapping-prep.xlsx#chunk-9',
            uploadedByUserId: 'admin-routing-user',
            batchStatus: 'promoted',
            rowCount: 5,
            pendingCount: 0,
            validCount: 0,
            needsReviewCount: 0,
            invalidCount: 0,
            promotedCount: 5,
            createdAt: '2026-05-04T11:51:26.982Z',
            validatedAt: '2026-05-04T11:51:27.289Z',
            promotedAt: '2026-05-04T11:52:42.761Z',
            readiness: 'closed',
            nextAction: 'closed',
          },
        ],
        meta: { count: 1, total: 10, limit: 1, offset: 0 },
      },
    })
  })
}

const authSessionFixture = {
  authMode: 'mock',
  authenticated: true,
  user: {
    userId: 'admin-routing-user',
    employeeId: null,
    roleCodes: ['SUPER_ADMIN', 'INTEGRATION_ADMIN', 'HR_ADMIN', 'REPORT_VIEWER', 'AUDITOR'],
    scope: {
      companyIds: ['00000000-0000-0000-0000-000000000001'],
      regionIds: [],
      storeIds: [],
    },
    readScope: {
      companyIds: ['00000000-0000-0000-0000-000000000001'],
      regionIds: [],
      storeIds: [],
    },
    actionScope: {
      assignedStoreIds: [],
    },
    assignedStoreIds: [],
  },
  scopeSummary: {
    companyCount: 1,
    regionCount: 0,
    storeCount: 0,
    assignedStoreCount: 0,
  },
}

const auditorOnlySessionFixture = {
  ...authSessionFixture,
  user: {
    ...authSessionFixture.user,
    roleCodes: ['AUDITOR'],
  },
}

const emptyListFixture = {
  items: [],
  meta: {
    count: 0,
    total: 0,
    limit: 50,
    offset: 0,
  },
}

const targetDistributionRequestsPrefetchFixture = {
  items: [
    {
      requestId: 'target-prefetch-request-1',
      companyId: '00000000-0000-0000-0000-000000000001',
      regionId: '00000000-0000-0000-0000-000000000010',
      storeId: '00000000-0000-0000-0000-000000000100',
      storeName: 'Prefetch Demo Store',
      requestMonth: '2026-05-01',
      targetLabel: 'Target Prefetch Request',
      totalTargetValue: 250000,
      allocationCount: 1,
      status: 'pending_region_approval',
      requestReason: 'Navigation prefetch proof',
      allocations: [
        {
          employeeId: '00000000-0000-4000-8000-000000000501',
          assigneeLabel: 'Coverage Prefetch Person',
          targetValue: 250000,
        },
      ],
      submittedByUserId: 'store-manager-prefetch',
      approvedByUserId: null,
      approvedAt: null,
      approvalNote: null,
      createdAt: '2026-05-15T09:00:00.000Z',
      updatedAt: '2026-05-15T09:00:00.000Z',
    },
  ],
  meta: {
    count: 1,
    total: 1,
    limit: 50,
    offset: 0,
  },
}

const targetCoveragePrefetchFixture = {
  items: [
    {
      storeId: '00000000-0000-0000-0000-000000000100',
      storeName: 'Prefetch Demo Store',
      employeeId: '00000000-0000-4000-8000-000000000501',
      displayName: 'Coverage Prefetch Person',
      externalEmployeeRef: 'PF1001',
      targetReferenceId: null,
      targetValue: null,
      pendingRequestId: 'target-prefetch-request-1',
      pendingTargetValue: 250000,
      staleTargetReferenceId: null,
      targetStatus: 'pending_region_approval',
    },
  ],
  meta: {
    count: 1,
    total: 1,
    limit: 50,
    offset: 0,
  },
  summary: {
    requestMonth: '2026-05-01',
    totalEmployees: 1,
    coveredEmployees: 0,
    missingEmployees: 0,
    pendingEmployees: 1,
    conflictEmployees: 0,
    staleEmployees: 0,
    uncoveredEmployees: 1,
    coverageRate: 0,
  },
}

const integrationOverviewFixture = {
  totals: {
    all: 3,
    completed: 2,
    failed: 0,
    completedWithErrors: 1,
    pending: 0,
    queued: 0,
    processing: 0,
  },
  healthTotals: {
    healthy: 2,
    inProgress: 0,
    blocked: 0,
    retryReady: 0,
    needsAction: 0,
    stuck: 0,
  },
  actionTotals: {
    blocked: 0,
    retryReady: 0,
    needsAction: 0,
    stuck: 0,
  },
  latest: {
    completedBatchId: 'batch-admin-prefetch-1',
    failedBatchId: null,
    inProgressBatchId: null,
    stuckBatchId: null,
  },
}

const integrationLookupsFixture = {
  activeSources: [
    {
      sourceId: 'source-power-bi',
      sourceCode: 'POWER_BI_KPI',
      sourceName: 'Power BI KPI',
      entityType: 'kpi',
      sourceSystem: 'power_bi',
      stateModel: 'manual_upload',
    },
  ],
  meta: {
    totalEntityTypes: 1,
    totalActiveSources: 1,
  },
}

const integrationTemplateFixture = {
  entityType: 'kpi',
  sourceSystem: 'power_bi',
  normalizedBehavior: ['Power BI personnel and store KPI rows stay split at upload time.'],
  requestBody: {
    entityType: 'kpi',
    rows: [],
    sourceCapturedAt: '2026-05-01T09:00:00.000Z',
  },
}

const authAuditFixture = {
  items: [
    {
      eventLogId: 'event-1',
      occurredAt: '2026-05-06T09:30:00.000Z',
      actorUserId: 'audit-admin',
      correlationId: 'correlation-1',
      eventType: 'auth.assignment.updated',
      metadata: {
        changedFields: ['isActive'],
        sourceContext: {
          module: 'auth',
          operation: 'update',
        },
        details: {
          scopeType: 'store',
        },
      },
    },
  ],
  meta: {
    count: 1,
    total: 1,
    limit: 50,
    offset: 0,
  },
}

const snapshotOverviewFixture = {
  totals: {
    all: 4,
    queued: 1,
    running: 1,
    completed: 1,
    failed: 1,
  },
  healthTotals: {
    healthy: 1,
    inProgress: 1,
    retryReady: 1,
    needsAction: 0,
    stuck: 1,
  },
  actionTotals: {
    retryReady: 1,
    stuck: 1,
  },
  latest: {
    completedSnapshotRunId: 'snapshot-completed-1',
    failedSnapshotRunId: 'snapshot-run-1',
    inProgressSnapshotRunId: 'snapshot-running-1',
    stuckSnapshotRunId: 'snapshot-stuck-1',
  },
}

const dailyClosureFixture = {
  automationEnabled: true,
  automationPollMinutes: 15,
  timezone: 'Europe/Istanbul',
  referenceAt: '2026-05-07T09:00:00.000Z',
  localDate: '2026-05-07',
  closureDate: '2026-05-06',
  healthState: 'retry_ready',
  dueNow: true,
  canQueue: true,
  canRerun: false,
  recommendedAction: 'Queue the daily closure for yesterday.',
  existingSnapshotRunId: null,
  existingRunStatus: null,
  existingFailureReason: null,
  existingGeneratedAt: null,
}

const snapshotNeedsActionFixture = {
  items: [
    {
      snapshotRunId: 'snapshot-run-1',
      snapshotDate: '2026-05-06',
      snapshotType: 'daily',
      periodStart: '2026-05-06',
      periodEnd: '2026-05-06',
      runStatus: 'failed',
      healthState: 'retry_ready',
      generatedAt: '2026-05-06T02:00:00.000Z',
      generatedBy: 'admin-routing-user',
      startedAt: '2026-05-06T02:01:00.000Z',
      finishedAt: '2026-05-06T02:03:00.000Z',
      failureReason: 'Fixture dependency failed',
      rerunOfSnapshotRunId: null,
      kpiConfigVersion: {
        kpiConfigVersionId: '11111111-1111-4111-8111-111111111111',
        versionNo: 7,
        state: 'versioned',
      },
      actionReason: 'Dependency can be retried safely.',
      recommendedAction: 'Rerun the snapshot after dependency recovery.',
      canRerun: true,
      rerunCount: 1,
      latestRerunSnapshotRunId: null,
      isStuck: false,
    },
  ],
  meta: { count: 1, total: 1, limit: 12, offset: 0 },
}

const snapshotDetailFixture = {
  snapshotRun: {
    snapshotRunId: 'snapshot-run-1',
    snapshotDate: '2026-05-06',
    snapshotType: 'daily',
    periodStart: '2026-05-06',
    periodEnd: '2026-05-06',
    runStatus: 'failed',
    healthState: 'retry_ready',
    generatedAt: '2026-05-06T02:00:00.000Z',
    generatedBy: 'admin-routing-user',
    startedAt: '2026-05-06T02:01:00.000Z',
    finishedAt: '2026-05-06T02:03:00.000Z',
    failureReason: 'Fixture dependency failed',
    rerunOfSnapshotRunId: null,
    kpiConfigVersion: {
      kpiConfigVersionId: '11111111-1111-4111-8111-111111111111',
      versionNo: 7,
      state: 'versioned',
    },
  },
  cards: {
    workforceRows: 12,
    kpiRows: 24,
    checklistRows: 6,
    turnoverRows: 3,
  },
  canRerun: true,
  rerunAllowed: true,
  rerunBlockedReason: null,
  rerunCount: 1,
  latestRerunSnapshotRunId: null,
  failureReason: 'Fixture dependency failed',
}

const snapshotDependenciesFixture = {
  snapshotRunId: 'snapshot-run-1',
  runStatus: 'failed',
  rerunAllowed: true,
  rerunBlockedReason: null,
  checks: [
    {
      code: 'source-ready',
      status: 'pass',
      message: 'Source dependency recovered.',
    },
  ],
}

const snapshotLineageFixture = {
  snapshotRunId: 'snapshot-run-1',
  parent: null,
  children: [],
}

const snapshotAuditFixture = {
  items: [
    {
      eventLogId: 'event-1',
      occurredAt: '2026-05-06T02:00:00.000Z',
      actorUserId: 'admin-routing-user',
      correlationId: 'correlation-1',
      eventType: 'snapshot.failed',
      metadata: {},
    },
  ],
  meta: { count: 1, total: 1, limit: 50, offset: 0 },
}
