import { expect, test } from './test-fixtures'
import { setStoredLocale } from './locale-test-utils'
import { demoStoreId, checklistCommandInstanceId, demoRegionId, regionSecondStoreId, outsideStoreId } from './store-surfaces-identities'
import { routeRequestCenter, createStoreAuthSession, routeAuthSession, createTaskWorkspaceFixture, routeStoreSurfaceApi } from './store-surfaces-api-fixtures'
import { authSessionFixture, checklistAcknowledgementsFixture } from './store-surfaces-profile-fixtures'
import { competitionFixture, targetDistributionRequestsFixture, pendingTargetDistributionRequestsFixture, sellerCodeRequestFixture, offboardingRequestFixture, rejectedSellerCodeRequestFixture, rejectedOffboardingRequestFixture, competitionDetailFixture } from './store-surfaces-operations-fixtures'

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

test('store tasks page renders readable Turkish queue labels', async ({ page }) => {
  await page.goto('/store/tasks')

  await expect(page.getByRole('heading', { name: 'Görevler', exact: true })).toBeVisible()
  await expect(page.getByText('Aksiyonları başlatın, takip edin ve sonucu kaydedin.')).toBeVisible()
  await expect(page.getByText('Detay ozeti')).toHaveCount(0)
  await expect(page.getByText('Görev sayısı')).toBeVisible()
  await expect(page.getByTestId('store-action-plans-panel')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Hedef' })).toHaveCount(0)
  await expect(page.getByText('Store Action İş Akışı')).toHaveCount(0)
  await expect(page.getByText('Mağaza aksiyon listesi')).toHaveCount(0)
  await expect(page.locator('body')).not.toContainText('Ã')
  await expect(page.locator('body')).not.toContainText('Ä')
  await expect(page.locator('body')).not.toContainText('Å')
})

test('store tasks lets managers retry after the queue load fails', async ({ page }) => {
  let workspaceAttempts = 0
  let allowWorkspace = false

  await page.unroute('**/api/store/tasks/workspace**')
  await page.route('**/api/store/tasks/workspace**', async (route) => {
    workspaceAttempts += 1

    if (!allowWorkspace) {
      await route.fulfill({
        status: 503,
        json: { message: 'Temporary task workspace outage' },
      })
      return
    }

    await route.fulfill({ json: { data: createTaskWorkspaceFixture() } })
  })

  await page.goto('/store/tasks')

  await expect(page.getByText('Görevler açılamadı', { exact: true })).toBeVisible()
  const retryButton = page.getByRole('button', { name: 'Tekrar dene' })
  await expect(retryButton).toBeVisible()

  allowWorkspace = true
  await retryButton.click()

  await expect(page.getByRole('heading', { name: 'Görevler', exact: true })).toBeVisible()
  await expect.poll(() => workspaceAttempts).toBeGreaterThan(1)
  await expect(page.getByText('Görevler açılamadı', { exact: true })).toHaveCount(0)
})

test('store tasks command-center copy stays stable when locale changes', async ({ page }) => {
  await page.goto('/store/tasks')

  await setStoredLocale(page, 'en')

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('heading', { name: 'Görevler', exact: true })).toBeVisible()
  await expect(page.getByText('Görev sayısı')).toBeVisible()
  await expect(page.getByTestId('store-action-plans-panel')).toBeVisible()
  await expect(page.getByText('Store Action workflow')).toHaveCount(0)
  await expect(page.getByText('Store action list')).toHaveCount(0)
  await expect(page.getByText('Aksiyon gerektiren işler')).toHaveCount(0)
  await expect(page.getByText('Detay özeti')).toHaveCount(0)
  await expect(page.locator('body')).not.toContainText('Ãƒ')
  await expect(page.locator('body')).not.toContainText('Ã„')
  await expect(page.locator('body')).not.toContainText('Ã…')

  await page.reload()

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('heading', { name: 'Görevler', exact: true })).toBeVisible()
})

test('store tasks checklist acknowledgement opens the exact checklist receipt', async ({ page }) => {
  let acknowledgementRequests = 0

  await page.addInitScript(() => {
    window.localStorage.setItem('store-ops-app-locale', 'en')
  })
  await page.unroute('**/api/auth/session')
  await page.unroute('**/api/workflow/inbox')
  await page.unroute('**/api/checklists/acknowledgements/list')
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({
      json: {
        ...authSessionFixture,
        user: {
          ...authSessionFixture.user,
            roleCodes: ['STORE_MANAGER'],
        },
      },
    })
  })
  await page.route('**/api/workflow/inbox', async (route) => {
    await route.fulfill({
      json: {
        items: [
          {
            itemType: 'acknowledgement',
            sourceType: 'checklist_receipt',
            sourceId: checklistCommandInstanceId,
            title: 'BM Result',
            summary: 'IstinyePark Demo Store completed checklist result',
            storeId: demoStoreId,
            storeName: 'IstinyePark Demo Store',
            workflowStatus: 'completed',
            inboxStatus: 'needs_attention',
            urgency: 'medium',
            createdAt: '2026-05-12T09:00:00.000Z',
            needsAttentionAt: '2026-05-12T09:00:00.000Z',
            actorRole: 'STORE_MANAGER',
            primaryActionLabel: 'I acknowledge',
            secondaryActionLabel: 'Open checklist result',
            deepLink: `/store/checklists?overlay=result&checklistInstanceId=${checklistCommandInstanceId}&storeId=${demoStoreId}&workflowTab=inbox`,
          },
        ],
        meta: {
          count: 1,
          total: 1,
          limit: 30,
          offset: 0,
        },
      },
    })
  })
  await page.route('**/api/checklists/acknowledgements/list', async (route) => {
    acknowledgementRequests += 1
    await route.fulfill({
      json: {
        ...checklistAcknowledgementsFixture,
        items: checklistAcknowledgementsFixture.items.map((item) =>
          item.checklistInstanceId === 'checklist-instance-bm-1'
            ? { ...item, checklistInstanceId: checklistCommandInstanceId }
            : item,
        ),
      },
    })
  })

  await page.goto('/store/tasks')
  await page.getByTestId('store-task-queue-row').filter({ hasText: 'BM Result' }).click()
  await page.getByRole('dialog', { name: 'Görev detayı' }).getByRole('link', { name: 'Kaynağı aç' }).click()

  await expect.poll(() => acknowledgementRequests).toBeGreaterThanOrEqual(1)
  await expect(page).toHaveURL(new RegExp(`/store/checklists\\?overlay=result&checklistInstanceId=${checklistCommandInstanceId}&storeId=${demoStoreId}&workflowTab=inbox$`))
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByRole('dialog')).toContainText('Checklist result')
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'BM Result' })).toBeVisible()

  await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click()

  await expect(page).toHaveURL(new RegExp(`/store/checklists\\?overlay=workflow&storeId=${demoStoreId}&workflowTab=inbox$`))
  await expect(page.getByRole('dialog', { name: 'Checklist workflow' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Result acknowledgement' })).toBeVisible()

  await page.getByRole('button', { name: 'View details' }).click()

  await expect(page).toHaveURL(new RegExp(`/store/checklists\\?overlay=result&checklistInstanceId=${checklistCommandInstanceId}&storeId=${demoStoreId}&workflowTab=inbox$`))
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'BM Result' })).toBeVisible()
})

test('store tasks keeps target approvals out of the command center', async ({ page }) => {
  let targetDistributionRequests = 0

  await page.unroute('**/api/workflow/inbox')
  await page.unroute('**/api/target-distributions/requests**')
  await page.route('**/api/workflow/inbox', async (route) => {
    await route.fulfill({
      json: {
        items: [
          {
            itemType: 'approval',
            sourceType: 'target_distribution_request',
            sourceId: 'target-request-prefetch-1',
            title: 'Mayis hedef dagitimi',
            summary: 'IstinyePark Demo Store icin hedef onayi bekliyor',
            storeId: demoStoreId,
            storeName: 'IstinyePark Demo Store',
            workflowStatus: 'pending_region_approval',
            inboxStatus: 'needs_attention',
            urgency: 'medium',
            createdAt: '2026-05-12T09:00:00.000Z',
            needsAttentionAt: '2026-05-12T09:00:00.000Z',
            actorRole: 'STORE_MANAGER',
            primaryActionLabel: 'Talebi ac',
            secondaryActionLabel: 'Onay yuzeyine git',
            deepLink: '/store/approvals',
          },
        ],
        meta: {
          count: 1,
          total: 1,
          limit: 30,
          offset: 0,
        },
      },
    })
  })
  await page.route('**/api/target-distributions/requests**', async (route) => {
    if (route.request().method() === 'GET') {
      targetDistributionRequests += 1
      await route.fulfill({ json: targetDistributionRequestsFixture })
      return
    }

    await route.fulfill({
      status: 403,
      json: { message: 'Target distribution write route is not mocked in this surface test.' },
    })
  })

  await page.goto('/store/tasks')

  await expect(page.getByText('Mayis hedef dagitimi')).toHaveCount(0)
  await expect(page.getByTestId('store-action-plans-panel').locator('a[href="/store/approvals"]')).toHaveCount(0)
  await expect.poll(() => targetDistributionRequests, { timeout: 1000 }).toBe(0)
})

test('store checklist acknowledgement refreshes the store task queue', async ({ page }) => {
  const checklistInstanceId = '44444444-4444-4444-8444-444444444444'
  await page.addInitScript(() => {
    window.localStorage.setItem('store-ops-app-locale', 'en')
  })
  await page.unroute('**/api/auth/session')
  await page.unroute('**/api/workflow/inbox')
  await page.unroute('**/api/checklists/acknowledgements/list')
  let acknowledged = false
  let workflowInboxRequests = 0

  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({
      json: {
        ...authSessionFixture,
        user: {
          ...authSessionFixture.user,
          roleCodes: ['STORE_MANAGER'],
        },
      },
    })
  })
  await page.route('**/api/workflow/inbox', async (route) => {
    workflowInboxRequests += 1
    await route.fulfill({
      json: {
        items: acknowledged
          ? []
          : [
              {
                itemType: 'acknowledgement',
                sourceType: 'checklist_receipt',
                sourceId: checklistInstanceId,
                title: 'BM Result',
                summary: 'IstinyePark Demo Store completed checklist result',
                storeId: demoStoreId,
                storeName: 'IstinyePark Demo Store',
                workflowStatus: 'completed',
                inboxStatus: 'needs_attention',
                urgency: 'medium',
                createdAt: '2026-05-12T09:00:00.000Z',
                needsAttentionAt: '2026-05-12T09:00:00.000Z',
                actorRole: 'STORE_MANAGER',
                primaryActionLabel: 'I acknowledge',
                secondaryActionLabel: 'Open checklist result',
                deepLink: `/store/checklists?overlay=result&checklistInstanceId=${checklistInstanceId}&storeId=${demoStoreId}&workflowTab=inbox`,
              },
            ],
        meta: {
          count: acknowledged ? 0 : 1,
          total: acknowledged ? 0 : 1,
          limit: 30,
          offset: 0,
        },
      },
    })
  })
  await page.route('**/api/checklists/acknowledgements/list', async (route) => {
    await route.fulfill({
      json: {
        ...checklistAcknowledgementsFixture,
        items: checklistAcknowledgementsFixture.items.map((item) =>
          item.checklistInstanceId === 'checklist-instance-bm-1'
            ? {
                ...item,
                checklistInstanceId,
                acknowledgement: acknowledged
                  ? {
                      checklistAcknowledgementId: 'checklist-ack-bm-1',
                      acknowledgedByUserId: 'store-manager-1',
                      acknowledgementNote: 'Store saw the completed visit',
                      acknowledgedAt: '2026-05-12T11:00:00.000Z',
                    }
                  : null,
              }
            : item,
        ),
      },
    })
  })
  await page.route('**/api/checklists/instances/*/acknowledge', async (route) => {
    expect(route.request().method()).toBe('POST')
    acknowledged = true
    await route.fulfill({
      json: {
        command: { status: 'acknowledged', message: 'Checklist instance acknowledged' },
        data: {
          acknowledgement: {
            checklistAcknowledgementId: 'checklist-ack-bm-1',
            acknowledgedByUserId: 'store-manager-1',
            acknowledgementNote: 'Store saw the completed visit',
            acknowledgedAt: '2026-05-12T11:00:00.000Z',
          },
        },
      },
    })
  })
  await page.route('**/api/checklists/command-canvas?**', async (route) => {
    await route.fulfill({
      json: {
        data: {
          period: '2026-07',
          view: 'store_manager',
          capabilities: { weeklyVisitPlanningAvailable: false, canMaintainWeeklyVisitPlan: false },
          metrics: { totalStores: 1, needsVisit: 0, active: 0, pending: 1, completed: 0 },
          items: [{
            storeId: demoStoreId,
            storeCode: 'DEMO-1',
            storeName: 'IstinyePark Demo Store',
            regionId: 'region-1',
            regionName: 'Marmara',
            bmScore: 86,
            vmScore: null,
            lastCompletedVisitAt: '2026-05-12T09:00:00.000Z',
            elapsedDaysSinceLastVisit: 64,
            status: 'pending',
            pendingAcknowledgementCount: acknowledged ? 0 : 1,
            openActionCount: 0,
          }],
          page: { total: 1, limit: 30, offset: 0, hasMore: false },
        },
      },
    })
  })

  await page.goto('/store/tasks')
  await expect(page.getByTestId('store-task-queue-row').filter({ hasText: 'BM Result' })).toBeVisible()
  expect(workflowInboxRequests).toBeGreaterThanOrEqual(1)
  const workflowRequestsBeforeAcknowledgement = workflowInboxRequests

  await page.getByTestId('store-task-queue-row').filter({ hasText: 'BM Result' }).click()
  await page.getByRole('dialog', { name: 'Görev detayı' }).getByRole('link', { name: 'Kaynağı aç' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'I acknowledge' }).click()
  await expect(page).toHaveURL(new RegExp(`/store/checklists\\?overlay=workflow&storeId=${demoStoreId}&workflowTab=history$`))
  await expect(page.getByRole('dialog', { name: 'Checklist workflow' })).toBeVisible()

  await page.goto('/store/tasks')

  await expect.poll(() => workflowInboxRequests).toBeGreaterThan(workflowRequestsBeforeAcknowledgement)
  await expect(page.getByTestId('store-task-queue-row').filter({ hasText: 'BM Result' })).toHaveCount(0)
})

test('store incentives unavailable state switches to English copy and persists locale', async ({ page }) => {
  await page.goto('/store/incentives')
  const incentiveSurface = page.getByTestId('store-incentives-page')

  await expect(incentiveSurface).toHaveCount(0)
  await expect(page.getByRole('heading', { name: /rota kullan/i })).toBeVisible()
  await expect(page.getByText('Store Incentives')).toHaveCount(0)

  await setStoredLocale(page, 'en')

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('heading', { name: /Route not available/i })).toBeVisible()
  await expect(page.getByText('Mağaza primleri')).toHaveCount(0)
  await expect(page.locator('body')).not.toContainText('Ãƒ')
  await expect(page.locator('body')).not.toContainText('Ã„')
  await expect(page.locator('body')).not.toContainText('Ã…')

  await page.reload()

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('heading', { name: /Route not available/i })).toBeVisible()
})

test('store competitions page renders visible contribution details', async ({ page }) => {
  await page.goto('/store/competitions')

  await expect(page.getByRole('heading', { name: /Mağaza yarışmaları/i })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'April Region Challenge' }).first()).toBeVisible()
  const readSummary = page.getByLabel('Mağaza yarışma okuma özeti')
  const contributionRows = page.getByLabel('Yetkili mağaza yarışma katkıları')
  await expect(readSummary.getByText('Okuma özeti')).toBeVisible()
  await expect(readSummary.getByText('95% katkı kapsamı')).toBeVisible()
  await expect(contributionRows.getByText('Katkı sağlığı')).toBeVisible()
  await expect(contributionRows.getByText('Kısmi katkı').first()).toBeVisible()
  await expect(contributionRows.getByText('BM checklist', { exact: true })).toBeVisible()
  await expect(page.getByText('Mağaza katkıları')).toBeVisible()
  await expect(page.getByText('IstinyePark Demo Store')).toBeVisible()
  await expect(page.getByText('93.50')).toBeVisible()
  await expect(page.getByText('Outside Region Store')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Recalculate/ })).toHaveCount(0)
})

test('store competitions lets store users retry after the detail load fails', async ({ page }) => {
  let detailAttempts = 0
  let allowCompetitionDetail = false

  await page.unroute('**/api/competitions**')
  await page.route('**/api/competitions**', async (route) => {
    const request = route.request()
    const pathname = new URL(request.url()).pathname

    if (request.method() === 'GET' && pathname.endsWith('/api/competitions')) {
      await route.fulfill({
        json: {
          items: [competitionFixture],
          meta: { count: 1, total: 1, limit: 50, offset: 0 },
        },
      })
      return
    }

    if (
      request.method() === 'GET' &&
      pathname.endsWith(`/api/competitions/${competitionFixture.competitionId}`)
    ) {
      detailAttempts += 1

      if (!allowCompetitionDetail) {
        await route.fulfill({
          status: 503,
          json: { message: 'Temporary competition detail outage' },
        })
        return
      }

      await route.fulfill({ json: competitionDetailFixture })
      return
    }

    await route.fulfill({
      status: 403,
      json: { message: 'Store competition surface is read-only' },
    })
  })

  await page.goto('/store/competitions')

  await expect(page.getByRole('heading', { name: 'Sıralama açılamadı' })).toBeVisible()
  const retryButton = page.getByRole('button', { name: 'Tekrar dene' })
  await expect(retryButton).toBeVisible()

  allowCompetitionDetail = true
  await retryButton.click()

  await expect(page.getByLabel('Mağaza yarışma okuma özeti').getByText('Okuma özeti')).toBeVisible()
  await expect.poll(() => detailAttempts).toBeGreaterThan(1)
  await expect(page.getByRole('heading', { name: 'Sıralama açılamadı' })).toHaveCount(0)
})

test('store competitions page localizes lifecycle states and competition types', async ({ page }) => {
  const competitionSummaries = [
    competitionFixture,
    {
      ...competitionFixture,
      competitionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa02',
      competitionCode: 'MAY_REGION_LEAGUE',
      competitionName: 'May Region League',
      competitionType: 'region_league',
      lifecycleState: 'published',
    },
    {
      ...competitionFixture,
      competitionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa03',
      competitionCode: 'SUMMER_CAMPAIGN',
      competitionName: 'Summer Campaign',
      competitionType: 'campaign',
      lifecycleState: 'completed',
    },
  ]

  await page.unroute('**/api/competitions**')
  await page.route('**/api/competitions**', async (route) => {
    const request = route.request()
    const pathname = new URL(request.url()).pathname

    if (request.method() === 'GET' && pathname.endsWith('/api/competitions')) {
      await route.fulfill({
        json: {
          items: competitionSummaries,
          meta: {
            count: competitionSummaries.length,
            total: competitionSummaries.length,
            limit: 50,
            offset: 0,
          },
        },
      })
      return
    }

    if (
      request.method() === 'GET' &&
      pathname.endsWith(`/api/competitions/${competitionFixture.competitionId}`)
    ) {
      await route.fulfill({ json: competitionDetailFixture })
      return
    }

    await route.fulfill({
      status: 403,
      json: { message: 'Store competition surface is read-only' },
    })
  })

  await page.goto('/store/competitions')

  const leagueRow = page.locator('article').filter({ hasText: 'May Region League' })
  const campaignRow = page.locator('article').filter({ hasText: 'Summer Campaign' })
  await expect(leagueRow.getByText('yayında', { exact: true })).toBeVisible()
  await expect(leagueRow.getByText('bölge ligi', { exact: true })).toBeVisible()
  await expect(campaignRow.getByText('tamamlandı', { exact: true })).toBeVisible()
  await expect(campaignRow.getByText('kampanya', { exact: true })).toBeVisible()
  await expect(page.locator('body')).not.toContainText('published')
  await expect(page.locator('body')).not.toContainText('completed')
  await expect(page.locator('body')).not.toContainText('region_league')
})

test('store competitions page switches chrome to English copy and persists locale', async ({
  page,
}) => {
  await page.goto('/store/competitions')

  await expect(page.getByRole('heading', { name: /Mağaza yarışmaları/i })).toBeVisible()
  await expect(page.getByText('Görünür yarışmalar')).toBeVisible()
  await expect(page.getByText('Sadece okuma')).toBeVisible()
  await expect(page.getByRole('button', { name: 'İncele' }).first()).toBeVisible()
  await expect(page.getByText('Store competitions')).toHaveCount(0)
  await expect(page.locator('body')).not.toContainText('Ã')
  await expect(page.locator('body')).not.toContainText('Ä')
  await expect(page.locator('body')).not.toContainText('Å')

  await setStoredLocale(page, 'en')

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('heading', { name: /Store competitions/i })).toBeVisible()
  await expect(page.getByText('Visible challenges')).toBeVisible()
  await expect(page.getByText('Read only')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Review' }).first()).toBeVisible()
  await expect(page.getByText('Team standing', { exact: true })).toBeVisible()
  await expect(page.getByText('Contribution rows').first()).toBeVisible()
  await expect(page.getByText('Mağaza yarışmaları')).toHaveCount(0)

  await page.reload()

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('heading', { name: /Store competitions/i })).toBeVisible()
})

test('store approvals page renders request center without creation forms', async ({ page }) => {
  await page.goto('/store/approvals')

  await expect(page.getByRole('heading', { name: 'Talep Merkezi' })).toBeVisible()
  await expect(page.getByRole('tab', { name: /Aktif talepler/ })).toBeVisible()
  await expect(page.getByRole('tab', { name: /Tamamlanan/ })).toBeVisible()
  await expect(page.getByLabel('Hedef dağıtım talebi formu')).toHaveCount(0)
  await expect(page.getByLabel('Satıcı kodu talebi formu')).toHaveCount(0)
  await expect(page.getByLabel('Personel çıkış talebi formu')).toHaveCount(0)
  await expect(page.locator('.store-approvals-ledger-grid')).toHaveCount(0)
  await expect(page.locator('.store-approvals-ledger-table')).toHaveCount(0)
  await expect(page.locator('.store-approvals-action-workbench')).toHaveCount(0)
})

test('store approvals mobile canvas keeps request history inline and read-only', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 })
  const writes: string[] = []
  page.on('request', (request) => {
    if (request.url().includes('/api/workflow/request-center') && request.method() !== 'GET') {
      writes.push(request.method())
    }
  })
  await routeRequestCenter(page, [{
    requestId: 'mobile-request-1', requestType: 'target', storeId: demoStoreId,
    storeName: 'Mobil Mağaza', status: 'pending_region_approval',
    createdAt: '2026-07-10T09:00:00.000Z', updatedAt: '2026-07-12T09:00:00.000Z',
    waitingSince: '2026-07-10T09:00:00.000Z', nextOwner: 'region',
    dueAt: '2026-07-12T09:00:00.000Z', isOverdue: true,
    events: [
      { eventId: 'mobile-event-2', type: 'returned', occurredAt: '2026-07-11T09:00:00.000Z', actorDisplayName: 'Mert Yalçın' },
      { eventId: 'mobile-event-1', type: 'created', occurredAt: '2026-07-10T09:00:00.000Z', actorDisplayName: null },
    ],
    eventTotal: 21,
    targetLabel: 'Temmuz hedefi', requestMonth: '2026-07-01', allocationCount: 4,
    approvalMode: null, personDisplayName: null, nationalIdLast4: null, externalEmployeeRef: null,
  }])

  await page.goto('/store/approvals')
  await expect(page.getByRole('button', { name: /Geciken/ })).toBeVisible()
  await page.getByRole('button', { name: /Geciken/ }).click()
  const row = page.locator('[data-testid="store-approvals-request-row"]:visible').first()
  await expect(row).toBeVisible()
  await row.click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('region', { name: /Temmuz hedefi · İşlem geçmişi/ })).toBeVisible()
  const history = page.getByRole('region', { name: /Temmuz hedefi · İşlem geçmişi/ })
  await expect(history.getByText('Talep oluşturuldu')).toBeVisible()
  await expect(history.getByText('Son 20 işlem gösteriliyor (21 toplam)')).toBeVisible()
  await row.click()
  await expect(page.getByRole('region', { name: /Temmuz hedefi · İşlem geçmişi/ })).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  expect(writes).toEqual([])
})

test('store approvals page keeps region manager request center free of workforce queues', async ({ page }) => {
  await page.unroute('**/api/auth/session')
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({
      json: {
        ...authSessionFixture,
        user: {
          ...authSessionFixture.user,
          roleCodes: ['REGION_MANAGER'],
          actionScope: {
            assignedStoreIds: [demoStoreId],
          },
          assignedStoreIds: [demoStoreId],
        },
      },
    })
  })

  const workforceCalls: string[] = []
  await page.unroute('**/api/workforce/seller-code-requests**')
  await page.route('**/api/workforce/seller-code-requests**', async (route) => {
    workforceCalls.push(route.request().url())
    await route.fulfill({
      status: 403,
      json: { message: 'Region manager must not request seller-code queues here.' },
    })
  })
  await page.unroute('**/api/workforce/offboarding-requests**')
  await page.route('**/api/workforce/offboarding-requests**', async (route) => {
    workforceCalls.push(route.request().url())
    await route.fulfill({
      status: 403,
      json: { message: 'Region manager must not request offboarding queues here.' },
    })
  })

  await page.goto('/store/approvals')

  await expect(page.getByRole('heading', { name: 'Talep Merkezi' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'SM' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'BM' })).toHaveCount(0)
  await expect(page.getByLabel('Satıcı kodu talebi formu')).toHaveCount(0)
  await expect(page.getByLabel('Personel çıkış talebi formu')).toHaveCount(0)
  await expect(page.getByLabel('İade edilen personel talepleri')).toHaveCount(0)
  expect(workforceCalls).toEqual([])
})

test('store approvals report viewer reads company-scoped manager and store hierarchy', async ({ page }) => {
  await page.unroute('**/api/auth/session')
  await page.route('**/api/auth/session', async (route) => route.fulfill({ json: {
    ...authSessionFixture,
    user: { ...authSessionFixture.user, roleCodes: ['REPORT_VIEWER'], actionScope: { assignedStoreIds: [] }, assignedStoreIds: [] },
  } }))
  await routeRequestCenter(page, [{
    requestId: 'viewer-request-1', requestType: 'target', storeId: demoStoreId,
    storeName: 'Viewer Store', regionId: demoRegionId, regionName: 'Marmara', regionManagerNames: ['Mert Yalçın', 'Ayşe Demir'],
    status: 'pending_region_approval', createdAt: '2026-07-10T09:00:00.000Z', updatedAt: '2026-07-10T09:00:00.000Z',
    waitingSince: '2026-07-10T09:00:00.000Z', nextOwner: 'region', dueAt: '2026-07-12T09:00:00.000Z', isOverdue: false,
    events: [], eventTotal: 0, targetLabel: 'Viewer target', requestMonth: '2026-07-01', allocationCount: 2,
    approvalMode: null, personDisplayName: null, nationalIdLast4: null, externalEmployeeRef: null,
  }, {
    requestId: 'viewer-request-2', requestType: 'offboarding', storeId: regionSecondStoreId,
    storeName: 'Second Region Store', regionId: '00000000-0000-0000-0000-000000000020', regionName: 'Ege', regionManagerNames: ['Can Kaya'],
    status: 'pending_hr_approval', createdAt: '2026-07-11T09:00:00.000Z', updatedAt: '2026-07-11T09:00:00.000Z',
    waitingSince: '2026-07-11T09:00:00.000Z', nextOwner: 'hr', dueAt: '2026-07-14T09:00:00.000Z', isOverdue: false,
    events: [], eventTotal: 0, targetLabel: null, requestMonth: null, allocationCount: null,
    approvalMode: null, personDisplayName: 'Safe Person', nationalIdLast4: null, externalEmployeeRef: 'EMP-2',
  }])
  await page.route('**/api/org/region-managers', async (route) => route.fulfill({ json: { items: [
    { userId: 'manager-mert', displayName: 'Mert Yalçın', storeIds: [demoStoreId] },
    { userId: 'manager-ayse', displayName: 'Ayşe Demir', storeIds: [demoStoreId] },
    { userId: 'manager-can', displayName: 'Can Kaya', storeIds: [regionSecondStoreId] },
  ] } }))

  await page.goto('/store/approvals')
  await expect(page.getByRole('heading', { name: 'Şirket talepleri' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Mert Yalçın.*1 sorumlu mağaza/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Ayşe Demir.*1 sorumlu mağaza/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Can Kaya.*1 sorumlu mağaza/ })).toBeVisible()
  await expect(page.locator('[data-testid="store-approvals-request-row"]:visible')).toHaveCount(2)
  await expect(page.getByLabel('Hedef dağıtım talebi formu')).toHaveCount(0)
})

test('store approvals keeps assigned manager identity when the directory response is empty', async ({ page }) => {
  await page.unroute('**/api/auth/session')
  await page.route('**/api/auth/session', async (route) => route.fulfill({ json: {
    ...authSessionFixture,
    user: { ...authSessionFixture.user, roleCodes: ['REPORT_VIEWER'], actionScope: { assignedStoreIds: [] }, assignedStoreIds: [] },
  } }))
  await routeRequestCenter(page, [{
    requestId: 'viewer-request-fallback', requestType: 'target', storeId: demoStoreId,
    storeName: 'Viewer Store', regionId: demoRegionId, regionName: 'Marmara', regionManagerNames: ['Mert Yalçın'],
    status: 'pending_region_approval', createdAt: '2026-07-10T09:00:00.000Z', updatedAt: '2026-07-10T09:00:00.000Z',
    waitingSince: '2026-07-10T09:00:00.000Z', nextOwner: 'region', dueAt: '2026-07-12T09:00:00.000Z', isOverdue: false,
    events: [], eventTotal: 0, targetLabel: 'Viewer target', requestMonth: '2026-07-01', allocationCount: 2,
    approvalMode: null, personDisplayName: null, nationalIdLast4: null, externalEmployeeRef: null,
  }])
  await page.route('**/api/org/region-managers', async (route) => route.fulfill({ json: { items: [] } }))

  await page.goto('/store/approvals')

  await expect(page.getByRole('button', { name: /Mert Yalçın.*1 sorumlu mağaza/ })).toBeVisible()
  await expect(page.getByText('Bölge yöneticisi tanımsız')).toHaveCount(0)
})

test('store approvals page presents bounded ledger load failures as an alert', async ({ page }) => {
  await page.unroute('**/api/workflow/request-center**')
  await page.route('**/api/workflow/request-center**', async (route) => {
    await route.fulfill({
      status: 500,
      body: 'Request center unavailable',
    })
  })

  await page.goto('/store/approvals')

  const alerts = page.getByRole('alert')
  await expect(alerts).toHaveCount(1)
  await expect(alerts.filter({ hasText: 'Request center unavailable' })).toBeVisible()
})

test('store approvals page keeps returned workforce corrections inline without navigation', async ({ page }) => {
  await page.unroute('**/api/auth/session')
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({
      json: {
        ...authSessionFixture,
        user: {
          ...authSessionFixture.user,
          actionScope: {
            assignedStoreIds: [outsideStoreId, demoStoreId],
          },
          assignedStoreIds: [outsideStoreId, demoStoreId],
        },
      },
    })
  })

  await page.route('**/api/workforce/seller-code-requests**', async (route) => {
    await route.fulfill({
      json: {
        items: [rejectedSellerCodeRequestFixture],
        meta: { count: 1, total: 1, limit: 50, offset: 0 },
      },
    })
  })
  await page.route('**/api/workforce/offboarding-requests**', async (route) => {
    await route.fulfill({
      json: {
        items: [rejectedOffboardingRequestFixture],
        meta: { count: 1, total: 1, limit: 50, offset: 0 },
      },
    })
  })

  await routeRequestCenter(page, [
    {
      requestId: rejectedSellerCodeRequestFixture.requestId,
      requestType: 'sellerCode',
      storeId: rejectedSellerCodeRequestFixture.storeId,
      storeName: rejectedSellerCodeRequestFixture.storeName,
      status: rejectedSellerCodeRequestFixture.status,
      updatedAt: rejectedSellerCodeRequestFixture.updatedAt,
      targetLabel: null,
      requestMonth: null,
      allocationCount: null,
      approvalMode: null,
      personDisplayName: `${rejectedSellerCodeRequestFixture.firstName} ${rejectedSellerCodeRequestFixture.lastName}`,
      nationalIdLast4: rejectedSellerCodeRequestFixture.nationalIdLast4,
      externalEmployeeRef: null,
    },
    {
      requestId: rejectedOffboardingRequestFixture.requestId,
      requestType: 'offboarding',
      storeId: rejectedOffboardingRequestFixture.storeId,
      storeName: rejectedOffboardingRequestFixture.storeName,
      status: rejectedOffboardingRequestFixture.status,
      updatedAt: rejectedOffboardingRequestFixture.updatedAt,
      targetLabel: null,
      requestMonth: null,
      allocationCount: null,
      approvalMode: null,
      personDisplayName: rejectedOffboardingRequestFixture.displayName,
      nationalIdLast4: null,
      externalEmployeeRef: rejectedOffboardingRequestFixture.externalEmployeeRef,
    },
  ])

  await page.goto('/store/approvals')

  const sellerRow = page
    .locator('[data-testid="store-approvals-request-row"]:visible')
    .filter({ hasText: 'Ayse Yilmaz' })
  await sellerRow.click()
  await expect(page.getByRole('region', { name: /Ayse Yilmaz · İşlem geçmişi/ })).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.locator('[data-testid="store-approvals-ledger"] a')).toHaveCount(0)

  const offboardingRow = page
    .locator('[data-testid="store-approvals-request-row"]:visible')
    .filter({ hasText: 'Store Personnel' })
  await sellerRow.click()
  await offboardingRow.click()
  await expect(page.getByRole('region', { name: /Store Personnel · İşlem geçmişi/ })).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.locator('[data-testid="store-approvals-ledger"] a')).toHaveCount(0)
})

test('store approvals page keeps pending workforce read actions generic', async ({ page }) => {
  await routeRequestCenter(page, [
    {
      requestId: sellerCodeRequestFixture.requestId,
      requestType: 'sellerCode',
      storeId: sellerCodeRequestFixture.storeId,
      storeName: sellerCodeRequestFixture.storeName,
      status: sellerCodeRequestFixture.status,
      updatedAt: sellerCodeRequestFixture.updatedAt,
      targetLabel: null,
      requestMonth: null,
      allocationCount: null,
      approvalMode: null,
      personDisplayName: `${sellerCodeRequestFixture.firstName} ${sellerCodeRequestFixture.lastName}`,
      nationalIdLast4: sellerCodeRequestFixture.nationalIdLast4,
      externalEmployeeRef: null,
    },
    {
      requestId: offboardingRequestFixture.requestId,
      requestType: 'offboarding',
      storeId: offboardingRequestFixture.storeId,
      storeName: offboardingRequestFixture.storeName,
      status: offboardingRequestFixture.status,
      updatedAt: offboardingRequestFixture.updatedAt,
      targetLabel: null,
      requestMonth: null,
      allocationCount: null,
      approvalMode: null,
      personDisplayName: offboardingRequestFixture.displayName,
      nationalIdLast4: null,
      externalEmployeeRef: offboardingRequestFixture.externalEmployeeRef,
    },
  ])

  await page.goto('/store/approvals')

  const sellerRow = page
    .locator('[data-testid="store-approvals-request-row"]:visible')
    .filter({ hasText: 'Ayse Yilmaz' })
  await sellerRow.click()
  await expect(page.getByRole('region', { name: /Ayse Yilmaz · İşlem geçmişi/ })).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.locator('[data-testid="store-approvals-ledger"] a')).toHaveCount(0)

  const offboardingRow = page
    .locator('[data-testid="store-approvals-request-row"]:visible')
    .filter({ hasText: 'Store Personnel' })
  await sellerRow.click()
  await offboardingRow.click()
  await expect(page.getByRole('region', { name: /Store Personnel · İşlem geçmişi/ })).toBeVisible()
  await expect(page.locator('[data-testid="store-approvals-ledger"] a')).toHaveCount(0)
})

test('store approvals page paginates request center rows after fifteen records', async ({ page }) => {
  await page.unroute('**/api/auth/session')
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({
      json: {
        ...authSessionFixture,
        user: {
          ...authSessionFixture.user,
          roleCodes: ['REGION_MANAGER'],
          actionScope: {
            assignedStoreIds: [demoStoreId],
          },
          assignedStoreIds: [demoStoreId],
        },
      },
    })
  })

  const baseRequest = pendingTargetDistributionRequestsFixture.items[0]
  const items = Array.from({ length: 20 }, (_, index) => ({
    ...baseRequest,
    requestId: `00000000-0000-0000-0000-0000000008${String(index).padStart(2, '0')}`,
    storeId: demoStoreId,
    storeName: `Pagination Store ${index + 1}`,
    status: index < 18 ? 'pending_region_approval' : 'approved',
    updatedAt: `2026-05-${String(20 - index).padStart(2, '0')}T10:00:00.000Z`,
  }))

  await routeRequestCenter(page, items.map((item) => ({
    requestId: item.requestId,
    requestType: 'target',
    storeId: item.storeId,
    storeName: item.storeName,
    status: item.status,
    updatedAt: item.updatedAt,
    targetLabel: item.targetLabel,
    requestMonth: item.requestMonth,
    allocationCount: item.allocationCount,
    approvalMode: item.approvalMode,
    personDisplayName: null,
    nationalIdLast4: null,
    externalEmployeeRef: null,
  })))

  await page.goto('/store/approvals')

  const visibleRows = page.locator('[data-testid="store-approvals-request-row"]:visible')
  await visibleRows.first().click()
  await expect(page.getByRole('region', { name: /İşlem geçmişi/ })).toBeVisible()
  await expect(page.locator('[data-testid="store-approvals-ledger"] a')).toHaveCount(0)
  await expect(visibleRows).toHaveCount(15)
  await page.getByRole('button', { name: 'Sonraki sayfa' }).click()
  await expect(visibleRows).toHaveCount(3)
  await page.getByRole('tab', { name: /Tamamlanan/ }).click()
  await expect(visibleRows).toHaveCount(2)
})

test('store approvals page keeps store manager target history inline without navigation', async ({ page }) => {
  await routeAuthSession(page, createStoreAuthSession({
    roleCodes: ['STORE_MANAGER'],
    readStoreIds: [demoStoreId],
    scopeStoreIds: [demoStoreId],
    actionStoreIds: [demoStoreId],
    legacyAssignedStoreIds: [demoStoreId],
    assignedStoreTypes: ['company'],
  }))

  await routeRequestCenter(
    page,
    pendingTargetDistributionRequestsFixture.items.map((item) => ({
      requestId: item.requestId,
      requestType: 'target',
      storeId: item.storeId,
      storeName: item.storeName,
      status: item.status,
      updatedAt: item.updatedAt,
      targetLabel: item.targetLabel,
      requestMonth: item.requestMonth,
      allocationCount: item.allocationCount,
      approvalMode: item.approvalMode,
      personDisplayName: null,
      nationalIdLast4: null,
      externalEmployeeRef: null,
    })),
  )

  await page.goto('/store/approvals')

  await page.locator('[data-testid="store-approvals-request-row"]:visible').first().click()
  await expect(page.getByRole('region', { name: /İşlem geçmişi/ })).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.locator('[data-testid="store-approvals-ledger"] a')).toHaveCount(0)
})

test('store approvals page switches to English request center copy and persists locale', async ({ page }) => {
  await page.goto('/store/approvals')

  await setStoredLocale(page, 'en')

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('heading', { name: /Request Center/i })).toBeVisible()
  await expect(page.getByText('Returned', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Seller code request form')).toHaveCount(0)
  await expect(page.getByLabel('Offboarding request form')).toHaveCount(0)
  await expect(page.getByRole('tab', { name: /Active requests/ })).toBeVisible()
  await expect(page.locator('a[href="/store/targets"]').first()).toBeVisible()
  await expect(page.getByText('Mağaza onayları')).toHaveCount(0)
  await expect(page.getByText('Satıcı kodu talebi')).toHaveCount(0)
  await expect(page.locator('body')).not.toContainText('ÃƒÆ’')
  await expect(page.locator('body')).not.toContainText('Ãƒâ€')
  await expect(page.locator('body')).not.toContainText('Ãƒâ€¦')

  await page.reload()

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('heading', { name: /Request Center/i })).toBeVisible()
})
test('language toggle localizes competition read labels and persists preference', async ({ page }) => {
  await page.goto('/store/competitions')

  const readSummary = page.getByLabel('Mağaza yarışma okuma özeti')
  const contributionRows = page.getByLabel('Yetkili mağaza yarışma katkıları')

  await expect(readSummary.getByRole('heading', { name: 'Okuma özeti' })).toBeVisible()
  await expect(readSummary.getByText('95% katkı kapsamı')).toBeVisible()
  await expect(contributionRows.getByText('Katkı sağlığı')).toBeVisible()
  await expect(contributionRows.getByText('Kısmi katkı').first()).toBeVisible()

  await setStoredLocale(page, 'en')

  const readSummaryEn = page.getByLabel('Store competition read summary')
  const contributionRowsEn = page.getByLabel('Authorized store competition contributions')

  await expect(readSummaryEn.getByRole('heading', { name: 'Read summary' })).toBeVisible()
  await expect(readSummaryEn.getByText('95% contribution coverage')).toBeVisible()
  await expect(contributionRowsEn.getByText('Contribution health')).toBeVisible()
  await expect(contributionRowsEn.getByText('Partial contribution').first()).toBeVisible()

  await page.reload()

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(readSummaryEn.getByRole('heading', { name: 'Read summary' })).toBeVisible()
  await expect(contributionRowsEn.getByText('Contribution health')).toBeVisible()
  await expect(page.locator('.language-toggle-button')).toHaveCount(0)
})
