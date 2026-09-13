import { expect, test, type Page } from './test-fixtures'

const companyId = '00000000-0000-0000-0000-000000000001'
const demoStoreId = '00000000-0000-0000-0000-000000000100'
const demoRegionId = '00000000-0000-0000-0000-000000000010'

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-06-29T12:00:00.000Z'))
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
  await packageSections.locator('summary').click()
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

test('store managers can read their store report without a manager directory', async ({ page }) => {
  await routeAuthSession(page, ['STORE_MANAGER'])

  await page.goto('/store/home')
  await expect(page.locator('.store-command-nav a[href="/store/reports"]')).toBeVisible()

  await page.goto('/store/reports')
  await expect(page.getByRole('heading', { name: 'Raporlar', exact: true })).toBeVisible()
  await expect(page.locator('.operations-directory')).toHaveCount(0)
})

test('store reports route is visible for region managers', async ({ page }) => {
  await page.goto('/store/home')

  const reportsLink = page.locator('.store-command-nav a[href="/store/reports"]')
  await expect(reportsLink).toBeVisible()
  await reportsLink.click()

  await expect(page).toHaveURL(/\/store\/reports$/)
  await expect(page.getByRole('heading', { name: 'Raporlar' })).toBeVisible()
})

test('report viewers select manager user IDs for the report and Excel, including empty managers', async ({ page }) => {
  await routeAuthSession(page, ['REPORT_VIEWER'])
  await page.route('**/api/org/region-managers', route => route.fulfill({ json: { items: [
    { userId: '11111111-1111-4111-8111-111111111111', displayName: 'Deniz Kaya', storeIds: [demoStoreId] },
    { userId: '22222222-2222-4222-8222-222222222222', displayName: 'Ece Yılmaz', storeIds: [] },
  ] } }))
  await page.goto('/store/reports')
  const reportRequest = page.waitForRequest(request => request.url().includes('store-monthly-package?') && new URL(request.url()).searchParams.get('regionManagerUserId') === '11111111-1111-4111-8111-111111111111')
  await page.getByRole('radio', { name: /Deniz Kaya/ }).click()
  await reportRequest
  await expect(page.getByRole('button', { name: 'Excel indir', exact: true })).toBeEnabled()
  const exportRequest = page.waitForRequest(request => request.url().includes('store-monthly-package.xlsx?') && new URL(request.url()).searchParams.get('regionManagerUserId') === '11111111-1111-4111-8111-111111111111')
  await page.getByRole('button', { name: 'Excel indir', exact: true }).click()
  await exportRequest
  await page.getByRole('radio', { name: /Ece Yılmaz/ }).click()
  await expect(page.getByText('Bu seçimde rapor kaydı yok.')).toBeVisible()
  await expect(page.getByRole('radio', { name: /Ece Yılmaz/ })).toBeVisible()
})

test('store report search and tabs expose recorded data without changing export scope', async ({ page }) => {
  await page.goto('/store/reports')
  const report = page.getByRole('region', { name: 'Mağaza raporu' })
  await expect(report.getByRole('cell', { name: '87,20', exact: true })).toBeVisible()
  await page.getByRole('tab', { name: 'Operasyon', exact: true }).click()
  await expect(report.getByRole('cell', { name: 'Devam ediyor', exact: true })).toBeVisible()
  await page.getByRole('textbox', { name: 'Mağaza veya bölge ara' }).fill('olmayan mağaza')
  await expect(page.getByText('Eşleşen mağaza bulunamadı.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Excel indir', exact: true })).toBeEnabled()
})

test('store reports period picker keeps month semantics in the shared calendar', async ({ page }) => {
  await page.goto('/store/reports')

  await page.getByRole('button', { name: 'Dönem seç' }).click()
  const popover = page.getByRole('dialog', { name: 'Dönem seç' })

  await expect(popover).toBeVisible()
  await expect(popover.getByRole('combobox', { name: 'Yıl seç' })).toBeVisible()
  await popover.getByRole('combobox', { name: 'Ay seç' }).selectOption('4')
  await popover.getByRole('button', { name: 'Uygula' }).click()
  await expect(page.getByRole('button', { name: 'Dönem seç' })).toContainText('Mayıs 2026')
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
  let downloadCalls = 0

  await page.route('**/api/reports/store-monthly-package.xlsx**', async (route) => {
    downloadCalls += 1
    await route.fulfill({ status: 500, json: { message: 'download failed' } })
  })

  await page.goto('/store/reports')
  await page.getByRole('button', { name: /Excel indir/i }).click()

  await expect.poll(() => downloadCalls).toBe(1)
  await expect(
    page.locator('.hr-axis-toast__title').getByText('Excel indirilemedi. Dönemi kontrol edip tekrar deneyin.'),
  ).toBeVisible()
  await expect(page.getByText('download failed')).toHaveCount(0)
})

test('store reports page stays within desktop and mobile viewport width', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 })
  await page.goto('/store/reports')
  await expectNoHorizontalOverflow(page)
  await expect(page.locator('.src-metric-label svg').first()).toBeVisible()

  await page.setViewportSize({ width: 390, height: 900 })
  await page.reload()
  await expectNoHorizontalOverflow(page)
  await expect(page.locator('.src-package')).toBeVisible()
})

test('report columns remain reachable and row separators survive desktop and mobile layouts', async ({ page }) => {
  await page.goto('/store/reports')
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 })
    await expect(page.getByRole('table', { name: 'Mağaza raporu' })).toBeVisible()
    for (const tab of ['KPI ve skorlar', 'Operasyon']) {
      await page.getByRole('tab', { name: tab, exact: true }).click()
      const table = page.getByRole('table', { name: 'Mağaza raporu' })
      await expect(table.getByRole('cell').last()).toBeVisible()
      await expect(table.locator('tbody tr').first()).toHaveCSS('border-bottom-width', '1px')
      const geometry = await table.evaluate(element => {
        const board = element.closest('.src-records')!.getBoundingClientRect()
        const cells = Array.from(element.querySelectorAll('tbody td')).map(cell => cell.getBoundingClientRect())
        return cells.every(cell => cell.left >= board.left && cell.right <= board.right)
      })
      expect(geometry).toBe(true)
      await expectNoHorizontalOverflow(page)
    }
    await expect(page.getByRole('button', { name: 'Excel indir', exact: true })).toHaveCSS('background-image', 'none')
  }
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
    const emptyManager = new URL(route.request().url()).searchParams.get('regionManagerUserId') === '22222222-2222-4222-8222-222222222222'

    await route.fulfill({
      json: {
        period,
        periodLabel: may ? 'Mayıs 2026' : 'Haziran 2026',
        coverageLabel: may ? '1-31 Mayıs' : '1-29 Haziran',
        isCurrentPeriod: !may,
        storeCount: emptyManager ? 0 : 30,
        sections: [
          { code: 'kpis', label: 'KPI kolonları', value: 'Skor, UPT, ATV, CR, HG%', status: 'ready' },
          { code: 'approval_scores', label: 'Onay skorları', value: 'GSM, BM Checklist, VM Checklist', status: 'ready' },
          { code: 'actions', label: 'Aksiyon durumu', value: 'Bitirildi, devam ediyor, bekliyor', status: 'ready' },
          { code: 'targets', label: 'Hedefler', value: 'Mağaza ve personel hedef durumu', status: 'ready' },
          { code: 'incentives', label: 'Primler', value: 'Hakediş ve kontrol durumu', status: 'ready' },
          { code: 'workforce', label: 'Norm Kadro', value: 'Aktif, norm, eksik gün, turnover', status: 'ready' },
          { code: 'visits', label: 'Ziyaret', value: 'Son ziyaret ve geçen gün', status: 'ready' },
        ],
        items: emptyManager ? [] : [
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
