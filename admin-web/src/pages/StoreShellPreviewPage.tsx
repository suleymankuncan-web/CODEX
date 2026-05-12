import type { ReactNode } from 'react'
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, BadgeCheck, ClipboardList, Megaphone, ReceiptText, Store, Target } from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  EmptyState,
  KeyValue,
  MetricAccent,
  MetricCard,
  ScreenState,
  StatusPill,
} from '../components/dashboard-primitives'
import type { AuthSessionSummary } from '../features/auth/api'
import { getDisplayRoleCodes } from '../features/auth/display'
import { getVisibleFeedPosts } from '../features/feed/api'
import type { FeedPostType } from '../features/feed/contracts'
import type { TranslateFunction, TranslationKey } from '../features/localization/dictionary'
import { LanguageToggle } from '../features/localization/LanguageToggle'
import { useLocalization } from '../features/localization/useLocalization'
import { getErrorMessage } from '../lib/format'

const feedPostTypeLabelKeys = {
  announcement: 'storeHome.feedType.announcement',
  challenge: 'storeHome.feedType.challenge',
} as const satisfies Record<FeedPostType, TranslationKey>

const roleLabelKeys = {
  HR_ADMIN: 'storeHome.role.HR_ADMIN',
  REGION_MANAGER: 'storeHome.role.REGION_MANAGER',
  REPORT_VIEWER: 'storeHome.role.REPORT_VIEWER',
  STORE_MANAGER: 'storeHome.role.STORE_MANAGER',
  STORE_PERSONNEL: 'storeHome.role.STORE_PERSONNEL',
  SUPER_ADMIN: 'storeHome.role.SUPER_ADMIN',
  VISUAL_MERCHANDISER: 'storeHome.role.VISUAL_MERCHANDISER',
} as const satisfies Partial<Record<string, TranslationKey>>

function formatFeedType(postType: FeedPostType, t: TranslateFunction) {
  return t(feedPostTypeLabelKeys[postType])
}

function formatRole(roleCode: string, t: TranslateFunction) {
  const key = roleLabelKeys[roleCode as keyof typeof roleLabelKeys]
  return key ? t(key) : roleCode.replaceAll('_', ' ').toLowerCase()
}

function formatHomeRoles(
  roleCodes: readonly string[] | null | undefined,
  t: TranslateFunction,
) {
  const displayRoles = getDisplayRoleCodes(roleCodes)
  return displayRoles.length > 0
    ? displayRoles.map((roleCode) => formatRole(roleCode, t)).join(', ')
    : t('storeHome.noResolvedRoles')
}

export function StoreShellPreviewPage(input: {
  authSummary: AuthSessionSummary | null
  recommendedLanding: string
}) {
  const { t } = useLocalization()
  const user = input.authSummary?.user
  const feedQuery = useQuery({
    queryKey: ['visible-feed', 'home-preview'],
    queryFn: getVisibleFeedPosts,
    retry: false,
  })
  const pinnedPosts = useMemo(
    () => (feedQuery.data?.items ?? []).filter((post) => post.isPinned).slice(0, 3),
    [feedQuery.data?.items],
  )

  return (
    <section className="page-stack">
      <section className="hero-panel store-hero-panel">
        <div>
          <div className="eyebrow">{t('storeHome.heroEyebrow')}</div>
          <h2 className="hero-title">{t('storeHome.heroTitle')}</h2>
          <p className="hero-copy">{t('storeHome.heroCopy')}</p>
        </div>
        <div className="hero-metrics">
          <MetricAccent label={t('storeHome.area')} value="/store" />
          <MetricAccent label={t('storeHome.currentLanding')} value={input.recommendedLanding} />
          <MetricAccent label={t('storeHome.purpose')} value={t('storeHome.taskFocused')} />
          <div className="store-home-language-control">
            <LanguageToggle />
          </div>
        </div>
      </section>

      <section className="metric-grid store-metric-grid">
        <MetricCard
          title={t('storeHome.todayWork')}
          value={3}
          note={t('storeHome.todayWorkNote')}
          icon={<ClipboardList size={18} />}
          tone="accent"
        />
        <MetricCard
          title={t('storeHome.storeFocus')}
          value={1}
          note={t('storeHome.storeFocusNote')}
          icon={<Store size={18} />}
          tone="calm"
        />
        <MetricCard
          title={t('storeHome.sharedAuthority')}
          value={1}
          note={t('storeHome.sharedAuthorityNote')}
          icon={<BadgeCheck size={18} />}
          tone="warning"
        />
      </section>

      {feedQuery.isError ? (
        <ScreenState
          title={t('storeHome.feedErrorTitle')}
          copy={getErrorMessage(feedQuery.error)}
          tone="error"
        />
      ) : pinnedPosts.length > 0 ? (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">{t('storeHome.pinnedAnnouncements')}</div>
              <h3>{t('storeHome.pinnedTitle')}</h3>
            </div>
            <Link className="control-button store-shell-link" to="/store/feed">
              {t('storeHome.allAnnouncements')}
            </Link>
          </div>
          <div className="stacked-table">
            {pinnedPosts.map((post) => (
              <div className="stacked-row" key={post.feedPostId}>
                <div className="stacked-row-head">
                  <strong>{post.title}</strong>
                  <div className="action-cluster">
                    <StatusPill tone={post.postType === 'challenge' ? 'accent' : 'neutral'}>
                      {formatFeedType(post.postType, t)}
                    </StatusPill>
                    <Megaphone size={16} />
                  </div>
                </div>
                <p>{post.body}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="two-up-grid">
        <article className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">{t('storeHome.homeEyebrow')}</div>
              <h3>{t('storeHome.homeTitle')}</h3>
            </div>
            <StatusPill tone="accent">{t('storeHome.phaseOne')}</StatusPill>
          </div>

          <div className="stacked-table">
            <div className="stacked-row">
              <div className="stacked-row-head">
                <strong>{t('storeHome.todayWork')}</strong>
                <StatusPill tone="warning">{t('storeHome.priority')}</StatusPill>
              </div>
              <p>{t('storeHome.todayWorkCopy')}</p>
            </div>
            <div className="stacked-row">
              <div className="stacked-row-head">
                <strong>{t('storeHome.kpiSummaries')}</strong>
                <StatusPill tone="calm">{t('storeHome.visibility')}</StatusPill>
              </div>
              <p>{t('storeHome.kpiSummariesCopy')}</p>
            </div>
            <div className="stacked-row">
              <div className="stacked-row-head">
                <strong>{t('storeHome.incentiveSummary')}</strong>
                <StatusPill tone="accent">{t('storeHome.later')}</StatusPill>
              </div>
              <p>{t('storeHome.incentiveSummaryCopy')}</p>
            </div>
          </div>
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">{t('storeHome.resolvedSession')}</div>
              <h3>{t('storeHome.resolvedTitle')}</h3>
            </div>
          </div>

          <div className="key-grid">
            <KeyValue
              label={t('storeHome.userId')}
              value={user?.userId ?? t('storeHome.sessionNotResolved')}
            />
            <KeyValue label={t('storeHome.roles')} value={formatHomeRoles(user?.roleCodes, t)} />
            <KeyValue
              label={t('storeHome.companyIds')}
              value={user?.scope.companyIds.join(', ') || t('storeHome.none')}
            />
            <KeyValue
              label={t('storeHome.storeIds')}
              value={user?.scope.storeIds.join(', ') || t('storeHome.none')}
            />
          </div>

          <div className="action-cluster">
            <Link className="control-button store-shell-link" to="/store/tasks">
              {t('storeHome.storeTasks')}
            </Link>
            <Link className="control-button store-shell-link" to="/store/checklists">
              {t('storeHome.storeChecklists')}
            </Link>
            <Link className="control-button store-shell-link" to="/store/kpis">
              {t('storeHome.storeKpis')}
            </Link>
            <Link className="control-button store-shell-link" to="/store/me">
              {t('storeHome.myPerformance')}
            </Link>
            <Link className="control-button store-shell-link" to="/store/rankings">
              {t('storeHome.rankings')}
            </Link>
            <Link className="control-button store-shell-link" to="/store/approvals">
              {t('storeHome.storeApprovals')}
            </Link>
            <Link className="control-button store-shell-link" to="/store/incentives">
              {t('storeHome.storeIncentives')}
            </Link>
            <Link className="control-button store-shell-link" to="/admin/reports">
              {t('storeHome.adminReports')}
            </Link>
          </div>
        </article>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <div className="eyebrow">{t('storeHome.routeSkeleton')}</div>
            <h3>{t('storeHome.routeSkeletonTitle')}</h3>
          </div>
        </div>

        <div className="store-route-grid">
          <RoutePreviewCard
            route="/store/tasks"
            title={t('storeHome.workQueue')}
            copy={t('storeHome.workQueueCopy')}
            icon={<ClipboardList size={18} />}
            tone="accent"
          />
          <RoutePreviewCard
            route="/store/checklists"
            title={t('storeHome.checklists')}
            copy={t('storeHome.checklistsCopy')}
            icon={<BadgeCheck size={18} />}
            tone="calm"
          />
          <RoutePreviewCard
            route="/store/kpis"
            title={t('storeHome.kpiSummaries')}
            copy={t('storeHome.kpiCardsCopy')}
            icon={<Target size={18} />}
            tone="warning"
          />
          <RoutePreviewCard
            route="/store/me"
            title={t('storeHome.myPerformance')}
            copy={t('storeHome.myPerformanceCopy')}
            icon={<BadgeCheck size={18} />}
            tone="calm"
          />
          <RoutePreviewCard
            route="/store/rankings"
            title={t('storeHome.rankings')}
            copy={t('storeHome.rankingsCopy')}
            icon={<Target size={18} />}
            tone="warning"
          />
          <RoutePreviewCard
            route="/store/approvals"
            title={t('storeHome.approvals')}
            copy={t('storeHome.approvalsCopy')}
            icon={<ReceiptText size={18} />}
            tone="accent"
          />
        </div>
      </section>

      <section className="two-up-grid">
        <article className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">{t('storeHome.belongsHere')}</div>
              <h3>{t('storeHome.ownershipTitle')}</h3>
            </div>
          </div>
          <div className="stacked-table">
            <div className="stacked-row">
              <div className="stacked-row-head">
                <strong>{t('storeHome.checklistAction')}</strong>
                <ArrowRight size={16} />
              </div>
              <p>{t('storeHome.checklistActionCopy')}</p>
            </div>
            <div className="stacked-row">
              <div className="stacked-row-head">
                <strong>{t('storeHome.kpiVisibility')}</strong>
                <ArrowRight size={16} />
              </div>
              <p>{t('storeHome.kpiVisibilityCopy')}</p>
            </div>
            <div className="stacked-row">
              <div className="stacked-row-head">
                <strong>{t('storeHome.incentiveApprovalConsumption')}</strong>
                <ArrowRight size={16} />
              </div>
              <p>{t('storeHome.incentiveApprovalConsumptionCopy')}</p>
            </div>
          </div>
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">{t('storeHome.adminKeeps')}</div>
              <h3>{t('storeHome.doNotMoveTitle')}</h3>
            </div>
          </div>
          <EmptyState
            title={t('storeHome.governanceStaysTitle')}
            copy={t('storeHome.governanceStaysCopy')}
          />
        </article>
      </section>
    </section>
  )
}

function RoutePreviewCard(input: {
  route: string
  title: string
  copy: string
  icon: ReactNode
  tone: 'accent' | 'calm' | 'warning'
}) {
  return (
    <article className={`store-route-card store-route-card-${input.tone}`}>
      <div className="store-route-card-head">
        <span className="store-route-card-icon">{input.icon}</span>
        <code>{input.route}</code>
      </div>
      <h4>{input.title}</h4>
      <p>{input.copy}</p>
    </article>
  )
}
