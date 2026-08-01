import type { ReactNode } from 'react'
import { AlertCircle, Check, ChevronLeft, ChevronRight, Search, type LucideIcon } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '../../components/ui/alert'
import { Badge } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { Card, CardContent } from '../../components/ui/card'
import { Input } from '../../components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '../../components/ui/popover'
import { Separator } from '../../components/ui/separator'
import { Skeleton } from '../../components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table'
import { cn } from '../../lib/utils'
import type { TranslateFunction } from '../localization/dictionary'
import type { ChecklistCommandRow } from './api'
import {
  getChecklistCommandSortLabel,
  type ChecklistCommandSort,
  type ChecklistCommandSortKey,
} from './model'

export type ChecklistCommandMetric = {
  key: string
  label: string
  note?: string
  value: number | string
  icon: LucideIcon
  tone?: 'plum' | 'danger' | 'active' | 'done'
}

const metricToneClasses = {
  active: 'tw:bg-accent/10 tw:text-accent',
  danger: 'tw:bg-destructive/10 tw:text-destructive',
  done: 'tw:bg-accent/10 tw:text-accent',
  plum: 'tw:bg-primary/10 tw:text-primary',
} as const

export function ChecklistCommandPageHeader(input: {
  eyebrow?: string
  title: string
  description?: string
  actions?: ReactNode
  className?: string
}) {
  return (
    <header className={cn('checklist-command-title tw:flex tw:flex-col tw:gap-3 tw:sm:flex-row tw:sm:items-end tw:sm:justify-between', input.className)}>
      <div className="tw:min-w-0">
        {input.eyebrow ? <p className="tw:m-0 tw:text-[10px] tw:font-semibold tw:uppercase tw:tracking-[0.14em] tw:text-muted-foreground">{input.eyebrow}</p> : null}
        <h1 className="tw:mt-1 tw:font-semibold tw:leading-tight tw:tracking-[-0.035em] tw:text-2xl tw:text-foreground tw:sm:text-3xl">{input.title}</h1>
        {input.description ? <p className="tw:mt-1 tw:max-w-2xl tw:text-xs tw:leading-5 tw:text-muted-foreground">{input.description}</p> : null}
      </div>
      {input.actions ? <div className="checklist-command-title-actions tw:flex tw:flex-wrap tw:items-center tw:gap-2 tw:sm:justify-end">{input.actions}</div> : null}
    </header>
  )
}

export function ChecklistCommandMetricStrip(input: {
  ariaLabel: string
  metrics: readonly ChecklistCommandMetric[]
  selectedKey?: string
  onSelect?: (key: string) => void
  testId?: string
}) {
  return (
    <section
      aria-label={input.ariaLabel}
      data-testid={input.testId}
      className="checklist-command-metrics tw:mt-1 tw:grid tw:overflow-hidden tw:rounded-[15px] tw:border tw:border-border tw:bg-card tw:shadow-sm tw:grid-cols-2 tw:lg:grid-cols-4"
    >
      {input.metrics.map((metric) => {
        const Icon = metric.icon
        const selected = input.selectedKey === metric.key
        const content = (
          <>
            <span className={cn('checklist-command-metric-icon tw:grid tw:size-8 tw:shrink-0 tw:place-items-center tw:rounded-lg', metricToneClasses[metric.tone ?? 'plum'])}>
              <Icon className="tw:size-4" aria-hidden="true" />
            </span>
            <span className="checklist-command-metric-copy tw:grid tw:min-w-0 tw:gap-0.5">
              <span className="tw:truncate tw:text-[10px] tw:font-semibold tw:text-muted-foreground">{metric.label}</span>
              {metric.note ? <small className="tw:hidden tw:truncate tw:text-[9px] tw:text-muted-foreground/75 tw:sm:block">{metric.note}</small> : null}
            </span>
            <strong className="tw:ml-auto tw:text-xl tw:font-semibold tw:tabular-nums tw:text-foreground tw:sm:text-2xl">{metric.value}</strong>
          </>
        )
        return input.onSelect ? (
          <Button
            key={metric.key}
            type="button"
            variant="ghost"
            aria-pressed={selected}
            className={cn(
              'checklist-command-metric tw:grid tw:min-h-20 tw:grid-cols-[auto_minmax(0,1fr)_auto] tw:items-center tw:gap-2 tw:rounded-none tw:border-0 tw:border-b tw:border-border tw:p-3 tw:text-left tw:hover:bg-muted/30 tw:last:border-b-0 tw:sm:min-h-[92px] tw:sm:gap-2.5 tw:sm:p-4 tw:lg:border-b-0 tw:lg:border-l tw:lg:first:border-l-0',
              selected && 'tw:bg-primary/[0.045]',
            )}
            onClick={() => input.onSelect?.(metric.key)}
          >
            {content}
          </Button>
        ) : (
          <div key={metric.key} className="checklist-command-metric tw:grid tw:min-h-20 tw:grid-cols-[auto_minmax(0,1fr)_auto] tw:items-center tw:gap-2 tw:border-b tw:border-border tw:p-3 tw:last:border-b-0 tw:sm:min-h-[92px] tw:sm:gap-2.5 tw:sm:p-4 tw:lg:border-b-0 tw:lg:border-l tw:lg:first:border-l-0">
            {content}
          </div>
        )
      })}
    </section>
  )
}

export type ChecklistCommandFilterOption = {
  value: string
  label: string
  note?: string
  count?: number
}

export function ChecklistCommandFilterPopover(input: {
  label: string
  valueLabel: string
  ariaLabel: string
  icon?: LucideIcon
  options: readonly ChecklistCommandFilterOption[]
  value: string
  onValueChange: (value: string) => void
}) {
  const Icon = input.icon
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="tw:min-h-9 tw:shrink-0 tw:gap-1.5 tw:rounded-lg tw:text-xs">
          {Icon ? <Icon className="tw:size-3.5" aria-hidden="true" /> : null}
          <span>{input.label}</span>
          <span className="tw:rounded-md tw:bg-secondary tw:px-1.5 tw:py-0.5 tw:text-[10px] tw:text-secondary-foreground">{input.valueLabel}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent role="menu" aria-label={input.ariaLabel} align="start" className="tw:w-64 tw:p-0">
        <PopoverHeader className="tw:border-b tw:border-border tw:px-3 tw:py-2.5">
          <PopoverTitle className="tw:text-xs">{input.label}</PopoverTitle>
          <PopoverDescription className="tw:text-[10px]">{input.ariaLabel}</PopoverDescription>
        </PopoverHeader>
        <div className="tw:grid tw:gap-0.5 tw:p-1.5">
          {input.options.map((option) => {
            const selected = option.value === input.value
            return (
              <Button
                key={option.value}
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                variant={selected ? 'secondary' : 'ghost'}
                className="tw:min-h-11 tw:justify-between tw:gap-2 tw:rounded-md tw:px-2.5 tw:text-left"
                onClick={() => input.onValueChange(option.value)}
              >
                <span className="tw:grid tw:min-w-0 tw:gap-0.5">
                  <strong className="tw:truncate tw:text-xs">{option.label}</strong>
                  {option.note ? <small className="tw:truncate tw:text-[10px] tw:font-normal tw:text-muted-foreground">{option.note}</small> : null}
                </span>
                <span className="tw:flex tw:items-center tw:gap-1.5">
                  {typeof option.count === 'number' ? <b className="tw:min-w-6 tw:rounded-md tw:bg-muted tw:px-1.5 tw:py-1 tw:text-center tw:text-[10px] tw:font-semibold tw:text-muted-foreground">{option.count}</b> : null}
                  {selected ? <Check className="tw:size-3.5 tw:text-primary" aria-hidden="true" /> : null}
                </span>
              </Button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}

export function ChecklistCommandToolbar(input: {
  searchLabel: string
  searchValue: string
  onSearchChange: (value: string) => void
  refreshing?: string | undefined
  errorLabel?: string | undefined
  retryLabel?: string | undefined
  onRetry?: (() => void) | undefined
  children?: ReactNode
  className?: string | undefined
}) {
  return (
    <div className={cn('checklist-command-toolbar tw:flex tw:flex-col tw:gap-2 tw:border-b tw:border-border tw:p-3 tw:sm:flex-row tw:sm:items-center', input.className)}>
      <label className="tw:flex tw:min-h-10 tw:min-w-0 tw:flex-1 tw:items-center tw:gap-2 tw:rounded-lg tw:border tw:border-input tw:bg-muted/20 tw:px-3 tw:text-muted-foreground tw:sm:max-w-sm">
        <Search className="tw:size-4 tw:shrink-0" aria-hidden="true" />
        <Input
          aria-label={input.searchLabel}
          placeholder={input.searchLabel}
          value={input.searchValue}
          onChange={(event) => input.onSearchChange(event.target.value)}
          className="tw:h-auto tw:border-0 tw:bg-transparent tw:p-0 tw:text-base tw:shadow-none tw:focus-visible:ring-0 tw:sm:text-xs"
        />
      </label>
      {input.refreshing ? <small className="checklist-command-inline-refresh tw:text-[10px] tw:text-muted-foreground" aria-live="polite">{input.refreshing}</small> : null}
      {input.errorLabel && input.onRetry ? <Button type="button" size="sm" variant="ghost" className="checklist-command-inline-error tw:min-h-9 tw:justify-start tw:px-1 tw:text-left tw:text-xs tw:text-destructive" onClick={input.onRetry}>{input.errorLabel}{input.retryLabel ? ` · ${input.retryLabel}` : null}</Button> : null}
      {input.children ? <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-1.5 tw:sm:ml-auto">{input.children}</div> : null}
    </div>
  )
}

export function ChecklistCommandState(input: {
  kind: 'empty' | 'error' | 'access'
  title: string
  description: string
  retryLabel?: string
  onRetry?: () => void
  icon?: LucideIcon
}) {
  if (input.kind === 'empty') {
    const Icon = input.icon ?? Search
    return <div className="tw:grid tw:min-h-52 tw:place-items-center tw:p-8 tw:text-center"><div><Icon className="tw:mx-auto tw:size-5 tw:text-muted-foreground" aria-hidden="true" /><strong className="tw:mt-2 tw:block tw:text-sm tw:text-foreground">{input.title}</strong><p className="tw:mt-1 tw:max-w-md tw:text-xs tw:leading-5 tw:text-muted-foreground">{input.description}</p></div></div>
  }
  return (
    <Alert variant={input.kind === 'access' ? 'default' : 'destructive'} className="tw:m-3">
      <AlertCircle aria-hidden="true" />
      <AlertTitle>{input.title}</AlertTitle>
      <AlertDescription>{input.description}</AlertDescription>
      {input.onRetry && input.kind !== 'access' ? <Button type="button" size="sm" variant="outline" className="tw:mt-2" onClick={input.onRetry}>{input.retryLabel ?? 'Retry'}</Button> : null}
    </Alert>
  )
}

export function ChecklistCommandLoadingState() {
  return (
    <Card className="tw:gap-3 tw:border-border tw:bg-card/90 tw:p-4 tw:shadow-sm">
      <Skeleton className="tw:h-5 tw:w-40" />
      <Skeleton className="tw:h-10 tw:w-full" />
      <div className="tw:grid tw:gap-2 tw:sm:grid-cols-2"><Skeleton className="tw:h-16" /><Skeleton className="tw:h-16" /></div>
      <Skeleton className="tw:h-20 tw:w-full" />
    </Card>
  )
}

export function ChecklistCommandStatusBadge(input: { label: string; tone: 'late' | 'active' | 'review' | 'done' }) {
  const variant = input.tone === 'late' ? 'destructive' : input.tone === 'active' ? 'secondary' : 'outline'
  const toneClass = input.tone === 'review'
    ? 'tw:border-border tw:bg-secondary tw:text-secondary-foreground'
    : input.tone === 'done'
      ? 'tw:border-accent/25 tw:bg-accent/10 tw:text-accent'
      : ''
  return <Badge variant={variant} className={cn('checklist-command-status tw:min-h-6 tw:px-2 tw:text-[10px]', toneClass)}>{input.label}</Badge>
}

export function ChecklistCommandPagination(input: {
  firstItem: number
  lastItem: number
  total: number
  pageNumber: number
  pageCount: number
  previousLabel: string
  nextLabel: string
  previousDisabled?: boolean
  nextDisabled?: boolean
  summary?: ReactNode
  onPrevious: () => void
  onNext: () => void
}) {
  return (
    <footer className="checklist-command-pagination tw:flex tw:min-h-14 tw:flex-wrap tw:items-center tw:justify-between tw:gap-2 tw:border-t tw:border-border tw:bg-muted/20 tw:px-3 tw:py-2.5 tw:text-xs tw:text-muted-foreground">
      <span className="tw:tabular-nums">{input.summary ?? `${input.firstItem}–${input.lastItem} / ${input.total}`}</span>
      <div className="tw:flex tw:items-center tw:gap-1.5">
        <Button type="button" size="icon" variant="outline" aria-label={input.previousLabel} disabled={input.previousDisabled} onClick={input.onPrevious} className="tw:size-10"><ChevronLeft className="tw:size-4" /></Button>
        <span className="tw:min-w-14 tw:text-center tw:text-xs tw:tabular-nums">{input.pageNumber} / {input.pageCount}</span>
        <Button type="button" size="icon" variant="outline" aria-label={input.nextLabel} disabled={input.nextDisabled} onClick={input.onNext} className="tw:size-10"><ChevronRight className="tw:size-4" /></Button>
      </div>
    </footer>
  )
}

export function ChecklistCommandDesktopTable(input: {
  actionStoreIds: ReadonlySet<string>
  columnPreset: 'all' | 'scores' | 'visit'
  locale: 'tr' | 'en'
  rows: ChecklistCommandRow[]
  sort: ChecklistCommandSort
  t: TranslateFunction
  onOpenWorkflow: (storeId: string, tab?: 'visits' | 'inbox' | 'history', directChecklist?: 'bm') => void
  onSort: (key: ChecklistCommandSortKey) => void
}) {
  const heading = (label: string, key: ChecklistCommandSortKey) => <Button type="button" variant="ghost" size="sm" className="tw:h-auto tw:justify-start tw:px-0 tw:text-[10px] tw:font-semibold tw:uppercase tw:text-muted-foreground" onClick={() => input.onSort(key)}>{getChecklistCommandSortLabel(label, key, input.sort)}</Button>
  return (
    <div className="checklist-command-desktop-list tw:hidden tw:md:block">
      <Table className="tw:table-fixed tw:text-xs">
        <TableHeader><TableRow className="checklist-command-table-head tw:bg-muted/30"><TableHead className="tw:w-[27%]">{heading(input.t('storeChecklists.command.store'), 'store')}</TableHead>{input.columnPreset !== 'visit' ? <><TableHead className="tw:w-[9%]">{heading('BM', 'bm')}</TableHead><TableHead className="tw:w-[9%]">{heading('VM', 'vm')}</TableHead></> : null}{input.columnPreset !== 'scores' ? <><TableHead className="tw:w-[15%]">{heading(input.t('storeChecklists.command.visit'), 'last_visit')}</TableHead><TableHead className="tw:w-[13%]">{input.t('storeChecklists.command.elapsed')}</TableHead></> : null}<TableHead className="tw:w-[17%]">{heading(input.t('storeChecklists.status'), 'status')}</TableHead><TableHead className="tw:w-[10%]" /></TableRow></TableHeader>
        <TableBody>
          {input.rows.map((row) => {
            const status = getRowStatusPresentation(row, input.locale)
            return <TableRow key={row.storeId} data-testid="checklist-command-row" className={cn('checklist-command-row tw:min-h-16', row.status === 'needs_visit' && 'tw:border-l-2 tw:border-l-destructive')}>
              <TableCell className="tw:min-w-0"><strong className="tw:block tw:truncate tw:text-xs tw:text-foreground">{row.storeName}</strong></TableCell>
              {input.columnPreset !== 'visit' ? <><TableCell><ChecklistScore className="score-bm" value={row.bmScore} completedAt={row.bmCompletedAt} t={input.t} /></TableCell><TableCell><ChecklistScore className="score-vm" value={row.vmScore} completedAt={row.vmCompletedAt} t={input.t} /></TableCell></> : null}
              {input.columnPreset !== 'scores' ? <><TableCell><VisitDate className="visit-date" value={row.lastCompletedVisitAt} locale={input.locale} t={input.t} /></TableCell><TableCell><ElapsedDays className="elapsed-days" value={row.elapsedDaysSinceLastVisit} t={input.t} /></TableCell></> : null}
              <TableCell><ChecklistCommandStatusBadge label={status.label} tone={status.tone} /></TableCell>
              <TableCell><div className="tw:flex tw:flex-wrap tw:justify-end tw:gap-1"><Button type="button" variant="ghost" size="sm" className="checklist-command-action tw:min-h-9 tw:px-1.5 tw:text-[10px]" onClick={() => row.bmCompletedAt ? input.onOpenWorkflow(row.storeId, row.pendingBmAcknowledgementCount > 0 ? 'inbox' : 'history') : undefined}>{row.bmCompletedAt ? (input.locale === 'tr' ? 'Sonuçlar' : 'Results') : ''}</Button><Button type="button" variant="ghost" size="sm" className="checklist-command-action tw:min-h-9 tw:px-1.5 tw:text-[10px]" onClick={() => input.onOpenWorkflow(row.storeId, getPrimaryWorkflowTab(row, input.actionStoreIds.has(row.storeId)), getDirectChecklist(input.actionStoreIds.has(row.storeId)))}>{getRowActionLabel(row, input.locale, input.actionStoreIds.has(row.storeId))}<ChevronRight className="tw:size-3" /></Button></div></TableCell>
            </TableRow>
          })}
        </TableBody>
      </Table>
    </div>
  )
}

export function ChecklistCommandMobileCards(input: {
  actionStoreIds: ReadonlySet<string>
  locale: 'tr' | 'en'
  rows: ChecklistCommandRow[]
  t: TranslateFunction
  onOpenWorkflow: (storeId: string, tab?: 'visits' | 'inbox' | 'history', directChecklist?: 'bm') => void
}) {
  return <div className="checklist-command-mobile-list tw:grid tw:gap-2 tw:p-3 tw:md:hidden">{input.rows.map((row) => { const status = getRowStatusPresentation(row, input.locale); return <article key={row.storeId} data-testid="checklist-command-mobile-card" className={cn('checklist-command-mobile-card', row.status === 'needs_visit' && 'tw:border-l-2 tw:border-l-destructive')}><Card className="tw:gap-3 tw:border-border tw:p-3 tw:shadow-none"><div className="tw:flex tw:min-w-0 tw:items-start tw:justify-between tw:gap-3"><strong className="tw:min-w-0 tw:truncate tw:text-sm">{row.storeName}</strong><ChecklistCommandStatusBadge label={status.label} tone={status.tone} /></div><CardContent className="tw:grid tw:grid-cols-2 tw:gap-2 tw:p-0"><ChecklistScore className="score-bm" value={row.bmScore} completedAt={row.bmCompletedAt} t={input.t} /><ChecklistScore className="score-vm" value={row.vmScore} completedAt={row.vmCompletedAt} t={input.t} /><VisitDate value={row.lastCompletedVisitAt} locale={input.locale} t={input.t} /><ElapsedDays value={row.elapsedDaysSinceLastVisit} t={input.t} /></CardContent><Separator /><div className="tw:flex tw:flex-wrap tw:justify-end tw:gap-1"><Button type="button" variant="ghost" size="sm" className="checklist-command-action tw:min-h-10 tw:text-xs" onClick={() => row.bmCompletedAt ? input.onOpenWorkflow(row.storeId, row.pendingBmAcknowledgementCount > 0 ? 'inbox' : 'history') : undefined}>{row.bmCompletedAt ? (input.locale === 'tr' ? 'Sonuçlar' : 'Results') : null}</Button><Button type="button" variant="outline" size="sm" className="checklist-command-action tw:min-h-10 tw:text-xs" onClick={() => input.onOpenWorkflow(row.storeId, getPrimaryWorkflowTab(row, input.actionStoreIds.has(row.storeId)), getDirectChecklist(input.actionStoreIds.has(row.storeId)))}>{getRowActionLabel(row, input.locale, input.actionStoreIds.has(row.storeId))}<ChevronRight className="tw:size-3" /></Button></div></Card></article> })}</div>
}

function ChecklistScore(input: { className?: string; completedAt: string | null; value: number | null; t: TranslateFunction }) {
  if (input.value === null && input.completedAt) return <span className={cn('checklist-command-score is-partial tw:inline-flex tw:min-h-8 tw:items-center tw:rounded-md tw:border tw:border-border tw:bg-secondary tw:px-2 tw:text-[10px] tw:font-semibold tw:text-secondary-foreground', input.className)}>{input.t('storeChecklists.command.scoreUnavailable')}</span>
  if (input.value === null) return <span className={cn('checklist-command-score is-missing tw:inline-flex tw:min-h-8 tw:items-center tw:rounded-md tw:border tw:border-destructive/25 tw:bg-destructive/10 tw:px-2 tw:text-[10px] tw:font-semibold tw:text-destructive', input.className)}>{input.t('storeChecklists.command.notDone')}</span>
  return <span className={cn('checklist-command-score is-done tw:inline-flex tw:min-h-8 tw:items-center tw:gap-1 tw:rounded-md tw:border tw:border-primary/20 tw:bg-primary/10 tw:px-2 tw:text-primary', input.className)}><strong className="tw:text-sm tw:tabular-nums">{Math.round(input.value)}</strong><small className="tw:text-[9px]">{input.t('storeChecklists.command.points')}</small></span>
}

function VisitDate(input: { className?: string; value: string | null; locale: 'tr' | 'en'; t: TranslateFunction }) {
  if (!input.value) return <span className={cn('checklist-command-date tw:grid tw:gap-0.5 tw:text-[8px] tw:text-muted-foreground', input.className)}>{input.t('storeChecklists.command.neverVisited')}</span>
  return <span className={cn('checklist-command-date tw:grid tw:gap-0.5 tw:text-[8px] tw:text-muted-foreground', input.className)}><strong className="tw:text-[10px] tw:text-foreground">{new Intl.DateTimeFormat(input.locale === 'tr' ? 'tr-TR' : 'en-US', { day: 'numeric', month: 'short', timeZone: 'Europe/Istanbul' }).format(new Date(input.value))}</strong><small className="tw:text-[8px]">{input.t('storeChecklists.command.lastCompleted')}</small></span>
}

function ElapsedDays(input: { className?: string; value: number | null; t: TranslateFunction }) {
  return <span className={cn('checklist-command-elapsed tw:grid tw:gap-0.5 tw:text-muted-foreground', input.className)}><strong className="tw:text-[10px] tw:text-foreground">{input.value === null ? '—' : input.t('storeChecklists.command.days', { count: input.value })}</strong><small className="tw:text-[8px]">{input.t('storeChecklists.command.lastCompleted')}</small></span>
}

function getRowStatusPresentation(row: ChecklistCommandRow, locale: 'tr' | 'en'): { label: string; tone: 'review' | 'active' | 'late' | 'done' } {
  if (row.pendingBmAcknowledgementCount > 0) return { label: locale === 'tr' ? 'Mağaza Müdürü Onayı Bekliyor' : 'Awaiting Store Manager acknowledgement', tone: 'review' }
  if (row.activeBmChecklistCount > 0) return { label: locale === 'tr' ? 'Aktif taslak' : 'Active draft', tone: 'active' }
  if (row.status === 'needs_visit') return { label: locale === 'tr' ? 'Bu ay eksik' : 'Missing this month', tone: 'late' }
  if (row.status === 'pending') return { label: locale === 'tr' ? 'Kabul bekliyor' : 'Awaiting acknowledgement', tone: 'review' }
  if (row.openActionCount > 0) return { label: locale === 'tr' ? 'Aksiyon Takipte' : 'Action in progress', tone: 'review' }
  return { label: locale === 'tr' ? 'Aksiyon Yok' : 'No action', tone: 'done' }
}

function getRowActionLabel(row: ChecklistCommandRow, locale: 'tr' | 'en', authorized: boolean) {
  if (!authorized) return locale === 'tr' ? 'Sonuçları gör' : 'View results'
  if (row.activeBmChecklistCount > 0) return locale === 'tr' ? 'Devam et' : 'Continue'
  return locale === 'tr' ? 'Checklist yap' : 'Run checklist'
}

function getPrimaryWorkflowTab(row: ChecklistCommandRow, authorized: boolean): 'visits' | 'inbox' | 'history' {
  if (authorized) return 'visits'
  return row.pendingBmAcknowledgementCount > 0 ? 'inbox' : 'history'
}

function getDirectChecklist(authorized: boolean): 'bm' | undefined {
  return authorized ? 'bm' : undefined
}
