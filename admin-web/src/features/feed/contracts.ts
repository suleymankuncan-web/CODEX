export type FeedPostType = 'announcement' | 'challenge'
export type FeedVisibilityScopeType = 'company' | 'region' | 'store'
export type FeedPublishStatus = 'draft' | 'published' | 'archived'

export type FeedPost = {
  feedPostId: string
  postType: FeedPostType
  title: string
  body: string
  linkLabel: string | null
  linkUrl: string | null
  visibilityScopeType: FeedVisibilityScopeType
  visibilityScopeIds: string[]
  isPinned: boolean
  publishStatus: FeedPublishStatus
  publishedAt: string | null
  startsAt: string | null
  endsAt: string | null
  metricCode: string | null
  metricLabel: string | null
  challengeStartsOn: string | null
  challengeEndsOn: string | null
  targetRoute: string | null
  createdByUserId: string
  updatedByUserId: string
  createdAt: string
  updatedAt: string
}

export type CreateFeedPostPayload = {
  postType: FeedPostType
  title: string
  body: string
  linkLabel?: string
  linkUrl?: string
  visibilityScopeType: FeedVisibilityScopeType
  visibilityScopeIds?: string[]
  isPinned?: boolean
  publishStatus?: FeedPublishStatus
  startsAt?: string
  endsAt?: string
  metricCode?: string
  metricLabel?: string
  challengeStartsOn?: string
  challengeEndsOn?: string
  targetRoute?: string
}

export type UpdateFeedPostPayload = {
  title?: string
  body?: string
  linkLabel?: string | null
  linkUrl?: string | null
  visibilityScopeType?: FeedVisibilityScopeType
  visibilityScopeIds?: string[]
  startsAt?: string | null
  endsAt?: string | null
  metricCode?: string | null
  metricLabel?: string | null
  challengeStartsOn?: string | null
  challengeEndsOn?: string | null
  targetRoute?: string | null
}

export const challengeMetricOptions = [
  { metricCode: 'total_score', metricLabel: 'Total score' },
  { metricCode: 'upt', metricLabel: 'UPT' },
  { metricCode: 'atv', metricLabel: 'ATV' },
  { metricCode: 'cr', metricLabel: 'CR' },
]

export const feedTargetRouteOptions = [
  { route: '/store/rankings', label: 'Store rankings' },
  { route: '/store/me', label: 'My performance' },
]

export function formatFeedPostType(input: FeedPostType) {
  return input === 'challenge' ? 'Challenge' : 'Announcement'
}

export function formatFeedScope(input: FeedVisibilityScopeType) {
  if (input === 'company') return 'Company'
  if (input === 'region') return 'Region'
  return 'Store'
}
