import type { StoreActionPlan } from '../store-actions/api'
import type { WorkflowInboxItem } from '../workflow/contracts'
import { normalizeDisplayLabel } from '../../lib/display-labels'

export type CommandChainActorRole =
  | 'SUPER_ADMIN'
  | 'HR_ADMIN'
  | 'INTEGRATION_ADMIN'
  | 'REGION_MANAGER'
  | 'SNAPSHOT_OPERATOR'
  | 'STORE_MANAGER'
  | 'STORE_PERSONNEL'
  | 'REPORT_VIEWER'

export type CommandChainSourceFamily =
  | 'auth'
  | 'checklist'
  | 'feed'
  | 'import'
  | 'kpi'
  | 'operations'
  | 'snapshot'
  | 'store_action'
  | 'target'
  | 'workflow'
  | 'workforce'

export type CommandChainSeverityLabel = 'critical' | 'high' | 'medium' | 'low' | 'info'
export type CommandChainFreshnessLabel =
  | 'fresh'
  | 'pending'
  | 'preview'
  | 'stale'
  | 'unavailable'
  | 'unknown'

export type CommandChainSignalStatus = 'attention' | 'loading' | 'ready' | 'unavailable'

export type CommandChainSignalSource = {
  count: number | null
  family: 'import' | 'snapshot' | 'workforce' | 'workflow' | 'kpi'
  href: string
  lastObservedAt: string | null
  status: CommandChainSignalStatus
}

export type CommandChainReasonSource = {
  createdAt?: string | null
  eligibleRoles: readonly CommandChainActorRole[]
  freshnessLabel?: CommandChainFreshnessLabel
  href?: string
  id: string
  limitation?: string
  needsAttentionAt?: string | null
  ownerSurface?: string
  priority?: number
  proofLabel: string
  scopeLabel?: string
  severityLabel?: CommandChainSeverityLabel
  sourceEntityId?: string
  sourceFamily: CommandChainSourceFamily
  sourceSurface: string
  statusLabel?: string
  storeId?: string
  storeLabel?: string
}

export type CommandChainReasonItem = {
  freshnessLabel: CommandChainFreshnessLabel
  href: string | null
  id: string
  limitation: string | null
  ownerSurface: string | null
  priority: number
  proofLabel: string
  roleVisibilityReason: string
  scopeLabel: string
  severityLabel: CommandChainSeverityLabel
  sourceEntityId: string | null
  sourceFamily: CommandChainSourceFamily
  sourceSurface: string
  statusLabel: string | null
  storeId: string | null
  storeLabel: string | null
}

export function buildCommandChainReasons(input: {
  actorRole: CommandChainActorRole
  defaultScopeLabel?: string
  limit?: number
  sources: readonly CommandChainReasonSource[]
}): CommandChainReasonItem[] {
  if (input.actorRole === 'STORE_PERSONNEL') {
    return []
  }

  const limit = input.limit ?? 8

  return input.sources
    .filter((source) => canActorReadSource(source.eligibleRoles, input.actorRole))
    .map((source) => toReasonItem(source, input.actorRole, input.defaultScopeLabel))
    .filter((item): item is CommandChainReasonItem => item !== null)
    .toSorted(compareReasonItems)
    .slice(0, limit)
}

export function buildCommandChainReasonsFromCurrentSources(input: {
  actorRole: CommandChainActorRole
  defaultScopeLabel?: string
  limit?: number
  signalSources?: readonly CommandChainSignalSource[]
  storeActionPlans?: readonly StoreActionPlan[]
  workflowItems?: readonly WorkflowInboxItem[]
}): CommandChainReasonItem[] {
  return buildCommandChainReasons({
    actorRole: input.actorRole,
    ...(input.defaultScopeLabel === undefined ? {} : { defaultScopeLabel: input.defaultScopeLabel }),
    ...(input.limit === undefined ? {} : { limit: input.limit }),
    sources: [
      ...(input.signalSources ?? []).flatMap(buildSignalReasonSources),
      ...(input.workflowItems ?? []).flatMap(buildWorkflowReasonSources),
      ...(input.storeActionPlans ?? []).flatMap(buildStoreActionPlanReasonSources),
    ],
  })
}

export function buildSignalReasonSources(
  signal: CommandChainSignalSource,
): CommandChainReasonSource[] {
  if (signal.status === 'ready') {
    return []
  }

  const sourceFamily = mapSignalFamily(signal.family)
  if (!sourceFamily) {
    return []
  }

  const countLabel = signal.count === null ? 'unknown' : String(signal.count)
  const base = {
    eligibleRoles: rolesForSignalSource(signal),
    freshnessLabel: mapSignalFreshness(signal.status),
    href: signal.href,
    id: `signal:${signal.family}:${signal.status}`,
    needsAttentionAt: signal.lastObservedAt,
    proofLabel: `${signal.family} signal status is ${signal.status}; count ${countLabel}`,
    sourceFamily,
    sourceSurface: signal.href,
    statusLabel: signal.status,
  } as const

  return [
    {
      ...base,
      ...(signal.status === 'loading'
        ? { limitation: 'Signal is still loading; this is not a zero-count proof.' }
        : {}),
      ...(signal.status === 'unavailable'
        ? { limitation: 'Signal is unavailable; runtime source must be checked before action.' }
        : {}),
      priority: signal.status === 'unavailable' ? 5 : 20,
      severityLabel: signal.status === 'unavailable' ? 'high' : 'medium',
    },
  ]
}

export function buildWorkflowReasonSources(
  item: WorkflowInboxItem,
): CommandChainReasonSource[] {
  if (item.inboxStatus !== 'needs_attention') {
    return []
  }

  const sourceFamily = mapWorkflowSourceFamily(item.sourceType)
  if (!sourceFamily) {
    return []
  }

  const sourceLimitation = limitationForWorkflowSource(item.sourceType)

  return [
    {
      eligibleRoles: rolesForWorkflowSource(item.sourceType),
      freshnessLabel: 'pending',
      href: item.deepLink,
      id: `workflow:${item.sourceType}:${safeReasonIdPart(item.sourceId)}`,
      ...(item.createdAt === undefined ? {} : { createdAt: item.createdAt }),
      ...(sourceLimitation ? { limitation: sourceLimitation } : {}),
      ...(item.needsAttentionAt === undefined
        ? {}
        : { needsAttentionAt: item.needsAttentionAt }),
      ownerSurface: 'workflow inbox',
      priority: item.urgency === 'high' ? 10 : item.urgency === 'medium' ? 25 : 40,
      proofLabel: `Workflow inbox item needs attention: ${item.title}`,
      scopeLabel: normalizeDisplayLabel(item.storeName, 'Mağaza adı yok'),
      severityLabel: severityForWorkflowUrgency(item.urgency),
      sourceEntityId: item.sourceId,
      sourceFamily,
      sourceSurface: item.deepLink || '/admin/inbox',
      statusLabel: item.workflowStatus,
      storeId: item.storeId,
      ...(item.storeName ? { storeLabel: item.storeName } : {}),
    },
  ]
}

export function buildStoreActionPlanReasonSources(
  plan: StoreActionPlan,
): CommandChainReasonSource[] {
  if (plan.status === 'closed' || plan.status === 'cancelled') {
    return []
  }

  return [
    {
      createdAt: plan.createdAt,
      eligibleRoles: ['SUPER_ADMIN', 'STORE_MANAGER'],
      freshnessLabel: 'pending',
      href: '/store/tasks',
      id: `store-action:${safeReasonIdPart(plan.actionPlanId)}`,
      ownerSurface: 'store tasks',
      priority: plan.status === 'blocked' ? 8 : plan.priority === 'high' ? 12 : 30,
      proofLabel: `Persisted Store Action plan is ${plan.status}: ${plan.title}`,
      scopeLabel: normalizeDisplayLabel(plan.storeName, 'Mağaza adı yok'),
      severityLabel: plan.status === 'blocked' || plan.priority === 'high' ? 'high' : 'medium',
      sourceEntityId: plan.sourceId,
      sourceFamily: 'store_action',
      sourceSurface: plan.sourceDeepLink ?? '/store/tasks',
      statusLabel: plan.status,
      storeId: plan.storeId,
      storeLabel: normalizeDisplayLabel(plan.storeName, 'Mağaza adı yok'),
    },
  ]
}

function toReasonItem(
  source: CommandChainReasonSource,
  actorRole: CommandChainActorRole,
  defaultScopeLabel: string | undefined,
): CommandChainReasonItem | null {
  if (!source.proofLabel.trim() || !source.sourceSurface.trim()) {
    return null
  }

  return {
    freshnessLabel: source.freshnessLabel ?? 'unknown',
    href: source.href ?? null,
    id: safeReasonId(source.id, `${source.sourceFamily}:redacted`),
    limitation: source.limitation ?? defaultLimitation(source.freshnessLabel),
    ownerSurface: source.ownerSurface ?? null,
    priority: source.priority ?? severityRank(source.severityLabel ?? 'info') * 100,
    proofLabel: source.proofLabel,
    roleVisibilityReason: buildRoleVisibilityReason(actorRole, source.sourceFamily),
    scopeLabel: source.scopeLabel ?? defaultScopeLabel ?? 'current actor scope',
    severityLabel: source.severityLabel ?? 'info',
    sourceEntityId: safeSourceEntityId(source.sourceEntityId),
    sourceFamily: source.sourceFamily,
    sourceSurface: source.sourceSurface,
    statusLabel: source.statusLabel ?? null,
    storeId: source.storeId ?? null,
    storeLabel: source.storeLabel ?? null,
  }
}

function compareReasonItems(left: CommandChainReasonItem, right: CommandChainReasonItem) {
  const priorityDelta = left.priority - right.priority
  if (priorityDelta !== 0) return priorityDelta

  const severityDelta = severityRank(left.severityLabel) - severityRank(right.severityLabel)
  if (severityDelta !== 0) return severityDelta

  return left.id.localeCompare(right.id)
}

function severityRank(severity: CommandChainSeverityLabel) {
  switch (severity) {
    case 'critical':
      return 0
    case 'high':
      return 1
    case 'medium':
      return 2
    case 'low':
      return 3
    case 'info':
      return 4
  }
}

function mapSignalFamily(
  family: CommandChainSignalSource['family'],
): CommandChainSourceFamily | null {
  switch (family) {
    case 'import':
      return 'import'
    case 'snapshot':
      return 'snapshot'
    case 'workforce':
      return 'workforce'
    case 'workflow':
      return 'workflow'
    case 'kpi':
      return 'kpi'
    default:
      return null
  }
}

function mapSignalFreshness(status: CommandChainSignalStatus): CommandChainFreshnessLabel {
  switch (status) {
    case 'attention':
      return 'pending'
    case 'loading':
      return 'pending'
    case 'ready':
      return 'fresh'
    case 'unavailable':
      return 'unavailable'
    default:
      return 'unknown'
  }
}

function mapWorkflowSourceFamily(
  sourceType: WorkflowInboxItem['sourceType'],
): CommandChainSourceFamily | null {
  switch (sourceType) {
    case 'kpi_exception':
      return 'kpi'
    case 'store_action_plan':
      return 'store_action'
    case 'checklist_receipt':
      return 'checklist'
    case 'target_distribution_request':
      return 'target'
    default:
      return null
  }
}

function rolesForSignalSource(
  signal: CommandChainSignalSource,
): readonly CommandChainActorRole[] {
  switch (signal.family) {
    case 'import':
      return ['SUPER_ADMIN', 'INTEGRATION_ADMIN']
    case 'snapshot':
      return ['SUPER_ADMIN', 'SNAPSHOT_OPERATOR']
    case 'workforce':
      return ['SUPER_ADMIN', 'HR_ADMIN']
    case 'workflow':
      return ['SUPER_ADMIN', 'HR_ADMIN', 'REPORT_VIEWER']
    case 'kpi':
      return ['SUPER_ADMIN', 'REPORT_VIEWER']
    default:
      return []
  }
}

function rolesForWorkflowSource(
  sourceType: WorkflowInboxItem['sourceType'],
): readonly CommandChainActorRole[] {
  switch (sourceType) {
    case 'kpi_exception':
      return ['SUPER_ADMIN', 'STORE_MANAGER', 'REPORT_VIEWER']
    case 'store_action_plan':
      return ['SUPER_ADMIN', 'STORE_MANAGER']
    case 'checklist_receipt':
      return ['SUPER_ADMIN', 'STORE_MANAGER']
    case 'target_distribution_request':
      return ['SUPER_ADMIN', 'REGION_MANAGER', 'REPORT_VIEWER']
    default:
      return []
  }
}

function severityForWorkflowUrgency(
  urgency: WorkflowInboxItem['urgency'],
): CommandChainSeverityLabel {
  switch (urgency) {
    case 'high':
      return 'high'
    case 'medium':
      return 'medium'
    case 'low':
      return 'low'
    default:
      return 'info'
  }
}

function limitationForWorkflowSource(sourceType: WorkflowInboxItem['sourceType']) {
  switch (sourceType) {
    case 'checklist_receipt':
      return 'Checklist receipt is inbox evidence only; do not reinterpret it as direct coaching policy.'
    case 'target_distribution_request':
      return 'Target request is approval evidence only; do not change target policy from this item.'
    case 'kpi_exception':
    case 'store_action_plan':
    default:
      return undefined
  }
}

function canActorReadSource(
  eligibleRoles: readonly CommandChainActorRole[] | undefined,
  actorRole: CommandChainActorRole,
) {
  return Array.isArray(eligibleRoles) && eligibleRoles.includes(actorRole)
}

function buildRoleVisibilityReason(
  actorRole: CommandChainActorRole,
  family: CommandChainSourceFamily,
) {
  return `${actorRole} can read ${family} source-linked reasons inside existing route and scope guards.`
}

function defaultLimitation(freshness: CommandChainFreshnessLabel | undefined) {
  switch (freshness) {
    case 'pending':
      return 'Pending source evidence; do not claim completion or zero pressure.'
    case 'preview':
      return 'Preview source evidence; do not treat as official without the source owner.'
    case 'stale':
      return 'Stale source evidence; refresh before operational action.'
    case 'unavailable':
      return 'Unavailable source evidence; investigate the source before action.'
    case 'fresh':
    case 'unknown':
    case undefined:
      return null
  }
}

function safeSourceEntityId(value: string | undefined) {
  if (!value || looksSensitive(value)) {
    return null
  }

  return value
}

function safeReasonId(value: string, fallback: string) {
  if (!value || looksSensitive(value)) {
    return fallback
  }

  return value
}

function safeReasonIdPart(value: string) {
  return safeSourceEntityId(value) ?? 'redacted-source'
}

function looksSensitive(value: string) {
  const lower = value.toLowerCase()
  const jwtLike = value.length > 80 && value.split('.').length === 3

  return (
    jwtLike ||
    lower.includes('bearer') ||
    lower.includes('cookie') ||
    lower.includes('secret') ||
    lower.includes('session') ||
    lower.includes('token')
  )
}
