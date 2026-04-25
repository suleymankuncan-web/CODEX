import { expect, test, type Page } from '@playwright/test'

const competitionId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const stageId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const teamId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const storeId = '00000000-0000-0000-0000-000000000101'

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
) {
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({ json: authSession })
  })

  await page.route('**/api/competitions**', async (route) => {
    const request = route.request()
    const pathname = new URL(request.url()).pathname

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

    await route.fulfill({
      json: {
        command: { status: 'ok', message: 'ok' },
        data: {},
      },
    })
  })
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
