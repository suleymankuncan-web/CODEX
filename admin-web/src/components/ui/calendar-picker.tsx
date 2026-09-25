import { useState, type ReactNode } from 'react'
import type { DateRange, Matcher } from 'react-day-picker'
import { tr, enUS } from 'react-day-picker/locale'
import { CalendarDays, ChevronDown } from 'lucide-react'
import { Button } from './button'
import { Calendar } from './calendar'
import { Popover, PopoverContent, PopoverHeader, PopoverTitle, PopoverTrigger } from './popover'
import { getBusinessDateInputValue } from '@/lib/business-date'
import { cn } from '@/lib/utils'
import { formatCalendarDate, parseCalendarDate } from './calendar-date'

const monthOnlyComponents = { MonthGrid: () => <></> }

export type CalendarPanelProps = {
  mode: 'single' | 'range' | 'month'
  value: string
  end?: string | undefined
  locale?: 'tr' | 'en' | undefined
  onApply: (value: string, end?: string) => void
  onFullMonth?: ((value: string) => void) | undefined
  onFullYear?: ((year: number) => void) | undefined
  onClear?: (() => void) | undefined
  onMonthPreview?: ((month: Date) => void) | undefined
  monthDescription?: ((month: Date) => ReactNode) | undefined
  disabledDays?: Matcher | Matcher[] | undefined
  minYear?: number | undefined
  maxYear?: number | undefined
  maxRangeDays?: number | undefined
  title?: string | undefined
}

/** Shared approved calendar surface. Feature adapters own URL/data semantics. */
export function CalendarPanel(input: CalendarPanelProps) {
  const locale = input.locale ?? 'tr'
  const today = parseCalendarDate(getBusinessDateInputValue())!
  const initial = parseCalendarDate(input.value) ?? today
  const [month, setMonth] = useState(initial)
  const [day, setDay] = useState<Date | undefined>(parseCalendarDate(input.value))
  const [range, setRange] = useState<DateRange | undefined>(input.end ? { from: initial, to: parseCalendarDate(input.end) } : undefined)
  const copy = locale === 'tr'
    ? { title: 'Dönem seç', hint: 'Başlangıç ve bitiş gününü seçin.', apply: 'Uygula', fullMonth: 'Tüm ay', fullYear: 'Tüm yıl', clear: 'Temizle', month: 'Ay seç', year: 'Yıl seç' }
    : { title: 'Select period', hint: 'Select the first and last day.', apply: 'Apply', fullMonth: 'Full month', fullYear: 'Full year', clear: 'Clear', month: 'Choose month', year: 'Choose year' }
  const label = (date: Date, withDay = true) => new Intl.DateTimeFormat(locale, { ...(withDay ? { day: 'numeric' as const } : {}), month: 'short', year: 'numeric' }).format(date)
  const changeMonth = (next: Date) => { setMonth(next); input.onMonthPreview?.(next) }
  const common = {
    month, onMonthChange: changeMonth, locale: locale === 'tr' ? tr : enUS,
    startMonth: new Date(input.minYear ?? Math.min(initial.getFullYear(), today.getFullYear() - 10), 0),
    endMonth: new Date(input.maxYear ?? Math.max(initial.getFullYear(), today.getFullYear() + 5), 11, 31),
    labels: { labelMonthDropdown: () => copy.month, labelYearDropdown: () => copy.year },
    ...(input.disabledDays ? { disabled: input.disabledDays } : {}),
  }
  const selection = input.mode === 'range'
    ? range?.from ? `${label(range.from)}${range.to ? ` – ${label(range.to)}` : '…'}` : copy.hint
    : input.mode === 'month' ? label(month, false) : day ? label(day) : ''
  return <>
    <PopoverHeader><PopoverTitle>{input.title ?? copy.title}</PopoverTitle></PopoverHeader>
    {input.mode === 'month' ? <Calendar {...common} className="axis-calendar-month" components={monthOnlyComponents}
      formatters={{ formatMonthDropdown: date => new Intl.DateTimeFormat(locale, { month: 'long' }).format(date) }} />
      : input.mode === 'range' ? <Calendar {...common} mode="range" selected={range}
      onSelect={(next, clicked) => setRange(range?.from && !range.to ? next : { from: clicked })}
      {...(input.maxRangeDays ? { max: input.maxRangeDays - 1 } : {})} />
      : <Calendar {...common} mode="single" selected={day}
        onSelect={(next) => { setDay(next); if (next) changeMonth(next) }} />}
    <p className="tw:m-0 tw:text-xs tw:text-muted-foreground" aria-live="polite">{selection}</p>
    {input.monthDescription?.(month)}
    <footer className="tw:flex tw:items-center tw:justify-between tw:gap-3 tw:border-t tw:border-border tw:pt-3">
      {input.onFullMonth ? <Button type="button" variant="outline" size="sm" onClick={() => input.onFullMonth?.(`${formatCalendarDate(month).slice(0, 7)}-01`)}>{copy.fullMonth}</Button>
        : input.onFullYear ? <Button type="button" variant="outline" size="sm" onClick={() => input.onFullYear?.(month.getFullYear())}>{copy.fullYear}</Button>
        : input.onClear ? <Button type="button" variant="ghost" size="sm" onClick={input.onClear}>{copy.clear}</Button> : <span />}
      <Button type="button" size="sm" disabled={input.mode === 'range' ? !range?.from || !range.to : input.mode === 'single' && !day}
        onClick={() => {
          if (input.mode === 'month') input.onApply(formatCalendarDate(month).slice(0, 7))
          else if (input.mode === 'single' && day) input.onApply(formatCalendarDate(day))
          else if (range?.from && range.to) input.onApply(formatCalendarDate(range.from), formatCalendarDate(range.to))
        }}>{copy.apply}</Button>
    </footer>
  </>
}

export function CalendarPopoverContent({ className, ...props }: React.ComponentProps<typeof PopoverContent>) {
  return <PopoverContent align="end" collisionPadding={12} className={cn('axis-calendar tw:z-[200] tw:w-auto tw:max-w-[calc(100vw-24px)] tw:max-h-[var(--radix-popover-content-available-height)] tw:overflow-y-auto tw:p-3', className)} {...props} />
}

export function CalendarPicker(input: Omit<CalendarPanelProps, 'onApply'> & {
  onValueChange: (value: string, end?: string) => void
  ariaLabel?: string | undefined
  triggerClassName?: string | undefined
  contentClassName?: string | undefined
  triggerContent?: ReactNode
  disabled?: boolean | undefined
}) {
  const [open, setOpen] = useState(false)
  const value = parseCalendarDate(input.value)
  const format = (date: Date) => new Intl.DateTimeFormat(input.locale ?? 'tr', {
    ...(input.mode === 'month' ? {} : { day: 'numeric' as const }), month: input.mode === 'month' ? 'long' : 'short', year: 'numeric',
  }).format(date)
  const end = parseCalendarDate(input.end)
  const label = value ? `${format(value)}${end ? ` – ${format(end)}` : ''}` : input.locale === 'en' ? 'Select date' : 'Tarih seç'
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild><Button type="button" variant="outline" disabled={input.disabled} aria-label={input.ariaLabel} className={input.triggerClassName}>
      <CalendarDays data-icon="inline-start" />{input.triggerContent ?? label}<ChevronDown data-icon="inline-end" />
    </Button></PopoverTrigger>
    <CalendarPopoverContent className={input.contentClassName} aria-label={input.title ?? (input.locale === 'en' ? 'Select period' : 'Dönem seç')}>
      <CalendarPanel {...input} onApply={(start, end) => { input.onValueChange(start, end); setOpen(false) }}
        {...(input.onFullMonth ? { onFullMonth: (value: string) => { input.onFullMonth?.(value); setOpen(false) } } : {})}
        {...(input.onFullYear ? { onFullYear: (year: number) => { input.onFullYear?.(year); setOpen(false) } } : {})}
        {...(input.onClear ? { onClear: () => { input.onClear?.(); setOpen(false) } } : {})} />
    </CalendarPopoverContent>
  </Popover>
}
