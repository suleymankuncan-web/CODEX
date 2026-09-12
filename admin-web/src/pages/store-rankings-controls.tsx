import { Trophy, Search, X } from 'lucide-react'
import { CalendarPicker } from '@/components/ui/calendar-picker'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { RankingSummary } from '../features/reports/api'
import type { TranslateFunction } from '../features/localization/dictionary'
import type { AppLocale } from '../lib/i18n'
import { normalizeDisplayLabel } from '../lib/display-labels'
import { formatMetricValue, formatNumber, formatPeriod, getMetricHeaderLabel, personnelMetricCodes, storeMetricCodes, type ActiveRankingList } from './store-rankings-page-model'

export function RankingHeader(input: {
  ranking: RankingSummary | undefined; periodStart: string; dayOfMonth: string; rangeStart: string; rangeEnd: string
  onPeriodChange: (period: string, day: string, from?: string, to?: string) => void
  locale: AppLocale; t: TranslateFunction
}) {
  const period = input.periodStart || input.ranking?.source.periodStart || new Date().toISOString().slice(0, 7) + '-01'
  const year = Number(period.slice(0, 4))
  const years = [new Date().getFullYear(), year, ...(input.ranking?.availablePeriods ?? []).map(p => Number(p.periodStart.slice(0, 4)))]
  const fullMonth = !input.dayOfMonth && !input.rangeStart
  const date = input.rangeStart || period.slice(0, 8) + String(input.dayOfMonth || 1).padStart(2, '0')
  const monthEnd = new Date(Date.UTC(year, Number(period.slice(5, 7)), 0)).toISOString().slice(0, 10)
  const label = new Intl.DateTimeFormat(input.locale, { month: 'short', year: 'numeric' }).format(new Date(year, Number(period.slice(5, 7)) - 1, 1))
  return <header className="store-rankings-topbar">
    <div className="store-rankings-title-block">
      <span className="store-rankings-header-icon"><Trophy aria-hidden="true" /></span>
      <div>
        <p className="store-rankings-eyebrow">{input.t('storeRankings.heroEyebrow')}</p>
        <h1 id="rankings-heading">{input.t('storeRankings.pageTitle')}</h1>
        <p>{input.locale === 'tr' ? 'Hesaplamalar seçili dönemdeki mevcut kayıtlara dayanır.' : 'Calculations use the available records in the selected period.'}</p>
      </div>
    </div>
    <CalendarPicker mode="range" locale={input.locale} value={date} end={input.rangeEnd || (fullMonth ? monthEnd : date)} maxRangeDays={366}
      ariaLabel={input.locale === 'tr' ? 'Dönem filtresi' : 'Period filter'}
      triggerClassName="store-rankings-period" triggerContent={fullMonth ? label : undefined}
      minYear={Math.min(...years) - 2} maxYear={Math.max(...years)}
      onFullMonth={value => input.onPeriodChange(value, '')}
      onValueChange={(value, end) => input.onPeriodChange(value.slice(0, 8) + '01', '', value, end || value)} />
  </header>
}

export function RankingFilters(input: {
  ranking: RankingSummary; isPrivileged: boolean; search: string; regionManagerUserId: string
  activeList: ActiveRankingList; onSearchChange: (value: string) => void
  onManagerChange: (value: string) => void; onClear: () => void; locale: AppLocale; t: TranslateFunction
}) {
  const meta = input.activeList === 'stores' ? input.ranking.storeLeaderboard.meta : input.ranking.personnelLeaderboard.meta
  const placeholder = input.activeList === 'stores'
    ? (input.locale === 'tr' ? 'Mağaza Ara' : 'Search stores')
    : (input.locale === 'tr' ? 'Personel Ara' : 'Search personnel')
  return <div className="store-rankings-filters" role="group" aria-label={input.t('storeRankings.filtersEyebrow')}>
      <InputGroup className="store-rankings-search-field">
        <InputGroupAddon><Search aria-hidden="true" /></InputGroupAddon>
        <InputGroupInput type="search" aria-label={input.t('storeRankings.searchLabel')} placeholder={placeholder} value={input.search} onChange={event => input.onSearchChange(event.target.value)} />
        <InputGroupAddon align="inline-end"><Badge variant="secondary">{meta.total}</Badge></InputGroupAddon>
      </InputGroup>
      {input.isPrivileged ? <Select value={input.regionManagerUserId || 'all'} onValueChange={value => input.onManagerChange(value === 'all' ? '' : value)}>
        <SelectTrigger aria-label={input.t('storeRankings.regionManagerFilterLabel')}><SelectValue placeholder={input.t('storeRankings.allRegions')} /></SelectTrigger>
        <SelectContent><SelectGroup>
          <SelectItem value="all">{input.t('storeRankings.allRegions')}</SelectItem>
          {input.ranking.filters.regionManagers.map(manager => <SelectItem key={manager.id} value={manager.id}>{normalizeDisplayLabel(manager.label, input.t('storeRankings.regionManager'))}</SelectItem>)}
        </SelectGroup></SelectContent>
      </Select> : <Badge variant="secondary">{input.t('storeRankings.top100Scope')}</Badge>}
    <Button variant="ghost" size="sm" onClick={input.onClear}><X data-icon="inline-start" aria-hidden="true" />{input.t('storeRankings.clearFilters')}</Button>
  </div>
}

export function RankingReference(input: { ranking: RankingSummary; activeList: ActiveRankingList; locale: AppLocale; t: TranslateFunction }) {
  const reference = input.activeList === 'stores' ? input.ranking.reference?.store : input.ranking.reference?.personnel
  const codes = input.activeList === 'stores' ? storeMetricCodes : personnelMetricCodes
  return <section className="store-rankings-reference-strip" data-list={input.activeList} aria-label={input.t('storeRankings.referenceLabel')}>
    <div className="store-rankings-reference-title"><h2>{input.t('storeRankings.turkeyReference')}</h2><p>{formatPeriod(input.ranking.source, input.locale, input.t)}</p></div>
    <dl>
      <div><dt>{input.t('storeRankings.averageScore')}</dt><dd>{formatNumber(input.locale, input.t, reference?.averageScore)}</dd></div>
      {codes.map(code => <div key={code}><dt>{getMetricHeaderLabel(input.t, code)}</dt><dd>{formatMetricValue(input.locale, input.t, reference?.metrics.find(metric => metric.code === code)?.value, code)}</dd></div>)}
    </dl>
  </section>
}
