import { fetchJson, sendJson } from '../../lib/api'
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
