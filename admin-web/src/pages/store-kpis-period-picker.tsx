import type { AppLocale } from '../lib/i18n'
import { MonthYearPeriodPicker } from './store-month-year-period-picker'

export function StoreKpisPeriodPicker(input: {
  periodStart: string
  onPeriodStartChange: (periodStart: string) => void
  locale: AppLocale
  availablePeriodStarts?: string[]
  ariaLabel?: string
  triggerClassName?: string
}) {
  return (
    <MonthYearPeriodPicker
      ariaLabel={input.ariaLabel ?? 'D\u00f6nem'}
      availableValues={input.availablePeriodStarts}
      locale={input.locale}
      maxValue={`${getCurrentMonthKey()}-01`}
      onValueChange={input.onPeriodStartChange}
      outputMode="period-start"
      title={'D\u00f6nem se\u00e7'}
      triggerClassName={input.triggerClassName}
      value={input.periodStart}
    />
  )
}

function getCurrentMonthKey() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}
