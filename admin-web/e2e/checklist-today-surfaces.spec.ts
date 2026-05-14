import { expect, test, type Page } from '@playwright/test'
import { setStoredLocale } from './locale-test-utils'

const storeId = '11111111-1111-4111-8111-111111111111'
const templateId = '22222222-2222-4222-8222-222222222222'

test('region manager checklist surface shows assigned store visit workflow', async ({ page }) => {
  const requests = createChecklistRequestLog()
  await setupChecklistPage(page, ['REGION_MANAGER'], { requests })
  await page.goto('/store/checklists')

  await expect(page.locator('.store-checklists-command-page .stacked-row')).toHaveCount(0)
  await expect(page.getByText('Devam et')).toBeVisible()
  await expect(page.locator('.store-checklists-visit-row').getByText('Taslak', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Devam et' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByText('Vitrin standartlara uygun')).toBeVisible()
  await page.getByLabel('Puan').fill('8')
  await page.getByLabel('Not').fill('Raf ve vitrin uygun')
  await expect.poll(() => requests.saves).toContainEqual(
    {
      checklistInstanceId: '33333333-3333-4333-8333-333333333333',
      body: {
        templateItemId: '55555555-5555-4555-8555-555555555555',
        scoreValue: 8,
        commentText: 'Raf ve vitrin uygun',
      },
    },
  )
  await expect(page.getByRole('button', { name: 'Tamamla', exact: true })).toBeVisible()
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Tamamla', exact: true }).click()
  await expect.poll(() => requests.completes).toEqual([
    { checklistInstanceId: '33333333-3333-4333-8333-333333333333' },
  ])
  await expect(page.getByText('Başarıyla Tamamlandı')).toBeVisible()
})

test('store manager checklist surface keeps acknowledgement language', async ({ page }) => {
  const requests = createChecklistRequestLog()
  await setupChecklistPage(page, ['STORE_MANAGER'], { requests })
  await page.goto('/store/checklists')

  await page
    .locator('.store-checklists-history-row')
    .filter({ hasText: 'BM Result' })
    .getByRole('button', { name: 'Detayı gör' })
    .click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByText('Checklist sonucu', { exact: true })).toBeVisible()
  await expect(page.getByText('Dikkat isteyen maddeler')).toBeVisible()
  await expect(page.getByText('Eksik manken')).toBeVisible()
  await page.getByLabel('Kabul notu').fill('Mağaza sonucu gördü')
  await expect(page.getByText('Kabul ettim')).toBeVisible()
  await page.getByRole('button', { name: 'Kabul ettim' }).click()
  await expect.poll(() => requests.acknowledgements).toEqual([
    {
      checklistInstanceId: '44444444-4444-4444-8444-444444444444',
      body: { acknowledgementNote: 'Mağaza sonucu gördü' },
    },
  ])
})

test('completed checklist handoff moves from field visit to store acknowledgement history', async ({ page }) => {
  const requests = createChecklistRequestLog()
  const roleState: ChecklistRoleState = { current: ['REGION_MANAGER'] }
  const handoffState: ChecklistHandoffState = {
    completed: false,
    acknowledged: false,
  }
  await page.addInitScript(() => {
    window.localStorage.setItem('store-ops-app-locale', 'en')
  })
  await setupChecklistPage(page, roleState.current, {
    activeInstances: [],
    handoffState,
    monthlySummaries: [],
    requests,
    roleState,
  })
  await page.goto('/store/checklists')

  await expect(page.getByRole('button', { name: 'Start checklist' })).toBeVisible()
  await page.getByRole('button', { name: 'Start checklist' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByText('Vitrin standartlara uygun')).toBeVisible()
  await expect.poll(() => requests.starts).toEqual([{ checklistTemplateId: templateId, storeId }])
  await expect(page.locator('.store-checklist-modal-start')).toHaveCount(0)

  await expect(page.getByLabel('Score')).toBeEnabled()
  await page.getByLabel('Score').fill('8')
  await page.getByLabel('Note').fill('Handoff-ready visit')
  await expect.poll(() => requests.saves).toContainEqual(
    {
      checklistInstanceId: '33333333-3333-4333-8333-333333333333',
      body: {
        templateItemId: '55555555-5555-4555-8555-555555555555',
        scoreValue: 8,
        commentText: 'Handoff-ready visit',
      },
    },
  )

  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Complete', exact: true }).click()
  await expect.poll(() => requests.completes).toEqual([
    { checklistInstanceId: '33333333-3333-4333-8333-333333333333' },
  ])
  await expect.poll(() => handoffState.completed).toBe(true)

  roleState.current = ['STORE_MANAGER']
  await setMockSessionRoles(page, roleState.current)
  await page.goto('/store/checklists')

  await expect(
    page.getByRole('heading', { name: 'Completed checklist receipts waiting on store acknowledgement' }),
  ).toBeVisible()
  const resultRow = page.locator('.store-checklists-history-row').filter({ hasText: 'BM Result' })
  await expect(resultRow).toBeVisible()
  await resultRow.getByRole('button', { name: 'View details' }).click()
  await expect(page.getByText('Checklist result', { exact: true })).toBeVisible()
  await page.getByLabel('Acknowledgement note').fill('Store saw the completed visit')
  await page.getByRole('button', { name: 'I acknowledge' }).click()

  await expect.poll(() => requests.acknowledgements).toEqual([
    {
      checklistInstanceId: '44444444-4444-4444-8444-444444444444',
      body: { acknowledgementNote: 'Store saw the completed visit' },
    },
  ])
  await expect(page.getByText('No pending checklist receipts')).toBeVisible()
  await expect(page.getByText('Store saw the completed visit')).toBeVisible()
  await expect(
    page.locator('.store-checklists-history-row').filter({ hasText: 'BM Result' }).filter({ hasText: 'Acknowledged' }),
  ).toBeVisible()
})

test('region manager can read BM and VM checklist results without acknowledging them', async ({ page }) => {
  await setupChecklistPage(page, ['REGION_MANAGER'])
  await page.goto('/store/checklists')

  await expect(page.locator('.store-checklists-history-row').filter({ hasText: 'BM Result' })).toBeVisible()
  await expect(page.locator('.store-checklists-history-row').filter({ hasText: 'VM Result' })).toBeVisible()
  await page
    .locator('.store-checklists-history-row')
    .filter({ hasText: 'VM Result' })
    .getByRole('button', { name: 'Detayı gör' })
    .click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByText('Bu checklist incelenebilir')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Kabul ettim' })).toHaveCount(0)
})

test('visual merchandiser sees checklist-only VM coverage and no broad store links', async ({ page }) => {
  const requests = createChecklistRequestLog()
  await setupChecklistPage(page, ['VISUAL_MERCHANDISER'], {
    templateType: 'VM_STORE_VISIT',
    templateCode: 'VM_VISIT_V1',
    templateName: 'VM Visit',
    activeInstances: [],
    monthlySummaries: [],
    requests,
  })
  await page.goto('/store/checklists')

  await expect(page.getByText('VM checklist yapılmadı')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Checklist yap' })).toBeVisible()
  await page.getByRole('button', { name: 'Checklist yap' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByText('Vitrin standartlara uygun')).toBeVisible()
  await expect.poll(() => requests.starts).toEqual([{ checklistTemplateId: templateId, storeId }])
  await expect(page.locator('.store-checklist-modal-start')).toHaveCount(0)
  await page.getByLabel('Puan').fill('8')
  await page.getByLabel('Not').fill('Vitrin iyi')
  await expect.poll(() => requests.saves).toContainEqual(
    {
      checklistInstanceId: '33333333-3333-4333-8333-333333333333',
      body: {
        templateItemId: '55555555-5555-4555-8555-555555555555',
        scoreValue: 8,
        commentText: 'Vitrin iyi',
      },
    },
  )
  await expect(
    page.locator('.store-command-nav').getByRole('link', { name: 'Checklist', exact: true }),
  ).toBeVisible()
  await expect(
    page.locator('.store-command-nav').getByRole('link', { name: 'Duyurular', exact: true }),
  ).toBeVisible()
  await expect(page.locator('a[href="/admin/reports"]')).toHaveCount(0)
  await expect(page.locator('a[href="/store/kpis"]')).toHaveCount(0)
  await expect(page.locator('a[href="/store/rankings"]')).toHaveCount(0)
  await expect(page.locator('a[href="/store/approvals"]')).toHaveCount(0)
  await expect(page.locator('a[href="/store/targets"]')).toHaveCount(0)
  await expect(page.locator('a[href="/store/reports"]')).toHaveCount(0)
  await expect(page.locator('a[href="/store/competitions"]')).toHaveCount(0)
  await expect(page.locator('.store-checklists-history-row').filter({ hasText: 'BM Result' })).toHaveCount(0)
  await expect(page.locator('.store-checklists-history-row').filter({ hasText: 'VM Result' })).toBeVisible()
})

test('store checklist surface switches to English copy and persists locale', async ({ page }) => {
  await setupChecklistPage(page, ['SUPER_ADMIN'])
  await page.goto('/store/checklists')

  await setStoredLocale(page, 'en')

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(
    page.getByRole('heading', { name: 'Checklist operations panel' }),
  ).toBeVisible()
  await expect(page.getByText('Visit flow')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Assigned store checklist visits' })).toBeVisible()
  await expect(page.getByText('In progress', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('Active drafts', { exact: true })).toBeVisible()
  await expect(page.getByText('This month', { exact: true })).toBeVisible()
  await expect(page.locator('.store-checklists-visit-row').getByText('Draft', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Complete', exact: true })).toBeVisible()
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Cancel' }).click()
  await expect(
    page.getByRole('heading', { name: 'Completed checklist receipts waiting on store acknowledgement' }),
  ).toBeVisible()
  await page
    .locator('.store-checklists-history-row')
    .filter({ hasText: 'BM Result' })
    .getByRole('button', { name: 'View details' })
    .click()
  await expect(page.getByText('Checklist result', { exact: true })).toBeVisible()
  await expect(page.getByText('Acknowledgement note')).toBeVisible()
  await expect(page.getByRole('button', { name: 'I acknowledge' })).toBeVisible()
  await expect(page.getByText('Checklist sonuçları')).toHaveCount(0)
  await expect(page.getByText('Ziyaret akışı')).toHaveCount(0)
  await expect(page.locator('body')).not.toContainText('Ãƒ')
  await expect(page.locator('body')).not.toContainText('Ã„')
  await expect(page.locator('body')).not.toContainText('Ã…')

  await page.reload()

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(
    page.getByRole('heading', { name: 'Checklist operations panel' }),
  ).toBeVisible()
})

type ChecklistFixtureOptions = {
  templateType?: string
  templateCode?: string
  templateName?: string
  activeInstances?: ChecklistActiveInstanceFixture[]
  monthlySummaries?: ChecklistMonthlySummaryFixture[]
  requests?: ChecklistRequestLog
  roleState?: ChecklistRoleState
  handoffState?: ChecklistHandoffState
}

type ChecklistActiveInstanceFixture = {
  checklistInstanceId: string
  checklistTemplateId: string
  storeId: string
  status: string
  startedAt: string
  updatedAt: string
  responses?: Array<{
    templateItemId: string
    scoreValue: number
    commentText: string | null
  }>
}

type ChecklistMonthlySummaryFixture = {
  storeId: string
  checklistTemplateId: string
  monthStart: string
  completedCount: number
  averageScore: number | null
}

type ChecklistRequestLog = {
  starts: Array<{ checklistTemplateId: string; storeId: string }>
  saves: Array<{
    checklistInstanceId: string
    body: { templateItemId: string; scoreValue: number; commentText?: string }
  }>
  completes: Array<{ checklistInstanceId: string }>
  acknowledgements: Array<{
    checklistInstanceId: string
    body: { acknowledgementNote?: string }
  }>
}

type ChecklistRoleState = { current: string[] }

type ChecklistHandoffState = {
  completed: boolean
  acknowledged: boolean
  acknowledgementNote?: string
}

function createChecklistRequestLog(): ChecklistRequestLog {
  return {
    starts: [],
    saves: [],
    completes: [],
    acknowledgements: [],
  }
}

async function setupChecklistPage(page: Page, roleCodes: string[], options: ChecklistFixtureOptions = {}) {
  const roleCodeHeader = roleCodes.join(',')
  await page.addInitScript((roles) => {
    window.localStorage.setItem(
      'store-ops-admin-session',
      JSON.stringify({
        mode: 'mock',
        mockUserId: 'checklist-surface-user',
        mockRoleCodes: roles,
        mockCompanyIds: '00000000-0000-0000-0000-000000000001',
        bearerToken: '',
      }),
    )
  }, roleCodeHeader)

  await routeChecklistApi(page, roleCodes, options)
}

async function setMockSessionRoles(page: Page, roleCodes: string[]) {
  await page.evaluate((roles) => {
    const session = JSON.parse(window.localStorage.getItem('store-ops-admin-session') ?? '{}')
    window.localStorage.setItem(
      'store-ops-admin-session',
      JSON.stringify({
        ...session,
        mockRoleCodes: roles,
      }),
    )
  }, roleCodes.join(','))
}

async function routeChecklistApi(page: Page, roleCodes: string[], options: ChecklistFixtureOptions) {
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({ json: createAuthSessionFixture(options.roleState?.current ?? roleCodes) })
  })

  await page.route('**/api/mobile/checklists/today', async (route) => {
    await route.fulfill({ json: createMobileChecklistTodayFixture(options) })
  })

  await page.route('**/api/checklists/acknowledgements/list', async (route) => {
    await route.fulfill({
      json: createChecklistAcknowledgementsFixture(
        options.roleState?.current ?? roleCodes,
        options.handoffState,
      ),
    })
  })

  await page.route('**/api/mobile/checklists/instances', async (route) => {
    options.requests?.starts.push(await route.request().postDataJSON())
    await route.fulfill({
      status: 201,
      json: {
        command: { status: 'created', message: 'Checklist visit started' },
        data: {
          checklistInstance: {
            checklist_instance_id: '33333333-3333-4333-8333-333333333333',
            status: 'in_progress',
            created_at: '2026-04-28T10:00:00.000Z',
          },
        },
      },
    })
  })

  await page.route('**/api/mobile/checklists/instances/*/responses', async (route) => {
    const match = route.request().url().match(/instances\/([^/]+)\/responses/)
    options.requests?.saves.push({
      checklistInstanceId: match?.[1] ?? '',
      body: await route.request().postDataJSON(),
    })
    await route.fulfill({
      json: {
        command: { status: 'saved', message: 'Checklist response saved' },
        data: {
          checklistResponse: {
            response_id: '66666666-6666-4666-8666-666666666666',
            responded_at: '2026-04-28T10:05:00.000Z',
          },
        },
      },
    })
  })

  await page.route('**/api/mobile/checklists/instances/*/complete', async (route) => {
    const match = route.request().url().match(/instances\/([^/]+)\/complete/)
    options.requests?.completes.push({ checklistInstanceId: match?.[1] ?? '' })
    if (options.handoffState) {
      options.handoffState.completed = true
    }
    await route.fulfill({
      json: {
        command: { status: 'completed', message: 'Checklist instance completed' },
        data: {
          checklistInstance: {
            checklist_instance_id: match?.[1] ?? '33333333-3333-4333-8333-333333333333',
            status: 'completed',
          },
        },
      },
    })
  })

  await page.route('**/api/checklists/instances/*/acknowledge', async (route) => {
    const match = route.request().url().match(/instances\/([^/]+)\/acknowledge/)
    const body = await route.request().postDataJSON()
    options.requests?.acknowledgements.push({
      checklistInstanceId: match?.[1] ?? '',
      body,
    })
    if (options.handoffState) {
      options.handoffState.acknowledged = true
      options.handoffState.acknowledgementNote = body.acknowledgementNote
    }
    await route.fulfill({
      json: {
        command: { status: 'acknowledged', message: 'Checklist instance acknowledged' },
        data: {
          acknowledgement: {
            checklistAcknowledgementId: '77777777-7777-4777-8777-777777777777',
            acknowledgedByUserId: 'store-manager-1',
            acknowledgementNote: body.acknowledgementNote ?? 'Mağaza sonucu gördü',
            acknowledgedAt: '2026-04-28T11:00:00.000Z',
          },
        },
      },
    })
  })
}

function createAuthSessionFixture(roleCodes: string[]) {
  return {
    authMode: 'mock',
    authenticated: true,
    user: {
      userId: 'checklist-surface-user',
      roleCodes,
      scope: {
        companyIds: ['00000000-0000-0000-0000-000000000001'],
        regionIds: ['12121212-1212-4121-8121-121212121212'],
        storeIds: [storeId],
      },
      readScope: {
        companyIds: ['00000000-0000-0000-0000-000000000001'],
        regionIds: ['12121212-1212-4121-8121-121212121212'],
        storeIds: [storeId],
      },
      actionScope: {
        assignedStoreIds: [storeId],
      },
      assignedStoreIds: [storeId],
    },
    scopeSummary: {
      companyCount: 1,
      regionCount: 1,
      storeCount: 1,
      assignedStoreCount: 1,
    },
  }
}

function createMobileChecklistTodayFixture(options: ChecklistFixtureOptions = {}) {
  const templateType = options.templateType ?? 'BM_STORE_VISIT'
  const templateCode = options.templateCode ?? 'BM_VISIT_V1'
  const templateName = options.templateName ?? 'BM Visit'

  return {
  data: {
    stores: [{ storeId, storeName: 'Marmara Park' }],
    templates: [
      {
        checklistTemplateId: templateId,
        templateCode,
        templateType,
        templateName,
        versionNo: 1,
        items: [
          {
            templateItemId: '55555555-5555-4555-8555-555555555555',
            sectionName: 'Gorsel duzen',
            itemNo: 1,
            itemText: 'Vitrin standartlara uygun',
            responseType: 'score',
            weight: 100,
            maxScore: 10,
          },
        ],
      },
    ],
    activeInstances: (
      options.activeInstances ?? [
        {
          checklistInstanceId: '33333333-3333-4333-8333-333333333333',
          checklistTemplateId: templateId,
          storeId,
          status: 'in_progress',
          startedAt: '2026-04-28T10:00:00.000Z',
          updatedAt: '2026-04-28T10:00:00.000Z',
        },
      ]
    ).map((instance) => ({ ...instance, responses: instance.responses ?? [] })),
    completedThisMonth: [],
    pendingAcknowledgements: [],
    monthlySummaries: options.monthlySummaries ?? [
      {
        storeId,
        checklistTemplateId: templateId,
        monthStart: '2026-04-01',
        completedCount: 2,
        averageScore: 86,
      },
    ],
  },
}
}

function createChecklistAcknowledgementsFixture(
  roleCodes: string[],
  handoffState?: ChecklistHandoffState,
) {
  const items = [
    {
      checklistInstanceId: '44444444-4444-4444-8444-444444444444',
      checklistTemplateId: templateId,
      templateName: 'BM Result',
      templateType: 'BM_STORE_VISIT',
      category: 'BM',
      storeId,
      storeName: 'Marmara Park',
      completedByUserId: 'region-user-1',
      completedAt: '2026-04-28T09:00:00.000Z',
      status: 'completed',
      totalScore: 86,
      complianceRate: 0.75,
      responses: [
        {
          templateItemId: '55555555-5555-4555-8555-555555555555',
          sectionName: 'Vitrin',
          itemNo: 1,
          itemText: 'Vitrin standartlara uygun',
          responseType: 'score',
          weight: 60,
          maxScore: 10,
          scoreValue: 5,
          commentText: 'Eksik manken',
        },
        {
          templateItemId: '55555555-5555-4555-8555-555555555556',
          sectionName: 'Kasa',
          itemNo: 2,
          itemText: 'Kasa alanı düzenli',
          responseType: 'score',
          weight: 40,
          maxScore: 10,
          scoreValue: 9,
          commentText: 'Temiz',
        },
      ],
      acknowledgement: handoffState?.acknowledged
        ? {
            checklistAcknowledgementId: '77777777-7777-4777-8777-777777777777',
            acknowledgedByUserId: 'store-manager-1',
            acknowledgementNote: handoffState.acknowledgementNote ?? null,
            acknowledgedAt: '2026-04-28T11:00:00.000Z',
          }
        : null,
    },
    {
      checklistInstanceId: '88888888-8888-4888-8888-888888888888',
      checklistTemplateId: '99999999-9999-4999-8999-999999999999',
      templateName: 'VM Result',
      templateType: 'VM_STORE_VISIT',
      category: 'VM',
      storeId,
      storeName: 'Marmara Park',
      completedByUserId: 'vm-user-1',
      completedAt: '2026-04-27T09:00:00.000Z',
      status: 'completed',
      totalScore: 92,
      complianceRate: 1,
      responses: [
        {
          templateItemId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          sectionName: 'Görsel düzen',
          itemNo: 1,
          itemText: 'Reyon düzeni temiz',
          responseType: 'score',
          weight: 100,
          maxScore: 10,
          scoreValue: 10,
          commentText: null,
        },
      ],
      acknowledgement: null,
    },
  ]
  const completedItems = handoffState
    ? handoffState.completed
      ? [items[0]]
      : []
    : items
  const visibleItems = roleCodes.includes('VISUAL_MERCHANDISER')
    ? completedItems.filter((item) => item.templateType === 'VM_STORE_VISIT')
    : completedItems

  return {
    items: visibleItems,
    meta: {
      count: visibleItems.length,
      total: visibleItems.length,
      limit: 50,
      offset: 0,
    },
  }
}
