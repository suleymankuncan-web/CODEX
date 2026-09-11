import type { ReactNode } from 'react'
import {
  ArrowDownUp,
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Play,
  Store,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ChecklistSearchField } from './ChecklistSearchField'
import { cn } from '@/lib/utils'
import { useLocalization } from '../localization/useLocalization'
import type { ChecklistCommandData, ChecklistCommandRow } from './api'
import {
  getChecklistCommandSortLabel,
  type ChecklistCommandSort,
  type ChecklistCommandSortKey,
} from './model'

export function RegionManagerChecklistWorkspace(input: {
  actionStoreIds: ReadonlySet<string>
  annualHistory: ReactNode
  data: ChecklistCommandData
  hasPartialScoreData: boolean
  isError: boolean
  isFetching: boolean
  offset: number
  pageCount: number
  pageNumber: number
  periodLabel: string
  periodPicker: ReactNode
  planner?: ReactNode
  regionName: string
  regionPicker: ReactNode
  searchDraft: string
  sort: ChecklistCommandSort
  onNextPage: () => void
  onOpenHistory: (store: ChecklistCommandRow, trigger: HTMLElement) => void
  onOpenWorkflow: (storeId: string, tab?: 'visits' | 'inbox' | 'history', directChecklist?: 'bm') => void
  onPreviousPage: () => void
  onRetry: () => void
  onSearchChange: (value: string) => void
  onSort: (key: ChecklistCommandSortKey) => void
}) {
  const { locale, t } = useLocalization()
  const firstItem = input.data.page.total === 0 ? 0 : input.data.page.offset + 1
  const lastItem = Math.min(input.data.page.total, input.data.page.offset + input.data.items.length)

  return (
    <div className="region-manager-checklist-v2 tw:flex tw:flex-col tw:gap-4">
      <header data-testid="region-manager-checklist-header" className="tw:relative tw:z-[1] tw:isolate tw:overflow-visible tw:rounded-[14px] tw:bg-primary tw:px-4 tw:py-4 tw:text-primary-foreground tw:shadow-sm tw:sm:px-5">
        <div aria-hidden className="tw:pointer-events-none tw:absolute tw:inset-0 tw:overflow-hidden tw:rounded-[14px]"><span className="tw:absolute tw:right-3 tw:top-3 tw:size-32 tw:rounded-full tw:border tw:border-white/15" /></div>
        <div className="tw:relative tw:flex tw:flex-col tw:gap-4 tw:lg:flex-row tw:lg:items-center tw:lg:justify-between">
          <div className="tw:flex tw:min-w-0 tw:items-center tw:gap-3">
            <span className="tw:grid tw:size-10 tw:shrink-0 tw:place-items-center tw:rounded-xl tw:border tw:border-white/20 tw:bg-white/10">
              <ClipboardCheck className="tw:size-5" />
            </span>
            <div className="tw:min-w-0">
              <p className="tw:text-[10px] tw:font-semibold tw:uppercase tw:tracking-[0.16em] tw:text-primary-foreground/70">
                {input.periodLabel} · {input.regionName}
              </p>
              <h1 className="tw:mt-0.5 tw:text-xl tw:font-semibold tw:tracking-[-0.025em] tw:sm:text-2xl">
                {t('storeChecklists.command.title')}
              </h1>
              <p className="tw:mt-1 tw:text-xs tw:text-primary-foreground/75">
                {locale === 'tr' ? 'Ziyaret planını takip edin, mağaza checklistlerini tek alandan yönetin.' : 'Track visits and manage store checklists from one workspace.'}
              </p>
            </div>
          </div>
          <div className="region-manager-checklist-v2-controls tw:flex tw:flex-wrap tw:items-center tw:gap-2 tw:[&_.checklist-command-period-trigger_*]:!text-white tw:[&>*>button]:!border-white/20 tw:[&>*>button]:!bg-[#20407c] tw:[&>*>button]:!text-white tw:[&>button]:!border-white/20 tw:[&>button]:!bg-[#20407c] tw:[&>button]:!text-white">
            {input.regionPicker}
            {input.annualHistory}
            {input.periodPicker}
          </div>
        </div>
      </header>

      {input.planner ? (
        <section className="checklist-command-unified-plan tw:!m-0 tw:!overflow-hidden tw:!rounded-[14px] tw:!border tw:!border-border tw:!bg-card tw:!shadow-sm" aria-label={locale === 'tr' ? 'Haftalık ziyaret planı' : 'Weekly visit plan'}>
          {input.planner}
        </section>
      ) : null}

      <section className="checklist-command-surface tw:!overflow-hidden tw:!rounded-[14px] tw:!border tw:!border-border tw:!bg-card tw:!shadow-sm" data-testid="checklist-command-surface">
        <div className="checklist-search-heading tw:border-b tw:border-border tw:p-3 tw:xl:hidden">
          <ChecklistSearchField label={t('storeChecklists.command.search')} placeholder={locale === 'tr' ? 'Mağaza Ara' : 'Search stores'} value={input.searchDraft} onChange={input.onSearchChange} count={input.data.page.total} testId="checklist-command-search" />
        </div>

        <div className={cn('tw:flex tw:min-h-7 tw:items-center tw:justify-end tw:border-b tw:border-border tw:bg-muted/20 tw:px-3 tw:py-1.5', !input.isFetching && !input.isError && 'tw:hidden')}>
          {input.isFetching ? <span className="tw:text-[10px] tw:font-medium tw:text-muted-foreground">{locale === 'tr' ? 'Güncelleniyor…' : 'Refreshing…'}</span> : null}
          {input.isError ? <Button type="button" variant="ghost" size="xs" onClick={input.onRetry}>{locale === 'tr' ? 'Yeniden dene' : 'Retry'}</Button> : null}
        </div>

        {input.hasPartialScoreData ? (
          <div className="checklist-command-partial-notice tw:flex tw:items-center tw:gap-2 tw:border-b tw:border-chart-4/25 tw:bg-chart-4/10 tw:px-3 tw:py-2 tw:text-xs tw:text-chart-4" role="status">
            {t('storeChecklists.command.partialScoreNotice')}
          </div>
        ) : null}

        <DesktopStoreList {...input} />
        {input.data.items.length === 0 ? (
          <div className="tw:grid tw:min-h-48 tw:place-items-center tw:p-8 tw:text-center">
            <div>
              <Store className="tw:mx-auto tw:mb-3 tw:size-6 tw:text-muted-foreground" />
              <strong className="tw:text-sm tw:text-foreground">{t('storeChecklists.command.emptyTitle')}</strong>
              <p className="tw:mt-1 tw:max-w-md tw:text-xs tw:leading-5 tw:text-muted-foreground">{t('storeChecklists.command.emptyCopy')}</p>
            </div>
          </div>
        ) : (
          <MobileStoreList {...input} />
        )}

        <footer className="tw:flex tw:min-h-12 tw:items-center tw:justify-between tw:border-t tw:border-border tw:px-3">
          <span className="tw:text-[11px] tw:text-muted-foreground">
            {t('storeChecklists.command.page', { start: firstItem, end: lastItem, total: input.data.page.total })}
          </span>
          <div className="tw:flex tw:items-center tw:gap-1">
            <Button type="button" variant="ghost" size="icon-sm" aria-label={t('storeChecklists.command.previous')} disabled={input.offset === 0 || input.isFetching} onClick={input.onPreviousPage}><ChevronLeft /></Button>
            <small className="tw:min-w-10 tw:text-center tw:text-[11px] tw:font-medium tw:tabular-nums">{input.pageNumber} / {input.pageCount}</small>
            <Button type="button" variant="ghost" size="icon-sm" aria-label={t('storeChecklists.command.next')} disabled={!input.data.page.hasMore || input.isFetching} onClick={input.onNextPage}><ChevronRight /></Button>
          </div>
        </footer>
      </section>
    </div>
  )
}

function DesktopStoreList(input: Parameters<typeof RegionManagerChecklistWorkspace>[0]) {
  const { locale, t } = useLocalization()
  const DirectionIcon = input.sort.endsWith('_asc') ? ArrowUp : ArrowDown
  const heading = (label: string, key: ChecklistCommandSortKey) => {
    const active = input.sort.startsWith(`${key === 'bm' || key === 'vm' ? `${key}_score` : key}_`)
    return <Button type="button" size="sm" variant="ghost" className="checklist-kpi-column-heading tw:w-full tw:justify-center" onClick={() => input.onSort(key)}>
      {label}{active ? <DirectionIcon aria-hidden="true" /> : null}
    </Button>
  }
  return (
    <div className="checklist-command-desktop-list tw:!hidden tw:xl:!block">
      <div className="checklist-command-table-head checklist-search-heading tw:!grid tw:!grid-cols-[minmax(220px,1.7fr)_72px_120px_100px_140px_196px] tw:!items-center tw:!gap-2 tw:!border-b tw:!border-border tw:!px-4 tw:!py-2">
        <div className="checklist-search-column">
          <ChecklistSearchField label={t('storeChecklists.command.search')} placeholder={locale === 'tr' ? 'Mağaza Ara' : 'Search stores'} value={input.searchDraft} onChange={input.onSearchChange} count={input.data.page.total} testId="checklist-command-search" />
          <Button size="icon-xs" variant="ghost" className="checklist-kpi-column-heading" aria-label={getChecklistCommandSortLabel(t('storeChecklists.command.store'), 'store', input.sort)} onClick={() => input.onSort('store')}>{input.sort.startsWith('store_') ? <DirectionIcon aria-hidden="true" /> : <ArrowDownUp aria-hidden="true" />}</Button>
        </div>
        {heading(locale === 'tr' ? 'Puan' : 'Score', 'bm')}
        {heading(t('storeChecklists.command.visit'), 'last_visit')}
        {heading(t('storeChecklists.command.elapsed'), 'elapsed')}
        {heading(t('storeChecklists.status'), 'status')}
        <span />
      </div>
      {input.data.items.map((row) => (
        <div key={row.storeId} data-testid="checklist-command-row" className="checklist-command-row tw:!grid tw:!min-h-16 tw:!grid-cols-[minmax(220px,1.7fr)_72px_120px_100px_140px_196px] tw:!items-center tw:!gap-2 tw:!border-b tw:!border-border tw:!px-4 tw:!py-2 tw:last:!border-b-0 tw:hover:!bg-muted/20">
          <StoreIdentity row={row} />
          <Score row={row} />
          <VisitDate locale={locale} row={row} />
          <Elapsed locale={locale} row={row} />
          <Status locale={locale} row={row} />
          <RowActions {...input} row={row} />
        </div>
      ))}
    </div>
  )
}

function MobileStoreList(input: Parameters<typeof RegionManagerChecklistWorkspace>[0]) {
  const { locale } = useLocalization()
  return (
    <div className="checklist-command-mobile-list tw:!grid tw:!gap-2 tw:!p-2.5 tw:xl:!hidden">
      {input.data.items.map((row) => (
        <article key={row.storeId} className="checklist-command-mobile-card tw:!grid tw:!min-h-0 tw:!grid-cols-1 tw:!gap-3 tw:!rounded-xl tw:!border tw:!border-border tw:!bg-background tw:!p-3 tw:!shadow-none">
          <div className="tw:flex tw:items-start tw:justify-between tw:gap-3">
            <StoreIdentity row={row} />
            <Status locale={locale} row={row} />
          </div>
          <dl className="tw:grid tw:grid-cols-3 tw:divide-x tw:divide-border tw:rounded-lg tw:bg-muted/30 tw:py-2">
            <MobileFact label={locale === 'tr' ? 'Puan' : 'Score'} value={row.bmScore === null ? '—' : `${Math.round(row.bmScore)}`} />
            <MobileFact emphasis={Boolean(row.lastCompletedVisitAt)} label={locale === 'tr' ? 'Son ziyaret' : 'Last visit'} value={formatVisitDate(row.lastCompletedVisitAt, locale)} />
            <MobileFact label={locale === 'tr' ? 'Geçen süre' : 'Elapsed'} value={formatElapsed(row.elapsedDaysSinceLastVisit, locale)} />
          </dl>
          <RowActions {...input} row={row} mobile />
        </article>
      ))}
    </div>
  )
}

function StoreIdentity({ row }: { row: ChecklistCommandRow }) {
  return <div className="tw:min-w-0"><strong className="tw:block tw:truncate tw:text-[13px] tw:font-semibold tw:text-foreground">{row.storeName}</strong><small className="tw:mt-0.5 tw:block tw:text-[10px] tw:text-muted-foreground">{row.storeCode}</small></div>
}

function Score({ row }: { row: ChecklistCommandRow }) {
  if (row.bmScore === null && row.bmCompletedAt) return <span className="score-bm tw:block tw:text-center tw:text-[10px] tw:font-medium tw:text-muted-foreground">—</span>
  if (row.bmScore === null) return <span className="score-bm tw:block tw:text-center tw:text-xs tw:text-muted-foreground">—</span>
  return <span className="score-bm tw:block tw:text-center tw:text-sm tw:font-semibold tw:tabular-nums tw:text-foreground">{Math.round(row.bmScore)}</span>
}

function VisitDate({ locale, row }: { locale: 'tr' | 'en'; row: ChecklistCommandRow }) {
  return <span className={cn('checklist-command-date tw:mx-auto tw:flex tw:min-h-7 tw:w-fit tw:items-center tw:justify-center tw:rounded-md tw:px-2 tw:text-center tw:!text-[12px] tw:font-semibold tw:tabular-nums', row.lastCompletedVisitAt ? 'tw:bg-primary/8 tw:text-primary' : 'tw:text-muted-foreground')}>{formatVisitDate(row.lastCompletedVisitAt, locale)}</span>
}

function Elapsed({ locale, row }: { locale: 'tr' | 'en'; row: ChecklistCommandRow }) {
  return <span className="tw:block tw:text-center tw:text-[11px] tw:font-medium tw:text-foreground">{formatElapsed(row.elapsedDaysSinceLastVisit, locale)}</span>
}

function Status({ locale, row }: { locale: 'tr' | 'en'; row: ChecklistCommandRow }) {
  const status = statusPresentation(row, locale)
  return <span className="tw:flex tw:justify-center"><Badge variant="outline" className={cn('tw:h-6 tw:max-w-full tw:truncate tw:border', status.className)}>{status.label}</Badge></span>
}

function RowActions(input: Parameters<typeof RegionManagerChecklistWorkspace>[0] & { mobile?: boolean; row: ChecklistCommandRow }) {
  const { locale } = useLocalization()
  const canAct = input.data.view === 'region_manager' || input.actionStoreIds.has(input.row.storeId)
  return (
    <div className="tw:grid tw:grid-cols-2 tw:items-center tw:gap-2">
      {canAct ? <Button type="button" size={input.mobile ? 'lg' : 'xs'} className="checklist-record-history-result-action tw:min-w-0" onClick={() => input.onOpenWorkflow(input.row.storeId, 'visits', 'bm')}>
        <Play />{input.row.activeBmChecklistCount > 0 ? (locale === 'tr' ? 'Devam et' : 'Continue') : (locale === 'tr' ? 'Başlat' : 'Start')}
      </Button> : <span />}
      <Button type="button" size={input.mobile ? 'lg' : 'xs'} className="checklist-record-history-result-action tw:min-w-0" onClick={(event) => input.onOpenHistory(input.row, event.currentTarget)}><ClipboardCheck />{locale === 'tr' ? 'Sonuçlar' : 'Results'}</Button>
    </div>
  )
}

function MobileFact({ emphasis = false, label, value }: { emphasis?: boolean; label: string; value: string }) {
  return <div className="tw:min-w-0 tw:px-2 tw:text-center"><dt className="tw:text-[9px] tw:font-semibold tw:uppercase tw:tracking-[0.08em] tw:text-muted-foreground">{label}</dt><dd className={cn('tw:mt-1 tw:truncate tw:text-[11px] tw:font-semibold', emphasis ? 'tw:text-primary' : 'tw:text-foreground')}>{value}</dd></div>
}

function formatVisitDate(value: string | null, locale: 'tr' | 'en') {
  if (!value) return locale === 'tr' ? 'Henüz yok' : 'Not yet'
  return new Intl.DateTimeFormat(locale === 'tr' ? 'tr-TR' : 'en-US', { day: 'numeric', month: 'short', timeZone: 'Europe/Istanbul' }).format(new Date(value))
}

function formatElapsed(value: number | null, locale: 'tr' | 'en') {
  if (value === null) return '—'
  return locale === 'tr' ? `${value} gün` : `${value} days`
}

function statusPresentation(row: ChecklistCommandRow, locale: 'tr' | 'en') {
  if (row.pendingBmAcknowledgementCount > 0) return { label: locale === 'tr' ? 'Onay bekliyor' : 'Awaiting approval', className: 'tw:border-chart-4/30 tw:bg-chart-4/10 tw:text-chart-4' }
  if (row.activeBmChecklistCount > 0) return { label: locale === 'tr' ? 'Aktif taslak' : 'Active draft', className: 'tw:border-primary/25 tw:bg-primary/10 tw:text-primary' }
  if (row.status === 'needs_visit') return { label: locale === 'tr' ? 'Ziyaret eksik' : 'Visit missing', className: 'tw:border-destructive/25 tw:bg-destructive/10 tw:text-destructive' }
  if (row.status === 'pending') return { label: locale === 'tr' ? 'Kabul bekliyor' : 'Awaiting acknowledgement', className: 'tw:border-chart-4/30 tw:bg-chart-4/10 tw:text-chart-4' }
  if (row.openActionCount > 0) return { label: locale === 'tr' ? 'Aksiyon takipte' : 'Action in progress', className: 'tw:border-chart-4/30 tw:bg-chart-4/10 tw:text-chart-4' }
  return { label: locale === 'tr' ? 'Tamamlandı' : 'Completed', className: 'tw:border-emerald-500/25 tw:bg-emerald-500/10 tw:text-emerald-700' }
}
