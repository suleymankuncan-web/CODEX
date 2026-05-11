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

test('admin KPI config page localizes publish governance preview', async ({ page }) => {
  await page.goto('/admin/kpi-config')

  await expect(page.getByRole('heading', { name: 'Yayın kararı önizlemesi' })).toBeVisible()
  await expect(page.getByText('Yönetişim önizlemesi')).toBeVisible()
  await expect(page.getByText('Taslak değişiklikler canlı KPI yorumunu etkiler.')).toBeVisible()
  await expect(page.getByText('Mağaza profil farkı')).toBeVisible()
  await expect(page.getByText('+1 / ~1 / -0')).toBeVisible()
  await expect(page.getByText('Puanlama farkı')).toBeVisible()
  await expect(page.getByText('+0 / ~1 / -0')).toBeVisible()
  await expect(page.getByText('Sürümlü şema')).toBeVisible()
  await expect(page.getByText('Aktif', { exact: true })).toBeVisible()
  await expect(page.getByText('Son sürüm')).toBeVisible()
  await expect(page.getByText('v3')).toBeVisible()
  await expect(page.getByText('Snapshot sabitleme', { exact: true })).toBeVisible()
  await expect(
    page.getByText('Snapshot sabitleme yeni çalışmalar için aktif; yönetişim öncesi snapshotlar okunabilir kalır.'),
  ).toBeVisible()
  await expect(page.getByText('Publish decision preview')).toHaveCount(0)
  await expect(page.locator('body')).not.toContainText('Ã')
  await expect(page.locator('body')).not.toContainText('Ä')
  await expect(page.locator('body')).not.toContainText('Å')

  await page.locator('.language-toggle-button').filter({ hasText: 'EN' }).click()

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('heading', { name: 'Publish decision preview' })).toBeVisible()
  await expect(page.getByText('Governance preview')).toBeVisible()
  await expect(page.getByText('Draft changes affect live KPI interpretation.')).toBeVisible()
  await expect(page.getByText('Store profile diff')).toBeVisible()
  await expect(page.getByText('Grading diff')).toBeVisible()
  await expect(page.getByText('Versioned schema')).toBeVisible()
  await expect(page.getByText('Active', { exact: true })).toBeVisible()
  await expect(page.getByText('Latest version')).toBeVisible()
  await expect(
    page.getByText('Snapshot anchoring is active for new runs; pre-governance snapshots remain readable.'),
  ).toBeVisible()
  await expect(page.getByText('Yayın kararı önizlemesi')).toHaveCount(0)

  await page.reload()

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('heading', { name: 'Publish decision preview' })).toBeVisible()
})

test('admin KPI config profile fields stay editable and save changed draft', async ({ page }) => {
  let savedConfig: typeof draftConfig | null = null

  await page.route('**/api/reports/kpi-config', async (route) => {
    if (route.request().method() !== 'PATCH') {
      await route.fallback()
      return
    }

    savedConfig = route.request().postDataJSON()
    await route.fulfill({
      json: {
        ...kpiConfigEditorFixture,
        draftConfig: savedConfig,
        hasUnpublishedChanges: true,
      },
    })
  })

  await page.goto('/admin/kpi-config')

  const targetMetric = page
    .locator('.stacked-row')
    .filter({ has: page.locator('input[value="TARGET_ACHIEVEMENT"]') })
    .first()
  const uptMetric = page
    .locator('.stacked-row')
    .filter({ has: page.locator('input[value="UPT"]') })
    .first()

  await targetMetric.getByLabel('Etiket').fill('HG skoru')
  await expect(targetMetric.getByLabel('Etiket')).toHaveValue('HG skoru')

  await targetMetric.getByLabel('Ağırlık %').fill('60')
  await expect(targetMetric.getByLabel('Ağırlık %')).toHaveValue('60')

  await uptMetric.getByLabel('Ağırlık %').fill('35')
  await expect(uptMetric.getByLabel('Ağırlık %')).toHaveValue('35')

  await targetMetric.getByLabel('Notlar').fill('HG ağırlığı pilot kararına göre güncellendi.')
  await expect(targetMetric.getByLabel('Notlar')).toHaveValue(
    'HG ağırlığı pilot kararına göre güncellendi.',
  )

  await page.getByRole('button', { name: 'Taslağı kaydet' }).click()

  await expect.poll(() => savedConfig?.storeProfile.metrics[0].label).toBe('HG skoru')
  await expect.poll(() => savedConfig?.storeProfile.metrics[0].weightPercent).toBe(60)
  await expect.poll(() => savedConfig?.storeProfile.metrics[1].weightPercent).toBe(35)
  await expect.poll(() => savedConfig?.storeProfile.metrics[0].notes).toBe(
    'HG ağırlığı pilot kararına göre güncellendi.',
  )
})

test('admin KPI config explains weight totals before saving draft', async ({ page }) => {
  await page.goto('/admin/kpi-config')
  await page.locator('.language-toggle-button').filter({ hasText: 'EN' }).click()

  const targetMetric = page
    .locator('.stacked-row')
    .filter({ has: page.locator('input[value="TARGET_ACHIEVEMENT"]') })
    .first()
  const uptMetric = page
    .locator('.stacked-row')
    .filter({ has: page.locator('input[value="UPT"]') })
    .first()
  const saveButton = page.getByRole('button', { name: 'Save draft' })

  await targetMetric.getByLabel('Weight %').fill('')
  await expect(targetMetric.getByLabel('Weight %')).toHaveValue('')
  await expect(page.getByText('Store profile has an invalid weight value.').first()).toBeVisible()
  await expect(saveButton).toBeDisabled()

  await targetMetric.getByLabel('Weight %').fill('60')
  await expect(
    page.getByText('Store profile is 5 points short. Total must be 100 before saving.').first(),
  ).toBeVisible()
  await expect(saveButton).toBeDisabled()

  await uptMetric.getByLabel('Weight %').fill('35')
  await expect(page.getByText('Store profile is balanced at 100.').first()).toBeVisible()
  await expect(saveButton).toBeEnabled()
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
  latestPublishedVersion: {
    kpiConfigVersionId: '33333333-3333-4333-8333-333333333333',
    versionNo: 3,
    effectiveFrom: '2026-04-26T00:00:00.000Z',
    effectiveTo: null,
    publishedAt: '2026-04-26T08:00:00.000Z',
    publishedBy: 'super-admin-kpi-config-user',
  },
}
