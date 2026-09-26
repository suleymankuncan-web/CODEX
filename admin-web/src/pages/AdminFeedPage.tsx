import { Input } from '@/components/ui/input'
import { useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react'
import { useMutation, useMutationState, useQuery, useQueryClient } from '@tanstack/react-query'
import { Megaphone, Pin, Send, ShieldCheck, Trophy } from 'lucide-react'
import {
  AdminOperationalBadge as StatusPill,
  AdminOperationalEmpty as EmptyState,
  AdminOperationalHeader,
  AdminOperationalKeyGrid,
  AdminOperationalKeyValue as KeyValue,
  AdminOperationalMetrics,
  AdminOperationalPage,
  AdminOperationalSection,
  AdminOperationalState,
  type AdminOperationalTone as Tone,
} from './admin-operational-primitives'
import { Button } from '../components/ui/button'
import { getAuthLookups, type AuthLookupStore, type AuthSessionSummary } from '../features/auth/api'
import {
  archiveFeedPost,
  createFeedPost,
  getAdminFeedQueryKey,
  getAdminFeedPosts,
  getVisibleFeedQueryKey,
  pinFeedPost,
  publishFeedPost,
  unpinFeedPost,
} from '../features/feed/api'
import {
  challengeMetricOptions,
  feedTargetRouteOptions,
  type FeedPost,
  type FeedPostType,
  type FeedPublishStatus,
  type FeedVisibilityScopeType,
} from '../features/feed/contracts'
import type { TranslateFunction, TranslationKey } from '../features/localization/dictionary'
import { useLocalization } from '../features/localization/useLocalization'
import { actionToast } from '../lib/action-toast'
import { formatDate, formatDateTime, getErrorMessage } from '../lib/format'
import type { AppLocale } from '../lib/i18n'
import { transientQueryRetryOptions } from '../lib/query-retry'

type FeedFormState = {
  postType: FeedPostType
  title: string
  body: string
  linkLabel: string
  linkUrl: string
  visibilityScopeType: FeedVisibilityScopeType
  scopeId: string
  isPinned: boolean
  startsAt: string
  endsAt: string
  metricCode: string
  targetRoute: string
  challengeStartsOn: string
  challengeEndsOn: string
}

type RegionOption = {
  regionId: string
  regionName: string
}

const feedPostTypeLabelKeys: Record<FeedPostType, TranslationKey> = {
  announcement: 'storeFeed.type.announcement',
  challenge: 'storeFeed.type.challenge',
}

const feedScopeLabelKeys: Record<FeedVisibilityScopeType, TranslationKey> = {
  company: 'storeFeed.scope.company',
  region: 'storeFeed.scope.region',
  store: 'storeFeed.scope.store',
}

const feedStatusLabelKeys: Record<FeedPublishStatus, TranslationKey> = {
  draft: 'adminFeed.status.draft',
  published: 'adminFeed.status.published',
  archived: 'adminFeed.status.archived',
}

function formatFeedPostTypeLabel(input: FeedPostType, t: TranslateFunction) {
  return t(feedPostTypeLabelKeys[input])
}

function formatFeedScopeLabel(input: FeedVisibilityScopeType, t: TranslateFunction) {
  return t(feedScopeLabelKeys[input])
}

function formatFeedStatusLabel(input: FeedPublishStatus, t: TranslateFunction) {
  return t(feedStatusLabelKeys[input])
}

function formatTargetRouteLabel(route: string, t: TranslateFunction) {
  if (route === '/store/rankings') return t('adminFeed.targetRoute.rankings')
  if (route === '/store/me') return t('adminFeed.targetRoute.me')
  return route
}

function ScreenState({
  action,
  copy,
  title,
  tone = 'neutral',
}: {
  action?: ReactNode | undefined
  copy?: ReactNode | undefined
  title: ReactNode
  tone?: Tone | 'error' | undefined
}) {
  const normalizedTone = tone === 'error' ? 'danger' : tone

  return (
    <AdminOperationalPage ariaLabel={typeof title === 'string' ? title : undefined}>
      <AdminOperationalState action={action} description={copy} title={title} tone={normalizedTone} />
    </AdminOperationalPage>
  )
}

export function AdminFeedPage(input: { authSummary: AuthSessionSummary | null }) {
  return <AdminFeedSurface key={getAdminFeedQueryKey(input.authSummary)[1]} {...input} />
}

function AdminFeedSurface(input: { authSummary: AuthSessionSummary | null }) {
  const { locale, t } = useLocalization()
  const roles = input.authSummary?.user.roleCodes ?? []
  const isGlobalWriter = roles.includes('SUPER_ADMIN') || roles.includes('HR_ADMIN')
  const isRegionManagerOnly = !isGlobalWriter && roles.includes('REGION_MANAGER')
  const assignedStoreIds = input.authSummary?.user.actionScope.assignedStoreIds ?? []
  const queryClient = useQueryClient()
  const [form, setForm] = useState<FeedFormState>(() => createInitialForm(isRegionManagerOnly))
  const adminFeedQueryKey = getAdminFeedQueryKey(input.authSummary)
  const visibleFeedQueryKey = getVisibleFeedQueryKey(input.authSummary)
  const feedCommandKey = [...adminFeedQueryKey, 'command']
  const pendingPostIds = useMutationState({
    filters: { mutationKey: feedCommandKey, exact: true, status: 'pending' },
    select: mutation => mutation.state.variables,
  })

  const feedQuery = useQuery({
    queryKey: adminFeedQueryKey,
    queryFn: getAdminFeedPosts,
    staleTime: 30_000,
    ...transientQueryRetryOptions,
  })
  const lookupsQuery = useQuery({
    queryKey: ['auth-lookups'],
    queryFn: getAuthLookups,
    staleTime: 30_000,
    ...transientQueryRetryOptions,
  })

  const stores = useMemo(() => lookupsQuery.data?.stores ?? [], [lookupsQuery.data?.stores])
  const regionOptions = useMemo(() => buildRegionOptions(stores), [stores])
  const posts = useMemo(() => feedQuery.data?.items ?? [], [feedQuery.data?.items])

  const createMutation = useMutation({
    mutationFn: createFeedPost,
    onSuccess: async (response) => {
      actionToast.success(response.command.message)
      setForm(createInitialForm(isRegionManagerOnly))
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-feed'] }),
        queryClient.invalidateQueries({ queryKey: ['visible-feed'] }),
        queryClient.invalidateQueries({ queryKey: adminFeedQueryKey }),
        queryClient.invalidateQueries({ queryKey: visibleFeedQueryKey }),
      ])
    },
    onError: (error) => {
      actionToast.error(error, 'Gönderi oluşturulamadı.')
    },
  })
  const publishMutation = useMutation({
    mutationKey: feedCommandKey,
    mutationFn: publishFeedPost,
    onSuccess: async (response) => {
      actionToast.success(response.command.message)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-feed'] }),
        queryClient.invalidateQueries({ queryKey: ['visible-feed'] }),
        queryClient.invalidateQueries({ queryKey: adminFeedQueryKey }),
        queryClient.invalidateQueries({ queryKey: visibleFeedQueryKey }),
      ])
    },
    onError: (error) => actionToast.error(error, 'Gönderi yayınlanamadı.'),
  })
  const pinMutation = useMutation({
    mutationKey: feedCommandKey,
    mutationFn: pinFeedPost,
    onSuccess: async (response) => {
      actionToast.success(response.command.message)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-feed'] }),
        queryClient.invalidateQueries({ queryKey: ['visible-feed'] }),
        queryClient.invalidateQueries({ queryKey: adminFeedQueryKey }),
        queryClient.invalidateQueries({ queryKey: visibleFeedQueryKey }),
      ])
    },
    onError: (error) => actionToast.error(error, 'Gönderi sabitlenemedi.'),
  })
  const unpinMutation = useMutation({
    mutationKey: feedCommandKey,
    mutationFn: unpinFeedPost,
    onSuccess: async (response) => {
      actionToast.info(response.command.message)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-feed'] }),
        queryClient.invalidateQueries({ queryKey: ['visible-feed'] }),
        queryClient.invalidateQueries({ queryKey: adminFeedQueryKey }),
        queryClient.invalidateQueries({ queryKey: visibleFeedQueryKey }),
      ])
    },
    onError: (error) => actionToast.error(error, 'Gönderi sabitlemeden kaldırılamadı.'),
  })
  const archiveMutation = useMutation({
    mutationKey: feedCommandKey,
    mutationFn: archiveFeedPost,
    onSuccess: async (response) => {
      actionToast.info(response.command.message)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-feed'] }),
        queryClient.invalidateQueries({ queryKey: ['visible-feed'] }),
        queryClient.invalidateQueries({ queryKey: adminFeedQueryKey }),
        queryClient.invalidateQueries({ queryKey: visibleFeedQueryKey }),
      ])
    },
    onError: (error) => actionToast.error(error, 'Gönderi arşivlenemedi.'),
  })

  if (!isGlobalWriter && !isRegionManagerOnly) {
    return (
      <ScreenState
        title={t('adminFeed.unavailableTitle')}
        copy={t('adminFeed.unavailableCopy')}
        tone="error"
      />
    )
  }

  if (isRegionManagerOnly && assignedStoreIds.length === 0) {
    return (
      <ScreenState
        title={t('adminFeed.regionMissingTitle')}
        copy={t('adminFeed.regionMissingCopy')}
        tone="error"
      />
    )
  }

  if (feedQuery.isLoading) {
    return <ScreenState title={t('adminFeed.loadingTitle')} copy={t('adminFeed.loadingCopy')} />
  }

  if (feedQuery.isError) {
    return (
      <ScreenState
        action={(
          <Button
            type="button"
            variant="outline"
            disabled={feedQuery.isFetching}
            onClick={() => void feedQuery.refetch()}
          >
            {locale === 'tr' ? 'Tekrar dene' : 'Try again'}
          </Button>
        )}
        title={t('adminFeed.errorTitle')}
        copy={getErrorMessage(feedQuery.error)}
        tone="error"
      />
    )
  }

  const pinnedCount = posts.filter((post) => post.isPinned).length
  const publishedCount = posts.filter((post) => post.publishStatus === 'published').length
  const challengeCount = posts.filter((post) => post.postType === 'challenge').length

  function submitPost(publishStatus: FeedPublishStatus) {
    const selectedMetric = challengeMetricOptions.find((metric) => metric.metricCode === form.metricCode)
    createMutation.mutate({
      postType: form.postType,
      title: form.title,
      body: form.body,
      ...(form.linkLabel ? { linkLabel: form.linkLabel } : {}),
      ...(form.linkUrl ? { linkUrl: form.linkUrl } : {}),
      visibilityScopeType: form.visibilityScopeType,
      visibilityScopeIds: isRegionManagerOnly ? assignedStoreIds : form.visibilityScopeType === 'company' ? [] : [form.scopeId],
      isPinned: form.isPinned,
      publishStatus,
      ...(form.startsAt ? { startsAt: form.startsAt } : {}),
      ...(form.endsAt ? { endsAt: form.endsAt } : {}),
      ...(form.postType === 'challenge' && selectedMetric
        ? {
            metricCode: selectedMetric.metricCode,
            metricLabel: selectedMetric.metricLabel,
          }
        : {}),
      ...(form.postType === 'challenge' && form.challengeStartsOn
        ? { challengeStartsOn: form.challengeStartsOn }
        : {}),
      ...(form.postType === 'challenge' && form.challengeEndsOn
        ? { challengeEndsOn: form.challengeEndsOn }
        : {}),
      ...(form.postType === 'challenge' && form.targetRoute ? { targetRoute: form.targetRoute } : {}),
    })
  }

  return (
    <AdminOperationalPage ariaLabel={t('adminFeed.heroTitle')}>
      <AdminOperationalHeader
        description={t('adminFeed.heroCopy')}
        eyebrow={t('adminFeed.heroEyebrow')}
        icon={<Megaphone aria-hidden="true" size={22} />}
        meta={
          <>
            <StatusPill tone="neutral">/admin/feed</StatusPill>
            <StatusPill tone={isRegionManagerOnly ? 'cyan' : 'accent'}>
              {isRegionManagerOnly ? t('adminFeed.regionManagerValue') : t('adminFeed.scoreOwnershipValue')}
            </StatusPill>
          </>
        }
        title={t('adminFeed.heroTitle')}
      />

      <AdminOperationalMetrics
        items={[
          {
            description: t('adminFeed.totalPostsNote'),
            icon: <Megaphone aria-hidden="true" size={18} />,
            id: 'feed-total',
            label: t('adminFeed.totalPosts'),
            tone: 'accent',
            value: posts.length,
          },
          {
            description: t('adminFeed.pinnedNote'),
            icon: <Pin aria-hidden="true" size={18} />,
            id: 'feed-pinned',
            label: t('adminFeed.pinned'),
            tone: pinnedCount > 0 ? 'warning' : 'neutral',
            value: pinnedCount,
          },
          {
            description: t('adminFeed.challengesNote'),
            icon: <Trophy aria-hidden="true" size={18} />,
            id: 'feed-challenges',
            label: t('adminFeed.challenges'),
            tone: 'calm',
            value: challengeCount,
          },
          {
            description: t('adminFeed.publishedNote'),
            icon: <Send aria-hidden="true" size={18} />,
            id: 'feed-published',
            label: t('adminFeed.published'),
            tone: 'cyan',
            value: publishedCount,
          },
        ]}
      />

      <div className="tw:grid tw:grid-cols-1 tw:gap-4 tw:xl:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.65fr)]">
        <AdminFeedComposerPanel
          createPending={createMutation.isPending}
          form={form}
          isGlobalWriter={isGlobalWriter}
          isRegionManagerOnly={isRegionManagerOnly}
          assignedStoreCount={assignedStoreIds.length}
          onSubmit={submitPost}
          regionOptions={regionOptions}
          setForm={setForm}
          stores={stores}
        />

        <AdminOperationalSection
          badge={<StatusPill tone="success"><ShieldCheck aria-hidden="true" size={13} />{t('adminFeed.regionManagerValue')}</StatusPill>}
          eyebrow={t('adminFeed.guardrailEyebrow')}
          title={t('adminFeed.guardrailTitle')}
        >
          <AdminOperationalKeyGrid>
            <KeyValue label={t('adminFeed.challengeTarget')} value="/store/rankings or /store/me" />
            <KeyValue label={t('adminFeed.scoreOwnership')} value={t('adminFeed.scoreOwnershipValue')} />
            <KeyValue label={t('adminFeed.competitionStages')} value={t('adminFeed.competitionStagesValue')} />
            <KeyValue label={t('adminFeed.regionManager')} value={t('adminFeed.regionManagerValue')} />
          </AdminOperationalKeyGrid>
        </AdminOperationalSection>
      </div>

      <AdminOperationalSection
        badge={<StatusPill tone="neutral">{`${posts.length} ${t('adminFeed.posts')}`}</StatusPill>}
        eyebrow={t('adminFeed.libraryEyebrow')}
        title={t('adminFeed.libraryTitle')}
      >
        {posts.length === 0 ? (
          <EmptyState title={t('adminFeed.emptyTitle')} copy={t('adminFeed.emptyCopy')} />
        ) : (
          <div className="tw:grid tw:gap-3">
            {posts.map((post) => (
              <FeedAdminRow
                actionPending={pendingPostIds.includes(post.feedPostId)}
                key={post.feedPostId}
                post={post}
                locale={locale}
                t={t}
                onPublish={() => publishMutation.mutate(post.feedPostId)}
                onPin={() => pinMutation.mutate(post.feedPostId)}
                onUnpin={() => unpinMutation.mutate(post.feedPostId)}
                onArchive={() => archiveMutation.mutate(post.feedPostId)}
              />
            ))}
          </div>
        )}
      </AdminOperationalSection>
    </AdminOperationalPage>
  )
}

function AdminFeedComposerPanel(input: {
  assignedStoreCount: number
  createPending: boolean
  form: FeedFormState
  isGlobalWriter: boolean
  isRegionManagerOnly: boolean
  onSubmit: (publishStatus: FeedPublishStatus) => void
  regionOptions: RegionOption[]
  setForm: Dispatch<SetStateAction<FeedFormState>>
  stores: AuthLookupStore[]
}) {
  const { t } = useLocalization()

  return (
    <AdminOperationalSection
      badge={
        <StatusPill tone={input.form.postType === 'challenge' ? 'accent' : 'neutral'}>
          {formatFeedPostTypeLabel(input.form.postType, t)}
        </StatusPill>
      }
      className="admin-feed-composer"
      eyebrow={t('adminFeed.composerEyebrow')}
      title={t('adminFeed.composerTitle')}
    >

      <div className="form-grid">
        <label>
          {t('adminFeed.type')}
          <select
            className="control-input"
            value={input.form.postType}
            onChange={(event) =>
              input.setForm((current) => ({
                ...current,
                postType: event.target.value as FeedPostType,
                linkUrl: event.target.value === 'challenge' ? '' : current.linkUrl,
              }))
            }
          >
            <option value="announcement">{formatFeedPostTypeLabel('announcement', t)}</option>
            <option value="challenge">{formatFeedPostTypeLabel('challenge', t)}</option>
          </select>
        </label>
        <label>
          {t('adminFeed.title')}
          <input
            className="control-input"
            value={input.form.title}
            onChange={(event) => input.setForm((current) => ({ ...current, title: event.target.value }))}
          />
        </label>
        <label>
          {t('adminFeed.body')}
          <textarea
            className="control-input"
            rows={4}
            value={input.form.body}
            onChange={(event) => input.setForm((current) => ({ ...current, body: event.target.value }))}
          />
        </label>
        <label>
          {t('adminFeed.scope')}
          <select
            className="control-input"
            value={input.form.visibilityScopeType}
            disabled={input.isRegionManagerOnly}
            onChange={(event) =>
              input.setForm((current) => ({
                ...current,
                visibilityScopeType: event.target.value as FeedVisibilityScopeType,
                scopeId: '',
              }))
            }
          >
            {input.isGlobalWriter ? <option value="company">{formatFeedScopeLabel('company', t)}</option> : null}
            {input.isGlobalWriter ? <option value="region">{formatFeedScopeLabel('region', t)}</option> : null}
            {input.isRegionManagerOnly ? <option value="store">{formatFeedScopeLabel('store', t)}</option> : null}
            {input.isGlobalWriter ? <option value="store">{formatFeedScopeLabel('store', t)}</option> : null}
          </select>
        </label>
        {input.form.visibilityScopeType !== 'company' ? (
          <label>
            {t('adminFeed.scopeId', { scope: formatFeedScopeLabel(input.form.visibilityScopeType, t) })}
            <select
              className="control-input"
              value={input.form.scopeId}
              disabled={input.isRegionManagerOnly}
              onChange={(event) => input.setForm((current) => ({ ...current, scopeId: event.target.value }))}
            >
              <option value="">{input.isRegionManagerOnly
                ? t('adminFeed.assignedStores', { count: input.assignedStoreCount })
                : t('adminFeed.selectScope')}</option>
              {input.form.visibilityScopeType === 'region'
                ? input.regionOptions.map((option) => (
                  <option key={option.regionId} value={option.regionId}>
                      {option.regionName}
                  </option>
                  ))
                : input.stores.map((option) => (
                    <option key={option.storeId} value={option.storeId}>
                      {option.storeCode} - {option.storeName}
                    </option>
                  ))}
            </select>
          </label>
        ) : null}
        <label>
          {t('adminFeed.linkLabel')}
          <input
            className="control-input"
            value={input.form.linkLabel}
            onChange={(event) => input.setForm((current) => ({ ...current, linkLabel: event.target.value }))}
          />
        </label>
        {input.form.postType === 'announcement' ? (
          <label>
            {t('adminFeed.linkUrl')}
            <input
              className="control-input"
              value={input.form.linkUrl}
              onChange={(event) => input.setForm((current) => ({ ...current, linkUrl: event.target.value }))}
              placeholder="/store/tasks"
            />
          </label>
        ) : null}
        <label>
          {t('adminFeed.startsAt')}
          <Input
            className="control-input"
            type="datetime-local"
            value={input.form.startsAt}
            onChange={(event) => input.setForm((current) => ({ ...current, startsAt: event.target.value }))}
          />
        </label>
        <label>
          {t('adminFeed.endsAt')}
          <Input
            className="control-input"
            type="datetime-local"
            value={input.form.endsAt}
            onChange={(event) => input.setForm((current) => ({ ...current, endsAt: event.target.value }))}
          />
        </label>
        <label className="checkbox-line">
          <input
            type="checkbox"
            checked={input.form.isPinned}
            onChange={(event) => input.setForm((current) => ({ ...current, isPinned: event.target.checked }))}
          />
          {t('adminFeed.pinPost')}
        </label>
      </div>

      {input.form.postType === 'challenge' ? (
        <div className="form-grid">
          <label>
            {t('adminFeed.metric')}
            <select
              className="control-input"
              value={input.form.metricCode}
              onChange={(event) => input.setForm((current) => ({ ...current, metricCode: event.target.value }))}
            >
              {challengeMetricOptions.map((metric) => (
                <option key={metric.metricCode} value={metric.metricCode}>
                  {metric.metricLabel}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t('adminFeed.targetRoute')}
            <select
              className="control-input"
              value={input.form.targetRoute}
              onChange={(event) => input.setForm((current) => ({ ...current, targetRoute: event.target.value }))}
            >
              {feedTargetRouteOptions.map((option) => (
                <option key={option.route} value={option.route}>
                  {formatTargetRouteLabel(option.route, t)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t('adminFeed.challengeStarts')}
            <Input
              className="control-input"
              type="date"
              value={input.form.challengeStartsOn}
              onChange={(event) => input.setForm((current) => ({ ...current, challengeStartsOn: event.target.value }))}
            />
          </label>
          <label>
            {t('adminFeed.challengeEnds')}
            <Input
              className="control-input"
              type="date"
              value={input.form.challengeEndsOn}
              onChange={(event) => input.setForm((current) => ({ ...current, challengeEndsOn: event.target.value }))}
            />
          </label>
        </div>
      ) : null}

      <div className="action-cluster">
        <Button
          variant="secondary"
          type="button"
          disabled={input.createPending}
          onClick={() => input.onSubmit('draft')}
        >
          {t('adminFeed.saveDraft')}
        </Button>
        <Button
          type="button"
          disabled={input.createPending}
          onClick={() => input.onSubmit('published')}
        >
          {t('adminFeed.publishPost')}
        </Button>
      </div>
    </AdminOperationalSection>
  )
}

function FeedAdminRow(input: {
  actionPending: boolean
  post: FeedPost
  locale: AppLocale
  t: TranslateFunction
  onPublish: () => void
  onPin: () => void
  onUnpin: () => void
  onArchive: () => void
}) {
  return (
    <article
      aria-busy={input.actionPending}
      className="tw:rounded-xl tw:border tw:border-border/80 tw:bg-background/65 tw:p-4 tw:shadow-xs"
    >
      <div className="tw:flex tw:flex-col tw:gap-3 tw:lg:flex-row tw:lg:items-start tw:lg:justify-between">
        <div className="tw:min-w-0">
          <strong className="tw:block tw:text-sm tw:font-semibold tw:text-foreground">{input.post.title}</strong>
          <p className="tw:mt-1 tw:text-sm tw:leading-6 tw:text-muted-foreground">{input.post.body}</p>
        </div>
        <div className="tw:flex tw:flex-wrap tw:gap-2">
          <StatusPill tone={input.post.postType === 'challenge' ? 'accent' : 'neutral'}>
            {formatFeedPostTypeLabel(input.post.postType, input.t)}
          </StatusPill>
          <StatusPill tone={mapStatusTone(input.post.publishStatus)}>
            {formatFeedStatusLabel(input.post.publishStatus, input.t)}
          </StatusPill>
          {input.post.isPinned ? <StatusPill tone="warning">{input.t('adminFeed.pinned')}</StatusPill> : null}
        </div>
      </div>

      <AdminOperationalKeyGrid className="tw:mt-3">
        <KeyValue
          label={input.t('adminFeed.scope')}
          value={input.t('adminFeed.scopeValue', {
            scope: formatFeedScopeLabel(input.post.visibilityScopeType, input.t),
            ids: input.post.visibilityScopeIds.join(', '),
          })}
        />
        <KeyValue label={input.t('adminFeed.updated')} value={formatDateTime(input.post.updatedAt, input.locale)} />
        <KeyValue
          label={input.t('adminFeed.published')}
          value={input.post.publishedAt ? formatDateTime(input.post.publishedAt, input.locale) : input.t('adminFeed.draft')}
        />
        <KeyValue label={input.t('adminFeed.metric')} value={input.post.metricLabel ?? input.t('storeFeed.noMetric')} />
        <KeyValue
          label={input.t('adminFeed.challengeWindow')}
          value={
            input.post.challengeStartsOn && input.post.challengeEndsOn
              ? `${formatDate(input.post.challengeStartsOn, input.locale)} - ${formatDate(input.post.challengeEndsOn, input.locale)}`
              : input.t('adminFeed.noChallengeWindow')
          }
        />
        <KeyValue label={input.t('adminFeed.link')} value={input.post.targetRoute ?? input.post.linkUrl ?? input.t('storeFeed.noLink')} />
      </AdminOperationalKeyGrid>

      <div className="tw:mt-3 tw:flex tw:flex-wrap tw:justify-end tw:gap-2">
        {input.post.publishStatus === 'draft' ? (
          <Button variant="secondary" type="button" disabled={input.actionPending} onClick={input.onPublish}>
            {input.t('adminFeed.publish')}
          </Button>
        ) : null}
        {input.post.publishStatus !== 'archived' && !input.post.isPinned ? (
          <Button variant="secondary" type="button" disabled={input.actionPending} onClick={input.onPin}>
            {input.t('adminFeed.pin')}
          </Button>
        ) : null}
        {input.post.publishStatus !== 'archived' && input.post.isPinned ? (
          <Button variant="secondary" type="button" disabled={input.actionPending} onClick={input.onUnpin}>
            {input.t('adminFeed.unpin')}
          </Button>
        ) : null}
        {input.post.publishStatus !== 'archived' ? (
          <Button variant="outline" type="button" disabled={input.actionPending} onClick={input.onArchive}>
            {input.t('adminFeed.archive')}
          </Button>
        ) : null}
      </div>
    </article>
  )
}

function createInitialForm(isRegionManagerOnly: boolean): FeedFormState {
  return {
    postType: 'announcement',
    title: '',
    body: '',
    linkLabel: '',
    linkUrl: '',
    visibilityScopeType: isRegionManagerOnly ? 'store' : 'company',
    scopeId: '',
    isPinned: false,
    startsAt: '',
    endsAt: '',
    metricCode: 'upt',
    targetRoute: '/store/rankings',
    challengeStartsOn: '',
    challengeEndsOn: '',
  }
}

function buildRegionOptions(stores: AuthLookupStore[]) {
  const regions = new Map<string, { regionId: string; regionName: string }>()

  for (const store of stores) {
    regions.set(store.regionId, {
      regionId: store.regionId,
      regionName: store.regionName,
    })
  }

  return [...regions.values()]
}

function mapStatusTone(status: FeedPublishStatus): Tone {
  if (status === 'published') return 'calm'
  if (status === 'archived') return 'neutral'
  return 'warning'
}
