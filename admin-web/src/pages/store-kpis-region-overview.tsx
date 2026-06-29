import { Link } from 'react-router-dom'
import {
  Activity,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Gauge,
  Map,
  ShieldCheck,
  Store as StoreIcon,
  type LucideIcon,
} from 'lucide-react'
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
import { StoreEmptyState, StoreSurfacePage } from './store-surface-primitives'

const regionMetricCodes = ['TARGET_ACHIEVEMENT', 'UPT', 'ATV', 'CR', 'gsm_approval'] as const
const rowGridClass =
  'tw:grid tw:grid-cols-[minmax(240px,0.9fr)_52px_repeat(5,minmax(70px,0.24fr))_minmax(92px,0.28fr)_minmax(92px,0.28fr)_minmax(62px,auto)] tw:items-center tw:gap-2.5'
const regionStoreActionClass =
  'store-command-soft-action tw:inline-flex tw:h-9 tw:items-center tw:justify-center tw:gap-1.5 tw:rounded-xl tw:border tw:px-3 tw:text-sm tw:font-semibold tw:transition'

export function StoreKpisRegionOverview({ model }: { model: StoreKpiHighlightsPageModel }) {
  const summary = buildRegionSummary(model)

  return (
    <StoreSurfacePage
      ariaLabel={model.t('storeKpis.regionCommandTitle')}
      testId="store-kpis-region-overview"
    >
      <div className="tw:mx-auto tw:grid tw:max-w-[1420px] tw:gap-4">
        <header className="tw:grid tw:items-start tw:gap-4 tw:lg:grid-cols-[minmax(0,1fr)_auto]">
          <section className="tw:grid tw:min-h-24 tw:content-center tw:gap-2.5 tw:rounded-[1.5rem] tw:border tw:border-[#c8d4e7]/70 tw:bg-[linear-gradient(110deg,rgba(255,255,255,0.9),rgba(230,250,255,0.78)),radial-gradient(circle_at_4%_8%,rgba(109,76,255,0.16),transparent_32%)] tw:p-5 tw:shadow-[0_22px_60px_rgba(40,55,93,0.14)]">
            <h1 className="tw:text-3xl tw:font-semibold tw:leading-none tw:tracking-[-0.03em] tw:text-[#071332] tw:sm:text-4xl">
              {model.t('storeKpis.regionCommandTitle')}
            </h1>
            <div className="tw:flex tw:flex-wrap tw:gap-2">
              <RegionMeta label={model.t('storeKpis.regionCommandKpiView')} />
              <RegionMeta label={model.t('storeKpis.regionOverviewStoreCount', { count: summary.storeCount })} />
              <RegionMeta label={summary.periodLabel} />
            </div>
          </section>
          <div className="tw:flex tw:flex-wrap tw:gap-2 tw:lg:justify-end">
            <RegionPeriodSelect model={model} />
            <RegionToolbarChip icon={Map} label={model.t('storeKpis.regionCommandManagerScope')} />
            <RegionToolbarChip icon={ShieldCheck} label={model.t('storeKpis.regionCommandScope')} />
          </div>
        </header>

        <section className="tw:grid tw:max-w-[1040px] tw:grid-cols-2 tw:gap-3 tw:md:grid-cols-3">
          <RegionSummaryCard
            badge={summary.scoreBadge}
            icon={Gauge}
            iconTone="plum"
            label={model.t('storeKpis.regionAverageScore')}
            value={summary.averageScoreLabel}
            subline={summary.averageScoreCopy}
          />
          <RegionSummaryCard
            badge={model.t('storeKpis.regionScopeBadge')}
            icon={StoreIcon}
            iconTone="cyan"
            label={model.t('storeKpis.regionScopeTitle')}
            value={formatInteger(model.locale, summary.storeCount)}
            subline={summary.personnelCountLabel}
          />
          <article className="tw:min-h-[118px] tw:rounded-[1.45rem] tw:border tw:border-[#dce4f1] tw:bg-white/[0.84] tw:p-4 tw:shadow-[0_12px_34px_rgba(40,55,93,0.10)]">
            <div className="tw:flex tw:items-center tw:justify-between tw:gap-3">
              <span className="tw:grid tw:size-10 tw:place-items-center tw:rounded-[0.9rem] tw:bg-[#fff0dc] tw:text-[#f08a00]">
                <Activity className="tw:size-5" />
              </span>
              <span className="tw:rounded-full tw:bg-[#fff0dc] tw:px-2.5 tw:py-1 tw:text-[11px] tw:font-semibold tw:text-[#a35b00]">
                {model.t('storeKpis.regionAverageBadge')}
              </span>
            </div>
            <p className="tw:mt-3 tw:text-xs tw:font-medium tw:text-[#7a839f]">
              {model.t('storeKpis.regionKpiAverageTitle')}
            </p>
            <div className="tw:mt-3 tw:grid tw:grid-cols-2 tw:gap-1.5 tw:md:grid-cols-5">
              {regionMetricCodes.map((code) => (
                <div
                  key={code}
                  className="tw:rounded-[0.9rem] tw:border tw:border-[#e0e5f2]/80 tw:bg-white/70 tw:p-2 tw:text-center"
                >
                  <span className="tw:block tw:text-[10px] tw:font-medium tw:text-[#8a94ad]">
                    {getRegionMetricLabel(code)}
                  </span>
                  <strong className="tw:mt-1 tw:block tw:text-[13px] tw:font-semibold tw:tracking-[-0.02em] tw:text-[#071332]">
                    {summary.metricAverages[code]}
                  </strong>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="tw:max-w-[1040px] tw:overflow-hidden tw:rounded-[1.55rem] tw:border tw:border-[#dce4f1] tw:bg-white/[0.84] tw:shadow-[0_12px_34px_rgba(40,55,93,0.10)]">
          <div className="tw:flex tw:min-h-[68px] tw:items-center tw:justify-between tw:gap-3 tw:border-b tw:border-[#dce4f1] tw:p-4">
            <div>
              <h2 className="tw:m-0 tw:text-lg tw:font-semibold tw:tracking-[-0.02em] tw:text-[#071332]">
                {model.t('storeKpis.regionStoresTitle')}
              </h2>
              <p className="tw:mt-1 tw:text-xs tw:font-normal tw:text-[#65708d]">
                {model.t('storeKpis.regionStoresCopy')}
              </p>
            </div>
            <span className="tw:rounded-full tw:bg-[#dcfbff] tw:px-3 tw:py-1.5 tw:text-xs tw:font-semibold tw:text-[#087f91]">
              {model.t('storeKpis.regionOverviewStoreCount', {
                count: summary.visibleStoreCount,
              })}
            </span>
          </div>
          {model.regionOverviewRows.length > 0 ? (
            <>
            <div className="tw:hidden tw:overflow-x-auto tw:md:block">
              <div className="tw:min-w-[980px]">
                <div
                  className={`${rowGridClass} tw:border-b tw:border-[#dce4f1] tw:px-3.5 tw:py-3 tw:text-[10px] tw:font-bold tw:uppercase tw:tracking-[0.035em] tw:text-[#667194]`}
                >
                  <span>{model.t('storeKpis.regionStoreColumn')}</span>
                  <RegionSortButton label={model.t('storeKpis.regionScoreColumn')} model={model} sortKey="score" centered />
                  <RegionSortButton label="HG%" model={model} sortKey="TARGET_ACHIEVEMENT" centered />
                  <RegionSortButton label="UPT" model={model} sortKey="UPT" centered />
                  <RegionSortButton label="ATV" model={model} sortKey="ATV" centered />
                  <RegionSortButton label="CR" model={model} sortKey="CR" centered />
                  <RegionSortButton label="GSM Onayı" model={model} sortKey="gsm_approval" centered />
                  <RegionSortButton label="BM Checklist" model={model} sortKey="BM_CHECKLIST" centered />
                  <RegionSortButton label="VM Checklist" model={model} sortKey="VM_CHECKLIST" centered />
                  <span className="tw:text-center">{model.t('storeKpis.regionActionColumn')}</span>
                </div>
                <div className="tw:grid tw:px-3.5 tw:pb-3">
                  {model.regionOverviewRows.map((row) => (
                    <RegionStoreRow key={row.storeId} model={model} row={row} />
                  ))}
                </div>
              </div>
            </div>
            <div className="tw:grid tw:px-4 tw:pb-4 tw:md:hidden">
              {model.regionOverviewRows.map((row) => (
                <RegionStoreMobileCard key={row.storeId} model={model} row={row} />
              ))}
            </div>
            </>
          ) : (
            <div className="tw:p-5">
              <StoreEmptyState
                title={model.t('storeKpis.regionOverviewEmptyTitle')}
                description={model.t('storeKpis.regionOverviewEmptyCopy')}
                titleAsHeading
              />
            </div>
          )}
        </section>
      </div>
    </StoreSurfacePage>
  )
}

function RegionMeta({ label }: { label: string }) {
  return (
    <span className="tw:inline-flex tw:min-h-6 tw:items-center tw:rounded-full tw:bg-white/80 tw:px-2.5 tw:text-[11px] tw:font-medium tw:text-[#59627f]">
      {label}
    </span>
  )
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
      triggerClassName="tw:min-h-10 tw:rounded-[0.95rem] tw:border-[#dce4f1] tw:bg-white/85 tw:px-3 tw:text-xs tw:font-medium tw:text-[#071332]"
    />
  )
}

function RegionToolbarChip(input: {
  icon: LucideIcon
  label: string
}) {
  const Icon = input.icon

  return (
    <span className="tw:inline-flex tw:min-h-10 tw:items-center tw:gap-2 tw:rounded-[0.95rem] tw:border tw:border-[#dce4f1] tw:bg-white/85 tw:px-3 tw:text-xs tw:font-medium tw:text-[#071332]">
      <Icon className="tw:size-4" />
      {input.label}
    </span>
  )
}

function RegionSummaryCard(input: {
  badge: string
  icon: LucideIcon
  iconTone: 'plum' | 'cyan'
  label: string
  subline: string
  value: string
}) {
  const Icon = input.icon
  const toneClass =
    input.iconTone === 'cyan'
      ? 'tw:bg-[#dcfbff] tw:text-[#0697aa]'
      : 'tw:bg-[#efe8ff] tw:text-[#6d4cff]'

  return (
    <article className="tw:min-h-[118px] tw:rounded-[1.45rem] tw:border tw:border-[#dce4f1] tw:bg-white/[0.84] tw:p-4 tw:shadow-[0_12px_34px_rgba(40,55,93,0.10)]">
      <div className="tw:flex tw:items-center tw:justify-between tw:gap-3">
        <span className={`tw:grid tw:size-10 tw:place-items-center tw:rounded-[0.9rem] ${toneClass}`}>
          <Icon className="tw:size-5" />
        </span>
        <span className="tw:rounded-full tw:bg-[#ddf8ed] tw:px-2.5 tw:py-1 tw:text-[11px] tw:font-semibold tw:text-[#087751]">
          {input.badge}
        </span>
      </div>
      <p className="tw:mt-3 tw:text-xs tw:font-medium tw:text-[#7a839f]">{input.label}</p>
      <div className="tw:mt-1 tw:text-[31px] tw:font-semibold tw:leading-none tw:tracking-[-0.04em] tw:text-[#071332]">
        {input.value}
      </div>
      <p className="tw:mt-2 tw:text-xs tw:font-normal tw:text-[#65708d]">{input.subline}</p>
    </article>
  )
}

function RegionSortButton(input: {
  centered?: boolean
  label: string
  model: StoreKpiHighlightsPageModel
  sortKey: StoreKpisRegionSortKey
}) {
  const active = input.model.regionOverviewSort.sortKey === input.sortKey
  const direction = input.model.regionOverviewSort.sortDirection

  return (
    <button
      type="button"
      aria-label={input.model.t('storeKpis.regionSortLabel', { column: input.label })}
      className={`tw:inline-flex tw:items-center ${
        input.centered ? 'tw:justify-center tw:text-center' : 'tw:justify-start'
      } tw:border-0 tw:bg-transparent tw:p-0 tw:text-[10px] tw:font-bold tw:uppercase tw:tracking-[0.035em] ${
        active ? 'tw:text-[#6d4cff]' : 'tw:text-inherit'
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
    <article className={`${rowGridClass} tw:min-h-[62px] tw:border-b tw:border-[#dce4f1] tw:bg-transparent tw:py-2 last:tw:border-b-0`}>
      <div className="tw:flex tw:min-w-0 tw:items-center tw:gap-2.5">
        <span className="tw:grid tw:size-9 tw:flex-none tw:place-items-center tw:rounded-[0.9rem] tw:bg-[#efe8ff] tw:text-[#6d4cff]">
          <StoreIcon className="tw:size-5" />
        </span>
        <strong className="tw:block tw:truncate tw:text-sm tw:font-semibold tw:text-[#071332]">
          {storeName}
        </strong>
      </div>
      <span className="tw:inline-flex tw:min-h-[30px] tw:min-w-[46px] tw:items-center tw:justify-center tw:rounded-full tw:bg-white tw:px-2 tw:text-[13px] tw:font-semibold tw:text-[#071332] tw:shadow-[inset_0_0_0_1px_#dce4f1]">
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
      <Link
        aria-label={model.t('storeKpis.regionOpenStoreLabel', { store: storeName })}
        className={regionStoreActionClass}
        to={model.getRegionStoreDetailPath(row.storeId)}
      >
        {model.t('storeKpis.regionOpenAction')}
        <ArrowRight className="tw:size-4" />
      </Link>
    </article>
  )
}

function RegionStoreMobileCard({ model, row }: { model: StoreKpiHighlightsPageModel; row: StoreRankingRow }) {
  const noData = model.t('common.noData')
  const storeName = row.storeName ?? model.t('storeKpis.noStoreScope')

  return (
    <article className="tw:grid tw:grid-cols-[42px_minmax(0,1fr)_minmax(112px,auto)] tw:items-center tw:gap-2.5 tw:border-b tw:border-[#dce4f1] tw:py-3 last:tw:border-b-0">
      <span className="tw:grid tw:size-9 tw:place-items-center tw:rounded-[0.9rem] tw:bg-[#efe8ff] tw:text-[#6d4cff]">
        <StoreIcon className="tw:size-5" />
      </span>
      <strong className="tw:min-w-0 tw:text-sm tw:font-semibold tw:leading-tight tw:text-[#071332]">
        {storeName}
      </strong>
      <span className="tw:inline-flex tw:min-h-[30px] tw:min-w-[112px] tw:items-center tw:justify-center tw:rounded-full tw:bg-white tw:px-3 tw:text-[13px] tw:font-semibold tw:text-[#071332] tw:shadow-[inset_0_0_0_1px_#dce4f1]">
        {formatNumber(model.locale, row.scoreValue, noData, 1)}
      </span>
      <div className="tw:col-start-2 tw:col-end-4 tw:grid tw:grid-cols-2 tw:gap-x-3 tw:gap-y-2 tw:pt-1 tw:text-center">
        {regionMetricCodes.map((code) => (
          <strong key={code} className="tw:text-[13px] tw:font-semibold tw:text-[#071332]">
            {formatRegionMetric(model.locale, noData, getMetricByCode(row.metrics, code), code)}
          </strong>
        ))}
      </div>
      <div className="tw:col-span-2 tw:col-start-1 tw:flex tw:gap-1.5 tw:pt-1">
        <ChecklistChip label="BM" metric={getMetricByCode(row.metrics, 'BM_CHECKLIST')} model={model} />
        <ChecklistChip label="VM" metric={getMetricByCode(row.metrics, 'VM_CHECKLIST')} model={model} />
      </div>
      <Link
        aria-label={model.t('storeKpis.regionOpenStoreLabel', { store: storeName })}
        className={`tw:col-start-3 ${regionStoreActionClass}`}
        to={model.getRegionStoreDetailPath(row.storeId)}
      >
        {model.t('storeKpis.regionOpenAction')}
        <ArrowRight className="tw:size-4" />
      </Link>
    </article>
  )
}

function MetricMini(input: {
  code: (typeof regionMetricCodes)[number]
  locale: string
  metric: RankingMetricValue | undefined
  noData: string
}) {
  return (
    <div className="tw:text-center">
      <strong className="tw:block tw:text-[13px] tw:font-semibold tw:text-[#071332]">
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
      <span className="tw:inline-flex tw:min-h-7 tw:items-center tw:justify-self-center tw:rounded-full tw:bg-[#ffe6ee] tw:px-2.5 tw:text-xs tw:font-semibold tw:text-[#c52d54]">
        {input.label} {input.model.t('storeKpis.regionChecklistPassive')}
      </span>
    )
  }

  return (
    <span className="tw:inline-flex tw:min-h-7 tw:items-center tw:justify-self-center tw:rounded-full tw:bg-[#ddf8ed] tw:px-2.5 tw:text-xs tw:font-semibold tw:text-[#087751]">
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

function getRegionMetricLabel(code: (typeof regionMetricCodes)[number]) {
  if (code === 'TARGET_ACHIEVEMENT') return 'HG%'
  if (code === 'gsm_approval') return 'GSM Onayı'
  return code
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
