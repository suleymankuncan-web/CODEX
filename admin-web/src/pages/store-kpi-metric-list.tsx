import { formatDate } from '../lib/format'
import { formatKpiPercent as formatPercent } from '../features/kpi/display'
import {
  StoreEmptyState,
  StoreInfoGrid,
  StoreSectionCard,
  StoreStackedList,
  StoreStackedRow,
  StoreStatusBadge,
} from './store-surface-primitives'
import {
  type StoreKpiHighlightsPageModel,
  describeLocalizedBenchmarkCap,
  formatAchievementValue,
  formatContributionTarget,
  formatKpiMetricLabel,
  formatMetricValue,
  formatOwnerRole,
  formatScoreBehavior,
  formatScoreProfileTitle,
  formatStatusBand,
  formatStorePerformanceGrade,
  resolveLocalizedKpiScoreReference,
  resolveLocalizedKpiSourceSemantics,
} from './store-kpi-highlights-model'

function getContributionStatusTone(item: StoreKpiHighlightsPageModel['weightedScore']['contributions'][number]) {
  if (item.matchingRow?.scoreStatus === 'scored') {
    return 'accent'
  }

  if (
    item.matchingRow?.scoreStatus === 'pending_normalization' ||
    item.matchingRow?.scoreStatus === 'missing_reference'
  ) {
    return 'warning'
  }

  return 'neutral'
}

export function StoreKpiScoreBreakdownPanel({ model }: { model: StoreKpiHighlightsPageModel }) {
  const {
    locale,
    matchedMetricCount,
    personnelWeightsReady,
    storeGrade,
    storeKpiScoreProfile,
    t,
    weightedScore,
  } = model

  return (
    <StoreSectionCard
      title={t('storeKpis.scoreBreakdown')}
      description={t('storeKpis.storeScoreSummary')}
      badge={{
        label:
          weightedScore.missingWeight === 0
            ? t('storeKpis.complete')
            : t('storeKpis.missingWeightStatus', { weight: weightedScore.missingWeight }),
        tone: weightedScore.missingWeight === 0 ? 'calm' : 'warning',
      }}
    >
      <StoreInfoGrid
        items={[
          { label: t('storeKpis.scoreValueLabel'), value: formatPercent(locale, weightedScore.scoreValue) },
          { label: t('storeKpis.scoreBand'), value: formatStorePerformanceGrade(t, storeGrade) },
          { label: t('storeKpis.coveredWeight'), value: `${weightedScore.coveredWeight}%` },
          { label: t('storeKpis.missingWeight'), value: `${weightedScore.missingWeight}%` },
          { label: t('storeKpis.scoreProfile'), value: formatScoreProfileTitle(t, storeKpiScoreProfile?.title) },
          { label: t('storeKpis.settingsSource'), value: t('storeKpis.publishedLiveConfig') },
          {
            label: t('storeKpis.matchedMetric'),
            value: `${matchedMetricCount}/${weightedScore.contributions.length}`,
          },
          {
            label: t('storeKpis.personnelWeight'),
            value: personnelWeightsReady ? t('storeKpis.ready') : t('storeKpis.weightWaiting'),
          },
        ]}
      />
      <StoreStackedList className="tw:mt-4">
        {weightedScore.contributions.map((item) => {
          const sourceSemantics = resolveLocalizedKpiSourceSemantics(t, {
            code: item.matchingRow?.kpiCode ?? item.metric.code,
            actualValue: item.matchingRow?.actualValue ?? null,
            scoreStatus: item.matchingRow?.scoreStatus ?? 'missing',
          })
          const scoreReference = resolveLocalizedKpiScoreReference(t, {
            targetValue: item.matchingRow?.targetValue ?? null,
            benchmarkValue: item.matchingRow?.benchmarkValue ?? null,
            benchmarkSource: item.matchingRow?.benchmarkSource ?? null,
          })

          return (
            <StoreStackedRow key={item.metric.code}>
              <div className="tw:flex tw:flex-col tw:gap-3 tw:sm:flex-row tw:sm:items-start tw:sm:justify-between">
                <div>
                  <strong className="tw:text-sm tw:text-foreground">
                    {formatKpiMetricLabel(t, item.metric.code, item.metric.label)}
                  </strong>
                  <span className="tw:block tw:text-sm tw:text-muted-foreground">
                    {item.matchingRow ? item.matchingRow.kpiCode : t('storeKpis.kpiRowWaiting')}
                  </span>
                </div>
                <StoreStatusBadge tone={getContributionStatusTone(item)}>
                  {`${item.metric.weightPercent}%`}
                </StoreStatusBadge>
              </div>
              <StoreInfoGrid
                className="tw:mt-3"
                items={[
                  {
                    label: t('storeKpis.scoreTarget'),
                    value: formatMetricValue(locale, t, scoreReference.value, item.matchingRow?.kpiCode),
                  },
                  {
                    label: t('storeKpis.actual'),
                    value: formatMetricValue(
                      locale,
                      t,
                      item.matchingRow?.actualValue ?? null,
                      item.matchingRow?.kpiCode,
                    ),
                  },
                  {
                    label: t('storeKpis.achievement'),
                    value: item.matchingRow ? formatAchievementValue(locale, t, item.matchingRow) : t('storeKpis.noData'),
                  },
                  { label: t('storeKpis.targetSource'), value: scoreReference.sourceLabel },
                  {
                    label: t('storeKpis.weightedContribution'),
                    value: formatPercent(locale, item.weightedContribution),
                  },
                  { label: t('storeKpis.scoreBehavior'), value: formatScoreBehavior(t, item.metric.scoreBehavior) },
                  { label: t('storeKpis.sourceType'), value: sourceSemantics.label },
                  { label: t('storeKpis.dataSource'), value: sourceSemantics.summary },
                ]}
              />
              {item.matchingRow?.isCapped ? (
                <p className="tw:mt-3 tw:text-sm tw:leading-6 tw:text-muted-foreground">
                  {describeLocalizedBenchmarkCap(t, {
                    actualRatio: item.matchingRow.actualRatio,
                    scoredRatio: item.matchingRow.scoredRatio,
                    isCapped: item.matchingRow.isCapped,
                  })}
                </p>
              ) : null}
              {item.matchingRow?.scoreStatus === 'missing_reference' ? (
                <p className="tw:mt-3 tw:text-sm tw:leading-6 tw:text-muted-foreground">
                  {t('storeKpis.missingReferenceReason', {
                    reason: item.matchingRow.missingReason ?? 'reference_missing',
                  })}
                </p>
              ) : null}
            </StoreStackedRow>
          )
        })}
      </StoreStackedList>
    </StoreSectionCard>
  )
}

export function StoreKpiOwnershipPanel({ model }: { model: StoreKpiHighlightsPageModel }) {
  const { kpiOwnershipMatrix, t } = model

  return (
    <StoreSectionCard title={t('storeKpis.ownershipTitle')} description={t('storeKpis.ownershipMatrix')}>
      <StoreStackedList>
        {kpiOwnershipMatrix.map((metric) => (
          <StoreStackedRow key={metric.code}>
            <div className="tw:flex tw:flex-col tw:gap-3 tw:sm:flex-row tw:sm:items-start tw:sm:justify-between">
              <div>
                <strong className="tw:text-sm tw:text-foreground">
                  {formatKpiMetricLabel(t, metric.code, metric.label)}
                </strong>
                <span className="tw:block tw:text-sm tw:text-muted-foreground">{metric.code}</span>
              </div>
              <StoreStatusBadge tone={metric.taskCandidate ? 'warning' : 'neutral'}>
                {metric.taskCandidate ? t('storeKpis.taskCandidate') : t('storeKpis.watchFirst')}
              </StoreStatusBadge>
            </div>
            <StoreInfoGrid
              className="tw:mt-3"
              items={[
                { label: t('storeKpis.operationalOwner'), value: formatOwnerRole(t, metric.operationalOwner) },
                {
                  label: t('storeKpis.visibleRoles'),
                  value: metric.visibleTo.map((role) => formatOwnerRole(t, role)).join(', '),
                },
                {
                  label: t('storeKpis.contributionArea'),
                  value: metric.contributesTo.map((item) => formatContributionTarget(t, item)).join(', '),
                },
              ]}
            />
          </StoreStackedRow>
        ))}
      </StoreStackedList>
    </StoreSectionCard>
  )
}

export function StoreKpiPriorityPanel({ model }: { model: StoreKpiHighlightsPageModel }) {
  const { locale, needsAttention, t } = model

  return (
    <StoreSectionCard title={t('storeKpis.priorityTitle')} description={t('storeKpis.priorityEyebrow')}>
      {needsAttention.length === 0 ? (
        <StoreEmptyState title={t('storeKpis.noRiskTitle')} description={t('storeKpis.noRiskCopy')} />
      ) : (
        <StoreStackedList>
          {needsAttention.map((row) => {
            const sourceSemantics = resolveLocalizedKpiSourceSemantics(t, {
              code: row.kpiCode,
              actualValue: row.actualValue,
              scoreStatus: row.scoreStatus,
            })

            return (
              <StoreStackedRow key={`${row.storeId}:${row.kpiCode}`}>
                <div className="tw:flex tw:flex-col tw:gap-3 tw:sm:flex-row tw:sm:items-start tw:sm:justify-between">
                  <div>
                    <strong className="tw:text-sm tw:text-foreground">
                      {formatKpiMetricLabel(t, row.kpiCode, row.kpiName)}
                    </strong>
                    <span className="tw:block tw:text-sm tw:text-muted-foreground">{row.kpiCode}</span>
                  </div>
                  <StoreStatusBadge tone={row.statusBand === 'off_track' ? 'danger' : 'warning'}>
                    {formatStatusBand(t, row.statusBand)}
                  </StoreStatusBadge>
                </div>
                <StoreInfoGrid
                  className="tw:mt-3"
                  items={[
                    {
                      label: t('storeKpis.scoreTarget'),
                      value: formatMetricValue(locale, t, row.targetValue, row.kpiCode),
                    },
                    { label: t('storeKpis.actual'), value: formatMetricValue(locale, t, row.actualValue, row.kpiCode) },
                    { label: t('storeKpis.achievement'), value: formatAchievementValue(locale, t, row) },
                    {
                      label: t('storeKpis.period'),
                      value: `${formatDate(row.periodStart, locale)} - ${formatDate(row.periodEnd, locale)}`,
                    },
                    { label: t('storeKpis.sourceType'), value: sourceSemantics.label },
                    { label: t('storeKpis.dataSource'), value: sourceSemantics.summary },
                  ]}
                />
              </StoreStackedRow>
            )
          })}
        </StoreStackedList>
      )}
    </StoreSectionCard>
  )
}
