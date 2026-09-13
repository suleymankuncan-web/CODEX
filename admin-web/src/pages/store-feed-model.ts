import type { FeedPost } from '../features/feed/contracts'
import type { TranslateFunction } from '../features/localization/dictionary'
import { getIntlLocale, type AppLocale } from '../lib/i18n'

export type StoreFeedFilter = 'all' | 'pinned' | 'today'

export function filterStoreFeedPosts(posts: FeedPost[], query: string, filter: StoreFeedFilter, locale: AppLocale) {
  const search = query.trim().toLocaleLowerCase(locale)
  return posts.filter(post => (filter !== 'pinned' || post.isPinned) && (filter !== 'today' || isToday(post.publishedAt ?? post.createdAt)) && `${post.title} ${post.body} ${post.metricLabel ?? ''}`.toLocaleLowerCase(locale).includes(search))
}

export function compareFeedPosts(left: FeedPost, right: FeedPost) {
  const pinnedDelta = Number(right.isPinned) - Number(left.isPinned)

  if (pinnedDelta !== 0) return pinnedDelta

  return getFeedPostTime(right) - getFeedPostTime(left)
}

export function getFeedPostTime(post: FeedPost) {
  return new Date(post.publishedAt ?? post.updatedAt ?? post.createdAt).getTime()
}

export function getPostRowType(post: FeedPost): 'announcement' | 'focus' {
  return post.postType === 'challenge' ? 'focus' : 'announcement'
}

export function getPostBody(post: FeedPost) {
  return post.body.trim() || post.title
}

export function derivePostTitle(body: string) {
  const firstLine = body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean)

  if (!firstLine) return 'Bölge duyurusu'

  return firstLine.length > 96 ? `${firstLine.slice(0, 93)}...` : firstLine
}

export function isEditedPost(post: FeedPost) {
  return new Date(post.updatedAt).getTime() !== new Date(post.createdAt).getTime()
}

export function isToday(input: string) {
  const date = new Date(input)
  const today = new Date()

  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  )
}

export function formatPostTimestamp(input: string, locale: AppLocale, t: TranslateFunction) {
  const date = new Date(input)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  const time = new Intl.DateTimeFormat(getIntlLocale(locale), {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)

  if (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  ) {
    return t('storeFeed.todayAt', { time })
  }

  if (
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate()
  ) {
    return t('storeFeed.yesterdayAt', { time })
  }

  return new Intl.DateTimeFormat(getIntlLocale(locale), {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}
