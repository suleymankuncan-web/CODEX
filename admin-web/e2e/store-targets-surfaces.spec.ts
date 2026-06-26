import { expect, test } from './test-fixtures'

const demoStoreId = '00000000-0000-0000-0000-000000000100'
const nonPrimaryStoreId = '00000000-0000-0000-0000-000000000101'
const demoEmployeeId = '00000000-0000-0000-0000-000000000202'
const pendingTargetRequestId = '00000000-0000-4000-8000-000000000777'

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

  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({ json: authSessionFixture })
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
  await page.route('**/api/target-distributions/coverage**', async (route) => {
    await route.fulfill({ json: targetCoverageFixture })
  })
  await page.route('**/api/target-distributions/store-personnel**', async (route) => {
    await route.fulfill({ json: storeTargetingPersonnelFixture })
  })
})

test('store targets page submits target distribution allocations with employee ids', async ({ page }) => {
  let capturedPayload: unknown = null

  await page.unroute('**/api/target-distributions/requests**')
  await page.unroute('**/api/target-distributions/coverage**')
  await page.unroute('**/api/target-distributions/store-personnel**')
  await page.route('**/api/target-distributions/coverage**', async (route) => {
    await route.fulfill({ json: targetCoverageFixture })
  })
  await page.route('**/api/target-distributions/store-personnel**', async (route) => {
    await route.fulfill({ json: storeTargetingPersonnelFixture })
  })
  await page.route('**/api/target-distributions/requests**', async (route) => {
    const request = route.request()

    if (request.method() === 'GET') {
      await route.fulfill({ json: targetDistributionRequestsFixture })
      return
    }

    capturedPayload = request.postDataJSON()
    expect(capturedPayload).toEqual({
      storeId: demoStoreId,
      requestMonth: '2026-05-01',
      targetLabel: 'Aylık personel hedef dağıtımı',
      totalTargetValue: 145000,
      allocations: [
        {
          employeeId: demoEmployeeId,
          assigneeLabel: 'Store Personnel',
          targetValue: 145000,
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
          request: pendingTargetDistributionRequestsFixture.items[0],
        },
      },
    })
  })

  await page.goto('/store/targets')

  await expect(page.locator('[data-testid="store-targets-contract-surface"]')).toBeVisible()
  await expect(page.locator('.targets-command-panel')).toBeVisible()
  await expect(page.locator('[data-testid="store-targets-contract-surface"] [data-store-section-card]')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Personel hedef dağıtımı' })).toBeVisible()
  await page.getByLabel('Dönem').fill('2026-05')
  await page.getByLabel('Toplam hedef').fill('145000')
  await page.getByLabel('Store Personnel Hedef').fill('145000')
  await page.getByRole('button', { name: 'Onaya gönder' }).click()

  await expect(page.getByText('Target distribution request submitted for region approval')).toBeVisible()
  expect(capturedPayload).not.toBeNull()
})

test('store targets page renders only role-fit target flows', async ({ page }) => {
  await page.goto('/store/targets')

  await expect(page.locator('[data-testid="store-targets-contract-surface"]')).toBeVisible()
  await expect(page.getByRole('radio', { name: /Dağıtım talebi/ })).toBeVisible()
  await expect(page.getByRole('radio', { name: /Revize Talebi/ })).toBeVisible()
  await expect(page.getByRole('radio', { name: /Onaylananlar/ })).toBeVisible()
  await expect(page.getByRole('radio', { name: /Onay akışı/ })).toHaveCount(0)

  await page.unroute('**/api/auth/session')
  await page.unroute('**/api/target-distributions/requests**')
  await page.unroute('**/api/target-distributions/coverage**')
  await page.unroute('**/api/target-distributions/store-personnel**')
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({
      json: {
        ...authSessionFixture,
        user: {
          ...authSessionFixture.user,
          roleCodes: ['REGION_MANAGER'],
          actionScope: {
            assignedStoreIds: [demoStoreId],
          },
          assignedStoreIds: [demoStoreId],
        },
      },
    })
  })
  await page.route('**/api/target-distributions/coverage**', async (route) => {
    await route.fulfill({ json: targetCoverageFixture })
  })
  await page.route('**/api/target-distributions/store-personnel**', async (route) => {
    await route.fulfill({ json: storeTargetingPersonnelFixture })
  })
  await page.route('**/api/target-distributions/requests**', async (route) => {
    await route.fulfill({ json: pendingTargetDistributionRequestsFixture })
  })

  await page.goto('/store/targets')

  await expect(page.locator('[data-testid="store-targets-contract-surface"]')).toBeVisible()
  await expect(page.locator('.targets-prototype')).toBeVisible()
  await expect(page.locator('.targets-ledger')).toBeVisible()
  await expect(page.getByRole('button', { name: /Onay bekleyen/ })).toBeVisible()
  await expect(page.getByRole('radio', { name: /Dağıtım talebi/ })).toHaveCount(0)
  await expect(page.getByRole('radio', { name: /Revize Talebi/ })).toHaveCount(0)
})

test('store targets page keeps command surface after target request approval', async ({ page }) => {
  await page.unroute('**/api/auth/session')
  await page.unroute('**/api/target-distributions/requests**')
  await page.unroute('**/api/target-distributions/coverage**')
  await page.unroute('**/api/target-distributions/store-personnel**')
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({
      json: {
        ...authSessionFixture,
        user: {
          ...authSessionFixture.user,
          roleCodes: ['REGION_MANAGER'],
          actionScope: {
            assignedStoreIds: [demoStoreId],
          },
          assignedStoreIds: [demoStoreId],
        },
      },
    })
  })
  await page.route('**/api/target-distributions/requests**', async (route) => {
    await route.fulfill({ json: approvedTargetDistributionRequestsFixture })
  })
  await page.route('**/api/target-distributions/coverage**', async (route) => {
    await route.fulfill({ json: approvedTargetCoverageFixture })
  })
  await page.route('**/api/target-distributions/store-personnel**', async (route) => {
    await route.fulfill({ json: storeTargetingPersonnelFixture })
  })

  await page.goto('/store/targets')

  await expect(page.locator('.targets-prototype')).toBeVisible()
  await expect(page.locator('.targets-ledger')).toBeVisible()
  await expect(page.getByRole('button', { name: /IstinyePark Demo Store/ })).toBeVisible()
  await expect(page.locator('.targets-status.success', { hasText: 'Onaylandı' })).toBeVisible()
  await expect(page.locator('[data-testid="store-targets-contract-surface"] [data-store-section-card]')).toHaveCount(0)
})

test('store targets page opens latest visible target request month when no month is provided', async ({ page }) => {
  const requestUrls: URL[] = []
  const coverageUrls: URL[] = []

  await page.unroute('**/api/target-distributions/requests**')
  await page.unroute('**/api/target-distributions/coverage**')
  await page.route('**/api/target-distributions/requests**', async (route) => {
    requestUrls.push(new URL(route.request().url()))
    await route.fulfill({ json: pendingTargetDistributionRequestsAcrossMonthsFixture })
  })
  await page.route('**/api/target-distributions/coverage**', async (route) => {
    coverageUrls.push(new URL(route.request().url()))
    await route.fulfill({ json: targetCoverageFixture })
  })

  await page.goto('/store/targets')

  await expect(page.locator('[data-testid="store-targets-contract-surface"]')).toBeVisible()
  await expect(page.getByLabel('Dönem')).toHaveValue('2026-06')
  expect(requestUrls.some((url) => !url.searchParams.has('requestMonth'))).toBe(true)
  await expect.poll(() => coverageUrls.at(-1)?.searchParams.get('requestMonth')).toBe('2026-06-01')
})

test('store targets page keeps region managers on latest approved or pending target month', async ({ page }) => {
  const coverageUrls: URL[] = []

  await page.unroute('**/api/auth/session')
  await page.unroute('**/api/target-distributions/requests**')
  await page.unroute('**/api/target-distributions/coverage**')
  await page.unroute('**/api/target-distributions/store-personnel**')
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({
      json: {
        ...authSessionFixture,
        user: {
          ...authSessionFixture.user,
          roleCodes: ['REGION_MANAGER'],
          actionScope: {
            assignedStoreIds: [demoStoreId, nonPrimaryStoreId],
          },
          assignedStoreIds: [demoStoreId, nonPrimaryStoreId],
        },
        scopeSummary: {
          ...authSessionFixture.scopeSummary,
          storeCount: 2,
          assignedStoreCount: 2,
        },
      },
    })
  })
  await page.route('**/api/target-distributions/requests**', async (route) => {
    await route.fulfill({ json: approvedWithRejectedNewerTargetRequestsFixture })
  })
  await page.route('**/api/target-distributions/coverage**', async (route) => {
    coverageUrls.push(new URL(route.request().url()))
    await route.fulfill({ json: targetCoverageFixture })
  })
  await page.route('**/api/target-distributions/store-personnel**', async (route) => {
    await route.fulfill({ json: storeTargetingPersonnelFixture })
  })

  await page.goto('/store/targets')

  await expect(page.locator('[data-testid="store-targets-contract-surface"]')).toBeVisible()
  await expect(page.getByLabel('Dönem')).toHaveValue('2026-05')
  await expect.poll(() => coverageUrls.at(-1)?.searchParams.get('requestMonth')).toBe('2026-05-01')
  await expect(page.locator('.targets-prototype')).toBeVisible()
  await expect(page.locator('.targets-ledger')).toBeVisible()
  await expect(page.getByText('Mayis hedef dagitimi')).toBeVisible()
  await expect(page.getByText('1 onaylandı')).toBeVisible()
  await expect(page.locator('.targets-metric').filter({ hasText: 'Hedefsiz mağaza' })).toContainText('1')
})

test('store targets page honors query store id for multi-store managers', async ({ page }) => {
  const requestUrls: URL[] = []
  const coverageUrls: URL[] = []

  await page.unroute('**/api/auth/session')
  await page.unroute('**/api/target-distributions/requests**')
  await page.unroute('**/api/target-distributions/coverage**')
  await page.unroute('**/api/target-distributions/store-personnel**')
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({
      json: {
        ...authSessionFixture,
        user: {
          ...authSessionFixture.user,
          actionScope: {
            assignedStoreIds: [demoStoreId, nonPrimaryStoreId],
          },
          assignedStoreIds: [demoStoreId, nonPrimaryStoreId],
        },
        scopeSummary: {
          ...authSessionFixture.scopeSummary,
          assignedStoreCount: 2,
        },
      },
    })
  })
  await page.route('**/api/target-distributions/requests**', async (route) => {
    const request = route.request()

    if (request.method() === 'GET') {
      requestUrls.push(new URL(request.url()))
      await route.fulfill({
        json: {
          ...pendingTargetDistributionRequestsFixture,
          items: [
            {
              ...pendingTargetDistributionRequestsFixture.items[0],
              storeId: nonPrimaryStoreId,
              storeName: 'Marmara Park Demo Store',
            },
          ],
        },
      })
      return
    }

    await route.fulfill({
      status: 403,
      json: { message: 'Target distribution write route is not mocked in this surface test.' },
    })
  })
  await page.route('**/api/target-distributions/coverage**', async (route) => {
    coverageUrls.push(new URL(route.request().url()))
    await route.fulfill({
      json: {
        ...targetCoverageFixture,
        items: targetCoverageFixture.items.map((item) => ({
          ...item,
          storeId: nonPrimaryStoreId,
          storeName: 'Marmara Park Demo Store',
        })),
      },
    })
  })
  await page.route('**/api/target-distributions/store-personnel**', async (route) => {
    await route.fulfill({ json: storeTargetingPersonnelFixture })
  })

  await page.goto(`/store/targets?requestMonth=2026-05&storeId=${nonPrimaryStoreId}&status=pending`)

  await expect(page.locator('[data-testid="store-targets-contract-surface"]')).toBeVisible()
  expect(requestUrls.at(-1)?.searchParams.get('storeId')).toBe(nonPrimaryStoreId)
  expect(coverageUrls.at(-1)?.searchParams.get('storeId')).toBe(nonPrimaryStoreId)
})

test('store targets page lets region managers approve pending target requests in scope', async ({ page }) => {
  let capturedPayload: unknown = null
  let approvedAfterPatch = false

  await page.unroute('**/api/auth/session')
  await page.unroute('**/api/target-distributions/requests**')
  await page.unroute('**/api/target-distributions/coverage**')
  await page.unroute('**/api/target-distributions/store-personnel**')
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({
      json: {
        ...authSessionFixture,
        user: {
          ...authSessionFixture.user,
          roleCodes: ['REGION_MANAGER'],
          actionScope: {
            assignedStoreIds: [demoStoreId],
          },
          assignedStoreIds: [demoStoreId],
        },
      },
    })
  })
  await page.route('**/api/target-distributions/coverage**', async (route) => {
    await route.fulfill({ json: targetCoverageFixture })
  })
  await page.route('**/api/target-distributions/store-personnel**', async (route) => {
    await route.fulfill({ json: storeTargetingPersonnelFixture })
  })
  await page.route('**/api/target-distributions/requests**', async (route) => {
    const request = route.request()

    if (request.method() === 'GET') {
      await route.fulfill({
        json: approvedAfterPatch
          ? approvedTargetDistributionRequestsFixture
          : pendingTargetDistributionRequestsFixture,
      })
      return
    }

    capturedPayload = request.postDataJSON()
    expect(request.url()).toContain(`/requests/${pendingTargetRequestId}/approve`)
    expect(capturedPayload).toEqual({
      approvalNote: 'Bolge onayi',
    })

    await route.fulfill({
      json: {
        command: {
          status: 'approved',
          message: 'Target distribution request approved',
        },
        data: {
          request: {
            ...pendingTargetDistributionRequestsFixture.items[0],
            status: 'approved',
            approvedByUserId: 'region-user-1',
            approvedAt: '2026-05-11T08:00:00.000Z',
            approvalNote: 'Bolge onayi',
          },
        },
      },
    })
    approvedAfterPatch = true
  })

  await page.goto('/store/targets')

  await expect(page.locator('[data-testid="store-targets-contract-surface"]')).toBeVisible()
  await page.getByLabel('Dönem').fill('2026-05')
  await expect(page.locator('.targets-ledger')).toBeVisible()
  await page.getByRole('button', { name: /IstinyePark Demo Store/ }).click()
  await expect(page.getByRole('heading', { name: 'IstinyePark Demo Store' })).toBeVisible()
  await expect(page.locator('.targets-detail-head')).toContainText('Mayis hedef dagitimi')
  await page.getByLabel('Karar notu').fill('Bolge onayi')
  await page.getByRole('button', { name: /^Onayla$/ }).click()

  await expect(page.getByText('Target distribution request approved')).toBeVisible()
  await expect(page.locator('.targets-prototype')).toBeVisible()
  await expect(page.locator('.targets-ledger')).toContainText('Mayis hedef dagitimi')
  expect(capturedPayload).not.toBeNull()
})

test('store targets page lets region managers approve with edited target allocations', async ({ page }) => {
  let capturedPayload: unknown = null
  let approvedAfterPatch = false

  await page.unroute('**/api/auth/session')
  await page.unroute('**/api/target-distributions/requests**')
  await page.unroute('**/api/target-distributions/coverage**')
  await page.unroute('**/api/target-distributions/store-personnel**')
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({
      json: {
        ...authSessionFixture,
        user: {
          ...authSessionFixture.user,
          roleCodes: ['REGION_MANAGER'],
          actionScope: {
            assignedStoreIds: [demoStoreId],
          },
          assignedStoreIds: [demoStoreId],
        },
      },
    })
  })
  await page.route('**/api/target-distributions/coverage**', async (route) => {
    await route.fulfill({ json: targetCoverageFixture })
  })
  await page.route('**/api/target-distributions/store-personnel**', async (route) => {
    await route.fulfill({ json: storeTargetingPersonnelFixture })
  })
  await page.route('**/api/target-distributions/requests**', async (route) => {
    const request = route.request()

    if (request.method() === 'GET') {
      await route.fulfill({
        json: approvedAfterPatch
          ? approvedTargetDistributionRequestsFixture
          : pendingTargetDistributionRequestsWithTwoAllocationsFixture,
      })
      return
    }

    capturedPayload = request.postDataJSON()
    expect(request.url()).toContain(`/requests/${pendingTargetRequestId}/approve`)
    expect(capturedPayload).toEqual({
      approvalNote: 'Bolge hedefi dengeledi',
      approvedTotalTargetValue: 145000,
      approvedAllocations: [
        {
          employeeId: demoEmployeeId,
          assigneeLabel: 'Store Personnel',
          targetValue: 40000,
        },
        {
          employeeId: '00000000-0000-0000-0000-000000000203',
          assigneeLabel: 'Store Personnel Covered',
          targetValue: 105000,
        },
      ],
    })

    await route.fulfill({
      json: {
        command: {
          status: 'approved',
          message: 'Target distribution request approved',
        },
        data: {
          request: {
            ...pendingTargetDistributionRequestsWithTwoAllocationsFixture.items[0],
            status: 'approved',
            approvedByUserId: 'region-user-1',
            approvedAt: '2026-05-11T08:00:00.000Z',
            approvalNote: 'Bolge hedefi dengeledi',
          },
        },
      },
    })
    approvedAfterPatch = true
  })

  await page.goto('/store/targets')

  await expect(page.locator('[data-testid="store-targets-contract-surface"]')).toBeVisible()
  await page.getByLabel('Dönem').fill('2026-05')
  await expect(page.locator('.targets-ledger')).toBeVisible()
  await page.getByRole('button', { name: /IstinyePark Demo Store/ }).click()
  await expect(page.getByRole('button', { name: /^Onayla$/ })).toBeVisible()

  await page.getByLabel('Store Personnel Hedef').fill('40000')
  await expect(page.getByRole('button', { name: 'Düzenleyerek onayla', exact: true })).toBeDisabled()
  await expect(page.getByText(/eksik dağıtıldı/)).toBeVisible()

  await page.getByLabel('Store Personnel Covered Hedef').fill('105000')
  await expect(page.getByRole('button', { name: 'Düzenleyerek onayla', exact: true })).toBeDisabled()
  await page.getByLabel('Karar notu').fill('Bolge hedefi dengeledi')
  await page.getByRole('button', { name: 'Düzenleyerek onayla', exact: true }).click()

  await expect(page.getByText('Target distribution request approved')).toBeVisible()
  expect(capturedPayload).not.toBeNull()
})

test('store targets page submits revision requests from approved target snapshots', async ({ page }) => {
  let capturedPayload: unknown = null

  await page.unroute('**/api/target-distributions/requests**')
  await page.unroute('**/api/target-distributions/coverage**')
  await page.unroute('**/api/target-distributions/store-personnel**')
  await page.route('**/api/target-distributions/coverage**', async (route) => {
    await route.fulfill({ json: approvedTargetCoverageFixture })
  })
  await page.route('**/api/target-distributions/store-personnel**', async (route) => {
    await route.fulfill({ json: storeTargetingPersonnelFixture })
  })
  await page.route('**/api/target-distributions/requests**', async (route) => {
    const request = route.request()

    if (request.method() === 'GET') {
      await route.fulfill({ json: approvedTargetDistributionRequestsFixture })
      return
    }

    capturedPayload = request.postDataJSON()
    expect(capturedPayload).toEqual({
      storeId: demoStoreId,
      requestMonth: '2026-05-01',
      targetLabel: 'Mayis hedef dagitimi revize',
      totalTargetValue: 145000,
      requestReason: 'Ay ici kadro degisikligi',
      allocations: [
        {
          employeeId: demoEmployeeId,
          assigneeLabel: 'Store Personnel',
          targetValue: 40000,
        },
        {
          employeeId: '00000000-0000-0000-0000-000000000203',
          assigneeLabel: 'Store Personnel Covered',
          targetValue: 105000,
        },
      ],
    })

    await route.fulfill({
      json: {
        command: {
          status: 'submitted',
          message: 'Revision request submitted for region approval',
        },
        data: {
          request: {
            ...approvedTargetDistributionRequestsFixture.items[0],
            status: 'pending_region_approval',
          },
        },
      },
    })
  })

  await page.goto('/store/targets')

  await expect(page.locator('[data-testid="store-targets-contract-surface"]')).toBeVisible()
  await page.getByLabel('Dönem').fill('2026-05')
  await page.getByRole('radio', { name: /Revize Talebi/ }).click()
  await page.getByRole('button', { name: 'Revize oluştur' }).click()
  await page.getByLabel('Store Personnel Revize talebi gönder').fill('40000')
  await expect(page.getByText('Revize toplam onaylı toplamla eşleşmeli.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Revize talebi gönder' })).toBeDisabled()

  await page.getByLabel('Store Personnel Covered Revize talebi gönder').fill('105000')
  await expect(page.getByRole('button', { name: 'Revize talebi gönder' })).toBeDisabled()

  await page.getByLabel('Revize notu').fill('Ay ici kadro degisikligi')
  await page.getByRole('button', { name: 'Revize talebi gönder' }).click()

  await expect(page.getByText('Revision request submitted for region approval')).toBeVisible()
  expect(capturedPayload).not.toBeNull()
})

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

const targetDistributionRequestsFixture = {
  items: [],
  meta: {
    count: 0,
    total: 0,
    limit: 30,
    offset: 0,
  },
}

const pendingTargetDistributionRequestsFixture = {
  items: [
    {
      requestId: pendingTargetRequestId,
      companyId: '00000000-0000-0000-0000-000000000001',
      regionId: '00000000-0000-0000-0000-000000000010',
      storeId: demoStoreId,
      storeName: 'IstinyePark Demo Store',
      requestMonth: '2026-05-01',
      targetLabel: 'Mayis hedef dagitimi',
      totalTargetValue: 145000,
      allocationCount: 1,
      status: 'pending_region_approval',
      requestReason: 'Magaza hedef dagitimi',
      allocations: [
        {
          employeeId: demoEmployeeId,
          assigneeLabel: 'Store Personnel',
          targetValue: 145000,
          note: null,
        },
      ],
      submittedByUserId: 'store-manager-1',
      approvedByUserId: null,
      approvedAt: null,
      approvalNote: null,
      createdAt: '2026-05-10T08:00:00.000Z',
      updatedAt: '2026-05-10T08:00:00.000Z',
    },
  ],
  meta: {
    count: 1,
    total: 1,
    limit: 30,
    offset: 0,
  },
}

const pendingTargetDistributionRequestsWithTwoAllocationsFixture = {
  items: [
    {
      ...pendingTargetDistributionRequestsFixture.items[0],
      allocationCount: 2,
      allocations: [
        {
          employeeId: demoEmployeeId,
          assigneeLabel: 'Store Personnel',
          targetValue: 45000,
          note: null,
        },
        {
          employeeId: '00000000-0000-0000-0000-000000000203',
          assigneeLabel: 'Store Personnel Covered',
          targetValue: 100000,
          note: null,
        },
      ],
    },
  ],
  meta: {
    count: 1,
    total: 1,
    limit: 30,
    offset: 0,
  },
}

const pendingTargetDistributionRequestsAcrossMonthsFixture = {
  items: [
    {
      ...pendingTargetDistributionRequestsFixture.items[0],
      requestId: '00000000-0000-4000-8000-000000000779',
      requestMonth: '2026-06-01',
      targetLabel: 'Haziran hedef dagitimi',
    },
    ...pendingTargetDistributionRequestsFixture.items,
  ],
  meta: {
    count: 2,
    total: 2,
    limit: 30,
    offset: 0,
  },
}

const approvedTargetDistributionRequestsFixture = {
  items: [
    {
      requestId: '00000000-0000-4000-8000-000000000778',
      companyId: '00000000-0000-0000-0000-000000000001',
      regionId: '00000000-0000-0000-0000-000000000010',
      storeId: demoStoreId,
      storeName: 'IstinyePark Demo Store',
      requestMonth: '2026-05-01',
      targetLabel: 'Mayis hedef dagitimi',
      totalTargetValue: 145000,
      allocationCount: 2,
      status: 'approved',
      requestReason: 'Magaza hedef dagitimi',
      allocations: [
        {
          employeeId: demoEmployeeId,
          assigneeLabel: 'Store Personnel',
          targetValue: 45000,
          note: null,
        },
        {
          employeeId: '00000000-0000-0000-0000-000000000203',
          assigneeLabel: 'Store Personnel Covered',
          targetValue: 100000,
          note: null,
        },
      ],
      submittedByUserId: 'store-manager-1',
      approvedByUserId: 'region-user-1',
      approvedAt: '2026-05-20T08:00:00.000Z',
      approvalNote: 'Bolge onayi',
      createdAt: '2026-05-10T08:00:00.000Z',
      updatedAt: '2026-05-20T08:00:00.000Z',
    },
  ],
  meta: {
    count: 1,
    total: 1,
    limit: 30,
    offset: 0,
  },
}

const approvedWithRejectedNewerTargetRequestsFixture = {
  items: [
    {
      ...approvedTargetDistributionRequestsFixture.items[0],
      requestMonth: '2026-05-01T00:00:00.000Z',
      updatedAt: '2026-05-20T08:00:00.000Z',
    },
    {
      ...approvedTargetDistributionRequestsFixture.items[0],
      requestId: '00000000-0000-4000-8000-000000000779',
      requestMonth: '2026-06-01T00:00:00.000Z',
      targetLabel: 'Haziran hedef dagitimi',
      status: 'rejected',
      approvedByUserId: null,
      approvedAt: null,
      approvalNote: null,
      createdAt: '2026-06-10T08:00:00.000Z',
      updatedAt: '2026-06-18T08:00:00.000Z',
    },
  ],
  meta: {
    count: 2,
    total: 2,
    limit: 30,
    offset: 0,
  },
}

const targetCoverageFixture = {
  items: [
    {
      storeId: demoStoreId,
      storeName: 'IstinyePark Demo Store',
      employeeId: demoEmployeeId,
      displayName: 'Store Personnel',
      externalEmployeeRef: 'FM8001',
      targetReferenceId: null,
      targetValue: null,
      pendingRequestId: pendingTargetRequestId,
      pendingTargetValue: 145000,
      staleTargetReferenceId: null,
      targetStatus: 'pending_region_approval',
    },
    {
      storeId: demoStoreId,
      storeName: 'IstinyePark Demo Store',
      employeeId: '00000000-0000-0000-0000-000000000203',
      displayName: 'Store Personnel Covered',
      externalEmployeeRef: 'FM8002',
      targetReferenceId: '00000000-0000-4000-8000-000000000601',
      targetValue: 155000,
      pendingRequestId: null,
      pendingTargetValue: null,
      staleTargetReferenceId: null,
      targetStatus: 'approved',
    },
    {
      storeId: demoStoreId,
      storeName: 'IstinyePark Demo Store',
      employeeId: '00000000-0000-0000-0000-000000000204',
      displayName: 'Store Personnel Missing',
      externalEmployeeRef: 'FM8003',
      targetReferenceId: null,
      targetValue: null,
      pendingRequestId: null,
      pendingTargetValue: null,
      staleTargetReferenceId: null,
      targetStatus: 'missing',
    },
  ],
  meta: {
    count: 3,
    total: 3,
    limit: 50,
    offset: 0,
  },
  summary: {
    requestMonth: '2026-05-01',
    totalEmployees: 3,
    coveredEmployees: 1,
    missingEmployees: 1,
    pendingEmployees: 1,
    conflictEmployees: 0,
    staleEmployees: 0,
    uncoveredEmployees: 2,
    coverageRate: 1 / 3,
  },
}

const approvedTargetCoverageFixture = {
  items: [
    {
      storeId: demoStoreId,
      storeName: 'IstinyePark Demo Store',
      employeeId: demoEmployeeId,
      displayName: 'Store Personnel',
      externalEmployeeRef: 'FM8001',
      targetReferenceId: '00000000-0000-4000-8000-000000000601',
      targetValue: 45000,
      pendingRequestId: null,
      pendingTargetValue: null,
      staleTargetReferenceId: null,
      targetStatus: 'approved',
    },
    {
      storeId: demoStoreId,
      storeName: 'IstinyePark Demo Store',
      employeeId: '00000000-0000-0000-0000-000000000203',
      displayName: 'Store Personnel Covered',
      externalEmployeeRef: 'FM8002',
      targetReferenceId: '00000000-0000-4000-8000-000000000602',
      targetValue: 100000,
      pendingRequestId: null,
      pendingTargetValue: null,
      staleTargetReferenceId: null,
      targetStatus: 'approved',
    },
  ],
  meta: {
    count: 2,
    total: 2,
    limit: 50,
    offset: 0,
  },
  summary: {
    requestMonth: '2026-05-01',
    totalEmployees: 2,
    coveredEmployees: 2,
    missingEmployees: 0,
    pendingEmployees: 0,
    conflictEmployees: 0,
    staleEmployees: 0,
    uncoveredEmployees: 0,
    coverageRate: 1,
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
