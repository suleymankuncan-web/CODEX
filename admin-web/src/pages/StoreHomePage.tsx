import { ArrowRight } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
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
  getStoreNavigation,
  resolveStorePersona,
  type StorePersona,
} from '../app/store-navigation'
import { transientQueryRetryOptions } from '../lib/query-retry'

type HomeMetric = {
  labelKey: TranslationKey
  value: string
  noteKey?: TranslationKey
  note?: string
  tone?: 'score' | 'link'
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
  pendingValue: string
  storeScopeValue: string
}) {
  if (input.persona === 'regionManager') {
    return [
      {
        labelKey: 'storeHome.metric.regionScore',
        value: input.pendingValue,
        noteKey: 'storeHome.metric.sourcePending',
        tone: 'score',
      },
      {
        labelKey: 'storeHome.metric.storeScope',
        value: input.storeScopeValue,
        noteKey: 'storeHome.metric.authorizedStores',
      },
      {
        labelKey: 'storeHome.metric.pendingRequests',
        value: input.pendingValue,
        noteKey: 'storeHome.metric.openRequests',
        tone: 'link',
        href: '/store/approvals',
      },
      {
        labelKey: 'storeHome.metric.checklistCoverage',
        value: input.checklistSummary?.metricValue ?? input.pendingValue,
        note: input.checklistSummary?.metricNote,
        noteKey: input.checklistSummary ? undefined : 'storeHome.metric.checklistPending',
        tone: 'link',
        href: '/store/checklists',
      },
    ] satisfies HomeMetric[]
  }

  if (input.persona === 'storeManager') {
    return [
      {
        labelKey: 'storeHome.metric.storeScore',
        value: input.pendingValue,
        noteKey: 'storeHome.metric.sourcePending',
        tone: 'score',
      },
      {
        labelKey: 'storeHome.metric.storeRank',
        value: input.pendingValue,
        noteKey: 'storeHome.metric.rankingPending',
      },
      {
        labelKey: 'storeHome.metric.pendingRequests',
        value: input.pendingValue,
        noteKey: 'storeHome.metric.openRequests',
        tone: 'link',
        href: '/store/approvals',
      },
      {
        labelKey: 'storeHome.metric.checklistStatus',
        value: input.checklistSummary?.metricValue ?? input.pendingValue,
        note: input.checklistSummary?.metricNote,
        noteKey: input.checklistSummary ? undefined : 'storeHome.metric.checklistPending',
        tone: 'link',
        href: '/store/checklists',
      },
    ] satisfies HomeMetric[]
  }

  if (input.persona === 'visualMerchandiser') {
    return [
      {
        labelKey: 'storeHome.metric.checklistQueue',
        value: input.checklistSummary?.metricValue ?? input.pendingValue,
        note: input.checklistSummary?.metricNote,
        noteKey: input.checklistSummary ? undefined : 'storeHome.metric.checklistPending',
        tone: 'score',
        href: '/store/checklists',
      },
      {
        labelKey: 'storeHome.metric.storeScope',
        value: input.storeScopeValue,
        noteKey: 'storeHome.metric.authorizedStores',
      },
    ] satisfies HomeMetric[]
  }

  return [
    {
      labelKey: 'storeHome.metric.personalScore',
      value: input.pendingValue,
      noteKey: 'storeHome.metric.sourcePending',
      tone: 'score',
    },
    {
      labelKey: 'storeHome.metric.storeRank',
      value: input.pendingValue,
      noteKey: 'storeHome.metric.rankingPending',
    },
    {
      labelKey: 'storeHome.metric.regionRank',
      value: input.pendingValue,
      noteKey: 'storeHome.metric.rankingPending',
    },
    {
      labelKey: 'storeHome.metric.turkeyRank',
      value: input.pendingValue,
      noteKey: 'storeHome.metric.rankingPending',
    },
  ] satisfies HomeMetric[]
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
  const config = homeConfigByPersona[persona]
  const navigation = getStoreNavigation(persona)
  const title = t(config.titleKey)
  const copy = t(config.copyKey)
  const heroTitle = t(config.heroTitleKey)
  const heroCopy = t(config.heroCopyKey)
  const pendingValue = t('storeHome.valuePending')
  const storeScopeValue = formatStoreScope(input.authSummary)
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
    pendingValue,
    storeScopeValue,
  })
  const summaryRows = [
    {
      labelKey: 'storeHome.summary.period',
      value: t('storeHome.summary.currentMonth'),
    },
    {
      labelKey: 'storeHome.summary.latestData',
      value: t('storeHome.valuePending'),
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
    <section className="store-command-home" aria-label={t('storeHome.command.aria')}>
      <header className="store-command-topbar">
        <div className="store-command-title-block">
          <h1>{title}</h1>
          {copy ? <p>{copy}</p> : null}
        </div>
      </header>

      <section className="store-command-content-grid">
        <div className="store-command-content-primary">
          <section className="store-command-hero">
            <div className="store-command-hero-head">
              {heroTitle || heroCopy ? (
                <div>
                  {heroTitle ? <h2>{heroTitle}</h2> : null}
                  {heroCopy ? <p>{heroCopy}</p> : null}
                </div>
              ) : null}
              <div className="store-command-period-pill">
                {t('storeHome.command.latestLoadedPeriodPending')}
              </div>
            </div>

            <article className="store-command-focus-card">
              <div>
                <strong>{t(config.focusTitleKey)}</strong>
                <p>{t(config.focusCopyKey)}</p>
              </div>
              <Link className="store-command-focus-action" to={config.focusHref}>
                {t(config.focusActionKey)}
              </Link>
            </article>

            <div className="store-command-metrics">
              {metrics.map((metric) => (
                <MetricCard key={metric.labelKey} metric={metric} />
              ))}
            </div>

            {checklistSummary ? <ChecklistHomeCard summary={checklistSummary} /> : null}
          </section>

          <section className="store-command-panel">
            <div className="store-command-panel-head">
              <h3>{t(config.timelineTitleKey)}</h3>
              <span className="store-command-status-dot">{t('storeHome.command.connected')}</span>
            </div>
            <p className="store-command-panel-note">{t('storeHome.command.connectedRoutesCopy')}</p>
            <div className="store-command-timeline">
              {navigation.slice(1, 5).map((item) => (
                <Link className="store-command-timeline-item" key={item.id} to={item.path}>
                  <i aria-hidden="true" />
                  <span>
                    <strong>{t(item.labelKey)}</strong>
                    <small>{t('storeHome.command.routeConnected')}</small>
                  </span>
                </Link>
              ))}
            </div>
          </section>
        </div>

        <aside className="store-command-home-aside">
          <section className="store-command-panel">
            <div className="store-command-panel-head">
              <h3>{t(config.summaryTitleKey)}</h3>
              <span className="store-command-status-dot">{t('storeHome.command.ready')}</span>
            </div>
            <div className="store-command-mini-list">
              {summaryRows.map((row) => (
                <div className="store-command-mini-row" key={row.labelKey}>
                  <span>
                    <strong>{t(row.labelKey)}</strong>
                  </span>
                  <span className="store-command-mini-value">{row.value}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="store-command-panel store-command-kpi-panel">
            <div className="store-command-panel-head">
              <h3>{t('storeHome.command.kpiSnapshot')}</h3>
            </div>
            <div className="store-command-kpi-list">
              {getKpiRowsForPersona(persona).map((row) => (
                <div className="store-command-kpi-row" key={row}>
                  <strong>{row}</strong>
                  <span>{pendingValue}</span>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </section>
    </section>
  )
}

function MetricCard(input: { metric: HomeMetric }) {
  const { t } = useLocalization()
  const content = (
    <>
      <div>
        <span>{t(input.metric.labelKey)}</span>
        <strong>{input.metric.value}</strong>
        {input.metric.note ? <small>{input.metric.note}</small> : null}
        {!input.metric.note && input.metric.noteKey ? <small>{t(input.metric.noteKey)}</small> : null}
      </div>
      {input.metric.tone === 'link' ? (
        <span className="store-command-metric-link-hint" aria-hidden="true">
          <ArrowRight size={17} />
        </span>
      ) : null}
    </>
  )
  const className = `store-command-metric${
    input.metric.tone === 'score' ? ' store-command-score-card' : ''
  }${input.metric.tone === 'link' ? ' store-command-metric-link' : ''}`

  if (input.metric.href) {
    return (
      <Link className={className} to={input.metric.href}>
        {content}
      </Link>
    )
  }

  return <article className={className}>{content}</article>
}

function ChecklistHomeCard(input: { summary: ChecklistHomeSummary }) {
  return (
    <Link
      className={`store-command-checklist-card store-command-checklist-card-${input.summary.tone}`}
      to="/store/checklists"
    >
      <div>
        <span>{input.summary.note}</span>
        <strong>{input.summary.title}</strong>
        <p>{input.summary.copy}</p>
      </div>
      <em>
        {input.summary.metricValue}
        <small>{input.summary.actionLabel}</small>
      </em>
    </Link>
  )
}

function getKpiRowsForPersona(persona: StorePersona) {
  if (persona === 'personnel') return ['UPT', 'ATV', 'HG%']
  if (persona === 'visualMerchandiser') return ['VM Checklist']
  return ['UPT', 'ATV', 'CR', 'HG%', 'BM Checklist', 'VM Checklist']
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
