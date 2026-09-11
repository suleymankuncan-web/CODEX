import { expect, test } from './test-fixtures'
import { setStoredLocale } from './locale-test-utils'
import { demoEmployeeId } from './store-surfaces-identities'
import { routeStoreSurfaceApi } from './store-surfaces-api-fixtures'
import { authSessionFixture, kpiConfigFixture, myPerformanceFixture, myPerformanceMayFixture } from './store-surfaces-profile-fixtures'
import { storeKpiHighlightsFixture, personnelRankingSummaryRow, personnelRankingRawTargetRow, rankingsPrivilegedDetailStoreRow, rankingsAvailablePeriods, rankingsPrivilegedDetailFixture, rankingsFixture } from './store-surfaces-ranking-fixtures'

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

  await expect(page.locator('[data-testid="store-me-page"]')).toBeVisible()
  const storeMeHeader = page.locator('.store-me-compact-header')
  await expect(storeMeHeader.getByRole('heading', { name: /Store Personnel/i })).toBeVisible()
  await expect(storeMeHeader).toContainText('IstinyePark Demo Store')
  await expect(page.locator('.store-me-plum-dashboard')).toBeVisible()
  await expect(page.locator('.store-me-kpi-grid')).toBeVisible()
  await expect(page.locator('.store-me-score-chart [data-slot="chart"]')).toBeVisible()
  await expect(page.locator('.store-me-score-breakdown')).toBeVisible()
  await expect(page.locator('.store-me-quote-card')).toHaveCount(0)
  await expect(page.getByText('Mağaza', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('Bölge', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('Türkiye', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('Bugün Yapılacaklar')).toBeVisible()
  await expect(page.locator('#store-me-actions').getByText(/HG% çizgisini kapat|Bugün için net aksiyon yok/)).toBeVisible()
  await expect(page.locator('#store-me-actions')).not.toContainText('Ritmi koru')
  await expect(page.getByText('Gelişim çizgisi')).toBeVisible()
  await expect(page.getByText('Hedef Gerçekleştirme')).toBeVisible()
  await expect(page.getByText('Skor kırılımı')).toBeVisible()
  await expect(page.getByText('Aynı dönem farkı')).toBeVisible()
  await expect(page.getByRole('button', { name: /Tarih filtresi/i })).toBeVisible()
  await page.getByRole('button', { name: 'KPI detayları' }).click()
  const kpiDetailsDialog = page.getByRole('dialog', { name: /KPI Detayları/i })
  await expect(kpiDetailsDialog).toBeVisible()
  await expect(kpiDetailsDialog).toContainText('Nisan 2026')
  await expect(kpiDetailsDialog).toContainText('Mayıs 2026')
  await expect(kpiDetailsDialog).not.toContainText('CR')
  await expect(page.locator('[data-testid="store-me-metric-card"]')).toHaveCount(3)
  const uptMetricCard = page.locator('[data-testid="store-me-metric-card"]').filter({ hasText: 'UPT' })
  const atvMetricCard = page.locator('[data-testid="store-me-metric-card"]').filter({ hasText: 'ATV' })
  await expect(uptMetricCard).toBeVisible()
  await expect(atvMetricCard).toBeVisible()
  await expect(uptMetricCard.locator('.store-me-kpi-progress')).toContainText('Ortalama Üstü')
  await expect(atvMetricCard.locator('.store-me-kpi-progress')).toContainText('Ortalama Üstü')
  await expect(uptMetricCard.locator('.store-me-kpi-progress')).not.toContainText('100%')
  await expect(atvMetricCard.locator('.store-me-kpi-progress')).not.toContainText('100%')
  await expect(page.locator('[data-testid="store-me-target-progress-card"]')).toContainText('Hedef Gerçekleştirme')
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

test('store self-performance does not treat raw net sales as HG percent when target is missing', async ({ page }) => {
  const missingTargetFixture = {
    ...myPerformanceFixture,
    score: {
      value: 58.2,
      matchedMetrics: 2,
      totalMetrics: 3,
    },
    partial: {
      isPartial: true,
      missingMetricCodes: [],
      missingMetricLabels: [],
      pendingNormalizationCodes: ['TARGET_ACHIEVEMENT'],
      pendingNormalizationLabels: ['Target Achievement'],
    },
    supporting: {
      ...myPerformanceFixture.supporting,
      netSalesValue: 92002.02,
    },
    metrics: myPerformanceFixture.metrics.map((metric) =>
      metric.code === 'TARGET_ACHIEVEMENT'
        ? {
            ...metric,
            actualValue: 92002.02,
            targetValue: null,
            achievementRate: null,
            actualRatio: null,
            scoredRatio: null,
            contributionValue: 0,
            dataStatus: 'reported',
            scoreStatus: 'missing_reference',
            missingReason: 'personnel_target_missing',
          }
        : metric,
    ),
  }

  await page.unroute('**/api/reports/my-performance**')
  await page.route('**/api/reports/my-performance**', async (route) => {
    await route.fulfill({ json: missingTargetFixture })
  })

  await page.goto('/store/me')

  await expect(page.getByText(/Hedefin %0/)).toBeVisible()
  await expect(page.locator('[data-testid="store-me-target-progress-card"]')).toContainText('Veri yok')
  await expect(page.locator('[data-testid="store-me-target-progress-card"]')).toContainText('Hedef Gerçekleştirme')
  await expect(page.getByText(/9\.200\.202%/)).toHaveCount(0)

  await page.getByRole('button', { name: /KPI detay/i }).click()
  await expect(page.locator('[data-testid="store-me-kpi-dialog"]')).not.toContainText(/9\.200\.202%/)
})

test('store self-performance displays target achievement above one hundred percent', async ({ page }) => {
  const aboveTargetFixture = {
    ...myPerformanceFixture,
    supporting: {
      ...myPerformanceFixture.supporting,
      netSalesValue: 136000,
    },
    metrics: myPerformanceFixture.metrics.map((metric) =>
      metric.code === 'TARGET_ACHIEVEMENT'
        ? {
            ...metric,
            actualValue: 1.36,
            achievementRate: 1.36,
            contributionValue: 40,
          }
        : metric,
    ),
  }

  await page.unroute('**/api/reports/my-performance**')
  await page.route('**/api/reports/my-performance**', async (route) => {
    await route.fulfill({ json: aboveTargetFixture })
  })

  await page.goto('/store/me')

  const targetProgressCard = page.locator('[data-testid="store-me-target-progress-card"]')
  await expect(targetProgressCard).toContainText('%136')
  await expect(targetProgressCard).toContainText('136%')
  await expect(targetProgressCard).not.toContainText('%100')
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

  await expect(page.locator('[data-testid="store-me-page"]')).toBeVisible()
  await page.getByRole('button', { name: /KPI detayları/i }).click()
  const kpiDetailsDialog = page.getByRole('dialog', { name: /KPI Detayları/i })
  await expect(kpiDetailsDialog).toBeVisible()
  await expect(kpiDetailsDialog).toContainText('Nisan 2026')
  await expect(kpiDetailsDialog).toContainText('Mayıs 2026')
  expect(pageErrors).toEqual([])
})

test('store self-performance requests an exact full month from the shared calendar', async ({ page }) => {
  const myPerformanceRequests: URL[] = []
  const loadedPeriods = [
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
  ]

  await page.unroute('**/api/reports/my-performance**')
  await page.route('**/api/reports/my-performance**', async (route) => {
    const requestUrl = new URL(route.request().url())
    const requestedPeriodStart = requestUrl.searchParams.get('periodStart')
    myPerformanceRequests.push(requestUrl)

    await route.fulfill({
      json: {
        ...myPerformanceFixture,
        period: {
          periodStart: requestedPeriodStart || '2026-04-01',
          periodEnd: requestedPeriodStart?.startsWith('2026-05') ? '2026-05-31' : '2026-04-30',
        },
        availablePeriods: loadedPeriods,
      },
    })
  })

  await page.goto('/store/me')
  await page.getByRole('button', { name: /Tarih filtresi/i }).click()

  await expect(page.locator('[data-slot="calendar"]')).toBeVisible()
  await page.getByRole('combobox', { name: 'Ay seç' }).selectOption({ index: 4 })
  await page.getByRole('button', { name: 'Uygula' }).click()

  await expect.poll(() =>
    myPerformanceRequests.some(
      (requestUrl) =>
        requestUrl.searchParams.get('periodType') === 'monthly' &&
        requestUrl.searchParams.get('periodStart') === '2026-05-01',
    ),
  ).toBe(true)

  await page.getByRole('button', { name: /KPI detay/i }).click()
  await expect(page.getByRole('dialog', { name: /KPI Detayları/i })).toContainText('Mayıs 2026')
})

test('store self-performance switches to English copy and persists locale', async ({ page }) => {
  await page.goto('/store/me')

  await setStoredLocale(page, 'en')

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.locator('[data-testid="store-me-page"]')).toBeVisible()
  const storeMeHeader = page.locator('.store-me-compact-header')
  await expect(storeMeHeader.getByRole('heading', { name: /Store Personnel/i })).toBeVisible()
  await expect(storeMeHeader).toContainText('IstinyePark Demo Store')
  await expect(page.locator('.store-me-plum-dashboard')).toBeVisible()
  await expect(page.locator('.store-me-kpi-grid')).toBeVisible()
  await expect(page.locator('.store-me-score-chart [data-slot="chart"]')).toBeVisible()
  await expect(page.locator('.store-me-score-breakdown')).toBeVisible()
  await expect(page.getByText("Today's Actions")).toBeVisible()
  await expect(page.locator('#store-me-actions').getByText(/Close the HG% gap|No clear action for today/)).toBeVisible()
  await expect(page.locator('#store-me-actions')).not.toContainText('Maintain the rhythm')
  await expect(page.getByText('Progress line')).toBeVisible()
  await expect(page.locator('[data-testid="store-me-target-progress-card"]').getByText('Target achievement', { exact: true })).toBeVisible()
  await expect(page.getByText('Score breakdown')).toBeVisible()
  await expect(page.getByText('Same-period difference')).toBeVisible()
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
  await expect(page.locator('[data-testid="store-me-page"]')).toBeVisible()
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

  await expect(page.locator('[data-testid="store-me-page"]')).toBeVisible()
  await expect(page.getByText('Seçilen tarih için veri bulunamadı')).toBeVisible()
  await expect(page.getByText('Takvimden başka bir gün veya ay seçebilirsiniz.')).toBeVisible()
  await expect(page.getByText('Performans yüzeyi açılamadı')).toHaveCount(0)
  expect(pageErrors).toEqual([])
})

test('store self-performance date filter uses the shared calendar without closed snapshot controls', async ({ page }) => {
  await page.goto('/store/me')
  await page.getByRole('button', { name: /Tarih filtresi/i }).click()

  await expect(page.getByRole('radio', { name: 'Kapanmış gün' })).toHaveCount(0)
  await expect(page.getByText('Kapanmış performans kaydı seçimi')).toHaveCount(0)
  await expect(page.locator('[data-slot="calendar"]')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Uygula' })).toBeVisible()
})

test('store KPI highlights page explains metric source semantics', async ({ page }) => {
  await page.unroute('**/api/reports/rankings**')
  await page.unroute('**/api/reports/store-kpi-highlights**')
  await page.route('**/api/reports/store-kpi-highlights**', async (route) => {
    const requestUrl = new URL(route.request().url())
    const isMay = requestUrl.searchParams.get('periodStart') === '2026-05-01'

    await route.fulfill({
      json: {
        ...storeKpiHighlightsFixture,
        period: isMay
          ? {
              periodStart: '2026-05-01',
              periodEnd: '2026-05-31',
            }
          : storeKpiHighlightsFixture.period,
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
        metrics: isMay
          ? storeKpiHighlightsFixture.metrics.map((metric) =>
              metric.code === 'TARGET_ACHIEVEMENT'
                ? {
                    ...metric,
                    actualValue: 0.8,
                    achievementRate: 0.8,
                    scoreContribution: 56,
                    statusBand: 'at_risk',
                  }
                : {
                    ...metric,
                    actualValue: 0.9,
                    achievementRate: 0.9,
                    scoreContribution: 27,
                    statusBand: 'at_risk',
                  },
            )
          : storeKpiHighlightsFixture.metrics,
      },
    })
  })
  await page.route('**/api/reports/rankings**', async (route) => {
    await route.fulfill({
      json: {
        ...rankingsFixture,
        personnelLeaderboard: {
          ...rankingsFixture.personnelLeaderboard,
          items: [
            {
              ...personnelRankingSummaryRow,
              employeeId: 'global-personnel-001',
              displayName: 'Global Top Personnel',
              storeId: 'outside-store',
              storeName: 'Outside Store',
              canOpenProfile: false,
              metrics: undefined,
            },
          ],
          managedStorePersonnel: [
            {
              ...personnelRankingRawTargetRow,
              metrics: personnelRankingRawTargetRow.metrics.map((metric) =>
                metric.code === 'TARGET_ACHIEVEMENT'
                  ? {
                      ...metric,
                      targetValue: null,
                      benchmarkValue: null,
                    }
                  : metric,
              ),
            },
          ],
        },
      },
    })
  })

  await page.goto('/store/kpis')

  await expect(page.getByRole('heading', { name: 'IstinyePark Demo Store' })).toBeVisible()
  await expect(page.getByText('Store KPI', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Mağaza Skoru detaylarını aç/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Personel Performansı/ })).toBeVisible()
  await expect(page.getByText('91,5').first()).toBeVisible()
  await expect(page.getByText('GSM Onayı').first()).toBeVisible()
  await expect(page.getByText('Bölge Müdürü Checklist').first()).toBeVisible()
  await expect(page.getByText('VM Checklist').first()).toBeVisible()
  await expect(page.getByText('Aylık Mağaza Skoru')).toBeVisible()
  await expect(page.getByLabel('Aylık mağaza skorları')).toContainText('Nis')
  await expect(page.getByLabel('Aylık mağaza skorları')).toContainText('May')

  await page.getByRole('button', { name: /Personel Performansı/ }).click()

  await expect(page.getByRole('region', { name: 'Personel KPI' })).toBeVisible()
  await expect(page.getByRole('columnheader', { name: 'Mağaza Skor Etkisi' })).toBeVisible()
  await expect(page.getByRole('row', { name: /Store Personnel - 1/ })).toContainText('Hedef bekleniyor')
  await expect(page.getByRole('row', { name: /Store Personnel - 1/ }).getByRole('link', { name: /Detay/ })).toHaveAttribute(
    'href',
    new RegExp(`/store/personnel/${demoEmployeeId}\\?mode=live&periodType=monthly&periodStart=2026-09-01`),
  )
  await expect(page.getByText('Global Top Personnel')).toHaveCount(0)
  await expect(page.getByText('Mağaza Skor Etkisi nasıl hesaplanır?')).toBeVisible()
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

  await page.getByRole('button', { name: /Mağaza Performansı/ }).click()
  await expect(page.getByRole('region', { name: 'Personel KPI' })).toHaveCount(0)
  await expect(page.getByText('Global Top Personnel')).toHaveCount(0)
})

test('store KPI live checklist impact uses completed BM and VM visits from highlights', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('store-ops-app-locale', 'en')
  })

  await page.unroute('**/api/reports/kpi-config')
  await page.unroute('**/api/reports/store-kpi-highlights**')

  await page.route('**/api/reports/kpi-config', async (route) => {
    await route.fulfill({
      json: {
        ...kpiConfigFixture,
        storeProfile: {
          ...kpiConfigFixture.storeProfile,
          metrics: [
            {
              code: 'TARGET_ACHIEVEMENT',
              label: 'Target Achievement',
              weightPercent: 90,
              ownerRole: 'STORE_MANAGER',
              scoreBehavior: 'score_only',
            },
            {
              code: 'BM_CHECKLIST',
              label: 'BM Checklist',
              weightPercent: 5,
              ownerRole: 'REGION_MANAGER',
              scoreBehavior: 'score_only',
            },
            {
              code: 'VM_CHECKLIST',
              label: 'VM Checklist',
              weightPercent: 5,
              ownerRole: 'VISUAL_TEAM',
              scoreBehavior: 'score_only',
            },
          ],
        },
      },
    })
  })

  await page.route('**/api/reports/store-kpi-highlights**', async (route) => {
    await route.fulfill({
      json: {
        ...storeKpiHighlightsFixture,
        score: {
          value: 99,
          matchedMetrics: 3,
          totalMetrics: 3,
        },
        metrics: [
          {
            code: 'TARGET_ACHIEVEMENT',
            label: 'Target Achievement',
            weightPercent: 90,
            actualValue: 1,
            targetValue: 1,
            achievementRate: 1,
            actualRatio: 1,
            scoredRatio: 1,
            capRatio: 1.2,
            isCapped: false,
            scoreContribution: 90,
            statusBand: 'exceeded',
            dataStatus: 'reported',
            scoreStatus: 'scored',
          },
          {
            code: 'BM_CHECKLIST',
            label: 'BM Checklist',
            weightPercent: 5,
            actualValue: 80,
            targetValue: 100,
            achievementRate: 0.8,
            actualRatio: 0.8,
            scoredRatio: 0.8,
            capRatio: 1,
            isCapped: false,
            scoreContribution: 4,
            statusBand: 'on_track',
            dataStatus: 'reported',
            scoreStatus: 'scored',
          },
          {
            code: 'VM_CHECKLIST',
            label: 'VM Checklist',
            weightPercent: 5,
            actualValue: 100,
            targetValue: 100,
            achievementRate: 1,
            actualRatio: 1,
            scoredRatio: 1,
            capRatio: 1,
            isCapped: false,
            scoreContribution: 5,
            statusBand: 'exceeded',
            dataStatus: 'reported',
            scoreStatus: 'scored',
          },
        ],
      },
    })
  })

  await page.goto('/store/kpis')

  await expect(page.getByRole('heading', { name: 'IstinyePark Demo Store' })).toBeVisible()
  await expect(page.getByRole('row', { name: /Region Manager Checklist/ })).toContainText('4.00 pts')
  await expect(page.getByRole('row', { name: /VM Checklist/ })).toContainText('5.00 pts')
  await expect(page.getByText('Passive')).toHaveCount(0)
})

test('region manager store KPI overview waits for selected store before loading detail highlights', async ({ page }) => {
  const rankingRequests: URL[] = []
  const highlightRequests: URL[] = []
  const regionStoreRows = Array.from({ length: 9 }, (_, index) => {
    const storeNumber = index + 1
    return {
      ...rankingsPrivilegedDetailStoreRow,
      storeId: index === 0 ? 'store-high-hg' : `store-region-${storeNumber}`,
      storeName: index === 0 ? 'High HG Store' : `Region Store ${storeNumber}`,
      rank: storeNumber,
      population: 9,
      scoreValue: 91.4 - index,
      metrics:
        index === 2
          ? rankingsPrivilegedDetailStoreRow.metrics.filter((metric) => metric.code !== 'VM_CHECKLIST')
          : rankingsPrivilegedDetailStoreRow.metrics,
    }
  })
  let storeLeaderboardTotal = regionStoreRows.length
  const regionKpiAvailablePeriods = [
    ...rankingsAvailablePeriods,
    {
      periodType: 'monthly',
      periodStart: '2026-05-01',
      periodEnd: '2026-05-31',
    },
  ]

  await page.unroute('**/api/auth/session')
  await page.unroute('**/api/reports/rankings**')
  await page.unroute('**/api/reports/store-kpi-highlights**')

  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({
      json: {
        ...authSessionFixture,
        user: {
          ...authSessionFixture.user,
          userId: 'region-kpi-user',
          employeeId: null,
          roleCodes: ['REGION_MANAGER', 'STORE_MANAGER'],
          scope: {
            ...authSessionFixture.user.scope,
            storeIds: [regionStoreRows[0].storeId],
          },
          readScope: {
            ...authSessionFixture.user.readScope,
            storeIds: regionStoreRows.map((row) => row.storeId),
          },
          actionScope: {
            assignedStoreIds: [regionStoreRows[0].storeId],
          },
          assignedStoreIds: [regionStoreRows[0].storeId],
        },
        scopeSummary: {
          ...authSessionFixture.scopeSummary,
          assignedStoreCount: 1,
        },
      },
    })
  })

  await page.route('**/api/reports/rankings**', async (route) => {
    const requestUrl = new URL(route.request().url())
    const periodStart = requestUrl.searchParams.get('periodStart') ?? '2026-04-01'
    rankingRequests.push(requestUrl)
    await route.fulfill({
      json: {
        ...rankingsPrivilegedDetailFixture,
        source: {
          ...rankingsPrivilegedDetailFixture.source,
          periodStart,
          periodEnd: periodStart === '2026-05-01' ? '2026-05-31' : '2026-04-30',
        },
        availablePeriods: regionKpiAvailablePeriods,
        filters: {
          ...rankingsPrivilegedDetailFixture.filters,
          stores: regionStoreRows.map((row) => ({ id: row.storeId, label: row.storeName })),
        },
        storeLeaderboard: {
          ...rankingsPrivilegedDetailFixture.storeLeaderboard,
          items: regionStoreRows,
          currentStore: regionStoreRows[0],
          meta: {
            ...rankingsPrivilegedDetailFixture.storeLeaderboard.meta,
            total: storeLeaderboardTotal,
          },
        },
      },
    })
  })

  await page.route('**/api/reports/store-kpi-highlights**', async (route) => {
    const url = new URL(route.request().url())
    const selectedStoreId = url.searchParams.get('storeId') ?? 'store-high-hg'
    const selectedStore = regionStoreRows.find((row) => row.storeId === selectedStoreId)
    highlightRequests.push(url)
    await route.fulfill({
      json: {
        ...storeKpiHighlightsFixture,
        store: {
          storeId: selectedStoreId,
          storeName: selectedStore?.storeName ?? 'Selected Store',
        },
      },
    })
  })

  await page.goto('/store/kpis')

  await expect(page.getByTestId('store-kpis-region-overview')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Bölge Performansı' })).toBeVisible()
  await expect(page.getByRole('table', { name: 'Mağaza KPI değerleri' })).toBeVisible()
  await expect(page.getByRole('columnheader', { name: 'BM' })).toBeVisible()
  await expect(page.getByRole('columnheader', { name: 'VM' })).toBeVisible()
  await expect(page.getByRole('columnheader', { name: /GSM/ })).toBeVisible()
  await expect(
    page.getByTestId('store-kpis-region-overview').getByText('Region Store 9').first(),
  ).toBeVisible()
  await expect(page.getByRole('link', { name: /— Detay/ })).toHaveCount(regionStoreRows.length)
  await expect(page.getByRole('link', { name: 'Region Store 9 — Detay' })).toBeVisible()
  await page.setViewportSize({ width: 390, height: 900 })
  await expect(page.getByTestId('store-kpis-region-overview')).toBeInViewport()
  await page.setViewportSize({ width: 1440, height: 900 })
  storeLeaderboardTotal = 120
  await page.reload()
  await expect(page.getByRole('textbox', { name: 'Bu sayfada mağaza ara' })).toBeVisible()
  await expect(page.getByRole('table', { name: 'Mağaza KPI değerleri' })).toBeVisible()
  storeLeaderboardTotal = regionStoreRows.length
  await page.reload()
  await expect(page.getByRole('table', { name: 'Mağaza KPI değerleri' })).toBeVisible()
  expect(rankingRequests.length).toBeGreaterThan(0)
  expect(rankingRequests.at(-1)?.searchParams.get('regionManagerUserId')).toBe('region-kpi-user')
  await expect.poll(() => rankingRequests.at(-1)?.searchParams.get('periodStart')).toBe('2026-05-01')
  expect(rankingRequests.at(-1)?.searchParams.get('sortKey')).toBe('score')
  expect(rankingRequests.at(-1)?.searchParams.get('sortDirection')).toBe('desc')
  expect(highlightRequests).toHaveLength(0)

  await page.getByRole('button', { name: 'Müdür KPI dönemi' }).click()
  await page.getByRole('combobox', { name: 'Ay seç' }).selectOption({ index: 3 })
  await page.getByRole('button', { name: 'Tüm ay' }).click()
  await expect.poll(() => rankingRequests.at(-1)?.searchParams.get('periodStart')).toBe('2026-04-01')

  const readsBeforeLocalSort = rankingRequests.length
  await page.getByRole('columnheader', { name: /UPT/ }).getByRole('button').click()
  expect(rankingRequests).toHaveLength(readsBeforeLocalSort)

  await page.getByRole('columnheader', { name: /UPT/ }).getByRole('button').click()
  expect(rankingRequests).toHaveLength(readsBeforeLocalSort)
  expect(highlightRequests).toHaveLength(0)

  await page.getByRole('columnheader', { name: /GSM/ }).getByRole('button').click()
  expect(rankingRequests).toHaveLength(readsBeforeLocalSort)

  await page.getByRole('link', { name: 'Region Store 9 — Detay' }).click()

  await expect(page).toHaveURL(/\/store\/kpis\?storeId=store-region-9&periodStart=2026-04-01/)
  await expect.poll(() => highlightRequests.length).toBeGreaterThan(0)
  expect(highlightRequests.at(-1)?.searchParams.get('storeId')).toBe('store-region-9')
  expect(highlightRequests.at(-1)?.searchParams.get('periodStart')).toBe('2026-04-01')
  await expect(page.getByRole('button', { name: 'Kapanmış gün' })).toHaveCount(0)
})

test('store KPI highlights switches to English copy and persists locale', async ({ page }) => {
  await page.goto('/store/kpis')

  await setStoredLocale(page, 'en')

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('heading', { name: 'IstinyePark Demo Store' })).toBeVisible()
  await expect(page.getByText('Store Performance', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: /Personnel Performance/ })).toBeVisible()
  await expect(page.getByText('Store Score', { exact: true })).toBeVisible()
  await expect(page.getByRole('columnheader', { name: 'Score Contribution' })).toBeVisible()
  await expect(page.getByText('Checklist score contribution')).toBeVisible()
  await page.getByRole('button', { name: /Personnel Performance/ }).click()
  await expect(page.getByText('How is store score impact allocated?')).toBeVisible()
  await expect(page.getByText("Mağaza KPI'ları")).toHaveCount(0)
  await expect(page.getByText('Mağaza skor özeti')).toHaveCount(0)
  await expect(page.locator('body')).not.toContainText('Ãƒ')
  await expect(page.locator('body')).not.toContainText('Ã„')
  await expect(page.locator('body')).not.toContainText('Ã…')

  await page.reload()

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByText('Store Performance', { exact: true })).toBeVisible()
})
