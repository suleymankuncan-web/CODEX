import type { TestInfo } from '@playwright/test'
import { expect, test, type Locator, type Page } from './test-fixtures'
import { checklistEvidenceOutputPath } from './checklist-evidence-output'
import { setStoredLocale } from './locale-test-utils'
import { expectChecklistResultModalAlignedContract, expectChecklistResultModalNoScoreContract, expectChecklistResultModalVisualContract } from './checklist-result-modal-assertions'

const storeId = '11111111-1111-4111-8111-111111111111'
const templateId = '22222222-2222-4222-8222-222222222222'
const vmTemplateId = '99999999-9999-4999-8999-999999999999'
const checklistFixtureNow = new Date('2026-05-20T12:00:00.000Z')

test('region manager checklist surface shows assigned store visit workflow', async ({ page }) => {
  const requests = createChecklistRequestLog()
  await setupChecklistPage(page, ['REGION_MANAGER'], { requests })
  const directUrl = `/store/checklists?overlay=workflow&storeId=${storeId}&workflowTab=visits&workflowChecklist=bm`
  await page.goto(directUrl)

  await expect(page.locator('.store-checklists-command-page')).toHaveCount(0)
  await expect(page.getByRole('dialog', { name: 'Checklist Oturumu' })).toBeVisible()
  await expect(page.getByText('Vitrin standartlara uygun')).toBeVisible()
  await answerChecklistScoreQuestion(page, '8', 'Raf ve vitrin uygun')
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
  await page.getByRole('dialog').getByRole('button', { name: 'Kapat', exact: true }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Checklisti kapat' }).click()
  await expect(page).not.toHaveURL(/overlay=workflow/)
  await page.goto(directUrl)
  await expect(page.getByRole('dialog').getByRole('radio', { name: '8', exact: true })).toBeChecked()
  await expect(page.getByRole('dialog').getByRole('textbox', { name: /Not/ })).toHaveValue('Raf ve vitrin uygun')
  await expect(page.getByRole('button', { name: 'Tamamla', exact: true })).toBeEnabled()
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Tamamla', exact: true }).click()
  await expect.poll(() => requests.completes).toEqual([
    { checklistInstanceId: '33333333-3333-4333-8333-333333333333' },
  ])
  await expect(page).not.toHaveURL(/overlay=workflow/)
  await expect(page.getByRole('dialog', { name: /Checklist akışı/ })).toHaveCount(0)
})

test('direct checklist closes the workflow drawer after successful completion', async ({ page }) => {
  const requests = createChecklistRequestLog()
  await setupChecklistPage(page, ['REGION_MANAGER'], { requests })
  await page.goto(`/store/checklists?overlay=workflow&storeId=${storeId}&workflowTab=visits&workflowChecklist=bm`)

  await expect(page.getByRole('dialog', { name: 'Checklist Oturumu' })).toBeVisible()
  await answerChecklistScoreQuestion(page, '8', 'Continued checklist should close')
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Tamamla', exact: true }).click()

  await expect.poll(() => requests.completes).toEqual([
    { checklistInstanceId: '33333333-3333-4333-8333-333333333333' },
  ])
  await expect(page).not.toHaveURL(/overlay=workflow/)
  await expect(page.getByRole('dialog', { name: /Checklist akışı/ })).toHaveCount(0)
})

test('continued checklist with saved draft responses completes without another edit', async ({ page }) => {
  const requests = createChecklistRequestLog()
  await setupChecklistPage(page, ['REGION_MANAGER'], {
    acknowledgementItems: [],
    activeInstances: [
      {
        checklistInstanceId: '33333333-3333-4333-8333-333333333333',
        checklistTemplateId: templateId,
        storeId,
        status: 'in_progress',
        startedAt: '2026-05-20T10:00:00.000Z',
        updatedAt: '2026-05-20T10:05:00.000Z',
        responses: [
          {
            templateItemId: '55555555-5555-4555-8555-555555555555',
            scoreValue: 8,
            commentText: 'Saved before completion',
          },
        ],
      },
    ],
    monthlySummaries: [],
    requests,
  })
  await page.goto(`/store/checklists?overlay=workflow&storeId=${storeId}&workflowTab=visits&workflowChecklist=bm`)

  await expect(page.getByRole('dialog', { name: 'Checklist Oturumu' })).toBeVisible()
  await expect(page.getByRole('dialog').getByRole('radio', { name: '8', exact: true })).toBeChecked()
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Tamamla', exact: true }).click()

  await expect.poll(() => requests.saves).toEqual([])
  await expect.poll(() => requests.completes).toEqual([
    { checklistInstanceId: '33333333-3333-4333-8333-333333333333' },
  ])
  await expect(page).not.toHaveURL(/overlay=workflow/)
  await expect(page.getByRole('dialog', { name: /Checklist akışı/ })).toHaveCount(0)
})

test('store manager checklist surface keeps acknowledgement language', async ({ page }) => {
  const requests = createChecklistRequestLog()
  await setupChecklistPage(page, ['STORE_MANAGER'], { requests })
  await page.goto(`/store/checklists?overlay=workflow&storeId=${storeId}&workflowTab=inbox`)

  await page.getByTestId('checklist-workflow-result-row').filter({ hasText: 'BM Result' }).getByRole('button', { name: 'Detayı gör' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expectChecklistResultModalVisualContract(dialog)
  await expectNoElementHorizontalOverflow(dialog)
  await expect(page.getByText('Eksik manken')).toHaveCount(0)
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

test('store manager checklist inbox keeps overdue acknowledgements visible by default', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('store-ops-app-locale', 'en')
  })
  await setupChecklistPage(page, ['STORE_MANAGER'], {
    acknowledgementCompletedAt: getPreviousMonthIsoDate(),
  })
  await page.goto(`/store/checklists?overlay=workflow&storeId=${storeId}&workflowTab=inbox`)

  await expect(page.getByLabel('Result acknowledgement')).toBeVisible()
  await expect(page.getByTestId('checklist-workflow-result-row').filter({ hasText: 'BM Result' })).toBeVisible()
})

test('store checklist area lets managers retry after acknowledgement load fails', async ({ page }) => {
  let acknowledgementAttempts = 0
  let allowAcknowledgements = false

  await setupChecklistPage(page, ['STORE_MANAGER'])
  await page.unroute('**/api/checklists/acknowledgements/list')
  await page.route('**/api/checklists/acknowledgements/list', async (route) => {
    acknowledgementAttempts += 1

    if (!allowAcknowledgements) {
      await route.fulfill({
        status: 503,
        json: { message: 'Temporary checklist acknowledgement outage' },
      })
      return
    }

    await route.fulfill({ json: createChecklistAcknowledgementsFixture(['STORE_MANAGER']) })
  })

  await page.goto(`/store/checklists?overlay=workflow&storeId=${storeId}&workflowTab=inbox`)

  await expect(page.getByText('Checklist akışı yüklenemedi')).toBeVisible()
  const retryButton = page.getByLabel('Checklist akışı').getByRole('button', { name: 'Tekrar dene' })
  await expect(retryButton).toBeVisible()

  allowAcknowledgements = true
  await retryButton.click()

  await expect(page.getByLabel('Sonuç kabulü')).toBeVisible()
  await expect.poll(() => acknowledgementAttempts).toBeGreaterThan(1)
  await expect(page.getByText('Checklist akışı yüklenemedi')).toHaveCount(0)
})

test('completed checklist handoff moves from field visit to store acknowledgement history', async ({ page }) => {
  let commandCanvasRequests = 0
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/checklists/command-canvas') {
      commandCanvasRequests += 1
    }
  })
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
    showStartedInstanceOnRefetch: true,
  })
  const directUrl = `/store/checklists?overlay=workflow&storeId=${storeId}&workflowTab=visits&workflowChecklist=bm`
  await page.goto(directUrl)

  const checklistSession = page.getByRole('dialog', { name: 'Checklist Session' })
  await expect(checklistSession).toBeVisible()
  await expect(page.getByRole('dialog', { name: /Checklist workflow/ })).toHaveCount(0)
  await expect(page.getByText('Vitrin standartlara uygun')).toBeVisible()
  await expect.poll(() => requests.starts).toEqual([{ checklistTemplateId: templateId, storeId }])
  await expect(page.locator('.store-checklist-modal-start')).toHaveCount(0)

  await answerChecklistScoreQuestion(page, '8', 'Handoff-ready visit')
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
  await page.getByRole('button', { name: 'Cancel' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Close checklist' }).click()
  await expect(checklistSession).toHaveCount(0)
  await page.goto(directUrl)
  await expect(page.getByRole('dialog').getByRole('radio', { name: '8', exact: true })).toBeChecked()
  await expect(page.getByRole('dialog').getByRole('textbox', { name: /Note/ })).toHaveValue('Handoff-ready visit')

  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Complete', exact: true }).click()
  await expect.poll(() => requests.completes).toEqual([
    { checklistInstanceId: '33333333-3333-4333-8333-333333333333' },
  ])
  await expect.poll(() => handoffState.completed).toBe(true)
  await expect.poll(() => commandCanvasRequests).toBeGreaterThan(1)
  await expect(page).not.toHaveURL(/overlay=workflow/)
  await expect(page.getByRole('dialog', { name: /Checklist workflow/ })).toHaveCount(0)
  await page.goto('/store/checklists?tab=incomplete')
  await expect(page).toHaveURL(/\/store\/checklists\?tab=incomplete$/)
  await expect(page.locator('.store-checklists-command-page')).toHaveCount(0)
  await expect(page.getByRole('tab', { name: /Incomplete/ })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Field Controls' })).toBeVisible()

  roleState.current = ['STORE_MANAGER']
  await setMockSessionRoles(page, roleState.current)
  await page.goto(`/store/checklists?overlay=workflow&storeId=${storeId}&workflowTab=inbox`)

  const resultRow = page.getByTestId('checklist-workflow-result-row').filter({ hasText: 'BM Result' })
  await expect(resultRow).toBeVisible()
  await resultRow.getByRole('button', { name: 'View details' }).click()
  await expect(page.getByText('Checklist result', { exact: true })).toBeVisible()
  await expect(page.locator('.store-checklist-result-overview')).toBeVisible()
  await expect(page.locator('.store-checklist-result-action-card')).toBeVisible()
  await page.getByLabel('Acknowledgement note').fill('Store saw the completed visit')
  await page.getByRole('button', { name: 'I acknowledge' }).click()

  await expect.poll(() => requests.acknowledgements).toEqual([
    {
      checklistInstanceId: '44444444-4444-4444-8444-444444444444',
      body: { acknowledgementNote: 'Store saw the completed visit' },
    },
  ])
  await expect(page).toHaveURL(/workflowTab=history/)
  const acknowledgedRow = page.getByTestId('checklist-workflow-result-row').filter({ hasText: 'BM Result' })
  await expect(acknowledgedRow).toBeVisible()
  await acknowledgedRow.getByRole('button', { name: 'View details' }).click()
  await expect(page.getByText('Store saw the completed visit')).toBeVisible()
})

test('completed checklist refreshes the store task queue cache', async ({ page }) => {
  const requests = createChecklistRequestLog()
  const handoffState: ChecklistHandoffState = {
    completed: false,
    acknowledged: false,
  }
  let taskWorkspaceRequests = 0

  await page.addInitScript(() => {
    window.localStorage.setItem('store-ops-app-locale', 'en')
  })
  await setupChecklistPage(page, ['STORE_MANAGER', 'VISUAL_MERCHANDISER'], {
    activeInstances: [],
    handoffState,
    monthlySummaries: [],
    requests,
    templateName: 'VM Visit',
    templateType: 'VM_STORE_VISIT',
  })
  await page.route('**/api/store/tasks/workspace**', async (route) => {
    taskWorkspaceRequests += 1
    const items = handoffState.completed
      ? [
          {
            actionPlanId: '77777777-7777-4777-8777-777777777777',
            storeId,
            storeName: 'Marmara Park',
            title: 'VM Result',
            summary: 'Marmara Park completed checklist result',
            priority: 'medium',
            status: 'closed',
            dueOn: '2026-05-21',
            createdAt: '2026-05-20T10:30:00.000Z',
            updatedAt: '2026-05-20T10:30:00.000Z',
            completedAt: '2026-05-20T10:30:00.000Z',
            resultNote: 'VM checklist completed.',
            source: {
              type: 'checklist_remediation',
              id: '44444444-4444-4444-8444-444444444444',
              deepLink: '/store/checklists',
            },
            events: {
              items: [],
              total: 0,
              limit: 20,
              hasMore: false,
            },
          },
        ]
      : []
    await route.fulfill({
      json: {
        data: {
          view: 'store_manager',
          capabilities: {
            canStart: true,
            canUpdate: true,
            canComplete: true,
            canCancel: true,
          },
          items,
          summary: {
            retained: items.length,
            actionable: 0,
            completed: items.length,
            cancelled: 0,
            checklist: items.length,
          },
          page: {
            total: items.length,
            limit: 20,
            offset: 0,
            count: items.length,
            hasMore: false,
          },
        },
      },
    })
  })

  await page.goto('/store/tasks')
  await expect(page.getByTestId('store-action-plans-panel')).toBeVisible()
  await expect(page.getByTestId('store-action-plan-row').filter({ hasText: 'VM Result' })).toHaveCount(0)
  expect(taskWorkspaceRequests).toBe(1)

  await page.goto(`/store/checklists?overlay=workflow&storeId=${storeId}&workflowTab=visits&workflowChecklist=vm`)
  await expect(page.getByRole('dialog', { name: 'Checklist Session' })).toBeVisible()
  await answerChecklistScoreQuestion(page, '8', 'Task-refresh visit')
  await expect.poll(() => requests.saves).toContainEqual(
    {
      checklistInstanceId: '33333333-3333-4333-8333-333333333333',
      body: {
        templateItemId: '55555555-5555-4555-8555-555555555555',
        scoreValue: 8,
        commentText: 'Task-refresh visit',
      },
    },
  )
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Complete', exact: true }).click()
  await expect.poll(() => handoffState.completed).toBe(true)

  await page.goto('/store/tasks')
  await expect(page.getByTestId('store-action-plans-panel')).toBeVisible()

  await expect.poll(() => taskWorkspaceRequests).toBeGreaterThanOrEqual(2)
  await expect(page.getByTestId('store-action-plan-row').filter({ hasText: 'VM Result' })).toBeVisible()
})

test('region manager reads its BM results without exposing the VM result lane', async ({ page }) => {
  await setupChecklistPage(page, ['REGION_MANAGER'])
  await page.goto(`/store/checklists?overlay=workflow&storeId=${storeId}&workflowTab=inbox`)

  await expect(page.getByRole('dialog', { name: /Checklist akışı/ })).toBeVisible()
  await expect(page.getByTestId('checklist-workflow-result-row').filter({ hasText: 'BM Result' })).toBeVisible()
  await expect(page.getByTestId('checklist-workflow-result-row').filter({ hasText: 'VM Result' })).toHaveCount(0)
  await page.getByTestId('checklist-workflow-result-row').filter({ hasText: 'BM Result' }).getByRole('button', { name: 'Detayı gör' }).click()
  const resultDialog = page.locator('.store-checklist-result-modal')
  await expect(resultDialog.getByText('BM Result')).toBeVisible()
  await expectChecklistResultModalAlignedContract(resultDialog)
  await expect(resultDialog.locator('.store-checklist-result-action-card')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Kabul ettim' })).toHaveCount(0)
})

test('region manager direct visit starts BM checklist without a VM choice', async ({ page }) => {
  const requests = createChecklistRequestLog()
  await setupChecklistPage(page, ['REGION_MANAGER'], {
    activeInstances: [],
    includeVmTemplate: true,
    monthlySummaries: [
      {
        storeId,
        checklistTemplateId: templateId,
        monthStart: '2026-05-01',
        completedCount: 1,
        averageScore: 82,
      },
      {
        storeId,
        checklistTemplateId: vmTemplateId,
        monthStart: '2026-05-01',
        completedCount: 1,
        averageScore: 92,
      },
    ],
    requests,
  })
  await page.goto(`/store/checklists?overlay=workflow&storeId=${storeId}&workflowTab=visits&workflowChecklist=bm`)

  await expect(page.getByRole('dialog', { name: 'Checklist Oturumu' })).toBeVisible()
  await expect(page.getByText('VM Checklist')).toHaveCount(0)
  await expect.poll(() => requests.starts).toEqual([{ checklistTemplateId: templateId, storeId }])
})

test('region manager English direct visit still starts only BM checklist', async ({ page }) => {
  const requests = createChecklistRequestLog()
  await page.addInitScript(() => {
    window.localStorage.setItem('store-ops-app-locale', 'en')
  })
  await setupChecklistPage(page, ['REGION_MANAGER'], {
    activeInstances: [],
    includeVmTemplate: true,
    monthlySummaries: [
      {
        storeId,
        checklistTemplateId: vmTemplateId,
        monthStart: '2026-05-01',
        completedCount: 1,
        averageScore: 92,
      },
    ],
    requests,
  })
  await page.goto(`/store/checklists?overlay=workflow&storeId=${storeId}&workflowTab=visits&workflowChecklist=bm`)

  await expect(page.getByRole('dialog', { name: 'Checklist Session' })).toBeVisible()
  await expect(page.getByText('VM Checklist')).toHaveCount(0)
  await expect.poll(() => requests.starts).toEqual([{ checklistTemplateId: templateId, storeId }])
})

test('visual merchandiser keeps assigned VM execution without weekly plan scope', async ({ page }) => {
  await setupChecklistPage(page, ['VISUAL_MERCHANDISER'], {
    acknowledgementItems: [],
    activeInstances: [],
    monthlySummaries: [],
    stores: [{ storeId, storeName: 'Marmara Park' }],
    templateCode: 'VM_VISIT_V1',
    templateName: 'VM Visit',
    templateType: 'VM_STORE_VISIT',
  })
  await page.goto('/store/checklists?tab=plan')

  await expect(page.getByRole('heading', { name: 'VM Kontrol Merkezi' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Ziyaret Planı/ })).toHaveCount(0)
  await expect(page.getByText('BM', { exact: true })).toHaveCount(0)
  await expect(page.getByText('BM + VM')).toHaveCount(0)
})

test('visit plan is not exposed to store manager and plan URL falls back', async ({ page }) => {
  await setupChecklistPage(page, ['STORE_MANAGER'])
  await page.goto('/store/checklists?tab=plan')

  await expect(page.getByRole('tab', { name: /Ziyaret planı/ })).toHaveCount(0)
  await expect(page.locator('#store-checklist-panel-plan')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Checklist İnceleme' })).toBeVisible()
})

test('visual merchandiser sees checklist-only VM coverage and no broad store links', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
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
  await captureCloseoutRoleEvidence(page, testInfo, 'visual-merchandiser', 'VM Kontrol Merkezi')

  await expect(page.getByRole('heading', { name: 'VM Kontrol Merkezi' })).toBeVisible()
  await expect(page.getByText('Atanmış mağaza', { exact: true })).toBeVisible()
  await expect(page.getByText('BM görünümü')).toHaveCount(0)
  await expect(page.getByText('BM + VM')).toHaveCount(0)
  await expect(page.locator('.checklist-search-field input')).toBeVisible()
  expect(await page.locator('.checklist-search-field input').evaluate((element) => getComputedStyle(element).fontSize)).toBe('16px')
  await expect(page.getByText('BM', { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'VM checklistini aç' }).click()
  await expect(page).toHaveURL(/workflowChecklist=vm/)
  await expect(page.getByRole('dialog', { name: /Checklist akışı/ })).toHaveCount(0)
  await expect(page.getByRole('dialog', { name: 'Checklist Oturumu' })).toBeVisible()
  await expect(page.getByText('BM Checklist', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Vitrin standartlara uygun')).toBeVisible()
  await expect.poll(() => requests.starts).toEqual([{ checklistTemplateId: templateId, storeId }])
  await expect(page.locator('.store-checklist-modal-start')).toHaveCount(0)
  await answerChecklistScoreQuestion(page, '8', 'Vitrin iyi')
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
  await expect(page.locator('a[href="/admin/reports"]')).toHaveCount(0)
  await expect(page.locator('a[href="/store/kpis"]')).toHaveCount(0)
  await expect(page.locator('a[href="/store/rankings"]')).toHaveCount(0)
  await expect(page.locator('a[href="/store/approvals"]')).toHaveCount(0)
  await expect(page.locator('a[href="/store/targets"]')).toHaveCount(0)
  await expect(page.locator('a[href="/store/reports"]')).toHaveCount(0)
  await expect(page.locator('a[href="/store/competitions"]')).toHaveCount(0)
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'İptal' }).click()
  await page.goto(`/store/checklists?overlay=workflow&storeId=${storeId}&workflowTab=inbox`)
  await expect(page.getByTestId('checklist-workflow-result-row').filter({ hasText: 'BM Result' })).toHaveCount(0)
  await expect(page.getByTestId('checklist-workflow-result-row').filter({ hasText: 'VM Result' })).toBeVisible()
})

test('visual merchandiser without a published VM template still sees assigned store scope', async ({ page }) => {
  await setupChecklistPage(page, ['VISUAL_MERCHANDISER'], {
    activeInstances: [],
    monthlySummaries: [],
    omitTemplates: true,
  })
  await page.goto('/store/checklists')

  await expect(page.locator('.checklist-command-metrics')).toContainText('Atanmış mağaza')
  await expect(page.locator('.checklist-command-metric').first()).toContainText('1')
  await page.getByRole('button', { name: 'VM checklistini aç' }).click()
  const workflowDialog = page.getByRole('dialog', { name: /Checklist akışı/ })
  await expect(workflowDialog.getByRole('heading', { name: 'VM şablonu yayında değil' })).toBeVisible()
  await expect(workflowDialog.getByText('BM Checklist')).toHaveCount(0)
})

test('visual merchandiser completed checklist lands in store manager acknowledgement inbox', async ({ page }) => {
  const requests = createChecklistRequestLog()
  const roleState: ChecklistRoleState = { current: ['VISUAL_MERCHANDISER'] }
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
    handoffTemplateName: 'VM Result',
    handoffTemplateType: 'VM_STORE_VISIT',
    monthlySummaries: [],
    requests,
    roleState,
    templateCode: 'VM_VISIT_V1',
    templateName: 'VM Visit',
    templateType: 'VM_STORE_VISIT',
  })
  await page.goto(`/store/checklists?overlay=workflow&storeId=${storeId}&workflowTab=visits&workflowChecklist=vm`)

  await expect(page.getByRole('dialog', { name: 'Checklist Session' })).toBeVisible()
  await expect.poll(() => requests.starts).toEqual([{ checklistTemplateId: templateId, storeId }])

  await answerChecklistScoreQuestion(page, '8', 'VM handoff-ready visit')
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Complete', exact: true }).click()
  await expect.poll(() => requests.completes).toEqual([
    { checklistInstanceId: '33333333-3333-4333-8333-333333333333' },
  ])
  await expect.poll(() => handoffState.completed).toBe(true)

  roleState.current = ['STORE_MANAGER']
  await setMockSessionRoles(page, roleState.current)
  await page.goto(`/store/checklists?overlay=workflow&storeId=${storeId}&workflowTab=inbox`)

  const resultRow = page.getByTestId('checklist-workflow-result-row').filter({ hasText: 'VM Result' })
  await expect(resultRow).toBeVisible()
  await expect(resultRow.getByText('92 points')).toBeVisible()
  await resultRow.getByRole('button', { name: 'View details' }).click()
  const resultDialog = page.getByRole('dialog')
  await expect(resultDialog).toBeVisible()
  await expect(resultDialog.getByText('Checklist result', { exact: true })).toBeVisible()
  await expect(resultDialog.locator('.store-checklist-result-status-legend')).toHaveCount(0)
  await page.getByLabel('Acknowledgement note').fill('Store acknowledged VM visit')
  await page.getByRole('button', { name: 'I acknowledge' }).click()

  await expect.poll(() => requests.acknowledgements).toEqual([
    {
      checklistInstanceId: '88888888-8888-4888-8888-888888888888',
      body: { acknowledgementNote: 'Store acknowledged VM visit' },
    },
  ])
})

test('store checklist surface switches to English copy and persists locale', async ({ page }, testInfo) => {
  await setupChecklistPage(page, ['SUPER_ADMIN'])
  await page.goto('/store/checklists')

  await setStoredLocale(page, 'en')
  await captureCloseoutRoleEvidence(page, testInfo, 'super-admin', 'Checklist Administration Center')

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByText('Checklist Administration Center', { exact: true }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Notifications' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Open checklists' }).click()
  const workflowDialog = page.getByRole('dialog', { name: /Checklist workflow/ })
  await workflowDialog.getByRole('article').filter({ hasText: 'BM Checklist' }).getByRole('button', { name: 'Continue' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Mark item' })).toHaveCount(0)
  await expect(page.getByText('Add photo (optional)')).toHaveCount(0)
  await expect(page.getByText('Not ready')).toHaveCount(0)
  await expect(page.getByText('Draft saved')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Save draft' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Complete', exact: true })).toBeVisible()
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Cancel' }).click()
  await page.goto(`/store/checklists?overlay=workflow&storeId=${storeId}&workflowTab=inbox`)
  await page.getByTestId('checklist-workflow-result-row').filter({ hasText: 'BM Result' }).getByRole('button', { name: 'View details' }).click()
  await expect(page.getByText('Checklist result', { exact: true })).toBeVisible()
  await expect(page.getByText('Acknowledgement note')).toBeVisible()
  await expect(page.getByRole('button', { name: 'I acknowledge' })).toBeVisible()
  await expect(page.getByText('Checklist sonuçları')).toHaveCount(0)
  await expect(page.getByText('Ziyaretler')).toHaveCount(0)
  await expect(page.locator('body')).not.toContainText('Ãƒ')
  await expect(page.locator('body')).not.toContainText('Ã„')
  await expect(page.locator('body')).not.toContainText('Ã…')

  await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click()

  await page.reload()

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByText('Checklist Administration Center', { exact: true }).first()).toBeVisible()
})

test('mixed Super Admin and Store Manager roles keep the Super Admin command view', async ({ page }) => {
  await setupChecklistPage(page, ['SUPER_ADMIN', 'STORE_MANAGER'])
  await page.goto('/store/checklists')

  await expect(page.getByRole('region', { name: 'Super Admin checklist görünümü' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Checklist Yönetim Merkezi' })).toBeVisible()
  await expect(page.getByText('Sunucu yanıtı Super Admin kapsamıyla eşleşmedi.')).toHaveCount(0)
})

test('checklist completion waits for API success before showing completed notice', async ({ page }) => {
  const requests = createChecklistRequestLog()
  await page.addInitScript(() => {
    window.localStorage.setItem('store-ops-app-locale', 'en')
  })
  await setupChecklistPage(page, ['REGION_MANAGER'], {
    completeFailureMessage: 'Checklist complete failed',
    requests,
  })
  await page.goto(`/store/checklists?overlay=workflow&storeId=${storeId}&workflowTab=visits&workflowChecklist=bm`)

  await expect(page.getByRole('dialog', { name: 'Checklist Session' })).toBeVisible()
  await answerChecklistScoreQuestion(page, '8', 'Completion should wait')
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Complete', exact: true }).click()

  await expect.poll(() => requests.completes).toEqual([
    { checklistInstanceId: '33333333-3333-4333-8333-333333333333' },
  ])
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByRole('dialog').getByText('Checklist complete failed')).toBeVisible()
  await expect(page.getByText('Completed successfully')).toHaveCount(0)
})

test('store manager checklist result treats unavailable score as neutral', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('store-ops-app-locale', 'en')
  })
  await setupChecklistPage(page, ['STORE_MANAGER'], { resultWithoutScore: true })
  await page.goto('/store/checklists?tab=inbox&result=44444444-4444-4444-8444-444444444444')

  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expectChecklistResultModalNoScoreContract(dialog)
})

test('store manager checklist result modal stays usable on mobile width', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 844 })
  await setupChecklistPage(page, ['STORE_MANAGER'], { longCopy: true })
  await page.goto('/store/checklists?tab=inbox&result=44444444-4444-4444-8444-444444444444')

  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog.locator('.store-checklist-result-overview')).toBeVisible()
  await expect(dialog.locator('.store-checklist-result-findings')).toBeVisible()
  await expect(dialog.locator('.store-checklist-result-action-card')).toBeVisible()
  await expectChecklistResultModalVisualContract(dialog)
  await expect(page.getByLabel(/Kabul notu|Acknowledgement note/)).toBeVisible()
  await expectNoElementHorizontalOverflow(dialog)
})

test('checklist visit surface stays usable on mobile width', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 844 })
  await setupChecklistPage(page, ['REGION_MANAGER'], { longCopy: true })
  await page.goto(`/store/checklists?overlay=workflow&storeId=${storeId}&workflowTab=visits&workflowChecklist=bm`)

  const checklistDialog = page.getByRole('dialog', { name: 'Checklist Oturumu' })
  await expect(checklistDialog).toBeVisible()
  await expectNoElementHorizontalOverflow(checklistDialog)
  await expectNoHorizontalOverflow(page)

  await expect(checklistDialog.getByRole('radio', { name: '8', exact: true })).toBeVisible()
  await checklistDialog.getByText('Not ekle', { exact: true }).click()
  const noteBox = checklistDialog.getByRole('textbox', { name: /Not/ })
  await expect(noteBox).toBeVisible()
  await noteBox.click()
  await noteBox.fill('Mobil not akisi kilitlenmeden yazildi')
  await expect(noteBox).toHaveValue('Mobil not akisi kilitlenmeden yazildi')
  await checklistDialog.getByRole('button', { name: 'Kapat', exact: true }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Checklisti kapat' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page).not.toHaveURL(/overlay=workflow/)
  await expectNoHorizontalOverflow(page)
})

type ChecklistFixtureOptions = {
  acknowledgementItems?: ChecklistAcknowledgementFixture[]
  templateType?: string
  templateCode?: string
  templateName?: string
  includeVmTemplate?: boolean
  longCopy?: boolean
  acknowledgementCompletedAt?: string
  omitTemplates?: boolean
  stores?: ChecklistStoreFixture[]
  activeInstances?: ChecklistActiveInstanceFixture[]
  monthlySummaries?: ChecklistMonthlySummaryFixture[]
  requests?: ChecklistRequestLog
  roleState?: ChecklistRoleState
  handoffState?: ChecklistHandoffState
  handoffTemplateName?: string
  handoffTemplateType?: string
  showStartedInstanceOnRefetch?: boolean
  completeFailureMessage?: string
  resultWithoutScore?: boolean
  completedThisMonth?: ChecklistCompletedThisMonthFixture[]
}

type ChecklistStoreFixture = {
  storeId: string
  storeName: string
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

type ChecklistCompletedThisMonthFixture = {
  checklistInstanceId: string
  checklistTemplateId: string
  storeId: string
  completedAt: string
  totalScore: number
  acknowledgedAt: string | null
}

type ChecklistAcknowledgementFixture = {
  acknowledgement: {
    acknowledgedAt: string
    acknowledgedByUserId: string
    acknowledgementNote: string | null
    checklistAcknowledgementId: string
  } | null
  category: string
  checklistInstanceId: string
  checklistTemplateId: string
  completedAt: string
  completedByUserId: string
  complianceRate: number | null
  responses: Array<{
    commentText: string | null
    itemNo: number
    itemText: string
    maxScore: number
    responseType: string
    scoreValue: number | null
    sectionName: string
    templateItemId: string
    weight: number
  }>
  status: string
  storeId: string
  storeName: string
  templateName: string
  templateType: string
  totalScore: number | null
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

function getPreviousMonthIsoDate() {
  const date = new Date()
  date.setMonth(date.getMonth() - 1)
  date.setDate(12)
  date.setHours(9, 0, 0, 0)
  return date.toISOString()
}

async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const viewportWidth = document.documentElement.clientWidth
        const documentScrollWidth = document.documentElement.scrollWidth
        const offenders = Array.from(document.querySelectorAll<HTMLElement>('body *'))
          .filter((element) => !element.closest('.store-command-nav') && !element.closest('[role="progressbar"]'))
          .map((element) => {
            const rect = element.getBoundingClientRect()
            return {
              className: element.className.toString(),
              tagName: element.tagName.toLowerCase(),
              left: Math.round(rect.left),
              right: Math.round(rect.right),
              width: Math.round(rect.width),
            }
          })
          .filter((entry) => entry.width > 0 && (entry.left < -1 || entry.right > viewportWidth + 1))
          .slice(0, 5)

        return {
          documentScrollWidth,
          offenders,
          viewportWidth,
        }
      }),
    )
    .toMatchObject({
      documentScrollWidth: expect.any(Number),
      offenders: [],
      viewportWidth: expect.any(Number),
    })

  await expect
    .poll(async () =>
      page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1),
    )
    .toBe(true)
}

async function expectNoElementHorizontalOverflow(locator: Locator) {
  await expect.poll(async () => locator.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
}

async function answerChecklistScoreQuestion(page: Page, score: string, note: string) {
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('radio', { name: score, exact: true }).click()
  await expect(dialog.getByRole('radio', { name: score, exact: true })).toBeChecked()
  await dialog.getByText(/^(Not ekle|Add note)$/).click()
  await dialog.getByRole('textbox', { name: /Not|Note/ }).fill(note)
  await dialog.getByRole('button', { name: /Notu kaydet|Save note/ }).click()
}

async function setupChecklistPage(page: Page, roleCodes: string[], options: ChecklistFixtureOptions = {}) {
  await page.clock.setFixedTime(checklistFixtureNow)
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
  let startedInstanceVisible = false

  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({ json: createAuthSessionFixture(options.roleState?.current ?? roleCodes, options) })
  })

  await page.route('**/api/checklists/command-canvas**', async (route) => {
    const url = new URL(route.request().url())
    const stores = options.stores ?? [{ storeId, storeName: 'Marmara Park' }]
    const completedAt = options.handoffState?.completed ? '2026-05-20T10:00:00.000Z' : null
    const currentRoles = options.roleState?.current ?? roleCodes
    const view = currentRoles.includes('REGION_MANAGER')
      ? 'region_manager'
      : currentRoles.includes('SUPER_ADMIN')
        ? 'super_admin'
        : currentRoles.includes('STORE_MANAGER')
        ? 'store_manager'
        : currentRoles.includes('VISUAL_MERCHANDISER')
          ? 'visual_merchandiser'
          : 'super_admin'
    const pendingAcknowledgements = createChecklistAcknowledgementsFixture(currentRoles, options).items
      .filter((item) => item.acknowledgement === null).length
    await route.fulfill({
      json: {
        data: {
          period: url.searchParams.get('period') ?? '2026-05',
          view,
          capabilities: {
            weeklyVisitPlanningAvailable: false,
            canMaintainWeeklyVisitPlan: false,
          },
          metrics: {
            totalStores: stores.length,
            needsVisit: options.handoffState && !options.handoffState.completed ? stores.length : 0,
            active: 0,
            pending: 0,
            completed: options.handoffState && !options.handoffState.completed ? 0 : stores.length,
          },
          items: stores.map((store) => ({
            storeId: store.storeId,
            storeCode: null,
            storeName: store.storeName,
            regionId: '12121212-1212-4121-8121-121212121212',
            regionName: 'Marmara',
            regionManagers: [{ displayName: 'Pilot Bölge Müdürü' }],
            bmScore: null,
            vmScore: null,
            bmCompletedAt: completedAt,
            vmCompletedAt: null,
            lastCompletedVisitAt: completedAt,
            elapsedDaysSinceLastVisit: completedAt ? 1 : null,
            activeChecklistCount: 0,
            pendingAcknowledgementCount: pendingAcknowledgements,
            openActionCount: 0,
            blockedActionCount: 0,
            status: options.handoffState && !options.handoffState.completed ? 'needs_visit' : 'completed',
            reasonCodes: options.handoffState && !options.handoffState.completed ? ['missing_bm_visit'] : ['completed_period'],
            lastOperationalAt: null,
          })),
          page: { total: stores.length, limit: 30, offset: 0, hasMore: false },
        },
      },
    })
  })

  await page.route('**/api/checklists/command-canvas/visit-plans/regions**', async (route) => {
    await route.fulfill({
      json: {
        data: {
          items: [{ regionId: '12121212-1212-4121-8121-121212121212', regionName: 'Marmara' }],
          page: { total: 1, limit: 20, offset: 0, hasMore: false },
        },
      },
    })
  })

  await page.route('**/api/checklists/command-canvas/visit-plans?**', async (route) => {
    const url = new URL(route.request().url())
    await route.fulfill({
      json: {
        data: {
          planId: null,
          regionId: url.searchParams.get('regionId') ?? '12121212-1212-4121-8121-121212121212',
          regionName: 'Marmara',
          weekStart: url.searchParams.get('weekStart') ?? '2026-05-18',
          revision: 0,
          revisedAt: null,
          view: 'region_manager',
          capabilities: { canMaintainWeeklyVisitPlan: false },
          items: [],
        },
      },
    })
  })

  await page.route('**/api/mobile/checklists/today', async (route) => {
    const shouldShowStartedInstance =
      options.showStartedInstanceOnRefetch && startedInstanceVisible && !options.handoffState?.completed
    const baseActiveInstances = shouldShowStartedInstance
      ? [
          {
            checklistInstanceId: '33333333-3333-4333-8333-333333333333',
            checklistTemplateId: templateId,
            storeId,
            status: 'in_progress',
            startedAt: '2026-05-20T10:00:00.000Z',
            updatedAt: '2026-05-20T10:00:00.000Z',
            responses: [],
          },
        ]
      : options.activeInstances ?? [
          {
            checklistInstanceId: '33333333-3333-4333-8333-333333333333',
            checklistTemplateId: templateId,
            storeId,
            status: 'in_progress',
            startedAt: '2026-05-20T10:00:00.000Z',
            updatedAt: '2026-05-20T10:00:00.000Z',
            responses: [],
          },
        ]
    const activeInstances = baseActiveInstances?.map((instance) => {
      const responses = new Map(
        (instance.responses ?? []).map((response) => [response.templateItemId, response]),
      )
      for (const saved of options.requests?.saves ?? []) {
        if (saved.checklistInstanceId !== instance.checklistInstanceId) continue
        responses.set(saved.body.templateItemId, {
          templateItemId: saved.body.templateItemId,
          scoreValue: saved.body.scoreValue,
          commentText: saved.body.commentText ?? null,
        })
      }
      return { ...instance, responses: [...responses.values()] }
    })
    await route.fulfill({
      json: createMobileChecklistTodayFixture(
        activeInstances ? { ...options, activeInstances } : options,
      ),
    })
  })

  await page.route('**/api/checklists/acknowledgements/list', async (route) => {
    const fixture = createChecklistAcknowledgementsFixture(options.roleState?.current ?? roleCodes, options)
    const body = route.request().postDataJSON() as { checklistInstanceId?: string } | null
    const items = body?.checklistInstanceId
      ? fixture.items.filter((item) => item.checklistInstanceId === body.checklistInstanceId)
      : fixture.items
    await route.fulfill({
      json: {
        ...fixture,
        items,
        meta: { ...fixture.meta, count: items.length, total: items.length },
      },
    })
  })

  await page.route('**/api/workflow/inbox', async (route) => {
    await route.fulfill({
      json: {
        items: [],
        meta: {
          count: 0,
          total: 0,
          limit: 30,
          offset: 0,
        },
      },
    })
  })

  await page.route('**/api/mobile/checklists/instances', async (route) => {
    options.requests?.starts.push(await route.request().postDataJSON())
    startedInstanceVisible = true
    await route.fulfill({
      status: 201,
      json: {
        command: { status: 'created', message: 'Checklist visit started' },
        data: {
          checklistInstance: {
            checklist_instance_id: '33333333-3333-4333-8333-333333333333',
            status: 'in_progress',
            created_at: '2026-05-20T10:00:00.000Z',
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
            responded_at: '2026-05-20T10:05:00.000Z',
          },
        },
      },
    })
  })

  await page.route('**/api/mobile/checklists/instances/*/complete', async (route) => {
    const match = route.request().url().match(/instances\/([^/]+)\/complete/)
    options.requests?.completes.push({ checklistInstanceId: match?.[1] ?? '' })
    if (options.completeFailureMessage) {
      await route.fulfill({
        status: 500,
        body: options.completeFailureMessage,
      })
      return
    }
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
            total_score: '80.00',
            compliance_rate: '1.0000',
            completed_at: '2026-05-20T10:30:00.000Z',
            locked_at: '2026-05-20T10:30:00.000Z',
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
            acknowledgedAt: '2026-05-20T11:00:00.000Z',
          },
        },
      },
    })
  })
}

function createAuthSessionFixture(roleCodes: string[], options: ChecklistFixtureOptions = {}) {
  const storeIds = (options.stores ?? [{ storeId, storeName: 'Marmara Park' }]).map(
    (store) => store.storeId,
  )

  return {
    authMode: 'mock',
    authenticated: true,
    user: {
      userId: 'checklist-surface-user',
      roleCodes,
      scope: {
        companyIds: ['00000000-0000-0000-0000-000000000001'],
        regionIds: ['12121212-1212-4121-8121-121212121212'],
        storeIds,
      },
      readScope: {
        companyIds: ['00000000-0000-0000-0000-000000000001'],
        regionIds: ['12121212-1212-4121-8121-121212121212'],
        storeIds,
      },
      actionScope: {
        assignedStoreIds: storeIds,
      },
      assignedStoreIds: storeIds,
    },
    scopeSummary: {
      companyCount: 1,
      regionCount: 1,
      storeCount: storeIds.length,
      assignedStoreCount: storeIds.length,
    },
  }
}

function createMobileChecklistTodayFixture(options: ChecklistFixtureOptions = {}) {
  const templateType = options.templateType ?? 'BM_STORE_VISIT'
  const templateCode = options.templateCode ?? 'BM_VISIT_V1'
  const templateName =
    options.templateName ??
    (options.longCopy ? 'BM Visit - extended mobile checklist surface copy' : 'BM Visit')
  const fixtureStoreName = options.longCopy
    ? 'IstinyePark Cadde Uzeri Sezon Sonu Denetim Noktasi - Uzun Magaza Adi'
    : 'Marmara Park'
  const stores = options.stores ?? [{ storeId, storeName: fixtureStoreName }]
  const fixtureItemText = options.longCopy
    ? 'Vitrin standartlara uygun ve kampanya etiketleri tum ana kategori bloklarinda hizali'
    : 'Vitrin standartlara uygun'
  const templates = [
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
          itemText: fixtureItemText,
          responseType: 'score',
          weight: 100,
          maxScore: 10,
        },
      ],
    },
  ]

  if (options.includeVmTemplate) {
    templates.push({
      checklistTemplateId: vmTemplateId,
      templateCode: 'VM_VISIT_V1',
      templateType: 'VM_STORE_VISIT',
      templateName: 'VM Visit',
      versionNo: 1,
      items: [
        {
          templateItemId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          sectionName: 'Gorsel duzen',
          itemNo: 1,
          itemText: 'Reyon duzeni temiz',
          responseType: 'score',
          weight: 100,
          maxScore: 10,
        },
      ],
    })
  }
  const visibleTemplates = options.omitTemplates ? [] : templates
  const completedThisMonth =
    options.completedThisMonth ??
    (options.handoffState?.completed
      ? [
          {
            checklistInstanceId: '33333333-3333-4333-8333-333333333333',
            checklistTemplateId: templateId,
            storeId,
            completedAt: '2026-05-20T10:30:00.000Z',
            totalScore: 86,
            acknowledgedAt: options.handoffState.acknowledged ? '2026-05-20T11:00:00.000Z' : null,
          },
        ]
      : [])

  return {
  data: {
    stores,
    templates: visibleTemplates,
    activeInstances: (
      options.activeInstances ?? [
        {
          checklistInstanceId: '33333333-3333-4333-8333-333333333333',
          checklistTemplateId: templateId,
          storeId,
          status: 'in_progress',
          startedAt: '2026-05-20T10:00:00.000Z',
          updatedAt: '2026-05-20T10:00:00.000Z',
        },
      ]
    ).map((instance) => ({ ...instance, responses: instance.responses ?? [] })),
    completedThisMonth,
    pendingAcknowledgements: completedThisMonth
      .filter((item) => item.acknowledgedAt === null)
      .map((item) => ({
        checklistInstanceId: item.checklistInstanceId,
        checklistTemplateId: item.checklistTemplateId,
        storeId: item.storeId,
        completedAt: item.completedAt,
        totalScore: item.totalScore,
      })),
    monthlySummaries: options.monthlySummaries ?? [
      {
        storeId,
        checklistTemplateId: templateId,
        monthStart: '2026-05-01',
        completedCount: 2,
        averageScore: 86,
      },
    ],
  },
}
}

function createChecklistAcknowledgementsFixture(
  roleCodes: string[],
  options: ChecklistFixtureOptions = {},
) {
  const fixtureStoreName = options.longCopy
    ? 'IstinyePark Cadde Uzeri Sezon Sonu Denetim Noktasi - Uzun Magaza Adi'
    : 'Marmara Park'
  const fixtureLowScoreComment = options.longCopy
    ? 'Eksik manken, kampanya etiketi ve vitrin odak urunu ayni blokta toparlanmali'
    : 'Eksik manken'
  const handoffState = options.handoffState
  const acknowledgement = handoffState?.acknowledged
    ? {
        checklistAcknowledgementId: '77777777-7777-4777-8777-777777777777',
        acknowledgedByUserId: 'store-manager-1',
        acknowledgementNote: handoffState.acknowledgementNote ?? null,
        acknowledgedAt: '2026-05-20T11:00:00.000Z',
      }
    : null
  const items: ChecklistAcknowledgementFixture[] = options.acknowledgementItems ?? [
    {
      checklistInstanceId: '44444444-4444-4444-8444-444444444444',
      checklistTemplateId: templateId,
      templateName: 'BM Result',
      templateType: 'BM_STORE_VISIT',
      category: 'BM',
      storeId,
      storeName: fixtureStoreName,
      completedByUserId: 'region-user-1',
      completedAt: options.acknowledgementCompletedAt ?? '2026-05-20T09:00:00.000Z',
      status: 'completed',
      totalScore: options.resultWithoutScore ? null : 86,
      complianceRate: options.resultWithoutScore ? null : 0.75,
      responses: [
        {
          templateItemId: '55555555-5555-4555-8555-555555555555',
          sectionName: 'Vitrin',
          itemNo: 1,
          itemText: 'Vitrin standartlara uygun',
          responseType: 'boolean',
          weight: 60,
          maxScore: 10,
          scoreValue: options.resultWithoutScore ? null : 5,
          commentText: fixtureLowScoreComment,
        },
        {
          templateItemId: '55555555-5555-4555-8555-555555555557',
          sectionName: 'Vitrin',
          itemNo: 2,
          itemText: 'Vitrin kampanya etiketi doğru',
          responseType: 'score',
          weight: 20,
          maxScore: 10,
          scoreValue: options.resultWithoutScore ? null : 7,
          commentText: 'Takipte kalacak etiket düzeni',
        },
        {
          templateItemId: '55555555-5555-4555-8555-555555555556',
          sectionName: 'Kasa',
          itemNo: 3,
          itemText: 'Kasa alanı düzenli',
          responseType: 'score',
          weight: 40,
          maxScore: 10,
          scoreValue: options.resultWithoutScore ? null : 9,
          commentText: 'Temiz',
        },
      ],
      acknowledgement: null,
    },
    {
      checklistInstanceId: '88888888-8888-4888-8888-888888888888',
      checklistTemplateId: '99999999-9999-4999-8999-999999999999',
      templateName: 'VM Result',
      templateType: 'VM_STORE_VISIT',
      category: 'VM',
      storeId,
      storeName: fixtureStoreName,
      completedByUserId: 'vm-user-1',
      completedAt: '2026-05-19T09:00:00.000Z',
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
  const handoffTemplateType = options.handoffTemplateType ?? 'BM_STORE_VISIT'
  const handoffItem = items.find((item) => item.templateType === handoffTemplateType) ?? items[0]
  const completedItems = handoffState
    ? handoffState.completed
      ? [
          {
            ...handoffItem,
            acknowledgement,
            templateName: options.handoffTemplateName ?? handoffItem.templateName,
          },
        ]
      : []
    : items
  const visibleItems = roleCodes.includes('VISUAL_MERCHANDISER')
    ? completedItems.filter((item) => item.templateType === 'VM_STORE_VISIT')
    : roleCodes.includes('REGION_MANAGER') && !roleCodes.includes('SUPER_ADMIN')
      ? completedItems.filter((item) => item.templateType === 'BM_STORE_VISIT')
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

async function captureCloseoutRoleEvidence(page: Page, testInfo: TestInfo, role: string, heading: string) {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1024, height: 768 },
    { width: 390, height: 844 },
    { width: 320, height: 844 },
  ] as const) {
    await page.setViewportSize(viewport)
    await page.goto('/store/checklists')
    await expect(page.getByRole('heading', { name: heading })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.screenshot({
      path: checklistEvidenceOutputPath(testInfo, `checklist-command-cutover-v2/p7/${role}-${viewport.width}x${viewport.height}.png`),
      fullPage: true,
    })
  }
}
