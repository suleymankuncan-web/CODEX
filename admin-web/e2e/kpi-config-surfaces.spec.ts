import { expect, test, type Page } from './test-fixtures'

const legacySelectors = [
  '.hero-panel',
  '.metric-card',
  '.dashboard-card',
  '.status-pill',
  '.panel-heading',
  '.stacked-row',
  '.stacked-table',
  '.control-button',
  '.page-stack',
  '.key-grid',
].join(', ')

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'store-ops-admin-session',
      JSON.stringify({
        mode: 'mock',
        mockUserId: 'super-admin-kpi-surface-user',
        mockRoleCodes: 'SUPER_ADMIN',
        mockCompanyIds: '00000000-0000-0000-0000-000000000001',
        bearerToken: '',
      }),
    )
  })

  await routeAdminKpiConfigSurfaceApi(page)
})

test('admin KPI config renders on AdminSurface primitives without legacy remnants', async ({ page }, testInfo) => {
  await page.goto('/admin/kpi-config')

  await expect(page.getByRole('heading', { name: 'KPI ayarları' })).toBeVisible()
  await expect(page.locator(legacySelectors)).toHaveCount(0)
  await expect(page.locator('[data-testid^="admin-metric-"]')).toHaveCount(0)
  await expect(page.getByRole('tab')).toHaveCount(5)
  await expect(page.getByRole('group', { name: /Mağaza puan ağırlıkları .* TARGET_ACHIEVEMENT/ })).toBeVisible()
  await expect(page.getByText('Hedef gerçekleşme', { exact: true })).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Görünen ad' })).toHaveCount(0)
  await expect(page.getByRole('group', { name: /Personel puan ağırlıkları .* TARGET_ACHIEVEMENT/ })).toHaveCount(0)
  await expect(page.locator('body')).not.toContainText('/admin/kpi-config')
  await expect(page.locator('body')).not.toContainText('ops.kpi_score_profile_config')
  await expect(page.locator('body')).not.toContainText('korelasyon')

  await page.setViewportSize({ width: 390, height: 844 })
  await page.reload()

  await expect(page.locator(legacySelectors)).toHaveCount(0)
  const hasNoHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
  )
  expect(hasNoHorizontalOverflow).toBe(true)
  for (const viewport of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }, { width: 390, height: 844 }, { width: 360, height: 800 }]) {
    await page.setViewportSize(viewport)
    await expect(page.getByRole('heading', { name: 'KPI ayarları' })).toBeVisible()
    await page.evaluate(() => document.fonts.ready)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`kpi-settings-${viewport.width}x${viewport.height}.png`), fullPage: true, animations: 'disabled' })
  }
})

for (const viewport of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }, { width: 390, height: 844 }, { width: 360, height: 800 }]) {
  test(`seven KPI settings remain bounded and usable at ${viewport.width}x${viewport.height}`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport)
    const denseConfig = { ...publishedConfig, storeProfile: { ...publishedConfig.storeProfile, metrics: [
      { ...publishedConfig.storeProfile.metrics[0], weightPercent: 35 },
      { ...publishedConfig.storeProfile.metrics[0], code: 'CR', label: 'CR', weightPercent: 20 },
      { ...publishedConfig.storeProfile.metrics[1], code: 'ATV', label: 'ATV', weightPercent: 15 },
      { ...publishedConfig.storeProfile.metrics[1], weightPercent: 15 },
      { ...publishedConfig.storeProfile.metrics[0], code: 'BM_CHECKLIST', label: 'BM Checklist', weightPercent: 5 },
      { ...publishedConfig.storeProfile.metrics[0], code: 'VM_CHECKLIST', label: 'VM Checklist', weightPercent: 5 },
      { ...publishedConfig.storeProfile.metrics[1], code: 'gsm_approval', label: 'GSM Onayı', weightPercent: 5 },
    ] } }
    await page.route('**/api/reports/kpi-config/editor', route => route.fulfill({ json: {
      ...kpiConfigEditorFixture, draftConfig: denseConfig, publishedConfig: denseConfig,
    } }))
    await page.route('**/api/reports/kpi-config', route => route.fulfill({ json: { ...kpiConfigEditorFixture, draftConfig: denseConfig, publishedConfig: denseConfig } }))
    await page.goto('/admin/kpi-config')
    await expect(page.getByRole('heading', { name: 'KPI ayarları' })).toBeVisible()
    await expect(page.getByText('Görsel düzen kontrol listesi', { exact: true })).toBeVisible()
    await page.evaluate(() => document.fonts.ready)
    const dimensions = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight, clientWidth: document.documentElement.clientWidth }))
    expect(dimensions.width).toBeLessThanOrEqual(dimensions.clientWidth)
    expect(dimensions.height).toBeLessThan(1400)
    const save = page.getByRole('button', { name: 'Taslağı kaydet' })
    const saveBox = await save.boundingBox()
    expect(saveBox?.y).toBeLessThan(viewport.height)
    expect(saveBox?.height).toBeGreaterThanOrEqual(44)
    const feedbackBox = await page.getByRole('button', { name: 'Pilot feedback' }).boundingBox()
    const publishBox = await page.getByRole('button', { name: 'Ayarları yayınla' }).boundingBox()
    expect(feedbackBox!.y + feedbackBox!.height).toBeLessThan(publishBox!.y)
    await page.screenshot({ path: testInfo.outputPath(`kpi-settings-dense-${viewport.width}x${viewport.height}.png`), fullPage: true, animations: 'disabled' })
    await page.getByRole('group', { name: /Mağaza puan ağırlıkları .* CR/ }).getByRole('button').first().click()
    await expect(page.getByRole('textbox', { name: 'Görünen ad' })).toHaveValue('CR')
    await page.screenshot({ path: testInfo.outputPath(`kpi-settings-editor-${viewport.width}x${viewport.height}.png`), fullPage: true, animations: 'disabled' })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
    await page.getByRole('tab', { name: 'Sorumlular', exact: true }).click()
    await page.getByRole('group', { name: 'KPI sorumluları: TARGET_ACHIEVEMENT' }).getByRole('button').first().click()
    for (const role of ['Genel müdür yardımcısı', 'Bölge müdürü', 'Mağaza müdürü', 'Mağaza personeli', 'Görsel ekip']) {
      await expect(page.getByRole('checkbox', { name: role, exact: true })).toBeVisible()
    }
    await expect(page.getByRole('checkbox', { name: 'Mağaza müdürü', exact: true })).toBeChecked()
    await expect(page.getByRole('checkbox', { name: 'Mağaza personeli', exact: true })).toBeChecked()
    await page.getByRole('tab', { name: 'Puan aralıkları', exact: true }).click()
    await page.getByRole('group', { name: 'Puan aralıkları: A' }).getByRole('button').first().click()
    await expect(page.getByRole('spinbutton', { name: 'Alt puan sınırı' })).toHaveValue('1')
    await page.getByRole('tab', { name: 'Yayın ve geçmiş' }).click()
    await expect(page.getByText('v3')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Ayarlar yayınlandı' })).toBeVisible()
    await expect(page.getByRole('main')).not.toContainText('kpi_config.published')
    await page.screenshot({ path: testInfo.outputPath(`kpi-settings-publication-${viewport.width}x${viewport.height}.png`), fullPage: true, animations: 'disabled' })
    await save.click()
    const toast = page.getByText('Taslak kaydedildi', { exact: true })
    await expect(toast).toBeVisible()
    await expect.poll(async () => {
      const toastBox = await toast.boundingBox()
      const actionbarBox = await page.locator('.admin-kpi-settings-actionbar').boundingBox()
      return Boolean(toastBox && actionbarBox && toastBox.y + toastBox.height < actionbarBox.y)
    }).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`kpi-settings-toast-${viewport.width}x${viewport.height}.png`), fullPage: true, animations: 'disabled' })
  })
}

async function routeAdminKpiConfigSurfaceApi(page: Page) {
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({ json: authSessionFixture })
  })

  await page.route('**/api/reports/kpi-config/editor', async (route) => {
    await route.fulfill({ json: kpiConfigEditorFixture })
  })

  await page.route('**/api/reports/kpi-config/audit', async (route) => {
    await route.fulfill({
      json: {
        items: [
          {
            eventLogId: 'event-1',
            eventType: 'kpi_config.published',
            actorUserId: 'admin',
            occurredAt: '2026-05-20T08:00:00.000Z',
            correlationId: 'correlation-hidden',
            metadata: {
              storeMetricCount: 2,
              personnelMetricCount: 2,
              ownershipRowCount: 1,
              diffSummary: {
                storeProfile: { added: [], removed: [], changed: ['UPT'] },
                personnelProfile: { added: [], removed: [], changed: [] },
                ownershipMatrix: { added: [], removed: [], changed: [] },
                gradingBands: { added: [], removed: [], changed: [] },
              },
            },
          },
        ],
        meta: { count: 1, total: 1, limit: 20, offset: 0 },
      },
    })
  })
}

const authSessionFixture = {
  authMode: 'mock',
  authenticated: true,
  user: {
    userId: 'super-admin-kpi-surface-user',
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
        weightPercent: 50,
        ownerRole: 'STORE_PERSONNEL',
        scoreBehavior: 'score_only',
      },
      {
        code: 'UPT',
        label: 'Units Per Ticket',
        weightPercent: 50,
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
  ],
}

const kpiConfigEditorFixture = {
  draftConfig: publishedConfig,
  publishedConfig,
  hasUnpublishedChanges: false,
  latestPublishedVersion: {
    kpiConfigVersionId: '33333333-3333-4333-8333-333333333333',
    versionNo: 3,
    effectiveFrom: '2026-04-26T00:00:00.000Z',
    effectiveTo: null,
    publishedAt: '2026-04-26T08:00:00.000Z',
    publishedBy: 'super-admin-kpi-surface-user',
  },
}
