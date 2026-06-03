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
    <div className="tw:grid tw:gap-3 tw:rounded-xl tw:border tw:border-primary/20 tw:bg-primary/5 tw:p-4">
      <div>
        <h3 className="tw:text-sm tw:font-semibold tw:text-foreground">
          {input.t('storeTasks.actionPlansCommandPanelTitle')}
        </h3>
        <p className="tw:mt-1 tw:text-sm tw:text-muted-foreground">
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
