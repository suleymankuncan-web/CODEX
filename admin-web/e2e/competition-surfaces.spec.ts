import { expect, test, type Page } from '@playwright/test'

const competitionId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const stageId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const teamId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const storeId = '00000000-0000-0000-0000-000000000101'
const secondStoreId = '00000000-0000-0000-0000-000000000102'
const templateId = '99999999-9999-4999-8999-999999999999'
const secondTemplateId = '66666666-6666-4666-8666-666666666666'
const inactiveTemplateId = '88888888-8888-4888-8888-888888888888'
const clonedTemplateId = '77777777-7777-4777-8777-777777777777'
const stagePackagePlanId = '55555555-5555-4555-8555-555555555555'
const clonedStagePackagePlanId = '44444444-4444-4444-8444-444444444444'

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

  await expect(page.getByRole('link', { name: 'Yarışmalar' })).toBeVisible()
  await expect(page.getByRole('heading', { name: /Bölge yarışma etapları/i })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'April Region Challenge' })).toBeVisible()
  const adminReadSummary = page.getByLabel('Yönetici yarışma okuma özeti')
  await expect(adminReadSummary.getByText('Okuma özeti')).toBeVisible()
  await expect(adminReadSummary.getByText('95% katkı kapsamı')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Marmara Demo' })).toBeVisible()
  await expect(
    page.locator('article').filter({ has: page.getByRole('heading', { name: 'Marmara Demo' }) }).getByText('92.45'),
  ).toBeVisible()
  await expect(
    page.getByLabel('Kapsamdaki yarışma uyarıları').getByText('BM checklist eksik', { exact: true }),
  ).toBeVisible()
  await expect(
    page.getByLabel('Kapsamdaki yarışma uyarıları').getByText('missing bm checklist', { exact: true }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: /Yeniden hesapla QUALIFIER/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Finale al QUALIFIER/ })).toBeVisible()
})

test('admin competitions page switches chrome to English copy and persists locale', async ({ page }) => {
  await page.goto('/admin/competitions')

  await expect(page.getByRole('heading', { name: 'Bölge yarışma etapları' })).toBeVisible()
  await expect(page.getByText('Yarışma listesi')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Yeni taslak' })).toBeVisible()
  await expect(page.getByText('Region challenge stages')).toHaveCount(0)
  await expect(page.locator('body')).not.toContainText('Ã')
  await expect(page.locator('body')).not.toContainText('Ä')
  await expect(page.locator('body')).not.toContainText('Å')

  await page.locator('.language-toggle-button').filter({ hasText: 'EN' }).click()

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('heading', { name: 'Region challenge stages' })).toBeVisible()
  await expect(page.getByText('Competition List')).toBeVisible()
  await expect(page.getByRole('button', { name: 'New draft' })).toBeVisible()
  await expect(page.getByText('Bölge yarışma etapları')).toHaveCount(0)

  await page.reload()

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('heading', { name: 'Region challenge stages' })).toBeVisible()
})

test('admin competition stage builder switches chrome to English copy and persists locale', async ({ page }) => {
  await page.goto('/admin/competitions')

  const builder = page.getByLabel('Yarışma etap oluşturucu')
  await expect(builder).toBeVisible()
  await expect(builder.getByText('Etap oluşturucu')).toBeVisible()
  await expect(builder.getByRole('heading', { name: 'Etap oluştur' })).toBeVisible()
  await expect(builder.getByLabel('Etap ön ayarı')).toBeVisible()
  await expect(builder.getByLabel('Etap kodu')).toBeVisible()
  await expect(builder.getByText('Etap paketi', { exact: true }).first()).toBeVisible()
  await expect(builder.getByText('Paket plan kütüphanesi')).toBeVisible()
  await expect(builder.getByText('Takım şablonu', { exact: true })).toBeVisible()
  await expect(builder.getByText('Şablon kütüphanesi')).toBeVisible()
  await expect(builder.getByText('Stage Builder')).toHaveCount(0)
  await expect(page.locator('body')).not.toContainText('Ãƒ')
  await expect(page.locator('body')).not.toContainText('Ã„')
  await expect(page.locator('body')).not.toContainText('Ã…')

  await page.locator('.language-toggle-button').filter({ hasText: 'EN' }).click()

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  const englishBuilder = page.getByLabel('Competition stage builder')
  await expect(englishBuilder).toBeVisible()
  await expect(englishBuilder.getByText('Stage Builder')).toBeVisible()
  await expect(englishBuilder.getByRole('heading', { name: 'Create stage' })).toBeVisible()
  await expect(englishBuilder.getByLabel('Stage preset')).toBeVisible()
  await expect(englishBuilder.getByText('Stage package', { exact: true }).first()).toBeVisible()
  await expect(englishBuilder.getByText('Package plan library')).toBeVisible()
  await expect(englishBuilder.getByText('Team template', { exact: true })).toBeVisible()
  await expect(englishBuilder.getByText('Template library')).toBeVisible()
  await expect(englishBuilder.getByText('Etap oluşturucu')).toHaveCount(0)

  await page.reload()

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByLabel('Competition stage builder')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Create stage' })).toBeVisible()
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

  await page.getByLabel('Etap kodu').fill('MAY_QUALIFIER')
  await page.getByLabel('Etap adı').fill('May Qualifier')
  await page.getByLabel('Etap sırası').fill('1')
  await page.getByLabel('Etap tipi').selectOption('qualifier')
  await page.getByLabel('Başlangıç', { exact: true }).fill('2026-05-01')
  await page.getByLabel('Bitiş', { exact: true }).fill('2026-05-15')
  const teamOne = page.locator('.stage-builder-team').filter({ hasText: '1. takım' })
  const teamTwo = page.locator('.stage-builder-team').filter({ hasText: '2. takım' })
  await page.getByLabel('1. takım kodu').fill('MARMARA_A')
  await page.getByLabel('1. takım adı').fill('Marmara A')
  await teamOne.getByLabel('DEMO-101 - Demo Store 101 - Marmara').check()
  await page.getByLabel('2. takım kodu').fill('MARMARA_B')
  await page.getByLabel('2. takım adı').fill('Marmara B')
  await teamTwo.getByLabel('DEMO-102 - Demo Store 102 - Marmara').check()
  await page.getByRole('button', { name: 'Etap oluştur', exact: true }).click()

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

test('admin can apply a stage format preset before creating a stage', async ({ page }) => {
  let createdStagePayload: unknown = null
  await page.unroute('**/api/competitions**')
  await routeCompetitionApi(page, authSessionFixture, competitionDetailFixture, {
    onCreateStage: (payload) => {
      createdStagePayload = payload
    },
  })

  await page.goto('/admin/competitions')

  await page.getByLabel('Etap ön ayarı').selectOption('region_league')
  await expect(page.getByLabel('Etap kodu')).toHaveValue('REGION_LEAGUE')
  await expect(page.getByLabel('Etap adı')).toHaveValue('Regional League')
  await expect(page.getByLabel('Etap tipi')).toHaveValue('league')
  await expect(page.getByLabel('Başlangıç', { exact: true })).toHaveValue('2026-04-22')
  await expect(page.getByLabel('Bitiş', { exact: true })).toHaveValue('2026-04-24')

  const teamOne = page.locator('.stage-builder-team').filter({ hasText: '1. takım' })
  const teamTwo = page.locator('.stage-builder-team').filter({ hasText: '2. takım' })
  await page.getByLabel('1. takım kodu').fill('MARMARA_A')
  await page.getByLabel('1. takım adı').fill('Marmara A')
  await teamOne.getByLabel('DEMO-101 - Demo Store 101 - Marmara').check()
  await page.getByLabel('2. takım kodu').fill('MARMARA_B')
  await page.getByLabel('2. takım adı').fill('Marmara B')
  await teamTwo.getByLabel('DEMO-102 - Demo Store 102 - Marmara').check()
  await page.getByRole('button', { name: 'Etap oluştur', exact: true }).click()

  await expect(page.getByText('Competition stage created')).toBeVisible()
  expect(createdStagePayload).toMatchObject({
    stagePresetCode: 'region_league',
    stageCode: 'REGION_LEAGUE',
    stageName: 'Regional League',
    stageOrder: 1,
    stageType: 'league',
    startsOn: '2026-04-22',
    endsOn: '2026-04-24',
  })
})

test('admin can create a league then final stage package from templates', async ({ page }) => {
  let createdStagePackagePayload: unknown = null
  await page.unroute('**/api/competitions**')
  await routeCompetitionApi(page, authSessionFixture, competitionDetailFixture, {
    initialTeamTemplates: [activeTemplateFixture, secondActiveTemplateFixture],
    onCreateStagePackage: (payload) => {
      createdStagePackagePayload = payload
    },
  })

  await page.goto('/admin/competitions')

  await page.getByLabel('Etap paketi').selectOption('league_then_final')
  await page.getByLabel('Paket 1. takım şablonu').selectOption(templateId)
  await page.getByLabel('Paket 2. takım şablonu').selectOption(secondTemplateId)
  await expect(page.getByLabel('Paket etabı 1 kodu')).toHaveValue('REGION_LEAGUE')
  await expect(page.getByLabel('Paket etabı 2 kodu')).toHaveValue('FINAL_SHOWDOWN')
  await page.getByLabel('Paket etabı 2 adı').fill('Marmara Final Night')
  await page.getByLabel('Paket etabı 2 başlangıcı').fill('2026-04-23')
  await page.getByRole('button', { name: 'Etap paketi oluştur' }).click()

  await expect(page.getByText('Competition stage package created')).toBeVisible()
  expect(createdStagePackagePayload).toMatchObject({
    packageCode: 'league_then_final',
    stages: [
      {
        stagePresetCode: 'region_league',
        stageCode: 'REGION_LEAGUE',
        stageName: 'Regional League',
        stageOrder: 1,
        stageType: 'league',
        startsOn: '2026-04-22',
        endsOn: '2026-04-24',
        teams: [
          {
            sourceTemplateId: templateId,
            teamCode: 'MARMARA_TEMPLATE_A',
            teamName: 'Marmara Template A',
            storeIds: [storeId],
          },
          {
            sourceTemplateId: secondTemplateId,
            teamCode: 'MARMARA_TEMPLATE_B',
            teamName: 'Marmara Template B',
            storeIds: [secondStoreId],
          },
        ],
      },
      {
        stagePresetCode: 'final_showdown',
        stageCode: 'FINAL_SHOWDOWN',
        stageName: 'Marmara Final Night',
        stageOrder: 2,
        stageType: 'final',
        startsOn: '2026-04-23',
        endsOn: '2026-04-24',
      },
    ],
  })
})

test('admin can save, submit, approve, and execute a stage package plan', async ({ page }) => {
  let savedStagePackagePlanPayload: unknown = null
  let submittedStagePackagePlanId: string | null = null
  let approvedStagePackagePlanId: string | null = null
  let executedStagePackagePlanId: string | null = null
  await page.unroute('**/api/competitions**')
  await routeCompetitionApi(page, authSessionFixture, competitionDetailFixture, {
    initialTeamTemplates: [activeTemplateFixture, secondActiveTemplateFixture],
    onCreateStagePackagePlan: (payload) => {
      savedStagePackagePlanPayload = payload
    },
    onSubmitStagePackagePlan: (planId) => {
      submittedStagePackagePlanId = planId
    },
    onApproveStagePackagePlan: (planId) => {
      approvedStagePackagePlanId = planId
    },
    onExecuteStagePackagePlan: (planId) => {
      executedStagePackagePlanId = planId
    },
  })

  await page.goto('/admin/competitions')

  await page.getByLabel('Etap paketi').selectOption('league_then_final')
  await page.getByLabel('Paket 1. takım şablonu').selectOption(templateId)
  await page.getByLabel('Paket 2. takım şablonu').selectOption(secondTemplateId)
  await page.getByLabel('Paket plan adı').fill('April regional package')
  await page.getByLabel('Paket etabı 2 adı').fill('Marmara Final Night')
  await page.getByRole('button', { name: 'Paket planını kaydet' }).click()

  await expect(page.getByText('Competition stage package plan saved')).toBeVisible()
  const planLibrary = page.locator('.stage-package-plan-library')
  await expect(planLibrary.locator('strong').filter({ hasText: 'April regional package' })).toBeVisible()
  await expect(planLibrary.getByText('taslak', { exact: true })).toBeVisible()
  await expect(
    planLibrary.getByRole('button', { name: 'April regional package onaylı planını çalıştır' }),
  ).toHaveCount(0)

  await planLibrary.getByRole('button', { name: 'April regional package planını karara hazır işaretle' }).click()

  await expect(page.getByText('Competition stage package plan submitted for review')).toBeVisible()
  expect(submittedStagePackagePlanId).toBe(stagePackagePlanId)
  await expect(planLibrary.getByText('karara hazır', { exact: true })).toBeVisible()
  await expect(planLibrary.getByText('Karar önizlemesi')).toBeVisible()
  await expect(planLibrary.getByText('2026-04-22 - 2026-04-24').first()).toBeVisible()
  await expect(planLibrary.getByText('4 mağaza ataması')).toBeVisible()
  await expect(planLibrary.getByText('MARMARA_TEMPLATE_A - Marmara Template A')).toBeVisible()
  await expect(planLibrary.getByText('MARMARA_TEMPLATE_B - Marmara Template B')).toBeVisible()
  await planLibrary.getByLabel('April regional package karar notu').fill('Reviewed in planning meeting.')
  await planLibrary.getByRole('button', { name: 'April regional package kararını onayla' }).click()

  await expect(page.getByText('Competition stage package plan approved')).toBeVisible()
  expect(approvedStagePackagePlanId).toBe(stagePackagePlanId)
  await expect(planLibrary.getByText('onaylandı', { exact: true })).toBeVisible()
  await planLibrary.getByRole('button', { name: 'April regional package onaylı planını çalıştır' }).click()

  await expect(page.getByText('Competition stage package plan executed')).toBeVisible()
  expect(executedStagePackagePlanId).toBe(stagePackagePlanId)
  expect(savedStagePackagePlanPayload).toMatchObject({
    planName: 'April regional package',
    packageCode: 'league_then_final',
    stages: [
      {
        stagePresetCode: 'region_league',
        stageCode: 'REGION_LEAGUE',
        stageName: 'Regional League',
        stageOrder: 1,
        stageType: 'league',
        startsOn: '2026-04-22',
        endsOn: '2026-04-24',
      },
      {
        stagePresetCode: 'final_showdown',
        stageCode: 'FINAL_SHOWDOWN',
        stageName: 'Marmara Final Night',
        stageOrder: 2,
        stageType: 'final',
      },
    ],
  })
})

test('admin can reject a submitted stage package plan', async ({ page }) => {
  let rejectedStagePackagePlanId: string | null = null
  let clonedStagePackagePlanSourceId: string | null = null
  await page.unroute('**/api/competitions**')
  await routeCompetitionApi(page, authSessionFixture, competitionDetailFixture, {
    initialTeamTemplates: [activeTemplateFixture, secondActiveTemplateFixture],
    initialStagePackagePlans: [createStagePackagePlanFixture({ planStatus: 'submitted' })],
    onRejectStagePackagePlan: (planId) => {
      rejectedStagePackagePlanId = planId
    },
    onCloneStagePackagePlan: (planId) => {
      clonedStagePackagePlanSourceId = planId
    },
  })

  await page.goto('/admin/competitions')

  const planLibrary = page.locator('.stage-package-plan-library')
  await expect(planLibrary.getByText('karara hazır', { exact: true })).toBeVisible()
  await expect(planLibrary.getByRole('button', { name: 'April regional package planını düzenle' })).toHaveCount(0)
  await expect(planLibrary.getByRole('button', { name: 'April regional package planını iptal et' })).toHaveCount(0)
  await planLibrary.getByLabel('April regional package karar notu').fill('Dates need another pass.')
  await planLibrary.getByRole('button', { name: 'April regional package planını revizyona gönder' }).click()

  await expect(page.getByText('Competition stage package plan rejected')).toBeVisible()
  expect(rejectedStagePackagePlanId).toBe(stagePackagePlanId)
  await expect(planLibrary.getByText('iade edildi', { exact: true })).toBeVisible()
  await expect(
    planLibrary.getByRole('button', { name: 'April regional package onaylı planını çalıştır' }),
  ).toHaveCount(0)
  await planLibrary.getByRole('button', { name: 'April regional package planını yeni taslak olarak klonla' }).click()
  await expect(page.getByText('Competition stage package plan cloned as draft')).toBeVisible()
  expect(clonedStagePackagePlanSourceId).toBe(stagePackagePlanId)
  await expect(planLibrary.locator('strong').filter({ hasText: 'April regional package revision' })).toBeVisible()
  await expect(planLibrary.getByText('April regional package planından klonlandı')).toBeVisible()
  await expect(planLibrary.getByText('taslak', { exact: true })).toBeVisible()
  await planLibrary.getByRole('button', { name: 'April regional package revision geçmişini göster' }).click()
  await expect(planLibrary.getByText('competition_stage_package_plan.cloned_from_returned')).toBeVisible()
  await expect(planLibrary.getByText('Kaynak: April regional package')).toBeVisible()
  await planLibrary.getByRole('button', { name: 'April regional package geçmişini göster', exact: true }).click()
  await expect(planLibrary.getByText('competition_stage_package_plan.rejected')).toBeVisible()
})

test('admin can edit, inspect, and cancel a stage package plan draft', async ({ page }) => {
  let updatedStagePackagePlanPayload: unknown = null
  let cancelledStagePackagePlanId: string | null = null
  await page.unroute('**/api/competitions**')
  await routeCompetitionApi(page, authSessionFixture, competitionDetailFixture, {
    initialTeamTemplates: [activeTemplateFixture, secondActiveTemplateFixture],
    initialStagePackagePlans: [createStagePackagePlanFixture()],
    onUpdateStagePackagePlan: (_planId, payload) => {
      updatedStagePackagePlanPayload = payload
    },
    onCancelStagePackagePlan: (planId) => {
      cancelledStagePackagePlanId = planId
    },
  })

  await page.goto('/admin/competitions')

  const planLibrary = page.locator('.stage-package-plan-library')
  await planLibrary.getByRole('button', { name: 'April regional package planını düzenle' }).click()
  await planLibrary.getByLabel('Plan adını düzenle').fill('April regional package revised')
  await planLibrary.getByLabel('Paket etabı düzenle 2 adı').fill('Revised Final Showdown')
  await planLibrary.getByRole('button', { name: 'Paket planı değişikliklerini kaydet' }).click()

  await expect(page.getByText('Competition stage package plan updated')).toBeVisible()
  await expect(planLibrary.locator('strong').filter({ hasText: 'April regional package revised' })).toBeVisible()
  expect(updatedStagePackagePlanPayload).toMatchObject({
    planName: 'April regional package revised',
    packageCode: 'league_then_final',
    stages: [
      { stageName: 'Regional League' },
      { stageName: 'Revised Final Showdown' },
    ],
  })

  await planLibrary.getByRole('button', { name: 'April regional package revised geçmişini göster' }).click()
  await expect(planLibrary.getByText('competition_stage_package_plan.updated')).toBeVisible()

  await planLibrary.getByRole('button', { name: 'April regional package revised planını iptal et' }).click()

  await expect(page.getByText('Competition stage package plan cancelled')).toBeVisible()
  expect(cancelledStagePackagePlanId).toBe(stagePackagePlanId)
  await expect(planLibrary.getByText('iptal', { exact: true })).toBeVisible()
  await expect(
    planLibrary.getByRole('button', { name: 'April regional package revised onaylı planını çalıştır' }),
  ).toHaveCount(0)
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
  await templateBuilder.getByLabel('Şablon kodu').fill('MARMARA_TEMPLATE_A')
  await templateBuilder.getByLabel('Şablon adı').fill('Marmara Template A')
  await templateBuilder.getByLabel('DEMO-101 - Demo Store 101 - Marmara').check()
  await templateBuilder.getByRole('button', { name: 'Şablon oluştur' }).click()

  await expect(page.getByText('Competition team template created')).toBeVisible()
  expect(createdTemplatePayload).toMatchObject({
    templateCode: 'MARMARA_TEMPLATE_A',
    templateName: 'Marmara Template A',
    storeIds: [storeId],
  })

  await page.getByLabel('Etap kodu').fill('MAY_TEMPLATE_STAGE')
  await page.getByLabel('Etap adı').fill('May Template Stage')
  await page.getByLabel('Etap sırası').fill('2')
  await page.getByLabel('Başlangıç', { exact: true }).fill('2026-05-16')
  await page.getByLabel('Bitiş', { exact: true }).fill('2026-05-31')
  const teamOne = page.locator('.stage-builder-team').filter({ hasText: '1. takım' })
  await teamOne.getByLabel('1. takım şablonu').selectOption(templateId)
  await page.getByLabel('2. takım kodu').fill('MARMARA_B')
  await page.getByLabel('2. takım adı').fill('Marmara B')
  const teamTwo = page.locator('.stage-builder-team').filter({ hasText: '2. takım' })
  await teamTwo.getByLabel('DEMO-102 - Demo Store 102 - Marmara').check()
  await page.getByRole('button', { name: 'Etap oluştur', exact: true }).click()

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

  await templateLibrary.getByLabel('Pasif şablonları göster').check()
  await expect(templateLibrary.locator('strong').filter({ hasText: 'OLD_MARMARA_TEMPLATE' })).toBeVisible()
  await expect(templateLibrary.getByText('Pasif', { exact: true })).toBeVisible()

  await templateLibrary.getByRole('button', { name: 'MARMARA_TEMPLATE_A şablonunu pasifleştir' }).click()

  await expect(page.getByText('Competition team template deactivated')).toBeVisible()
  expect(deactivatedTemplateId).toBe(templateId)
  const teamOne = page.locator('.stage-builder-team').filter({ hasText: '1. takım' })
  await expect(teamOne.getByLabel('1. takım şablonu')).not.toContainText('MARMARA_TEMPLATE_A')
})

test('admin can update and clone competition team templates', async ({ page }) => {
  let updatedTemplatePayload: unknown = null
  let clonedTemplatePayload: unknown = null
  await page.unroute('**/api/competitions**')
  await routeCompetitionApi(page, authSessionFixture, competitionDetailFixture, {
    initialTeamTemplates: [activeTemplateFixture],
    onUpdateTemplate: (_templateId, payload) => {
      updatedTemplatePayload = payload
    },
    onCloneTemplate: (_templateId, payload) => {
      clonedTemplatePayload = payload
    },
  })

  await page.goto('/admin/competitions')

  const templateLibrary = page.locator('.stage-template-library')
  let activeTemplateRow = templateLibrary.locator('article').filter({ hasText: 'MARMARA_TEMPLATE_A' })
  await activeTemplateRow.getByRole('button', { name: 'MARMARA_TEMPLATE_A şablonunu düzenle' }).click()
  await activeTemplateRow.getByLabel('Şablon adını düzenle').fill('Marmara Template A Revised')
  await activeTemplateRow.getByLabel('Şablon açıklamasını düzenle').fill('May revision')
  await activeTemplateRow.getByLabel('DEMO-102 - Demo Store 102 - Marmara').check()
  await activeTemplateRow.getByRole('button', { name: 'Şablonu kaydet' }).click()

  await expect(page.getByText('Competition team template updated')).toBeVisible()
  expect(updatedTemplatePayload).toMatchObject({
    templateCode: 'MARMARA_TEMPLATE_A',
    templateName: 'Marmara Template A Revised',
    description: 'May revision',
    storeIds: [storeId, secondStoreId],
  })

  activeTemplateRow = templateLibrary.locator('article').filter({ hasText: 'MARMARA_TEMPLATE_A' })
  await activeTemplateRow.getByRole('button', { name: 'MARMARA_TEMPLATE_A şablonunu klonla' }).click()
  await activeTemplateRow.getByLabel('Klon şablon kodu').fill('MARMARA_TEMPLATE_A_COPY')
  await activeTemplateRow.getByLabel('Klon şablon adı').fill('Marmara Template A Copy')
  await activeTemplateRow.getByLabel('Klon şablon açıklaması').fill('Copy for finals')
  await activeTemplateRow.getByRole('button', { name: 'Şablonu klonla' }).click()

  await expect(page.getByText('Competition team template cloned')).toBeVisible()
  expect(clonedTemplatePayload).toMatchObject({
    templateCode: 'MARMARA_TEMPLATE_A_COPY',
    templateName: 'Marmara Template A Copy',
    description: 'Copy for finals',
  })
  await expect(templateLibrary.locator('strong').filter({ hasText: 'MARMARA_TEMPLATE_A_COPY' })).toBeVisible()
})

test('region manager competitions surface is read-only and scoped to visible store contributions', async ({ page }) => {
  await page.unroute('**/api/auth/session')
  await page.unroute('**/api/competitions**')
  await routeCompetitionApi(page, regionManagerSessionFixture, scopedCompetitionDetailFixture)

  await page.goto('/admin/competitions')

  await expect(page.getByRole('heading', { name: /Bölge yarışma etapları/i })).toBeVisible()
  const regionReadSummary = page.getByLabel('Yönetici yarışma okuma özeti')
  const regionContributionRows = page.getByLabel('Kapsamdaki yarışma mağaza katkıları')
  await expect(regionReadSummary.getByText('Okuma özeti')).toBeVisible()
  await expect(regionReadSummary.getByText('95% katkı kapsamı')).toBeVisible()
  await expect(regionContributionRows.getByText('Katkı sağlığı')).toBeVisible()
  await expect(regionContributionRows.getByText('Kısmi katkı').first()).toBeVisible()
  await expect(page.getByText('Kapsamdaki katkılar')).toBeVisible()
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
    onUpdateTemplate?: (templateId: string, payload: unknown) => void
    onCloneTemplate?: (templateId: string, payload: unknown) => void
    onCreateStagePackage?: (payload: unknown) => void
    onCreateStagePackagePlan?: (payload: unknown) => void
    onUpdateStagePackagePlan?: (planId: string, payload: unknown) => void
    onSubmitStagePackagePlan?: (planId: string) => void
    onApproveStagePackagePlan?: (planId: string, payload: unknown) => void
    onRejectStagePackagePlan?: (planId: string, payload: unknown) => void
    onCloneStagePackagePlan?: (planId: string) => void
    onExecuteStagePackagePlan?: (planId: string) => void
    onCancelStagePackagePlan?: (planId: string) => void
    initialTeamTemplates?: unknown[]
    initialStagePackagePlans?: unknown[]
  },
) {
  let teamTemplates: unknown[] = options?.initialTeamTemplates ?? []
  let stagePackagePlans: unknown[] = options?.initialStagePackagePlans ?? []
  let stagePackagePlanAuditEvents: unknown[] = stagePackagePlans.flatMap((plan) => {
    const planRecord = plan as { planId?: string; planName?: string }

    return planRecord.planId === stagePackagePlanId
      ? [
          {
            eventLogId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            occurredAt: '2026-04-25T10:00:00.000Z',
            actorUserId: authSession.user.userId,
            eventType: 'competition_stage_package_plan.saved',
            metadata: { planName: planRecord.planName },
          },
        ]
      : []
  })
  let clonedStagePackagePlanAuditEvents: unknown[] = []

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

    if (request.method() === 'PUT' && pathname.endsWith(`/api/competitions/team-templates/${templateId}`)) {
      const payload = request.postDataJSON()
      options?.onUpdateTemplate?.(templateId, payload)
      teamTemplates = teamTemplates.map((template) =>
        (template as { templateId?: string }).templateId === templateId
          ? {
              ...(template as Record<string, unknown>),
              templateCode: payload.templateCode,
              templateName: payload.templateName,
              description: payload.description ?? null,
              stores: storesFromIds(payload.storeIds),
            }
          : template,
      )
      await route.fulfill({
        json: {
          command: { status: 'updated', message: 'Competition team template updated' },
          data: {
            template: teamTemplates.find(
              (template) => (template as { templateId?: string }).templateId === templateId,
            ),
          },
        },
      })
      return
    }

    if (request.method() === 'POST' && pathname.endsWith(`/api/competitions/team-templates/${templateId}/clone`)) {
      const payload = request.postDataJSON()
      options?.onCloneTemplate?.(templateId, payload)
      const sourceTemplate = teamTemplates.find(
        (template) => (template as { templateId?: string }).templateId === templateId,
      ) as { stores?: unknown[] } | undefined
      const clonedTemplate = {
        templateId: clonedTemplateId,
        templateCode: payload.templateCode,
        templateName: payload.templateName,
        description: payload.description ?? null,
        isActive: true,
        stores: sourceTemplate?.stores ?? [],
      }
      teamTemplates = [...teamTemplates, clonedTemplate]
      await route.fulfill({
        json: {
          command: { status: 'created', message: 'Competition team template cloned' },
          data: {
            template: clonedTemplate,
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

    if (
      request.method() === 'GET' &&
      pathname.endsWith(`/api/competitions/${competitionId}/stage-package-plans`)
    ) {
      await route.fulfill({
        json: {
          items: stagePackagePlans,
          meta: {
            count: stagePackagePlans.length,
            total: stagePackagePlans.length,
            limit: stagePackagePlans.length,
            offset: 0,
          },
        },
      })
      return
    }

    const planAuditMatch = pathname.match(/\/api\/competitions\/stage-package-plans\/([^/]+)\/audit$/)
    if (request.method() === 'GET' && planAuditMatch) {
      const auditEvents =
        planAuditMatch[1] === clonedStagePackagePlanId
          ? clonedStagePackagePlanAuditEvents
          : stagePackagePlanAuditEvents
      await route.fulfill({
        json: {
          items: auditEvents,
          meta: {
            count: auditEvents.length,
            total: auditEvents.length,
            limit: auditEvents.length,
            offset: 0,
          },
        },
      })
      return
    }

    if (request.method() === 'GET' && pathname.endsWith(`/api/competitions/${competitionId}`)) {
      await route.fulfill({ json: competitionDetail })
      return
    }

    if (
      request.method() === 'POST' &&
      pathname.endsWith(`/api/competitions/${competitionId}/stage-package-plans`)
    ) {
      const payload = request.postDataJSON()
      options?.onCreateStagePackagePlan?.(payload)
      const plan = {
        planId: stagePackagePlanId,
        competitionId,
        packageCode: payload.packageCode,
        planName: payload.planName,
        planStatus: 'draft',
        stageDrafts: payload.stages,
        createdStageIds: [],
        createdAt: '2026-04-25T10:00:00.000Z',
        updatedAt: '2026-04-25T10:00:00.000Z',
        executedAt: null,
      }
      stagePackagePlans = [plan, ...stagePackagePlans]
      await route.fulfill({
        json: {
          command: { status: 'created', message: 'Competition stage package plan saved' },
          data: { plan },
        },
      })
      return
    }

    if (
      request.method() === 'PUT' &&
      pathname.endsWith(`/api/competitions/stage-package-plans/${stagePackagePlanId}`)
    ) {
      const payload = request.postDataJSON()
      options?.onUpdateStagePackagePlan?.(stagePackagePlanId, payload)
      stagePackagePlans = stagePackagePlans.map((plan) =>
        (plan as { planId?: string }).planId === stagePackagePlanId
          ? {
              ...(plan as Record<string, unknown>),
              packageCode: payload.packageCode,
              planName: payload.planName,
              stageDrafts: payload.stages,
              updatedAt: '2026-04-25T10:10:00.000Z',
            }
          : plan,
      )
      stagePackagePlanAuditEvents = [
        ...stagePackagePlanAuditEvents,
        {
          eventLogId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          occurredAt: '2026-04-25T10:10:00.000Z',
          actorUserId: authSession.user.userId,
          eventType: 'competition_stage_package_plan.updated',
          metadata: { planName: payload.planName, stageCount: payload.stages.length },
        },
      ]
      await route.fulfill({
        json: {
          command: { status: 'updated', message: 'Competition stage package plan updated' },
          data: {
            plan: stagePackagePlans.find(
              (plan) => (plan as { planId?: string }).planId === stagePackagePlanId,
            ),
          },
        },
      })
      return
    }

    if (
      request.method() === 'POST' &&
      pathname.endsWith(`/api/competitions/stage-package-plans/${stagePackagePlanId}/execute`)
    ) {
      options?.onExecuteStagePackagePlan?.(stagePackagePlanId)
      stagePackagePlans = stagePackagePlans.map((plan) =>
        (plan as { planId?: string }).planId === stagePackagePlanId
          ? {
              ...(plan as Record<string, unknown>),
              planStatus: 'executed',
              createdStageIds: [
                'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
                'ffffffff-ffff-4fff-8fff-ffffffffffff',
              ],
              executedAt: '2026-04-25T10:05:00.000Z',
              updatedAt: '2026-04-25T10:05:00.000Z',
            }
          : plan,
      )
      await route.fulfill({
        json: {
          command: { status: 'executed', message: 'Competition stage package plan executed' },
          data: {
            plan: stagePackagePlans.find(
              (plan) => (plan as { planId?: string }).planId === stagePackagePlanId,
            ),
            stages: [
              {
                competitionStageId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
                competitionId,
                stageCode: 'REGION_LEAGUE',
                stageName: 'Regional League',
                stageOrder: 1,
                stageType: 'league',
                startsOn: '2026-04-22',
                endsOn: '2026-04-24',
                lifecycleState: 'active',
                finalizationState: null,
              },
              {
                competitionStageId: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
                competitionId,
                stageCode: 'FINAL_SHOWDOWN',
                stageName: 'Marmara Final Night',
                stageOrder: 2,
                stageType: 'final',
                startsOn: '2026-04-24',
                endsOn: '2026-04-24',
                lifecycleState: 'active',
                finalizationState: null,
              },
            ],
          },
        },
      })
      return
    }

    if (
      request.method() === 'POST' &&
      pathname.endsWith(`/api/competitions/stage-package-plans/${stagePackagePlanId}/submit`)
    ) {
      options?.onSubmitStagePackagePlan?.(stagePackagePlanId)
      stagePackagePlans = stagePackagePlans.map((plan) =>
        (plan as { planId?: string }).planId === stagePackagePlanId
          ? {
              ...(plan as Record<string, unknown>),
              planStatus: 'submitted',
              submittedByUserId: authSession.user.userId,
              submittedAt: '2026-04-25T10:15:00.000Z',
              updatedAt: '2026-04-25T10:15:00.000Z',
            }
          : plan,
      )
      stagePackagePlanAuditEvents = [
        ...stagePackagePlanAuditEvents,
        {
          eventLogId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
          occurredAt: '2026-04-25T10:15:00.000Z',
          actorUserId: authSession.user.userId,
          eventType: 'competition_stage_package_plan.submitted',
          metadata: { planName: 'April regional package' },
        },
      ]
      await route.fulfill({
        json: {
          command: { status: 'submitted', message: 'Competition stage package plan submitted for review' },
          data: {
            plan: stagePackagePlans.find(
              (plan) => (plan as { planId?: string }).planId === stagePackagePlanId,
            ),
          },
        },
      })
      return
    }

    if (
      request.method() === 'POST' &&
      pathname.endsWith(`/api/competitions/stage-package-plans/${stagePackagePlanId}/approve`)
    ) {
      const payload = request.postDataJSON()
      options?.onApproveStagePackagePlan?.(stagePackagePlanId, payload)
      stagePackagePlans = stagePackagePlans.map((plan) =>
        (plan as { planId?: string }).planId === stagePackagePlanId
          ? {
              ...(plan as Record<string, unknown>),
              planStatus: 'approved',
              reviewedByUserId: authSession.user.userId,
              reviewedAt: '2026-04-25T10:20:00.000Z',
              reviewNote: payload.reviewNote ?? null,
              updatedAt: '2026-04-25T10:20:00.000Z',
            }
          : plan,
      )
      stagePackagePlanAuditEvents = [
        ...stagePackagePlanAuditEvents,
        {
          eventLogId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
          occurredAt: '2026-04-25T10:20:00.000Z',
          actorUserId: authSession.user.userId,
          eventType: 'competition_stage_package_plan.approved',
          metadata: { planName: 'April regional package', reviewNote: payload.reviewNote },
        },
      ]
      await route.fulfill({
        json: {
          command: { status: 'approved', message: 'Competition stage package plan approved' },
          data: {
            plan: stagePackagePlans.find(
              (plan) => (plan as { planId?: string }).planId === stagePackagePlanId,
            ),
          },
        },
      })
      return
    }

    if (
      request.method() === 'POST' &&
      pathname.endsWith(`/api/competitions/stage-package-plans/${stagePackagePlanId}/reject`)
    ) {
      const payload = request.postDataJSON()
      options?.onRejectStagePackagePlan?.(stagePackagePlanId, payload)
      stagePackagePlans = stagePackagePlans.map((plan) =>
        (plan as { planId?: string }).planId === stagePackagePlanId
          ? {
              ...(plan as Record<string, unknown>),
              planStatus: 'rejected',
              reviewedByUserId: authSession.user.userId,
              reviewedAt: '2026-04-25T10:20:00.000Z',
              reviewNote: payload.reviewNote ?? null,
              updatedAt: '2026-04-25T10:20:00.000Z',
            }
          : plan,
      )
      stagePackagePlanAuditEvents = [
        ...stagePackagePlanAuditEvents,
        {
          eventLogId: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
          occurredAt: '2026-04-25T10:20:00.000Z',
          actorUserId: authSession.user.userId,
          eventType: 'competition_stage_package_plan.rejected',
          metadata: { planName: 'April regional package', reviewNote: payload.reviewNote },
        },
      ]
      await route.fulfill({
        json: {
          command: { status: 'rejected', message: 'Competition stage package plan rejected' },
          data: {
            plan: stagePackagePlans.find(
              (plan) => (plan as { planId?: string }).planId === stagePackagePlanId,
            ),
          },
        },
      })
      return
    }

    if (
      request.method() === 'POST' &&
      pathname.endsWith(`/api/competitions/stage-package-plans/${stagePackagePlanId}/clone`)
    ) {
      options?.onCloneStagePackagePlan?.(stagePackagePlanId)
      const sourcePlan = stagePackagePlans.find(
        (plan) => (plan as { planId?: string }).planId === stagePackagePlanId,
      ) as { packageCode?: string; planName?: string; stageDrafts?: unknown[] } | undefined
      const clonedPlan = {
        planId: clonedStagePackagePlanId,
        competitionId,
        packageCode: sourcePlan?.packageCode ?? 'league_then_final',
        planName: `${sourcePlan?.planName ?? 'Package plan'} revision`,
        planStatus: 'draft',
        stageDrafts: sourcePlan?.stageDrafts ?? [],
        createdStageIds: [],
        sourcePlan: {
          planId: stagePackagePlanId,
          planName: sourcePlan?.planName ?? 'Package plan',
        },
        submittedByUserId: null,
        submittedAt: null,
        reviewedByUserId: null,
        reviewedAt: null,
        reviewNote: null,
        createdAt: '2026-04-25T10:25:00.000Z',
        updatedAt: '2026-04-25T10:25:00.000Z',
        executedAt: null,
      }
      stagePackagePlans = [clonedPlan, ...stagePackagePlans]
      stagePackagePlanAuditEvents = [
        ...stagePackagePlanAuditEvents,
        {
          eventLogId: '11111111-2222-4333-8444-555555555555',
          occurredAt: '2026-04-25T10:25:00.000Z',
          actorUserId: authSession.user.userId,
          eventType: 'competition_stage_package_plan.cloned_to_draft',
          metadata: {
            planName: sourcePlan?.planName,
            clonedPlanId: clonedStagePackagePlanId,
            clonedPlanName: clonedPlan.planName,
          },
        },
      ]
      clonedStagePackagePlanAuditEvents = [
        {
          eventLogId: '22222222-3333-4444-8555-666666666666',
          occurredAt: '2026-04-25T10:25:00.000Z',
          actorUserId: authSession.user.userId,
          eventType: 'competition_stage_package_plan.cloned_from_returned',
          metadata: {
            sourcePlanId: stagePackagePlanId,
            sourcePlanName: sourcePlan?.planName,
            planName: clonedPlan.planName,
          },
        },
      ]
      await route.fulfill({
        json: {
          command: { status: 'created', message: 'Competition stage package plan cloned as draft' },
          data: { plan: clonedPlan },
        },
      })
      return
    }

    if (
      request.method() === 'PATCH' &&
      pathname.endsWith(`/api/competitions/stage-package-plans/${stagePackagePlanId}/cancel`)
    ) {
      options?.onCancelStagePackagePlan?.(stagePackagePlanId)
      stagePackagePlans = stagePackagePlans.map((plan) =>
        (plan as { planId?: string }).planId === stagePackagePlanId
          ? {
              ...(plan as Record<string, unknown>),
              planStatus: 'cancelled',
              updatedAt: '2026-04-25T10:12:00.000Z',
            }
          : plan,
      )
      stagePackagePlanAuditEvents = [
        ...stagePackagePlanAuditEvents,
        {
          eventLogId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
          occurredAt: '2026-04-25T10:12:00.000Z',
          actorUserId: authSession.user.userId,
          eventType: 'competition_stage_package_plan.cancelled',
          metadata: { planName: 'April regional package revised' },
        },
      ]
      await route.fulfill({
        json: {
          command: { status: 'cancelled', message: 'Competition stage package plan cancelled' },
          data: {
            plan: stagePackagePlans.find(
              (plan) => (plan as { planId?: string }).planId === stagePackagePlanId,
            ),
          },
        },
      })
      return
    }

    if (request.method() === 'POST' && pathname.endsWith(`/api/competitions/${competitionId}/stage-packages`)) {
      options?.onCreateStagePackage?.(request.postDataJSON())
      await route.fulfill({
        json: {
          command: { status: 'created', message: 'Competition stage package created' },
          data: {
            stages: [
              {
                competitionStageId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
                competitionId,
                stageCode: 'REGION_LEAGUE',
                stageName: 'Regional League',
                stageOrder: 1,
                stageType: 'league',
                startsOn: '2026-04-22',
                endsOn: '2026-04-24',
                lifecycleState: 'active',
                finalizationState: null,
              },
              {
                competitionStageId: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
                competitionId,
                stageCode: 'FINAL_SHOWDOWN',
                stageName: 'Final Showdown',
                stageOrder: 2,
                stageType: 'final',
                startsOn: '2026-04-24',
                endsOn: '2026-04-24',
                lifecycleState: 'active',
                finalizationState: null,
              },
            ],
          },
        },
      })
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

function storesFromIds(storeIds: string[]) {
  return authLookupsFixture.stores.flatMap((store) =>
    storeIds.includes(store.storeId)
      ? [
          {
            storeId: store.storeId,
            storeCode: store.storeCode,
            storeName: store.storeName,
            regionId: store.regionId,
          },
        ]
      : [],
  )
}

function createStagePackagePlanFixture(input?: { planStatus?: string }) {
  const teams = [activeTemplateFixture, secondActiveTemplateFixture].map((template) => ({
    sourceTemplateId: template.templateId,
    teamCode: template.templateCode,
    teamName: template.templateName,
    storeIds: template.stores.map((store) => store.storeId),
  }))

  return {
    planId: stagePackagePlanId,
    competitionId,
    packageCode: 'league_then_final',
    planName: 'April regional package',
    planStatus: input?.planStatus ?? 'draft',
    stageDrafts: [
      {
        stagePresetCode: 'region_league',
        stageCode: 'REGION_LEAGUE',
        stageName: 'Regional League',
        stageOrder: 1,
        stageType: 'league',
        startsOn: '2026-04-22',
        endsOn: '2026-04-24',
        teams,
      },
      {
        stagePresetCode: 'final_showdown',
        stageCode: 'FINAL_SHOWDOWN',
        stageName: 'Final Showdown',
        stageOrder: 2,
        stageType: 'final',
        startsOn: '2026-04-24',
        endsOn: '2026-04-24',
        teams,
      },
    ],
    createdStageIds: [],
    submittedByUserId: input?.planStatus === 'submitted' ? authSessionFixture.user.userId : null,
    submittedAt: input?.planStatus === 'submitted' ? '2026-04-25T10:15:00.000Z' : null,
    reviewedByUserId: null,
    reviewedAt: null,
    reviewNote: null,
    createdAt: '2026-04-25T10:00:00.000Z',
    updatedAt: '2026-04-25T10:00:00.000Z',
    executedAt: null,
  }
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

const secondActiveTemplateFixture = {
  templateId: secondTemplateId,
  templateCode: 'MARMARA_TEMPLATE_B',
  templateName: 'Marmara Template B',
  description: null,
  isActive: true,
  stores: [
    {
      storeId: secondStoreId,
      storeCode: 'DEMO-102',
      storeName: 'Demo Store 102',
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
