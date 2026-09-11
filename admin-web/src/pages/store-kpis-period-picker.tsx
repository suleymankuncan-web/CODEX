import { useSearchParams } from 'react-router'
import { CalendarPicker } from '@/components/ui/calendar-picker'
import { getBusinessDateInputValue } from '../lib/business-date'
import type { AppLocale } from '../lib/i18n'

export function StoreKpisPeriodPicker(input: {
  periodType?: 'daily' | 'monthly'
  periodStart: string
  onPeriodStartChange: (periodStart: string) => void
  locale: AppLocale
  availablePeriodStarts?: string[]
  ariaLabel?: string
  triggerClassName?: string
  onRangeChange?: (start: string, end: string) => void
  allowRange?: boolean
}) {
  const [params, setParams] = useSearchParams()
  const today = getBusinessDateInputValue()
  const start = input.periodStart || today
  const end = input.allowRange === false ? '' : params.get('periodEnd') || ''
  const triggerContent = !end && input.periodType !== 'daily'
    ? new Intl.DateTimeFormat(input.locale, { month: 'short', year: 'numeric' }).format(new Date(start.slice(0, 7) + '-01T12:00:00')) : undefined
  return <CalendarPicker mode={input.allowRange === false ? 'month' : 'range'} value={start} end={end}
    locale={input.locale} ariaLabel={input.ariaLabel} triggerClassName={input.triggerClassName} triggerContent={triggerContent}
    maxYear={Math.max(Number(start.slice(0, 4)), Number(today.slice(0, 4)))} maxRangeDays={366}
    onFullMonth={input.onPeriodStartChange}
    onValueChange={(from, to) => {
      if (input.allowRange === false) { input.onPeriodStartChange(from.slice(0, 7) + '-01'); return }
      if (!to) return
      if (input.onRangeChange) input.onRangeChange(from, to)
      else { const next = new URLSearchParams(params); next.set('periodStart', from); next.set('periodEnd', to); next.set('periodType', 'daily'); setParams(next, { replace: true }) }
    }} />
}
