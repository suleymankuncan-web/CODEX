import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Clock3, Megaphone, Pin, RefreshCcw, Search, Send, Store } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import type { AuthSessionSummary } from '../features/auth/api'
import type { TranslateFunction, TranslationKey } from '../features/localization/dictionary'
import { useLocalization } from '../features/localization/useLocalization'
import { archiveFeedPost, createFeedPost, getAdminFeedQueryKey, getVisibleFeedPosts, getVisibleFeedQueryKey, pinFeedPost, unpinFeedPost, updateFeedPost } from '../features/feed/api'
import type { FeedPost } from '../features/feed/contracts'
import { CommandCanvasPage } from '../features/store-command-canvas/primitives'
import { actionToast } from '../lib/action-toast'
import { getUserFacingErrorMessage } from '../lib/format'
import { transientQueryRetryOptions } from '../lib/query-retry'
import { StoreOperationsHeader } from './store-operations-layout'
import { StoreFeedTable } from './store-feed-table'
import { compareFeedPosts, derivePostTitle, filterStoreFeedPosts, getPostBody, isToday, type StoreFeedFilter } from './store-feed-model'
import './store-feed-azure.css'

type FeedListResponse = Awaited<ReturnType<typeof getVisibleFeedPosts>>
type RemovedPostSnapshot = { post: FeedPost }
const archiveUndoDelayMs = 4500

export function StoreFeedPage(input: { authSummary: AuthSessionSummary | null }) {
  return <StoreFeedSurface key={getVisibleFeedQueryKey(input.authSummary)[1]} {...input} />
}

function StoreFeedSurface(input: { authSummary: AuthSessionSummary | null }) {
  const { locale, t } = useLocalization()
  const queryClient = useQueryClient()
  const visibleFeedQueryKey = getVisibleFeedQueryKey(input.authSummary)
  const adminFeedQueryKey = getAdminFeedQueryKey(input.authSummary)
  const roleCodes = input.authSummary?.user.roleCodes ?? []
  const isRegionManagerRead = roleCodes.includes('REGION_MANAGER') && !roleCodes.includes('REPORT_VIEWER')
  const assignedStoreIds = useMemo(() => [
    ...new Set(input.authSummary?.user.actionScope.assignedStoreIds ?? []),
  ].sort(), [input.authSummary])
  const storeCount = useMemo(() => {
    if (isRegionManagerRead) return assignedStoreIds.length
    return new Set([
      ...(input.authSummary?.user.readScope.storeIds ?? []),
      ...(input.authSummary?.user.scope.storeIds ?? []),
      ...(input.authSummary?.user.assignedStoreIds ?? []),
    ]).size
  }, [assignedStoreIds, input.authSummary, isRegionManagerRead])
  const canComposeStoreFeed = isRegionManagerRead && assignedStoreIds.length > 0
  const roleLabel = roleCodes.includes('REPORT_VIEWER') ? t('storeFeed.role.reportViewer') : formatRoleLabel(roleCodes, t)
  const contextLabel = canComposeStoreFeed ? t('storeFeed.context.regionStores') : roleLabel
  const [notice, setNotice] = useState<TranslationKey | null>(null)
  const [body, setBody] = useState('')
  const [pinNextPost, setPinNextPost] = useState(false)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<StoreFeedFilter>('all')
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
  const canPublish = body.trim().length > 0 && canComposeStoreFeed

  const filteredPosts = filterStoreFeedPosts(visiblePosts, query, filter, locale)
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
    return () => {
      if (archiveTimerRef.current) {
        window.clearTimeout(archiveTimerRef.current)
      }
    }
  }, [])

  function publishPost() {
    const nextBody = body.trim()

    if (!nextBody || !canComposeStoreFeed) return

    createMutation.mutate({
      postType: 'announcement',
      title: derivePostTitle(nextBody),
      body: nextBody,
      visibilityScopeType: 'store',
      visibilityScopeIds: assignedStoreIds,
      isPinned: pinNextPost,
      publishStatus: 'published',
    })
  }

  function startEditingPost(post: FeedPost) {
    setEditingPostId(post.feedPostId)
    setEditingBody(getPostBody(post))
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
      if (removedPostSnapshot) archiveMutation.mutate(removedPostSnapshot.post.feedPostId)
    }

    setHiddenPostIds((current) => new Set(current).add(post.feedPostId))
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
    <CommandCanvasPage className="store-feed-azure" ariaLabelledBy="feed-production-title">
      <StoreOperationsHeader title={t('storeFeed.heroEyebrow')} titleId="feed-production-title" eyebrow={roleLabel}
        description={t('storeFeed.productionDescription')} icon={Megaphone}
        actions={<Button variant="outline" size="sm" className="operations-period" disabled={feedQuery.isFetching} onClick={() => void feedQuery.refetch()}><RefreshCcw data-icon="inline-start" />{t('storeFeed.refresh')}</Button>} />

      <div className="store-feed-summary" aria-label={t('storeFeed.heroEyebrow')}>
        {[
          { label: t('storeFeed.metric.visible'), value: visiblePosts.length, icon: Megaphone },
          { label: t('storeFeed.metric.pinned'), value: pinnedPosts.length, icon: Pin },
          { label: t('storeFeed.metric.today'), value: todayPosts.length, icon: Clock3 },
          { label: t('storeFeed.storeScope'), value: storeCount, icon: Store },
        ].map((item, index) => <Card key={item.label} size="sm"><CardHeader><CardTitle><item.icon aria-hidden="true" />{item.label}</CardTitle></CardHeader><CardContent>{index < 3 && (feedQuery.isLoading || feedQuery.isError) ? <span aria-label={t('storeFeed.unavailable')}>—</span> : item.value}</CardContent></Card>)}
      </div>

      {canComposeStoreFeed ? <Card size="sm" className="store-feed-composer" aria-label={t('storeFeed.composerAria')}>
        <CardHeader><CardTitle>{t('storeFeed.composerAria')}</CardTitle><CardDescription>{contextLabel}</CardDescription></CardHeader>
        <CardContent><FieldGroup><Field><FieldLabel htmlFor="store-feed-body">{t('storeFeed.composerBodyAria')}</FieldLabel><Textarea id="store-feed-body" placeholder={t('storeFeed.composerPlaceholder')} rows={2} value={body} disabled={createMutation.isPending} onChange={event => setBody(event.target.value)} /></Field></FieldGroup></CardContent>
        <CardFooter><Button variant="outline" size="sm" aria-pressed={pinNextPost} disabled={createMutation.isPending} onClick={() => setPinNextPost(current => !current)}><Pin data-icon="inline-start" />{t('storeFeed.pinAction')}</Button><Button size="sm" disabled={!canPublish || createMutation.isPending} onClick={publishPost}><Send data-icon="inline-start" />{t('storeFeed.shareAction')}</Button></CardFooter>
      </Card> : null}

      {notice ? <Alert role="status"><Check /><AlertDescription className="tw:flex tw:items-center tw:justify-between tw:gap-3"><span>{t(notice)}</span>{removedPostSnapshot ? <Button variant="outline" size="sm" onClick={undoRemovePost}>{t('storeFeed.undoAction')}</Button> : null}</AlertDescription></Alert> : null}

      <Card className="store-feed-board">
        <CardHeader>
          <div className="store-feed-board-heading"><CardTitle><h2>{t('storeFeed.boardTitle')}</h2></CardTitle><Badge variant="secondary" aria-live="polite">{feedQuery.isLoading || feedQuery.isError ? '—' : t('storeFeed.recordCount', { count: filteredPosts.length })}</Badge></div>
          <div className="store-feed-toolbar">
            <InputGroup><InputGroupAddon><Search aria-hidden="true" /></InputGroupAddon><InputGroupInput aria-label={t('storeFeed.search')} placeholder={t('storeFeed.search')} value={query} onChange={event => setQuery(event.target.value)} /></InputGroup>
            <ToggleGroup type="single" value={filter} aria-label={t('storeFeed.filterAria')} onValueChange={value => { if (value === 'all' || value === 'pinned' || value === 'today') setFilter(value) }}>
              <ToggleGroupItem value="all">{t('storeFeed.filter.all')}</ToggleGroupItem><ToggleGroupItem value="pinned">{t('storeFeed.pinned')}</ToggleGroupItem><ToggleGroupItem value="today">{t('storeFeed.filter.today')}</ToggleGroupItem>
            </ToggleGroup>
          </div>
        </CardHeader>
        <CardContent>
          {feedQuery.isLoading ? <div role="status" className="store-feed-loading"><span>{t('storeFeed.loadingTitle')}</span>{[0, 1, 2].map(item => <Skeleton key={item} className="tw:h-16 tw:w-full" />)}</div> : null}
          {feedQuery.isError ? <Alert variant="destructive"><AlertTitle>{t('storeFeed.errorTitle')}</AlertTitle><AlertDescription>{getUserFacingErrorMessage(feedQuery.error, t('storeFeed.loadError'))}<Button variant="outline" size="sm" disabled={feedQuery.isFetching} onClick={() => void feedQuery.refetch()}>{t('storeFeed.retryAction')}</Button></AlertDescription></Alert> : null}
          {!feedQuery.isLoading && !feedQuery.isError && !filteredPosts.length ? <Empty><EmptyHeader><EmptyTitle>{visiblePosts.length ? t('storeFeed.noMatchTitle') : t('storeFeed.emptyTitle')}</EmptyTitle><EmptyDescription>{visiblePosts.length ? t('storeFeed.noMatchCopy') : t('storeFeed.productionEmptyCopy')}</EmptyDescription></EmptyHeader>{query || filter !== 'all' ? <Button variant="outline" size="sm" onClick={() => { setQuery(''); setFilter('all') }}>{t('storeFeed.clearFilters')}</Button> : null}</Empty> : null}
          {!feedQuery.isLoading && !feedQuery.isError && filteredPosts.length ? <StoreFeedTable posts={filteredPosts} locale={locale} t={t} canManagePost={post => canComposeStoreFeed && post.visibilityScopeType === 'store' && post.visibilityScopeIds.length > 0 && post.visibilityScopeIds.every(storeId => assignedStoreIds.includes(storeId))} editingPostId={editingPostId} editingBody={editingBody} onEditBodyChange={setEditingBody} onStartEdit={startEditingPost} onCancelEdit={cancelEditingPost} onSaveEdit={saveEditingPost} onTogglePin={togglePostPin} onRemove={removePost} isMutationPending={updateMutation.isPending || pinMutation.isPending || unpinMutation.isPending || archiveMutation.isPending} /> : null}
        </CardContent>
      </Card>
    </CommandCanvasPage>
  )
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
