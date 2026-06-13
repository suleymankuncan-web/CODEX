import type { TranslationKey } from '../features/localization/dictionary'

export type CapacityEvidenceStatus = 'passed' | 'blocked' | 'stale'
export type CapacityEvidenceTone = 'calm' | 'warning'
export type CapacityDecisionImpact = 'pilot_allowed_with_limits' | 'pilot_refresh_required' | 'broad_launch_blocked'

export type CapacityReadinessItem = {
  id: 'public-staging-baseline' | 'protected-role-baseline'
  labelKey: TranslationKey
  status: CapacityEvidenceStatus
  tone: CapacityEvidenceTone
  sourcePath: string
  lastVerifiedAt: string
  staleOnOrAfter: string | null
  summaryKey: TranslationKey
  nextActionKey: TranslationKey
  decisionImpact: CapacityDecisionImpact
}

type CapacityReadinessSource = {
  baseStatus: 'passed' | 'blocked'
  decisionImpact: CapacityDecisionImpact
  id: CapacityReadinessItem['id']
  labelKey: TranslationKey
  lastVerifiedAt: string
  nextActionKey: TranslationKey
  sourcePath: string
  staleOnOrAfter: string | null
  summaryKey: TranslationKey
}

const publicBaseline = {
  id: 'public-staging-baseline',
  labelKey: 'operations.capacity.publicBaseline.label',
  baseStatus: 'passed',
  sourcePath: 'docs/evidence/readiness/2026-06-13-capacity-700-user-baseline.md',
  lastVerifiedAt: '2026-06-13',
  staleOnOrAfter: '2026-06-28',
  summaryKey: 'operations.capacity.publicBaseline.summary',
  nextActionKey: 'operations.capacity.publicBaseline.nextAction',
  decisionImpact: 'pilot_allowed_with_limits',
} satisfies CapacityReadinessSource

const protectedBaseline = {
  id: 'protected-role-baseline',
  labelKey: 'operations.capacity.protectedBaseline.label',
  baseStatus: 'blocked',
  sourcePath: 'docs/evidence/readiness/2026-06-13-capacity-700-user-baseline.md',
  lastVerifiedAt: '2026-06-13',
  staleOnOrAfter: null,
  summaryKey: 'operations.capacity.protectedBaseline.summary',
  nextActionKey: 'operations.capacity.protectedBaseline.nextAction',
  decisionImpact: 'broad_launch_blocked',
} satisfies CapacityReadinessSource

export function getCapacityReadinessSnapshot(now = new Date()): CapacityReadinessItem[] {
  return [toReadinessItem(publicBaseline, now), toReadinessItem(protectedBaseline, now)]
}

function toReadinessItem(
  item: CapacityReadinessSource,
  now: Date,
): CapacityReadinessItem {
  const status = resolveStatus(item.baseStatus, item.staleOnOrAfter, now)

  return {
    id: item.id,
    labelKey: item.labelKey,
    status,
    tone: resolveTone(status),
    sourcePath: item.sourcePath,
    lastVerifiedAt: item.lastVerifiedAt,
    staleOnOrAfter: item.staleOnOrAfter,
    summaryKey: item.summaryKey,
    nextActionKey: item.nextActionKey,
    decisionImpact: resolveDecisionImpact(item.decisionImpact, status),
  }
}

function resolveDecisionImpact(
  decisionImpact: CapacityDecisionImpact,
  status: CapacityEvidenceStatus,
): CapacityDecisionImpact {
  if (decisionImpact === 'pilot_allowed_with_limits' && status === 'stale') return 'pilot_refresh_required'
  return decisionImpact
}

function resolveStatus(
  baseStatus: 'passed' | 'blocked',
  staleOnOrAfter: string | null,
  now: Date,
): CapacityEvidenceStatus {
  if (baseStatus === 'passed' && staleOnOrAfter && isOnOrAfterUtcDate(now, staleOnOrAfter)) return 'stale'
  return baseStatus
}

function resolveTone(status: CapacityEvidenceStatus): CapacityEvidenceTone {
  return status === 'passed' ? 'calm' : 'warning'
}

function isOnOrAfterUtcDate(now: Date, utcDate: string): boolean {
  const [yearText, monthText, dayText] = utcDate.split('-')
  if (!yearText || !monthText || !dayText) {
    throw new Error(`Invalid UTC date: ${utcDate}`)
  }

  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)

  return now.getTime() >= Date.UTC(year, month - 1, day)
}
