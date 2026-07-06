import { expect, test, type Page } from './test-fixtures'
import {
  installGenericStoreApiFallbacks,
  installStoreContractSession,
  regionId,
  storeIds,
} from './store-page-contract-fixtures'

test('region incentives locks compact surface and excludes header Excel export', async ({ page }) => {
  await installStoreContractSession(page, 'regionManager')
  await installGenericStoreApiFallbacks(page)
  await routeIncentiveContractApi(page)

  await page.goto('/store/incentives')

  await expect(page.getByRole('heading', { name: 'Prim Kontrol Sayfası' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Excel dışa aktar/i })).toHaveCount(0)
  await expect(page.getByText('Mağaza paketleri')).toHaveCount(0)
  await expect(page.getByText('Bölge hakediş kontrolü')).toHaveCount(0)
  await expect(page.getByText('Balıkesir 10 Burda AVM')).toBeVisible()
})

test('region incentives review checkbox gives immediate feedback before save finishes', async ({ page }) => {
  await installStoreContractSession(page, 'regionManager')
  await installGenericStoreApiFallbacks(page)
  await routeIncentiveContractApi(page, { reviewDelayMs: 700 })

  await page.goto('/store/incentives')
  await page.getByText('Balıkesir 10 Burda AVM').click()

  const checkbox = page.getByRole('checkbox').first()
  await expect(checkbox).toBeVisible()
  await checkbox.click()

  await expect(page.getByText(/Kaydediliyor|Kontrol edildi/).first()).toBeVisible()
  await expect(page.getByText('Kontrol edildi').first()).toBeVisible({ timeout: 2_000 })
})

test('region incentives correction drawer accepts money input and keeps footer actions usable', async ({ page }) => {
  await installStoreContractSession(page, 'regionManager')
  await installGenericStoreApiFallbacks(page)
  await routeIncentiveContractApi(page)

  await page.goto('/store/incentives')
  await page.getByText('Balıkesir 10 Burda AVM').click()
  await page.getByRole('button', { name: 'Emine Çavuş' }).click()

  const finalAmount = page.getByLabel('Final prim tutarı')
  await expect(finalAmount).toBeVisible()
  await expect(finalAmount).toBeEnabled()
  await finalAmount.fill('50000')
  await page.getByLabel('Düzeltme notu').fill('Sunum kontrol düzeltmesi')
  await expect(finalAmount).toHaveValue(/50\.000|50000/)
  await expect(page.getByText('Geçerli bir tutar girin.')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Kaydet/i })).toBeVisible()
})

async function routeIncentiveContractApi(
  page: Page,
  options: { reviewDelayMs?: number } = {},
) {
  await page.route('**/api/store/incentives**', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback()
      return
    }

    await route.fulfill({ json: createRegionIncentivesFixture() })
  })
  await page.route('**/api/store/incentives/store-reviews', async (route) => {
    if (options.reviewDelayMs) {
      await new Promise((resolve) => setTimeout(resolve, options.reviewDelayMs))
    }
    await route.fulfill({
      json: {
        data: {
          period: '2026-05',
          reviewedAt: '2026-07-06T12:00:00.000Z',
          reviewedByUserId: 'regionManager-contract-user',
          reviewStatus: 'reviewed',
          storeId: storeIds[0],
        },
      },
    })
  })
  await page.route('**/api/store/incentives/corrections', async (route) => {
    await route.fulfill({
      json: {
        data: {
          adjustmentAmount: '18731.96',
          beforeAmount: '31268.04',
          correctionId: 'correction-contract-1',
          createdAt: '2026-07-06T12:00:00.000Z',
          createdByUserId: 'regionManager-contract-user',
          finalAmount: '50000.00',
          reasonNote: 'Sunum kontrol düzeltmesi',
          reviewedAt: null,
          reviewNote: null,
          status: 'draft',
          submittedAt: null,
          targetScope: 'final_snapshot',
        },
      },
    })
  })
}

function createRegionIncentivesFixture() {
  return {
    data: {
      period: '2026-05',
      periodEnd: '2026-05-31',
      periodStart: '2026-05-01',
      periodTimezone: 'Europe/Istanbul',
      projections: [
        {
          blockedReason: null,
          calculationState: 'closed',
          closeCutoffAt: '2026-06-01T00:00:00.000Z',
          lastImportAt: '2026-06-01T08:00:00.000Z',
          period: '2026-05',
          periodTimezone: 'Europe/Istanbul',
          regionId,
          review: {
            periodCloseStatus: 'closed',
            reviewedAt: null,
            reviewedByUserId: null,
            reviewNote: null,
            storeReviewStatus: 'pending_review',
            workflowLockedReason: null,
          },
          roleScope: 'region',
          rows: [
            incentiveRow({
              actualPositiveSales: '3126804.25',
              displayName: 'Mert Alcan',
              employeeId: 'manager-contract-1',
              participantType: 'store_manager',
              payableAmount: '31268.04',
              positionCode: 'STORE_MANAGER',
              target: '2750000.00',
            }),
            incentiveRow({
              actualPositiveSales: '980000.00',
              displayName: 'Emine Çavuş',
              employeeId: 'employee-contract-emine',
              participantType: 'personnel',
              payableAmount: '31268.04',
              positionCode: 'SALES_ASSOCIATE',
              target: '916666.67',
            }),
          ],
          ruleVersionId: 'rule-contract-v1',
          storeAchievementPct: '113.70',
          storeActualNetSales: '3126804.25',
          storeGatePassed: true,
          storeId: storeIds[0],
          storeName: 'Balıkesir 10 Burda AVM',
          storeOwnershipType: 'company',
          storeTarget: '2750000.00',
        },
      ],
      regionWorkflow: {
        regionId,
        regionPackageId: null,
        regionPackageStatus: 'not_submitted',
        reviewedAt: null,
        submittedAt: null,
        workflowLockedReason: null,
      },
      roleScope: 'region',
    },
  }
}

function incentiveRow(input: {
  actualPositiveSales: string
  displayName: string
  employeeId: string
  participantType: 'personnel' | 'store_manager'
  payableAmount: string
  positionCode: 'ASSISTANT_MANAGER' | 'SALES_ASSOCIATE' | 'STORE_MANAGER'
  target: string
}) {
  return {
    achievementPct: '106.91',
    actualPositiveSales: input.actualPositiveSales,
    adjustmentAmount: null,
    blockedReason: null,
    correctionAmount: null,
    displayName: input.displayName,
    employeeId: input.employeeId,
    explanation: 'Kontrat satırı',
    finalAmount: null,
    normalizedFromPositionCode: null,
    participantType: input.participantType,
    payableAmount: input.payableAmount,
    positionCode: input.positionCode,
    rate: input.participantType === 'store_manager' ? '0.0100' : '0.0165',
    rateTableVersion: 'v1',
    rawEarnedAmount: input.payableAmount,
    regionCorrection: null,
    status: 'closed',
    storeAchievementPct: '113.70',
    storeGatePassed: true,
    target: input.target,
  }
}
