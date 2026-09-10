import { CalendarPicker } from '@/components/ui/calendar-picker'
import type { AppLocale } from '../../lib/i18n'

export type MonthYearPeriodPickerProps = {
  ariaLabel: string
  locale: AppLocale
  onValueChange: (value: string) => void
  value: string
  availableValues?: string[] | undefined
  maxValue?: string | undefined
  outputMode?: 'month' | 'period-start' | undefined
  popoverClassName?: string | undefined
  title?: string | undefined
  triggerClassName?: string | undefined
}

export function MonthYearPeriodPicker(input: MonthYearPeriodPickerProps) {
  return <CalendarPicker mode="month" value={input.value} locale={input.locale} title={input.title}
    ariaLabel={input.ariaLabel} triggerClassName={input.triggerClassName}
    contentClassName={input.popoverClassName}
    onValueChange={value => input.onValueChange(input.outputMode === 'period-start' ? value + '-01' : value)} />
}
