import { useState } from 'react'
import { CalendarDays, X } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../components/ui/dialog'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select'
import type { AuthSessionSummary } from '../auth/api'
import { formatChecklistCommandPeriodLabel } from './checklist-command-period'
import { getChecklistPeriodWeekStart } from './model'
import { ReportViewerWeeklyVisitPlan } from './ReportViewerWeeklyVisitPlan'

export type ReportViewerManagerOption = {
  key: string
  managerName: string
  scopeId: string
  storeCount: number
}

export function ReportViewerVisitCalendarDialog(input: {
  authSummary: AuthSessionSummary | null
  initialManagerKey: string | null
  locale: 'tr' | 'en'
  managers: ReportViewerManagerOption[]
  open: boolean
  period: string
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={input.open} onOpenChange={input.onOpenChange}>
      {input.open ? <CalendarDialogContent authSummary={input.authSummary} initialManagerKey={input.initialManagerKey} locale={input.locale} managers={input.managers} period={input.period} /> : null}
    </Dialog>
  )
}

function CalendarDialogContent(input: {
  authSummary: AuthSessionSummary | null
  initialManagerKey: string | null
  locale: 'tr' | 'en'
  managers: ReportViewerManagerOption[]
  period: string
}) {
  const copy = input.locale === 'tr' ? trCopy : enCopy
  const [selectedManagerKey, setSelectedManagerKey] = useState(input.initialManagerKey ?? input.managers[0]?.key ?? '')
  const [weekStart, setWeekStart] = useState(() => getChecklistPeriodWeekStart(input.period))
  const selectedManager = input.managers.find((manager) => manager.key === selectedManagerKey) ?? input.managers[0]

  return (
      <DialogContent closeLabel={copy.close} showCloseButton={false} className="tw:max-h-[calc(100dvh-24px)] tw:gap-0 tw:overflow-y-auto tw:rounded-2xl tw:p-0 tw:sm:w-[calc(100%-3rem)] tw:sm:max-w-[1180px]">
        <DialogHeader className="tw:relative tw:overflow-hidden tw:border-b tw:border-primary/30 tw:bg-primary tw:px-4 tw:py-3.5 tw:pr-12 tw:text-primary-foreground">
          <span aria-hidden className="tw:pointer-events-none tw:absolute tw:-top-20 tw:right-16 tw:size-44 tw:rounded-full tw:border tw:border-primary-foreground/10" />
          <div className="tw:flex tw:items-start tw:gap-3">
            <span className="tw:grid tw:size-8 tw:shrink-0 tw:place-items-center tw:rounded-lg tw:border tw:border-primary-foreground/20 tw:bg-primary-foreground/12 tw:text-primary-foreground"><CalendarDays aria-hidden className="tw:size-4" /></span>
            <div className="tw:min-w-0"><DialogTitle className="tw:text-lg tw:font-semibold tw:tracking-[-0.025em] tw:text-primary-foreground">{copy.title}</DialogTitle><DialogDescription className="tw:mt-0.5 tw:text-[11px] tw:text-primary-foreground/75">{copy.description}</DialogDescription></div>
          </div>
          <DialogClose asChild><Button className="tw:absolute tw:top-2.5 tw:right-2.5 tw:border-primary-foreground/20 tw:bg-primary-foreground/10 tw:text-primary-foreground tw:hover:bg-primary-foreground/20 tw:hover:text-primary-foreground" size="icon-sm" variant="ghost" aria-label={copy.close}><X aria-hidden /></Button></DialogClose>
        </DialogHeader>

        <div className="tw:flex tw:flex-col tw:gap-2.5 tw:border-b tw:border-border tw:bg-accent/35 tw:px-4 tw:py-3 tw:sm:flex-row tw:sm:items-end tw:sm:justify-between">
          <label className="tw:grid tw:w-full tw:gap-1 tw:sm:max-w-xs">
            <span className="tw:text-[9px] tw:font-bold tw:uppercase tw:tracking-[0.12em] tw:text-muted-foreground">{copy.manager}</span>
            <Select value={selectedManager?.key ?? ''} onValueChange={(value) => { setSelectedManagerKey(value); setWeekStart(getChecklistPeriodWeekStart(input.period)) }}>
              <SelectTrigger aria-label={copy.manager} className="tw:h-8 tw:w-full tw:bg-card tw:text-xs"><SelectValue placeholder={copy.chooseManager} /></SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {input.managers.map((manager) => <SelectItem key={manager.key} value={manager.key}>{manager.managerName} · {manager.storeCount} {copy.store}</SelectItem>)}
                </SelectGroup>
              </SelectContent>
            </Select>
          </label>
          <span className="tw:text-xs tw:font-medium tw:text-muted-foreground">{formatChecklistCommandPeriodLabel(input.period, input.locale)}</span>
        </div>

        <div className="tw:p-3 tw:sm:p-4">
          {selectedManager ? (
            <div>
              <div className="tw:mb-3 tw:flex tw:items-baseline tw:justify-between tw:gap-3"><h3 className="tw:m-0 tw:text-base tw:font-semibold tw:tracking-[-0.015em]">{selectedManager.managerName}</h3><span className="tw:text-[11px] tw:text-muted-foreground">{selectedManager.storeCount} {copy.store}</span></div>
              <ReportViewerWeeklyVisitPlan key={`${selectedManager.key}:${input.period}`} authSummary={input.authSummary} locale={input.locale} scopeId={selectedManager.scopeId} weekStart={weekStart} onWeekStartChange={setWeekStart} />
            </div>
          ) : <p className="tw:m-0 tw:py-12 tw:text-center tw:text-sm tw:text-muted-foreground">{copy.empty}</p>}
        </div>
      </DialogContent>
  )
}

const trCopy = { chooseManager: 'Bölge müdürü seçin', close: 'Ziyaret takvimini kapat', description: 'Bölge müdürünü seçerek haftalık ziyaret planını inceleyin.', empty: 'Görüntülenecek bölge müdürü bulunamadı.', manager: 'Bölge müdürü', store: 'mağaza', title: 'Ziyaret Takvimi' } as const
const enCopy = { chooseManager: 'Select a region manager', close: 'Close visit calendar', description: 'Select a region manager to review the weekly visit plan.', empty: 'No region manager is available.', manager: 'Region manager', store: 'stores', title: 'Visit Calendar' } as const
