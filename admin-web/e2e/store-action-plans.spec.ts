import { expect, test, type Page } from './test-fixtures'

const demoStoreId = '00000000-0000-0000-0000-000000000100'
const demoEmployeeId = '00000000-0000-0000-0000-000000000202'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'store-ops-admin-session',
      JSON.stringify({
        mode: 'mock',
        mockUserId: 'store-me-smoke-user',
        mockRoleCodes: 'STORE_MANAGER',
        mockCompanyIds: '00000000-0000-0000-0000-000000000001',
        bearerToken: '',
      }),
    )
  })

  await routeStoreActionPlanApi(page)
})

function getActionPlansPanel(page: Page) {
  return page.getByTestId('store-action-plans-panel')
}

function getActionPlanRow(page: Page, title = 'Net sales recovery plan') {
  return getActionPlansPanel(page).getByTestId('store-action-plan-row').filter({ hasText: title })
}

test('store tasks renders persisted action plans from the workflow inbox', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('store-ops-app-locale', 'en')
  })
  await page.unroute('**/api/workflow/inbox')
  await page.route('**/api/workflow/inbox', async (route) => {
    await route.fulfill({
      json: {
        items: [
          {
            itemType: 'task',
            sourceType: 'store_action_plan',
            sourceId: 'action-plan-1',
            title: 'Net sales recovery plan',
            summary: 'Call the team and confirm recovery actions.',
            companyId: '00000000-0000-0000-0000-000000000001',
            regionId: '00000000-0000-0000-0000-000000000010',
            storeId: demoStoreId,
            storeName: 'IstinyePark Demo Store',
            workflowStatus: 'open',
            inboxStatus: 'needs_attention',
            urgency: 'high',
            createdAt: '2026-05-22T08:00:00.000Z',
            needsAttentionAt: '2026-05-24T12:00:00.000Z',
            actorRole: 'STORE_MANAGER',
            primaryActionLabel: 'Open action plan',
            secondaryActionLabel: 'Review source',
            deepLink: '/store/tasks?actionPlan=action-plan-1',
            historyPreview: 'Due 2026-05-24',
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

  await page.goto('/store/tasks')

  await expect(page.getByText('Action plan', { exact: true })).toBeVisible()
  await expect(page.getByText('Net sales recovery plan')).toBeVisible()
  await expect(page.getByText('Call the team and confirm recovery actions.')).toBeVisible()
  const actionLink = page.getByRole('link', { name: 'Go to action plan' })
  await expect(actionLink).toBeVisible()
  await expect(actionLink).toHaveAttribute('href', '/store/tasks?actionPlan=action-plan-1')
  await expect(page.getByText('Review plan source')).toBeVisible()
})

test('store tasks lists persisted action plan records with active status controls', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('store-ops-app-locale', 'en')
  })
  await page.unroute('**/api/store-actions/plans**')
  await page.route('**/api/store-actions/plans**', async (route) => {
    await route.fulfill({ json: storeActionPlansFixture })
  })

  await page.goto('/store/tasks')

  const actionPlansPanel = getActionPlansPanel(page)
  await expect(actionPlansPanel.getByRole('heading', { name: 'Action plans' })).toBeVisible()
  await expect(actionPlansPanel.getByText('1 plan')).toBeVisible()
  await expect(actionPlansPanel.getByText('Net sales recovery plan')).toBeVisible()
  await expect(actionPlansPanel.getByText('Confirm the daily recovery checklist with the team.')).toBeVisible()
  await expect(actionPlansPanel.getByText('Open', { exact: true })).toBeVisible()
  await expect(actionPlansPanel.getByText('High', { exact: true })).toBeVisible()
  await expect(actionPlansPanel.getByText('May 24, 2026')).toBeVisible()
  const sourceLink = actionPlansPanel.getByRole('link', { name: 'Open source' })
  await expect(sourceLink).toBeVisible()
  await expect(sourceLink).toHaveAttribute('href', '/store/kpis')
  await expect(actionPlansPanel.getByRole('button', { name: 'Update status' })).toBeVisible()
  await expect(actionPlansPanel.getByRole('button', { name: 'Close plan' })).toBeVisible()
  await expect(actionPlansPanel.getByRole('button', { name: 'Cancel plan' })).toBeVisible()
  await expect(actionPlansPanel.getByText('1-1 / 1')).toBeVisible()
})

test('store tasks labels persisted checklist remediation plans without changing checklist receipts', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('store-ops-app-locale', 'en')
  })
  await page.unroute('**/api/store-actions/plans**')
  await page.route('**/api/store-actions/plans**', async (route) => {
    await route.fulfill({
      json: {
        items: [
          {
            ...storeActionPlansFixture.items[0],
            actionPlanId: '00000000-0000-0000-0000-00000000c001',
            sourceType: 'checklist_remediation',
            sourceId: 'checklist:checklist-instance-bm-1:item:item-1',
            sourceDeepLink: '/store/checklists?result=checklist-instance-bm-1',
            title: 'Kasa checklist bulgusu',
            summary: 'BM Store Visit - Kasa duzeni standartlara uygun mu?',
          },
        ],
        meta: {
          count: 1,
          total: 1,
          limit: 20,
          offset: 0,
        },
      },
    })
  })

  await page.goto('/store/tasks')

  const actionPlansPanel = getActionPlansPanel(page)
  await expect(actionPlansPanel.getByText('Kasa checklist bulgusu')).toBeVisible()
  await expect(actionPlansPanel.getByText('Checklist remediation')).toBeVisible()
  const sourceLink = actionPlansPanel.getByRole('link', { name: 'Open source' })
  await expect(sourceLink).toHaveAttribute(
    'href',
    '/store/checklists?result=checklist-instance-bm-1',
  )
  await expect(actionPlansPanel.getByRole('button', { name: 'Close plan' })).toBeVisible()
})

test('store tasks opens persisted action plan coaching detail on demand', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('store-ops-app-locale', 'en')
  })
  let detailRequested = false

  await page.unroute('**/api/store-actions/plans**')
  await page.route('**/api/store-actions/plans**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())

    if (
      request.method() === 'GET' &&
      url.pathname.endsWith(`/store-actions/plans/${storeActionPlansFixture.items[0].actionPlanId}`)
    ) {
      detailRequested = true
      await route.fulfill({
        json: {
          data: {
            plan: {
              ...storeActionPlansFixture.items[0],
              status: 'blocked',
              sourceSnapshotRunId: '00000000-0000-0000-0000-00000000c001',
              sourceKpiId: '00000000-0000-0000-0000-00000000d001',
              updatedAt: '2026-05-23T10:30:00.000Z',
            },
          },
        },
      })
      return
    }

    await route.fulfill({ json: storeActionPlansFixture })
  })

  await page.goto('/store/tasks')

  const actionPlanRow = getActionPlanRow(page)
  await actionPlanRow.getByRole('button', { name: 'Open coaching detail' }).click()

  await expect(actionPlanRow.getByLabel('Action plan coaching detail')).toBeVisible()
  await expect(actionPlanRow.getByText('Lifecycle snapshot')).toBeVisible()
  await expect(actionPlanRow.getByText('00000000-0000-0000-0000-00000000c001')).toBeVisible()
  await expect(actionPlanRow.getByText('00000000-0000-0000-0000-00000000d001')).toBeVisible()
  await expect(actionPlanRow.getByText('Not available').first()).toBeVisible()
  expect(detailRequested).toBe(true)
})

test('store tasks updates a persisted action plan status', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('store-ops-app-locale', 'en')
  })
  let updated = false
  let capturedStatusBody: Record<string, unknown> | null = null

  await page.unroute('**/api/store-actions/plans**')
  await page.route('**/api/store-actions/plans**', async (route) => {
    const request = route.request()

    if (request.method() === 'PATCH' && request.url().endsWith('/status')) {
      capturedStatusBody = request.postDataJSON() as Record<string, unknown>
      updated = true
      await route.fulfill({
        json: {
          command: {
            status: 'updated',
            message: 'Store action plan status updated',
          },
          data: {
            plan: {
              ...storeActionPlansFixture.items[0],
              status: 'blocked',
            },
          },
        },
      })
      return
    }

    await route.fulfill({
      json: {
        ...storeActionPlansFixture,
        items: [
          {
            ...storeActionPlansFixture.items[0],
            status: updated ? 'blocked' : 'open',
          },
        ],
      },
    })
  })

  await page.goto('/store/tasks')

  const actionPlansPanel = getActionPlansPanel(page)
  const actionPlanRow = getActionPlanRow(page)
  await actionPlanRow.getByRole('button', { name: 'Update status' }).click()
  const statusForm = actionPlanRow.locator('form[aria-label="Action plan status"]')
  await statusForm.getByLabel('Status').selectOption('blocked')
  await statusForm.getByLabel('Note').fill('Waiting for regional input')
  await statusForm.getByRole('button', { name: 'Save status' }).click()

  expect(capturedStatusBody).toMatchObject({
    status: 'blocked',
    note: 'Waiting for regional input',
  })
  await expect(actionPlansPanel.getByText('Blocked', { exact: true })).toBeVisible()
})

test('store tasks keeps status update failures local to the action plan form', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('store-ops-app-locale', 'en')
  })

  await page.unroute('**/api/store-actions/plans**')
  await page.route('**/api/store-actions/plans**', async (route) => {
    const request = route.request()

    if (request.method() === 'PATCH' && request.url().endsWith('/status')) {
      await route.fulfill({
        status: 409,
        json: { message: 'Terminal plan cannot be updated' },
      })
      return
    }

    await route.fulfill({ json: storeActionPlansFixture })
  })

  await page.goto('/store/tasks')

  const actionPlanRow = getActionPlanRow(page)
  await actionPlanRow.getByRole('button', { name: 'Update status' }).click()
  const statusForm = actionPlanRow.locator('form[aria-label="Action plan status"]')
  await statusForm.getByLabel('Status').selectOption('blocked')
  await statusForm.getByRole('button', { name: 'Save status' }).click()

  await expect(statusForm.getByRole('alert')).toContainText('Status could not be updated')
  await expect(statusForm.getByRole('alert')).toContainText('Terminal plan cannot be updated')
  await expect(actionPlanRow.locator('[data-slot="badge"]').filter({ hasText: 'Open' })).toBeVisible()
})

test('store tasks closes a persisted action plan with a resolution note', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('store-ops-app-locale', 'en')
  })
  let closed = false
  let capturedCloseBody: Record<string, unknown> | null = null

  await page.unroute('**/api/store-actions/plans**')
  await page.route('**/api/store-actions/plans**', async (route) => {
    const request = route.request()

    if (request.method() === 'PATCH' && request.url().endsWith('/close')) {
      capturedCloseBody = request.postDataJSON() as Record<string, unknown>
      closed = true
      await route.fulfill({
        json: {
          command: {
            status: 'closed',
            message: 'Store action plan closed',
          },
          data: {
            plan: {
              ...storeActionPlansFixture.items[0],
              status: 'closed',
              resolutionNote: capturedCloseBody.resolutionNote,
            },
          },
        },
      })
      return
    }

    await route.fulfill({
      json: {
        ...storeActionPlansFixture,
        items: [
          {
            ...storeActionPlansFixture.items[0],
            status: closed ? 'closed' : 'open',
            resolutionNote: closed ? 'Coaching completed with the store team' : null,
          },
        ],
      },
    })
  })

  await page.goto('/store/tasks')

  const actionPlansPanel = getActionPlansPanel(page)
  const actionPlanRow = getActionPlanRow(page)
  await actionPlanRow.getByRole('button', { name: 'Close plan' }).click()
  const closeForm = actionPlanRow.locator('form[aria-label="Close action plan"]')
  await closeForm.getByLabel('Resolution note').fill('Coaching completed with the store team')
  await closeForm.getByRole('button', { name: 'Close' }).click()

  expect(capturedCloseBody).toMatchObject({
    resolutionNote: 'Coaching completed with the store team',
  })
  await expect(actionPlansPanel.getByText('Closed', { exact: true })).toBeVisible()
  await expect(actionPlanRow.getByRole('button', { name: 'Close plan' })).toHaveCount(0)
})

test('store tasks keeps close failures local to the action plan form', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('store-ops-app-locale', 'en')
  })

  await page.unroute('**/api/store-actions/plans**')
  await page.route('**/api/store-actions/plans**', async (route) => {
    const request = route.request()

    if (request.method() === 'PATCH' && request.url().endsWith('/close')) {
      await route.fulfill({
        status: 409,
        json: { message: 'Action plan was already closed' },
      })
      return
    }

    await route.fulfill({ json: storeActionPlansFixture })
  })

  await page.goto('/store/tasks')

  const actionPlanRow = getActionPlanRow(page)
  await actionPlanRow.getByRole('button', { name: 'Close plan' }).click()
  const closeForm = actionPlanRow.locator('form[aria-label="Close action plan"]')
  await closeForm.getByLabel('Resolution note').fill('Coaching completed with the store team')
  await closeForm.getByRole('button', { name: 'Close' }).click()

  await expect(closeForm.getByRole('alert')).toContainText('Plan could not be closed')
  await expect(closeForm.getByRole('alert')).toContainText('Action plan was already closed')
  await expect(actionPlanRow.getByText('Open', { exact: true })).toBeVisible()
})

test('store tasks cancels a persisted action plan with a reason', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('store-ops-app-locale', 'en')
  })
  let cancelled = false
  let capturedCancelBody: Record<string, unknown> | null = null

  await page.unroute('**/api/store-actions/plans**')
  await page.route('**/api/store-actions/plans**', async (route) => {
    const request = route.request()

    if (request.method() === 'PATCH' && request.url().endsWith('/cancel')) {
      capturedCancelBody = request.postDataJSON() as Record<string, unknown>
      cancelled = true
      await route.fulfill({
        json: {
          command: {
            status: 'cancelled',
            message: 'Store action plan cancelled',
          },
          data: {
            plan: {
              ...storeActionPlansFixture.items[0],
              status: 'cancelled',
              cancelReason: 'Duplicate of a regional recovery plan',
            },
          },
        },
      })
      return
    }

    await route.fulfill({
      json: {
        ...storeActionPlansFixture,
        items: [
          {
            ...storeActionPlansFixture.items[0],
            status: cancelled ? 'cancelled' : 'open',
            cancelReason: cancelled ? 'Duplicate of a regional recovery plan' : null,
          },
        ],
      },
    })
  })

  await page.goto('/store/tasks')

  const actionPlansPanel = getActionPlansPanel(page)
  const actionPlanRow = getActionPlanRow(page)
  await actionPlanRow.getByRole('button', { name: 'Cancel plan' }).click()
  const cancelForm = actionPlanRow.locator('form[aria-label="Cancel action plan"]')
  await cancelForm.getByLabel('Cancel reason').fill('Duplicate of a regional recovery plan')
  await cancelForm.getByRole('button', { name: 'Cancel plan' }).click()

  expect(capturedCancelBody).toMatchObject({
    cancelReason: 'Duplicate of a regional recovery plan',
  })
  await expect(actionPlansPanel.getByText('Cancelled', { exact: true })).toBeVisible()
  await expect(actionPlanRow.getByRole('button', { name: 'Cancel plan' })).toHaveCount(0)
})

test('store tasks keeps cancel failures local to the action plan form', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('store-ops-app-locale', 'en')
  })

  await page.unroute('**/api/store-actions/plans**')
  await page.route('**/api/store-actions/plans**', async (route) => {
    const request = route.request()

    if (request.method() === 'PATCH' && request.url().endsWith('/cancel')) {
      await route.fulfill({
        status: 409,
        json: { message: 'Action plan was already cancelled' },
      })
      return
    }

    await route.fulfill({ json: storeActionPlansFixture })
  })

  await page.goto('/store/tasks')

  const actionPlanRow = getActionPlanRow(page)
  await actionPlanRow.getByRole('button', { name: 'Cancel plan' }).click()
  const cancelForm = actionPlanRow.locator('form[aria-label="Cancel action plan"]')
  await cancelForm.getByLabel('Cancel reason').fill('Duplicate of a regional recovery plan')
  await cancelForm.getByRole('button', { name: 'Cancel plan' }).click()

  await expect(cancelForm.getByRole('alert')).toContainText('Plan could not be cancelled')
  await expect(cancelForm.getByRole('alert')).toContainText('Action plan was already cancelled')
  await expect(actionPlanRow.getByText('Open', { exact: true })).toBeVisible()
})

test('store tasks creates an action plan from a KPI follow-up candidate', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('store-ops-app-locale', 'en')
  })
  const competingStoreId = '00000000-0000-0000-0000-000000000101'
  let created = false
  let capturedCreateBody: Record<string, unknown> | null = null

  await page.unroute('**/api/workflow/inbox')
  await page.route('**/api/workflow/inbox', async (route) => {
    await route.fulfill({
      json: {
        items: [
          workflowInboxFixture.items[0],
          {
            ...workflowInboxFixture.items[0],
            title: 'UPT at risk in a second store',
            summary: 'Kanyon Demo Store icin KPI exception takibi gerekiyor',
            storeId: competingStoreId,
            storeName: 'Kanyon Demo Store',
            deepLink: '/store/kpis?store=kanyon',
          },
        ],
        meta: {
          count: 2,
          total: 2,
          limit: 30,
          offset: 0,
        },
      },
    })
  })
  await page.unroute('**/api/store-actions/plans**')
  await page.route('**/api/store-actions/plans**', async (route) => {
    const request = route.request()

    if (request.method() === 'POST') {
      const requestBody = request.postDataJSON() as Record<string, unknown>
      capturedCreateBody = requestBody
      created = true
      await route.fulfill({
        status: 201,
        json: {
          command: {
            status: 'created',
            message: 'Store action plan created',
          },
          data: {
            plan: {
              ...storeActionPlansFixture.items[0],
              actionPlanId: '00000000-0000-0000-0000-00000000a111',
              sourceId: requestBody.sourceId,
              sourceDeepLink: requestBody.sourceDeepLink,
              title: requestBody.title,
              summary: requestBody.summary,
              priority: requestBody.priority,
              dueOn: requestBody.dueOn,
            },
          },
        },
      })
      return
    }

    await route.fulfill({
      json: created
        ? {
            items: [
              {
                ...storeActionPlansFixture.items[0],
                actionPlanId: '00000000-0000-0000-0000-00000000a111',
                title: 'UPT at risk',
                summary: 'IstinyePark Demo Store icin KPI exception takibi gerekiyor',
                dueOn: '2026-05-27',
              },
            ],
            meta: { count: 1, total: 1, limit: 20, offset: 0 },
          }
        : {
            items: [],
            meta: { count: 0, total: 0, limit: 20, offset: 0 },
          },
    })
  })

  await page.goto('/store/tasks')

  const firstKpiFollowUp = page
    .getByTestId('store-task-queue-row')
    .filter({ hasText: 'IstinyePark Demo Store' })
    .filter({ hasText: 'UPT at risk' })
    .first()
  await firstKpiFollowUp.getByRole('button', { name: 'Create action plan' }).click()
  const createForm = page.locator('form[aria-label="KPI follow-up action plan"]')
  await expect(createForm.getByLabel('Title')).toHaveValue('UPT at risk')
  await createForm.getByLabel('Due date').fill('2026-05-27')
  await createForm.getByRole('button', { name: 'Create plan' }).click()

  expect(capturedCreateBody).toMatchObject({
    storeId: demoStoreId,
    sourceType: 'kpi_exception',
    sourceId: 'snapshot-2026-04-24:store:kpi',
    sourceDeepLink: '/store/kpis',
    title: 'UPT at risk',
    summary: 'IstinyePark Demo Store icin KPI exception takibi gerekiyor',
    priority: 'high',
    dueOn: '2026-05-27',
  })
  const actionPlansPanel = getActionPlansPanel(page)
  await expect(actionPlansPanel.getByText('UPT at risk')).toBeVisible()
  await expect(actionPlansPanel.getByText('May 27, 2026')).toBeVisible()
  await expect(actionPlansPanel.getByText('1-1 / 1')).toBeVisible()
})

test('store tasks keeps create failures local to the KPI follow-up form', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('store-ops-app-locale', 'en')
  })

  await page.unroute('**/api/store-actions/plans**')
  await page.route('**/api/store-actions/plans**', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 409,
        json: { message: 'Active store action plan already exists for this source' },
      })
      return
    }

    await route.fulfill({
      json: {
        items: [],
        meta: { count: 0, total: 0, limit: 20, offset: 0 },
      },
    })
  })

  await page.goto('/store/tasks')

  await page.getByRole('button', { name: 'Create action plan' }).click()
  const createForm = page.locator('form[aria-label="KPI follow-up action plan"]')
  await createForm.getByLabel('Due date').fill('2026-05-27')
  await createForm.getByRole('button', { name: 'Create plan' }).click()

  await expect(createForm.getByRole('alert')).toContainText('Action plan could not be created')
  await expect(createForm.getByRole('alert')).toContainText('Active store action plan already exists')
  await expect(page.getByText('No persisted action plans')).toBeVisible()
})

test('store tasks pages persisted action plan records', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('store-ops-app-locale', 'en')
  })
  await page.unroute('**/api/store-actions/plans**')
  await page.route('**/api/store-actions/plans**', async (route) => {
    const offset = Number(new URL(route.request().url()).searchParams.get('offset') ?? '0')
    const isSecondPage = offset === 20

    await route.fulfill({
      json: {
        items: [
          {
            ...storeActionPlansFixture.items[0],
            actionPlanId: isSecondPage
              ? '00000000-0000-0000-0000-00000000a021'
              : '00000000-0000-0000-0000-00000000a001',
            title: isSecondPage ? 'Second page recovery plan' : 'First page recovery plan',
          },
        ],
        meta: {
          count: isSecondPage ? 1 : 20,
          total: 21,
          limit: 20,
          offset,
        },
      },
    })
  })

  await page.goto('/store/tasks')

  const actionPlansPanel = getActionPlansPanel(page)
  await expect(actionPlansPanel.getByText('21 plan')).toBeVisible()
  await expect(actionPlansPanel.getByText('First page recovery plan')).toBeVisible()
  await expect(actionPlansPanel.getByText('1-20 / 21')).toBeVisible()
  await expect(actionPlansPanel.getByRole('button', { name: 'Previous' })).toBeDisabled()

  const nextButton = actionPlansPanel.getByRole('button', { name: 'Next' })
  await expect(nextButton).toBeEnabled()
  await nextButton.click()

  await expect(actionPlansPanel.getByText('Second page recovery plan')).toBeVisible()
  await expect(actionPlansPanel.getByText('21-21 / 21')).toBeVisible()
  await expect(actionPlansPanel.getByRole('button', { name: 'Previous' })).toBeEnabled()
  await expect(actionPlansPanel.getByRole('button', { name: 'Next' })).toBeDisabled()
})

test('store tasks hides unsafe persisted action plan source links', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('store-ops-app-locale', 'en')
  })
  await page.unroute('**/api/store-actions/plans**')
  await page.route('**/api/store-actions/plans**', async (route) => {
    await route.fulfill({
      json: {
        items: [
          {
            ...storeActionPlansFixture.items[0],
            actionPlanId: '00000000-0000-0000-0000-00000000bad1',
            title: 'Unsafe source plan',
            summary: '   ',
            sourceDeepLink: 'javascript:alert(1)',
          },
        ],
        meta: { count: 1, total: 1, limit: 20, offset: 0 },
      },
    })
  })

  await page.goto('/store/tasks')

  const actionPlansPanel = getActionPlansPanel(page)
  await expect(actionPlansPanel.getByText('Unsafe source plan')).toBeVisible()
  await expect(actionPlansPanel.getByText('No plan summary')).toBeVisible()
  await expect(actionPlansPanel.getByRole('link', { name: 'Open source' })).toHaveCount(0)
  await expect(actionPlansPanel.getByText('No source link')).toBeVisible()
})

test('store tasks recovers when the current action plan page becomes empty', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('store-ops-app-locale', 'en')
  })
  await page.unroute('**/api/store-actions/plans**')
  await page.route('**/api/store-actions/plans**', async (route) => {
    const offset = Number(new URL(route.request().url()).searchParams.get('offset') ?? '0')

    if (offset === 20) {
      await route.fulfill({
        json: {
          items: [],
          meta: { count: 0, total: 20, limit: 20, offset: 20 },
        },
      })
      return
    }

    await route.fulfill({
      json: {
        items: [
          {
            ...storeActionPlansFixture.items[0],
            actionPlanId: '00000000-0000-0000-0000-00000000a001',
            title: 'First page recovery plan',
          },
        ],
        meta: { count: 20, total: 21, limit: 20, offset: 0 },
      },
    })
  })

  await page.goto('/store/tasks')

  const actionPlansPanel = getActionPlansPanel(page)
  await expect(actionPlansPanel.getByText('First page recovery plan')).toBeVisible()
  await actionPlansPanel.getByRole('button', { name: 'Next' }).click()

  await expect(actionPlansPanel.getByText('First page recovery plan')).toBeVisible()
  await expect(actionPlansPanel.getByText('21-20 / 20')).toHaveCount(0)
  await expect(actionPlansPanel.getByText('No persisted action plans')).toHaveCount(0)
  await expect(actionPlansPanel.getByText('1-20 / 21')).toBeVisible()
})


async function routeStoreActionPlanApi(page: Page) {
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({ json: authSessionFixture })
  })

  await page.route('**/api/workflow/inbox', async (route) => {
    await route.fulfill({ json: workflowInboxFixture })
  })

  await page.route('**/api/store-actions/plans**', async (route) => {
    await route.fulfill({
      json: {
        items: [],
        meta: { count: 0, total: 0, limit: 20, offset: 0 },
      },
    })
  })
}

const authSessionFixture = {
  authMode: 'mock',
  authenticated: true,
  user: {
    userId: 'store-me-smoke-user',
    employeeId: demoEmployeeId,
    roleCodes: ['STORE_PERSONNEL', 'STORE_MANAGER'],
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
      sourceId: 'snapshot-2026-04-24:store:kpi',
      title: 'UPT at risk',
      summary: 'IstinyePark Demo Store icin KPI exception takibi gerekiyor',
      storeId: demoStoreId,
      storeName: 'IstinyePark Demo Store',
      workflowStatus: 'at_risk',
      inboxStatus: 'needs_attention',
      urgency: 'high',
      createdAt: '2026-04-24T08:00:00.000Z',
      needsAttentionAt: '2026-04-24T08:00:00.000Z',
      actorRole: 'STORE_MANAGER',
      primaryActionLabel: 'Open KPI detail',
      secondaryActionLabel: 'Detay ac',
      deepLink: '/store/kpis',
      historyPreview: 'Achievement 84%',
    },
  ],
  meta: {
    count: 1,
    total: 1,
    limit: 30,
    offset: 0,
  },
}

const storeActionPlansFixture = {
  items: [
    {
      actionPlanId: '00000000-0000-0000-0000-00000000a001',
      companyId: '00000000-0000-0000-0000-000000000001',
      regionId: '00000000-0000-0000-0000-000000000010',
      storeId: demoStoreId,
      ownerUserId: '00000000-0000-0000-0000-00000000b001',
      createdByUserId: '00000000-0000-0000-0000-00000000b001',
      sourceType: 'kpi_exception',
      sourceId: 'snapshot-2026-04-24:store:kpi',
      sourceDeepLink: '/store/kpis',
      sourceSnapshotRunId: null,
      sourceKpiId: null,
      title: 'Net sales recovery plan',
      summary: 'Confirm the daily recovery checklist with the team.',
      priority: 'high',
      status: 'open',
      dueOn: '2026-05-24',
      resolutionNote: null,
      closedByUserId: null,
      closedAt: null,
      cancelReason: null,
      cancelledByUserId: null,
      cancelledAt: null,
      createdAt: '2026-05-22T08:00:00.000Z',
      updatedAt: '2026-05-22T08:30:00.000Z',
    },
  ],
  meta: {
    count: 1,
    total: 1,
    limit: 20,
    offset: 0,
  },
}
