import { expect, test, type Page } from './test-fixtures'
import { setStoredLocale } from './locale-test-utils'

const storeId = '11111111-1111-4111-8111-111111111111'
const templateId = '22222222-2222-4222-8222-222222222222'
const vmTemplateId = '99999999-9999-4999-8999-999999999999'
const checklistFixtureNow = new Date('2026-05-20T12:00:00.000Z')

test('region manager checklist surface shows assigned store visit workflow', async ({ page }) => {
  const requests = createChecklistRequestLog()
  await setupChecklistPage(page, ['REGION_MANAGER'], { requests })
  await page.goto('/store/checklists')

  await expect(page.locator('.store-checklists-command-page .stacked-row')).toHaveCount(0)
  await expect(page.locator('.store-checklists-attention')).toHaveCount(0)
  await expect(page.locator('.store-checklists-priority-rail')).toHaveCount(0)
  await expect(page.getByRole('tab', { name: /Ziyaret akışı/ })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByText('Devam et')).toBeVisible()
  await expect(page.locator('.store-checklists-visit-table .store-checklists-table-head').getByText('Durum', { exact: true })).toHaveCount(0)
  await expect(page.locator('.store-checklists-visit-row').getByText('Taslak', { exact: true })).toHaveCount(0)

  await page.getByRole('button', { name: 'Devam et' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
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
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('dialog').getByRole('button', { name: 'Kapat' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByRole('button', { name: 'Devam et' }).click()
  await expect(page.getByRole('dialog').getByRole('radio', { name: '8', exact: true })).toBeChecked()
  await expect(page.getByRole('dialog').getByRole('textbox', { name: /Not/ })).toHaveValue('Raf ve vitrin uygun')
  await expect(page.getByRole('button', { name: 'Tamamla', exact: true })).toBeEnabled()
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

test('store manager checklist inbox keeps overdue acknowledgements visible by default', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('store-ops-app-locale', 'en')
  })
  await setupChecklistPage(page, ['STORE_MANAGER'], {
    acknowledgementCompletedAt: getPreviousMonthIsoDate(),
  })
  await page.goto('/store/checklists')

  await expect(
    page.getByRole('heading', { name: 'Completed checklist receipts waiting on store acknowledgement' }),
  ).toBeVisible()
  await expect(page.locator('.store-checklists-history-row').filter({ hasText: 'BM Result' })).toBeVisible()
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

  await page.goto('/store/checklists')

  await expect(page.getByRole('heading', { name: 'Checklist alanı açılamadı' })).toBeVisible()
  const retryButton = page.getByRole('button', { name: 'Tekrar dene' })
  await expect(retryButton).toBeVisible()

  allowAcknowledgements = true
  await retryButton.click()

  await expect(
    page.getByRole('heading', { name: 'Mağaza kabulü bekleyen tamamlanmış checklistler' }),
  ).toBeVisible()
  await expect.poll(() => acknowledgementAttempts).toBeGreaterThan(1)
  await expect(page.getByRole('heading', { name: 'Checklist alanı açılamadı' })).toHaveCount(0)
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
    showStartedInstanceOnRefetch: true,
  })
  await page.goto('/store/checklists')

  await expect(page.getByRole('button', { name: 'Start checklist' })).toBeVisible()
  await page.getByRole('button', { name: 'Start checklist' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
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
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Cancel' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page.getByRole('dialog').getByRole('radio', { name: '8', exact: true })).toBeChecked()
  await expect(page.getByRole('dialog').getByRole('textbox', { name: /Note/ })).toHaveValue('Handoff-ready visit')

  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Complete', exact: true }).click()
  await expect.poll(() => requests.completes).toEqual([
    { checklistInstanceId: '33333333-3333-4333-8333-333333333333' },
  ])
  await expect.poll(() => handoffState.completed).toBe(true)
  await expect(page.locator('#store-checklist-tab-incomplete small')).toHaveText('0')
  await page.getByRole('tab', { name: /Incomplete/ }).click()
  await expect(page.getByText('No incomplete records')).toBeVisible()

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
  await expect(page.getByRole('tab', { name: /Recent history/ })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByText('Store saw the completed visit')).toBeVisible()
  await expect(
    page.locator('.store-checklists-history-row').filter({
      hasText: /(?=.*BM Result)(?=.*Acknowledged)/,
    }),
  ).toBeVisible()
  await page.getByRole('tab', { name: /Checklist inbox/ }).click()
  await expect(page.getByText('No pending checklist receipts')).toBeVisible()
})

test('completed checklist refreshes the store task queue cache', async ({ page }) => {
  const requests = createChecklistRequestLog()
  const handoffState: ChecklistHandoffState = {
    completed: false,
    acknowledged: false,
  }
  let workflowInboxRequests = 0

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
  await page.route('**/api/workflow/inbox', async (route) => {
    workflowInboxRequests += 1
    await route.fulfill({
      json: {
        items: handoffState.completed
          ? [
              {
                itemType: 'acknowledgement',
                sourceType: 'checklist_receipt',
                sourceId: '44444444-4444-4444-8444-444444444444',
                title: 'VM Result',
                summary: 'Marmara Park completed checklist result',
                storeId,
                storeName: 'Marmara Park',
                workflowStatus: 'completed',
                inboxStatus: 'needs_attention',
                urgency: 'medium',
                createdAt: '2026-05-20T10:30:00.000Z',
                needsAttentionAt: '2026-05-20T10:30:00.000Z',
                actorRole: 'STORE_MANAGER',
                primaryActionLabel: 'I acknowledge',
                secondaryActionLabel: 'Open checklist result',
                deepLink: '/store/checklists?tab=inbox&result=44444444-4444-4444-8444-444444444444',
              },
            ]
          : [],
        meta: {
          count: handoffState.completed ? 1 : 0,
          total: handoffState.completed ? 1 : 0,
          limit: 30,
          offset: 0,
        },
      },
    })
  })

  await page.goto('/store/tasks')
  await expect(page.getByRole('heading', { name: 'Store action list' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'I acknowledge' })).toHaveCount(0)
  expect(workflowInboxRequests).toBe(1)

  await page.goto('/store/checklists')
  await page.getByRole('button', { name: 'Start checklist' }).click()
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
  await expect(page.getByRole('heading', { name: 'Store action list' })).toBeVisible()

  await expect.poll(() => workflowInboxRequests).toBeGreaterThanOrEqual(2)
  await expect(page.getByRole('link', { name: 'I acknowledge' })).toBeVisible()
})

test('region manager can read BM and VM checklist results without acknowledging them', async ({ page }) => {
  await setupChecklistPage(page, ['REGION_MANAGER'])
  await page.goto('/store/checklists')

  await page.getByRole('tab', { name: /Checklist kutusu/ }).click()
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

test('region manager visit flow reads VM score but starts BM checklist only', async ({ page }) => {
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
  await page.goto('/store/checklists')

  const visitRow = page.locator('.store-checklists-visit-row').filter({ hasText: 'Marmara Park' })
  await expect(visitRow).toBeVisible()
  await expect(visitRow.getByText('82')).toBeVisible()
  await expect(visitRow.getByText('92')).toBeVisible()

  await visitRow.getByRole('button', { name: 'Checklist yap' }).click()
  await expect.poll(() => requests.starts).toEqual([{ checklistTemplateId: templateId, storeId }])
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

  await expect(page.getByText('VM görünümü').first()).toBeVisible()
  await expect(page.getByText('BM görünümü')).toHaveCount(0)
  await expect(page.getByText('BM + VM')).toHaveCount(0)
  await expect(page.getByText('BM skor')).toHaveCount(0)
  await expect(page.getByText('BM yapılmadı')).toHaveCount(0)
  await expect(page.getByLabel(/VM ziyaret yok/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Checklist yap' })).toBeVisible()
  await page.getByRole('button', { name: 'Checklist yap' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
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
  await page.getByRole('button', { name: 'İptal Et' }).click()
  await page.getByRole('tab', { name: /Checklist kutusu/ }).click()
  await expect(page.locator('.store-checklists-history-row').filter({ hasText: 'BM Result' })).toHaveCount(0)
  await expect(page.locator('.store-checklists-history-row').filter({ hasText: 'VM Result' })).toBeVisible()
})

test('visual merchandiser without a published VM template still sees assigned store scope', async ({ page }) => {
  await setupChecklistPage(page, ['VISUAL_MERCHANDISER'], {
    activeInstances: [],
    monthlySummaries: [],
    omitTemplates: true,
  })
  await page.goto('/store/checklists')

  await expect(page.locator('.store-checklists-command-metrics')).toContainText('Atanmış mağaza')
  await expect(page.locator('.store-checklists-command-metrics .store-checklists-metric').first()).toContainText('1')
  await expect(page.getByText('VM şablonu yayında değil')).toBeVisible()
  const templateTypeSelect = page.getByRole('combobox', { name: 'Şablon tipi' })
  await expect(templateTypeSelect).toContainText('VM')
  await templateTypeSelect.click()
  await expect(page.getByRole('option', { name: 'VM', exact: true })).toHaveCount(1)
  await expect(page.getByRole('option', { name: 'BM + VM', exact: true })).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(page.getByText('BM + VM')).toHaveCount(0)
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
  await page.goto('/store/checklists')

  await expect(page.getByLabel(/VM no visits/)).toBeVisible()
  await page.getByRole('button', { name: 'Start checklist' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
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
  await page.goto('/store/checklists')

  const resultRow = page.locator('.store-checklists-history-row').filter({ hasText: 'VM Result' })
  await expect(resultRow).toBeVisible()
  await expect(resultRow.getByText(/Result summary|low-score/)).toBeVisible()
  await resultRow.getByRole('button', { name: 'View details' }).click()
  const resultDialog = page.getByRole('dialog')
  await expect(resultDialog).toBeVisible()
  await expect(resultDialog.getByText('Result summary')).toBeVisible()
  await page.getByLabel('Acknowledgement note').fill('Store acknowledged VM visit')
  await page.getByRole('button', { name: 'I acknowledge' }).click()

  await expect.poll(() => requests.acknowledgements).toEqual([
    {
      checklistInstanceId: '88888888-8888-4888-8888-888888888888',
      body: { acknowledgementNote: 'Store acknowledged VM visit' },
    },
  ])
})

test('store checklist surface switches to English copy and persists locale', async ({ page }) => {
  await setupChecklistPage(page, ['SUPER_ADMIN'])
  await page.goto('/store/checklists')

  await setStoredLocale(page, 'en')

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(
    page.getByRole('heading', { name: 'Checklist Flow' }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Notifications' })).toHaveCount(0)
  await expect(page.getByRole('tab', { name: /Visit flow/ })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Assigned store checklist visits' })).toBeVisible()
  await expect(page.getByText('In progress', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('Assigned stores', { exact: true })).toBeVisible()
  await expect(page.getByText('Average score', { exact: true })).toBeVisible()
  await expect(page.getByText('BM score', { exact: true })).toBeVisible()
  await expect(page.locator('.store-checklists-visit-table .store-checklists-table-head').getByText('Status', { exact: true })).toHaveCount(0)
  await expect(page.locator('.store-checklists-visit-row').getByText('Draft', { exact: true })).toHaveCount(0)
  const checklistUrl = page.url()
  await page.getByRole('tab', { name: /Checklist inbox/ }).click()
  await expect(page).toHaveURL(checklistUrl)
  await page.getByRole('tab', { name: /Visit flow/ }).click()
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Mark item' })).toHaveCount(0)
  await expect(page.getByText('Add photo (optional)')).toHaveCount(0)
  await expect(page.getByText('Not ready')).toHaveCount(0)
  await expect(page.getByText('Draft saved')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Save draft' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Complete', exact: true })).toBeVisible()
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Cancel' }).click()
  await page.getByRole('tab', { name: /Checklist inbox/ }).click()
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

  await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click()

  await page.reload()

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(
    page.getByRole('heading', { name: 'Checklist Flow' }),
  ).toBeVisible()
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
  await page.goto('/store/checklists')

  await page.getByRole('button', { name: 'Continue' }).click()
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
  await expect(dialog.locator('.store-checklist-modal-summary').getByText('No score').first()).toBeVisible()
  await expect(dialog.locator('.store-checklist-modal-summary .store-checklists-fact').first()).toHaveCSS('display', 'grid')
  await expect(
    dialog.locator('.store-checklist-modal-summary .store-checklists-scorebar > div').first(),
  ).toHaveCSS('display', 'grid')
  await expect(
    dialog.locator('.store-checklist-modal-summary .store-checklists-scorebar b.store-checklists-tone-neutral'),
  ).toHaveCount(1)
  await expect(
    dialog.locator('.store-checklist-modal-summary .store-checklists-scorebar b.store-checklists-tone-warning'),
  ).toHaveCount(0)
})

test('checklist visit surface stays usable on mobile width', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 844 })
  await setupChecklistPage(page, ['REGION_MANAGER'], { longCopy: true })
  await page.goto('/store/checklists')

  await expect(page.getByRole('combobox', { name: 'Checklist bölümleri' })).toBeVisible()
  await expect(page.getByRole('tab', { name: /Ziyaret akışı/ })).toHaveCount(0)
  await expectNoHorizontalOverflow(page)

  await page.getByRole('button', { name: 'Devam et' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByRole('dialog').getByRole('radio', { name: '8', exact: true })).toBeVisible()
  const noteBox = page.getByRole('dialog').getByRole('textbox', { name: /Not/ })
  await expect(noteBox).toBeVisible()
  await noteBox.click()
  await noteBox.fill('Mobil not akisi kilitlenmeden yazildi')
  await expect(noteBox).toHaveValue('Mobil not akisi kilitlenmeden yazildi')
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('dialog').getByRole('button', { name: 'Kapat' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expectNoHorizontalOverflow(page)
})

type ChecklistFixtureOptions = {
  templateType?: string
  templateCode?: string
  templateName?: string
  includeVmTemplate?: boolean
  longCopy?: boolean
  acknowledgementCompletedAt?: string
  omitTemplates?: boolean
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

async function answerChecklistScoreQuestion(page: Page, score: string, note: string) {
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('radio', { name: score, exact: true }).click()
  await expect(dialog.getByRole('radio', { name: score, exact: true })).toBeChecked()
  await dialog.getByRole('textbox', { name: /Not|Note/ }).fill(note)
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
    await route.fulfill({ json: createAuthSessionFixture(options.roleState?.current ?? roleCodes) })
  })

  await page.route('**/api/mobile/checklists/today', async (route) => {
    await route.fulfill({
      json: createMobileChecklistTodayFixture(
        options.showStartedInstanceOnRefetch && startedInstanceVisible
          ? {
              ...options,
              activeInstances: [
                {
                  checklistInstanceId: '33333333-3333-4333-8333-333333333333',
                  checklistTemplateId: templateId,
                  storeId,
                  status: 'in_progress',
                  startedAt: '2026-05-20T10:00:00.000Z',
                  updatedAt: '2026-05-20T10:00:00.000Z',
                  responses: [],
                },
              ],
            }
          : options,
      ),
    })
  })

  await page.route('**/api/checklists/acknowledgements/list', async (route) => {
    await route.fulfill({
      json: createChecklistAcknowledgementsFixture(options.roleState?.current ?? roleCodes, options),
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
  const templateName =
    options.templateName ??
    (options.longCopy ? 'BM Visit - extended mobile checklist surface copy' : 'BM Visit')
  const fixtureStoreName = options.longCopy
    ? 'IstinyePark Cadde Uzeri Sezon Sonu Denetim Noktasi - Uzun Magaza Adi'
    : 'Marmara Park'
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

  return {
  data: {
    stores: [{ storeId, storeName: fixtureStoreName }],
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
    completedThisMonth: [],
    pendingAcknowledgements: [],
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
  const items = [
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
          responseType: 'score',
          weight: 60,
          maxScore: 10,
          scoreValue: options.resultWithoutScore ? null : 5,
          commentText: fixtureLowScoreComment,
        },
        {
          templateItemId: '55555555-5555-4555-8555-555555555556',
          sectionName: 'Kasa',
          itemNo: 2,
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
