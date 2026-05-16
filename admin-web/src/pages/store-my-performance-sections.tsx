import { type CSSProperties } from 'react'
import { NavLink } from 'react-router-dom'
import { CalendarDays, ChevronDown, X } from 'lucide-react'
import type { TranslateFunction } from '../features/localization/dictionary'

type StorePerformanceSourceMode = 'live' | 'closed'
type LivePeriodType = 'monthly' | 'daily'

type LiveDayPeriod = {
  periodType: string
  periodStart: string
  periodEnd: string
}

type StoreMyPerformanceRailProps = {
  t: TranslateFunction
}

type StoreMyPerformanceTopbarProps = {
  employeeHeading: string
  introCopy: string
  periodLabel: string
  t: TranslateFunction
}

type StoreMyPerformanceDateFilterProps = {
  activeClosedSnapshotRunId: string
  availableClosedSnapshotRuns: Array<{
    label: string
    snapshotRunId: string
  }>
  availableLiveMonthOptions: Array<{
    checked: boolean
    key: string
    label: string
  }>
  availableLiveYearOptions: Array<{
    checked: boolean
    key: string
  }>
  dataQualityLabel: string
  isDateFilterOpen: boolean
  isPartial: boolean
  loadedPeriodCount: number
  onChangeLivePeriodType: (periodType: LivePeriodType) => void
  onSelectClosedSnapshotRun: (snapshotRunId: string) => void
  onSelectSourceMode: (mode: StorePerformanceSourceMode) => void
  onToggleDateFilter: () => void
  onToggleLiveDay: (period: LiveDayPeriod) => void
  onToggleLiveMonth: (monthKey: string) => void
  onToggleLiveYear: (year: string) => void
  scopedAvailableDailyPeriods: Array<{
    checked: boolean
    key: string
    label: string
    period: LiveDayPeriod
  }>
  selectedClosedSnapshotRunId: string
  selectedLivePeriodType: LivePeriodType
  selectedPeriodLabel: string
  sourceMode: StorePerformanceSourceMode
  t: TranslateFunction
  usesClosedSnapshotMode: boolean
}

type SamePeriodMetric = {
  code: string
  delta: string | null
  label: string
  width: string
}

type StoreMyPerformanceScorePanelProps = {
  gradeLabel: string
  isPartial: boolean
  scoreConfidence: string
  scoreDeltaLabel: string
  scoreFocus: string
  scoreValue: number
  storePopulationLabel: string
  storeRankLabel: string
  t: TranslateFunction
  turkeyPopulationLabel: string
  turkeyRankLabel: string
}

type StoreMyPerformanceHeroPanelProps = {
  actualSalesLabel: string
  onOpenKpiDetails: () => void
  remainingTargetLabel: string
  samePeriodMetrics: SamePeriodMetric[]
  samePeriodScoreDelta: string | null
  scoreSummary: string
  t: TranslateFunction
  targetProgressPercent: number
  targetSalesLabel: string
  targetStatusLabel: string
}

type StoreMyPerformancePartialAlertProps = {
  isPartial: boolean
  missingMetricLabels: string[]
  pendingNormalizationLabels: string[]
  t: TranslateFunction
}

type MetricCard = {
  code: string
  displayValue: string
  label: string
  narrative: string
  progressPercent: number
  statusLabel: string
  tone: string
}

type StoreMyPerformanceMetricGridProps = {
  metricCards: MetricCard[]
  storeRankLabel: string
  t: TranslateFunction
  turkeyRankLabel: string
}

type StoreMyPerformanceLowerGridProps = {
  samePeriodScoreDelta: string | null
  t: TranslateFunction
  trendPoints: {
    area: string
    line: string
  }
}

type MonthlyDetailRow = {
  atvLabel: string
  key: string
  label: string
  periodNote: string
  scoreLabel: string
  targetLabel: string
  trendLabel: string | null
  trendWidth: string
  uptLabel: string
}

type StoreMyPerformanceKpiDialogProps = {
  employeeName: string
  isOpen: boolean
  monthlyDetailRows: MonthlyDetailRow[]
  onClose: () => void
  t: TranslateFunction
}

function NavGlyph(input: { type: 'home' | 'me' | 'rank' | 'target' | 'settings' }) {
  if (input.type === 'home') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 11.5 12 5l8 6.5V20H4z" />
        <path d="M9 20v-6h6v6" />
      </svg>
    )
  }

  if (input.type === 'rank') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M18 20V10" />
        <path d="M12 20V4" />
        <path d="M6 20v-6" />
      </svg>
    )
  }

  if (input.type === 'target') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 20a8 8 0 1 0-8-8" />
        <path d="M12 12 18 8" />
        <path d="M4 12H2" />
      </svg>
    )
  }

  if (input.type === 'settings') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z" />
        <path d="M19.4 15a1.8 1.8 0 0 0 .36 1.98l.04.04a2.1 2.1 0 1 1-2.97 2.97l-.04-.04a1.8 1.8 0 0 0-1.98-.36 1.8 1.8 0 0 0-1.09 1.65V21a2.1 2.1 0 1 1-4.2 0v-.06A1.8 1.8 0 0 0 8.43 19.3a1.8 1.8 0 0 0-1.98.36l-.04.04a2.1 2.1 0 1 1-2.97-2.97l.04-.04A1.8 1.8 0 0 0 3.84 15a1.8 1.8 0 0 0-1.65-1.09H2a2.1 2.1 0 1 1 0-4.2h.06a1.8 1.8 0 0 0 1.65-1.09 1.8 1.8 0 0 0-.36-1.98l-.04-.04a2.1 2.1 0 1 1 2.97-2.97l.04.04a1.8 1.8 0 0 0 1.98.36h.01A1.8 1.8 0 0 0 9.4 2.38V2a2.1 2.1 0 1 1 4.2 0v.06a1.8 1.8 0 0 0 1.09 1.65 1.8 1.8 0 0 0 1.98-.36l.04-.04a2.1 2.1 0 1 1 2.97 2.97l-.04.04a1.8 1.8 0 0 0-.36 1.98v.01a1.8 1.8 0 0 0 1.65 1.09H21a2.1 2.1 0 1 1 0 4.2h-.06A1.8 1.8 0 0 0 19.4 15z" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 19V9" />
      <path d="M10 19V5" />
      <path d="M16 19v-8" />
      <path d="M22 19H2" />
    </svg>
  )
}

export function StoreMyPerformanceRail({ t }: StoreMyPerformanceRailProps) {
  return (
    <aside className="store-me-v2-rail" aria-label={t('storeMe.nav.aria')}>
      <div className="store-me-v2-brand-mark" aria-label={t('storeMe.brandAria')}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 16.5 9.2 11l3.8 3.7L20 7" />
          <path d="M15 7h5v5" />
        </svg>
      </div>
      <nav className="store-me-v2-rail-nav" aria-label={t('storeMe.nav.aria')}>
        <NavLink to="/store/home" className="store-me-v2-rail-link">
          <NavGlyph type="home" />
          <span>{t('storeMe.nav.home')}</span>
        </NavLink>
        <NavLink to="/store/me" className="store-me-v2-rail-link">
          <NavGlyph type="me" />
          <span>{t('storeMe.nav.me')}</span>
        </NavLink>
        <NavLink to="/store/rankings" className="store-me-v2-rail-link">
          <NavGlyph type="rank" />
          <span>{t('storeMe.nav.rankings')}</span>
        </NavLink>
        <NavLink to="/store/approvals" className="store-me-v2-rail-link">
          <NavGlyph type="target" />
          <span>{t('storeMe.nav.targets')}</span>
        </NavLink>
      </nav>
      <div className="store-me-v2-rail-spacer" />
      <NavLink to="/store/tasks" className="store-me-v2-rail-link">
        <NavGlyph type="settings" />
        <span>{t('storeMe.nav.tasks')}</span>
      </NavLink>
    </aside>
  )
}

export function StoreMyPerformanceTopbar({
  employeeHeading,
  introCopy,
  periodLabel,
  t,
}: StoreMyPerformanceTopbarProps) {
  return (
    <header className="store-me-v2-topbar">
      <div className="store-me-v2-identity">
        <h1>{employeeHeading}</h1>
        <p>{introCopy}</p>
      </div>
      <div className="store-me-v2-top-actions" aria-label={t('storeMe.pageTools')}>
        <button className="store-me-v2-period-pill" type="button">
          {periodLabel}
        </button>
        <button className="store-me-v2-theme-pill" type="button">
          {t('storeMe.lightTheme')}
        </button>
        <button className="store-me-v2-icon-button" type="button" aria-label={t('storeMe.notifications')}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
            <path d="M10 21h4" />
          </svg>
        </button>
      </div>
    </header>
  )
}

export function StoreMyPerformanceDateFilter({
  activeClosedSnapshotRunId,
  availableClosedSnapshotRuns,
  availableLiveMonthOptions,
  availableLiveYearOptions,
  dataQualityLabel,
  isDateFilterOpen,
  isPartial,
  loadedPeriodCount,
  onChangeLivePeriodType,
  onSelectClosedSnapshotRun,
  onSelectSourceMode,
  onToggleDateFilter,
  onToggleLiveDay,
  onToggleLiveMonth,
  onToggleLiveYear,
  scopedAvailableDailyPeriods,
  selectedClosedSnapshotRunId,
  selectedLivePeriodType,
  selectedPeriodLabel,
  sourceMode,
  t,
  usesClosedSnapshotMode,
}: StoreMyPerformanceDateFilterProps) {
  return (
    <section className="store-me-v2-date-filter">
      <button
        className="store-me-v2-date-filter-trigger"
        type="button"
        aria-expanded={isDateFilterOpen}
        onClick={onToggleDateFilter}
      >
        <span className="store-me-v2-filter-trigger-icon" aria-hidden="true">
          <CalendarDays size={20} />
        </span>
        <span className="store-me-v2-filter-trigger-main">
          <span>{t('storeMe.dateFilter')}</span>
          <strong>{selectedPeriodLabel}</strong>
        </span>
        <span className="store-me-v2-filter-trigger-meta" aria-hidden="true">
          <span>{t('storeMe.loadedPeriodCount', { count: loadedPeriodCount })}</span>
          <span className={isPartial ? '' : 'success'}>{dataQualityLabel}</span>
        </span>
        <span className="store-me-v2-filter-caret" aria-hidden="true">
          <ChevronDown size={18} />
        </span>
      </button>

      {isDateFilterOpen ? (
        <div className="store-me-v2-date-filter-popover" role="group" aria-label={t('storeMe.dateFilter')}>
          {usesClosedSnapshotMode ? (
            <div className="store-me-v2-filter-field">
              <span>{t('storeMe.view')}</span>
              <div className="store-me-v2-choice-row">
                <button
                  className={sourceMode === 'live' ? 'active' : ''}
                  type="button"
                  onClick={() => onSelectSourceMode('live')}
                >
                  {t('storeMe.liveStatus')}
                </button>
                <button
                  className={sourceMode === 'closed' ? 'active' : ''}
                  type="button"
                  onClick={() => onSelectSourceMode('closed')}
                >
                  {t('storeMe.closedDay')}
                </button>
              </div>
            </div>
          ) : null}
          <div className="store-me-v2-filter-field">
            <span>{t('storeMe.liveGranularity')}</span>
            <div className="store-me-v2-choice-row">
              <button
                className={selectedLivePeriodType === 'monthly' ? 'active' : ''}
                type="button"
                disabled={sourceMode !== 'live'}
                onClick={() => onChangeLivePeriodType('monthly')}
              >
                {t('storeMe.liveMonth')}
              </button>
              <button
                className={selectedLivePeriodType === 'daily' ? 'active' : ''}
                type="button"
                disabled={sourceMode !== 'live'}
                onClick={() => onChangeLivePeriodType('daily')}
              >
                {t('storeMe.liveDay')}
              </button>
            </div>
          </div>
          <div className="store-me-v2-filter-field">
            <span>{t('storeMe.loadedYears')}</span>
            <div
              className="store-me-v2-period-picklist"
              role="group"
              aria-label={t('storeMe.loadedYears')}
            >
              {availableLiveYearOptions.length ? (
                availableLiveYearOptions.map((year) => (
                  <label
                    className={`store-me-v2-period-check${year.checked ? ' active' : ''}`}
                    key={year.key}
                  >
                    <input
                      type="checkbox"
                      checked={year.checked}
                      onChange={() => onToggleLiveYear(year.key)}
                      disabled={sourceMode !== 'live'}
                    />
                    <span>{year.key}</span>
                  </label>
                ))
              ) : (
                <span className="store-me-v2-period-empty">{t('storeMe.noLoadedPeriods')}</span>
              )}
            </div>
          </div>
          <div className="store-me-v2-filter-field">
            <span>{t('storeMe.loadedMonthBuckets')}</span>
            <div
              className="store-me-v2-period-picklist"
              role="group"
              aria-label={t('storeMe.loadedMonthBuckets')}
            >
              {availableLiveMonthOptions.length ? (
                availableLiveMonthOptions.map((month) => (
                  <label
                    className={`store-me-v2-period-check${month.checked ? ' active' : ''}`}
                    key={month.key}
                  >
                    <input
                      type="checkbox"
                      checked={month.checked}
                      onChange={() => onToggleLiveMonth(month.key)}
                      disabled={sourceMode !== 'live'}
                    />
                    <span>{month.label}</span>
                  </label>
                ))
              ) : (
                <span className="store-me-v2-period-empty">{t('storeMe.noLoadedPeriods')}</span>
              )}
            </div>
          </div>
          {selectedLivePeriodType === 'daily' ? (
            <div className="store-me-v2-filter-field">
              <span>{t('storeMe.loadedDays')}</span>
              <div
                className="store-me-v2-period-picklist"
                role="group"
                aria-label={t('storeMe.loadedDaySelect')}
              >
                {scopedAvailableDailyPeriods.length ? (
                  scopedAvailableDailyPeriods.map((period) => (
                    <label
                      className={`store-me-v2-period-check${period.checked ? ' active' : ''}`}
                      key={`${period.period.periodType}-${period.key}`}
                    >
                      <input
                        type="checkbox"
                        checked={period.checked}
                        onChange={() => onToggleLiveDay(period.period)}
                        disabled={sourceMode !== 'live'}
                      />
                      <span>{period.label}</span>
                    </label>
                  ))
                ) : (
                  <span className="store-me-v2-period-empty">{t('storeMe.noLoadedPeriods')}</span>
                )}
              </div>
            </div>
          ) : null}
          {usesClosedSnapshotMode ? (
            <label className="store-me-v2-filter-field">
              <span>{t('storeMe.closedSnapshotSelect')}</span>
              <select
                value={selectedClosedSnapshotRunId || activeClosedSnapshotRunId || ''}
                onChange={(event) => onSelectClosedSnapshotRun(event.target.value)}
                disabled={sourceMode !== 'closed' || availableClosedSnapshotRuns.length === 0}
              >
                <option value="">{t('storeMe.latestClosedSnapshot')}</option>
                {availableClosedSnapshotRuns.map((run) => (
                  <option key={run.snapshotRunId} value={run.snapshotRunId}>
                    {run.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}

export function StoreMyPerformanceScorePanel({
  gradeLabel,
  isPartial,
  scoreConfidence,
  scoreDeltaLabel,
  scoreFocus,
  scoreValue,
  storePopulationLabel,
  storeRankLabel,
  t,
  turkeyPopulationLabel,
  turkeyRankLabel,
}: StoreMyPerformanceScorePanelProps) {
  return (
    <aside className="store-me-v2-panel store-me-v2-score-panel" aria-label={t('storeMe.performanceScore')}>
      <div className="store-me-v2-score-head">
        <div>
          <span>{t('storeMe.overallPerformance')}</span>
          <strong>{t('storeMe.personalScoreCard')}</strong>
        </div>
        <div className="store-me-v2-status-chip">
          <i />
          {isPartial ? t('storeMe.incompleteData') : gradeLabel}
        </div>
      </div>

      <div className="store-me-v2-score-core">
        <div
          className="store-me-v2-score-orbit"
          style={{ '--store-me-v2-score': `${scoreValue}%` } as CSSProperties}
        >
          <div className="store-me-v2-score-number">
            <strong>{scoreValue}</strong>
            <span>/100</span>
            <small>{scoreDeltaLabel}</small>
          </div>
        </div>
      </div>

      <div className="store-me-v2-rank-ladder" aria-label={t('storeMe.generalScoreRankings')}>
        <article className="store-me-v2-rank-card">
          <span>{t('storeMe.store')}</span>
          <strong>{storeRankLabel}</strong>
          <small>{storePopulationLabel}</small>
        </article>
        <article className="store-me-v2-rank-card">
          <span>{t('storeMe.region')}</span>
          <strong>{t('storeMe.noData')}</strong>
          <small>{t('storeMe.regionRankPending')}</small>
        </article>
        <article className="store-me-v2-rank-card">
          <span>{t('storeMe.turkey')}</span>
          <strong>{turkeyRankLabel}</strong>
          <small>{turkeyPopulationLabel}</small>
        </article>
      </div>

      <section className="store-me-v2-coach-card" aria-label={t('storeMe.coachingMode')}>
        <span>{t('storeMe.coachingMode')}</span>
        <strong>{scoreFocus}</strong>
        <p>{scoreConfidence}</p>
      </section>
    </aside>
  )
}

export function StoreMyPerformanceHeroPanel({
  actualSalesLabel,
  onOpenKpiDetails,
  remainingTargetLabel,
  samePeriodMetrics,
  samePeriodScoreDelta,
  scoreSummary,
  t,
  targetProgressPercent,
  targetSalesLabel,
  targetStatusLabel,
}: StoreMyPerformanceHeroPanelProps) {
  return (
    <section className="store-me-v2-panel store-me-v2-hero-panel" aria-label={t('storeMe.performanceSummary')}>
      <div className="store-me-v2-hero-copy">
        <h2>{t('storeMe.v2HeroTitle')}</h2>
        <p>{scoreSummary}</p>
        <section className="store-me-v2-target-progress-card" aria-label={t('storeMe.targetProgress')}>
          <div className="store-me-v2-target-progress-head">
            <div>
              <span>{t('storeMe.targetProgress')}</span>
              <strong>{t('storeMe.targetProgressPercent', { value: targetProgressPercent })}</strong>
            </div>
            <em>{targetStatusLabel}</em>
          </div>
          <div className="store-me-v2-target-progress-track" aria-hidden="true">
            <i style={{ '--store-me-v2-fill': `${targetProgressPercent}%` } as CSSProperties} />
          </div>
          <div className="store-me-v2-target-progress-meta">
            <div>
              <span>{t('storeMe.target')}</span>
              <strong>{targetSalesLabel}</strong>
            </div>
            <div>
              <span>{t('storeMe.actual')}</span>
              <strong>{actualSalesLabel}</strong>
            </div>
            <div>
              <span>{t('storeMe.remaining')}</span>
              <strong>{remainingTargetLabel}</strong>
            </div>
          </div>
        </section>
        <div className="store-me-v2-hero-actions">
          <a className="store-me-v2-primary-button" href="#store-me-v2-actions">
            {t('storeMe.todayFocus')}
          </a>
          <button
            className="store-me-v2-secondary-button"
            type="button"
            onClick={onOpenKpiDetails}
          >
            {t('storeMe.kpiDetails')}
          </button>
        </div>
      </div>

      <article className="store-me-v2-compare-card" aria-label={t('storeMe.samePeriodComparison')}>
        <div>
          <span>{t('storeMe.samePeriodComparison')}</span>
          <strong>
            {samePeriodScoreDelta
              ? t('storeMe.samePeriodSummary', { value: samePeriodScoreDelta })
              : t('storeMe.noTrendData')}
          </strong>
        </div>
        <div className="store-me-v2-mini-bars" aria-label={t('storeMe.samePeriodComparison')}>
          {samePeriodMetrics.map((metric) => (
            <div className="store-me-v2-mini-bar" key={metric.code}>
              <b>{metric.label}</b>
              <i style={{ '--store-me-v2-width': metric.width } as CSSProperties} />
              <em>{metric.delta ?? t('storeMe.noData')}</em>
            </div>
          ))}
        </div>
      </article>
    </section>
  )
}

export function StoreMyPerformancePartialAlert({
  isPartial,
  missingMetricLabels,
  pendingNormalizationLabels,
  t,
}: StoreMyPerformancePartialAlertProps) {
  if (!isPartial) {
    return null
  }

  return (
    <section className="store-me-v2-alert" aria-label={t('storeMe.partialTitle')}>
      <strong>{t('storeMe.partialTitle')}</strong>
      <p>
        {t('storeMe.missingMetrics', {
          labels: missingMetricLabels.join(', ') || t('storeMe.noMetricDetail'),
        })}
      </p>
      {pendingNormalizationLabels.length ? (
        <p>
          {t('storeMe.pendingNormalization', {
            labels: pendingNormalizationLabels.join(', '),
          })}
        </p>
      ) : null}
    </section>
  )
}

export function StoreMyPerformanceMetricGrid({
  metricCards,
  storeRankLabel,
  t,
  turkeyRankLabel,
}: StoreMyPerformanceMetricGridProps) {
  return (
    <section id="metrics" className="store-me-v2-metric-grid" aria-label={t('storeMe.kpiDetails')}>
      {metricCards.map((card) => (
        <article className={`store-me-v2-metric-card ${card.tone}`} key={card.code}>
          <div className="store-me-v2-metric-top">
            <span>{card.label}</span>
            <small>{card.statusLabel}</small>
          </div>
          <div className="store-me-v2-metric-value">
            <strong>{card.displayValue}</strong>
            <span>{card.narrative}</span>
          </div>
          <div className="store-me-v2-metric-track" aria-hidden="true">
            <i style={{ '--store-me-v2-fill': `${card.progressPercent}%` } as CSSProperties} />
          </div>
          <div className="store-me-v2-metric-ranks">
            <div>
              <span>{t('storeMe.store')}</span>
              <strong>{storeRankLabel}</strong>
            </div>
            <div>
              <span>{t('storeMe.region')}</span>
              <strong>{t('storeMe.noData')}</strong>
            </div>
            <div>
              <span>{t('storeMe.turkey')}</span>
              <strong>{turkeyRankLabel}</strong>
            </div>
          </div>
          <p>{t('storeMe.metricCardCopy', { metric: card.label })}</p>
        </article>
      ))}
    </section>
  )
}

export function StoreMyPerformanceLowerGrid({
  samePeriodScoreDelta,
  t,
  trendPoints,
}: StoreMyPerformanceLowerGridProps) {
  return (
    <section className="store-me-v2-lower-grid">
      <section className="store-me-v2-panel store-me-v2-timeline" aria-label={t('storeMe.progressLine')}>
        <div className="store-me-v2-section-head">
          <div>
            <h3>{t('storeMe.progressLine')}</h3>
            <p>{t('storeMe.progressLineCopy')}</p>
          </div>
          <span>{samePeriodScoreDelta ?? t('storeMe.noTrendData')}</span>
        </div>
        <div className="store-me-v2-chart-card">
          <div className="store-me-v2-y-axis"><span>100</span><span>75</span><span>50</span><span>25</span></div>
          <div className="store-me-v2-chart-grid" />
          <svg className="store-me-v2-chart-svg" viewBox="0 0 640 210" preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <linearGradient id="storeMeV2Area" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.22" />
                <stop offset="100%" stopColor="#7c3aed" stopOpacity="0" />
              </linearGradient>
            </defs>
            <polygon className="area" points={trendPoints.area} />
            <polyline className="line" points={trendPoints.line} />
          </svg>
          <div className="store-me-v2-chart-legend">
            <span className="current">{t('storeMe.thisPeriod')}</span>
            <span className="previous">{t('storeMe.previousComparablePeriod')}</span>
          </div>
        </div>
      </section>

      <section id="store-me-v2-actions" className="store-me-v2-panel store-me-v2-actions" aria-label={t('storeMe.todayCoaching')}>
        <div className="store-me-v2-section-head">
          <div>
            <h3>{t('storeMe.todayCoaching')}</h3>
            <p>{t('storeMe.todayCoachingCopy')}</p>
          </div>
        </div>

        <div className="store-me-v2-action-list">
          <article className="store-me-v2-action-row focus">
            <div className="store-me-v2-action-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M4 12h16" />
                <path d="M12 4v16" />
              </svg>
            </div>
            <div>
              <strong>{t('storeMe.action.keepRhythm.title')}</strong>
              <span>{t('storeMe.action.keepRhythm.copy')}</span>
            </div>
            <small>{t('storeMe.priorityOne')}</small>
          </article>

          <article className="store-me-v2-action-row growth">
            <div className="store-me-v2-action-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M4 18 10 12l4 4 6-9" />
                <path d="M15 7h5v5" />
              </svg>
            </div>
            <div>
              <strong>{t('storeMe.action.growBasket.title')}</strong>
              <span>{t('storeMe.action.growBasket.copy')}</span>
            </div>
            <small>{t('storeMe.opportunity')}</small>
          </article>

          <article className="store-me-v2-action-row target">
            <div className="store-me-v2-action-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="8" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </div>
            <div>
              <strong>{t('storeMe.action.trackTarget.title')}</strong>
              <span>{t('storeMe.action.trackTarget.copy')}</span>
            </div>
            <small>{t('storeMe.follow')}</small>
          </article>
        </div>
      </section>
    </section>
  )
}

export function StoreMyPerformanceKpiDialog({
  employeeName,
  isOpen,
  monthlyDetailRows,
  onClose,
  t,
}: StoreMyPerformanceKpiDialogProps) {
  if (!isOpen) {
    return null
  }

  return (
    <div
      className="store-me-v2-dialog-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <section
        className="store-me-v2-kpi-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="store-me-v2-kpi-dialog-title"
      >
        <div className="store-me-v2-kpi-dialog-head">
          <div>
            <span>{t('storeMe.kpiDetails')}</span>
            <h3 id="store-me-v2-kpi-dialog-title">
              {t('storeMe.monthlyPerformanceTitle', {
                name: employeeName,
              })}
            </h3>
            <p>{t('storeMe.monthlyPerformanceCopy')}</p>
          </div>
          <button
            className="store-me-v2-dialog-close"
            type="button"
            aria-label={t('storeMe.closeKpiDetails')}
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>
        <div className="store-me-v2-monthly-table" aria-label={t('storeMe.monthlyPerformanceTable')}>
          <div className="store-me-v2-monthly-row header" aria-hidden="true">
            <span>{t('storeMe.month')}</span>
            <span>{t('storeMe.score')}</span>
            <span>{t('storeMe.metric.uptShort')}</span>
            <span>{t('storeMe.metric.atvShort')}</span>
            <span>{t('storeMe.metric.hgShort')}</span>
            <span>{t('storeMe.monthlyTrend')}</span>
          </div>
          {monthlyDetailRows.map((row) => (
            <article className="store-me-v2-monthly-row" key={row.key}>
              <div>
                <strong>{row.label}</strong>
                <small>{row.periodNote}</small>
              </div>
              <b>{row.scoreLabel}</b>
              <b>{row.uptLabel}</b>
              <b>{row.atvLabel}</b>
              <b>{row.targetLabel}</b>
              <div className="store-me-v2-trend-strip">
                <i style={{ '--store-me-v2-width': row.trendWidth } as CSSProperties} />
                <em>{row.trendLabel ?? t('storeMe.noTrendData')}</em>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}

export function StoreMyPerformanceMobileDock({ t }: StoreMyPerformanceRailProps) {
  return (
    <nav className="store-me-v2-mobile-dock" aria-label={t('storeMe.mobileNav')}>
      <NavLink to="/store/home">{t('storeMe.nav.home')}</NavLink>
      <NavLink to="/store/me">{t('storeMe.nav.me')}</NavLink>
      <NavLink to="/store/rankings">{t('storeMe.nav.rankings')}</NavLink>
      <NavLink to="/store/approvals">{t('storeMe.nav.targets')}</NavLink>
    </nav>
  )
}
