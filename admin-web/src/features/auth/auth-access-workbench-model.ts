import { normalizeDisplayLabel } from '../../lib/display-labels'
import type {
  ActionStoreAssignment,
  AuditEvent,
  CreateActionStoreAssignmentInput,
  CreateRoleAssignmentInput,
  DeactivateUserAccountInput,
  RoleAssignment,
  UpdateUserAccountInput,
  UserAccount,
} from './api'

export type AuthWorkbenchStatus = 'active' | 'inactive'
export type AuthWorkbenchTone = 'cyan' | 'mint' | 'plum' | 'amber' | 'rose' | 'slate'

export type AuthWorkbenchFilters = {
  query?: string
  q?: string
  authProvider?: string
  isActive?: boolean
  limit?: number
  offset?: number
}

export type AuthWorkbenchUserRow = {
  userId: string
  displayName: string
  email: string
  employeeLabel: string
  providerLabel: string
  status: AuthWorkbenchStatus
  statusLabel: string
  tone: AuthWorkbenchTone
  lastActivityLabel: string
  roleCount: number
  storeCount: number
  auditCount: number
  source: UserAccount
}

export type AuthWorkbenchRoleRow = {
  assignmentId: string
  label: string
  scopeLabel: string
  active: boolean
  effectiveLabel: string
  tone: AuthWorkbenchTone
  source: RoleAssignment
}

export type AuthWorkbenchStoreRow = {
  assignmentId: string
  label: string
  regionLabel: string
  active: boolean
  effectiveLabel: string
  tone: AuthWorkbenchTone
  source: ActionStoreAssignment
}

export type AuthWorkbenchAuditRow = {
  eventLogId: string
  label: string
  detail: string
  occurredAt: string
  source: AuditEvent
}

export type AuthWorkbenchUserDetail = AuthWorkbenchUserRow & {
  roles: AuthWorkbenchRoleRow[]
  stores: AuthWorkbenchStoreRow[]
  audit: AuthWorkbenchAuditRow[]
}

export type AuthWorkbenchMetrics = {
  totalUsers: number
  activeUsers: number
  inactiveUsers: number
  activeRoleAssignments: number
  activeStoreAssignments: number
}

export type AuthAccessWorkbenchModel = {
  users: AuthWorkbenchUserRow[]
  selectedUser: AuthWorkbenchUserDetail | null
  metrics: AuthWorkbenchMetrics
}

export type UserProfileDraft = {
  employeeId: string
  username: string
  email: string
}

export type UserStatusDraft = {
  isActive: boolean
  reason: string
}

export const authAccessWorkbenchKeys = {
  root: ['auth-access-workbench'] as const,
  users: (filters: AuthWorkbenchFilters) =>
    [
      ...authAccessWorkbenchKeys.root,
      'users',
      normalizeFilters(filters),
    ] as const,
  roleAssignments: (userId?: string) =>
    [...authAccessWorkbenchKeys.root, 'role-assignments', userId ?? 'all'] as const,
  actionStoreAssignments: (userId?: string) =>
    [...authAccessWorkbenchKeys.root, 'action-store-assignments', userId ?? 'all'] as const,
  audit: (userId: string) => [...authAccessWorkbenchKeys.root, 'audit', userId] as const,
}

export function buildAuthAccessWorkbenchModel(input: {
  users: UserAccount[]
  roleAssignments: RoleAssignment[]
  actionStoreAssignments: ActionStoreAssignment[]
  auditEvents?: AuditEvent[]
  selectedUserId?: string | null
}): AuthAccessWorkbenchModel {
  const rolesByUserId = groupBy(input.roleAssignments, (item) => item.userId)
  const storesByUserId = groupBy(input.actionStoreAssignments, (item) => item.userId)
  const selectedAuditEvents = input.auditEvents ?? []

  const rows = input.users
    .map((user) =>
      mapUserRow({
        user,
        roleCount: rolesByUserId.get(user.userId)?.filter((item) => item.active).length ?? 0,
        storeCount: storesByUserId.get(user.userId)?.filter((item) => item.active).length ?? 0,
        auditCount: user.userId === input.selectedUserId ? selectedAuditEvents.length : 0,
      }),
    )
    .sort(compareUsers)

  const selectedBase =
    rows.find((user) => user.userId === input.selectedUserId) ?? rows[0] ?? null
  const selectedUser = selectedBase
    ? {
        ...selectedBase,
        roles: (rolesByUserId.get(selectedBase.userId) ?? []).map((assignment) =>
          mapRoleRow(assignment, input.actionStoreAssignments),
        ),
        stores: (storesByUserId.get(selectedBase.userId) ?? []).map(mapStoreRow),
        audit:
          selectedBase.userId === input.selectedUserId
            ? selectedAuditEvents.map(mapAuditRow)
            : [],
      }
    : null

  return {
    users: rows,
    selectedUser,
    metrics: {
      totalUsers: rows.length,
      activeUsers: rows.filter((user) => user.status === 'active').length,
      inactiveUsers: rows.filter((user) => user.status === 'inactive').length,
      activeRoleAssignments: input.roleAssignments.filter((assignment) => assignment.active).length,
      activeStoreAssignments: input.actionStoreAssignments.filter((assignment) => assignment.active)
        .length,
    },
  }
}

export function createUserProfileDraft(user: UserAccount): UserProfileDraft {
  return {
    employeeId: user.employeeId ?? '',
    username: user.username,
    email: user.email,
  }
}

export function createUserStatusDraft(user: UserAccount): UserStatusDraft {
  return {
    isActive: user.isActive,
    reason: '',
  }
}

export function buildUserProfileUpdateInput(
  user: UserAccount,
  draft: UserProfileDraft,
): UpdateUserAccountInput | null {
  const input: UpdateUserAccountInput = {}
  const employeeId = draft.employeeId.trim() || null
  const username = draft.username.trim()
  const email = draft.email.trim()

  if (employeeId !== user.employeeId) {
    input.employeeId = employeeId
  }

  if (username && username !== user.username) {
    input.username = username
  }

  if (email && email !== user.email) {
    input.email = email
  }

  return Object.keys(input).length > 0 ? input : null
}

export function buildDeactivateUserInput(draft: UserStatusDraft): DeactivateUserAccountInput {
  const reason = draft.reason.trim()
  return reason ? { reason } : {}
}

export function hasUserStatusChange(user: UserAccount, draft: UserStatusDraft) {
  return user.isActive !== draft.isActive
}

export function buildRoleAssignmentDraft(input: CreateRoleAssignmentInput) {
  return {
    userId: input.userId,
    roleCode: input.roleCode,
    scopeType: input.scopeType,
    companyId: input.companyId ?? '',
    regionId: input.regionId ?? '',
    storeId: input.storeId ?? '',
    effectiveFrom: input.effectiveFrom ?? '',
    effectiveTo: input.effectiveTo ?? '',
  }
}

export function buildActionStoreAssignmentDraft(input: CreateActionStoreAssignmentInput) {
  return {
    userId: input.userId,
    storeId: input.storeId,
    effectiveFrom: input.effectiveFrom ?? '',
    effectiveTo: input.effectiveTo ?? '',
  }
}

export function getAuthWorkbenchInvalidationKeys(userId?: string) {
  return [
    authAccessWorkbenchKeys.root,
    authAccessWorkbenchKeys.roleAssignments(userId),
    authAccessWorkbenchKeys.actionStoreAssignments(userId),
    ...(userId ? [authAccessWorkbenchKeys.audit(userId)] : []),
  ] as const
}

function mapUserRow(input: {
  user: UserAccount
  roleCount: number
  storeCount: number
  auditCount: number
}): AuthWorkbenchUserRow {
  const { user } = input
  const status: AuthWorkbenchStatus = user.isActive ? 'active' : 'inactive'

  return {
    userId: user.userId,
    displayName: normalizeDisplayLabel(user.username ?? user.email, 'Kullanıcı'),
    email: normalizeDisplayLabel(user.email, 'E-posta yok'),
    employeeLabel: user.employeeId ? 'Personel bağlı' : 'Personel yok',
    providerLabel: providerLabel(user.authProvider),
    status,
    statusLabel: status === 'active' ? 'Aktif' : 'Pasif',
    tone: status === 'active' ? 'mint' : 'rose',
    lastActivityLabel: user.lastLoginAt ?? user.createdAt,
    roleCount: input.roleCount,
    storeCount: input.storeCount,
    auditCount: input.auditCount,
    source: user,
  }
}

function mapRoleRow(
  assignment: RoleAssignment,
  actionStoreAssignments: ActionStoreAssignment[],
): AuthWorkbenchRoleRow {
  return {
    assignmentId: assignment.assignmentId,
    label: normalizeDisplayLabel(assignment.roleName ?? assignment.roleCode, 'Rol'),
    scopeLabel: roleScopeLabel(assignment, actionStoreAssignments),
    active: assignment.active,
    effectiveLabel: effectiveLabel(assignment.effectiveFrom, assignment.effectiveTo),
    tone: assignment.active ? 'cyan' : 'slate',
    source: assignment,
  }
}

function mapStoreRow(assignment: ActionStoreAssignment): AuthWorkbenchStoreRow {
  return {
    assignmentId: assignment.assignmentId,
    label: normalizeDisplayLabel(assignment.storeName, 'Mağaza'),
    regionLabel: normalizeDisplayLabel(assignment.regionName, 'Bölge'),
    active: assignment.active,
    effectiveLabel: effectiveLabel(assignment.effectiveFrom, assignment.effectiveTo),
    tone: assignment.active ? 'plum' : 'slate',
    source: assignment,
  }
}

function mapAuditRow(event: AuditEvent): AuthWorkbenchAuditRow {
  return {
    eventLogId: event.eventLogId,
    label: auditEventLabel(event.eventType),
    detail: auditEventDetail(event),
    occurredAt: event.occurredAt,
    source: event,
  }
}

function roleScopeLabel(
  assignment: RoleAssignment,
  actionStoreAssignments: ActionStoreAssignment[],
) {
  if (assignment.scopeType === 'company') return 'Şirket'
  if (assignment.storeId) {
    const store = actionStoreAssignments.find((item) => item.storeId === assignment.storeId)
    return normalizeDisplayLabel(store?.storeName, 'Mağaza')
  }
  if (assignment.regionId) return 'Bölge'
  return normalizeDisplayLabel(assignment.scopeType, 'Kapsam')
}

function effectiveLabel(from: string | null, to: string | null) {
  if (from && to) return `${from} - ${to}`
  if (from) return `${from} sonrası`
  if (to) return `${to} bitiş`
  return 'Süresiz'
}

function providerLabel(provider: string) {
  const normalized = provider.trim().toLowerCase()
  if (normalized === 'clerk') return 'Clerk'
  if (normalized === 'oidc') return 'OIDC'
  if (normalized === 'sso') return 'SSO'
  if (normalized === 'local') return 'Yerel'
  return normalizeDisplayLabel(provider, 'Giriş yöntemi')
}

function auditEventLabel(eventType: string) {
  const labels: Record<string, string> = {
    'user_account.created': 'Hesap oluşturuldu',
    'user_account.updated': 'Hesap güncellendi',
    'user_account.deactivated': 'Hesap pasife alındı',
    'user_account.reactivated': 'Hesap aktifleştirildi',
    'user_role_assignment.created': 'Rol verildi',
    'user_role_assignment.deactivated': 'Rol kaldırıldı',
    'user_action_store_assignment.created': 'Mağaza erişimi verildi',
    'user_action_store_assignment.deactivated': 'Mağaza erişimi kapatıldı',
  }

  return labels[eventType] ?? 'İşlem kaydı'
}

function auditEventDetail(event: AuditEvent) {
  const changedFields = event.metadata.changedFields
  if (changedFields?.length) {
    return `${changedFields.length} alan değişti`
  }

  if (event.metadata.reason) {
    return event.metadata.reason
  }

  return 'Denetim kaydı'
}

function compareUsers(a: AuthWorkbenchUserRow, b: AuthWorkbenchUserRow) {
  if (a.status !== b.status) {
    return a.status === 'active' ? -1 : 1
  }

  const dateCompare = Date.parse(b.lastActivityLabel) - Date.parse(a.lastActivityLabel)
  if (Number.isFinite(dateCompare) && dateCompare !== 0) return dateCompare

  return a.displayName.localeCompare(b.displayName, 'tr')
}

function groupBy<T>(items: T[], keyOf: (item: T) => string) {
  const groups = new Map<string, T[]>()
  for (const item of items) {
    const key = keyOf(item)
    const group = groups.get(key) ?? []
    group.push(item)
    groups.set(key, group)
  }
  return groups
}

function normalizeFilters(filters: AuthWorkbenchFilters) {
  return {
    query: filters.query?.trim() ?? '',
    q: filters.q?.trim() ?? '',
    authProvider: filters.authProvider ?? '',
    isActive: filters.isActive ?? null,
    limit: filters.limit ?? 100,
    offset: filters.offset ?? 0,
  }
}
