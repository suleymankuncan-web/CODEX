import { fetchOpenApiJson, sendOpenApiJson } from '../../lib/openapi-client'

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
  regionCorrection: SalesTargetIncentiveRegionCorrection | null
}

export type SalesTargetIncentiveRegionCorrection = {
  correctionId: string
  status: 'draft' | 'submitted' | 'admin_approved' | 'admin_returned' | 'voided'
  targetScope: 'final_snapshot'
  beforeAmount: string
  adjustmentAmount: string
  finalAmount: string
  reasonNote: string
  createdByUserId: string
  createdAt: string
  submittedAt: string | null
  reviewedAt: string | null
  reviewNote: string | null
}

export type SalesTargetIncentiveStoreReview = {
  storeReviewStatus: 'pending_review' | 'reviewed'
  reviewedByUserId: string | null
  reviewedAt: string | null
  periodCloseStatus: 'projection_only' | 'closed'
  workflowLockedReason: string | null
}

export type SalesTargetIncentiveRegionWorkflow = {
  regionId: string
  regionPackageStatus: 'not_submitted' | 'submitted' | 'admin_approved' | 'admin_returned'
  regionPackageId: string | null
  submittedAt: string | null
  reviewedAt: string | null
  workflowLockedReason: string | null
}

export type SalesTargetIncentiveProjection = {
  period: string
  periodTimezone: 'Europe/Istanbul'
  closeCutoffAt: string | null
  ruleVersionId: string
  regionId: string
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
  review: SalesTargetIncentiveStoreReview | null
  rows: SalesTargetIncentiveRow[]
}

export type SalesTargetIncentiveResponse = {
  data: {
    period: string
    periodStart: string
    periodEnd: string
    periodTimezone: 'Europe/Istanbul'
    roleScope: SalesTargetIncentiveRoleScope
    regionWorkflow: SalesTargetIncentiveRegionWorkflow | null
    regionPackages?: SalesTargetIncentiveAdminRegionPackageSummary[]
    projections: SalesTargetIncentiveProjection[]
  }
}

export type SalesTargetIncentiveAdminRegionPackageSummary = {
  regionId: string
  regionName: string | null
  regionManagerUserId: string | null
  regionManagerName: string | null
  submittedByUserId: string | null
  submittedByName: string | null
  submittedAt: string | null
  reviewedByUserId: string | null
  reviewedByName: string | null
  reviewedAt: string | null
  reviewNote: string | null
  status: 'not_submitted' | 'submitted' | 'admin_approved' | 'admin_returned'
  storeCount: number
  reviewedStoreCount: number
  submittedStoreCount: number
  draftCorrectionCount: number
  submittedCorrectionCount: number
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

export type AdminSalesTargetIncentiveRegionPackageReviewInput = {
  period: string
  regionId: string
  decision: 'approve' | 'return'
  reviewNote?: string
}

export type AdminSalesTargetIncentiveRegionPackageReviewResponse = {
  data: {
    period: string
    regionId: string
    regionPackageId: string
    status: 'submitted' | 'admin_approved' | 'admin_returned'
    reviewedByUserId: string | null
    reviewedAt: string | null
    reviewNote: string | null
  }
}

export type StoreSalesTargetIncentiveReviewInput = {
  period: string
  storeId: string
  reviewStatus: 'pending_review' | 'reviewed'
}

export type StoreSalesTargetIncentiveRegionCorrectionInput = {
  period: string
  storeId: string
  employeeId: string
  participantType: 'store_manager' | 'personnel'
  finalAmount: string
  reasonNote: string
}

export type StoreSalesTargetIncentiveVoidCorrectionInput = {
  period: string
  correctionId: string
}

export type StoreSalesTargetIncentiveSubmitPackageInput = {
  period: string
  regionId: string
  submissionNote?: string
}

export type StoreSalesTargetIncentiveReviewResponse = {
  data: {
    period: string
    storeId: string
    reviewStatus: 'pending_review' | 'reviewed'
    reviewedByUserId: string | null
    reviewedAt: string | null
  }
}

export type StoreSalesTargetIncentiveCorrectionResponse = {
  data: SalesTargetIncentiveRegionCorrection
}

export type StoreSalesTargetIncentivePackageResponse = {
  data: {
    period: string
    regionId: string
    regionPackageId: string
    regionPackageStatus: 'submitted' | 'admin_approved' | 'admin_returned'
    submittedAt: string
    reviewedAt: string | null
    reviewNote: string | null
  }
}

export type SalesTargetIncentiveQueryIdentity = {
  actorUserId?: string | null
  roleScope?: SalesTargetIncentiveRoleScope | null
  assignedStoreIds?: readonly string[]
}

function buildPeriodQuery(period?: string) {
  if (!period?.trim()) {
    return undefined
  }

  return new URLSearchParams({ period: period.trim() })
}

export const mySalesTargetIncentivesQueryKey = (period?: string) =>
  ['store-me-sales-target-incentives', period ?? 'current'] as const

export const storeSalesTargetIncentivesQueryKey = (
  period?: string,
  identity?: SalesTargetIncentiveQueryIdentity,
) =>
  [
    'store-sales-target-incentives',
    period ?? 'current',
    identity?.actorUserId ?? 'anonymous',
    identity?.roleScope ?? 'unknown',
    [...(identity?.assignedStoreIds ?? [])].sort().join(',') || 'no-assigned-store-scope',
  ] as const

export const adminSalesTargetIncentivesQueryKey = (
  period?: string,
  identity?: SalesTargetIncentiveQueryIdentity,
) =>
  [
    'admin-sales-target-incentives',
    period ?? 'current',
    identity?.actorUserId ?? 'anonymous',
    identity?.roleScope ?? 'unknown',
  ] as const

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
  return sendOpenApiJson('/api/admin/incentives/corrections', {
    method: 'POST',
    body: input,
  }) as Promise<AdminSalesTargetIncentiveCorrectionResponse>
}

export async function reviewAdminSalesTargetIncentiveRegionPackage(
  input: AdminSalesTargetIncentiveRegionPackageReviewInput,
) {
  return sendOpenApiJson('/api/admin/incentives/region-packages/reviews', {
    method: 'POST',
    body: input,
  }) as Promise<AdminSalesTargetIncentiveRegionPackageReviewResponse>
}

export async function markStoreSalesTargetIncentiveReview(
  input: StoreSalesTargetIncentiveReviewInput,
) {
  return sendOpenApiJson('/api/store/incentives/store-reviews', {
    method: 'POST',
    body: input,
  }) as Promise<StoreSalesTargetIncentiveReviewResponse>
}

export async function createStoreSalesTargetIncentiveRegionCorrection(
  input: StoreSalesTargetIncentiveRegionCorrectionInput,
) {
  return sendOpenApiJson('/api/store/incentives/corrections', {
    method: 'POST',
    body: input,
  }) as Promise<StoreSalesTargetIncentiveCorrectionResponse>
}

export async function voidStoreSalesTargetIncentiveRegionCorrection(
  input: StoreSalesTargetIncentiveVoidCorrectionInput,
) {
  return sendOpenApiJson('/api/store/incentives/corrections/void', {
    method: 'POST',
    body: input,
  }) as Promise<StoreSalesTargetIncentiveCorrectionResponse>
}

export async function submitStoreSalesTargetIncentiveRegionPackage(
  input: StoreSalesTargetIncentiveSubmitPackageInput,
) {
  return sendOpenApiJson('/api/store/incentives/submissions', {
    method: 'POST',
    body: input,
  }) as Promise<StoreSalesTargetIncentivePackageResponse>
}
