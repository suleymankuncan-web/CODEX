import { useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Megaphone, Pin, Send, Trophy } from 'lucide-react'
import {
  EmptyState,
  KeyValue,
  MetricAccent,
  MetricCard,
  ScreenState,
  StatusPill,
  type Tone,
} from '../components/dashboard-primitives'
import { getAuthLookups, type AuthLookupStore, type AuthSessionSummary } from '../features/auth/api'
import {
  archiveFeedPost,
  createFeedPost,
  getAdminFeedPosts,
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

export function AdminFeedPage(input: { authSummary: AuthSessionSummary | null }) {
  const { locale, t } = useLocalization()
  const roles = input.authSummary?.user.roleCodes ?? []
  const isGlobalWriter = roles.includes('SUPER_ADMIN') || roles.includes('HR_ADMIN')
  const isRegionManagerOnly = !isGlobalWriter && roles.includes('REGION_MANAGER')
  const defaultRegionId = input.authSummary?.user.readScope.regionIds[0] ?? ''
  const queryClient = useQueryClient()
  const [notice, setNotice] = useState<string | null>(null)
  const [errorNotice, setErrorNotice] = useState<string | null>(null)
  const [form, setForm] = useState<FeedFormState>(() => createInitialForm(isRegionManagerOnly, defaultRegionId))

  const feedQuery = useQuery({
    queryKey: ['admin-feed'],
    queryFn: getAdminFeedPosts,
    ...transientQueryRetryOptions,
  })
  const lookupsQuery = useQuery({
    queryKey: ['auth-lookups'],
    queryFn: getAuthLookups,
    ...transientQueryRetryOptions,
  })

  const stores = useMemo(() => lookupsQuery.data?.stores ?? [], [lookupsQuery.data?.stores])
  const regionOptions = useMemo(() => buildRegionOptions(stores), [stores])
  const posts = useMemo(() => feedQuery.data?.items ?? [], [feedQuery.data?.items])

  const createMutation = useMutation({
    mutationFn: createFeedPost,
    onSuccess: async (response) => {
      setNotice(response.command.message)
      setErrorNotice(null)
      setForm(createInitialForm(isRegionManagerOnly, defaultRegionId))
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-feed'] }),
        queryClient.invalidateQueries({ queryKey: ['visible-feed'] }),
      ])
    },
    onError: (error) => {
      setErrorNotice(getErrorMessage(error))
    },
  })
  const publishMutation = useMutation({
    mutationFn: publishFeedPost,
    onSuccess: async (response) => {
      setNotice(response.command.message)
      setErrorNotice(null)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-feed'] }),
        queryClient.invalidateQueries({ queryKey: ['visible-feed'] }),
      ])
    },
    onError: (error) => setErrorNotice(getErrorMessage(error)),
  })
  const pinMutation = useMutation({
    mutationFn: pinFeedPost,
    onSuccess: async (response) => {
      setNotice(response.command.message)
      setErrorNotice(null)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-feed'] }),
        queryClient.invalidateQueries({ queryKey: ['visible-feed'] }),
      ])
    },
    onError: (error) => setErrorNotice(getErrorMessage(error)),
  })
  const unpinMutation = useMutation({
    mutationFn: unpinFeedPost,
    onSuccess: async (response) => {
      setNotice(response.command.message)
      setErrorNotice(null)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-feed'] }),
        queryClient.invalidateQueries({ queryKey: ['visible-feed'] }),
      ])
    },
    onError: (error) => setErrorNotice(getErrorMessage(error)),
  })
  const archiveMutation = useMutation({
    mutationFn: archiveFeedPost,
    onSuccess: async (response) => {
      setNotice(response.command.message)
      setErrorNotice(null)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-feed'] }),
        queryClient.invalidateQueries({ queryKey: ['visible-feed'] }),
      ])
    },
    onError: (error) => setErrorNotice(getErrorMessage(error)),
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

  if (isRegionManagerOnly && !defaultRegionId) {
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
      linkLabel: form.linkLabel || undefined,
      linkUrl: form.linkUrl || undefined,
      visibilityScopeType: form.visibilityScopeType,
      visibilityScopeIds: form.visibilityScopeType === 'company' ? [] : [form.scopeId],
      isPinned: form.isPinned,
      publishStatus,
      startsAt: form.startsAt || undefined,
      endsAt: form.endsAt || undefined,
      metricCode: form.postType === 'challenge' ? selectedMetric?.metricCode : undefined,
      metricLabel: form.postType === 'challenge' ? selectedMetric?.metricLabel : undefined,
      challengeStartsOn: form.postType === 'challenge' ? form.challengeStartsOn : undefined,
      challengeEndsOn: form.postType === 'challenge' ? form.challengeEndsOn : undefined,
      targetRoute: form.postType === 'challenge' ? form.targetRoute : undefined,
    })
  }

  return (
    <section className="page-stack">
      <section className="hero-panel">
        <div>
          <div className="eyebrow">{t('adminFeed.heroEyebrow')}</div>
          <h2 className="hero-title">{t('adminFeed.heroTitle')}</h2>
          <p className="hero-copy">{t('adminFeed.heroCopy')}</p>
        </div>
        <div className="hero-metrics">
          <MetricAccent label={t('adminFeed.route')} value="/admin/feed" />
          <MetricAccent label={t('adminFeed.posts')} value={String(posts.length)} />
          <MetricAccent label={t('adminFeed.published')} value={String(publishedCount)} />
        </div>
      </section>

      <section className="metric-grid">
        <MetricCard title={t('adminFeed.totalPosts')} value={posts.length} note={t('adminFeed.totalPostsNote')} icon={<Megaphone size={18} />} tone="accent" />
        <MetricCard title={t('adminFeed.pinned')} value={pinnedCount} note={t('adminFeed.pinnedNote')} icon={<Pin size={18} />} tone={pinnedCount > 0 ? 'warning' : 'neutral'} />
        <MetricCard title={t('adminFeed.challenges')} value={challengeCount} note={t('adminFeed.challengesNote')} icon={<Trophy size={18} />} tone="calm" />
        <MetricCard title={t('adminFeed.published')} value={publishedCount} note={t('adminFeed.publishedNote')} icon={<Send size={18} />} tone="accent" />
      </section>

      {notice ? <div className="shell-notice">{notice}</div> : null}
      {errorNotice ? <div className="shell-notice shell-notice-warning">{errorNotice}</div> : null}

      <section className="two-up-grid">
        <AdminFeedComposerPanel
          createPending={createMutation.isPending}
          form={form}
          isGlobalWriter={isGlobalWriter}
          isRegionManagerOnly={isRegionManagerOnly}
          onSubmit={submitPost}
          regionOptions={regionOptions}
          setForm={setForm}
          stores={stores}
        />

        <article className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">{t('adminFeed.guardrailEyebrow')}</div>
              <h3>{t('adminFeed.guardrailTitle')}</h3>
            </div>
          </div>
          <div className="key-grid">
            <KeyValue label={t('adminFeed.challengeTarget')} value="/store/rankings or /store/me" />
            <KeyValue label={t('adminFeed.scoreOwnership')} value={t('adminFeed.scoreOwnershipValue')} />
            <KeyValue label={t('adminFeed.competitionStages')} value={t('adminFeed.competitionStagesValue')} />
            <KeyValue label={t('adminFeed.regionManager')} value={t('adminFeed.regionManagerValue')} />
          </div>
        </article>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <div className="eyebrow">{t('adminFeed.libraryEyebrow')}</div>
            <h3>{t('adminFeed.libraryTitle')}</h3>
          </div>
        </div>

        {posts.length === 0 ? (
          <EmptyState title={t('adminFeed.emptyTitle')} copy={t('adminFeed.emptyCopy')} />
        ) : (
          <div className="stacked-table">
            {posts.map((post) => (
              <FeedAdminRow
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
      </section>
    </section>
  )
}

function AdminFeedComposerPanel(input: {
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
    <article className="panel">
      <div className="panel-heading">
        <div>
          <div className="eyebrow">{t('adminFeed.composerEyebrow')}</div>
          <h3>{t('adminFeed.composerTitle')}</h3>
        </div>
        <StatusPill tone={input.form.postType === 'challenge' ? 'accent' : 'neutral'}>
          {formatFeedPostTypeLabel(input.form.postType, t)}
        </StatusPill>
      </div>

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
            <option value="region">{formatFeedScopeLabel('region', t)}</option>
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
              <option value="">{t('adminFeed.selectScope')}</option>
              {input.form.visibilityScopeType === 'region'
                ? input.regionOptions.map((option) => (
                    <option key={option.regionId} value={option.regionId}>
                      {option.regionName} - {option.regionId}
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
          <input
            className="control-input"
            type="datetime-local"
            value={input.form.startsAt}
            onChange={(event) => input.setForm((current) => ({ ...current, startsAt: event.target.value }))}
          />
        </label>
        <label>
          {t('adminFeed.endsAt')}
          <input
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
            <input
              className="control-input"
              type="date"
              value={input.form.challengeStartsOn}
              onChange={(event) => input.setForm((current) => ({ ...current, challengeStartsOn: event.target.value }))}
            />
          </label>
          <label>
            {t('adminFeed.challengeEnds')}
            <input
              className="control-input"
              type="date"
              value={input.form.challengeEndsOn}
              onChange={(event) => input.setForm((current) => ({ ...current, challengeEndsOn: event.target.value }))}
            />
          </label>
        </div>
      ) : null}

      <div className="action-cluster">
        <button
          className="control-button"
          type="button"
          disabled={input.createPending}
          onClick={() => input.onSubmit('draft')}
        >
          {t('adminFeed.saveDraft')}
        </button>
        <button
          className="control-button primary-control"
          type="button"
          disabled={input.createPending}
          onClick={() => input.onSubmit('published')}
        >
          {t('adminFeed.publishPost')}
        </button>
      </div>
    </article>
  )
}

function FeedAdminRow(input: {
  post: FeedPost
  locale: AppLocale
  t: TranslateFunction
  onPublish: () => void
  onPin: () => void
  onUnpin: () => void
  onArchive: () => void
}) {
  return (
    <article className="stacked-row">
      <div className="stacked-row-head">
        <div>
          <strong>{input.post.title}</strong>
          <p className="queue-subtitle">{input.post.body}</p>
        </div>
        <div className="action-cluster">
          <StatusPill tone={input.post.postType === 'challenge' ? 'accent' : 'neutral'}>
            {formatFeedPostTypeLabel(input.post.postType, input.t)}
          </StatusPill>
          <StatusPill tone={mapStatusTone(input.post.publishStatus)}>
            {formatFeedStatusLabel(input.post.publishStatus, input.t)}
          </StatusPill>
          {input.post.isPinned ? <StatusPill tone="warning">{input.t('adminFeed.pinned')}</StatusPill> : null}
        </div>
      </div>

      <div className="key-grid">
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
      </div>

      <div className="action-cluster">
        {input.post.publishStatus === 'draft' ? (
          <button className="control-button" type="button" onClick={input.onPublish}>
            {input.t('adminFeed.publish')}
          </button>
        ) : null}
        {input.post.publishStatus !== 'archived' && !input.post.isPinned ? (
          <button className="control-button" type="button" onClick={input.onPin}>
            {input.t('adminFeed.pin')}
          </button>
        ) : null}
        {input.post.publishStatus !== 'archived' && input.post.isPinned ? (
          <button className="control-button" type="button" onClick={input.onUnpin}>
            {input.t('adminFeed.unpin')}
          </button>
        ) : null}
        {input.post.publishStatus !== 'archived' ? (
          <button className="control-button" type="button" onClick={input.onArchive}>
            {input.t('adminFeed.archive')}
          </button>
        ) : null}
      </div>
    </article>
  )
}

function createInitialForm(isRegionManagerOnly: boolean, defaultRegionId: string): FeedFormState {
  return {
    postType: 'announcement',
    title: '',
    body: '',
    linkLabel: '',
    linkUrl: '',
    visibilityScopeType: isRegionManagerOnly ? 'region' : 'company',
    scopeId: isRegionManagerOnly ? defaultRegionId : '',
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
