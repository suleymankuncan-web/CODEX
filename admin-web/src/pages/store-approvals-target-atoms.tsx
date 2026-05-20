import type { TargetDistributionAllocation } from '../features/targets/api'
import type { AppLocale } from '../lib/i18n'
import { formatAllocationShare, formatTargetNumber } from './store-approvals-model'

export function TargetAllocationBreakdown(input: {
  allocations: TargetDistributionAllocation[]
  locale: AppLocale
  totalTargetValue: number
}) {
  if (!input.allocations.length) {
    return null
  }

  return (
    <div className="store-target-allocation-breakdown">
      {input.allocations.map((allocation) => {
        const targetValue = Number(allocation.targetValue || 0)

        return (
          <div
            className="store-target-allocation-breakdown-row"
            key={`${allocation.employeeId}-${allocation.assigneeLabel}`}
          >
            <strong>{allocation.assigneeLabel}</strong>
            <span>{formatTargetNumber(targetValue, input.locale)}</span>
            <span>{formatAllocationShare(targetValue, input.totalTargetValue, input.locale)}</span>
            {allocation.note ? <small>{allocation.note}</small> : null}
          </div>
        )
      })}
    </div>
  )
}
