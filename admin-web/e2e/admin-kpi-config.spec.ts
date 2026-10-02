import { expect, test, type Page } from './test-fixtures'
import { setStoredLocale } from './locale-test-utils'
import { installGenericStoreApiFallbacks } from './store-page-contract-fixtures'
import { rankingsPrivilegedDetailFixture } from './store-surfaces-ranking-fixtures'

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

  await page.getByRole('tab', { name: 'Yayın ve geçmiş' }).click()
  await expect(page.getByRole('heading', { name: 'Yayın öncesi kontrol' })).toBeVisible()
  await expect(page.getByLabel('Yayın kontrolü')).toBeVisible()
  await expect(page.getByText('Sıralamalar yayınlanan ayarı kullanır. Taslak değişiklikleri yayınlanana kadar uygulanmaz.')).toBeVisible()
  await expect(page.getByText('Mağaza profil farkı')).toBeVisible()
  await expect(page.getByText('1 eklendi, 1 değişti, 0 kaldırıldı')).toBeVisible()
  await expect(page.getByText('Puanlama farkı')).toBeVisible()
  await expect(page.getByText('0 eklendi, 1 değişti, 0 kaldırıldı')).toBeVisible()
  await expect(page.getByText('Sürüm takibi')).toBeVisible()
  await expect(page.getByText('Aktif', { exact: true })).toBeVisible()
  await expect(page.getByText('Son sürüm')).toBeVisible()
  await expect(page.getByText('v3')).toBeVisible()
  await expect(page.getByText('Raporların sürümü', { exact: true })).toBeVisible()
  await expect(
    page.getByText('Yeni raporlar oluşturuldukları ayar sürümünü korur. Önceki raporlar okunabilir.'),
  ).toBeVisible()
  await expect(page.getByText('Publish decision preview')).toHaveCount(0)
  await expect(page.locator('body')).not.toContainText('Ã')
  await expect(page.locator('body')).not.toContainText('Ä')
  await expect(page.locator('body')).not.toContainText('Å')

  await setStoredLocale(page, 'en')
  await page.getByRole('tab', { name: 'Publication' }).click()

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('heading', { name: 'Publish decision preview' })).toBeVisible()
  await expect(page.getByLabel('Governance preview')).toBeVisible()
  await expect(
    page.getByText('Draft is saved for review; rankings and live KPI interpretation use the published config.'),
  ).toBeVisible()
  await expect(page.getByText('Store profile diff')).toBeVisible()
  await expect(page.getByText('Grading diff')).toBeVisible()
  await expect(page.getByText('Review before publish')).toBeVisible()
  await expect(page.getByText('Versioned schema')).toBeVisible()
  await expect(page.getByText('Active', { exact: true })).toBeVisible()
  await expect(page.getByText('Latest version')).toBeVisible()
  await expect(
    page.getByText('Snapshot anchoring is active for new runs; pre-governance snapshots remain readable.'),
  ).toBeVisible()
  await expect(page.getByText('Yayın öncesi kontrol')).toHaveCount(0)

  await page.reload()
  await page.getByRole('tab', { name: 'Publication' }).click()

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

  const targetMetric = metricEditorRow(page, 'Store Score', 'TARGET_ACHIEVEMENT')
  const uptMetric = metricEditorRow(page, 'Store Score', 'UPT')
  await targetMetric.getByRole('button').first().click()
  await uptMetric.getByRole('button').first().click()

  await targetMetric.getByLabel('Görünen ad').fill('HG skoru')
  await expect(targetMetric.getByLabel('Görünen ad')).toHaveValue('HG skoru')

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
  await setStoredLocale(page, 'en')

  const targetMetric = metricEditorRow(page, 'Store Score', 'TARGET_ACHIEVEMENT')
  const uptMetric = metricEditorRow(page, 'Store Score', 'UPT')
  await targetMetric.getByRole('button').first().click()
  await uptMetric.getByRole('button').first().click()
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

test('admin KPI config labels repeated editor rows and actions with row context', async ({ page }) => {
  await page.goto('/admin/kpi-config')
  await setStoredLocale(page, 'en')
  const target = metricEditorRow(page, 'Store Score', 'TARGET_ACHIEVEMENT')
  await expect(target).toBeVisible()
  await target.getByRole('button').first().click()
  await expect(page.getByRole('button', { name: 'Remove metric: Store score weights TARGET_ACHIEVEMENT' })).toBeVisible()

  await page.getByRole('tab', { name: 'Personnel', exact: true }).click()
  const personnel = metricEditorRow(page, 'Personnel Score', 'TARGET_ACHIEVEMENT')
  await expect(personnel).toBeVisible()
  await personnel.getByRole('button').first().click()
  await expect(page.getByRole('button', { name: 'Remove metric: Personnel score weights TARGET_ACHIEVEMENT' })).toBeVisible()

  await page.getByRole('tab', { name: 'Owners', exact: true }).click()
  const owner = page.getByRole('group', { name: 'Ownership Matrix: TARGET_ACHIEVEMENT' })
  await owner.getByRole('button').first().click()
  await expect(page.getByRole('button', { name: 'Remove row: TARGET_ACHIEVEMENT' })).toBeVisible()

  await page.getByRole('tab', { name: 'Grading', exact: true }).click()
  const band = page.getByRole('group', { name: 'Grading Bands: A' })
  await band.getByRole('button').first().click()
  await expect(page.getByRole('button', { name: 'Remove band: A' })).toBeVisible()

  await page.setViewportSize({ width: 390, height: 844 })
  await page.reload()
  const mobileTarget = metricEditorRow(page, 'Store Score', 'TARGET_ACHIEVEMENT')
  await expect(mobileTarget).toBeVisible()
  await mobileTarget.getByRole('button').first().click()
  await expect(page.getByRole('button', { name: 'Remove metric: Store score weights TARGET_ACHIEVEMENT' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
})

test('admin KPI edits survive section changes and keep serialized role and profile values', async ({ page }) => {
  let savedConfig: typeof draftConfig | null = null
  await page.route('**/api/reports/kpi-config', route => {
    savedConfig = route.request().postDataJSON()
    return route.fulfill({ json: { ...kpiConfigEditorFixture, draftConfig: savedConfig } })
  })
  await page.goto('/admin/kpi-config')
  const store = metricEditorRow(page, 'Store Score', 'TARGET_ACHIEVEMENT')
  await store.getByRole('button').first().click()
  await store.getByLabel('Alternatif adlar').fill('STORE_SALES, SALES_TARGET_ACHIEVEMENT')
  await store.getByRole('combobox', { name: 'Sorumlu', exact: true }).click()
  await page.getByRole('option', { name: 'Bölge müdürü', exact: true }).click()
  await store.getByRole('combobox', { name: 'Puanın kullanım şekli' }).click()
  await page.getByRole('option', { name: 'Yalnızca puanlama' }).click()

  await page.getByRole('tab', { name: 'Personel', exact: true }).click()
  const personnel = metricEditorRow(page, 'Personnel Score', 'TARGET_ACHIEVEMENT')
  await personnel.getByRole('button').first().click()
  await personnel.getByLabel('Notlar').fill('Personel notu')

  await page.getByRole('tab', { name: 'Sorumlular', exact: true }).click()
  const ownership = page.getByRole('group', { name: 'KPI sorumluları: TARGET_ACHIEVEMENT' })
  await ownership.getByRole('button').first().click()
  await ownership.getByRole('combobox', { name: 'Sorumlu', exact: true }).click()
  await page.getByRole('option', { name: 'Bölge müdürü', exact: true }).click()
  await ownership.getByRole('checkbox', { name: 'Bölge müdürü', exact: true }).check()
  await ownership.getByRole('checkbox', { name: 'Mağaza personeli', exact: true }).uncheck()
  await ownership.getByRole('checkbox', { name: 'Personel', exact: true }).uncheck()
  await ownership.getByRole('combobox', { name: 'Görev adayı' }).click()
  await page.getByRole('option', { name: 'Hayır', exact: true }).click()

  await page.getByRole('tab', { name: 'Puan aralıkları', exact: true }).click()
  const band = page.getByRole('group', { name: 'Puan aralıkları: B' })
  await band.getByRole('button').first().click()
  await band.getByLabel('Görünen ad').fill('İyi düzey')
  await band.getByLabel('Emoji').fill('🙂')
  await band.getByRole('spinbutton', { name: 'Alt puan sınırı' }).fill('0.9')
  await band.getByRole('combobox', { name: 'Durum rengi' }).click()
  await page.getByRole('option', { name: 'Nötr', exact: true }).click()

  await page.getByRole('tab', { name: 'Mağaza', exact: true }).click()
  const returnedStore = metricEditorRow(page, 'Store Score', 'TARGET_ACHIEVEMENT')
  await returnedStore.getByRole('button').first().click()
  await expect(returnedStore.getByLabel('Görünen ad')).toHaveValue('Target Achievement')
  await expect(returnedStore.getByRole('combobox', { name: 'Sorumlu', exact: true })).toContainText('Bölge müdürü')
  await returnedStore.getByLabel('Kod', { exact: true }).fill('TARGET_REVIEWED')
  const renamed = metricEditorRow(page, 'Store Score', 'TARGET_REVIEWED')
  await expect(renamed.getByLabel('Kod', { exact: true })).toBeFocused()
  await expect(renamed.getByLabel('Alternatif adlar')).toHaveValue('STORE_SALES, SALES_TARGET_ACHIEVEMENT')
  await page.getByRole('button', { name: 'Taslağı kaydet' }).click()
  await expect.poll(() => savedConfig?.storeProfile.metrics[0].code).toBe('TARGET_REVIEWED')
  expect(savedConfig).toEqual({
    ...draftConfig,
    storeProfile: { ...draftConfig.storeProfile, metrics: [
      { ...draftConfig.storeProfile.metrics[0], code: 'TARGET_REVIEWED', aliases: ['STORE_SALES', 'SALES_TARGET_ACHIEVEMENT'], ownerRole: 'REGION_MANAGER', scoreBehavior: 'score_only' },
      ...draftConfig.storeProfile.metrics.slice(1),
    ] },
    personnelProfile: { ...draftConfig.personnelProfile, metrics: [
      { ...draftConfig.personnelProfile.metrics[0], notes: 'Personel notu' },
      ...draftConfig.personnelProfile.metrics.slice(1),
    ] },
    ownershipMatrix: [{ ...draftConfig.ownershipMatrix[0], operationalOwner: 'REGION_MANAGER', visibleTo: ['STORE_MANAGER', 'REGION_MANAGER'], contributesTo: ['store'], taskCandidate: false }],
    gradingBands: [draftConfig.gradingBands[0], { ...draftConfig.gradingBands[1], label: 'İyi düzey', emoji: '🙂', tone: 'neutral', minScore: 0.9 }, draftConfig.gradingBands[2]],
  })
})

test('admin KPI settings keep add and remove controls reachable in every section', async ({ page }) => {
  await page.goto('/admin/kpi-config')
  for (const section of [
    { tab: 'Mağaza', add: 'KPI ekle', remove: 'KPI’ı kaldır', context: 'Mağaza puan ağırlıkları' },
    { tab: 'Personel', add: 'KPI ekle', remove: 'KPI’ı kaldır', context: 'Personel puan ağırlıkları' },
    { tab: 'Sorumlular', add: 'Sorumluluk ekle', remove: 'Satırı kaldır', context: 'KPI sorumluları' },
    { tab: 'Puan aralıkları', add: 'Puan aralığı ekle', remove: 'Aralığı kaldır', context: 'Puan aralıkları' },
  ]) {
    await page.getByRole('tab', { name: section.tab, exact: true }).click()
    const rows = page.getByRole('group', { name: new RegExp(`^${section.context}`) })
    const count = await rows.count()
    await page.getByRole('button', { name: section.add, exact: true }).click()
    await expect(rows).toHaveCount(count + 1)
    const added = rows.last()
    await expect(added.getByLabel('Kod', { exact: true })).toHaveValue('')
    await added.getByRole('button', { name: new RegExp(`^${section.remove}`) }).click()
    await expect(rows).toHaveCount(count)
  }
  await expect(page.getByRole('button', { name: 'Taslağı kaydet' })).toBeEnabled()
})

test('admin KPI settings support keyboard navigation and recover from a load failure', async ({ page }) => {
  let failed = true
  await page.route('**/api/reports/kpi-config/editor', route => route.fulfill(failed
    ? { status: 500, json: { message: 'Request failed' } }
    : { json: kpiConfigEditorFixture }))
  await page.goto('/admin/kpi-config')
  await expect(page.getByRole('heading', { name: 'KPI ayarı kullanılamıyor' })).toBeVisible()
  await expect(page.getByText('KPI ayarları alınamadı. Tekrar deneyin.')).toBeVisible()
  await expect(page.getByRole('main')).not.toContainText('Request failed')
  failed = false
  await page.getByRole('button', { name: 'Tekrar dene' }).click()
  await expect(page.getByRole('heading', { name: 'KPI ayarları' })).toBeVisible()
  const storeTab = page.getByRole('tab', { name: 'Mağaza', exact: true })
  await storeTab.focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('tab', { name: 'Personel', exact: true })).toHaveAttribute('aria-selected', 'true')
  const personnel = metricEditorRow(page, 'Personnel Score', 'TARGET_ACHIEVEMENT')
  await personnel.getByRole('button').first().focus()
  await page.keyboard.press('Enter')
  await expect(personnel.getByLabel('Görünen ad')).toBeVisible()
  await page.keyboard.press('Enter')
  await expect(personnel.getByLabel('Görünen ad')).toHaveCount(0)
})

test('admin KPI settings retain loading empty and audit failure states', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  let release: () => void = () => {}
  const pending = new Promise<void>(resolve => { release = resolve })
  const emptyConfig = {
    ...draftConfig,
    storeProfile: { ...draftConfig.storeProfile, metrics: [] },
    personnelProfile: { ...draftConfig.personnelProfile, metrics: [] },
    ownershipMatrix: [], gradingBands: [],
  }
  await page.route('**/api/reports/kpi-config/editor', async route => {
    await pending
    await route.fulfill({ json: { draftConfig: emptyConfig, publishedConfig: null, hasUnpublishedChanges: false, latestPublishedVersion: null } })
  })
  await page.route('**/api/reports/kpi-config/audit', route => route.fulfill({ status: 500, json: { message: 'internal SQL relation failure' } }))
  await page.goto('/admin/kpi-config')
  await expect(page.getByRole('heading', { name: 'KPI ayarı yükleniyor' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Taslağı kaydet' })).toHaveCount(0)
  await page.screenshot({ path: testInfo.outputPath('kpi-settings-loading-390x844.png') })
  release()
  await expect(page.getByText('Henüz KPI eklenmedi.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'KPI ekle', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Taslağı kaydet' })).toBeDisabled()
  await page.screenshot({ path: testInfo.outputPath('kpi-settings-empty-390x844.png') })
  await page.getByRole('tab', { name: 'Sorumlular', exact: true }).click()
  await expect(page.getByText('Henüz KPI sorumlusu eklenmedi.')).toBeVisible()
  await page.getByRole('tab', { name: 'Puan aralıkları', exact: true }).click()
  await expect(page.getByText('Henüz puan aralığı eklenmedi.')).toBeVisible()
  await page.getByRole('tab', { name: 'Yayın ve geçmiş' }).click()
  await expect(page.getByText('Yayınlanmış sürüm yok')).toBeVisible()
  await expect(page.getByText('Değişiklik geçmişi alınamadı.')).toBeVisible()
  await expect(page.getByRole('main')).not.toContainText('SQL')
  await page.screenshot({ path: testInfo.outputPath('kpi-settings-audit-error-390x844.png'), fullPage: true })
})

test('admin KPI settings preserve SUPER_ADMIN access and hide admin commands from HR_ADMIN', async ({ page }) => {
  let editorReads = 0
  await page.route('**/api/auth/session', route => route.fulfill({ json: {
    ...authSessionFixture, user: { ...authSessionFixture.user, roleCodes: ['HR_ADMIN'] },
  } }))
  await page.route('**/api/reports/kpi-config/editor', route => {
    editorReads += 1
    return route.fulfill({ json: kpiConfigEditorFixture })
  })
  await page.goto('/admin/kpi-config')
  await expect(page.getByText('Bu rol için rota kullanılamaz', { exact: true })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Mağaza', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Taslağı kaydet' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Ayarları yayınla' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'KPI Ayarları', exact: true })).toHaveCount(0)
  expect(editorReads).toBe(0)
})

test('publishing refreshes cached rankings without a page reload; a draft save does not', async ({ page }) => {
  await installGenericStoreApiFallbacks(page)
  let published = false
  let rankingReads = 0
  await page.route('**/api/reports/rankings**', async route => {
    rankingReads += 1
    await route.fulfill({ json: {
      ...rankingsPrivilegedDetailFixture,
      storeLeaderboard: {
        ...rankingsPrivilegedDetailFixture.storeLeaderboard,
        items: rankingsPrivilegedDetailFixture.storeLeaderboard.items.map(row => ({
          ...row, scoreValue: published ? 79 : 82,
        })),
      },
    } })
  })
  await page.route('**/api/reports/kpi-config', route => route.fulfill({ json: kpiConfigEditorFixture }))
  await page.route('**/api/reports/kpi-config/publish', async route => {
    published = true
    await route.fulfill({ json: { ...kpiConfigEditorFixture,
      publishedConfig: draftConfig, hasUnpublishedChanges: false } })
  })
  const rankingsPath = '/store/rankings?period=2026-04-01'
  // SPA navigation preserves the QueryClient; a document reload would hide this regression.
  const navigate = (path: string) => page.evaluate(destination => {
    window.history.pushState({}, '', destination)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }, path)
  const firstRow = () => page.getByTestId('store-rankings-page').locator('tbody tr').first()
  await page.goto(rankingsPath)
  await expect(firstRow()).toContainText('82')
  const readsBefore = rankingReads
  await navigate('/admin/kpi-config')
  await page.getByRole('button', { name: 'Taslağı kaydet' }).click()
  await expect(page.getByText('Taslak kaydedildi', { exact: true })).toBeVisible()
  await navigate(rankingsPath)
  await expect(firstRow()).toContainText('82')
  expect(rankingReads).toBe(readsBefore)
  await navigate('/admin/kpi-config')
  await page.getByRole('button', { name: 'Ayarları yayınla' }).click()
  await expect(page.getByText('Yayınlandı', { exact: true })).toBeVisible()
  await navigate(rankingsPath)
  await expect(firstRow()).toContainText('79')
  expect(rankingReads).toBeGreaterThan(readsBefore)
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

function metricEditorRow(page: Page, profileTitle: string, code: string) {
  const title = profileTitle === 'Store Score' ? '(Mağaza puan ağırlıkları|Store score weights)' : '(Personel puan ağırlıkları|Personnel score weights)'
  return page.getByRole('group', { name: new RegExp(`${title} .* ${code}`) }).first()
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
        direction: 'HIGHER_IS_BETTER',
        benchmarkSource: 'TARGET',
        capRatio: 1.2,
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
