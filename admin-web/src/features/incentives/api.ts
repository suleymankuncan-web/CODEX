import { fetchOpenApiJson } from '../../lib/openapi-client'
import { sendJson } from '../../lib/api'

export type SalesTargetIncentiveRoleScope = 'own' | 'store' | 'region' | 'admin'

export type SalesTargetIncentiveStatus =
  | 'projected'
  | 'no_source'
  | 'blocked'
  | 'closed'
  | 'corrected'
  | 'adjusted'

export type SalesTargetIncentiveRow = {
  employeeId: string
  displayName: string
  participantType: 'store_manager' | 'personnel'
  positionCode: 'STORE_MANAGER' | 'ASSISTANT_MANAGER' | 'SENIOR_SALES_CONSULTANT' | 'SALES_ASSOCIATE'
  normalizedFromPositionCode: 'SHIFT_LEAD' | null
  target: string | null
  actualPositiveSales: string | null
  achievementPct: string | null
  storeAchievementPct: string | null
  storeGatePassed: boolean | null
  rate: string | null
  rawEarnedAmount: string | null
  payableAmount: string | null
  correctionAmount: string | null
  adjustmentAmount: string | null
  finalAmount: string | null
  status: SalesTargetIncentiveStatus
  blockedReason: string | null
  rateTableVersion: string
  explanation: string
}

export type SalesTargetIncentiveProjection = {
  period: string
  periodTimezone: 'Europe/Istanbul'
  closeCutoffAt: string | null
  ruleVersionId: string
  storeId: string
  storeName: string
  storeOwnershipType: 'company'
  roleScope: SalesTargetIncentiveRoleScope
  storeTarget: string | null
  storeActualNetSales: string | null
  storeAchievementPct: string | null
  storeGatePassed: boolean | null
  calculationState: SalesTargetIncentiveStatus
  blockedReason: string | null
  lastImportAt: string | null
  rows: SalesTargetIncentiveRow[]
}

export type SalesTargetIncentiveResponse = {
  data: {
    period: string
    periodStart: string
    periodEnd: string
    periodTimezone: 'Europe/Istanbul'
    roleScope: SalesTargetIncentiveRoleScope
    projections: SalesTargetIncentiveProjection[]
  }
}

export type AdminSalesTargetIncentiveCorrectionInput = {
  period: string
  storeId: string
  employeeId: string
  participantType: 'store_manager' | 'personnel'
  adjustmentAmount: string
  reasonCode: string
  reasonNote: string
}

export type AdminSalesTargetIncentiveCorrectionResponse = {
  data: {
    adjustmentId: string
    phase: 'pre_close' | 'post_close'
    adjustmentScope: 'projection' | 'final_snapshot'
    adjustmentType: 'correction' | 'manual_adjustment'
    periodKey: string
    storeId: string
    employeeId: string
    participantType: 'store_manager' | 'personnel'
    beforeAmount: string
    adjustmentAmount: string
    afterAmount: string
    status: 'approved'
  }
}

function buildPeriodQuery(period?: string) {
  if (!period?.trim()) {
    return undefined
  }

  return new URLSearchParams({ period: period.trim() })
}

export const mySalesTargetIncentivesQueryKey = (period?: string) =>
  ['store-me-sales-target-incentives', period ?? 'current'] as const

export const storeSalesTargetIncentivesQueryKey = (period?: string) =>
  ['store-sales-target-incentives', period ?? 'current'] as const

export const adminSalesTargetIncentivesQueryKey = (period?: string) =>
  ['admin-sales-target-incentives', period ?? 'current'] as const

export async function getMySalesTargetIncentives(input?: { period?: string }) {
  const query = buildPeriodQuery(input?.period)
  return fetchOpenApiJson(
    '/api/store/me/incentives',
    query ? { query } : undefined,
  ) as Promise<SalesTargetIncentiveResponse>
}

export async function getStoreSalesTargetIncentives(input?: { period?: string }) {
  const query = buildPeriodQuery(input?.period)
  return fetchOpenApiJson(
    '/api/store/incentives',
    query ? { query } : undefined,
  ) as Promise<SalesTargetIncentiveResponse>
}

export async function getAdminSalesTargetIncentives(input?: { period?: string }) {
  const query = buildPeriodQuery(input?.period)
  return fetchOpenApiJson(
    '/api/admin/incentives',
    query ? { query } : undefined,
  ) as Promise<SalesTargetIncentiveResponse>
}

export async function createAdminSalesTargetIncentiveCorrection(
  input: AdminSalesTargetIncentiveCorrectionInput,
) {
  return sendJson<AdminSalesTargetIncentiveCorrectionResponse>(
    '/admin/incentives/corrections',
    {
      method: 'POST',
      body: input,
    },
  )
}
