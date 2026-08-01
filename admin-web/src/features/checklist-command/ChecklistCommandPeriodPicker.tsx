import { useMemo, useState } from 'react'
import { CalendarDays, Check, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '../../components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '../../components/ui/popover'
import { getBusinessMonthInputValue } from '../../lib/business-date'
import { cn } from '../../lib/utils'
import { formatChecklistCommandPeriodLabel, parseChecklistCommandPeriod } from './checklist-command-period'
import { createChecklistCommandPeriod } from './model'

export function ChecklistCommandPeriodPicker(input: { locale: 'tr' | 'en'; period: string; onChange: (value: string) => void }) {
  const current = parseChecklistCommandPeriod(input.period)
  const [draft, setDraft] = useState(current)
  const [open, setOpen] = useState(false)
  const monthNames = useMemo(
    () => Array.from({ length: 12 }, (_, index) => new Intl.DateTimeFormat(input.locale === 'tr' ? 'tr-TR' : 'en-US', { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2026, index, 1)))),
    [input.locale],
  )
  const businessPeriod = parseChecklistCommandPeriod(getBusinessMonthInputValue())
  const previousPeriod = businessPeriod.month === 1
    ? { year: businessPeriod.year - 1, month: 12 }
    : { year: businessPeriod.year, month: businessPeriod.month - 1 }

  const resetDraft = () => setDraft(current)
  const apply = () => {
    input.onChange(createChecklistCommandPeriod(draft.year, draft.month))
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={(nextOpen) => { setOpen(nextOpen); if (nextOpen) setDraft(current); else resetDraft() }}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="checklist-command-period-trigger tw:min-h-10 tw:gap-2 tw:rounded-lg tw:px-2.5 tw:text-left"
          aria-label={formatChecklistCommandPeriodLabel(input.period, input.locale)}
        >
          <CalendarDays className="tw:size-4 tw:text-primary" aria-hidden="true" />
          <span className="tw:grid tw:gap-0.5">
            <small className="tw:text-[9px] tw:font-semibold tw:uppercase tw:tracking-[0.08em] tw:text-muted-foreground">{input.locale === 'tr' ? 'DÖNEM' : 'PERIOD'}</small>
            <strong className="tw:whitespace-nowrap tw:text-xs tw:text-foreground">{formatChecklistCommandPeriodLabel(input.period, input.locale)}</strong>
          </span>
          <ChevronRight className="tw:size-3 tw:rotate-90 tw:text-muted-foreground" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent role="dialog" aria-label={input.locale === 'tr' ? 'Raporlama dönemi' : 'Reporting period'} align="end" className="tw:w-[min(22rem,calc(100vw-1.5rem))] tw:p-0">
        <PopoverHeader className="tw:border-b tw:border-border tw:px-4 tw:py-3">
          <PopoverTitle className="tw:flex tw:items-center tw:gap-2 tw:text-sm"><CalendarDays className="tw:size-4 tw:text-primary" aria-hidden="true" />{input.locale === 'tr' ? 'Ay ve yıl seçin' : 'Select month and year'}</PopoverTitle>
          <PopoverDescription className="tw:text-xs">{input.locale === 'tr' ? 'Raporlama dönemini seçin.' : 'Choose a reporting period.'}</PopoverDescription>
        </PopoverHeader>
        <div className="tw:grid tw:gap-3 tw:p-3">
          <div className="tw:grid tw:grid-cols-2 tw:gap-1.5" role="group" aria-label={input.locale === 'tr' ? 'Hızlı dönemler' : 'Quick periods'}>
            <Button type="button" variant={draft.year === businessPeriod.year && draft.month === businessPeriod.month ? 'secondary' : 'outline'} size="sm" onClick={() => setDraft(businessPeriod)}>{input.locale === 'tr' ? 'Bu ay' : 'This month'}</Button>
            <Button type="button" variant={draft.year === previousPeriod.year && draft.month === previousPeriod.month ? 'secondary' : 'outline'} size="sm" onClick={() => setDraft(previousPeriod)}>{input.locale === 'tr' ? 'Geçen ay' : 'Last month'}</Button>
          </div>
          <div className="tw:grid tw:grid-cols-[2.5rem_1fr_2.5rem] tw:items-center tw:gap-2 tw:rounded-lg tw:border tw:border-border tw:bg-muted/20 tw:p-1.5">
            <Button type="button" variant="ghost" size="icon" aria-label={input.locale === 'tr' ? 'Önceki yıl' : 'Previous year'} onClick={() => setDraft((value) => ({ ...value, year: value.year - 1 }))}><ChevronLeft className="tw:size-4" /></Button>
            <span className="tw:text-center"><small className="tw:block tw:text-[9px] tw:font-semibold tw:uppercase tw:tracking-[0.1em] tw:text-muted-foreground">{input.locale === 'tr' ? 'YIL' : 'YEAR'}</small><strong className="tw:text-base tw:tabular-nums">{draft.year}</strong></span>
            <Button type="button" variant="ghost" size="icon" aria-label={input.locale === 'tr' ? 'Sonraki yıl' : 'Next year'} onClick={() => setDraft((value) => ({ ...value, year: value.year + 1 }))}><ChevronRight className="tw:size-4" /></Button>
          </div>
          <div className="tw:grid tw:grid-cols-3 tw:gap-1.5" role="group" aria-label={input.locale === 'tr' ? 'Ay seçin' : 'Select month'}>
            {monthNames.map((label, index) => {
              const selected = draft.month === index + 1
              return <Button key={label} type="button" variant={selected ? 'secondary' : 'outline'} size="sm" className={cn('tw:min-h-10 tw:justify-between tw:px-2 tw:text-xs', selected && 'tw:text-primary')} onClick={() => setDraft((value) => ({ ...value, month: index + 1 }))}><span>{label}</span>{selected ? <Check className="tw:size-3.5" aria-hidden="true" /> : null}</Button>
            })}
          </div>
        </div>
        <footer className="tw:flex tw:items-center tw:justify-between tw:gap-2 tw:border-t tw:border-border tw:bg-muted/20 tw:px-3 tw:py-2.5">
          <Button type="button" variant="ghost" size="sm" onClick={resetDraft}>{input.locale === 'tr' ? 'Sıfırla' : 'Reset'}</Button>
          <span className="tw:text-xs tw:font-medium tw:text-muted-foreground">{formatChecklistCommandPeriodLabel(createChecklistCommandPeriod(draft.year, draft.month), input.locale)}</span>
          <Button type="button" size="sm" onClick={apply}><Check className="tw:size-3.5" aria-hidden="true" />{input.locale === 'tr' ? 'Uygula' : 'Apply'}</Button>
        </footer>
      </PopoverContent>
    </Popover>
  )
}
