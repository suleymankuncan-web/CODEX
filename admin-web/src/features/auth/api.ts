import { fetchJson, sendJson } from '../../lib/api'
import { fetchOpenApiJson, type ApiGetResponse } from '../../lib/openapi-client'

type ListResponse<T> = {
  items: T[]
  meta: {
    count: number
    total: number
    limit: number
    offset: number
  }
}

export type AuthLookups = ApiGetResponse<'/api/auth/lookups'>
export type AuthLookupUser = AuthLookups['users'][number]
export type AuthLookupStore = AuthLookups['stores'][number]
type AuthLookupUserSearchResponse = ApiGetResponse<'/api/auth/lookups/users/search'>
export type AuthLookupUserSearchResult = AuthLookupUserSearchResponse['items'][number]
type AuthRoleCatalogResponse = ApiGetResponse<'/api/auth/roles'>
export type RoleCatalogItem = AuthRoleCatalogResponse['items'][number]
type AuthPermissionCatalogResponse = ApiGetResponse<'/api/auth/permissions'>
export type PermissionCatalogItem = AuthPermissionCatalogResponse['items'][number]

export type UserAccount = {
  userId: string
  employeeId: string | null
  username: string
  email: string
  authProvider: string
  providerSubject: string | null
  isActive: boolean
  lastLoginAt: string | null
  createdAt: string
  deactivatedAt?: string | null
  deactivationReason?: string | null
  deactivatedByUserId?: string | null
  employeeStatus?: string | null
}

export type UserAccessClosure = {
  closedRoleAssignments: number
  closedActionStoreAssignments: number
  revokedMobileSessions: number
}

export type RoleAssignment = {
  assignmentId: string
  userId: string
  username: string
  email: string
  roleCode: string
  roleName: string
  scopeType: string
  companyId: string | null
  regionId: string | null
  storeId: string | null
  effectiveFrom: string | null
  effectiveTo: string | null
  createdAt: string
  active: boolean
}

export type ActionStoreAssignment = {
  assignmentId: string
  userId: string
  username: string
  email: string
  storeId: string
  storeCode: string
  storeName: string
  companyId: string
  regionId: string
  regionName: string
  effectiveFrom: string | null
  effectiveTo: string | null
  createdAt: string
  active: boolean
}

export type PilotUserBinding = {
  user: UserAccount
  roleAssignments: RoleAssignment[]
  actionStoreAssignments: ActionStoreAssignment[]
  employee: {
    employeeId: string
    employeeCode: string | null
    firstName: string
    lastName: string
    storeId: string
    storeCode: string
    storeName: string
  }
}

export type AuditEvent = {
  eventLogId: string
  occurredAt: string
  actorUserId: string | null
  correlationId: string | null
  eventType: string
  metadata: {
    reason: string | null
    correlationId: string | null
    sourceContext?: {
      module?: string
      operation?: string
    } | null
    changedFields?: string[]
    details?: Record<string, unknown>
  }
}

export type AuthSessionSummary = {
  authMode: string
  authenticated: boolean
  user: {
    userId: string
    employeeId: string | null
    roleCodes: string[]
    scope: {
      companyIds: string[]
      regionIds: string[]
      storeIds: string[]
    }
    readScope: {
      companyIds: string[]
      regionIds: string[]
      storeIds: string[]
    }
    actionScope: {
      assignedStoreIds: string[]
    }
    assignedStoreIds: string[]
  }
  scopeSummary: {
    companyCount: number
    regionCount: number
    storeCount: number
    assignedStoreCount: number
  }
}

export type AuthBootstrap = {
  authMode: string
  provider: {
    configured: boolean
    authorizationUrl: string | null
    clientId: string | null
    scope: string | null
    responseType: string | null
    audience: string | null
    callbackPath: string
    tokenUrl: string | null
    logoutUrl: string | null
    postLogoutRedirectPath: string
  }
}

type CommandResponse<T> = {
  command: {
    status: string
    message: string
  }
  data: T
}

export async function getAuthLookups() {
  return fetchOpenApiJson('/api/auth/lookups')
}

export async function searchAuthUsers(input: { query: string; limit?: number }) {
  const params = new URLSearchParams({
    q: input.query,
    limit: String(input.limit ?? 20),
  })

  return fetchOpenApiJson('/api/auth/lookups/users/search', { query: params })
}

export async function searchAuthStores(input: { query: string; limit?: number }) {
  const params = new URLSearchParams({
    q: input.query,
    limit: String(input.limit ?? 20),
  })

  return fetchOpenApiJson('/api/auth/lookups/stores/search', { query: params })
}

export async function getAuthSession() {
  return fetchJson<AuthSessionSummary>('/auth/session')
}

export async function getAuthBootstrap() {
  return fetchJson<AuthBootstrap>('/auth/bootstrap')
}

export async function getUserAccounts(input?: {
  authProvider?: string
  isActive?: boolean
}) {
  const params = new URLSearchParams({
    limit: '50',
    offset: '0',
  })

  if (input?.authProvider) {
    params.set('authProvider', input.authProvider)
  }

  if (input?.isActive !== undefined) {
    params.set('isActive', String(input.isActive))
  }

  return fetchJson<ListResponse<UserAccount>>(`/auth/users?${params.toString()}`)
}

export async function getRoleAssignments(input?: {
  userId?: string
  roleCode?: string
  scopeType?: string
  active?: boolean
}) {
  const params = new URLSearchParams({
    limit: '50',
    offset: '0',
  })

  if (input?.userId) {
    params.set('userId', input.userId)
  }

  if (input?.roleCode) {
    params.set('roleCode', input.roleCode)
  }

  if (input?.scopeType) {
    params.set('scopeType', input.scopeType)
  }

  if (input?.active !== undefined) {
    params.set('active', String(input.active))
  }

  return fetchJson<ListResponse<RoleAssignment>>(`/auth/role-assignments?${params.toString()}`)
}

export async function getActionStoreAssignments(input?: {
  userId?: string
  storeId?: string
  active?: boolean
}) {
  const params = new URLSearchParams({
    limit: '50',
    offset: '0',
  })

  if (input?.userId) {
    params.set('userId', input.userId)
  }

  if (input?.storeId) {
    params.set('storeId', input.storeId)
  }

  if (input?.active !== undefined) {
    params.set('active', String(input.active))
  }

  return fetchJson<ListResponse<ActionStoreAssignment>>(
    `/auth/action-store-assignments?${params.toString()}`,
  )
}

export async function getRoles() {
  return fetchOpenApiJson('/api/auth/roles')
}

export async function getPermissions() {
  return fetchOpenApiJson('/api/auth/permissions')
}

export async function deactivateRoleAssignment(assignmentId: string) {
  return sendJson<CommandResponse<{ assignment: RoleAssignment }>>(
    `/auth/role-assignments/${assignmentId}/deactivate`,
    { method: 'PATCH' },
  )
}

export async function deactivateActionStoreAssignment(assignmentId: string) {
  return sendJson<CommandResponse<{ assignment: ActionStoreAssignment }>>(
    `/auth/action-store-assignments/${assignmentId}/deactivate`,
    { method: 'PATCH' },
  )
}

export async function deactivateUserAccount(userId: string) {
  return sendJson<CommandResponse<{ user: UserAccount; accessClosure: UserAccessClosure }>>(
    `/auth/users/${userId}/deactivate`,
    {
      method: 'PATCH',
    },
  )
}

export async function reactivateUserAccount(userId: string) {
  return sendJson<CommandResponse<{ user: UserAccount }>>(`/auth/users/${userId}/reactivate`, {
    method: 'PATCH',
  })
}

export async function createUserAccount(input: {
  employeeId?: string
  username: string
  email: string
  authProvider: 'local' | 'oidc' | 'sso' | 'clerk'
  providerSubject?: string
}) {
  return sendJson<CommandResponse<{ user: UserAccount }>>('/auth/users', {
    method: 'POST',
    body: input,
  })
}

export async function createPilotUserBinding(input: {
  employeeId: string
  authProvider: 'oidc' | 'clerk'
  providerSubject: string
  username: string
  email: string
  roleCode: 'REGION_MANAGER' | 'STORE_MANAGER' | 'VISUAL_MERCHANDISER'
  storeIds: string[]
}) {
  return sendJson<CommandResponse<{ binding: PilotUserBinding }>>('/auth/pilot-user-bindings', {
    method: 'POST',
    body: input,
  })
}

export async function createRoleAssignment(input: {
  userId: string
  roleCode: string
  scopeType: 'company' | 'region' | 'store'
  companyId?: string
  regionId?: string
  storeId?: string
  effectiveFrom?: string
  effectiveTo?: string
}) {
  return sendJson<CommandResponse<{ assignment: RoleAssignment }>>('/auth/role-assignments', {
    method: 'POST',
    body: input,
  })
}

export async function createActionStoreAssignment(input: {
  userId: string
  storeId: string
  effectiveFrom?: string
  effectiveTo?: string
}) {
  return sendJson<CommandResponse<{ assignment: ActionStoreAssignment }>>(
    '/auth/action-store-assignments',
    {
      method: 'POST',
      body: input,
    },
  )
}

export async function grantRolePermission(input: {
  roleId: string
  permissionCode: string
}) {
  return sendJson<
    CommandResponse<{
      rolePermission: {
        roleId: string
        roleCode: string
        permissionId: string
        permissionCode: string
        grantedAt?: string | null
      }
    }>
  >(`/auth/roles/${input.roleId}/permissions`, {
    method: 'POST',
    body: {
      permissionCode: input.permissionCode,
    },
  })
}

export async function revokeRolePermission(input: {
  roleId: string
  permissionCode: string
}) {
  return sendJson<
    CommandResponse<{
      rolePermission: {
        roleId: string
        roleCode: string
        permissionId: string
        permissionCode: string
      }
    }>
  >(`/auth/roles/${input.roleId}/permissions/${encodeURIComponent(input.permissionCode)}`, {
    method: 'DELETE',
  })
}

export async function getUserAudit(userId: string) {
  return fetchJson<ListResponse<AuditEvent>>(`/auth/users/${userId}/audit`)
}

export async function getRoleAssignmentAudit(assignmentId: string) {
  return fetchJson<ListResponse<AuditEvent>>(`/auth/role-assignments/${assignmentId}/audit`)
}

export async function getActionStoreAssignmentAudit(assignmentId: string) {
  return fetchJson<ListResponse<AuditEvent>>(
    `/auth/action-store-assignments/${assignmentId}/audit`,
  )
}
