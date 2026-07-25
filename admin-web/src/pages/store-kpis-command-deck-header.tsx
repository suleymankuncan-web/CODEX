import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Store, Users } from 'lucide-react'
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
          <p className="tw:mt-1 tw:text-sm tw:text-[var(--store-command-muted)]">{model.t('storeKpis.commandWorkspaceCopy')}</p>
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

      <div role="tablist" aria-label={model.t('storeKpis.commandTabsLabel')} className="tw:inline-grid tw:w-full tw:max-w-[360px] tw:grid-cols-2 tw:rounded-xl tw:border tw:border-[var(--store-command-line)] tw:bg-white tw:p-1">
        <button type="button" role="tab" aria-selected={activeTab === 'store'} className={tabClass(activeTab === 'store')} onClick={() => setActiveTab('store')}>
          <Store className="tw:size-4" />{model.t('storeKpis.commandStoreTab')}
        </button>
        <button type="button" role="tab" aria-selected={activeTab === 'people'} className={tabClass(activeTab === 'people')} onClick={() => setActiveTab('people')}>
          <Users className="tw:size-4" />{model.t('storeKpis.commandPeopleTab')} <span>{personnelCount}</span>
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

function tabClass(active: boolean) {
  return `tw:flex tw:min-h-10 tw:items-center tw:justify-center tw:gap-2 tw:rounded-lg tw:px-3 tw:text-sm tw:font-semibold tw:transition ${active ? 'tw:bg-[var(--store-command-plum-soft)] tw:text-[var(--store-command-plum-deep)]' : 'tw:text-[var(--store-command-muted)] tw:hover:bg-[var(--store-command-surface-soft)]'}`
}
