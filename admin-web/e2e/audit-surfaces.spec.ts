import { expect, test, type Page } from './test-fixtures'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('store-ops-app-locale', 'en')
    window.localStorage.setItem(
      'store-ops-admin-session',
      JSON.stringify({
        mode: 'mock',
        mockUserId: 'audit-admin-user',
        mockRoleCodes: 'SUPER_ADMIN,AUDITOR',
        mockCompanyIds: '10000000-0000-4000-8000-000000000001',
        bearerToken: '',
      }),
    )
  })

  await routeAuditApi(page)
})

test('audit center keeps audit links and modern surface primitives', async ({ page }) => {
  await page.goto('/admin/audit')

  const main = page.getByRole('main')
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(main.getByRole('heading', { name: 'Audit Center' })).toBeVisible()
  await expect(main.getByTestId('admin-metric-audit-users')).toContainText('1')
  await expect(main.getByRole('heading', { name: 'Latest visible events across auth and operations' })).toBeVisible()
  await expect(main.getByRole('link', { name: /super.admin/ }).first()).toHaveAttribute(
    'href',
    '/admin/audit/users/user-1/audit',
  )
  await expect(main.getByRole('link', { name: /STORE_MANAGER/ }).first()).toHaveAttribute(
    'href',
    '/admin/audit/role-assignments/role-assignment-1/audit',
  )
  await expect(main.getByRole('link', { name: /POWERBI/ }).first()).toHaveAttribute(
    'href',
    '/admin/integrations/import-batch-1',
  )
  await expect(main.getByRole('link', { name: /kpi snapshot/ }).first()).toHaveAttribute(
    'href',
    '/admin/snapshots/snapshot-run-1',
  )
  await expect(
    page.locator('.hero-panel, .metric-card, .panel-heading, .stacked-row, .stacked-table, .control-button'),
  ).toHaveCount(0)
})

test('audit detail route preserves correlation and back navigation', async ({ page }) => {
  await page.goto('/admin/audit/users/user-1/audit')

  const main = page.getByRole('main')
  await expect(main.getByRole('heading', { name: 'User account audit trail.' })).toBeVisible()
  await expect(main.getByRole('link', { name: 'Back to audit center' })).toHaveAttribute('href', '/admin/audit')
  await expect(main.getByText('correlation-1')).toBeVisible()
  await expect(main.getByText('USER_CREATED')).toBeVisible()
  await expect(
    page.locator('.hero-panel, .panel-heading, .timeline-item, .timeline-dot, .key-grid, .back-link'),
  ).toHaveCount(0)
})

async function routeAuditApi(page: Page) {
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({ json: authSessionFixture })
  })

  await page.route('**/api/auth/users?**', async (route) => {
    await route.fulfill({
      json: {
        items: [userFixture],
        meta: { count: 1, total: 1, limit: 50, offset: 0 },
      },
    })
  })

  await page.route('**/api/auth/role-assignments?**', async (route) => {
    await route.fulfill({
      json: {
        items: [roleAssignmentFixture],
        meta: { count: 1, total: 1, limit: 50, offset: 0 },
      },
    })
  })

  await page.route('**/api/integrations/import-batches/needs-action?**', async (route) => {
    await route.fulfill({
      json: {
        items: [importBatchFixture],
        meta: { count: 1, total: 1, limit: 6, offset: 0 },
      },
    })
  })

  await page.route('**/api/snapshots/runs/needs-action?**', async (route) => {
    await route.fulfill({
      json: {
        items: [snapshotRunFixture],
        meta: { count: 1, total: 1, limit: 6, offset: 0 },
      },
    })
  })

  await page.route('**/api/auth/users/*/audit', async (route) => {
    await route.fulfill({ json: auditResponseFixture })
  })

  await page.route('**/api/auth/role-assignments/*/audit', async (route) => {
    await route.fulfill({ json: auditResponseFixture })
  })

  await page.route('**/api/auth/action-store-assignments/*/audit', async (route) => {
    await route.fulfill({ json: auditResponseFixture })
  })
}

const authSessionFixture = {
  authMode: 'mock',
  authenticated: true,
  user: {
    userId: 'audit-admin-user',
    employeeId: null,
    roleCodes: ['SUPER_ADMIN', 'AUDITOR'],
    scope: {
      companyIds: ['10000000-0000-4000-8000-000000000001'],
      regionIds: [],
      storeIds: [],
    },
    readScope: {
      companyIds: ['10000000-0000-4000-8000-000000000001'],
      regionIds: [],
      storeIds: [],
    },
    actionScope: { assignedStoreIds: [] },
    assignedStoreIds: [],
  },
  scopeSummary: {
    companyCount: 1,
    regionCount: 0,
    storeCount: 0,
    assignedStoreCount: 0,
  },
}

const userFixture = {
  userId: 'user-1',
  employeeId: null,
  username: 'super.admin',
  email: 'super.admin@example.com',
  authProvider: 'oidc',
  providerSubject: 'subject-1',
  isActive: true,
  lastLoginAt: null,
  createdAt: '2026-05-20T09:00:00.000Z',
  deactivatedAt: null,
  deactivationReason: null,
  employeeStatus: null,
}

const roleAssignmentFixture = {
  assignmentId: 'role-assignment-1',
  userId: 'user-1',
  username: 'super.admin',
  email: 'super.admin@example.com',
  roleCode: 'STORE_MANAGER',
  roleName: 'Store Manager',
  scopeType: 'store',
  companyId: '10000000-0000-4000-8000-000000000001',
  regionId: '10000000-0000-4000-8000-000000000011',
  storeId: '10000000-0000-4000-8000-000000000021',
  effectiveFrom: '2026-05-20T09:00:00.000Z',
  effectiveTo: null,
  active: true,
  createdAt: '2026-05-20T09:00:00.000Z',
}

const importBatchFixture = {
  batchId: 'import-batch-1',
  sourceCode: 'POWERBI',
  entityType: 'kpi',
  status: 'failed',
  healthState: 'needs_action',
  actionReason: 'validation requires review',
  startedAt: '2026-05-20T08:30:00.000Z',
}

const snapshotRunFixture = {
  snapshotRunId: 'snapshot-run-1',
  snapshotType: 'kpi',
  runStatus: 'failed',
  healthState: 'failed',
  actionReason: 'rerun required',
  generatedAt: '2026-05-20T08:00:00.000Z',
}

const auditResponseFixture = {
  items: [
    {
      eventLogId: 'event-1',
      eventType: 'USER_CREATED',
      occurredAt: '2026-05-20T10:00:00.000Z',
      actorUserId: 'audit-admin-user',
      correlationId: 'correlation-1',
      metadata: {
        changedFields: ['email'],
        sourceContext: {
          module: 'auth',
          operation: 'create-user',
        },
        details: {
          email: 'super.admin@example.com',
        },
      },
    },
  ],
  meta: { count: 1, total: 1, limit: 50, offset: 0 },
}
