import type { AppLocale } from '../lib/i18n'
import { getCurrentMonthInput } from './store-targets-page-model'
import { MonthYearPeriodPicker } from './store-month-year-period-picker'

export function StoreTargetsPeriodPicker(input: {
  period: string
  onPeriodChange: (period: string) => void
  locale: AppLocale
  maxPeriod?: string
  triggerClassName?: string
}) {
  return (
    <MonthYearPeriodPicker
      ariaLabel={'D\u00f6nem'}
      locale={input.locale}
      maxValue={input.maxPeriod ?? getCurrentMonthInput()}
      onValueChange={input.onPeriodChange}
      outputMode="month"
      title={'D\u00f6nem se\u00e7'}
      triggerClassName={input.triggerClassName}
      value={input.period}
    />
  )
}
