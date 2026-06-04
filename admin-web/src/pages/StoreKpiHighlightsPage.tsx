import type { AuthSessionSummary } from '../features/auth/api'
import { Link } from 'react-router-dom'
import { getErrorMessage } from '../lib/format'
import { ApiError } from '../lib/api'
import { StoreKpiViewModePanel } from './store-kpi-view-mode-panel'
import {
  type StoreKpiHighlightsPageModel,
  useStoreKpiHighlightsPageModel,
} from './store-kpi-highlights-model'
import {
  StoreKpiChecklistImpactPanel,
  StoreKpiHeroPanel,
  StoreKpiPartialDataPanel,
  StoreKpiScopeSignalGrid,
  StoreKpiScoreMeaningPanel,
  StoreKpiScoreSourcesPanel,
  StoreKpiSummaryGrid,
} from './store-kpi-score-summary'
import {
  StoreKpiOwnershipPanel,
  StoreKpiPriorityPanel,
  StoreKpiScoreBreakdownPanel,
} from './store-kpi-metric-list'
import {
  StoreErrorState,
  StoreEmptyState,
  StoreInfoGrid,
  StoreLoadingState,
  StoreSectionCard,
  StoreSurfaceHeader,
  StoreSurfacePage,
} from './store-surface-primitives'

export function StoreKpiHighlightsPage(input: {
  authSummary: AuthSessionSummary | null
}) {
  const model = useStoreKpiHighlightsPageModel(input)
  const { t } = model

  if (!model.reportingAllowed) {
    return <StoreKpiUnavailableState model={model} />
  }

  if (model.isLoading) {
    return (
      <StoreLoadingState
        title={t('storeKpis.loadingTitle')}
        description={t('storeKpis.loadingCopy')}
      />
    )
  }

  if (model.configQuery.isError && !model.configForbidden) {
    return (
      <StoreSurfacePage ariaLabel={t('storeKpis.configErrorTitle')}>
        <StoreErrorState
          title={t('storeKpis.configErrorTitle')}
          description={getErrorMessage(model.configQuery.error)}
        />
      </StoreSurfacePage>
    )
  }

  if (model.isRegionManagerOverview && model.regionOverviewQuery.isError) {
    return (
      <StoreSurfacePage ariaLabel={t('storeKpis.regionOverviewErrorTitle')}>
        <StoreErrorState
          title={t('storeKpis.regionOverviewErrorTitle')}
          description={getErrorMessage(model.regionOverviewQuery.error)}
        />
      </StoreSurfacePage>
    )
  }

  if (model.isRegionManagerOverview) {
    return <StoreKpiRegionOverviewFoundation model={model} />
  }

  if (model.viewMode === 'live' && model.liveKpiQuery.isError) {
    if (model.liveKpiQuery.error instanceof ApiError && model.liveKpiQuery.error.status === 403) {
      return (
        <StoreSurfacePage ariaLabel={t('storeKpis.liveForbiddenTitle')}>
          <StoreErrorState
            title={t('storeKpis.liveForbiddenTitle')}
            description={t('storeKpis.liveForbiddenCopy')}
          />
        </StoreSurfacePage>
      )
    }

    return (
      <StoreSurfacePage ariaLabel={t('storeKpis.rowsErrorTitle')}>
        <StoreErrorState
          title={t('storeKpis.rowsErrorTitle')}
          description={getErrorMessage(model.liveKpiQuery.error)}
        />
      </StoreSurfacePage>
    )
  }

  if (model.viewMode === 'closed' && model.dailySnapshotQuery.isError) {
    return (
      <StoreSurfacePage ariaLabel={t('storeKpis.snapshotListErrorTitle')}>
        <StoreErrorState
          title={t('storeKpis.snapshotListErrorTitle')}
          description={getErrorMessage(model.dailySnapshotQuery.error)}
        />
      </StoreSurfacePage>
    )
  }

  if (model.viewMode === 'closed' && !model.activeSnapshotRun) {
    return (
      <StoreSurfacePage ariaLabel={t('storeKpis.closedDayMissingTitle')}>
        <StoreErrorState
          title={t('storeKpis.closedDayMissingTitle')}
          description={t('storeKpis.closedDayMissingCopy')}
        />
      </StoreSurfacePage>
    )
  }

  if (model.viewMode === 'closed' && model.closedKpiQuery.isError) {
    return (
      <StoreSurfacePage ariaLabel={t('storeKpis.rowsErrorTitle')}>
        <StoreErrorState
          title={t('storeKpis.rowsErrorTitle')}
          description={getErrorMessage(model.closedKpiQuery.error)}
        />
      </StoreSurfacePage>
    )
  }

  return <StoreKpiHighlightsExperience model={model} />
}

function StoreKpiRegionOverviewFoundation({ model }: { model: StoreKpiHighlightsPageModel }) {
  const { regionOverviewRows, t } = model

  return (
    <StoreSurfacePage
      ariaLabel={t('storeKpis.regionOverviewTitle')}
      testId="store-kpis-region-overview"
    >
      <StoreSurfaceHeader
        eyebrow={t('storeKpis.regionOverviewEyebrow')}
        title={t('storeKpis.regionOverviewTitle')}
        description={t('storeKpis.regionOverviewCopy')}
        badges={[
          {
            label: t('storeKpis.regionOverviewStoreCount', {
              count: regionOverviewRows.length,
            }),
            tone: 'calm',
          },
        ]}
      />

      <StoreSectionCard
        title={t('storeKpis.regionOverviewStoresTitle')}
        description={t('storeKpis.regionOverviewStoresCopy')}
        badge={{
          label: t('storeKpis.regionOverviewFoundationBadge'),
          tone: 'accent',
        }}
      >
        {regionOverviewRows.length > 0 ? (
          <div className="tw:flex tw:flex-col tw:gap-2">
            {regionOverviewRows.map((row) => (
              <div
                key={row.storeId}
                className="tw:grid tw:gap-3 tw:rounded-lg tw:border tw:border-border tw:bg-card/70 tw:p-3 tw:sm:grid-cols-[minmax(0,1fr)_auto_auto] tw:sm:items-center"
              >
                <div className="tw:min-w-0">
                  <strong className="tw:block tw:truncate tw:text-sm tw:font-semibold tw:text-foreground">
                    {row.storeName}
                  </strong>
                  <span className="tw:text-xs tw:text-muted-foreground">
                    {t('storeKpis.regionOverviewScopedStore')}
                  </span>
                </div>
                <StoreInfoGrid
                  className="tw:sm:min-w-44 tw:sm:grid-cols-1 tw:xl:grid-cols-1"
                  items={[
                    {
                      label: t('storeKpis.score'),
                      value:
                        row.scoreValue !== null && row.scoreValue !== undefined
                          ? new Intl.NumberFormat(model.locale, {
                              maximumFractionDigits: 1,
                            }).format(row.scoreValue)
                          : t('storeKpis.noData'),
                    },
                  ]}
                />
                <Link
                  className="tw:inline-flex tw:h-9 tw:items-center tw:justify-center tw:rounded-md tw:bg-primary tw:px-3 tw:text-sm tw:font-medium tw:text-primary-foreground tw:shadow-sm tw:transition-colors hover:tw:bg-primary/90"
                  to={model.getRegionStoreDetailPath(row.storeId)}
                >
                  {t('storeKpis.openStoreKpi')}
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <StoreEmptyState
            title={t('storeKpis.regionOverviewEmptyTitle')}
            description={t('storeKpis.regionOverviewEmptyCopy')}
            titleAsHeading
          />
        )}
      </StoreSectionCard>
    </StoreSurfacePage>
  )
}

function StoreKpiUnavailableState({ model }: { model: StoreKpiHighlightsPageModel }) {
  const { primaryStoreId, storeShellIntent, t } = model

  return (
    <StoreSurfacePage ariaLabel={t('storeKpis.title')}>
      <StoreSurfaceHeader
        eyebrow={t('storeKpis.unavailableEyebrow')}
        title={t('storeKpis.title')}
        description={t('storeKpis.unavailableCopy')}
        badges={[
          { label: `${t('storeKpis.store')}: ${primaryStoreId ?? t('storeKpis.noStoreScope')}`, tone: 'neutral' },
          { label: t('storeKpis.authWaiting'), tone: 'warning' },
        ]}
      />

      {storeShellIntent ? (
        <StoreSectionCard title={t('storeKpis.storeScope')}>
          <StoreInfoGrid
            items={[
              {
                label: t('storeKpis.storeScope'),
                value: primaryStoreId ?? t('storeKpis.noOpenStoreScope'),
              },
              { label: t('storeKpis.readStatus'), value: t('storeKpis.readWaiting'), tone: 'warning' },
            ]}
            className="tw:xl:grid-cols-2"
          />
        </StoreSectionCard>
      ) : null}
    </StoreSurfacePage>
  )
}

function StoreKpiHighlightsExperience({ model }: { model: StoreKpiHighlightsPageModel }) {
  return (
    <StoreSurfacePage ariaLabel={model.t('storeKpis.title')}>
      <StoreKpiHeroPanel model={model} />
      <StoreKpiViewModePanel model={model} />
      <StoreKpiSummaryGrid model={model} />
      <StoreKpiChecklistImpactPanel model={model} />
      <StoreKpiScoreSourcesPanel model={model} />
      <StoreKpiScopeSignalGrid model={model} />
      <StoreKpiPartialDataPanel model={model} />
      <StoreKpiScoreMeaningPanel model={model} />
      <StoreKpiScoreBreakdownPanel model={model} />
      <StoreKpiOwnershipPanel model={model} />
      <StoreKpiPriorityPanel model={model} />
    </StoreSurfacePage>
  )
}
