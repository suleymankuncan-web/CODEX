import { useState } from 'react'
import { CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { Button } from '../../components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '../../components/ui/popover'
import { createChecklistCommandPeriod } from './model'
import { formatChecklistCommandPeriodLabel, parseChecklistCommandPeriod } from './checklist-command-period'

export function ReportViewerPeriodPicker(input: {
  locale: 'tr' | 'en'
  period: string
  onChange: (value: string) => void
}) {
  const [open, setOpen] = useState(false)
  const active = parseChecklistCommandPeriod(input.period)
  const [draft, setDraft] = useState(active)
  const copy = input.locale === 'tr' ? trCopy : enCopy
  const months = Array.from({ length: 12 }, (_, index) => new Intl.DateTimeFormat(
    input.locale === 'tr' ? 'tr-TR' : 'en-US',
    { month: 'long', timeZone: 'UTC' },
  ).format(new Date(Date.UTC(2026, index, 1))))

  const selectDraft = (next: typeof draft) => setDraft(next)
  const close = () => setOpen(false)
  const apply = () => {
    input.onChange(createChecklistCommandPeriod(draft.year, draft.month))
    close()
  }

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (nextOpen) setDraft(active)
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="tw:min-w-[136px] tw:justify-start tw:gap-2 tw:border-primary-foreground/25 tw:bg-primary-foreground/10 tw:text-primary-foreground tw:shadow-none tw:hover:bg-primary-foreground/20 tw:hover:text-primary-foreground"
          aria-label={`${copy.period} ${formatChecklistCommandPeriodLabel(input.period, input.locale)}`}
        >
          <CalendarDays aria-hidden className="tw:size-4" />
          <span className="tw:grid tw:min-w-0 tw:text-left tw:leading-none">
            <small className="tw:text-[8px] tw:font-bold tw:tracking-[0.13em] tw:text-primary-foreground/70">{copy.period}</small>
            <strong className="tw:mt-1 tw:truncate tw:text-[11px] tw:font-semibold">{formatChecklistCommandPeriodLabel(input.period, input.locale)}</strong>
          </span>
          <ChevronDown aria-hidden className="tw:ml-1 tw:size-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="tw:w-[min(340px,calc(100vw-24px))] tw:gap-3 tw:rounded-2xl tw:border tw:border-border tw:bg-popover tw:p-3.5 tw:shadow-xl"
        role="dialog"
        aria-label={copy.dialog}
      >
        <PopoverHeader className="tw:flex-row tw:items-start tw:justify-between tw:gap-3">
          <div>
            <span className="tw:text-[9px] tw:font-bold tw:uppercase tw:tracking-[0.14em] tw:text-primary">{copy.eyebrow}</span>
            <PopoverTitle className="tw:mt-1 tw:text-base tw:font-semibold tw:tracking-tight">{copy.title}</PopoverTitle>
          </div>
          <Button type="button" size="icon-sm" variant="ghost" aria-label={copy.close} onClick={close}>
            <X aria-hidden />
          </Button>
        </PopoverHeader>

        <div className="tw:flex tw:items-center tw:justify-between tw:rounded-xl tw:border tw:border-primary/15 tw:bg-accent/70 tw:p-1.5">
          <Button type="button" size="icon-sm" variant="ghost" aria-label={copy.previousYear} onClick={() => selectDraft({ ...draft, year: draft.year - 1 })}>
            <ChevronLeft aria-hidden />
          </Button>
          <span className="tw:text-center">
            <small className="tw:block tw:text-[8px] tw:font-bold tw:uppercase tw:tracking-[0.14em] tw:text-muted-foreground">{copy.year}</small>
            <strong className="tw:block tw:text-base tw:font-semibold tw:tabular-nums">{draft.year}</strong>
          </span>
          <Button type="button" size="icon-sm" variant="ghost" aria-label={copy.nextYear} onClick={() => selectDraft({ ...draft, year: draft.year + 1 })}>
            <ChevronRight aria-hidden />
          </Button>
        </div>

        <div className="tw:grid tw:grid-cols-3 tw:gap-1.5">
          {months.map((month, index) => {
            const selected = draft.month === index + 1
            return (
              <Button
                type="button"
                key={month}
                size="sm"
                variant={selected ? 'default' : 'outline'}
                className={selected
                  ? 'tw:justify-between tw:px-2.5 tw:text-xs tw:shadow-sm'
                  : 'tw:justify-between tw:border-primary/12 tw:bg-primary/[0.04] tw:px-2.5 tw:text-xs tw:hover:border-primary/25 tw:hover:bg-accent/75'}
                aria-pressed={selected}
                onClick={() => selectDraft({ ...draft, month: index + 1 })}
              >
                {month}
                {selected ? <Check aria-hidden className="tw:size-3.5 tw:text-primary-foreground" /> : null}
              </Button>
            )
          })}
        </div>

        <footer className="tw:flex tw:items-center tw:justify-between tw:gap-3 tw:border-t tw:border-border tw:pt-3">
          <span className="tw:text-[10px] tw:font-medium tw:text-muted-foreground">
            {formatChecklistCommandPeriodLabel(createChecklistCommandPeriod(draft.year, draft.month), input.locale)}
          </span>
          <Button type="button" size="sm" onClick={apply}><Check aria-hidden /> {copy.apply}</Button>
        </footer>
      </PopoverContent>
    </Popover>
  )
}

const trCopy = {
  apply: 'Uygula', close: 'Tarih filtresini kapat', dialog: 'Raporlama dönemi', eyebrow: 'Raporlama dönemi', nextYear: 'Sonraki yıl', period: 'DÖNEM', previousYear: 'Önceki yıl', title: 'Ay ve yıl seçin', year: 'Yıl',
} as const

const enCopy = {
  apply: 'Apply', close: 'Close date filter', dialog: 'Reporting period', eyebrow: 'Reporting period', nextYear: 'Next year', period: 'PERIOD', previousYear: 'Previous year', title: 'Select month and year', year: 'Year',
} as const
