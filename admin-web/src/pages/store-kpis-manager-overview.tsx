import { useMemo, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router'
import type { UseQueryResult } from '@tanstack/react-query'
import { BarChart3, ReceiptText, ShoppingBag, RefreshCw, ClipboardCheck, Search, ArrowDown, ArrowUp, ArrowLeft, ArrowRight, UsersRound, Info } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableHeader, TableHead, TableRow, TableBody, TableCell } from '@/components/ui/table'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { StoreKpisPeriodPicker } from './store-kpis-period-picker'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { CommandCanvasPage } from '../features/store-command-canvas/primitives'
import type { getRankings, PersonnelRankingRow } from '../features/reports/api'
import { ApiError } from '../lib/api'
import { matchesKpiMetricCode } from '../features/kpi/score-profiles'
import type { StoreKpiHighlightsPageModel } from './store-kpi-highlights-model'
import { formatMetricValue, resolveLocalizedKpiScoreReference } from './store-kpi-highlights-formatters'
import { toHundredPointLiveStoreScore } from './store-kpis-command-contract'
import { personnelStoreScoreImpact } from './store-kpis-personnel-impact'
import { StoreKpisPeriodEmpty } from './store-kpis-period-empty'
import { StoreEmptyState, StoreErrorState, StoreLoadingState } from './store-surface-primitives'
import './store-kpis-region-command-canvas.css'
import './store-kpis-manager-overview.css'
import { StoreManagerScoreChart, StoreManagerMetricDialog } from './store-kpis-manager-insights'

type PersonnelData = {
  rows: PersonnelRankingRow[]
  total: number
  page: number
  pageSize: number
  search: string
  onSearchChange: (value: string) => void
  onPageChange: (page: number) => void
  query: UseQueryResult<Awaited<ReturnType<typeof getRankings>>, unknown>
}
const storeColumns = [
  ['TARGET_ACHIEVEMENT', 'HG%'], ['ATV', 'ATV'], ['UPT', 'UPT'], ['CR', 'CR'],
  ['gsm_approval', 'GSM'], ['BM_CHECKLIST', 'BM'], ['VM_CHECKLIST', 'VM'],
] as const
const peopleColumns = [['score', 'Skor'], ['TARGET_ACHIEVEMENT', 'HG%'], ['ATV', 'ATV'], ['UPT', 'UPT'], ['storeScoreImpact', 'Mağaza Skor Etkisi']] as const
type PeopleSort = (typeof peopleColumns)[number][0]

export function StoreKpisManagerOverview({ model, personnel, backgroundError }: {
  model: StoreKpiHighlightsPageModel
  personnel: PersonnelData
  backgroundError: ReactNode
}) {
  const tr = model.locale === 'tr'
  const [params, setParams] = useSearchParams()
  const showPeople = params.get('view') === 'personnel'
  const overviewParams = new URLSearchParams(params)
  overviewParams.delete('storeId')
  overviewParams.delete('view')
  if (!overviewParams.has('periodStart') && model.livePeriodStart) overviewParams.set('periodStart', model.livePeriodStart)
  const switchView = () => { const next = new URLSearchParams(params); if (showPeople) next.delete('view'); else next.set('view', 'personnel'); setParams(next) }
  const { search } = personnel
  const [selectedKpi, setSelectedKpi] = useState<string | null>(null)
  const [sort, setSort] = useState<{ key: PeopleSort; ascending: boolean }>({ key: 'score', ascending: false })
  const noData = model.t('storeKpis.noData')
  const metric = (code: string) => model.rows.find(row => row.kpiCode.toLowerCase() === code.toLowerCase())
  const value = (code: string) => {
    const row = metric(code)
    if (!row || row.actualValue === null) return noData
    if (code === 'TARGET_ACHIEVEMENT' || code === 'ATV') return new Intl.NumberFormat(model.locale, { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(Number(row.actualValue))
    if (code === 'UPT') return numeric(row.actualValue, model.locale, 2)
    return formatMetricValue(model.locale, model.t, row.actualValue, code)
  }
  const scoreValue = model.viewMode === 'live'
    ? model.liveSummary?.score.matchedMetrics ? finite(model.liveSummary.score.value) : null
    : model.weightedScore.coveredWeight > 0 ? model.weightedScore.scoreValue : null
  const score = scoreValue === null ? noData : numeric(toHundredPointLiveStoreScore(scoreValue), model.locale, 1)
  const storeScorePoints = toHundredPointLiveStoreScore(scoreValue)
  const displayedStoreScore = storeScorePoints === null ? null : Math.round(storeScorePoints * 10) / 10
  const cards = [
    { code: 'score', label: tr ? 'Mağaza Skoru' : 'Store Score', value: score, icon: BarChart3 },
    { code: 'ATV', label: tr ? 'Mağaza ATV' : 'Store ATV', value: value('ATV'), icon: ReceiptText },
    { code: 'UPT', label: tr ? 'Mağaza UPT' : 'Store UPT', value: value('UPT'), icon: ShoppingBag },
    { code: 'CR', label: tr ? 'Mağaza CR' : 'Store CR', value: value('CR'), icon: RefreshCw },
  ]
  const storeMetricLabels: Record<string, string> = tr
    ? { TARGET_ACHIEVEMENT: 'Hedef Gerçekleşme', ATV: 'Ortalama Fiş Tutarı', UPT: 'Fiş Başına Ürün', CR: 'Dönüşüm Oranı', gsm_approval: 'GSM Onayı', BM_CHECKLIST: 'Bölge Müdürü Checklist', VM_CHECKLIST: 'VM Checklist' }
    : { TARGET_ACHIEVEMENT: 'Target Achievement', ATV: 'Average Ticket Value', UPT: 'Units Per Ticket', CR: 'Conversion Rate', gsm_approval: 'GSM Approval', BM_CHECKLIST: 'Region Manager Checklist', VM_CHECKLIST: 'VM Checklist' }
  const periodStart = (model.livePeriodStart || model.liveSummary?.period?.periodStart || model.routePeriodStart).slice(0, 10)
  const scope = `${model.effectiveStoreId}|${periodStart}|${model.kpiDateRangeEnd}|${model.viewMode}`
  const people = useMemo(() => personnel.rows.filter(row => !search.trim() || (row.displayName ?? '').toLocaleLowerCase(model.locale).includes(search.trim().toLocaleLowerCase(model.locale))).sort((a, b) => {
    const left = personMetric(a, sort.key, model.effectiveStoreId, displayedStoreScore)
    const right = personMetric(b, sort.key, model.effectiveStoreId, displayedStoreScore)
    if (left === null) return right === null ? 0 : 1
    if (right === null) return -1
    return (left - right) * (sort.ascending ? 1 : -1)
  }), [personnel.rows, search, sort, model.locale, model.effectiveStoreId, displayedStoreScore])
  const SortIcon = sort.ascending ? ArrowUp : ArrowDown
  const protectedPersonnelError = personnel.query.error instanceof ApiError && (personnel.query.error.status === 401 || personnel.query.error.status === 403)
  const personValue = (row: PersonnelRankingRow, code: PeopleSort) => {
    const actual = personMetric(row, code, model.effectiveStoreId, displayedStoreScore)
    if (code === 'storeScoreImpact') return actual === null ? (tr ? 'Hesaplanamadı' : 'Unavailable') : `${numeric(actual, model.locale, 2)} ${tr ? 'puan' : 'pts'}`
    if (actual === null) return code === 'TARGET_ACHIEVEMENT' && finite(row.metrics?.find(metric => metric.code === code)?.actualValue) !== null ? model.t('storeKpis.targetWaiting') : noData
    if (code === 'ATV') return new Intl.NumberFormat(model.locale, { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(actual)
    if (code === 'TARGET_ACHIEVEMENT') return `%${numeric(actual * 100, model.locale, 1)}`
    return numeric(actual, model.locale, code === 'UPT' ? 2 : 1)
  }
  const detail = (row: PersonnelRankingRow) => {
    if (!row.canOpenProfile || !row.employeeId) return <span>{noData}</span>
    const params = new URLSearchParams({ mode: 'live', periodType: model.livePeriodType })
    if (periodStart) params.set('periodStart', periodStart)
    if (model.kpiDateRangeEnd) params.set('periodEnd', model.kpiDateRangeEnd)
    return <Button asChild size="xs" className="region-performance-detail"><Link to={`/store/personnel/${encodeURIComponent(row.employeeId)}?${params}`} aria-label={`${row.displayName} — ${tr ? 'Detay' : 'Details'}`}><ClipboardCheck aria-hidden="true" /><span>{tr ? 'Detay' : 'Details'}</span></Link></Button>
  }
  const personnelSearch = <InputGroup className="region-performance-header-search"><InputGroupAddon><Search aria-hidden="true" /></InputGroupAddon><InputGroupInput aria-label={tr ? 'Personel ara' : 'Search personnel'} placeholder={tr ? 'Personel Ara' : 'Search personnel'} value={search} onChange={event => personnel.onSearchChange(event.target.value)} /><InputGroupAddon align="inline-end"><Badge variant="secondary">{protectedPersonnelError ? 0 : personnel.total}</Badge></InputGroupAddon></InputGroup>

  return <CommandCanvasPage ariaLabelledBy="manager-kpi-title" className="region-performance manager-performance" testId="store-kpis-manager-overview">
    {model.isRegionManagerStoreDetail || model.isReportViewerStoreDetail ? <Button asChild variant="ghost" size="sm" className="tw:self-start"><Link to={`/store/kpis?${overviewParams}`}><ArrowLeft aria-hidden="true" />{tr ? 'Mağaza listesine dön' : 'Back to store list'}</Link></Button> : null}
    <header className="manager-performance-hero">
      <div className="manager-performance-title"><span className="manager-performance-icon"><BarChart3 aria-hidden="true" /></span><div>
        <p>{showPeople ? (tr ? 'Personel Performansı' : 'Personnel Performance') : (tr ? 'Mağaza Performansı' : 'Store Performance')}</p><h1 id="manager-kpi-title">{model.activeStoreName}</h1>
        <p>{model.isRegionManagerStoreDetail ? (tr ? 'Mağazanın ve ekibinin KPI değerlerini inceleyin.' : 'Review KPI results for this store and its team.') : (tr ? 'Mağazanızın ve ekibinizin KPI değerlerini inceleyin.' : 'Review KPI results for your store and team.')}</p>
      </div></div>
      <div className="manager-performance-period"><Button variant="outline" className="manager-performance-view-button" onClick={switchView}>{showPeople ? <BarChart3 aria-hidden="true" /> : <UsersRound aria-hidden="true" />}<span>{showPeople ? (tr ? 'Mağaza Performansı' : 'Store Performance') : (tr ? 'Personel Performansı' : 'Personnel Performance')}</span><ArrowRight aria-hidden="true" /></Button><StoreKpisPeriodPicker locale={model.locale} periodType={model.livePeriodType} periodStart={periodStart} onPeriodStartChange={model.setLivePeriodStart} onRangeChange={model.setKpiDateRange} ariaLabel={tr ? 'Dönem seç' : 'Select period'} /></div>
    </header>
    {backgroundError}
    {!showPeople ? <>
    <div className="region-performance-metrics" role="group" aria-label={tr ? 'Mağaza KPI özeti' : 'Store KPI summary'}>
      {cards.map(({ code, label, value: cardValue, icon: Icon }) => <Card key={label} size="sm" onClick={() => setSelectedKpi(code)}><CardHeader><CardTitle><Icon aria-hidden="true" /><span>{label}</span></CardTitle></CardHeader><CardContent><Button variant="link" className="manager-metric-trigger" aria-label={`${label} detaylarını aç`} onClick={() => setSelectedKpi(code)}><strong>{cardValue}</strong></Button></CardContent></Card>)}
    </div>
    {model.viewMode === 'live' && model.liveKpiQuery.isSuccess && !model.rows.some(row => row.actualValue !== null) ? <StoreKpisPeriodEmpty locale={model.locale} start={model.livePeriodStart} end={model.kpiDateRangeEnd || (model.livePeriodType === 'daily' ? model.livePeriodStart : undefined)} /> : null}
    <section className="region-performance-stores manager-performance-store" aria-label={tr ? 'Mağaza KPI değerleri' : 'Store KPI values'}>
      <Table><TableHeader><TableRow><TableHead>{tr ? 'Performans göstergesi' : 'Performance metric'}</TableHead><TableHead>{tr ? 'Gerçekleşen' : 'Actual'}</TableHead><TableHead>{tr ? 'Ortalama Değerler' : 'Average Values'}</TableHead><TableHead>{tr ? 'Gerçekleşme Oranı' : 'Achievement Rate'}</TableHead><TableHead>{tr ? 'Ağırlık' : 'Weight'}</TableHead><TableHead>{tr ? 'Skora Katkı' : 'Score Contribution'}</TableHead></TableRow></TableHeader>
        <TableBody>{storeColumns.map(([code, label]) => { const row = metric(code); const weight = model.storeKpiScoreProfile?.metrics.find(item => matchesKpiMetricCode(item, code))?.weightPercent; const reference = row ? resolveLocalizedKpiScoreReference(model.t, {targetValue: row.targetValue, ...(row.benchmarkValue === undefined ? {} : {benchmarkValue: row.benchmarkValue}), benchmarkSource: row.benchmarkSource ?? null}).value : null; return <TableRow key={code} className="manager-performance-kpi-row" onClick={() => setSelectedKpi(code)}><TableCell><strong>{storeMetricLabels[code]}</strong><span className="manager-metric-code">{label}</span></TableCell><TableCell data-label={tr ? 'Gerçekleşen' : 'Actual'}><Button variant="link" className="manager-metric-trigger" aria-haspopup="dialog" onClick={() => setSelectedKpi(code)} aria-label={`${label} ${tr ? 'detaylarını aç' : 'details'}`}>{value(code)}</Button></TableCell><TableCell data-label={tr ? 'Ortalama Değerler' : 'Average Values'}>{code === 'TARGET_ACHIEVEMENT' ? (reference == null ? noData : new Intl.NumberFormat(model.locale,{style:'currency',currency:'TRY',maximumFractionDigits:0}).format(Number(reference))) : formatMetricValue(model.locale, model.t, reference == null ? null : String(reference), code)}</TableCell><TableCell data-label={tr ? 'Gerçekleşme Oranı' : 'Achievement Rate'}>{row?.actualValue != null && reference != null && Number(reference) !== 0 ? new Intl.NumberFormat(model.locale, {style:'percent', maximumFractionDigits:1}).format(Number(row.actualValue)/Math.abs(Number(reference))) : noData}</TableCell><TableCell data-label={tr ? 'Ağırlık' : 'Weight'}>{weight == null ? noData : new Intl.NumberFormat(model.locale, { style: 'percent', maximumFractionDigits: 2 }).format(weight / 100)}</TableCell><TableCell data-label={tr ? 'Skora Katkı' : 'Score Contribution'} className="manager-performance-contribution">{row?.scoreContribution == null ? noData : `${numeric(row.scoreContribution, model.locale, 2)} ${tr ? 'puan' : 'pts'}`}</TableCell></TableRow> })}</TableBody>
      </Table>
    </section>
    <Alert className="manager-performance-checklist-note"><Info aria-hidden="true" /><AlertTitle>{tr ? 'Checklistlerin skora etkisi' : 'Checklist score contribution'}</AlertTitle><AlertDescription>{tr ? 'BM veya VM checklisti yapılmadığında, ilgili checklistin ağırlığı sıralama skorunda diğer KPI’lara mevcut ağırlıkları oranında dağıtılır. Checklist tamamlandığında kendi puanıyla hesaba katılır. Yukarıdaki Skora Katkı sütunu, bu dağıtım öncesindeki KPI katkılarını gösterir.' : 'When a BM or VM checklist is not completed, its weight is redistributed proportionally to the other KPIs in the ranking score. Completed checklists contribute their own score. The Score Contribution column above shows KPI contributions before redistribution.'}</AlertDescription></Alert>
    <StoreManagerScoreChart model={model} />
    </> : <>
    <section className="region-performance-stores manager-performance-people" aria-label={tr ? 'Personel KPI' : 'Personnel KPI'} key={scope}>
      <div className="manager-performance-people-toolbar">{personnelSearch}</div>
      {personnel.query.isLoading && !personnel.query.data ? <StoreLoadingState title={model.t('storeKpis.loadingTitle')} description={model.t('storeKpis.loadingCopy')} />
        : protectedPersonnelError || (personnel.query.isError && !personnel.query.data) ? <StoreErrorState title={model.t('storeKpis.rowsErrorTitle')} description={model.t('storeKpis.personnelKpiUnavailableCopy')} action={{ label: model.t('storeKpis.retry'), onClick: () => void personnel.query.refetch() }} />
        : <>
          {personnel.query.isError ? <Alert variant="destructive"><AlertDescription>{model.t('storeKpis.backgroundError')}<Button variant="outline" onClick={() => void personnel.query.refetch()}>{model.t('storeKpis.retry')}</Button></AlertDescription></Alert> : null}
          <Table><TableHeader><TableRow><TableHead>{personnelSearch}</TableHead>{peopleColumns.map(([code, label]) => <TableHead key={code} aria-sort={sort.key === code ? sort.ascending ? 'ascending' : 'descending' : 'none'}><Button variant="ghost" size="sm" onClick={() => setSort({ key: code, ascending: sort.key === code ? !sort.ascending : false })}>{label}{sort.key === code ? <SortIcon aria-hidden="true" /> : null}</Button></TableHead>)}<TableHead><span className="tw:sr-only">{tr ? 'Detay' : 'Details'}</span></TableHead></TableRow></TableHeader>
            <TableBody>{people.map(row => <TableRow key={row.employeeId}><TableCell><strong>{row.displayName}</strong></TableCell>{peopleColumns.map(([code, label]) => <TableCell key={code} data-label={label} className={code === 'storeScoreImpact' ? 'manager-performance-contribution' : undefined}>{personValue(row, code)}</TableCell>)}<TableCell>{detail(row)}</TableCell></TableRow>)}</TableBody>
          </Table>
          {!people.length ? <StoreEmptyState title={search ? (tr ? 'Personel bulunamadı' : 'No matching personnel') : model.t('storeKpis.personnelKpiEmptyTitle')} description={search ? (tr ? 'Aramanızı değiştirerek tekrar deneyin.' : 'Try a different search.') : model.t('storeKpis.personnelKpiEmptyCopy')} /> : null}
          {personnel.total > personnel.pageSize ? <nav className="region-performance-pager" aria-label={model.t('storeKpis.personnelPaginationLabel')}><Button variant="outline" disabled={personnel.page === 0 || personnel.query.isFetching} onClick={() => personnel.onPageChange(personnel.page - 1)}>{model.t('storeKpis.companyPrevious')}</Button><span>{personnel.page + 1} / {Math.ceil(personnel.total / personnel.pageSize)}</span><Button variant="outline" disabled={(personnel.page + 1) * personnel.pageSize >= personnel.total || personnel.query.isFetching} onClick={() => personnel.onPageChange(personnel.page + 1)}>{model.t('storeKpis.companyNext')}</Button></nav> : null}
        </>}
    </section>
    <Alert className="manager-performance-checklist-note"><Info aria-hidden="true" /><AlertTitle>{tr ? 'Mağaza Skor Etkisi nasıl hesaplanır?' : 'How is store score impact allocated?'}</AlertTitle><AlertDescription><span>{tr ? `Mağaza skoru (${score} puan), net satış × personel KPI skoru oranında satış ekibine paylaştırılır. Ortak GSM ve checklist sonuçları da bu toplamın içindedir; kişisel olarak ölçülmüş başarı anlamına gelmez. Eksik veriyle hesap yapılmaz. Negatif net satışın payı sıfırdır; yuvarlama nedeniyle toplamda küçük farklar olabilir.` : `The store score (${score} points) is allocated across the sales team in proportion to net sales × personnel KPI score. Shared GSM and checklist outcomes are included in that total; this is not individually measured or causal impact. Missing inputs remain unavailable. Negative net sales receive zero share; rounding can cause small total differences.`}</span></AlertDescription></Alert>
    </>}
    {selectedKpi ? <StoreManagerMetricDialog model={model} code={selectedKpi} onClose={() => setSelectedKpi(null)} rankings={personnel.query.data} rankingLoading={personnel.query.isLoading} rankingError={personnel.query.isError} retryRankings={() => void personnel.query.refetch()} /> : null}
  </CommandCanvasPage>
}

function finite(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}
function numeric(value: unknown, locale: string, decimals: number) {
  const number = finite(value)
  return number === null ? '—' : new Intl.NumberFormat(locale, { minimumFractionDigits: decimals === 2 ? 2 : 0, maximumFractionDigits: decimals }).format(number)
}
function personMetric(row: PersonnelRankingRow, code: PeopleSort, storeId?: string, storeScore: number | null = null) {
  if (code === 'storeScoreImpact') return personnelStoreScoreImpact(row, storeId, storeScore)
  if (code === 'score') return finite(row.scoreValue)
  const metric = row.metrics?.find(metric => metric.code === code)
  const actual = finite(metric?.actualValue)
  if (code !== 'TARGET_ACHIEVEMENT') return actual
  const target = finite(metric?.targetValue) ?? finite(metric?.benchmarkValue)
  return actual === null || target === null || target === 0 ? null : actual / Math.abs(target)
}
