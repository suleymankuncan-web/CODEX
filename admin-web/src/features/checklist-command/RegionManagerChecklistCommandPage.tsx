import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Search,
  Store,
} from 'lucide-react'
import type { AuthSessionSummary } from '../auth/api'
import { storeChecklistCommandQueryKey } from '../auth/store-query-scope'
import { useLocalization } from '../localization/useLocalization'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Popover, PopoverContent, PopoverHeader, PopoverTitle, PopoverTrigger } from '../../components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select'
import { getBusinessMonthInputValue } from '../../lib/business-date'
import { getUserFacingErrorMessage } from '../../lib/format'
import { transientQueryRetryOptions } from '../../lib/query-retry'
import { cn } from '../../lib/utils'
import { StoreErrorState, StoreLoadingState, StoreSurfacePage } from '../../pages/store-surface-primitives'
import { getChecklistCommandCanvas, type ChecklistCommandRow } from './api'
import {
  createChecklistCommandPeriod,
  getChecklistCommandSortLabel,
  getChecklistCommandStatusLabel,
  toggleChecklistCommandSort,
  type ChecklistCommandSort,
  type ChecklistCommandSortKey,
  type ChecklistCommandStatus,
} from './model'

const PAGE_SIZE = 30

export function RegionManagerChecklistCommandPage(input: {
  authSummary: AuthSessionSummary | null
  onOpenWorkflow: (storeId: string) => void
}) {
  const { locale, t } = useLocalization()
  const [period, setPeriod] = useState(() => getBusinessMonthInputValue())
  const [status, setStatus] = useState<ChecklistCommandStatus>('all')
  const [sort, setSort] = useState<ChecklistCommandSort>('store_asc')
  const [searchDraft, setSearchDraft] = useState('')
  const [query, setQuery] = useState('')
  const [offset, setOffset] = useState(0)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQuery(searchDraft.trim())
      setOffset(0)
    }, 300)
    return () => window.clearTimeout(timer)
  }, [searchDraft])

  const filters = useMemo(
    () => ({ period, status, sort, query, limit: PAGE_SIZE, offset }),
    [offset, period, query, sort, status],
  )
  const commandQuery = useQuery({
    queryKey: storeChecklistCommandQueryKey(input.authSummary, filters),
    queryFn: () => getChecklistCommandCanvas(filters),
    ...transientQueryRetryOptions,
  })

  function selectStatus(nextStatus: ChecklistCommandStatus) {
    setStatus((current) => current === nextStatus && nextStatus !== 'all' ? 'all' : nextStatus)
    setOffset(0)
  }

  function changeSort(key: ChecklistCommandSortKey) {
    setSort((current) => toggleChecklistCommandSort(current, key))
    setOffset(0)
  }

  if (commandQuery.isLoading) {
    return <StoreLoadingState title={t('storeChecklists.loadingTitle')} description={t('storeChecklists.loadingCopy')} />
  }

  if (commandQuery.isError || !commandQuery.data) {
    return (
      <StoreSurfacePage ariaLabel={t('storeChecklists.errorTitle')}>
        <StoreErrorState
          title={t('storeChecklists.errorTitle')}
          description={getUserFacingErrorMessage(commandQuery.error, t('storeChecklists.errorCopy'))}
          action={{
            disabled: commandQuery.isFetching,
            label: commandQuery.isFetching ? t('storeChecklists.retryingAction') : t('storeChecklists.retryAction'),
            onClick: () => void commandQuery.refetch(),
            variant: 'outline',
          }}
        />
      </StoreSurfacePage>
    )
  }

  const data = commandQuery.data.data
  const firstItem = data.page.total === 0 ? 0 : data.page.offset + 1
  const lastItem = Math.min(data.page.total, data.page.offset + data.items.length)
  const periodLabel = formatPeriodLabel(period, locale)
  const metrics: Array<{
    key: ChecklistCommandStatus
    label: string
    note: string
    value: number
    icon: typeof Store
    tone: 'plum' | 'danger' | 'active' | 'done'
  }> = [
    {
      key: 'all',
      label: t('storeChecklists.command.totalStores'),
      note: t('storeChecklists.command.totalStoresNote'),
      value: data.metrics.totalStores,
      icon: Store,
      tone: 'plum',
    },
    {
      key: 'needs_visit',
      label: t('storeChecklists.command.needsVisit'),
      note: t('storeChecklists.command.needsVisitNote'),
      value: data.metrics.needsVisit,
      icon: CircleAlert,
      tone: 'danger',
    },
    {
      key: 'active',
      label: t('storeChecklists.command.active'),
      note: t('storeChecklists.command.activeNote'),
      value: data.metrics.active,
      icon: Clock3,
      tone: 'active',
    },
    {
      key: 'completed',
      label: t('storeChecklists.command.completed'),
      note: t('storeChecklists.command.completedNote'),
      value: data.metrics.completed,
      icon: CheckCircle2,
      tone: 'done',
    },
  ]

  return (
    <StoreSurfacePage ariaLabel={t('storeChecklists.command.title')} className="tw:max-w-[1180px] tw:gap-3">
      <header className="tw:flex tw:flex-col tw:gap-3 tw:sm:flex-row tw:sm:items-center tw:sm:justify-between">
        <div>
          <p className="tw:text-[10px] tw:font-bold tw:uppercase tw:tracking-[0.14em] tw:text-muted-foreground">
            {t('storeChecklists.command.eyebrow')} · {periodLabel}
          </p>
          <h1 className="tw:mt-1 tw:text-2xl tw:font-semibold tw:tracking-[-0.035em] tw:text-foreground tw:sm:text-3xl">
            {t('storeChecklists.command.title')}
          </h1>
          <p className="tw:mt-1 tw:text-xs tw:text-muted-foreground">{t('storeChecklists.command.scope')}</p>
        </div>
        <ChecklistCommandPeriodPicker locale={locale} period={period} onChange={(value) => { setPeriod(value); setOffset(0) }} />
      </header>

      <section aria-label={t('storeChecklists.summaryAria')} className="tw:relative tw:grid tw:grid-cols-2 tw:overflow-hidden tw:rounded-2xl tw:border tw:border-border tw:bg-card/90 tw:shadow-[0_10px_35px_rgba(55,38,72,0.06)] tw:lg:grid-cols-4">
        <span aria-hidden className="tw:absolute tw:inset-x-0 tw:top-0 tw:h-[3px] tw:bg-gradient-to-r tw:from-primary tw:via-blue-500 tw:to-cyan-500" />
        {metrics.map((metric) => {
          const Icon = metric.icon
          return (
            <button
              type="button"
              key={metric.key}
              aria-pressed={status === metric.key}
              className={cn(
                'tw:grid tw:min-h-24 tw:grid-cols-[30px_minmax(0,1fr)] tw:items-center tw:gap-2 tw:border-b tw:border-border tw:p-3 tw:text-left tw:transition-colors tw:hover:bg-muted/30 tw:[&:nth-child(even)]:border-l tw:sm:grid-cols-[34px_1fr_auto] tw:sm:gap-2.5 tw:sm:p-4 tw:lg:min-h-[106px] tw:lg:border-b-0 tw:lg:border-l tw:lg:first-of-type:border-l-0',
                status === metric.key && 'tw:bg-primary/[0.045]',
              )}
              onClick={() => selectStatus(metric.key)}
            >
              <span className={cn('tw:grid tw:size-8 tw:place-items-center tw:rounded-lg', metricToneClasses[metric.tone])}>
                <Icon className="tw:size-4" />
              </span>
              <span className="tw:grid tw:min-w-0 tw:gap-1">
                <span className="tw:text-[10px] tw:font-semibold tw:text-muted-foreground">{metric.label}</span>
                <small className="tw:text-[9px] tw:text-muted-foreground/75">{metric.note}</small>
              </span>
              <strong className="tw:col-span-2 tw:text-right tw:text-xl tw:font-semibold tw:tabular-nums tw:text-foreground tw:sm:col-span-1 tw:sm:text-2xl">{metric.value}</strong>
            </button>
          )
        })}
      </section>

      <section className="tw:overflow-hidden tw:rounded-2xl tw:border tw:border-border tw:bg-card/95 tw:shadow-[0_18px_50px_rgba(44,31,59,0.07)]">
        <div className="tw:flex tw:flex-col tw:gap-2 tw:border-b tw:border-border tw:p-3 tw:sm:flex-row tw:sm:items-center">
          <label className="tw:flex tw:min-h-9 tw:min-w-0 tw:flex-1 tw:items-center tw:gap-2 tw:rounded-lg tw:border tw:border-input tw:bg-muted/20 tw:px-3 tw:text-muted-foreground tw:sm:max-w-sm">
            <Search className="tw:size-4 tw:shrink-0" />
            <Input
              aria-label={t('storeChecklists.command.search')}
              className="tw:h-auto tw:border-0 tw:bg-transparent tw:p-0 tw:text-xs tw:shadow-none tw:focus-visible:ring-0"
              placeholder={t('storeChecklists.command.search')}
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
            />
          </label>
          <Select value={status} onValueChange={(value) => selectStatus(value as ChecklistCommandStatus)}>
            <SelectTrigger aria-label={t('storeChecklists.command.statusFilter')} className="tw:w-full tw:sm:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('storeChecklists.command.all')}</SelectItem>
              <SelectItem value="needs_visit">{t('storeChecklists.command.needsVisit')}</SelectItem>
              <SelectItem value="active">{t('storeChecklists.command.active')}</SelectItem>
              <SelectItem value="pending">{t('storeChecklists.pendingAcknowledgements')}</SelectItem>
              <SelectItem value="completed">{t('storeChecklists.command.completed')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {data.items.length === 0 ? (
          <div className="tw:grid tw:min-h-52 tw:place-items-center tw:p-8 tw:text-center">
            <div>
              <strong className="tw:text-sm tw:text-foreground">{t('storeChecklists.command.emptyTitle')}</strong>
              <p className="tw:mt-1 tw:max-w-md tw:text-xs tw:leading-5 tw:text-muted-foreground">{t('storeChecklists.command.emptyCopy')}</p>
            </div>
          </div>
        ) : (
          <>
            <ChecklistCommandDesktopTable
              locale={locale}
              rows={data.items}
              sort={sort}
              t={t}
              onOpenWorkflow={input.onOpenWorkflow}
              onSort={changeSort}
            />
            <ChecklistCommandMobileCards locale={locale} rows={data.items} t={t} onOpenWorkflow={input.onOpenWorkflow} />
          </>
        )}

        <footer className="tw:flex tw:flex-col tw:items-center tw:justify-between tw:gap-2 tw:border-t tw:border-border tw:bg-muted/20 tw:px-3 tw:py-2 tw:sm:flex-row">
          <span className="tw:text-[10px] tw:font-medium tw:text-muted-foreground">
            {t('storeChecklists.command.page', { start: firstItem, end: lastItem, total: data.page.total })}
          </span>
          <div className="tw:flex tw:gap-2">
            <Button type="button" size="sm" variant="outline" disabled={offset === 0 || commandQuery.isFetching} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}>
              {t('storeChecklists.command.previous')}
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={!data.page.hasMore || commandQuery.isFetching} onClick={() => setOffset(offset + PAGE_SIZE)}>
              {t('storeChecklists.command.next')}
            </Button>
          </div>
        </footer>
      </section>
    </StoreSurfacePage>
  )
}

const metricToneClasses = {
  active: 'tw:bg-blue-500/10 tw:text-blue-600',
  danger: 'tw:bg-destructive/10 tw:text-destructive',
  done: 'tw:bg-emerald-500/10 tw:text-emerald-600',
  plum: 'tw:bg-primary/10 tw:text-primary',
}

function ChecklistCommandDesktopTable(input: {
  locale: 'tr' | 'en'
  rows: ChecklistCommandRow[]
  sort: ChecklistCommandSort
  t: ReturnType<typeof useLocalization>['t']
  onOpenWorkflow: (storeId: string) => void
  onSort: (key: ChecklistCommandSortKey) => void
}) {
  const heading = (label: string, key: ChecklistCommandSortKey) => (
    <button type="button" className="tw:border-0 tw:bg-transparent tw:p-0 tw:text-left tw:font-[inherit] tw:tracking-[inherit] tw:text-[inherit] tw:uppercase" onClick={() => input.onSort(key)}>
      {getChecklistCommandSortLabel(label, key, input.sort)}
    </button>
  )
  return (
    <div className="tw:hidden tw:lg:block">
      <div className="tw:grid tw:grid-cols-[minmax(220px,1.35fr)_82px_82px_128px_120px_118px_142px] tw:items-center tw:gap-3 tw:bg-muted/35 tw:px-4 tw:py-3 tw:text-[9px] tw:font-bold tw:uppercase tw:tracking-[0.08em] tw:text-muted-foreground">
        {heading(input.t('storeChecklists.command.store'), 'store')}
        {heading('BM', 'bm')}
        {heading('VM', 'vm')}
        {heading(input.t('storeChecklists.command.visit'), 'last_visit')}
        <span>{input.t('storeChecklists.command.elapsed')}</span>
        {heading(input.t('storeChecklists.status'), 'status')}
        {heading(input.t('storeChecklists.command.actions'), 'open_actions')}
      </div>
      {input.rows.map((row) => (
        <div key={row.storeId} className="tw:relative tw:grid tw:min-h-16 tw:grid-cols-[minmax(220px,1.35fr)_82px_82px_128px_120px_118px_142px] tw:items-center tw:gap-3 tw:border-t tw:border-border tw:px-4 tw:py-2 tw:text-xs tw:hover:bg-muted/25">
          {row.status === 'needs_visit' ? <span aria-hidden className="tw:absolute tw:inset-y-3 tw:left-0 tw:w-0.5 tw:bg-destructive" /> : null}
          <StoreIdentity row={row} />
          <ChecklistScore value={row.bmScore} t={input.t} />
          <ChecklistScore value={row.vmScore} t={input.t} />
          <VisitDate value={row.lastCompletedVisitAt} locale={input.locale} t={input.t} />
          <ElapsedDays value={row.elapsedDaysSinceLastVisit} t={input.t} />
          <StatusPill locale={input.locale} status={row.status} />
          <Button type="button" variant="ghost" size="sm" className="tw:justify-start tw:px-2 tw:text-[10px] tw:font-semibold tw:text-primary" onClick={() => input.onOpenWorkflow(row.storeId)}>
            {input.t('storeChecklists.command.openWorkflow')}
          </Button>
        </div>
      ))}
    </div>
  )
}

function ChecklistCommandMobileCards(input: {
  locale: 'tr' | 'en'
  rows: ChecklistCommandRow[]
  t: ReturnType<typeof useLocalization>['t']
  onOpenWorkflow: (storeId: string) => void
}) {
  return (
    <div className="tw:grid tw:divide-y tw:divide-border tw:lg:hidden">
      {input.rows.map((row) => (
        <article key={row.storeId} className="tw:grid tw:gap-3 tw:p-4">
          <div className="tw:flex tw:items-start tw:justify-between tw:gap-3">
            <StoreIdentity row={row} />
            <StatusPill locale={input.locale} status={row.status} />
          </div>
          <div className="tw:grid tw:grid-cols-2 tw:gap-2">
            <div><small className="tw:mb-1 tw:block tw:text-[9px] tw:font-bold tw:text-muted-foreground">BM</small><ChecklistScore value={row.bmScore} t={input.t} /></div>
            <div><small className="tw:mb-1 tw:block tw:text-[9px] tw:font-bold tw:text-muted-foreground">VM</small><ChecklistScore value={row.vmScore} t={input.t} /></div>
          </div>
          <div className="tw:flex tw:items-end tw:justify-between tw:gap-3">
            <div className="tw:grid tw:gap-1"><VisitDate value={row.lastCompletedVisitAt} locale={input.locale} t={input.t} /><ElapsedDays value={row.elapsedDaysSinceLastVisit} t={input.t} /></div>
            <Button type="button" variant="outline" size="sm" className="tw:text-[10px]" onClick={() => input.onOpenWorkflow(row.storeId)}>{input.t('storeChecklists.command.openWorkflow')}</Button>
          </div>
        </article>
      ))}
    </div>
  )
}

function StoreIdentity({ row }: { row: ChecklistCommandRow }) {
  return <span className="tw:grid tw:min-w-0 tw:gap-0.5"><strong className="tw:truncate tw:text-xs tw:text-foreground">{row.storeName}</strong><small className="tw:truncate tw:text-[9px] tw:text-muted-foreground">{row.storeCode} · {row.regionName}</small></span>
}

function ChecklistScore(input: { value: number | null; t: ReturnType<typeof useLocalization>['t'] }) {
  if (input.value === null) return <span className="tw:inline-flex tw:w-fit tw:min-w-16 tw:justify-center tw:rounded-lg tw:border tw:border-destructive/20 tw:bg-destructive/10 tw:px-2 tw:py-1.5 tw:text-[9px] tw:font-bold tw:text-destructive">{input.t('storeChecklists.command.notDone')}</span>
  return <span className="tw:inline-flex tw:w-fit tw:min-w-16 tw:items-baseline tw:justify-center tw:gap-1 tw:rounded-lg tw:border tw:border-primary/20 tw:bg-primary/[0.06] tw:px-2 tw:py-1.5 tw:text-primary"><strong className="tw:text-sm tw:tabular-nums">{Math.round(input.value)}</strong><small className="tw:text-[8px] tw:font-semibold">{input.t('storeChecklists.command.points')}</small></span>
}

function VisitDate(input: { value: string | null; locale: 'tr' | 'en'; t: ReturnType<typeof useLocalization>['t'] }) {
  if (!input.value) return <span className="tw:text-[10px] tw:text-muted-foreground">{input.t('storeChecklists.command.neverVisited')}</span>
  return <span className="tw:grid tw:gap-0.5"><strong className="tw:text-[10px] tw:text-foreground">{new Intl.DateTimeFormat(input.locale === 'tr' ? 'tr-TR' : 'en-US', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Europe/Istanbul' }).format(new Date(input.value))}</strong><small className="tw:text-[8px] tw:text-muted-foreground">{input.t('storeChecklists.command.lastCompleted')}</small></span>
}

function ElapsedDays(input: { value: number | null; t: ReturnType<typeof useLocalization>['t'] }) {
  return <span className="tw:text-[10px] tw:font-medium tw:text-muted-foreground">{input.value === null ? '—' : input.t('storeChecklists.command.days', { count: input.value })}</span>
}

function StatusPill(input: { locale: 'tr' | 'en'; status: ChecklistCommandRow['status'] }) {
  return <span className={cn('tw:inline-flex tw:w-fit tw:rounded-full tw:px-2 tw:py-1 tw:text-[9px] tw:font-semibold', statusToneClasses[input.status])}>{getChecklistCommandStatusLabel(input.status, input.locale)}</span>
}

const statusToneClasses: Record<ChecklistCommandRow['status'], string> = {
  active: 'tw:bg-primary/10 tw:text-primary',
  completed: 'tw:bg-emerald-500/10 tw:text-emerald-700',
  needs_visit: 'tw:bg-destructive/10 tw:text-destructive',
  pending: 'tw:bg-amber-500/10 tw:text-amber-700',
}

function ChecklistCommandPeriodPicker(input: { locale: 'tr' | 'en'; period: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false)
  const { year: periodYear, month: periodMonth } = parsePeriod(input.period)
  const [year, setYear] = useState(periodYear)
  const years = Array.from({ length: 7 }, (_, index) => periodYear - 3 + index)
  const monthNames = Array.from({ length: 12 }, (_, index) => new Intl.DateTimeFormat(input.locale === 'tr' ? 'tr-TR' : 'en-US', { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2026, index, 1))))
  return (
    <Popover open={open} onOpenChange={(nextOpen) => { setOpen(nextOpen); if (nextOpen) setYear(periodYear) }}>
      <PopoverTrigger asChild><Button type="button" variant="outline" className="tw:self-start"><CalendarDays className="tw:size-4" />{formatPeriodLabel(input.period, input.locale)}</Button></PopoverTrigger>
      <PopoverContent align="end" className="tw:w-72">
        <PopoverHeader><PopoverTitle>{input.locale === 'tr' ? 'Dönem seç' : 'Select period'}</PopoverTitle></PopoverHeader>
        <Select value={String(year)} onValueChange={(value) => setYear(Number(value))}>
          <SelectTrigger aria-label={input.locale === 'tr' ? 'Yıl seç' : 'Select year'} className="tw:w-full"><SelectValue /></SelectTrigger>
          <SelectContent>{years.map((option) => <SelectItem key={option} value={String(option)}>{option}</SelectItem>)}</SelectContent>
        </Select>
        <div className="tw:grid tw:grid-cols-3 tw:gap-2">
          {monthNames.map((month, index) => {
            const value = createChecklistCommandPeriod(year, index + 1)
            return <Button key={value} type="button" size="sm" variant={periodMonth === index + 1 && periodYear === year ? 'default' : 'outline'} onClick={() => { input.onChange(value); setOpen(false) }}>{month}</Button>
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function formatPeriodLabel(period: string, locale: 'tr' | 'en') {
  const { year, month } = parsePeriod(period)
  return new Intl.DateTimeFormat(locale === 'tr' ? 'tr-TR' : 'en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1, 1)))
}

function parsePeriod(period: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(period)
  if (!match) return { year: 2026, month: 1 }
  return { year: Number(match[1]!), month: Number(match[2]!) }
}
