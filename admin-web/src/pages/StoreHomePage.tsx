import type { ReactNode } from 'react'
import { Activity, ArrowRight, ClipboardCheck, Inbox, ListChecks, Store, Target, Trophy } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import type { AuthSessionSummary } from '../features/auth/api'
import { canReadChecklistResults, hasAnyRole } from '../features/auth/authorization'
import {
  getChecklistAcknowledgements,
  getMobileChecklistToday,
  type ChecklistAcknowledgementItem,
  type MobileChecklistToday,
} from '../features/checklists/api'
import type { TranslationKey } from '../features/localization/dictionary'
import { useLocalization } from '../features/localization/useLocalization'
import {
  getRoleAwareStoreNavigation,
  resolveStorePersona,
  type StorePersona,
} from '../app/store-navigation'
import {
  buildDailyCommandBriefItems,
  type DailyCommandBriefItem,
} from '../features/store-home/daily-command-brief'
import { getWorkflowInbox } from '../features/workflow/api'
import { transientQueryRetryOptions } from '../lib/query-retry'
import {
  StoreMetricCard,
  StoreMetricGrid,
  StoreSectionCard,
  StoreStackedList,
  StoreStackedRow,
  StoreStatusBadge,
  StoreSurfaceHeader,
  StoreSurfacePage,
  type StoreSurfaceTone,
} from './store-surface-primitives'

type HomeMetric = {
  labelKey: TranslationKey
  value: string
  noteKey?: TranslationKey
  note?: string
  icon?: ReactNode
  tone?: StoreSurfaceTone
  href?: string
}

type HomeDashboardRow = {
  actionLabel: string
  copy: string
  href: string
  icon: ReactNode
  id: string
  testId?: string
  title: string
  tone: StoreSurfaceTone
  value: string
}

type HomeConfig = {
  titleKey: TranslationKey
  copyKey: TranslationKey
  summaryTitleKey: TranslationKey
  timelineTitleKey: TranslationKey
}

type ChecklistHomeSummary = {
  actionLabel: string
  copy: string
  metricNote: string
  metricValue: string
  note: string
  title: string
  tone: 'attention' | 'ready'
}

const homeConfigByPersona: Record<StorePersona, HomeConfig> = {
  personnel: {
    titleKey: 'storeHome.command.personnelTitle',
    copyKey: 'storeHome.command.personnelCopy',
    summaryTitleKey: 'storeHome.command.personnelSummaryTitle',
    timelineTitleKey: 'storeHome.command.personnelTimelineTitle',
  },
  storeManager: {
    titleKey: 'storeHome.command.managerTitle',
    copyKey: 'storeHome.command.managerCopy',
    summaryTitleKey: 'storeHome.dashboard.managerTitle',
    timelineTitleKey: 'storeHome.command.managerTimelineTitle',
  },
  regionManager: {
    titleKey: 'storeHome.command.regionTitle',
    copyKey: 'storeHome.command.regionCopy',
    summaryTitleKey: 'storeHome.dashboard.regionTitle',
    timelineTitleKey: 'storeHome.command.regionTimelineTitle',
  },
  visualMerchandiser: {
    titleKey: 'storeHome.command.vmTitle',
    copyKey: 'storeHome.command.vmCopy',
    summaryTitleKey: 'storeHome.command.vmSummaryTitle',
    timelineTitleKey: 'storeHome.command.vmTimelineTitle',
  },
}

function formatStoreScope(authSummary: AuthSessionSummary | null) {
  const assignedStoreCount = authSummary?.scopeSummary.assignedStoreCount ?? 0
  const storeCount =
    authSummary?.scopeSummary.storeCount ??
    authSummary?.user.readScope.storeIds.length ??
    authSummary?.user.scope.storeIds.length ??
    0

  return assignedStoreCount > 0 ? String(assignedStoreCount) : String(storeCount)
}

function parseHomeCount(value: string | null | undefined) {
  if (!value) return null
  if (!/^\d+$/.test(value)) return null
  return Number(value)
}

function buildMetrics(input: {
  availablePaths: ReadonlySet<string>
  checklistSummary: ChecklistHomeSummary | null
  persona: StorePersona
  pendingValue: string
  pendingWorkNote: string
  pendingWorkValue: string
  pendingRequestsValue: string | null
  storeScopeValue: string
}) {
  const metrics: HomeMetric[] = [
    {
      icon: <Store data-icon="inline-start" />,
      labelKey: 'storeHome.metric.storeScope',
      value: input.storeScopeValue,
      noteKey: 'storeHome.metric.authorizedStores',
      tone: 'neutral',
    },
  ]

  if (input.persona === 'storeManager') {
    if (input.availablePaths.has('/store/tasks')) {
      metrics.push({
        icon: <Inbox data-icon="inline-start" />,
        labelKey: 'storeHome.metric.pendingWork',
        note: input.pendingWorkNote,
        value: input.pendingWorkValue,
        tone: parseHomeCount(input.pendingWorkValue) ? 'warning' : 'calm',
        href: '/store/tasks',
      })
    }
  } else if (input.persona === 'regionManager') {
    const targetRequestHref = input.availablePaths.has('/store/approvals')
      ? '/store/approvals'
      : input.availablePaths.has('/store/targets')
        ? '/store/targets'
        : null
    if (targetRequestHref) {
      metrics.push({
        icon: <Target data-icon="inline-start" />,
        labelKey: 'storeHome.metric.targetRequestFlow',
        noteKey: 'storeHome.metric.targetRequestPending',
        value: input.pendingValue,
        tone: 'neutral',
        href: targetRequestHref,
      })
    }
  } else if (input.pendingRequestsValue !== null && input.availablePaths.has('/store/approvals')) {
    metrics.push({
      icon: <Inbox data-icon="inline-start" />,
      labelKey: 'storeHome.metric.pendingRequests',
      value: input.pendingRequestsValue,
      noteKey: 'storeHome.metric.openRequests',
      tone: Number(input.pendingRequestsValue) > 0 ? 'warning' : 'calm',
      href: '/store/approvals',
    })
  }

  if (input.checklistSummary && input.availablePaths.has('/store/checklists')) {
    const checklistMetric: HomeMetric = {
      icon: <ClipboardCheck data-icon="inline-start" />,
      labelKey:
        input.persona === 'visualMerchandiser'
          ? 'storeHome.metric.checklistQueue'
          : input.persona === 'storeManager'
            ? 'storeHome.metric.checklistStatus'
            : 'storeHome.metric.checklistCoverage',
      value: input.checklistSummary.metricValue,
      note: input.checklistSummary.metricNote,
      tone: input.checklistSummary.tone === 'attention' ? 'warning' : 'calm',
      href: '/store/checklists',
    }
    metrics.push(checklistMetric)
  }

  if ((input.persona === 'storeManager' || input.persona === 'regionManager') && input.availablePaths.has('/store/kpis')) {
    metrics.push({
      icon: <Activity data-icon="inline-start" />,
      labelKey: input.persona === 'regionManager'
        ? 'storeHome.nav.kpiSummaries'
        : 'storeHome.command.kpiSnapshot',
      noteKey: 'storeHome.metric.kpiSnapshotPending',
      value: input.pendingValue,
      tone: 'neutral',
      href: '/store/kpis',
    })
  }

  if (input.persona === 'personnel') {
    metrics.push({
      icon: <Trophy data-icon="inline-start" />,
      labelKey: 'storeHome.nav.myPerformance',
      value: 'KPI',
      noteKey: 'storeHome.command.openPerformance',
      tone: 'accent',
      href: '/store/me',
    })
  }

  return metrics
}

export function StoreHomePage(input: {
  authSummary: AuthSessionSummary | null
}) {
  const { t } = useLocalization()
  const persona = resolveStorePersona(input.authSummary)
  const canManageChecklistVisits = hasAnyRole(input.authSummary, [
    'REGION_MANAGER',
    'VISUAL_MERCHANDISER',
    'SUPER_ADMIN',
  ])
  const canUseWorkflowInbox = hasAnyRole(input.authSummary, [
    'STORE_MANAGER',
    'SUPER_ADMIN',
    'REPORT_VIEWER',
  ])
  const canReadChecklistInbox = canReadChecklistResults(input.authSummary)
  const checklistAcknowledgementsQuery = useQuery({
    queryKey: ['checklist-acknowledgements'],
    queryFn: getChecklistAcknowledgements,
    enabled: canReadChecklistInbox && persona !== 'personnel',
    ...transientQueryRetryOptions,
  })
  const mobileChecklistQuery = useQuery({
    queryKey: ['mobile-checklists-today'],
    queryFn: getMobileChecklistToday,
    enabled: canManageChecklistVisits && persona !== 'storeManager' && persona !== 'personnel',
    ...transientQueryRetryOptions,
  })
  const workflowInboxQuery = useQuery({
    queryKey: ['workflow-inbox'],
    queryFn: getWorkflowInbox,
    enabled: canUseWorkflowInbox,
    ...transientQueryRetryOptions,
  })
  const config = homeConfigByPersona[persona]
  const navigation = getRoleAwareStoreNavigation(input.authSummary)
  const availablePaths = new Set(navigation.map((item) => item.path))
  const title = t(config.titleKey)
  const copy = t(config.copyKey)
  const pendingValue = t('storeHome.valuePending')
  const storeScopeValue = formatStoreScope(input.authSummary)
  const workflowItems = workflowInboxQuery.data?.items ?? []
  const pendingWorkflowItems = workflowItems.filter((item) => item.inboxStatus === 'needs_attention')
  const pendingRequestsValue =
    canUseWorkflowInbox && !workflowInboxQuery.isError
      ? workflowInboxQuery.isLoading
        ? pendingValue
        : String(pendingWorkflowItems.length)
      : null
  const checklistSummary = buildChecklistHomeSummary({
    acknowledgementItems: checklistAcknowledgementsQuery.data?.items ?? [],
    isLoading: checklistAcknowledgementsQuery.isLoading || mobileChecklistQuery.isLoading,
    mobileToday: mobileChecklistQuery.data?.data ?? null,
    pendingValue,
    persona,
    storeScopeValue,
    t,
  })
  const checklistCount = parseHomeCount(checklistSummary?.metricValue)
  const requestCount =
    canUseWorkflowInbox && !workflowInboxQuery.isLoading && !workflowInboxQuery.isError
      ? pendingWorkflowItems.length
      : null
  const pendingWorkValue =
    checklistSummary && checklistSummary.metricValue !== pendingValue && requestCount !== null
      ? String((checklistCount ?? 0) + requestCount)
      : pendingValue
  const pendingWorkNote = t('storeHome.metric.pendingWorkNote', {
    checklists: checklistSummary?.metricValue ?? pendingValue,
    requests: requestCount === null ? pendingValue : String(requestCount),
  })
  const metrics = buildMetrics({
    availablePaths,
    checklistSummary,
    persona,
    pendingValue,
    pendingWorkNote,
    pendingWorkValue,
    pendingRequestsValue,
    storeScopeValue,
  })
  const dailyBriefItems = buildDailyCommandBriefItems({
    checklistSummary,
    canUseWorkflowInbox,
    pendingValue,
    persona,
    workflowItems,
    workflowLoading: workflowInboxQuery.isLoading,
    workflowUnavailable: workflowInboxQuery.isError,
  }).filter((item) => availablePaths.has(item.href))
  const dashboardRows = buildHomeDashboardRows({
    availablePaths,
    checklistSummary,
    pendingRequestsValue,
    pendingValue,
    pendingWorkValue,
    persona,
    t,
  })
  const dashboardTitleKey =
    persona === 'regionManager'
      ? 'storeHome.dashboard.regionTitle'
      : persona === 'storeManager'
        ? 'storeHome.dashboard.managerTitle'
        : config.summaryTitleKey
  const dashboardCopyKey =
    persona === 'regionManager'
      ? 'storeHome.dashboard.regionCopy'
      : persona === 'storeManager'
        ? 'storeHome.dashboard.managerCopy'
        : config.copyKey
  const timelineItems = navigation.slice(1, 5)
  const showKpiSnapshotPanel =
    (persona === 'storeManager' || persona === 'regionManager') && availablePaths.has('/store/kpis')

  return (
    <StoreSurfacePage
      ariaLabel={t('storeHome.command.aria')}
      className="store-command-home"
      testId="store-home-dashboard"
    >
      <StoreSurfaceHeader
        eyebrow={t('storeHome.homeEyebrow')}
        title={title}
        description={copy}
        badges={[
          { label: t(`storeHome.persona.${persona}` as TranslationKey), tone: 'accent' },
          { label: `${t('storeHome.metric.authorizedStores')}: ${storeScopeValue}`, tone: 'neutral' },
        ]}
      />

      <StoreMetricGrid ariaLabel={t('storeHome.dashboard.metricsAria')} className="tw:xl:grid-cols-4">
        {metrics.map((metric) => (
          <HomeMetricCard key={metric.labelKey} metric={metric} />
        ))}
      </StoreMetricGrid>

      <div className="tw:grid tw:gap-4 tw:xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.85fr)]">
        <div className="tw:flex tw:flex-col tw:gap-4">
          <StoreSectionCard
            title={t(dashboardTitleKey)}
            description={t(dashboardCopyKey)}
            badge={{ label: t('storeHome.command.ready'), tone: 'calm' }}
          >
            <StoreStackedList>
              {dashboardRows.map((row) => (
                <HomeDashboardRowCard key={row.id} row={row} />
              ))}
            </StoreStackedList>
          </StoreSectionCard>

          <DailyCommandBriefPanel items={dailyBriefItems} />
        </div>

        <div className="tw:flex tw:flex-col tw:gap-4">
          {showKpiSnapshotPanel ? <KpiSnapshotPanel pendingValue={pendingValue} persona={persona} /> : null}

          <StoreSectionCard
            title={t(config.timelineTitleKey)}
            badge={{ label: t('storeHome.command.connected'), tone: 'calm' }}
          >
            <StoreStackedList>
              {timelineItems.map((item) => (
                <StoreStackedRow key={item.id}>
                  <div className="tw:flex tw:flex-col tw:gap-3 tw:sm:flex-row tw:sm:items-center tw:sm:justify-between">
                    <strong className="tw:text-sm tw:text-foreground">{t(item.labelKey)}</strong>
                    <Button asChild size="sm" variant="outline">
                      <Link to={item.path}>
                        {t('storeHome.dashboard.open')}
                        <ArrowRight data-icon="inline-end" />
                      </Link>
                    </Button>
                  </div>
                </StoreStackedRow>
              ))}
            </StoreStackedList>
          </StoreSectionCard>
        </div>
      </div>
    </StoreSurfacePage>
  )
}

function DailyCommandBriefPanel(input: { items: DailyCommandBriefItem[] }) {
  const { t } = useLocalization()

  return (
    <StoreSectionCard
      ariaLabel={t('storeHome.dailyBrief.title')}
      title={t('storeHome.dailyBrief.title')}
      description={t('storeHome.dailyBrief.copy')}
      badge={{ label: t('storeHome.dailyBrief.sourceLinked'), tone: 'accent' }}
    >
      <StoreStackedList>
        {input.items.map((item) => (
          <StoreStackedRow key={item.id}>
            <div className="tw:flex tw:flex-col tw:gap-3 tw:sm:flex-row tw:sm:items-center tw:sm:justify-between">
              <span className="tw:min-w-0">
                <strong className="tw:block tw:text-sm tw:text-foreground">{t(item.titleKey)}</strong>
                <small className="tw:block tw:text-sm tw:leading-6 tw:text-muted-foreground">
                  {t(item.copyKey)}
                </small>
              </span>
              <Button asChild size="sm" variant="outline">
                <Link aria-label={`${t('storeHome.dashboard.open')}: ${t(item.sourceLabelKey)}`} to={item.href}>
                  {item.value}
                  <ArrowRight data-icon="inline-end" />
                </Link>
              </Button>
            </div>
          </StoreStackedRow>
        ))}
      </StoreStackedList>
    </StoreSectionCard>
  )
}

function buildHomeDashboardRows(input: {
  availablePaths: ReadonlySet<string>
  checklistSummary: ChecklistHomeSummary | null
  pendingRequestsValue: string | null
  pendingValue: string
  pendingWorkValue: string
  persona: StorePersona
  t: ReturnType<typeof useLocalization>['t']
}): HomeDashboardRow[] {
  const rows: HomeDashboardRow[] = []
  const checklistRow = input.checklistSummary && input.availablePaths.has('/store/checklists')
    ? {
        actionLabel: input.checklistSummary.actionLabel,
        copy: input.checklistSummary.copy,
        href: '/store/checklists',
        icon: <ClipboardCheck data-icon="inline-start" />,
        id: 'checklists',
        testId: 'store-home-checklist-card',
        title: input.checklistSummary.title,
        tone: input.checklistSummary.tone === 'attention' ? 'warning' : 'calm',
        value: input.checklistSummary.metricValue,
      } satisfies HomeDashboardRow
    : null

  if (input.persona === 'storeManager') {
    if (input.availablePaths.has('/store/tasks')) {
      rows.push({
        actionLabel: input.t('storeHome.dashboard.open'),
        copy: input.t('storeHome.dashboard.managerPendingWorkCopy'),
        href: '/store/tasks',
        icon: <ListChecks data-icon="inline-start" />,
        id: 'pending-work',
        title: input.t('storeHome.dashboard.pendingWorkTitle'),
        tone: parseHomeCount(input.pendingWorkValue) ? 'warning' : 'calm',
        value: input.pendingWorkValue,
      })
    }
    if (checklistRow) rows.push(checklistRow)
    if (input.availablePaths.has('/store/kpis')) {
      rows.push({
        actionLabel: input.t('storeHome.dashboard.open'),
        copy: input.t('storeHome.dashboard.kpiPendingCopy'),
        href: '/store/kpis',
        icon: <Activity data-icon="inline-start" />,
        id: 'kpi-snapshot',
        title: input.t('storeHome.command.kpiSnapshot'),
        tone: 'neutral',
        value: input.pendingValue,
      })
    }
    if (input.availablePaths.has('/store/approvals')) {
      rows.push({
        actionLabel: input.t('storeHome.dashboard.open'),
        copy: input.t('storeHome.dashboard.approvalsCopy'),
        href: '/store/approvals',
        icon: <Inbox data-icon="inline-start" />,
        id: 'approvals',
        title: input.t('storeHome.nav.requestsApprovals'),
        tone: parseHomeCount(input.pendingRequestsValue) ? 'warning' : 'neutral',
        value: input.pendingRequestsValue ?? input.pendingValue,
      })
    }

    return rows
  }

  if (input.persona === 'regionManager') {
    if (checklistRow) rows.push(checklistRow)
    if (input.availablePaths.has('/store/kpis')) {
      rows.push({
        actionLabel: input.t('storeHome.dashboard.open'),
        copy: input.t('storeHome.dashboard.regionKpiCopy'),
        href: '/store/kpis',
        icon: <Activity data-icon="inline-start" />,
        id: 'region-kpis',
        title: input.t('storeHome.nav.kpiSummaries'),
        tone: 'neutral',
        value: input.pendingValue,
      })
    }
    if (input.availablePaths.has('/store/targets')) {
      rows.push({
        actionLabel: input.t('storeHome.dashboard.open'),
        copy: input.t('storeHome.dashboard.regionTargetsCopy'),
        href: '/store/targets',
        icon: <Target data-icon="inline-start" />,
        id: 'targets',
        title: input.t('storeHome.nav.targets'),
        tone: 'neutral',
        value: input.pendingValue,
      })
    }
    if (input.availablePaths.has('/store/reports')) {
      rows.push({
        actionLabel: input.t('storeHome.dashboard.open'),
        copy: input.t('storeHome.dashboard.regionReportsCopy'),
        href: '/store/reports',
        icon: <Trophy data-icon="inline-start" />,
        id: 'reports',
        title: input.t('storeHome.nav.reports'),
        tone: 'neutral',
        value: input.pendingValue,
      })
    }

    return rows
  }

  if (input.availablePaths.has('/store/me')) {
    rows.push({
      actionLabel: input.t('storeHome.dashboard.open'),
      copy: input.t('storeHome.dailyBrief.performanceCopy'),
      href: '/store/me',
      icon: <Trophy data-icon="inline-start" />,
      id: 'performance',
      title: input.t('storeHome.nav.myPerformance'),
      tone: 'neutral',
      value: input.pendingValue,
    })
  }
  if (checklistRow) rows.push(checklistRow)

  return rows
}

function HomeDashboardRowCard(input: { row: HomeDashboardRow }) {
  return (
    <StoreStackedRow
      tone={input.row.tone}
      {...(input.row.testId ? { testId: input.row.testId } : {})}
    >
      <div className="tw:flex tw:flex-col tw:gap-3 tw:lg:flex-row tw:lg:items-center tw:lg:justify-between">
        <div className="tw:flex tw:min-w-0 tw:gap-3">
          <span className="tw:flex tw:size-9 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-lg tw:bg-background tw:text-primary">
            {input.row.icon}
          </span>
          <span className="tw:min-w-0">
            <strong className="tw:block tw:text-sm tw:font-semibold tw:text-foreground">
              {input.row.title}
            </strong>
            <span className="tw:mt-1 tw:block tw:text-sm tw:leading-6 tw:text-muted-foreground">
              {input.row.copy}
            </span>
          </span>
        </div>
        <div className="tw:flex tw:shrink-0 tw:items-center tw:gap-3 tw:lg:justify-end">
          <StoreStatusBadge tone={input.row.tone}>{input.row.value}</StoreStatusBadge>
          <Button asChild size="sm" variant="outline">
            <Link aria-label={`${input.row.title} ${input.row.actionLabel}`} to={input.row.href}>
              {input.row.actionLabel}
              <ArrowRight data-icon="inline-end" />
            </Link>
          </Button>
        </div>
      </div>
    </StoreStackedRow>
  )
}

function KpiSnapshotPanel(input: { pendingValue: string; persona: StorePersona }) {
  const { t } = useLocalization()
  const title =
    input.persona === 'regionManager'
      ? t('storeHome.dashboard.regionKpiTitle')
      : t('storeHome.command.kpiSnapshot')

  return (
    <StoreSectionCard
      title={title}
      description={t('storeHome.dashboard.kpiSnapshotCopy')}
      badge={{ label: input.pendingValue, tone: 'neutral' }}
    >
      <StoreStackedList>
        <StoreStackedRow>
          <div className="tw:flex tw:flex-col tw:gap-3 tw:sm:flex-row tw:sm:items-center tw:sm:justify-between">
            <span className="tw:min-w-0">
              <strong className="tw:block tw:text-sm tw:text-foreground">
                {t('storeHome.dashboard.kpiSnapshotStatus')}
              </strong>
              <small className="tw:block tw:text-sm tw:leading-6 tw:text-muted-foreground">
                {t('storeHome.metric.kpiSnapshotPending')}
              </small>
            </span>
            <Button asChild size="sm" variant="outline">
              <Link to="/store/kpis">
                {t('storeHome.dashboard.open')}
                <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
          </div>
        </StoreStackedRow>
        <StoreStackedRow tone="neutral">
          <div className="tw:flex tw:flex-wrap tw:items-center tw:justify-between tw:gap-3">
            <span className="tw:text-sm tw:font-medium tw:text-muted-foreground">
              {t('storeHome.dashboard.kpiMetricSet')}
            </span>
            <StoreStatusBadge tone="neutral">{input.pendingValue}</StoreStatusBadge>
          </div>
        </StoreStackedRow>
      </StoreStackedList>
    </StoreSectionCard>
  )
}

function HomeMetricCard(input: { metric: HomeMetric }) {
  const { t } = useLocalization()
  const note = input.metric.note ?? (input.metric.noteKey ? t(input.metric.noteKey) : undefined)
  const action = input.metric.href
    ? {
        icon: <ArrowRight data-icon="inline-start" />,
        label: t('storeHome.dashboard.open'),
        to: input.metric.href,
        variant: 'outline' as const,
      }
    : undefined

  return (
    <StoreMetricCard
      icon={input.metric.icon}
      title={t(input.metric.labelKey)}
      value={input.metric.value}
      {...(input.metric.tone ? { tone: input.metric.tone } : {})}
      {...(note ? { note } : {})}
      {...(action ? { action } : {})}
    />
  )
}

function buildChecklistHomeSummary(input: {
  acknowledgementItems: ChecklistAcknowledgementItem[]
  isLoading: boolean
  mobileToday: MobileChecklistToday | null
  pendingValue: string
  persona: StorePersona
  storeScopeValue: string
  t: ReturnType<typeof useLocalization>['t']
}): ChecklistHomeSummary | null {
  if (input.persona === 'personnel') return null

  const visibleAcknowledgementItems = getChecklistHomeAcknowledgementItemsForPersona(
    input.acknowledgementItems,
    input.persona,
  )
  const visibleMobileToday = getChecklistHomeMobileTodayForPersona(input.mobileToday, input.persona)
  const pendingAcknowledgements = visibleAcknowledgementItems.filter((item) => item.acknowledgement === null).length
  const acknowledgedCount = visibleAcknowledgementItems.filter((item) => item.acknowledgement !== null).length
  const activeDraftCount = visibleMobileToday?.activeInstances.length ?? 0
  const completedVisitCount = visibleMobileToday?.completedThisMonth.length ?? acknowledgedCount
  const expectedVisitCount = visibleMobileToday
    ? visibleMobileToday.stores.length * Math.max(visibleMobileToday.templates.length, 1)
    : null
  const pendingVisitCount =
    expectedVisitCount === null
      ? pendingAcknowledgements
      : Math.max(expectedVisitCount - completedVisitCount - activeDraftCount, 0)

  if (input.persona === 'storeManager') {
    const value = input.isLoading ? input.pendingValue : String(pendingAcknowledgements)
    return {
      actionLabel: input.t('storeHome.checklistCard.action'),
      copy: input.t('storeHome.checklistCard.storeCopy', { count: value }),
      metricNote: input.t('storeHome.checklistCard.storeMetricNote'),
      metricValue: value,
      note: input.t('storeHome.checklistCard.storeNote'),
      title: input.t('storeHome.checklistCard.storeTitle'),
      tone: pendingAcknowledgements > 0 ? 'attention' : 'ready',
    }
  }

  const value = input.isLoading ? input.pendingValue : String(pendingVisitCount)
  const completedValue = input.isLoading ? input.pendingValue : String(completedVisitCount)

  if (input.persona === 'visualMerchandiser') {
    return {
      actionLabel: input.t('storeHome.checklistCard.action'),
      copy: input.t('storeHome.checklistCard.vmCopy', {
        completed: completedValue,
        count: value,
        scope: input.storeScopeValue,
      }),
      metricNote: input.t('storeHome.checklistCard.vmMetricNote', { completed: completedValue }),
      metricValue: value,
      note: input.t('storeHome.checklistCard.vmNote'),
      title: input.t('storeHome.checklistCard.vmTitle'),
      tone: pendingVisitCount > 0 ? 'attention' : 'ready',
    }
  }

  return {
    actionLabel: input.t('storeHome.checklistCard.action'),
    copy: input.t('storeHome.checklistCard.regionCopy', {
      completed: completedValue,
      count: value,
      scope: input.storeScopeValue,
    }),
    metricNote: input.t('storeHome.checklistCard.regionMetricNote', { completed: completedValue }),
    metricValue: value,
    note: input.t('storeHome.checklistCard.regionNote'),
    title: input.t('storeHome.checklistCard.regionTitle'),
    tone: pendingVisitCount > 0 ? 'attention' : 'ready',
  }
}

function getChecklistHomeAcknowledgementItemsForPersona(
  items: ChecklistAcknowledgementItem[],
  persona: StorePersona,
) {
  if (persona === 'visualMerchandiser') {
    return items.filter((item) => item.templateType === 'VM_STORE_VISIT')
  }

  return items
}

function getChecklistHomeMobileTodayForPersona(
  mobileToday: MobileChecklistToday | null,
  persona: StorePersona,
): MobileChecklistToday | null {
  if (!mobileToday || persona !== 'visualMerchandiser') return mobileToday

  const vmTemplateIds = new Set<string>()
  const vmTemplates: MobileChecklistToday['templates'] = []

  for (const template of mobileToday.templates) {
    if (template.templateType !== 'VM_STORE_VISIT') continue
    vmTemplateIds.add(template.checklistTemplateId)
    vmTemplates.push(template)
  }

  return {
    ...mobileToday,
    templates: vmTemplates,
    activeInstances: mobileToday.activeInstances.filter((instance) =>
      vmTemplateIds.has(instance.checklistTemplateId),
    ),
    completedThisMonth: mobileToday.completedThisMonth.filter((item) =>
      vmTemplateIds.has(item.checklistTemplateId),
    ),
    pendingAcknowledgements: mobileToday.pendingAcknowledgements.filter((item) =>
      vmTemplateIds.has(item.checklistTemplateId),
    ),
    monthlySummaries: mobileToday.monthlySummaries.filter((item) =>
      vmTemplateIds.has(item.checklistTemplateId),
    ),
  }
}
