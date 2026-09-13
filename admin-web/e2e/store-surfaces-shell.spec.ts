import { expect, test } from './test-fixtures'
import { setStoredLocale } from './locale-test-utils'
import { readComputedStyle } from './style-test-utils'
import { routeStoreManagerTargetCommand } from './store-targets-store-manager-command-fixtures'
import { demoStoreId, demoRegionId, regionSecondStoreId } from './store-surfaces-identities'
import { verifyStoreNavTransition, expectHealthyStoreTransition, createStoreAuthSession, routeAuthSession, createTaskWorkspaceFixture, routeStoreSurfaceApi } from './store-surfaces-api-fixtures'
import { authSessionFixture, workflowInboxFixture, checklistAcknowledgementsFixture, mobileChecklistTodayFixture, storeFeedFixture } from './store-surfaces-profile-fixtures'
import { targetDistributionRequestsFixture, targetCoverageFixture, storeTargetingPersonnelFixture } from './store-surfaces-operations-fixtures'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'store-ops-admin-session',
      JSON.stringify({
        mode: 'mock',
        mockUserId: 'store-me-smoke-user',
        mockRoleCodes: 'STORE_PERSONNEL',
        mockCompanyIds: '00000000-0000-0000-0000-000000000001',
        bearerToken: '',
      }),
    )
  })

  await routeStoreSurfaceApi(page)
})

test('store shell exposes Turkish-first chrome and hides technical auth roles', async ({ page }) => {
  await page.goto('/store')

  const storeNav = page.locator('.store-command-nav')
  const storeSidebar = page.locator('.store-command-sidebar')
  await expect(storeNav.locator('a[href="/store/checklists"]')).toBeVisible()
  await expect(storeNav.locator('a[href="/store/targets"]')).toBeVisible()
  await expect(storeNav.locator('a[href="/store/reports"]')).toHaveCount(0)
  await expect(page.getByRole('main', { name: 'Mağaza çalışma alanı' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Operasyon Paneli' })).toBeVisible()
  await expect(storeNav.getByRole('link', { name: 'Mağaza KPI', exact: true })).toBeVisible()
  await expect(storeNav.getByRole('link', { name: 'Talep Merkezi', exact: true })).toBeVisible()
  await expect(storeSidebar.locator('a[href="/store/settings"]')).toBeVisible()
  const checklistCard = page.getByTestId('store-home-checklist-card')
  await expect(checklistCard).toBeVisible()
  await expect(checklistCard).toContainText('1')
  await expect(checklistCard.getByRole('link')).toHaveAttribute('href', '/store/checklists')
  await expect(page.getByText('Ön izleme', { exact: true })).toHaveCount(0)
  await expect(page.getByLabel('Prototip rol seçimi')).toHaveCount(0)
  await expect(page.getByTestId('store-home-visit-priority-card')).toHaveCount(0)
  await expect(page.locator('a[href="/store/checklists?canvasView=plan"]')).toHaveCount(0)
  await expect(page.locator('body')).not.toContainText('STORE_PERSONNEL')
  await expect(page.locator('body')).not.toContainText('STORE_MANAGER')
  await expect(page.getByText('offline_access')).toHaveCount(0)
  await expect(page.getByText('uma_authorization')).toHaveCount(0)
  await expect(page.getByText('default-roles-store-ops')).toHaveCount(0)
  await expect(page.getByText('Task-first preview for store-scoped work.')).toHaveCount(0)
})

test('store home uses the current semantic shell palette tokens', async ({ page }) => {
  await page.goto('/store/home')

  await expect(page.getByTestId('store-home-dashboard')).toBeVisible()

  const app = await readComputedStyle(page, '.store-shell.store-command-app')
  expect(app.backgroundColor).toBe('rgb(248, 245, 251)')
  expect(app.backgroundImage).toContain('rgba(248, 245, 251, 0.98)')
  expect(app.backgroundImage).toContain('rgba(237, 247, 246, 0.94)')
  expect(app.color).toBe('rgb(23, 20, 33)')

  const activeNav = await readComputedStyle(page, '.store-command-nav-link-active')
  expect(activeNav.backgroundImage).toBe('none')
  expect(activeNav.backgroundColor).toBe('rgb(255, 255, 255)')
  expect(activeNav.boxShadow).not.toBe('none')
  expect(activeNav.color).not.toBe('rgb(76, 42, 165)')

  const header = await readComputedStyle(page, '.store-command-home .sh-dashboard-header')
  expect(header.backgroundColor).toBe('rgba(255, 255, 255, 0.88)')
  expect(header.borderColor).toBe('rgba(36, 28, 50, 0.1)')
  expect(header.boxShadow).toContain('rgba(32, 24, 48, 0.08)')

  const card = await readComputedStyle(page, '.store-command-home .sh-metric')
  expect(card.backgroundColor).toBe('rgba(255, 255, 255, 0.88)')
  expect(card.borderColor).toBe('rgba(36, 28, 50, 0.1)')
  expect(card.boxShadow).toContain('rgba(32, 24, 48, 0.08)')

  const cyanIcon = await readComputedStyle(page, '.store-command-home .sh-tone-cyan .sh-metric-icon')
  expect(cyanIcon.backgroundColor).toBe('rgba(19, 167, 179, 0.12)')
  expect(cyanIcon.color).toBe('rgb(8, 123, 134)')

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  )
  expect(hasHorizontalOverflow).toBe(false)
})

test('store home prefetches the task queue for manager navigation', async ({ page }) => {
  let workflowInboxRequests = 0
  await page.unroute('**/api/workflow/inbox')
  await page.route('**/api/workflow/inbox', async (route) => {
    workflowInboxRequests += 1
    await route.fulfill({ json: workflowInboxFixture })
  })

  await page.goto('/store/home')

  await expect(page.getByRole('heading', { name: 'Operasyon Paneli' })).toBeVisible()
  await expect(page.getByTestId('store-home-dashboard')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Bugünün gündemi' })).toBeVisible()
  await expect(page.getByText('Mağaza özeti', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Dönem', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Ayarlar içinde', { exact: true })).toHaveCount(0)
  const requestPriority = page.locator('.sh-agenda-row').filter({ hasText: 'Talep Merkezi' })
  await expect(requestPriority).toContainText('Karar bekleyen talepler var')
  await expect(requestPriority).toContainText('Karar bekliyor')
  await expect.poll(() => workflowInboxRequests).toBeGreaterThanOrEqual(1)

  await page
    .locator('.store-command-nav')
    .getByRole('link', { name: 'Görevler', exact: true })
    .click()

  await expect(page.getByRole('heading', { name: 'Görevler' })).toBeVisible()
  expect(workflowInboxRequests).toBe(1)
})

test('store home keeps the command surface pending when workflow inbox fails', async ({ page }) => {
  await page.unroute('**/api/workflow/inbox')
  await page.route('**/api/workflow/inbox', async (route) => {
    await route.fulfill({
      status: 503,
      json: { message: 'Workflow unavailable' },
    })
  })

  await page.goto('/store/home')

  await expect(page.getByRole('heading', { name: 'Operasyon Paneli' })).toBeVisible()
  await expect(page.getByText('Talep özeti açılamadı')).toBeVisible()
  await expect(page.getByText('Açılamadı').first()).toBeVisible()
  await expect(page.getByRole('status')).toContainText('Bazı özetler')
})

test('region manager home surfaces checklist field queue summary', async ({ page }) => {
  let acknowledgementRequests = 0
  let mobileTodayRequests = 0

  await page.unroute('**/api/auth/session')
  await page.unroute('**/api/checklists/acknowledgements/list')
  await page.unroute('**/api/mobile/checklists/today')
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({
      json: {
        ...authSessionFixture,
        user: {
          ...authSessionFixture.user,
          roleCodes: ['REGION_MANAGER'],
          actionScope: {
            assignedStoreIds: [demoStoreId, regionSecondStoreId],
          },
          assignedStoreIds: [demoStoreId, regionSecondStoreId],
        },
        scopeSummary: {
          ...authSessionFixture.scopeSummary,
          assignedStoreCount: 2,
          storeCount: 2,
        },
      },
    })
  })
  await page.route('**/api/checklists/acknowledgements/list', async (route) => {
    acknowledgementRequests += 1
    await route.fulfill({ json: checklistAcknowledgementsFixture })
  })
  await page.route('**/api/mobile/checklists/today', async (route) => {
    mobileTodayRequests += 1
    await route.fulfill({ json: mobileChecklistTodayFixture })
  })
  await page.route('**/api/checklists/command-canvas**', async (route) => {
    await route.fulfill({
      json: {
        data: {
          period: '2026-05',
          view: 'region_manager',
          capabilities: {
            weeklyVisitPlanningAvailable: false,
            canMaintainWeeklyVisitPlan: false,
          },
          metrics: { totalStores: 2, needsVisit: 2, active: 0, pending: 0, completed: 0 },
          items: [
            {
              storeId: demoStoreId,
              storeCode: 'PILOT-001',
              storeName: 'Pilot Store',
              regionId: '00000000-0000-0000-0000-000000000010',
              regionName: 'Pilot Region',
              regionManagers: [{ displayName: 'Pilot Bölge Müdürü' }],
              bmScore: null,
              vmScore: null,
              bmCompletedAt: null,
              vmCompletedAt: null,
              lastCompletedVisitAt: null,
              elapsedDaysSinceLastVisit: null,
              activeChecklistCount: 0,
              pendingAcknowledgementCount: 0,
              openActionCount: 0,
              blockedActionCount: 0,
              status: 'needs_visit',
              reasonCodes: ['missing_bm_visit', 'missing_vm_visit'],
              lastOperationalAt: null,
            },
          ],
          page: { total: 2, limit: 30, offset: 0, hasMore: false },
        },
      },
    })
  })

  await page.goto('/store/home')

  const storeNav = page.locator('.store-command-nav')
  await expect(storeNav.locator('a[href="/store/reports"]')).toBeVisible()
  const checklistCard = page.getByTestId('store-home-checklist-card')
  await expect(checklistCard).toBeVisible()
  await expect(checklistCard).toContainText('1')
  await expect(checklistCard.getByRole('link')).toHaveAttribute('href', '/store/checklists')
  const visitPriorityCard = page.getByTestId('store-home-visit-priority-card')
  await expect(visitPriorityCard).toBeVisible()
  await expect(visitPriorityCard).toContainText('Bu hafta ziyaret')
  await expect(visitPriorityCard).toContainText('2')
  await expect(visitPriorityCard).toContainText('2 yüksek riskli mağaza')
  await expect(visitPriorityCard).toContainText('ziyaret planında görünüyor')
  await expect(visitPriorityCard.getByRole('link')).toHaveAttribute('href', '/store/checklists?canvasView=plan')
  await expect(page.getByRole('heading', { name: 'Çalışma alanları' })).toBeVisible()
  await expect(page.locator('a[href="/store/kpis"]').first()).toBeVisible()
  await expect.poll(() => acknowledgementRequests).toBeGreaterThanOrEqual(1)
  await expect.poll(() => mobileTodayRequests).toBeGreaterThanOrEqual(1)
  const prefetchedAcknowledgementRequests = acknowledgementRequests
  const prefetchedMobileTodayRequests = mobileTodayRequests

  await checklistCard.getByRole('link').click()

  await expect(page).toHaveURL(/\/store\/checklists$/)
  await expect(page.getByRole('heading', { name: 'Saha Kontrolleri' })).toBeVisible()
  await expect.poll(() => acknowledgementRequests, { timeout: 1000 }).toBe(prefetchedAcknowledgementRequests)
  await expect.poll(() => mobileTodayRequests, { timeout: 1000 }).toBe(prefetchedMobileTodayRequests)
})

test('region manager visit priority card stays pending when checklist data fails', async ({ page }) => {
  let mobileTodayErrorRequests = 0
  await page.unroute('**/api/auth/session')
  await page.unroute('**/api/checklists/acknowledgements/list')
  await page.unroute('**/api/mobile/checklists/today')
  await page.context().unroute('**/api/mobile/checklists/today')
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({
      json: createStoreAuthSession({
        roleCodes: ['REGION_MANAGER'],
        readStoreIds: [demoStoreId, regionSecondStoreId],
        scopeStoreIds: [demoStoreId, regionSecondStoreId],
        actionStoreIds: [demoStoreId, regionSecondStoreId],
        legacyAssignedStoreIds: [demoStoreId, regionSecondStoreId],
      }),
    })
  })
  await page.route('**/api/checklists/acknowledgements/list', async (route) => {
    await route.fulfill({ json: checklistAcknowledgementsFixture })
  })
  await page.context().route('**/api/mobile/checklists/today**', async (route) => {
    mobileTodayErrorRequests += 1
    await route.fulfill({
      status: 503,
      json: { message: 'Checklist data unavailable' },
    })
  })

  await page.goto('/store/home')

  const visitPriorityCard = page.getByTestId('store-home-visit-priority-card')
  await expect(visitPriorityCard).toBeVisible()
  await expect.poll(() => mobileTodayErrorRequests).toBeGreaterThanOrEqual(1)
  await expect(visitPriorityCard).toContainText('Açılamadı')
  await expect(visitPriorityCard).toContainText('Bu bilgi şu anda görüntülenemiyor')
  await expect(visitPriorityCard).not.toContainText('Yüksek riskli mağaza yok')
})

test('report viewer store home does not advertise the visit plan link', async ({ page }) => {
  await routeAuthSession(page, createStoreAuthSession({
    roleCodes: ['REPORT_VIEWER'],
    readStoreIds: [demoStoreId],
    scopeStoreIds: [demoStoreId],
    actionStoreIds: [],
    legacyAssignedStoreIds: [],
  }))

  await page.goto('/store/home')

  await expect(page.locator('.store-command-nav').locator('a[href="/store/checklists"]')).toBeVisible()
  await expect(page.getByTestId('store-home-visit-priority-card')).toHaveCount(0)
  await expect(page.locator('a[href="/store/checklists?canvasView=plan"]')).toHaveCount(0)
})

test('region manager home translates visit priority reasons in English', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('store-ops-app-locale', 'en')
  })
  await routeAuthSession(page, createStoreAuthSession({
    roleCodes: ['REGION_MANAGER'],
    readStoreIds: [demoStoreId, regionSecondStoreId],
    scopeStoreIds: [demoStoreId, regionSecondStoreId],
    actionStoreIds: [demoStoreId, regionSecondStoreId],
    legacyAssignedStoreIds: [demoStoreId, regionSecondStoreId],
  }))

  await page.goto('/store/home')

  const visitPriorityCard = page.getByTestId('store-home-visit-priority-card')
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(visitPriorityCard).toBeVisible()
  await expect(visitPriorityCard).toContainText('This week visit priority')
  await expect(visitPriorityCard).toContainText('2 high-risk stores')
  await expect(visitPriorityCard).toContainText('visit plan')
  await expect(visitPriorityCard).not.toContainText('Bu ay ziyaret yok')
})

test('store home dashboard actions follow role-aware navigation for admin landing roles', async ({ page }) => {
  await page.unroute('**/api/auth/session')
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({
      json: {
        ...authSessionFixture,
        user: {
          ...authSessionFixture.user,
          roleCodes: ['HR_ADMIN'],
          actionScope: {
            assignedStoreIds: [],
          },
          assignedStoreIds: [],
        },
        scopeSummary: {
          ...authSessionFixture.scopeSummary,
          assignedStoreCount: 0,
        },
      },
    })
  })

  await page.goto('/store/home')

  await expect(page.getByTestId('store-home-dashboard')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Operasyon Paneli' })).toBeVisible()
  await expect(page.getByTestId('store-home-dashboard').getByText('Admin görünümü', { exact: true })).toBeVisible()
  await expect(page.locator('.sh-dashboard-heading')).toContainText('store-me-smoke-user')
  await expect(page.getByText('Bölge özet dashboard')).toHaveCount(0)
  await expect(page.locator('a[href="/store/feed"]').first()).toBeVisible()
  await expect(page.locator('a[href="/store/reports"]')).toHaveCount(0)
  await expect(page.locator('a[href="/store/kpis"]')).toHaveCount(0)
  await expect(page.locator('a[href="/store/targets"]')).toHaveCount(0)
  await expect(page.locator('a[href="/store/approvals"]')).toHaveCount(0)
  await expect(page.locator('a[href="/store/checklists"]')).toHaveCount(0)
  await expect(page.locator('a[href="/store/tasks"]')).toHaveCount(0)
})

test('store personnel sidebar only exposes personnel surfaces', async ({ page }) => {
  await page.unroute('**/api/auth/session')
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({
      json: {
        ...authSessionFixture,
        user: {
          ...authSessionFixture.user,
          roleCodes: ['STORE_PERSONNEL'],
          actionScope: {
            assignedStoreIds: [demoStoreId],
          },
          assignedStoreIds: [demoStoreId],
        },
      },
    })
  })

  await page.goto('/store/me')

  const storeNav = page.locator('.store-command-nav')
  await expect(storeNav.locator('a[href="/store/me"]')).toBeVisible()
  await expect(storeNav.locator('a[href="/store/rankings"]')).toBeVisible()
  await expect(storeNav.locator('a[href="/store/settings"]')).toBeVisible()
  await expect(storeNav.locator('a[href="/store/checklists"]')).toHaveCount(0)
  await expect(storeNav.locator('a[href="/store/kpis"]')).toHaveCount(0)
  await expect(storeNav.locator('a[href="/store/approvals"]')).toHaveCount(0)
  await expect(storeNav.locator('a[href="/store/tasks"]')).toHaveCount(0)
  await expect(page.locator('a[href="/store/checklists"]')).toHaveCount(0)
  await expect(page.locator('a[href="/store/approvals"]')).toHaveCount(0)
})

test('store personnel command surface stays personal and read-only', async ({ page }) => {
  await page.unroute('**/api/auth/session')
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({
      json: {
        ...authSessionFixture,
        user: {
          ...authSessionFixture.user,
          roleCodes: ['STORE_PERSONNEL'],
          actionScope: {
            assignedStoreIds: [demoStoreId],
          },
          assignedStoreIds: [demoStoreId],
        },
      },
    })
  })

  await page.goto('/store/home')

  await expect(page.getByTestId('store-home-command')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Operasyon Paneli' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Çalışma alanları' })).toBeVisible()
  await expect(page.locator('a[href="/store/me"]').first()).toBeVisible()
  await expect(page.locator('a[href="/store/rankings"]').first()).toBeVisible()
  await expect(page.locator('a[href="/store/feed"]').first()).toBeVisible()
  await expect(page.locator('a[href="/store/tasks"]')).toHaveCount(0)
  await expect(page.locator('a[href="/store/checklists"]')).toHaveCount(0)
  await expect(page.locator('a[href="/store/kpis"]')).toHaveCount(0)
})

test('store personnel cannot open tasks by direct route', async ({ page }) => {
  let workflowInboxRequests = 0
  let taskWorkspaceRequests = 0

  await page.unroute('**/api/auth/session')
  await page.unroute('**/api/workflow/inbox**')
  await page.unroute('**/api/store/tasks/workspace**')
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({
      json: {
        ...authSessionFixture,
        user: {
          ...authSessionFixture.user,
          roleCodes: ['STORE_PERSONNEL'],
          actionScope: {
            assignedStoreIds: [demoStoreId],
          },
          assignedStoreIds: [demoStoreId],
        },
      },
    })
  })
  await page.route('**/api/workflow/inbox**', async (route) => {
    workflowInboxRequests += 1
    await route.fulfill({ json: workflowInboxFixture })
  })
  await page.route('**/api/store/tasks/workspace**', async (route) => {
    taskWorkspaceRequests += 1
    await route.fulfill({ json: { data: createTaskWorkspaceFixture() } })
  })

  await page.goto('/store/tasks')

  await expect(page.getByRole('heading', { name: /rota kullan/i })).toBeVisible()
  await expect(page.getByText('/store/me')).toBeVisible()
  expect(workflowInboxRequests).toBe(0)
  expect(taskWorkspaceRequests).toBe(0)
})

test('store personnel cannot open checklists by direct route', async ({ page }) => {
  let acknowledgementRequests = 0
  let mobileTodayRequests = 0

  await page.unroute('**/api/auth/session')
  await page.unroute('**/api/checklists/acknowledgements/list')
  await page.unroute('**/api/mobile/checklists/today')
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({
      json: {
        ...authSessionFixture,
        user: {
          ...authSessionFixture.user,
          roleCodes: ['STORE_PERSONNEL'],
          actionScope: {
            assignedStoreIds: [demoStoreId],
          },
          assignedStoreIds: [demoStoreId],
        },
      },
    })
  })
  await page.route('**/api/checklists/acknowledgements/list', async (route) => {
    acknowledgementRequests += 1
    await route.fulfill({ json: checklistAcknowledgementsFixture })
  })
  await page.route('**/api/mobile/checklists/today', async (route) => {
    mobileTodayRequests += 1
    await route.fulfill({ json: mobileChecklistTodayFixture })
  })

  await page.goto('/store/checklists')

  await expect(page.getByRole('heading', { name: /rota kullan/i })).toBeVisible()
  await expect(page.getByText('/store/me')).toBeVisible()
  await expect(page.locator('.store-checklists-command-page')).toHaveCount(0)
  expect(acknowledgementRequests).toBe(0)
  expect(mobileTodayRequests).toBe(0)
})

test('store personnel cannot open approvals by direct route', async ({ page }) => {
  let targetDistributionRequests = 0

  await page.unroute('**/api/auth/session')
  await page.unroute('**/api/target-distributions/requests**')
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({
      json: {
        ...authSessionFixture,
        user: {
          ...authSessionFixture.user,
          roleCodes: ['STORE_PERSONNEL'],
          actionScope: {
            assignedStoreIds: [demoStoreId],
          },
          assignedStoreIds: [demoStoreId],
        },
      },
    })
  })
  await page.route('**/api/target-distributions/requests**', async (route) => {
    targetDistributionRequests += 1
    await route.fulfill({ json: targetDistributionRequestsFixture })
  })

  await page.goto('/store/approvals')

  await expect(page.getByRole('heading', { name: /rota kullan/i })).toBeVisible()
  await expect(page.getByText('/store/me')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Talep Merkezi' })).toHaveCount(0)
  expect(targetDistributionRequests).toBe(0)
})

test('store personnel cannot open targets by direct route', async ({ page }) => {
  let targetDistributionRequests = 0
  let targetCoverageRequests = 0
  let targetPersonnelRequests = 0

  await page.unroute('**/api/auth/session')
  await page.unroute('**/api/target-distributions/requests**')
  await page.unroute('**/api/target-distributions/coverage**')
  await page.unroute('**/api/target-distributions/store-personnel**')
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({
      json: {
        ...authSessionFixture,
        user: {
          ...authSessionFixture.user,
          roleCodes: ['STORE_PERSONNEL'],
          actionScope: {
            assignedStoreIds: [demoStoreId],
          },
          assignedStoreIds: [demoStoreId],
        },
      },
    })
  })
  await page.route('**/api/target-distributions/requests**', async (route) => {
    targetDistributionRequests += 1
    await route.fulfill({ json: targetDistributionRequestsFixture })
  })
  await page.route('**/api/target-distributions/coverage**', async (route) => {
    targetCoverageRequests += 1
    await route.fulfill({ json: targetCoverageFixture })
  })
  await page.route('**/api/target-distributions/store-personnel**', async (route) => {
    targetPersonnelRequests += 1
    await route.fulfill({ json: storeTargetingPersonnelFixture })
  })

  await page.goto('/store/targets')

  await expect(page.getByRole('heading', { name: /rota kullan/i })).toBeVisible()
  await expect(page.getByText('/store/me')).toBeVisible()
  await expect(page.locator('[data-testid="store-targets-contract-surface"]')).toHaveCount(0)
  expect(targetDistributionRequests).toBe(0)
  expect(targetCoverageRequests).toBe(0)
  expect(targetPersonnelRequests).toBe(0)
})

test('visual merchandiser lands on checklist-only shell from store root', async ({ page }) => {
  await page.unroute('**/api/auth/session')
  await page.unroute('**/api/checklists/command-canvas**')
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({
      json: {
        ...authSessionFixture,
        user: {
          ...authSessionFixture.user,
          roleCodes: ['VISUAL_MERCHANDISER'],
          actionScope: {
            assignedStoreIds: [demoStoreId],
          },
          assignedStoreIds: [demoStoreId],
        },
      },
    })
  })
  await page.route('**/api/checklists/command-canvas**', async (route) => {
    await route.fulfill({
      json: {
        data: {
          period: '2026-07',
          view: 'visual_merchandiser',
          capabilities: { weeklyVisitPlanningAvailable: false, canMaintainWeeklyVisitPlan: false },
          metrics: { totalStores: 1, needsVisit: 1, active: 0, pending: 0, completed: 0 },
          items: [{
            storeId: demoStoreId,
            storeCode: 'DEMO-1',
            storeName: 'IstinyePark Demo Store',
            regionId: demoRegionId,
            regionName: 'Marmara',
            regionManagers: [{ displayName: 'Pilot Bölge Müdürü' }],
            bmScore: null,
            vmScore: null,
            bmCompletedAt: null,
            vmCompletedAt: null,
            lastCompletedVisitAt: null,
            elapsedDaysSinceLastVisit: null,
            activeChecklistCount: 0,
            pendingAcknowledgementCount: 0,
            openActionCount: 0,
            blockedActionCount: 0,
            status: 'needs_visit',
            reasonCodes: ['missing_vm_visit'],
            lastOperationalAt: null,
          }],
          page: { total: 1, limit: 30, offset: 0, hasMore: false },
        },
      },
    })
  })

  await page.goto('/store')

  await expect(page).toHaveURL(/\/store\/checklists$/)
  await expect(page.getByRole('region', { name: 'VM checklist görünümü' })).toBeVisible()
  const storeNav = page.locator('.store-command-nav')
  await expect(storeNav).toHaveCount(0)
  await expect(storeNav.locator('a[href="/store/home"]')).toHaveCount(0)
  await expect(storeNav.locator('a[href="/store/kpis"]')).toHaveCount(0)
  await expect(storeNav.locator('a[href="/store/rankings"]')).toHaveCount(0)
  await expect(storeNav.locator('a[href="/store/approvals"]')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'VM Kontrol Merkezi' })).toBeVisible()
  await expect(page.getByText('IstinyePark Demo Store')).toBeVisible()
  await expect(page.getByText('BM Checklist')).toHaveCount(0)
  await expect(page.getByText('BM skor')).toHaveCount(0)
  await expect(page.getByText('BM görünümü')).toHaveCount(0)
  await expect(page.getByText('BM + VM')).toHaveCount(0)
  await expectHealthyStoreTransition(page)
})

test('store home keeps the command surface stable when English locale persists', async ({ page }) => {
  await page.goto('/store')

  await setStoredLocale(page, 'en')

  const storeNav = page.locator('.store-command-nav')
  const storeSidebar = page.locator('.store-command-sidebar')
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('heading', { name: 'Operasyon Paneli' })).toBeVisible()
  await expect(page.getByTestId('store-home-dashboard')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Bugünün gündemi' })).toBeVisible()
  await expect(page.getByText('Store operations run from one command surface.')).toHaveCount(0)
  await expect(page.getByText('Store performance and requests share one entry.')).toHaveCount(0)
  await expect(storeNav.getByRole('link', { name: 'Store KPIs', exact: true })).toBeVisible()
  await expect(storeNav.getByRole('link', { name: 'Turkey Ranking', exact: true })).toBeVisible()
  await expect(storeNav.getByRole('link', { name: 'Request Center', exact: true })).toBeVisible()
  await expect(storeSidebar.locator('a[href="/store/settings"]')).toBeVisible()
  await expect(page.getByText('Mağaza alanı')).toHaveCount(0)
  await expect(page.getByText('Mağaza ana sayfa Faz 1')).toHaveCount(0)
  await expect(page.getByText('Benim performansim')).toHaveCount(0)
  await expect(page.getByText('Siralamalar')).toHaveCount(0)
  await expect(page.locator('body')).not.toContainText('Ãƒ')
  await expect(page.locator('body')).not.toContainText('Ã„')
  await expect(page.locator('body')).not.toContainText('Ã…')

  await page.reload()

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('heading', { name: 'Operasyon Paneli' })).toBeVisible()
})

test('store sidebar recovers when a lazy route module fails during SPA navigation', async ({ page }) => {
  let failedFeedRouteModuleOnce = false
  await page.route(/StoreFeedPage.*\.(js|tsx)(\?.*)?$/, async (route) => {
    if (!failedFeedRouteModuleOnce) {
      failedFeedRouteModuleOnce = true
      await route.abort('failed')
      return
    }

    await route.continue()
  })

  await page.goto('/store/home')

  await page
    .locator('.store-command-nav')
    .getByRole('link', { name: 'Duyurular', exact: true })
    .click()

  await expect(page).toHaveURL(/\/store\/feed$/)
  await expect(page.getByRole('heading', { name: 'Duyurular' })).toBeVisible()
  expect(failedFeedRouteModuleOnce).toBe(true)
})

test('store sidebar retries a transient announcements API failure without leaving the user stuck', async ({ page }) => {
  const pageErrors: string[] = []
  let feedAttempts = 0

  page.on('pageerror', (error) => {
    pageErrors.push(error.message)
  })

  await page.unroute('**/api/feed?**')
  await page.route('**/api/feed?**', async (route) => {
    feedAttempts += 1

    if (feedAttempts === 1) {
      await route.fulfill({
        status: 503,
        json: { message: 'Temporary feed outage' },
      })
      return
    }

    await route.fulfill({ json: storeFeedFixture })
  })

  await page.goto('/store/home')

  await page
    .locator('.store-command-nav')
    .getByRole('link', { name: 'Duyurular', exact: true })
    .click()

  await expect(page).toHaveURL(/\/store\/feed$/)
  await expect.poll(() => feedAttempts).toBeGreaterThanOrEqual(2)
  await expect(page.getByText('Pilot store shell announcement.')).toBeVisible()
  await expect(page.getByText(/Duyurular a..lamad./i)).toHaveCount(0)
  expect(pageErrors).toEqual([])
})

test('store sidebar prefetches announcement data before opening feed', async ({ page }) => {
  let feedRequests = 0

  await page.unroute('**/api/feed?**')
  await page.route('**/api/feed?**', async (route) => {
    feedRequests += 1
    await route.fulfill({ json: storeFeedFixture })
  })

  await page.goto('/store/home')

  const feedLink = page
    .locator('.store-command-nav')
    .getByRole('link', { name: 'Duyurular', exact: true })
  await expect(feedLink).toBeVisible()
  expect(feedRequests).toBe(0)

  await feedLink.hover()

  await expect.poll(() => feedRequests).toBeGreaterThanOrEqual(1)
  const prefetchedFeedRequests = feedRequests

  await feedLink.click()

  await expect(page).toHaveURL(/\/store\/feed$/)
  await expect(page.getByText('Pilot store shell announcement.')).toBeVisible()
  await expect.poll(() => feedRequests, { timeout: 1000 }).toBe(prefetchedFeedRequests)
})

test('store feed switches owned product copy to English and preserves source posts', async ({ page }) => {
  await page.goto('/store/feed')
  await setStoredLocale(page, 'en')

  await expect(page.getByRole('heading', { name: 'Announcements' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Refresh' })).toBeVisible()
  await expect(page.getByText('Region feed')).toBeVisible()
  await expect(page.getByText('Pilot store shell announcement.')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Duyurular' })).toHaveCount(0)

  await setStoredLocale(page, 'tr')
  await expect(page.getByRole('heading', { name: 'Duyurular' })).toBeVisible()
  await expect(page.getByText('Pilot store shell announcement.')).toBeVisible()
})

test('store sidebar transitions across visible manager pages without requiring manual refresh', async ({ page }) => {
  const storeNav = page.locator('.store-command-nav')
  await page.goto('/store/home')

  await verifyStoreNavTransition(page, storeNav, {
    linkName: 'Mağaza KPI',
    path: '/store/kpis',
    ready: page.getByRole('heading', { name: 'IstinyePark Demo Store' }),
  })
  await verifyStoreNavTransition(page, storeNav, {
    linkName: 'Türkiye Sıralaması',
    path: '/store/rankings',
    ready: page.getByRole('heading', { name: 'Sıralamalar' }),
  })
  await verifyStoreNavTransition(page, storeNav, {
    linkName: 'Talep Merkezi',
    path: '/store/approvals',
    ready: page.getByRole('heading', { name: 'Talep Merkezi' }),
  })
  await verifyStoreNavTransition(page, storeNav, {
    linkName: 'Görevler',
    path: '/store/tasks',
    ready: page.getByRole('heading', { name: 'Görevler' }),
  })
  await verifyStoreNavTransition(page, storeNav, {
    linkName: 'Duyurular',
    path: '/store/feed',
    ready: page.getByRole('heading', { name: 'Duyurular' }),
  })
  await verifyStoreNavTransition(page, storeNav, {
    linkName: 'Ana Sayfa',
    path: '/store/home',
    ready: page.getByRole('heading', { name: 'Operasyon Paneli' }),
  })

  await expectHealthyStoreTransition(page)
})

test('store settings utility pages show honest preferences and stay mobile-safe', async ({ page }) => {
  await routeStoreManagerTargetCommand(page)
  await page.goto('/store/settings')

  await expect(page.getByRole('heading', { name: 'Profil ve ayarlar' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Kullanıcı profili' })).toBeVisible()
  await page.getByRole('button', { name: 'Tercihler' }).click()
  await expect(page.getByRole('heading', { name: 'Uygulama tercihleri' })).toBeVisible()
  await expect(page.getByRole('group', { name: 'Dil seçimi' })).toBeVisible()
  const settingsOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(settingsOverflow).toBeLessThanOrEqual(1)

  await page.goto('/store/targets')

  await expect(page.locator('[data-command-canvas-page].target-store-manager-page')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Mall of İstanbul' })).toBeVisible()
  await expect(page.getByText('Hedef dağıtım günü', { exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: /Hedef ak/i })).toHaveCount(0)
  await expect(page.getByText('/admin/targets')).toHaveCount(0)

  await page.goto('/store/reports')

  await expect(page.getByRole('heading', { name: /rota kullan|Route not available/i })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Raporlar' })).toHaveCount(0)

  await page.setViewportSize({ width: 390, height: 900 })
  await page.reload()

  await expect(page.getByRole('heading', { name: /rota kullan|Route not available/i })).toBeVisible()
  await expect.poll(
    () => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
  ).toBe(true)
})

test('store reports package is visible for region managers and stays mobile-safe', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-06-29T12:00:00.000Z'))
  await routeAuthSession(page, createStoreAuthSession({
    roleCodes: ['REGION_MANAGER'],
    readStoreIds: [demoStoreId, regionSecondStoreId],
    readRegionIds: [demoRegionId],
    scopeStoreIds: [],
    scopeRegionIds: [demoRegionId],
    actionStoreIds: [],
    legacyAssignedStoreIds: [],
  }))

  await page.goto('/store/reports')

  await expect(page.getByRole('heading', { name: 'Raporlar' })).toBeVisible()
  await expect(page.getByRole('heading', { name: /Mağaza İzleyiş Exceli/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /Excel indir/i })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Dönem seç' })).toContainText('Haziran 2026')
  await expect(page.getByText('Raporları aç')).toHaveCount(0)
  await expect(page.getByText('/admin/reports')).toHaveCount(0)

  await page.setViewportSize({ width: 390, height: 900 })
  await page.reload()

  await expect(page.getByRole('heading', { name: 'Raporlar' })).toBeVisible()
  await expect.poll(
    () => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
  ).toBe(true)
  await expect.poll(() =>
    page.evaluate(() => {
      const nav = document.querySelector<HTMLElement>('.store-command-sidebar')
      if (!nav) {
        return false
      }

      const navBox = nav.getBoundingClientRect()
      return navBox.top >= 0 && navBox.bottom <= window.innerHeight
    }),
  ).toBe(true)
  await expect.poll(() =>
    page.evaluate(() => {
      const nav = document.querySelector<HTMLElement>('.store-command-sidebar')
      if (!nav) {
        return false
      }

      return window.getComputedStyle(nav).position !== 'fixed'
    }),
  ).toBe(true)
  await expect(page.getByText('KPI kolonları')).toBeVisible()
})

test('store reports switches owned package copy to English', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-06-29T12:00:00.000Z'))
  await routeAuthSession(page, createStoreAuthSession({
    roleCodes: ['REGION_MANAGER'],
    readStoreIds: [demoStoreId, regionSecondStoreId],
    readRegionIds: [demoRegionId],
    scopeStoreIds: [],
    scopeRegionIds: [demoRegionId],
    actionStoreIds: [],
    legacyAssignedStoreIds: [],
  }))
  await page.goto('/store/reports')
  await setStoredLocale(page, 'en')

  await expect(page.getByRole('heading', { name: 'Reports' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Download Excel/i })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Package contents' })).toBeVisible()
  await expect(page.getByText('KPI kolonları')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Raporlar' })).toHaveCount(0)

  await setStoredLocale(page, 'tr')
  await expect(page.getByRole('heading', { name: 'Raporlar' })).toBeVisible()
  await expect(page.getByText('KPI kolonları')).toBeVisible()
})

test('store route navigation does not blank the shell with a global transition layer', async ({ page }) => {
  const storeNav = page.locator('.store-command-nav')
  await page.goto('/store/home')

  await expect(page.locator('.store-command-home')).toBeVisible()

  await page.evaluate(() => {
    const marker = '__storeRouteTransitionSeen'
    ;(window as Window & Record<typeof marker, boolean>)[marker] = Boolean(
      document.querySelector('[data-testid="route-transition"]'),
    )
    const observer = new MutationObserver(() => {
      if (document.querySelector('[data-testid="route-transition"]')) {
        ;(window as Window & Record<typeof marker, boolean>)[marker] = true
      }
    })
    observer.observe(document.body, { childList: true, subtree: true })
  })

  await storeNav.getByRole('link', { name: 'Duyurular', exact: true }).click()

  await expect(page).toHaveURL(/\/store\/feed$/)
  await expect(page.getByText('Pilot store shell announcement.')).toBeVisible()
  await expect.poll(() =>
    page.evaluate(() => (window as Window & { __storeRouteTransitionSeen?: boolean }).__storeRouteTransitionSeen ?? false),
  ).toBe(false)
  await expectHealthyStoreTransition(page)
})
