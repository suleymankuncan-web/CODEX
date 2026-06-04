import type { ReactNode } from 'react'
import { Activity, Store, Users } from 'lucide-react'
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

  return (
    <div className="tw:space-y-5">
      <section className="tw:grid tw:gap-4 tw:lg:grid-cols-[minmax(0,560px)_auto] tw:lg:items-center tw:lg:justify-between">
        <div className="tw:flex tw:items-center tw:gap-5 tw:rounded-[2rem] tw:border tw:border-white/75 tw:bg-[linear-gradient(115deg,rgba(247,246,255,0.98),rgba(239,251,255,0.92))] tw:p-7 tw:shadow-[0_24px_70px_rgba(70,85,120,0.16)]">
          <span className="tw:grid tw:size-16 tw:place-items-center tw:rounded-3xl tw:bg-[linear-gradient(135deg,#6d4df7,#18bfd0)] tw:text-white tw:shadow-sm">
            <Activity className="tw:size-8" />
          </span>
          <strong className="tw:text-4xl tw:font-semibold tw:leading-none tw:text-[#071332]">
            Store KPI
          </strong>
        </div>
        <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-3 tw:lg:justify-end">
          {controls}
        </div>
      </section>

      <section className="tw:overflow-hidden tw:rounded-[2rem] tw:border tw:border-white/75 tw:bg-white/90 tw:shadow-[0_24px_70px_rgba(70,85,120,0.14)]">
        <div className="tw:flex tw:flex-col tw:gap-4 tw:p-5 tw:sm:p-7 tw:lg:flex-row tw:lg:items-start tw:lg:justify-between">
          <div>
            <p className="tw:text-xs tw:font-semibold tw:uppercase tw:tracking-[0.24em] tw:text-[#65708d]">
              {model.t('storeKpis.commandManagerEyebrow')}
            </p>
            <h1 className="tw:mt-2 tw:text-2xl tw:font-semibold tw:leading-tight tw:text-[#071332] tw:sm:text-3xl">
              {model.t('storeKpis.commandWorkspaceTitle', { store: model.activeStoreName })}
            </h1>
            <p className="tw:mt-3 tw:max-w-3xl tw:text-sm tw:font-normal tw:leading-6 tw:text-[#56627e]">
              {model.t('storeKpis.commandWorkspaceCopy')}
            </p>
          </div>
          <div className="tw:flex tw:flex-wrap tw:gap-2">
            <span className="tw:rounded-full tw:bg-[#dcfaff] tw:px-3 tw:py-1 tw:text-xs tw:font-semibold tw:text-[#00879b]">
              {model.t('storeKpis.commandOwnStoreScope')}
            </span>
            <span className="tw:rounded-full tw:bg-[#dcfce7] tw:px-3 tw:py-1 tw:text-xs tw:font-semibold tw:text-[#047857]">
              {model.t('storeKpis.commandStoreKpiCount', { count: storeKpiCount })}
            </span>
            <span className="tw:rounded-full tw:bg-[#fff3df] tw:px-3 tw:py-1 tw:text-xs tw:font-semibold tw:text-[#b45309]">
              {model.t('storeKpis.commandPersonnelBadge', { count: personnelCount })}
            </span>
          </div>
        </div>

        <div className="tw:grid tw:grid-cols-2 tw:border-t tw:border-border/70">
          <button
            type="button"
            className={tabClass(activeTab === 'store')}
            onClick={() => setActiveTab('store')}
          >
            <Store className="tw:size-5" />
            {model.t('storeKpis.commandStoreTab')}
          </button>
          <button
            type="button"
            className={tabClass(activeTab === 'people')}
            onClick={() => setActiveTab('people')}
          >
            <Users className="tw:size-5" />
            {model.t('storeKpis.commandPeopleTab')}
          </button>
        </div>
      </section>
    </div>
  )
}

function tabClass(active: boolean) {
  return `tw:flex tw:h-16 tw:items-center tw:justify-center tw:gap-2 tw:border-b-2 tw:text-sm tw:font-semibold ${active ? 'tw:border-[#6d4df7] tw:bg-[linear-gradient(90deg,rgba(109,77,247,0.12),rgba(24,191,208,0.10))] tw:text-[#6d4df7]' : 'tw:border-transparent tw:bg-[#f7f8fc] tw:text-[#63708f]'}`
}
