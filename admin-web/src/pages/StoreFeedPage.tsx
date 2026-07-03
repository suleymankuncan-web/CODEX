import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  BellRing,
  Check,
  ChevronRight,
  Clock3,
  Megaphone,
  MoreVertical,
  Pencil,
  Pin,
  RefreshCcw,
  Send,
  Store,
  Trash2,
} from 'lucide-react'
import type { AuthSessionSummary } from '../features/auth/api'
import {
  archiveFeedPost,
  createFeedPost,
  getAdminFeedQueryKey,
  getVisibleFeedPosts,
  getVisibleFeedQueryKey,
  pinFeedPost,
  unpinFeedPost,
  updateFeedPost,
} from '../features/feed/api'
import type { FeedPost } from '../features/feed/contracts'
import { actionToast } from '../lib/action-toast'
import { getUserFacingErrorMessage } from '../lib/format'
import { transientQueryRetryOptions } from '../lib/query-retry'

type FeedTone = 'plum' | 'cyan' | 'mint' | 'amber'
type FeedRowType = 'announcement' | 'focus'
type FeedListResponse = Awaited<ReturnType<typeof getVisibleFeedPosts>>

type RemovedPostSnapshot = {
  post: FeedPost
}

type MetricCard = {
  icon: typeof Megaphone
  label: string
  note: string
  tone: FeedTone
  value: string
}

const archiveUndoDelayMs = 4500
const feedActionErrorCopy = 'Duyuru işlemi şu anda tamamlanamadı.'
const feedLoadErrorCopy = 'Duyurular şu anda yüklenemedi.'

export function StoreFeedPage(input: { authSummary: AuthSessionSummary | null }) {
  const queryClient = useQueryClient()
  const visibleFeedQueryKey = getVisibleFeedQueryKey(input.authSummary)
  const adminFeedQueryKey = getAdminFeedQueryKey(input.authSummary)
  const roleCodes = input.authSummary?.user.roleCodes ?? []
  const regionIds = useMemo(() => {
    return [
      ...new Set([
        ...(input.authSummary?.user.readScope.regionIds ?? []),
        ...(input.authSummary?.user.scope.regionIds ?? []),
      ]),
    ]
  }, [input.authSummary])
  const storeCount = useMemo(() => {
    return new Set([
      ...(input.authSummary?.user.readScope.storeIds ?? []),
      ...(input.authSummary?.user.scope.storeIds ?? []),
      ...(input.authSummary?.user.assignedStoreIds ?? []),
    ]).size
  }, [input.authSummary])
  const activeRegionId = regionIds[0] ?? ''
  const canComposeRegionFeed = roleCodes.includes('REGION_MANAGER') && activeRegionId.length > 0
  const roleLabel = formatRoleLabel(roleCodes)
  const contextLabel = canComposeRegionFeed ? 'Bölge mağazaları' : roleLabel
  const [notice, setNotice] = useState<string | null>(null)
  const [body, setBody] = useState('')
  const [pinNextPost, setPinNextPost] = useState(false)
  const [openPostMenuId, setOpenPostMenuId] = useState<string | null>(null)
  const [editingPostId, setEditingPostId] = useState<string | null>(null)
  const [editingBody, setEditingBody] = useState('')
  const [removedPostSnapshot, setRemovedPostSnapshot] = useState<RemovedPostSnapshot | null>(null)
  const [hiddenPostIds, setHiddenPostIds] = useState<Set<string>>(() => new Set())
  const archiveTimerRef = useRef<number | null>(null)

  const feedQuery = useQuery({
    queryKey: visibleFeedQueryKey,
    queryFn: getVisibleFeedPosts,
    staleTime: 30_000,
    ...transientQueryRetryOptions,
  })

  const rawPosts = useMemo(() => feedQuery.data?.items ?? [], [feedQuery.data?.items])
  const visiblePosts = useMemo(() => {
    return rawPosts
      .filter((post) => post.publishStatus === 'published' && !hiddenPostIds.has(post.feedPostId))
      .sort(compareFeedPosts)
  }, [hiddenPostIds, rawPosts])
  const pinnedPosts = visiblePosts.filter((post) => post.isPinned)
  const todayPosts = visiblePosts.filter((post) => isToday(post.publishedAt ?? post.createdAt))
  const canPublish = body.trim().length > 0 && canComposeRegionFeed

  const metricCards = useMemo<MetricCard[]>(() => [
    {
      label: 'Görünür duyuru',
      value: String(visiblePosts.length),
      note: 'Bölge mağazalarına açık',
      icon: Megaphone,
      tone: 'plum',
    },
    {
      label: 'Sabitlenen',
      value: String(pinnedPosts.length),
      note: 'Üstte kalan paylaşım',
      icon: Pin,
      tone: 'amber',
    },
    {
      label: 'Bugün paylaşılan',
      value: String(todayPosts.length),
      note: 'Bugün',
      icon: Clock3,
      tone: 'cyan',
    },
    {
      label: 'Bölge mağazası',
      value: String(storeCount),
      note: 'Duyuru kapsamı',
      icon: Store,
      tone: 'mint',
    },
  ], [pinnedPosts.length, storeCount, todayPosts.length, visiblePosts.length])

  const createMutation = useMutation({
    mutationFn: createFeedPost,
    onSuccess: async (response) => {
      upsertFeedPost(queryClient, visibleFeedQueryKey, response.data.feedPost)
      upsertFeedPost(queryClient, adminFeedQueryKey, response.data.feedPost)
      setBody('')
      setPinNextPost(false)
      setRemovedPostSnapshot(null)
      setNotice(null)
      actionToast.success(response.data.feedPost.isPinned ? 'Bölge duyurusu sabitlenerek paylaşıldı.' : 'Bölge duyurusu paylaşıldı.')
      await invalidateFeedQueries(queryClient, visibleFeedQueryKey, adminFeedQueryKey)
    },
    onError: (error) => {
      actionToast.error(error, feedActionErrorCopy)
    },
  })
  const updateMutation = useMutation({
    mutationFn: updateFeedPost,
    onSuccess: async (response) => {
      upsertFeedPost(queryClient, visibleFeedQueryKey, response.data.feedPost)
      upsertFeedPost(queryClient, adminFeedQueryKey, response.data.feedPost)
      setEditingPostId(null)
      setEditingBody('')
      setRemovedPostSnapshot(null)
      setNotice(null)
      actionToast.success('Gönderi güncellendi.')
      await invalidateFeedQueries(queryClient, visibleFeedQueryKey, adminFeedQueryKey)
    },
    onError: (error) => {
      actionToast.error(error, feedActionErrorCopy)
    },
  })
  const pinMutation = useMutation({
    mutationFn: pinFeedPost,
    onSuccess: async (response) => {
      upsertFeedPost(queryClient, visibleFeedQueryKey, response.data.feedPost)
      upsertFeedPost(queryClient, adminFeedQueryKey, response.data.feedPost)
      setNotice(null)
      actionToast.success('Gönderi sabitlendi.')
      await invalidateFeedQueries(queryClient, visibleFeedQueryKey, adminFeedQueryKey)
    },
    onError: (error) => actionToast.error(error, feedActionErrorCopy),
  })
  const unpinMutation = useMutation({
    mutationFn: unpinFeedPost,
    onSuccess: async (response) => {
      upsertFeedPost(queryClient, visibleFeedQueryKey, response.data.feedPost)
      upsertFeedPost(queryClient, adminFeedQueryKey, response.data.feedPost)
      setNotice(null)
      actionToast.info('Gönderi sabitlemeden kaldırıldı.')
      await invalidateFeedQueries(queryClient, visibleFeedQueryKey, adminFeedQueryKey)
    },
    onError: (error) => actionToast.error(error, feedActionErrorCopy),
  })
  const archiveMutation = useMutation({
    mutationFn: archiveFeedPost,
    onSuccess: async () => {
      await invalidateFeedQueries(queryClient, visibleFeedQueryKey, adminFeedQueryKey)
    },
    onError: (error, feedPostId) => {
      setHiddenPostIds((current) => {
        const next = new Set(current)
        next.delete(feedPostId)
        return next
      })
      actionToast.error(error, feedActionErrorCopy)
    },
  })

  useEffect(() => {
    if (!openPostMenuId) return

    function closeMenuWithEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpenPostMenuId(null)
      }
    }

    window.addEventListener('keydown', closeMenuWithEscape)

    return () => window.removeEventListener('keydown', closeMenuWithEscape)
  }, [openPostMenuId])

  useEffect(() => {
    return () => {
      if (archiveTimerRef.current) {
        window.clearTimeout(archiveTimerRef.current)
      }
    }
  }, [])

  function publishPost() {
    const nextBody = body.trim()

    if (!nextBody || !canComposeRegionFeed) return

    createMutation.mutate({
      postType: 'announcement',
      title: derivePostTitle(nextBody),
      body: nextBody,
      visibilityScopeType: 'region',
      visibilityScopeIds: [activeRegionId],
      isPinned: pinNextPost,
      publishStatus: 'published',
    })
  }

  function startEditingPost(post: FeedPost) {
    setEditingPostId(post.feedPostId)
    setEditingBody(getPostBody(post))
    setOpenPostMenuId(null)
  }

  function cancelEditingPost() {
    setEditingPostId(null)
    setEditingBody('')
  }

  function saveEditingPost() {
    const nextBody = editingBody.trim()

    if (!editingPostId || nextBody.length === 0) return

    updateMutation.mutate({
      feedPostId: editingPostId,
      payload: {
        title: derivePostTitle(nextBody),
        body: nextBody,
      },
    })
  }

  function togglePostPin(post: FeedPost) {
    setOpenPostMenuId(null)
    setRemovedPostSnapshot(null)

    if (post.isPinned) {
      unpinMutation.mutate(post.feedPostId)
      return
    }

    pinMutation.mutate(post.feedPostId)
  }

  function removePost(post: FeedPost) {
    if (archiveTimerRef.current) {
      window.clearTimeout(archiveTimerRef.current)
      archiveTimerRef.current = null
    }

    setHiddenPostIds((current) => new Set(current).add(post.feedPostId))
    setOpenPostMenuId(null)
    setRemovedPostSnapshot({ post })
    setNotice('Gönderi yayından kaldırıldı.')

    if (editingPostId === post.feedPostId) {
      cancelEditingPost()
    }

    archiveTimerRef.current = window.setTimeout(() => {
      archiveTimerRef.current = null
      archiveMutation.mutate(post.feedPostId)
      setRemovedPostSnapshot(null)
    }, archiveUndoDelayMs)
  }

  function undoRemovePost() {
    const snapshot = removedPostSnapshot

    if (!snapshot) return

    if (archiveTimerRef.current) {
      window.clearTimeout(archiveTimerRef.current)
      archiveTimerRef.current = null
    }

    setHiddenPostIds((current) => {
      const next = new Set(current)
      next.delete(snapshot.post.feedPostId)
      return next
    })
    setRemovedPostSnapshot(null)
    setNotice('Gönderi geri alındı.')
  }

  return (
    <section
      className="feed-prototype store-feed-command-page"
      aria-labelledby="feed-production-title"
      onClick={() => setOpenPostMenuId(null)}
    >
      <header className="feed-prototype-hero">
        <div className="feed-prototype-title-block">
          <div className="feed-prototype-pills">
            <span className="feed-pill feed-pill-primary">
              <Megaphone size={15} />
              Duyurular
            </span>
            <span className="feed-pill">{roleLabel}</span>
            <span className="feed-pill feed-pill-soft">{contextLabel}</span>
          </div>
          <h1 id="feed-production-title">Duyurular</h1>
          <p>Bölge mağazalarına giden hızlı duyuru ve paylaşım akışı.</p>
        </div>
        <div className="feed-prototype-actions">
          <button
            type="button"
            className="feed-button feed-button-muted"
            onClick={() => void feedQuery.refetch()}
          >
            <RefreshCcw size={16} />
            Yenile
          </button>
        </div>
      </header>

      <div className="feed-metrics">
        {metricCards.map((card) => {
          const Icon = card.icon
          return (
            <article className={`feed-metric feed-metric-${card.tone}`} key={card.label}>
              <span className="feed-metric-icon" aria-hidden="true">
                <Icon size={20} />
              </span>
              <span>{card.label}</span>
              <strong>{card.value}</strong>
              <small>{card.note}</small>
            </article>
          )
        })}
      </div>

      {canComposeRegionFeed ? (
        <section className="feed-composer-card feed-composer-card-compact" aria-label="Bölge duyurusu paylaş">
          <div className="feed-composer-avatar" aria-hidden="true">
            <Megaphone size={20} />
          </div>
          <div className="feed-composer-form">
            <textarea
              aria-label="Duyuru içeriği"
              className="feed-composer-body"
              placeholder="Bölge mağazalarına ne duyurmak istiyorsun?"
              rows={3}
              value={body}
              onChange={(event) => setBody(event.target.value)}
            />
            <div className="feed-composer-footer">
              <span className="feed-composer-context">{contextLabel}</span>
              <div className="feed-composer-actions">
                <button
                  type="button"
                  className={`feed-pin-toggle${pinNextPost ? ' feed-pin-toggle-active' : ''}`}
                  aria-pressed={pinNextPost}
                  onClick={() => setPinNextPost((current) => !current)}
                >
                  <Pin size={15} />
                  Sabitle
                </button>
                <button
                  type="button"
                  className="feed-button feed-button-primary feed-composer-submit"
                  disabled={!canPublish || createMutation.isPending}
                  onClick={publishPost}
                >
                  <Send size={16} />
                  Paylaş
                </button>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {notice ? (
        <div className="feed-notice">
          <span className="feed-notice-copy">
            <Check size={16} />
            {notice}
          </span>
          {removedPostSnapshot ? (
            <button type="button" className="feed-notice-action" onClick={undoRemovePost}>
              Geri al
            </button>
          ) : null}
        </div>
      ) : null}

      <section className="feed-list-panel feed-list-panel-full">
        <div className="feed-list-head">
          <div>
            <h2>Bölge akışı</h2>
            <p>En yeni duyurular ve bölge paylaşımları.</p>
          </div>
          <span>{visiblePosts.length} kayıt</span>
        </div>

        <div className="feed-list">
          {feedQuery.isLoading ? (
            <FeedStateRow title="Duyurular yükleniyor" copy="Mağaza akışı hazırlanıyor." />
          ) : null}

          {feedQuery.isError ? (
            <FeedStateRow
              title="Duyurular açılamadı"
              copy={getUserFacingErrorMessage(feedQuery.error, feedLoadErrorCopy)}
              actionLabel="Tekrar dene"
              onAction={() => void feedQuery.refetch()}
            />
          ) : null}

          {!feedQuery.isLoading && !feedQuery.isError && visiblePosts.length === 0 ? (
            <FeedStateRow title="Sana uygun duyuru yok" copy="Yeni duyurular burada görünecek." />
          ) : null}

          {!feedQuery.isLoading && !feedQuery.isError
            ? visiblePosts.map((post, index) => (
                <FeedPostRow
                  key={post.feedPostId}
                  canManage={canComposeRegionFeed}
                  editingBody={editingBody}
                  isEditing={editingPostId === post.feedPostId}
                  isMenuOpen={openPostMenuId === post.feedPostId}
                  isMutationPending={
                    updateMutation.isPending ||
                    pinMutation.isPending ||
                    unpinMutation.isPending ||
                    archiveMutation.isPending
                  }
                  opensUp={index === visiblePosts.length - 1}
                  onCancelEdit={cancelEditingPost}
                  onEditBodyChange={setEditingBody}
                  onMenuToggle={() => setOpenPostMenuId((current) => (
                    current === post.feedPostId ? null : post.feedPostId
                  ))}
                  onRemove={() => removePost(post)}
                  onSaveEdit={saveEditingPost}
                  onStartEdit={() => startEditingPost(post)}
                  onTogglePin={() => togglePostPin(post)}
                  post={post}
                />
              ))
            : null}
        </div>
      </section>
    </section>
  )
}

function FeedPostRow(input: {
  canManage: boolean
  editingBody: string
  isEditing: boolean
  isMenuOpen: boolean
  isMutationPending: boolean
  opensUp: boolean
  onCancelEdit: () => void
  onEditBodyChange: (value: string) => void
  onMenuToggle: () => void
  onRemove: () => void
  onSaveEdit: () => void
  onStartEdit: () => void
  onTogglePin: () => void
  post: FeedPost
}) {
  const rowType = getPostRowType(input.post)
  const destination = input.post.targetRoute ?? input.post.linkUrl

  return (
    <article
      className={`feed-post-row feed-post-${rowType}${input.canManage ? '' : ' feed-post-row-readonly'}`}
      data-testid="store-feed-post-row"
    >
      {input.canManage ? (
        <div
          className={`feed-post-menu-wrap${input.isMenuOpen ? ' feed-post-menu-wrap-open' : ''}${
            input.opensUp ? ' feed-post-menu-wrap-up' : ''
          }`}
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            className="feed-post-menu-button"
            aria-expanded={input.isMenuOpen}
            aria-label="Gönderi seçenekleri"
            onClick={input.onMenuToggle}
          >
            <MoreVertical size={18} />
          </button>
          {input.isMenuOpen ? (
            <div className="feed-post-menu" role="menu">
              <button type="button" role="menuitem" onClick={input.onStartEdit}>
                <Pencil size={15} />
                Düzenle
              </button>
              <button type="button" role="menuitem" onClick={input.onTogglePin}>
                <Pin size={15} />
                {input.post.isPinned ? 'Sabitlemeden kaldır' : 'Sabitle'}
              </button>
              <button type="button" role="menuitem" className="feed-post-menu-danger" onClick={input.onRemove}>
                <Trash2 size={15} />
                Yayından kaldır
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
      <div className="feed-post-icon" aria-hidden="true">
        {rowType === 'focus' ? <Megaphone size={18} /> : <BellRing size={18} />}
      </div>
      <div className="feed-post-main">
        {input.isEditing ? (
          <div className="feed-post-edit">
            <textarea
              className="feed-post-editor"
              aria-label="Gönderi metnini düzenle"
              value={input.editingBody}
              onChange={(event) => input.onEditBodyChange(event.target.value)}
            />
            <div className="feed-post-edit-actions">
              <button type="button" className="feed-button feed-button-muted" onClick={input.onCancelEdit}>
                Vazgeç
              </button>
              <button
                type="button"
                className="feed-button feed-button-primary"
                disabled={input.editingBody.trim().length === 0 || input.isMutationPending}
                onClick={input.onSaveEdit}
              >
                <Check size={15} />
                Kaydet
              </button>
            </div>
          </div>
        ) : (
          <p>{getPostBody(input.post)}</p>
        )}
        <div className="feed-post-meta">
          <span className="feed-post-time">
            <Clock3 size={14} />
            {formatPostTimestamp(input.post.publishedAt ?? input.post.createdAt)}
          </span>
          {input.post.isPinned ? <span className="feed-post-meta-pin">Sabit</span> : null}
          {isEditedPost(input.post) ? <span className="feed-post-meta-edited">Düzenlendi</span> : null}
          <span className="feed-post-meta-live">Yayında</span>
          <span>{rowType === 'focus' ? 'Bölge odağı' : 'Duyuru'}</span>
          {input.post.metricLabel ? <span>{input.post.metricLabel}</span> : null}
          {destination && input.post.linkLabel ? (
            <Link className="feed-post-meta-link" to={destination}>
              {input.post.linkLabel}
              <ChevronRight size={14} />
            </Link>
          ) : null}
        </div>
      </div>
    </article>
  )
}

function FeedStateRow(input: {
  actionLabel?: string
  copy: string
  onAction?: () => void
  title: string
}) {
  return (
    <div className="feed-state-row">
      <strong>{input.title}</strong>
      <span>{input.copy}</span>
      {input.actionLabel && input.onAction ? (
        <button type="button" className="feed-button feed-button-muted" onClick={input.onAction}>
          {input.actionLabel}
        </button>
      ) : null}
    </div>
  )
}

function compareFeedPosts(left: FeedPost, right: FeedPost) {
  const pinnedDelta = Number(right.isPinned) - Number(left.isPinned)

  if (pinnedDelta !== 0) return pinnedDelta

  return getFeedPostTime(right) - getFeedPostTime(left)
}

function getFeedPostTime(post: FeedPost) {
  return new Date(post.publishedAt ?? post.updatedAt ?? post.createdAt).getTime()
}

function getPostRowType(post: FeedPost): FeedRowType {
  return post.postType === 'challenge' ? 'focus' : 'announcement'
}

function getPostBody(post: FeedPost) {
  return post.body.trim() || post.title
}

function derivePostTitle(body: string) {
  const firstLine = body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean)

  if (!firstLine) return 'Bölge duyurusu'

  return firstLine.length > 96 ? `${firstLine.slice(0, 93)}...` : firstLine
}

function isEditedPost(post: FeedPost) {
  return new Date(post.updatedAt).getTime() !== new Date(post.createdAt).getTime()
}

function isToday(input: string) {
  const date = new Date(input)
  const today = new Date()

  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  )
}

function formatPostTimestamp(input: string) {
  const date = new Date(input)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  const time = new Intl.DateTimeFormat('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)

  if (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  ) {
    return `Bugün ${time}`
  }

  if (
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate()
  ) {
    return `Dün ${time}`
  }

  return new Intl.DateTimeFormat('tr-TR', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function formatRoleLabel(roleCodes: string[]) {
  if (roleCodes.includes('REGION_MANAGER')) return 'Bölge müdürü'
  if (roleCodes.includes('STORE_MANAGER')) return 'Mağaza müdürü'
  if (roleCodes.includes('STORE_PERSONNEL')) return 'Personel'
  if (roleCodes.includes('VISUAL_MERCHANDISER')) return 'VM'

  return 'Mağaza'
}

function upsertFeedPost(
  queryClient: ReturnType<typeof useQueryClient>,
  queryKey: readonly unknown[],
  feedPost: FeedPost,
) {
  queryClient.setQueryData<FeedListResponse | undefined>(queryKey, (current) => {
    if (!current) return current

    const items = [
      feedPost,
      ...current.items.filter((item) => item.feedPostId !== feedPost.feedPostId),
    ].sort(compareFeedPosts)

    return {
      ...current,
      items,
      meta: {
        ...current.meta,
        count: items.length,
        total: Math.max(current.meta.total, items.length),
      },
    }
  })
}

async function invalidateFeedQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  visibleFeedQueryKey: readonly unknown[],
  adminFeedQueryKey: readonly unknown[],
) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['visible-feed'] }),
    queryClient.invalidateQueries({ queryKey: ['admin-feed'] }),
    queryClient.invalidateQueries({ queryKey: visibleFeedQueryKey }),
    queryClient.invalidateQueries({ queryKey: adminFeedQueryKey }),
  ])
}
