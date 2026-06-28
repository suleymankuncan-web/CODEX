import { fetchJson, sendJson } from '../../lib/api'
import type { AuthSessionSummary } from '../auth/api'
import type {
  CreateFeedPostPayload,
  FeedPost,
  UpdateFeedPostPayload,
} from './contracts'

type ListResponse<T> = {
  items: T[]
  meta: {
    count: number
    total: number
    limit: number
    offset: number
  }
}

type CommandResponse<T> = {
  command: {
    status: string
    message: string
  }
  data: T
}

function sortedUnique(input: readonly string[] | undefined) {
  return [...new Set(input ?? [])].sort()
}

export function getFeedScopeSignature(authSummary: AuthSessionSummary | null) {
  const user = authSummary?.user

  if (!user) {
    return 'anonymous'
  }

  const roles = sortedUnique(user.roleCodes).join(',')
  const companyIds = sortedUnique([
    ...(user.readScope.companyIds ?? []),
    ...(user.scope.companyIds ?? []),
  ]).join(',')
  const regionIds = sortedUnique([
    ...(user.readScope.regionIds ?? []),
    ...(user.scope.regionIds ?? []),
  ]).join(',')
  const storeIds = sortedUnique([
    ...(user.readScope.storeIds ?? []),
    ...(user.scope.storeIds ?? []),
  ]).join(',')

  return `roles:${roles}|companies:${companyIds}|regions:${regionIds}|stores:${storeIds}|user:${user.userId}`
}

export function getVisibleFeedQueryKey(authSummary: AuthSessionSummary | null) {
  return ['visible-feed', getFeedScopeSignature(authSummary)] as const
}

export function getAdminFeedQueryKey(authSummary: AuthSessionSummary | null) {
  return ['admin-feed', getFeedScopeSignature(authSummary)] as const
}

export async function getVisibleFeedPosts() {
  return fetchJson<ListResponse<FeedPost>>('/feed?limit=50&offset=0')
}

export async function getAdminFeedPosts() {
  return fetchJson<ListResponse<FeedPost>>('/admin/feed?limit=50&offset=0')
}

export async function createFeedPost(input: CreateFeedPostPayload) {
  return sendJson<CommandResponse<{ feedPost: FeedPost }>>('/admin/feed', {
    method: 'POST',
    body: input,
  })
}

export async function updateFeedPost(input: {
  feedPostId: string
  payload: UpdateFeedPostPayload
}) {
  return sendJson<CommandResponse<{ feedPost: FeedPost }>>(`/admin/feed/${input.feedPostId}`, {
    method: 'PUT',
    body: input.payload,
  })
}

export async function publishFeedPost(feedPostId: string) {
  return sendJson<CommandResponse<{ feedPost: FeedPost }>>(
    `/admin/feed/${feedPostId}/publish`,
    { method: 'POST' },
  )
}

export async function pinFeedPost(feedPostId: string) {
  return sendJson<CommandResponse<{ feedPost: FeedPost }>>(`/admin/feed/${feedPostId}/pin`, {
    method: 'POST',
  })
}

export async function unpinFeedPost(feedPostId: string) {
  return sendJson<CommandResponse<{ feedPost: FeedPost }>>(`/admin/feed/${feedPostId}/unpin`, {
    method: 'POST',
  })
}

export async function archiveFeedPost(feedPostId: string) {
  return sendJson<CommandResponse<{ feedPost: FeedPost }>>(`/admin/feed/${feedPostId}/archive`, {
    method: 'POST',
  })
}
