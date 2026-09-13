import { CalendarPicker } from '@/components/ui/calendar-picker'

export function PeriodPicker(input: { period: string; onChange: (period: string) => void; triggerClassName?: string }) {
  return <CalendarPicker mode="month" value={input.period} onValueChange={input.onChange} triggerClassName={input.triggerClassName} ariaLabel="Prim dönemi" />
}
