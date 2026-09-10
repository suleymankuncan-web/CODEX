import { CalendarPicker } from '@/components/ui/calendar-picker'
import { formatChecklistCommandPeriodLabel } from './checklist-command-period'

export function ReportViewerPeriodPicker(input: { locale: 'tr' | 'en'; period: string; onChange: (value: string) => void }) {
  const label = formatChecklistCommandPeriodLabel(input.period, input.locale)
  return <CalendarPicker mode="month" value={input.period} locale={input.locale} onValueChange={input.onChange}
    triggerClassName="tw:min-w-[136px] tw:justify-start tw:gap-2 tw:border-primary-foreground/25 tw:bg-primary-foreground/10 tw:text-primary-foreground tw:shadow-none tw:hover:bg-primary-foreground/20 tw:hover:text-primary-foreground"
    ariaLabel={(input.locale === 'tr' ? 'DÖNEM ' : 'PERIOD ') + label}
    triggerContent={<span className="tw:grid tw:min-w-0 tw:text-left tw:leading-none"><small className="tw:text-[8px] tw:font-bold tw:tracking-[0.13em] tw:text-primary-foreground/70">{input.locale === 'tr' ? 'DÖNEM' : 'PERIOD'}</small><strong className="tw:mt-1 tw:truncate tw:text-[11px] tw:font-semibold">{label}</strong></span>} />
}
