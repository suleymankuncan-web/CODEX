import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Megaphone, Pin, Trophy } from 'lucide-react'
import {
  EmptyState,
  KeyValue,
  MetricAccent,
  MetricCard,
  ScreenState,
  StatusPill,
} from '../components/dashboard-primitives'
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
    retry: false,
  })
  const posts = useMemo(() => feedQuery.data?.items ?? [], [feedQuery.data?.items])
  const pinnedPosts = posts.filter((post) => post.isPinned)
  const challengePosts = posts.filter((post) => post.postType === 'challenge')
  const scopeLabel =
    input.authSummary?.user.readScope.storeIds[0] ??
    input.authSummary?.user.scope.storeIds[0] ??
    t('storeFeed.noStoreScope')

  if (feedQuery.isLoading) {
    return <ScreenState title={t('storeFeed.loadingTitle')} copy={t('storeFeed.loadingCopy')} />
  }

  if (feedQuery.isError) {
    return (
      <ScreenState
        title={t('storeFeed.errorTitle')}
        copy={getErrorMessage(feedQuery.error)}
        tone="error"
      />
    )
  }

  return (
    <section className="page-stack">
      <section className="hero-panel store-hero-panel">
        <div>
          <div className="eyebrow">{t('storeFeed.heroEyebrow')}</div>
          <h2 className="hero-title">{t('storeFeed.title')}</h2>
          <p className="hero-copy">{t('storeFeed.heroCopy')}</p>
        </div>
        <div className="hero-metrics">
          <MetricAccent label={t('storeFeed.route')} value="/store/feed" />
          <MetricAccent label={t('storeFeed.visiblePost')} value={String(posts.length)} />
          <MetricAccent label={t('storeFeed.storeScope')} value={scopeLabel} />
        </div>
      </section>

      <section className="metric-grid store-metric-grid">
        <MetricCard
          title={t('storeFeed.visiblePosts')}
          value={posts.length}
          note={t('storeFeed.visiblePostsNote')}
          icon={<Megaphone size={18} />}
          tone="accent"
        />
        <MetricCard
          title={t('storeFeed.pinnedPosts')}
          value={pinnedPosts.length}
          note={t('storeFeed.pinnedPostsNote')}
          icon={<Pin size={18} />}
          tone={pinnedPosts.length > 0 ? 'warning' : 'neutral'}
        />
        <MetricCard
          title={t('storeFeed.challengeAnnouncements')}
          value={challengePosts.length}
          note={t('storeFeed.challengeAnnouncementsNote')}
          icon={<Trophy size={18} />}
          tone="calm"
        />
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <div className="eyebrow">{t('storeFeed.feedEyebrow')}</div>
            <h3>{t('storeFeed.visibleAnnouncements')}</h3>
          </div>
        </div>

        {posts.length === 0 ? (
          <EmptyState title={t('storeFeed.emptyTitle')} copy={t('storeFeed.emptyCopy')} />
        ) : (
          <div className="stacked-table">
            {posts.map((post) => (
              <StoreFeedPostRow key={post.feedPostId} locale={locale} post={post} t={t} />
            ))}
          </div>
        )}
      </section>
    </section>
  )
}

function StoreFeedPostRow(input: {
  locale: AppLocale
  post: FeedPost
  t: TranslateFunction
}) {
  const destination = input.post.targetRoute ?? input.post.linkUrl

  return (
    <article className="stacked-row">
      <div className="stacked-row-head">
        <div>
          <strong>{input.post.title}</strong>
          <p className="queue-subtitle">{input.post.body}</p>
        </div>
        <div className="action-cluster">
          <StatusPill tone={input.post.postType === 'challenge' ? 'accent' : 'neutral'}>
            {formatFeedPostTypeLabel(input.t, input.post.postType)}
          </StatusPill>
          <StatusPill tone="neutral">
            {formatFeedScopeLabel(input.t, input.post.visibilityScopeType)}
          </StatusPill>
          {input.post.isPinned ? (
            <StatusPill tone="warning">{input.t('storeFeed.pinned')}</StatusPill>
          ) : null}
        </div>
      </div>

      <div className="key-grid">
        <KeyValue
          label={input.t('storeFeed.publish')}
          value={
            input.post.publishedAt
              ? formatDateTime(input.post.publishedAt, input.locale)
              : input.t('storeFeed.live')
          }
        />
        <KeyValue
          label={input.t('storeFeed.metric')}
          value={input.post.metricLabel ?? input.t('storeFeed.noMetric')}
        />
        <KeyValue
          label={input.t('storeFeed.challengeRange')}
          value={
            input.post.challengeStartsOn && input.post.challengeEndsOn
              ? `${formatDate(input.post.challengeStartsOn, input.locale)} - ${formatDate(
                  input.post.challengeEndsOn,
                  input.locale,
                )}`
              : input.t('storeFeed.noChallengeRange')
          }
        />
        <KeyValue
          label={input.t('storeFeed.target')}
          value={destination ?? input.t('storeFeed.noLink')}
        />
      </div>

      {destination ? (
        <div className="action-cluster">
          <Link className="control-button store-shell-link" to={destination}>
            {input.post.linkLabel ?? input.t('storeFeed.openDetail')}
          </Link>
        </div>
      ) : null}
    </article>
  )
}
