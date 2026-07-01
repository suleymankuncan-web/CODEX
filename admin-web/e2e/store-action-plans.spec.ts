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
  await expect(page.getByText('Mağaza aksiyonları, checklist takipleri ve projeksiyon işleri.')).toBeVisible()
  await expect(page.getByText('İş kuyruğu')).toBeVisible()
  const queuePanel = page.getByTestId('store-action-plans-panel')
  await expect(queuePanel.getByText('Görev', { exact: true })).toBeVisible()
  await expect(queuePanel.getByText('Kaynak', { exact: true })).toBeVisible()
  await expect(queuePanel.getByText('Atanma', { exact: true })).toBeVisible()
  await expect(queuePanel.getByText('Süre', { exact: true })).toBeVisible()
  await expect(queuePanel.getByText('Öncelik', { exact: true })).toBeVisible()
  await expect(queuePanel.getByText('Durum', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Hedef' })).toHaveCount(0)
  await expect(page.getByText('Hedef dağıtımı onayı')).toHaveCount(0)
  await expect(getActionPlanRow(page, 'Vitrin düzeni takip maddesi')).toBeVisible()
  await expect(getActionPlanRow(page, 'Mayıs reyon düzeni')).toBeVisible()
  await expect(getActionPlanRow(page, 'Mayıs çözüm kaydı')).toHaveCount(0)
  await expect(page.getByText('Devreden').first()).toBeVisible()
  expect(api.listStatuses).toEqual(expect.arrayContaining(['open', 'in_progress', 'blocked', 'closed', 'cancelled']))
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
  await routeStoreTasksApi(page, { failActionPlanList: true })

  await page.goto('/store/tasks')

  await expect(page.getByTestId('store-action-plans-panel').getByText(/Aksiyon planlar/).first()).toBeVisible()
  await expect(page.getByText('Missing required role')).toHaveCount(0)
  await expect(getWorkflowRow(page, 'UPT projeksiyon riski')).toBeVisible()
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

  await drawer.getByPlaceholder('Kısa not yaz').fill('Vitrin düzeni tamamlandı.')
  await drawer.getByRole('button', { name: 'Çözüm bildir' }).click()
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
})

test('region manager reads results and open follow-ups without command buttons', async ({ page }) => {
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
  await routeStoreTasksApi(page, { roleCodes: ['REGION_MANAGER'] })

  await page.goto('/store/tasks')

  await expect(page.getByText('Mağaza müdürünün bitirdiği süreçler ve sonuç geçmişi.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sonuçlar' })).toBeVisible()
  await expect(getActionPlanRow(page, 'Haziran çözüm kaydı')).toBeVisible()
  await getActionPlanRow(page, 'Haziran çözüm kaydı').click()
  let drawer = page.getByRole('dialog', { name: 'Görev detayı' })
  await expect(drawer.getByText('Mağaza müdürü notu')).toBeVisible()
  await expect(drawer.getByRole('button', { name: 'İşleme al' })).toHaveCount(0)
  await drawer.getByRole('button', { name: 'Kapat', exact: true }).click()

  await page.getByRole('button', { name: 'Açık takipler' }).click()
  await expect(getActionPlanRow(page, 'Vitrin düzeni takip maddesi')).toBeVisible()
  await getActionPlanRow(page, 'Vitrin düzeni takip maddesi').click()
  drawer = page.getByRole('dialog', { name: 'Görev detayı' })
  await expect(drawer.getByRole('button', { name: 'Çözüm bildir' })).toHaveCount(0)
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
  await page.getByRole('button', { name: 'Açık takipler' }).click()
  await expect(getWorkflowRow(page, 'UPT projeksiyon riski')).toBeVisible()
  await getWorkflowRow(page, 'UPT projeksiyon riski').click()
  const drawer = page.getByRole('dialog', { name: 'Görev detayı' })
  await expect(drawer.getByRole('button', { name: 'İşleme al' })).toHaveCount(0)
  expect(api.listStatuses).toEqual(expect.arrayContaining(['open', 'in_progress', 'blocked', 'closed', 'cancelled']))
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
    await route.fulfill({ json: workflowInboxFixture })
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
  status: 'open' | 'in_progress' | 'blocked' | 'closed' | 'cancelled'
  dueOn: string
  resolutionNote: string | null
  closedByUserId: string | null
  closedAt: string | null
  cancelReason: string | null
  cancelledByUserId: string | null
  cancelledAt: string | null
  createdAt: string
  updatedAt: string
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
