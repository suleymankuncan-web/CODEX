import { expect, test, type Page } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'store-ops-admin-session',
      JSON.stringify({
        mode: 'mock',
        mockUserId: 'super-admin-kpi-config-user',
        mockRoleCodes: 'SUPER_ADMIN',
        mockCompanyIds: '00000000-0000-0000-0000-000000000001',
        bearerToken: '',
      }),
    )
  })

  await routeAdminKpiConfigApi(page)
})

test('admin KPI config page explains publish governance preview', async ({ page }) => {
  await page.goto('/admin/kpi-config')

  await expect(page.getByRole('heading', { name: 'Publish decision preview' })).toBeVisible()
  await expect(page.getByText('Governance preview')).toBeVisible()
  await expect(page.getByText('Draft changes affect live KPI interpretation.')).toBeVisible()
  await expect(page.getByText('Store profile diff')).toBeVisible()
  await expect(page.getByText('+1 / ~1 / -0')).toBeVisible()
  await expect(page.getByText('Grading diff')).toBeVisible()
  await expect(page.getByText('+0 / ~1 / -0')).toBeVisible()
  await expect(page.getByText('Versioned schema')).toBeVisible()
  await expect(page.getByText('Not active yet')).toBeVisible()
  await expect(
    page.getByText('Snapshot anchoring is required before interpretation changes become admin-editable.'),
  ).toBeVisible()
})

async function routeAdminKpiConfigApi(page: Page) {
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({ json: authSessionFixture })
  })

  await page.route('**/api/reports/kpi-config/editor', async (route) => {
    await route.fulfill({ json: kpiConfigEditorFixture })
  })

  await page.route('**/api/reports/kpi-config/audit', async (route) => {
    await route.fulfill({ json: { items: [], meta: { count: 0, total: 0, limit: 20, offset: 0 } } })
  })
}

const authSessionFixture = {
  authMode: 'mock',
  authenticated: true,
  user: {
    userId: 'super-admin-kpi-config-user',
    roleCodes: ['SUPER_ADMIN'],
    scope: {
      companyIds: ['00000000-0000-0000-0000-000000000001'],
      regionIds: [],
      storeIds: [],
    },
    readScope: {
      companyIds: ['00000000-0000-0000-0000-000000000001'],
      regionIds: [],
      storeIds: [],
    },
    actionScope: {
      assignedStoreIds: [],
    },
    assignedStoreIds: [],
  },
  scopeSummary: {
    companyCount: 1,
    regionCount: 0,
    storeCount: 0,
    assignedStoreCount: 0,
  },
}

const publishedConfig = {
  storeProfile: {
    profileCode: 'store',
    title: 'Store Score',
    summary: 'Published store score profile',
    futureMetricRule: 'Manual review',
    metrics: [
      {
        code: 'TARGET_ACHIEVEMENT',
        label: 'Target Achievement',
        weightPercent: 70,
        ownerRole: 'STORE_MANAGER',
        scoreBehavior: 'task_candidate',
      },
      {
        code: 'UPT',
        label: 'Units Per Ticket',
        weightPercent: 30,
        ownerRole: 'STORE_MANAGER',
        scoreBehavior: 'warning_first',
      },
    ],
  },
  personnelProfile: {
    profileCode: 'personnel',
    title: 'Personnel Score',
    summary: 'Published personnel score profile',
    futureMetricRule: 'Manual review',
    metrics: [
      {
        code: 'TARGET_ACHIEVEMENT',
        label: 'Target Achievement',
        weightPercent: 40,
        ownerRole: 'STORE_PERSONNEL',
        scoreBehavior: 'warning_first',
      },
      {
        code: 'ATV',
        label: 'Average Ticket Value',
        weightPercent: 30,
        ownerRole: 'STORE_PERSONNEL',
        scoreBehavior: 'warning_first',
      },
      {
        code: 'UPT',
        label: 'Units Per Ticket',
        weightPercent: 30,
        ownerRole: 'STORE_PERSONNEL',
        scoreBehavior: 'warning_first',
      },
    ],
  },
  ownershipMatrix: [
    {
      code: 'TARGET_ACHIEVEMENT',
      label: 'Target Achievement',
      visibleTo: ['STORE_MANAGER', 'STORE_PERSONNEL'],
      operationalOwner: 'STORE_MANAGER',
      contributesTo: ['store', 'personnel'],
      taskCandidate: true,
    },
  ],
  gradingBands: [
    { code: 'A', label: 'Excellent', emoji: 'A', tone: 'calm', minScore: 1 },
    { code: 'B', label: 'Healthy', emoji: 'B', tone: 'accent', minScore: 0.85 },
    { code: 'C', label: 'Follow up', emoji: 'C', tone: 'warning', minScore: 0.75 },
  ],
}

const draftConfig = {
  ...publishedConfig,
  storeProfile: {
    ...publishedConfig.storeProfile,
    metrics: [
      {
        ...publishedConfig.storeProfile.metrics[0],
        weightPercent: 65,
      },
      publishedConfig.storeProfile.metrics[1],
      {
        code: 'ATV',
        label: 'Average Ticket Value',
        weightPercent: 5,
        ownerRole: 'STORE_MANAGER',
        scoreBehavior: 'warning_first',
      },
    ],
  },
  gradingBands: [
    publishedConfig.gradingBands[0],
    {
      ...publishedConfig.gradingBands[1],
      minScore: 0.88,
    },
    publishedConfig.gradingBands[2],
  ],
}

const kpiConfigEditorFixture = {
  draftConfig,
  publishedConfig,
  hasUnpublishedChanges: true,
}
