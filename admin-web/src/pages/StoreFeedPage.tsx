import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ArrowRight, CalendarDays, Megaphone, Pin, Trophy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { AuthSessionSummary } from '../features/auth/api'
import { getVisibleFeedPosts } from '../features/feed/api'
import {
  type FeedPost,
  type FeedPostType,
  type FeedVisibilityScopeType,
} from '../features/feed/contracts'
import type { TranslateFunction, TranslationKey } from '../features/localization/dictionary'
import { useLocalization } from '../features/localization/useLocalization'
import { formatDate, formatDateTime, getErrorMessage } from '../lib/format'
import type { AppLocale } from '../lib/i18n'
import { transientQueryRetryOptions } from '../lib/query-retry'
import {
  StoreEmptyState,
  StoreErrorState,
  StoreInfoGrid,
  StoreLoadingState,
  StoreMetricCard,
  StoreMetricGrid,
  StoreSectionCard,
  StoreStackedList,
  StoreStackedRow,
  StoreStatusBadge,
  StoreSurfaceHeader,
  StoreSurfacePage,
} from './store-surface-primitives'

const feedPostTypeLabelKeys: Record<FeedPostType, TranslationKey> = {
  announcement: 'storeFeed.type.announcement',
  challenge: 'storeFeed.type.challenge',
}

const feedScopeLabelKeys: Record<FeedVisibilityScopeType, TranslationKey> = {
  company: 'storeFeed.scope.company',
  region: 'storeFeed.scope.region',
  store: 'storeFeed.scope.store',
}

function formatFeedPostTypeLabel(t: TranslateFunction, input: FeedPostType) {
  return t(feedPostTypeLabelKeys[input])
}

function formatFeedScopeLabel(t: TranslateFunction, input: FeedVisibilityScopeType) {
  return t(feedScopeLabelKeys[input])
}

export function StoreFeedPage(input: { authSummary: AuthSessionSummary | null }) {
  const { locale, t } = useLocalization()
  const feedQuery = useQuery({
    queryKey: ['visible-feed'],
    queryFn: getVisibleFeedPosts,
    staleTime: 30_000,
    ...transientQueryRetryOptions,
  })
  const posts = useMemo(() => feedQuery.data?.items ?? [], [feedQuery.data?.items])
  const pinnedPosts = posts.filter((post) => post.isPinned)
  const challengePosts = posts.filter((post) => post.postType === 'challenge')
  const scopeLabel =
    input.authSummary?.user.readScope.storeIds[0] ??
    input.authSummary?.user.scope.storeIds[0] ??
    t('storeFeed.noStoreScope')

  if (feedQuery.isLoading) {
    return <StoreLoadingState title={t('storeFeed.loadingTitle')} description={t('storeFeed.loadingCopy')} />
  }

  if (feedQuery.isError) {
    return (
      <StoreSurfacePage ariaLabel={t('storeFeed.title')}>
        <StoreErrorState
          title={t('storeFeed.errorTitle')}
          description={getErrorMessage(feedQuery.error)}
          action={{
            label: t('storeFeed.retryAction'),
            onClick: () => void feedQuery.refetch(),
            variant: 'outline',
          }}
        />
      </StoreSurfacePage>
    )
  }

  return (
    <StoreSurfacePage ariaLabel={t('storeFeed.title')}>
      <StoreSurfaceHeader
        eyebrow={t('storeFeed.heroEyebrow')}
        title={t('storeFeed.title')}
        description={t('storeFeed.heroCopy')}
        badges={[
          { label: `${t('storeFeed.visiblePost')}: ${posts.length}`, tone: 'accent' },
          { label: `${t('storeFeed.storeScope')}: ${scopeLabel}`, tone: 'neutral' },
        ]}
      />

      <StoreMetricGrid className="tw:xl:grid-cols-3">
        <StoreMetricCard
          title={t('storeFeed.visiblePosts')}
          value={posts.length}
          note={t('storeFeed.visiblePostsNote')}
          icon={<Megaphone data-icon="inline-start" />}
          tone="accent"
        />
        <StoreMetricCard
          title={t('storeFeed.pinnedPosts')}
          value={pinnedPosts.length}
          note={t('storeFeed.pinnedPostsNote')}
          icon={<Pin data-icon="inline-start" />}
          tone={pinnedPosts.length > 0 ? 'warning' : 'neutral'}
        />
        <StoreMetricCard
          title={t('storeFeed.challengeAnnouncements')}
          value={challengePosts.length}
          note={t('storeFeed.challengeAnnouncementsNote')}
          icon={<Trophy data-icon="inline-start" />}
          tone="calm"
        />
      </StoreMetricGrid>

      <StoreSectionCard title={t('storeFeed.visibleAnnouncements')} description={t('storeFeed.feedEyebrow')}>
        {posts.length === 0 ? (
          <StoreEmptyState title={t('storeFeed.emptyTitle')} description={t('storeFeed.emptyCopy')} />
        ) : (
          <StoreStackedList>
            {posts.map((post) => (
              <StoreFeedPostRow key={post.feedPostId} locale={locale} post={post} t={t} />
            ))}
          </StoreStackedList>
        )}
      </StoreSectionCard>
    </StoreSurfacePage>
  )
}

function StoreFeedPostRow(input: {
  locale: AppLocale
  post: FeedPost
  t: TranslateFunction
}) {
  const destination = input.post.targetRoute ?? input.post.linkUrl

  return (
    <StoreStackedRow>
      <div className="tw:flex tw:flex-col tw:gap-3">
        <div className="tw:flex tw:flex-col tw:gap-3 tw:md:flex-row tw:md:items-start tw:md:justify-between">
          <div className="tw:min-w-0">
            <strong className="tw:block tw:text-sm tw:font-semibold tw:text-foreground">
              {input.post.title}
            </strong>
            <p className="tw:mt-1 tw:text-sm tw:leading-6 tw:text-muted-foreground">
              {input.post.body}
            </p>
          </div>
          <div className="tw:flex tw:flex-wrap tw:gap-2">
            <StoreStatusBadge tone={input.post.postType === 'challenge' ? 'accent' : 'neutral'}>
              {formatFeedPostTypeLabel(input.t, input.post.postType)}
            </StoreStatusBadge>
            <StoreStatusBadge tone="neutral">
              {formatFeedScopeLabel(input.t, input.post.visibilityScopeType)}
            </StoreStatusBadge>
            {input.post.isPinned ? (
              <StoreStatusBadge tone="warning">{input.t('storeFeed.pinned')}</StoreStatusBadge>
            ) : null}
          </div>
        </div>

        <StoreInfoGrid
          items={[
            {
              label: input.t('storeFeed.publish'),
              value: input.post.publishedAt
                ? formatDateTime(input.post.publishedAt, input.locale)
                : input.t('storeFeed.live'),
            },
            {
              label: input.t('storeFeed.metric'),
              value: input.post.metricLabel ?? input.t('storeFeed.noMetric'),
            },
            {
              label: input.t('storeFeed.challengeRange'),
              value:
                input.post.challengeStartsOn && input.post.challengeEndsOn
                  ? `${formatDate(input.post.challengeStartsOn, input.locale)} - ${formatDate(
                      input.post.challengeEndsOn,
                      input.locale,
                    )}`
                  : input.t('storeFeed.noChallengeRange'),
            },
          ]}
          className="tw:xl:grid-cols-3"
        />

        {destination ? (
          <div>
            <Button asChild size="sm" variant="outline">
              <Link to={destination}>
                <CalendarDays data-icon="inline-start" />
                {input.post.linkLabel ?? input.t('storeFeed.openDetail')}
                <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
          </div>
        ) : null}
      </div>
    </StoreStackedRow>
  )
}
