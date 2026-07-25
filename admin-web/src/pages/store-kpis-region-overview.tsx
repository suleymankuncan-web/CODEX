import { useDeferredValue, useMemo, useState } from 'react'
import { Link } from 'react-router'
import {
  AlertCircle,
  BarChart3,
  ChevronDown,
  ChevronUp,
  Search,
  Target,
  Store as StoreIcon,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  CommandCanvasDataList,
  CommandCanvasFilterBar,
  CommandCanvasMetricFilter,
  CommandCanvasMetricRail,
  CommandCanvasPage,
  CommandCanvasPageHeader,
} from '../features/store-command-canvas/primitives'
import type { RankingMetricValue, StoreRankingRow } from '../features/reports/api'
import type {
  StoreKpiHighlightsPageModel,
  StoreKpisRegionSortKey,
} from './store-kpi-highlights-model'
import {
  getMetricByCode,
  getMetricComparableValue,
} from './store-rankings-page-model'
import { StoreKpisPeriodPicker } from './store-kpis-period-picker'
import { StoreEmptyState } from './store-surface-primitives'
import './store-kpis-region-command-canvas.css'

const regionMetricCodes = ['TARGET_ACHIEVEMENT', 'UPT', 'ATV', 'CR', 'gsm_approval'] as const
const rowGridClass =
  'kpi-command-store-grid tw:grid tw:items-center'

export function StoreKpisRegionOverview({ model }: { model: StoreKpiHighlightsPageModel }) {
  const [query, setQuery] = useState('')
  const [riskOnly, setRiskOnly] = useState(false)
  const [rail, setRail] = useState<'stores' | 'score' | 'target' | 'risk'>('stores')
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase(model.locale))
  const summary = buildRegionSummary(model)
  const regionMeta = model.regionOverviewQuery.data?.storeLeaderboard.meta
  const regionTotal = regionMeta?.total ?? 0
  const regionHasPrevious = model.regionOverviewPage > 0
  const regionHasNext =
    (model.regionOverviewPage + 1) * model.regionOverviewPageSize < regionTotal
  const riskCount = model.regionOverviewRows.filter(
    (row) => typeof row.scoreValue === 'number' && row.scoreValue < 75,
  ).length
  const isPageScoped = regionTotal > model.regionOverviewRows.length
  const visibleRows = useMemo(
    () =>
      model.regionOverviewRows.filter((row) => {
        const matchesQuery =
          !deferredQuery ||
          (row.storeName ?? '').toLocaleLowerCase(model.locale).includes(deferredQuery)
        const matchesRisk =
          !riskOnly || (typeof row.scoreValue === 'number' && row.scoreValue < 75)
        return matchesQuery && matchesRisk
      }),
    [deferredQuery, model.locale, model.regionOverviewRows, riskOnly],
  )

  return (
    <CommandCanvasPage
      ariaLabelledBy="store-kpis-region-title"
      className="kpi-command-page"
      testId="store-kpis-region-overview"
    >
      <CommandCanvasPageHeader
        title="KPI Özetleri"
        titleId="store-kpis-region-title"
        eyebrow={`Bölge görünümü · ${summary.periodLabel}`}
        description="Mağaza seçerek KPI çalışma alanına ilerleyin."
        actions={<RegionPeriodSelect model={model} />}
      />
      {(model.regionOverviewQuery.isError || model.regionOverviewQuery.failureCount > 0) &&
      model.regionOverviewQuery.data ? <RegionBackgroundError model={model} /> : null}

      <CommandCanvasMetricRail ariaLabel="Bölge KPI özeti">
        <CommandCanvasMetricFilter
          label="Toplam mağaza"
          value={formatInteger(model.locale, summary.storeCount)}
          note="Yetkili mağazalar"
          icon={<StoreIcon size={16} />}
          active={rail === 'stores'}
          onClick={() => { setRail('stores'); setRiskOnly(false); setQuery('') }}
        />
        <CommandCanvasMetricFilter
          label="Ortalama skor"
          value={summary.averageScoreLabel}
          note="Aylık sonuç"
          icon={<BarChart3 size={16} />}
          tone="cyan"
          active={rail === 'score'}
          onClick={() => { setRail('score'); setRiskOnly(false); model.setRegionOverviewSort('score') }}
        />
        <CommandCanvasMetricFilter
          label="Hedef gerçekleşme"
          value={summary.metricAverages.TARGET_ACHIEVEMENT}
          note="Bölge ortalaması"
          icon={<Target size={16} />}
          tone="mint"
          active={rail === 'target'}
          onClick={() => { setRail('target'); setRiskOnly(false); model.setRegionOverviewSort('TARGET_ACHIEVEMENT') }}
        />
        <CommandCanvasMetricFilter
          label={isPageScoped ? 'Bu sayfada takip' : 'Yakın takip'}
          value={String(riskCount)}
          note={isPageScoped ? 'Yüklü mağazalarda skor <75' : 'Mağaza skoru <75'}
          icon={<AlertCircle size={16} />}
          tone="rose"
          active={rail === 'risk'}
          onClick={() => { const next = rail !== 'risk'; setRail(next ? 'risk' : 'stores'); setRiskOnly(next) }}
        />
      </CommandCanvasMetricRail>

      <CommandCanvasFilterBar
        updatingLabel="KPI görünümü güncelleniyor"
        isUpdating={model.regionOverviewQuery.isFetching}
        search={<label className="kpi-command-search"><Search aria-hidden="true" size={15} /><Input aria-label={isPageScoped ? 'Bu sayfada mağaza ara' : 'Mağaza ara'} placeholder={isPageScoped ? 'Bu sayfada mağaza ara' : 'Mağaza ara'} value={query} onChange={(event) => setQuery(event.target.value)} /></label>}
        controls={<>
          <Button variant="outline" onClick={() => model.setRegionOverviewSort('score')}>Skor</Button>
          <Button variant={riskOnly ? 'secondary' : 'outline'} onClick={() => { setRiskOnly((value) => !value); setRail(riskOnly ? 'stores' : 'risk') }}>Risk durumu</Button>
        </>}
      />

      <RegionMobileSort model={model} />

      <div className="kpi-command-list-title">
        <h2>{model.t('storeKpis.regionStoresTitle')}</h2>
        <span>{visibleRows.length} mağaza</span>
      </div>
      <CommandCanvasDataList
        ariaLabel={model.t('storeKpis.regionStoresTitle')}
        className="kpi-command-list"
        header={<div className={`${rowGridClass} kpi-command-list-head`}>
          <span>{model.t('storeKpis.regionStoreColumn')}</span>
          <RegionSortButton label={model.t('storeKpis.regionScoreColumn')} model={model} sortKey="score" centered />
          <RegionSortButton label="HG%" model={model} sortKey="TARGET_ACHIEVEMENT" centered />
          <RegionSortButton label="UPT" model={model} sortKey="UPT" centered />
          <RegionSortButton label="ATV" model={model} sortKey="ATV" centered />
          <RegionSortButton label="CR" model={model} sortKey="CR" centered />
          <RegionSortButton label="GSM Onayı" model={model} sortKey="gsm_approval" centered />
          <RegionSortButton label="BM" model={model} sortKey="BM_CHECKLIST" centered />
          <RegionSortButton label="VM" model={model} sortKey="VM_CHECKLIST" centered />
        </div>}
        footer={regionHasPrevious || regionHasNext ? <KpiPager model={model} regionHasPrevious={regionHasPrevious} regionHasNext={regionHasNext} regionTotal={regionTotal} /> : undefined}
      >
        {visibleRows.length === 0 ? <StoreEmptyState title="Sonuç bulunamadı" description={isPageScoped ? 'Bu sayfadaki filtreleri değiştirin veya diğer mağaza sayfasına geçin.' : 'Filtreleri değiştirerek tekrar deneyin.'} titleAsHeading /> : <>
          <div className="kpi-command-desktop-rows">
            {visibleRows.map((row) => <RegionStoreRow key={row.storeId} model={model} row={row} />)}
          </div>
          <div className="kpi-command-mobile-rows">
            {visibleRows.map((row) => <RegionStoreMobileCard key={row.storeId} model={model} row={row} />)}
          </div>
        </>}
      </CommandCanvasDataList>
    </CommandCanvasPage>
  )
}

const mobileSortOptions: Array<{ key: StoreKpisRegionSortKey; label: string }> = [
  { key: 'score', label: 'Skor' },
  { key: 'TARGET_ACHIEVEMENT', label: 'HG%' },
  { key: 'UPT', label: 'UPT' },
  { key: 'ATV', label: 'ATV' },
  { key: 'CR', label: 'CR' },
  { key: 'gsm_approval', label: 'GSM Onayı' },
  { key: 'BM_CHECKLIST', label: 'BM' },
  { key: 'VM_CHECKLIST', label: 'VM' },
]

function RegionMobileSort({ model }: { model: StoreKpiHighlightsPageModel }) {
  const value = `${model.regionOverviewSort.sortKey}:${model.regionOverviewSort.sortDirection}`

  return (
    <div className="kpi-command-mobile-sort">
      <Select
        value={value}
        onValueChange={(next) => {
          const [sortKey, sortDirection] = next.split(':') as [
            StoreKpisRegionSortKey,
            'asc' | 'desc',
          ]
          model.setRegionOverviewSort(sortKey, sortDirection)
        }}
      >
        <SelectTrigger aria-label="KPI sıralama seçenekleri">
          <SelectValue placeholder="Sıralama" />
        </SelectTrigger>
        <SelectContent>
          {mobileSortOptions.flatMap((option) => [
            <SelectItem key={`${option.key}:desc`} value={`${option.key}:desc`}>
              {option.label} · Azalan
            </SelectItem>,
            <SelectItem key={`${option.key}:asc`} value={`${option.key}:asc`}>
              {option.label} · Artan
            </SelectItem>,
          ])}
        </SelectContent>
      </Select>
    </div>
  )
}

function RegionBackgroundError({ model }: { model: StoreKpiHighlightsPageModel }) {
  return <div role="alert" className="tw:flex tw:flex-wrap tw:items-center tw:justify-between tw:gap-3 tw:rounded-xl tw:border tw:border-destructive/20 tw:bg-destructive/5 tw:p-3 tw:text-sm"><span>{model.t('storeKpis.backgroundError')}</span><button type="button" className="tw:min-h-11 tw:rounded-xl tw:border tw:border-border tw:bg-white tw:px-3 tw:font-semibold" onClick={() => void model.regionOverviewQuery.refetch()}>{model.t('storeKpis.retry')}</button></div>
}

function RegionPeriodSelect({ model }: { model: StoreKpiHighlightsPageModel }) {
  const monthlyPeriods =
    model.regionOverviewQuery.data?.availablePeriods.filter(
      (period) => period.periodType === 'monthly',
    ) ?? []
  const activePeriodStart =
    model.regionOverviewActivePeriodStart ??
    model.regionOverviewQuery.data?.source.periodStart ??
    ''

  return (
    <StoreKpisPeriodPicker
      ariaLabel={model.t('storeKpis.regionPeriodSelect')}
      availablePeriodStarts={monthlyPeriods.map((period) => period.periodStart)}
      locale={model.locale}
      onPeriodStartChange={model.setRegionOverviewPeriodStart}
      periodStart={activePeriodStart}
      triggerClassName="command-canvas-period-trigger"
    />
  )
}

function KpiPager(input: {
  model: StoreKpiHighlightsPageModel
  regionHasPrevious: boolean
  regionHasNext: boolean
  regionTotal: number
}) {
  return <>
    <span className="kpi-command-pager-count">
      {input.regionTotal === 0 ? 0 : input.model.regionOverviewPage * input.model.regionOverviewPageSize + 1}-
      {Math.min((input.model.regionOverviewPage + 1) * input.model.regionOverviewPageSize, input.regionTotal)} / {input.regionTotal}
    </span>
    <Button variant="outline" size="sm" disabled={!input.regionHasPrevious} onClick={() => input.model.setRegionOverviewPage(Math.max(0, input.model.regionOverviewPage - 1))}>{input.model.t('storeKpis.companyPrevious')}</Button>
    <Button variant="outline" size="sm" data-testid="store-kpis-region-next-page" disabled={!input.regionHasNext} onClick={() => input.model.setRegionOverviewPage(input.model.regionOverviewPage + 1)}>{input.model.t('storeKpis.companyNext')}</Button>
  </>
}

function RegionSortButton(input: {
  centered?: boolean
  label: string
  model: StoreKpiHighlightsPageModel
  sortKey: StoreKpisRegionSortKey
  touch?: boolean
}) {
  const active = input.model.regionOverviewSort.sortKey === input.sortKey
  const direction = input.model.regionOverviewSort.sortDirection

  return (
    <button
      type="button"
      aria-label={input.model.t('storeKpis.regionSortLabel', { column: input.label })}
      className={`tw:inline-flex tw:items-center ${input.touch ? 'tw:min-h-11 tw:shrink-0 tw:rounded-xl tw:border tw:border-[var(--store-command-line)] tw:bg-white tw:px-3' : 'tw:border-0 tw:bg-transparent tw:p-0'} ${
        input.centered ? 'tw:justify-center tw:text-center' : 'tw:justify-start'
      } tw:text-[10px] tw:font-bold tw:uppercase tw:tracking-[0.035em] ${
        active ? 'tw:text-[var(--store-command-plum)]' : 'tw:text-inherit'
      }`}
      onClick={() => input.model.setRegionOverviewSort(input.sortKey)}
    >
      <span>{input.label}</span>
      {active ? (
        direction === 'desc' ? (
          <ChevronDown aria-hidden="true" className="tw:ml-1 tw:size-3" />
        ) : (
          <ChevronUp aria-hidden="true" className="tw:ml-1 tw:size-3" />
        )
      ) : null}
    </button>
  )
}

function RegionStoreRow({ model, row }: { model: StoreKpiHighlightsPageModel; row: StoreRankingRow }) {
  const noData = model.t('common.noData')
  const storeName = row.storeName ?? model.t('storeKpis.noStoreScope')

  return (
    <Link
      aria-label={model.t('storeKpis.regionOpenStoreLabel', { store: storeName })}
      className={`${rowGridClass} kpi-command-store-row`}
      to={model.getRegionStoreDetailPath(row.storeId)}
    >
      <div className="tw:flex tw:min-w-0 tw:items-center tw:gap-2.5">
        <span className="tw:grid tw:size-9 tw:flex-none tw:place-items-center tw:rounded-[0.9rem] tw:bg-[var(--store-command-plum-soft)] tw:text-[var(--store-command-plum)]">
          <StoreIcon className="tw:size-5" />
        </span>
        <strong className="tw:block tw:truncate tw:text-sm tw:font-semibold tw:text-[var(--store-command-ink)]">
          {storeName}
        </strong>
      </div>
      <span className="tw:inline-flex tw:min-h-[30px] tw:min-w-[46px] tw:items-center tw:justify-center tw:rounded-full tw:bg-white tw:px-2 tw:text-[13px] tw:font-semibold tw:text-[var(--store-command-ink)] tw:shadow-[inset_0_0_0_1px_var(--store-command-line)]">
        {formatNumber(model.locale, row.scoreValue, noData, 1)}
      </span>
      {regionMetricCodes.map((code) => (
        <MetricMini
          key={code}
          code={code}
          locale={model.locale}
          metric={getMetricByCode(row.metrics, code)}
          noData={noData}
        />
      ))}
      <ChecklistChip label="BM" metric={getMetricByCode(row.metrics, 'BM_CHECKLIST')} model={model} />
      <ChecklistChip label="VM" metric={getMetricByCode(row.metrics, 'VM_CHECKLIST')} model={model} />
    </Link>
  )
}

function RegionStoreMobileCard({ model, row }: { model: StoreKpiHighlightsPageModel; row: StoreRankingRow }) {
  const noData = model.t('common.noData')
  const storeName = row.storeName ?? model.t('storeKpis.noStoreScope')

  return (
    <Link
      aria-label={model.t('storeKpis.regionOpenStoreLabel', { store: storeName })}
      className="kpi-command-mobile-row"
      to={model.getRegionStoreDetailPath(row.storeId)}
    >
      <span className="kpi-command-mobile-store-icon">
        <StoreIcon className="tw:size-5" />
      </span>
      <strong className="kpi-command-mobile-store-name">{storeName}</strong>
      <span className="kpi-command-mobile-score">
        <small>Skor</small>
        <strong>{formatNumber(model.locale, row.scoreValue, noData, 1)}</strong>
      </span>
      <div className="kpi-command-mobile-facts">
        {regionMetricCodes.map((code) => (
          <span key={code}>
            <small>{getMobileMetricLabel(code)}</small>
            <strong>{formatRegionMetric(model.locale, noData, getMetricByCode(row.metrics, code), code)}</strong>
          </span>
        ))}
      </div>
      <div className="kpi-command-mobile-checklists">
        <ChecklistChip label="BM" metric={getMetricByCode(row.metrics, 'BM_CHECKLIST')} model={model} />
        <ChecklistChip label="VM" metric={getMetricByCode(row.metrics, 'VM_CHECKLIST')} model={model} />
      </div>
    </Link>
  )
}

function getMobileMetricLabel(code: (typeof regionMetricCodes)[number]) {
  if (code === 'TARGET_ACHIEVEMENT') return 'HG%'
  if (code === 'gsm_approval') return 'GSM'
  return code
}

function MetricMini(input: {
  code: (typeof regionMetricCodes)[number]
  locale: string
  metric: RankingMetricValue | undefined
  noData: string
}) {
  return (
    <div className="tw:text-center">
      <strong className="tw:block tw:text-[13px] tw:font-semibold tw:text-[var(--store-command-ink)]">
        {formatRegionMetric(input.locale, input.noData, input.metric, input.code)}
      </strong>
    </div>
  )
}

function ChecklistChip(input: {
  label: 'BM' | 'VM'
  metric: RankingMetricValue | undefined
  model: StoreKpiHighlightsPageModel
}) {
  const value = getMetricComparableValue(input.metric, `${input.label}_CHECKLIST`)

  if (value === null || value === undefined || !Number.isFinite(value)) {
    return (
      <span className="tw:inline-flex tw:min-h-7 tw:items-center tw:justify-self-center tw:rounded-full tw:bg-[var(--store-command-danger-soft)] tw:px-2.5 tw:text-xs tw:font-semibold tw:text-[var(--store-command-danger)]">
        {input.label} {input.model.t('storeKpis.regionChecklistPassive')}
      </span>
    )
  }

  return (
    <span className="tw:inline-flex tw:min-h-7 tw:items-center tw:justify-self-center tw:rounded-full tw:bg-[var(--store-command-mint-soft)] tw:px-2.5 tw:text-xs tw:font-semibold tw:text-[var(--store-command-success-ink)]">
      {input.label} <b className="tw:ml-1 tw:font-semibold">{formatNumber(input.model.locale, value, input.model.t('common.noData'), 0)}</b>
    </span>
  )
}

function buildRegionSummary(model: StoreKpiHighlightsPageModel) {
  const ranking = model.regionOverviewQuery.data
  const rows = model.regionOverviewRows
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
  if (score >= 80) return 'storeKpis.regionScoreStableBadge'
  if (score >= 70) return 'storeKpis.regionScoreWatchBadge'
  return 'storeKpis.regionScoreRiskBadge'
}
