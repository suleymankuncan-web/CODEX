import type { ReactNode } from 'react'
import { Link } from 'react-router'
import type { StoreKpiHighlightsPageModel } from './store-kpi-highlights-model'

export type StoreKpiCommandTab = 'store' | 'people'

export function StoreKpisCommandDeckHeader(input: {
  activeTab: StoreKpiCommandTab
  controls: ReactNode
  model: StoreKpiHighlightsPageModel
  personnelCount: number
  setActiveTab: (tab: StoreKpiCommandTab) => void
  storeKpiCount: number
}) {
  const { activeTab, controls, model, personnelCount, setActiveTab, storeKpiCount } = input
  const overviewPath = buildOverviewPath(model)
  const scopeLabel = model.isReportViewer
    ? model.t('storeKpis.commandViewerScope')
    : model.isRegionManagerStoreDetail
      ? model.t('storeKpis.commandRegionScope')
      : model.t('storeKpis.commandOwnStoreScope')
  const eyebrow = model.isReportViewer
    ? model.t('storeKpis.commandViewerEyebrow')
    : model.isRegionManagerStoreDetail
      ? model.t('storeKpis.commandRegionEyebrow')
      : model.t('storeKpis.commandManagerEyebrow')

  return (
    <div className="tw:grid tw:gap-4">
      <header className="tw:grid tw:gap-4 tw:lg:grid-cols-[minmax(0,1fr)_auto] tw:lg:items-end">
        <div>
          <div className="tw:flex tw:flex-wrap tw:gap-2">
            <span className="tw:rounded-full tw:bg-[var(--store-command-plum-soft)] tw:px-3 tw:py-1 tw:text-xs tw:font-semibold tw:text-[var(--store-command-plum-deep)]">{scopeLabel}</span>
            <span className="tw:rounded-full tw:bg-[var(--store-command-cyan-soft)] tw:px-3 tw:py-1 tw:text-xs tw:font-semibold tw:text-[var(--store-command-accent-ink)]">{model.t('storeKpis.commandStoreKpiCount', { count: storeKpiCount })}</span>
            <span className="tw:rounded-full tw:bg-[var(--store-command-warning-soft)] tw:px-3 tw:py-1 tw:text-xs tw:font-semibold tw:text-[var(--store-command-warning-ink)]">{model.t('storeKpis.commandPersonnelBadge', { count: personnelCount })}</span>
          </div>
          <p className="tw:mt-3 tw:text-xs tw:font-semibold tw:uppercase tw:tracking-[0.18em] tw:text-[var(--store-command-muted)]">{eyebrow}</p>
          <h1 className="tw:mt-1 tw:text-3xl tw:font-semibold tw:tracking-[-0.04em] tw:text-[var(--store-command-ink)]">
            {model.t('storeKpis.commandWorkspaceTitle', { store: model.activeStoreName })}
          </h1>
        </div>
        <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-2 tw:lg:justify-end">{controls}</div>
      </header>

      <nav aria-label={model.t('storeKpis.commandTrailLabel')} className="tw:flex tw:min-h-11 tw:items-center tw:gap-2 tw:rounded-xl tw:border tw:border-[var(--store-command-line)] tw:bg-white/80 tw:px-4 tw:text-xs tw:text-[var(--store-command-muted)]">
        {overviewPath ? <Link className="tw:font-medium tw:text-[var(--store-command-plum-deep)]" to={overviewPath}>{model.t('storeKpis.commandTrailOverview')}</Link> : <span>{scopeLabel}</span>}
        <span>/</span>
        <strong className="tw:text-[var(--store-command-ink)]">{model.activeStoreName}</strong>
        <span>/</span>
        <span>{activeTab === 'store' ? model.t('storeKpis.commandStoreTab') : model.t('storeKpis.commandPeopleTab')}</span>
      </nav>

      <div
        className="canvas-view-switch kpi-view-switch"
        data-view={activeTab}
        aria-label={model.t('storeKpis.commandTabsLabel')}
      >
        <span className="canvas-view-glider" aria-hidden="true" />
        <button
          type="button"
          className={activeTab === 'store' ? 'is-active' : ''}
          aria-pressed={activeTab === 'store'}
          onClick={() => setActiveTab('store')}
        >
          {model.t('storeKpis.commandStoreTab')}
        </button>
        <button
          type="button"
          className={activeTab === 'people' ? 'is-active' : ''}
          aria-pressed={activeTab === 'people'}
          onClick={() => setActiveTab('people')}
        >
          {model.t('storeKpis.commandPeopleTab')}
        </button>
      </div>
    </div>
  )
}

function buildOverviewPath(model: StoreKpiHighlightsPageModel) {
  if (!model.isReportViewer && !model.isRegionManagerStoreDetail) return null
  const params = new URLSearchParams()
  const periodStart = model.livePeriodStart || model.liveSummary?.period?.periodStart
  if (periodStart) params.set('periodStart', periodStart)
  const query = params.toString()
  return `/store/kpis${query ? `?${query}` : ''}`
}
