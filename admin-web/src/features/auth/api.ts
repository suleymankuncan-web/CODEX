import { sendJson } from '../../lib/api'
import {
  fetchOpenApiJson,
  sendOpenApiJson,
  type ApiGetResponse,
  type ApiMutationBody,
  type ApiMutationResponse,
} from '../../lib/openapi-client'

export type AuthLookups = ApiGetResponse<'/api/auth/lookups'>
export type AuthLookupUser = AuthLookups['users'][number]
export type AuthLookupStore = AuthLookups['stores'][number]
type AuthLookupUserSearchResponse = ApiGetResponse<'/api/auth/lookups/users/search'>
export type AuthLookupUserSearchResult = AuthLookupUserSearchResponse['items'][number]
type AuthRoleCatalogResponse = ApiGetResponse<'/api/auth/roles'>
export type RoleCatalogItem = AuthRoleCatalogResponse['items'][number]
type AuthPermissionCatalogResponse = ApiGetResponse<'/api/auth/permissions'>
export type PermissionCatalogItem = AuthPermissionCatalogResponse['items'][number]
type AuthUserAccountsResponse = ApiGetResponse<'/api/auth/users'>
export type UserAccount = AuthUserAccountsResponse['items'][number]
export type CreateUserAccountInput = ApiMutationBody<'/api/auth/users', 'POST'>
type DeactivateUserAccountResponse = ApiMutationResponse<
  '/api/auth/users/{userId}/deactivate',
  'PATCH'
>
type AuthRoleAssignmentsResponse = ApiGetResponse<'/api/auth/role-assignments'>
export type RoleAssignment = AuthRoleAssignmentsResponse['items'][number]
export type CreateRoleAssignmentInput = ApiMutationBody<
  '/api/auth/role-assignments',
  'POST'
>
type AuthActionStoreAssignmentsResponse = ApiGetResponse<'/api/auth/action-store-assignments'>
export type ActionStoreAssignment = AuthActionStoreAssignmentsResponse['items'][number]
export type CreateActionStoreAssignmentInput = ApiMutationBody<
  '/api/auth/action-store-assignments',
  'POST'
>
type AuthAuditResponse = ApiGetResponse<'/api/auth/users/{userId}/audit'>
export type AuditEvent = AuthAuditResponse['items'][number]
export type AuthBootstrap = ApiGetResponse<'/api/auth/bootstrap'>
export type AuthSessionSummary = ApiGetResponse<'/api/auth/session'>

export type UserAccessClosure = DeactivateUserAccountResponse['data']['accessClosure']

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
  return fetchOpenApiJson('/api/auth/session')
}

export async function getAuthBootstrap() {
  return fetchOpenApiJson('/api/auth/bootstrap')
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

  return fetchOpenApiJson('/api/auth/users', { query: params })
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

  return fetchOpenApiJson('/api/auth/role-assignments', { query: params })
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

  return fetchOpenApiJson('/api/auth/action-store-assignments', { query: params })
}

export async function getRoles() {
  return fetchOpenApiJson('/api/auth/roles')
}

export async function getPermissions() {
  return fetchOpenApiJson('/api/auth/permissions')
}

export async function deactivateRoleAssignment(assignmentId: string) {
  return sendOpenApiJson('/api/auth/role-assignments/{assignmentId}/deactivate', {
    method: 'PATCH',
    params: { assignmentId },
  })
}

export async function deactivateActionStoreAssignment(assignmentId: string) {
  return sendOpenApiJson('/api/auth/action-store-assignments/{assignmentId}/deactivate', {
    method: 'PATCH',
    params: { assignmentId },
  })
}

export async function deactivateUserAccount(userId: string) {
  return sendOpenApiJson('/api/auth/users/{userId}/deactivate', {
    method: 'PATCH',
    params: { userId },
  })
}

export async function reactivateUserAccount(userId: string) {
  return sendOpenApiJson('/api/auth/users/{userId}/reactivate', {
    method: 'PATCH',
    params: { userId },
  })
}

export async function createUserAccount(input: CreateUserAccountInput) {
  return sendOpenApiJson('/api/auth/users', {
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

export async function createRoleAssignment(
  input: CreateRoleAssignmentInput,
) {
  return sendOpenApiJson('/api/auth/role-assignments', {
    method: 'POST',
    body: input,
  })
}

export async function createActionStoreAssignment(input: CreateActionStoreAssignmentInput) {
  return sendOpenApiJson('/api/auth/action-store-assignments', {
    method: 'POST',
    body: input,
  })
}

export async function grantRolePermission(input: {
  roleId: string
  permissionCode: string
}) {
  return sendOpenApiJson('/api/auth/roles/{roleId}/permissions', {
    method: 'POST',
    params: { roleId: input.roleId },
    body: {
      permissionCode: input.permissionCode,
    },
  })
}

export async function revokeRolePermission(input: {
  roleId: string
  permissionCode: string
}) {
  return sendOpenApiJson('/api/auth/roles/{roleId}/permissions/{permissionCode}', {
    method: 'DELETE',
    params: {
      roleId: input.roleId,
      permissionCode: input.permissionCode,
    },
  })
}

export async function getUserAudit(userId: string) {
  return fetchOpenApiJson('/api/auth/users/{userId}/audit', {
    params: { userId },
  })
}

export async function getRoleAssignmentAudit(assignmentId: string) {
  return fetchOpenApiJson('/api/auth/role-assignments/{assignmentId}/audit', {
    params: { assignmentId },
  })
}

export async function getActionStoreAssignmentAudit(assignmentId: string) {
  return fetchOpenApiJson('/api/auth/action-store-assignments/{assignmentId}/audit', {
    params: { assignmentId },
  })
}
