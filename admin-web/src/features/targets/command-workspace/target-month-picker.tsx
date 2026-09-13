import { useState, type ReactNode } from 'react'
import { CalendarDays } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export function TargetMonthPicker(input: {
  value: string; locale: 'tr' | 'en'; onValueChange: (value: string) => void;
  ariaLabel: string; triggerClassName?: string; allowAll?: boolean;
  onMonthPreview?: (month: Date) => void; monthDescription?: (month: Date) => ReactNode;
}) {
  const [open, setOpen] = useState(false)
  const initialMonth = () => input.value === 'all' ? new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Istanbul' }).slice(0, 7) : input.value
  const [draft, setDraft] = useState(initialMonth)
  const year = Number(draft.slice(0, 4)); const month = Number(draft.slice(5, 7))
  const date = new Date(year, month - 1, 1)
  const months = Array.from({ length: 12 }, (_, i) => new Intl.DateTimeFormat(input.locale, { month: 'long' }).format(new Date(2026, i, 1)))
  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: Math.max(currentYear + 5, year) - Math.min(currentYear - 10, year) + 1 }, (_, i) => Math.min(currentYear - 10, year) + i)
  return <Popover open={open} onOpenChange={next => { if (next) setDraft(initialMonth()); setOpen(next) }}>
    <PopoverTrigger asChild><Button type="button" variant="outline" aria-label={input.ariaLabel} className={input.triggerClassName}><CalendarDays />{input.allowAll && input.value === 'all' ? (input.locale === 'tr' ? 'Tüm Dönemler' : 'All periods') : new Intl.DateTimeFormat(input.locale, { year: 'numeric', month: 'long' }).format(new Date(Number(input.value.slice(0, 4)), Number(input.value.slice(5, 7)) - 1, 1))}</Button></PopoverTrigger>
    <PopoverContent align="end" className="tw:w-72 tw:space-y-3" aria-label={input.allowAll ? (input.locale === 'tr' ? 'Dönem seç' : 'Select period') : 'Hedef dönemi seç'}>
      <strong>{input.locale === 'tr' ? 'Yıl ve ay seçin' : 'Select year and month'}</strong>
      <div className="tw:flex tw:items-center tw:justify-between tw:gap-2">
        <span className="tw:text-sm">{input.locale === 'tr' ? 'Yıl' : 'Year'}</span><Select value={String(year)} onValueChange={value => { setDraft(`${value}-${String(month).padStart(2, '0')}`); input.onMonthPreview?.(new Date(Number(value), month - 1, 1)) }}><SelectTrigger aria-label="Yıl"><SelectValue /></SelectTrigger><SelectContent position="popper" align="end">{years.map(value => <SelectItem key={value} value={String(value)}>{value}</SelectItem>)}</SelectContent></Select>

      </div>
      <div role="group" aria-label={input.locale === 'tr' ? 'Ay' : 'Month'} className="tw:grid tw:grid-cols-3 tw:gap-2">
        {months.map((name, i) => <Button key={name} type="button" variant={month === i + 1 ? 'default' : 'outline'} aria-pressed={month === i + 1} className="tw:h-9 tw:px-1 tw:text-xs" onClick={() => { setDraft(`${year}-${String(i + 1).padStart(2, '0')}`); input.onMonthPreview?.(new Date(year, i, 1)) }}>{name}</Button>)}
      </div>
      {input.monthDescription?.(date)}
      {input.allowAll && <Button variant="outline" className="tw:w-full" onClick={() => { input.onValueChange('all'); setOpen(false) }}>{input.locale === 'tr' ? 'Tüm Dönemler' : 'All periods'}</Button>}
      <Button className="tw:w-full" onClick={() => { input.onValueChange(draft); setOpen(false) }}>{input.locale === 'tr' ? 'Uygula' : 'Apply'}</Button>
    </PopoverContent>
  </Popover>
}
