import { expect, test, type Page, type Route } from './test-fixtures'

const demoStoreId = '00000000-0000-0000-0000-000000000100'
const detachedStoreId = '00000000-0000-0000-0000-000000000101'
const demoEmployeeId = '00000000-0000-0000-0000-000000000202'

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-06-29T12:00:00.000Z'))
  await page.addInitScript(() => {
    window.localStorage.setItem('store-ops-app-locale', 'tr')
    window.localStorage.setItem(
      'store-ops-admin-session',
      JSON.stringify({
        mode: 'mock',
        mockUserId: 'store-tasks-smoke-user',
        mockRoleCodes: 'STORE_MANAGER',
        mockCompanyIds: '00000000-0000-0000-0000-000000000001',
        bearerToken: '',
      }),
    )
  })
})

test('store tasks renders the command center and keeps target approvals out', async ({ page }) => {
  const api = await routeStoreTasksApi(page)

  await page.goto('/store/tasks')

  await expect(page.getByRole('heading', { name: 'Görevler' })).toBeVisible()
  await expect(page.getByText('Aksiyonları başlatın, takip edin ve sonucu kaydedin.')).toBeVisible()
  await expect(page.getByText('Toplam sonuç')).toBeVisible()
  const queuePanel = page.getByTestId('store-action-plans-panel')
  await expect(queuePanel.getByText('Görev', { exact: true })).toBeVisible()
  await expect(queuePanel.getByText('Kaynak', { exact: true })).toBeVisible()
  await expect(queuePanel.getByText('Tarih', { exact: true })).toBeVisible()
  await expect(queuePanel.getByText('Mağaza', { exact: true })).toBeVisible()
  await expect(queuePanel.getByText('Öncelik', { exact: true })).toBeVisible()
  await expect(queuePanel.getByText('Durum', { exact: true })).toBeVisible()
  await expect(queuePanel.getByRole('button', { name: 'Hedef', exact: true })).toHaveCount(0)
  await expect(page.getByText('Hedef dağıtımı onayı')).toHaveCount(0)
  await expect(getActionPlanRow(page, 'Vitrin düzeni takip maddesi')).toBeVisible()
  await expect(getActionPlanRow(page, 'Mayıs reyon düzeni')).toBeVisible()
  await expect(getActionPlanRow(page, 'Mayıs çözüm kaydı')).toHaveCount(0)
  expect(api.listStatuses).toEqual(expect.arrayContaining(['open', 'in_progress', 'blocked', 'closed', 'cancelled']))
})

test('store tasks keeps same-day open plans visibly open', async ({ page }) => {
  const sameDayPlan = {
    ...storeActionPlansFixture[0],
    actionPlanId: '00000000-0000-0000-0000-00000000a105',
    title: 'Bugün açılan takip',
    createdAt: '2026-06-29T08:00:00.000Z',
    updatedAt: '2026-06-29T08:30:00.000Z',
  }
  await routeStoreTasksApi(page, { plans: [sameDayPlan] })

  await page.goto('/store/tasks')

  await expect(getActionPlanRow(page, 'Bugün açılan takip')).toContainText('Açık')
})

test('store tasks renders persisted plan names without UUID fallbacks', async ({ page }) => {
  const detachedPlan = {
    ...storeActionPlansFixture[0],
    actionPlanId: '00000000-0000-0000-0000-00000000a101',
    storeId: detachedStoreId,
    storeName: 'Bagdat Caddesi',
    ownerUserId: '00000000-0000-0000-0000-00000000b101',
    ownerDisplayName: 'Ayse Demir',
    sourceId: 'checklist:2026-06:item-detached',
    title: 'Bagdat takip maddesi',
  }
  await routeStoreTasksApi(page, {
    plans: [detachedPlan],
    assignedStoreIds: [demoStoreId, detachedStoreId],
  })

  await page.goto('/store/tasks')

  const row = getActionPlanRow(page, 'Bagdat takip maddesi')
  await expect(row).toContainText('Bagdat Caddesi')
  await expect(row).not.toContainText(detachedStoreId)
})

test('store tasks keeps raw action plan permission errors out of the UI', async ({ page }) => {
  const api = await routeStoreTasksApi(page, { failActionPlanList: true })

  await page.goto('/store/tasks')

  await expect(page.getByText('Görevler açılamadı')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByText('Missing required role')).toHaveCount(0)
  await expect(getWorkflowRow(page, 'UPT projeksiyon riski')).toHaveCount(0)
  expect(api.workspaceRequestCount).toBe(1)
})

test('store manager can move and close a persisted action plan from the drawer', async ({ page }) => {
  const api = await routeStoreTasksApi(page)

  await page.goto('/store/tasks')

  await getActionPlanRow(page, 'Vitrin düzeni takip maddesi').click()
  const drawer = page.getByRole('dialog', { name: 'Görev detayı' })
  await expect(drawer.getByRole('heading', { name: 'Vitrin düzeni takip maddesi' })).toBeVisible()
  await expect(drawer.getByRole('button', { name: 'İşleme al' })).toBeVisible()
  await expect(drawer.getByRole('button', { name: 'Bloke et' })).toBeVisible()
  await expect(drawer.getByRole('button', { name: 'Çözüm bildir' })).toBeVisible()

  await drawer.getByRole('button', { name: 'İşleme al' }).click()
  expect(api.statusPayloads.at(-1)).toMatchObject({ status: 'in_progress' })
  await expect(drawer).toBeHidden()
  await expect(getActionPlanRow(page, 'Vitrin düzeni takip maddesi')).toContainText('İşlemde')

  await getActionPlanRow(page, 'Vitrin düzeni takip maddesi').click()
  const refreshedDrawer = page.getByRole('dialog', { name: 'Görev detayı' })
  await refreshedDrawer.getByPlaceholder('Kısa not yaz').fill('Vitrin düzeni tamamlandı.')
  await refreshedDrawer.getByRole('button', { name: 'Çözüm bildir' }).click()
  expect(api.closePayloads.at(-1)).toMatchObject({
    resolutionNote: 'Vitrin düzeni tamamlandı.',
  })
})

test('store manager can block a persisted action plan with a note', async ({ page }) => {
  const api = await routeStoreTasksApi(page)

  await page.goto('/store/tasks')

  await getActionPlanRow(page, 'Mayıs reyon düzeni').click()
  const drawer = page.getByRole('dialog', { name: 'Görev detayı' })
  await drawer.getByPlaceholder('Kısa not yaz').fill('Eksik ürün bekleniyor.')
  await drawer.getByRole('button', { name: 'Bloke et' }).click()

  expect(api.statusPayloads.at(-1)).toMatchObject({
    status: 'blocked',
    note: 'Eksik ürün bekleniyor.',
  })
  await expect(drawer).toBeHidden()
  await expect(getActionPlanRow(page, 'Mayıs reyon düzeni')).toContainText('Bloke')
})

test('region manager reads only completed results without command buttons', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'store-ops-admin-session',
      JSON.stringify({
        mode: 'mock',
        mockUserId: 'store-tasks-rm-smoke-user',
        mockRoleCodes: 'REGION_MANAGER',
        mockCompanyIds: '00000000-0000-0000-0000-000000000001',
        bearerToken: '',
      }),
    )
  })
  const api = await routeStoreTasksApi(page, { roleCodes: ['REGION_MANAGER'] })

  await page.goto('/store/tasks')

  await expect(page.getByText('Tamamlanan mağaza aksiyonlarını ve denetlenebilir sonuç geçmişini inceleyin.')).toBeVisible()
  await expect(page.getByText('Çözüm bildirildi').first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Açık takipler' })).toHaveCount(0)
  await expect(getActionPlanRow(page, 'Haziran çözüm kaydı')).toBeVisible()
  await expect(getActionPlanRow(page, 'Vitrin düzeni takip maddesi')).toHaveCount(0)
  await expect(getActionPlanRow(page, 'Mayıs reyon düzeni')).toHaveCount(0)
  await getActionPlanRow(page, 'Haziran çözüm kaydı').click()
  const drawer = page.getByRole('dialog', { name: 'Görev detayı' })
  await expect(drawer.getByText('Mağaza müdürü notu')).toBeVisible()
  await expect(drawer.getByRole('button', { name: 'İşleme al' })).toHaveCount(0)
  await expect(drawer.getByRole('button', { name: 'Çözüm bildir' })).toHaveCount(0)
  expect(api.listStatuses).toEqual(expect.arrayContaining(['closed', 'cancelled']))
  expect(api.listStatuses).not.toEqual(expect.arrayContaining(['open', 'in_progress', 'blocked']))
})

test('region manager with no action-store assignment does not read persisted plans', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'store-ops-admin-session',
      JSON.stringify({
        mode: 'mock',
        mockUserId: 'store-tasks-rm-no-actions-user',
        mockRoleCodes: 'REGION_MANAGER',
        mockCompanyIds: '00000000-0000-0000-0000-000000000001',
        bearerToken: '',
      }),
    )
  })
  const api = await routeStoreTasksApi(page, {
    roleCodes: ['REGION_MANAGER'],
    assignedStoreIds: [],
  })

  await page.goto('/store/tasks')

  await expect(page.getByRole('heading', { name: 'Görevler' })).toBeVisible()
  await expect(getActionPlanRow(page, 'Haziran çözüm kaydı')).toHaveCount(0)
  await expect(getActionPlanRow(page, 'Vitrin düzeni takip maddesi')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Açık takipler' })).toHaveCount(0)
  await expect(getWorkflowRow(page, 'UPT projeksiyon riski')).toHaveCount(0)
  expect(api.listStatuses).toEqual(expect.arrayContaining(['closed', 'cancelled']))
  expect(api.listStatuses).not.toEqual(expect.arrayContaining(['open', 'in_progress', 'blocked']))
})

test('region manager does not see active action plans from workflow inbox as completed results', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'store-ops-admin-session',
      JSON.stringify({
        mode: 'mock',
        mockUserId: 'store-tasks-rm-workflow-user',
        mockRoleCodes: 'REGION_MANAGER',
        mockCompanyIds: '00000000-0000-0000-0000-000000000001',
        bearerToken: '',
      }),
    )
  })
  await routeStoreTasksApi(page, {
    roleCodes: ['REGION_MANAGER'],
    plans: [],
    workflowItems: [
      ...workflowInboxFixture.items,
      {
        itemType: 'task',
        sourceType: 'store_action_plan',
        sourceId: 'workflow-active-plan-1',
        title: 'Workflow açık takip',
        summary: 'Aktif plan sonuç geçmişinde görünmemeli.',
        storeId: demoStoreId,
        storeName: 'IstinyePark Demo Store',
        workflowStatus: 'open',
        inboxStatus: 'informational',
        urgency: 'medium',
        createdAt: '2026-06-27T08:00:00.000Z',
        needsAttentionAt: '2026-06-27T08:00:00.000Z',
        actorRole: 'STORE_MANAGER',
        primaryActionLabel: 'Detay aç',
        secondaryActionLabel: 'Detay aç',
        deepLink: '/store/tasks',
        historyPreview: 'Aksiyon açık.',
      },
    ],
  })

  await page.goto('/store/tasks')

  await expect(getWorkflowRow(page, 'Workflow açık takip')).toHaveCount(0)
})

test('store manager can create an action plan from a projection candidate', async ({ page }) => {
  const api = await routeStoreTasksApi(page, { plans: [] })

  await page.goto('/store/tasks')

  await getWorkflowRow(page, 'UPT projeksiyon riski').click()
  const drawer = page.getByRole('dialog', { name: 'Görev detayı' })
  await drawer.getByLabel('Termin').fill('2026-06-30')
  await drawer.getByRole('button', { name: 'Aksiyon planı oluştur' }).click()

  expect(api.createPayloads.at(-1)).toMatchObject({
    storeId: demoStoreId,
    sourceType: 'kpi_exception',
    sourceId: 'snapshot-2026-06:store:kpi',
    sourceDeepLink: '/store/kpis',
    title: 'UPT projeksiyon riski',
    summary: 'UPT ritmi dönem sonu hedefinin altında kalıyor.',
    priority: 'high',
    dueOn: '2026-06-30',
  })
})

test('[FR-05][AC-05] V2 Store Manager uses photo submission instead of direct close', async ({ page }) => {
  const plan = { ...storeActionPlansFixture[0], resolutionWorkflowVersion: 2 as const,
    photoEvidenceVersion: 0, currentSolutionAttemptId: null }
  await routeStoreTasksApi(page, { plans: [plan] })
  await page.goto('/store/tasks')
  await getActionPlanRow(page, plan.title).click()
  const drawer = page.getByRole('dialog', { name: 'Görev detayı' })
  await expect(drawer.getByRole('heading', { name: 'Fotoğraflı çözüm bildirimi' })).toBeVisible()
  await expect(drawer.getByRole('button', { name: 'Görevi kapat' })).toHaveCount(0)
})

test('[FR-06][AC-06] Region Manager compares finding and solution evidence', async ({ page }) => {
  const plan = { ...storeActionPlansFixture[0], status: 'solution_review_pending' as const,
    resolutionWorkflowVersion: 2 as const, photoEvidenceVersion: 1,
    currentSolutionAttemptId: '00000000-0000-4000-8000-00000000d001' }
  await routeStoreTasksApi(page, { roleCodes: ['REGION_MANAGER'], plans: [plan] })
  await page.route(`**/api/store-actions/plans/${plan.actionPlanId}/photo-review`, (route) => route.fulfill({ json: {
    actionPlanId: plan.actionPlanId, status: plan.status, version: 1,
    currentAttemptId: plan.currentSolutionAttemptId,
    findingMediaAssetIds: ['00000000-0000-4000-8000-00000000e001'],
    attempts: [{ attemptId: plan.currentSolutionAttemptId, attemptNo: 1,
      resolutionNote: 'Düzen tamamlandı', submittedAt: '2026-06-20T08:00:00.000Z',
      mediaAssetIds: ['00000000-0000-4000-8000-00000000e002'], review: null }],
  } }))
  await page.route('**/api/store-actions/plans/*/evidence/*/content/thumbnail', (route) => route.fulfill({
    contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64'),
  }))
  await page.goto('/store/tasks')
  await getActionPlanRow(page, plan.title).click()
  const drawer = page.getByRole('dialog', { name: 'Görev detayı' })
  await expect(drawer.getByText('Denetim bulgusu')).toBeVisible()
  await expect(drawer.getByText('Çözüm kanıtı')).toBeVisible()
  await expect(drawer.getByRole('button', { name: 'Onayla ve kapat' })).toBeEnabled()
  await expect(drawer.getByRole('button', { name: 'Düzeltme iste' })).toBeDisabled()
})

test('[EC-02] ambiguous Store Manager retry reuses upload and idempotency identity', async ({ page }) => {
  const plan = { ...storeActionPlansFixture[0], resolutionWorkflowVersion: 2 as const,
    photoEvidenceVersion: 0, currentSolutionAttemptId: null }
  await routeStoreTasksApi(page, { plans: [plan] })
  let uploadCount = 0
  let finalizeCount = 0
  const submitKeys: string[] = []
  await page.route('**/solution/uploads', (route) => {
    uploadCount += 1
    return route.fulfill({ status: 201, json: { mediaAssetId: '00000000-0000-4000-8000-00000000e003' } })
  })
  await page.route('**/solution/uploads/*/finalize', (route) => {
    finalizeCount += 1
    return route.fulfill({ status: 201, json: { state: 'ready' } })
  })
  await page.route('**/solution-attempts', async (route) => {
    submitKeys.push((route.request().postDataJSON() as { idempotencyKey: string }).idempotencyKey)
    if (submitKeys.length === 1) return route.fulfill({ status: 504, json: { message: 'Ambiguous timeout' } })
    return route.fulfill({ status: 201, json: { actionPlanId: plan.actionPlanId,
      status: 'solution_review_pending', version: 1, currentAttemptId: '00000000-0000-4000-8000-00000000d001',
      findingMediaAssetIds: [], attempts: [] } })
  })
  await page.goto('/store/tasks')
  await getActionPlanRow(page, plan.title).click()
  const drawer = page.getByRole('dialog', { name: 'Görev detayı' })
  await drawer.getByLabel('Çözüm kanıtı').setInputFiles({
    name: 'approved-synthetic.png', mimeType: 'image/png', buffer: Buffer.from('approved-fixture'),
  })
  await drawer.getByLabel('Çözüm notu').fill('Düzen tamamlandı')
  const submitButton = drawer.getByRole('button', { name: 'İncelemeye gönder' })
  await submitButton.click()
  await expect.poll(() => submitKeys.length).toBe(1)
  await expect(submitButton).toBeEnabled()
  await submitButton.click()
  await expect.poll(() => submitKeys.length).toBe(2)
  expect(uploadCount).toBe(1)
  expect(finalizeCount).toBe(1)
  expect(submitKeys[1]).toBe(submitKeys[0])
})

function getActionPlanRow(page: Page, title: string) {
  return page.getByTestId('store-action-plan-row').filter({ hasText: title })
}

function getWorkflowRow(page: Page, title: string) {
  return page.getByTestId('store-task-queue-row').filter({ hasText: title })
}

async function routeStoreTasksApi(
  page: Page,
  input: {
    roleCodes?: string[]
    plans?: StoreActionPlanFixture[]
    assignedStoreIds?: string[]
    failActionPlanList?: boolean
    workflowItems?: WorkflowInboxItemFixture[]
  } = {},
) {
  const roleCodes = input.roleCodes ?? ['STORE_MANAGER']
  const assignedStoreIds = input.assignedStoreIds ?? [demoStoreId]
  const state = {
    plans: [...(input.plans ?? storeActionPlansFixture)],
    assignedStoreIds,
    listStatuses: [] as string[],
    statusPayloads: [] as Array<Record<string, unknown>>,
    closePayloads: [] as Array<Record<string, unknown>>,
    createPayloads: [] as Array<Record<string, unknown>>,
    workspaceRequestCount: 0,
    failActionPlanList: input.failActionPlanList ?? false,
  }

  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({
      json: {
        ...authSessionFixture,
        user: {
          ...authSessionFixture.user,
          roleCodes,
          actionScope: {
            assignedStoreIds,
          },
          assignedStoreIds,
        },
        scopeSummary: {
          ...authSessionFixture.scopeSummary,
          assignedStoreCount: assignedStoreIds.length,
        },
      },
    })
  })

  await page.route('**/api/workflow/inbox', async (route) => {
    await route.fulfill({
      json: {
        ...workflowInboxFixture,
        items: input.workflowItems ?? workflowInboxFixture.items,
      },
    })
  })

  await page.route('**/api/store/tasks/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    if (url.pathname.endsWith('/workspace')) state.workspaceRequestCount += 1
    if (url.pathname.endsWith('/events')) {
      await route.fulfill({
        json: {
          data: {
            items: [{
              eventId: 'event-1',
              eventType: 'store_action_plan.created',
              occurredAt: '2026-06-14T08:00:00.000Z',
              actorDisplayName: 'Pilot Kullanıcı',
              actorRoleLabel: 'Mağaza Müdürü',
              note: null,
            }],
            total: 1,
            limit: 20,
            offset: 0,
          },
        },
      })
      return
    }
    if (state.failActionPlanList) {
      await route.fulfill({ status: 403, json: { message: 'Missing required role' } })
      return
    }
    const regionManager = roleCodes.includes('REGION_MANAGER')
    const reportViewer = roleCodes.includes('REPORT_VIEWER')
    const resultOnly = regionManager || reportViewer
    const scopedPlans = state.plans.filter((plan) =>
      assignedStoreIds.includes(plan.storeId)
      && (!resultOnly || plan.status === 'closed' || plan.status === 'cancelled'
        || (regionManager && plan.status === 'solution_review_pending'))
      && (plan.dueOn.startsWith('2026-06') || plan.closedAt?.startsWith('2026-06')),
    )
    const items = scopedPlans.map((plan) => ({
      actionPlanId: plan.actionPlanId,
      storeId: plan.storeId,
      storeName: plan.storeName,
      title: plan.title,
      summary: plan.summary,
      priority: plan.priority,
      status: plan.status,
      dueOn: plan.dueOn,
      createdAt: plan.createdAt,
      updatedAt: plan.updatedAt,
      completedAt: plan.closedAt ?? plan.cancelledAt,
      resultNote: plan.resolutionNote ?? plan.cancelReason,
      source: {
        type: plan.sourceType,
        id: plan.sourceId,
        deepLink: plan.sourceDeepLink ?? (plan.sourceType === 'checklist_remediation' ? '/store/checklists' : '/store/kpis'),
      },
      events: { items: [], total: 0, limit: 0, hasMore: false },
      photoEvidenceVersion: plan.photoEvidenceVersion ?? 0,
      currentSolutionAttemptId: plan.currentSolutionAttemptId ?? null,
      resolutionWorkflowVersion: plan.resolutionWorkflowVersion ?? 1,
    }))
    const statuses = regionManager ? ['solution_review_pending', 'closed', 'cancelled']
      : resultOnly ? ['closed', 'cancelled']
        : ['open', 'in_progress', 'blocked', 'correction_required', 'closed', 'cancelled']
    state.listStatuses.push(...statuses)
    await route.fulfill({
      json: {
        data: {
          view: reportViewer ? 'report_viewer' : regionManager ? 'region_manager' : 'store_manager',
          capabilities: {
            canStart: !resultOnly,
            canUpdate: !resultOnly,
            canComplete: !resultOnly,
            canCancel: !resultOnly,
            canReview: regionManager,
          },
          items,
          summary: {
            retained: items.length,
            actionable: items.filter((item) => ['open', 'in_progress', 'blocked'].includes(item.status)).length,
            completed: items.filter((item) => item.status === 'closed').length,
            cancelled: items.filter((item) => item.status === 'cancelled').length,
            checklist: items.filter((item) => item.source.type === 'checklist_remediation').length,
          },
          page: { total: items.length, limit: 20, offset: 0, count: items.length, hasMore: false },
        },
      },
    })
  })

  await page.route('**/api/store-actions/plans**', async (route) => {
    await handleStoreActionPlanRoute(route, state)
  })

  return state
}

async function handleStoreActionPlanRoute(
  route: Route,
  state: {
    plans: StoreActionPlanFixture[]
    assignedStoreIds: string[]
    listStatuses: string[]
    statusPayloads: Array<Record<string, unknown>>
    closePayloads: Array<Record<string, unknown>>
    createPayloads: Array<Record<string, unknown>>
    failActionPlanList: boolean
  },
) {
  const request = route.request()
  const url = new URL(request.url())
  const planIdMatch = /\/store-actions\/plans\/([^/]+)(?:\/(status|close|cancel))?$/.exec(url.pathname)
  const actionPlanId = planIdMatch?.[1]
  const command = planIdMatch?.[2]
  const scopedPlans = state.plans.filter((plan) => state.assignedStoreIds.includes(plan.storeId))

  if (request.method() === 'GET' && !actionPlanId && state.failActionPlanList) {
    await route.fulfill({ status: 403, json: { message: 'Missing required role' } })
    return
  }

  if (request.method() === 'GET' && actionPlanId && !command) {
    const plan = scopedPlans.find((item) => item.actionPlanId === actionPlanId)
    if (!plan) {
      await route.fulfill({ status: 404, json: { message: 'Not found' } })
      return
    }
    await route.fulfill({ json: { data: { plan } } })
    return
  }

  if (request.method() === 'PATCH' && actionPlanId && command === 'status') {
    const body = request.postDataJSON() as Record<string, unknown>
    state.statusPayloads.push(body)
    state.plans = state.plans.map((plan) =>
      plan.actionPlanId === actionPlanId ? { ...plan, status: body.status as StoreActionPlanFixture['status'] } : plan,
    )
    await route.fulfill({ json: { command: { status: 'updated', message: 'updated' }, data: { plan: state.plans.find((item) => item.actionPlanId === actionPlanId) } } })
    return
  }

  if (request.method() === 'PATCH' && actionPlanId && command === 'close') {
    const body = request.postDataJSON() as Record<string, unknown>
    state.closePayloads.push(body)
    state.plans = state.plans.map((plan) =>
      plan.actionPlanId === actionPlanId
        ? {
            ...plan,
            status: 'closed',
            resolutionNote: body.resolutionNote as string,
            closedAt: '2026-06-27T10:00:00.000Z',
          }
        : plan,
    )
    await route.fulfill({ json: { command: { status: 'closed', message: 'closed' }, data: { plan: state.plans.find((item) => item.actionPlanId === actionPlanId) } } })
    return
  }

  if (request.method() === 'POST') {
    const body = request.postDataJSON() as Record<string, unknown>
    state.createPayloads.push(body)
    const plan = {
      ...storeActionPlansFixture[0],
      actionPlanId: '00000000-0000-0000-0000-00000000c999',
      sourceId: body.sourceId as string,
      sourceDeepLink: body.sourceDeepLink as string,
      title: body.title as string,
      summary: body.summary as string,
      dueOn: body.dueOn as string,
      priority: body.priority as StoreActionPlanFixture['priority'],
      status: 'open' as const,
      createdAt: '2026-06-27T08:00:00.000Z',
    }
    state.plans.push(plan)
    await route.fulfill({ status: 201, json: { command: { status: 'created', message: 'created' }, data: { plan } } })
    return
  }

  const status = url.searchParams.get('status')
  if (status) {
    state.listStatuses.push(status)
  }
  const items = status ? scopedPlans.filter((plan) => plan.status === status) : []
  await route.fulfill({
    json: {
      items,
      meta: { count: items.length, total: items.length, limit: 20, offset: 0 },
    },
  })
}

const authSessionFixture = {
  authMode: 'mock',
  authenticated: true,
  user: {
    userId: 'store-tasks-smoke-user',
    employeeId: demoEmployeeId,
    roleCodes: ['STORE_MANAGER'],
    scope: {
      companyIds: ['00000000-0000-0000-0000-000000000001'],
      regionIds: ['00000000-0000-0000-0000-000000000010'],
      storeIds: [demoStoreId],
    },
    readScope: {
      companyIds: ['00000000-0000-0000-0000-000000000001'],
      regionIds: ['00000000-0000-0000-0000-000000000010'],
      storeIds: [demoStoreId],
    },
    actionScope: {
      assignedStoreIds: [demoStoreId],
    },
    assignedStoreIds: [demoStoreId],
  },
  scopeSummary: {
    companyCount: 1,
    regionCount: 1,
    storeCount: 1,
    assignedStoreCount: 1,
  },
}

const workflowInboxFixture = {
  items: [
    {
      itemType: 'task',
      sourceType: 'kpi_exception',
      sourceId: 'snapshot-2026-06:store:kpi',
      title: 'UPT projeksiyon riski',
      summary: 'UPT ritmi dönem sonu hedefinin altında kalıyor.',
      storeId: demoStoreId,
      storeName: 'IstinyePark Demo Store',
      workflowStatus: 'at_risk',
      inboxStatus: 'needs_attention',
      urgency: 'high',
      createdAt: '2026-06-24T08:00:00.000Z',
      needsAttentionAt: '2026-06-24T08:00:00.000Z',
      actorRole: 'STORE_MANAGER',
      primaryActionLabel: 'KPI detayına git',
      secondaryActionLabel: 'Detay aç',
      deepLink: '/store/kpis',
      historyPreview: 'Gerçekleşme %84',
    },
    {
      itemType: 'approval',
      sourceType: 'target_distribution_request',
      sourceId: 'target-request-1',
      title: 'Hedef dağıtımı onayı',
      summary: 'Bu kayıt Store Tasks içinde görünmemeli.',
      storeId: demoStoreId,
      storeName: 'IstinyePark Demo Store',
      workflowStatus: 'pending_region_approval',
      inboxStatus: 'needs_attention',
      urgency: 'medium',
      createdAt: '2026-06-24T08:00:00.000Z',
      needsAttentionAt: '2026-06-24T08:00:00.000Z',
      actorRole: 'REGION_MANAGER',
      primaryActionLabel: 'Talebi onayla',
      secondaryActionLabel: 'Detay aç',
      deepLink: '/store/targets',
      historyPreview: 'Hedef onayı bekliyor',
    },
  ],
  meta: {
    count: 2,
    total: 2,
    limit: 30,
    offset: 0,
  },
}

type WorkflowInboxItemFixture = (typeof workflowInboxFixture.items)[number]

type StoreActionPlanFixture = {
  actionPlanId: string
  companyId: string
  regionId: string
  storeId: string
  storeName: string | null
  ownerUserId: string
  ownerDisplayName: string | null
  createdByUserId: string
  sourceType: 'kpi_exception' | 'checklist_remediation'
  sourceId: string
  sourceDeepLink: string | null
  sourceSnapshotRunId: string | null
  sourceKpiId: string | null
  title: string
  summary: string | null
  priority: 'high' | 'medium' | 'low'
  status: 'open' | 'in_progress' | 'blocked' | 'solution_review_pending' | 'correction_required' | 'closed' | 'cancelled'
  dueOn: string
  resolutionNote: string | null
  closedByUserId: string | null
  closedAt: string | null
  cancelReason: string | null
  cancelledByUserId: string | null
  cancelledAt: string | null
  createdAt: string
  updatedAt: string
  photoEvidenceVersion?: number
  currentSolutionAttemptId?: string | null
  resolutionWorkflowVersion?: 1 | 2
}

const storeActionPlansFixture: StoreActionPlanFixture[] = [
  {
    actionPlanId: '00000000-0000-0000-0000-00000000a001',
    companyId: '00000000-0000-0000-0000-000000000001',
    regionId: '00000000-0000-0000-0000-000000000010',
    storeId: demoStoreId,
    storeName: 'IstinyePark Demo Store',
    ownerUserId: 'Mert Alcan',
    ownerDisplayName: 'Mert Alcan',
    createdByUserId: '00000000-0000-0000-0000-00000000b001',
    sourceType: 'checklist_remediation',
    sourceId: 'checklist:2026-06:item-1',
    sourceDeepLink: '/store/checklists?result=checklist-1',
    sourceSnapshotRunId: null,
    sourceKpiId: null,
    title: 'Vitrin düzeni takip maddesi',
    summary: 'BM checklist sonucunda vitrin sezon standardı düşük puan aldı.',
    priority: 'high',
    status: 'open',
    dueOn: '2026-06-28',
    resolutionNote: null,
    closedByUserId: null,
    closedAt: null,
    cancelReason: null,
    cancelledByUserId: null,
    cancelledAt: null,
    createdAt: '2026-06-14T08:00:00.000Z',
    updatedAt: '2026-06-14T08:30:00.000Z',
  },
  {
    actionPlanId: '00000000-0000-0000-0000-00000000a002',
    companyId: '00000000-0000-0000-0000-000000000001',
    regionId: '00000000-0000-0000-0000-000000000010',
    storeId: demoStoreId,
    storeName: 'IstinyePark Demo Store',
    ownerUserId: 'Eda Çelik',
    ownerDisplayName: 'Eda Celik',
    createdByUserId: '00000000-0000-0000-0000-00000000b002',
    sourceType: 'checklist_remediation',
    sourceId: 'checklist:2026-05:item-2',
    sourceDeepLink: '/store/checklists?result=checklist-2',
    sourceSnapshotRunId: null,
    sourceKpiId: null,
    title: 'Mayıs reyon düzeni',
    summary: 'Mayıs checklistinden kalan reyon düzeni aksiyonu devam ediyor.',
    priority: 'medium',
    status: 'in_progress',
    dueOn: '2026-06-30',
    resolutionNote: null,
    closedByUserId: null,
    closedAt: null,
    cancelReason: null,
    cancelledByUserId: null,
    cancelledAt: null,
    createdAt: '2026-05-28T08:00:00.000Z',
    updatedAt: '2026-06-04T08:30:00.000Z',
  },
  {
    actionPlanId: '00000000-0000-0000-0000-00000000a003',
    companyId: '00000000-0000-0000-0000-000000000001',
    regionId: '00000000-0000-0000-0000-000000000010',
    storeId: demoStoreId,
    storeName: 'IstinyePark Demo Store',
    ownerUserId: 'Onur Tekin',
    ownerDisplayName: 'Onur Tekin',
    createdByUserId: '00000000-0000-0000-0000-00000000b003',
    sourceType: 'kpi_exception',
    sourceId: 'snapshot-2026-06:store:kpi-closed',
    sourceDeepLink: '/store/kpis',
    sourceSnapshotRunId: null,
    sourceKpiId: null,
    title: 'Haziran çözüm kaydı',
    summary: 'UPT aksiyon sonucu mağaza müdürü tarafından bildirildi.',
    priority: 'low',
    status: 'closed',
    dueOn: '2026-06-20',
    resolutionNote: 'Ekip ürün eşleştirme odağına geçti.',
    closedByUserId: '00000000-0000-0000-0000-00000000b003',
    closedAt: '2026-06-21T08:00:00.000Z',
    cancelReason: null,
    cancelledByUserId: null,
    cancelledAt: null,
    createdAt: '2026-06-02T08:00:00.000Z',
    updatedAt: '2026-06-21T08:30:00.000Z',
  },
  {
    actionPlanId: '00000000-0000-0000-0000-00000000a004',
    companyId: '00000000-0000-0000-0000-000000000001',
    regionId: '00000000-0000-0000-0000-000000000010',
    storeId: demoStoreId,
    storeName: 'IstinyePark Demo Store',
    ownerUserId: 'Onur Tekin',
    ownerDisplayName: 'Onur Tekin',
    createdByUserId: '00000000-0000-0000-0000-00000000b004',
    sourceType: 'checklist_remediation',
    sourceId: 'checklist:2026-05:item-closed',
    sourceDeepLink: '/store/checklists?result=checklist-closed',
    sourceSnapshotRunId: null,
    sourceKpiId: null,
    title: 'Mayıs çözüm kaydı',
    summary: 'Mayıs döneminde kapanan kayıt.',
    priority: 'low',
    status: 'closed',
    dueOn: '2026-05-20',
    resolutionNote: 'Kayıt Mayıs ayında kapandı.',
    closedByUserId: '00000000-0000-0000-0000-00000000b004',
    closedAt: '2026-05-26T08:00:00.000Z',
    cancelReason: null,
    cancelledByUserId: null,
    cancelledAt: null,
    createdAt: '2026-05-10T08:00:00.000Z',
    updatedAt: '2026-05-26T08:30:00.000Z',
  },
]
