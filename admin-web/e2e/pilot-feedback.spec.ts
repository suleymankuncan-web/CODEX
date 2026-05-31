import { expect, test, type Page } from './test-fixtures'

const superAdminSession = {
  authMode: 'mock',
  authenticated: true,
  user: {
    userId: 'pilot-super-admin',
    employeeId: null,
    roleCodes: ['SUPER_ADMIN'],
    scope: {
      companyIds: ['00000000-0000-0000-0000-000000000001'],
      regionIds: ['11111111-1111-4111-8111-111111111111'],
      storeIds: ['22222222-2222-4222-8222-222222222222'],
    },
    readScope: {
      companyIds: ['00000000-0000-0000-0000-000000000001'],
      regionIds: ['11111111-1111-4111-8111-111111111111'],
      storeIds: ['22222222-2222-4222-8222-222222222222'],
    },
    actionScope: {
      assignedStoreIds: ['22222222-2222-4222-8222-222222222222'],
    },
    assignedStoreIds: ['22222222-2222-4222-8222-222222222222'],
  },
  scopeSummary: {
    companyCount: 1,
    regionCount: 1,
    storeCount: 1,
    assignedStoreCount: 1,
  },
}

type PilotFeedbackFixture = {
  feedbackId: string
  actorUserId: string
  actorRoleCodes: string[]
  feedbackType: string
  severitySuggestion: string
  routePath: string
  pageTitle: string | null
  title: string
  description: string
  status: string
  classification: string | null
  classifiedByUserId: string | null
  classifiedAt: string | null
  classificationNote: string | null
  createdAt: string
  updatedAt: string
}

const pilotFeedbackItem: PilotFeedbackFixture = {
  feedbackId: 'pilot-feedback-1',
  actorUserId: 'pilot-store-manager',
  actorRoleCodes: ['STORE_MANAGER'],
  feedbackType: 'bug',
  severitySuggestion: 'p1',
  routePath: '/store/tasks',
  pageTitle: 'Store Tasks',
  title: 'Checkout submit failed',
  description: 'The submit button returns an error after a valid pilot action.',
  status: 'new',
  classification: null,
  classifiedByUserId: null,
  classifiedAt: null,
  classificationNote: null,
  createdAt: '2026-05-23T10:00:00.000Z',
  updatedAt: '2026-05-23T10:00:00.000Z',
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('store-ops-app-locale', 'en')
    window.localStorage.setItem(
      'store-ops-admin-session',
      JSON.stringify({
        mode: 'mock',
        mockUserId: 'pilot-super-admin',
        mockRoleCodes: 'SUPER_ADMIN',
        mockCompanyIds: '00000000-0000-0000-0000-000000000001',
        bearerToken: '',
      }),
    )
  })

  await routeAuthSession(page)
})

test('pilot feedback can be submitted and classified inside the app', async ({ page }) => {
  const submittedBodies: unknown[] = []
  const classifiedBodies: unknown[] = []
  await routePilotFeedbackApi(page)
  await capturePilotFeedbackWrites(page, submittedBodies, classifiedBodies)

  await page.goto('/admin/session')
  await page.getByRole('button', { name: 'Pilot feedback' }).click()

  const dialog = page.getByRole('dialog', { name: 'Record pilot feedback' })
  await expect(dialog.getByText('Capture a bug, friction point, or idea')).toBeVisible()
  await expect(dialog.getByText('/admin/session')).toBeVisible()
  await dialog.getByLabel('Type').selectOption('bug')
  await dialog.getByLabel('Severity').selectOption('p1')
  await dialog.getByLabel('Title').fill('Pilot action needs clearer copy')
  await dialog.getByLabel('Description').fill('The pilot actor could not tell which action would be saved.')
  await dialog.getByRole('button', { name: 'Submit' }).click()

  await expect(page.getByRole('status').filter({ hasText: 'Feedback recorded' })).toBeVisible()
  expect(submittedBodies).toHaveLength(1)
  expect(submittedBodies[0]).toMatchObject({
    feedbackType: 'bug',
    severitySuggestion: 'p1',
    routePath: '/admin/session',
    title: 'Pilot action needs clearer copy',
  })

  await page.goto('/admin/pilot-feedback')

  const main = page.getByRole('main')
  await expect(page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Pilot Feedback' })).toBeVisible()
  await expect(main.getByRole('heading', { name: 'Pilot feedback is classified in one queue.' })).toBeVisible()
  await expect(main.getByText('Checkout submit failed')).toBeVisible()

  const row = main.locator('article').filter({ hasText: 'Checkout submit failed' }).first()
  await expect(row.getByText('P1 blocker')).toBeVisible()
  await row.getByLabel('Class').selectOption('p1_pilot_blocker')
  await row.getByLabel('Note').fill('Blocks pilot action confidence.')
  await row.getByRole('button', { name: 'Classify' }).click()

  await expect(row.getByRole('status')).toContainText('Class updated')
  expect(classifiedBodies).toHaveLength(1)
  expect(classifiedBodies[0]).toMatchObject({
    classification: 'p1_pilot_blocker',
    note: 'Blocks pilot action confidence.',
  })
})

test('pilot feedback classification keeps an existing note when unchanged', async ({ page }) => {
  const classifiedBodies: unknown[] = []
  await routePilotFeedbackApi(page, {
    ...pilotFeedbackItem,
    feedbackId: 'pilot-feedback-existing-note',
    status: 'triaged',
    classification: 'p2_pilot_friction',
    classificationNote: 'Existing triage context.',
  })
  await capturePilotFeedbackWrites(page, [], classifiedBodies)

  await page.goto('/admin/pilot-feedback')

  const row = page.getByRole('main').locator('article').filter({ hasText: 'Checkout submit failed' }).first()
  await expect(row.getByLabel('Note')).toHaveValue('Existing triage context.')
  await row.getByLabel('Class').selectOption('p3_backlog')
  await row.getByRole('button', { name: 'Classify' }).click()

  await expect(row.getByRole('status')).toContainText('Class updated')
  expect(classifiedBodies).toHaveLength(1)
  expect(classifiedBodies[0]).toMatchObject({
    classification: 'p3_backlog',
    note: 'Existing triage context.',
  })
})

async function routeAuthSession(page: Page) {
  await page.unroute('**/api/auth/session').catch(() => undefined)
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({ json: superAdminSession })
  })
}

async function routePilotFeedbackApi(page: Page, initialItem: PilotFeedbackFixture = pilotFeedbackItem) {
  let currentItem = { ...initialItem }

  await page.route('**/api/admin/pilot-feedback**', async (route) => {
    const request = route.request()
    if (request.method() === 'PATCH') {
      const body = request.postDataJSON()
      currentItem = {
        ...currentItem,
        status: 'triaged',
        classification: body.classification,
        classificationNote: body.note ?? null,
        classifiedByUserId: 'pilot-super-admin',
        classifiedAt: '2026-05-23T10:05:00.000Z',
        updatedAt: '2026-05-23T10:05:00.000Z',
      }
      await route.fulfill({
        json: {
          command: { status: 'ok', message: 'Pilot feedback classified.' },
          data: { feedback: currentItem },
        },
      })
      return
    }

    await route.fulfill({
      json: {
        items: [currentItem],
        meta: {
          count: 1,
          total: 1,
          limit: 20,
          offset: 0,
        },
      },
    })
  })
}

async function capturePilotFeedbackWrites(
  page: Page,
  submittedBodies: unknown[],
  classifiedBodies: unknown[],
) {
  await page.route('**/api/pilot-feedback', async (route) => {
    const body = route.request().postDataJSON()
    submittedBodies.push(body)
    await route.fulfill({
      status: 201,
      json: {
        command: { status: 'ok', message: 'Pilot feedback recorded.' },
        data: {
          feedback: {
            ...pilotFeedbackItem,
            feedbackId: 'pilot-feedback-created',
            actorUserId: 'pilot-super-admin',
            actorRoleCodes: ['SUPER_ADMIN'],
            feedbackType: body.feedbackType,
            severitySuggestion: body.severitySuggestion,
            routePath: body.routePath,
            pageTitle: body.pageTitle ?? null,
            title: body.title,
            description: body.description,
          },
        },
      },
    })
  })

  await page.route('**/api/admin/pilot-feedback/*/classification', async (route) => {
    classifiedBodies.push(route.request().postDataJSON())
    await route.fallback()
  })
}
