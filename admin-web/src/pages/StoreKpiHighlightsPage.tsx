import type { AuthSessionSummary } from '../features/auth/api'
import { getUserFacingErrorMessage } from '../lib/format'
import { ApiError } from '../lib/api'
import {
  type StoreKpiHighlightsPageModel,
  useStoreKpiHighlightsPageModel,
} from './store-kpi-highlights-model'
import { StoreKpisStoreDetail } from './store-kpis-store-detail'
import { StoreKpisCompanyOverview } from './store-kpis-company-overview'
import { StoreKpisRegionOverview } from './store-kpis-region-overview'
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

  if (model.isReportViewerStoreDetail && model.companyStoreQuery.isError && !model.companyStoreQuery.data) {
    return (
      <StoreSurfacePage ariaLabel={t('storeKpis.companyStoresErrorTitle')}>
        <StoreErrorState
          title={t('storeKpis.companyStoresErrorTitle')}
          action={{ label: t('storeKpis.retry'), onClick: () => void model.companyStoreQuery.refetch() }}
          description={getUserFacingErrorMessage(
            model.companyStoreQuery.error,
            'Mağaza listesi alınamadı. Daha sonra tekrar deneyin.',
          )}
        />
      </StoreSurfacePage>
    )
  }

  if (model.isReportViewerStoreDetail && model.companyStoreQuery.isSuccess && model.storeOptions.length === 0) {
    return (
      <StoreSurfacePage ariaLabel={t('storeKpis.companyStoresEmptyTitle')}>
        <StoreErrorState
          title={t('storeKpis.companyStoresEmptyTitle')}
          description={t('storeKpis.companyStoresEmptyCopy')}
        />
      </StoreSurfacePage>
    )
  }

  if (model.configQuery.isError && !model.configQuery.data && !model.configForbidden) {
    return (
      <StoreSurfacePage ariaLabel={t('storeKpis.configErrorTitle')}>
        <StoreErrorState
          title={t('storeKpis.configErrorTitle')}
          action={{ label: t('storeKpis.retry'), onClick: () => void model.configQuery.refetch() }}
          description={getUserFacingErrorMessage(
            model.configQuery.error,
            'KPI ayarları alınamadı. Dönemi kontrol edip tekrar deneyin.',
          )}
        />
      </StoreSurfacePage>
    )
  }

  if (model.isReportViewerOverview && model.reportViewerOverviewQuery.isError && !model.reportViewerOverviewQuery.data) {
    return (
      <StoreSurfacePage ariaLabel={t('storeKpis.companyStoresErrorTitle')}>
        <StoreErrorState
          title={t('storeKpis.companyStoresErrorTitle')}
          action={{ label: t('storeKpis.retry'), onClick: () => void model.reportViewerOverviewQuery.refetch() }}
          description={getUserFacingErrorMessage(
            model.reportViewerOverviewQuery.error,
            'Şirket KPI görünümü alınamadı. Dönemi kontrol edip tekrar deneyin.',
          )}
        />
      </StoreSurfacePage>
    )
  }

  if (model.isReportViewerOverview) {
    return <StoreKpisCompanyOverview model={model} />
  }

  if (model.isRegionManagerOverview && model.regionOverviewQuery.isError && !model.regionOverviewQuery.data) {
    return (
      <StoreSurfacePage ariaLabel={t('storeKpis.regionOverviewErrorTitle')}>
        <StoreErrorState
          title={t('storeKpis.regionOverviewErrorTitle')}
          action={{ label: t('storeKpis.retry'), onClick: () => void model.regionOverviewQuery.refetch() }}
          description={getUserFacingErrorMessage(
            model.regionOverviewQuery.error,
            'Bölge KPI özeti alınamadı. Dönemi kontrol edip tekrar deneyin.',
          )}
        />
      </StoreSurfacePage>
    )
  }

  if (model.isRegionManagerOverview) {
    return <StoreKpisRegionOverview model={model} />
  }

  if (model.viewMode === 'live' && model.liveKpiQuery.isError && !model.liveKpiQuery.data) {
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
          action={{ label: t('storeKpis.retry'), onClick: () => void model.liveKpiQuery.refetch() }}
          description={getUserFacingErrorMessage(
            model.liveKpiQuery.error,
            'KPI verisi alınamadı. Dönemi kontrol edip tekrar deneyin.',
          )}
        />
      </StoreSurfacePage>
    )
  }

  if (model.viewMode === 'closed' && model.dailySnapshotQuery.isError && !model.dailySnapshotQuery.data) {
    return (
      <StoreSurfacePage ariaLabel={t('storeKpis.snapshotListErrorTitle')}>
        <StoreErrorState
          title={t('storeKpis.snapshotListErrorTitle')}
          action={{ label: t('storeKpis.retry'), onClick: () => void model.dailySnapshotQuery.refetch() }}
          description={getUserFacingErrorMessage(
            model.dailySnapshotQuery.error,
            'Kapanmış dönem listesi alınamadı. Dönemi kontrol edip tekrar deneyin.',
          )}
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

  if (model.viewMode === 'closed' && model.closedKpiQuery.isError && !model.closedKpiQuery.data) {
    return (
      <StoreSurfacePage ariaLabel={t('storeKpis.rowsErrorTitle')}>
        <StoreErrorState
          title={t('storeKpis.rowsErrorTitle')}
          action={{ label: t('storeKpis.retry'), onClick: () => void model.closedKpiQuery.refetch() }}
          description={getUserFacingErrorMessage(
            model.closedKpiQuery.error,
            'Kapanmış dönem KPI verisi alınamadı. Dönemi kontrol edip tekrar deneyin.',
          )}
        />
      </StoreSurfacePage>
    )
  }

  return <StoreKpisStoreDetail model={model} />
}

function StoreKpiUnavailableState({ model }: { model: StoreKpiHighlightsPageModel }) {
  const { primaryStoreId, storeShellIntent, t } = model
  const storeScopeLabel = primaryStoreId ? t('storeKpis.storeScopeCount', { count: 1 }) : t('storeKpis.noStoreScope')

  return (
    <StoreSurfacePage ariaLabel={t('storeKpis.title')}>
      <StoreSurfaceHeader
        eyebrow={t('storeKpis.unavailableEyebrow')}
        title={t('storeKpis.title')}
        description={t('storeKpis.unavailableCopy')}
        badges={[
          { label: `${t('storeKpis.store')}: ${storeScopeLabel}`, tone: 'neutral' },
          { label: t('storeKpis.authWaiting'), tone: 'warning' },
        ]}
      />

      {storeShellIntent ? (
        <StoreSectionCard title={t('storeKpis.storeScope')}>
          <StoreInfoGrid
            items={[
              {
                label: t('storeKpis.storeScope'),
                value: storeScopeLabel,
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
