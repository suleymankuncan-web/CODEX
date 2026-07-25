import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router'
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
import type { TranslateFunction, TranslationKey } from '../features/localization/dictionary'
import { useLocalization } from '../features/localization/useLocalization'
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
import { getIntlLocale, type AppLocale } from '../lib/i18n'
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

export function StoreFeedPage(input: { authSummary: AuthSessionSummary | null }) {
  const { locale, t } = useLocalization()
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
  const roleLabel = formatRoleLabel(roleCodes, t)
  const contextLabel = canComposeRegionFeed ? t('storeFeed.context.regionStores') : roleLabel
  const [notice, setNotice] = useState<TranslationKey | null>(null)
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
      label: t('storeFeed.metric.visible'),
      value: String(visiblePosts.length),
      note: t('storeFeed.metric.visibleNote'),
      icon: Megaphone,
      tone: 'plum',
    },
    {
      label: t('storeFeed.metric.pinned'),
      value: String(pinnedPosts.length),
      note: t('storeFeed.metric.pinnedNote'),
      icon: Pin,
      tone: 'amber',
    },
    {
      label: t('storeFeed.metric.today'),
      value: String(todayPosts.length),
      note: t('storeFeed.metric.todayNote'),
      icon: Clock3,
      tone: 'cyan',
    },
    {
      label: t('storeFeed.metric.regionStores'),
      value: String(storeCount),
      note: t('storeFeed.metric.regionStoresNote'),
      icon: Store,
      tone: 'mint',
    },
  ], [pinnedPosts.length, storeCount, t, todayPosts.length, visiblePosts.length])

  const createMutation = useMutation({
    mutationFn: createFeedPost,
    onSuccess: async (response) => {
      upsertFeedPost(queryClient, visibleFeedQueryKey, response.data.feedPost)
      upsertFeedPost(queryClient, adminFeedQueryKey, response.data.feedPost)
      setBody('')
      setPinNextPost(false)
      setRemovedPostSnapshot(null)
      setNotice(null)
      actionToast.success(response.data.feedPost.isPinned
        ? t('storeFeed.toast.createdPinned')
        : t('storeFeed.toast.created'))
      await invalidateFeedQueries(queryClient, visibleFeedQueryKey, adminFeedQueryKey)
    },
    onError: (error) => {
      actionToast.error(error, t('storeFeed.actionError'))
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
      actionToast.success(t('storeFeed.toast.updated'))
      await invalidateFeedQueries(queryClient, visibleFeedQueryKey, adminFeedQueryKey)
    },
    onError: (error) => {
      actionToast.error(error, t('storeFeed.actionError'))
    },
  })
  const pinMutation = useMutation({
    mutationFn: pinFeedPost,
    onSuccess: async (response) => {
      upsertFeedPost(queryClient, visibleFeedQueryKey, response.data.feedPost)
      upsertFeedPost(queryClient, adminFeedQueryKey, response.data.feedPost)
      setNotice(null)
      actionToast.success(t('storeFeed.toast.pinned'))
      await invalidateFeedQueries(queryClient, visibleFeedQueryKey, adminFeedQueryKey)
    },
    onError: (error) => actionToast.error(error, t('storeFeed.actionError')),
  })
  const unpinMutation = useMutation({
    mutationFn: unpinFeedPost,
    onSuccess: async (response) => {
      upsertFeedPost(queryClient, visibleFeedQueryKey, response.data.feedPost)
      upsertFeedPost(queryClient, adminFeedQueryKey, response.data.feedPost)
      setNotice(null)
      actionToast.info(t('storeFeed.toast.unpinned'))
      await invalidateFeedQueries(queryClient, visibleFeedQueryKey, adminFeedQueryKey)
    },
    onError: (error) => actionToast.error(error, t('storeFeed.actionError')),
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
      actionToast.error(error, t('storeFeed.actionError'))
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
    setNotice('storeFeed.notice.removed')

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
    setNotice('storeFeed.notice.restored')
  }

  return (
    <section
      className="feed-command store-feed-command-page"
      aria-labelledby="feed-production-title"
      onClick={() => setOpenPostMenuId(null)}
    >
      <header className="feed-command-hero">
        <div className="feed-command-title-block">
          <div className="feed-command-pills">
            <span className="feed-pill feed-pill-primary">
              <Megaphone size={15} />
              {t('storeFeed.heroEyebrow')}
            </span>
            <span className="feed-pill">{roleLabel}</span>
            <span className="feed-pill feed-pill-soft">{contextLabel}</span>
          </div>
          <h1 id="feed-production-title">{t('storeFeed.heroEyebrow')}</h1>
          <p>{t('storeFeed.productionHeroCopy')}</p>
        </div>
        <div className="feed-command-actions">
          <button
            type="button"
            className="feed-button feed-button-muted"
            onClick={() => void feedQuery.refetch()}
          >
            <RefreshCcw size={16} />
            {t('storeFeed.refresh')}
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
        <section
          className="feed-composer-card feed-composer-card-compact"
          aria-label={t('storeFeed.composerAria')}
        >
          <div className="feed-composer-avatar" aria-hidden="true">
            <Megaphone size={20} />
          </div>
          <div className="feed-composer-form">
            <textarea
              aria-label={t('storeFeed.composerBodyAria')}
              className="feed-composer-body"
              placeholder={t('storeFeed.composerPlaceholder')}
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
                  {t('storeFeed.pinAction')}
                </button>
                <button
                  type="button"
                  className="feed-button feed-button-primary feed-composer-submit"
                  disabled={!canPublish || createMutation.isPending}
                  onClick={publishPost}
                >
                  <Send size={16} />
                  {t('storeFeed.shareAction')}
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
            {t(notice)}
          </span>
          {removedPostSnapshot ? (
            <button type="button" className="feed-notice-action" onClick={undoRemovePost}>
              {t('storeFeed.undoAction')}
            </button>
          ) : null}
        </div>
      ) : null}

      <section className="feed-list-panel feed-list-panel-full">
        <div className="feed-list-head">
          <div>
            <h2>{t('storeFeed.regionFeed')}</h2>
            <p>{t('storeFeed.regionFeedCopy')}</p>
          </div>
          <span>{t('storeFeed.recordCount', { count: visiblePosts.length })}</span>
        </div>

        <div className="feed-list">
          {feedQuery.isLoading ? (
            <FeedStateRow
              title={t('storeFeed.loadingTitle')}
              copy={t('storeFeed.loadingCopy')}
            />
          ) : null}

          {feedQuery.isError ? (
            <FeedStateRow
              title={t('storeFeed.errorTitle')}
              copy={getUserFacingErrorMessage(feedQuery.error, t('storeFeed.loadError'))}
              actionLabel={t('storeFeed.retryAction')}
              onAction={() => void feedQuery.refetch()}
            />
          ) : null}

          {!feedQuery.isLoading && !feedQuery.isError && visiblePosts.length === 0 ? (
            <FeedStateRow
              title={t('storeFeed.emptyTitle')}
              copy={t('storeFeed.productionEmptyCopy')}
            />
          ) : null}

          {!feedQuery.isLoading && !feedQuery.isError
            ? visiblePosts.map((post, index) => (
                <FeedPostRow
                  key={post.feedPostId}
                  locale={locale}
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
                  t={t}
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
  locale: AppLocale
  opensUp: boolean
  onCancelEdit: () => void
  onEditBodyChange: (value: string) => void
  onMenuToggle: () => void
  onRemove: () => void
  onSaveEdit: () => void
  onStartEdit: () => void
  onTogglePin: () => void
  post: FeedPost
  t: TranslateFunction
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
            aria-label={input.t('storeFeed.postOptionsAria')}
            onClick={input.onMenuToggle}
          >
            <MoreVertical size={18} />
          </button>
          {input.isMenuOpen ? (
            <div className="feed-post-menu" role="menu">
              <button type="button" role="menuitem" onClick={input.onStartEdit}>
                <Pencil size={15} />
                {input.t('storeFeed.editAction')}
              </button>
              <button type="button" role="menuitem" onClick={input.onTogglePin}>
                <Pin size={15} />
                {input.post.isPinned
                  ? input.t('storeFeed.unpinAction')
                  : input.t('storeFeed.pinAction')}
              </button>
              <button type="button" role="menuitem" className="feed-post-menu-danger" onClick={input.onRemove}>
                <Trash2 size={15} />
                {input.t('storeFeed.archiveAction')}
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
              aria-label={input.t('storeFeed.editBodyAria')}
              value={input.editingBody}
              onChange={(event) => input.onEditBodyChange(event.target.value)}
            />
            <div className="feed-post-edit-actions">
              <button type="button" className="feed-button feed-button-muted" onClick={input.onCancelEdit}>
                {input.t('storeFeed.cancelAction')}
              </button>
              <button
                type="button"
                className="feed-button feed-button-primary"
                disabled={input.editingBody.trim().length === 0 || input.isMutationPending}
                onClick={input.onSaveEdit}
              >
                <Check size={15} />
                {input.t('storeFeed.saveAction')}
              </button>
            </div>
          </div>
        ) : (
          <p>{getPostBody(input.post)}</p>
        )}
        <div className="feed-post-meta">
          <span className="feed-post-time">
            <Clock3 size={14} />
            {formatPostTimestamp(
              input.post.publishedAt ?? input.post.createdAt,
              input.locale,
              input.t,
            )}
          </span>
          {input.post.isPinned ? (
            <span className="feed-post-meta-pin">{input.t('storeFeed.pinned')}</span>
          ) : null}
          {isEditedPost(input.post) ? (
            <span className="feed-post-meta-edited">{input.t('storeFeed.edited')}</span>
          ) : null}
          <span className="feed-post-meta-live">{input.t('storeFeed.published')}</span>
          <span>
            {rowType === 'focus'
              ? input.t('storeFeed.regionFocus')
              : input.t('storeFeed.type.announcement')}
          </span>
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

function formatPostTimestamp(input: string, locale: AppLocale, t: TranslateFunction) {
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

function formatRoleLabel(roleCodes: string[], t: TranslateFunction) {
  if (roleCodes.includes('REGION_MANAGER')) return t('storeFeed.role.regionManager')
  if (roleCodes.includes('STORE_MANAGER')) return t('storeFeed.role.storeManager')
  if (roleCodes.includes('STORE_PERSONNEL')) return t('storeFeed.role.personnel')
  if (roleCodes.includes('VISUAL_MERCHANDISER')) return t('storeFeed.role.visualMerchandiser')

  return t('storeFeed.role.store')
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
