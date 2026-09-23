import { Link } from 'react-router'
import { ArrowDown, ArrowUp, BarChart3, ClipboardCheck, ReceiptText, ShoppingBag, RefreshCw, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from '@/components/ui/empty'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableHeader, TableHead, TableRow, TableBody, TableCell } from '@/components/ui/table'
import { CommandCanvasPage } from '../features/store-command-canvas/primitives'
import type { RankingMetricValue, StoreRankingRow } from '../features/reports/api'
import type { StoreKpiHighlightsPageModel, StoreKpisRegionSortKey } from './store-kpi-highlights-model'
import { getMetricByCode, getMetricComparableValue } from './store-rankings-page-model'
import { StoreKpisPeriodPicker } from './store-kpis-period-picker'
import { StoreKpisPeriodEmpty } from './store-kpis-period-empty'
import './store-kpis-region-command-canvas.css'

const regionMetricCodes = ['TARGET_ACHIEVEMENT', 'ATV', 'UPT', 'CR', 'gsm_approval'] as const
const columns: Array<{ key: StoreKpisRegionSortKey; label: string }> = [
  { key: 'score', label: 'Skor' },
  { key: 'TARGET_ACHIEVEMENT', label: 'HG%' },
  { key: 'ATV', label: 'ATV' },
  { key: 'UPT', label: 'UPT' },
  { key: 'CR', label: 'CR' },
  { key: 'gsm_approval', label: 'GSM' },
  { key: 'BM_CHECKLIST', label: 'BM' },
  { key: 'VM_CHECKLIST', label: 'VM' },
]

export function StoreKpisRegionOverview({ model }: { model: StoreKpiHighlightsPageModel }) {
  const summary = buildRegionSummary(model)
  const total = model.regionOverviewQuery.data?.storeLeaderboard.meta.total ?? 0
  const pageOffset = model.regionOverviewQuery.data?.storeLeaderboard.meta.offset ?? model.regionOverviewPage * model.regionOverviewPageSize
  const displayedPage = Math.floor(pageOffset / model.regionOverviewPageSize)
  const changePage = (page: number) => {
    if (page === model.regionOverviewPage) void model.regionOverviewQuery.refetch()
    else model.setRegionOverviewPage(page)
  }
  const visibleRows = model.regionOverviewRows
  const metrics = [
    { label: 'Bölge Skoru', value: summary.averageScoreLabel, icon: BarChart3 },
    { label: 'Bölge ATV', value: summary.metricAverages.ATV, icon: ReceiptText },
    { label: 'Bölge UPT', value: summary.metricAverages.UPT, icon: ShoppingBag },
    { label: 'Bölge CR', value: summary.metricAverages.CR, icon: RefreshCw },
  ]
  const storeSearch = <InputGroup className="region-performance-header-search">
    <InputGroupAddon><Search aria-hidden="true" /></InputGroupAddon>
    <InputGroupInput aria-label="Mağaza ara" placeholder="Mağaza Ara" value={model.regionOverviewSearch} onChange={event => model.setRegionOverviewSearch(event.target.value)} />
    <InputGroupAddon align="inline-end"><Badge variant="secondary" aria-label={`${total} mağaza`}>{total}</Badge></InputGroupAddon>
  </InputGroup>

  return (
    <CommandCanvasPage ariaLabelledBy="store-kpis-region-title" className="region-performance" testId="store-kpis-region-overview">
      <header className="region-performance-hero tw:relative tw:isolate tw:overflow-visible tw:rounded-[14px] tw:bg-primary tw:px-4 tw:py-4 tw:text-primary-foreground tw:shadow-sm tw:sm:px-5">
        <div aria-hidden="true" className="tw:pointer-events-none tw:absolute tw:inset-0 tw:overflow-hidden tw:rounded-[14px]"><span className="tw:absolute tw:right-3 tw:top-3 tw:size-32 tw:rounded-full tw:border tw:border-white/15" /></div>
        <div className="region-performance-heading tw:relative">
          <div className="tw:flex tw:min-w-0 tw:items-center tw:gap-3">
            <span className="tw:grid tw:size-10 tw:shrink-0 tw:place-items-center tw:rounded-xl tw:border tw:border-white/20 tw:bg-white/10"><BarChart3 aria-hidden="true" className="tw:size-5" /></span>
            <div className="tw:min-w-0">
              <p className="tw:text-[10px] tw:font-semibold tw:uppercase tw:tracking-[0.16em] tw:text-primary-foreground/70">{model.kpiDateRangeEnd ? `${model.regionOverviewActivePeriodStart} – ${model.kpiDateRangeEnd}` : summary.periodLabel} · {total} mağaza</p>
              <h1 id="store-kpis-region-title" className="tw:mt-0.5 tw:text-xl tw:font-semibold tw:tracking-[-0.025em] tw:sm:text-2xl">Bölge Performansı</h1>
              <p className="tw:mt-1 tw:text-xs tw:text-primary-foreground/75">Mağazaların KPI değerlerini karşılaştırın.</p>
            </div>
          </div>
          <RegionPeriodSelect model={model} />
        </div>
      </header>
        <div className="region-performance-metrics" role="group" aria-label="Bölge KPI özeti">
          {metrics.map(({ label, value, icon: Icon }) => (
            <Card key={label} size="sm">
              <CardHeader><CardTitle><Icon aria-hidden="true" /><span>{label}</span></CardTitle></CardHeader>
              <CardContent><strong>{value}</strong></CardContent>
            </Card>
          ))}
        </div>
        {total > visibleRows.length ? <p className="region-performance-coverage">{summary.averageScoreCopy}</p> : null}

      {(model.regionOverviewQuery.isError || model.regionOverviewQuery.failureCount > 0) && model.regionOverviewQuery.data ? (
        <Alert variant="destructive"><AlertDescription>
          {model.t('storeKpis.backgroundError')}
          <Button variant="outline" onClick={() => void model.regionOverviewQuery.refetch()}>{model.t('storeKpis.retry')}</Button>
        </AlertDescription></Alert>
      ) : null}

      <section className="region-performance-stores" aria-label="Mağaza KPI değerleri" aria-busy={model.regionOverviewQuery.isFetching}>
        <div className="region-performance-mobile-controls">
          {storeSearch}
          <div className="region-performance-mobile-sort"><RegionMobileSort model={model} /></div>
        </div>
          <div className="region-performance-desktop">
            <Table aria-label="Mağaza KPI değerleri">
              <colgroup><col />{columns.map(column => <col key={column.key} className="region-performance-metric-column" />)}<col className="region-performance-action-column" /></colgroup>
              <TableHeader><TableRow>
                <TableHead>{storeSearch}</TableHead>
                {columns.map(column => <TableHead key={column.key} aria-sort={model.regionOverviewSort.sortKey === column.key ? (model.regionOverviewSort.sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}><RegionSortButton model={model} column={column} /></TableHead>)}
                <TableHead><span className="tw:sr-only">Mağaza detayı</span></TableHead>
              </TableRow></TableHeader>
              <TableBody>{visibleRows.map(row => <TableRow key={row.storeId}>
                <TableCell><strong>{row.storeName ?? model.t('storeKpis.noStoreScope')}</strong></TableCell>
                <TableCell><span className="region-performance-score">{formatNumber(model.locale, row.scoreValue, model.t('common.noData'), 1)}</span></TableCell>
                {regionMetricCodes.map(code => <TableCell key={code}>{formatRegionMetric(model.locale, model.t('common.noData'), getMetricByCode(row.metrics, code), code)}</TableCell>)}
                <TableCell><ChecklistValue row={row} model={model} code="BM_CHECKLIST" /></TableCell>
                <TableCell><ChecklistValue row={row} model={model} code="VM_CHECKLIST" /></TableCell>
                <TableCell><StoreDetailButton row={row} model={model} /></TableCell>
              </TableRow>)}</TableBody>
            </Table>
          </div>
          <div className="region-performance-mobile">
            {visibleRows.map(row => <article className="region-performance-store" key={row.storeId}>
              <div className="region-performance-store-heading"><h3>{row.storeName ?? model.t('storeKpis.noStoreScope')}</h3><StoreDetailButton row={row} model={model} mobile /></div>
              <dl>
                <div><dt>Skor</dt><dd className="region-performance-score">{formatNumber(model.locale, row.scoreValue, model.t('common.noData'), 1)}</dd></div>
                {regionMetricCodes.map(code => <div key={code}><dt>{columns.find(column => column.key === code)?.label}</dt><dd>{formatRegionMetric(model.locale, model.t('common.noData'), getMetricByCode(row.metrics, code), code)}</dd></div>)}
                <div><dt>BM</dt><dd><ChecklistValue row={row} model={model} code="BM_CHECKLIST" /></dd></div>
                <div><dt>VM</dt><dd><ChecklistValue row={row} model={model} code="VM_CHECKLIST" /></dd></div>
              </dl>
            </article>)}
          </div>
        {visibleRows.length === 0 ? (
          model.regionOverviewSearch.trim()
            ? <Empty><EmptyHeader><EmptyTitle>Sonuç bulunamadı</EmptyTitle><EmptyDescription>Aramanızı değiştirerek tekrar deneyin.</EmptyDescription></EmptyHeader></Empty>
            : <StoreKpisPeriodEmpty locale={model.locale} start={model.regionOverviewActivePeriodStart} end={model.kpiDateRangeEnd} />
        ) : null}
        {total > model.regionOverviewPageSize ? <div className="region-performance-pager">
          <span>{pageOffset + 1}–{Math.min(pageOffset + model.regionOverviewPageSize, total)} / {total}</span>
          <Button variant="outline" disabled={displayedPage === 0 || model.regionOverviewQuery.isFetching} onClick={() => changePage(displayedPage - 1)}>{model.t('storeKpis.companyPrevious')}</Button>
          <Button variant="outline" data-testid="store-kpis-region-next-page" disabled={(displayedPage + 1) * model.regionOverviewPageSize >= total || model.regionOverviewQuery.isFetching} onClick={() => changePage(displayedPage + 1)}>{model.t('storeKpis.companyNext')}</Button>
        </div> : null}
      </section>
    </CommandCanvasPage>
  )
}

function StoreDetailButton({ row, model, mobile = false }: { row: StoreRankingRow; model: StoreKpiHighlightsPageModel; mobile?: boolean }) {
  return <Button asChild size={mobile ? 'lg' : 'xs'} className="checklist-record-history-result-action region-performance-detail tw:min-w-0"><Link aria-label={`${row.storeName ?? model.t('storeKpis.noStoreScope')} — Detay`} to={model.getRegionStoreDetailPath(row.storeId)}><ClipboardCheck aria-hidden="true" /><span>Detay</span></Link></Button>
}

function ChecklistValue({ row, model, code }: { row: StoreRankingRow; model: StoreKpiHighlightsPageModel; code: 'BM_CHECKLIST' | 'VM_CHECKLIST' }) {
  const value = getMetricComparableValue(getMetricByCode(row.metrics, code), code)
  return value === null || value === undefined || !Number.isFinite(value)
    ? <span className="region-performance-missing">{model.t('storeKpis.regionChecklistPassive')}</span>
    : <>{formatNumber(model.locale, value, model.t('common.noData'), 0)}</>
}

function RegionSortButton({ model, column }: { model: StoreKpiHighlightsPageModel; column: (typeof columns)[number] }) {
  const active = model.regionOverviewSort.sortKey === column.key
  const Icon = model.regionOverviewSort.sortDirection === 'asc' ? ArrowUp : ArrowDown
  return <Button variant="ghost" size="sm" aria-label={model.t('storeKpis.regionSortLabel', { column: column.label })} onClick={() => model.setRegionOverviewSort(column.key)}>{column.label}{active ? <Icon aria-hidden="true" data-icon="inline-end" /> : null}</Button>
}

function RegionMobileSort({ model }: { model: StoreKpiHighlightsPageModel }) {
  return <Select value={`${model.regionOverviewSort.sortKey}:${model.regionOverviewSort.sortDirection}`} onValueChange={value => {
    const [key, direction] = value.split(':') as [StoreKpisRegionSortKey, 'asc' | 'desc']
    model.setRegionOverviewSort(key, direction)
  }}><SelectTrigger aria-label="KPI sıralama seçenekleri"><SelectValue /></SelectTrigger><SelectContent><SelectGroup>
    {columns.flatMap(column => ['desc', 'asc'].map(direction => <SelectItem key={`${column.key}:${direction}`} value={`${column.key}:${direction}`}>{column.label} · {direction === 'desc' ? 'Azalan' : 'Artan'}</SelectItem>))}
  </SelectGroup></SelectContent></Select>
}

function RegionPeriodSelect({ model }: { model: StoreKpiHighlightsPageModel }) {
  const periods = model.regionOverviewQuery.data?.availablePeriods.filter(period => period.periodType === 'monthly') ?? []
  return <StoreKpisPeriodPicker onRangeChange={model.setKpiDateRange} ariaLabel={model.t('storeKpis.regionPeriodSelect')} availablePeriodStarts={periods.map(period => period.periodStart)} locale={model.locale} onPeriodStartChange={model.setRegionOverviewPeriodStart} periodStart={model.regionOverviewActivePeriodStart ?? model.regionOverviewQuery.data?.source.periodStart ?? ''} triggerClassName="region-performance-period" />
}
function buildRegionSummary(model: StoreKpiHighlightsPageModel) {
  const ranking = model.regionOverviewSummaryQuery.data
  const rows = ranking?.storeLeaderboard.items ?? []
  const noData = model.t('common.noData')
  const rankingStoreCount = ranking?.storeLeaderboard.meta.total ?? rows.length
  const scopeStoreCount = ranking?.scopeSummary?.storeCount ?? rankingStoreCount
  const scopePersonnelTotal = ranking?.scopeSummary?.activePersonnelCount
  const hasCompleteStoreCoverage = rankingStoreCount > 0 && rows.length >= rankingStoreCount
  const averageScore = hasCompleteStoreCoverage ? average(rows.map((row) => row.scoreValue)) : null
  const metricAverages = Object.fromEntries(
    regionMetricCodes.map((code) => [
      code,
      formatRegionMetricValue(
        model.locale,
        noData,
        hasCompleteStoreCoverage
          ? average(rows.map((row) => getMetricComparableValue(getMetricByCode(row.metrics, code), code)))
          : null,
        code,
      ),
    ]),
  ) as Record<(typeof regionMetricCodes)[number], string>

  return {
    averageScoreLabel: formatNumber(model.locale, averageScore, noData, 0),
    averageScoreCopy: hasCompleteStoreCoverage
      ? model.t('storeKpis.regionAverageScoreCopy', {
          count: formatInteger(model.locale, rankingStoreCount),
        })
      : model.t('storeKpis.regionAverageIncompleteCopy'),
    metricAverages,
    periodLabel: formatMonthLabel(
      model.regionOverviewActivePeriodStart || ranking?.source.periodStart || model.routePeriodStart,
      model.locale,
    ),
    personnelCountLabel:
      scopePersonnelTotal !== undefined
        ? model.t('storeKpis.regionScopeCopy', {
            stores: formatInteger(model.locale, scopeStoreCount),
            personnel: formatInteger(model.locale, scopePersonnelTotal),
          })
        : model.t('storeKpis.regionScopePersonnelUnavailable', {
            stores: formatInteger(model.locale, scopeStoreCount),
          }),
    scoreBadge: model.t(resolveScoreBadgeKey(averageScore)),
    storeCount: scopeStoreCount,
    visibleStoreCount: rows.length,
  }
}

function formatRegionMetric(
  locale: string,
  noData: string,
  metric: RankingMetricValue | undefined,
  code: (typeof regionMetricCodes)[number],
) {
  return formatRegionMetricValue(locale, noData, getMetricComparableValue(metric, code), code)
}

function formatRegionMetricValue(
  locale: string,
  noData: string,
  value: number | null | undefined,
  code: (typeof regionMetricCodes)[number],
) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return noData
  }

  if (code === 'TARGET_ACHIEVEMENT' || code === 'CR') {
    return `%${formatNumber(locale, value * 100, noData, 1)}`
  }

  if (code === 'gsm_approval') {
    return `%${formatNumber(locale, value, noData, 1)}`
  }

  if (code === 'ATV') {
    return new Intl.NumberFormat(locale, {
      currency: 'TRY',
      maximumFractionDigits: 0,
      style: 'currency',
    }).format(value)
  }

  if (code === 'UPT') {
    return new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)
  }

  return formatNumber(locale, value, noData, 1)
}

function formatNumber(
  locale: string,
  value: number | null | undefined,
  noData: string,
  maximumFractionDigits = 1,
) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return noData
  }

  return new Intl.NumberFormat(locale, {
    maximumFractionDigits,
    minimumFractionDigits: 0,
  }).format(value)
}

function formatInteger(locale: string, value: number) {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value)
}

function average(values: Array<number | null | undefined>) {
  const numericValues = values.filter(
    (value): value is number => value !== null && value !== undefined && Number.isFinite(value),
  )

  if (!numericValues.length) {
    return null
  }

  return numericValues.reduce((total, value) => total + value, 0) / numericValues.length
}

function formatMonthLabel(periodStart: string | undefined, locale: string) {
  if (!periodStart) {
    return 'Son aylık dönem'
  }

  return new Intl.DateTimeFormat(locale, {
    month: 'long',
    timeZone: 'UTC',
    year: 'numeric',
  }).format(parsePeriodStartAsUtcDate(periodStart))
}

function parsePeriodStartAsUtcDate(periodStart: string) {
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(periodStart)
  if (!dateOnlyMatch) {
    return new Date(periodStart)
  }

  const [, year, month, day] = dateOnlyMatch
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)))
}

function resolveScoreBadgeKey(score: number | null) {
  if (score === null) return 'storeKpis.regionScoreUnknownBadge'
  if (score >= 56) return 'storeKpis.regionScoreStableBadge'
  if (score >= 49) return 'storeKpis.regionScoreWatchBadge'
  return 'storeKpis.regionScoreRiskBadge'
}
