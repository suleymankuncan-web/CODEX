import type { AuthSessionSummary } from '../features/auth/api'
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
