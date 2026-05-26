import { ArrowRight } from 'lucide-react'
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
  StoreInfoGrid,
  StoreMetricCard,
  StoreMetricGrid,
  StoreSectionCard,
  StoreStackedList,
  StoreStackedRow,
  StoreSurfaceHeader,
  StoreSurfacePage,
  type StoreSurfaceTone,
} from './store-surface-primitives'

type HomeMetric = {
  labelKey: TranslationKey
  value: string
  noteKey?: TranslationKey
  note?: string
  tone?: StoreSurfaceTone
  href?: string
}

type HomeConfig = {
  titleKey: TranslationKey
  copyKey: TranslationKey
  heroTitleKey: TranslationKey
  heroCopyKey: TranslationKey
  focusTitleKey: TranslationKey
  focusCopyKey: TranslationKey
  focusActionKey: TranslationKey
  focusHref: string
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
    heroTitleKey: 'storeHome.command.personnelHeroTitle',
    heroCopyKey: 'storeHome.command.personnelHeroCopy',
    focusTitleKey: 'storeHome.command.personnelFocusTitle',
    focusCopyKey: 'storeHome.command.personnelFocusCopy',
    focusActionKey: 'storeHome.command.openPerformance',
    focusHref: '/store/me',
    summaryTitleKey: 'storeHome.command.personnelSummaryTitle',
    timelineTitleKey: 'storeHome.command.personnelTimelineTitle',
  },
  storeManager: {
    titleKey: 'storeHome.command.managerTitle',
    copyKey: 'storeHome.command.managerCopy',
    heroTitleKey: 'storeHome.command.managerHeroTitle',
    heroCopyKey: 'storeHome.command.managerHeroCopy',
    focusTitleKey: 'storeHome.command.managerFocusTitle',
    focusCopyKey: 'storeHome.command.managerFocusCopy',
    focusActionKey: 'storeHome.nav.requestsApprovals',
    focusHref: '/store/approvals',
    summaryTitleKey: 'storeHome.command.managerSummaryTitle',
    timelineTitleKey: 'storeHome.command.managerTimelineTitle',
  },
  regionManager: {
    titleKey: 'storeHome.command.regionTitle',
    copyKey: 'storeHome.command.regionCopy',
    heroTitleKey: 'storeHome.command.regionHeroTitle',
    heroCopyKey: 'storeHome.command.regionHeroCopy',
    focusTitleKey: 'storeHome.command.regionFocusTitle',
    focusCopyKey: 'storeHome.command.regionFocusCopy',
    focusActionKey: 'storeHome.nav.checklists',
    focusHref: '/store/checklists',
    summaryTitleKey: 'storeHome.command.regionSummaryTitle',
    timelineTitleKey: 'storeHome.command.regionTimelineTitle',
  },
  visualMerchandiser: {
    titleKey: 'storeHome.command.vmTitle',
    copyKey: 'storeHome.command.vmCopy',
    heroTitleKey: 'storeHome.command.vmHeroTitle',
    heroCopyKey: 'storeHome.command.vmHeroCopy',
    focusTitleKey: 'storeHome.command.vmFocusTitle',
    focusCopyKey: 'storeHome.command.vmFocusCopy',
    focusActionKey: 'storeHome.nav.checklists',
    focusHref: '/store/checklists',
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

function buildMetrics(input: {
  checklistSummary: ChecklistHomeSummary | null
  persona: StorePersona
  pendingRequestsValue: string | null
  storeScopeValue: string
}) {
  const metrics: HomeMetric[] = [
    {
      labelKey: 'storeHome.metric.storeScope',
      value: input.storeScopeValue,
      noteKey: 'storeHome.metric.authorizedStores',
      tone: 'neutral',
    },
  ]

  if (input.pendingRequestsValue !== null) {
    metrics.push({
      labelKey: 'storeHome.metric.pendingRequests',
      value: input.pendingRequestsValue,
      noteKey: 'storeHome.metric.openRequests',
      tone: Number(input.pendingRequestsValue) > 0 ? 'warning' : 'calm',
      href: '/store/approvals',
    })
  }

  if (input.checklistSummary) {
    const checklistMetric: HomeMetric = {
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

  if (input.persona === 'personnel') {
    metrics.push({
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
  const title = t(config.titleKey)
  const copy = t(config.copyKey)
  const heroTitle = t(config.heroTitleKey)
  const heroCopy = t(config.heroCopyKey)
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
  const metrics = buildMetrics({
    checklistSummary,
    persona,
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
  })
  const summaryRows = [
    {
      labelKey: 'storeHome.summary.period',
      value: t('storeHome.summary.currentMonth'),
    },
    {
      labelKey: 'storeHome.summary.scope',
      value: storeScopeValue,
    },
    {
      labelKey: 'storeHome.summary.language',
      value: t('storeHome.summary.languageSettings'),
    },
  ] satisfies Array<{ labelKey: TranslationKey; value: string }>

  return (
    <StoreSurfacePage ariaLabel={t('storeHome.command.aria')}>
      <StoreSurfaceHeader
        eyebrow={t('storeHome.homeEyebrow')}
        title={title}
        description={copy}
        badges={[
          { label: t(`storeHome.persona.${persona}` as TranslationKey), tone: 'accent' },
          { label: `${t('storeHome.summary.scope')}: ${storeScopeValue}`, tone: 'neutral' },
        ]}
      />

      <div className="tw:grid tw:gap-4 tw:xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <div className="tw:flex tw:flex-col tw:gap-4">
          <StoreSectionCard
            title={heroTitle}
            description={heroCopy}
            action={{
              icon: <ArrowRight data-icon="inline-start" />,
              label: t(config.focusActionKey),
              to: config.focusHref,
            }}
          >
            <StoreStackedRow tone="accent">
              <strong className="tw:block tw:text-sm tw:font-semibold tw:text-foreground">
                {t(config.focusTitleKey)}
              </strong>
              <p className="tw:mt-1 tw:text-sm tw:leading-6 tw:text-muted-foreground">
                {t(config.focusCopyKey)}
              </p>
            </StoreStackedRow>

            {metrics.length > 0 ? (
              <StoreMetricGrid className="tw:mt-3 tw:xl:grid-cols-3">
                {metrics.map((metric) => (
                  <HomeMetricCard key={metric.labelKey} metric={metric} />
                ))}
              </StoreMetricGrid>
            ) : null}

            {checklistSummary ? <ChecklistHomeCard summary={checklistSummary} /> : null}
          </StoreSectionCard>

          <DailyCommandBriefPanel items={dailyBriefItems} />

          <StoreSectionCard
            title={t(config.timelineTitleKey)}
            badge={{ label: t('storeHome.command.connected'), tone: 'calm' }}
          >
            <StoreStackedList>
              {navigation.slice(1, 5).map((item) => (
                <StoreStackedRow key={item.id}>
                  <div className="tw:flex tw:flex-col tw:gap-3 tw:sm:flex-row tw:sm:items-center tw:sm:justify-between">
                    <strong className="tw:text-sm tw:text-foreground">{t(item.labelKey)}</strong>
                    <Button asChild size="sm" variant="outline">
                      <Link to={item.path}>
                        {t('storeHome.dailyBrief.openSource')}
                        <ArrowRight data-icon="inline-end" />
                      </Link>
                    </Button>
                  </div>
                </StoreStackedRow>
              ))}
            </StoreStackedList>
          </StoreSectionCard>
        </div>

        <StoreSectionCard
          title={t(config.summaryTitleKey)}
          badge={{ label: t('storeHome.command.ready'), tone: 'calm' }}
        >
          <StoreInfoGrid
            items={summaryRows.map((row) => ({
              label: t(row.labelKey),
              value: row.value,
            }))}
            className="tw:sm:grid-cols-1 tw:xl:grid-cols-1"
          />
        </StoreSectionCard>
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
                <Link aria-label={`${t('storeHome.dailyBrief.openSource')}: ${t(item.sourceLabelKey)}`} to={item.href}>
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

function HomeMetricCard(input: { metric: HomeMetric }) {
  const { t } = useLocalization()
  const note = input.metric.href
    ? input.metric.note
    : input.metric.note ?? (input.metric.noteKey ? t(input.metric.noteKey) : undefined)
  const action = input.metric.href
    ? {
        icon: <ArrowRight data-icon="inline-start" />,
        label: input.metric.noteKey ? t(input.metric.noteKey) : t('storeHome.dailyBrief.openSource'),
        to: input.metric.href,
        variant: 'outline' as const,
      }
    : undefined

  return (
    <StoreMetricCard
      title={t(input.metric.labelKey)}
      value={input.metric.value}
      {...(input.metric.tone ? { tone: input.metric.tone } : {})}
      {...(note ? { note } : {})}
      {...(action ? { action } : {})}
    />
  )
}

function ChecklistHomeCard(input: { summary: ChecklistHomeSummary }) {
  return (
    <StoreStackedRow
      className="tw:mt-3"
      tone={input.summary.tone === 'attention' ? 'warning' : 'calm'}
    >
      <div className="tw:flex tw:flex-col tw:gap-3 tw:sm:flex-row tw:sm:items-center tw:sm:justify-between">
        <div className="tw:min-w-0">
          <span className="tw:text-xs tw:font-medium tw:text-muted-foreground">{input.summary.note}</span>
          <strong className="tw:block tw:text-sm tw:text-foreground">{input.summary.title}</strong>
          <p className="tw:mt-1 tw:text-sm tw:leading-6 tw:text-muted-foreground">{input.summary.copy}</p>
        </div>
        <div className="tw:flex tw:items-center tw:gap-3">
          <strong className="tw:text-2xl tw:text-foreground">{input.summary.metricValue}</strong>
          <Button asChild size="sm" variant="outline">
            <Link to="/store/checklists">
              {input.summary.actionLabel}
              <ArrowRight data-icon="inline-end" />
            </Link>
          </Button>
        </div>
      </div>
    </StoreStackedRow>
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
