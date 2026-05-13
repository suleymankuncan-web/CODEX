import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { AuthSessionSummary } from '../features/auth/api'
import type { TranslationKey } from '../features/localization/dictionary'
import { useLocalization } from '../features/localization/useLocalization'
import {
  getStoreNavigation,
  resolveStorePersona,
  type StorePersona,
} from '../app/store-navigation'

type HomeMetric = {
  labelKey: TranslationKey
  value: string
  noteKey?: TranslationKey
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
        value: input.pendingValue,
        noteKey: 'storeHome.metric.checklistPending',
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
        value: input.pendingValue,
        noteKey: 'storeHome.metric.checklistPending',
      },
    ] satisfies HomeMetric[]
  }

  if (input.persona === 'visualMerchandiser') {
    return [
      {
        labelKey: 'storeHome.metric.checklistQueue',
        value: input.pendingValue,
        noteKey: 'storeHome.metric.checklistPending',
        tone: 'score',
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
  const config = homeConfigByPersona[persona]
  const navigation = getStoreNavigation(persona)
  const title = t(config.titleKey)
  const copy = t(config.copyKey)
  const heroTitle = t(config.heroTitleKey)
  const heroCopy = t(config.heroCopyKey)
  const pendingValue = t('storeHome.valuePending')
  const storeScopeValue = formatStoreScope(input.authSummary)
  const metrics = buildMetrics({
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
        {input.metric.noteKey ? <small>{t(input.metric.noteKey)}</small> : null}
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

function getKpiRowsForPersona(persona: StorePersona) {
  if (persona === 'personnel') return ['UPT', 'ATV', 'HG%']
  if (persona === 'visualMerchandiser') return ['BM Checklist', 'VM Checklist']
  return ['UPT', 'ATV', 'CR', 'HG%', 'BM Checklist', 'VM Checklist']
}
