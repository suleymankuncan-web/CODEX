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

function getActionPlanDetailDialog(page: Page, title = 'Net sales recovery plan') {
  return page.getByRole('dialog').filter({ hasText: title })
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

  const actionRow = page.getByTestId('store-task-queue-row').filter({ hasText: 'Net sales recovery plan' })
  await expect(actionRow).toBeVisible()
  await expect(actionRow.getByText('Action plan', { exact: true })).toBeVisible()
  await expect(actionRow.getByText('Call the team and confirm recovery actions.')).toBeVisible()
  await expect(actionRow.getByText('Due 2026-05-24')).toBeVisible()
  const actionLink = actionRow.getByRole('link', { name: 'Go to action plan' })
  await expect(actionLink).toBeVisible()
  await expect(actionLink).toHaveAttribute('href', '/store/tasks?actionPlan=action-plan-1')
})

test('store tasks shows region managers checklist remediation plans as informational read rows', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('store-ops-app-locale', 'en')
    window.localStorage.setItem(
      'store-ops-admin-session',
      JSON.stringify({
        mode: 'mock',
        mockUserId: 'region-remediation-smoke-user',
        mockRoleCodes: 'REGION_MANAGER',
        mockCompanyIds: '',
        bearerToken: '',
      }),
    )
  })
  await page.unroute('**/api/auth/session')
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({
      json: {
        ...authSessionFixture,
        user: {
          ...authSessionFixture.user,
          roleCodes: ['REGION_MANAGER'],
          scope: {
            companyIds: [],
            regionIds: ['00000000-0000-0000-0000-000000000010'],
            storeIds: [],
          },
          readScope: {
            companyIds: [],
            regionIds: ['00000000-0000-0000-0000-000000000010'],
            storeIds: [],
          },
          actionScope: {
            assignedStoreIds: [],
          },
          assignedStoreIds: [],
        },
      },
    })
  })
  await page.unroute('**/api/workflow/inbox')
  await page.route('**/api/workflow/inbox', async (route) => {
    await route.fulfill({
      json: {
        items: [
          {
            itemType: 'task',
            sourceType: 'store_action_plan',
            sourceId: 'action-plan-checklist-1',
            title: 'Kasa checklist bulgusu',
            summary: 'Kasa duzeni standardi icin takip',
            companyId: '00000000-0000-0000-0000-000000000001',
            regionId: '00000000-0000-0000-0000-000000000010',
            storeId: demoStoreId,
            storeName: 'IstinyePark Demo Store',
            workflowStatus: 'closed',
            inboxStatus: 'informational',
            urgency: 'low',
            createdAt: '2026-05-22T08:00:00.000Z',
            needsAttentionAt: '2026-05-24T12:00:00.000Z',
            actorRole: 'STORE_MANAGER',
            primaryActionLabel: 'Review checklist source',
            secondaryActionLabel: 'Store reported resolved',
            deepLink: '/store/checklists?result=instance-1',
            historyPreview: 'Store reported resolved: Kasa alani duzenlendi',
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

  await expect(getActionPlansPanel(page)).toBeVisible()
  const remediationRow = page.getByTestId('store-task-queue-row').filter({ hasText: 'Kasa checklist bulgusu' })
  await expect(remediationRow).toBeVisible()
  await expect(remediationRow.getByText('Action plan', { exact: true })).toBeVisible()
  await expect(remediationRow.getByText('Informational')).toBeVisible()
  await expect(remediationRow.getByText('Store reported resolved: Kasa alani duzenlendi')).toBeVisible()
  const sourceLink = remediationRow.getByRole('link', { name: 'Review checklist source' })
  await expect(sourceLink).toHaveAttribute('href', '/store/checklists?result=instance-1')
  await expect(page.getByRole('button', { name: 'Create action plan' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Close plan' })).toHaveCount(0)
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
  await expect(actionPlansPanel.getByRole('heading', { name: 'Store action queue' })).toBeVisible()
  await expect(actionPlansPanel.getByText('1 work')).toBeVisible()
  const actionPlanRow = getActionPlanRow(page)
  await expect(actionPlanRow.getByText('Net sales recovery plan')).toBeVisible()
  await expect(actionPlanRow.getByText('Confirm the daily recovery checklist with the team.')).toBeVisible()
  await expect(actionPlanRow.locator('strong').filter({ hasText: /^Open$/ })).toBeVisible()
  await expect(actionPlanRow.getByRole('button', { name: 'Update status' })).toHaveCount(0)
  await actionPlanRow.getByRole('button', { name: 'Open detail' }).click()
  const detailDialog = getActionPlanDetailDialog(page)
  await expect(detailDialog.getByText('Why was it created?')).toBeVisible()
  await expect(detailDialog.getByText('Movement history')).toBeVisible()
  await expect(detailDialog.getByText('High')).toBeVisible()
  await expect(detailDialog.getByText('May 24, 2026')).toBeVisible()
  await expect(detailDialog.getByRole('link', { name: 'Open source' })).toHaveAttribute('href', '/store/kpis')
  await expect(detailDialog.getByText('Action command')).toBeVisible()
  await expect(detailDialog.getByRole('button', { name: 'Update status' })).toBeVisible()
  await expect(detailDialog.getByRole('button', { name: 'Close plan' })).toBeVisible()
  await expect(detailDialog.getByRole('button', { name: 'Cancel plan' })).toBeVisible()
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

  const actionPlanRow = getActionPlanRow(page, 'Kasa checklist bulgusu')
  await expect(actionPlanRow.getByText('Kasa checklist bulgusu')).toBeVisible()
  await expect(actionPlanRow.getByText('Checklist remediation')).toBeVisible()
  await actionPlanRow.getByRole('button', { name: 'Open detail' }).click()
  const detailDialog = getActionPlanDetailDialog(page, 'Kasa checklist bulgusu')
  const sourceLink = detailDialog.getByRole('link', { name: 'Open source' })
  await expect(sourceLink).toHaveAttribute(
    'href',
    '/store/checklists?result=checklist-instance-bm-1',
  )
  await expect(detailDialog.getByRole('button', { name: 'Close plan' })).toBeVisible()
})

test('store tasks opens persisted action plan detail on demand', async ({ page }) => {
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
  await actionPlanRow.getByRole('button', { name: 'Open detail' }).click()

  const detailDialog = getActionPlanDetailDialog(page)
  await expect(detailDialog).toBeVisible()
  await expect(detailDialog.getByText('Why was it created?')).toBeVisible()
  await expect(detailDialog.getByText('Movement history')).toBeVisible()
  await expect(detailDialog.getByText('Action command')).toBeVisible()
  await expect(detailDialog.getByText('Blocked')).toBeVisible()
  await expect(detailDialog.getByRole('link', { name: 'Open source' })).toHaveAttribute('href', '/store/kpis')
  await expect(detailDialog.getByText('Not available').first()).toBeVisible()
  expect(detailRequested).toBe(true)
})

test('store tasks keeps persisted plan commands available when detail fails', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('store-ops-app-locale', 'en')
  })

  await page.unroute('**/api/store-actions/plans**')
  await page.route('**/api/store-actions/plans**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())

    if (
      request.method() === 'GET' &&
      url.pathname.endsWith(`/store-actions/plans/${storeActionPlansFixture.items[0].actionPlanId}`)
    ) {
      await route.fulfill({
        status: 503,
        json: { message: 'Action plan detail temporarily unavailable' },
      })
      return
    }

    await route.fulfill({ json: storeActionPlansFixture })
  })

  await page.goto('/store/tasks')

  const actionPlanRow = getActionPlanRow(page)
  await actionPlanRow.getByRole('button', { name: 'Open detail' }).click()

  const detailDialog = getActionPlanDetailDialog(page)
  await expect(detailDialog.getByText('Plan detail could not be opened')).toBeVisible()
  await expect(detailDialog.getByText('Action command')).toBeVisible()
  await expect(detailDialog.getByRole('button', { name: 'Update status' })).toBeVisible()
  await expect(detailDialog.getByRole('button', { name: 'Close plan' })).toBeVisible()
  await expect(detailDialog.getByRole('button', { name: 'Cancel plan' })).toBeVisible()
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

  const actionPlanRow = getActionPlanRow(page)
  await actionPlanRow.getByRole('button', { name: 'Open detail' }).click()
  const detailDialog = getActionPlanDetailDialog(page)
  await detailDialog.getByRole('button', { name: 'Update status' }).click()
  const statusForm = detailDialog.locator('form[aria-label="Action plan status"]')
  await statusForm.getByLabel('Status').selectOption('blocked')
  await statusForm.getByLabel('Note').fill('Waiting for regional input')
  await statusForm.getByRole('button', { name: 'Save status' }).click()

  expect(capturedStatusBody).toMatchObject({
    status: 'blocked',
    note: 'Waiting for regional input',
  })
  await expect(actionPlanRow.locator('strong').filter({ hasText: /^Blocked$/ })).toBeVisible()
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
  await actionPlanRow.getByRole('button', { name: 'Open detail' }).click()
  const detailDialog = getActionPlanDetailDialog(page)
  await detailDialog.getByRole('button', { name: 'Update status' }).click()
  const statusForm = detailDialog.locator('form[aria-label="Action plan status"]')
  await statusForm.getByLabel('Status').selectOption('blocked')
  await statusForm.getByRole('button', { name: 'Save status' }).click()

  await expect(statusForm.getByRole('alert')).toContainText('Status could not be updated')
  await expect(statusForm.getByRole('alert')).toContainText('Terminal plan cannot be updated')
  await expect(actionPlanRow.locator('strong').filter({ hasText: /^Open$/ })).toBeVisible()
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
            resolutionNote: closed ? 'Resolution completed with the store team' : null,
          },
        ],
      },
    })
  })

  await page.goto('/store/tasks')

  const actionPlanRow = getActionPlanRow(page)
  await actionPlanRow.getByRole('button', { name: 'Open detail' }).click()
  const detailDialog = getActionPlanDetailDialog(page)
  await detailDialog.getByRole('button', { name: 'Close plan' }).click()
  const closeForm = detailDialog.locator('form[aria-label="Close action plan"]')
  await closeForm.getByLabel('Resolution note').fill('Resolution completed with the store team')
  await closeForm.getByRole('button', { name: 'Close' }).click()

  expect(capturedCloseBody).toMatchObject({
    resolutionNote: 'Resolution completed with the store team',
  })
  await expect(actionPlanRow.getByText('Closed', { exact: true })).toBeVisible()
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
  await actionPlanRow.getByRole('button', { name: 'Open detail' }).click()
  const detailDialog = getActionPlanDetailDialog(page)
  await detailDialog.getByRole('button', { name: 'Close plan' }).click()
  const closeForm = detailDialog.locator('form[aria-label="Close action plan"]')
  await closeForm.getByLabel('Resolution note').fill('Resolution completed with the store team')
  await closeForm.getByRole('button', { name: 'Close' }).click()

  await expect(closeForm.getByRole('alert')).toContainText('Plan could not be closed')
  await expect(closeForm.getByRole('alert')).toContainText('Action plan was already closed')
  await expect(actionPlanRow.locator('strong').filter({ hasText: /^Open$/ })).toBeVisible()
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
  await actionPlanRow.getByRole('button', { name: 'Open detail' }).click()
  const detailDialog = getActionPlanDetailDialog(page)
  await detailDialog.getByRole('button', { name: 'Cancel plan' }).click()
  const cancelForm = detailDialog.locator('form[aria-label="Cancel action plan"]')
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
  await actionPlanRow.getByRole('button', { name: 'Open detail' }).click()
  const detailDialog = getActionPlanDetailDialog(page)
  await detailDialog.getByRole('button', { name: 'Cancel plan' }).click()
  const cancelForm = detailDialog.locator('form[aria-label="Cancel action plan"]')
  await cancelForm.getByLabel('Cancel reason').fill('Duplicate of a regional recovery plan')
  await cancelForm.getByRole('button', { name: 'Cancel plan' }).click()

  await expect(cancelForm.getByRole('alert')).toContainText('Plan could not be cancelled')
  await expect(cancelForm.getByRole('alert')).toContainText('Action plan was already cancelled')
  await expect(actionPlanRow.locator('strong').filter({ hasText: /^Open$/ })).toBeVisible()
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
  await firstKpiFollowUp.getByRole('button', { name: 'Open plan' }).click()
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
  const createdPlanRow = getActionPlanRow(page, 'UPT at risk')
  await expect(createdPlanRow).toBeVisible()
  await createdPlanRow.getByRole('button', { name: 'Open detail' }).click()
  await expect(getActionPlanDetailDialog(page, 'UPT at risk').getByText('May 27, 2026')).toBeVisible()
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

  await page.getByRole('button', { name: 'Open plan' }).click()
  const createForm = page.locator('form[aria-label="KPI follow-up action plan"]')
  await createForm.getByLabel('Due date').fill('2026-05-27')
  await createForm.getByRole('button', { name: 'Create plan' }).click()

  await expect(createForm.getByRole('alert')).toContainText('Action plan could not be created')
  await expect(createForm.getByRole('alert')).toContainText('Active store action plan already exists')
  await expect(getActionPlansPanel(page).getByTestId('store-action-plan-row')).toHaveCount(0)
  await expect(page.getByTestId('store-task-queue-row').filter({ hasText: 'UPT at risk' })).toBeVisible()
})

test('store tasks keeps workflow rows visible when persisted action plans fail', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('store-ops-app-locale', 'en')
  })
  await page.unroute('**/api/store-actions/plans**')
  await page.route('**/api/store-actions/plans**', async (route) => {
    await route.fulfill({
      status: 503,
      json: { message: 'Temporary action plan outage' },
    })
  })

  await page.goto('/store/tasks')

  const actionPlansPanel = getActionPlansPanel(page)
  await expect(actionPlansPanel.getByText('Action plans could not be opened')).toBeVisible()
  await expect(actionPlansPanel.getByText('Temporary action plan outage')).toBeVisible()
  await expect(page.getByTestId('store-task-queue-row').filter({ hasText: 'UPT at risk' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Open plan' })).toBeVisible()
})

test('store tasks keeps off-page workflow action plans when active index cannot prove a persisted row', async ({ page }) => {
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
            sourceId: '00000000-0000-0000-0000-00000000a099',
            title: 'Off-page active plan',
            summary: 'Active action plan projected by the workflow inbox.',
            companyId: '00000000-0000-0000-0000-000000000001',
            regionId: '00000000-0000-0000-0000-000000000010',
            storeId: demoStoreId,
            storeName: 'IstinyePark Demo Store',
            workflowStatus: 'open',
            inboxStatus: 'needs_attention',
            urgency: 'high',
            createdAt: '2026-05-23T08:00:00.000Z',
            needsAttentionAt: '2026-05-25T12:00:00.000Z',
            actorRole: 'STORE_MANAGER',
            primaryActionLabel: 'Open action plan',
            secondaryActionLabel: 'Review source',
            deepLink: '/store/tasks?actionPlan=00000000-0000-0000-0000-00000000a099',
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
  await page.unroute('**/api/store-actions/plans**')
  await page.route('**/api/store-actions/plans**', async (route) => {
    const url = new URL(route.request().url())

    if (url.searchParams.has('status')) {
      await route.fulfill({
        json: {
          items: [],
          meta: { count: 0, total: 0, limit: 100, offset: 0 },
        },
      })
      return
    }

    await route.fulfill({
      json: {
        items: [
          {
            ...storeActionPlansFixture.items[0],
            actionPlanId: '00000000-0000-0000-0000-00000000c099',
            title: 'Closed archive plan',
            status: 'closed',
          },
        ],
        meta: {
          count: 20,
          total: 21,
          limit: 20,
          offset: 0,
        },
      },
    })
  })

  await page.goto('/store/tasks')

  await expect(getActionPlanRow(page, 'Closed archive plan')).toBeVisible()
  const offPageWorkflowRow = page.getByTestId('store-task-queue-row').filter({ hasText: 'Off-page active plan' })
  await expect(offPageWorkflowRow).toBeVisible()
  await expect(offPageWorkflowRow.getByRole('link', { name: 'Go to action plan' })).toBeVisible()
})

test('store tasks pages persisted action plan records', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('store-ops-app-locale', 'en')
  })
  await page.unroute('**/api/workflow/inbox')
  await page.route('**/api/workflow/inbox', async (route) => {
    await route.fulfill({
      json: {
        items: [
          workflowInboxFixture.items[0],
          {
            itemType: 'task',
            sourceType: 'store_action_plan',
            sourceId: '00000000-0000-0000-0000-00000000a021',
            title: 'Second page recovery plan',
            summary: 'This projection is already represented by the paged plan endpoint.',
            companyId: '00000000-0000-0000-0000-000000000001',
            regionId: '00000000-0000-0000-0000-000000000010',
            storeId: demoStoreId,
            storeName: 'IstinyePark Demo Store',
            workflowStatus: 'open',
            inboxStatus: 'needs_attention',
            urgency: 'high',
            createdAt: '2026-05-23T08:00:00.000Z',
            needsAttentionAt: '2026-05-25T12:00:00.000Z',
            actorRole: 'STORE_MANAGER',
            primaryActionLabel: 'Open action plan',
            secondaryActionLabel: 'Review source',
            deepLink: '/store/tasks?actionPlan=00000000-0000-0000-0000-00000000a021',
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
    const url = new URL(route.request().url())
    const status = url.searchParams.get('status')
    const offset = Number(url.searchParams.get('offset') ?? '0')
    const isSecondPage = offset === 20

    if (status) {
      await route.fulfill({
        json:
          status === 'open'
            ? {
                items: [
                  {
                    ...storeActionPlansFixture.items[0],
                    actionPlanId: '00000000-0000-0000-0000-00000000a021',
                    title: 'Second page recovery plan',
                  },
                ],
                meta: { count: 1, total: 1, limit: 100, offset: 0 },
              }
            : {
                items: [],
                meta: { count: 0, total: 0, limit: 100, offset: 0 },
              },
      })
      return
    }

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
  await expect(actionPlansPanel.getByText('21 work')).toBeVisible()
  await expect(actionPlansPanel.getByText('First page recovery plan')).toBeVisible()
  await expect(getActionPlanRow(page, 'Second page recovery plan')).toBeVisible()
  await expect(page.getByTestId('store-task-queue-row').filter({ hasText: 'Second page recovery plan' })).toHaveCount(0)
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
  await getActionPlanRow(page, 'Unsafe source plan').getByRole('button', { name: 'Open detail' }).click()
  const detailDialog = getActionPlanDetailDialog(page, 'Unsafe source plan')
  await expect(detailDialog.getByRole('link', { name: 'Open source' })).toHaveCount(0)
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
