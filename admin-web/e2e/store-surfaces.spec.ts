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

  await expect(page.getByRole('heading', { name: /Benim performansım/i })).toBeVisible()
  await expect(page.getByText('Performans özeti')).toBeVisible()
  await expect(page.getByText('Dönem performansı')).toBeVisible()
  await expect(page.getByText('Türkiye sıram')).toBeVisible()
  await expect(page.getByText('Mağaza içi sıram')).toBeVisible()
  await expect(page.getByText('Skor yorumu')).toBeVisible()
  await expect(page.getByText('Güçlü performans')).toBeVisible()
  await expect(page.getByText('Hedef girişi')).toBeVisible()
  await expect(page.getByText('A A - Mükemmel', { exact: true })).toBeVisible()
  await expect(page.getByText('Veri güveni: 3/3 metrik skorlandı.')).toBeVisible()
  await expect(page.getByText('Veri kaynağı').first()).toBeVisible()
  await expect(page.getByText('Hedef bazlı skor')).toBeVisible()
  await expect(page.getByText('Gerçekleşen').first()).toBeVisible()
  await expect(page.getByText('Başarı').first()).toBeVisible()
  await expect(page.getByText('TARGET_ACHIEVEMENT')).toBeVisible()
  await expect(page.getByText('ATV', { exact: true })).toBeVisible()
  await expect(page.getByText('UPT', { exact: true })).toBeVisible()
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

  await expect(page.getByRole('heading', { name: /Benim performansım/i })).toBeVisible()
  await expect(page.getByText('Bu skor şu an kısmi veriyle hesaplanıyor')).toBeVisible()
  await expect(page.getByText('Power BI importundan gelen satış verisi yok.')).toBeVisible()
  await expect(page.getByText('Performans yüzeyi açılamadı')).toHaveCount(0)
  expect(pageErrors).toEqual([])
})

test('store self-performance closed mode uses readable snapshot labels', async ({ page }) => {
  await page.goto('/store/me')
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

test('store shell exposes Turkish-first chrome and hides technical auth roles', async ({ page }) => {
  await page.goto('/store/me')

  await expect(page.getByRole('main', { name: 'Store workspace' })).toBeVisible()
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

test('store rankings page renders closed leaderboard and metric mini-ranks', async ({ page }) => {
  await page.goto('/store/rankings')

  await expect(page.getByRole('heading', { name: /Mağaza ve personel sıralamaları/i })).toBeVisible()
  await expect(
    page.getByRole('option', {
      name: /1 Nis 2026 - 30 Nis 2026/,
    }),
  ).toBeAttached()
  await expect(page.getByRole('heading', { name: 'Top 100 görünümü' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Türkiye mağaza sıralaması' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Türkiye personel sıralaması' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Kendi mağaza sırası' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Kendi personel sırası' })).toBeVisible()
  await expect(page.getByText('Store Personnel - 1').first()).toBeVisible()
  await expect(page.getByLabel('Sıralama metrik detayları').first()).toBeVisible()
  await expect(page.getByText('Magaza ve personel rankingleri')).toHaveCount(0)
  await expect(page.getByText('Top 100 gorunumu')).toHaveCount(0)
  await expect(page.getByText('Turkiye magaza siralamasi')).toHaveCount(0)
  await expect(page.getByText('Turkiye personel siralamasi')).toHaveCount(0)
  await expect(page.getByText('Kendi magaza sirasi')).toHaveCount(0)
  await expect(page.getByText('Kendi personel sirasi')).toHaveCount(0)
  await expect(page.getByText('Siralama yuzeyi acilamadi')).toHaveCount(0)
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
  await expect(page.getByText('Top 100', { exact: true })).toBeVisible()
  await expect(page.getByText('Global liste Top 100 özet; kendi konumun ayrıca görünür.')).toBeVisible()
  await expect(page.getByText('Global liste Top 100 ozet; kendi konumun ayrica gorunur.')).toHaveCount(0)
  await expect(page.getByText('Siralama yuzeyi acilamadi')).toHaveCount(0)
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

test('store competitions page renders scoped contribution details', async ({ page }) => {
  await page.goto('/store/competitions')

  await expect(page.getByRole('heading', { name: /Store competitions/i })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'April Region Challenge' })).toBeVisible()
  const readSummary = page.getByLabel('Store competition read summary')
  const contributionRows = page.getByLabel('Scoped store competition contributions')
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

  const sellerCodeForm = page.getByLabel('Seller code request form')
  await expect(sellerCodeForm.getByRole('heading', { name: 'Satici kodu talebi' })).toBeVisible()
  await expect(sellerCodeForm.getByLabel('Seller code', { exact: true })).toHaveCount(0)
  await sellerCodeForm.getByLabel('First name').fill('Ayse')
  await sellerCodeForm.getByLabel('Last name').fill('Yilmaz')
  await sellerCodeForm.getByLabel('TC kimlik no').fill('12345678901')
  await sellerCodeForm.getByLabel('Phone number').fill('05551234567')
  await sellerCodeForm.getByLabel('Hire date').fill('2026-05-01')
  await expect(sellerCodeForm.getByLabel('Position', { exact: true })).toContainText('Sales Consultant')
  await sellerCodeForm.getByLabel('Position', { exact: true }).selectOption(demoPositionId)
  await sellerCodeForm.getByLabel('Request reason').fill('Yeni personel')
  await sellerCodeForm.getByRole('button', { name: 'Submit seller code request' }).click()

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
      targetLabel: 'Aylik personel hedef dagitimi',
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
            targetLabel: 'Aylik personel hedef dagitimi',
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

  const targetHeading = page.getByRole('heading', { name: 'Submit a target distribution request' })
  await expect(targetHeading).toBeVisible()
  const targetForm = targetHeading.locator('xpath=ancestor::article[1]')
  await expect(targetForm.getByText('Store Personnel')).toBeVisible()
  await targetForm.getByLabel('Request month').fill('2026-04')
  await targetForm.getByLabel('Total target value').fill('100000')
  await targetForm.getByLabel('Personel target value').fill('100000')
  await targetForm.getByRole('button', { name: 'Submit for region approval' }).click()

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

  const offboardingForm = page.getByLabel('Offboarding request form')
  await expect(offboardingForm.getByRole('heading', { name: 'Personel cikis talebi' })).toBeVisible()
  await expect(offboardingForm.getByLabel('Employee')).toContainText('Store Personnel')
  await offboardingForm.getByLabel('Employee').selectOption(demoEmployeeId)
  await offboardingForm.getByLabel('Termination date').fill('2026-05-10')
  await offboardingForm.getByLabel('Termination reason').fill('resignation')
  await offboardingForm.getByLabel('Request reason').fill('Personel istifa etti')
  await offboardingForm.getByRole('button', { name: 'Submit offboarding request' }).click()

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

  const returnedPanel = page.getByLabel('Returned workforce requests')
  await expect(returnedPanel.getByText('TC numarasi tekrar kontrol edilmeli')).toBeVisible()
  await expect(returnedPanel.getByText('Cikis tarihi tekrar kontrol edilmeli')).toBeVisible()

  await returnedPanel.getByRole('button', { name: 'Edit seller code request' }).click()
  const sellerCodeForm = page.getByLabel('Seller code request form')
  await expect(sellerCodeForm.getByLabel('First name')).toHaveValue('Ayse')
  await expect(sellerCodeForm.getByLabel('Last name')).toHaveValue('Yilmaz')
  await sellerCodeForm.getByLabel('TC kimlik no').fill('12345678902')
  await sellerCodeForm.getByLabel('Hire date').fill('2026-05-02')
  await sellerCodeForm.getByLabel('Request reason').fill('TC guncellendi')
  await sellerCodeForm.getByRole('button', { name: 'Resubmit seller code request' }).click()
  await expect(page.getByText('Seller code request resubmitted for HR approval')).toBeVisible()

  await returnedPanel.getByRole('button', { name: 'Edit offboarding request' }).click()
  const offboardingForm = page.getByLabel('Offboarding request form')
  await offboardingForm.getByLabel('Termination date').fill('2026-05-12')
  await offboardingForm.getByLabel('Termination reason').fill('transfer')
  await offboardingForm.getByLabel('Request reason').fill('Tarih ve sebep guncellendi')
  await offboardingForm.getByRole('button', { name: 'Resubmit offboarding request' }).click()
  await expect(page.getByText('Offboarding request resubmitted for HR approval')).toBeVisible()

  expect(capturedSellerPayloads).toHaveLength(1)
  expect(capturedOffboardingPayloads).toHaveLength(1)
})

test('language toggle localizes competition read labels and persists preference', async ({ page }) => {
  await page.goto('/store/competitions')

  const readSummary = page.getByLabel('Store competition read summary')
  const contributionRows = page.getByLabel('Scoped store competition contributions')

  await expect(readSummary.getByRole('heading', { name: 'Okuma özeti' })).toBeVisible()
  await expect(readSummary.getByText('95% katkı kapsamı')).toBeVisible()
  await expect(contributionRows.getByText('Katkı sağlığı')).toBeVisible()
  await expect(contributionRows.getByText('Kısmi katkı').first()).toBeVisible()

  await page.getByRole('button', { name: 'İngilizceye geç' }).click()

  await expect(readSummary.getByRole('heading', { name: 'Read summary' })).toBeVisible()
  await expect(readSummary.getByText('95% contribution coverage')).toBeVisible()
  await expect(contributionRows.getByText('Contribution health')).toBeVisible()
  await expect(contributionRows.getByText('Partial contribution').first()).toBeVisible()

  await page.reload()

  await expect(readSummary.getByRole('heading', { name: 'Read summary' })).toBeVisible()
  await expect(contributionRows.getByText('Contribution health')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Switch language to Turkish' })).toHaveAttribute(
    'aria-pressed',
    'false',
  )
})

async function routeStoreSurfaceApi(page: Page) {
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({ json: authSessionFixture })
  })

  await page.route('**/api/reports/kpi-config', async (route) => {
    await route.fulfill({ json: kpiConfigFixture })
  })

  await page.route('**/api/reports/my-performance**', async (route) => {
    await route.fulfill({ json: myPerformanceFixture })
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
