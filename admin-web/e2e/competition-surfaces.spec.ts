import { expect, test, type Page } from '@playwright/test'

const competitionId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const stageId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const teamId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const storeId = '00000000-0000-0000-0000-000000000101'
const secondStoreId = '00000000-0000-0000-0000-000000000102'
const templateId = '99999999-9999-4999-8999-999999999999'
const inactiveTemplateId = '88888888-8888-4888-8888-888888888888'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'store-ops-admin-session',
      JSON.stringify({
        mode: 'mock',
        mockUserId: 'hr-admin-smoke-user',
        mockRoleCodes: 'HR_ADMIN',
        mockCompanyIds: '00000000-0000-0000-0000-000000000001',
        bearerToken: '',
      }),
    )
  })

  await routeCompetitionApi(page, authSessionFixture, competitionDetailFixture)
})

test('admin competitions surface shows live scores and warnings', async ({ page }) => {
  await page.goto('/admin/competitions')

  await expect(page.getByRole('link', { name: /Competitions/ })).toBeVisible()
  await expect(page.getByRole('heading', { name: /Region challenge stages/i })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'April Region Challenge' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Marmara Demo' })).toBeVisible()
  await expect(
    page.locator('article').filter({ has: page.getByRole('heading', { name: 'Marmara Demo' }) }).getByText('92.45'),
  ).toBeVisible()
  await expect(page.getByText('missing bm checklist')).toBeVisible()
  await expect(page.getByRole('button', { name: /Recalculate QUALIFIER/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Finalize QUALIFIER/ })).toBeVisible()
})

test('admin can create a competition stage with team store assignments', async ({ page }) => {
  let createdStagePayload: unknown = null
  await page.unroute('**/api/competitions**')
  await routeCompetitionApi(page, authSessionFixture, competitionDetailFixture, {
    onCreateStage: (payload) => {
      createdStagePayload = payload
    },
  })

  await page.goto('/admin/competitions')

  await page.getByLabel('Stage code').fill('MAY_QUALIFIER')
  await page.getByLabel('Stage name').fill('May Qualifier')
  await page.getByLabel('Stage order').fill('1')
  await page.getByLabel('Stage type').selectOption('qualifier')
  await page.getByLabel('Stage starts').fill('2026-05-01')
  await page.getByLabel('Stage ends').fill('2026-05-15')
  const teamOne = page.locator('.stage-builder-team').filter({ hasText: 'Team 1' })
  const teamTwo = page.locator('.stage-builder-team').filter({ hasText: 'Team 2' })
  await page.getByLabel('Team 1 code').fill('MARMARA_A')
  await page.getByLabel('Team 1 name').fill('Marmara A')
  await teamOne.getByLabel('DEMO-101 - Demo Store 101 - Marmara').check()
  await page.getByLabel('Team 2 code').fill('MARMARA_B')
  await page.getByLabel('Team 2 name').fill('Marmara B')
  await teamTwo.getByLabel('DEMO-102 - Demo Store 102 - Marmara').check()
  await page.getByRole('button', { name: 'Create stage' }).click()

  await expect(page.getByText('Competition stage created')).toBeVisible()
  expect(createdStagePayload).toMatchObject({
    stageCode: 'MAY_QUALIFIER',
    stageName: 'May Qualifier',
    stageOrder: 1,
    stageType: 'qualifier',
    startsOn: '2026-05-01',
    endsOn: '2026-05-15',
    teams: [
      {
        teamCode: 'MARMARA_A',
        teamName: 'Marmara A',
        storeIds: [storeId],
      },
      {
        teamCode: 'MARMARA_B',
        teamName: 'Marmara B',
        storeIds: [secondStoreId],
      },
    ],
  })
})

test('admin creates a team template and applies it to a stage team', async ({ page }) => {
  let createdTemplatePayload: unknown = null
  let createdStagePayload: unknown = null
  await page.unroute('**/api/competitions**')
  await routeCompetitionApi(page, authSessionFixture, competitionDetailFixture, {
    onCreateTemplate: (payload) => {
      createdTemplatePayload = payload
    },
    onCreateStage: (payload) => {
      createdStagePayload = payload
    },
  })

  await page.goto('/admin/competitions')

  const templateBuilder = page.locator('.stage-template-builder')
  await templateBuilder.getByLabel('Template code').fill('MARMARA_TEMPLATE_A')
  await templateBuilder.getByLabel('Template name').fill('Marmara Template A')
  await templateBuilder.getByLabel('DEMO-101 - Demo Store 101 - Marmara').check()
  await templateBuilder.getByRole('button', { name: 'Create template' }).click()

  await expect(page.getByText('Competition team template created')).toBeVisible()
  expect(createdTemplatePayload).toMatchObject({
    templateCode: 'MARMARA_TEMPLATE_A',
    templateName: 'Marmara Template A',
    storeIds: [storeId],
  })

  await page.getByLabel('Stage code').fill('MAY_TEMPLATE_STAGE')
  await page.getByLabel('Stage name').fill('May Template Stage')
  await page.getByLabel('Stage order').fill('2')
  await page.getByLabel('Stage starts').fill('2026-05-16')
  await page.getByLabel('Stage ends').fill('2026-05-31')
  await page.getByLabel('Team 1 template').selectOption(templateId)
  await page.getByLabel('Team 2 code').fill('MARMARA_B')
  await page.getByLabel('Team 2 name').fill('Marmara B')
  const teamTwo = page.locator('.stage-builder-team').filter({ hasText: 'Team 2' })
  await teamTwo.getByLabel('DEMO-102 - Demo Store 102 - Marmara').check()
  await page.getByRole('button', { name: 'Create stage' }).click()

  await expect(page.getByText('Competition stage created')).toBeVisible()
  expect(createdStagePayload).toMatchObject({
    stageCode: 'MAY_TEMPLATE_STAGE',
    stageName: 'May Template Stage',
    teams: [
      {
        sourceTemplateId: templateId,
        teamCode: 'MARMARA_TEMPLATE_A',
        teamName: 'Marmara Template A',
        storeIds: [storeId],
      },
      {
        teamCode: 'MARMARA_B',
        teamName: 'Marmara B',
        storeIds: [secondStoreId],
      },
    ],
  })
})

test('admin can view inactive templates and deactivate active templates', async ({ page }) => {
  let deactivatedTemplateId: string | null = null
  await page.unroute('**/api/competitions**')
  await routeCompetitionApi(page, authSessionFixture, competitionDetailFixture, {
    initialTeamTemplates: [activeTemplateFixture, inactiveTemplateFixture],
    onDeactivateTemplate: (nextTemplateId) => {
      deactivatedTemplateId = nextTemplateId
    },
  })

  await page.goto('/admin/competitions')

  const templateLibrary = page.locator('.stage-template-library')
  const activeTemplateRow = templateLibrary.locator('article').filter({ hasText: 'MARMARA_TEMPLATE_A' })
  await expect(activeTemplateRow.getByText('MARMARA_TEMPLATE_A', { exact: true })).toBeVisible()
  await expect(templateLibrary.getByText('OLD_MARMARA_TEMPLATE')).toHaveCount(0)

  await templateLibrary.getByLabel('Show inactive templates').check()
  await expect(templateLibrary.getByText('OLD_MARMARA_TEMPLATE')).toBeVisible()
  await expect(templateLibrary.getByText('Inactive', { exact: true })).toBeVisible()

  await templateLibrary.getByRole('button', { name: 'Deactivate MARMARA_TEMPLATE_A' }).click()

  await expect(page.getByText('Competition team template deactivated')).toBeVisible()
  expect(deactivatedTemplateId).toBe(templateId)
  await expect(page.getByLabel('Team 1 template')).not.toContainText('MARMARA_TEMPLATE_A')
})

test('region manager competitions surface is read-only and scoped to visible store contributions', async ({ page }) => {
  await page.unroute('**/api/auth/session')
  await page.unroute('**/api/competitions**')
  await routeCompetitionApi(page, regionManagerSessionFixture, scopedCompetitionDetailFixture)

  await page.goto('/admin/competitions')

  await expect(page.getByRole('heading', { name: /Region challenge stages/i })).toBeVisible()
  await expect(page.getByText('Scoped contributions')).toBeVisible()
  await expect(page.getByText('Visible Region Store')).toBeVisible()
  await expect(page.getByText('93.50')).toBeVisible()
  await expect(page.getByText('Outside Region Store')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /New draft/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Recalculate QUALIFIER/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Finalize QUALIFIER/ })).toHaveCount(0)
})

async function routeCompetitionApi(
  page: Page,
  authSession: typeof authSessionFixture,
  competitionDetail: typeof competitionDetailFixture,
  options?: {
    onCreateStage?: (payload: unknown) => void
    onCreateTemplate?: (payload: unknown) => void
    onDeactivateTemplate?: (templateId: string) => void
    initialTeamTemplates?: unknown[]
  },
) {
  let teamTemplates: unknown[] = options?.initialTeamTemplates ?? []

  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({ json: authSession })
  })

  await page.route('**/api/auth/lookups', async (route) => {
    await route.fulfill({ json: authLookupsFixture })
  })

  await page.route('**/api/competitions**', async (route) => {
    const request = route.request()
    const pathname = new URL(request.url()).pathname

    if (request.method() === 'GET' && pathname.endsWith('/api/competitions/team-templates')) {
      const activeOnly = new URL(request.url()).searchParams.get('activeOnly') !== 'false'
      const visibleTemplates = activeOnly
        ? teamTemplates.filter((template) => Boolean((template as { isActive?: boolean }).isActive))
        : teamTemplates
      await route.fulfill({
        json: {
          items: visibleTemplates,
          meta: { count: visibleTemplates.length, total: visibleTemplates.length, limit: 50, offset: 0 },
        },
      })
      return
    }

    if (request.method() === 'POST' && pathname.endsWith('/api/competitions/team-templates')) {
      const payload = request.postDataJSON()
      options?.onCreateTemplate?.(payload)
      teamTemplates = [
        {
          templateId,
          templateCode: 'MARMARA_TEMPLATE_A',
          templateName: 'Marmara Template A',
          description: null,
          isActive: true,
          stores: [
            {
              storeId,
              storeCode: 'DEMO-101',
              storeName: 'Demo Store 101',
              regionId: '00000000-0000-0000-0000-000000000010',
            },
          ],
        },
      ]
      await route.fulfill({
        json: {
          command: { status: 'created', message: 'Competition team template created' },
          data: {
            template: teamTemplates[0],
          },
        },
      })
      return
    }

    if (
      request.method() === 'PATCH' &&
      pathname.endsWith(`/api/competitions/team-templates/${templateId}/deactivate`)
    ) {
      options?.onDeactivateTemplate?.(templateId)
      teamTemplates = teamTemplates.map((template) =>
        (template as { templateId?: string }).templateId === templateId
          ? { ...(template as Record<string, unknown>), isActive: false }
          : template,
      )
      await route.fulfill({
        json: {
          command: { status: 'deactivated', message: 'Competition team template deactivated' },
          data: {
            template: teamTemplates.find(
              (template) => (template as { templateId?: string }).templateId === templateId,
            ),
          },
        },
      })
      return
    }

    if (request.method() === 'GET' && pathname.endsWith('/api/competitions')) {
      await route.fulfill({
        json: {
          items: [competitionFixture],
          meta: { count: 1, total: 1, limit: 50, offset: 0 },
        },
      })
      return
    }

    if (request.method() === 'GET' && pathname.endsWith(`/api/competitions/${competitionId}`)) {
      await route.fulfill({ json: competitionDetail })
      return
    }

    if (request.method() === 'POST' && pathname.endsWith(`/api/competitions/${competitionId}/stages`)) {
      options?.onCreateStage?.(request.postDataJSON())
      await route.fulfill({
        json: {
          command: { status: 'created', message: 'Competition stage created' },
          data: {
            stage: {
              competitionStageId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
              competitionId,
              stageCode: 'MAY_QUALIFIER',
              stageName: 'May Qualifier',
              stageOrder: 1,
              stageType: 'qualifier',
              startsOn: '2026-05-01',
              endsOn: '2026-05-15',
              lifecycleState: 'draft',
              finalizationState: null,
            },
          },
        },
      })
      return
    }

    await route.fulfill({
      json: {
        command: { status: 'ok', message: 'ok' },
        data: {},
      },
    })
  })
}

const activeTemplateFixture = {
  templateId,
  templateCode: 'MARMARA_TEMPLATE_A',
  templateName: 'Marmara Template A',
  description: null,
  isActive: true,
  stores: [
    {
      storeId,
      storeCode: 'DEMO-101',
      storeName: 'Demo Store 101',
      regionId: '00000000-0000-0000-0000-000000000010',
    },
  ],
}

const inactiveTemplateFixture = {
  templateId: inactiveTemplateId,
  templateCode: 'OLD_MARMARA_TEMPLATE',
  templateName: 'Old Marmara Template',
  description: null,
  isActive: false,
  stores: [
    {
      storeId: secondStoreId,
      storeCode: 'DEMO-102',
      storeName: 'Demo Store 102',
      regionId: '00000000-0000-0000-0000-000000000010',
    },
  ],
}

const authSessionFixture = {
  authMode: 'mock',
  authenticated: true,
  user: {
    userId: 'hr-admin-smoke-user',
    employeeId: null,
    roleCodes: ['HR_ADMIN'],
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

const regionManagerSessionFixture = {
  ...authSessionFixture,
  user: {
    ...authSessionFixture.user,
    userId: 'region-manager-smoke-user',
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
  },
  scopeSummary: {
    companyCount: 0,
    regionCount: 1,
    storeCount: 0,
    assignedStoreCount: 0,
  },
}

const authLookupsFixture = {
  scopeTypes: ['company', 'region', 'store'],
  authProviders: ['mock', 'oidc'],
  users: [],
  roles: [],
  permissions: [],
  stores: [
    {
      storeId,
      storeCode: 'DEMO-101',
      storeName: 'Demo Store 101',
      companyId: '00000000-0000-0000-0000-000000000001',
      regionId: '00000000-0000-0000-0000-000000000010',
      regionName: 'Marmara',
    },
    {
      storeId: secondStoreId,
      storeCode: 'DEMO-102',
      storeName: 'Demo Store 102',
      companyId: '00000000-0000-0000-0000-000000000001',
      regionId: '00000000-0000-0000-0000-000000000010',
      regionName: 'Marmara',
    },
  ],
  optionGroups: {
    users: [],
    roles: [],
    permissions: [],
    stores: [],
    scopeTypes: [
      { value: 'company', label: 'company' },
      { value: 'region', label: 'region' },
      { value: 'store', label: 'store' },
    ],
    authProviders: [
      { value: 'mock', label: 'mock' },
      { value: 'oidc', label: 'oidc' },
    ],
  },
  meta: {
    totalUsers: 0,
    totalRoles: 0,
    totalPermissions: 0,
    totalStores: 2,
  },
}

const competitionFixture = {
  competitionId,
  competitionCode: 'APRIL_REGION_CHALLENGE',
  competitionName: 'April Region Challenge',
  description: null,
  competitionType: 'region_challenge',
  lifecycleState: 'active',
  startsOn: '2026-04-22',
  endsOn: '2026-04-24',
}

const competitionDetailFixture = {
  competition: competitionFixture,
  stages: [
    {
      competitionStageId: stageId,
      competitionId,
      stageCode: 'QUALIFIER',
      stageName: 'Qualifier',
      stageOrder: 1,
      stageType: 'qualifier',
      startsOn: '2026-04-22',
      endsOn: '2026-04-24',
      lifecycleState: 'active',
      finalizationState: null,
    },
  ],
  teams: [
    {
      competitionTeamId: teamId,
      teamCode: 'MARMARA_DEMO',
      teamName: 'Marmara Demo',
      teamOrder: 1,
      stores: [
        {
          storeId,
          storeCode: 'DEMO-101',
          storeName: 'Demo Store 101',
          regionId: '00000000-0000-0000-0000-000000000010',
        },
      ],
    },
  ],
  latestScores: [
    {
      stageId,
      teamId,
      teamCode: 'MARMARA_DEMO',
      teamName: 'Marmara Demo',
      snapshotDate: '2026-04-22',
      scoreValue: 92.45,
      validStoreCount: 1,
      totalStoreCount: 1,
      coverageRate: 1,
      rankPosition: 1,
      rankingPopulation: 2,
    },
  ],
  warnings: [
    {
      warningId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      stageId,
      teamId,
      storeId,
      warningCode: 'missing_bm_checklist',
      warningLevel: 'warning',
      periodStart: '2026-04-22',
      periodEnd: '2026-04-22',
      message: 'missing_bm_checklist for store DEMO-101 on 2026-04-22',
      resolvedAt: null,
    },
  ],
  storeContributions: [
    {
      stageId,
      teamId,
      teamCode: 'MARMARA_DEMO',
      teamName: 'Marmara Demo',
      storeId,
      storeCode: 'DEMO-101',
      storeName: 'Demo Store 101',
      regionId: '00000000-0000-0000-0000-000000000010',
      snapshotDate: '2026-04-22',
      scoreValue: 92.45,
      reportedWeightPercent: 95,
      expectedWeightPercent: 100,
      hasDailyData: true,
      missingKpiCodes: ['BM_CHECKLIST'],
    },
  ],
}

const scopedCompetitionDetailFixture = {
  ...competitionDetailFixture,
  teams: [
    {
      competitionTeamId: teamId,
      teamCode: 'MARMARA_DEMO',
      teamName: 'Marmara Demo',
      teamOrder: 1,
      stores: [
        {
          storeId,
          storeCode: 'DEMO-101',
          storeName: 'Visible Region Store',
          regionId: '00000000-0000-0000-0000-000000000010',
        },
      ],
    },
  ],
  storeContributions: [
    {
      stageId,
      teamId,
      teamCode: 'MARMARA_DEMO',
      teamName: 'Marmara Demo',
      storeId,
      storeCode: 'DEMO-101',
      storeName: 'Visible Region Store',
      regionId: '00000000-0000-0000-0000-000000000010',
      snapshotDate: '2026-04-22',
      scoreValue: 93.5,
      reportedWeightPercent: 95,
      expectedWeightPercent: 100,
      hasDailyData: true,
      missingKpiCodes: ['BM_CHECKLIST'],
    },
  ],
}
