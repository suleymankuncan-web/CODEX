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
  formatFeedPostType,
  formatFeedScope,
  type FeedPost,
} from '../features/feed/contracts'
import { formatDate, formatDateTime, getErrorMessage } from '../lib/format'

export function StoreFeedPage(input: { authSummary: AuthSessionSummary | null }) {
  const feedQuery = useQuery({
    queryKey: ['visible-feed'],
    queryFn: getVisibleFeedPosts,
    retry: false,
  })
  const posts = useMemo(() => feedQuery.data?.items ?? [], [feedQuery.data?.items])
  const pinnedPosts = posts.filter((post) => post.isPinned)
  const challengePosts = posts.filter((post) => post.postType === 'challenge')
  const scopeLabel = input.authSummary?.user.readScope.storeIds[0] ?? input.authSummary?.user.scope.storeIds[0] ?? 'Mağaza kapsamı yok'

  if (feedQuery.isLoading) {
    return <ScreenState title="Duyurular yükleniyor" copy="Mağaza akışı hazırlanıyor." />
  }

  if (feedQuery.isError) {
    return (
      <ScreenState
        title="Duyurular açılamadı"
        copy={getErrorMessage(feedQuery.error)}
        tone="error"
      />
    )
  }

  return (
    <section className="page-stack">
      <section className="hero-panel store-hero-panel">
        <div>
          <div className="eyebrow">Duyurular</div>
          <h2 className="hero-title">Şirket, bölge ve mağaza duyuruları tek akışta.</h2>
          <p className="hero-copy">
            Yarışma duyuruları burada görünür; skor ve sıralama takibi mevcut performans
            yüzeylerinden yapılır.
          </p>
        </div>
        <div className="hero-metrics">
          <MetricAccent label="Rota" value="/store/feed" />
          <MetricAccent label="Görünen post" value={String(posts.length)} />
          <MetricAccent label="Mağaza kapsamı" value={scopeLabel} />
        </div>
      </section>

      <section className="metric-grid store-metric-grid">
        <MetricCard
          title="Görünen postlar"
          value={posts.length}
          note="Kapsamla eşleşen yayınlanmış duyurular."
          icon={<Megaphone size={18} />}
          tone="accent"
        />
        <MetricCard
          title="Sabitlenenler"
          value={pinnedPosts.length}
          note="Ana sayfada öne çıkabilecek duyurular."
          icon={<Pin size={18} />}
          tone={pinnedPosts.length > 0 ? 'warning' : 'neutral'}
        />
        <MetricCard
          title="Yarışma duyuruları"
          value={challengePosts.length}
          note="Sıralama veya profil yüzeylerine yönlenen odak postları."
          icon={<Trophy size={18} />}
          tone="calm"
        />
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <div className="eyebrow">Akış</div>
            <h3>Görünen duyurular</h3>
          </div>
        </div>

        {posts.length === 0 ? (
          <EmptyState
            title="Kapsamına uygun duyuru yok"
            copy="Şirket, bölge veya mağaza kapsamına uygun yayın geldiğinde burada görünür."
          />
        ) : (
          <div className="stacked-table">
            {posts.map((post) => (
              <StoreFeedPostRow key={post.feedPostId} post={post} />
            ))}
          </div>
        )}
      </section>
    </section>
  )
}

function StoreFeedPostRow(input: { post: FeedPost }) {
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
            {formatFeedPostType(input.post.postType)}
          </StatusPill>
          <StatusPill tone="neutral">{formatFeedScope(input.post.visibilityScopeType)}</StatusPill>
          {input.post.isPinned ? <StatusPill tone="warning">Sabit</StatusPill> : null}
        </div>
      </div>

      <div className="key-grid">
        <KeyValue label="Yayın" value={input.post.publishedAt ? formatDateTime(input.post.publishedAt) : 'Canlı'} />
        <KeyValue label="Metrik" value={input.post.metricLabel ?? 'Metrik yok'} />
        <KeyValue
          label="Yarışma aralığı"
          value={
            input.post.challengeStartsOn && input.post.challengeEndsOn
              ? `${formatDate(input.post.challengeStartsOn)} - ${formatDate(input.post.challengeEndsOn)}`
              : 'Yarışma aralığı yok'
          }
        />
        <KeyValue label="Hedef" value={destination ?? 'Link yok'} />
      </div>

      {destination ? (
        <div className="action-cluster">
          <Link className="control-button store-shell-link" to={destination}>
            {input.post.linkLabel ?? 'Detayı aç'}
          </Link>
        </div>
      ) : null}
    </article>
  )
}
