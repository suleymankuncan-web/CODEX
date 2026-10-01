import { fetchOpenApiJson, sendOpenApiJson, type ApiGetResponse } from '../../lib/openapi-client'

export type AccountSecurity = ApiGetResponse<'/api/auth/users/{userId}/security'>
export const getAccountSecurity = (userId: string) => fetchOpenApiJson('/api/auth/users/{userId}/security', { params: { userId } })
export const requestPasswordLink = (userId: string, kind: 'setup' | 'reset', requestId: string) =>
  sendOpenApiJson('/api/auth/users/{userId}/password-links', { method: 'POST', params: { userId }, body: { kind, requestId } })
