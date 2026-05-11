import { expect, test, type Page } from '@playwright/test'

const demoStoreId = '00000000-0000-0000-0000-000000000100'
const demoEmployeeId = '00000000-0000-0000-0000-000000000202'
const demoPositionId = '44444444-4444-4444-8444-444444444444'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'store-ops-admin-session',
      JSON.stringify({
        mode: 'mock',
        mockUserId: 'store-me-smoke-user',
        mockRoleCodes: 'STORE_PERSONNEL',
        mockCompanyIds: '00000000-0000-0000-0000-000000000001',
        bearerToken: '',
      }),
    )
  })

  await routeStoreSurfaceApi(page)
})

test('store self-performance page renders live score, metrics, and ranks', async ({ page }) => {
  await page.goto('/store/me')

  await expect(page.locator('.store-me-v2-page')).toBeVisible()
  await expect(page.getByRole('heading', { name: /Store Personnel · IstinyePark Demo Store/i })).toBeVisible()
  await expect(page.getByText('Genel performans')).toBeVisible()
  await expect(page.getByText('Kişisel skor kartı')).toBeVisible()
  await expect(page.getByText('Mağaza', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('Bölge', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('Türkiye', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('Bugünkü koçluk')).toBeVisible()
  await expect(page.getByText('Gelişim çizgisi')).toBeVisible()
  await expect(page.getByRole('heading', { name: /Bugün tablo/i })).toBeVisible()
  await expect(page.getByText('Hedef gerçekleşme barı')).toBeVisible()
  await expect(page.getByText('Aynı gün kıyaslaması')).toBeVisible()
  await expect(page.getByRole('button', { name: /Tarih filtresi/i })).toBeVisible()
  await page.getByRole('button', { name: 'KPI detayları' }).click()
  const kpiDetailsDialog = page.getByRole('dialog', { name: /ay ay performansı/i })
  await expect(kpiDetailsDialog).toBeVisible()
  await expect(kpiDetailsDialog).toContainText('Nisan 2026')
  await expect(kpiDetailsDialog).toContainText('Mayıs 2026')
  await expect(kpiDetailsDialog).not.toContainText('CR')
  await expect(page.locator('.store-me-v2-metric-card')).toHaveCount(3)
  await expect(page.locator('.store-me-v2-metric-card').filter({ hasText: 'UPT' })).toBeVisible()
  await expect(page.locator('.store-me-v2-metric-card').filter({ hasText: 'ATV' })).toBeVisible()
  await expect(page.locator('.store-me-v2-metric-card').filter({ hasText: 'HG%' })).toBeVisible()
  await expect(page.locator('.store-metric-grid')).toHaveCount(0)
  await expect(page.locator('.stacked-row')).toHaveCount(0)
  await expect(page.locator('.store-hero-panel')).toHaveCount(0)
  await expect(page.locator('.store-me-score-card')).toHaveCount(0)
  await expect(page.locator('.store-me-action-panel')).toHaveCount(0)
  await expect(page.getByText('Skor yorumu')).toHaveCount(0)
  await expect(page.getByText('Veri kaynağı')).toHaveCount(0)
  await expect(page.getByText('Hedef bazlı skor')).toHaveCount(0)
  await expect(page.getByText('TARGET_ACHIEVEMENT')).toHaveCount(0)
  await expect(page.getByText('Weighted score')).toHaveCount(0)
  await expect(page.getByText('Turkey ranking')).toHaveCount(0)
  await expect(page.getByText('Store ranking')).toHaveCount(0)
  await expect(page.getByText('Resolved Session')).toHaveCount(0)
  await expect(page.getByText('Source mode')).toHaveCount(0)
  await expect(page.getByText('Snapshot run')).toHaveCount(0)
  await expect(page.getByText('Grade')).toHaveCount(0)
  await expect(page.getByText('Excellent')).toHaveCount(0)
  await expect(page.getByText('Pending')).toHaveCount(0)
  await expect(page.getByText('Missing')).toHaveCount(0)
  await expect(page.getByText('Route')).toHaveCount(0)
  await expect(page.getByText('Persona')).toHaveCount(0)
  await expect(page.getByText('Benim performansim')).toHaveCount(0)
  await expect(page.getByText('Performans ozeti')).toHaveCount(0)
  await expect(page.getByText('Donem performansi')).toHaveCount(0)
  await expect(page.getByText('Turkiye siram')).toHaveCount(0)
  await expect(page.getByText('Magaza ici siram')).toHaveCount(0)
  await expect(page.getByText('Hedef girisi')).toHaveCount(0)
  await expect(page.getByText('Mukemmel')).toHaveCount(0)
  await expect(page.getByText('Veri guveni')).toHaveCount(0)
  await expect(page.getByText('Veri kaynagi')).toHaveCount(0)
  await expect(page.getByText('Gerceklesen')).toHaveCount(0)
  await expect(page.getByText('Basari')).toHaveCount(0)
  await expect(page.getByText('Performans yüzeyi açılamadı')).toHaveCount(0)
})

test('store self-performance tolerates ISO period timestamps from live API', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', (error) => {
    pageErrors.push(error.message)
  })
  const availablePeriods = [
    {
      periodType: 'monthly',
      periodStart: '2026-04-01T00:00:00.000Z',
      periodEnd: '2026-04-30T00:00:00.000Z',
    },
    {
      periodType: 'monthly',
      periodStart: '2026-05-01T00:00:00.000Z',
      periodEnd: '2026-05-31T00:00:00.000Z',
    },
  ]
  const isoAprilFixture = {
    ...myPerformanceFixture,
    period: {
      periodStart: '2026-04-01T00:00:00.000Z',
      periodEnd: '2026-04-30T00:00:00.000Z',
    },
    availablePeriods,
  }
  const isoMayFixture = {
    ...myPerformanceMayFixture,
    period: {
      periodStart: '2026-05-01T00:00:00.000Z',
      periodEnd: '2026-05-31T00:00:00.000Z',
    },
    availablePeriods,
  }

  await page.unroute('**/api/reports/my-performance**')
  await page.route('**/api/reports/my-performance**', async (route) => {
    const requestUrl = new URL(route.request().url())
    await route.fulfill({
      json: requestUrl.searchParams.get('periodStart')?.startsWith('2026-05-01')
        ? isoMayFixture
        : isoAprilFixture,
    })
  })

  await page.goto('/store/me')

  await expect(page.locator('.store-me-v2-page')).toBeVisible()
  await page.getByRole('button', { name: /KPI detayları/i }).click()
  const kpiDetailsDialog = page.getByRole('dialog', { name: /ay ay performansı/i })
  await expect(kpiDetailsDialog).toBeVisible()
  await expect(kpiDetailsDialog).toContainText('Nisan 2026')
  await expect(kpiDetailsDialog).toContainText('Mayıs 2026')
  expect(pageErrors).toEqual([])
})

test('store self-performance switches to English copy and persists locale', async ({ page }) => {
  await page.goto('/store/me')

  await page.locator('.language-toggle-button').filter({ hasText: 'EN' }).click()

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.locator('.store-me-v2-page')).toBeVisible()
  await expect(page.getByRole('heading', { name: /Store Personnel · IstinyePark Demo Store/i })).toBeVisible()
  await expect(page.getByText('Overall performance')).toBeVisible()
  await expect(page.getByText('Personal score card')).toBeVisible()
  await expect(page.getByText("Today's coaching")).toBeVisible()
  await expect(page.getByText('Progress line')).toBeVisible()
  await expect(page.getByText('Target achievement bar')).toBeVisible()
  await expect(page.getByText('Same-day comparison')).toBeVisible()
  await expect(page.getByText('Score meaning')).toHaveCount(0)
  await expect(page.getByText('Data source')).toHaveCount(0)
  await expect(page.getByText('Target-based score')).toHaveCount(0)
  await expect(page.getByText('Actual')).toBeVisible()
  await expect(page.getByText('Achievement', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Benim performansım')).toHaveCount(0)
  await expect(page.getByText('Performans özeti')).toHaveCount(0)
  await expect(page.locator('body')).not.toContainText('Ã')
  await expect(page.locator('body')).not.toContainText('Ä')
  await expect(page.locator('body')).not.toContainText('Å')

  await page.reload()

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.locator('.store-me-v2-page')).toBeVisible()
})

test('store self-performance handles live no-data responses without supporting metadata', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', (error) => {
    pageErrors.push(error.message)
  })

  const myPerformanceWithoutSupporting: Record<string, unknown> = {
    ...myPerformanceFixture,
    employee: {
      employeeId: demoEmployeeId,
      displayName: 'Unknown employee',
      storeId: null,
      storeName: null,
    },
    period: null,
    score: {
      value: 0,
      matchedMetrics: 0,
      totalMetrics: 3,
    },
    rankings: {
      turkeyRank: null,
      turkeyPopulation: 0,
      storeRank: null,
      storePopulation: 0,
    },
    availablePeriods: [],
    partial: {
      isPartial: true,
      missingMetricCodes: ['TARGET_ACHIEVEMENT', 'ATV', 'UPT'],
      missingMetricLabels: ['Target Achievement', 'Average Ticket Value', 'Units Per Ticket'],
      pendingNormalizationCodes: [],
      pendingNormalizationLabels: [],
    },
    metrics: [
      {
        code: 'TARGET_ACHIEVEMENT',
        label: 'Target Achievement',
        weightPercent: 40,
        actualValue: null,
        contributionValue: 0,
        dataStatus: 'missing',
        scoreStatus: 'missing',
        status: 'missing',
      },
      {
        code: 'ATV',
        label: 'Average Ticket Value',
        weightPercent: 30,
        actualValue: null,
        contributionValue: 0,
        dataStatus: 'missing',
        scoreStatus: 'missing',
        status: 'missing',
      },
      {
        code: 'UPT',
        label: 'Units Per Ticket',
        weightPercent: 30,
        actualValue: null,
        contributionValue: 0,
        dataStatus: 'missing',
        scoreStatus: 'missing',
        status: 'missing',
      },
    ],
  }
  delete myPerformanceWithoutSupporting.supporting

  await page.unroute('**/api/reports/my-performance**')
  await page.route('**/api/reports/my-performance**', async (route) => {
    await route.fulfill({ json: myPerformanceWithoutSupporting })
  })

  await page.goto('/store/me')

  await expect(page.locator('.store-me-v2-page')).toBeVisible()
  await expect(page.getByText('Eksik veri var')).toBeVisible()
  await expect(page.getByText('Bu skor şu an kısmi veriyle hesaplanıyor')).toBeVisible()
  await expect(page.getByText('Performans yüzeyi açılamadı')).toHaveCount(0)
  expect(pageErrors).toEqual([])
})

test('store self-performance closed mode uses readable snapshot labels', async ({ page }) => {
  await page.goto('/store/me')
  await page.getByRole('button', { name: /Tarih filtresi/i }).click()
  await page.getByRole('button', { name: 'Kapanmış gün' }).click()

  await expect(
    page.getByRole('option', {
      name: /24 Nis 2026 kapanışı/,
    }),
  ).toBeAttached()
})

test('store KPI highlights page explains metric source semantics', async ({ page }) => {
  await page.goto('/store/kpis')

  await expect(page.getByRole('heading', { name: "Mağaza KPI'ları" })).toBeVisible()
  await expect(page.getByText('Mağaza skor özeti')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'KPI satırları', exact: true })).toBeVisible()
  await expect(page.getByText('İzlenecek KPI')).toBeVisible()
  await expect(page.getByText('Mağaza skor yorumu')).toBeVisible()
  await expect(page.getByText('Güçlü mağaza skoru')).toBeVisible()
  await expect(page.getByText("Aksiyon: ritmi koru; düşük katkılı ilk KPI'yi günlük izle.")).toBeVisible()
  await expect(page.getByText('Skor güveni: 100% ağırlık kapsandı.')).toBeVisible()
  await expect(page.getByText('BM checklist durumu')).toBeVisible()
  await expect(page.getByText('BM checklist: bu dönem skora dahil edilmedi')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Mağaza skor kaynakları' })).toBeVisible()
  await expect(page.getByText('Satış hedefi girilen hedeften; CR, ATV ve UPT Türkiye ortalamasından puanlanır.')).toBeVisible()
  await expect(page.getByText('BM ve VM checklist tamamlanan aylık ziyaret varsa küçük ağırlıkla skora katılır.')).toBeVisible()
  await expect(page.getByText('Gerçek oran %120 üzerinde olsa da skor katkısı %120 cap ile hesaplanır.')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Skor kırılımı' })).toBeVisible()
  await expect(page.getByText('Tam', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('Veri kaynağı').first()).toBeVisible()
  await expect(page.getByText('Hedef bazlı skor').first()).toBeVisible()
  await expect(page.getByText('Operasyon verisi').first()).toBeVisible()
  await expect(page.getByText('Store KPI Highlights')).toHaveCount(0)
  await expect(page.getByText('Store skor yorumu')).toHaveCount(0)
  await expect(page.getByText('Weighted Score Summary')).toHaveCount(0)
  await expect(page.getByText('Current Context')).toHaveCount(0)
  await expect(page.getByText('Top Signal')).toHaveCount(0)
  await expect(page.getByText('Ownership Matrix')).toHaveCount(0)
  await expect(page.getByText('Priority Follow-Up')).toHaveCount(0)
  await expect(page.getByText('Needs attention')).toHaveCount(0)
  await expect(page.getByText('Configured blend')).toHaveCount(0)
  await expect(page.getByText('Effective blend')).toHaveCount(0)
  await expect(page.getByText('KPI rows unavailable')).toHaveCount(0)
})

test('store KPI highlights switches to English copy and persists locale', async ({ page }) => {
  await page.goto('/store/kpis')

  await page.locator('.language-toggle-button').filter({ hasText: 'EN' }).click()

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('heading', { name: 'Store KPIs' })).toBeVisible()
  await expect(page.getByText('Store score summary')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Score breakdown' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'KPI rows', exact: true })).toBeVisible()
  await expect(page.getByText('KPIs to watch')).toBeVisible()
  await expect(page.getByText('Store score meaning')).toBeVisible()
  await expect(page.getByText('Strong store score')).toBeVisible()
  await expect(page.getByText('Action: keep the rhythm; watch the first low-contribution KPI daily.')).toBeVisible()
  await expect(page.getByText('Score confidence: 100% weight covered.')).toBeVisible()
  await expect(page.getByText('BM checklist status')).toBeVisible()
  await expect(page.getByText('BM checklist: not included in score this period')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Store score sources' })).toBeVisible()
  await expect(page.getByText('Target-based score').first()).toBeVisible()
  await expect(page.getByText('Operational data').first()).toBeVisible()
  await expect(page.getByText("Mağaza KPI'ları")).toHaveCount(0)
  await expect(page.getByText('Mağaza skor özeti')).toHaveCount(0)
  await expect(page.locator('body')).not.toContainText('Ãƒ')
  await expect(page.locator('body')).not.toContainText('Ã„')
  await expect(page.locator('body')).not.toContainText('Ã…')

  await page.reload()

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('heading', { name: 'Store KPIs' })).toBeVisible()
})

test('store shell exposes Turkish-first chrome and hides technical auth roles', async ({ page }) => {
  await page.goto('/store')

  await expect(page.getByRole('main', { name: 'Mağaza çalışma alanı' })).toBeVisible()
  await expect(page.getByRole('heading', { name: /Mağaza kapsamlı işler için/i })).toBeVisible()
  await expect(page.getByText('Ön izleme', { exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Yarışmalar' })).toBeVisible()
  await expect(page.locator('body')).not.toContainText('STORE_PERSONNEL')
  await expect(page.locator('body')).not.toContainText('STORE_MANAGER')
  await expect(page.getByText('offline_access')).toHaveCount(0)
  await expect(page.getByText('uma_authorization')).toHaveCount(0)
  await expect(page.getByText('default-roles-store-ops')).toHaveCount(0)
  await expect(page.getByText('Task-first preview for store-scoped work.')).toHaveCount(0)
})

test('store home switches to English copy and persists locale', async ({ page }) => {
  await page.goto('/store')

  await page.locator('.language-toggle-button').filter({ hasText: 'EN' }).click()

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('heading', { name: /Task-focused home page/i })).toBeVisible()
  await expect(page.getByText('Store home Phase 1')).toBeVisible()
  await expect(page.getByText('Pinned announcements')).toBeVisible()
  await expect(page.getByRole('link', { name: 'All announcements' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'My performance' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Rankings' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Store approvals' })).toBeVisible()
  await expect(page.getByText('Mağaza alanı')).toHaveCount(0)
  await expect(page.getByText('Mağaza ana sayfa Faz 1')).toHaveCount(0)
  await expect(page.getByText('Benim performansim')).toHaveCount(0)
  await expect(page.getByText('Siralamalar')).toHaveCount(0)
  await expect(page.locator('body')).not.toContainText('Ãƒ')
  await expect(page.locator('body')).not.toContainText('Ã„')
  await expect(page.locator('body')).not.toContainText('Ã…')

  await page.reload()

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('heading', { name: /Task-focused home page/i })).toBeVisible()
})

test('store rankings page renders Plum ranking table without signal chrome', async ({ page }) => {
  await page.goto('/store/rankings')

  await expect(page.getByRole('heading', { name: 'Sıralamalar' })).toBeVisible()
  await expect(
    page.getByRole('option', {
      name: /1 Nis 2026 - 30 Nis 2026/,
    }),
  ).toBeAttached()
  await expect(page.locator('.rankings-plum-page')).toBeVisible()
  await expect(page.getByText('Top 100 kapsam')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Mağaza listesi' })).toBeVisible()
  await expect(page.getByText('Mağaza skor')).toBeVisible()
  await expect(page.getByText('Sinyal')).toHaveCount(0)
  await expect(page.locator('.rankings-plum-trend')).toHaveCount(0)
  await page.getByRole('tab', { name: 'Personel listesi' }).click()
  await expect(page.getByRole('heading', { name: 'Personel listesi' })).toBeVisible()
  await expect(page.getByText('Store Personnel - 1').first()).toBeVisible()
  await expect(page.getByText('Personel skor')).toBeVisible()
  await expect(page.getByText('Sinyal')).toHaveCount(0)
  await expect(page.locator('.rankings-plum-trend')).toHaveCount(0)
  await expect(page.getByText('Magaza ve personel rankingleri')).toHaveCount(0)
  await expect(page.getByText('Top 100 gorunumu')).toHaveCount(0)
  await expect(page.getByText('Turkiye magaza siralamasi')).toHaveCount(0)
  await expect(page.getByText('Turkiye personel siralamasi')).toHaveCount(0)
  await expect(page.getByText('Kendi magaza sirasi')).toHaveCount(0)
  await expect(page.getByText('Kendi personel sirasi')).toHaveCount(0)
  await expect(page.getByText('Siralama yuzeyi acilamadi')).toHaveCount(0)
})

test('store rankings personnel detail opens the selected personnel performance profile', async ({ page }) => {
  const personnelPerformanceRequests: URL[] = []

  await page.unroute('**/api/auth/session')
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({
      json: {
        ...authSessionFixture,
        user: {
          ...authSessionFixture.user,
          userId: 'region-ranking-user',
          roleCodes: ['REGION_MANAGER'],
        },
      },
    })
  })

  await page.unroute('**/api/reports/rankings**')
  await page.route('**/api/reports/rankings**', async (route) => {
    await route.fulfill({
      json: {
        ...rankingsPrivilegedDetailFixture,
        personnelLeaderboard: {
          items: [personnelRankingDetailRow],
          currentEmployee: null,
          managedStorePersonnel: [],
          meta: {
            total: 1,
            limit: 100,
            offset: 0,
          },
        },
      },
    })
  })
  await page.unroute('**/api/reports/personnel-performance/**')
  await page.route('**/api/reports/personnel-performance/**', async (route) => {
    const requestUrl = new URL(route.request().url())
    personnelPerformanceRequests.push(requestUrl)
    await route.fulfill({
      json: {
        ...myPerformanceFixture,
        employee: {
          ...myPerformanceFixture.employee,
          employeeId: demoEmployeeId,
          displayName: 'Store Personnel - 1',
          storeName: 'IstinyePark Demo Store',
        },
      },
    })
  })

  await page.goto('/store/rankings')
  await page.getByRole('tab', { name: 'Personel listesi' }).click()
  await page.getByRole('button', { name: 'Store Personnel - 1' }).click()

  const drawer = page.locator('.rankings-plum-drawer')
  await expect(drawer).toBeVisible()
  await drawer.getByRole('button', { name: 'Detaya git' }).click()

  await expect(page).toHaveURL(new RegExp(`/store/personnel/${demoEmployeeId}\\?`))
  await expect.poll(() => new URL(page.url()).searchParams.get('mode')).toBe('live')
  await expect.poll(() => new URL(page.url()).searchParams.get('periodType')).toBe('monthly')
  await expect.poll(() => new URL(page.url()).searchParams.get('periodStart')).toBe('2026-04-01')
  await expect(page.locator('.store-me-v2-page')).toBeVisible()
  await expect(
    page.getByRole('heading', { name: /Store Personnel - 1 . IstinyePark Demo Store/i }),
  ).toBeVisible()
  await expect(page.locator('.store-me-v2-metric-card')).toHaveCount(3)
  await expect(page.locator('.store-me-v2-metric-card').filter({ hasText: 'CR' })).toHaveCount(0)
  await expect
    .poll(() =>
      personnelPerformanceRequests.some((requestUrl) => requestUrl.searchParams.get('periodStart') === '2026-04-01'),
    )
    .toBe(true)
})

test('store personnel profile falls back when ranking period has no personnel data', async ({ page }) => {
  const personnelPerformanceRequests: URL[] = []
  const aprilOnlyPeriods = [
    {
      periodType: 'monthly',
      periodStart: '2026-04-01',
      periodEnd: '2026-04-30',
    },
  ]
  const noMayPersonnelDataFixture = {
    ...myPerformanceFixture,
    employee: {
      employeeId: demoEmployeeId,
      displayName: 'Unknown employee',
      storeId: null,
      storeName: null,
    },
    period: null,
    score: {
      value: 0,
      matchedMetrics: 0,
      totalMetrics: 3,
    },
    availablePeriods: aprilOnlyPeriods,
    partial: {
      isPartial: true,
      missingMetricCodes: ['TARGET_ACHIEVEMENT', 'ATV', 'UPT'],
      missingMetricLabels: ['Target Achievement', 'Average Ticket Value', 'Units Per Ticket'],
      pendingNormalizationCodes: [],
      pendingNormalizationLabels: [],
    },
    metrics: myPerformanceFixture.metrics.map((metric) => ({
      ...metric,
      actualValue: null,
      contributionValue: 0,
      dataStatus: 'missing',
      scoreStatus: 'missing',
      status: 'missing',
    })),
  }

  await page.unroute('**/api/auth/session')
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({
      json: {
        ...authSessionFixture,
        user: {
          ...authSessionFixture.user,
          userId: 'region-ranking-user',
          roleCodes: ['REGION_MANAGER'],
        },
      },
    })
  })

  await page.unroute('**/api/reports/rankings**')
  await page.route('**/api/reports/rankings**', async (route) => {
    await route.fulfill({
      json: {
        ...rankingsPrivilegedDetailFixture,
        source: {
          ...rankingsPrivilegedDetailFixture.source,
          periodStart: '2026-05-01',
          periodEnd: '2026-05-31',
        },
        availablePeriods: [
          ...rankingsPrivilegedDetailFixture.availablePeriods,
          {
            periodType: 'monthly',
            periodStart: '2026-05-01',
            periodEnd: '2026-05-31',
          },
        ],
        personnelLeaderboard: {
          items: [personnelRankingDetailRow],
          currentEmployee: null,
          managedStorePersonnel: [],
          meta: {
            total: 1,
            limit: 100,
            offset: 0,
          },
        },
      },
    })
  })
  await page.unroute('**/api/reports/personnel-performance/**')
  await page.route('**/api/reports/personnel-performance/**', async (route) => {
    const requestUrl = new URL(route.request().url())
    personnelPerformanceRequests.push(requestUrl)

    if (requestUrl.searchParams.get('periodStart') === '2026-05-01') {
      await route.fulfill({ json: noMayPersonnelDataFixture })
      return
    }

    await route.fulfill({
      json: {
        ...myPerformanceFixture,
        availablePeriods: aprilOnlyPeriods,
        employee: {
          ...myPerformanceFixture.employee,
          employeeId: demoEmployeeId,
          displayName: 'Store Personnel - 1',
          storeName: 'IstinyePark Demo Store',
        },
      },
    })
  })

  await page.goto('/store/rankings')
  await page.getByRole('tab', { name: 'Personel listesi' }).click()
  await page.getByRole('button', { name: 'Store Personnel - 1' }).click()
  await page.locator('.rankings-plum-drawer').getByRole('button', { name: 'Detaya git' }).click()

  await expect.poll(() =>
    personnelPerformanceRequests.some((requestUrl) => requestUrl.searchParams.get('periodStart') === '2026-05-01'),
  ).toBe(true)
  await expect.poll(() =>
    personnelPerformanceRequests.some((requestUrl) => requestUrl.searchParams.get('periodStart') === '2026-04-01'),
  ).toBe(true)
  await expect(
    page.getByRole('heading', { name: /Store Personnel - 1 . IstinyePark Demo Store/i }),
  ).toBeVisible()
  await expect(page.getByText('Unknown employee')).toHaveCount(0)
})

test('store rankings page switches to English copy and persists locale', async ({ page }) => {
  await page.goto('/store/rankings')

  await page.locator('.language-toggle-button').filter({ hasText: 'EN' }).click()

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('heading', { name: 'Rankings' })).toBeVisible()
  await expect(
    page.getByRole('option', {
      name: /Apr 1, 2026 - Apr 30, 2026/,
    }),
  ).toBeAttached()
  await expect(page.locator('.rankings-plum-page')).toBeVisible()
  await expect(page.getByText('Top 100 scope')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Store list' })).toBeVisible()
  await page.getByRole('tab', { name: 'Personnel list' }).click()
  await expect(page.getByRole('heading', { name: 'Personnel list' })).toBeVisible()
  await expect(page.getByText('Mağaza ve personel sıralamaları')).toHaveCount(0)
  await expect(page.locator('body')).not.toContainText('Ã')
  await expect(page.locator('body')).not.toContainText('Ä')
  await expect(page.locator('body')).not.toContainText('Å')

  await page.reload()

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('heading', { name: 'Rankings' })).toBeVisible()
})

test('store rankings page explains monthly preview-only ranking', async ({ page }) => {
  await page.goto('/store/rankings')
  await page.getByLabel('Sıralama dönem seçimi').selectOption('2026-04-01')

  await expect(
    page.getByRole('option', {
      name: /1 Nis 2026 - 30 Nis 2026/,
    }),
  ).toBeAttached()
  await expect(page.getByLabel('Sıralama dönem seçimi')).toHaveValue('2026-04-01')
  await expect(page.getByText('Top 100 kapsam')).toBeVisible()
  await expect(
    page.getByText('Top 100 görünümünü, kendi mağaza ve personel konumunla birlikte takip et.'),
  ).toBeVisible()
  await expect(page.getByText('Global liste Top 100 ozet; kendi konumun ayrica gorunur.')).toHaveCount(0)
  await expect(page.getByText('Siralama yuzeyi acilamadi')).toHaveCount(0)
})

test('store rankings uses Turkey reference, checklist metrics, normalized HG, and backend sort params', async ({ page }) => {
  const rankingRequests: URL[] = []

  await page.unroute('**/api/auth/session')
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({
      json: {
        ...authSessionFixture,
        user: {
          ...authSessionFixture.user,
          userId: 'region-ranking-user',
          roleCodes: ['REGION_MANAGER'],
        },
      },
    })
  })

  await page.unroute('**/api/reports/rankings**')
  await page.route('**/api/reports/rankings**', async (route) => {
    const url = new URL(route.request().url())
    rankingRequests.push(url)
    const ascendingTargetSort =
      url.searchParams.get('sortKey') === 'TARGET_ACHIEVEMENT' &&
      url.searchParams.get('sortDirection') === 'asc'

    if (ascendingTargetSort) {
      await new Promise((resolve) => setTimeout(resolve, 250))
    }

    await route.fulfill({
      json: {
        ...rankingsPrivilegedDetailFixture,
        storeLeaderboard: {
          ...rankingsPrivilegedDetailFixture.storeLeaderboard,
          items: ascendingTargetSort
            ? [rankingsPrivilegedLowHgStoreRow]
            : [rankingsPrivilegedDetailStoreRow],
        },
      },
    })
  })

  await page.goto('/store/rankings')

  await expect(page.locator('.rankings-plum-reference-title')).toBeVisible()
  await expect(page.locator('.rankings-plum-reference-bar')).toContainText('Türkiye Referansı')
  await expect(page.locator('.rankings-plum-metric-heading')).not.toContainText('KPI')
  await expect(page.locator('td[data-label="KPI özeti"]')).toHaveCount(0)
  await expect(page.locator('td[data-label="KPI summary"]')).toHaveCount(0)
  await expect(page.locator('.rankings-plum-metric-sort-row')).toContainText('BM Checklist')
  await expect(page.locator('.rankings-plum-metric-sort-row')).toContainText('VM Checklist')
  await expect
    .poll(() =>
      page
        .locator('.rankings-plum-metric-sort-row')
        .first()
        .evaluate((element) =>
          getComputedStyle(element).gridTemplateColumns.split(' ').filter(Boolean).length,
        ),
    )
    .toBe(6)
  await expect(page.locator('.rankings-plum-metric-grid').first()).toContainText('371,09%')
  await expect(page.locator('.rankings-plum-metric-grid').first()).not.toContainText('371.088.457%')

  await page.locator('.rankings-plum-sort-button', { hasText: 'HG%' }).click()
  await page.locator('.rankings-plum-sort-button', { hasText: 'HG%' }).click()

  await expect(page.getByRole('button', { name: 'High HG Store' })).toBeVisible()
  await expect(page.getByText('Sıralama hazırlanıyor')).toHaveCount(0)
  await expect(page.getByText('Sıralama yüzeyi açılamadı')).toHaveCount(0)
  await expect.poll(() => rankingRequests.at(-1)?.searchParams.get('sortKey')).toBe('TARGET_ACHIEVEMENT')
  await expect.poll(() => rankingRequests.at(-1)?.searchParams.get('sortDirection')).toBe('asc')
  await expect(page.getByRole('button', { name: 'Low HG Store' })).toBeVisible()
})

test('store rankings removes signal chrome while preserving weighted score rows', async ({ page }) => {
  await page.unroute('**/api/auth/session')
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({
      json: {
        ...authSessionFixture,
        user: {
          ...authSessionFixture.user,
          userId: 'region-ranking-user',
          roleCodes: ['REGION_MANAGER'],
        },
      },
    })
  })

  await page.unroute('**/api/reports/rankings**')
  await page.route('**/api/reports/rankings**', async (route) => {
    await route.fulfill({
      json: {
        ...rankingsPrivilegedDetailFixture,
        storeLeaderboard: {
          ...rankingsPrivilegedDetailFixture.storeLeaderboard,
          items: [scoreDisplayLeaderStoreRow, scoreDisplayFollowerStoreRow],
          meta: {
            total: 2,
            limit: 100,
            offset: 0,
          },
        },
      },
    })
  })

  await page.goto('/store/rankings')

  const rows = page.locator('.rankings-plum-table tbody tr')
  await expect(rows.nth(0)).toContainText('Weighted Score Leader')
  await expect(rows.nth(0).locator('.rankings-plum-scorebar')).toContainText('112,30')
  await expect(rows.nth(1)).toContainText('Raw Delta Trap')
  await expect(rows.nth(1).locator('.rankings-plum-scorebar')).toContainText('104,20')
  await expect(page.getByText('Sinyal')).toHaveCount(0)
  await expect(page.locator('.rankings-plum-trend')).toHaveCount(0)

  await page.getByRole('button', { name: 'Weighted Score Leader' }).click()

  await expect(page.locator('.rankings-plum-drawer')).toBeVisible()
  await expect(page.locator('.rankings-plum-drawer')).not.toContainText('Detaya git')
  await expect(page.locator('.rankings-plum-drawer .rankings-plum-trend')).toHaveCount(0)
  await expect(page.locator('.rankings-plum-month-row')).toContainText('112,30')
})

test('store tasks page renders readable Turkish queue labels', async ({ page }) => {
  await page.goto('/store/tasks')

  await expect(page.getByRole('heading', { name: /Aksiyon gerektiren işler/i })).toBeVisible()
  await expect(page.getByText('Detay ozeti')).toHaveCount(0)
  await expect(page.getByText('Detay özeti')).toBeVisible()
  await expect(page.getByText('Zaman sinyali')).toBeVisible()
  await expect(page.getByText('Yükseltme', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Inbox governance signals').getByText('Yükseltme adayı')).toBeVisible()
  await expect(page.getByText('Kaynak aksiyonu')).toBeVisible()
  await expect(page.getByRole('link', { name: 'KPI detayına git' })).toBeVisible()
  await expect(page.getByText('Önce bakılması gereken işler.')).toBeVisible()
  await expect(page.getByText('Kuyruk bağlamı')).toBeVisible()
  await expect(page.getByText('Bugünün kuyruğu')).toBeVisible()
  await expect(page.getByText('İş tipi')).toBeVisible()
  await expect(page.getByText('Aksiyon zamanı')).toBeVisible()
  await expect(page.getByText('Görev', { exact: true })).toBeVisible()
  await expect(page.getByText('Sapmayı incele')).toBeVisible()
  await expect(page.locator('body')).not.toContainText('Ã')
  await expect(page.locator('body')).not.toContainText('Ä')
  await expect(page.locator('body')).not.toContainText('Å')
})

test('store tasks page switches to English copy and persists locale', async ({ page }) => {
  await page.goto('/store/tasks')

  await page.locator('.language-toggle-button').filter({ hasText: 'EN' }).click()

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('heading', { name: /Action-required work/i })).toBeVisible()
  await expect(page.getByText('Detail summary')).toBeVisible()
  await expect(page.getByText('Time signal')).toBeVisible()
  await expect(page.getByText('Escalation', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Inbox governance signals').getByText('Escalation candidate')).toBeVisible()
  await expect(page.getByText('Source action')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Go to KPI detail' })).toBeVisible()
  await expect(page.getByText('Work that should be reviewed first.')).toBeVisible()
  await expect(page.getByText('Queue context')).toBeVisible()
  await expect(page.getByText("Today's queue")).toBeVisible()
  await expect(page.getByText('Work type', { exact: true })).toBeVisible()
  await expect(page.getByText('Action time')).toBeVisible()
  await expect(page.getByText('Task', { exact: true })).toBeVisible()
  await expect(page.getByText('Review deviation')).toBeVisible()
  await expect(page.getByText('Aksiyon gerektiren işler')).toHaveCount(0)
  await expect(page.getByText('Detay özeti')).toHaveCount(0)
  await expect(page.locator('body')).not.toContainText('Ãƒ')
  await expect(page.locator('body')).not.toContainText('Ã„')
  await expect(page.locator('body')).not.toContainText('Ã…')

  await page.reload()

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('heading', { name: /Action-required work/i })).toBeVisible()
})

test('store incentives page switches to English copy and persists locale', async ({ page }) => {
  await page.goto('/store/incentives')

  await expect(page.getByRole('heading', { name: /Mağaza prim görünürlüğü/i })).toBeVisible()
  await expect(page.getByText('Prim görünümü')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Canlı ödeme' })).toBeVisible()
  await expect(page.getByText('Store Incentives')).toHaveCount(0)

  await page.locator('.language-toggle-button').filter({ hasText: 'EN' }).click()

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('heading', { name: /Store incentive visibility/i })).toBeVisible()
  await expect(page.getByText('Incentive view')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Live payouts' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Store tasks' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Store approvals' })).toBeVisible()
  await expect(page.getByText('Mağaza prim görünürlüğü')).toHaveCount(0)
  await expect(page.locator('body')).not.toContainText('Ãƒ')
  await expect(page.locator('body')).not.toContainText('Ã„')
  await expect(page.locator('body')).not.toContainText('Ã…')

  await page.reload()

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('heading', { name: /Store incentive visibility/i })).toBeVisible()
})

test('store competitions page renders scoped contribution details', async ({ page }) => {
  await page.goto('/store/competitions')

  await expect(page.getByRole('heading', { name: /Mağaza yarışmaları/i })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'April Region Challenge' })).toBeVisible()
  const readSummary = page.getByLabel('Mağaza yarışma okuma özeti')
  const contributionRows = page.getByLabel('Kapsamdaki mağaza yarışma katkıları')
  await expect(readSummary.getByText('Okuma özeti')).toBeVisible()
  await expect(readSummary.getByText('95% katkı kapsamı')).toBeVisible()
  await expect(contributionRows.getByText('Katkı sağlığı')).toBeVisible()
  await expect(contributionRows.getByText('Kısmi katkı').first()).toBeVisible()
  await expect(contributionRows.getByText('BM checklist', { exact: true })).toBeVisible()
  await expect(page.getByText('Kapsamdaki katkılar')).toBeVisible()
  await expect(page.getByText('IstinyePark Demo Store')).toBeVisible()
  await expect(page.getByText('93.50')).toBeVisible()
  await expect(page.getByText('Outside Region Store')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Recalculate/ })).toHaveCount(0)
})

test('store competitions page switches chrome to English copy and persists locale', async ({
  page,
}) => {
  await page.goto('/store/competitions')

  await expect(page.getByRole('heading', { name: /Mağaza yarışmaları/i })).toBeVisible()
  await expect(page.getByText('Görünür yarışmalar')).toBeVisible()
  await expect(page.getByText('Sadece okuma')).toBeVisible()
  await expect(page.getByRole('button', { name: 'İncele' }).first()).toBeVisible()
  await expect(page.getByText('Store competitions')).toHaveCount(0)
  await expect(page.locator('body')).not.toContainText('Ã')
  await expect(page.locator('body')).not.toContainText('Ä')
  await expect(page.locator('body')).not.toContainText('Å')

  await page.locator('.language-toggle-button').filter({ hasText: 'EN' }).click()

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('heading', { name: /Store competitions/i })).toBeVisible()
  await expect(page.getByText('Visible challenges')).toBeVisible()
  await expect(page.getByText('Read only')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Review' }).first()).toBeVisible()
  await expect(page.getByText('Team standing', { exact: true })).toBeVisible()
  await expect(page.getByText('Contribution rows').first()).toBeVisible()
  await expect(page.getByText('Mağaza yarışmaları')).toHaveCount(0)

  await page.reload()

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('heading', { name: /Store competitions/i })).toBeVisible()
})

test('store approvals page lets store managers submit seller code requests', async ({ page }) => {
  let capturedPayload: unknown = null

  await page.route('**/api/workforce/seller-code-requests', async (route) => {
    capturedPayload = route.request().postDataJSON()
    expect(route.request().method()).toBe('POST')
    expect(capturedPayload).toEqual({
      storeId: demoStoreId,
      requestType: 'create_code',
      firstName: 'Ayse',
      lastName: 'Yilmaz',
      nationalId: '12345678901',
      phoneNumber: '05551234567',
      hireDate: '2026-05-01',
      requestedPositionId: demoPositionId,
      employmentType: 'full_time',
      requestReason: 'Yeni personel',
    })

    await route.fulfill({
      json: {
        command: {
          status: 'accepted',
          message: 'Seller code request submitted for HR approval',
        },
        data: {
          request: sellerCodeRequestFixture,
        },
      },
    })
  })

  await page.goto('/store/approvals')

  const sellerCodeForm = page.getByLabel('Satıcı kodu talebi formu')
  await expect(sellerCodeForm.getByRole('heading', { name: 'Satıcı kodu talebi' })).toBeVisible()
  await expect(sellerCodeForm.getByLabel('Satıcı kodu', { exact: true })).toHaveCount(0)
  await sellerCodeForm.getByLabel('Ad', { exact: true }).fill('Ayse')
  await sellerCodeForm.getByLabel('Soyad', { exact: true }).fill('Yilmaz')
  await sellerCodeForm.getByLabel('TC kimlik no').fill('12345678901')
  await sellerCodeForm.getByLabel('Telefon numarası').fill('05551234567')
  await sellerCodeForm.getByLabel('İşe giriş tarihi').fill('2026-05-01')
  await expect(sellerCodeForm.getByLabel('Pozisyon', { exact: true })).toContainText('Sales Consultant')
  await sellerCodeForm.getByLabel('Pozisyon', { exact: true }).selectOption(demoPositionId)
  await sellerCodeForm.getByLabel('Talep nedeni').fill('Yeni personel')
  await sellerCodeForm.getByRole('button', { name: 'Satıcı kodu talebini gönder' }).click()

  await expect(page.getByText('Seller code request submitted for HR approval')).toBeVisible()
  expect(capturedPayload).not.toBeNull()
})

test('store approvals page submits target distribution allocations with employee ids', async ({ page }) => {
  let capturedPayload: unknown = null

  await page.route('**/api/target-distributions/requests**', async (route) => {
    const request = route.request()

    if (request.method() === 'GET') {
      await route.fulfill({ json: targetDistributionRequestsFixture })
      return
    }

    capturedPayload = request.postDataJSON()
    expect(capturedPayload).toEqual({
      storeId: demoStoreId,
      requestMonth: '2026-04-01',
      targetLabel: 'Aylık personel hedef dağıtımı',
      totalTargetValue: 100000,
      allocations: [
        {
          employeeId: demoEmployeeId,
          assigneeLabel: 'Store Personnel',
          targetValue: 100000,
          note: '',
        },
      ],
    })

    await route.fulfill({
      json: {
        command: {
          status: 'submitted',
          message: 'Target distribution request submitted for region approval',
        },
        data: {
          request: {
            requestId: '00000000-0000-0000-0000-000000000777',
            companyId: '00000000-0000-0000-0000-000000000001',
            regionId: '00000000-0000-0000-0000-000000000010',
            storeId: demoStoreId,
            storeName: 'IstinyePark Demo Store',
            requestMonth: '2026-04-01',
            targetLabel: 'Aylık personel hedef dağıtımı',
            totalTargetValue: 100000,
            allocationCount: 1,
            status: 'pending_region_approval',
            requestReason: null,
            allocations: [
              {
                employeeId: demoEmployeeId,
                assigneeLabel: 'Store Personnel',
                targetValue: 100000,
                note: '',
              },
            ],
            submittedByUserId: 'store-me-smoke-user',
            approvedByUserId: null,
            approvedAt: null,
            approvalNote: null,
            createdAt: '2026-04-29T10:00:00.000Z',
            updatedAt: '2026-04-29T10:00:00.000Z',
          },
        },
      },
    })
  })

  await page.goto('/store/approvals')

  const targetHeading = page.getByRole('heading', { name: 'Hedef dağıtım talebi' })
  await expect(targetHeading).toBeVisible()
  const targetForm = targetHeading.locator('xpath=ancestor::article[1]')
  await expect(targetForm.getByText('Store Personnel')).toBeVisible()
  await targetForm.getByLabel('Talep ayı').fill('2026-04')
  await targetForm.getByLabel('Toplam hedef değeri').fill('100000')
  await targetForm.getByLabel('Personel hedef değeri').fill('100000')
  await targetForm.getByRole('button', { name: 'Bölge onayına gönder' }).click()

  await expect(page.getByText('Target distribution request submitted for region approval')).toBeVisible()
  expect(capturedPayload).not.toBeNull()
})

test('store approvals page lets store managers submit offboarding requests', async ({ page }) => {
  let capturedPayload: unknown = null

  await page.route('**/api/workforce/offboarding-requests', async (route) => {
    capturedPayload = route.request().postDataJSON()
    expect(route.request().method()).toBe('POST')
    expect(capturedPayload).toEqual({
      storeId: demoStoreId,
      employeeId: demoEmployeeId,
      terminationDate: '2026-05-10',
      terminationReason: 'resignation',
      requestReason: 'Personel istifa etti',
    })

    await route.fulfill({
      json: {
        command: {
          status: 'accepted',
          message: 'Offboarding request submitted for HR approval',
        },
        data: {
          request: offboardingRequestFixture,
        },
      },
    })
  })

  await page.goto('/store/approvals')

  const offboardingForm = page.getByLabel('Personel çıkış talebi formu')
  await expect(offboardingForm.getByRole('heading', { name: 'Personel çıkış talebi' })).toBeVisible()
  await expect(offboardingForm.getByLabel('Personel')).toContainText('Store Personnel')
  await offboardingForm.getByLabel('Personel').selectOption(demoEmployeeId)
  await offboardingForm.getByLabel('Çıkış tarihi').fill('2026-05-10')
  await offboardingForm.getByLabel('Çıkış sebebi').fill('resignation')
  await offboardingForm.getByLabel('Talep nedeni').fill('Personel istifa etti')
  await offboardingForm.getByRole('button', { name: 'Personel çıkış talebini gönder' }).click()

  await expect(page.getByText('Offboarding request submitted for HR approval')).toBeVisible()
  expect(capturedPayload).not.toBeNull()
})

test('store approvals page lets store managers edit and resubmit returned workforce requests', async ({ page }) => {
  const capturedSellerPayloads: unknown[] = []
  const capturedOffboardingPayloads: unknown[] = []

  await page.route('**/api/workforce/seller-code-requests**', async (route) => {
    const request = route.request()
    const pathname = new URL(request.url()).pathname

    if (request.method() === 'PATCH' && pathname.endsWith('/resubmit')) {
      const body = request.postDataJSON()
      capturedSellerPayloads.push(body)
      expect(body).toEqual({
        firstName: 'Ayse',
        lastName: 'Yilmaz',
        nationalId: '12345678902',
        phoneNumber: '05551234567',
        hireDate: '2026-05-02',
        requestedPositionId: demoPositionId,
        employmentType: 'full_time',
        requestReason: 'TC guncellendi',
      })
      await route.fulfill({
        json: {
          command: {
            status: 'resubmitted',
            message: 'Seller code request resubmitted for HR approval',
          },
          data: {
            request: {
              ...rejectedSellerCodeRequestFixture,
              status: 'pending_hr_approval',
              nationalIdLast4: '8902',
              hireDate: '2026-05-02',
              reviewNote: null,
            },
          },
        },
      })
      return
    }

    await route.fulfill({
      json: {
        items: [rejectedSellerCodeRequestFixture],
        meta: { count: 1, total: 1, limit: 50, offset: 0 },
      },
    })
  })

  await page.route('**/api/workforce/offboarding-requests**', async (route) => {
    const request = route.request()
    const pathname = new URL(request.url()).pathname

    if (request.method() === 'PATCH' && pathname.endsWith('/resubmit')) {
      const body = request.postDataJSON()
      capturedOffboardingPayloads.push(body)
      expect(body).toEqual({
        employeeId: demoEmployeeId,
        terminationDate: '2026-05-12',
        terminationReason: 'transfer',
        requestReason: 'Tarih ve sebep guncellendi',
      })
      await route.fulfill({
        json: {
          command: {
            status: 'resubmitted',
            message: 'Offboarding request resubmitted for HR approval',
          },
          data: {
            request: {
              ...rejectedOffboardingRequestFixture,
              status: 'pending_hr_approval',
              terminationDate: '2026-05-12',
              terminationReason: 'transfer',
              requestReason: 'Tarih ve sebep guncellendi',
              reviewNote: null,
            },
          },
        },
      })
      return
    }

    await route.fulfill({
      json: {
        items: [rejectedOffboardingRequestFixture],
        meta: { count: 1, total: 1, limit: 50, offset: 0 },
      },
    })
  })

  await page.goto('/store/approvals')

  const returnedPanel = page.getByLabel('İade edilen personel talepleri')
  await expect(returnedPanel.getByText('TC numarasi tekrar kontrol edilmeli')).toBeVisible()
  await expect(returnedPanel.getByText('Cikis tarihi tekrar kontrol edilmeli')).toBeVisible()

  await returnedPanel.getByRole('button', { name: 'Satıcı kodu talebini düzenle' }).click()
  const sellerCodeForm = page.getByLabel('Satıcı kodu talebi formu')
  await expect(sellerCodeForm.getByLabel('Ad', { exact: true })).toHaveValue('Ayse')
  await expect(sellerCodeForm.getByLabel('Soyad', { exact: true })).toHaveValue('Yilmaz')
  await sellerCodeForm.getByLabel('TC kimlik no').fill('12345678902')
  await sellerCodeForm.getByLabel('İşe giriş tarihi').fill('2026-05-02')
  await sellerCodeForm.getByLabel('Talep nedeni').fill('TC guncellendi')
  await sellerCodeForm.getByRole('button', { name: 'Satıcı kodu talebini yeniden gönder' }).click()
  await expect(page.getByText('Seller code request resubmitted for HR approval')).toBeVisible()

  await returnedPanel.getByRole('button', { name: 'Personel çıkış talebini düzenle' }).click()
  const offboardingForm = page.getByLabel('Personel çıkış talebi formu')
  await offboardingForm.getByLabel('Çıkış tarihi').fill('2026-05-12')
  await offboardingForm.getByLabel('Çıkış sebebi').fill('transfer')
  await offboardingForm.getByLabel('Talep nedeni').fill('Tarih ve sebep guncellendi')
  await offboardingForm.getByRole('button', { name: 'Personel çıkış talebini yeniden gönder' }).click()
  await expect(page.getByText('Offboarding request resubmitted for HR approval')).toBeVisible()

  expect(capturedSellerPayloads).toHaveLength(1)
  expect(capturedOffboardingPayloads).toHaveLength(1)
})

test('store approvals page switches to English copy and persists locale', async ({ page }) => {
  await page.goto('/store/approvals')

  await page.locator('.language-toggle-button').filter({ hasText: 'EN' }).click()

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('heading', { name: /Store approval requests/i })).toBeVisible()
  await expect(page.getByText('Returned requests')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Target distribution request' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Seller code request' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Employee exit request' })).toBeVisible()
  await expect(page.getByLabel('Seller code request form').getByLabel('First name')).toBeVisible()
  await expect(page.getByLabel('Offboarding request form').getByLabel('Employee')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Submit seller code request' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Submit offboarding request' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Submitted requests' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Open region approval queue' })).toBeVisible()
  await expect(page.getByText('Mağaza onayları')).toHaveCount(0)
  await expect(page.getByText('Satıcı kodu talebi')).toHaveCount(0)
  await expect(page.locator('body')).not.toContainText('Ãƒ')
  await expect(page.locator('body')).not.toContainText('Ã„')
  await expect(page.locator('body')).not.toContainText('Ã…')

  await page.reload()

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('heading', { name: /Store approval requests/i })).toBeVisible()
})

test('language toggle localizes competition read labels and persists preference', async ({ page }) => {
  await page.goto('/store/competitions')

  const readSummary = page.getByLabel('Mağaza yarışma okuma özeti')
  const contributionRows = page.getByLabel('Kapsamdaki mağaza yarışma katkıları')

  await expect(readSummary.getByRole('heading', { name: 'Okuma özeti' })).toBeVisible()
  await expect(readSummary.getByText('95% katkı kapsamı')).toBeVisible()
  await expect(contributionRows.getByText('Katkı sağlığı')).toBeVisible()
  await expect(contributionRows.getByText('Kısmi katkı').first()).toBeVisible()

  await page.getByRole('button', { name: 'İngilizceye geç' }).click()

  const readSummaryEn = page.getByLabel('Store competition read summary')
  const contributionRowsEn = page.getByLabel('Scoped store competition contributions')

  await expect(readSummaryEn.getByRole('heading', { name: 'Read summary' })).toBeVisible()
  await expect(readSummaryEn.getByText('95% contribution coverage')).toBeVisible()
  await expect(contributionRowsEn.getByText('Contribution health')).toBeVisible()
  await expect(contributionRowsEn.getByText('Partial contribution').first()).toBeVisible()

  await page.reload()

  await expect(readSummaryEn.getByRole('heading', { name: 'Read summary' })).toBeVisible()
  await expect(contributionRowsEn.getByText('Contribution health')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Switch language to Turkish' })).toHaveAttribute(
    'aria-pressed',
    'false',
  )
})

async function routeStoreSurfaceApi(page: Page) {
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({ json: authSessionFixture })
  })

  await page.route('**/api/feed?**', async (route) => {
    await route.fulfill({ json: storeFeedFixture })
  })

  await page.route('**/api/reports/kpi-config', async (route) => {
    await route.fulfill({ json: kpiConfigFixture })
  })

  await page.route('**/api/reports/my-performance**', async (route) => {
    const requestUrl = new URL(route.request().url())
    await route.fulfill({
      json:
        requestUrl.searchParams.get('periodStart') === '2026-05-01'
          ? myPerformanceMayFixture
          : myPerformanceFixture,
    })
  })

  await page.route('**/api/reports/personnel-performance/**', async (route) => {
    const requestUrl = new URL(route.request().url())
    const baseFixture =
      requestUrl.searchParams.get('periodStart') === '2026-05-01'
        ? myPerformanceMayFixture
        : myPerformanceFixture

    await route.fulfill({
      json: {
        ...baseFixture,
        employee: {
          ...baseFixture.employee,
          employeeId: demoEmployeeId,
          displayName: 'Store Personnel - 1',
          storeName: 'IstinyePark Demo Store',
        },
      },
    })
  })

  await page.route('**/api/reports/store-kpi-highlights**', async (route) => {
    await route.fulfill({ json: storeKpiHighlightsFixture })
  })

  await page.route('**/api/reports/leaderboards/closed**', async (route) => {
    const requestUrl = new URL(route.request().url())
    await route.fulfill({
      json:
        requestUrl.searchParams.get('periodType') === 'monthly'
          ? closedLeaderboardMonthlyPreviewFixture
          : closedLeaderboardFixture,
    })
  })

  await page.route('**/api/reports/rankings**', async (route) => {
    await route.fulfill({ json: rankingsFixture })
  })

  await page.route('**/api/reports/snapshot-runs**', async (route) => {
    await route.fulfill({
      json: {
        items: [
          {
            snapshotRunId: 'snapshot-2026-04-24',
            snapshotDate: '2026-04-24',
            snapshotType: 'daily',
            periodStart: '2026-04-24',
            periodEnd: '2026-04-24',
            runStatus: 'completed',
            generatedAt: '2026-04-24T08:00:00.000Z',
            generatedBy: 'release-smoke',
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

  await page.route('**/api/workflow/inbox', async (route) => {
    await route.fulfill({ json: workflowInboxFixture })
  })

  await page.route('**/api/target-distributions/requests**', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ json: targetDistributionRequestsFixture })
      return
    }

    await route.fulfill({
      status: 403,
      json: { message: 'Target distribution write route is not mocked in this surface test.' },
    })
  })

  await page.route('**/api/target-distributions/store-personnel**', async (route) => {
    await route.fulfill({ json: storeTargetingPersonnelFixture })
  })

  await page.route('**/api/workforce/position-options**', async (route) => {
    await route.fulfill({ json: positionOptionsFixture })
  })

  await page.route('**/api/workforce/store-employees**', async (route) => {
    await route.fulfill({ json: storeEmployeesFixture })
  })

  await page.route('**/api/workforce/seller-code-requests**', async (route) => {
    await route.fulfill({
      json: {
        items: [],
        meta: { count: 0, total: 0, limit: 50, offset: 0 },
      },
    })
  })

  await page.route('**/api/workforce/offboarding-requests**', async (route) => {
    await route.fulfill({
      json: {
        items: [],
        meta: { count: 0, total: 0, limit: 50, offset: 0 },
      },
    })
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

    if (
      request.method() === 'GET' &&
      pathname.endsWith(`/api/competitions/${competitionFixture.competitionId}`)
    ) {
      await route.fulfill({ json: competitionDetailFixture })
      return
    }

    await route.fulfill({
      status: 403,
      json: { message: 'Store competition surface is read-only' },
    })
  })
}

const authSessionFixture = {
  authMode: 'mock',
  authenticated: true,
  user: {
    userId: 'store-me-smoke-user',
    employeeId: demoEmployeeId,
    roleCodes: ['STORE_PERSONNEL', 'STORE_MANAGER', 'offline_access', 'uma_authorization', 'default-roles-store-ops'],
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
      secondaryActionLabel: 'Detay aç',
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

const storeFeedFixture = {
  items: [
    {
      feedPostId: 'store-home-feed-1',
      postType: 'announcement',
      title: 'Pilot announcement',
      body: 'Pilot store shell announcement.',
      linkLabel: null,
      linkUrl: null,
      visibilityScopeType: 'store',
      visibilityScopeIds: [demoStoreId],
      isPinned: true,
      publishStatus: 'published',
      publishedAt: '2026-05-01T08:00:00.000Z',
      startsAt: null,
      endsAt: null,
      metricCode: null,
      metricLabel: null,
      challengeStartsOn: null,
      challengeEndsOn: null,
      targetRoute: null,
      createdByUserId: 'store-me-smoke-user',
      updatedByUserId: 'store-me-smoke-user',
      createdAt: '2026-05-01T08:00:00.000Z',
      updatedAt: '2026-05-01T08:00:00.000Z',
    },
  ],
  meta: {
    count: 1,
    total: 1,
    limit: 50,
    offset: 0,
  },
}

const kpiConfigFixture = {
  storeProfile: {
    profileCode: 'store',
    title: 'Store Score',
    summary: 'Store score profile',
    futureMetricRule: 'Manual review',
    metrics: [
      {
        code: 'TARGET_ACHIEVEMENT',
        label: 'Target Achievement',
        weightPercent: 70,
        ownerRole: 'STORE_MANAGER',
        scoreBehavior: 'score_only',
      },
      {
        code: 'UPT',
        label: 'Units Per Ticket',
        weightPercent: 30,
        ownerRole: 'STORE_MANAGER',
        scoreBehavior: 'score_only',
      },
    ],
  },
  personnelProfile: {
    profileCode: 'personnel',
    title: 'Personnel Score',
    summary: 'Personnel score profile',
    futureMetricRule: 'Manual review',
    metrics: [
      {
        code: 'TARGET_ACHIEVEMENT',
        label: 'Target Achievement',
        weightPercent: 40,
        ownerRole: 'STORE_PERSONNEL',
        scoreBehavior: 'score_only',
      },
      {
        code: 'ATV',
        label: 'Average Ticket Value',
        weightPercent: 30,
        ownerRole: 'STORE_PERSONNEL',
        scoreBehavior: 'score_only',
      },
      {
        code: 'UPT',
        label: 'Units Per Ticket',
        weightPercent: 30,
        ownerRole: 'STORE_PERSONNEL',
        scoreBehavior: 'score_only',
      },
    ],
  },
  ownershipMatrix: [],
  gradingBands: [
    {
      code: 'A',
      label: 'Excellent',
      emoji: 'A',
      tone: 'calm',
      minScore: 1,
    },
    {
      code: 'B',
      label: 'Healthy',
      emoji: 'B',
      tone: 'accent',
      minScore: 0.85,
    },
  ],
}

const myPerformanceFixture = {
  source: {
    mode: 'live',
    snapshotRunId: null,
    snapshotDate: null,
  },
  employee: {
    employeeId: demoEmployeeId,
    displayName: 'Store Personnel',
    storeId: demoStoreId,
    storeName: 'IstinyePark Demo Store',
  },
  period: {
    periodStart: '2026-04-01',
    periodEnd: '2026-04-30',
  },
  score: {
    value: 91.5,
    matchedMetrics: 3,
    totalMetrics: 3,
  },
  rankings: {
    turkeyRank: 1,
    turkeyPopulation: 4,
    storeRank: 1,
    storePopulation: 3,
  },
  availablePeriods: [
    {
      periodType: 'monthly',
      periodStart: '2026-04-01',
      periodEnd: '2026-04-30',
    },
    {
      periodType: 'monthly',
      periodStart: '2026-05-01',
      periodEnd: '2026-05-31',
    },
  ],
  partial: {
    isPartial: false,
    missingMetricCodes: [],
    missingMetricLabels: [],
    pendingNormalizationCodes: [],
    pendingNormalizationLabels: [],
  },
  supporting: {
    netSalesValue: 145000,
    targetEntryMode: 'manager_assignment',
    targetEditableByCurrentUser: false,
  },
  metrics: [
    {
      code: 'TARGET_ACHIEVEMENT',
      label: 'Target Achievement',
      weightPercent: 40,
      actualValue: 0.98,
      targetValue: null,
      achievementRate: 0.98,
      contributionValue: 39.2,
      dataStatus: 'reported',
      scoreStatus: 'scored',
      status: 'reported',
    },
    {
      code: 'ATV',
      label: 'Average Ticket Value',
      weightPercent: 30,
      actualValue: 96,
      targetValue: null,
      achievementRate: 96,
      contributionValue: 28.8,
      dataStatus: 'reported',
      scoreStatus: 'scored',
      status: 'reported',
    },
    {
      code: 'UPT',
      label: 'Units Per Ticket',
      weightPercent: 30,
      actualValue: 95,
      targetValue: null,
      achievementRate: 95,
      contributionValue: 28.5,
      dataStatus: 'reported',
      scoreStatus: 'scored',
      status: 'reported',
    },
  ],
}

const myPerformanceMayFixture = {
  ...myPerformanceFixture,
  period: {
    periodStart: '2026-05-01',
    periodEnd: '2026-05-31',
  },
  score: {
    value: 93.2,
    matchedMetrics: 3,
    totalMetrics: 3,
  },
  rankings: {
    turkeyRank: 1,
    turkeyPopulation: 4,
    storeRank: 1,
    storePopulation: 3,
  },
  supporting: {
    netSalesValue: 172000,
    targetEntryMode: 'manager_assignment',
    targetEditableByCurrentUser: false,
  },
  metrics: [
    {
      code: 'TARGET_ACHIEVEMENT',
      label: 'Target Achievement',
      weightPercent: 40,
      actualValue: 1.04,
      targetValue: null,
      achievementRate: 1.04,
      contributionValue: 41.6,
      dataStatus: 'reported',
      scoreStatus: 'scored',
      status: 'reported',
    },
    {
      code: 'ATV',
      label: 'Average Ticket Value',
      weightPercent: 30,
      actualValue: 112,
      targetValue: null,
      achievementRate: 112,
      contributionValue: 33.6,
      dataStatus: 'reported',
      scoreStatus: 'scored',
      status: 'reported',
    },
    {
      code: 'UPT',
      label: 'Units Per Ticket',
      weightPercent: 30,
      actualValue: 101,
      targetValue: null,
      achievementRate: 101,
      contributionValue: 30.3,
      dataStatus: 'reported',
      scoreStatus: 'scored',
      status: 'reported',
    },
  ],
}

const storeKpiHighlightsFixture = {
  source: {
    mode: 'live',
    snapshotRunId: null,
    snapshotDate: null,
    periodType: 'monthly',
  },
  store: {
    storeId: demoStoreId,
    storeName: 'IstinyePark Demo Store',
  },
  period: {
    periodStart: '2026-04-01',
    periodEnd: '2026-04-30',
  },
  score: {
    value: 91.5,
    matchedMetrics: 2,
    totalMetrics: 2,
  },
  availablePeriods: [
    {
      periodType: 'monthly',
      periodStart: '2026-04-01',
      periodEnd: '2026-04-30',
    },
  ],
  partial: {
    isPartial: false,
    missingMetricCodes: [],
    missingMetricLabels: [],
    pendingNormalizationCodes: [],
    pendingNormalizationLabels: [],
  },
  metrics: [
    {
      code: 'TARGET_ACHIEVEMENT',
      label: 'Target Achievement',
      weightPercent: 35,
      actualValue: 0.98,
      targetValue: null,
      achievementRate: 0.98,
      statusBand: 'exceeded',
      dataStatus: 'reported',
      scoreStatus: 'scored',
    },
    {
      code: 'UPT',
      label: 'Units Per Ticket',
      weightPercent: 25,
      actualValue: 95,
      targetValue: null,
      achievementRate: 95,
      statusBand: 'on_track',
      dataStatus: 'reported',
      scoreStatus: 'scored',
    },
  ],
}

const closedLeaderboardFixture = {
  source: {
    mode: 'closed',
    periodType: 'daily',
    state: 'closed',
    snapshotRunId: 'snapshot-2026-04-24',
    snapshotDate: '2026-04-24',
    periodStart: '2026-04-24',
    periodEnd: '2026-04-24',
  },
  includedSnapshotRuns: [
    {
      snapshotRunId: 'snapshot-2026-04-24',
      snapshotDate: '2026-04-24',
      snapshotType: 'daily',
      periodStart: '2026-04-24',
      periodEnd: '2026-04-24',
      runStatus: 'completed',
      generatedAt: '2026-04-24T08:00:00.000Z',
      generatedBy: 'release-smoke',
    },
  ],
  currentEmployee: {
    employeeId: demoEmployeeId,
    displayName: 'Store Personnel',
    storeId: demoStoreId,
    storeName: 'IstinyePark Demo Store',
    scoreValue: 91.5,
    rankings: {
      turkeyRank: 1,
      turkeyPopulation: 4,
      storeRank: 1,
      storePopulation: 3,
    },
    coverage: {
      closedDaysInPeriod: 1,
      daysWithPerformance: 1,
      minimumRequiredDays: 1,
      isEligibleForRanking: true,
    },
    rankingStatus: 'official',
    eligibilityReason: 'eligible',
    neededPerformanceDays: 0,
    metricRanks: [
      {
        code: 'TARGET_ACHIEVEMENT',
        label: 'Target Achievement',
        actualValue: 0.98,
        storeRank: 1,
        storePopulation: 3,
        turkeyRank: 1,
        turkeyPopulation: 4,
      },
      {
        code: 'ATV',
        label: 'Average Ticket Value',
        actualValue: 96,
        storeRank: 1,
        storePopulation: 3,
        turkeyRank: 2,
        turkeyPopulation: 4,
      },
      {
        code: 'UPT',
        label: 'Units Per Ticket',
        actualValue: 95,
        storeRank: 1,
        storePopulation: 3,
        turkeyRank: 1,
        turkeyPopulation: 4,
      },
    ],
  },
  personnelTop: [
    {
      employeeId: demoEmployeeId,
      displayName: 'Store Personnel',
      storeId: demoStoreId,
      storeName: 'IstinyePark Demo Store',
      scoreValue: 91.5,
      rankings: {
        turkeyRank: 1,
        turkeyPopulation: 4,
        storeRank: 1,
        storePopulation: 3,
      },
      coverage: {
        closedDaysInPeriod: 1,
        daysWithPerformance: 1,
        minimumRequiredDays: 1,
        isEligibleForRanking: true,
      },
      rankingStatus: 'official',
      eligibilityReason: 'eligible',
      neededPerformanceDays: 0,
      metricRanks: [],
    },
  ],
}

const closedLeaderboardMonthlyPreviewFixture = {
  ...closedLeaderboardFixture,
  source: {
    ...closedLeaderboardFixture.source,
    periodType: 'monthly',
    snapshotRunId: null,
    snapshotDate: '2026-04-02',
    periodStart: '2026-04-01',
    periodEnd: '2026-04-30',
  },
  includedSnapshotRuns: [
    {
      snapshotRunId: 'snapshot-2026-04-23',
      snapshotDate: '2026-04-23',
      snapshotType: 'daily',
      periodStart: '2026-04-23',
      periodEnd: '2026-04-23',
      runStatus: 'completed',
      generatedAt: '2026-04-23T08:00:00.000Z',
      generatedBy: 'ranking-closure-job',
    },
    {
      snapshotRunId: 'snapshot-2026-04-24',
      snapshotDate: '2026-04-24',
      snapshotType: 'daily',
      periodStart: '2026-04-24',
      periodEnd: '2026-04-24',
      runStatus: 'completed',
      generatedAt: '2026-04-24T08:00:00.000Z',
      generatedBy: 'ranking-closure-job',
    },
  ],
  currentEmployee: {
    ...closedLeaderboardFixture.currentEmployee,
    rankings: {
      turkeyRank: null,
      turkeyPopulation: 4,
      storeRank: null,
      storePopulation: 3,
    },
    coverage: {
      closedDaysInPeriod: 2,
      daysWithPerformance: 2,
      minimumRequiredDays: 3,
      isEligibleForRanking: false,
    },
    rankingStatus: 'preview_only',
    eligibilityReason: 'needs_more_closed_days',
    neededPerformanceDays: 1,
  },
  personnelTop: [
    {
      ...closedLeaderboardFixture.personnelTop[0],
      rankings: {
        turkeyRank: null,
        turkeyPopulation: 4,
        storeRank: null,
        storePopulation: 3,
      },
      coverage: {
        closedDaysInPeriod: 2,
        daysWithPerformance: 2,
        minimumRequiredDays: 3,
        isEligibleForRanking: false,
      },
      rankingStatus: 'preview_only',
      eligibilityReason: 'needs_more_closed_days',
      neededPerformanceDays: 1,
    },
  ],
}

const storeRankingSummaryRow = {
  subject: 'store',
  storeId: demoStoreId,
  storeName: 'IstinyePark Demo Store',
  regionId: '00000000-0000-0000-0000-000000000010',
  regionName: 'Marmara',
  regionManagerUserId: 'region-manager-1',
  regionManagerName: 'Region Manager',
  rank: 12,
  population: 240,
  scoreValue: 104.6,
  visibility: 'summary',
}

const personnelRankingSummaryRow = {
  subject: 'personnel',
  employeeId: demoEmployeeId,
  displayName: 'Store Personnel - 1',
  storeId: demoStoreId,
  storeName: 'IstinyePark Demo Store',
  regionId: '00000000-0000-0000-0000-000000000010',
  regionName: 'Marmara',
  regionManagerUserId: 'region-manager-1',
  regionManagerName: 'Region Manager',
  rank: 7,
  population: 420,
  storeRank: 1,
  storePopulation: 4,
  scoreValue: 96.4,
  visibility: 'summary',
}

const personnelRankingDetailRow = {
  ...personnelRankingSummaryRow,
  visibility: 'detail',
  metrics: [
    {
      code: 'UPT',
      label: 'UPT',
      actualValue: 4.8,
      benchmarkValue: 4.2,
      contributionValue: 29,
    },
    {
      code: 'ATV',
      label: 'ATV',
      actualValue: 1245,
      benchmarkValue: 1180,
      contributionValue: 28,
    },
    {
      code: 'TARGET_ACHIEVEMENT',
      label: 'Target Achievement',
      actualValue: 0.98,
      targetValue: 1,
      contributionValue: 39.2,
    },
  ],
}

const rankingsPrivilegedDetailStoreRow = {
  subject: 'store',
  storeId: 'store-high-hg',
  storeName: 'High HG Store',
  regionId: '00000000-0000-0000-0000-000000000010',
  regionName: 'Marmara',
  regionManagerUserId: 'region-manager-1',
  regionManagerName: 'Region Manager',
  rank: 1,
  population: 2,
  scoreValue: 91.4,
  visibility: 'detail',
  metrics: [
    {
      code: 'UPT',
      label: 'UPT',
      actualValue: 4.75,
      benchmarkValue: 4.2,
      contributionValue: 15,
    },
    {
      code: 'ATV',
      label: 'ATV',
      actualValue: 1580,
      benchmarkValue: 1320,
      contributionValue: 15,
    },
    {
      code: 'CR',
      label: 'CR',
      actualValue: 0.197,
      benchmarkValue: 0.185,
      contributionValue: 20,
    },
    {
      code: 'TARGET_ACHIEVEMENT',
      label: 'Target Achievement',
      actualValue: 3710884.57,
      targetValue: 1000000,
      contributionValue: 40,
    },
    {
      code: 'BM_CHECKLIST',
      label: 'BM Checklist',
      actualValue: 86,
      contributionValue: 4.3,
    },
    {
      code: 'VM_CHECKLIST',
      label: 'VM Checklist',
      actualValue: 92,
      contributionValue: 4.6,
    },
  ],
}

const rankingsPrivilegedLowHgStoreRow = {
  ...rankingsPrivilegedDetailStoreRow,
  storeId: 'store-low-hg',
  storeName: 'Low HG Store',
  rank: 2,
  scoreValue: 64.2,
  metrics: rankingsPrivilegedDetailStoreRow.metrics.map((metric) =>
    metric.code === 'TARGET_ACHIEVEMENT'
      ? {
          ...metric,
          actualValue: 640000,
          targetValue: 1000000,
          contributionValue: 25.6,
        }
      : metric,
  ),
}

const scoreDisplayLeaderStoreRow = {
  ...rankingsPrivilegedDetailStoreRow,
  storeId: 'store-score-display-leader',
  storeName: 'Weighted Score Leader',
  rank: 1,
  scoreValue: 112.3,
  metrics: [
    {
      code: 'UPT',
      label: 'UPT',
      actualValue: 4,
      benchmarkValue: 4,
      contributionValue: 15,
    },
    {
      code: 'ATV',
      label: 'ATV',
      actualValue: 1500,
      benchmarkValue: 1500,
      contributionValue: 15,
    },
    {
      code: 'CR',
      label: 'CR',
      actualValue: 0.2,
      benchmarkValue: 0.2,
      contributionValue: 20,
    },
    {
      code: 'TARGET_ACHIEVEMENT',
      label: 'Target Achievement',
      actualValue: 1000000,
      targetValue: 1000000,
      contributionValue: 40,
    },
    {
      code: 'BM_CHECKLIST',
      label: 'BM Checklist',
      actualValue: 95,
      contributionValue: 11.15,
    },
    {
      code: 'VM_CHECKLIST',
      label: 'VM Checklist',
      actualValue: 95,
      contributionValue: 11.15,
    },
  ],
}

const scoreDisplayFollowerStoreRow = {
  ...rankingsPrivilegedDetailStoreRow,
  storeId: 'store-score-display-follower',
  storeName: 'Raw Delta Trap',
  rank: 2,
  scoreValue: 104.2,
  metrics: [
    {
      code: 'UPT',
      label: 'UPT',
      actualValue: 7,
      benchmarkValue: 4,
      contributionValue: 18,
    },
    {
      code: 'ATV',
      label: 'ATV',
      actualValue: 1500,
      benchmarkValue: 1500,
      contributionValue: 15,
    },
    {
      code: 'CR',
      label: 'CR',
      actualValue: 0.2,
      benchmarkValue: 0.2,
      contributionValue: 20,
    },
    {
      code: 'TARGET_ACHIEVEMENT',
      label: 'Target Achievement',
      actualValue: 1000000,
      targetValue: 1000000,
      contributionValue: 40,
    },
    {
      code: 'BM_CHECKLIST',
      label: 'BM Checklist',
      actualValue: 56,
      contributionValue: 5.6,
    },
    {
      code: 'VM_CHECKLIST',
      label: 'VM Checklist',
      actualValue: 56,
      contributionValue: 5.6,
    },
  ],
}

const rankingsPrivilegedDetailFixture = {
  source: {
    mode: 'live',
    periodType: 'monthly',
    periodStart: '2026-04-01',
    periodEnd: '2026-04-30',
  },
  access: {
    globalMode: 'full',
    canSeeGlobalDetails: true,
    canSeeManagedStorePersonnelDetails: true,
  },
  filters: {
    regionManagers: [{ id: 'region-manager-1', label: 'Region Manager' }],
    regions: [{ id: '00000000-0000-0000-0000-000000000010', label: 'Marmara' }],
    stores: [{ id: 'store-high-hg', label: 'High HG Store' }],
  },
  reference: {
    store: {
      averageScore: 83.6,
      metrics: [
        { code: 'UPT', label: 'UPT', value: 4.22 },
        { code: 'ATV', label: 'ATV', value: 1320 },
        { code: 'CR', label: 'CR', value: 0.185 },
        { code: 'TARGET_ACHIEVEMENT', label: 'Target Achievement', value: 0.94 },
        { code: 'BM_CHECKLIST', label: 'BM Checklist', value: 81 },
        { code: 'VM_CHECKLIST', label: 'VM Checklist', value: 84 },
      ],
    },
    personnel: {
      averageScore: 79.2,
      metrics: [
        { code: 'UPT', label: 'UPT', value: 4.1 },
        { code: 'ATV', label: 'ATV', value: 1180 },
        { code: 'TARGET_ACHIEVEMENT', label: 'Target Achievement', value: 0.88 },
      ],
    },
  },
  storeLeaderboard: {
    items: [rankingsPrivilegedDetailStoreRow],
    currentStore: rankingsPrivilegedDetailStoreRow,
    meta: {
      total: 2,
      limit: 100,
      offset: 0,
    },
  },
  personnelLeaderboard: {
    items: [],
    currentEmployee: null,
    managedStorePersonnel: [],
    meta: {
      total: 0,
      limit: 100,
      offset: 0,
    },
  },
  availablePeriods: [
    {
      periodType: 'monthly',
      periodStart: '2026-04-01',
      periodEnd: '2026-04-30',
    },
  ],
}

const rankingsFixture = {
  source: {
    mode: 'live',
    periodType: 'monthly',
    periodStart: '2026-04-01',
    periodEnd: '2026-04-30',
  },
  access: {
    globalMode: 'top100',
    canSeeGlobalDetails: false,
    canSeeManagedStorePersonnelDetails: true,
  },
  filters: {
    regionManagers: [],
    regions: [],
    stores: [],
  },
  storeLeaderboard: {
    items: [storeRankingSummaryRow],
    currentStore: {
      ...storeRankingSummaryRow,
      visibility: 'detail',
      metrics: [
        {
          code: 'TARGET_ACHIEVEMENT',
          label: 'Target Achievement',
          actualValue: 1.12,
          targetValue: 1,
          contributionValue: 70,
        },
      ],
    },
    meta: {
      total: 240,
      limit: 100,
      offset: 0,
    },
  },
  personnelLeaderboard: {
    items: [personnelRankingSummaryRow],
    currentEmployee: {
      ...personnelRankingSummaryRow,
      visibility: 'detail',
      metrics: [
        {
          code: 'ATV',
          label: 'ATV',
          actualValue: 1245,
          benchmarkValue: 1180,
          contributionValue: 28,
        },
      ],
    },
    managedStorePersonnel: [
      {
        ...personnelRankingSummaryRow,
        visibility: 'detail',
        metrics: [
          {
            code: 'UPT',
            label: 'UPT',
            actualValue: 4.8,
            benchmarkValue: 4.2,
            contributionValue: 29,
          },
        ],
      },
    ],
    meta: {
      total: 420,
      limit: 100,
      offset: 0,
    },
  },
  availablePeriods: [
    {
      periodType: 'monthly',
      periodStart: '2026-04-01',
      periodEnd: '2026-04-30',
    },
  ],
}

const competitionFixture = {
  competitionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  competitionCode: 'APRIL_REGION_CHALLENGE',
  competitionName: 'April Region Challenge',
  description: null,
  competitionType: 'region_challenge',
  lifecycleState: 'active',
  startsOn: '2026-04-22',
  endsOn: '2026-04-24',
}

const targetDistributionRequestsFixture = {
  items: [],
  meta: {
    count: 0,
    total: 0,
    limit: 30,
    offset: 0,
  },
}

const storeTargetingPersonnelFixture = {
  items: [
    {
      employeeId: demoEmployeeId,
      displayName: 'Store Personnel',
      externalEmployeeRef: 'FM8001',
      periodStart: '2026-04-01',
      periodEnd: '2026-04-30',
      netSalesValue: 145000,
    },
  ],
  meta: {
    count: 1,
    total: 1,
    limit: 30,
    offset: 0,
  },
}

const sellerCodeRequestFixture = {
  requestId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  companyId: '00000000-0000-0000-0000-000000000001',
  regionId: '00000000-0000-0000-0000-000000000010',
  storeId: demoStoreId,
  storeCode: 'DEMO-100',
  storeName: 'IstinyePark Demo Store',
  storeType: 'franchise',
  requestType: 'create_code',
  status: 'pending_hr_approval',
  firstName: 'Ayse',
  lastName: 'Yilmaz',
  nationalIdLast4: '8901',
  phoneNumber: '05551234567',
  hireDate: '2026-05-01',
  requestedPositionId: demoPositionId,
  positionCode: 'SALES_CONSULTANT',
  positionName: 'Sales Consultant',
  employmentType: 'full_time',
  requestedSellerCode: null,
  approvedSellerCode: null,
  lastReferenceSellerCode: null,
  submittedByUserId: 'store-me-smoke-user',
  reviewedByUserId: null,
  reviewedAt: null,
  reviewNote: null,
  employeeId: null,
  createdAt: '2026-04-27T09:00:00.000Z',
  updatedAt: '2026-04-27T09:00:00.000Z',
}

const offboardingRequestFixture = {
  requestId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  companyId: '00000000-0000-0000-0000-000000000001',
  regionId: '00000000-0000-0000-0000-000000000010',
  storeId: demoStoreId,
  storeCode: 'DEMO-100',
  storeName: 'IstinyePark Demo Store',
  employeeId: demoEmployeeId,
  displayName: 'Store Personnel',
  externalEmployeeRef: 'FM8001',
  positionCode: 'SALES_CONSULTANT',
  positionName: 'Sales Consultant',
  status: 'pending_hr_approval',
  terminationDate: '2026-05-10',
  terminationReason: 'resignation',
  requestReason: 'Personel istifa etti',
  submittedByUserId: 'store-me-smoke-user',
  reviewedByUserId: null,
  reviewedAt: null,
  reviewNote: null,
  createdAt: '2026-04-27T09:00:00.000Z',
  updatedAt: '2026-04-27T09:00:00.000Z',
}

const rejectedSellerCodeRequestFixture = {
  ...sellerCodeRequestFixture,
  status: 'rejected',
  reviewedByUserId: 'hr-admin-user',
  reviewedAt: '2026-04-27T10:00:00.000Z',
  reviewNote: 'TC numarasi tekrar kontrol edilmeli',
  updatedAt: '2026-04-27T10:00:00.000Z',
}

const rejectedOffboardingRequestFixture = {
  ...offboardingRequestFixture,
  status: 'rejected',
  reviewedByUserId: 'hr-admin-user',
  reviewedAt: '2026-04-27T10:00:00.000Z',
  reviewNote: 'Cikis tarihi tekrar kontrol edilmeli',
  updatedAt: '2026-04-27T10:00:00.000Z',
}

const storeEmployeesFixture = {
  items: [
    {
      employeeId: demoEmployeeId,
      displayName: 'Store Personnel',
      externalEmployeeRef: 'FM8001',
      storeId: demoStoreId,
      positionId: demoPositionId,
      positionCode: 'SALES_CONSULTANT',
      positionName: 'Sales Consultant',
      assignmentStartDate: '2026-04-01',
      employmentStatus: 'active',
    },
  ],
  meta: {
    count: 1,
    total: 1,
    limit: 1,
    offset: 0,
  },
}

const positionOptionsFixture = {
  items: [
    {
      positionId: demoPositionId,
      positionCode: 'SALES_CONSULTANT',
      positionName: 'Sales Consultant',
      jobFamily: 'store',
      isManagerial: false,
    },
    {
      positionId: '44444444-4444-4444-9444-444444444444',
      positionCode: 'ASSISTANT_MANAGER',
      positionName: 'Assistant Store Manager',
      jobFamily: 'store',
      isManagerial: true,
    },
  ],
  meta: {
    count: 2,
    total: 2,
    limit: 2,
    offset: 0,
  },
}

const competitionDetailFixture = {
  competition: competitionFixture,
  stages: [
    {
      competitionStageId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      competitionId: competitionFixture.competitionId,
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
      competitionTeamId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      teamCode: 'MARMARA_DEMO',
      teamName: 'Marmara Demo',
      teamOrder: 1,
      stores: [
        {
          storeId: demoStoreId,
          storeCode: 'DEMO-100',
          storeName: 'IstinyePark Demo Store',
          regionId: '00000000-0000-0000-0000-000000000010',
        },
      ],
    },
  ],
  latestScores: [
    {
      stageId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      teamId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
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
  warnings: [],
  storeContributions: [
    {
      stageId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      teamId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      teamCode: 'MARMARA_DEMO',
      teamName: 'Marmara Demo',
      storeId: demoStoreId,
      storeCode: 'DEMO-100',
      storeName: 'IstinyePark Demo Store',
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
