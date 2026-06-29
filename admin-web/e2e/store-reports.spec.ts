import { expect, test, type Page } from './test-fixtures'

const companyId = '00000000-0000-0000-0000-000000000001'
const demoStoreId = '00000000-0000-0000-0000-000000000100'
const demoRegionId = '00000000-0000-0000-0000-000000000010'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'store-ops-admin-session',
      JSON.stringify({
        mode: 'mock',
        mockUserId: 'store-reports-e2e-user',
        mockRoleCodes: 'REGION_MANAGER',
        mockCompanyIds: '00000000-0000-0000-0000-000000000001',
        bearerToken: '',
      }),
    )
  })

  await routeAuthSession(page, ['REGION_MANAGER'])
  await routeReportPackage(page)
})

test('store reports product page renders the package contract for region managers', async ({ page }) => {
  await page.goto('/store/reports')

  await expect(page.locator('.store-reports-command')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Raporlar' })).toBeVisible()
  await expect(page.getByText('Dönem rapor paketi, modül özetleri ve detay dışa aktarım.')).toBeVisible()
  await expect(page.getByText('Dönem paketi')).toBeVisible()
  await expect(page.getByText('Kapsam', { exact: true })).toBeVisible()
  await expect(page.getByText('Detay çıktı')).toBeVisible()
  await expect(page.getByRole('heading', { name: /Haziran 2026 Mağaza İzleyiş Exceli/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /Excel indir/i })).toBeVisible()

  const packageSections = page.getByLabel('Paket içeriği')
  for (const section of [
    'KPI kolonları',
    'Onay skorları',
    'Aksiyon durumu',
    'Hedefler',
    'Primler',
    'Norm Kadro',
    'Ziyaret',
  ]) {
    await expect(packageSections.getByText(section, { exact: true })).toBeVisible()
  }

  await expect(page.getByText('Raporları aç')).toHaveCount(0)
  await expect(page.getByText('/admin/reports')).toHaveCount(0)
})

test('store reports route is hidden for store managers and direct access is denied', async ({ page }) => {
  await routeAuthSession(page, ['STORE_MANAGER'])

  await page.goto('/store/home')
  await expect(page.locator('.store-command-nav a[href="/store/reports"]')).toHaveCount(0)

  await page.goto('/store/reports')
  await expect(page.getByRole('heading', { name: /rota kullan|Route not available/i })).toBeVisible()
  await expect(page.locator('.store-reports-command')).toHaveCount(0)
})

test('store reports route is visible for region managers', async ({ page }) => {
  await page.goto('/store/home')

  const reportsLink = page.locator('.store-command-nav a[href="/store/reports"]')
  await expect(reportsLink).toBeVisible()
  await reportsLink.click()

  await expect(page).toHaveURL(/\/store\/reports$/)
  await expect(page.getByRole('heading', { name: 'Raporlar' })).toBeVisible()
})

test('store reports period picker is month-year only and blocks future months', async ({ page }) => {
  await page.goto('/store/reports')

  await page.getByRole('button', { name: /Haziran 2026/i }).click()
  const popover = page.locator('.src-period-popover')

  await expect(popover).toBeVisible()
  await expect(popover.getByRole('combobox', { name: 'Yıl seç' })).toBeVisible()
  await expect(popover.getByText('Pt')).toHaveCount(0)
  await expect(popover.getByText('Pz')).toHaveCount(0)
  await expect(popover.getByRole('button', { name: /^1$/ })).toHaveCount(0)
  await expect(popover.getByRole('button', { name: 'Tem' })).toBeDisabled()

  await popover.getByRole('button', { name: 'May' }).click()
  await expect(page.getByRole('button', { name: /Mayıs 2026/i })).toBeVisible()
  await expect(page.getByText('1-31 Mayıs')).toBeVisible()
})

test('store reports Excel action calls the scoped export endpoint once', async ({ page }) => {
  let downloadCalls = 0
  let releaseDownload: (() => void) | null = null
  const pendingDownload = new Promise<void>((resolve) => {
    releaseDownload = resolve
  })

  await page.unroute('**/api/reports/store-monthly-package.xlsx?**')
  await page.route('**/api/reports/store-monthly-package.xlsx?**', async (route) => {
    downloadCalls += 1
    await pendingDownload
    await route.fulfill({
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      body: 'store-report-package',
    })
  })

  await page.goto('/store/reports')

  const downloadButton = page.getByRole('button', { name: /Excel indir/i })
  await downloadButton.click()
  await expect(page.getByRole('button', { name: /Hazırlanıyor/i })).toBeDisabled()

  releaseDownload?.()
  await expect.poll(() => downloadCalls).toBe(1)
})

test('store reports Excel action shows product copy when download fails', async ({ page }) => {
  await page.unroute('**/api/reports/store-monthly-package.xlsx?**')
  await page.route('**/api/reports/store-monthly-package.xlsx?**', async (route) => {
    await route.fulfill({ status: 500, json: { message: 'download failed' } })
  })

  await page.goto('/store/reports')
  await page.getByRole('button', { name: /Excel indir/i }).click()

  await expect(page.getByText('Excel indirilemedi. Dönemi kontrol edip tekrar deneyin.')).toBeVisible()
  await expect(page.getByText('download failed')).toHaveCount(0)
})

test('store reports page stays within desktop and mobile viewport width', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 })
  await page.goto('/store/reports')
  await expectNoHorizontalOverflow(page)
  await expect(page.locator('.src-metric-icon').first()).toBeVisible()

  await page.setViewportSize({ width: 390, height: 900 })
  await page.reload()
  await expectNoHorizontalOverflow(page)
  await expect(page.locator('.src-package-card')).toBeVisible()
})

async function routeAuthSession(page: Page, roleCodes: string[]) {
  await page.unroute('**/api/auth/session').catch(() => undefined)
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({
      json: {
        authMode: 'mock',
        authenticated: true,
        user: {
          userId: 'store-reports-e2e-user',
          employeeId: null,
          roleCodes,
          scope: {
            companyIds: [companyId],
            regionIds: [demoRegionId],
            storeIds: roleCodes.includes('STORE_MANAGER') ? [demoStoreId] : [],
          },
          readScope: {
            companyIds: [companyId],
            regionIds: [demoRegionId],
            storeIds: roleCodes.includes('STORE_MANAGER') ? [demoStoreId] : [],
          },
          actionScope: {
            assignedStoreIds: roleCodes.includes('STORE_MANAGER') ? [demoStoreId] : [],
            assignedStoreTypes: roleCodes.includes('STORE_MANAGER') ? ['company'] : [],
          },
          assignedStoreIds: roleCodes.includes('STORE_MANAGER') ? [demoStoreId] : [],
        },
        scopeSummary: {
          companyCount: 1,
          regionCount: 1,
          storeCount: roleCodes.includes('STORE_MANAGER') ? 1 : 30,
          assignedStoreCount: roleCodes.includes('STORE_MANAGER') ? 1 : 0,
        },
      },
    })
  })
}

async function routeReportPackage(page: Page) {
  await page.route('**/api/reports/store-monthly-package?**', async (route) => {
    const period = new URL(route.request().url()).searchParams.get('period') ?? '2026-06'
    const may = period === '2026-05'

    await route.fulfill({
      json: {
        period,
        periodLabel: may ? 'Mayıs 2026' : 'Haziran 2026',
        coverageLabel: may ? '1-31 Mayıs' : '1-29 Haziran',
        isCurrentPeriod: !may,
        storeCount: 30,
        sections: [
          { code: 'kpis', label: 'KPI kolonları', value: 'Skor, UPT, ATV, CR, HG%', status: 'ready' },
          { code: 'approval_scores', label: 'Onay skorları', value: 'GSM, BM Checklist, VM Checklist', status: 'ready' },
          { code: 'actions', label: 'Aksiyon durumu', value: 'Bitirildi, devam ediyor, bekliyor', status: 'ready' },
          { code: 'targets', label: 'Hedefler', value: 'Mağaza ve personel hedef durumu', status: 'ready' },
          { code: 'incentives', label: 'Primler', value: 'Hakediş ve kontrol durumu', status: 'ready' },
          { code: 'workforce', label: 'Norm Kadro', value: 'Aktif, norm, eksik gün, turnover', status: 'ready' },
          { code: 'visits', label: 'Ziyaret', value: 'Son ziyaret ve geçen gün', status: 'ready' },
        ],
        items: [
          {
            regionManager: 'Onur Kaytan',
            storeName: 'IstinyePark Demo Store',
            city: 'İstanbul',
            period: may ? 'Mayıs 2026' : 'Haziran 2026',
            reportRange: may ? '1-31 Mayıs' : '1-29 Haziran',
            score: '87,20',
            upt: '4,12',
            atv: '4.850,00',
            cr: '%22,4',
            hg: '%104,5',
            gsm: '%96',
            bmChecklist: '91',
            vmChecklist: '88',
            actionStatus: 'Devam ediyor',
            targetStatus: 'Onaylandı',
            incentiveStatus: 'Kontrol edildi',
            normFiili: '6 / 6',
            missingDays: 'Yok',
            turnover: 'Veri yok',
            lastVisit: '14 Haziran',
            daysSinceVisit: '15 gün',
            dataNote: '',
          },
        ],
      },
    })
  })

  await page.route('**/api/reports/store-monthly-package.xlsx?**', async (route) => {
    await route.fulfill({
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      body: 'store-report-package',
    })
  })
}

async function expectNoHorizontalOverflow(page: Page) {
  await expect.poll(
    () => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
  ).toBe(true)
}
