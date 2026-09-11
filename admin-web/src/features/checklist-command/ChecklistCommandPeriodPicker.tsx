import { CalendarPicker } from '@/components/ui/calendar-picker'
import { formatChecklistCommandPeriodLabel } from './checklist-command-period'

export function ChecklistCommandPeriodPicker(input: { locale: 'tr' | 'en'; period: string; onChange: (value: string) => void }) {
  const label = formatChecklistCommandPeriodLabel(input.period, input.locale)
  return <CalendarPicker mode="month" value={input.period} locale={input.locale} onValueChange={input.onChange}
    triggerClassName="checklist-command-period-trigger"
    ariaLabel={(input.locale === 'tr' ? 'Dönem: ' : 'Period: ') + label}
    triggerContent={<span><small>{input.locale === 'tr' ? 'DÖNEM' : 'PERIOD'}</small><strong>{label}</strong></span>} />
}
