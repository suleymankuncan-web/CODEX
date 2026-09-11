import { useState, type ComponentProps } from 'react'
import { format } from 'date-fns'
import { tr, enUS } from 'date-fns/locale'
import { CalendarIcon } from 'lucide-react'
import { Button } from './button'
import { CalendarPanel, CalendarPopoverContent } from './calendar-picker'
import { formatCalendarDate, parseCalendarDate } from './calendar-date'
import { Popover, PopoverTrigger } from './popover'

type DatePickerProps = Omit<ComponentProps<typeof Button>, 'children' | 'onChange' | 'value'> & {
  value?: Date
  onValueChange?: (value: Date | undefined) => void
  placeholder?: string
  dateFormat?: string
  locale?: 'tr' | 'en'
}

function DatePicker({ value, onValueChange, placeholder, dateFormat = 'PPP', locale = 'tr', ...props }: DatePickerProps) {
  const [open, setOpen] = useState(false)
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild><Button type="button" variant="outline" {...props}>
      <CalendarIcon data-icon="inline-start" />
      {value ? format(value, dateFormat, { locale: locale === 'tr' ? tr : enUS }) : placeholder ?? (locale === 'tr' ? 'Tarih seç' : 'Select date')}
    </Button></PopoverTrigger>
    <CalendarPopoverContent aria-label={locale === 'tr' ? 'Dönem seç' : 'Select period'}>
      <CalendarPanel mode="single" value={value ? formatCalendarDate(value) : ''} locale={locale}
        onApply={date => { onValueChange?.(parseCalendarDate(date)); setOpen(false) }}
        onClear={() => { onValueChange?.(undefined); setOpen(false) }} />
    </CalendarPopoverContent>
  </Popover>
}
export { DatePicker }
export type { DatePickerProps }
