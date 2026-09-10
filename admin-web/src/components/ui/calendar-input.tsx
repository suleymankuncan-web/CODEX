import { useRef, useState, type ComponentProps } from 'react'
import type { Matcher } from 'react-day-picker'
import { CalendarDays } from 'lucide-react'
import { Button } from './button'
import { CalendarPanel, CalendarPopoverContent } from './calendar-picker'
import { parseCalendarDate } from './calendar-date'
import { Popover, PopoverAnchor, PopoverTrigger } from './popover'

/** Keep native values, validation, refs and change events; replace only the picker UI. */
export function CalendarInput({ ref, onClick, onKeyDown, ...props }: ComponentProps<'input'>) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [open, setOpen] = useState(false)
  const [locale, setLocale] = useState<'tr' | 'en'>(() => (props.lang ?? (typeof document === 'undefined' ? 'tr' : document.documentElement.lang)).startsWith('en') ? 'en' : 'tr')
  const type = props.type ?? 'date'
  const [currentValue, setCurrentValue] = useState(String(props.value ?? props.defaultValue ?? ''))
  const unavailable = props.disabled || props.readOnly
  const changeOpen = (value: boolean) => {
    if (unavailable) return
    if (value) {
      setCurrentValue(inputRef.current?.value ?? '')
      setLocale((props.lang ?? document.documentElement.lang).startsWith('en') ? 'en' : 'tr')
    }
    setOpen(value)
  }
  const bounds: Matcher[] = []
  const min = parseCalendarDate(String(props.min ?? '').slice(0, 10))
  const max = parseCalendarDate(String(props.max ?? '').slice(0, 10))
  if (min) bounds.push({ before: min })
  if (max) bounds.push({ after: max })
  const changeValue = (value: string) => {
    const element = inputRef.current
    if (!element || unavailable) return
    // Dispatch a real input event so controlled React forms and native FormData agree.
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    setter?.call(element, value)
    element.dispatchEvent(new Event('input', { bubbles: true }))
    setOpen(false)
  }
  return <Popover open={open} onOpenChange={changeOpen}>
    <PopoverAnchor asChild><span className="axis-calendar-input">
      <input {...props} data-calendar-input="true" ref={node => {
        inputRef.current = node
        if (typeof ref === 'function') return ref(node)
        if (ref) ref.current = node
      }} onClick={event => {
        onClick?.(event)
        if (!event.defaultPrevented && !unavailable) { event.preventDefault(); changeOpen(true) }
      }} onKeyDown={event => {
        onKeyDown?.(event)
        if (!event.defaultPrevented && event.altKey && event.key === 'ArrowDown' && !unavailable) { event.preventDefault(); changeOpen(true) }
      }} />
      <PopoverTrigger asChild><Button type="button" variant="ghost" size="icon-sm" disabled={unavailable}
        aria-label={`${props['aria-label'] ?? (locale === 'tr' ? 'Tarih' : 'Date')} — ${locale === 'tr' ? 'takvimi aç' : 'open calendar'}`}><CalendarDays /></Button></PopoverTrigger>
    </span></PopoverAnchor>
    <CalendarPopoverContent aria-label={locale === 'tr' ? 'Dönem seç' : 'Select period'} onCloseAutoFocus={event => { event.preventDefault(); inputRef.current?.focus() }}>
      <CalendarPanel mode={type === 'month' ? 'month' : 'single'} locale={locale} value={currentValue.slice(0, type === 'month' ? 7 : 10)}
        minYear={min?.getFullYear() ?? 1900} maxYear={max?.getFullYear() ?? new Date().getFullYear() + 10}
        disabledDays={bounds} onClear={props.required ? undefined : () => changeValue('')}
        onApply={date => changeValue(type === 'datetime-local' ? `${date}T${currentValue.split('T')[1] || '00:00'}` : date)} />
    </CalendarPopoverContent>
  </Popover>
}
