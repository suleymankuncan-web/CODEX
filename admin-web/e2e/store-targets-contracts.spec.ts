import { expect, test, type Page } from './test-fixtures'
import {
  installGenericStoreApiFallbacks,
  installStoreContractSession,
  storeIds,
} from './store-page-contract-fixtures'

test('targets period picker opens from the full trigger surface', async ({ page }) => {
  await installStoreContractSession(page, 'regionManager')
  await installGenericStoreApiFallbacks(page)
  await routeTargetsContractApi(page)

  await page.goto('/store/targets?requestMonth=2026-05')

  const trigger = page.locator('button.targets-month-button')
  await expect(trigger).toBeVisible()
  const box = await trigger.boundingBox()
  expect(box).not.toBeNull()
  if (!box) return

  for (const x of [box.x + 6, box.x + box.width / 2, box.x + box.width - 6]) {
    await page.mouse.click(x, box.y + box.height / 2)
    await expect(page.getByText('Dönem seç')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByText('Dönem seç')).toHaveCount(0)
  }
})

test('targets metrics agree with mocked visible request and coverage data', async ({ page }) => {
  await installStoreContractSession(page, 'regionManager')
  await installGenericStoreApiFallbacks(page)
  await routeTargetsContractApi(page)

  await page.goto('/store/targets?requestMonth=2026-05')

  await expect(page.getByTestId('store-targets-region-personnel-metric')).toContainText('%67')
  await expect(page.getByTestId('store-targets-region-personnel-metric')).toContainText('2 / 3')
  await expect(page.getByTestId('store-targets-region-store-metric')).toContainText('2')
  await expect(page.getByTestId('store-targets-region-store-metric')).toContainText('Bölge portföyü')
  await expect(page.getByTestId('store-targets-region-decision-metric')).toContainText('1')
  await expect(page.getByTestId('store-targets-region-no-request-metric')).toContainText('0')
  await expect(page.getByText('Balıkesir 10 Burda AVM').first()).toBeVisible()
})

async function routeTargetsContractApi(page: Page) {
  await page.route('**/api/target-distributions/coverage**', async (route) => {
    await route.fulfill({ json: createTargetCoverageFixture() })
  })
  await page.route('**/api/target-distributions/requests**', async (route) => {
    await route.fulfill({ json: createTargetRequestsFixture() })
  })
  await page.route('**/api/target-distributions/store-personnel**', async (route) => {
    await route.fulfill({ json: createStorePersonnelFixture() })
  })
}

function createTargetCoverageFixture() {
  return {
    items: [
      coverageRow({
        displayName: 'Emine Çavuş',
        employeeId: 'employee-contract-emine',
        storeId: storeIds[0],
        storeName: 'Balıkesir 10 Burda AVM',
        targetStatus: 'approved',
        targetValue: 916666.67,
      }),
      coverageRow({
        displayName: 'Gürkan Çakar',
        employeeId: 'employee-contract-gurkan',
        storeId: storeIds[0],
        storeName: 'Balıkesir 10 Burda AVM',
        targetStatus: 'approved',
        targetValue: 916666.67,
      }),
      coverageRow({
        displayName: 'Ayşe Yılmaz',
        employeeId: 'employee-contract-ayse',
        storeId: storeIds[1],
        storeName: 'Bursa Downtown AVM',
        targetStatus: 'pending',
        pendingTargetValue: 800000,
      }),
    ],
    meta: { count: 3, limit: 50, offset: 0, total: 3 },
    summary: {
      conflictEmployees: 0,
      coverageRate: 2 / 3,
      coveredEmployees: 2,
      missingEmployees: 1,
      pendingEmployees: 1,
      requestMonth: '2026-05-01',
      staleEmployees: 0,
      totalEmployees: 3,
      uncoveredEmployees: 1,
    },
  }
}

function coverageRow(input: {
  displayName: string
  employeeId: string
  pendingTargetValue?: number
  storeId: string
  storeName: string
  targetStatus: string
  targetValue?: number
}) {
  return {
    displayName: input.displayName,
    employeeId: input.employeeId,
    externalEmployeeRef: null,
    pendingTargetValue: input.pendingTargetValue ?? null,
    storeId: input.storeId,
    storeName: input.storeName,
    targetStatus: input.targetStatus,
    targetValue: input.targetValue ?? null,
  }
}

function createTargetRequestsFixture() {
  return {
    items: [
      targetRequest({
        requestId: 'target-request-approved',
        status: 'approved',
        storeId: storeIds[0],
        storeName: 'Balıkesir 10 Burda AVM',
      }),
      targetRequest({
        requestId: 'target-request-pending',
        status: 'pending_region_approval',
        storeId: storeIds[1],
        storeName: 'Bursa Downtown AVM',
      }),
    ],
    meta: { count: 2, limit: 200, offset: 0, total: 2 },
  }
}

function targetRequest(input: {
  requestId: string
  status: 'approved' | 'pending_region_approval'
  storeId: string
  storeName: string
}) {
  return {
    allocations: [
      {
        assigneeLabel: 'Emine Çavuş',
        employeeId: 'employee-contract-emine',
        note: null,
        targetValue: 916666.67,
      },
      {
        assigneeLabel: 'Gürkan Çakar',
        employeeId: 'employee-contract-gurkan',
        note: null,
        targetValue: 916666.67,
      },
    ],
    approvedAt: input.status === 'approved' ? '2026-05-03T10:00:00.000Z' : null,
    createdAt: '2026-05-02T10:00:00.000Z',
    requestId: input.requestId,
    requestMonth: '2026-05-01',
    requestReason: 'Aylık hedef dağıtımı',
    requestedByName: 'Mert Alcan',
    status: input.status,
    storeId: input.storeId,
    storeName: input.storeName,
    targetLabel: 'Mayıs personel hedefi',
    totalTargetValue: 1833333.34,
  }
}

function createStorePersonnelFixture() {
  return {
    items: [
      {
        displayName: 'Emine Çavuş',
        employeeId: 'employee-contract-emine',
        positionCode: 'SALES_ASSOCIATE',
        positionName: 'Satış danışmanı',
      },
    ],
    meta: { count: 1, limit: 50, offset: 0, total: 1 },
  }
}
