import { useEffect, useRef, useState } from 'react'
import { CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { getBusinessMonthInputValue } from '../../lib/business-date'
import { cn } from '../../lib/utils'
import { createChecklistCommandPeriod } from './model'
import { formatChecklistCommandPeriodLabel, parseChecklistCommandPeriod } from './checklist-command-period'

export function ChecklistCommandPeriodPicker(input: { locale: 'tr' | 'en'; period: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false)
  const { year: periodYear, month: periodMonth } = parseChecklistCommandPeriod(input.period)
  const [draft, setDraft] = useState({ year: periodYear, month: periodMonth })
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const monthNames = Array.from({ length: 12 }, (_, index) => new Intl.DateTimeFormat(input.locale === 'tr' ? 'tr-TR' : 'en-US', { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2026, index, 1))))
  const currentPeriod = parseChecklistCommandPeriod(getBusinessMonthInputValue())
  const previousPeriod = currentPeriod.month === 1 ? { year: currentPeriod.year - 1, month: 12 } : { year: currentPeriod.year, month: currentPeriod.month - 1 }

  useEffect(() => {
    if (!open) return
    const close = (restoreFocus: boolean) => {
      setDraft({ year: periodYear, month: periodMonth })
      setOpen(false)
      if (restoreFocus) window.requestAnimationFrame(() => triggerRef.current?.focus())
    }
    const handlePointerDown = (event: PointerEvent) => { if (!rootRef.current?.contains(event.target as Node)) close(false) }
    const handleKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') close(true) }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => { document.removeEventListener('pointerdown', handlePointerDown); document.removeEventListener('keydown', handleKeyDown) }
  }, [open, periodMonth, periodYear])

  const closeWithoutApply = (restoreFocus = true) => {
    setDraft({ year: periodYear, month: periodMonth })
    setOpen(false)
    if (restoreFocus) window.requestAnimationFrame(() => triggerRef.current?.focus())
  }
  return <div ref={rootRef} className={cn('checklist-command-period', open && 'is-open')}>
    <button ref={triggerRef} type="button" className="checklist-command-period-trigger" aria-label={`${input.locale === 'tr' ? 'Dönem' : 'Period'}: ${formatChecklistCommandPeriodLabel(input.period, input.locale)}`} aria-haspopup="dialog" aria-expanded={open} onClick={() => { if (open) closeWithoutApply(false); else { setDraft({ year: periodYear, month: periodMonth }); setOpen(true) } }}><CalendarDays size={15} /><span><small>{input.locale === 'tr' ? 'DÖNEM' : 'PERIOD'}</small><strong>{formatChecklistCommandPeriodLabel(input.period, input.locale)}</strong></span><ChevronDown size={13} /></button>
    {open ? <div className="checklist-command-period-popover" role="dialog" aria-label={input.locale === 'tr' ? 'Raporlama dönemi' : 'Reporting period'}>
      <header><div><span className="checklist-command-period-icon"><CalendarDays size={16} /></span><span><small>{input.locale === 'tr' ? 'RAPORLAMA DÖNEMİ' : 'REPORTING PERIOD'}</small><strong>{input.locale === 'tr' ? 'Ay ve yıl seçin' : 'Select month and year'}</strong></span></div><button type="button" aria-label={input.locale === 'tr' ? 'Tarih filtresini kapat' : 'Close date filter'} onClick={() => closeWithoutApply()}><X size={15} /></button></header>
      <div className="checklist-command-period-presets"><button type="button" className={draft.year === currentPeriod.year && draft.month === currentPeriod.month ? 'is-active' : ''} onClick={() => setDraft(currentPeriod)}>{input.locale === 'tr' ? 'Bu ay' : 'This month'}</button><button type="button" className={draft.year === previousPeriod.year && draft.month === previousPeriod.month ? 'is-active' : ''} onClick={() => setDraft(previousPeriod)}>{input.locale === 'tr' ? 'Geçen ay' : 'Last month'}</button></div>
      <div className="checklist-command-period-year"><button type="button" aria-label={input.locale === 'tr' ? 'Önceki yıl' : 'Previous year'} onClick={() => setDraft((current) => ({ ...current, year: current.year - 1 }))}><ChevronLeft size={15} /></button><span><small>{input.locale === 'tr' ? 'YIL' : 'YEAR'}</small><strong>{draft.year}</strong></span><button type="button" aria-label={input.locale === 'tr' ? 'Sonraki yıl' : 'Next year'} onClick={() => setDraft((current) => ({ ...current, year: current.year + 1 }))}><ChevronRight size={15} /></button></div>
      <div className="checklist-command-period-months">{monthNames.map((label, index) => <button type="button" className={draft.month === index + 1 ? 'is-active' : ''} key={label} onClick={() => setDraft((current) => ({ ...current, month: index + 1 }))}><span>{label}</span>{draft.month === index + 1 ? <Check size={13} /> : null}</button>)}</div>
      <footer><button type="button" onClick={() => setDraft(currentPeriod)}>{input.locale === 'tr' ? 'Sıfırla' : 'Reset'}</button><span>{formatChecklistCommandPeriodLabel(createChecklistCommandPeriod(draft.year, draft.month), input.locale)}</span><button type="button" className="primary" onClick={() => { input.onChange(createChecklistCommandPeriod(draft.year, draft.month)); setOpen(false) }}><Check size={14} /> {input.locale === 'tr' ? 'Uygula' : 'Apply'}</button></footer>
    </div> : null}
  </div>
}
