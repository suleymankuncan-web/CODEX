import type { TranslateFunction } from '../localization/dictionary'
import type { StoreActionPlan } from '../store-actions/api'
import { StoreActionPlanCancelControl } from '../store-actions/StoreActionPlanCancelControl'
import { StoreActionPlanCloseControl } from '../store-actions/StoreActionPlanCloseControl'
import { StoreActionPlanStatusControl } from '../store-actions/StoreActionPlanStatusControl'

export function StoreActionPlanCommandPanel(input: {
  plan: StoreActionPlan
  t: TranslateFunction
}) {
  return (
    <div className="tw:grid tw:gap-3">
      <div>
        <h4 className="tw:text-sm tw:font-semibold tw:text-[#071631]">
          {input.t('storeTasks.actionPlansCommandPanelTitle')}
        </h4>
        <p className="tw:mt-1 tw:text-xs tw:leading-5 tw:text-[#62708a]">
          {input.t('storeTasks.actionPlansCommandPanelCopy')}
        </p>
      </div>
      <div className="tw:flex tw:flex-wrap tw:gap-2">
        <StoreActionPlanStatusControl plan={input.plan} t={input.t} />
        <StoreActionPlanCloseControl plan={input.plan} t={input.t} />
        <StoreActionPlanCancelControl plan={input.plan} t={input.t} />
      </div>
    </div>
  )
}
