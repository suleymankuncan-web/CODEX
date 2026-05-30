import { ShieldAlert, Target, TrendingUp } from 'lucide-react'
import { formatDate } from '../lib/format'
import { formatKpiNumber as formatMetric, formatKpiPercent as formatPercent } from '../features/kpi/display'
import {
  StoreEmptyState,
  StoreInfoGrid,
  StoreMetricCard,
  StoreMetricGrid,
  StoreSectionCard,
  StoreStackedList,
  StoreStackedRow,
  StoreStatusBadge,
  StoreSurfaceHeader,
} from './store-surface-primitives'
import {
  type StoreKpiHighlightsPageModel,
  formatAchievementValue,
  formatKpiMetricLabel,
  formatMetricLabelList,
  formatStorePerformanceGrade,
} from './store-kpi-highlights-model'

export function StoreKpiHeroPanel({ model }: { model: StoreKpiHighlightsPageModel }) {
  const { activeSnapshotRun, activeStoreName, averageAchievement, liveSummary, locale, rows, storeGrade, t, viewMode } = model

  return (
    <StoreSurfaceHeader
      eyebrow={t('storeKpis.heroEyebrow')}
      title={t('storeKpis.title')}
      description={t('storeKpis.heroCopy')}
      badges={[
        { label: viewMode === 'live' ? t('storeKpis.livePeriod') : t('storeKpis.closedDay'), tone: 'accent' },
        { label: `${t('storeKpis.store')}: ${activeStoreName}`, tone: 'neutral' },
        {
          label:
            viewMode === 'live'
              ? liveSummary?.period
                ? `${formatDate(liveSummary.period.periodStart, locale)} - ${formatDate(liveSummary.period.periodEnd, locale)}`
                : t('storeKpis.noLivePeriod')
              : activeSnapshotRun?.snapshotDate ?? t('storeKpis.noRecord'),
          tone: 'neutral',
        },
        { label: `${t('storeKpis.scoreBand')}: ${storeGrade.emoji} ${storeGrade.code}`, tone: storeGrade.tone },
        {
          label:
            rows.length > 0
              ? viewMode === 'live'
                ? t('storeKpis.scorePoints', { value: formatMetric(locale, averageAchievement) })
                : formatPercent(locale, averageAchievement)
              : t('storeKpis.noScorableRows'),
          tone: rows.length > 0 ? 'calm' : 'warning',
        },
      ]}
    />
  )
}

export function StoreKpiSummaryGrid({ model }: { model: StoreKpiHighlightsPageModel }) {
  const { matchedMetricCount, needsAttention, rows, storeGrade, t, totals, weightedScore } = model
  const storeScoreNote = `${formatStorePerformanceGrade(t, storeGrade)} \u00B7 ${t('storeKpis.covered', { weight: weightedScore.coveredWeight })}`

  return (
    <StoreMetricGrid>
      <StoreMetricCard title={t('storeKpis.kpiRows')} value={rows.length} note={t('storeKpis.kpiRowsNote')} icon={<Target data-icon="inline-start" />} tone="accent" />
      <StoreMetricCard
        title={t('storeKpis.scored')}
        value={matchedMetricCount}
        note={t('storeKpis.pendingNormalizationCount', { count: totals.pendingNormalization })}
        icon={<TrendingUp data-icon="inline-start" />}
        tone={totals.pendingNormalization === 0 ? 'calm' : 'warning'}
      />
      <StoreMetricCard
        title={t('storeKpis.watchKpi')}
        value={needsAttention.length}
        note={t('storeKpis.riskNote', { atRisk: totals.atRisk, offTrack: totals.offTrack })}
        icon={<ShieldAlert data-icon="inline-start" />}
        tone={needsAttention.length === 0 ? 'neutral' : 'warning'}
      />
      <StoreMetricCard
        title={t('storeKpis.storeScore')}
        value={Number((weightedScore.scoreValue * 100).toFixed(1))}
        note={storeScoreNote}
        icon={<TrendingUp data-icon="inline-start" />}
        tone={storeGrade.tone}
      />
    </StoreMetricGrid>
  )
}

export function StoreKpiChecklistImpactPanel({ model }: { model: StoreKpiHighlightsPageModel }) {
  const {
    bmChecklistContributionLabel,
    bmChecklistMissingNote,
    bmChecklistStatusLabel,
    closedScoreBreakdown,
    locale,
    t,
    viewMode,
    vmChecklistContributionLabel,
    vmChecklistMissingNote,
    vmChecklistStatusLabel,
    weightedScore,
  } = model

  return (
    <StoreSectionCard
      title={t('storeKpis.checklistImpact')}
      description={t('storeKpis.monthlyBreakdownEyebrow')}
      badge={{
        label: viewMode === 'closed' ? t('storeKpis.finalRecord') : t('storeKpis.livePreview'),
        tone: viewMode === 'closed' ? 'calm' : 'neutral',
      }}
    >
      <StoreInfoGrid
        items={[
          {
            label: t('storeKpis.kpiContribution'),
            value:
              closedScoreBreakdown?.components.kpi.contribution !== null &&
              closedScoreBreakdown?.components.kpi.contribution !== undefined
                ? formatMetric(locale, closedScoreBreakdown.components.kpi.contribution)
                : t('storeKpis.scorePoints', {
                    value: formatMetric(locale, weightedScore.scoreValue * 100),
                  }),
          },
          { label: t('storeKpis.bmChecklistStatus'), value: bmChecklistStatusLabel },
          { label: t('storeKpis.bmContribution'), value: bmChecklistContributionLabel },
          { label: t('storeKpis.vmChecklistStatus'), value: vmChecklistStatusLabel },
          { label: t('storeKpis.vmContribution'), value: vmChecklistContributionLabel },
          {
            label: t('storeKpis.configuredBlend'),
            value: closedScoreBreakdown
              ? t('storeKpis.configuredBlendValue', {
                  kpi: closedScoreBreakdown.configuredWeights.kpiPerformanceWeight,
                  bm: closedScoreBreakdown.configuredWeights.bmChecklistWeight,
                  vm: closedScoreBreakdown.configuredWeights.vmChecklistWeight,
                })
              : t('storeKpis.defaultPlanBlend'),
          },
          {
            label: t('storeKpis.effectiveBlend'),
            value: closedScoreBreakdown
              ? t('storeKpis.effectiveBlendValue', {
                  kpi: closedScoreBreakdown.effectiveWeights.kpiPerformanceWeight,
                  bm: closedScoreBreakdown.effectiveWeights.bmChecklistWeight,
                  vm: closedScoreBreakdown.effectiveWeights.vmChecklistWeight,
                })
              : t('storeKpis.livePreview'),
          },
        ]}
      />
      <p className="tw:mt-3 tw:text-sm tw:leading-6 tw:text-muted-foreground">{t('storeKpis.checklistImpactCopy')}</p>
      {bmChecklistMissingNote ? <p className="tw:text-sm tw:text-muted-foreground">{bmChecklistMissingNote}</p> : null}
      {vmChecklistMissingNote ? <p className="tw:text-sm tw:text-muted-foreground">{vmChecklistMissingNote}</p> : null}
    </StoreSectionCard>
  )
}

export function StoreKpiScoreSourcesPanel({ model }: { model: StoreKpiHighlightsPageModel }) {
  const { t } = model

  return (
    <StoreSectionCard
      title={t('storeKpis.storeScoreSources')}
      description={t('storeKpis.scoreSourcesCopy')}
      badge={{ label: t('storeKpis.officialRule'), tone: 'accent' }}
    >
      <StoreInfoGrid
        items={[
          { label: t('storeKpis.kpiSources'), value: t('storeKpis.kpiSourcesValue') },
          { label: t('storeKpis.checklistShare'), value: t('storeKpis.checklistShareValue') },
          { label: t('storeKpis.capLanguage'), value: t('storeKpis.capLanguageValue') },
          { label: t('storeKpis.turkeyAverage'), value: t('storeKpis.turkeyAverageValue') },
        ]}
      />
    </StoreSectionCard>
  )
}

export function StoreKpiScopeSignalGrid({ model }: { model: StoreKpiHighlightsPageModel }) {
  const { activeStoreName, locale, needsAttention, primaryStoreId, t, topPerformer, viewMode } = model

  return (
    <section className="tw:grid tw:gap-4 tw:lg:grid-cols-2">
      <StoreSectionCard title={t('storeKpis.activeScopeTitle')} description={t('storeKpis.activeScopeEyebrow')}>
        <StoreInfoGrid
          items={[
            { label: t('storeKpis.storeScope'), value: primaryStoreId ?? t('storeKpis.noOpenStoreScope') },
            { label: t('storeKpis.storeName'), value: activeStoreName },
            {
              label: t('storeKpis.dataView'),
              value: viewMode === 'live' ? t('storeKpis.liveImportedMonthlyData') : t('storeKpis.dailyClosedRecord'),
            },
            { label: t('storeKpis.readScope'), value: t('storeKpis.readScopeValue') },
          ]}
        />
      </StoreSectionCard>

      <StoreSectionCard
        title={t('storeKpis.topSignalTitle')}
        description={t('storeKpis.topSignalEyebrow')}
        badge={{
          label: needsAttention.length === 0 ? t('storeKpis.balanced') : t('storeKpis.watch'),
          tone: needsAttention.length === 0 ? 'calm' : 'warning',
        }}
      >
        {topPerformer ? (
          <StoreStackedList>
            <StoreStackedRow>
              <div className="tw:flex tw:flex-col tw:gap-3 tw:sm:flex-row tw:sm:items-start tw:sm:justify-between">
                <div>
                  <strong className="tw:text-sm tw:text-foreground">{formatKpiMetricLabel(t, topPerformer.kpiCode, topPerformer.kpiName)}</strong>
                  <span className="tw:block tw:text-sm tw:text-muted-foreground">{topPerformer.kpiCode}</span>
                </div>
                <StoreStatusBadge tone="accent">{formatAchievementValue(locale, t, topPerformer)}</StoreStatusBadge>
              </div>
              <p className="tw:mt-2 tw:text-sm tw:leading-6 tw:text-muted-foreground">{t('storeKpis.topSignalCopy')}</p>
            </StoreStackedRow>
          </StoreStackedList>
        ) : (
          <StoreEmptyState title={t('storeKpis.noTopSignalTitle')} description={t('storeKpis.noTopSignalCopy')} />
        )}
      </StoreSectionCard>
    </section>
  )
}

export function StoreKpiPartialDataPanel({ model }: { model: StoreKpiHighlightsPageModel }) {
  const { liveSummary, t, viewMode } = model

  if (viewMode !== 'live' || !liveSummary?.partial.isPartial) {
    return null
  }

  return (
    <StoreSectionCard
      title={t('storeKpis.partialTitle')}
      description={t('storeKpis.partialEyebrow')}
      badge={{ label: t('storeKpis.partialData'), tone: 'warning' }}
    >
      <StoreInfoGrid
        items={[
          {
            label: t('storeKpis.missingMetrics'),
            value:
              liveSummary.partial.missingMetricLabels.length > 0
                ? formatMetricLabelList(
                    t,
                    liveSummary.partial.missingMetricCodes,
                    liveSummary.partial.missingMetricLabels,
                  )
                : t('storeKpis.none'),
          },
          {
            label: t('storeKpis.pendingNormalization'),
            value:
              liveSummary.partial.pendingNormalizationLabels.length > 0
                ? formatMetricLabelList(
                    t,
                    liveSummary.partial.pendingNormalizationCodes,
                    liveSummary.partial.pendingNormalizationLabels,
                  )
                : t('storeKpis.none'),
          },
          { label: t('storeKpis.note'), value: t('storeKpis.partialNote') },
        ]}
      />
    </StoreSectionCard>
  )
}

export function StoreKpiScoreMeaningPanel({ model }: { model: StoreKpiHighlightsPageModel }) {
  const { locale, storeGrade, storeScoreMeaning, t, weightedScore } = model

  return (
    <StoreSectionCard
      title={t('storeKpis.scoreMeaningEyebrow')}
      description={`${storeScoreMeaning.title}. ${storeScoreMeaning.summary}`}
      badge={{ label: storeGrade.code, tone: storeScoreMeaning.tone }}
    >
      <StoreInfoGrid
        items={[
          { label: t('storeKpis.scoreBand'), value: formatStorePerformanceGrade(t, storeGrade) },
          { label: t('storeKpis.score'), value: formatPercent(locale, weightedScore.scoreValue) },
          { label: t('storeKpis.coveredWeight'), value: `${weightedScore.coveredWeight}%` },
          { label: t('storeKpis.actionLanguage'), value: storeScoreMeaning.action },
        ]}
      />
      <p className="tw:mt-3 tw:text-sm tw:leading-6 tw:text-muted-foreground">{storeScoreMeaning.confidence}</p>
    </StoreSectionCard>
  )
}
